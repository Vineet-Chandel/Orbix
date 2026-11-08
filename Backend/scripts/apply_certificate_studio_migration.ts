import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyCertificateMigration() {
    try {
        console.log("Applying Migration 037 (Certificate Studio Ecosystem)...");
        const migPath037 = path.join(__dirname, "..", "src", "database", "migrations", "037_certificate_studio_ecosystem.sql");
        const sql037 = fs.readFileSync(migPath037, "utf-8");
        await query(sql037);
        console.log("✅ 037_certificate_studio_ecosystem.sql applied successfully!");

        // Drop legacy check constraint if present so all certificate categories are supported
        console.log("Relaxing certificate_type constraint on club_certificates...");
        await query(`
            ALTER TABLE public.club_certificates DROP CONSTRAINT IF EXISTS club_certificates_certificate_type_check;
        `);
        console.log("✅ Check constraint relaxed for extended award categories!");

        // Create Certificate Audit Logs table (Phase 17)
        console.log("Ensuring certificate_audit_logs table exists...");
        await query(`
            CREATE TABLE IF NOT EXISTS public.certificate_audit_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                club_id UUID REFERENCES public.verified_clubs(id) ON DELETE CASCADE,
                actor_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
                action VARCHAR(100) NOT NULL,
                entity_type VARCHAR(50) NOT NULL,
                entity_id VARCHAR(100),
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_cert_audit_club ON public.certificate_audit_logs(club_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_cert_audit_entity ON public.certificate_audit_logs(entity_type, entity_id);
        `);
        console.log("✅ certificate_audit_logs table verified!");

        // Support External Recipient Claims (Phase 11)
        console.log("Supporting external recipient verified claims on club_certificates...");
        await query(`
            ALTER TABLE public.club_certificates ALTER COLUMN user_id DROP NOT NULL;
            ALTER TABLE public.club_certificates ADD COLUMN IF NOT EXISTS claim_token VARCHAR(128);
            ALTER TABLE public.club_certificates ADD COLUMN IF NOT EXISTS claim_status VARCHAR(30) DEFAULT 'claimed';
            ALTER TABLE public.club_certificates ADD COLUMN IF NOT EXISTS claim_expires_at TIMESTAMPTZ;
            CREATE INDEX IF NOT EXISTS idx_club_certificates_claim_token ON public.club_certificates(claim_token);
        `);
        console.log("✅ External recipient claim columns and indexes applied!");

        process.exit(0);
    } catch (err: any) {
        console.error("Migration failed:", err.message);
        process.exit(1);
    }
}

applyCertificateMigration();
