-- Migration 027_club_category_cooldown.sql
-- Add category_updated_at to enforce 4-hour cooldown on club category changes

ALTER TABLE public.verified_clubs 
    ADD COLUMN IF NOT EXISTS category_updated_at TIMESTAMPTZ;
