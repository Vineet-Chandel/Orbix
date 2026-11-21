import { query as defaultQuery } from "../database/client.js";

/**
 * ============================================================================
 * ORBIX ENTERPRISE USERNAME & HANDLE POLICY ENGINE
 * ============================================================================
 * Centralized, authoritative handle validation & collision-prevention engine.
 *
 * Enforces:
 * 1. Demo Profile Immunity:
 *    Prevents any user or club from registering or updating to the demo profile
 *    handle ("vineet-chandel", "demo", "demo-profile") or demo variants
 *    ("demo-vineet-chandel", "vineet-chandel-demo").
 *
 * 2. Demo Club Immunity:
 *    Prevents any club or user from registering or updating to the demo club
 *    slug ("acm-psit", "demo-club", "acm", "acm-student-chapter") or variants.
 *
 * 3. System Namespace Protection:
 *    Guarantees platform infrastructure, routing, and brand terms (e.g. "admin",
 *    "api", "auth", "orbix", "support") cannot be hijacked.
 *
 * 4. Cross-Entity Handle Exclusivity:
 *    Ensures handles are strictly unique across personal users and verified clubs.
 *    A personal user cannot take an active club's slug, and a club cannot take
 *    an active user's username.
 * ============================================================================
 */

// 1. Exact match protected lists
export const DEMO_PROFILE_EXACT = new Set([
    "vineet-chandel",
    "demo",
    "demo-profile",
    "demoprofile",
    "demo_profile",
    "demo-user",
    "demouser",
    "demo_user",
    "demo-account",
    "demoaccount",
    "demo_account",
    "demo-vineet-chandel",
    "vineet-chandel-demo",
]);

export const DEMO_CLUB_EXACT = new Set([
    "aws-swg-psit",
    "aws_swg_psit",
    "awsswgpsit",
    "aws.swg.psit",
    "aws-psit",
    "aws_psit",
    "awspsit",
    "aws-swg",
    "aws_swg",
    "awsswg",
    "psit-aws",
    "psitaws",
    "aws-student-work-group",
    "awsstudentworkgroup",
    "acm-psit",
    "acm_psit",
    "acmpsit",
    "acm.psit",
    "demo-club",
    "democlub",
    "demo_club",
    "acm",
    "acm-student-chapter",
    "acmstudentchapter",
    "psit-acm",
    "psitacm",
]);

// 2. Collapsed roots (stripped of '.', '-', '_') to catch all permutations
export const DEMO_PROFILE_COLLAPSED_ROOTS = [
    "demoprofile",
    "demouser",
    "demoaccount",
];

export const DEMO_CLUB_COLLAPSED_ROOTS = [
    "awsswgpsit",
    "awspsit",
    "awsswg",
    "psitaws",
    "acmpsit",
    "democlub",
    "acmstudentchapter",
    "psitacm",
];

// 3. System reserved routes and namespaces
export const SYSTEM_RESERVED_NAMES = new Set([
    // Administrative & Security
    "admin",
    "administrator",
    "root",
    "system",
    "superuser",
    "superadmin",
    "moderator",
    "moderation",
    "reviewer",
    "security",
    "toor",
    "null",
    "undefined",
    "void",
    "guest",
    "anonymous",

    // Orbix Brand & Platform
    "orbix",
    "theorbix",
    "orbixworld",
    "theorbixworld",
    "orbix-official",
    "orbixofficial",
    "official",
    "orbixteam",
    "orbixdev",
    "orbixapp",
    "orbix-support",

    // Authentication & Core API Routes
    "api",
    "auth",
    "oauth",
    "signup",
    "signin",
    "login",
    "logout",
    "register",
    "verification",
    "verify",
    "callback",
    "session",
    "sessions",
    "token",
    "otp",
    "password",
    "reset-password",
    "forgot-password",

    // Core Domain Entities
    "club",
    "clubs",
    "college",
    "colleges",
    "institution",
    "institutions",
    "user",
    "users",
    "profile",
    "profiles",
    "account",
    "accounts",
    "leaderboard",
    "leaderboards",
    "event",
    "events",
    "team",
    "teams",
    "portal",
    "portals",
    "project",
    "projects",
    "resume",
    "resumes",
    "badge",
    "badges",
    "member",
    "members",

    // App Navigation & Services
    "dashboard",
    "settings",
    "manage-account",
    "inbox",
    "notifications",
    "feed",
    "explore",
    "blog",
    "docs",
    "documentation",
    "support",
    "help",
    "contact",
    "status",
    "legal",
    "terms",
    "privacy",
    "faq",
    "about",
    "careers",
    "jobs",
    "billing",
    "pricing",
    "onboarding",
    "webhook",
    "webhooks",

    // Dynamic Reserved Route Segments
    "check-availability",
    "session-state",
    "application-status",
    "public-events",
    "college-events",
    "college-clubs",
    "public",
]);

/**
 * Normalizes handle string: lowercase and trim.
 */
export function normalizeHandle(handle: string): string {
    return typeof handle === "string" ? handle.trim().toLowerCase() : "";
}

/**
 * Collapses handle by removing all delimiters (hyphens, underscores, dots, spaces).
 * Used for aggressive permutation detection (e.g. "v-i-n-e-e-t_chandel" -> "vineetchandel").
 */
export function collapseHandle(handle: string): string {
    return normalizeHandle(handle).replace(/[-_.\s]/g, "");
}

/**
 * Checks if a handle collides with the Orbix demo profile namespace.
 */
export function isDemoProfileHandle(handle: string): boolean {
    const clean = normalizeHandle(handle);
    if (!clean) return false;

    if (clean === "demo") return true;
    if (DEMO_PROFILE_EXACT.has(clean)) return true;

    const collapsed = collapseHandle(clean);
    if (collapsed === "demo") return true;

    for (const root of DEMO_PROFILE_COLLAPSED_ROOTS) {
        if (collapsed === root || collapsed.startsWith(root) || collapsed.endsWith(root)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a handle collides with the official demo club namespace.
 */
export function isDemoClubHandle(handle: string): boolean {
    const clean = normalizeHandle(handle);
    if (!clean) return false;

    if (DEMO_CLUB_EXACT.has(clean)) return true;

    const collapsed = collapseHandle(clean);
    for (const root of DEMO_CLUB_COLLAPSED_ROOTS) {
        if (collapsed === root || collapsed.startsWith(root) || collapsed.endsWith(root)) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a handle is a reserved system route or platform keyword.
 */
export function isSystemReservedHandle(handle: string): boolean {
    const clean = normalizeHandle(handle);
    if (!clean) return false;

    if (SYSTEM_RESERVED_NAMES.has(clean)) return true;

    const collapsed = collapseHandle(clean);
    return SYSTEM_RESERVED_NAMES.has(collapsed);
}

export interface HandleFormatResult {
    valid: boolean;
    normalized: string;
    reason?: string | undefined;
}

/**
 * Validates canonical handle format:
 * - 3 to 20 characters
 * - Only a-z, 0-9, dot (.), underscore (_), hyphen (-)
 * - Cannot start or end with a special character
 * - Cannot have consecutive special characters
 */
export function validateHandleFormat(handle: string): HandleFormatResult {
    const clean = normalizeHandle(handle);
    if (!clean) {
        return { valid: false, normalized: "", reason: "Handle cannot be empty." };
    }

    if (clean.length < 3 || clean.length > 20) {
        return {
            valid: false,
            normalized: clean,
            reason: "Handle must be between 3 and 20 characters long.",
        };
    }

    if (!/^[a-z0-9._-]+$/.test(clean)) {
        return {
            valid: false,
            normalized: clean,
            reason: "Handle can only contain lowercase letters, numbers, dot (.), underscore (_), or hyphen (-).",
        };
    }

    if (/^[._-]|[._-]$/.test(clean)) {
        return {
            valid: false,
            normalized: clean,
            reason: "Handle cannot start or end with a special character (., _, -).",
        };
    }

    if (/[._-]{2,}/.test(clean)) {
        return {
            valid: false,
            normalized: clean,
            reason: "Handle cannot contain consecutive special characters.",
        };
    }

    return { valid: true, normalized: clean };
}

export interface HandleAvailabilityResult {
    available: boolean;
    normalized: string;
    reason?: string | undefined;
    code?:
        | "INVALID_FORMAT"
        | "DEMO_PROFILE_RESERVED"
        | "DEMO_CLUB_RESERVED"
        | "SYSTEM_RESERVED"
        | "USER_EXISTS"
        | "CLUB_EXISTS"
        | "PENDING_CLUB_EXISTS"
        | "ANTI_IMPERSONATION_HOLD"
        | undefined;
}

/**
 * Fast synchronous check against static rules (format, demo profile, demo club, system reserved).
 * Used in synchronous form validators before database calls.
 */
export function checkStaticHandleAvailability(
    handle: string,
    entityType: "user" | "club" = "user"
): HandleAvailabilityResult {
    const formatCheck = validateHandleFormat(handle);
    if (!formatCheck.valid) {
        return {
            available: false,
            normalized: formatCheck.normalized,
            reason: formatCheck.reason,
            code: "INVALID_FORMAT",
        };
    }

    const clean = formatCheck.normalized;

    // 1. Demo Profile Check
    if (isDemoProfileHandle(clean)) {
        return {
            available: false,
            normalized: clean,
            reason: `The username '${clean}' is reserved for the Orbix demo profile and cannot be registered.`,
            code: "DEMO_PROFILE_RESERVED",
        };
    }

    // 2. Demo Club Check
    if (isDemoClubHandle(clean)) {
        return {
            available: false,
            normalized: clean,
            reason: `The handle '${clean}' is reserved for the official demo club showcase and cannot be registered.`,
            code: "DEMO_CLUB_RESERVED",
        };
    }

    // 3. System Reserved Check
    if (isSystemReservedHandle(clean)) {
        return {
            available: false,
            normalized: clean,
            reason: `The handle '${clean}' is a reserved platform keyword and cannot be used.`,
            code: "SYSTEM_RESERVED",
        };
    }

    return { available: true, normalized: clean };
}

export interface PlatformAvailabilityOptions {
    entityType?: "user" | "club";
    currentUserId?: string;
    currentClubId?: string;
    client?: any; // optional pg Client for transactional queries
}

/**
 * Authoritative platform-wide handle availability check.
 * Checks format, demo profile, demo club, system keywords, users table,
 * verified_clubs table, club_verification_requests table, and anti-impersonation history.
 */
export async function checkHandleAvailabilityAcrossPlatform(
    handle: string,
    options: PlatformAvailabilityOptions = {}
): Promise<HandleAvailabilityResult> {
    const { entityType = "user", currentUserId, currentClubId, client } = options;
    const executeQuery = client ? client.query.bind(client) : defaultQuery;

    // 1. Static validation (Format + Demo Profile + Demo Club + System Reserved)
    const staticCheck = checkStaticHandleAvailability(handle, entityType);
    if (!staticCheck.available) {
        return staticCheck;
    }

    const clean = staticCheck.normalized;

    try {
        // 2. Check collision with existing users in users table
        let userCheckSql = `SELECT id, username, account_type FROM users WHERE LOWER(username) = LOWER($1)`;
        const userParams: any[] = [clean];
        if (currentUserId) {
            userCheckSql += ` AND id != $2`;
            userParams.push(currentUserId);
        }
        userCheckSql += ` LIMIT 1;`;

        const userConflict = await executeQuery(userCheckSql, userParams);
        if (userConflict.rows.length > 0) {
            const conflictUser = userConflict.rows[0];
            const isClubAccount = conflictUser.account_type === "club";
            return {
                available: false,
                normalized: clean,
                reason: isClubAccount
                    ? "This handle is already registered to a verified club account."
                    : "This username is already taken by a registered user. Please choose another username.",
                code: "USER_EXISTS",
            };
        }

        // 3. Check collision with existing clubs in verified_clubs table (slug)
        let clubCheckSql = `SELECT id, name, slug FROM verified_clubs WHERE LOWER(slug) = LOWER($1)`;
        const clubParams: any[] = [clean];
        if (currentClubId) {
            clubCheckSql += ` AND id != $2`;
            clubParams.push(currentClubId);
        } else if (currentUserId) {
            clubCheckSql += ` AND auth_user_id != $2`;
            clubParams.push(currentUserId);
        }
        clubCheckSql += ` LIMIT 1;`;

        const clubConflict = await executeQuery(clubCheckSql, clubParams);
        if (clubConflict.rows.length > 0) {
            return {
                available: false,
                normalized: clean,
                reason: `This handle is already registered to verified club "${clubConflict.rows[0].name}". Please choose another handle.`,
                code: "CLUB_EXISTS",
            };
        }

        // 4. Check collision with pending club registration applications
        const pendingCheckSql = `
            SELECT id, club_name, status 
            FROM club_verification_requests 
            WHERE LOWER(club_name) = LOWER($1) 
              AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion')
            LIMIT 1;
        `;
        const pendingConflict = await executeQuery(pendingCheckSql, [clean]);
        if (pendingConflict.rows.length > 0) {
            return {
                available: false,
                normalized: clean,
                reason: `This handle is currently associated with an active club registration application for "${pendingConflict.rows[0].club_name}".`,
                code: "PENDING_CLUB_EXISTS",
            };
        }

        // 5. Anti-impersonation cooldown: check recently released handles (7 days)
        if (currentUserId) {
            const historySql = `
                SELECT id FROM account_change_history
                WHERE change_type = 'username' AND LOWER(old_value) = LOWER($1) AND user_id != $2
                  AND created_at >= NOW() - INTERVAL '7 days'
                LIMIT 1;
            `;
            const historyConflict = await executeQuery(historySql, [clean, currentUserId]);
            if (historyConflict.rows.length > 0) {
                return {
                    available: false,
                    normalized: clean,
                    reason: "This handle was recently released and is temporarily on anti-impersonation hold.",
                    code: "ANTI_IMPERSONATION_HOLD",
                };
            }
        }

        return {
            available: true,
            normalized: clean,
        };
    } catch (err: any) {
        console.error("Handle availability check database error:", err);
        // Fail-safe: re-throw or fail-closed if db error
        throw err;
    }
}
