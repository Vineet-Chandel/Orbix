import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import fs from "fs";
import { pool } from "../src/database/client.js";

async function run() {
    console.log("Applying Migration 048: Team Workspace Notifications, Outbox, and Resend...");
    const migrationPath = path.resolve(__dirname, "../src/database/migrations/048_workspace_notifications_outbox_and_resend.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query(sql);
        await client.query("COMMIT;");
        console.log("✅ Migration 048 applied successfully!");
    } catch (err) {
        await client.query("ROLLBACK;");
        console.error("❌ Migration 048 failed:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
