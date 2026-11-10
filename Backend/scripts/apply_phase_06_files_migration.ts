import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import fs from "fs";
import { pool } from "../src/database/client.js";

async function run() {
    console.log("Applying Migration 047: Team Workspace Media and Document Management...");
    const migrationPath = path.resolve(__dirname, "../src/database/migrations/047_workspace_media_and_document_management.sql");
    const sql = fs.readFileSync(migrationPath, "utf-8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN;");
        await client.query(sql);
        await client.query("COMMIT;");
        console.log("✅ Migration 047 applied successfully!");
    } catch (err) {
        await client.query("ROLLBACK;");
        console.error("❌ Migration 047 failed:", err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
