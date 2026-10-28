-- 011_manage_accounts_system.sql
-- Production-Ready Manage Accounts System
-- Supports atomic email changes with old-email authorization, new-email verification,
-- username changes with step-up authentication, monthly limits, and audit history.

-- 1. Ensure user columns for pending operations and username timestamps
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255) NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_operation_id UUID NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;

-- 2. Account Change Operations Table
-- Represents stateful account identity workflows: email changes and username changes
CREATE TABLE IF NOT EXISTS account_change_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    change_type VARCHAR(30) NOT NULL, -- 'email_change' | 'username_change'
    current_value VARCHAR(255) NOT NULL,
    requested_value VARCHAR(255) NOT NULL,
    stage VARCHAR(50) NOT NULL, -- 'old_email_authorization_pending' | 'new_email_verification_pending' | 'authorization_pending' | 'completed' | 'cancelled' | 'expired'
    old_challenge_id UUID NULL,
    new_challenge_id UUID NULL,
    attempts INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    cancelled_at TIMESTAMPTZ NULL,
    cancellation_reason TEXT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index active operations by user and type
CREATE INDEX IF NOT EXISTS idx_account_change_ops_user_stage 
ON account_change_operations(user_id, stage);

CREATE INDEX IF NOT EXISTS idx_account_change_ops_expires 
ON account_change_operations(expires_at) 
WHERE stage NOT IN ('completed', 'cancelled', 'expired');

-- 3. Account Change Verification Challenges Table
-- Stores cryptographically hashed OTPs bound to specific operations and stages
CREATE TABLE IF NOT EXISTS account_change_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_id UUID NOT NULL REFERENCES account_change_operations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    challenge_type VARCHAR(50) NOT NULL, -- 'old_email_auth' | 'new_email_verify' | 'username_change_auth'
    destination VARCHAR(255) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'verified' | 'failed' | 'expired' | 'consumed'
    attempts INT DEFAULT 0,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    resend_count INT DEFAULT 0,
    last_resent_at TIMESTAMPTZ NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_change_challenges_op 
ON account_change_challenges(operation_id, status);

CREATE INDEX IF NOT EXISTS idx_account_change_challenges_user 
ON account_change_challenges(user_id, destination);

-- 4. Account Change History (Audit & Monthly Quota Enforcement)
-- Tracks every successfully committed email and username change
CREATE TABLE IF NOT EXISTS account_change_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    operation_id UUID NULL UNIQUE,
    change_type VARCHAR(30) NOT NULL, -- 'email' | 'username'
    old_value VARCHAR(255) NOT NULL,
    new_value VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Composite index to support instant monthly limit evaluation
CREATE INDEX IF NOT EXISTS idx_account_change_history_monthly 
ON account_change_history(user_id, change_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_change_history_old_username
ON account_change_history(LOWER(old_value)) 
WHERE change_type = 'username';
