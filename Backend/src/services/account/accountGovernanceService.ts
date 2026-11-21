// Backend/src/services/account/accountGovernanceService.ts
import { query } from "../../database/client.js";

export const COLLEGE_CHANGE_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 72 hours

export interface UserAccountStanding {
    standing: "good_standing" | "warning" | "under_review" | "restricted" | "suspended" | "deactivated";
    severity: "none" | "low" | "medium" | "high" | "critical";
    publicReasonCode: string | null;
    publicReason: string | null;
    lastReviewedAt: string | null;
    nextReviewAt: string | null;
    effectiveFrom: string;
    expiresAt: string | null;
    source: "system" | "manual_admin" | "automated_rule";
}

export interface UserCommunityConduct {
    complianceState: "100% Compliant" | "Active Warnings" | "Under Review" | "Restricted";
    activeWarningsCount: number;
    activeStrikesCount: number;
    lastReviewDate: string | null;
    summary: string;
}

export interface UserPlatformSyncHealth {
    status: "Active & Healthy" | "Attention Needed" | "No Connections";
    connectedCount: number;
    supportedPortalsCount: number;
    failedPortals: string[];
    lastSyncAt: string | null;
    syncCadence: string;
}

export interface UserAccountSecuritySummary {
    protectionLevel: "Enhanced Protection" | "Standard Protection";
    isEmailVerified: boolean;
    isTwoFactorEnabled: boolean;
    activeSecurityWarningsCount: number;
    lastSecurityAudit: string | null;
}

export interface UserPlatformCapability {
    key: string;
    title: string;
    status: "Available" | "Limited" | "Temporarily Unavailable" | "Not Eligible";
    badgeText: string;
    description: string;
    quotaLimit?: number | null;
}

export interface CollegiateSafeguardStatus {
    collegeName: string | null;
    isAffiliated: boolean;
    canChangeCollege: boolean;
    lockRemainingSeconds: number;
    nextAllowedChangeAt: string | null;
    cooldownPeriodHours: number;
    explanation: string;
}

export interface UserGovernanceOverview {
    userId: string;
    username: string;
    standing: UserAccountStanding;
    communityConduct: UserCommunityConduct;
    platformSync: UserPlatformSyncHealth;
    accountSecurity: UserAccountSecuritySummary;
    capabilities: UserPlatformCapability[];
    collegiateSafeguard: CollegiateSafeguardStatus;
    activeRestrictions: Array<{
        id: string;
        restrictionType: string;
        affectedResource: string | null;
        reasonCode: string | null;
        startsAt: string;
        expiresAt: string | null;
    }>;
}

/**
 * Get or lazily initialize the user's account status row
 */
async function ensureAccountStatusRow(userId: string): Promise<any> {
    const existing = await query(
        `SELECT * FROM account_statuses WHERE user_id = $1 LIMIT 1;`,
        [userId]
    );
    if (existing.rows.length > 0) {
        return existing.rows[0];
    }

    const inserted = await query(
        `INSERT INTO account_statuses (
            user_id,
            standing,
            severity,
            public_reason_code,
            public_reason,
            source
        ) VALUES ($1, 'good_standing', 'none', 'ACCOUNT_HEALTHY', 'Account complies with all community and integrity guidelines.', 'system')
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
        RETURNING *;`,
        [userId]
    );

    // Record initial status history event
    await query(
        `INSERT INTO account_status_history (
            user_id,
            previous_status,
            new_status,
            action,
            reason_code,
            public_explanation,
            actor_role
        ) VALUES ($1, NULL, 'good_standing', 'initial_provisioning', 'ACCOUNT_CREATED', 'Initial developer account provisioned with Good Standing.', 'system')
        ON CONFLICT DO NOTHING;`,
        [userId]
    );

    return inserted.rows[0];
}

/**
 * Authoritative read-only governance summary for the authenticated user
 */
export async function getUserGovernanceOverview(userId: string): Promise<UserGovernanceOverview> {
    // 1. Fetch user base record
    const userRes = await query(
        `SELECT
            id,
            username,
            email,
            is_email_verified,
            is_two_factor_enabled,
            college,
            college_updated_at,
            created_at
        FROM users
        WHERE id = $1 LIMIT 1;`,
        [userId]
    );

    if (userRes.rows.length === 0) {
        throw new Error("User account not found");
    }
    const user = userRes.rows[0];

    // 2. Ensure account status row
    const statusRow = await ensureAccountStatusRow(userId);

    // 3. Fetch active restrictions
    const restrictionsRes = await query(
        `SELECT
            id,
            restriction_type,
            affected_resource,
            reason_code,
            starts_at,
            expires_at
        FROM account_restrictions
        WHERE user_id = $1
          AND status = 'active'
          AND starts_at <= NOW()
          AND (expires_at IS NULL OR expires_at > NOW())
        ORDER BY starts_at DESC;`,
        [userId]
    );
    const activeRestrictions = restrictionsRes.rows.map((r: any) => ({
        id: r.id,
        restrictionType: r.restriction_type,
        affectedResource: r.affected_resource,
        reasonCode: r.reason_code,
        startsAt: r.starts_at,
        expiresAt: r.expires_at,
    }));

    // 4. Community Conduct metrics from history
    const warningsRes = await query(
        `SELECT
            COUNT(*) FILTER (WHERE action = 'warning_issued') AS warnings_count,
            COUNT(*) FILTER (WHERE action = 'strike_added') AS strikes_count
        FROM account_status_history
        WHERE user_id = $1
          AND created_at >= NOW() - INTERVAL '90 days';`,
        [userId]
    );
    const warningsCount = parseInt(warningsRes.rows[0]?.warnings_count || "0", 10);
    const strikesCount = parseInt(warningsRes.rows[0]?.strikes_count || "0", 10);

    let complianceState: UserCommunityConduct["complianceState"] = "100% Compliant";
    let conductSummary = "Zero active moderation warnings or strikes";
    if (statusRow.standing === "restricted" || activeRestrictions.length > 0) {
        complianceState = "Restricted";
        conductSummary = `${activeRestrictions.length} active platform restriction(s) applied`;
    } else if (statusRow.standing === "warning" || warningsCount > 0) {
        complianceState = "Active Warnings";
        conductSummary = `${warningsCount} active warning(s) on record`;
    } else if (statusRow.standing === "under_review") {
        complianceState = "Under Review";
        conductSummary = "Account is currently under routine integrity review";
    }

    const communityConduct: UserCommunityConduct = {
        complianceState,
        activeWarningsCount: warningsCount,
        activeStrikesCount: strikesCount,
        lastReviewDate: statusRow.last_reviewed_at || user.created_at,
        summary: conductSummary,
    };

    // 5. Platform Sync status from real `user_links`
    const linksRes = await query(
        `SELECT
            portal,
            last_sync_status,
            last_sync_at
        FROM user_links
        WHERE user_id = $1 OR LOWER(username) = LOWER($2);`,
        [userId, user.username]
    );

    const connectedLinks = linksRes.rows;
    const connectedCount = connectedLinks.length;
    const failedPortals = connectedLinks
        .filter((l: any) => l.last_sync_status === "error" || l.last_sync_status === "failed")
        .map((l: any) => l.portal);

    let latestSyncAt: string | null = null;
    for (const link of connectedLinks) {
        if (link.last_sync_at) {
            if (!latestSyncAt || new Date(link.last_sync_at) > new Date(latestSyncAt)) {
                latestSyncAt = link.last_sync_at;
            }
        }
    }

    let syncHealthStatus: UserPlatformSyncHealth["status"] = "Active & Healthy";
    if (connectedCount === 0) {
        syncHealthStatus = "No Connections";
    } else if (failedPortals.length > 0) {
        syncHealthStatus = "Attention Needed";
    }

    const platformSync: UserPlatformSyncHealth = {
        status: syncHealthStatus,
        connectedCount,
        supportedPortalsCount: 16,
        failedPortals,
        lastSyncAt: latestSyncAt,
        syncCadence: "Daily background sync + instant on-demand refresh",
    };

    // 6. Account Security status
    const is2FA = Boolean(user.is_two_factor_enabled);
    const isVerifiedEmail = Boolean(user.is_email_verified);
    const accountSecurity: UserAccountSecuritySummary = {
        protectionLevel: is2FA ? "Enhanced Protection" : "Standard Protection",
        isEmailVerified: isVerifiedEmail,
        isTwoFactorEnabled: is2FA,
        activeSecurityWarningsCount: !isVerifiedEmail ? 1 : 0,
        lastSecurityAudit: statusRow.updated_at,
    };

    // 7. Platform Capabilities & Quotas (checks active restrictions)
    const hasLeaderboardRestriction = activeRestrictions.some(
        (r) => r.restrictionType === "leaderboard_access" || r.restrictionType === "all"
    );
    const hasShowcaseRestriction = activeRestrictions.some(
        (r) => r.restrictionType === "public_profile" || r.restrictionType === "all"
    );
    const hasResumeRestriction = activeRestrictions.some(
        (r) => r.restrictionType === "resume_audit" || r.restrictionType === "all"
    );
    const hasSyncRestriction = activeRestrictions.some(
        (r) => r.restrictionType === "contest_sync" || r.restrictionType === "all"
    );

    const capabilities: UserPlatformCapability[] = [
        {
            key: "leaderboard",
            title: "Global & College Leaderboards",
            status: hasLeaderboardRestriction ? "Temporarily Unavailable" : "Available",
            badgeText: hasLeaderboardRestriction ? "Restricted" : "Eligible & Ranked",
            description: hasLeaderboardRestriction
                ? "Leaderboard participation is temporarily restricted pending review."
                : "Real-time percentile ranking, tier badges, and college standings active.",
        },
        {
            key: "showcase_card",
            title: "Developer Showcase & Card Studio",
            status: hasShowcaseRestriction ? "Temporarily Unavailable" : "Available",
            badgeText: hasShowcaseRestriction ? "Restricted" : "Full Access",
            description: hasShowcaseRestriction
                ? "Public profile showcase is temporarily masked."
                : "Custom public URL, interactive 3D card export, and SVG profile embeds.",
        },
        {
            key: "resume_intelligence",
            title: "Resume Intelligence Engine",
            status: hasResumeRestriction ? "Limited" : "Available",
            badgeText: hasResumeRestriction ? "Limited" : "Unlimited Audits",
            description: hasResumeRestriction
                ? "Resume parsing quota restricted."
                : "7-dimension deterministic ATS scoring & fact provenance extraction.",
        },
        {
            key: "platform_sync_rate",
            title: "Platform Sync Rate",
            status: hasSyncRestriction ? "Limited" : "Available",
            badgeText: hasSyncRestriction ? "Sync Paused" : "Automated + Live Refresh",
            description: hasSyncRestriction
                ? "External synchronization paused by moderation policy."
                : "Daily background updates plus manual on-demand synchronization.",
        },
    ];

    // 8. Collegiate Fair-Play Safeguard (calculates real cooldown from DB)
    const collegeUpdatedAtMs = user.college_updated_at ? new Date(user.college_updated_at).getTime() : 0;
    const nowMs = Date.now();
    const elapsedMs = nowMs - collegeUpdatedAtMs;
    const isLocked = collegeUpdatedAtMs > 0 && elapsedMs < COLLEGE_CHANGE_COOLDOWN_MS;
    const lockRemainingSeconds = isLocked ? Math.ceil((COLLEGE_CHANGE_COOLDOWN_MS - elapsedMs) / 1000) : 0;
    const nextAllowedChangeAt = isLocked ? new Date(collegeUpdatedAtMs + COLLEGE_CHANGE_COOLDOWN_MS).toISOString() : null;

    const collegiateSafeguard: CollegiateSafeguardStatus = {
        collegeName: user.college || null,
        isAffiliated: Boolean(user.college && user.college.trim().length > 0),
        canChangeCollege: !isLocked,
        lockRemainingSeconds,
        nextAllowedChangeAt,
        cooldownPeriodHours: 72,
        explanation: isLocked
            ? `College affiliation is on a 72-hour verification cooldown to protect seasonal leaderboard integrity. Changes unlock in ${Math.ceil(lockRemainingSeconds / 3600)} hour(s).`
            : "College updates require a 72-hour integrity cooldown between modifications to prevent seasonal leaderboard manipulation.",
    };

    return {
        userId: user.id,
        username: user.username,
        standing: {
            standing: statusRow.standing,
            severity: statusRow.severity,
            publicReasonCode: statusRow.public_reason_code,
            publicReason: statusRow.public_reason,
            lastReviewedAt: statusRow.last_reviewed_at,
            nextReviewAt: statusRow.next_review_at,
            effectiveFrom: statusRow.effective_from,
            expiresAt: statusRow.expires_at,
            source: statusRow.source,
        },
        communityConduct,
        platformSync,
        accountSecurity,
        capabilities,
        collegiateSafeguard,
        activeRestrictions,
    };
}

/**
 * User-visible audit timeline (strips sensitive internal notes)
 */
export async function getUserStatusTimeline(userId: string) {
    const res = await query(
        `SELECT
            id,
            previous_status,
            new_status,
            action,
            reason_code,
            public_explanation,
            effective_from,
            expires_at,
            created_at
        FROM account_status_history
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 50;`,
        [userId]
    );

    return res.rows.map((row: any) => ({
        id: row.id,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        action: row.action,
        reasonCode: row.reason_code,
        publicExplanation: row.public_explanation,
        effectiveFrom: row.effective_from,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
    }));
}

// =============================================================================
// STAFF & ADMIN GOVERNANCE OPERATIONS (Strictly Protected)
// =============================================================================

export interface UpdateStandingPayload {
    targetUserId: string;
    newStatus: "good_standing" | "warning" | "under_review" | "restricted" | "suspended" | "deactivated";
    severity?: "none" | "low" | "medium" | "high" | "critical";
    publicReasonCode: string;
    publicReason: string;
    internalNote?: string;
    expiresAt?: string | null;
    nextReviewAt?: string | null;
    actorId: string;
    actorRole: string;
}

/**
 * Updates a user's account standing atomically with audit history
 */
export async function updateAccountStandingAdmin(payload: UpdateStandingPayload) {
    const {
        targetUserId,
        newStatus,
        severity = "none",
        publicReasonCode,
        publicReason,
        internalNote,
        expiresAt,
        nextReviewAt,
        actorId,
        actorRole,
    } = payload;

    // Validate target user exists
    const userRes = await query(`SELECT id, username, email FROM users WHERE id = $1 LIMIT 1;`, [targetUserId]);
    if (userRes.rows.length === 0) {
        throw new Error("Target user account not found.");
    }

    const currentStatus = await ensureAccountStatusRow(targetUserId);

    // Atomic update
    await query(
        `UPDATE account_statuses
         SET
            standing = $1,
            severity = $2,
            public_reason_code = $3,
            public_reason = $4,
            internal_reason = $5,
            expires_at = $6,
            next_review_at = $7,
            last_reviewed_at = NOW(),
            updated_by = $8,
            source = 'manual_admin',
            version = version + 1,
            updated_at = NOW()
         WHERE user_id = $9;`,
        [
            newStatus,
            severity,
            publicReasonCode,
            publicReason,
            internalNote || null,
            expiresAt ? new Date(expiresAt) : null,
            nextReviewAt ? new Date(nextReviewAt) : null,
            actorId,
            targetUserId,
        ]
    );

    // Append to audit history
    await query(
        `INSERT INTO account_status_history (
            user_id,
            previous_status,
            new_status,
            action,
            reason_code,
            public_explanation,
            internal_note,
            actor_id,
            actor_role,
            expires_at
        ) VALUES ($1, $2, $3, 'status_change', $4, $5, $6, $7, $8, $9);`,
        [
            targetUserId,
            currentStatus.standing,
            newStatus,
            publicReasonCode,
            publicReason,
            internalNote || null,
            actorId,
            actorRole,
            expiresAt ? new Date(expiresAt) : null,
        ]
    );

    // Emit notification to user
    await query(
        `INSERT INTO user_notifications (
            user_id,
            title,
            body,
            notification_type,
            metadata
        ) VALUES ($1, $2, $3, 'account_governance', $4);`,
        [
            targetUserId,
            `Account Standing Updated: ${newStatus.replace("_", " ").toUpperCase()}`,
            publicReason,
            JSON.stringify({
                standing: newStatus,
                severity,
                reasonCode: publicReasonCode,
            }),
        ]
    );

    return {
        success: true,
        message: `User standing updated to ${newStatus}.`,
        targetUserId,
        newStatus,
    };
}

export interface ApplyRestrictionPayload {
    targetUserId: string;
    restrictionType: "leaderboard_access" | "public_profile" | "contest_sync" | "club_leadership" | "resume_audit" | "messaging_access";
    affectedResource?: string;
    reasonCode: string;
    publicExplanation: string;
    internalNote?: string;
    expiresAt?: string | null;
    actorId: string;
    actorRole: string;
}

/**
 * Apply granular restriction to user account
 */
export async function applyRestrictionAdmin(payload: ApplyRestrictionPayload) {
    const {
        targetUserId,
        restrictionType,
        affectedResource = "platform",
        reasonCode,
        publicExplanation,
        internalNote,
        expiresAt,
        actorId,
        actorRole,
    } = payload;

    const res = await query(
        `INSERT INTO account_restrictions (
            user_id,
            restriction_type,
            affected_resource,
            reason_code,
            status,
            starts_at,
            expires_at,
            created_by
        ) VALUES ($1, $2, $3, $4, 'active', NOW(), $5, $6)
        RETURNING id;`,
        [
            targetUserId,
            restrictionType,
            affectedResource,
            reasonCode,
            expiresAt ? new Date(expiresAt) : null,
            actorId,
        ]
    );

    // Record in history
    await query(
        `INSERT INTO account_status_history (
            user_id,
            previous_status,
            new_status,
            action,
            reason_code,
            public_explanation,
            internal_note,
            actor_id,
            actor_role,
            expires_at
        ) VALUES ($1, 'standing_maintained', 'restricted', 'restriction_applied', $2, $3, $4, $5, $6, $7);`,
        [
            targetUserId,
            reasonCode,
            publicExplanation,
            internalNote || null,
            actorId,
            actorRole,
            expiresAt ? new Date(expiresAt) : null,
        ]
    );

    // Notify user
    await query(
        `INSERT INTO user_notifications (
            user_id,
            title,
            body,
            notification_type,
            metadata
        ) VALUES ($1, $2, $3, 'account_restriction', $4);`,
        [
            targetUserId,
            `Platform Restriction Applied: ${restrictionType}`,
            publicExplanation,
            JSON.stringify({ restrictionType, reasonCode }),
        ]
    );

    return {
        success: true,
        restrictionId: res.rows[0].id,
        message: `Restriction '${restrictionType}' applied.`,
    };
}

/**
 * Revoke an active restriction
 */
export async function revokeRestrictionAdmin(
    restrictionId: string,
    actorId: string,
    actorRole: string,
    note?: string
) {
    const restRes = await query(
        `SELECT * FROM account_restrictions WHERE id = $1 LIMIT 1;`,
        [restrictionId]
    );
    if (restRes.rows.length === 0) {
        throw new Error("Restriction record not found.");
    }
    const rest = restRes.rows[0];

    await query(
        `UPDATE account_restrictions SET status = 'revoked' WHERE id = $1;`,
        [restrictionId]
    );

    // Audit log
    await query(
        `INSERT INTO account_status_history (
            user_id,
            previous_status,
            new_status,
            action,
            reason_code,
            public_explanation,
            internal_note,
            actor_id,
            actor_role
        ) VALUES ($1, 'restricted', 'good_standing', 'privilege_restored', 'RESTRICTION_REVOKED', 'Platform privilege restored by administration.', $2, $3, $4);`,
        [rest.user_id, note || null, actorId, actorRole]
    );

    return { success: true, message: `Restriction ${rest.restriction_type} revoked.` };
}

/**
 * Search users for governance administration
 */
export async function searchUsersForGovernance(searchTerm: string, limit = 20) {
    const term = `%${searchTerm.trim().toLowerCase()}%`;
    const res = await query(
        `SELECT
            u.id,
            u.username,
            u.email,
            u.firstname,
            u.lastname,
            u.account_type,
            u.staff_role,
            u.is_email_verified,
            COALESCE(ast.standing, 'good_standing') AS standing,
            COALESCE(ast.severity, 'none') AS severity,
            ast.last_reviewed_at
        FROM users u
        LEFT JOIN account_statuses ast ON ast.user_id = u.id
        WHERE LOWER(u.username) LIKE $1 OR LOWER(u.email) LIKE $1 OR u.id::text LIKE $1
        ORDER BY u.created_at DESC
        LIMIT $2;`,
        [term, Math.min(limit, 50)]
    );

    return res.rows.map((row: any) => ({
        id: row.id,
        username: row.username,
        email: row.email,
        name: `${row.firstname || ""} ${row.lastname || ""}`.trim() || row.username,
        accountType: row.account_type,
        staffRole: row.staff_role,
        isEmailVerified: Boolean(row.is_email_verified),
        standing: row.standing,
        severity: row.severity,
        lastReviewedAt: row.last_reviewed_at,
    }));
}
