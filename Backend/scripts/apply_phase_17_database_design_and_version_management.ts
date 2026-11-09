import { query } from "../src/database/client.js";

async function applyPhase17Migration() {
    console.log("=== PHASE 17: DATABASE DESIGN AND VERSION MANAGEMENT MIGRATION ===");

    // 1. Extend club_certificates (CertificateIssue entity)
    console.log("1. Extending club_certificates with recipient_type and integrity constraints...");
    
    // Add recipient_type column if not exists
    await query(`
        ALTER TABLE public.club_certificates 
        ADD COLUMN IF NOT EXISTS recipient_type VARCHAR(32) DEFAULT 'individual';
    `);

    // Backfill recipient_type for existing records
    await query(`
        UPDATE public.club_certificates
        SET recipient_type = 'team'
        WHERE team_id IS NOT NULL AND user_id IS NULL AND (claim_token IS NULL OR claim_token = '');
    `);

    await query(`
        UPDATE public.club_certificates
        SET recipient_type = 'external'
        WHERE (claim_token IS NOT NULL AND claim_token != '') 
           OR (user_id IS NULL AND team_id IS NULL);
    `);

    await query(`
        UPDATE public.club_certificates
        SET recipient_type = 'individual'
        WHERE user_id IS NOT NULL;
    `);

    // Add CHECK constraint on recipient_type
    await query(`
        ALTER TABLE public.club_certificates
        DROP CONSTRAINT IF EXISTS club_certificates_recipient_type_check;
        ALTER TABLE public.club_certificates
        ADD CONSTRAINT club_certificates_recipient_type_check
        CHECK (recipient_type IN ('individual', 'team', 'external'));
    `);

    // Standardize null/empty status
    await query(`
        UPDATE public.club_certificates
        SET status = CASE 
            WHEN is_revoked = true THEN 'revoked'
            WHEN superseded_by_id IS NOT NULL THEN 'superseded'
            ELSE 'valid'
        END
        WHERE status IS NULL OR status = '';
    `);

    // Add CHECK constraint on status
    await query(`
        ALTER TABLE public.club_certificates
        DROP CONSTRAINT IF EXISTS club_certificates_status_check;
        ALTER TABLE public.club_certificates
        ADD CONSTRAINT club_certificates_status_check
        CHECK (status IN ('valid', 'revoked', 'superseded'));
    `);

    // Standardize claim_status
    await query(`
        UPDATE public.club_certificates
        SET claim_status = 'claimed'
        WHERE claim_status IS NULL OR claim_status = '';
    `);

    await query(`
        ALTER TABLE public.club_certificates
        DROP CONSTRAINT IF EXISTS club_certificates_claim_status_check;
        ALTER TABLE public.club_certificates
        ADD CONSTRAINT club_certificates_claim_status_check
        CHECK (claim_status IN ('claimed', 'pending_claim', 'expired', 'revoked'));
    `);

    // Add CHECK constraint on version
    await query(`
        UPDATE public.club_certificates
        SET version = 1
        WHERE version IS NULL OR version < 1;
    `);

    await query(`
        ALTER TABLE public.club_certificates
        DROP CONSTRAINT IF EXISTS club_certificates_version_check;
        ALTER TABLE public.club_certificates
        ADD CONSTRAINT club_certificates_version_check
        CHECK (version >= 1);
    `);

    // Indexes on club_certificates
    await query(`
        CREATE INDEX IF NOT EXISTS idx_club_certs_recipient_type 
        ON public.club_certificates (recipient_type);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_club_certs_club_status 
        ON public.club_certificates (club_id, status, issue_date DESC);
    `);

    // 2. Extend certificate_batches (CertificateBatch entity)
    console.log("2. Extending certificate_batches constraints and indexes...");
    
    await query(`
        ALTER TABLE public.certificate_batches
        DROP CONSTRAINT IF EXISTS certificate_batches_counts_check;
        ALTER TABLE public.certificate_batches
        ADD CONSTRAINT certificate_batches_counts_check
        CHECK (total_recipients >= 0 AND successful_count >= 0 AND failed_count >= 0 AND template_version >= 1);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_cert_batches_club_status
        ON public.certificate_batches (club_id, status, created_at DESC);
    `);

    // 3. Extend certificate_templates (CertificateTemplate entity)
    console.log("3. Extending certificate_templates constraints and indexes...");

    await query(`
        ALTER TABLE public.certificate_templates
        DROP CONSTRAINT IF EXISTS certificate_templates_dimensions_check;
        ALTER TABLE public.certificate_templates
        ADD CONSTRAINT certificate_templates_dimensions_check
        CHECK (page_width > 0 AND page_height > 0 AND version >= 1);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_cert_templates_club_version
        ON public.certificate_templates (club_id, version);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_cert_templates_name_version
        ON public.certificate_templates (club_id, name, version);
    `);

    // 4. Extend certificate_audit_logs (CertificateAuditLog entity)
    console.log("4. Extending certificate_audit_logs indexes...");

    await query(`
        CREATE INDEX IF NOT EXISTS idx_cert_audit_actor
        ON public.certificate_audit_logs (actor_user_id, created_at DESC);
    `);

    await query(`
        CREATE INDEX IF NOT EXISTS idx_cert_audit_action
        ON public.certificate_audit_logs (action, created_at DESC);
    `);

    console.log("✅ Phase 17 Database Migration applied successfully!");
    process.exit(0);
}

applyPhase17Migration().catch(e => {
    console.error("Migration failed:", e);
    process.exit(1);
});
