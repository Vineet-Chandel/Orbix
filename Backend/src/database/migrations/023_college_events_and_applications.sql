-- Migration 023: College Events Likes & Detailed Applications Tracking

-- 1. Create club_event_likes table for hearts / appreciations
CREATE TABLE IF NOT EXISTS public.club_event_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_user_like UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_event_likes_event ON public.club_event_likes(event_id);
CREATE INDEX IF NOT EXISTS idx_event_likes_user ON public.club_event_likes(user_id);

-- 2. Extend club_event_registrations with applicant details for spreadsheet tracking
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS applicant_name VARCHAR(150),
    ADD COLUMN IF NOT EXISTS applicant_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS department VARCHAR(100),
    ADD COLUMN IF NOT EXISTS year_of_study VARCHAR(50),
    ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS phone_number VARCHAR(30),
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb;

-- 3. Update status constraint to include waitlisted
ALTER TABLE public.club_event_registrations 
    DROP CONSTRAINT IF EXISTS club_event_registrations_status_check;

ALTER TABLE public.club_event_registrations 
    ADD CONSTRAINT club_event_registrations_status_check 
    CHECK (status IN ('registered', 'attended', 'waitlisted', 'cancelled', 'blocked'));
