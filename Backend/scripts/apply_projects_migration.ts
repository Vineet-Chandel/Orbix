import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function applyMigration() {
    try {
        const migrationPath = path.join(__dirname, "..", "src", "database", "migrations", "038_user_projects_showcase.sql");
        const sql = fs.readFileSync(migrationPath, "utf-8");
        console.log("Applying migration 038_user_projects_showcase.sql...");
        await query(sql);
        console.log("✅ 038_user_projects_showcase.sql applied successfully!");
        process.exit(0);
    } catch (err: any) {
        console.error("Migration failed:", err.message);
        process.exit(1);
    }
}

applyMigration();
