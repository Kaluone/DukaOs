-- ============================================================
-- DukaOS — Expense Receipt Attachments
-- 20240101000014_expense_receipts.sql
-- ============================================================

-- ─── ADD receipt_path TO expense submissions ─────────────────────────────────
-- Stores the Supabase Storage object path (not a full URL, so signed URLs
-- can be generated fresh on demand and never expire in the DB record).

ALTER TABLE public.employee_expense_submissions
  ADD COLUMN IF NOT EXISTS receipt_path TEXT;

-- ─── STORAGE BUCKET ──────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  false,              -- private bucket
  10485760,           -- 10 MB per file
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── STORAGE RLS ─────────────────────────────────────────────────────────────
-- Path convention: {shop_id}/{staff_id}/{timestamp}_{filename}
-- The first folder segment is always the shop_id.
-- Owners can read/write all receipts for their shop.
-- Staff (using owner JWT) get the same access automatically.

CREATE POLICY "expense_receipts_owner_all" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.shops WHERE owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'expense-receipts'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.shops WHERE owner_user_id = auth.uid()
    )
  );

-- ─── UPDATE rpc_submit_expense TO ACCEPT receipt_path ────────────────────────

CREATE OR REPLACE FUNCTION public.rpc_submit_expense(
  p_staff_id    UUID,
  p_shop_id     UUID,
  p_amount      NUMERIC,
  p_category    TEXT    DEFAULT 'other',
  p_description TEXT    DEFAULT '',
  p_notes       TEXT    DEFAULT NULL,
  p_shift_id    UUID    DEFAULT NULL,
  p_receipt_path TEXT   DEFAULT NULL
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
    (shop_id, staff_id, shift_id, amount, category, description, notes, receipt_path)
  VALUES
    (p_shop_id, p_staff_id, p_shift_id, p_amount, p_category, p_description, p_notes, p_receipt_path)
  RETURNING * INTO v_result;

  INSERT INTO public.staff_activity_log (shop_id, staff_id, staff_name, action, details)
  SELECT p_shop_id, p_staff_id, full_name,
         'expense.submit',
         jsonb_build_object(
           'amount',       p_amount,
           'category',     p_category,
           'has_receipt',  p_receipt_path IS NOT NULL
         )
  FROM   public.staff WHERE id = p_staff_id;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_submit_expense(UUID, UUID, NUMERIC, TEXT, TEXT, TEXT, UUID, TEXT)
  TO authenticated;
