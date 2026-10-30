-- =========================================================================
-- Migration 018: Real User Account Linkage & Club Credential Management
-- Enforces: One person = One personal account; One club = Organisational entity.
-- =========================================================================

-- 1. Ensure any legacy users with account_type = 'club' are normalized to 'personal'
UPDATE public.users 
SET account_type = 'personal' 
WHERE account_type = 'club';

-- 2. Ensure applicant_user_id explicit column on club_verification_requests and verified_clubs
ALTER TABLE public.club_verification_requests 
    ADD COLUMN IF NOT EXISTS applicant_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE;

UPDATE public.club_verification_requests 
SET applicant_user_id = auth_user_id 
WHERE applicant_user_id IS NULL AND auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_club_req_applicant_user ON public.club_verification_requests(applicant_user_id);

ALTER TABLE public.verified_clubs 
    ADD COLUMN IF NOT EXISTS applicant_user_id UUID REFERENCES public.users(id) ON DELETE RESTRICT;

UPDATE public.verified_clubs 
SET applicant_user_id = auth_user_id 
WHERE applicant_user_id IS NULL AND auth_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_verified_clubs_applicant_user ON public.verified_clubs(applicant_user_id);

-- 3. Dedicated table for encrypted club-owned external credentials & service accounts
CREATE TABLE IF NOT EXISTS public.club_external_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    service_name VARCHAR(100) NOT NULL,
    account_identifier VARCHAR(150),
    credential_type VARCHAR(50) NOT NULL DEFAULT 'api_key', -- 'api_key', 'service_account', 'webhook', 'smtp', 'oauth_token', 'other'
    encrypted_secret TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    updated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_club_ext_cred_club ON public.club_external_credentials(club_id);
