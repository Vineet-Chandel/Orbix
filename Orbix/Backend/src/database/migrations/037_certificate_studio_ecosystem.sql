-- Migration 037: Orbix Certificate Studio Ecosystem
-- Visual Template Builder, Intelligent Data Mapping & Digital Credential Issuance Platform

-- 1. Certificate Templates Table
CREATE TABLE IF NOT EXISTS public.certificate_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    is_system BOOLEAN NOT NULL DEFAULT false,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'event',
    design JSONB NOT NULL DEFAULT '{}'::jsonb,
    background_asset_url TEXT,
    background_fit VARCHAR(20) DEFAULT 'cover' CHECK (background_fit IN ('cover', 'contain', 'stretch')),
    orientation VARCHAR(20) NOT NULL DEFAULT 'landscape' CHECK (orientation IN ('landscape', 'portrait')),
    page_width INT NOT NULL DEFAULT 842,
    page_height INT NOT NULL DEFAULT 595,
    version INT NOT NULL DEFAULT 1,
    status VARCHAR(30) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived')),
    thumbnail_url TEXT,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_templates_club ON public.certificate_templates(club_id, status);
CREATE INDEX IF NOT EXISTS idx_cert_templates_system ON public.certificate_templates(is_system, category);
CREATE INDEX IF NOT EXISTS idx_cert_templates_created ON public.certificate_templates(created_at DESC);

-- 2. Certificate Batches Table
CREATE TABLE IF NOT EXISTS public.certificate_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.club_events(id) ON DELETE SET NULL,
    template_id UUID REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
    template_version INT NOT NULL DEFAULT 1,
    title VARCHAR(255) NOT NULL,
    certificate_type VARCHAR(50) NOT NULL DEFAULT 'participation',
    issuance_source VARCHAR(50) NOT NULL DEFAULT 'event' CHECK (issuance_source IN ('event', 'team', 'manual', 'csv')),
    total_recipients INT NOT NULL DEFAULT 0,
    successful_count INT NOT NULL DEFAULT 0,
    failed_count INT NOT NULL DEFAULT 0,
    status VARCHAR(30) NOT NULL DEFAULT 'completed' CHECK (status IN (
        'draft', 'validating', 'queued', 'processing', 'completed', 'partially_completed', 'partially_failed', 'failed', 'cancelled'
    )),
    error_log JSONB DEFAULT '[]'::jsonb,
    batch_payload JSONB DEFAULT '{}'::jsonb,
    idempotency_key VARCHAR(128),
    issued_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cert_batches_club ON public.certificate_batches(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_batches_event ON public.certificate_batches(event_id);
CREATE INDEX IF NOT EXISTS idx_cert_batches_status ON public.certificate_batches(status);

-- 3. Extend Existing club_certificates Table
ALTER TABLE public.club_certificates
    ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.certificate_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS template_version INT DEFAULT 1,
    ADD COLUMN IF NOT EXISTS batch_id UUID REFERENCES public.certificate_batches(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.club_teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS design_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS recipient_snapshot JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS pdf_url TEXT,
    ADD COLUMN IF NOT EXISTS preview_url TEXT,
    ADD COLUMN IF NOT EXISTS sha256_hash VARCHAR(64),
    ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS revocation_reason TEXT,
    ADD COLUMN IF NOT EXISTS revoked_by_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS verification_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_club_certificates_template ON public.club_certificates(template_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_batch ON public.club_certificates(batch_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_team ON public.club_certificates(team_id);
CREATE INDEX IF NOT EXISTS idx_club_certificates_revoked ON public.club_certificates(is_revoked);
CREATE INDEX IF NOT EXISTS idx_club_certificates_sha ON public.club_certificates(sha256_hash);

-- 4. Relax Legacy Check Constraint for Extended Award Categories
ALTER TABLE public.club_certificates DROP CONSTRAINT IF EXISTS club_certificates_certificate_type_check;

-- 5. Certificate Audit Logs Table (Phase 17)
CREATE TABLE IF NOT EXISTS public.certificate_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    club_id UUID REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_cert_audit_club ON public.certificate_audit_logs(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cert_audit_entity ON public.certificate_audit_logs(entity_type, entity_id);
