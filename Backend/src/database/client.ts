
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
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
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
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
            CREATE INDEX IF NOT EXISTS idx_users_lower_username ON users(LOWER(username));
            CREATE INDEX IF NOT EXISTS idx_users_orbix_score ON users(orbix_score DESC, username ASC);
            CREATE INDEX IF NOT EXISTS idx_users_is_public ON users(is_public);

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
            CREATE INDEX IF NOT EXISTS idx_users_college_id ON users (college_id);
            ALTER TABLE leaderboard_entries ADD COLUMN IF NOT EXISTS college_id UUID;
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

