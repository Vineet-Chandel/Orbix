-- ============================================================
-- Migration 008: Associate Club Applications & Verified Clubs with Institutions Table
-- ============================================================

ALTER TABLE public.club_verification_requests
    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.institutions(id);

ALTER TABLE public.verified_clubs
    ADD COLUMN IF NOT EXISTS college_id UUID REFERENCES public.institutions(id);

CREATE INDEX IF NOT EXISTS idx_club_verification_requests_college_id
    ON public.club_verification_requests (college_id);

CREATE INDEX IF NOT EXISTS idx_verified_clubs_college_id
    ON public.verified_clubs (college_id);

-- Ensure authenticated applicants can supply & view college_id
GRANT SELECT (college_id) ON public.club_verification_requests TO authenticated;
GRANT INSERT (college_id) ON public.club_verification_requests TO authenticated;
