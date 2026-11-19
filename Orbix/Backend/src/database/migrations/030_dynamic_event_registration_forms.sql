-- Migration 030: Dynamic Event Registration Form Builder
-- Adds support for Google Forms-level dynamic forms for club events

-- 1. Create club_event_forms table
CREATE TABLE IF NOT EXISTS public.club_event_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    club_id UUID NOT NULL REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    header_image_url TEXT,
    header_image_public_id TEXT,
    theme_settings JSONB NOT NULL DEFAULT '{
        "accentColor": "#38BDF8",
        "fontFamily": "sans",
        "headerPosition": "center"
    }'::jsonb,
    settings JSONB NOT NULL DEFAULT '{
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
    structure JSONB NOT NULL DEFAULT '{"sections": []}'::jsonb,
    is_published BOOLEAN NOT NULL DEFAULT true,
    schema_version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_event_form UNIQUE (event_id)
);

CREATE INDEX IF NOT EXISTS idx_club_event_forms_event 
    ON public.club_event_forms(event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_forms_club 
    ON public.club_event_forms(club_id);

-- 2. Extend club_event_registrations with form references and attachments
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS form_id UUID REFERENCES public.club_event_forms(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS form_response JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS file_attachments JSONB DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_club_event_registrations_form 
    ON public.club_event_registrations(form_id);
