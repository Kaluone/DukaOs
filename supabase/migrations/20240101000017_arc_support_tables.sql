-- ============================================================
-- DukaOS — ARC Support Tickets, Backup History, Report Log
-- 20240101000017_arc_support_tables.sql
--
-- Provides the DB backing for ARCSupportPage, ARCBackupPage,
-- and ARCReportsPage (all previously queried non-existent tables).
-- ============================================================

-- ─── Support Tickets ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number  TEXT        NOT NULL UNIQUE,
  shop_id        UUID        REFERENCES public.shops(id) ON DELETE SET NULL,
  customer_name  TEXT,
  customer_email TEXT,
  subject        TEXT        NOT NULL,
  description    TEXT,
  priority       TEXT        NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','critical')),
  status         TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  assigned_to    UUID        REFERENCES public.arc_admins(id) ON DELETE SET NULL,
  device         TEXT,
  browser        TEXT,
  resolved_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.support_tickets(status);
CREATE INDEX ON public.support_tickets(priority);
CREATE INDEX ON public.support_tickets(created_at DESC);
CREATE INDEX ON public.support_tickets(shop_id);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arc_support_tickets_all" ON public.support_tickets
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.fn_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.fn_touch_updated_at();

-- ─── Support Messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.support_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_type TEXT        NOT NULL CHECK (sender_type IN ('admin','customer')),
  sender_id   UUID        REFERENCES public.arc_admins(id) ON DELETE SET NULL,
  message     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.support_messages(ticket_id, created_at);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arc_support_messages_all" ON public.support_messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── Backup History ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.arc_backups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_type    TEXT        NOT NULL
    CHECK (backup_type IN ('full','incremental','schema')),
  status         TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','running','completed','failed')),
  size_mb        INT,
  initiated_by   UUID        REFERENCES public.arc_admins(id) ON DELETE SET NULL,
  started_at     TIMESTAMPTZ,
  completed_at   TIMESTAMPTZ,
  error_message  TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.arc_backups(started_at DESC);

ALTER TABLE public.arc_backups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arc_backups_all" ON public.arc_backups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );

-- ─── Report Download Log ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.arc_report_log (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id    TEXT        NOT NULL,
  format       TEXT        NOT NULL CHECK (format IN ('csv','excel','pdf')),
  row_count    INT,
  generated_by UUID        REFERENCES public.arc_admins(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ON public.arc_report_log(created_at DESC);

ALTER TABLE public.arc_report_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arc_report_log_all" ON public.arc_report_log
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.arc_admins WHERE user_id = auth.uid() AND is_active = true)
  );
