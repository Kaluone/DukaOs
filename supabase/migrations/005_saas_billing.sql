-- ============================================================
-- DukaOS — SaaS Billing, Notification Settings, VFD Config,
--          Subscriptions, Sessions, Activity Logs
-- 005_saas_billing.sql
-- ============================================================

-- ─── SUBSCRIPTION PLANS (static reference) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id               UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT    NOT NULL UNIQUE,  -- free, starter, business, enterprise
  display_name     TEXT    NOT NULL,
  price_monthly    NUMERIC(10,2) NOT NULL DEFAULT 0,
  price_yearly     NUMERIC(10,2) NOT NULL DEFAULT 0,
  max_products     INT     NOT NULL DEFAULT 50,
  max_staff        INT     NOT NULL DEFAULT 2,
  max_branches     INT     NOT NULL DEFAULT 1,
  storage_gb       NUMERIC(6,2) NOT NULL DEFAULT 1,
  features         JSONB   NOT NULL DEFAULT '[]',
  is_active        BOOLEAN NOT NULL DEFAULT true,
  sort_order       INT     NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.subscription_plans
  (name, display_name, price_monthly, price_yearly, max_products, max_staff, max_branches, storage_gb, features, sort_order)
VALUES
  ('free',       'Free',       0,      0,      50,   2,  1,  1,  '["POS","Products","Expenses","Reports"]', 0),
  ('starter',    'Starter',    15000,  150000, 500,  5,  1,  5,  '["POS","Products","Expenses","Reports","Purchases","Suppliers","Customers","WhatsApp alerts"]', 1),
  ('business',   'Business',   45000,  450000, 5000, 20, 3,  20, '["All Starter","Staff Performance","VFD/EFD","Bulk Import","Advanced Reports","SMS alerts"]', 2),
  ('enterprise', 'Enterprise', 120000, 1200000,999999,999,999,100,'["All Business","AI Assistant","API Access","Priority Support","Custom Branding","Dedicated Manager"]', 3)
ON CONFLICT (name) DO NOTHING;

-- ─── SHOP SUBSCRIPTIONS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_subscriptions (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID    NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_name       TEXT    NOT NULL DEFAULT 'free'
                  CHECK (plan_name IN ('free','starter','business','enterprise')),
  billing_cycle   TEXT    NOT NULL DEFAULT 'monthly'
                  CHECK (billing_cycle IN ('monthly','yearly')),
  status          TEXT    NOT NULL DEFAULT 'trial'
                  CHECK (status IN ('trial','active','grace','expired','cancelled','suspended')),
  trial_ends_at   TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end   TIMESTAMPTZ,
  grace_ends_at   TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  suspended_at    TIMESTAMPTZ,
  auto_renew      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_subs_shop ON public.shop_subscriptions(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_subs_status ON public.shop_subscriptions(status);
ALTER TABLE public.shop_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: view own subscription"
  ON public.shop_subscriptions FOR SELECT USING (shop_id = public.my_shop_id());
CREATE POLICY "Owner: update own subscription"
  ON public.shop_subscriptions FOR UPDATE USING (shop_id = public.my_shop_id());
CREATE TRIGGER set_shop_subs_updated_at
  BEFORE UPDATE ON public.shop_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── BILLING INVOICES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.billing_invoices (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  invoice_number  TEXT    NOT NULL UNIQUE,
  plan_name       TEXT    NOT NULL,
  billing_cycle   TEXT    NOT NULL,
  amount          NUMERIC(12,2) NOT NULL,
  currency        TEXT    NOT NULL DEFAULT 'TZS',
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','paid','overdue','void')),
  period_start    TIMESTAMPTZ NOT NULL,
  period_end      TIMESTAMPTZ NOT NULL,
  paid_at         TIMESTAMPTZ,
  payment_method  TEXT,
  payment_ref     TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_shop ON public.billing_invoices(shop_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.billing_invoices(status);
ALTER TABLE public.billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: view own invoices"
  ON public.billing_invoices FOR SELECT USING (shop_id = public.my_shop_id());

-- ─── EXTENDED NOTIFICATION PREFERENCES ───────────────────────────────────────
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS email                TEXT,
  ADD COLUMN IF NOT EXISTS sms_number           TEXT,
  ADD COLUMN IF NOT EXISTS email_enabled        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_stock_threshold  INT     NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS daily_digest         BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_digest        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_digest       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS new_sale_alert       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expense_alert        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS low_stock_alert      BOOLEAN NOT NULL DEFAULT true;

-- ─── VFD CONFIGURATION ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vfd_configs (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID    NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  tra_username    TEXT,
  tra_password    TEXT,  -- stored encrypted; handle at app layer
  device_serial   TEXT,
  certificate     TEXT,
  api_endpoint    TEXT    DEFAULT 'https://virtual.tra.go.tz/efdmsREST',
  last_test_at    TIMESTAMPTZ,
  last_test_ok    BOOLEAN,
  last_test_msg   TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vfd_configs_shop ON public.vfd_configs(shop_id);
ALTER TABLE public.vfd_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage vfd config"
  ON public.vfd_configs FOR ALL USING (shop_id = public.my_shop_id());
CREATE TRIGGER set_vfd_configs_updated_at
  BEFORE UPDATE ON public.vfd_configs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── ACTIVITY LOG (UI-facing timeline) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.activity_log (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  activity_type TEXT    NOT NULL
                CHECK (activity_type IN (
                  'sale','purchase','expense','refund','login','logout',
                  'stock_in','stock_out','stock_adjust','product_add',
                  'product_edit','staff_add','customer_add','import'
                )),
  description   TEXT    NOT NULL,
  amount        NUMERIC(12,2),
  reference_id  UUID,
  reference_type TEXT,
  staff_name    TEXT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_activity_shop    ON public.activity_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON public.activity_log(shop_id, created_at DESC);
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: view activity"
  ON public.activity_log FOR ALL USING (shop_id = public.my_shop_id());

-- ─── USER SESSIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT    NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  device_name   TEXT,
  ip_address    TEXT,
  user_agent    TEXT,
  last_seen_at  TIMESTAMPTZ DEFAULT now(),
  revoked       BOOLEAN NOT NULL DEFAULT false,
  revoked_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_shop ON public.user_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON public.user_sessions(user_id);
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage own sessions"
  ON public.user_sessions FOR ALL
  USING (shop_id = public.my_shop_id() AND user_id = auth.uid());

-- ─── SUPER ADMIN TABLE ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.super_admins (
  user_id    UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT    NOT NULL DEFAULT 'admin' CHECK (role IN ('admin','super_admin')),
  created_at TIMESTAMPTZ DEFAULT now()
);
-- No RLS on super_admins — access controlled at API level via service_role

-- ─── AI ASSISTANT THREADS ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_threads (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  messages    JSONB   NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage ai threads"
  ON public.ai_threads FOR ALL USING (shop_id = public.my_shop_id());
CREATE TRIGGER set_ai_threads_updated_at
  BEFORE UPDATE ON public.ai_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Auto-create subscription on shop creation ───────────────────────────────
CREATE OR REPLACE FUNCTION public.init_shop_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.shop_subscriptions(
    shop_id, plan_name, status,
    trial_ends_at, current_period_start, current_period_end
  ) VALUES (
    NEW.id, 'starter', 'trial',
    now() + INTERVAL '14 days',
    now(),
    now() + INTERVAL '14 days'
  ) ON CONFLICT DO NOTHING;

  INSERT INTO public.vfd_configs(shop_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_shop_subscription
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.init_shop_subscription();

-- ─── Log activity from sale (trigger on transactions) ─────────────────────────
CREATE OR REPLACE FUNCTION public.log_sale_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.activity_log(
    shop_id, activity_type, description, amount, reference_id, reference_type
  ) VALUES (
    NEW.shop_id, 'sale',
    'Sale of ' || NEW.total_amount || ' TZS',
    NEW.total_amount, NEW.id, 'transaction'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_sale_activity
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.log_sale_activity();

-- ─── Log activity from expense ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_expense_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.activity_log(
    shop_id, activity_type, description, amount, reference_id, reference_type
  ) VALUES (
    NEW.shop_id, 'expense',
    NEW.category || ': ' || NEW.description,
    NEW.amount, NEW.id, 'expense'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_expense_activity
  AFTER INSERT ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.log_expense_activity();

-- ─── Log activity from purchase ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_purchase_activity()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.activity_log(
    shop_id, activity_type, description, amount, reference_id, reference_type
  ) VALUES (
    NEW.shop_id, 'purchase',
    'Purchase #' || COALESCE(NEW.invoice_number, NEW.id::TEXT),
    NEW.total_amount, NEW.id, 'purchase'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_purchase_activity
  AFTER INSERT ON public.purchases
  FOR EACH ROW EXECUTE FUNCTION public.log_purchase_activity();

-- ─── Reports Views ────────────────────────────────────────────────────────────

-- Best selling products (by quantity sold)
CREATE OR REPLACE VIEW public.v_best_sellers AS
SELECT
  ti.product_id,
  p.name          AS product_name,
  p.category,
  p.photo_url,
  ti.shop_id,
  SUM(ti.quantity)                            AS total_qty_sold,
  SUM(ti.subtotal)                            AS total_revenue,
  SUM((ti.unit_price - ti.buying_price) * ti.quantity - ti.item_discount) AS total_profit
FROM public.transaction_items ti
JOIN public.products p ON p.id = ti.product_id
JOIN public.transactions t ON t.id = ti.transaction_id
WHERE t.sync_status = 'synced'
GROUP BY ti.product_id, p.name, p.category, p.photo_url, ti.shop_id
ORDER BY total_qty_sold DESC;

-- Staff performance
CREATE OR REPLACE VIEW public.v_staff_performance AS
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
GROUP BY t.shop_id, t.staff_id, s.full_name;

-- Inventory valuation
CREATE OR REPLACE VIEW public.v_inventory_value AS
SELECT
  sl.shop_id,
  p.id           AS product_id,
  p.name         AS product_name,
  p.category,
  p.buying_price,
  p.price        AS selling_price,
  sl.quantity,
  sl.reorder_threshold,
  (p.buying_price * sl.quantity)                  AS stock_cost_value,
  (p.price        * sl.quantity)                  AS stock_retail_value,
  (p.price - p.buying_price) * sl.quantity        AS potential_profit
FROM public.stock_levels sl
JOIN public.products p ON p.id = sl.product_id
WHERE p.active = true
ORDER BY stock_cost_value DESC;

-- P&L summary by date range (called with parameters via RPC)
CREATE OR REPLACE FUNCTION public.get_pnl_summary(
  p_shop_id  UUID,
  p_from     DATE,
  p_to       DATE
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_revenue   NUMERIC;
  v_cogs      NUMERIC;
  v_expenses  NUMERIC;
  v_gross     NUMERIC;
  v_net       NUMERIC;
BEGIN
  SELECT COALESCE(SUM(t.total_amount), 0)
    INTO v_revenue
    FROM public.transactions t
    WHERE t.shop_id = p_shop_id
      AND t.sync_status = 'synced'
      AND DATE(t.created_at) BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(ti.buying_price * ti.quantity), 0)
    INTO v_cogs
    FROM public.transaction_items ti
    JOIN public.transactions t ON t.id = ti.transaction_id
    WHERE t.shop_id = p_shop_id
      AND t.sync_status = 'synced'
      AND DATE(t.created_at) BETWEEN p_from AND p_to;

  SELECT COALESCE(SUM(e.amount), 0)
    INTO v_expenses
    FROM public.expenses e
    WHERE e.shop_id = p_shop_id
      AND e.expense_date BETWEEN p_from AND p_to;

  v_gross := v_revenue - v_cogs;
  v_net   := v_gross - v_expenses;

  RETURN json_build_object(
    'revenue',   v_revenue,
    'cogs',      v_cogs,
    'gross_profit', v_gross,
    'expenses',  v_expenses,
    'net_profit', v_net,
    'gross_margin', CASE WHEN v_revenue > 0 THEN ROUND((v_gross/v_revenue)*100, 1) ELSE 0 END,
    'net_margin',   CASE WHEN v_revenue > 0 THEN ROUND((v_net/v_revenue)*100, 1) ELSE 0 END
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_pnl_summary(UUID, DATE, DATE) TO authenticated;

-- Customer purchase summary
CREATE OR REPLACE VIEW public.v_customer_summary AS
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
GROUP BY t.shop_id, c.id, c.name, c.phone, c.loyalty_points, c.credit_balance;

-- ─── Backfill subscriptions for existing shops ───────────────────────────────
INSERT INTO public.shop_subscriptions(
  shop_id, plan_name, status,
  trial_ends_at, current_period_start, current_period_end
)
SELECT
  s.id, 'starter', 'trial',
  now() + INTERVAL '14 days',
  now(),
  now() + INTERVAL '14 days'
FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 FROM public.shop_subscriptions ss WHERE ss.shop_id = s.id
);

-- Backfill vfd_configs for existing shops
INSERT INTO public.vfd_configs(shop_id)
SELECT s.id FROM public.shops s
WHERE NOT EXISTS (
  SELECT 1 FROM public.vfd_configs v WHERE v.shop_id = s.id
);

-- ─── RLS Grant read on subscription_plans to authenticated ───────────────────
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated: read plans"
  ON public.subscription_plans FOR SELECT TO authenticated USING (true);
