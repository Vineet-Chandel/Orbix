// Backend/scripts/apply_phase_02_recognition_migration.ts
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query, pool } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    try {
        console.log("Applying Migration 051: Orbix Recognition & Immutable Orbits Ledger...");
        const migrationPath = path.join(__dirname, "../src/database/migrations/051_workspace_recognition_and_orbits_ledger.sql");
        const sql = fs.readFileSync(migrationPath, "utf-8");
        await query(sql);
        console.log("✅ Migration 051 applied successfully!");

        // Verify tables exist
        const tablesRes = await query(
            `SELECT table_name FROM information_schema.tables 
             WHERE table_schema = 'public' 
               AND table_name IN (
                 'workspace_recognition_policies',
                 'workspace_recognition_categories',
                 'workspace_recognition_budgets',
                 'workspace_recognition_ledger',
                 'workspace_recognition_period_aggregates'
               );`
        );
        console.log("Verified Recognition Tables created in PostgreSQL:", tablesRes.rows.map(r => r.table_name));

        if (tablesRes.rows.length !== 5) {
            throw new Error(`Expected 5 recognition tables, found ${tablesRes.rows.length}`);
        }

        console.log("All Phase 02 Recognition tables verified in database.");
        await pool.end();
        process.exit(0);
    } catch (err: any) {
        console.error("Migration 051 execution failed:", err);
        await pool.end();
        process.exit(1);
    }
}

run();
