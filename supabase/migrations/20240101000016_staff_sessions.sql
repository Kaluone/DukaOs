-- ============================================================
-- DukaOS — Staff Session Management
-- 20240101000016_staff_sessions.sql
--
-- Replaces client-side PIN comparison with server-side session
-- tokens. Owner can revoke sessions per-device or force-logout
-- all devices for a staff member.
-- ============================================================

-- Session config columns on shops
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS max_concurrent_sessions INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS session_duration_hours  INT  NOT NULL DEFAULT 12;

-- ─── Sessions Table ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_sessions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id       UUID        NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shop_id        UUID        NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  session_token  UUID        NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  device_id      TEXT,
  device_label   TEXT,
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT now() + INTERVAL '12 hours',
  is_revoked     BOOLEAN     NOT NULL DEFAULT false,
  revoked_by     TEXT,
  revoked_at     TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.staff_sessions(staff_id, is_revoked);
CREATE INDEX ON public.staff_sessions(session_token) WHERE is_revoked = false;
CREATE INDEX ON public.staff_sessions(shop_id, expires_at);

ALTER TABLE public.staff_sessions ENABLE ROW LEVEL SECURITY;

-- Only the shop owner can see/manage sessions for their shop
CREATE POLICY "owner_staff_sessions_all" ON public.staff_sessions
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

-- ─── RPC: Staff Login ─────────────────────────────────────────────────────────
-- Verifies staff PIN server-side and returns a session token.
-- Removes the security gap of exposing pin_hash to the browser.

CREATE OR REPLACE FUNCTION public.rpc_staff_login(
  p_shop_id      UUID,
  p_staff_id     UUID,
  p_pin_hash     TEXT,
  p_device_id    TEXT    DEFAULT NULL,
  p_device_label TEXT    DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_staff   public.staff;
  v_shop    public.shops;
  v_session public.staff_sessions;
  v_active  INT;
BEGIN
  -- Caller must own the shop
  SELECT * INTO v_shop FROM public.shops
  WHERE id = p_shop_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  -- Verify staff PIN
  SELECT * INTO v_staff FROM public.staff
  WHERE id = p_staff_id
    AND shop_id = p_shop_id
    AND pin_hash = p_pin_hash
    AND active = true
    AND (suspended IS NULL OR suspended = false);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PIN si sahihi' USING ERRCODE = '42501';
  END IF;

  -- Enforce concurrent session limit (0 = unlimited)
  IF v_shop.max_concurrent_sessions > 0 THEN
    SELECT COUNT(*) INTO v_active
    FROM public.staff_sessions
    WHERE staff_id = v_staff.id AND is_revoked = false AND expires_at > now();

    IF v_active >= v_shop.max_concurrent_sessions THEN
      -- Revoke oldest session to make room
      UPDATE public.staff_sessions
      SET is_revoked = true, revoked_by = 'system_limit', revoked_at = now()
      WHERE id = (
        SELECT id FROM public.staff_sessions
        WHERE staff_id = v_staff.id AND is_revoked = false AND expires_at > now()
        ORDER BY last_seen_at ASC LIMIT 1
      );
    END IF;
  END IF;

  -- Create new session
  INSERT INTO public.staff_sessions (
    staff_id, shop_id, device_id, device_label, expires_at
  ) VALUES (
    v_staff.id, p_shop_id, p_device_id, p_device_label,
    now() + (v_shop.session_duration_hours::text || ' hours')::INTERVAL
  )
  RETURNING * INTO v_session;

  UPDATE public.staff SET last_login_at = now() WHERE id = v_staff.id;

  RETURN jsonb_build_object(
    'session_token', v_session.session_token,
    'expires_at',    v_session.expires_at,
    'staff',         row_to_json(v_staff)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_staff_login(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- ─── RPC: Session Heartbeat ───────────────────────────────────────────────────
-- Called every 5 min from EmployeeLayout. Returns false if revoked/expired.

CREATE OR REPLACE FUNCTION public.rpc_staff_session_heartbeat(
  p_session_token UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE public.staff_sessions SET last_seen_at = now()
  WHERE session_token = p_session_token
    AND is_revoked = false
    AND expires_at > now()
    AND shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid());
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_staff_session_heartbeat(UUID) TO authenticated;

-- ─── RPC: Revoke One Session ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_revoke_staff_session(
  p_session_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE public.staff_sessions
  SET is_revoked = true, revoked_by = 'owner', revoked_at = now()
  WHERE id = p_session_id
    AND shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid());
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_revoke_staff_session(UUID) TO authenticated;

-- ─── RPC: Revoke All Sessions for a Staff Member ─────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_revoke_all_staff_sessions(
  p_staff_id UUID
) RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE public.staff_sessions
  SET is_revoked = true, revoked_by = 'owner_force_logout', revoked_at = now()
  WHERE staff_id = p_staff_id
    AND is_revoked = false
    AND shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid());
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_revoke_all_staff_sessions(UUID) TO authenticated;

-- ─── RPC: Update Session Settings ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_update_session_settings(
  p_shop_id             UUID,
  p_max_concurrent      INT  DEFAULT 1,
  p_duration_hours      INT  DEFAULT 12
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.shops
  SET max_concurrent_sessions = p_max_concurrent,
      session_duration_hours  = p_duration_hours
  WHERE id = p_shop_id AND owner_user_id = auth.uid();
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_update_session_settings(UUID, INT, INT) TO authenticated;
