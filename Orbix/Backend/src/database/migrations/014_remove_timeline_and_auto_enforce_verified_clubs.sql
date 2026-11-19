-- =========================================================================
-- Migration 014: Remove timeline events table and automatically enforce
-- verified_clubs creation via trigger whenever status is approved
-- =========================================================================

-- 1. Create or replace the trigger function to automatically enforce verified_clubs
CREATE OR REPLACE FUNCTION public.fn_auto_enforce_verified_club()
RETURNS TRIGGER AS $$
DECLARE
    v_existing_club_id UUID;
    v_base_slug TEXT;
    v_candidate_slug TEXT;
    v_counter INT := 0;
BEGIN
    -- Only act when status is 'approved'
    IF NEW.status = 'approved' THEN
        -- Auto-confirm verification flags if reviewer did not manually toggle them
        NEW.college_contact_status := 'confirmed';
        NEW.club_existence_confirmed := TRUE;
        NEW.college_authorization_confirmed := TRUE;
        NEW.representative_authority_confirmed := TRUE;
        NEW.reviewed_at := COALESCE(NEW.reviewed_at, NOW());

        -- Check if a verified club record already exists for this applicant user or request
        SELECT id INTO v_existing_club_id
        FROM public.verified_clubs
        WHERE auth_user_id = NEW.auth_user_id
           OR (NEW.verified_club_id IS NOT NULL AND id = NEW.verified_club_id)
        LIMIT 1;

        IF v_existing_club_id IS NOT NULL THEN
            -- Link verified_club_id and ensure the club is marked active
            NEW.verified_club_id := v_existing_club_id;

            UPDATE public.verified_clubs
            SET is_active = TRUE,
                verified_at = COALESCE(verified_at, NOW()),
                name = COALESCE(NEW.club_name, name),
                category = COALESCE(NEW.club_category, category),
                college_name = COALESCE(NEW.college_name, college_name),
                college_city = COALESCE(NEW.college_city, college_city),
                college_state = COALESCE(NEW.college_state, college_state),
                college_country = COALESCE(NEW.college_country, college_country),
                short_description = COALESCE(NEW.club_description, short_description),
                website_url = COALESCE(NEW.club_website_url, website_url),
                social_links = jsonb_build_object(
                    'website', NEW.club_website_url,
                    'social', NEW.club_social_url
                ),
                updated_at = NOW()
            WHERE id = v_existing_club_id;
        ELSE
            -- Generate a URL-safe lowercase slug from the club name
            v_base_slug := lower(regexp_replace(COALESCE(NEW.club_name, 'club'), '[^a-zA-Z0-9]+', '-', 'g'));
            v_base_slug := trim(both '-' from v_base_slug);
            IF v_base_slug IS NULL OR length(v_base_slug) = 0 THEN
                v_base_slug := 'club-' || substr(NEW.id::text, 1, 8);
            END IF;

            v_candidate_slug := v_base_slug;

            -- Avoid collisions with existing slugs
            WHILE EXISTS (SELECT 1 FROM public.verified_clubs WHERE lower(slug) = lower(v_candidate_slug)) LOOP
                v_counter := v_counter + 1;
                v_candidate_slug := v_base_slug || '-' || v_counter;
            END LOOP;

            -- Generate new UUID for the club
            v_existing_club_id := gen_random_uuid();

            -- Automatically insert into verified_clubs
            INSERT INTO public.verified_clubs (
                id,
                auth_user_id,
                college_id,
                name,
                slug,
                category,
                college_name,
                college_city,
                college_state,
                college_country,
                short_description,
                about,
                website_url,
                social_links,
                is_active,
                verified_at,
                created_at,
                updated_at
            ) VALUES (
                v_existing_club_id,
                NEW.auth_user_id,
                NEW.college_id,
                NEW.club_name,
                v_candidate_slug,
                COALESCE(NEW.club_category, 'General Tech & Engineering'),
                COALESCE(NEW.college_name, 'Collegiate Institution'),
                COALESCE(NEW.college_city, 'City'),
                COALESCE(NEW.college_state, 'State'),
                COALESCE(NEW.college_country, 'India'),
                NEW.club_description,
                COALESCE(NEW.club_description, 'Official chapter of ' || NEW.club_name || ' at ' || COALESCE(NEW.college_name, 'campus') || '.'),
                NEW.club_website_url,
                jsonb_build_object(
                    'website', NEW.club_website_url,
                    'social', NEW.club_social_url
                ),
                TRUE,
                COALESCE(NEW.reviewed_at, NOW()),
                NOW(),
                NOW()
            );

            -- Automatically associate verified_club_id on the request
            NEW.verified_club_id := v_existing_club_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to club_verification_requests
DROP TRIGGER IF EXISTS trg_auto_enforce_verified_club ON public.club_verification_requests;

CREATE TRIGGER trg_auto_enforce_verified_club
BEFORE INSERT OR UPDATE ON public.club_verification_requests
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_enforce_verified_club();

-- 3. Backfill any existing approved applications that don't have verified_clubs yet
UPDATE public.club_verification_requests
SET status = 'approved',
    updated_at = NOW()
WHERE status = 'approved'
  AND (verified_club_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.verified_clubs WHERE id = verified_club_id));

-- 4. Drop the obsolete club_verification_timeline_events table
DROP TABLE IF EXISTS public.club_verification_timeline_events CASCADE;
