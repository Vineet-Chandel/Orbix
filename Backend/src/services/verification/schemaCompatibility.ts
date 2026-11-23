/**
 * ORBIX PLATFORM ACCOUNT OWNERSHIP VERIFICATION - SCHEMA COMPATIBILITY UTILITY
 * 
 * Manages backward-compatible database queries between pre-migration and
 * post-migration (Migration 069) database environments.
 * 
 * Guarantees:
 * 1. Checks dynamically if Migration 069 has been applied (cached with lazy TTL).
 * 2. In post-migration environments, strictly enforces `ownership_status = 'VERIFIED'`.
 * 3. In pre-migration environments, ownership checks fail closed and verification stays unavailable.
 * 4. Never allows client-supplied overrides or unproven handles to bypass verification.
 */

import { query } from "../../database/client.js";

interface SchemaState {
    checkedAt: number;
    hasOwnershipStatusColumn: boolean;
    hasChallengesTable: boolean;
}

let cachedSchemaState: SchemaState | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute cache TTL
let schemaInspection: Promise<VerificationSchemaStatus> | null = null;
interface VerificationSchemaStatus {
    isMigrated: boolean;
    hasOwnershipStatusColumn: boolean;
    hasChallengesTable: boolean;
}

/**
 * Checks whether Migration 069 is applied to the active database.
 */
async function inspectVerificationSchemaStatus(): Promise<VerificationSchemaStatus> {
    const now = Date.now();
    const ttl = cachedSchemaState?.hasOwnershipStatusColumn && cachedSchemaState?.hasChallengesTable ? CACHE_TTL_MS : 5_000;
    if (cachedSchemaState && now - cachedSchemaState.checkedAt < ttl) {
        return {
            isMigrated: cachedSchemaState.hasOwnershipStatusColumn && cachedSchemaState.hasChallengesTable,
            hasOwnershipStatusColumn: cachedSchemaState.hasOwnershipStatusColumn,
            hasChallengesTable: cachedSchemaState.hasChallengesTable,
        };
    }

    try {
        const colCheck = await query(`
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'user_links' 
              AND column_name = 'ownership_status'
            LIMIT 1;
        `);
        const hasCol = colCheck.rows.length > 0;

        const tableCheck = await query(`
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_name = 'platform_verification_challenges'
            LIMIT 1;
        `);
        const hasTbl = tableCheck.rows.length > 0;

        cachedSchemaState = {
            checkedAt: now,
            hasOwnershipStatusColumn: hasCol,
            hasChallengesTable: hasTbl,
        };

        return {
            isMigrated: hasCol && hasTbl,
            hasOwnershipStatusColumn: hasCol,
            hasChallengesTable: hasTbl,
        };
    } catch (err) {
        console.warn("[SchemaCompatibility] Verification schema inspection unavailable; refusing verification.");
        cachedSchemaState = { checkedAt: now, hasOwnershipStatusColumn: false, hasChallengesTable: false };
        return {
            isMigrated: false,
            hasOwnershipStatusColumn: false,
            hasChallengesTable: false,
        };
    }
}

// Coalesce concurrent checks on each replica instead of querying metadata per user.
export async function checkVerificationSchemaStatus(): Promise<VerificationSchemaStatus> {
    if (!schemaInspection) {
        schemaInspection = inspectVerificationSchemaStatus().finally(() => { schemaInspection = null; });
    }
    return schemaInspection;
}

export function verificationSchemaRequiredError(): Error & { code: string; statusCode: number } {
    return Object.assign(new Error("Account verification is temporarily unavailable. Please try again later."), {
        code: "MIGRATION_REQUIRED", statusCode: 503,
    });
}

export async function assertVerificationSchemaReady(): Promise<void> {
    if (!(await checkVerificationSchemaStatus()).isMigrated) throw verificationSchemaRequiredError();
}

/**
 * Resets the cached schema state (used in tests after applying migrations).
 */
export function resetSchemaStateCache(): void {
    cachedSchemaState = null;
}

/**
 * Returns SQL WHERE clause fragment ensuring only ownership-verified accounts are retrieved.
 * 
 * @param tableAlias Optional table alias (e.g. 'ul' -> 'ul.ownership_status = ...')
 */
export async function getVerifiedLinksCondition(tableAlias?: string): Promise<string> {
    const { hasOwnershipStatusColumn } = await checkVerificationSchemaStatus();
    const prefix = tableAlias ? `${tableAlias}.` : "";

    if (hasOwnershipStatusColumn) {
        return `${prefix}ownership_status = 'VERIFIED'`;
    }

    // Fail-closed security boundary: Prior to Migration 069, legacy 'verified = true'
    // indicated only that an account existed/synced, NEVER that ownership was proven.
    // Migration 069 demotes legacy records precisely because legacy verification was unproven.
    // Therefore, trust-sensitive consumers must fail closed (return '1 = 0') and exclude
    // all external accounts from ownership-dependent attribution until Migration 069 is applied.
    return "1 = 0";
}
