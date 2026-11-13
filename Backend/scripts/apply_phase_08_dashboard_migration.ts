import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import fs from "fs";
import { pool } from "../src/database/client.js";

async function run() {
    console.log("Applying Migration 049: Workspace Dashboard, Activity Feed & Search...");
    const migrationPath = path.resolve(__dirname, "../src/database/migrations/049_workspace_dashboard_activity_and_search.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query(sql);
        await client.query("COMMIT;");
        console.log("✅ Migration 049 applied successfully!");
    } catch (err) {
        await client.query("ROLLBACK;");
        console.error("❌ Migration 049 failed:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
