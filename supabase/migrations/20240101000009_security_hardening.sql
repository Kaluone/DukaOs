-- ============================================================
-- DukaOS — Security Hardening
-- 009_security_hardening.sql  (idempotent — safe to re-run)
-- ============================================================
-- Fixes:
-- 1. super_admins: enable RLS (was completely open)
-- 2. arc_tenant_overview: restrict to ARC admins only
--    (was GRANT SELECT TO authenticated — all tenants exposed)
-- 3. Broken RLS policies in 20260618_enterprise_upgrade.sql
--    (used shops.owner_id which doesn't exist; correct is owner_user_id)
-- 4. All views: add security_barrier + explicit shop_id filter
--    so they show only the current user's data regardless of
--    underlying table RLS behavior
-- 5. Add customer_id to transactions (needed by v_customer_summary)
-- ============================================================

-- ─── 1. SUPER_ADMINS: ENABLE RLS (deny all direct client access) ─────────────
-- service_role bypasses RLS in Supabase, so backend ops still work.
-- No policy = deny all for anon/authenticated roles.
ALTER TABLE public.super_admins ENABLE ROW LEVEL SECURITY;


-- ─── 2. ARC_TENANT_OVERVIEW: RESTRICT TO ARC ADMINS ─────────────────────────
-- Revoke the blanket grant that exposed all tenant data to any logged-in user.
REVOKE SELECT ON public.arc_tenant_overview FROM authenticated;

-- Rebuild the view with security_barrier so the arc_admin check
-- is always evaluated before any user-provided WHERE clause.
CREATE OR REPLACE VIEW public.arc_tenant_overview
  WITH (security_barrier = true) AS
SELECT
  s.id,
  s.name,
  s.owner_user_id,
  s.phone,
  s.address,
  s.created_at,
  ss.plan_name,
  ss.status          AS sub_status,
  ss.trial_ends_at,
  ss.current_period_end,
  ss.billing_cycle,
  u.email            AS owner_email,
  u.last_sign_in_at,
  u.raw_user_meta_data->>'full_name' AS owner_name,
  u.raw_user_meta_data->>'country'   AS country
FROM public.shops s
LEFT JOIN public.shop_subscriptions ss ON ss.shop_id = s.id
LEFT JOIN auth.users u ON u.id = s.owner_user_id
WHERE EXISTS (
  SELECT 1 FROM public.arc_admins
  WHERE user_id = auth.uid() AND is_active = true
);

-- Re-grant only to authenticated (the WHERE clause above now gates access)
GRANT SELECT ON public.arc_tenant_overview TO authenticated;


-- ─── 3. FIX BROKEN RLS POLICIES (owner_id → owner_user_id) ─────────────────
-- Migration 20260618_enterprise_upgrade.sql used shops.owner_id which does not
-- exist.  We wrap every block in a DO $$ ... $$ so a missing table is skipped
-- gracefully rather than aborting the whole migration.

DO $$ BEGIN
  DROP POLICY IF EXISTS "sync_log_shop" ON public.sync_log;
  CREATE POLICY "sync_log_shop" ON public.sync_log
    USING (shop_id IN (
      SELECT id FROM public.shops WHERE owner_user_id = auth.uid()
    ));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "push_subscriptions_shop" ON public.push_subscriptions;
  CREATE POLICY "push_subscriptions_shop" ON public.push_subscriptions
    USING (shop_id IN (
      SELECT id FROM public.shops WHERE owner_user_id = auth.uid()
    ));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notification_settings_shop" ON public.notification_settings;
  CREATE POLICY "notification_settings_shop" ON public.notification_settings
    USING (shop_id IN (
      SELECT id FROM public.shops WHERE owner_user_id = auth.uid()
    ));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "notification_history_shop" ON public.notification_history;
  CREATE POLICY "notification_history_shop" ON public.notification_history
    USING (shop_id IN (
      SELECT id FROM public.shops WHERE owner_user_id = auth.uid()
    ));
EXCEPTION WHEN undefined_table THEN NULL; END $$;

-- Drop stale duplicate policies added by 20260618 on tables already in 006
DO $$ BEGIN
  DROP POLICY IF EXISTS "loyalty_tiers_shop"        ON public.loyalty_tiers;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "loyalty_transactions_shop" ON public.loyalty_transactions;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tax_rates_shop"            ON public.tax_rates;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "receipt_templates_shop"    ON public.receipt_templates;
EXCEPTION WHEN undefined_table THEN NULL; END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "feature_flags_shop"        ON public.feature_flags;
EXCEPTION WHEN undefined_table THEN NULL; END $$;


-- ─── 4. ADD customer_id TO transactions (needed by v_customer_summary) ────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

CREATE INDEX IF NOT EXISTS idx_transactions_customer
  ON public.transactions(customer_id) WHERE customer_id IS NOT NULL;


-- ─── 5. REBUILD ALL VIEWS WITH security_barrier + shop_id FILTERS ─────────────
-- Every view now contains an explicit WHERE clause that pins results to the
-- authenticated user's shop, AND uses security_barrier = true so PostgreSQL
-- cannot reorder the filter away via query optimisation.

-- v_dashboard_today
CREATE OR REPLACE VIEW public.v_dashboard_today
  WITH (security_barrier = true) AS
SELECT
  s.id   AS shop_id,
  s.name AS shop_name,
  COALESCE(SUM(t.total_amount), 0)  AS revenue_today,
  COUNT(DISTINCT t.id)              AS transactions_today,
  COUNT(DISTINCT t.staff_id)        AS active_staff_today,
  (
    SELECT COUNT(*) FROM public.stock_levels sl
    JOIN public.products p2 ON p2.id = sl.product_id
    WHERE sl.shop_id = s.id
      AND p2.active = true
      AND sl.quantity <= sl.reorder_threshold
  )                                  AS low_stock_count,
  (
    SELECT COUNT(*) FROM public.cash_reconciliations cr
    WHERE cr.shop_id = s.id
      AND cr.shift_date = CURRENT_DATE
      AND cr.variance <> 0
  )                                  AS variance_alerts_today,
  COALESCE((
    SELECT SUM(e.amount) FROM public.expenses e
    WHERE e.shop_id = s.id AND e.expense_date = CURRENT_DATE
  ), 0)                              AS expenses_today,
  COALESCE((
    SELECT SUM((ti.unit_price - ti.buying_price) * ti.quantity - ti.item_discount)
    FROM public.transaction_items ti
    JOIN public.transactions t2 ON t2.id = ti.transaction_id
    WHERE t2.shop_id = s.id
      AND DATE(t2.created_at) = CURRENT_DATE
      AND t2.sync_status = 'synced'
  ), 0)                              AS profit_today
FROM public.shops s
LEFT JOIN public.transactions t
  ON t.shop_id = s.id
  AND DATE(t.created_at) = CURRENT_DATE
  AND t.sync_status = 'synced'
WHERE s.id = public.my_shop_id()          -- ← explicit ownership filter
GROUP BY s.id, s.name;

-- v_low_stock
CREATE OR REPLACE VIEW public.v_low_stock
  WITH (security_barrier = true) AS
SELECT
  sl.shop_id,
  p.id         AS product_id,
  p.name       AS product_name,
  p.photo_url,
  p.category,
  sl.quantity,
  sl.reorder_threshold
FROM public.stock_levels sl
JOIN public.products p ON p.id = sl.product_id
WHERE p.active = true
  AND sl.quantity <= sl.reorder_threshold
  AND sl.shop_id = public.my_shop_id()    -- ← explicit ownership filter
ORDER BY sl.quantity ASC;

-- v_best_sellers
CREATE OR REPLACE VIEW public.v_best_sellers
  WITH (security_barrier = true) AS
SELECT
  ti.product_id,
  p.name          AS product_name,
  p.category,
  p.photo_url,
  ti.shop_id,
  SUM(ti.quantity)                                                         AS total_qty_sold,
  SUM(ti.subtotal)                                                         AS total_revenue,
  SUM((ti.unit_price - ti.buying_price) * ti.quantity - ti.item_discount) AS total_profit
FROM public.transaction_items ti
JOIN public.products p ON p.id = ti.product_id
JOIN public.transactions t ON t.id = ti.transaction_id
WHERE t.sync_status = 'synced'
  AND ti.shop_id = public.my_shop_id()    -- ← explicit ownership filter
GROUP BY ti.product_id, p.name, p.category, p.photo_url, ti.shop_id
ORDER BY total_qty_sold DESC;

-- v_staff_performance
CREATE OR REPLACE VIEW public.v_staff_performance
  WITH (security_barrier = true) AS
SELECT
  t.shop_id,
  t.staff_id,
  COALESCE(s.full_name, 'Owner') AS staff_name,
  COUNT(DISTINCT t.id)           AS transaction_count,
  SUM(t.total_amount)            AS total_revenue,
  AVG(t.total_amount)            AS avg_transaction,
  MAX(t.created_at)              AS last_sale_at
FROM public.transactions t
LEFT JOIN public.staff s ON s.id = t.staff_id
WHERE t.sync_status = 'synced'
  AND t.shop_id = public.my_shop_id()     -- ← explicit ownership filter
GROUP BY t.shop_id, t.staff_id, s.full_name;

-- v_inventory_value
CREATE OR REPLACE VIEW public.v_inventory_value
  WITH (security_barrier = true) AS
SELECT
  sl.shop_id,
  p.id           AS product_id,
  p.name         AS product_name,
  p.category,
  p.buying_price,
  p.price        AS selling_price,
  sl.quantity,
  sl.reorder_threshold,
  (p.buying_price * sl.quantity)           AS stock_cost_value,
  (p.price        * sl.quantity)           AS stock_retail_value,
  (p.price - p.buying_price) * sl.quantity AS potential_profit
FROM public.stock_levels sl
JOIN public.products p ON p.id = sl.product_id
WHERE p.active = true
  AND sl.shop_id = public.my_shop_id()    -- ← explicit ownership filter
ORDER BY stock_cost_value DESC;

-- v_customer_summary
CREATE OR REPLACE VIEW public.v_customer_summary
  WITH (security_barrier = true) AS
SELECT
  t.shop_id,
  c.id              AS customer_id,
  c.name            AS customer_name,
  c.phone,
  COUNT(DISTINCT t.id)  AS purchase_count,
  SUM(t.total_amount)   AS total_spent,
  MAX(t.created_at)     AS last_purchase_at,
  c.loyalty_points,
  c.credit_balance
FROM public.transactions t
JOIN public.customers c ON c.id = t.customer_id
WHERE t.sync_status = 'synced'
  AND t.shop_id = public.my_shop_id()     -- ← explicit ownership filter
GROUP BY t.shop_id, c.id, c.name, c.phone, c.loyalty_points, c.credit_balance;

-- v_branch_performance
CREATE OR REPLACE VIEW public.v_branch_performance
  WITH (security_barrier = true) AS
SELECT
  b.id          AS branch_id,
  b.shop_id,
  b.name        AS branch_name,
  COUNT(DISTINCT t.id)             AS transactions_count,
  COALESCE(SUM(t.total_amount), 0) AS total_revenue,
  COUNT(DISTINCT t.staff_id)       AS active_staff
FROM public.branches b
LEFT JOIN public.transactions t
  ON t.branch_id = b.id
  AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
WHERE b.shop_id = public.my_shop_id()     -- ← explicit ownership filter
GROUP BY b.id, b.shop_id, b.name;

-- v_active_promotions
CREATE OR REPLACE VIEW public.v_active_promotions
  WITH (security_barrier = true) AS
SELECT *
FROM public.promotions
WHERE is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
  AND (usage_limit IS NULL OR usage_count < usage_limit)
  AND shop_id = public.my_shop_id();      -- ← explicit ownership filter

-- v_unread_notifications
CREATE OR REPLACE VIEW public.v_unread_notifications
  WITH (security_barrier = true) AS
SELECT shop_id, COUNT(*) AS unread_count
FROM public.notifications
WHERE is_read = false
  AND shop_id = public.my_shop_id()       -- ← explicit ownership filter
GROUP BY shop_id;
