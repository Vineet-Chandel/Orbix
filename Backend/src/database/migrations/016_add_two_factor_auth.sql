-- 016_add_two_factor_auth.sql
-- Enables email-based Two-Factor Authentication (2FA) for Orbix user accounts

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS two_factor_enabled_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_users_two_factor ON public.users (is_two_factor_enabled) WHERE is_two_factor_enabled = true;
