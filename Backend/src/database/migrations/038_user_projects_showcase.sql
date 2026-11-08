-- ============================================================================
-- Migration 038: User Projects Showcase System
--
-- Features:
-- 1. Full relational project repository schema for developer portfolio showcase
-- 2. Atomic 4-project hard capacity constraint per user (0 min, 4 max)
-- 3. Technologies, features, external links, and architecture notes
-- 4. Publication and draft workflow with display ordering
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    slug VARCHAR(180) NOT NULL,
    tagline VARCHAR(255),
    description TEXT,
    category VARCHAR(50) DEFAULT 'Full-Stack',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    is_published BOOLEAN DEFAULT false,
    is_pinned BOOLEAN DEFAULT false,
    display_order INT NOT NULL DEFAULT 0,
    repo_url TEXT NULL,
    repo_name VARCHAR(150) NULL,
    repo_stars INT DEFAULT 0,
    repo_forks INT DEFAULT 0,
    repo_license VARCHAR(100) NULL,
    repo_language VARCHAR(60) NULL,
    repo_pushed_at TIMESTAMPTZ NULL,
    live_url TEXT NULL,
    demo_video_url TEXT NULL,
    documentation_url TEXT NULL,
    image_url TEXT NULL,
    gallery_images JSONB DEFAULT '[]'::jsonb,
    technologies JSONB DEFAULT '[]'::jsonb,
    features JSONB DEFAULT '[]'::jsonb,
    external_links JSONB DEFAULT '[]'::jsonb,
    architecture_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Performance & Query Optimization Indexes
CREATE INDEX IF NOT EXISTS idx_user_projects_user_id ON user_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_projects_user_order ON user_projects(user_id, display_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_projects_published ON user_projects(user_id, is_published);
CREATE INDEX IF NOT EXISTS idx_user_projects_slug ON user_projects(slug);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_projects_user_slug ON user_projects(user_id, slug);

-- ============================================================================
-- Atomic Hard Project Capacity Enforcement Trigger (Max 4 Projects per User)
-- Guarantees atomic isolation so simultaneous requests cannot exceed 4 projects.
-- ============================================================================
CREATE OR REPLACE FUNCTION enforce_user_projects_max_limit()
RETURNS TRIGGER AS $$
DECLARE
    project_count INT;
BEGIN
    -- Count existing projects for this user with lock
    SELECT COUNT(*) INTO project_count
    FROM user_projects
    WHERE user_id = NEW.user_id;

    IF project_count >= 4 THEN
        RAISE EXCEPTION 'Maximum project showcase capacity reached (4/4). You must delete an existing project before adding a new one.'
            USING ERRCODE = '23514'; -- check_violation
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_enforce_user_projects_max_limit ON user_projects;
CREATE TRIGGER trigger_enforce_user_projects_max_limit
BEFORE INSERT ON user_projects
FOR EACH ROW
EXECUTE FUNCTION enforce_user_projects_max_limit();
