-- Migration 066: Add sponsors jsonb column to club_events
ALTER TABLE public.club_events
ADD COLUMN IF NOT EXISTS sponsors JSONB NOT NULL DEFAULT '[]'::jsonb;
