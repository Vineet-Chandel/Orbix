-- Migration: Add user profile photo fields and upload intent tracking
-- Logical fields: photo_url, photo_public_id, previous_photo_url, previous_photo_public_id

-- 1. Extend users table with nullable profile photo management columns
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_public_id TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_url TEXT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_public_id TEXT NULL;

-- 2. Create photo_upload_intents table to prevent arbitrary public IDs, enforce server-generated ownership, and protect against replay
CREATE TABLE IF NOT EXISTS photo_upload_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    username VARCHAR(100),
    user_email VARCHAR(255),
    public_id TEXT NOT NULL UNIQUE,
    signature TEXT NOT NULL,
    timestamp BIGINT NOT NULL,
    folder TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_public_id ON photo_upload_intents(public_id);
CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_user ON photo_upload_intents(username, status);

-- 3. Create photo_cleanup_queue table to ensure safe, retryable asset deletion without breaking active photos
CREATE TABLE IF NOT EXISTS photo_cleanup_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    public_id TEXT NOT NULL,
    reason VARCHAR(50) NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    last_error TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_photo_cleanup_queue_status ON photo_cleanup_queue(status);
