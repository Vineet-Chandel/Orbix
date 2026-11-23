-- Provider-owned evidence; OCR and email ownership cannot approve enrollment.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS sheerid_organization_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS institutions_sheerid_org ON institutions(sheerid_organization_id) WHERE sheerid_organization_id IS NOT NULL;
ALTER TABLE college_verifications
 ADD COLUMN IF NOT EXISTS provider TEXT,
 ADD COLUMN IF NOT EXISTS provider_verification_id TEXT,
 ADD COLUMN IF NOT EXISTS provider_program_id TEXT,
 ADD COLUMN IF NOT EXISTS provider_institution_id TEXT,
 ADD COLUMN IF NOT EXISTS provider_step TEXT,
 ADD COLUMN IF NOT EXISTS provider_checked_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS consented_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ,
 ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS college_provider_session ON college_verifications(provider_verification_id) WHERE provider_verification_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS college_verification_expiry ON college_verifications(expires_at) WHERE status = 'APPROVED';
CREATE TABLE IF NOT EXISTS college_verification_events (
 id BIGSERIAL PRIMARY KEY,
 verification_id UUID NOT NULL REFERENCES college_verifications(id) ON DELETE CASCADE,
 event_key TEXT NOT NULL UNIQUE,
 status TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Existing approvals retain a bounded renewal window. Pending legacy uploads need a new session.
UPDATE college_verifications SET verified_at = COALESCE(reviewed_at, updated_at),
 expires_at = COALESCE(reviewed_at, updated_at) + interval '1 year'
 WHERE status = 'APPROVED' AND expires_at IS NULL;
UPDATE college_verifications SET status = 'INVALIDATED', rejection_reason = 'Please restart using the new enrollment verification flow.', updated_at = now()
 WHERE provider IS NULL AND status IN ('PENDING', 'PROCESSING');
UPDATE users u SET is_college_verified = false, college_verified_at = NULL
 WHERE is_college_verified AND NOT EXISTS (
 SELECT 1 FROM college_verifications v WHERE v.user_id = u.id AND v.college_id = u.college_id AND v.status = 'APPROVED' AND v.expires_at > now());
