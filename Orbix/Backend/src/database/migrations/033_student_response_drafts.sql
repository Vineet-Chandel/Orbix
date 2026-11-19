-- Migration 033: Student Response Drafts and Autosave Engine
-- Persists unfinished student registration drafts with debounced autosaving,
-- tied to the student, event, and published form version snapshot.

CREATE TABLE IF NOT EXISTS public.club_event_response_drafts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.club_events(id) ON DELETE CASCADE,
    form_id UUID REFERENCES public.club_event_forms(id) ON DELETE CASCADE,
    form_version_id UUID REFERENCES public.club_event_form_versions(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    answers JSONB NOT NULL DEFAULT '{}'::jsonb,
    file_attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_section_index INT NOT NULL DEFAULT 0,
    section_history JSONB NOT NULL DEFAULT '[0]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_event_draft UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_event_response_drafts_user_event
    ON public.club_event_response_drafts(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_club_event_response_drafts_event_version
    ON public.club_event_response_drafts(event_id, form_version_id);
