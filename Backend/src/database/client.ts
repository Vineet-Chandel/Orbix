import 'dotenv/config';
import pg from "pg";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
}

export const pool = new Pool({
    connectionString: DATABASE_URL,
});

export const testDatabaseConnection = async () => {
    try {
        const result = await pool.query("SELECT NOW()");

        console.log("✅ Neon DB connected");
        console.log("Database time:", result.rows[0].now);
    } catch (error) {
        console.error("❌ Neon DB connection failed:", error);
        throw error;
    }
};

export const query = (
    text: string,
    params?: unknown[]
) => {
    return pool.query(text, params);
};