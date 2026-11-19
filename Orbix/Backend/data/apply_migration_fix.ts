import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { query } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
    const sqlPath = path.join(__dirname, "../src/database/migrations/002_expand_institutions_directory.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    await query(sql);
    console.log("✅ Migration 002 re-applied successfully.");

    // Update Manipal aliases
    await query(`
        UPDATE institutions
        SET aliases = array_append(aliases, 'Manipal')
        WHERE aishe_code = 'U-0230' AND NOT ('Manipal' = ANY(aliases));
    `);

    await query(`
        INSERT INTO institution_aliases (institution_id, alias, alias_type)
        SELECT id, 'Manipal', 'popular' FROM institutions WHERE aishe_code = 'U-0230'
        ON CONFLICT (institution_id, alias) DO NOTHING;
    `);

    // Also ensure VIT has popular alias VIT
    await query(`
        INSERT INTO institution_aliases (institution_id, alias, alias_type)
        SELECT id, 'VIT', 'popular' FROM institutions WHERE aishe_code = 'U-0484'
        ON CONFLICT (institution_id, alias) DO NOTHING;
    `);

    console.log("✅ Aliases for Manipal and VIT successfully synchronized.");
}

run()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Error applying migration fix:", err);
        process.exit(1);
    });
