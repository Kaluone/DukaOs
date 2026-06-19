-- ============================================================
-- DukaOS — Functions, Triggers & Views
-- 003_functions_triggers.sql
-- ============================================================

-- ============================================================
-- Auto-update updated_at on any table
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_shops_updated_at
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_stock_updated_at
  BEFORE UPDATE ON public.stock_levels
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_notif_prefs_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- Decrement stock when a transaction_item is inserted
-- ============================================================
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.stock_levels
  SET quantity = GREATEST(0, quantity - NEW.quantity),
      updated_at = now()
  WHERE product_id = NEW.product_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_decrement_stock
  AFTER INSERT ON public.transaction_items
  FOR EACH ROW EXECUTE FUNCTION public.decrement_stock_on_sale();

-- ============================================================
-- Create notification_preferences row when a shop is created
-- ============================================================
CREATE OR REPLACE FUNCTION public.init_shop_preferences()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notification_preferences(shop_id)
  VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_init_shop_prefs
  AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.init_shop_preferences();

-- ============================================================
-- Audit log writer (call from sensitive operations)
-- ============================================================
CREATE OR REPLACE FUNCTION public.write_audit_log(
  p_shop_id   UUID,
  p_event     TEXT,
  p_table     TEXT,
  p_record_id TEXT,
  p_old_data  JSONB DEFAULT NULL,
  p_new_data  JSONB DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.audit_logs(shop_id, event_type, table_name, record_id, user_id, old_data, new_data)
  VALUES (p_shop_id, p_event, p_table, p_record_id, auth.uid(), p_old_data, p_new_data);
END;
$$;

-- ============================================================
-- Dashboard summary view (used by React + Flutter dashboards)
-- ============================================================
CREATE OR REPLACE VIEW public.v_dashboard_today AS
SELECT
  s.id                                                      AS shop_id,
  s.name                                                    AS shop_name,
  COALESCE(SUM(t.total_amount), 0)                         AS revenue_today,
  COUNT(DISTINCT t.id)                                      AS transactions_today,
  COUNT(DISTINCT t.staff_id)                               AS active_staff_today,
  (
    SELECT COUNT(*) FROM public.stock_levels sl
    JOIN public.products p ON p.id = sl.product_id
    WHERE sl.shop_id = s.id
      AND p.active = true
      AND sl.quantity <= sl.reorder_threshold
  )                                                         AS low_stock_count,
  (
    SELECT COUNT(*) FROM public.cash_reconciliations cr
    WHERE cr.shop_id = s.id
      AND cr.shift_date = CURRENT_DATE
      AND cr.variance <> 0
  )                                                         AS variance_alerts_today
FROM public.shops s
LEFT JOIN public.transactions t
  ON t.shop_id = s.id
  AND t.created_at >= CURRENT_DATE
  AND t.sync_status = 'synced'
GROUP BY s.id, s.name;

-- ============================================================
-- Low-stock products view
-- ============================================================
CREATE OR REPLACE VIEW public.v_low_stock AS
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
ORDER BY sl.quantity ASC;

-- ============================================================
-- Landing page stats (public, anon access)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_landing_stats()
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN json_build_object(
    'shops',        (SELECT COUNT(*) FROM public.shops),
    'transactions', (SELECT COUNT(*) FROM public.transactions WHERE sync_status = 'synced'),
    'products',     (SELECT COUNT(*) FROM public.products WHERE active = true)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_landing_stats() TO anon;
