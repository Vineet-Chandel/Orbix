-- 032_form_quiz_and_settings_engine.sql
-- Add quiz scoring, grading, and settings engine columns to club_event_registrations

ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS quiz_score NUMERIC(7,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS quiz_max_score NUMERIC(7,2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS quiz_graded_answers JSONB DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS quiz_grades_released BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_club_event_registrations_quiz_score
    ON public.club_event_registrations(quiz_score) WHERE quiz_score IS NOT NULL;
