-- =========================================================================
-- Migration 019: Complete Club Profile Management & Dynamic Public Profile
-- =========================================================================

-- 1. Add extended profile columns to verified_clubs
ALTER TABLE public.verified_clubs
    ADD COLUMN IF NOT EXISTS founded_year INT,
    ADD COLUMN IF NOT EXISTS operating_status VARCHAR(30) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS mission TEXT,
    ADD COLUMN IF NOT EXISTS vision TEXT,
    ADD COLUMN IF NOT EXISTS focus_areas JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS contact_phone TEXT,
    ADD COLUMN IF NOT EXISTS publication_status VARCHAR(20) NOT NULL DEFAULT 'published',
    ADD COLUMN IF NOT EXISTS profile_visibility VARCHAR(20) NOT NULL DEFAULT 'public',
    ADD COLUMN IF NOT EXISTS recruitment_status VARCHAR(20) NOT NULL DEFAULT 'closed',
    ADD COLUMN IF NOT EXISTS recruitment_announcement TEXT,
    ADD COLUMN IF NOT EXISTS recruitment_url TEXT;

-- Enforce check constraints safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'verified_clubs_publication_status_check'
    ) THEN
        ALTER TABLE public.verified_clubs
            ADD CONSTRAINT verified_clubs_publication_status_check
            CHECK (publication_status IN ('draft', 'published', 'hidden'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'verified_clubs_profile_visibility_check'
    ) THEN
        ALTER TABLE public.verified_clubs
            ADD CONSTRAINT verified_clubs_profile_visibility_check
            CHECK (profile_visibility IN ('public', 'unlisted', 'private'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'verified_clubs_recruitment_status_check'
    ) THEN
        ALTER TABLE public.verified_clubs
            ADD CONSTRAINT verified_clubs_recruitment_status_check
            CHECK (recruitment_status IN ('open', 'closed', 'upcoming'));
    END IF;
END $$;

-- 2. Create club_coordinators table
CREATE TABLE IF NOT EXISTS public.club_coordinators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    linked_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    department TEXT,
    role TEXT NOT NULL,
    image_url TEXT,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    display_order INT NOT NULL DEFAULT 0,
    is_public BOOLEAN NOT NULL DEFAULT true,
    contact_email TEXT,
    linkedin_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_coordinators_club_id ON public.club_coordinators(club_id);
CREATE INDEX IF NOT EXISTS idx_club_coordinators_user_id ON public.club_coordinators(linked_user_id);
CREATE INDEX IF NOT EXISTS idx_club_coordinators_order ON public.club_coordinators(club_id, display_order ASC);

-- 3. Create club_achievements table
CREATE TABLE IF NOT EXISTS public.club_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    achievement_date TEXT,
    issuer TEXT,
    image_url TEXT,
    external_link TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_achievements_club_id ON public.club_achievements(club_id);
CREATE INDEX IF NOT EXISTS idx_club_achievements_order ON public.club_achievements(club_id, display_order ASC);
