-- =========================================================================
-- Migration 013: Case-insensitive unique constraints on users (email, username)
-- and verified_clubs slug optimization for /clubs/<club-username>
-- =========================================================================

-- 1. Ensure case-insensitive unique indexes on users email and username
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_email
    ON public.users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_lower_username
    ON public.users (LOWER(username));

-- 2. Ensure case-insensitive unique index on verified_clubs slug
CREATE UNIQUE INDEX IF NOT EXISTS idx_verified_clubs_lower_slug
    ON public.verified_clubs (LOWER(slug));
