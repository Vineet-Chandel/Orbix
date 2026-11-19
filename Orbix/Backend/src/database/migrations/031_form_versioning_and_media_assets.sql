-- Migration 031: Form Versioning, Concurrency, and Media Assets
-- Adds immutable form snapshots, optimistic concurrency control, media asset tracking, and idempotency protection

-- 1. Add versioning and draft control columns to club_event_forms
ALTER TABLE public.club_event_forms
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS current_draft_version_id UUID,
    ADD COLUMN IF NOT EXISTS published_version_id UUID,
    ADD COLUMN IF NOT EXISTS default_settings JSONB NOT NULL DEFAULT '{
        "isOpen": true,
        "closedMessage": "Registrations are currently closed for this event.",
        "maxResponses": null,
        "limitOneResponse": true,
        "allowEditResponse": false,
        "requireLogin": true,
        "showProgressBar": true,
        "confirmationMessage": "Your registration has been submitted successfully!",
        "notifyOnRegistration": true
    }'::jsonb,
    ADD COLUMN IF NOT EXISTS version_count INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- 2. Create club_event_form_versions (Immutable published and draft snapshots)
CREATE TABLE IF NOT EXISTS public.club_event_form_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.club_event_forms(id) ON DELETE CASCADE,
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    header_image_url TEXT,
    header_image_public_id TEXT,
    structure JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    theme_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
    change_summary TEXT,
    is_published BOOLEAN NOT NULL DEFAULT false,
    published_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMPTZ,
    CONSTRAINT unique_form_version UNIQUE (form_id, version_number)
);

CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_form
    ON public.club_event_form_versions(form_id);
CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_event
    ON public.club_event_form_versions(event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_form_versions_published
    ON public.club_event_form_versions(form_id, is_published);

-- 3. Extend club_event_registrations with form_version_id, idempotency_key, and last_updated_at
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS form_version_id UUID REFERENCES public.club_event_form_versions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS answers JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
    ADD COLUMN IF NOT EXISTS last_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_club_event_registrations_version
    ON public.club_event_registrations(form_version_id);
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_idempotency
    ON public.club_event_registrations(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_club_event_registrations_event_user
    ON public.club_event_registrations(event_id, user_id);

-- 4. Create club_form_media_assets table
CREATE TABLE IF NOT EXISTS public.club_form_media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID REFERENCES public.club_event_forms(id) ON DELETE CASCADE,
    event_id UUID REFERENCES public.club_events(id) ON DELETE CASCADE,
    uploader_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    public_id TEXT NOT NULL UNIQUE,
    secure_url TEXT NOT NULL,
    resource_type TEXT NOT NULL DEFAULT 'image',
    format TEXT,
    bytes INT,
    width INT,
    height INT,
    asset_purpose TEXT NOT NULL DEFAULT 'question_image',
    question_id TEXT,
    response_id UUID REFERENCES public.club_event_registrations(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_form
    ON public.club_form_media_assets(form_id);
CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_event
    ON public.club_form_media_assets(event_id);
CREATE INDEX IF NOT EXISTS idx_club_form_media_assets_response
    ON public.club_form_media_assets(response_id);
