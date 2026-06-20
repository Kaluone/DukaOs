-- ============================================================
-- DukaOS — Enhancements: POS, Expenses, Purchases, Stock Movements
-- 004_enhancements.sql
-- ============================================================

-- ─── Extend Products ─────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS barcode      TEXT,
  ADD COLUMN IF NOT EXISTS buying_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (buying_price >= 0);

CREATE INDEX IF NOT EXISTS idx_products_barcode
  ON public.products(shop_id, barcode) WHERE barcode IS NOT NULL;

-- ─── Extend Transactions ─────────────────────────────────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount >= 0);

-- ─── Extend Transaction Items ────────────────────────────────────────────────
ALTER TABLE public.transaction_items
  ADD COLUMN IF NOT EXISTS buying_price  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS item_discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtotal      NUMERIC(12,2);

-- ─── EXPENSES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.expenses (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  category     TEXT    NOT NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description  TEXT,
  expense_date DATE    NOT NULL DEFAULT CURRENT_DATE,
  staff_id     UUID    REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_expenses_shop ON public.expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(shop_id, expense_date DESC);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage expenses"
  ON public.expenses FOR ALL USING (shop_id = public.my_shop_id());

-- ─── SUPPLIERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.suppliers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_shop ON public.suppliers(shop_id);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage suppliers"
  ON public.suppliers FOR ALL USING (shop_id = public.my_shop_id());
CREATE TRIGGER set_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── CUSTOMERS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customers (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name           TEXT    NOT NULL,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  notes          TEXT,
  loyalty_points INT     NOT NULL DEFAULT 0,
  credit_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  active         BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customers_shop  ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(shop_id, phone);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage customers"
  ON public.customers FOR ALL USING (shop_id = public.my_shop_id());
CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── PURCHASES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchases (
  id             UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  supplier_id    UUID    REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invoice_number TEXT,
  total_amount   NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
  paid_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT    NOT NULL DEFAULT 'unpaid'
                 CHECK (payment_status IN ('unpaid','partial','paid')),
  notes          TEXT,
  purchase_date  DATE    NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchases_shop ON public.purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON public.purchases(shop_id, purchase_date DESC);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage purchases"
  ON public.purchases FOR ALL USING (shop_id = public.my_shop_id());

-- ─── PURCHASE ITEMS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id           UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id  UUID    NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id   UUID    NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  shop_id      UUID    NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quantity     INT     NOT NULL CHECK (quantity > 0),
  buying_price NUMERIC(12,2) NOT NULL CHECK (buying_price >= 0),
  subtotal     NUMERIC(12,2) NOT NULL
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: manage purchase items"
  ON public.purchase_items FOR ALL USING (shop_id = public.my_shop_id());

-- ─── STOCK MOVEMENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  movement_type   TEXT NOT NULL
                  CHECK (movement_type IN ('IN','OUT','SALE','PURCHASE','ADJUSTMENT','DAMAGE','RETURN')),
  quantity_before INT  NOT NULL,
  quantity_change INT  NOT NULL,
  quantity_after  INT  NOT NULL,
  reference_id    UUID,
  reference_type  TEXT,
  reason          TEXT,
  staff_id        UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movements_shop    ON public.stock_movements(shop_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner: view stock movements"
  ON public.stock_movements FOR ALL USING (shop_id = public.my_shop_id());

-- ─── Updated: decrement_stock_on_sale (now also logs stock_movements) ────────
CREATE OR REPLACE FUNCTION public.decrement_stock_on_sale()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qty_before INT;
  v_qty_after  INT;
BEGIN
  SELECT quantity INTO v_qty_before
    FROM public.stock_levels WHERE product_id = NEW.product_id;

  v_qty_after := GREATEST(0, COALESCE(v_qty_before, 0) - NEW.quantity);

  UPDATE public.stock_levels
    SET quantity = v_qty_after, updated_at = now()
    WHERE product_id = NEW.product_id;

  INSERT INTO public.stock_movements (
    shop_id, product_id, movement_type,
    quantity_before, quantity_change, quantity_after,
    reference_id, reference_type
  ) VALUES (
    NEW.shop_id, NEW.product_id, 'SALE',
    COALESCE(v_qty_before, 0), -NEW.quantity, v_qty_after,
    NEW.transaction_id, 'transaction'
  );

  RETURN NEW;
END;
$$;

-- ─── New: increment stock when a purchase item is received ────────────────────
CREATE OR REPLACE FUNCTION public.increment_stock_on_purchase()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_qty_before INT;
BEGIN
  SELECT quantity INTO v_qty_before
    FROM public.stock_levels WHERE product_id = NEW.product_id;

  UPDATE public.stock_levels
    SET quantity = COALESCE(quantity, 0) + NEW.quantity, updated_at = now()
    WHERE product_id = NEW.product_id;

  UPDATE public.products
    SET buying_price = NEW.buying_price, updated_at = now()
    WHERE id = NEW.product_id;

  INSERT INTO public.stock_movements (
    shop_id, product_id, movement_type,
    quantity_before, quantity_change, quantity_after,
    reference_id, reference_type
  ) VALUES (
    NEW.shop_id, NEW.product_id, 'PURCHASE',
    COALESCE(v_qty_before, 0), NEW.quantity, COALESCE(v_qty_before, 0) + NEW.quantity,
    NEW.purchase_id, 'purchase'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_increment_stock_purchase
  AFTER INSERT ON public.purchase_items
  FOR EACH ROW EXECUTE FUNCTION public.increment_stock_on_purchase();

-- ─── Atomic sale processing RPC ──────────────────────────────────────────────
-- Wraps transaction + items insert in a single DB call to prevent partial writes.
CREATE OR REPLACE FUNCTION public.process_sale(
  p_shop_id       UUID,
  p_staff_id      UUID,
  p_payment_method TEXT,
  p_total_amount  NUMERIC,
  p_discount      NUMERIC  DEFAULT 0,
  p_notes         TEXT     DEFAULT NULL,
  p_items         JSONB    DEFAULT '[]'::JSONB
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_txn_id UUID;
  v_item   JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.shops WHERE id = p_shop_id AND owner_user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Unauthorized: shop does not belong to user';
  END IF;

  INSERT INTO public.transactions (
    shop_id, staff_id, payment_method, total_amount, discount, notes, sync_status
  ) VALUES (
    p_shop_id, p_staff_id, p_payment_method, p_total_amount, p_discount, p_notes, 'synced'
  ) RETURNING id INTO v_txn_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    INSERT INTO public.transaction_items (
      transaction_id, product_id, shop_id,
      quantity, unit_price, buying_price, item_discount, subtotal
    ) VALUES (
      v_txn_id,
      (v_item->>'product_id')::UUID,
      p_shop_id,
      (v_item->>'quantity')::INT,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'buying_price')::NUMERIC, 0),
      COALESCE((v_item->>'item_discount')::NUMERIC, 0),
      (v_item->>'subtotal')::NUMERIC
    );
  END LOOP;

  RETURN json_build_object('success', true, 'transaction_id', v_txn_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_sale(UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, JSONB)
  TO authenticated;

-- ─── Updated dashboard view: adds profit + expenses ──────────────────────────
CREATE OR REPLACE VIEW public.v_dashboard_today AS
SELECT
  s.id   AS shop_id,
  s.name AS shop_name,
  COALESCE(SUM(t.total_amount), 0)  AS revenue_today,
  COUNT(DISTINCT t.id)              AS transactions_today,
  COUNT(DISTINCT t.staff_id)        AS active_staff_today,
  (
    SELECT COUNT(*) FROM public.stock_levels sl
    JOIN public.products p2 ON p2.id = sl.product_id
    WHERE sl.shop_id = s.id AND p2.active = true AND sl.quantity <= sl.reorder_threshold
  )                                  AS low_stock_count,
  (
    SELECT COUNT(*) FROM public.cash_reconciliations cr
    WHERE cr.shop_id = s.id AND cr.shift_date = CURRENT_DATE AND cr.variance <> 0
  )                                  AS variance_alerts_today,
  COALESCE((
    SELECT SUM(e.amount) FROM public.expenses e
    WHERE e.shop_id = s.id AND e.expense_date = CURRENT_DATE
  ), 0)                              AS expenses_today,
  COALESCE((
    SELECT SUM((ti.unit_price - ti.buying_price) * ti.quantity - ti.item_discount)
    FROM public.transaction_items ti
    JOIN public.transactions t2 ON t2.id = ti.transaction_id
    WHERE t2.shop_id = s.id AND DATE(t2.created_at) = CURRENT_DATE AND t2.sync_status = 'synced'
  ), 0)                              AS profit_today
FROM public.shops s
LEFT JOIN public.transactions t
  ON t.shop_id = s.id
  AND DATE(t.created_at) = CURRENT_DATE
  AND t.sync_status = 'synced'
GROUP BY s.id, s.name;
