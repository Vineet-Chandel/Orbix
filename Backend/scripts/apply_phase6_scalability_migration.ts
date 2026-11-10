import fs from "fs";
import path from "path";
if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";

async function applyPhase6Migration() {
    console.log("Applying Migration 042: Scalable Project Showcase Entity, Atomic Lock & Row Level Security...");
    const migrationPath = path.resolve("./src/database/migrations/042_project_showcase_scalability_rls.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    await query(sql);
    console.log("✅ Migration 042 applied successfully!");

    // Verify columns exist
    const colCheck = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_projects' 
        AND column_name IN (
            'short_description',
            'repository_provider',
            'repository_owner',
            'repository_visibility',
            'repository_metadata',
            'extraction_status',
            'extraction_completeness',
            'show_on_profile',
            'repository_link_visibility'
        );
    `);

    console.log("Verified Phase 6 columns in user_projects:", colCheck.rows.map((r: any) => r.column_name));

    // Verify RLS is enabled
    const rlsCheck = await query(`
        SELECT relname, relrowsecurity 
        FROM pg_class 
        WHERE relname IN ('user_projects', 'user_github_installations');
    `);
    console.log("Verified Row Level Security status:", rlsCheck.rows);

    process.exit(0);
}

applyPhase6Migration().catch((err) => {
    console.error("Migration 042 failed:", err);
    process.exit(1);
});
