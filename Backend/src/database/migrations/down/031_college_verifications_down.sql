-- =========================================================================
-- Migration Down: 031_college_verifications_down.sql
-- Status: PREPARED FOR HUMAN REVIEW ONLY — DO NOT EXECUTE AUTOMATICALLY
-- Purpose: Safely rolls back Migration 031 schema objects in reverse dependency order
-- without generic cascading drops.
-- =========================================================================

BEGIN;

-- 1. Remove college verification tracking from public.schema_migrations
DELETE FROM public.schema_migrations WHERE version = '031_college_verifications.sql';

-- 2. Drop dependent child tables first (reverse order)
DROP TABLE IF EXISTS public.college_verification_phone_otps;
DROP TABLE IF EXISTS public.college_verification_email_tokens;

-- 3. Drop main college_verifications table
DROP TABLE IF EXISTS public.college_verifications;

-- 4. Revert cache columns added to users table
ALTER TABLE public.users DROP COLUMN IF EXISTS college_verified_at;
ALTER TABLE public.users DROP COLUMN IF EXISTS is_college_verified;

COMMIT;
