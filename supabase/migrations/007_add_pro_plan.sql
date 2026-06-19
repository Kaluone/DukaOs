-- ============================================================
-- DukaOS — Add Pro plan, remove Free from billing display,
--          update all plan prices to match marketing page
-- 007_add_pro_plan.sql
-- ============================================================

-- Update existing plan prices to match landing page
UPDATE public.subscription_plans SET price_monthly = 25000,  price_yearly = 250000  WHERE name = 'starter';
UPDATE public.subscription_plans SET price_monthly = 60000,  price_yearly = 600000  WHERE name = 'business';
UPDATE public.subscription_plans SET price_monthly = 250000, price_yearly = 2500000 WHERE name = 'enterprise';

-- Update Enterprise sort_order to make room for Pro
UPDATE public.subscription_plans SET sort_order = 4 WHERE name = 'enterprise';

-- Add Pro plan
INSERT INTO public.subscription_plans
  (name, display_name, price_monthly, price_yearly, max_products, max_staff, max_branches, storage_gb, features, sort_order)
VALUES
  ('pro', 'Pro', 120000, 1200000, 10000, 50, 5, 50,
   '["All Business","AI Business Insights","Multi User Access","WhatsApp Alerts","PDF Reports","Cloud Backup","Priority Support"]', 3)
ON CONFLICT (name) DO UPDATE SET
  price_monthly = 120000, price_yearly = 1200000,
  display_name = 'Pro', sort_order = 3;

-- Extend CHECK constraint on shop_subscriptions to include 'pro'
ALTER TABLE public.shop_subscriptions
  DROP CONSTRAINT IF EXISTS shop_subscriptions_plan_name_check;

ALTER TABLE public.shop_subscriptions
  ADD CONSTRAINT shop_subscriptions_plan_name_check
  CHECK (plan_name IN ('free','starter','business','pro','enterprise'));

-- Hide Free plan from billing UI (keep in DB for internal use)
UPDATE public.subscription_plans SET is_active = false WHERE name = 'free';
