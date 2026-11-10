import fs from "fs";
import path from "path";
import os from "os";

// Set dummy connection string before importing database modules to guarantee isolated mock testing
process.env.SUPABASE_DB_URL = process.env.SUPABASE_DB_URL || "postgresql://mock_user:mock_pass@localhost:5432/mock_db";

import { runMigrations, sanitizeErrorMessage, MIGRATION_SIGNATURES } from "../run_migration.js";

interface MockQueryCall {
    sql: string;
    params?: any[] | undefined;
}

function createMockPool(options: {
    appliedVersions?: string[];
    hasSchemaMigrations?: boolean;
    lockAcquired?: boolean;
    failOnMigration?: string;
    existingTables?: string[];
    existingColumns?: Array<{ table: string; column: string }>;
} = {}) {
    const {
        appliedVersions = [],
        hasSchemaMigrations = true,
        lockAcquired = true,
        failOnMigration,
        existingTables = ["institutions", "college_verifications", "college_verification_email_tokens", "college_verification_phone_otps"],
        existingColumns = [{ table: "users", column: "is_college_verified" }, { table: "users", column: "college_verified_at" }],
    } = options;

    const queries: MockQueryCall[] = [];
    const clientQueries: MockQueryCall[] = [];
    let clientReleased = false;
    let lockClientReleased = false;

    const mockClient = {
        query: async (sqlText: string, params?: any[]) => {
            const sql = String(sqlText).trim();
            clientQueries.push({ sql, params });

            if (failOnMigration && sql.includes(failOnMigration)) {
                throw new Error(`Simulated database syntax error in ${failOnMigration}`);
            }

            if (sql.includes("pg_try_advisory_lock")) {
                return { rows: [{ acquired: lockAcquired }] };
            }
            if (sql.includes("pg_advisory_unlock")) {
                return { rows: [{ unlocked: true }] };
            }

            return { rows: [] };
        },
        release: () => {
            clientReleased = true;
        },
    };

    const mockLockClient = {
        query: async (sqlText: string, params?: any[]) => {
            const sql = String(sqlText).trim();
            clientQueries.push({ sql, params });

            if (sql.includes("pg_try_advisory_lock")) {
                return { rows: [{ acquired: lockAcquired }] };
            }
            if (sql.includes("pg_advisory_unlock")) {
                return { rows: [{ unlocked: true }] };
            }
            return { rows: [] };
        },
        release: () => {
            lockClientReleased = true;
        },
    };

    let connectCount = 0;
    const mockPool = {
        query: async (sqlText: string, params?: any[]) => {
            const sql = String(sqlText).trim();
            queries.push({ sql, params });

            if (sql.includes("to_regclass")) {
                return { rows: [{ regclass: hasSchemaMigrations ? "public.schema_migrations" : null }] };
            }
            if (sql.includes("SELECT version FROM public.schema_migrations")) {
                return { rows: appliedVersions.map((v) => ({ version: v })) };
            }
            if (sql.includes("information_schema.tables")) {
                return { rows: existingTables.map((t) => ({ table_name: t })) };
            }
            if (sql.includes("information_schema.columns")) {
                return { rows: existingColumns.map((c) => ({ table_name: c.table, column_name: c.column })) };
            }
            return { rows: [] };
        },
        connect: async () => {
            connectCount++;
            // First connect is the advisory lock client, subsequent are migration clients
            if (connectCount === 1) {
                return mockLockClient;
            }
            return mockClient;
        },
        getQueries: () => queries,
        getClientQueries: () => clientQueries,
        isClientReleased: () => clientReleased,
        isLockClientReleased: () => lockClientReleased,
    };

    return mockPool;
}

// Minimal Test Runner
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}\n     ${err.stack || err.message}`);
        failed++;
    }
}

function assert(condition: boolean, msg: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

async function runAllTests() {
    console.log("=================================================");
    console.log("🧪 ORBIX MIGRATION RUNNER SAFE UNIT TEST SUITE");
    console.log("   (100% Mocked, Isolated, Zero Database Pollution)");
    console.log("=================================================\n");

    // Create a temporary isolated migration directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_mig_test_"));
    try {
        fs.writeFileSync(path.join(tempDir, "001_initial.sql"), "CREATE TABLE test_001 (id INT);");
        fs.writeFileSync(path.join(tempDir, "002_second.sql"), "CREATE TABLE test_002 (id INT);");
        fs.writeFileSync(path.join(tempDir, "010_tenth.sql"), "CREATE TABLE test_010 (id INT);");
        fs.writeFileSync(path.join(tempDir, "031_college_verifications.sql"), "CREATE TABLE college_verifications (id INT);");

        await test("1. Deterministic natural numeric sort order", async () => {
            const pool = createMockPool();
            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
            });

            assert(res.applied.length === 4, `Expected 4 applied, got ${res.applied.length}`);
            assert(res.applied[0] === "001_initial.sql", `Order 0 was ${res.applied[0]}`);
            assert(res.applied[1] === "002_second.sql", `Order 1 was ${res.applied[1]}`);
            assert(res.applied[2] === "010_tenth.sql", `Order 2 was ${res.applied[2]}`);
            assert(res.applied[3] === "031_college_verifications.sql", `Order 3 was ${res.applied[3]}`);
        });

        await test("2. Transactional execution with BEGIN, DDL, schema_migrations INSERT, and COMMIT", async () => {
            const pool = createMockPool();
            await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                targetFile: "001_initial.sql",
            });

            const clientQueries = pool.getClientQueries().map((q) => q.sql);
            assert(clientQueries.includes("BEGIN;"), "Must contain BEGIN;");
            assert(clientQueries.some((q) => q.includes("CREATE TABLE test_001")), "Must execute DDL");
            assert(clientQueries.some((q) => q.includes("INSERT INTO public.schema_migrations")), "Must insert into schema_migrations");
            assert(clientQueries.includes("COMMIT;"), "Must contain COMMIT;");
            assert(pool.isClientReleased(), "Must release migration client");
            assert(pool.isLockClientReleased(), "Must release lock client");
        });

        await test("3. Rollback on failure without marking schema_migrations", async () => {
            const pool = createMockPool({ failOnMigration: "test_002" });
            let errorCaught = false;

            try {
                await runMigrations({
                    migrationsDir: tempDir,
                    poolOverride: pool,
                });
            } catch (err: any) {
                errorCaught = true;
                assert(err.message.includes("002_second.sql failed"), "Error message identifies failed migration");
            }

            assert(errorCaught, "Runner must throw on migration failure");
            const clientQueries = pool.getClientQueries().map((q) => q.sql);
            assert(clientQueries.includes("ROLLBACK;"), "Must issue ROLLBACK on failure");
            assert(pool.isClientReleased(), "Must release client even on failure");
            assert(pool.isLockClientReleased(), "Must release lock client even on failure");
        });

        await test("4. Skipping already applied migrations", async () => {
            const pool = createMockPool({
                appliedVersions: ["001_initial.sql", "002_second.sql"],
            });

            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
            });

            assert(res.skipped.length === 2, `Expected 2 skipped, got ${res.skipped.length}`);
            assert(res.skipped.includes("001_initial.sql"), "001 must be skipped");
            assert(res.skipped.includes("002_second.sql"), "002 must be skipped");
            assert(res.applied.length === 2, `Expected 2 applied, got ${res.applied.length}`);
            assert(res.applied[0] === "010_tenth.sql", "010 must be applied next");
            assert(res.applied[1] === "031_college_verifications.sql", "031 must be applied last");
        });

        await test("5. Dry-run zero writes guarantee", async () => {
            const pool = createMockPool({ hasSchemaMigrations: false });
            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                dryRun: true,
            });

            assert(res.pending.length === 4, "All 4 should be identified as pending in dry-run");
            assert(res.applied.length === 0, "0 migrations applied in dry-run");

            const allPoolQueries = pool.getQueries().map((q) => q.sql);
            const allClientQueries = pool.getClientQueries().map((q) => q.sql);

            assert(!allPoolQueries.some((q) => q.includes("CREATE TABLE IF NOT EXISTS public.schema_migrations")), "Zero CREATE TABLE writes in dry-run");
            assert(!allClientQueries.includes("BEGIN;"), "Zero BEGIN calls in dry-run");
            assert(!allClientQueries.some((q) => q.includes("INSERT INTO")), "Zero INSERT calls in dry-run");
        });

        await test("6. Strict exact --file matching and path traversal prevention", async () => {
            const pool = createMockPool();

            // Exact match succeeds
            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                targetFile: "031_college_verifications.sql",
            });
            assert(res.applied.length === 1 && res.applied[0] === "031_college_verifications.sql", "Exact file runs single file");

            // Inexact / partial match fails
            let caughtPartial = false;
            try {
                await runMigrations({
                    migrationsDir: tempDir,
                    poolOverride: pool,
                    targetFile: "031",
                });
            } catch (err: any) {
                caughtPartial = true;
                assert(err.message.includes("Strict exact filename match required"), "Rejects partial name");
            }
            assert(caughtPartial, "Partial filename match must be rejected");

            // Path traversal attempt fails
            let caughtTraversal = false;
            try {
                await runMigrations({
                    migrationsDir: tempDir,
                    poolOverride: pool,
                    targetFile: "../../secret.sql",
                });
            } catch (err: any) {
                caughtTraversal = true;
                assert(err.message.includes("secret.sql"), "Sanitizes traversal to basename and fails lookup");
            }
            assert(caughtTraversal, "Path traversal target must be rejected");
        });

        await test("7. Concurrent runner advisory lock prevents race conditions", async () => {
            const pool = createMockPool({ lockAcquired: false });
            let caughtLockError = false;

            try {
                await runMigrations({
                    migrationsDir: tempDir,
                    poolOverride: pool,
                });
            } catch (err: any) {
                caughtLockError = true;
                assert(err.message.includes("Another migration runner process is currently executing"), "Lock error message");
            }

            assert(caughtLockError, "Runner must abort when advisory lock cannot be acquired");
            assert(pool.isLockClientReleased(), "Lock client must be released when lock acquisition fails");
        });

        await test("8. Existing database adoption mode (--adopt without confirm: preview only)", async () => {
            const pool = createMockPool({
                existingTables: ["college_verifications", "college_verification_email_tokens", "college_verification_phone_otps"],
                existingColumns: [{ table: "users", column: "is_college_verified" }, { table: "users", column: "college_verified_at" }],
            });

            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                adopt: true,
                confirm: false,
            });

            assert(res.adopted.length === 0, "No records written without --confirm");
            assert(res.applied.length === 0, "No DDL executed in adoption mode");
            const clientQueries = pool.getClientQueries().map((q) => q.sql);
            assert(!clientQueries.includes("BEGIN;"), "Zero transactions in adoption inspection");
        });

        await test("9. Existing database adoption mode (--adopt --confirm: records without DDL)", async () => {
            const pool = createMockPool({
                existingTables: ["college_verifications", "college_verification_email_tokens", "college_verification_phone_otps"],
                existingColumns: [{ table: "users", column: "is_college_verified" }, { table: "users", column: "college_verified_at" }],
            });

            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                adopt: true,
                confirm: true,
            });

            assert(res.adopted.includes("031_college_verifications.sql"), "031 was adopted because its tables/columns exist");
            assert(res.applied.length === 0, "No DDL statements were executed during adoption");
            assert(pool.isLockClientReleased(), "Lock client released after adoption");
        });

        await test("10. Sanitized error messages scrub sensitive credentials", async () => {
            const rawErr1 = "Connection failed to postgresql://postgres:super_secret_password@db.supabase.co:5432/postgres";
            const sanitized1 = sanitizeErrorMessage(rawErr1);
            assert(!sanitized1.includes("super_secret_password"), "Password scrubbed from postgres URI");
            assert(sanitized1.includes("[REDACTED]"), "Redaction token present");

            const rawErr2 = "Auth error: password=my_db_secret_pass;host=127.0.0.1";
            const sanitized2 = sanitizeErrorMessage(rawErr2);
            assert(!sanitized2.includes("my_db_secret_pass"), "Password parameter scrubbed");
        });

        await test("11. Prevention of false-positive adoption on partial or divergent schema", async () => {
            // Missing one required table ('college_verification_phone_otps')
            const pool = createMockPool({
                existingTables: ["college_verifications", "college_verification_email_tokens"], // missing phone_otps
                existingColumns: [{ table: "users", column: "is_college_verified" }], // missing college_verified_at
            });

            const res = await runMigrations({
                migrationsDir: tempDir,
                poolOverride: pool,
                adopt: true,
                confirm: true,
            });

            assert(!res.adopted.includes("031_college_verifications.sql"), "031 must NOT be adopted when tables/columns are partially missing");
            assert(res.adopted.length === 0, "Zero migrations adopted on divergent schema");
        });

    } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
    }

    console.log(`\nTests Completed: ${passed} passed, ${failed} failed`);
    if (failed > 0) {
        process.exit(1);
    }
}

runAllTests().catch((e) => {
    console.error("Test runner crashed:", e);
    process.exit(1);
});
