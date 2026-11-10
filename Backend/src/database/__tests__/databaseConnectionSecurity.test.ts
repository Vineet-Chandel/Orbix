import fs from "fs";
import path from "path";
import os from "os";
import {
    resolveDatabaseConfig,
    parseDatabaseUrl,
    matchesExpectedIdentity,
    FORBIDDEN_DATABASE_IDENTIFIERS,
    DISALLOWED_BROAD_IDENTITIES,
    normalizeHostname,
    parseExpectedIdentity,
    sanitizeDatabaseError,
} from "../config.js";
import {
    runMigrations,
    performStaticMigrationAnalysis,
} from "../run_migration.js";

let passed = 0;
let failed = 0;

function assert(condition: boolean, msg: string) {
    if (!condition) {
        throw new Error(`Assertion failed: ${msg}`);
    }
}

async function test(name: string, fn: () => Promise<void> | void) {
    try {
        await fn();
        console.log(`  ✅ PASS: ${name}`);
        passed++;
    } catch (err: any) {
        console.error(`  ❌ FAIL: ${name}\n     ${err.stack || err.message}`);
        failed++;
    }
}

async function runSecuritySuite() {
    console.log("=================================================");
    console.log("🔒 ORBIX DATABASE SECURITY & MIGRATION FAIL-CLOSED REGRESSION SUITE");
    console.log("   (100% Isolated, Zero Database Connections, Pure Logic & Mocks)");
    console.log("=================================================\n");

    console.log("--- PART 1: DATABASE CONFIGURATION SECURITY (TESTS 1 - 10) ---");

    // 1. Valid staging configuration is accepted
    await test("1. Valid staging configuration is accepted", () => {
        const config = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: "postgresql://staging_user:staging_secret@staging-rds.orbix.internal:5432/orbix_staging",
            expectedIdentity: "staging-rds.orbix.internal:5432/orbix_staging",
        });
        assert(config.isStaging === true, "Must be flagged as staging");
        assert(config.environment === "staging", "Environment must be staging");
        assert(config.parsed.host === "staging-rds.orbix.internal", "Host matches");
        assert(config.parsed.port === 5432, "Port matches");
        assert(config.parsed.database === "orbix_staging", "Database matches");
    });

    // 2. Missing STAGING_DATABASE_URL is rejected
    await test("2. Missing STAGING_DATABASE_URL is rejected in staging mode", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                env: {
                    STAGING_DATABASE_URL: "",
                    EXPECTED_STAGING_DB_IDENTITY: "staging-rds.internal",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("requires STAGING_DATABASE_URL"), "Error message specifies missing STAGING_DATABASE_URL");
        }
        assert(caught, "Must fail closed when STAGING_DATABASE_URL is missing");
    });

    // 3. Staging mode cannot fall back to SUPABASE_DB_URL
    await test("3. Staging mode cannot fall back to SUPABASE_DB_URL", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                env: {
                    SUPABASE_DB_URL: "postgresql://postgres:secret@db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres",
                    STAGING_DATABASE_URL: "", // omitted
                    EXPECTED_STAGING_DB_IDENTITY: "staging-rds.internal",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("requires STAGING_DATABASE_URL"), "Must refuse fallback to SUPABASE_DB_URL");
        }
        assert(caught, "Must reject fallback to SUPABASE_DB_URL in staging mode");
    });

    // 4. Staging mode cannot fall back to DATABASE_URL
    await test("4. Staging mode cannot fall back to DATABASE_URL", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                env: {
                    DATABASE_URL: "postgresql://postgres:secret@db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres",
                    STAGING_DATABASE_URL: "", // omitted
                    EXPECTED_STAGING_DB_IDENTITY: "staging-rds.internal",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("requires STAGING_DATABASE_URL"), "Must refuse fallback to DATABASE_URL");
        }
        assert(caught, "Must reject fallback to DATABASE_URL in staging mode");
    });

    // 5. The shared Supabase project is rejected
    await test("5. The shared Supabase project (bhixamqnpcbstfwvmmog) is rejected", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://postgres:secret@db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres",
                expectedIdentity: "db.bhixamqnpcbstfwvmmog.supabase.co",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("bhixamqnpcbstfwvmmog") && err.message.includes("strictly forbidden"), "Error explicitly mentions forbidden shared Supabase");
        }
        assert(caught, "Must strictly reject shared Supabase project identifier");
    });

    // 6. A production database identity is rejected in staging mode
    await test("6. A production database identity is rejected in staging mode", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@orbix-prod-db.us-east-1.rds.amazonaws.com:5432/orbix_production",
                expectedIdentity: "orbix-prod-db.us-east-1.rds.amazonaws.com",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("production database"), "Error indicates production database rejection");
        }
        assert(caught, "Must reject production database in staging");
    });

    // 7. A mismatched expected staging identity is rejected
    await test("7. A mismatched expected staging identity is rejected", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@staging-node-01.internal:5432/orbix_staging",
                expectedIdentity: "staging-node-02.internal:5432/orbix_staging", // does not match
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Identifies mismatch");
            assert(err.message.includes("staging-node-01.internal"), "Reports effective host");
            assert(err.message.includes("staging-node-02.internal"), "Reports expected identity");
        }
        assert(caught, "Must fail closed when effective host does not match expected identity");
    });

    // 8. Malformed URLs are rejected
    await test("8. Malformed URLs are rejected", () => {
        const malformedUrls = [
            "not-a-url",
            "http://wrong-protocol.com/db",
            "postgresql://missing-db-path.com",
            "postgres://",
            "  ",
        ];

        for (const badUrl of malformedUrls) {
            let caught = false;
            try {
                parseDatabaseUrl(badUrl);
            } catch {
                caught = true;
            }
            assert(caught, `Malformed URL must be rejected: '${badUrl}'`);
        }
    });

    // 9. Missing expected identity is rejected
    await test("9. Missing expected identity is rejected in staging mode", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@staging-valid.internal:5432/staging_db",
                expectedIdentity: "", // missing
                env: {
                    EXPECTED_STAGING_DB_IDENTITY: "",
                    STAGING_DB_IDENTITY: "",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("requires an explicit expected database identity"), "Identifies missing expected identity");
        }
        assert(caught, "Must fail closed if expected identity is omitted");
    });

    // 10. Development and production configuration behavior is preserved
    await test("10. Development and production configuration behavior is preserved", () => {
        // Dev: defaults to localhost fallback safely
        const devConfig = resolveDatabaseConfig({
            targetEnv: "development",
            env: {},
        });
        assert(devConfig.environment === "development", "Dev environment resolved");
        assert(devConfig.isDevelopment === true, "isDevelopment is true");

        // Prod: resolves SUPABASE_DB_URL or DATABASE_URL
        const prodConfig = resolveDatabaseConfig({
            targetEnv: "production",
            env: {
                DATABASE_URL: "postgresql://prod_user:prod_pass@prod-cluster.internal:5432/orbix_core",
            },
        });
        assert(prodConfig.environment === "production", "Production resolved");
        assert(prodConfig.isProduction === true, "isProduction is true");
        assert(prodConfig.parsed.host === "prod-cluster.internal", "Host matches");
    });

    console.log("\n--- PART 2: MIGRATION RUNNER FAIL-CLOSED SAFETY (TESTS 11 - 21) ---");

    // 11. Staging execution without --target=staging is rejected
    await test("11. Staging execution without --target=staging is rejected", async () => {
        let caught = false;
        try {
            await runMigrations({
                target: undefined,
                env: {
                    NODE_ENV: "staging",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Explicit --target=staging flag is strictly required"), "Requires explicit target flag");
        }
        assert(caught, "Runner must reject staging execution without explicit target");
    });

    // 12. Staging execution without STAGING_DATABASE_URL is rejected
    await test("12. Staging execution without STAGING_DATABASE_URL is rejected", async () => {
        let caught = false;
        try {
            await runMigrations({
                target: "staging",
                env: {
                    STAGING_DATABASE_URL: "",
                    EXPECTED_STAGING_DB_IDENTITY: "staging-db.internal",
                },
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("STAGING_DATABASE_URL must be explicitly configured"), "Requires STAGING_DATABASE_URL");
        }
        assert(caught, "Runner must fail closed when STAGING_DATABASE_URL is not set");
    });

    // 13. Shared Supabase destination is rejected in migration runner
    await test("13. Shared Supabase destination is rejected in migration runner", async () => {
        let caught = false;
        try {
            await runMigrations({
                target: "staging",
                stagingUrl: "postgresql://postgres:secret@db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres",
                expectedIdentity: "db.bhixamqnpcbstfwvmmog.supabase.co",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("bhixamqnpcbstfwvmmog"), "Rejection cites forbidden Supabase instance");
        }
        assert(caught, "Runner must refuse shared Supabase destination");
    });

    // 14. Production destination is rejected in staging runner
    await test("14. Production destination is rejected in staging runner", async () => {
        let caught = false;
        try {
            await runMigrations({
                target: "staging",
                stagingUrl: "postgresql://user:pass@orbix-prod-db.us-east-1.rds.amazonaws.com:5432/orbix_production",
                expectedIdentity: "orbix-prod-db.us-east-1.rds.amazonaws.com",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("production database"), "Rejection cites production database");
        }
        assert(caught, "Runner must refuse production database in staging");
    });

    // 15. --dry-run performs no database connection
    await test("15. --dry-run performs no database connection", async () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_dryrun_conn_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "001_first.sql"), "CREATE TABLE t1 (id INT);");
            let connectCalled = false;
            const forbiddenPool = {
                connect: () => {
                    connectCalled = true;
                    throw new Error("VIOLATION: connect called");
                },
                query: () => {
                    throw new Error("VIOLATION: query called");
                },
            };

            await runMigrations({
                dryRun: true,
                migrationsDir: dummyDir,
                poolOverride: forbiddenPool,
            });

            assert(!connectCalled, "Dry run must never initiate a database connection");
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 16. --dry-run performs no SQL queries
    await test("16. --dry-run performs no SQL queries", async () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_dryrun_sql_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "001_first.sql"), "CREATE TABLE t1 (id INT);");
            let queryCalled = false;
            const forbiddenPool = {
                query: () => {
                    queryCalled = true;
                    throw new Error("VIOLATION: query called");
                },
                connect: () => {
                    throw new Error("VIOLATION: connect called");
                },
            };

            await runMigrations({
                dryRun: true,
                migrationsDir: dummyDir,
                poolOverride: forbiddenPool,
            });

            assert(!queryCalled, "Dry run must never execute SQL queries");
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 17. --dry-run performs no network operations
    await test("17. --dry-run performs no network operations", async () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_dryrun_net_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "001_first.sql"), "CREATE TABLE t1 (id INT);");
            const result = await runMigrations({
                dryRun: true,
                migrationsDir: dummyDir,
            });

            assert(result.applied.length === 0, "No network operations or applied writes");
            assert(
                Boolean(result.dryRunReport && result.dryRunReport.statusNotice.includes("No database connection opened")),
                "Report confirms offline state"
            );
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 18. Duplicate migration prefixes are detected
    await test("18. Duplicate migration prefixes are detected in static analysis", () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_dup_test_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "001_first.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "020_blog_likes.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "020_settings_governance_system.sql"), "--");

            const report = performStaticMigrationAnalysis(dummyDir);
            assert("020" in report.duplicatePrefixes, "Prefix 020 detected as duplicate");
            const dupList = report.duplicatePrefixes["020"];
            assert(Boolean(dupList && dupList.length === 2), "Both duplicate files captured");
            assert(Boolean(dupList && dupList.includes("020_blog_likes.sql")), "Captured 020_blog_likes.sql");
            assert(Boolean(dupList && dupList.includes("020_settings_governance_system.sql")), "Captured 020_settings_governance_system.sql");
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 19. Invalid migration filenames are detected
    await test("19. Invalid migration filenames are detected in static analysis", () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_invalid_test_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "001_valid_name.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "not_numbered.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "12_too_short_prefix.sql"), "--");

            const report = performStaticMigrationAnalysis(dummyDir);
            assert(report.invalidFilenames.length === 2, `Expected 2 invalid files, got ${report.invalidFilenames.length}`);
            assert(report.invalidFilenames.includes("not_numbered.sql"), "Captured not_numbered.sql");
            assert(report.invalidFilenames.includes("12_too_short_prefix.sql"), "Captured 12_too_short_prefix.sql");
            assert(report.isSequenceValid === false, "Sequence marked invalid due to filename issues");
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 20. Migration ordering is deterministic
    await test("20. Migration ordering is strictly deterministic across multiple runs", () => {
        const dummyDir = fs.mkdtempSync(path.join(os.tmpdir(), "orbix_order_test_"));
        try {
            fs.writeFileSync(path.join(dummyDir, "002_second.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "001_first.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "010_tenth.sql"), "--");
            fs.writeFileSync(path.join(dummyDir, "031_last.sql"), "--");

            const report1 = performStaticMigrationAnalysis(dummyDir);
            const report2 = performStaticMigrationAnalysis(dummyDir);

            assert(
                JSON.stringify(report1.orderedFiles) === JSON.stringify(report2.orderedFiles),
                "Ordering is deterministic across runs"
            );
            assert(report1.orderedFiles[0] === "001_first.sql", "First is 001");
            assert(report1.orderedFiles[1] === "002_second.sql", "Second is 002");
            assert(report1.orderedFiles[2] === "010_tenth.sql", "Third is 010");
            assert(report1.orderedFiles[3] === "031_last.sql", "Fourth is 031");
        } finally {
            fs.rmSync(dummyDir, { recursive: true, force: true });
        }
    });

    // 21. Invalid identity configuration fails before pool creation or database access
    await test("21. Invalid identity configuration fails before pool creation or database access", async () => {
        let poolConstructed = false;
        let queryAttempted = false;

        const fakePool = {
            query: async () => {
                queryAttempted = true;
                return { rows: [] };
            },
            connect: async () => {
                poolConstructed = true;
                return { query: async () => ({ rows: [] }), release: () => {} };
            },
        };

        let caught = false;
        try {
            await runMigrations({
                target: "staging",
                stagingUrl: "postgresql://user:pass@staging-host.internal:5432/staging_db",
                expectedIdentity: "DIFFERENT-HOST.internal:5432/staging_db", // will fail identity check
                poolOverride: fakePool,
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Fails on identity check");
        }

        assert(caught, "Must fail closed on identity error");
        assert(!poolConstructed, "Must not construct or connect pool when identity check fails");
        assert(!queryAttempted, "Must not execute any query when identity check fails");
    });

    console.log("\n--- PART 3: COMPLETE DESTINATION IDENTITY ENFORCEMENT & ADVERSARIAL COVERAGE (TESTS 22 - 52) ---");

    const validStagingUrl = "postgresql://staging_user:staging_secret@staging-rds.orbix.internal:5432/orbix_staging";
    const validCompleteIdentity = "staging-rds.orbix.internal:5432/orbix_staging";
    const parsedValidStaging = parseDatabaseUrl(validStagingUrl);

    // 22. Correct complete destination (hostname, port, database) accepted
    await test("22. Correct complete destination (hostname, port, database) accepted", () => {
        const config = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: validStagingUrl,
            expectedIdentity: validCompleteIdentity,
        });
        assert(config.parsed.host === "staging-rds.orbix.internal", "Host matched exactly");
        assert(config.parsed.port === 5432, "Port matched exactly");
        assert(config.parsed.database === "orbix_staging", "Database matched exactly");
        assert(matchesExpectedIdentity(parsedValidStaging, validCompleteIdentity) === true, "Direct matcher passes complete identity");
    });

    // 23. Hostname casing is normalized correctly in complete identity
    await test("23. Hostname casing is normalized correctly in complete identity", () => {
        const config = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: validStagingUrl,
            expectedIdentity: "STAGING-RDS.ORBIX.INTERNAL:5432/orbix_staging",
        });
        assert(config.parsed.host === "staging-rds.orbix.internal", "Normalized casing");
        assert(matchesExpectedIdentity(parsedValidStaging, "STAGING-RDS.ORBIX.INTERNAL:5432/orbix_staging") === true, "Matches uppercase expected host");
    });

    // 24. Optional trailing DNS dot is handled correctly
    await test("24. Optional trailing DNS dot is handled correctly", () => {
        // Trailing dot in expected identity
        const config1 = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: validStagingUrl,
            expectedIdentity: "staging-rds.orbix.internal.:5432/orbix_staging",
        });
        assert(config1.parsed.host === "staging-rds.orbix.internal", "Trailing dot stripped from expected");

        // Trailing dot in connection string
        const config2 = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: "postgresql://staging_user:staging_secret@staging-rds.orbix.internal.:5432/orbix_staging",
            expectedIdentity: validCompleteIdentity,
        });
        assert(config2.parsed.host === "staging-rds.orbix.internal", "Trailing dot stripped from URL host");

        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal.:5432/orbix_staging") === true, "Direct matcher handles trailing dot");
    });

    // 25. Correct hostname and port with incorrect database name fails
    await test("25. Correct hostname and port with incorrect database name fails", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging-rds.orbix.internal:5432/wrong_database",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Fails on database mismatch");
        }
        assert(caught, "Must fail closed on database name mismatch");
        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal:5432/wrong_database") === false, "Direct matcher returns false");
    });

    // 26. Correct database name and port with incorrect hostname fails
    await test("26. Correct database name and port with incorrect hostname fails", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "wrong-host.orbix.internal:5432/orbix_staging",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Fails on host mismatch");
        }
        assert(caught, "Must fail closed on host mismatch despite correct database and port");
        assert(matchesExpectedIdentity(parsedValidStaging, "wrong-host.orbix.internal:5432/orbix_staging") === false, "Direct matcher returns false");
    });

    // 27. Correct hostname and database with incorrect port fails
    await test("27. Correct hostname and database with incorrect port fails", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl, // port 5432
                expectedIdentity: "staging-rds.orbix.internal:5433/orbix_staging", // mismatch
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Fails on port mismatch");
        }
        assert(caught, "Must fail closed on port mismatch");
        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal:5433/orbix_staging") === false, "Direct matcher returns false");
    });

    // 28. Correct hostname and database with missing expected port rejected (fail-closed)
    await test("28. Correct hostname and database with missing expected port rejected (fail-closed)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging-rds.orbix.internal/orbix_staging", // missing port
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Incomplete staging destination identity") && err.message.includes("explicit port"), "Explicitly rejects missing port");
        }
        assert(caught, "Must fail closed when expected port is omitted in staging");
        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal/orbix_staging") === false, "Direct matcher returns false when port is omitted");
    });

    // 29. Correct hostname and port with missing expected database rejected (fail-closed)
    await test("29. Correct hostname and port with missing expected database rejected (fail-closed)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging-rds.orbix.internal:5432", // missing database
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Incomplete staging destination identity") && err.message.includes("explicit database name"), "Explicitly rejects missing database");
        }
        assert(caught, "Must fail closed when expected database name is omitted in staging");
        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal:5432") === false, "Direct matcher returns false when database is omitted");
    });

    // 30. Hostname-only expected identity rejected in staging mode (fail-closed)
    await test("30. Hostname-only expected identity rejected in staging mode (fail-closed)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging-rds.orbix.internal", // hostname only
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Incomplete staging destination identity"), "Rejects hostname-only identity");
        }
        assert(caught, "Must strictly reject hostname-only identity for staging");
        assert(matchesExpectedIdentity(parsedValidStaging, "staging-rds.orbix.internal") === false, "Direct matcher returns false for hostname-only");
    });

    // 31. Broad keyword 'rds' cannot authorize a hostname containing 'rds'
    await test("31. Broad keyword 'rds' cannot authorize a hostname containing 'rds'", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "rds",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("broad keyword"), "Rejected as broad keyword");
        }
        assert(caught, "Must reject 'rds' as broad expected identity");
        assert(matchesExpectedIdentity(parsedValidStaging, "rds") === false, "Direct matcher returns false for 'rds'");
    });

    // 32. Broad keyword 'internal' cannot authorize an unrelated internal hostname
    await test("32. Broad keyword 'internal' cannot authorize an unrelated internal hostname", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "internal",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("broad keyword"), "Rejected as broad keyword");
        }
        assert(caught, "Must reject 'internal' as broad expected identity");
        assert(matchesExpectedIdentity(parsedValidStaging, "internal") === false, "Direct matcher returns false for 'internal'");
    });

    // 33. Broad keywords ('staging', 'postgres', 'aws', etc.) are strictly rejected
    await test("33. Broad keywords ('staging', 'postgres', 'aws', etc.) are strictly rejected", () => {
        const broadTokens = ["staging", "postgres", "postgresql", "aws", "database", "db"];
        for (const token of broadTokens) {
            let caught = false;
            try {
                resolveDatabaseConfig({
                    targetEnv: "staging",
                    connectionString: validStagingUrl,
                    expectedIdentity: token,
                });
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("broad keyword"), `Rejected broad token '${token}'`);
            }
            assert(caught, `Must reject '${token}' in resolveDatabaseConfig`);
            assert(matchesExpectedIdentity(parsedValidStaging, token) === false, `Direct matcher returns false for '${token}'`);
        }
    });

    // 34. A hostname containing the expected hostname as a substring fails (substring rejection)
    await test("34. A hostname containing the expected hostname as a substring fails (substring rejection)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@staging-orbix.internal:5432/orbix_staging",
                expectedIdentity: "orbix.internal:5432/orbix_staging",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Rejects substring match");
        }
        assert(caught, "Must reject substring match");
        const parsed = parseDatabaseUrl("postgresql://user:pass@staging-orbix.internal:5432/orbix_staging");
        assert(matchesExpectedIdentity(parsed, "orbix.internal:5432/orbix_staging") === false, "Direct matcher rejects substring");
    });

    // 35. A hostname with an unexpected suffix fails (suffix attack prevention)
    await test("35. A hostname with an unexpected suffix fails (suffix attack prevention)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@staging-rds.orbix.internal.attacker.com:5432/orbix_staging",
                expectedIdentity: validCompleteIdentity,
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Rejects suffix spoofing");
        }
        assert(caught, "Must reject suffix spoofing");
        const parsed = parseDatabaseUrl("postgresql://user:pass@staging-rds.orbix.internal.attacker.com:5432/orbix_staging");
        assert(matchesExpectedIdentity(parsed, validCompleteIdentity) === false, "Direct matcher rejects suffix spoofing");
    });

    // 36. An unexpected subdomain fails (prefix attack prevention)
    await test("36. An unexpected subdomain fails (prefix attack prevention)", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@sub.staging-rds.orbix.internal:5432/orbix_staging",
                expectedIdentity: validCompleteIdentity,
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Database identity mismatch"), "Rejects subdomain prefix spoofing");
        }
        assert(caught, "Must reject subdomain prefix spoofing");
        const parsed = parseDatabaseUrl("postgresql://user:pass@sub.staging-rds.orbix.internal:5432/orbix_staging");
        assert(matchesExpectedIdentity(parsed, validCompleteIdentity) === false, "Direct matcher rejects prefix spoofing");
    });

    // 37. URL-encoded database names decoded and compared safely
    await test("37. URL-encoded database names decoded and compared safely", () => {
        // Connection URL has encoded %5F (underscore), expected identity has standard underscore
        const config1 = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix%5Fstaging",
            expectedIdentity: "staging-rds.orbix.internal:5432/orbix_staging",
        });
        assert(config1.parsed.database === "orbix_staging", "Decoded database name in URL");

        // Expected identity has encoded %5F, connection URL has standard underscore
        const config2 = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: validStagingUrl,
            expectedIdentity: "staging-rds.orbix.internal:5432/orbix%5Fstaging",
        });
        assert(config2.parsed.database === "orbix_staging", "Decoded database name in expected identity");

        // Both encoded match
        assert(matchesExpectedIdentity(parseDatabaseUrl("postgresql://user:pass@staging-rds.orbix.internal:5432/orbix%5Fstaging"), "staging-rds.orbix.internal:5432/orbix%5Fstaging") === true, "Both encoded match");
    });

    // 38. Unsupported multi-host URI in connection URL fails closed
    await test("38. Unsupported multi-host URI in connection URL fails closed", () => {
        const multiHostUrls = [
            "postgresql://host1:5432,host2:5432/orbix_staging",
            "postgresql://user:pass@host1:5432,host2:5432/orbix_staging",
            "postgresql://host1,host2/orbix_staging",
        ];
        for (const badUrl of multiHostUrls) {
            let caught = false;
            try {
                parseDatabaseUrl(badUrl);
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("Multi-host connection URLs are not supported"), `Rejects multi-host: ${badUrl}`);
            }
            assert(caught, `Must reject multi-host URL: ${badUrl}`);
        }
    });

    // 39. Unsupported multi-host string in expected identity fails closed
    await test("39. Unsupported multi-host string in expected identity fails closed", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "host1:5432,host2:5432/orbix_staging",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("Multi-host expected identity is not supported"), "Rejects multi-host expected identity");
        }
        assert(caught, "Must reject multi-host expected identity");
    });

    // 40. Ambiguous destination query parameters in connection URL rejected
    await test("40. Ambiguous destination query parameters in connection URL rejected", () => {
        const ambiguousUrls = [
            "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix_staging?host=evil.com",
            "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix_staging?port=5433",
            "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix_staging?dbname=other_db",
            "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix_staging?database=other_db",
        ];
        for (const badUrl of ambiguousUrls) {
            let caught = false;
            try {
                parseDatabaseUrl(badUrl);
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("ambiguous destination query parameter"), `Catches parameter in ${badUrl}`);
            }
            assert(caught, `Must reject ambiguous query parameter in ${badUrl}`);
        }
    });

    // 41. Query parameters or URL fragment in expected identity rejected
    await test("41. Query parameters or URL fragment in expected identity rejected", () => {
        const badIdentities = [
            "staging-rds.orbix.internal:5432/orbix_staging?sslmode=require",
            "staging-rds.orbix.internal:5432/orbix_staging#section",
            "postgresql://staging-rds.orbix.internal:5432/orbix_staging?ssl=true",
        ];
        for (const badId of badIdentities) {
            let caught = false;
            try {
                resolveDatabaseConfig({
                    targetEnv: "staging",
                    connectionString: validStagingUrl,
                    expectedIdentity: badId,
                });
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("query parameters or URL fragment"), `Catches param/fragment in ${badId}`);
            }
            assert(caught, `Must reject query params or fragment in expected identity: ${badId}`);
        }
    });

    // 42. Multiple trailing hostname dots rejected
    await test("42. Multiple trailing hostname dots rejected", () => {
        let caughtUrl = false;
        try {
            parseDatabaseUrl("postgresql://user:pass@staging-rds.orbix.internal..:5432/orbix_staging");
        } catch (err: any) {
            caughtUrl = true;
            assert(err.message.includes("multiple trailing dots"), "URL rejects multiple trailing dots");
        }
        assert(caughtUrl, "Connection URL must reject multiple trailing dots");

        let caughtExpected = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging-rds.orbix.internal..:5432/orbix_staging",
            });
        } catch (err: any) {
            caughtExpected = true;
            assert(err.message.includes("multiple trailing dots") || err.message.includes("malformed or invalid"), "Expected identity rejects multiple trailing dots");
        }
        assert(caughtExpected, "Expected identity must reject multiple trailing dots");
    });

    // 43. Underscore hostname labels rejected under conventional DNS rules (RFC 952/1123)
    await test("43. Underscore hostname labels rejected under conventional DNS rules", () => {
        let caughtUrl = false;
        try {
            parseDatabaseUrl("postgresql://user:pass@staging_rds.orbix.internal:5432/orbix_staging");
        } catch (err: any) {
            caughtUrl = true;
            assert(err.message.includes("invalid or malformed hostname"), "URL rejects underscore hostname");
        }
        assert(caughtUrl, "Must reject underscore in DNS hostname");

        let caughtExpected = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "staging_rds.orbix.internal:5432/orbix_staging",
            });
        } catch (err: any) {
            caughtExpected = true;
            assert(err.message.includes("malformed or invalid"), "Expected identity rejects underscore in hostname");
        }
        assert(caughtExpected, "Expected identity must reject underscore in hostname");
    });

    // 44. Invalid IPv4 addresses rejected
    await test("44. Invalid IPv4 addresses rejected", () => {
        const badIps = [
            "300.0.1.5",       // Octet out of range
            "10.0.1",          // Incomplete octets
            "10.0.0.01",       // Leading zero octal ambiguity
            "999.999.999.999", // All out of range
        ];
        for (const badIp of badIps) {
            let caught = false;
            try {
                parseDatabaseUrl(`postgresql://user:pass@${badIp}:5432/orbix_staging`);
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("invalid or malformed hostname"), `Rejects bad IP ${badIp}`);
            }
            assert(caught, `Must reject invalid IPv4 ${badIp}`);
        }
    });

    // 45. Valid IPv4 accepted in complete destination identity
    await test("45. Valid IPv4 accepted in complete destination identity", () => {
        const ipUrl = "postgresql://user:pass@10.0.1.5:5432/staging_db";
        const config = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: ipUrl,
            expectedIdentity: "10.0.1.5:5432/staging_db",
        });
        assert(config.parsed.host === "10.0.1.5", "Valid IPv4 host parsed");
        assert(config.parsed.port === 5432, "Valid IPv4 port parsed");
        assert(config.parsed.database === "staging_db", "Valid IPv4 database parsed");
    });

    // 46. Valid bracketed IPv6 accepted in complete destination identity
    await test("46. Valid bracketed IPv6 accepted in complete destination identity", () => {
        const ipv6Url = "postgresql://user:pass@[2001:db8::1]:5432/staging_db";
        const config = resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: ipv6Url,
            expectedIdentity: "[2001:db8::1]:5432/staging_db",
        });
        assert(config.parsed.host === "[2001:db8::1]", "Valid bracketed IPv6 host parsed");
        assert(config.parsed.port === 5432, "Port parsed correctly");
        assert(config.parsed.database === "staging_db", "Database parsed correctly");
        assert(matchesExpectedIdentity(config.parsed, "[2001:db8::1]:5432/staging_db") === true, "Direct matcher passes bracketed IPv6");
    });

    // 47. Production database name on staging hostname rejected
    await test("47. Production database name on staging hostname rejected", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@staging-rds.orbix.internal:5432/orbix_production",
                expectedIdentity: "staging-rds.orbix.internal:5432/orbix_production",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("production database") || err.message.includes("production indicator"), "Rejects production db name in staging");
        }
        assert(caught, "Must strictly reject production database name on staging hostname");
    });

    // 48. Malformed expected identities fail closed
    await test("48. Malformed expected identities fail closed", () => {
        const malformedIdentities = [
            "staging..orbix.internal:5432/orbix_staging",
            "-staging.orbix.internal:5432/orbix_staging",
            "staging-.orbix.internal:5432/orbix_staging",
            "staging-rds.orbix.internal:abc/orbix_staging",
            "staging-rds.orbix.internal:99999/orbix_staging",
            "staging-rds.orbix.internal/db1/db2",
            "/orbix_staging",
            "staging-rds.orbix.internal/",
            "staging rds.internal:5432/orbix_staging",
        ];

        for (const malformed of malformedIdentities) {
            let caught = false;
            try {
                resolveDatabaseConfig({
                    targetEnv: "staging",
                    connectionString: validStagingUrl,
                    expectedIdentity: malformed,
                });
            } catch (err: any) {
                caught = true;
                assert(
                    err.message.includes("malformed or invalid") ||
                    err.message.includes("Incomplete staging destination identity") ||
                    err.message.includes("Database identity mismatch"),
                    `Catches malformed: '${malformed}'`
                );
            }
            assert(caught, `Must reject malformed identity '${malformed}'`);
            assert(matchesExpectedIdentity(parsedValidStaging, malformed) === false, `Direct matcher rejects malformed: '${malformed}'`);
        }
    });

    // 49. Empty and whitespace-only expected identities fail closed
    await test("49. Empty and whitespace-only expected identities fail closed", () => {
        const empties = ["", "   ", "\t", "\n"];
        for (const empty of empties) {
            let caught = false;
            try {
                resolveDatabaseConfig({
                    targetEnv: "staging",
                    connectionString: validStagingUrl,
                    expectedIdentity: empty,
                });
            } catch (err: any) {
                caught = true;
                assert(err.message.includes("requires an explicit expected database identity"), "Fails closed on empty");
            }
            assert(caught, `Must reject empty expected identity '${empty}'`);
            assert(matchesExpectedIdentity(parsedValidStaging, empty) === false, "Direct matcher rejects empty");
        }
    });

    // 50. Forbidden Supabase project identity fails even if supplied as complete expected identity
    await test("50. Forbidden Supabase project identity fails even if supplied as complete expected identity", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("bhixamqnpcbstfwvmmog") && err.message.includes("strictly forbidden"), "Rejects forbidden expected identity");
        }
        assert(caught, "Must fail closed if expected identity specifies forbidden Supabase project");
        assert(matchesExpectedIdentity(parsedValidStaging, "db.bhixamqnpcbstfwvmmog.supabase.co:5432/postgres") === false, "Direct matcher rejects forbidden project");
    });

    // 51. Production destination fails in staging mode even if supplied as complete expected identity
    await test("51. Production destination fails in staging mode even if supplied as complete expected identity", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: validStagingUrl,
                expectedIdentity: "orbix-prod-db.us-east-1.rds.amazonaws.com:5432/orbix_production",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("production database") || err.message.includes("production indicator"), "Rejects production expected identity");
        }
        assert(caught, "Must fail closed if expected identity specifies a production database");
    });

    // 52. Administrator cannot bypass staging safety by configuring production destination as expected identity
    await test("52. Administrator cannot bypass staging safety by configuring production destination as expected identity", () => {
        let caught = false;
        try {
            resolveDatabaseConfig({
                targetEnv: "staging",
                connectionString: "postgresql://user:pass@orbix-prod-db.us-east-1.rds.amazonaws.com:5432/orbix_production",
                expectedIdentity: "orbix-prod-db.us-east-1.rds.amazonaws.com:5432/orbix_production",
            });
        } catch (err: any) {
            caught = true;
            assert(err.message.includes("production database") || err.message.includes("production indicator"), "Rejects production bypass attempt");
        }
        assert(caught, "Production destination must be strictly rejected even if connection URL and expected identity match exactly");
    });

    console.log("\n=================================================");
    console.log(`RESULTS: ${passed} passed, ${failed} failed (Total: ${passed + failed})`);
    console.log("=================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runSecuritySuite().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
