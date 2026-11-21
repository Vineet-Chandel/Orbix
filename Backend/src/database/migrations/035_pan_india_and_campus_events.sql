-- ============================================================
-- Migration 035: Pan India & Campus-Only Event Ecosystem
-- ============================================================
-- Adds event scope ('CAMPUS' vs 'PAN_INDIA') to club_events
-- and enriches club_event_registrations with institution snapshot
-- metadata for cross-college national events.
-- Idempotent: safe to run multiple times.
-- ============================================================

-- 1. Add scope column to club_events
ALTER TABLE public.club_events 
    ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'CAMPUS' 
    CHECK (scope IN ('CAMPUS', 'PAN_INDIA'));

-- Search & filter performance indexes for scope
CREATE INDEX IF NOT EXISTS idx_club_events_scope 
    ON public.club_events(scope);

CREATE INDEX IF NOT EXISTS idx_club_events_scope_status 
    ON public.club_events(scope, status);

-- 2. Add institution snapshot fields to club_event_registrations
ALTER TABLE public.club_event_registrations
    ADD COLUMN IF NOT EXISTS institution_id UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS institution_name VARCHAR(500),
    ADD COLUMN IF NOT EXISTS university_name VARCHAR(500),
    ADD COLUMN IF NOT EXISTS campus_name VARCHAR(255),
    ADD COLUMN IF NOT EXISTS institution_city VARCHAR(150),
    ADD COLUMN IF NOT EXISTS institution_state VARCHAR(100),
    ADD COLUMN IF NOT EXISTS institution_verification_status VARCHAR(50) DEFAULT 'unverified',
    ADD COLUMN IF NOT EXISTS is_unlisted_institution BOOLEAN DEFAULT false;

-- Indexes for organizer filtering & analytics aggregations
CREATE INDEX IF NOT EXISTS idx_club_event_reg_institution 
    ON public.club_event_registrations(institution_id);

CREATE INDEX IF NOT EXISTS idx_club_event_reg_state 
    ON public.club_event_registrations(institution_state);
