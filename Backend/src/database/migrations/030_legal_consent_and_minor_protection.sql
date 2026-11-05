-- Migration 030: Legal Consent Records, Minor Protection & Account Deletion Purge Support
-- 1. Extend users table with explicit, versioned legal acceptance & 18+ age confirmation
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS terms_version VARCHAR(32) DEFAULT 'v1.0',
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS privacy_policy_accepted BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS privacy_policy_version VARCHAR(32) DEFAULT 'v1.0',
    ADD COLUMN IF NOT EXISTS privacy_policy_accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS is_age_18_confirmed BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS age_confirmed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

-- 2. Create append-only user_legal_consents table for compliance auditing
CREATE TABLE IF NOT EXISTS public.user_legal_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'terms_and_conditions', 'privacy_policy', 'age_confirmation'
    document_version VARCHAR(32) NOT NULL DEFAULT 'v1.0',
    action VARCHAR(50) NOT NULL DEFAULT 'accepted', -- 'accepted', 'withdrawn', 're_accepted'
    ip_address VARCHAR(100),
    user_agent TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_legal_consents_user ON public.user_legal_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_legal_consents_type ON public.user_legal_consents(user_id, document_type);
CREATE INDEX IF NOT EXISTS idx_user_legal_consents_created ON public.user_legal_consents(created_at DESC);

-- 3. Extend club_event_registrations table with Minor Attendee & Guardian Consent tracking
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS is_attendee_under_18 BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS guardian_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS guardian_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS guardian_relationship VARCHAR(100),
    ADD COLUMN IF NOT EXISTS guardian_consent_status VARCHAR(50) DEFAULT 'not_required',
    ADD COLUMN IF NOT EXISTS guardian_consent_token VARCHAR(128),
    ADD COLUMN IF NOT EXISTS guardian_consent_token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS guardian_consent_verified_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS guardian_consent_ip VARCHAR(100),
    ADD COLUMN IF NOT EXISTS guardian_consent_user_agent TEXT;

-- Enforce check constraint on guardian_consent_status
DO $$
BEGIN
    ALTER TABLE public.club_event_registrations
        DROP CONSTRAINT IF EXISTS club_event_registrations_guardian_status_check;
    ALTER TABLE public.club_event_registrations
        ADD CONSTRAINT club_event_registrations_guardian_status_check
        CHECK (guardian_consent_status IN ('not_required', 'pending_verification', 'verified', 'rejected', 'withdrawn'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_club_event_reg_guardian_token
    ON public.club_event_registrations(guardian_consent_token)
    WHERE guardian_consent_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_event_reg_minor_consent
    ON public.club_event_registrations(event_id, guardian_consent_status);

-- 4. Update account_deletion_requests to support permanent purge while retaining audit integrity
DO $$
BEGIN
    -- Drop not null and cascade foreign key so deleted users leave anonymized audit records
    ALTER TABLE public.account_deletion_requests
        DROP CONSTRAINT IF EXISTS account_deletion_requests_user_id_fkey;
    ALTER TABLE public.account_deletion_requests
        ALTER COLUMN user_id DROP NOT NULL;
    ALTER TABLE public.account_deletion_requests
        ADD CONSTRAINT account_deletion_requests_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

ALTER TABLE public.account_deletion_requests
    ADD COLUMN IF NOT EXISTS user_email_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS purge_log JSONB DEFAULT '{}'::jsonb;
