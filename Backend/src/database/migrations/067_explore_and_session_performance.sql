-- Supports page-first discovery and its per-page platform lookups.
CREATE INDEX IF NOT EXISTS idx_user_links_lower_username ON user_links (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_users_public_explore_score
    ON users (orbix_score DESC NULLS LAST, total_solved DESC NULLS LAST, id)
    WHERE is_public IS TRUE;
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_last_active
    ON user_sessions (user_id, last_active_at DESC);
