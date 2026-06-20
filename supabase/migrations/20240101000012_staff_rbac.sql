-- ============================================================
-- DukaOS — Staff RBAC: Database-Level Permission Enforcement
-- 20240101000012_staff_rbac.sql
--
-- Architecture note:
--   Staff use the owner's Supabase JWT (PIN-based mode runs
--   inside the owner's auth session). This means RLS alone
--   cannot distinguish "owner" from "staff". The solution:
--   SECURITY DEFINER RPC functions that verify BOTH:
--     (a) The calling auth.uid() owns the shop
--     (b) The passed staff_id has the required permission
--   Staff operations go through these RPCs; direct table
--   access is still governed by shop-ownership RLS (for the
--   owner dashboard). Full JWT-per-staff is Phase 2.
-- ============================================================


-- ─── CORE HELPER: CHECK ONE PERMISSION ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_staff_has_permission(
  p_staff_id   UUID,
  p_shop_id    UUID,
  p_permission TEXT
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.staff_permissions sp
    JOIN   public.staff s ON s.id = sp.staff_id
    WHERE  sp.staff_id = p_staff_id
      AND  s.shop_id   = p_shop_id
      AND  s.active    = true
      AND  s.suspended = false
      AND  sp.code     = p_permission
      AND  sp.granted  = true
  );
$$;


-- ─── CORE HELPER: ASSERT VALID STAFF SESSION ────────────────────────────────
-- Verifies:
--   1. The JWT's auth.uid() is the shop owner
--   2. The staff_id belongs to that shop and is active
-- Raises an exception (HTTP 403-equivalent) if either check fails.

CREATE OR REPLACE FUNCTION public.fn_assert_staff_session(
  p_staff_id UUID,
  p_shop_id  UUID
) RETURNS public.staff
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_owner UUID;
  v_staff public.staff;
BEGIN
  SELECT owner_user_id INTO v_owner
  FROM   public.shops
  WHERE  id = p_shop_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized: shop does not belong to authenticated user'
      USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_staff
  FROM   public.staff
  WHERE  id         = p_staff_id
    AND  shop_id    = p_shop_id
    AND  active     = true
    AND  suspended  = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized: staff member not found or is inactive/suspended'
      USING ERRCODE = '42501';
  END IF;

  RETURN v_staff;
END;
$$;


-- ─── RPC: GET MY PERMISSIONS ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_get_my_permissions(
  p_staff_id UUID,
  p_shop_id  UUID
) RETURNS TABLE (code TEXT, granted BOOLEAN)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  RETURN QUERY
    SELECT sp.code, sp.granted
    FROM   public.staff_permissions sp
    WHERE  sp.staff_id = p_staff_id;
END;
$$;


-- ─── RPC: START SHIFT (requires pos.access) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_start_shift(
  p_staff_id     UUID,
  p_shop_id      UUID,
  p_branch_id    UUID    DEFAULT NULL,
  p_opening_cash NUMERIC DEFAULT 0
) RETURNS public.employee_shifts
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_shift public.employee_shifts;
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  IF NOT public.fn_staff_has_permission(p_staff_id, p_shop_id, 'pos.access') THEN
    RAISE EXCEPTION 'Permission denied: pos.access required to start a shift'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.employee_shifts
    WHERE  staff_id = p_staff_id
      AND  shop_id  = p_shop_id
      AND  status   = 'open'
  ) THEN
    RAISE EXCEPTION 'A shift is already open for this staff member';
  END IF;

  INSERT INTO public.employee_shifts (shop_id, staff_id, branch_id, opening_cash)
  VALUES (p_shop_id, p_staff_id, p_branch_id, p_opening_cash)
  RETURNING * INTO v_shift;

  -- Log the action
  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  SELECT p_shop_id, p_staff_id, full_name,
         'shift.start',
         jsonb_build_object('shift_id', v_shift.id, 'opening_cash', p_opening_cash)
  FROM   public.staff WHERE id = p_staff_id;

  RETURN v_shift;
END;
$$;


-- ─── RPC: END SHIFT ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_end_shift(
  p_staff_id      UUID,
  p_shop_id       UUID,
  p_shift_id      UUID,
  p_counted_cash  NUMERIC DEFAULT NULL,
  p_closing_notes TEXT    DEFAULT NULL,
  p_incidents     TEXT    DEFAULT NULL
) RETURNS public.employee_shifts
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_open   public.employee_shifts;
  v_result public.employee_shifts;
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  SELECT * INTO v_open
  FROM   public.employee_shifts
  WHERE  id       = p_shift_id
    AND  staff_id = p_staff_id
    AND  shop_id  = p_shop_id
    AND  status   = 'open';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open shift found for this staff member';
  END IF;

  UPDATE public.employee_shifts SET
    ended_at        = now(),
    counted_cash    = p_counted_cash,
    cash_difference = COALESCE(p_counted_cash, 0)
                        - v_open.opening_cash
                        - v_open.total_sales
                        + v_open.total_expenses,
    closing_notes   = p_closing_notes,
    incidents       = p_incidents,
    status          = 'closed',
    updated_at      = now()
  WHERE id = p_shift_id
  RETURNING * INTO v_result;

  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  SELECT p_shop_id, p_staff_id, full_name,
         'shift.end',
         jsonb_build_object(
           'shift_id',      p_shift_id,
           'counted_cash',  p_counted_cash,
           'cash_diff',     v_result.cash_difference
         )
  FROM   public.staff WHERE id = p_staff_id;

  RETURN v_result;
END;
$$;


-- ─── RPC: SUBMIT EXPENSE (requires expenses.submit) ──────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_submit_expense(
  p_staff_id    UUID,
  p_shop_id     UUID,
  p_amount      NUMERIC,
  p_category    TEXT    DEFAULT 'other',
  p_description TEXT    DEFAULT '',
  p_notes       TEXT    DEFAULT NULL,
  p_shift_id    UUID    DEFAULT NULL
) RETURNS public.employee_expense_submissions
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result public.employee_expense_submissions;
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  IF NOT public.fn_staff_has_permission(p_staff_id, p_shop_id, 'expenses.submit') THEN
    RAISE EXCEPTION 'Permission denied: expenses.submit required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.employee_expense_submissions
    (shop_id, staff_id, shift_id, amount, category, description, notes)
  VALUES
    (p_shop_id, p_staff_id, p_shift_id, p_amount, p_category, p_description, p_notes)
  RETURNING * INTO v_result;

  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  SELECT p_shop_id, p_staff_id, full_name,
         'expense.submit',
         jsonb_build_object('amount', p_amount, 'category', p_category)
  FROM   public.staff WHERE id = p_staff_id;

  RETURN v_result;
END;
$$;


-- ─── RPC: SUBMIT DAILY REPORT (requires reports.submit) ──────────────────────

CREATE OR REPLACE FUNCTION public.rpc_submit_report(
  p_staff_id    UUID,
  p_shop_id     UUID,
  p_title       TEXT,
  p_description TEXT,
  p_category    TEXT DEFAULT 'general',
  p_severity    TEXT DEFAULT 'low'
) RETURNS public.employee_daily_reports
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_result public.employee_daily_reports;
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  IF NOT public.fn_staff_has_permission(p_staff_id, p_shop_id, 'reports.submit') THEN
    RAISE EXCEPTION 'Permission denied: reports.submit required'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.employee_daily_reports
    (shop_id, staff_id, category, title, description, severity)
  VALUES
    (p_shop_id, p_staff_id, p_category, p_title, p_description, p_severity)
  RETURNING * INTO v_result;

  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  SELECT p_shop_id, p_staff_id, full_name,
         'report.submit',
         jsonb_build_object('title', p_title, 'severity', p_severity)
  FROM   public.staff WHERE id = p_staff_id;

  RETURN v_result;
END;
$$;


-- ─── RPC: LOG STAFF ACTIVITY ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_log_staff_activity(
  p_staff_id   UUID,
  p_shop_id    UUID,
  p_staff_name TEXT,
  p_action     TEXT,
  p_details    JSONB DEFAULT '{}'
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM public.fn_assert_staff_session(p_staff_id, p_shop_id);

  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  VALUES (p_shop_id, p_staff_id, p_staff_name, p_action, p_details);
END;
$$;


-- ─── RPC: VERIFY OWNER EXIT PIN ──────────────────────────────────────────────
-- Called when an employee tries to exit staff mode.
-- Returns true if the hash matches shops.owner_exit_pin_hash.

CREATE OR REPLACE FUNCTION public.rpc_verify_exit_pin(
  p_shop_id  UUID,
  p_pin_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $$
DECLARE
  v_stored TEXT;
  v_owner  UUID;
BEGIN
  SELECT owner_user_id, owner_exit_pin_hash
  INTO   v_owner, v_stored
  FROM   public.shops
  WHERE  id = p_shop_id;

  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF v_stored IS NULL THEN
    RETURN false; -- no PIN set yet
  END IF;

  RETURN v_stored = p_pin_hash;
END;
$$;


-- ─── RPC: SET / UPDATE OWNER EXIT PIN ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_set_exit_pin(
  p_shop_id  UUID,
  p_pin_hash TEXT
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.shops
  SET    owner_exit_pin_hash = p_pin_hash
  WHERE  id = p_shop_id
    AND  owner_user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;
END;
$$;


-- ─── GRANT EXECUTE TO authenticated ─────────────────────────────────────────

GRANT EXECUTE ON FUNCTION public.fn_staff_has_permission(UUID, UUID, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_assert_staff_session(UUID, UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_get_my_permissions(UUID, UUID)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_start_shift(UUID, UUID, UUID, NUMERIC)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_end_shift(UUID, UUID, UUID, NUMERIC, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_expense(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_submit_report(UUID, UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_log_staff_activity(UUID, UUID, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_verify_exit_pin(UUID, TEXT)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_set_exit_pin(UUID, TEXT)                      TO authenticated;
