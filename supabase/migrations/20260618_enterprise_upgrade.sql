-- =============================================================
-- DukaOS Enterprise Upgrade Migration
-- Covers: lifecycle_status, sync_log, push_subscriptions,
--         notification_settings, notification_history,
--         loyalty_tiers, loyalty_transactions, tax_rates,
--         receipt_templates, feature_flags, credit_customers view
-- =============================================================

-- ── Purchases: lifecycle status ─────────────────────────────
ALTER TABLE purchases
  ADD COLUMN IF NOT EXISTS lifecycle_status VARCHAR DEFAULT 'draft';

-- ── Sync log ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sync_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  operation     TEXT NOT NULL CHECK (operation IN ('insert','update','delete')),
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','synced','conflict','error')),
  payload       JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at     TIMESTAMPTZ
);

ALTER TABLE sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sync_log_shop" ON sync_log
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sync_log_shop_status ON sync_log(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_log_created ON sync_log(created_at DESC);

-- ── Push subscriptions ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  device_label TEXT,
  endpoint     TEXT NOT NULL,
  p256dh       TEXT,
  auth_key     TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_shop" ON push_subscriptions
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_push_subs_shop ON push_subscriptions(shop_id);

-- ── Notification settings ────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_settings (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  triggers   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_settings_shop" ON notification_settings
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- ── Notification history ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_history (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id          UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  body             TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'manual',
  status           TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','partial')),
  recipient_count  INTEGER NOT NULL DEFAULT 0,
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notification_history_shop" ON notification_history
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_notif_history_shop ON notification_history(shop_id, sent_at DESC);

-- ── Loyalty tiers ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_tiers (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  min_points      INTEGER NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  color           TEXT DEFAULT '#3b82f6',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_tiers_shop" ON loyalty_tiers
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- ── Loyalty transactions ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  points        INTEGER NOT NULL,
  reason        TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_transactions_shop" ON loyalty_transactions
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_customer ON loyalty_transactions(customer_id);

-- ── Tax rates ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tax_rates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id       UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  rate          NUMERIC(6,4) NOT NULL,
  type          TEXT NOT NULL DEFAULT 'exclusive' CHECK (type IN ('inclusive','exclusive')),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tax_rates_shop" ON tax_rates
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- Only one default per shop
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_default
  ON tax_rates(shop_id) WHERE is_default = true;

-- ── Receipt templates ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS receipt_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL UNIQUE REFERENCES shops(id) ON DELETE CASCADE,
  show_logo       BOOLEAN NOT NULL DEFAULT true,
  show_qr         BOOLEAN NOT NULL DEFAULT true,
  show_barcode    BOOLEAN NOT NULL DEFAULT false,
  show_tax        BOOLEAN NOT NULL DEFAULT true,
  show_discount   BOOLEAN NOT NULL DEFAULT true,
  show_cashier    BOOLEAN NOT NULL DEFAULT false,
  paper_width     INTEGER NOT NULL DEFAULT 80,
  font_size       INTEGER NOT NULL DEFAULT 12,
  header_text     TEXT DEFAULT '',
  footer_text     TEXT DEFAULT 'Asante kwa kununua!',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE receipt_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipt_templates_shop" ON receipt_templates
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- ── Feature flags ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feature_flags (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  enabled    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (shop_id, key)
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "feature_flags_shop" ON feature_flags
  USING (shop_id IN (SELECT id FROM shops WHERE owner_user_id = auth.uid()));

-- ── Document storage bucket (idempotent) ──────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "documents_shop_access"
ON storage.objects FOR ALL
USING (
  bucket_id = 'documents'
  AND (storage.foldername(name))[1] IN (
    SELECT id::text FROM shops WHERE owner_user_id = auth.uid()
  )
);

-- ── Customers: loyalty points column ─────────────────────────
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS loyalty_points INTEGER NOT NULL DEFAULT 0;

-- ── Products: barcode column ──────────────────────────────────
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS barcode TEXT;

CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
