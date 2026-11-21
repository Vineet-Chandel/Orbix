-- ============================================================================
-- ORBIX MIGRATION 069: PLATFORM ACCOUNT OWNERSHIP VERIFICATION & DUAL-STATE SCHEMA
-- ============================================================================
-- Description:
-- 1. Safely resolves user_links with null user_id matching users.username (unambiguous only).
-- 2. Archives all unresolvable/ambiguous orphans to user_links_orphaned_archive.
-- 3. Enforces NOT NULL and FOREIGN KEY constraint on user_links.user_id.
-- 4. Establishes composite unique constraint on (id, user_id) on user_links.
-- 5. Introduces canonical dual-state architecture: ownership_status & sync_status.
-- 6. Demotes legacy unproven connected accounts to CONNECTED_UNVERIFIED with
--    legacy_unverified_at timestamp (Zero-Conflict rollout).
-- 7. Establishes partial unique index unique_verified_portal_account ensuring
--    exactly one Orbix user can hold ownership of an external handle.
-- 8. Installs synchronization trigger guaranteeing legacy 'verified' boolean
--    strictly mirrors (ownership_status = 'VERIFIED').
-- 9. Creates platform_verification_challenges table with strict state/attempt
--    constraints, composite foreign key to (link_id, user_id), and single active
--    challenge uniqueness per user and portal.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- STEP 1: PRE-CLEANUP & LOSSLESS ORPHAN ARCHIVING FOR user_links
-- ----------------------------------------------------------------------------

-- 1a. Unambiguous backfill: match user_id only when exactly ONE user matches normalized username
UPDATE public.user_links ul
SET user_id = u.id
FROM (
    SELECT id, LOWER(TRIM(username)) AS norm_username
    FROM public.users
    WHERE LOWER(TRIM(username)) IN (
        SELECT LOWER(TRIM(username))
        FROM public.users
        GROUP BY LOWER(TRIM(username))
        HAVING COUNT(*) = 1
    )
) u
WHERE ul.user_id IS NULL
  AND ul.username IS NOT NULL
  AND LOWER(TRIM(ul.username)) = u.norm_username;

-- 1b. Create orphan archive table to prevent silent data loss during cleanup
CREATE TABLE IF NOT EXISTS public.user_links_orphaned_archive (
    archive_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    archived_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    archive_reason TEXT NOT NULL,
    original_id UUID,
    user_id UUID,
    username VARCHAR(100),
    portal VARCHAR(50),
    portal_username VARCHAR(100),
    link TEXT,
    raw_input TEXT,
    verified BOOLEAN,
    display_name VARCHAR(150),
    avatar_url TEXT,
    stats JSONB,
    is_public BOOLEAN,
    last_sync_status VARCHAR(50),
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ,
    last_error TEXT,
    snapshot JSONB,
    retry_count INT
);

-- 1c. Archive any remaining orphaned or ambiguous records before deletion
INSERT INTO public.user_links_orphaned_archive (
    archive_reason, original_id, user_id, username, portal, portal_username,
    link, raw_input, verified, display_name, avatar_url, stats, is_public,
    last_sync_status, last_sync_at, created_at, updated_at, last_error,
    snapshot, retry_count
)
SELECT 
    CASE 
        WHEN ul.user_id IS NULL AND ul.username IS NOT NULL AND (
            SELECT COUNT(*) FROM public.users u WHERE LOWER(TRIM(u.username)) = LOWER(TRIM(ul.username))
        ) > 1 THEN 'Ambiguous username match: multiple users found with matching normalized username'
        WHEN ul.user_id IS NULL THEN 'Unresolvable record: user_id is NULL and username does not exist in users table'
        ELSE 'Orphaned record: user_id does not exist in users table'
    END,
    id, user_id, username, portal, portal_username, link, raw_input,
    verified, display_name, avatar_url, stats, is_public, last_sync_status,
    last_sync_at, created_at, updated_at, to_jsonb(ul)->>'last_error', to_jsonb(ul)->'snapshot',
    (to_jsonb(ul)->>'retry_count')::INT
FROM public.user_links ul
WHERE ul.user_id IS NULL OR ul.user_id NOT IN (SELECT id FROM public.users);

-- 1d. Delete unresolvable orphaned rows from user_links
DELETE FROM public.user_links
WHERE user_id IS NULL OR user_id NOT IN (SELECT id FROM public.users);

-- ----------------------------------------------------------------------------
-- STEP 2: ENFORCE NOT NULL & FOREIGN KEY CONSTRAINT ON user_links.user_id
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_links
    ALTER COLUMN user_id SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_user_links_user_id'
    ) THEN
        ALTER TABLE public.user_links
            ADD CONSTRAINT fk_user_links_user_id
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;

    -- Composite unique constraint to enable cross-table user binding
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_user_links_id_user_id'
    ) THEN
        ALTER TABLE public.user_links
            ADD CONSTRAINT uq_user_links_id_user_id UNIQUE (id, user_id);
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 3: ADD CANONICAL OWNERSHIP & SYNC STATE COLUMNS TO user_links
-- ----------------------------------------------------------------------------

ALTER TABLE public.user_links
    ADD COLUMN IF NOT EXISTS ownership_status VARCHAR(30) NOT NULL DEFAULT 'CONNECTED_UNVERIFIED',
    ADD COLUMN IF NOT EXISTS sync_status VARCHAR(30) NOT NULL DEFAULT 'NOT_SYNCED',
    ADD COLUMN IF NOT EXISTS legacy_unverified_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS verified_handle VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS verification_method VARCHAR(30) NULL,
    ADD COLUMN IF NOT EXISTS verification_metadata JSONB DEFAULT '{}'::jsonb;

-- Default legacy verified boolean to false for all future inserts
ALTER TABLE public.user_links ALTER COLUMN verified SET DEFAULT false;

-- Add check constraints for enum values
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_links_ownership_status'
    ) THEN
        ALTER TABLE public.user_links
            ADD CONSTRAINT chk_user_links_ownership_status
            CHECK (ownership_status IN (
                'NOT_CONNECTED',
                'CONNECTED_UNVERIFIED',
                'VERIFICATION_PENDING',
                'VERIFICATION_FAILED',
                'VERIFIED',
                'REVOKED'
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_links_sync_status'
    ) THEN
        ALTER TABLE public.user_links
            ADD CONSTRAINT chk_user_links_sync_status
            CHECK (sync_status IN (
                'NOT_SYNCED',
                'SYNCING',
                'SYNCED',
                'SYNC_FAILED',
                'PROFILE_UNAVAILABLE'
            ));
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- STEP 4: ZERO-CONFLICT MIGRATION (LEGACY DEMOTION & AUDIT MARKING)
-- ----------------------------------------------------------------------------
-- Demotes all legacy unproven connected accounts to CONNECTED_UNVERIFIED.
-- Populates legacy_unverified_at with CURRENT_TIMESTAMP to track the 14-day
-- verification grace period window without granting scoring authority.
-- Harmonizes existing last_sync_status into the canonical sync_status column.
-- Idempotency safeguard: Replays or retries must NEVER demote already-verified
-- accounts (ownership_status = 'VERIFIED') or reset existing grace period timestamps.
UPDATE public.user_links
SET verified = false,
    ownership_status = 'CONNECTED_UNVERIFIED',
    legacy_unverified_at = COALESCE(legacy_unverified_at, CURRENT_TIMESTAMP),
    verified_at = NULL,
    verified_handle = NULL,
    sync_status = CASE
        WHEN last_sync_status IN ('valid', 'success', 'synced') THEN 'SYNCED'
        WHEN last_sync_status IN ('failed', 'error', 'invalid') THEN 'SYNC_FAILED'
        ELSE 'NOT_SYNCED'
    END
WHERE ownership_status IS DISTINCT FROM 'VERIFIED'
  AND (legacy_unverified_at IS NULL OR verified = true);

-- ----------------------------------------------------------------------------
-- STEP 5: CREATE PARTIAL UNIQUE INDEX & PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
-- Guaranteed zero collisions at rollout because all legacy rows were demoted
-- to CONNECTED_UNVERIFIED above (covering 0 rows at migration time).
CREATE UNIQUE INDEX IF NOT EXISTS unique_verified_portal_account
    ON public.user_links (LOWER(TRIM(portal)), LOWER(TRIM(portal_username)))
    WHERE ownership_status = 'VERIFIED';

-- Query optimization indexes for user-scoped portal lookups
CREATE INDEX IF NOT EXISTS idx_user_links_user_portal_ownership
    ON public.user_links (user_id, LOWER(TRIM(portal)), ownership_status);

CREATE INDEX IF NOT EXISTS idx_user_links_user_id
    ON public.user_links (user_id);

CREATE INDEX IF NOT EXISTS idx_user_links_legacy_grace
    ON public.user_links (legacy_unverified_at)
    WHERE legacy_unverified_at IS NOT NULL;

-- ----------------------------------------------------------------------------
-- STEP 6: TRIGGER TO GUARANTEE LEGACY 'verified' BOOLEAN COMPATIBILITY
-- ----------------------------------------------------------------------------
-- Ensures that the legacy 'verified' boolean strictly mirrors (ownership_status = 'VERIFIED').
-- Prevents any legacy writer or edge case from making verified = true without verified ownership.
CREATE OR REPLACE FUNCTION public.sync_user_links_verified_status()
RETURNS TRIGGER AS $$
BEGIN
    NEW.verified := (NEW.ownership_status = 'VERIFIED');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_user_links_verified ON public.user_links;
CREATE TRIGGER trg_sync_user_links_verified
    BEFORE INSERT OR UPDATE ON public.user_links
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_user_links_verified_status();

-- ----------------------------------------------------------------------------
-- STEP 7: DEDICATED CHALLENGE PERSISTENCE TABLE
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.platform_verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    link_id UUID NULL,
    portal VARCHAR(50) NOT NULL,
    portal_username VARCHAR(100) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    token_display_prefix VARCHAR(15) NOT NULL,
    target_field VARCHAR(50) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 5,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    last_attempt_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_pvc_status CHECK (status IN ('pending', 'verified', 'failed', 'expired', 'invalidated')),
    CONSTRAINT chk_pvc_attempts_range CHECK (attempts >= 0 AND max_attempts > 0 AND attempts <= max_attempts),
    CONSTRAINT chk_pvc_consumed_consistency CHECK (
        (status = 'verified' AND consumed_at IS NOT NULL) OR
        (status <> 'verified' AND consumed_at IS NULL)
    ),
    CONSTRAINT chk_pvc_expiry_consistency CHECK (expires_at > created_at),
    CONSTRAINT fk_pvc_user_link FOREIGN KEY (link_id, user_id)
        REFERENCES public.user_links(id, user_id) ON DELETE CASCADE
);

-- Ensure at most one active ('pending') challenge per user and external platform
CREATE UNIQUE INDEX IF NOT EXISTS idx_pvc_single_active_challenge
    ON public.platform_verification_challenges (user_id, LOWER(TRIM(portal)))
    WHERE status = 'pending';

-- Index for rapid challenge lookups by user, portal, and status
CREATE INDEX IF NOT EXISTS idx_pvc_user_portal_status
    ON public.platform_verification_challenges (user_id, LOWER(TRIM(portal)), status);

-- Index for efficient background expiry / cleanup
CREATE INDEX IF NOT EXISTS idx_pvc_pending_expiry
    ON public.platform_verification_challenges (expires_at)
    WHERE status = 'pending';

-- ----------------------------------------------------------------------------
-- STEP 8: TRIGGER TO RESET OWNERSHIP ON EXTERNAL IDENTITY CHANGE
-- ----------------------------------------------------------------------------
-- Guarantees that if portal_username or portal changes on user_links,
-- verified ownership is automatically revoked and demoted to CONNECTED_UNVERIFIED.
CREATE OR REPLACE FUNCTION public.reset_user_links_on_identity_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF (LOWER(TRIM(OLD.portal_username)) <> LOWER(TRIM(NEW.portal_username)))
           OR (LOWER(TRIM(OLD.portal)) <> LOWER(TRIM(NEW.portal))) THEN
            NEW.ownership_status := 'CONNECTED_UNVERIFIED';
            NEW.verified := false;
            NEW.verified_at := NULL;
            NEW.verified_handle := NULL;
            NEW.verification_method := NULL;
            NEW.verification_metadata := '{}'::jsonb;
            NEW.legacy_unverified_at := CURRENT_TIMESTAMP;

            -- Invalidate all outstanding pending challenges for this link/identity
            UPDATE public.platform_verification_challenges
            SET status = 'invalidated',
                last_error = 'Identity changed while challenge was pending',
                updated_at = CURRENT_TIMESTAMP
            WHERE (link_id = OLD.id OR (user_id = OLD.user_id AND LOWER(TRIM(portal)) = LOWER(TRIM(OLD.portal))))
              AND status = 'pending';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_links_reset_on_identity_change ON public.user_links;
CREATE TRIGGER trg_user_links_reset_on_identity_change
    BEFORE UPDATE OF portal, portal_username ON public.user_links
    FOR EACH ROW
    EXECUTE FUNCTION public.reset_user_links_on_identity_change();
