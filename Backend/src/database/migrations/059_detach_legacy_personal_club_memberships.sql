-- ============================================================================
-- Migration 059: Detach legacy personal club memberships & metadata
-- Ensures personal accounts whose Gmail was originally used to register a club
-- (migrated to a dedicated account_type = 'club' user in Migration 057) are
-- treated as completely independent normal personal accounts with zero automatic
-- club ownership/membership links.
--
-- Idempotent: marks each migrated club's auth.users metadata with
-- legacy_personal_membership_detached = true so future intentional invitations
-- of that personal account at any role are never affected on re-runs.
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    ws_id UUID;
    is_legacy_uninvited BOOLEAN;
BEGIN
    FOR rec IN
        SELECT
            au.id AS club_user_id,
            (au.raw_user_meta_data->>'migrated_from_user_id')::uuid AS old_personal_user_id,
            vc.id AS club_id
        FROM auth.users au
        JOIN public.users u_club ON u_club.id = au.id AND u_club.account_type = 'club'
        LEFT JOIN public.verified_clubs vc ON vc.auth_user_id = au.id
        WHERE au.raw_user_meta_data ? 'migrated_from_user_id'
          AND COALESCE((au.raw_user_meta_data->>'legacy_personal_membership_detached')::boolean, false) = false
    LOOP
        IF rec.club_id IS NOT NULL THEN
            SELECT tw.id INTO ws_id
            FROM public.team_workspaces tw
            WHERE tw.club_id = rec.club_id
            LIMIT 1;

            IF ws_id IS NOT NULL THEN
                SELECT EXISTS (
                    SELECT 1
                    FROM public.workspace_members wm
                    WHERE wm.workspace_id = ws_id
                      AND wm.user_id = rec.old_personal_user_id
                      AND (wm.invited_by IS NULL OR wm.invited_by = rec.old_personal_user_id)
                ) INTO is_legacy_uninvited;

                IF is_legacy_uninvited THEN
                    UPDATE public.team_workspaces
                    SET manager_user_id = NULL,
                        updated_at = NOW()
                    WHERE id = ws_id
                      AND manager_user_id = rec.old_personal_user_id;

                    DELETE FROM public.workspace_department_members
                    WHERE workspace_id = ws_id
                      AND user_id = rec.old_personal_user_id;

                    DELETE FROM public.workspace_members
                    WHERE workspace_id = ws_id
                      AND user_id = rec.old_personal_user_id
                      AND (invited_by IS NULL OR invited_by = rec.old_personal_user_id);
                END IF;
            END IF;

            DELETE FROM public.club_memberships
            WHERE club_id = rec.club_id
              AND user_id = rec.old_personal_user_id
              AND (invited_by IS NULL OR invited_by = rec.old_personal_user_id)
              AND access_role = 'owner';
        END IF;

        -- Normalize legacy auth.users metadata on the personal user if it still carries 'club'
        UPDATE auth.users au_old
        SET raw_user_meta_data = (
            (COALESCE(au_old.raw_user_meta_data, '{}'::jsonb) - 'club_name')
            || '{"account_type": "personal"}'::jsonb
        ),
        updated_at = NOW()
        FROM public.users u_old
        WHERE au_old.id = rec.old_personal_user_id
          AND u_old.id = rec.old_personal_user_id
          AND COALESCE(u_old.account_type, 'personal') != 'club'
          AND (
              au_old.raw_user_meta_data->>'account_type' = 'club'
              OR au_old.raw_user_meta_data ? 'club_name'
          );

        -- Mark detachment completed so subsequent migration runs are no-ops
        UPDATE auth.users
        SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || '{"legacy_personal_membership_detached": true}'::jsonb,
            updated_at = NOW()
        WHERE id = rec.club_user_id;
    END LOOP;
END $$;
