import { query } from "../src/database/client.js";

export async function applyPhase16Migration() {
    console.log("Applying Phase 16: Verification, Revocation, Superseding & Wallet Migration...");

    // 1. Add Phase 16 columns to club_certificates
    await query(`
        ALTER TABLE public.club_certificates
        ADD COLUMN IF NOT EXISTS status VARCHAR(30) DEFAULT 'valid',
        ADD COLUMN IF NOT EXISTS superseded_by_id UUID REFERENCES public.club_certificates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS reissued_from_id UUID REFERENCES public.club_certificates(id) ON DELETE SET NULL,
        ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS kms_key_id VARCHAR(255),
        ADD COLUMN IF NOT EXISTS kms_signature TEXT,
        ADD COLUMN IF NOT EXISTS digital_signature_algorithm VARCHAR(100);
    `);

    // 2. Synchronize existing is_revoked flags with status column
    await query(`
        UPDATE public.club_certificates
        SET status = 'revoked'
        WHERE is_revoked = true AND (status IS NULL OR status = 'valid');
    `);

    // 3. Create performance indexes and update uniqueness to support reissuing/superseded versions
    await query(`
        CREATE INDEX IF NOT EXISTS idx_club_certs_user_status ON public.club_certificates (user_id, status);
        CREATE INDEX IF NOT EXISTS idx_club_certs_team_status ON public.club_certificates (team_id, status);
        CREATE INDEX IF NOT EXISTS idx_club_certs_superseded_by ON public.club_certificates (superseded_by_id);
        CREATE INDEX IF NOT EXISTS idx_club_certs_reissued_from ON public.club_certificates (reissued_from_id);
        CREATE INDEX IF NOT EXISTS idx_club_certs_version ON public.club_certificates (version);

        -- Uniqueness scoped by version to support reissuing/superseded versions (Phase 16 & 17)
        DROP INDEX IF EXISTS unique_club_user_cert_idx;
        CREATE UNIQUE INDEX IF NOT EXISTS unique_club_user_cert_idx 
        ON public.club_certificates (club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title, version);

        DROP INDEX IF EXISTS unique_club_team_cert_idx;
        CREATE UNIQUE INDEX IF NOT EXISTS unique_club_team_cert_idx 
        ON public.club_certificates (club_id, team_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title) 
        WHERE (team_id IS NOT NULL AND user_id IS NULL AND claim_token IS NULL);
    `);

    console.log("✅ Phase 16 Database Migration successfully applied.");
}

// Direct execution support
if (process.argv[1]?.endsWith("apply_phase_16_verification_wallet_migration.ts")) {
    applyPhase16Migration()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Migration failed:", err);
            process.exit(1);
        });
}
