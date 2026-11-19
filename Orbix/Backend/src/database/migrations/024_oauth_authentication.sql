-- Migration 024: Add OAuth provider support for Google and GitHub
-- 1. Allow password to be NULL for OAuth-registered users
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- 2. Add OAuth provider identifiers and provider type
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS github_id VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';

-- 3. Create unique partial indexes for provider IDs
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id) WHERE github_id IS NOT NULL;
