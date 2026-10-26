-- =========================================================================
-- Migration 003: Club Registration and Verification Pipeline
-- Creates the club_verification_requests table, indexes, trigger, and RLS policies
-- =========================================================================

-- Ensure account_type column exists on users table to restrict club accounts
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_type VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (account_type IN ('personal', 'club', 'admin'));
CREATE INDEX IF NOT EXISTS idx_users_account_type ON public.users(account_type);

CREATE TABLE IF NOT EXISTS public.club_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    auth_user_id UUID NOT NULL
        REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Club identity
    club_name TEXT NOT NULL
        CHECK (length(btrim(club_name)) BETWEEN 2 AND 120),

    college_name TEXT NOT NULL
        CHECK (length(btrim(college_name)) BETWEEN 2 AND 200),

    college_city TEXT NOT NULL,
    college_state TEXT NOT NULL,
    college_country TEXT NOT NULL DEFAULT 'India',

    club_category TEXT NOT NULL
        CHECK (club_category IN (
            'coding',
            'technology',
            'ai_ml',
            'robotics',
            'entrepreneurship',
            'cultural',
            'sports',
            'other'
        )),

    club_description TEXT,

    -- Representative details
    contact_person_name TEXT NOT NULL,
    contact_person_role TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    college_official_email TEXT,
    contact_phone TEXT,

    -- Optional verification references
    college_website_url TEXT,
    club_website_url TEXT,
    club_social_url TEXT,

    -- Legal consent record
    terms_accepted BOOLEAN NOT NULL DEFAULT FALSE
        CHECK (terms_accepted IS TRUE),

    terms_version TEXT NOT NULL,

    privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE
        CHECK (privacy_policy_accepted IS TRUE),

    privacy_policy_version TEXT NOT NULL,

    consent_recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Public application status
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'under_review',
            'needs_information',
            'rejected',
            'ready_for_promotion'
        )),

    -- Internal college-verification checklist
    college_contact_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (college_contact_status IN (
            'not_started',
            'contacted',
            'confirmed',
            'not_found',
            'no_response'
        )),

    club_existence_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    college_authorization_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    representative_authority_confirmed BOOLEAN NOT NULL DEFAULT FALSE,

    last_college_contacted_at TIMESTAMPTZ,

    -- Internal review information
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    internal_notes TEXT,

    -- Timestamps
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Validate provided URLs
    CHECK (
        college_website_url IS NULL
        OR college_website_url ~* '^https?://'
    ),
    CHECK (
        club_website_url IS NULL
        OR club_website_url ~* '^https?://'
    ),
    CHECK (
        club_social_url IS NULL
        OR club_social_url ~* '^https?://'
    )
);

-- Permit only one active verification request per authenticated account.
-- A rejected request remains available for review history.
CREATE UNIQUE INDEX IF NOT EXISTS
    club_verification_one_active_request_per_user
ON public.club_verification_requests (auth_user_id)
WHERE status IN (
    'pending',
    'under_review',
    'needs_information',
    'ready_for_promotion'
);

-- Additional lookup and sorting indexes
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_status
    ON public.club_verification_requests (status);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_submitted_at
    ON public.club_verification_requests (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_verification_requests_user
    ON public.club_verification_requests (auth_user_id);

-- Maintain updated_at automatically.
CREATE OR REPLACE FUNCTION
    public.set_club_verification_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION
    public.set_club_verification_requests_updated_at()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS
    set_club_verification_requests_updated_at
ON public.club_verification_requests;

CREATE TRIGGER
    set_club_verification_requests_updated_at
BEFORE UPDATE ON public.club_verification_requests
FOR EACH ROW
EXECUTE FUNCTION
    public.set_club_verification_requests_updated_at();

-- Secure the exposed table.
ALTER TABLE public.club_verification_requests
ENABLE ROW LEVEL SECURITY;

-- Remove default client privileges before granting precise permissions.
REVOKE ALL ON TABLE public.club_verification_requests
FROM anon, authenticated;

GRANT ALL PRIVILEGES ON TABLE
    public.club_verification_requests
TO service_role;

-- Applicants may read only the columns needed by their own
-- application-status page. Internal review fields remain private.
GRANT SELECT (
    id,
    auth_user_id,
    club_name,
    college_name,
    college_city,
    college_state,
    college_country,
    club_category,
    club_description,
    contact_person_name,
    contact_person_role,
    contact_email,
    college_official_email,
    contact_phone,
    college_website_url,
    club_website_url,
    club_social_url,
    terms_accepted,
    terms_version,
    privacy_policy_accepted,
    privacy_policy_version,
    consent_recorded_at,
    status,
    submitted_at,
    updated_at
)
ON public.club_verification_requests
TO authenticated;

-- Applicants may insert only submitted application fields.
-- They cannot set internal verification fields or choose a status.
GRANT INSERT (
    auth_user_id,
    club_name,
    college_name,
    college_city,
    college_state,
    college_country,
    club_category,
    club_description,
    contact_person_name,
    contact_person_role,
    contact_email,
    college_official_email,
    contact_phone,
    college_website_url,
    club_website_url,
    club_social_url,
    terms_accepted,
    terms_version,
    privacy_policy_accepted,
    privacy_policy_version
)
ON public.club_verification_requests
TO authenticated;

DROP POLICY IF EXISTS
    applicants_read_own_club_verification_request
ON public.club_verification_requests;

CREATE POLICY applicants_read_own_club_verification_request
ON public.club_verification_requests
FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) = auth_user_id
);

DROP POLICY IF EXISTS
    applicants_insert_own_club_verification_request
ON public.club_verification_requests;

CREATE POLICY applicants_insert_own_club_verification_request
ON public.club_verification_requests
FOR INSERT
TO authenticated
WITH CHECK (
    (SELECT auth.uid()) = auth_user_id
    AND status = 'pending'
    AND terms_accepted IS TRUE
    AND privacy_policy_accepted IS TRUE
);
