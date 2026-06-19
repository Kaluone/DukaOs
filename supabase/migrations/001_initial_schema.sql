-- ============================================================
-- DukaOS — Initial Schema Migration
-- 001_initial_schema.sql
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SHOPS
-- ============================================================
CREATE TABLE public.shops (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             TEXT NOT NULL,
  owner_user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vfd_enabled      BOOLEAN NOT NULL DEFAULT false,
  vfd_provider_config JSONB,
  phone            TEXT,
  address          TEXT,
  currency         TEXT NOT NULL DEFAULT 'TZS',
  timezone         TEXT NOT NULL DEFAULT 'Africa/Dar_es_Salaam',
  language         TEXT NOT NULL DEFAULT 'sw',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STAFF
-- ============================================================
CREATE TABLE public.staff (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  pin_hash    TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- PRODUCTS
-- ============================================================
CREATE TABLE public.products (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  photo_url  TEXT,
  price      NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  category   TEXT,
  active     BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- STOCK LEVELS
-- ============================================================
CREATE TABLE public.stock_levels (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id        UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  shop_id           UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quantity          INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_threshold INT NOT NULL DEFAULT 2 CHECK (reorder_threshold >= 0),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(product_id)
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE public.transactions (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id       UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash'
                 CHECK (payment_method IN ('cash','mpesa','tigopesa','airtelmoney','halopesa','other')),
  total_amount   NUMERIC(12, 2) NOT NULL CHECK (total_amount >= 0),
  sync_status    TEXT NOT NULL DEFAULT 'synced'
                 CHECK (sync_status IN ('pending','synced','failed')),
  offline_id     TEXT UNIQUE,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- TRANSACTION ITEMS
-- ============================================================
CREATE TABLE public.transaction_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  quantity       INT NOT NULL CHECK (quantity > 0),
  unit_price     NUMERIC(12, 2) NOT NULL CHECK (unit_price >= 0)
);

-- ============================================================
-- CASH RECONCILIATIONS
-- ============================================================
CREATE TABLE public.cash_reconciliations (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id       UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  shift_date     DATE NOT NULL,
  expected_cash  NUMERIC(12, 2) NOT NULL,
  actual_cash    NUMERIC(12, 2) NOT NULL,
  variance       NUMERIC(12, 2) GENERATED ALWAYS AS (actual_cash - expected_cash) STORED,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- VFD RECEIPTS
-- ============================================================
CREATE TABLE public.vfd_receipts (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id     UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  shop_id            UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider_reference TEXT,
  qr_code_url        TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','submitted','confirmed','failed')),
  error_message      TEXT,
  retry_count        INT NOT NULL DEFAULT 0,
  submitted_at       TIMESTAMPTZ,
  confirmed_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- MOBILE MONEY PAYMENTS
-- ============================================================
CREATE TABLE public.mobile_money_payments (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id       UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  shop_id              UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  provider             TEXT NOT NULL
                       CHECK (provider IN ('mpesa','tigopesa','airtelmoney','halopesa')),
  aggregator_reference TEXT,
  amount               NUMERIC(12, 2) NOT NULL,
  matched              BOOLEAN NOT NULL DEFAULT false,
  matched_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATIONS LOG
-- ============================================================
CREATE TABLE public.notifications_log (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  type       TEXT NOT NULL
             CHECK (type IN ('sale_alert','low_stock','reconciliation_variance','daily_digest','weekly_digest')),
  channel    TEXT NOT NULL
             CHECK (channel IN ('push','whatsapp','sms')),
  payload    JSONB,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending','sent','failed')),
  sent_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- NOTIFICATION PREFERENCES
-- ============================================================
CREATE TABLE public.notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id               UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE UNIQUE,
  sale_alert_threshold  NUMERIC(12, 2) NOT NULL DEFAULT 50000,
  push_enabled          BOOLEAN NOT NULL DEFAULT true,
  whatsapp_enabled      BOOLEAN NOT NULL DEFAULT true,
  sms_enabled           BOOLEAN NOT NULL DEFAULT false,
  daily_digest_time     TIME NOT NULL DEFAULT '20:00:00',
  whatsapp_number       TEXT,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- AUDIT LOG (append-only — no DELETE or UPDATE)
-- ============================================================
CREATE TABLE public.audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID REFERENCES public.shops(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  table_name TEXT,
  record_id  TEXT,
  user_id    UUID,
  old_data   JSONB,
  new_data   JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX idx_transactions_shop_id   ON public.transactions(shop_id);
CREATE INDEX idx_transactions_created   ON public.transactions(created_at DESC);
CREATE INDEX idx_transactions_staff     ON public.transactions(staff_id);
CREATE INDEX idx_transaction_items_txn  ON public.transaction_items(transaction_id);
CREATE INDEX idx_products_shop_id       ON public.products(shop_id);
CREATE INDEX idx_stock_levels_shop      ON public.stock_levels(shop_id);
CREATE INDEX idx_notifications_shop     ON public.notifications_log(shop_id);
CREATE INDEX idx_reconciliations_shop   ON public.cash_reconciliations(shop_id);
CREATE INDEX idx_reconciliations_date   ON public.cash_reconciliations(shift_date DESC);
CREATE INDEX idx_vfd_receipts_status    ON public.vfd_receipts(status) WHERE status IN ('pending','failed');
CREATE INDEX idx_audit_logs_shop        ON public.audit_logs(shop_id);
CREATE INDEX idx_audit_logs_created     ON public.audit_logs(created_at DESC);
