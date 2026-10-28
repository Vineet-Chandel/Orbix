-- =========================================================================
-- Migration 010: Firebase Phone Authentication & Verified Phone Uniqueness
-- =========================================================================

-- 1. Ensure phone and phone_confirmed_at exist on public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_confirmed_at TIMESTAMPTZ NULL;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;

-- 2. Ensure verification status flags on club_verification_requests
ALTER TABLE public.club_verification_requests ADD COLUMN IF NOT EXISTS contact_phone TEXT NULL;
ALTER TABLE public.club_verification_requests ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
ALTER TABLE public.club_verification_requests ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;

-- 3. Add audit columns for Firebase verification tracking on phone_verification_otps
ALTER TABLE public.phone_verification_otps ADD COLUMN IF NOT EXISTS firebase_uid TEXT NULL;
ALTER TABLE public.phone_verification_otps ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'firebase';

-- 4. Create unique partial index on normalized phone numbers on users
-- Enforces one Orbix user account per verified phone number, avoiding collision
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique 
    ON public.users (LOWER(TRIM(phone))) 
    WHERE phone IS NOT NULL AND TRIM(phone) != '';

-- 5. Index for quick lookup on club verification requests by contact phone
CREATE INDEX IF NOT EXISTS idx_club_verification_contact_phone 
    ON public.club_verification_requests (contact_phone);

-- 6. Permissions
GRANT ALL ON TABLE public.phone_verification_otps TO postgres, authenticated, anon;
