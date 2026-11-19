-- =========================================================================
-- Migration 006: Verified Clubs, Verification Timeline Events & Club Events
-- =========================================================================

-- 1. Ensure club_verification_requests supports 'approved' status and verified_club_id
ALTER TABLE public.club_verification_requests
    DROP CONSTRAINT IF EXISTS club_verification_requests_status_check;

ALTER TABLE public.club_verification_requests
    ADD CONSTRAINT club_verification_requests_status_check
    CHECK (status IN (
        'pending',
        'under_review',
        'needs_information',
        'rejected',
        'ready_for_promotion',
        'approved'
    ));

-- 2. Create club_verification_timeline_events table
CREATE TABLE IF NOT EXISTS public.club_verification_timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID NOT NULL,
    auth_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL CHECK (stage IN (
        'application_submitted',
        'initial_review',
        'college_verification',
        'verification_decision',
        'club_activated'
    )),
    status VARCHAR(30) NOT NULL CHECK (status IN (
        'completed',
        'in_progress',
        'upcoming',
        'action_required',
        'rejected'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    action_required TEXT,
    is_applicant_visible BOOLEAN NOT NULL DEFAULT true,
    actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_timeline_app_id
    ON public.club_verification_timeline_events (application_id);
CREATE INDEX IF NOT EXISTS idx_club_timeline_user_id
    ON public.club_verification_timeline_events (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_club_timeline_created_at
    ON public.club_verification_timeline_events (created_at ASC);

-- 3. Create verified_clubs table
CREATE TABLE IF NOT EXISTS public.verified_clubs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE RESTRICT,
    name TEXT NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 120),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~* '^[a-z0-9]+(-[a-z0-9]+)*$'),
    category VARCHAR(50) NOT NULL,
    college_name TEXT NOT NULL,
    college_city TEXT NOT NULL,
    college_state TEXT NOT NULL,
    college_country TEXT NOT NULL DEFAULT 'India',
    short_description TEXT,
    about TEXT,
    logo_url TEXT,
    cover_image_url TEXT,
    website_url TEXT,
    public_email TEXT,
    social_links JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT true,
    verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_slug
    ON public.verified_clubs (slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_user
    ON public.verified_clubs (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_active
    ON public.verified_clubs (is_active);

-- Link verified_club_id in club_verification_requests
ALTER TABLE public.club_verification_requests
    ADD COLUMN IF NOT EXISTS verified_club_id UUID REFERENCES public.verified_clubs(id) ON DELETE SET NULL;

-- 4. Create club_events table
CREATE TABLE IF NOT EXISTS public.club_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
    slug TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata',
    location_type VARCHAR(20) NOT NULL DEFAULT 'in_person' CHECK (location_type IN ('in_person', 'online', 'hybrid')),
    venue_or_location TEXT,
    registration_url TEXT,
    cover_image_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'cancelled')),
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_club_event_slug UNIQUE (club_id, slug),
    CHECK (ends_at IS NULL OR ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_club_events_club_id
    ON public.club_events (club_id);
CREATE INDEX IF NOT EXISTS idx_club_events_status_starts
    ON public.club_events (status, starts_at);

-- 5. Row Level Security & Grants

ALTER TABLE public.club_verification_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verified_clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.club_verification_timeline_events FROM anon, authenticated;
REVOKE ALL ON TABLE public.verified_clubs FROM anon, authenticated;
REVOKE ALL ON TABLE public.club_events FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE public.club_verification_timeline_events TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.verified_clubs TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.club_events TO service_role;

-- Public can read active verified clubs (explicit safe columns)
GRANT SELECT (
    id, name, slug, category, college_name, college_city, college_state,
    college_country, short_description, about, logo_url, cover_image_url,
    website_url, public_email, social_links, is_active, verified_at, created_at
) ON public.verified_clubs TO anon, authenticated;

-- Public can read published club events
GRANT SELECT ON public.club_events TO anon, authenticated;

-- Authenticated club owners can read their timeline
GRANT SELECT ON public.club_verification_timeline_events TO authenticated;

-- Authenticated club owners can manage their own club & events
GRANT UPDATE ON public.verified_clubs TO authenticated;
GRANT ALL ON public.club_events TO authenticated;

-- Timeline RLS: applicants see their own visible timeline items
DROP POLICY IF EXISTS applicant_read_own_timeline ON public.club_verification_timeline_events;
CREATE POLICY applicant_read_own_timeline
    ON public.club_verification_timeline_events
    FOR SELECT TO authenticated
    USING (
        auth_user_id = (SELECT auth.uid())
        AND is_applicant_visible = true
    );

-- Verified Clubs RLS: public read active
DROP POLICY IF EXISTS public_read_active_verified_clubs ON public.verified_clubs;
CREATE POLICY public_read_active_verified_clubs
    ON public.verified_clubs
    FOR SELECT
    USING (is_active = true);

-- Verified Clubs RLS: owner can update permitted profile fields
DROP POLICY IF EXISTS owner_update_own_verified_club ON public.verified_clubs;
CREATE POLICY owner_update_own_verified_club
    ON public.verified_clubs
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = auth_user_id)
    WITH CHECK ((SELECT auth.uid()) = auth_user_id);

-- Club Events RLS: public read published
DROP POLICY IF EXISTS public_read_published_events ON public.club_events;
CREATE POLICY public_read_published_events
    ON public.club_events
    FOR SELECT
    USING (
        status = 'published'
        AND EXISTS (
            SELECT 1 FROM public.verified_clubs vc
            WHERE vc.id = club_id AND vc.is_active = true
        )
    );

-- Club Events RLS: owner can manage events
DROP POLICY IF EXISTS owner_manage_own_club_events ON public.club_events;
CREATE POLICY owner_manage_own_club_events
    ON public.club_events
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.verified_clubs vc
            WHERE vc.id = club_id AND vc.auth_user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.verified_clubs vc
            WHERE vc.id = club_id AND vc.auth_user_id = (SELECT auth.uid())
        )
    );
