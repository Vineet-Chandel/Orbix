-- Migration 057: Strictly decouple personal user accounts from club portal accounts.
-- Ensures every verified_clubs record and club_verification_requests record
-- owns a dedicated users + auth.users row with account_type = 'club', while leaving
-- personal workspace memberships (e.g. Workspace Owner in team_workspaces) intact.

DO $$
DECLARE
    rec RECORD;
    cand_username TEXT;
    cand_email TEXT;
    new_club_user_id UUID;
    suffix_counter INT;
BEGIN
    -- 1. Migrate any verified club whose auth_user_id currently points to a personal/non-club user
    FOR rec IN
        SELECT
            vc.id AS club_id,
            vc.name AS club_name,
            vc.slug AS club_slug,
            vc.logo_url AS logo_url,
            vc.auth_user_id AS old_user_id,
            u.password AS old_password
        FROM public.verified_clubs vc
        JOIN public.users u ON u.id = vc.auth_user_id
        WHERE COALESCE(u.account_type, 'personal') != 'club'
    LOOP
        cand_username := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(rec.club_slug), ''), 'club-' || LEFT(rec.club_id::text, 8)), '[^a-z0-9._-]', '-', 'g'));
        suffix_counter := 0;

        WHILE EXISTS (
            SELECT 1 FROM public.users
            WHERE LOWER(username) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username ELSE cand_username || '-' || suffix_counter END
            )
            OR LOWER(email) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username || '@club.orbix' ELSE cand_username || '-' || suffix_counter || '@club.orbix' END
            )
        ) OR EXISTS (
            SELECT 1 FROM auth.users
            WHERE LOWER(email) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username || '@club.orbix' ELSE cand_username || '-' || suffix_counter || '@club.orbix' END
            )
        ) LOOP
            suffix_counter := suffix_counter + 1;
        END LOOP;

        IF suffix_counter > 0 THEN
            cand_username := cand_username || '-' || suffix_counter;
        END IF;
        cand_email := cand_username || '@club.orbix';
        new_club_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        )
        VALUES (
            new_club_user_id,
            'authenticated',
            'authenticated',
            cand_email,
            rec.old_password,
            CURRENT_TIMESTAMP,
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'club_name', rec.club_name,
                'account_type', 'club',
                'is_email_verified', true,
                'migrated_from_user_id', rec.old_user_id::text
            ),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        INSERT INTO public.users (
            id,
            firstname,
            middlename,
            lastname,
            email,
            username,
            password,
            termsaccepted,
            account_type,
            avatar_url,
            photo_url,
            is_email_verified,
            email_verified_at,
            is_verified_coder,
            is_public
        )
        VALUES (
            new_club_user_id,
            COALESCE(NULLIF(TRIM(rec.club_name), ''), cand_username),
            NULL,
            'Club',
            cand_email,
            cand_username,
            rec.old_password,
            true,
            'club',
            COALESCE(rec.logo_url, 'https://api.dicebear.com/7.x/shapes/svg?seed=' || cand_username),
            rec.logo_url,
            true,
            CURRENT_TIMESTAMP,
            true,
            true
        );

        UPDATE public.verified_clubs
        SET auth_user_id = new_club_user_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = rec.club_id;

        UPDATE public.club_verification_requests
        SET auth_user_id = new_club_user_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE verified_club_id = rec.club_id
           OR (auth_user_id = rec.old_user_id AND LOWER(TRIM(club_name)) = LOWER(TRIM(rec.club_name)));

        RAISE NOTICE 'Migrated club "%" (%) from personal user % to dedicated club user % (%)',
            rec.club_name, rec.club_id, rec.old_user_id, new_club_user_id, cand_username;
    END LOOP;

    -- 2. Migrate any remaining club verification applications linked to non-club accounts
    FOR rec IN
        SELECT
            cvr.id AS req_id,
            cvr.club_name,
            cvr.auth_user_id AS old_user_id,
            u.password AS old_password
        FROM public.club_verification_requests cvr
        JOIN public.users u ON u.id = cvr.auth_user_id
        WHERE COALESCE(u.account_type, 'personal') != 'club'
    LOOP
        cand_username := LOWER(REGEXP_REPLACE(COALESCE(NULLIF(TRIM(rec.club_name), ''), 'club-app'), '[^a-z0-9]+', '-', 'g'));
        cand_username := TRIM(BOTH '-' FROM cand_username);
        IF cand_username = '' THEN
            cand_username := 'club-' || LEFT(rec.req_id::text, 8);
        END IF;

        suffix_counter := 0;
        WHILE EXISTS (
            SELECT 1 FROM public.users
            WHERE LOWER(username) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username ELSE cand_username || '-' || suffix_counter END
            )
            OR LOWER(email) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username || '@club.orbix' ELSE cand_username || '-' || suffix_counter || '@club.orbix' END
            )
        ) OR EXISTS (
            SELECT 1 FROM auth.users
            WHERE LOWER(email) = LOWER(
                CASE WHEN suffix_counter = 0 THEN cand_username || '@club.orbix' ELSE cand_username || '-' || suffix_counter || '@club.orbix' END
            )
        ) LOOP
            suffix_counter := suffix_counter + 1;
        END LOOP;

        IF suffix_counter > 0 THEN
            cand_username := cand_username || '-' || suffix_counter;
        END IF;
        cand_email := cand_username || '@club.orbix';
        new_club_user_id := gen_random_uuid();

        INSERT INTO auth.users (
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at
        )
        VALUES (
            new_club_user_id,
            'authenticated',
            'authenticated',
            cand_email,
            rec.old_password,
            CURRENT_TIMESTAMP,
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object(
                'club_name', rec.club_name,
                'account_type', 'club',
                'is_email_verified', true,
                'migrated_from_user_id', rec.old_user_id::text
            ),
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
        );

        INSERT INTO public.users (
            id,
            firstname,
            middlename,
            lastname,
            email,
            username,
            password,
            termsaccepted,
            account_type,
            avatar_url,
            is_email_verified,
            email_verified_at,
            is_verified_coder,
            is_public
        )
        VALUES (
            new_club_user_id,
            COALESCE(NULLIF(TRIM(rec.club_name), ''), cand_username),
            NULL,
            'Club',
            cand_email,
            cand_username,
            rec.old_password,
            true,
            'club',
            'https://api.dicebear.com/7.x/shapes/svg?seed=' || cand_username,
            true,
            CURRENT_TIMESTAMP,
            true,
            true
        );

        UPDATE public.club_verification_requests
        SET auth_user_id = new_club_user_id,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = rec.req_id;
    END LOOP;
END $$;
