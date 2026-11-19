-- ============================================================================
-- Migration 039: Private Repository Support & Data Protection
-- 
-- Features:
-- 1. Adds privacy flags (is_repo_private, hide_repo_url) to user_projects
-- 2. Creates user_github_installations table for secure GitHub App installations
-- 3. Stores short-lived access tokens encrypted with AES-256-GCM
-- ============================================================================

-- 1. Add privacy protection columns to user_projects
ALTER TABLE user_projects 
ADD COLUMN IF NOT EXISTS is_repo_private BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS hide_repo_url BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_user_projects_private ON user_projects(is_repo_private);

-- 2. Create user_github_installations table
CREATE TABLE IF NOT EXISTS user_github_installations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installation_id VARCHAR(100) NOT NULL,
    account_login VARCHAR(150) NOT NULL,
    account_type VARCHAR(50) DEFAULT 'User',
    repository_selection VARCHAR(50) DEFAULT 'selected', -- 'all' | 'selected'
    permissions JSONB DEFAULT '{"metadata": "read", "contents": "read"}'::jsonb,
    encrypted_access_token TEXT NULL,
    token_expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_installation UNIQUE(user_id, installation_id)
);

CREATE INDEX IF NOT EXISTS idx_user_gh_install_user ON user_github_installations(user_id);
