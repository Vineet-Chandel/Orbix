-- =========================================================================
-- Migration 022: Redesigned Club Profile Management Architecture
-- =========================================================================

-- 1. Add links column (dynamic link manager) to verified_clubs
ALTER TABLE public.verified_clubs
    ADD COLUMN IF NOT EXISTS links JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'draft';

-- Enforce visibility check constraint safely
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'verified_clubs_unified_visibility_check'
    ) THEN
        ALTER TABLE public.verified_clubs
            ADD CONSTRAINT verified_clubs_unified_visibility_check
            CHECK (visibility IN ('draft', 'public', 'unlisted', 'private', 'archived'));
    END IF;
END $$;

-- 2. Add achievement_type to club_achievements
ALTER TABLE public.club_achievements
    ADD COLUMN IF NOT EXISTS achievement_type VARCHAR(50);

-- 3. Create indexes for high-speed directory lookup and filtering
CREATE INDEX IF NOT EXISTS idx_verified_clubs_visibility ON public.verified_clubs(visibility);
CREATE INDEX IF NOT EXISTS idx_verified_clubs_college_visibility ON public.verified_clubs(college_id, visibility);

-- 4. Idempotent Data Migration:
-- Map legacy publication_status + profile_visibility to single unified visibility tier
UPDATE public.verified_clubs
SET visibility = CASE
    WHEN publication_status = 'published' AND profile_visibility = 'public' THEN 'public'
    WHEN publication_status = 'published' AND profile_visibility = 'unlisted' THEN 'unlisted'
    WHEN publication_status = 'published' AND profile_visibility = 'private' THEN 'private'
    WHEN publication_status = 'hidden' THEN 'archived'
    WHEN publication_status = 'draft' THEN 'draft'
    ELSE 'draft'
END
WHERE visibility = 'draft' AND (publication_status != 'draft' OR profile_visibility != 'private');

-- Normalize legacy operating_status ('recruiting' -> 'active', 'hiatus' -> 'on_hiatus')
UPDATE public.verified_clubs
SET operating_status = 'active',
    recruitment_status = CASE WHEN recruitment_status = 'closed' THEN 'open' ELSE recruitment_status END
WHERE operating_status = 'recruiting';

UPDATE public.verified_clubs
SET operating_status = 'on_hiatus'
WHERE operating_status = 'hiatus';

-- Populate dynamic links from legacy website_url and social_links if links array is empty
DO $$
DECLARE
    r RECORD;
    v_links JSONB;
    v_order INT;
    v_soc JSONB;
BEGIN
    FOR r IN SELECT id, website_url, social_links, links FROM public.verified_clubs LOOP
        -- Only populate if links is empty array
        IF jsonb_array_length(r.links) = 0 THEN
            v_links := '[]'::jsonb;
            v_order := 0;
            v_soc := COALESCE(r.social_links, '{}'::jsonb);

            -- Add website if present
            IF r.website_url IS NOT NULL AND length(trim(r.website_url)) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'website',
                    'url', trim(r.website_url),
                    'label', 'Official Website',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check GitHub
            IF (v_soc->>'github') IS NOT NULL AND length(trim(v_soc->>'github')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'github',
                    'url', trim(v_soc->>'github'),
                    'label', 'GitHub',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check LinkedIn
            IF (v_soc->>'linkedin') IS NOT NULL AND length(trim(v_soc->>'linkedin')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'linkedin',
                    'url', trim(v_soc->>'linkedin'),
                    'label', 'LinkedIn',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check Instagram
            IF (v_soc->>'instagram') IS NOT NULL AND length(trim(v_soc->>'instagram')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'instagram',
                    'url', trim(v_soc->>'instagram'),
                    'label', 'Instagram',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check X / Twitter
            IF (v_soc->>'x') IS NOT NULL AND length(trim(v_soc->>'x')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'x',
                    'url', trim(v_soc->>'x'),
                    'label', 'X (Twitter)',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            ELSIF (v_soc->>'twitter') IS NOT NULL AND length(trim(v_soc->>'twitter')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'x',
                    'url', trim(v_soc->>'twitter'),
                    'label', 'X (Twitter)',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check Discord
            IF (v_soc->>'discord') IS NOT NULL AND length(trim(v_soc->>'discord')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'discord',
                    'url', trim(v_soc->>'discord'),
                    'label', 'Discord',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Check YouTube
            IF (v_soc->>'youtube') IS NOT NULL AND length(trim(v_soc->>'youtube')) > 0 THEN
                v_links := v_links || jsonb_build_object(
                    'id', gen_random_uuid(),
                    'platform', 'youtube',
                    'url', trim(v_soc->>'youtube'),
                    'label', 'YouTube',
                    'displayOrder', v_order
                );
                v_order := v_order + 1;
            END IF;

            -- Update record with migrated links
            IF jsonb_array_length(v_links) > 0 THEN
                UPDATE public.verified_clubs
                SET links = v_links
                WHERE id = r.id;
            END IF;
        END IF;
    END LOOP;
END $$;
