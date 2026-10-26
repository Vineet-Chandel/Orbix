-- Migration: 005_relationship_block_quotas.sql
-- Description: Production-grade Action Log Quota Auditing and Request Management Indexes

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLE: user_relationship_action_logs
-- Stores durable audit trail of every connection request and user block attempt.
-- Used as a durable fallback for sliding window rate limiting (20/day, 50/week).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_relationship_action_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('request', 'block')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Fast index for rolling window rate limit checks: actor + action_type + created_at
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_type_time 
    ON user_relationship_action_logs(actor_id, action_type, created_at DESC);

-- Fast index for target-specific action auditing
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_target 
    ON user_relationship_action_logs(actor_id, target_id, action_type, created_at DESC);

-- Index for rolling TTL cleanup
CREATE INDEX IF NOT EXISTS idx_rel_action_logs_created_at 
    ON user_relationship_action_logs(created_at);

-- ============================================================================
-- OPTIMIZED INDEXES FOR REQUEST MANAGEMENT
-- ============================================================================

-- Partial index for outgoing pending requests (requester is actor)
CREATE INDEX IF NOT EXISTS idx_relationships_requested_by_pending 
    ON user_relationships(requested_by, created_at DESC) 
    WHERE status = 'pending';

-- Partial indexes for incoming pending requests (actor is user_low_id or user_high_id and NOT requested_by)
CREATE INDEX IF NOT EXISTS idx_relationships_low_pending 
    ON user_relationships(user_low_id, requested_by, created_at DESC) 
    WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_relationships_high_pending 
    ON user_relationships(user_high_id, requested_by, created_at DESC) 
    WHERE status = 'pending';
