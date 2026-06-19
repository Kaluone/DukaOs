-- ============================================================
-- DukaOS — Row Level Security Policies
-- 002_rls_policies.sql
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.shops                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_levels            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_reconciliations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vfd_receipts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_money_payments   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications_log       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: get the shop_id belonging to the current auth user
-- ============================================================
CREATE OR REPLACE FUNCTION public.my_shop_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT id FROM public.shops WHERE owner_user_id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- SHOPS — owner can only see/edit their own shop
-- ============================================================
CREATE POLICY "Owner: select own shop"
  ON public.shops FOR SELECT
  USING (owner_user_id = auth.uid());

CREATE POLICY "Owner: insert own shop"
  ON public.shops FOR INSERT
  WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "Owner: update own shop"
  ON public.shops FOR UPDATE
  USING (owner_user_id = auth.uid());

-- ============================================================
-- STAFF
-- ============================================================
CREATE POLICY "Owner: manage staff"
  ON public.staff FOR ALL
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE POLICY "Owner: manage products"
  ON public.products FOR ALL
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- STOCK LEVELS
-- ============================================================
CREATE POLICY "Owner: manage stock"
  ON public.stock_levels FOR ALL
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- TRANSACTIONS — owner reads all; also allow service role for POS writes
-- ============================================================
CREATE POLICY "Owner: read own transactions"
  ON public.transactions FOR SELECT
  USING (shop_id = public.my_shop_id());

CREATE POLICY "Owner: insert transactions"
  ON public.transactions FOR INSERT
  WITH CHECK (shop_id = public.my_shop_id());

-- ============================================================
-- TRANSACTION ITEMS
-- ============================================================
CREATE POLICY "Owner: read own items"
  ON public.transaction_items FOR SELECT
  USING (shop_id = public.my_shop_id());

CREATE POLICY "Owner: insert items"
  ON public.transaction_items FOR INSERT
  WITH CHECK (shop_id = public.my_shop_id());

-- ============================================================
-- CASH RECONCILIATIONS
-- ============================================================
CREATE POLICY "Owner: manage reconciliations"
  ON public.cash_reconciliations FOR ALL
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- VFD RECEIPTS
-- ============================================================
CREATE POLICY "Owner: view vfd receipts"
  ON public.vfd_receipts FOR SELECT
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- MOBILE MONEY PAYMENTS
-- ============================================================
CREATE POLICY "Owner: view mobile payments"
  ON public.mobile_money_payments FOR SELECT
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================
CREATE POLICY "Owner: view notifications"
  ON public.notifications_log FOR SELECT
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE POLICY "Owner: manage notification prefs"
  ON public.notification_preferences FOR ALL
  USING (shop_id = public.my_shop_id());

-- ============================================================
-- AUDIT LOGS — read-only for owner, no delete/update
-- ============================================================
CREATE POLICY "Owner: read audit logs"
  ON public.audit_logs FOR SELECT
  USING (shop_id = public.my_shop_id());
