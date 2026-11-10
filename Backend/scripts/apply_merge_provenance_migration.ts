import fs from "fs";
import path from "path";
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";

async function applyMigration() {
    console.log("Applying Migration 041: Field-Level Provenance & Non-Destructive Data Merge Engine...");
    const migrationPath = path.resolve("./src/database/migrations/041_project_merge_provenance.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    await query(sql);
    console.log("✅ Migration 041 applied successfully!");

    // Verify columns exist
    const colCheck = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_projects' 
        AND column_name IN (
            'raw_extracted_data', 
            'field_overrides', 
            'last_synced_at', 
            'sync_metadata'
        );
    `);

    console.log("Verified new columns in user_projects:", colCheck.rows.map((r: any) => r.column_name));
    process.exit(0);
}

applyMigration().catch((err) => {
    console.error("Migration 041 failed:", err);
    process.exit(1);
});
