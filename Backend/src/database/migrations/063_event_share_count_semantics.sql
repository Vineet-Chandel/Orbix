-- Migration 063: College Events Share Count Semantics Correction
-- Differentiates between internal shares, external shares, and copy-link actions.
-- Public-facing share count includes only 'internal' and 'external' shares; 'copy_link' is tracked separately.

DO $$
BEGIN
    -- 1. Add share_type column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'club_event_shares'
          AND column_name = 'share_type'
    ) THEN
        ALTER TABLE public.club_event_shares
        ADD COLUMN share_type VARCHAR(32) NOT NULL DEFAULT 'external';
    END IF;

    -- 2. Add recipient_user_id column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'club_event_shares'
          AND column_name = 'recipient_user_id'
    ) THEN
        ALTER TABLE public.club_event_shares
        ADD COLUMN recipient_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 3. Backfill existing records: categorize 'clipboard' platform as 'copy_link', others as 'external'
UPDATE public.club_event_shares
SET share_type = 'copy_link'
WHERE platform = 'clipboard' AND share_type = 'external';

-- 4. Enforce valid share_type values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'check_club_event_shares_type'
    ) THEN
        ALTER TABLE public.club_event_shares
        ADD CONSTRAINT check_club_event_shares_type
        CHECK (share_type IN ('internal', 'external', 'copy_link'));
    END IF;
END $$;

-- 5. Add performance indexes for event share count queries filtered by share_type
CREATE INDEX IF NOT EXISTS idx_club_event_shares_event_type ON public.club_event_shares(event_id, share_type);
CREATE INDEX IF NOT EXISTS idx_club_event_shares_recipient ON public.club_event_shares(recipient_user_id) WHERE recipient_user_id IS NOT NULL;
