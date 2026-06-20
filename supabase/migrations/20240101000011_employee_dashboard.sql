-- ============================================================
-- DukaOS — Employee Dashboard & Enhanced Staff Migration
-- 011_employee_dashboard.sql
-- ============================================================

-- ─── ENHANCE STAFF TABLE ────────────────────────────────────────────────────

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS phone         TEXT,
  ADD COLUMN IF NOT EXISTS email         TEXT,
  ADD COLUMN IF NOT EXISTS role          TEXT NOT NULL DEFAULT 'cashier'
                                         CHECK (role IN ('cashier','supervisor','manager','custom')),
  ADD COLUMN IF NOT EXISTS branch_id     UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS suspended     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by  TEXT,
  ADD COLUMN IF NOT EXISTS notes         TEXT,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_count   INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_staff_branch   ON public.staff(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_role     ON public.staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_shop_active ON public.staff(shop_id, active);

-- ─── STAFF PERMISSIONS (granular RBAC) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_permissions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id   UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code       TEXT NOT NULL,        -- matches permissions.code
  granted    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (staff_id, code)
);
CREATE INDEX IF NOT EXISTS idx_staff_perms_staff ON public.staff_permissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_perms_shop  ON public.staff_permissions(shop_id);

-- ─── EMPLOYEE SHIFTS ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_shifts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id       UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  shift_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at        TIMESTAMPTZ,
  opening_cash    NUMERIC(12,2) NOT NULL DEFAULT 0,
  expected_cash   NUMERIC(12,2),
  counted_cash    NUMERIC(12,2),
  cash_difference NUMERIC(12,2),
  total_sales     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_expenses  NUMERIC(12,2) NOT NULL DEFAULT 0,
  transactions_count INT NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','closed','reviewed')),
  closing_notes   TEXT,
  incidents       TEXT,
  reviewed_by     TEXT,
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_shop     ON public.employee_shifts(shop_id);
CREATE INDEX IF NOT EXISTS idx_shifts_staff    ON public.employee_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_shifts_date     ON public.employee_shifts(shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_status   ON public.employee_shifts(status);

-- ─── EMPLOYEE DAILY REPORTS ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.employee_daily_reports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id       UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id      UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  report_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  category       TEXT NOT NULL DEFAULT 'general'
                 CHECK (category IN ('general','observation','complaint','incident','lost_receipt','stock_issue','other')),
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'low'
                 CHECK (severity IN ('low','medium','high','urgent')),
  status         TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','read','resolved','dismissed')),
  reviewed_by    TEXT,
  reviewed_at    TIMESTAMPTZ,
  review_notes   TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_daily_reports_shop   ON public.employee_daily_reports(shop_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_staff  ON public.employee_daily_reports(staff_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_date   ON public.employee_daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_status ON public.employee_daily_reports(status);

-- ─── EMPLOYEE EXPENSE SUBMISSIONS ────────────────────────────────────────────
-- Employees submit expenses; owner approves them before they appear in main expenses

CREATE TABLE IF NOT EXISTS public.employee_expense_submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id     UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  branch_id    UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  shift_id     UUID REFERENCES public.employee_shifts(id) ON DELETE SET NULL,
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category     TEXT NOT NULL DEFAULT 'other',
  description  TEXT NOT NULL,
  notes        TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','approved','rejected')),
  reviewed_by  TEXT,
  reviewed_at  TIMESTAMPTZ,
  expense_id   UUID REFERENCES public.expenses(id) ON DELETE SET NULL, -- link to approved expense
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_emp_expenses_shop   ON public.employee_expense_submissions(shop_id);
CREATE INDEX IF NOT EXISTS idx_emp_expenses_staff  ON public.employee_expense_submissions(staff_id);
CREATE INDEX IF NOT EXISTS idx_emp_expenses_status ON public.employee_expense_submissions(status);

-- ─── STAFF ACTIVITY LOG ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.staff_activity_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id   UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  staff_name TEXT NOT NULL,
  action     TEXT NOT NULL,
  details    JSONB,
  branch_id  UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ip_address TEXT,
  device     TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_activity_shop    ON public.staff_activity_log(shop_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_staff   ON public.staff_activity_log(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_created ON public.staff_activity_log(created_at DESC);

-- ─── UPDATE STAFF LAST LOGIN trigger ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.fn_staff_login()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.staff
  SET last_login_at = now(), login_count = login_count + 1
  WHERE id = NEW.staff_id;
  RETURN NEW;
END;
$$;

-- RLS for new tables
ALTER TABLE public.employee_shifts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_daily_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_expense_submissions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_permissions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_activity_log            ENABLE ROW LEVEL SECURITY;

-- Owner can see all records for their shop
CREATE POLICY "owner_shifts" ON public.employee_shifts
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_daily_reports" ON public.employee_daily_reports
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_emp_expenses" ON public.employee_expense_submissions
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_staff_perms" ON public.staff_permissions
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );

CREATE POLICY "owner_staff_activity" ON public.staff_activity_log
  FOR ALL USING (
    shop_id IN (SELECT id FROM public.shops WHERE owner_user_id = auth.uid())
  );
