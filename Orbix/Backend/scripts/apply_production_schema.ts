import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const backendEnvPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else {
    dotenv.config();
}

import { pool } from "../src/database/client.js";

async function run() {
    console.log("=================================================");
    console.log("🚀 ORBIX PRODUCTION DATABASE SCHEMA INITIALIZER");
    console.log("=================================================");

    const schemaPath = path.resolve(__dirname, "../src/database/schema_production_complete.sql");
    if (!fs.existsSync(schemaPath)) {
        throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    console.log("📄 Reading schema_production_complete.sql...");
    const sql = fs.readFileSync(schemaPath, "utf-8");

    console.log("⚡ Executing DDL bootstrap (creating all 131 tables, constraints, and indexes)...");
    const startTime = Date.now();

    const client = await pool.connect();
    try {
        await client.query(sql);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ Schema applied successfully in ${elapsed}s!`);

        // Verify key tables exist
        const checkRes = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name IN (
                'users', 
                'verified_clubs', 
                'club_verification_requests', 
                'institutions', 
                'institution_aliases', 
                'club_events', 
                'team_workspaces',
                'club_memberships'
              )
            ORDER BY table_name;
        `);

        console.log("\nVerified Core Tables Present:");
        for (const row of checkRes.rows) {
            console.log(`  ✓ ${row.table_name}`);
        }
    } finally {
        client.release();
    }
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Schema bootstrap failed:", err);
        process.exit(1);
    });
