-- Migration: 004_relationships_blocks_notifications.sql
-- Description: Production-grade User Relationships, User Blocks, and Notifications Upgrade

-- Enable pgcrypto for UUID generation if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- SCHEMA A: USER RELATIONSHIPS
-- Canonical pair model: user_low_id < user_high_id
-- Ensures A-B and B-A always resolve to exactly one canonical record.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_low_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_high_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL CHECK (status IN ('pending', 'connected', 'declined', 'cancelled', 'removed')),
    requested_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMPTZ,
    last_action_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Canonical ordering constraint: user_low_id must strictly precede user_high_id
    CONSTRAINT check_canonical_order CHECK (user_low_id < user_high_id),
    -- Requester must belong to the pair
    CONSTRAINT check_requester_in_pair CHECK (requested_by = user_low_id OR requested_by = user_high_id),
    -- Exactly one relationship row per distinct pair
    CONSTRAINT unique_canonical_pair UNIQUE (user_low_id, user_high_id)
);

-- Indexes for lightning-fast queries in both directions and status lookups
CREATE INDEX IF NOT EXISTS idx_relationships_low ON user_relationships(user_low_id, status);
CREATE INDEX IF NOT EXISTS idx_relationships_high ON user_relationships(user_high_id, status);
CREATE INDEX IF NOT EXISTS idx_relationships_status ON user_relationships(status);
CREATE INDEX IF NOT EXISTS idx_relationships_last_action ON user_relationships(last_action_at DESC);

-- ============================================================================
-- SCHEMA B: USER BLOCKS
-- Directional blocking model: blocker_id initiates block against blocked_id
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- A user cannot block themselves
    CONSTRAINT check_no_self_block CHECK (blocker_id != blocked_id),
    -- Unique directional block
    CONSTRAINT unique_user_block UNIQUE (blocker_id, blocked_id)
);

-- Bidirectional indexes for checking blocks in either direction with index-only scans
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked ON user_blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_blocker ON user_blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_created_at ON user_blocks(created_at DESC);

-- ============================================================================
-- SCHEMA C: USER NOTIFICATIONS UPGRADE
-- Upgrade user_notifications to support actor_id, recipient_id, idempotency,
-- and rate-limit tracking.
-- ============================================================================

-- Add new columns safely if they do not already exist
DO $$
BEGIN
    -- recipient_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'recipient_id'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN recipient_id UUID REFERENCES users(id) ON DELETE CASCADE;
    END IF;

    -- actor_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'actor_id'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- relationship_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'relationship_id'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN relationship_id UUID REFERENCES user_relationships(id) ON DELETE SET NULL;
    END IF;

    -- notification_type
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'notification_type'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN notification_type VARCHAR(100);
    END IF;

    -- idempotency_key
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN idempotency_key VARCHAR(255) UNIQUE;
    END IF;

    -- is_user_initiated
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'is_user_initiated'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN is_user_initiated BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- delivery_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_notifications' AND column_name = 'delivery_status'
    ) THEN
        ALTER TABLE user_notifications ADD COLUMN delivery_status VARCHAR(50) NOT NULL DEFAULT 'delivered';
    END IF;
END $$;

-- Backfill recipient_id from user_id if null
UPDATE user_notifications
SET recipient_id = user_id
WHERE recipient_id IS NULL AND user_id IS NOT NULL;

-- Backfill notification_type from type if null
UPDATE user_notifications
SET notification_type = type
WHERE notification_type IS NULL AND type IS NOT NULL;

-- Indexes for user_notifications: inbox query & sliding window rate limiting
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON user_notifications(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread ON user_notifications(recipient_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_sliding_window ON user_notifications(actor_id, recipient_id, is_user_initiated, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_relationship ON user_notifications(relationship_id);

-- ============================================================================
-- AUTO-UPDATE TRIGGER FOR user_relationships.updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_relationships_updated_at ON user_relationships;
CREATE TRIGGER trigger_user_relationships_updated_at
BEFORE UPDATE ON user_relationships
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
