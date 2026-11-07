-- Migration 031: Production-Conscious College Verification Schema
-- Establish authentic institutional enrollment via OCR-assisted document inspection,
-- institutional email verification, phone OTP, and mandatory founder review.

-- 1. Create college_verifications table
CREATE TABLE IF NOT EXISTS public.college_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    college_id UUID NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('NOT_VERIFIED', 'PENDING', 'PROCESSING', 'APPROVED', 'REJECTED', 'INVALIDATED')
    ),
    document_type VARCHAR(50) NOT NULL, -- 'student_id', 'erp_profile', 'student_id_both_sides'
    document_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
    extracted_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    student_name VARCHAR(255) NULL,
    enrollment_number VARCHAR(100) NULL,
    course_name VARCHAR(255) NULL,
    academic_year VARCHAR(100) NULL,
    institution_email VARCHAR(255) NULL,
    email_verified_at TIMESTAMPTZ NULL,
    phone_number VARCHAR(30) NULL,
    phone_verified_at TIMESTAMPTZ NULL,
    ocr_confidence NUMERIC(5,2) DEFAULT 0.00,
    reviewed_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    reviewer_notes TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Partial Unique Indexes for Verification Invariants
-- Invariant 1: Exactly one active (pending or processing) submission per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_college_verifications_active_user 
    ON public.college_verifications(user_id) 
    WHERE status IN ('PENDING', 'PROCESSING');

-- Invariant 2: Exactly one approved verification per user at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_college_verifications_approved_user 
    ON public.college_verifications(user_id) 
    WHERE status = 'APPROVED';

-- General performance indexes
CREATE INDEX IF NOT EXISTS idx_college_verifications_user ON public.college_verifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_college_verifications_college ON public.college_verifications(college_id);
CREATE INDEX IF NOT EXISTS idx_college_verifications_status_created ON public.college_verifications(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_college_verifications_enrollment ON public.college_verifications(enrollment_number) WHERE enrollment_number IS NOT NULL;

-- 2. Institutional Email Verification Tokens Table
CREATE TABLE IF NOT EXISTS public.college_verification_email_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NULL REFERENCES public.college_verifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    institution_email VARCHAR(255) NOT NULL,
    token_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_col_verif_email_tokens_hash ON public.college_verification_email_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_col_verif_email_tokens_user ON public.college_verification_email_tokens(user_id, status);

-- 3. Dedicated College Verification Phone OTPs Table
CREATE TABLE IF NOT EXISTS public.college_verification_phone_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_id UUID NULL REFERENCES public.college_verifications(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    phone VARCHAR(30) NOT NULL,
    otp_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
    attempts INT DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_col_verif_phone_otps_user ON public.college_verification_phone_otps(user_id, status);
CREATE INDEX IF NOT EXISTS idx_col_verif_phone_otps_phone ON public.college_verification_phone_otps(phone, status);

-- 4. Extend users table with direct cache columns
ALTER TABLE public.users 
    ADD COLUMN IF NOT EXISTS is_college_verified BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS college_verified_at TIMESTAMPTZ NULL;
