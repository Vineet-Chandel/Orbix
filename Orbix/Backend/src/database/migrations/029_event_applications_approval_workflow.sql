-- Migration 029: Event Applications Review & Approval Workflow
-- Adds 'pending' and 'rejected' statuses to club_event_registrations
-- Changes default status to 'pending'

ALTER TABLE public.club_event_registrations 
    DROP CONSTRAINT IF EXISTS club_event_registrations_status_check;

ALTER TABLE public.club_event_registrations 
    ADD CONSTRAINT club_event_registrations_status_check 
    CHECK (status IN ('pending', 'registered', 'attended', 'waitlisted', 'rejected', 'cancelled', 'blocked'));

ALTER TABLE public.club_event_registrations 
    ALTER COLUMN status SET DEFAULT 'pending';

-- Add reviewer audit columns if not exists
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS review_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_club_event_registrations_status 
    ON public.club_event_registrations(event_id, status);
