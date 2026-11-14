-- Migration 065: Distinguish Event Share Account Types
-- Adds account_type column to club_event_shares to reliably track whether a share originated from a personal or club account.
-- Public event share counts strictly include only normal/personal user shares ('internal' and 'external').
-- Club account shares (external and copy_link) are tracked for operational analytics but excluded from public counts.

DO $$
BEGIN
    -- 1. Add account_type column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'club_event_shares'
          AND column_name = 'account_type'
    ) THEN
        ALTER TABLE public.club_event_shares
        ADD COLUMN account_type VARCHAR(32) NOT NULL DEFAULT 'personal';
    END IF;
END $$;

-- 2. Backfill existing records: map user_id to authoritative users.account_type
UPDATE public.club_event_shares s
SET account_type = u.account_type
FROM public.users u
WHERE s.user_id = u.id
  AND u.account_type IS NOT NULL
  AND s.account_type != u.account_type;

-- 3. Enforce valid account_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_club_event_shares_account_type'
    ) THEN
        ALTER TABLE public.club_event_shares
        ADD CONSTRAINT check_club_event_shares_account_type
        CHECK (account_type IN ('personal', 'club', 'admin'));
    END IF;
END $$;

-- 4. Create performance indexes for public share count filtering and analytics
CREATE INDEX IF NOT EXISTS idx_club_event_shares_account_type
ON public.club_event_shares(account_type);

CREATE INDEX IF NOT EXISTS idx_club_event_shares_public_count
ON public.club_event_shares(event_id, share_type, account_type);
