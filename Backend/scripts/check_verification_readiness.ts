import { pool } from "../src/database/client.js";

// Read-only release check. Schema changes run separately through the migration runner.
const requiredColumns: Record<string, string[]> = {
    users: ["github_id"],
    user_links: ["ownership_status", "sync_status", "legacy_unverified_at", "verified_at", "verified_handle", "verification_method", "verification_metadata"],
    platform_verification_challenges: ["user_id", "link_id", "portal", "portal_username", "token_hash", "status", "expires_at"],
};

try {
    const columns = await pool.query(
        "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
        [Object.keys(requiredColumns)]
    );
    const present = new Set(columns.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missingColumns = Object.entries(requiredColumns).flatMap(([table, fields]) => fields.map((field) => `${table}.${field}`)).filter((column) => !present.has(column));
    const indexes = await pool.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname IN ('idx_users_github_id', 'unique_verified_portal_account', 'idx_pvc_single_active_challenge')");
    const presentIndexes = new Set(indexes.rows.map((row) => row.indexname));
    const missingIndexes = ["idx_users_github_id", "unique_verified_portal_account", "idx_pvc_single_active_challenge"].filter((index) => !presentIndexes.has(index));
    const ready = missingColumns.length === 0 && missingIndexes.length === 0;
    console.log(JSON.stringify({ ready, missingColumns, missingIndexes, requiredMigration: ready ? null : "069_platform_account_ownership_verification.sql" }, null, 2));
    if (!ready) process.exitCode = 1;
} catch {
    console.error("Could not inspect verification readiness. Check database connectivity and configuration.");
    process.exitCode = 1;
} finally {
    await pool.end();
}
