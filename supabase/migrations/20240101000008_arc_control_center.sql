-- ============================================================
-- DukaOS — AutoRevenue Labs Control Center (ARC)
-- Super Admin infrastructure: roles, audit logs, sessions,
-- support tickets, and ARC-wide admin management
-- 008_arc_control_center.sql  (idempotent — safe to re-run)
-- ============================================================

-- ─── ARC ADMIN ROLES ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE public.arc_role AS ENUM (
    'founder', 'chief_admin', 'support_agent', 'finance_admin', 'technical_admin'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── ARC ADMINS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_admins (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT    NOT NULL UNIQUE,
  full_name     TEXT    NOT NULL,
  role          public.arc_role NOT NULL DEFAULT 'support_agent',
  avatar_url    TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  totp_secret   TEXT,
  totp_enabled  BOOLEAN NOT NULL DEFAULT false,
  last_login_at TIMESTAMPTZ,
  last_login_ip TEXT,
  created_by    UUID REFERENCES public.arc_admins(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_arc_admins_user ON public.arc_admins(user_id);
ALTER TABLE public.arc_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_admins: self read" ON public.arc_admins;
CREATE POLICY "arc_admins: self read"
  ON public.arc_admins FOR SELECT
  USING (user_id = auth.uid());

-- ─── ARC AUDIT LOGS (append-only) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_audit_logs (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID        REFERENCES public.arc_admins(id),
  admin_email   TEXT        NOT NULL,
  admin_role    TEXT        NOT NULL,
  action        TEXT        NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  resource_name TEXT,
  details       JSONB       DEFAULT '{}',
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_arc_audit_admin   ON public.arc_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_arc_audit_action  ON public.arc_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_arc_audit_created ON public.arc_audit_logs(created_at DESC);
ALTER TABLE public.arc_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_audit: insert own"    ON public.arc_audit_logs;
DROP POLICY IF EXISTS "arc_audit: select all arc" ON public.arc_audit_logs;
CREATE POLICY "arc_audit: insert own"
  ON public.arc_audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "arc_audit: select all arc"
  ON public.arc_audit_logs FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- Immutable audit log rules
DROP RULE IF EXISTS arc_audit_no_update ON public.arc_audit_logs;
DROP RULE IF EXISTS arc_audit_no_delete ON public.arc_audit_logs;
CREATE RULE arc_audit_no_update AS ON UPDATE TO public.arc_audit_logs DO INSTEAD NOTHING;
CREATE RULE arc_audit_no_delete AS ON DELETE TO public.arc_audit_logs DO INSTEAD NOTHING;

-- ─── ARC SESSIONS (impersonation tracking) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_sessions (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id      UUID        NOT NULL REFERENCES public.arc_admins(id),
  tenant_id     UUID        REFERENCES public.shops(id),
  session_type  TEXT        NOT NULL DEFAULT 'support'
                CHECK (session_type IN ('support','impersonation')),
  reason        TEXT,
  started_at    TIMESTAMPTZ DEFAULT now(),
  ended_at      TIMESTAMPTZ,
  is_active     BOOLEAN NOT NULL DEFAULT true
);
ALTER TABLE public.arc_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_sessions: arc admins" ON public.arc_sessions;
CREATE POLICY "arc_sessions: arc admins"
  ON public.arc_sessions FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── SUPPORT TICKETS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number   TEXT    NOT NULL UNIQUE,
  shop_id         UUID    REFERENCES public.shops(id) ON DELETE SET NULL,
  customer_name   TEXT,
  customer_email  TEXT,
  customer_phone  TEXT,
  subject         TEXT    NOT NULL,
  description     TEXT,
  priority        TEXT    NOT NULL DEFAULT 'medium'
                  CHECK (priority IN ('low','medium','high','critical')),
  status          TEXT    NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  assigned_to     UUID    REFERENCES public.arc_admins(id),
  device          TEXT,
  browser         TEXT,
  ip_address      TEXT,
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_shop     ON public.support_tickets(shop_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status   ON public.support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON public.support_tickets(assigned_to);
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets: arc admins" ON public.support_tickets;
CREATE POLICY "support_tickets: arc admins"
  ON public.support_tickets FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── SUPPORT MESSAGES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_messages (
  id          UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id   UUID    NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT    NOT NULL CHECK (sender_type IN ('admin','customer')),
  sender_id   UUID,
  message     TEXT    NOT NULL,
  attachments JSONB   DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_messages: arc admins" ON public.support_messages;
CREATE POLICY "support_messages: arc admins"
  ON public.support_messages FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── SYSTEM HEALTH SNAPSHOTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_system_snapshots (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  cpu_pct       NUMERIC(5,2),
  memory_pct    NUMERIC(5,2),
  disk_pct      NUMERIC(5,2),
  db_status     TEXT    DEFAULT 'ok',
  api_latency   INT,
  active_users  INT     DEFAULT 0,
  snapshot_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.arc_system_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_snapshots: arc admins" ON public.arc_system_snapshots;
CREATE POLICY "arc_snapshots: arc admins"
  ON public.arc_system_snapshots FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── BACKUP RECORDS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_backups (
  id            UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  backup_type   TEXT    NOT NULL DEFAULT 'full'
                CHECK (backup_type IN ('full','incremental','schema')),
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed')),
  size_mb       NUMERIC(12,2),
  storage_path  TEXT,
  initiated_by  UUID    REFERENCES public.arc_admins(id),
  started_at    TIMESTAMPTZ DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  notes         TEXT
);
ALTER TABLE public.arc_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_backups: arc admins" ON public.arc_backups;
CREATE POLICY "arc_backups: arc admins"
  ON public.arc_backups FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── LANDING PAGE ANALYTICS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.arc_landing_analytics (
  id              UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  date            DATE    NOT NULL UNIQUE,
  visitors        INT     NOT NULL DEFAULT 0,
  signups         INT     NOT NULL DEFAULT 0,
  trial_accounts  INT     NOT NULL DEFAULT 0,
  paid_accounts   INT     NOT NULL DEFAULT 0,
  bounce_rate     NUMERIC(5,2) DEFAULT 0,
  src_google      INT     DEFAULT 0,
  src_facebook    INT     DEFAULT 0,
  src_instagram   INT     DEFAULT 0,
  src_tiktok      INT     DEFAULT 0,
  src_direct      INT     DEFAULT 0,
  src_referral    INT     DEFAULT 0,
  android_dl      INT     DEFAULT 0,
  ios_dl          INT     DEFAULT 0,
  apk_dl          INT     DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.arc_landing_analytics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "arc_analytics: arc admins" ON public.arc_landing_analytics;
CREATE POLICY "arc_analytics: arc admins"
  ON public.arc_landing_analytics FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── FOUNDER ADMIN SEED ──────────────────────────────────────────────────────
INSERT INTO public.arc_admins (user_id, email, full_name, role, is_active)
SELECT
  id,
  'kalungura555@gmail.com',
  'Frank Felix Kalungura',
  'founder',
  true
FROM auth.users
WHERE email = 'kalungura555@gmail.com'
ON CONFLICT (email) DO NOTHING;

-- ─── TRIGGERS ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS set_arc_admins_updated_at      ON public.arc_admins;
DROP TRIGGER IF EXISTS set_support_tickets_updated_at ON public.support_tickets;

CREATE TRIGGER set_arc_admins_updated_at
  BEFORE UPDATE ON public.arc_admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── VIEW: arc_tenant_overview ───────────────────────────────────────────────
CREATE OR REPLACE VIEW public.arc_tenant_overview AS
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
LEFT JOIN auth.users u ON u.id = s.owner_user_id;

GRANT SELECT ON public.arc_tenant_overview TO authenticated;
