-- 026_club_events_completed_status.sql
-- Allow 'completed' status in club_events table

ALTER TABLE public.club_events DROP CONSTRAINT IF EXISTS club_events_status_check;
ALTER TABLE public.club_events ADD CONSTRAINT club_events_status_check
    CHECK (status IN ('draft', 'published', 'completed', 'cancelled'));
