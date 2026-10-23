import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    try {
        const migrationsDir = path.join(__dirname, "migrations");
        const files = fs.readdirSync(migrationsDir)
            .filter((f) => f.endsWith(".sql"))
            .sort();

        for (const file of files) {
            const sqlPath = path.join(migrationsDir, file);
            const sql = fs.readFileSync(sqlPath, "utf-8");
            console.log(`Applying migration: ${file}...`);
            await query(sql);
            console.log(`✅ ${file} applied successfully!`);
        }
        console.log("All migrations applied successfully!");
    } catch (err: any) {
        console.error("Migration failed:", err.message);
        process.exit(1);
    }
    process.exit(0);
}

runMigrations();
