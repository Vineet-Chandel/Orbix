-- Migration 028: Club Certificates & Credential Issuance System

CREATE TABLE IF NOT EXISTS public.club_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.club_events(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL DEFAULT 'participation' CHECK (
        certificate_type IN ('participation', 'excellence', 'merit', 'contributor', 'organizer', 'appreciation')
    ),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255),
    description TEXT,
    credential_code VARCHAR(64) NOT NULL UNIQUE,
    signer_name VARCHAR(150),
    signer_role VARCHAR(150),
    issued_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    issue_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_certificates_user ON public.club_certificates(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_certificates_club ON public.club_certificates(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_club_certificates_event ON public.club_certificates(event_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_code ON public.club_certificates(credential_code);

CREATE UNIQUE INDEX IF NOT EXISTS unique_club_user_cert_idx
    ON public.club_certificates(club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title);
