
import "dotenv/config";
import pg from "pg";
import { performance } from "node:perf_hooks";

const { Pool } = pg;

const DATABASE_URL = process.env.SUPABASE_DB_URL;

if (!DATABASE_URL) {
    throw new Error("SUPABASE_DB_URL is not configured");
}

export const pool = new Pool({
    connectionString: DATABASE_URL,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10,
    ssl: { rejectUnauthorized: false },
});

// Detect unexpected errors on idle pooled connections.
pool.on("error", (error) => {
    console.error(
        "Unexpected PostgreSQL pool error:",
        error
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
            CREATE INDEX IF NOT EXISTS idx_user_links_username ON user_links(username);
            CREATE INDEX IF NOT EXISTS idx_user_links_portal ON user_links(portal);

            -- Ensure user profile extension columns exist on users table
            ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_image_url TEXT;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(150);
            ALTER TABLE users ADD COLUMN IF NOT EXISTS skills JSONB DEFAULT '[]'::jsonb;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_public_id TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_url TEXT NULL;
            ALTER TABLE users ADD COLUMN IF NOT EXISTS previous_photo_public_id TEXT NULL;
            CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

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
        `);
        console.log("✅ Database schema verified for users & user_links profile and photo columns");
    } catch (error) {
        console.error(
            "❌ Supabase PostgreSQL connection failed:",
            error
        );
        throw error;
    }
};

export const query = (
    text: string,
    params?: any[]
) => {
    return pool.query(text, params);
};
