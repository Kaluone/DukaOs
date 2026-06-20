-- ============================================================
-- DukaOS — Enterprise Features Migration
-- 006_enterprise_features.sql
-- Phases 11–40: Branches, Roles, Approvals, Refunds,
-- Transfers, Stock Counts, Loyalty, Promotions, Coupons,
-- Tax, Accounting, Cash Registers, Shifts, EOD, Receipts,
-- Documents, Notifications, APIs, Webhooks, Feature Flags
-- ============================================================

-- ─── PHASE 11: MULTI-BRANCH MANAGEMENT ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.branches (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  manager_name TEXT,
  is_main      BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branches_shop ON public.branches(shop_id);

-- Auto-insert main branch for existing shops (handled by app on first use)

-- Add branch_id to key tables (nullable for backward compat)
ALTER TABLE public.transactions    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.expenses        ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.purchases       ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);
ALTER TABLE public.stock_levels    ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

CREATE INDEX IF NOT EXISTS idx_transactions_branch  ON public.transactions(branch_id);
CREATE INDEX IF NOT EXISTS idx_expenses_branch      ON public.expenses(branch_id);
CREATE INDEX IF NOT EXISTS idx_purchases_branch     ON public.purchases(branch_id);

-- Branch staff assignments
CREATE TABLE IF NOT EXISTS public.branch_staff (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id  UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  staff_id   UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  is_manager BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (branch_id, staff_id)
);
CREATE INDEX IF NOT EXISTS idx_branch_staff_branch ON public.branch_staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_staff_staff  ON public.branch_staff(staff_id);

-- ─── PHASE 12: ENTERPRISE ROLE & PERMISSION SYSTEM ──────────────────────────

CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        TEXT NOT NULL UNIQUE,  -- e.g. 'view_profit', 'refund_sale'
  name        TEXT NOT NULL,
  description TEXT,
  category    TEXT NOT NULL DEFAULT 'general',
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.permissions (code, name, description, category) VALUES
  ('view_profit',      'View Profit',          'See profit margins and cost prices',      'reports'),
  ('view_cost_price',  'View Cost Price',       'See buying/cost prices on products',      'reports'),
  ('refund_sale',      'Refund Sale',           'Process refunds on completed sales',      'sales'),
  ('delete_sale',      'Delete Sale',           'Delete sales records',                    'sales'),
  ('delete_expense',   'Delete Expense',        'Delete expense records',                  'expenses'),
  ('export_reports',   'Export Reports',        'Export reports to Excel/PDF',             'reports'),
  ('manage_billing',   'Manage Billing',        'View and manage subscription billing',    'admin'),
  ('manage_staff',     'Manage Staff',          'Add, edit, deactivate staff',             'staff'),
  ('manage_products',  'Manage Products',       'Add, edit, delete products',              'products'),
  ('manage_branches',  'Manage Branches',       'Create and configure branches',           'branches'),
  ('manage_customers', 'Manage Customers',      'Add and edit customer records',           'customers'),
  ('manage_purchases', 'Manage Purchases',      'Create and approve purchase orders',      'purchases'),
  ('manage_suppliers', 'Manage Suppliers',      'Add and edit supplier records',           'suppliers'),
  ('access_ai',        'Access AI Assistant',   'Use the AI business assistant',           'ai'),
  ('access_admin',     'Access Admin Panel',    'Access the super admin panel',            'admin'),
  ('configure_vfd',    'Configure VFD/EFD',     'Set up fiscal device integration',        'settings'),
  ('approve_requests', 'Approve Requests',      'Approve or reject workflow requests',     'approvals'),
  ('manage_inventory', 'Manage Inventory',      'Adjust stock levels and transfers',       'inventory'),
  ('view_audit',       'View Audit Log',        'Access the audit trail',                  'security'),
  ('manage_coupons',   'Manage Coupons',        'Create and manage coupon codes',          'promotions'),
  ('manage_promotions','Manage Promotions',     'Create and manage promotions',            'promotions'),
  ('close_shift',      'Close Shift',           'Close cash register shifts',              'cash'),
  ('manage_tax',       'Manage Tax',            'Configure tax rates',                     'settings')
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.roles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,           -- e.g. 'Owner', 'Manager', 'Cashier'
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, name)
);
CREATE INDEX IF NOT EXISTS idx_roles_shop ON public.roles(shop_id);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE (role_id, permission_id)
);
CREATE INDEX IF NOT EXISTS idx_role_perms_role ON public.role_permissions(role_id);

-- Per-user permission overrides
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id      UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted       BOOLEAN NOT NULL DEFAULT true,  -- true=grant override, false=revoke override
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, staff_id, permission_id)
);

-- Add role_id to staff
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.roles(id);
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS email   TEXT;

-- ─── PHASE 13: APPROVAL WORKFLOW ENGINE ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  request_type    TEXT NOT NULL CHECK (request_type IN (
    'refund','expense_approval','purchase_approval',
    'price_change','stock_adjustment','product_deletion'
  )),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'draft','pending','approved','rejected','executed','cancelled'
  )),
  requester_id    UUID REFERENCES public.staff(id),
  approver_id     UUID REFERENCES public.staff(id),
  reference_id    UUID,
  reference_type  TEXT,
  amount          NUMERIC(12,2),
  reason          TEXT,
  notes           TEXT,
  payload         JSONB DEFAULT '{}',
  requested_at    TIMESTAMPTZ DEFAULT now(),
  reviewed_at     TIMESTAMPTZ,
  executed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_approval_shop    ON public.approval_requests(shop_id);
CREATE INDEX IF NOT EXISTS idx_approval_status  ON public.approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_type    ON public.approval_requests(request_type);

-- ─── PHASE 14: REFUND MANAGEMENT ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.refunds (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  transaction_id  UUID NOT NULL REFERENCES public.transactions(id),
  branch_id       UUID REFERENCES public.branches(id),
  refund_type     TEXT NOT NULL DEFAULT 'full' CHECK (refund_type IN ('full','partial','item')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','completed')),
  total_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,
  reason          TEXT,
  processed_by    UUID REFERENCES public.staff(id),
  approval_id     UUID REFERENCES public.approval_requests(id),
  payment_reversed BOOLEAN NOT NULL DEFAULT false,
  stock_restored   BOOLEAN NOT NULL DEFAULT false,
  receipt_number  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_shop        ON public.refunds(shop_id);
CREATE INDEX IF NOT EXISTS idx_refunds_transaction ON public.refunds(transaction_id);

CREATE TABLE IF NOT EXISTS public.refund_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_id       UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  transaction_item_id UUID REFERENCES public.transaction_items(id),
  product_id      UUID REFERENCES public.products(id),
  quantity        INT NOT NULL DEFAULT 1,
  unit_price      NUMERIC(12,2) NOT NULL,
  subtotal        NUMERIC(12,2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refund_items_refund ON public.refund_items(refund_id);

-- ─── PHASE 15: PURCHASE LIFECYCLE ENHANCEMENT ───────────────────────────────

ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received'
  CHECK (status IN ('draft','pending','approved','ordered','partially_received','received','closed','cancelled'));
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS expected_date DATE;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS approved_by   UUID REFERENCES public.staff(id);
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS approved_at   TIMESTAMPTZ;
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS ordered_at    TIMESTAMPTZ;

-- ─── PHASE 16: INVENTORY TRANSFER ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory_transfers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  from_branch_id  UUID NOT NULL REFERENCES public.branches(id),
  to_branch_id    UUID NOT NULL REFERENCES public.branches(id),
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft','sent','in_transit','received','completed','cancelled'
  )),
  reference_number TEXT,
  notes           TEXT,
  initiated_by    UUID REFERENCES public.staff(id),
  received_by     UUID REFERENCES public.staff(id),
  sent_at         TIMESTAMPTZ,
  received_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfers_shop      ON public.inventory_transfers(shop_id);
CREATE INDEX IF NOT EXISTS idx_transfers_from      ON public.inventory_transfers(from_branch_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to        ON public.inventory_transfers(to_branch_id);

CREATE TABLE IF NOT EXISTS public.inventory_transfer_items (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transfer_id    UUID NOT NULL REFERENCES public.inventory_transfers(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id),
  quantity_sent  INT NOT NULL DEFAULT 0,
  quantity_received INT NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_transfer_items ON public.inventory_transfer_items(transfer_id);

-- ─── PHASE 17: STOCK COUNT & RECONCILIATION ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.branches(id),
  count_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  status          TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN (
    'in_progress','pending_approval','approved','rejected','applied'
  )),
  counted_by      UUID REFERENCES public.staff(id),
  approved_by     UUID REFERENCES public.staff(id),
  approval_id     UUID REFERENCES public.approval_requests(id),
  notes           TEXT,
  total_variance  NUMERIC(12,2) GENERATED ALWAYS AS (0) STORED,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_counts_shop ON public.stock_counts(shop_id);

-- Drop the generated column and re-add without the incorrect default
ALTER TABLE public.stock_counts DROP COLUMN IF EXISTS total_variance;
ALTER TABLE public.stock_counts ADD COLUMN IF NOT EXISTS total_variance NUMERIC(12,2) DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_count_id  UUID NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  product_id      UUID NOT NULL REFERENCES public.products(id),
  system_quantity INT NOT NULL DEFAULT 0,
  physical_quantity INT NOT NULL DEFAULT 0,
  variance        INT GENERATED ALWAYS AS (physical_quantity - system_quantity) STORED,
  variance_value  NUMERIC(12,2) DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_count_items ON public.stock_count_items(stock_count_id);

-- ─── PHASE 18: CUSTOMER LOYALTY ENHANCEMENT ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loyalty_tiers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,  -- Bronze, Silver, Gold, Platinum
  min_points      INT NOT NULL DEFAULT 0,
  points_per_100  INT NOT NULL DEFAULT 1,  -- points earned per 100 currency units
  discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  color           TEXT DEFAULT '#6b7280',
  benefits        JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_tiers_shop ON public.loyalty_tiers(shop_id);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  transaction_id  UUID REFERENCES public.transactions(id),
  type            TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust','expire')),
  points          INT NOT NULL,
  balance_before  INT NOT NULL DEFAULT 0,
  balance_after   INT NOT NULL DEFAULT 0,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_shop      ON public.loyalty_transactions(shop_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_txn_customer  ON public.loyalty_transactions(customer_id);

-- Loyalty config per shop
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS loyalty_enabled        BOOLEAN DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS loyalty_earn_rate      INT DEFAULT 1;   -- points per 100 units
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS loyalty_redeem_rate    INT DEFAULT 100; -- points needed per 1 unit discount

-- ─── PHASE 19 & 20: PROMOTIONS, DISCOUNTS & COUPONS ─────────────────────────

CREATE TABLE IF NOT EXISTS public.promotions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  type            TEXT NOT NULL CHECK (type IN (
    'percentage','fixed','buy_x_get_y','bundle','category','customer','happy_hour','weekend'
  )),
  value           NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_purchase    NUMERIC(12,2) DEFAULT 0,
  applies_to      TEXT NOT NULL DEFAULT 'all' CHECK (applies_to IN ('all','product','category','customer')),
  target_ids      JSONB DEFAULT '[]',       -- product/category/customer ids
  buy_quantity    INT DEFAULT NULL,         -- for buy_x_get_y
  get_quantity    INT DEFAULT NULL,
  get_product_id  UUID REFERENCES public.products(id),
  happy_hour_start TIME,
  happy_hour_end  TIME,
  active_days     JSONB DEFAULT '[0,1,2,3,4,5,6]',  -- 0=Sun...6=Sat
  is_active       BOOLEAN NOT NULL DEFAULT true,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  usage_count     INT NOT NULL DEFAULT 0,
  usage_limit     INT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_promotions_shop   ON public.promotions(shop_id);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON public.promotions(is_active, ends_at);

CREATE TABLE IF NOT EXISTS public.coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code            TEXT NOT NULL,
  description     TEXT,
  discount_type   TEXT NOT NULL DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value  NUMERIC(12,2) NOT NULL,
  min_purchase    NUMERIC(12,2) DEFAULT 0,
  usage_limit     INT,
  usage_count     INT NOT NULL DEFAULT 0,
  customer_id     UUID REFERENCES public.customers(id),  -- restrict to one customer
  is_active       BOOLEAN NOT NULL DEFAULT true,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coupons_shop ON public.coupons(shop_id);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons(shop_id, code);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_id      UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id),
  customer_id    UUID REFERENCES public.customers(id),
  discount_applied NUMERIC(12,2) NOT NULL DEFAULT 0,
  used_at        TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupon_usages ON public.coupon_usages(coupon_id);

-- Add coupon_id to transactions
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS coupon_id      UUID REFERENCES public.coupons(id);
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS promotion_ids  JSONB DEFAULT '[]';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(12,2) DEFAULT 0;

-- ─── PHASE 21: TAX ENGINE ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tax_rates (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  code         TEXT NOT NULL,  -- e.g. 'VAT18', 'ZERO', 'EXEMPT'
  rate         NUMERIC(5,2) NOT NULL DEFAULT 0,
  type         TEXT NOT NULL DEFAULT 'standard' CHECK (type IN ('standard','zero','exempt')),
  is_inclusive BOOLEAN NOT NULL DEFAULT true,
  is_default   BOOLEAN NOT NULL DEFAULT false,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_rates_shop ON public.tax_rates(shop_id);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tax_rate_id UUID REFERENCES public.tax_rates(id);
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS tax_rate   NUMERIC(5,2)  DEFAULT 0;
ALTER TABLE public.transactions       ADD COLUMN IF NOT EXISTS tax_total  NUMERIC(12,2) DEFAULT 0;

-- ─── PHASE 22: ACCOUNTING FOUNDATION ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('asset','liability','equity','revenue','expense')),
  sub_type    TEXT,
  parent_id   UUID REFERENCES public.chart_of_accounts(id),
  is_active   BOOLEAN NOT NULL DEFAULT true,
  balance     NUMERIC(15,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coa_shop ON public.chart_of_accounts(shop_id);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  reference       TEXT,
  description     TEXT,
  source          TEXT,  -- 'sale', 'purchase', 'expense', 'manual'
  source_id       UUID,
  is_posted       BOOLEAN NOT NULL DEFAULT false,
  created_by      UUID REFERENCES public.staff(id),
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_shop ON public.journal_entries(shop_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON public.journal_entries(entry_date);

CREATE TABLE IF NOT EXISTS public.journal_lines (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id       UUID NOT NULL REFERENCES public.chart_of_accounts(id),
  debit            NUMERIC(15,2) NOT NULL DEFAULT 0,
  credit           NUMERIC(15,2) NOT NULL DEFAULT 0,
  description      TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry   ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);

-- ─── PHASE 23: CASH REGISTER MANAGEMENT ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.cash_registers (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES public.branches(id),
  name         TEXT NOT NULL DEFAULT 'Main Register',
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cash_registers_shop ON public.cash_registers(shop_id);

CREATE TABLE IF NOT EXISTS public.register_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  register_id     UUID REFERENCES public.cash_registers(id),
  branch_id       UUID REFERENCES public.branches(id),
  staff_id        UUID REFERENCES public.staff(id),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opening_cash    NUMERIC(12,2) NOT NULL DEFAULT 0,
  closing_cash    NUMERIC(12,2),
  cash_in         NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_out        NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash   NUMERIC(12,2),
  actual_cash     NUMERIC(12,2),
  variance        NUMERIC(12,2),
  sales_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  transactions_count INT NOT NULL DEFAULT 0,
  notes           TEXT,
  opened_at       TIMESTAMPTZ DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_register_sessions_shop    ON public.register_sessions(shop_id);
CREATE INDEX IF NOT EXISTS idx_register_sessions_status  ON public.register_sessions(status);

-- ─── PHASE 24: SHIFT MANAGEMENT ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.shifts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES public.branches(id),
  staff_id         UUID REFERENCES public.staff(id),
  register_session_id UUID REFERENCES public.register_sessions(id),
  shift_type       TEXT NOT NULL DEFAULT 'morning' CHECK (shift_type IN ('morning','afternoon','night','custom')),
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','closed')),
  start_time       TIMESTAMPTZ DEFAULT now(),
  end_time         TIMESTAMPTZ,
  sales_count      INT NOT NULL DEFAULT 0,
  sales_total      NUMERIC(12,2) NOT NULL DEFAULT 0,
  expenses_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_handled     NUMERIC(12,2) NOT NULL DEFAULT 0,
  variance         NUMERIC(12,2),
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_shop   ON public.shifts(shop_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff  ON public.shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);

-- ─── PHASE 25: END OF DAY CLOSING ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.eod_closings (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  branch_id        UUID REFERENCES public.branches(id),
  closing_date     DATE NOT NULL DEFAULT CURRENT_DATE,
  closed_by        UUID REFERENCES public.staff(id),
  total_sales      NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_refunds    NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses   NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_purchases  NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_profit     NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_profit       NUMERIC(12,2) NOT NULL DEFAULT 0,
  cash_balance     NUMERIC(12,2) NOT NULL DEFAULT 0,
  transactions_count INT NOT NULL DEFAULT 0,
  inventory_changes  JSONB DEFAULT '[]',
  summary_data     JSONB DEFAULT '{}',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, closing_date, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_eod_closings_shop ON public.eod_closings(shop_id);
CREATE INDEX IF NOT EXISTS idx_eod_closings_date ON public.eod_closings(closing_date);

-- ─── PHASE 26: RECEIPT DESIGNER ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.receipt_templates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id          UUID NOT NULL UNIQUE REFERENCES public.shops(id) ON DELETE CASCADE,
  logo_url         TEXT,
  header_text      TEXT,
  footer_text      TEXT,
  show_barcode     BOOLEAN NOT NULL DEFAULT false,
  show_qr_code     BOOLEAN NOT NULL DEFAULT true,
  paper_width      INT NOT NULL DEFAULT 80,  -- mm (58 or 80)
  font_size        INT NOT NULL DEFAULT 12,
  show_tax         BOOLEAN NOT NULL DEFAULT true,
  show_cashier     BOOLEAN NOT NULL DEFAULT true,
  show_customer    BOOLEAN NOT NULL DEFAULT true,
  custom_fields    JSONB DEFAULT '[]',
  color_primary    TEXT DEFAULT '#1a1a2e',
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- ─── PHASE 29: DOCUMENT ATTACHMENTS ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.document_attachments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  entity_type     TEXT NOT NULL,  -- 'purchase', 'expense', 'supplier', 'transaction', 'refund'
  entity_id       UUID NOT NULL,
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       INT,
  mime_type       TEXT,
  uploaded_by     UUID REFERENCES public.staff(id),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_attachments_entity ON public.document_attachments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_doc_attachments_shop   ON public.document_attachments(shop_id);

-- ─── PHASE 30: NOTIFICATION CENTER ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  user_id         UUID,  -- Supabase auth user
  type            TEXT NOT NULL CHECK (type IN (
    'low_stock','subscription_alert','payment_failure','system_update',
    'approval_request','approval_decision','sale_alert','eod_reminder',
    'shift_start','shift_end','transfer_received','refund_processed'
  )),
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  icon            TEXT DEFAULT 'bell',
  action_url      TEXT,
  is_read         BOOLEAN NOT NULL DEFAULT false,
  read_at         TIMESTAMPTZ,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_shop    ON public.notifications(shop_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(shop_id, is_read) WHERE is_read = false;

-- ─── PHASE 31: DEVELOPER API KEYS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.api_keys (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  key_prefix   TEXT NOT NULL,        -- first 8 chars shown in UI
  key_hash     TEXT NOT NULL UNIQUE, -- bcrypt/sha256 hash of full key
  permissions  JSONB DEFAULT '["read"]',
  last_used_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now(),
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_api_keys_shop ON public.api_keys(shop_id);

-- ─── PHASE 32: WEBHOOK SYSTEM ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.webhooks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  events       JSONB NOT NULL DEFAULT '[]',
  secret       TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  retry_count  INT NOT NULL DEFAULT 3,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhooks_shop ON public.webhooks(shop_id);

CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id    UUID NOT NULL REFERENCES public.webhooks(id) ON DELETE CASCADE,
  shop_id       UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL DEFAULT '{}',
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','retrying')),
  response_code INT,
  response_body TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON public.webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status  ON public.webhook_deliveries(status);

-- ─── PHASE 36: FEATURE FLAGS ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.feature_flags (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id     UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  flag        TEXT NOT NULL,  -- 'restaurant_mode', 'salon_mode', 'wholesale_mode', etc.
  enabled     BOOLEAN NOT NULL DEFAULT false,
  config      JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (shop_id, flag)
);
CREATE INDEX IF NOT EXISTS idx_feature_flags_shop ON public.feature_flags(shop_id);

-- ─── RLS POLICIES FOR NEW TABLES ─────────────────────────────────────────────

ALTER TABLE public.branches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_staff            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_requests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_items            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transfer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_counts            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_count_items       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_tiers           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupon_usages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_rates               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_registers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eod_closings            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receipt_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags           ENABLE ROW LEVEL SECURITY;

-- Helper function: get shop_id for authenticated user
CREATE OR REPLACE FUNCTION public.auth_shop_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT id FROM public.shops WHERE owner_user_id = auth.uid() LIMIT 1;
$$;

-- Generic shop-owner RLS policy macro (applied per table below)
-- branches
CREATE POLICY "branches_owner" ON public.branches
  USING (shop_id = public.auth_shop_id());
CREATE POLICY "branches_insert" ON public.branches
  WITH CHECK (shop_id = public.auth_shop_id());

-- branch_staff
CREATE POLICY "branch_staff_owner" ON public.branch_staff
  USING (shop_id = public.auth_shop_id());
CREATE POLICY "branch_staff_insert" ON public.branch_staff
  WITH CHECK (shop_id = public.auth_shop_id());

-- permissions (read-only, no shop filter)
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT USING (true);

-- roles
CREATE POLICY "roles_owner" ON public.roles USING (shop_id = public.auth_shop_id());
CREATE POLICY "roles_insert" ON public.roles WITH CHECK (shop_id = public.auth_shop_id());

-- role_permissions (join through roles)
CREATE POLICY "role_perms_owner" ON public.role_permissions
  USING (EXISTS (SELECT 1 FROM public.roles r WHERE r.id = role_id AND r.shop_id = public.auth_shop_id()));

-- user_permissions
CREATE POLICY "user_perms_owner" ON public.user_permissions USING (shop_id = public.auth_shop_id());
CREATE POLICY "user_perms_insert" ON public.user_permissions WITH CHECK (shop_id = public.auth_shop_id());

-- approval_requests
CREATE POLICY "approvals_owner" ON public.approval_requests USING (shop_id = public.auth_shop_id());
CREATE POLICY "approvals_insert" ON public.approval_requests WITH CHECK (shop_id = public.auth_shop_id());

-- refunds
CREATE POLICY "refunds_owner" ON public.refunds USING (shop_id = public.auth_shop_id());
CREATE POLICY "refunds_insert" ON public.refunds WITH CHECK (shop_id = public.auth_shop_id());

-- refund_items (join through refunds)
CREATE POLICY "refund_items_owner" ON public.refund_items
  USING (EXISTS (SELECT 1 FROM public.refunds r WHERE r.id = refund_id AND r.shop_id = public.auth_shop_id()));

-- inventory_transfers
CREATE POLICY "inv_transfers_owner" ON public.inventory_transfers USING (shop_id = public.auth_shop_id());
CREATE POLICY "inv_transfers_insert" ON public.inventory_transfers WITH CHECK (shop_id = public.auth_shop_id());

-- inventory_transfer_items
CREATE POLICY "inv_transfer_items_owner" ON public.inventory_transfer_items
  USING (EXISTS (SELECT 1 FROM public.inventory_transfers t WHERE t.id = transfer_id AND t.shop_id = public.auth_shop_id()));

-- stock_counts
CREATE POLICY "stock_counts_owner" ON public.stock_counts USING (shop_id = public.auth_shop_id());
CREATE POLICY "stock_counts_insert" ON public.stock_counts WITH CHECK (shop_id = public.auth_shop_id());

-- stock_count_items
CREATE POLICY "stock_count_items_owner" ON public.stock_count_items
  USING (EXISTS (SELECT 1 FROM public.stock_counts c WHERE c.id = stock_count_id AND c.shop_id = public.auth_shop_id()));

-- loyalty_tiers
CREATE POLICY "loyalty_tiers_owner" ON public.loyalty_tiers USING (shop_id = public.auth_shop_id());
CREATE POLICY "loyalty_tiers_insert" ON public.loyalty_tiers WITH CHECK (shop_id = public.auth_shop_id());

-- loyalty_transactions
CREATE POLICY "loyalty_txn_owner" ON public.loyalty_transactions USING (shop_id = public.auth_shop_id());
CREATE POLICY "loyalty_txn_insert" ON public.loyalty_transactions WITH CHECK (shop_id = public.auth_shop_id());

-- promotions
CREATE POLICY "promotions_owner" ON public.promotions USING (shop_id = public.auth_shop_id());
CREATE POLICY "promotions_insert" ON public.promotions WITH CHECK (shop_id = public.auth_shop_id());

-- coupons
CREATE POLICY "coupons_owner" ON public.coupons USING (shop_id = public.auth_shop_id());
CREATE POLICY "coupons_insert" ON public.coupons WITH CHECK (shop_id = public.auth_shop_id());

-- coupon_usages
CREATE POLICY "coupon_usages_owner" ON public.coupon_usages
  USING (EXISTS (SELECT 1 FROM public.coupons c WHERE c.id = coupon_id AND c.shop_id = public.auth_shop_id()));

-- tax_rates
CREATE POLICY "tax_rates_owner" ON public.tax_rates USING (shop_id = public.auth_shop_id());
CREATE POLICY "tax_rates_insert" ON public.tax_rates WITH CHECK (shop_id = public.auth_shop_id());

-- chart_of_accounts
CREATE POLICY "coa_owner" ON public.chart_of_accounts USING (shop_id = public.auth_shop_id());
CREATE POLICY "coa_insert" ON public.chart_of_accounts WITH CHECK (shop_id = public.auth_shop_id());

-- journal_entries
CREATE POLICY "journal_entries_owner" ON public.journal_entries USING (shop_id = public.auth_shop_id());
CREATE POLICY "journal_entries_insert" ON public.journal_entries WITH CHECK (shop_id = public.auth_shop_id());

-- journal_lines
CREATE POLICY "journal_lines_owner" ON public.journal_lines
  USING (EXISTS (SELECT 1 FROM public.journal_entries e WHERE e.id = journal_entry_id AND e.shop_id = public.auth_shop_id()));

-- cash_registers
CREATE POLICY "cash_registers_owner" ON public.cash_registers USING (shop_id = public.auth_shop_id());
CREATE POLICY "cash_registers_insert" ON public.cash_registers WITH CHECK (shop_id = public.auth_shop_id());

-- register_sessions
CREATE POLICY "register_sessions_owner" ON public.register_sessions USING (shop_id = public.auth_shop_id());
CREATE POLICY "register_sessions_insert" ON public.register_sessions WITH CHECK (shop_id = public.auth_shop_id());

-- shifts
CREATE POLICY "shifts_owner" ON public.shifts USING (shop_id = public.auth_shop_id());
CREATE POLICY "shifts_insert" ON public.shifts WITH CHECK (shop_id = public.auth_shop_id());

-- eod_closings
CREATE POLICY "eod_closings_owner" ON public.eod_closings USING (shop_id = public.auth_shop_id());
CREATE POLICY "eod_closings_insert" ON public.eod_closings WITH CHECK (shop_id = public.auth_shop_id());

-- receipt_templates
CREATE POLICY "receipt_templates_owner" ON public.receipt_templates USING (shop_id = public.auth_shop_id());
CREATE POLICY "receipt_templates_insert" ON public.receipt_templates WITH CHECK (shop_id = public.auth_shop_id());

-- document_attachments
CREATE POLICY "doc_attachments_owner" ON public.document_attachments USING (shop_id = public.auth_shop_id());
CREATE POLICY "doc_attachments_insert" ON public.document_attachments WITH CHECK (shop_id = public.auth_shop_id());

-- notifications
CREATE POLICY "notifications_owner" ON public.notifications
  USING (shop_id = public.auth_shop_id() OR user_id = auth.uid());
CREATE POLICY "notifications_insert" ON public.notifications
  WITH CHECK (shop_id = public.auth_shop_id());

-- api_keys
CREATE POLICY "api_keys_owner" ON public.api_keys USING (shop_id = public.auth_shop_id());
CREATE POLICY "api_keys_insert" ON public.api_keys WITH CHECK (shop_id = public.auth_shop_id());

-- webhooks
CREATE POLICY "webhooks_owner" ON public.webhooks USING (shop_id = public.auth_shop_id());
CREATE POLICY "webhooks_insert" ON public.webhooks WITH CHECK (shop_id = public.auth_shop_id());

-- webhook_deliveries
CREATE POLICY "webhook_deliveries_owner" ON public.webhook_deliveries USING (shop_id = public.auth_shop_id());

-- feature_flags
CREATE POLICY "feature_flags_owner" ON public.feature_flags USING (shop_id = public.auth_shop_id());
CREATE POLICY "feature_flags_insert" ON public.feature_flags WITH CHECK (shop_id = public.auth_shop_id());

-- ─── UPDATED TRIGGERS ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY[
    'branches','approval_requests','refunds','inventory_transfers',
    'promotions','webhooks','receipt_templates','shifts'
  ] LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;
       CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      t, t, t, t
    );
  END LOOP;
END $$;

-- ─── SYSTEM DEFAULT ROLES FUNCTION ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_roles(p_shop_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role_id UUID;
  v_perm_id UUID;
  v_all_perms UUID[];
  v_mgr_perms TEXT[] := ARRAY[
    'view_profit','view_cost_price','refund_sale','delete_expense',
    'export_reports','manage_products','manage_customers','manage_purchases',
    'manage_suppliers','manage_inventory','view_audit','manage_coupons','manage_promotions'
  ];
  v_cashier_perms TEXT[] := ARRAY['manage_customers'];
  v_storekeeper_perms TEXT[] := ARRAY['manage_inventory','manage_products','manage_suppliers'];
  v_accountant_perms TEXT[] := ARRAY['view_profit','view_cost_price','export_reports','view_audit'];
BEGIN
  -- Owner role (all permissions)
  SELECT ARRAY(SELECT id FROM public.permissions) INTO v_all_perms;
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Owner', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, unnest(v_all_perms) ON CONFLICT DO NOTHING;
  END IF;

  -- Manager role
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Manager', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p WHERE p.code = ANY(v_mgr_perms)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Cashier role
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Cashier', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p WHERE p.code = ANY(v_cashier_perms)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Store Keeper
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Store Keeper', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p WHERE p.code = ANY(v_storekeeper_perms)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Accountant
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Accountant', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p WHERE p.code = ANY(v_accountant_perms)
      ON CONFLICT DO NOTHING;
  END IF;

  -- Sales Agent
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Sales Agent', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;

  -- Administrator
  INSERT INTO public.roles (shop_id, name, is_system) VALUES (p_shop_id, 'Administrator', true)
    ON CONFLICT (shop_id, name) DO NOTHING RETURNING id INTO v_role_id;
  IF v_role_id IS NOT NULL THEN
    INSERT INTO public.role_permissions (role_id, permission_id)
      SELECT v_role_id, p.id FROM public.permissions p WHERE p.code = ANY(v_mgr_perms || ARRAY['manage_staff','manage_branches','configure_vfd'])
      ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- ─── DEFAULT CHART OF ACCOUNTS FUNCTION ──────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_default_coa(p_shop_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.chart_of_accounts (shop_id, code, name, type, sub_type) VALUES
    (p_shop_id, '1000', 'Cash',             'asset',   'current'),
    (p_shop_id, '1010', 'Bank Account',     'asset',   'current'),
    (p_shop_id, '1100', 'Accounts Receivable','asset', 'current'),
    (p_shop_id, '1200', 'Inventory',        'asset',   'current'),
    (p_shop_id, '2000', 'Accounts Payable', 'liability','current'),
    (p_shop_id, '3000', 'Owner Equity',     'equity',  NULL),
    (p_shop_id, '4000', 'Sales Revenue',    'revenue', NULL),
    (p_shop_id, '4100', 'Service Revenue',  'revenue', NULL),
    (p_shop_id, '5000', 'Cost of Goods Sold','expense','cogs'),
    (p_shop_id, '6000', 'Operating Expenses','expense','operating'),
    (p_shop_id, '6100', 'Rent',             'expense', 'operating'),
    (p_shop_id, '6200', 'Salaries',         'expense', 'operating'),
    (p_shop_id, '6300', 'Utilities',        'expense', 'operating')
  ON CONFLICT (shop_id, code) DO NOTHING;
END;
$$;

-- ─── ONBOARDING FUNCTION ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.initialize_shop_enterprise(p_shop_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Create default main branch
  INSERT INTO public.branches (shop_id, name, is_main, is_active)
  VALUES (p_shop_id, 'Main Branch', true, true)
  ON CONFLICT DO NOTHING;

  -- Create default roles
  PERFORM public.create_default_roles(p_shop_id);

  -- Create chart of accounts
  PERFORM public.create_default_coa(p_shop_id);

  -- Create default cash register
  INSERT INTO public.cash_registers (shop_id, name, is_active)
  VALUES (p_shop_id, 'Main Register', true)
  ON CONFLICT DO NOTHING;

  -- Create default receipt template
  INSERT INTO public.receipt_templates (shop_id) VALUES (p_shop_id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- ─── VIEWS FOR NEW FEATURES ───────────────────────────────────────────────────

-- Branch performance view
CREATE OR REPLACE VIEW public.v_branch_performance AS
SELECT
  b.id          AS branch_id,
  b.shop_id,
  b.name        AS branch_name,
  COUNT(DISTINCT t.id)      AS transactions_count,
  COALESCE(SUM(t.total_amount), 0) AS total_revenue,
  COUNT(DISTINCT t.staff_id) AS active_staff
FROM public.branches b
LEFT JOIN public.transactions t ON t.branch_id = b.id
  AND t.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY b.id, b.shop_id, b.name;

-- Active promotions view
CREATE OR REPLACE VIEW public.v_active_promotions AS
SELECT *
FROM public.promotions
WHERE is_active = true
  AND (starts_at IS NULL OR starts_at <= now())
  AND (ends_at IS NULL OR ends_at > now())
  AND (usage_limit IS NULL OR usage_count < usage_limit);

-- Unread notifications count view
CREATE OR REPLACE VIEW public.v_unread_notifications AS
SELECT shop_id, COUNT(*) AS unread_count
FROM public.notifications
WHERE is_read = false
GROUP BY shop_id;
