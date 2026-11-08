import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

import { query } from "../src/database/client.js";

async function applyMigration() {
    console.log("Applying Migration 039: Private Repository Support & Data Protection...");
    const migrationPath = path.resolve("./src/database/migrations/039_projects_private_repo_security.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    await query(sql);
    console.log("✅ Migration 039 applied successfully!");

    // Verify columns exist
    const colCheck = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'user_projects' 
        AND column_name IN ('is_repo_private', 'hide_repo_url');
    `);

    console.log("Verified user_projects columns:", colCheck.rows);

    const tblCheck = await query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_name = 'user_github_installations';
    `);

    console.log("Verified table user_github_installations exists:", tblCheck.rowCount > 0);
    process.exit(0);
}

applyMigration().catch((err) => {
    console.error("Migration 039 failed:", err);
    process.exit(1);
});
