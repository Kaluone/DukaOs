-- ============================================================
-- DukaOS — Payment Events (Provider-Agnostic Interface)
-- 20240101000015_payment_events.sql
--
-- This table is the integration surface for payment providers.
-- Wire your Snippet here: insert a row on every payment event.
-- ARC reads this table for monitoring; no provider is hardcoded.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payment_events (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id           UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type        TEXT    NOT NULL
    CHECK (event_type IN (
      'payment_initiated',
      'payment_success',
      'payment_failed',
      'payment_retried',
      'refund_issued',
      'subscription_renewed',
      'subscription_cancelled',
      'subscription_upgraded',
      'subscription_downgraded'
    )),
  amount            NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency          TEXT    NOT NULL DEFAULT 'TZS',
  plan_name         TEXT,
  billing_cycle     TEXT    CHECK (billing_cycle IN ('monthly','annual') OR billing_cycle IS NULL),
  provider          TEXT,           -- 'mpesa', 'airtel_money', 'stripe', 'tigopesa', etc.
  provider_event_id TEXT,           -- External reference from your provider (idempotency key)
  provider_ref      TEXT,           -- Human-readable reference (e.g. M-Pesa transaction code)
  error_code        TEXT,           -- Provider error code for failed payments
  error_message     TEXT,           -- Human-readable failure reason
  retry_count       INT     NOT NULL DEFAULT 0,
  resolved          BOOLEAN NOT NULL DEFAULT false,  -- ARC marked as resolved / written off
  resolved_by       TEXT,           -- ARC admin email
  resolved_at       TIMESTAMPTZ,
  resolution_note   TEXT,
  metadata          JSONB   NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_shop    ON public.payment_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_type    ON public.payment_events(event_type);
CREATE INDEX IF NOT EXISTS idx_payment_events_created ON public.payment_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_events_failed  ON public.payment_events(event_type, resolved)
  WHERE event_type = 'payment_failed';

-- Unique constraint: one record per provider event (prevents duplicate inserts)
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_ref
  ON public.payment_events(provider, provider_event_id)
  WHERE provider IS NOT NULL AND provider_event_id IS NOT NULL;

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ARC admins can read and update all payment events
CREATE POLICY "arc_admin_payment_events_all" ON public.payment_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.arc_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Shops can INSERT their own payment events (provider webhook via service role bypasses this)
-- but owners can read their own payment history
CREATE POLICY "shop_owner_payment_events_read" ON public.payment_events
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

-- ─── ARC RPC: RESOLVE FAILED PAYMENT ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_arc_resolve_payment(
  p_event_id       UUID,
  p_resolution_note TEXT DEFAULT NULL
) RETURNS public.payment_events
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin  public.arc_admins;
  v_result public.payment_events;
BEGIN
  SELECT * INTO v_admin
  FROM   public.arc_admins
  WHERE  user_id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payment_events SET
    resolved        = true,
    resolved_by     = v_admin.email,
    resolved_at     = now(),
    resolution_note = p_resolution_note
  WHERE id = p_event_id AND event_type = 'payment_failed'
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment event not found or already resolved';
  END IF;

  -- Audit log
  INSERT INTO public.arc_audit_logs (admin_id, admin_email, admin_role, action, resource_type, resource_id, details)
  VALUES (v_admin.id, v_admin.email, v_admin.role,
    'payment.resolve', 'payment_event', p_event_id::text,
    jsonb_build_object('note', p_resolution_note));

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_arc_resolve_payment(UUID, TEXT) TO authenticated;

-- ─── VIEW: UPCOMING RENEWALS (next 60 days) ──────────────────────────────────

CREATE OR REPLACE VIEW public.arc_upcoming_renewals
  WITH (security_barrier = true) AS
SELECT
  ss.id            AS subscription_id,
  ss.shop_id,
  ss.plan_name,
  ss.status        AS sub_status,
  ss.billing_cycle,
  ss.current_period_end,
  ss.trial_ends_at,
  s.name           AS shop_name,
  s.phone          AS shop_phone,
  u.email          AS owner_email,
  u.raw_user_meta_data->>'full_name' AS owner_name,
  EXTRACT(DAY FROM (ss.current_period_end - now()))::int AS days_until_renewal,
  -- Risk scoring
  CASE
    WHEN ss.status = 'grace'                                                              THEN 'critical'
    WHEN ss.status = 'trial' AND ss.trial_ends_at < now() + INTERVAL '3 days'            THEN 'high'
    WHEN EXTRACT(DAY FROM (ss.current_period_end - now())) <= 3                          THEN 'high'
    WHEN EXTRACT(DAY FROM (ss.current_period_end - now())) <= 7                          THEN 'medium'
    ELSE                                                                                      'low'
  END              AS risk_level
FROM public.shop_subscriptions ss
JOIN public.shops s ON s.id = ss.shop_id
LEFT JOIN auth.users u ON u.id = s.owner_user_id
WHERE ss.current_period_end <= now() + INTERVAL '60 days'
  AND ss.status NOT IN ('cancelled', 'expired')
  AND EXISTS (
    SELECT 1 FROM public.arc_admins
    WHERE user_id = auth.uid() AND is_active = true
  )
ORDER BY ss.current_period_end ASC;

GRANT SELECT ON public.arc_upcoming_renewals TO authenticated;
