
import "dotenv/config";
import pg from "pg";
import { performance } from "node:perf_hooks";

const { Pool } = pg;

const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("SUPABASE_DB_URL (or DATABASE_URL) is not configured");
}

export const pool = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 60000,
    max: 20,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
    ssl: { rejectUnauthorized: false },
});

// Detect unexpected errors on idle pooled connections.
pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL pool error:",
        error.message || error
    );
});

export const testDatabaseConnection = async () => {
    const start = performance.now();

    try {
        const result = await pool.query("SELECT NOW()");

        const durationMs = performance.now() - start;

        console.log("✅ Supabase PostgreSQL connected");
        console.log(
            "Query round-trip:",
            `${durationMs.toFixed(2)} ms`
        );
        console.log(
            "Database time:",
            result.rows[0].now
        );

        // Ensure user_links table and profile columns exist
        await pool.query(`
            CREATE TABLE IF NOT EXISTS user_links (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100),
                portal VARCHAR(50) NOT NULL,
                portal_username VARCHAR(100) NOT NULL,
                link TEXT NOT NULL,
                raw_input TEXT,
                verified BOOLEAN DEFAULT true,
                display_name VARCHAR(150),
                avatar_url TEXT,
                stats JSONB DEFAULT '[]'::jsonb,
                is_public BOOLEAN DEFAULT true,
                last_sync_status VARCHAR(50) DEFAULT 'valid',
                last_sync_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_user_portal UNIQUE (username, portal)
            );
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS last_sync_status VARCHAR(50) DEFAULT 'valid';
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS last_error TEXT NULL;
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS snapshot JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE user_links ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
            CREATE INDEX IF NOT EXISTS idx_user_links_username ON user_links(username);
            CREATE INDEX IF NOT EXISTS idx_user_links_portal ON user_links(portal);
            CREATE INDEX IF NOT EXISTS idx_user_links_portal_handle ON user_links(portal, portal_username);

            -- Ensure user profile extension columns exist on users table
            ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png';
            ALTER TABLE users ALTER COLUMN avatar_url SET DEFAULT 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS github VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_link VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(150);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS links JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_public_id TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_url TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_public_id TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS college VARCHAR(255) DEFAULT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS college_updated_at TIMESTAMPTZ DEFAULT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS orbix_score INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS orbix_score_breakdown JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS orbix_score_version VARCHAR(20) DEFAULT 'v1.0.0';
            ALTER TABLE users ADD COLUMN IF NOT EXISTS orbix_score_updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_coder BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS streak INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS total_solved INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS total_contests INT DEFAULT 0;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS platform_ratings JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_open_to_work BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_hireable BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_url TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_public_id TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_filename VARCHAR(255) NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_filesize INT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_updated_at TIMESTAMPTZ NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_resume_public BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS resume_metadata JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255) NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email_operation_id UUID NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS username_updated_at TIMESTAMPTZ NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(30) NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_confirmed_at TIMESTAMPTZ NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN DEFAULT false;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ NULL;
            CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique ON users (LOWER(TRIM(phone))) WHERE phone IS NOT NULL AND TRIM(phone) != '';
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(LOWER(username));
            CREATE INDEX IF NOT EXISTS idx_users_orbix_score ON users(orbix_score DESC, username ASC);
            CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public);

            -- Enforce strict personal user verification rule: verified strictly when email is verified via OTP
            UPDATE users
            SET is_verified_coder = COALESCE(is_email_verified, false)
            WHERE account_type IS NULL OR account_type = 'personal';

            UPDATE leaderboard_entries le
            SET is_verified = COALESCE(u.is_email_verified, false)
            FROM users u
            WHERE le.user_id = u.id;

            -- Ensure email verification OTP audit table exists
            CREATE TABLE IF NOT EXISTS email_verification_otps (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                email VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(64) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                attempts INT DEFAULT 0,
                ip_address VARCHAR(45),
                user_agent TEXT,
                expires_at TIMESTAMPTZ NOT NULL,
                verified_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_otps(user_id, status);
            CREATE INDEX IF NOT EXISTS idx_email_verification_email ON email_verification_otps(email);

            -- Ensure Manage Accounts system tables exist
            CREATE TABLE IF NOT EXISTS account_change_operations (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                change_type VARCHAR(30) NOT NULL,
                current_value VARCHAR(255) NOT NULL,
                requested_value VARCHAR(255) NOT NULL,
                stage VARCHAR(50) NOT NULL,
                old_challenge_id UUID NULL,
                new_challenge_id UUID NULL,
                attempts INT DEFAULT 0,
                expires_at TIMESTAMPTZ NOT NULL,
                completed_at TIMESTAMPTZ NULL,
                cancelled_at TIMESTAMPTZ NULL,
                cancellation_reason TEXT NULL,
                metadata JSONB DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_account_change_ops_user_stage ON account_change_operations(user_id, stage);

            CREATE TABLE IF NOT EXISTS account_change_challenges (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                operation_id UUID NOT NULL REFERENCES account_change_operations(id) ON DELETE CASCADE,
                user_id UUID NOT NULL,
                challenge_type VARCHAR(50) NOT NULL,
                destination VARCHAR(255) NOT NULL,
                otp_hash VARCHAR(64) NOT NULL,
                status VARCHAR(20) DEFAULT 'pending',
                attempts INT DEFAULT 0,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                resend_count INT DEFAULT 0,
                last_resent_at TIMESTAMPTZ NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                consumed_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_account_change_challenges_op ON account_change_challenges(operation_id, status);

            CREATE TABLE IF NOT EXISTS account_change_history (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                operation_id UUID NULL UNIQUE,
                change_type VARCHAR(30) NOT NULL,
                old_value VARCHAR(255) NOT NULL,
                new_value VARCHAR(255) NOT NULL,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_account_change_history_monthly ON account_change_history(user_id, change_type, created_at DESC);

            CREATE TABLE IF NOT EXISTS account_data_exports (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL,
                export_id VARCHAR(64) UNIQUE NOT NULL,
                requested_categories TEXT[] NOT NULL DEFAULT '{}',
                sha256_checksum VARCHAR(64) NOT NULL,
                file_size_bytes INTEGER NOT NULL,
                record_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
                ip_address VARCHAR(45) NULL,
                user_agent TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '48 hours')
            );
            CREATE INDEX IF NOT EXISTS idx_account_data_exports_user ON account_data_exports(user_id, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_account_data_exports_export_id ON account_data_exports(export_id);

            -- Ensure resume upload intent tracking & cleanup queues exist
            CREATE TABLE IF NOT EXISTS resume_upload_intents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100),
                user_email VARCHAR(255),
                public_id TEXT NOT NULL UNIQUE,
                signature TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                folder TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_resume_upload_intents_public_id ON resume_upload_intents(public_id);
            CREATE INDEX IF NOT EXISTS idx_resume_upload_intents_user ON resume_upload_intents(username, status);

            CREATE TABLE IF NOT EXISTS resume_cleanup_queue (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                public_id TEXT NOT NULL,
                resource_type VARCHAR(20) NOT NULL DEFAULT 'raw',
                reason VARCHAR(50) NOT NULL,
                attempts INT NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                last_error TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_resume_cleanup_queue_status ON resume_cleanup_queue(status);

            -- =========================================================================
            -- Resume Intelligence: Document Uploads, Real Analyses & Consent-Based Sync
            -- =========================================================================
            CREATE TABLE IF NOT EXISTS resume_uploads (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                storage_reference TEXT NOT NULL,
                storage_provider VARCHAR(50) NOT NULL DEFAULT 'cloudinary',
                original_filename VARCHAR(255) NOT NULL,
                validated_mime_type VARCHAR(100) NOT NULL,
                file_size INT NOT NULL,
                checksum VARCHAR(64) NOT NULL,
                processing_status VARCHAR(50) NOT NULL DEFAULT 'uploaded',
                ai_consent_granted BOOLEAN DEFAULT false,
                ai_consent_timestamp TIMESTAMPTZ NULL,
                error_message TEXT NULL,
                retention_status VARCHAR(50) DEFAULT 'active',
                sync_review_status VARCHAR(50) DEFAULT 'pending',
                uploaded_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                analysis_completed_at TIMESTAMPTZ NULL
            );
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS storage_provider VARCHAR(50) DEFAULT 'cloudinary';
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS ai_consent_granted BOOLEAN DEFAULT false;
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS ai_consent_timestamp TIMESTAMPTZ NULL;
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS error_message TEXT NULL;
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS retention_status VARCHAR(50) DEFAULT 'active';
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS sync_review_status VARCHAR(50) DEFAULT 'pending';
            ALTER TABLE resume_uploads ADD COLUMN IF NOT EXISTS analysis_completed_at TIMESTAMPTZ NULL;
            CREATE INDEX IF NOT EXISTS idx_resume_uploads_username ON resume_uploads(username, uploaded_at DESC);
            CREATE INDEX IF NOT EXISTS idx_resume_uploads_checksum ON resume_uploads(checksum);
            CREATE INDEX IF NOT EXISTS idx_resume_uploads_sync ON resume_uploads(username, sync_review_status);

            CREATE TABLE IF NOT EXISTS resume_analyses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resume_upload_id UUID,
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                analyzer_version VARCHAR(50) NOT NULL DEFAULT 'v1.0-orbix-intelligence',
                model_identifier VARCHAR(100) NULL,
                extracted_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
                findings JSONB NOT NULL DEFAULT '[]'::jsonb,
                score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
                extraction_confidence_score NUMERIC(5,2) NOT NULL DEFAULT 0.00,
                profile_comparison JSONB NOT NULL DEFAULT '{}'::jsonb,
                analysis_status VARCHAR(50) NOT NULL DEFAULT 'completed',
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS resume_upload_id UUID;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS resume_id UUID;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS version_id UUID;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS model_identifier VARCHAR(100) NULL;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS extracted_fields JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS findings JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS score_breakdown JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS extraction_confidence_score NUMERIC(5,2) DEFAULT 0.00;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS profile_comparison JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS analysis_status VARCHAR(50) DEFAULT 'completed';
            CREATE INDEX IF NOT EXISTS idx_resume_analyses_upload ON resume_analyses(resume_upload_id);
            CREATE INDEX IF NOT EXISTS idx_resume_analyses_user ON resume_analyses(username, created_at DESC);

            CREATE TABLE IF NOT EXISTS resume_profile_sync_reviews (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resume_upload_id UUID,
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                review_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                proposed_changes JSONB NOT NULL DEFAULT '[]'::jsonb,
                selected_changes JSONB DEFAULT '[]'::jsonb,
                result_summary JSONB DEFAULT '{}'::jsonb,
                reviewed_at TIMESTAMPTZ NULL,
                synchronized_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE resume_profile_sync_reviews ADD COLUMN IF NOT EXISTS resume_upload_id UUID;
            ALTER TABLE resume_profile_sync_reviews ADD COLUMN IF NOT EXISTS proposed_changes JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE resume_profile_sync_reviews ADD COLUMN IF NOT EXISTS selected_changes JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE resume_profile_sync_reviews ADD COLUMN IF NOT EXISTS result_summary JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE resume_profile_sync_reviews ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending';
            CREATE INDEX IF NOT EXISTS idx_resume_sync_reviews_upload ON resume_profile_sync_reviews(resume_upload_id);
            CREATE INDEX IF NOT EXISTS idx_resume_sync_reviews_user ON resume_profile_sync_reviews(username, review_status);

            -- Ensure recruiter messages and notifications tables exist
            CREATE TABLE IF NOT EXISTS recruiter_messages (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                recipient_user_id UUID,
                recipient_username VARCHAR(100) NOT NULL,
                recipient_email VARCHAR(255),
                sender_name VARCHAR(150) NOT NULL,
                sender_email VARCHAR(255) NOT NULL,
                communication_email VARCHAR(255),
                company VARCHAR(200) NULL,
                message TEXT NOT NULL,
                status VARCHAR(50) DEFAULT 'delivered',
                is_read BOOLEAN DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE recruiter_messages ADD COLUMN IF NOT EXISTS communication_email VARCHAR(255);
            ALTER TABLE recruiter_messages ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'delivered';
            ALTER TABLE recruiter_messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP;
            CREATE INDEX IF NOT EXISTS idx_recruiter_messages_recipient ON recruiter_messages(recipient_username);
            CREATE INDEX IF NOT EXISTS idx_recruiter_messages_created_at ON recruiter_messages(created_at DESC);

            CREATE TABLE IF NOT EXISTS user_notifications (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                title VARCHAR(200) NOT NULL,
                body TEXT NOT NULL,
                type VARCHAR(50) DEFAULT 'hire_inquiry',
                metadata JSONB DEFAULT '{}'::jsonb,
                is_read BOOLEAN DEFAULT false,
                read_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ NULL;
            CREATE INDEX IF NOT EXISTS idx_user_notifications_username ON user_notifications(username, is_read);
            CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(username, is_read, created_at DESC);

            -- Resume Intelligence: Dedicated structured resumes, versions & real analyses
            CREATE TABLE IF NOT EXISTS user_resumes (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                title VARCHAR(255) NOT NULL DEFAULT 'My Developer Resume',
                target_role VARCHAR(255) DEFAULT 'Full Stack Engineer',
                template_id VARCHAR(50) DEFAULT 'ats_clean_single',
                content JSONB NOT NULL DEFAULT '{}'::jsonb,
                completeness_score INT DEFAULT 0,
                is_primary BOOLEAN DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_user_resumes_user ON user_resumes(username, is_primary);
            CREATE INDEX IF NOT EXISTS idx_user_resumes_updated ON user_resumes(updated_at DESC);

            CREATE TABLE IF NOT EXISTS resume_versions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resume_id UUID NOT NULL REFERENCES user_resumes(id) ON DELETE CASCADE,
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                version_number INT NOT NULL DEFAULT 1,
                version_label VARCHAR(100) NOT NULL DEFAULT 'Initial Draft',
                target_role VARCHAR(255),
                company_name VARCHAR(255),
                job_description TEXT,
                content JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE resume_versions ADD COLUMN IF NOT EXISTS resume_id UUID;
            CREATE INDEX IF NOT EXISTS idx_resume_versions_resume ON resume_versions(resume_id, version_number DESC);

            CREATE TABLE IF NOT EXISTS resume_analyses (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                resume_id UUID,
                version_id UUID,
                user_id UUID,
                username VARCHAR(100) NOT NULL,
                analyzer_version VARCHAR(50) NOT NULL DEFAULT 'v2.0-ats-strict',
                overall_score INT NOT NULL DEFAULT 0,
                score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
                findings JSONB NOT NULL DEFAULT '[]'::jsonb,
                checks_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
                job_match_report JSONB DEFAULT NULL,
                source_type VARCHAR(50) DEFAULT 'structured',
                source_filename VARCHAR(255),
                source_filesize INT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS resume_id UUID;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS version_id UUID;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS overall_score INT DEFAULT 0;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS checks_summary JSONB DEFAULT '{}'::jsonb;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS job_match_report JSONB DEFAULT NULL;
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS source_type VARCHAR(50) DEFAULT 'structured';
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS source_filename VARCHAR(255);
            ALTER TABLE resume_analyses ADD COLUMN IF NOT EXISTS source_filesize INT;
            CREATE INDEX IF NOT EXISTS idx_resume_analyses_user ON resume_analyses(username, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_resume_analyses_resume ON resume_analyses(resume_id, created_at DESC);

            -- Ensure leaderboard_entries precomputed projection table exists
            CREATE TABLE IF NOT EXISTS leaderboard_entries (
                user_id UUID PRIMARY KEY,
                username VARCHAR(100) NOT NULL UNIQUE,
                display_name VARCHAR(150) NOT NULL,
                avatar_url TEXT NULL,
                college VARCHAR(255) NULL,
                is_verified BOOLEAN DEFAULT false,
                score INT NOT NULL DEFAULT 0,
                score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
                total_solved INT NOT NULL DEFAULT 0,
                total_contests INT NOT NULL DEFAULT 0,
                platform_ratings JSONB NOT NULL DEFAULT '{}'::jsonb,
                streak INT NOT NULL DEFAULT 0,
                global_rank INT DEFAULT NULL,
                is_public BOOLEAN DEFAULT true,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_leaderboard_score_rank ON leaderboard_entries(score DESC, total_solved DESC, username ASC);
            CREATE INDEX IF NOT EXISTS idx_leaderboard_username ON leaderboard_entries(username);
            CREATE INDEX IF NOT EXISTS idx_leaderboard_global_rank ON leaderboard_entries(global_rank);
            CREATE INDEX IF NOT EXISTS idx_leaderboard_is_public ON leaderboard_entries(is_public);

            -- Ensure photo_upload_intents table exists for signed upload tracking and replay protection
            CREATE TABLE IF NOT EXISTS photo_upload_intents (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID,
                username VARCHAR(100),
                user_email VARCHAR(255),
                public_id TEXT NOT NULL UNIQUE,
                signature TEXT NOT NULL,
                timestamp BIGINT NOT NULL,
                folder TEXT NOT NULL,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_public_id ON photo_upload_intents(public_id);
            CREATE INDEX IF NOT EXISTS idx_photo_upload_intents_user ON photo_upload_intents(username, status);

            -- Ensure photo_cleanup_queue table exists for safe, retryable asset deletion
            CREATE TABLE IF NOT EXISTS photo_cleanup_queue (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                public_id TEXT NOT NULL,
                reason VARCHAR(50) NOT NULL,
                attempts INT NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'pending',
                last_error TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_photo_cleanup_queue_status ON photo_cleanup_queue(status);

            -- Verified Indian Institution Directory
            CREATE TABLE IF NOT EXISTS institutions (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                official_name VARCHAR(500) NOT NULL,
                normalized_name VARCHAR(500) NOT NULL,
                aliases TEXT[] DEFAULT '{}',
                aishe_code VARCHAR(50) UNIQUE,
                state VARCHAR(100),
                district VARCHAR(150),
                city VARCHAR(150),
                institution_type VARCHAR(100),
                website VARCHAR(500),
                verification_status VARCHAR(30) NOT NULL DEFAULT 'unverified',
                verification_basis TEXT,
                is_active BOOLEAN NOT NULL DEFAULT true,
                last_verified_at TIMESTAMPTZ,
                source_year VARCHAR(20),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_institutions_normalized_name ON institutions (normalized_name varchar_pattern_ops);
            CREATE INDEX IF NOT EXISTS idx_institutions_status_active ON institutions (verification_status, is_active) WHERE verification_status = 'verified' AND is_active = true;
            CREATE INDEX IF NOT EXISTS idx_institutions_state ON institutions (state);
            CREATE INDEX IF NOT EXISTS idx_institutions_aishe_code ON institutions (aishe_code) WHERE aishe_code IS NOT NULL;

            CREATE TABLE IF NOT EXISTS institution_regulatory_ids (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
                regulator VARCHAR(50) NOT NULL,
                identifier VARCHAR(100) NOT NULL,
                status VARCHAR(50),
                valid_from DATE,
                valid_until DATE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT unique_institution_regulator UNIQUE (institution_id, regulator, identifier)
            );
            CREATE INDEX IF NOT EXISTS idx_institution_regulatory_ids_institution ON institution_regulatory_ids (institution_id);

            CREATE TABLE IF NOT EXISTS institution_sources (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
                source_name VARCHAR(200) NOT NULL,
                source_url TEXT,
                source_record_id VARCHAR(100),
                source_publication_year VARCHAR(20),
                retrieval_date DATE NOT NULL DEFAULT CURRENT_DATE,
                verification_result VARCHAR(50) NOT NULL DEFAULT 'confirmed',
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_institution_sources_institution ON institution_sources (institution_id);

            CREATE TABLE IF NOT EXISTS institution_verification_requests (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                submitted_by_user_id UUID,
                submitted_by_username VARCHAR(100),
                institution_name VARCHAR(500) NOT NULL,
                institution_website VARCHAR(500),
                supporting_reference TEXT,
                status VARCHAR(30) NOT NULL DEFAULT 'pending',
                admin_notes TEXT,
                resolved_institution_id UUID REFERENCES institutions(id),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_verification_requests_status ON institution_verification_requests (status);
            CREATE INDEX IF NOT EXISTS idx_verification_requests_user ON institution_verification_requests (submitted_by_user_id);

            ALTER TABLE users ADD COLUMN IF NOT EXISTS college_id UUID;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS college_updated_at TIMESTAMPTZ DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_users_college_id ON users (college_id);
            ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS college_id UUID;
            CREATE INDEX IF NOT EXISTS idx_leaderboard_college_id ON leaderboard_entries (college_id);
            CREATE INDEX IF NOT EXISTS idx_leaderboard_college_score ON leaderboard_entries (college_id, score DESC, total_solved DESC, username ASC) WHERE is_public = true AND college_id IS NOT NULL;

            -- Relationship action logs for quota enforcement (20/day, 50/week)
            CREATE TABLE IF NOT EXISTS user_relationship_action_logs (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                target_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                action_type VARCHAR(30) NOT NULL CHECK (action_type IN ('request', 'block')),
                created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_type_time 
                ON user_relationship_action_logs(actor_id, action_type, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_rel_action_logs_actor_target 
                ON user_relationship_action_logs(actor_id, target_id, action_type, created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_rel_action_logs_created_at 
                ON user_relationship_action_logs(created_at);

            -- Optimized partial indexes for pending relationship queries
            CREATE INDEX IF NOT EXISTS idx_relationships_requested_by_pending 
                ON user_relationships(requested_by, created_at DESC) 
                WHERE status = 'pending';
            CREATE INDEX IF NOT EXISTS idx_relationships_low_pending 
                ON user_relationships(user_low_id, requested_by, created_at DESC) 
                WHERE status = 'pending';
            CREATE INDEX IF NOT EXISTS idx_relationships_high_pending 
                ON user_relationships(user_high_id, requested_by, created_at DESC) 
                WHERE status = 'pending';
        `);
        console.log("✅ Database schema verified for users, leaderboard_entries & user_links profile columns");
    } catch (error) {
        console.error(
            "❌ Supabase PostgreSQL connection failed:",
            error
        );
        throw error;
    }
};

const isRetryableError = (error: any): boolean => {
    if (!error) return false;
    const msg = String(error.message || "").toLowerCase();
    const code = String(error.code || "");
    return (
        msg.includes("timeout") ||
        msg.includes("connection terminated") ||
        msg.includes("connection reset") ||
        msg.includes("econnreset") ||
        msg.includes("etimedout") ||
        msg.includes("epipe") ||
        code === "57P01" || // admin_shutdown
        code === "57P02" || // crash_shutdown
        code === "57P03" || // cannot_connect_now
        code === "08006" || // connection_failure
        code === "08001" || // sqlclient_unable_to_establish_sqlconnection
        code === "08004"    // sqlserver_rejected_establishment_of_sqlconnection
    );
};

export const query = async (
    text: string,
    params?: any[],
    maxRetries = 2
): Promise<pg.QueryResult<any>> => {
    let attempt = 0;
    while (true) {
        try {
            return await pool.query(text, params);
        } catch (error: any) {
            attempt++;
            if (attempt <= maxRetries && isRetryableError(error)) {
                const delayMs = attempt * 500;
                console.warn(
                    `[Database] Transient query error (attempt ${attempt}/${maxRetries}): ${error.message}. Retrying in ${delayMs}ms...`
                );
                await new Promise((res) => setTimeout(res, delayMs));
                continue;
            }
            throw error;
        }
    }
};

