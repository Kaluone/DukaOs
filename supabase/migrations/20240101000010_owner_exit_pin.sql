-- ============================================================
-- 010_owner_exit_pin.sql
-- Adds owner_exit_pin_hash to shops so owners who sign in via
-- Google (no Supabase password) can still lock/unlock staff mode.
-- ============================================================

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS owner_exit_pin_hash TEXT;
