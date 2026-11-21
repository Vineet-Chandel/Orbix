-- =========================================================================
-- Migration: 020_blog_likes.sql
-- Description: Publication-level blog likes for Orbix blogs & workbooks
-- =========================================================================

-- Ensure pgcrypto for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS blog_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hoster VARCHAR(120) NOT NULL,
    blog_name VARCHAR(120) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Guarantee: Exactly one like per authenticated user per publication
    CONSTRAINT uq_blog_likes_publication_user UNIQUE (hoster, blog_name, user_id)
);

-- Index for publication-level count retrieval and batch aggregations
CREATE INDEX IF NOT EXISTS idx_blog_likes_pub ON blog_likes(hoster, blog_name);

-- Composite index for fast user-specific publication like lookups (index-only scans)
CREATE INDEX IF NOT EXISTS idx_blog_likes_user_pub ON blog_likes(user_id, hoster, blog_name);

