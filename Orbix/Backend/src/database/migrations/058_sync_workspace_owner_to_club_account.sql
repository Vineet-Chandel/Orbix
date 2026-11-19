-- ============================================================================
-- Migration 058: Sync team_workspaces.owner_id to dedicated Club Account
-- and ensure an active internal workspace_members row exists for club FKs.
-- ============================================================================

DO $$
DECLARE
    rec RECORD;
    owner_role_id UUID;
BEGIN
    -- 1. Point each team_workspace.owner_id to its verified club's dedicated auth_user_id
    UPDATE public.team_workspaces tw
    SET
        owner_id = vc.auth_user_id,
        updated_at = NOW()
    FROM public.verified_clubs vc
    JOIN public.users u ON u.id = vc.auth_user_id
    WHERE vc.id = tw.club_id
      AND vc.auth_user_id IS NOT NULL
      AND COALESCE(u.account_type, 'personal') = 'club'
      AND tw.owner_id IS DISTINCT FROM vc.auth_user_id;

    -- 2. Ensure each club account has an active internal workspace_members row
    --    (required for DB foreign keys such as workspace_messages.sender_member_id;
    --     hidden from Member Roster and member counts via COALESCE(u.account_type, 'personal') <> 'club').
    FOR rec IN
        SELECT
            tw.id AS workspace_id,
            vc.auth_user_id AS club_user_id
        FROM public.team_workspaces tw
        JOIN public.verified_clubs vc ON vc.id = tw.club_id
        JOIN public.users u ON u.id = vc.auth_user_id
        WHERE vc.auth_user_id IS NOT NULL
          AND COALESCE(u.account_type, 'personal') = 'club'
    LOOP
        SELECT wr.id
        INTO owner_role_id
        FROM public.workspace_roles wr
        WHERE wr.workspace_id = rec.workspace_id
          AND wr.slug = 'owner'
        LIMIT 1;

        IF owner_role_id IS NOT NULL THEN
            INSERT INTO public.workspace_members (
                workspace_id,
                user_id,
                role_id,
                role_title,
                membership_status,
                is_suspended
            )
            VALUES (
                rec.workspace_id,
                rec.club_user_id,
                owner_role_id,
                'Club Official Account',
                'active',
                false
            )
            ON CONFLICT (workspace_id, user_id) DO UPDATE
            SET
                role_id = EXCLUDED.role_id,
                membership_status = 'active',
                is_suspended = false,
                suspended_at = NULL,
                suspended_reason = NULL,
                suspended_by = NULL,
                updated_at = NOW();
        END IF;
    END LOOP;
END $$;
