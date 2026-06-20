-- ============================================================
-- DukaOS — ARC Broadcast Center
-- 20240101000013_arc_broadcasts.sql
-- ============================================================

-- ─── ARC BROADCASTS (outbound messages from ARC to tenants) ─────────────────

CREATE TABLE IF NOT EXISTS public.arc_broadcasts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by      UUID REFERENCES public.arc_admins(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  type            TEXT NOT NULL DEFAULT 'announcement'
                  CHECK (type IN ('announcement','maintenance','billing','feature','alert')),
  recipient_type  TEXT NOT NULL DEFAULT 'all'
                  CHECK (recipient_type IN ('all','by_plan','by_status','specific')),
  recipient_plans TEXT[] DEFAULT NULL,
  recipient_shop_ids UUID[] DEFAULT NULL,
  channels        TEXT[] NOT NULL DEFAULT ARRAY['in_app'],
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','sent','scheduled')),
  sent_at         TIMESTAMPTZ,
  scheduled_at    TIMESTAMPTZ,
  recipient_count INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_arc_broadcasts_status  ON public.arc_broadcasts(status);
CREATE INDEX IF NOT EXISTS idx_arc_broadcasts_created ON public.arc_broadcasts(created_at DESC);

ALTER TABLE public.arc_broadcasts ENABLE ROW LEVEL SECURITY;

-- ARC admins can do everything
CREATE POLICY "arc_admin_broadcasts_all" ON public.arc_broadcasts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.arc_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- ─── TENANT BROADCAST INBOX (broadcasts visible to each tenant) ─────────────

CREATE TABLE IF NOT EXISTS public.arc_broadcast_deliveries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES public.arc_broadcasts(id) ON DELETE CASCADE,
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  read_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (broadcast_id, shop_id)
);

CREATE INDEX IF NOT EXISTS idx_bcast_delivery_shop ON public.arc_broadcast_deliveries(shop_id);
CREATE INDEX IF NOT EXISTS idx_bcast_delivery_read ON public.arc_broadcast_deliveries(shop_id, is_read);

ALTER TABLE public.arc_broadcast_deliveries ENABLE ROW LEVEL SECURITY;

-- ARC admins can manage all deliveries
CREATE POLICY "arc_admin_deliveries_all" ON public.arc_broadcast_deliveries
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.arc_admins
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Tenants can read their own deliveries (to show inbox in their dashboard)
CREATE POLICY "tenant_deliveries_read" ON public.arc_broadcast_deliveries
  FOR SELECT USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "tenant_deliveries_mark_read" ON public.arc_broadcast_deliveries
  FOR UPDATE USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

-- ─── RPC: SEND BROADCAST ──────────────────────────────────────────────────────
-- Creates the broadcast, fans out delivery rows to all matching shops,
-- and marks it as sent.  Email/SMS delivery is intentionally left as a
-- stub so the caller can wire their own provider via Snippet.

CREATE OR REPLACE FUNCTION public.rpc_arc_send_broadcast(
  p_subject         TEXT,
  p_body            TEXT,
  p_type            TEXT DEFAULT 'announcement',
  p_recipient_type  TEXT DEFAULT 'all',
  p_recipient_plans TEXT[] DEFAULT NULL,
  p_recipient_ids   UUID[] DEFAULT NULL,
  p_channels        TEXT[] DEFAULT ARRAY['in_app']
) RETURNS public.arc_broadcasts
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_admin   public.arc_admins;
  v_bcast   public.arc_broadcasts;
  v_count   INT;
BEGIN
  -- Verify caller is an active ARC admin
  SELECT * INTO v_admin
  FROM   public.arc_admins
  WHERE  user_id = auth.uid() AND is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: ARC admin access required' USING ERRCODE = '42501';
  END IF;

  -- Insert broadcast record
  INSERT INTO public.arc_broadcasts (
    created_by, subject, body, type,
    recipient_type, recipient_plans, recipient_shop_ids, channels,
    status, sent_at
  ) VALUES (
    v_admin.id, p_subject, p_body, p_type,
    p_recipient_type, p_recipient_plans, p_recipient_ids, p_channels,
    'sent', now()
  )
  RETURNING * INTO v_bcast;

  -- Fan out delivery rows to matching shops
  INSERT INTO public.arc_broadcast_deliveries (broadcast_id, shop_id)
  SELECT v_bcast.id, s.id
  FROM   public.shops s
  LEFT JOIN public.shop_subscriptions ss ON ss.shop_id = s.id
  WHERE
    CASE p_recipient_type
      WHEN 'all'       THEN true
      WHEN 'by_plan'   THEN ss.plan_name = ANY(p_recipient_plans)
      WHEN 'by_status' THEN ss.status    = ANY(p_recipient_plans)  -- reuse field for status filter
      WHEN 'specific'  THEN s.id         = ANY(p_recipient_ids)
      ELSE false
    END
  ON CONFLICT (broadcast_id, shop_id) DO NOTHING;

  -- Update recipient count
  GET DIAGNOSTICS v_count = ROW_COUNT;
  UPDATE public.arc_broadcasts SET recipient_count = v_count WHERE id = v_bcast.id;
  v_bcast.recipient_count := v_count;

  RETURN v_bcast;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_arc_send_broadcast(TEXT, TEXT, TEXT, TEXT, TEXT[], UUID[], TEXT[])
  TO authenticated;
