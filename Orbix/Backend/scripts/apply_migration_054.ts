// Backend/scripts/apply_migration_054.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        console.log("Applying Migration 054: Workspace Recognition Security, Ledger Immutability & Budget Integrity...");
        const migrationPath = path.join(__dirname, "../src/database/migrations/054_workspace_recognition_security_and_immutability.sql");
        const sql = fs.readFileSync(migrationPath, "utf-8");
        await query(sql);
        console.log("✅ Migration 054 applied successfully!");

        // Verify triggers and constraints
        const triggerRes = await query(
            `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_guard_recognition_ledger_immutability';`
        );
        console.log("Verified triggers:", triggerRes.rows);

        const constraintRes = await query(
            `SELECT conname FROM pg_constraint WHERE conname IN ('chk_used_budget_lte_allocated', 'chk_points_delta_type');`
        );
        console.log("Verified constraints:", constraintRes.rows.map(r => r.conname));

        await pool.end();
        process.exit(0);
    } catch (err: any) {
        console.error("Migration 054 execution failed:", err);
        await pool.end();
        process.exit(1);
    }
}

run();
