import { query } from "../src/database/client.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const migrationPath = path.resolve(__dirname, "../src/database/migrations/050_workspace_transfers_and_accountability.sql");
    const sql = fs.readFileSync(migrationPath, "utf8");
    console.log("Applying Migration 050...");
    await query(sql);
    console.log("✅ Migration 050 applied successfully.");
    process.exit(0);
}

run().catch((err) => {
    console.error("Migration 050 failed:", err);
    process.exit(1);
});
