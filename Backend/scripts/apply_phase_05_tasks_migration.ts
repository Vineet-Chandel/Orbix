import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import fs from "fs";
import { pool } from "../src/database/client.js";

async function run() {
    console.log("Applying Migration 046: Team Workspace Task Management System...");
    const migrationPath = path.resolve(__dirname, "../src/database/migrations/046_workspace_task_management_system.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query(sql);
        await client.query("COMMIT;");
        console.log("✅ Migration 046 applied successfully!");
    } catch (err) {
        await client.query("ROLLBACK;");
        console.error("❌ Migration 046 failed:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
