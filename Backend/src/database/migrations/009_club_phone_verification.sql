-- =========================================================================
-- Migration 009: Club Phone Verification & Pre-Registration OTP Support
-- =========================================================================

-- 1. Ensure phone verification status flags on users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;

-- 2. Ensure verification status flags on club_verification_requests
ALTER TABLE club_verification_requests ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
ALTER TABLE club_verification_requests ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
ALTER TABLE club_verification_requests ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;

-- 3. Allow pre-registration email OTP audit logging without requiring user_id upfront
DO $$
BEGIN
    ALTER TABLE email_verification_otps ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION
    WHEN others THEN NULL;
END $$;

-- 4. Create phone_verification_otps audit table
CREATE TABLE IF NOT EXISTS phone_verification_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NULL,
    phone VARCHAR(30) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_phone_verification_phone ON phone_verification_otps(phone, status);
CREATE INDEX IF NOT EXISTS idx_phone_verification_expires ON phone_verification_otps(expires_at);

-- 5. Grant permissions
GRANT ALL ON TABLE phone_verification_otps TO postgres, authenticated, anon;
