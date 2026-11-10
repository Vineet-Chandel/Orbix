import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import pg from "pg";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Robustly resolve Backend/.env regardless of execution working directory
const backendEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(backendEnvPath)) {
    dotenv.config({ path: backendEnvPath });
} else {
    dotenv.config();
}

import {
    resolveDatabaseConfig,
    type ResolvedDatabaseConfig,
    sanitizeDatabaseError,
    FORBIDDEN_DATABASE_IDENTIFIERS,
    parseDatabaseUrl,
} from "./config.js";

const { Pool } = pg;

export interface MigrationOptions {
    dryRun?: boolean | undefined;
    target?: "staging" | "production" | "development" | "test" | undefined;
    targetFile?: string | undefined;
    adopt?: boolean | undefined;
    confirm?: boolean | undefined;
    migrationsDir?: string | undefined;
    poolOverride?: any;
    stagingUrl?: string | undefined;
    expectedIdentity?: string | undefined;
    env?: Record<string, string | undefined> | undefined;
}

export interface DryRunReport {
    discoveredFiles: string[];
    orderedFiles: string[];
    duplicatePrefixes: Record<string, string[]>;
    missingNumbers: number[];
    invalidFilenames: string[];
    isSequenceValid: boolean;
    baselineBootstrapPresent: boolean;
    statusNotice: string;
}

export interface MigrationResult {
    applied: string[];
    skipped: string[];
    adopted: string[];
    pending: string[];
    dryRunReport?: DryRunReport | undefined;
}

export function sanitizeErrorMessage(msg: string): string {
    return sanitizeDatabaseError(msg);
}

// Explicit schema signature objects used for adoption inspection
export const MIGRATION_SIGNATURES: Record<string, { tables?: string[]; columns?: string[] }> = {
    "001_institutions_schema.sql": {
        tables: ["institutions", "institution_regulatory_ids", "institution_sources", "institution_verification_requests"],
    },
    "002_expand_institutions_directory.sql": {
        tables: ["institution_aliases", "institution_rankings"],
    },
    "003_club_verification_requests.sql": {
        tables: ["club_verification_requests"],
    },
    "004_relationships_blocks_notifications.sql": {
        tables: ["user_relationships", "user_blocks"],
    },
    "005_relationship_block_quotas.sql": {
        tables: ["user_relationship_action_logs"],
    },
    "006_verified_clubs_timeline_events.sql": {
        tables: ["club_verification_timeline_events", "verified_clubs", "club_events"],
    },
    "007_help_center_tickets.sql": {
        tables: ["help_tickets", "help_ticket_messages"],
    },
    "008_club_verified_college_fk.sql": {
        columns: ["verified_clubs.college_id"],
    },
    "009_club_phone_verification.sql": {
        tables: ["phone_verification_otps"],
    },
    "010_firebase_phone_auth.sql": {
        columns: ["users.phone_confirmed_at", "club_verification_requests.contact_phone"],
    },
    "011_manage_accounts_system.sql": {
        tables: ["account_change_operations", "account_change_challenges", "account_change_history"],
    },
    "012_account_data_exports.sql": {
        tables: ["account_data_exports"],
    },
    "013_club_unique_credentials_and_slugs.sql": {
        tables: ["verified_clubs"],
    },
    "014_remove_timeline_and_auto_enforce_verified_clubs.sql": {
        tables: ["verified_clubs"],
    },
    "015_club_inbox_and_moderation.sql": {
        tables: ["club_conversations", "club_messages", "club_user_moderation", "club_message_action_logs", "club_event_registrations"],
    },
    "016_add_two_factor_auth.sql": {
        columns: ["users.is_two_factor_enabled", "users.two_factor_enabled_at"],
    },
    "017_club_team_management.sql": {
        tables: ["club_teams", "club_memberships", "club_team_members", "club_team_invitations"],
    },
    "019_club_profile_management.sql": {
        tables: ["club_coordinators", "club_achievements"],
    },
    "020_blog_likes.sql": {
        tables: ["blog_likes"],
    },
    "020_settings_governance_system.sql": {
        tables: ["help_faqs", "help_faq_feedback", "help_ticket_attachments", "user_privacy_preferences", "account_deletion_requests", "account_statuses", "account_entitlements"],
    },
    "021_login_activity_and_sessions.sql": {
        tables: ["user_sessions", "club_access_events", "account_security_events"],
    },
    "022_club_profile_redesign.sql": {
        columns: ["verified_clubs.links"],
    },
    "023_college_events_and_applications.sql": {
        tables: ["club_event_likes"],
    },
    "024_oauth_authentication.sql": {
        columns: ["users.google_id", "users.github_id", "users.auth_provider"],
    },
    "025_update_club_events_location_type.sql": {
        tables: ["club_events"],
    },
    "026_club_events_completed_status.sql": {
        tables: ["club_events"],
    },
    "027_club_category_cooldown.sql": {
        columns: ["verified_clubs.category_updated_at"],
    },
    "028_club_certificates.sql": {
        tables: ["club_certificates"],
    },
    "029_event_applications_approval_workflow.sql": {
        columns: ["club_event_registrations.reviewed_by_user_id"],
    },
    "030_legal_consent_and_minor_protection.sql": {
        tables: ["user_legal_consents"],
    },
    "031_college_verifications.sql": {
        tables: ["college_verifications", "college_verification_email_tokens", "college_verification_phone_otps"],
        columns: ["users.is_college_verified", "users.college_verified_at"],
    },
};

/**
 * Performs static migration discovery, numbering analysis, and structure validation.
 * PURE OFFLINE FUNCTION: ZERO DATABASE POOL OR NETWORK CALLS.
 */
export function performStaticMigrationAnalysis(migrationsDir: string, targetFile?: string | undefined): DryRunReport {
    if (!fs.existsSync(migrationsDir)) {
        throw new Error(`Migrations directory not found: ${migrationsDir}`);
    }

    const allFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql"));

    // Check invalid filenames: must strictly follow format \d{3}_[a-z0-9_]+\.sql
    const validFilenamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
    const invalidFilenames = allFiles.filter((f) => !validFilenamePattern.test(f));

    // Natural numeric sorting
    const orderedFiles = [...allFiles].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    // Group files by prefix to detect duplicates
    const prefixMap = new Map<string, string[]>();
    for (const f of allFiles) {
        const prefix = f.split("_")[0] || "";
        if (!prefixMap.has(prefix)) {
            prefixMap.set(prefix, []);
        }
        prefixMap.get(prefix)!.push(f);
    }

    const duplicatePrefixes: Record<string, string[]> = {};
    for (const [prefix, list] of prefixMap.entries()) {
        if (list.length > 1) {
            duplicatePrefixes[prefix] = list;
        }
    }

    // Detect missing numbers in sequence
    const parsedNumbers = allFiles
        .map((f) => parseInt(f.split("_")[0] || "", 10))
        .filter((n) => !isNaN(n));

    const minNum = 1;
    const maxNum = parsedNumbers.length > 0 ? Math.max(...parsedNumbers) : 0;
    const numSet = new Set(parsedNumbers);
    const missingNumbers: number[] = [];

    for (let i = minNum; i <= maxNum; i++) {
        if (!numSet.has(i)) {
            missingNumbers.push(i);
        }
    }

    // Check baseline bootstrap schema existence
    const baselineBootstrapPresent = fs.existsSync(
        path.join(path.dirname(migrationsDir), "bootstrap_baseline.sql")
    );

    const isSequenceValid = invalidFilenames.length === 0;

    let discoveredFiles = orderedFiles;
    if (targetFile) {
        const exactMatch = orderedFiles.find((f) => f === targetFile);
        if (!exactMatch) {
            throw new Error(
                `Target migration file not found: ${targetFile}. Strict exact filename match required.`
            );
        }
        discoveredFiles = [exactMatch];
    }

    return {
        discoveredFiles,
        orderedFiles,
        duplicatePrefixes,
        missingNumbers,
        invalidFilenames,
        isSequenceValid,
        baselineBootstrapPresent,
        statusNotice:
            "[Dry-Run Offline Mode] Migrations discovered and validated statically. No database connection opened; live database schema has NOT been verified.",
    };
}

/**
 * Main migration execution function.
 * Enforces fail-closed destination identity checks before connecting or executing queries.
 */
export async function runMigrations(options: MigrationOptions = {}): Promise<MigrationResult> {
    const isDryRun = options.dryRun || process.argv.includes("--dry-run");
    const isAdopt = options.adopt || process.argv.includes("--adopt");
    const isConfirm = options.confirm || process.argv.includes("--confirm");

    const targetArg = options.targetFile || process.argv.find((a) => a.startsWith("--file="))?.split("=")[1];
    const targetFile = targetArg ? path.basename(targetArg.trim()) : undefined;

    const migrationsDir = options.migrationsDir || path.join(__dirname, "migrations");

    // =========================================================================
    // 1. PURE OFFLINE DRY-RUN (ZERO DATABASE / NETWORK ACTIVITY)
    // =========================================================================
    if (isDryRun) {
        console.log("=================================================");
        console.log("🔍 ORBIX MIGRATION RUNNER — OFFLINE DRY-RUN");
        console.log("   (Static Discovery & Structural Sequence Check)");
        console.log("=================================================\n");

        const report = performStaticMigrationAnalysis(migrationsDir, targetFile);

        console.log(`Discovered ${report.discoveredFiles.length} migration file(s) in deterministic order:`);
        report.discoveredFiles.forEach((f, idx) => {
            console.log(`  ${idx + 1}. ${f}`);
        });

        if (Object.keys(report.duplicatePrefixes).length > 0) {
            console.log("\n⚠️ Detected duplicate migration prefix(es):");
            for (const [prefix, files] of Object.entries(report.duplicatePrefixes)) {
                console.log(`   Prefix '${prefix}': ${files.join(", ")}`);
            }
        }

        if (report.missingNumbers.length > 0) {
            console.log("\n⚠️ Missing migration number(s) in sequence:");
            console.log(`   ${report.missingNumbers.map((n) => String(n).padStart(3, "0")).join(", ")}`);
        }

        if (report.invalidFilenames.length > 0) {
            console.error("\n❌ Invalid migration filename(s) detected:");
            console.error(`   ${report.invalidFilenames.join(", ")}`);
        }

        console.log(`\nBootstrap baseline schema present: ${report.baselineBootstrapPresent ? "YES" : "NO"}`);
        console.log(`\n📢 ${report.statusNotice}`);
        console.log("[Dry-Run] Skipped actual execution of pending migrations. (0 database writes performed)\n");

        return {
            applied: [],
            skipped: [],
            adopted: [],
            pending: report.discoveredFiles,
            dryRunReport: report,
        };
    }

    // =========================================================================
    // 2. FAIL-CLOSED DESTINATION & TARGET VERIFICATION
    // =========================================================================
    const env = options.env || process.env;
    const cliTarget = process.argv.find((a) => a.startsWith("--target="))?.split("=")[1]?.trim();
    const explicitTarget = options.target || cliTarget;
    const isStagingEnv = (env.TARGET_ENV || env.APP_ENV || env.ORBIX_ENV || env.NODE_ENV || "").toLowerCase() === "staging";

    if (isStagingEnv && explicitTarget !== "staging") {
        throw new Error(
            "Explicit --target=staging flag is strictly required when executing migrations in staging mode."
        );
    }

    const resolvedTarget = (explicitTarget || env.TARGET_ENV || env.APP_ENV || env.ORBIX_ENV || env.NODE_ENV || "").toLowerCase();

    // Staging mode enforcement
    if (resolvedTarget === "staging") {
        const stagingUrl = options.stagingUrl ?? env.STAGING_DATABASE_URL;
        if (!stagingUrl || !stagingUrl.trim()) {
            throw new Error(
                "Staging migration execution rejected: STAGING_DATABASE_URL must be explicitly configured. Connecting to shared Supabase or fallback DATABASE_URL is strictly prohibited."
            );
        }

        const expectedIdentity = options.expectedIdentity ?? env.EXPECTED_STAGING_DB_IDENTITY ?? env.STAGING_DB_IDENTITY;
        if (!expectedIdentity || !expectedIdentity.trim()) {
            throw new Error(
                "Staging migration execution rejected: EXPECTED_STAGING_DB_IDENTITY must be explicitly configured."
            );
        }

        // Validate via central configuration resolver
        resolveDatabaseConfig({
            targetEnv: "staging",
            connectionString: stagingUrl,
            expectedIdentity,
            env: options.env,
        });
    } else if (!options.poolOverride) {
        // Global check: refuse shared Supabase in all migration executions
        const effectiveUrl = options.stagingUrl ?? env.SUPABASE_DB_URL ?? env.DATABASE_URL ?? "";
        if (effectiveUrl) {
            try {
                const parsed = parseDatabaseUrl(effectiveUrl);
                for (const forbidden of FORBIDDEN_DATABASE_IDENTIFIERS) {
                    if (
                        parsed.host.includes(forbidden) ||
                        parsed.database.includes(forbidden) ||
                        parsed.username.includes(forbidden) ||
                        parsed.rawUrl.toLowerCase().includes(forbidden)
                    ) {
                        throw new Error(
                            `Migration execution rejected: Connecting to the shared Supabase database (${forbidden}) is strictly forbidden for migration execution.`
                        );
                    }
                }
            } catch (parseErr: any) {
                if (parseErr.message.includes("forbidden")) {
                    throw parseErr;
                }
            }
        }
    }

    // =========================================================================
    // 3. SECURE CONNECTION POOL SETUP
    // =========================================================================
    let activePool = options.poolOverride;
    let poolCreatedInternally = false;

    if (!activePool) {
        const stagingConnStr = resolvedTarget === "staging" ? (options.stagingUrl ?? env.STAGING_DATABASE_URL) : undefined;
        const stagingExpId = resolvedTarget === "staging" ? (options.expectedIdentity ?? env.EXPECTED_STAGING_DB_IDENTITY) : undefined;

        const dbConfig: ResolvedDatabaseConfig = resolveDatabaseConfig({
            targetEnv: resolvedTarget === "staging" ? "staging" : undefined,
            connectionString: stagingConnStr,
            expectedIdentity: stagingExpId,
            env: options.env,
        });

        activePool = new Pool({
            connectionString: dbConfig.connectionString,
            connectionTimeoutMillis: 20000,
            idleTimeoutMillis: 60000,
            max: 5,
            ssl: dbConfig.ssl,
        });
        poolCreatedInternally = true;
    }

    try {
        const result: MigrationResult = {
            applied: [],
            skipped: [],
            adopted: [],
            pending: [],
        };

        if (!fs.existsSync(migrationsDir)) {
            throw new Error(`Migrations directory not found: ${migrationsDir}`);
        }

        // 1. Deterministic dependency order using natural numeric sorting
        let files = fs
            .readdirSync(migrationsDir)
            .filter((f) => f.endsWith(".sql"))
            .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));

        // 2. Exact --file matching with path traversal prevention
        if (targetFile) {
            const exactMatch = files.find((f) => f === targetFile);
            if (!exactMatch) {
                const err = new Error(
                    `Target migration file not found: ${targetFile}. Strict exact filename match required.`
                );
                console.error(`❌ ${err.message}`);
                throw err;
            }
            files = [exactMatch];
        }

        // 3. Schema Migrations Ledger
        await activePool.query(`
            CREATE TABLE IF NOT EXISTS public.schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
        `);
        const appliedRes = await activePool.query(`SELECT version FROM public.schema_migrations;`);
        const appliedVersions = new Set(appliedRes.rows.map((r: any) => r.version));

        result.skipped = files.filter((f) => appliedVersions.has(f));
        const pendingFiles = files.filter((f) => !appliedVersions.has(f));
        result.pending = [...pendingFiles];

        // 4. Adoption Mode: Inspection & Safe Retrofit
        if (isAdopt) {
            console.log(`[Adoption Mode] Inspecting database schema for ${pendingFiles.length} unrecorded migration(s)...`);

            const tablesRes = await activePool.query(
                `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';`
            );
            const existingTables = new Set<string>(tablesRes.rows.map((r: any) => String(r.table_name).toLowerCase()));

            const colsRes = await activePool.query(
                `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public';`
            );
            const existingCols = new Set<string>(
                colsRes.rows.map((r: any) => `${String(r.table_name).toLowerCase()}.${String(r.column_name).toLowerCase()}`)
            );

            const adoptable: string[] = [];
            const divergent: string[] = [];

            for (const file of pendingFiles) {
                const sig = MIGRATION_SIGNATURES[file];
                if (!sig) {
                    divergent.push(file);
                    continue;
                }

                const tablesMatch = (sig.tables || []).every((t) => existingTables.has(t.toLowerCase()));
                const colsMatch = (sig.columns || []).every((c) => existingCols.has(c.toLowerCase()));

                if (tablesMatch && colsMatch) {
                    adoptable.push(file);
                } else {
                    divergent.push(file);
                }
            }

            console.log(`\nAdoption Inspection Report:`);
            console.log(`- Verified Adoptable (${adoptable.length}): ${adoptable.join(", ") || "none"}`);
            console.log(`- Divergent / Pending (${divergent.length}): ${divergent.join(", ") || "none"}`);

            if (!isConfirm) {
                console.log("\n⚠️ [Adoption Inspection Only] No records were written to schema_migrations.");
                console.log(
                    "To record these verified migrations into public.schema_migrations without executing DDL, re-run with: --adopt --confirm\n"
                );
                return result;
            }

            // Perform adoption writes with advisory lock
            const lockClient = await activePool.connect();
            try {
                const lockRes = await lockClient.query(
                    `SELECT pg_try_advisory_lock(hashtext('orbix_schema_migrations_lock')) AS acquired;`
                );
                if (!lockRes.rows[0]?.acquired) {
                    throw new Error(
                        "Another migration runner process is currently executing. Aborting adoption to prevent race conditions."
                    );
                }

                const adoptClient = await activePool.connect();
                try {
                    await adoptClient.query("BEGIN;");
                    for (const file of adoptable) {
                        await adoptClient.query(
                            `INSERT INTO public.schema_migrations (version, applied_at) VALUES ($1, CURRENT_TIMESTAMP)
                             ON CONFLICT (version) DO NOTHING;`,
                            [file]
                        );
                        result.adopted.push(file);
                        console.log(`✅ [Adopted] ${file} recorded in schema_migrations without executing DDL.`);
                    }
                    await adoptClient.query("COMMIT;");
                    console.log(`Successfully adopted ${result.adopted.length} migration(s).`);
                } catch (adoptErr: any) {
                    try {
                        await adoptClient.query("ROLLBACK;");
                    } catch {}
                    throw adoptErr;
                } finally {
                    adoptClient.release();
                }
            } finally {
                try {
                    await lockClient.query(`SELECT pg_advisory_unlock(hashtext('orbix_schema_migrations_lock'));`);
                } catch {}
                lockClient.release();
            }

            return result;
        }

        if (pendingFiles.length === 0) {
            console.log("No pending migrations. Database schema is completely up to date.");
            return result;
        }

        console.log(`Found ${pendingFiles.length} pending migration(s): ${pendingFiles.join(", ")}`);

        // 5. Concurrent Runner Advisory Lock
        const lockClient = await activePool.connect();
        try {
            const lockRes = await lockClient.query(
                `SELECT pg_try_advisory_lock(hashtext('orbix_schema_migrations_lock')) AS acquired;`
            );
            if (!lockRes.rows[0]?.acquired) {
                throw new Error(
                    "Another migration runner process is currently executing. Aborting to prevent race conditions."
                );
            }

            // 6. Transactional Migration Execution with immediate Rollback on failure
            for (const file of pendingFiles) {
                const sqlPath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(sqlPath, "utf-8");
                console.log(`Applying migration: ${file}...`);

                const client = await activePool.connect();
                try {
                    await client.query("BEGIN;");
                    await client.query(sql);
                    await client.query(
                        `INSERT INTO public.schema_migrations (version, applied_at) VALUES ($1, CURRENT_TIMESTAMP)
                         ON CONFLICT (version) DO NOTHING;`,
                        [file]
                    );
                    await client.query("COMMIT;");
                    result.applied.push(file);
                    console.log(`✅ ${file} applied and recorded successfully!`);
                } catch (fileErr: any) {
                    try {
                        await client.query("ROLLBACK;");
                    } catch {}
                    const safeMsg = sanitizeErrorMessage(fileErr.message);
                    console.error(`❌ Migration failed in ${file}: ${safeMsg}`);
                    throw new Error(`Migration ${file} failed: ${safeMsg}`);
                } finally {
                    client.release();
                }
            }

            console.log("All pending migrations applied successfully!");
        } finally {
            try {
                await lockClient.query(`SELECT pg_advisory_unlock(hashtext('orbix_schema_migrations_lock'));`);
            } catch {}
            lockClient.release();
        }

        return result;
    } finally {
        if (poolCreatedInternally && activePool) {
            try {
                await activePool.end();
            } catch {}
        }
    }
}

// Auto-execute only when invoked directly as CLI script
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    runMigrations()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("Migration execution aborted:", sanitizeErrorMessage(err.message));
            process.exit(1);
        });
}
