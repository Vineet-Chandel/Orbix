import fs from "fs";
import path from "path";
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";

async function applyMigration() {
    console.log("Applying Migration 040: Dynamic Project Creation Form Fields...");
    const migrationPath = path.resolve("./src/database/migrations/040_dynamic_project_form_fields.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    await query(sql);
    console.log("✅ Migration 040 applied successfully!");

    // Verify columns exist
    const colCheck = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_projects' 
        AND column_name IN (
            'project_type', 
            'development_status', 
            'full_overview', 
            'story', 
            'categorized_technologies', 
            'contribution', 
            'additional_details', 
            'api_doc_url', 
            'figma_url'
        );
    `);

    console.log("Verified new columns in user_projects:", colCheck.rows.map((r: any) => r.column_name));
    process.exit(0);
}

applyMigration().catch((err) => {
    console.error("Migration 040 failed:", err);
    process.exit(1);
});
