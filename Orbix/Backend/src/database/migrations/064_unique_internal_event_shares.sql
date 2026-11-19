-- Migration 064: Permanent Unique Internal Event Share Counting
-- Enforces that for each unique combination of (event_id, user_id, recipient_user_id),
-- only the first successfully delivered internal share creates a counted share record.
-- External shares and copy_link records are unaffected.

-- 1. Deduplicate any existing duplicate internal shares if present before adding unique index
DELETE FROM public.club_event_shares a
USING public.club_event_shares b
WHERE a.id > b.id
  AND a.event_id = b.event_id
  AND a.user_id = b.user_id
  AND a.recipient_user_id = b.recipient_user_id
  AND a.share_type = 'internal'
  AND b.share_type = 'internal'
  AND a.recipient_user_id IS NOT NULL;

-- 2. Create partial unique index on (event_id, user_id, recipient_user_id) for internal shares
CREATE UNIQUE INDEX IF NOT EXISTS idx_club_event_shares_unique_internal
ON public.club_event_shares (event_id, user_id, recipient_user_id)
WHERE share_type = 'internal' AND recipient_user_id IS NOT NULL;
