// Backend/src/services/account/privacyCenterService.ts
import { query } from "../../database/client.js";

export interface UserPrivacyPreferences {
    anonymousTelemetryEnabled: boolean;
    anonymousTelemetry?: boolean;
    publicProfileVisibility: "public" | "private";
    resumeVisibility: "private" | "public" | "shared_only";
    recruiterContactAllowed: boolean;
    activityVisibility: "all" | "milestones_only" | "private";
    consentVersion: string;
    updatedAt: string;
}

export interface DataInventoryCategory {
    category: string;
    purpose: string;
    dataPoints: string[];
    visibility: "Public" | "Private" | "Conditionally Shared";
    storage: string;
    retentionPolicy: string;
}

/**
 * Fetch or lazily initialize user privacy preferences
 */
export async function getUserPrivacyPreferences(userId: string): Promise<UserPrivacyPreferences> {
    const res = await query(
        `SELECT
            anonymous_telemetry_enabled AS "anonymousTelemetryEnabled",
            public_profile_visibility AS "publicProfileVisibility",
            resume_visibility AS "resumeVisibility",
            recruiter_contact_allowed AS "recruiterContactAllowed",
            activity_visibility AS "activityVisibility",
            consent_version AS "consentVersion",
            updated_at AS "updatedAt"
        FROM user_privacy_preferences
        WHERE user_id = $1 LIMIT 1;`,
        [userId]
    );

    if (res.rows.length > 0) {
        const row = res.rows[0];
        row.anonymousTelemetry = Boolean(row.anonymousTelemetryEnabled);
        return row;
    }

    // Default initialization
    const inserted = await query(
        `INSERT INTO user_privacy_preferences (
            user_id,
            anonymous_telemetry_enabled,
            public_profile_visibility,
            resume_visibility,
            recruiter_contact_allowed,
            activity_visibility
        ) VALUES ($1, false, 'public', 'private', true, 'all')
        ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
        RETURNING
            anonymous_telemetry_enabled AS "anonymousTelemetryEnabled",
            public_profile_visibility AS "publicProfileVisibility",
            resume_visibility AS "resumeVisibility",
            recruiter_contact_allowed AS "recruiterContactAllowed",
            activity_visibility AS "activityVisibility",
            consent_version AS "consentVersion",
            updated_at AS "updatedAt";`,
        [userId]
    );

    const insertedRow = inserted.rows[0];
    insertedRow.anonymousTelemetry = Boolean(insertedRow.anonymousTelemetryEnabled);
    return insertedRow;
}

/**
 * Update user privacy preferences with server-side validation and audit logging
 */
export async function updateUserPrivacyPreferences(
    userId: string,
    updates: Partial<UserPrivacyPreferences>,
    ip?: string,
    userAgent?: string
): Promise<UserPrivacyPreferences> {
    const current = await getUserPrivacyPreferences(userId);

    const telemetryInput = updates.anonymousTelemetryEnabled !== undefined
        ? updates.anonymousTelemetryEnabled
        : updates.anonymousTelemetry;
    const telemetry = telemetryInput ?? current.anonymousTelemetryEnabled;
    const profileVis = updates.publicProfileVisibility ?? current.publicProfileVisibility;
    const resumeVis = updates.resumeVisibility ?? current.resumeVisibility;
    const recruiter = updates.recruiterContactAllowed ?? current.recruiterContactAllowed;
    const activity = updates.activityVisibility ?? current.activityVisibility;

    // Validate enum fields
    if (!["public", "private"].includes(profileVis)) {
        throw new Error("Invalid publicProfileVisibility. Must be 'public' or 'private'.");
    }
    if (!["private", "public", "shared_only"].includes(resumeVis)) {
        throw new Error("Invalid resumeVisibility. Must be 'private', 'public', or 'shared_only'.");
    }
    if (!["all", "milestones_only", "private"].includes(activity)) {
        throw new Error("Invalid activityVisibility. Must be 'all', 'milestones_only', or 'private'.");
    }

    const updated = await query(
        `INSERT INTO user_privacy_preferences (
            user_id,
            anonymous_telemetry_enabled,
            public_profile_visibility,
            resume_visibility,
            recruiter_contact_allowed,
            activity_visibility,
            updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            anonymous_telemetry_enabled = EXCLUDED.anonymous_telemetry_enabled,
            public_profile_visibility = EXCLUDED.public_profile_visibility,
            resume_visibility = EXCLUDED.resume_visibility,
            recruiter_contact_allowed = EXCLUDED.recruiter_contact_allowed,
            activity_visibility = EXCLUDED.activity_visibility,
            updated_at = NOW()
        RETURNING
            anonymous_telemetry_enabled AS "anonymousTelemetryEnabled",
            public_profile_visibility AS "publicProfileVisibility",
            resume_visibility AS "resumeVisibility",
            recruiter_contact_allowed AS "recruiterContactAllowed",
            activity_visibility AS "activityVisibility",
            consent_version AS "consentVersion",
            updated_at AS "updatedAt";`,
        [userId, telemetry, profileVis, resumeVis, recruiter, activity]
    );

    // Keep existing `users.is_public` in sync with profile visibility
    try {
        await query(
            `UPDATE users SET is_public = $1 WHERE id = $2;`,
            [profileVis === "public", userId]
        );
    } catch {
        // Safe fallback if is_public column name differs
    }

    // Record audit event
    await query(
        `INSERT INTO privacy_request_audit (
            user_id,
            request_type,
            details,
            ip_address,
            user_agent
        ) VALUES ($1, 'preference_update', $2, $3, $4);`,
        [
            userId,
            JSON.stringify({
                before: current,
                after: updated.rows[0],
            }),
            ip || null,
            userAgent || null,
        ]
    );

    const result = updated.rows[0];
    result.anonymousTelemetry = Boolean(result.anonymousTelemetryEnabled);
    return result;
}

/**
 * Authoritative Data Inventory of Orbix Platform
 */
export function getPlatformDataInventory(): DataInventoryCategory[] {
    return [
        {
            category: "Account & Identity",
            purpose: "Authentication, session verification, and canonical developer profile",
            dataPoints: ["Username", "Full Name", "Verified Email", "College Affiliation", "Avatar URL"],
            visibility: "Conditionally Shared",
            storage: "Encrypted PostgreSQL database with TLS 1.3 in transit",
            retentionPolicy: "Retained during active membership; erased upon confirmed deletion request",
        },
        {
            category: "Connected Coding Platforms",
            purpose: "Multi-platform competitive programming and contribution synchronization",
            dataPoints: ["Connected Handles (LeetCode, Codeforces, GitHub, etc.)", "Daily Solved Problem Counts", "Rated Contest Milestones"],
            visibility: "Public",
            storage: "Relational links and indexed cache",
            retentionPolicy: "Synced daily; decoupled upon account disconnection or profile erasure",
        },
        {
            category: "Competitive Statistics & Orbix Score",
            purpose: "Deterministic algorithm ranking and inter-college leaderboard calculation",
            dataPoints: ["Orbix Score (0-10,000)", "Pillar Breakdown", "Weekly Streaks", "Contest Percentile Ranks"],
            visibility: "Public",
            storage: "Cached scoring records with diminishing-returns bounding",
            retentionPolicy: "Calculated continuously; masked immediately when switched to Private Mode",
        },
        {
            category: "Resume Intelligence & AST Facts",
            purpose: "ATS optimization, structured skill verification, and deterministic provenance",
            dataPoints: ["Parsed Resume Sections", "Skill Claims", "Quantified Metric Scores", "ATS Audit Checklists"],
            visibility: "Private",
            storage: "Secure file storage with isolated AST parsing",
            retentionPolicy: "Private by default; shared only when explicit recruiter permission is granted",
        },
        {
            category: "Support Tickets & Correspondence",
            purpose: "Issue resolution, bug investigations, and collegiate chapter verification",
            dataPoints: ["Ticket Inquiries", "Discussion Messages", "Client Diagnostics (with consent)", "Uploaded Error Screenshots"],
            visibility: "Private",
            storage: "Scoped help repository with role-governed staff access",
            retentionPolicy: "Retained for resolution history; accessible exclusively to user and support staff",
        },
        {
            category: "Anonymous Diagnostics & Telemetry",
            purpose: "Client latency monitoring, crash reporting, and dashboard performance optimization",
            dataPoints: ["Browser & OS Version", "Viewport Resolution", "Request Latency", "Error Codes"],
            visibility: "Private",
            storage: "Ephemeral anonymized telemetry logs",
            retentionPolicy: "Governed by user toggle; zero personal source code or credentials ever transmitted",
        },
    ];
}

/**
 * Request account deletion with 7-day grace period
 */
export async function requestAccountDeletion(
    userId: string,
    reason?: string,
    ip?: string,
    userAgent?: string
) {
    const existing = await query(
        `SELECT * FROM account_deletion_requests
         WHERE user_id = $1 AND status IN ('scheduled', 'processing')
         LIMIT 1;`,
        [userId]
    );

    if (existing.rows.length > 0) {
        return {
            success: true,
            message: "An account deletion request is already scheduled.",
            request: existing.rows[0],
        };
    }

    const res = await query(
        `INSERT INTO account_deletion_requests (
            user_id,
            status,
            reason,
            grace_period_days,
            scheduled_for,
            requested_ip
        ) VALUES ($1, 'scheduled', $2, 7, NOW() + INTERVAL '7 days', $3)
        RETURNING *;`,
        [userId, reason || "User initiated account deletion", ip || null]
    );

    // Audit log
    await query(
        `INSERT INTO privacy_request_audit (
            user_id,
            request_type,
            details,
            ip_address,
            user_agent
        ) VALUES ($1, 'deletion_request', $2, $3, $4);`,
        [
            userId,
            JSON.stringify({ scheduledFor: res.rows[0].scheduled_for, reason }),
            ip || null,
            userAgent || null,
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
        ) VALUES ($1, $2, $3, 'account_deletion', $4);`,
        [
            userId,
            "Account Deletion Scheduled",
            `Your account has been scheduled for permanent deletion in 7 days. You can cancel this request at any time before ${new Date(res.rows[0].scheduled_for).toLocaleDateString()}.`,
            JSON.stringify({ scheduledFor: res.rows[0].scheduled_for }),
        ]
    );

    return {
        success: true,
        message: "Account deletion scheduled with a 7-day grace period.",
        request: res.rows[0],
    };
}

/**
 * Cancel a pending account deletion request
 */
export async function cancelAccountDeletion(userId: string, ip?: string, userAgent?: string) {
    const res = await query(
        `UPDATE account_deletion_requests
         SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND status = 'scheduled'
         RETURNING *;`,
        [userId]
    );

    if (res.rows.length === 0) {
        throw new Error("No scheduled account deletion request found to cancel.");
    }

    // Audit log
    await query(
        `INSERT INTO privacy_request_audit (
            user_id,
            request_type,
            details,
            ip_address,
            user_agent
        ) VALUES ($1, 'deletion_cancelled', '{}'::jsonb, $2, $3);`,
        [userId, ip || null, userAgent || null]
    );

    return {
        success: true,
        message: "Account deletion request has been successfully cancelled.",
    };
}

/**
 * Fetch unified privacy and compliance request history
 */
export async function getPrivacyRequestHistory(userId: string) {
    // 1. Data exports
    const exportsRes = await query(
        `SELECT
            export_id AS "id",
            'data_export' AS "type",
            'completed' AS "status",
            file_size_bytes AS "fileSizeBytes",
            created_at AS "createdAt",
            expires_at AS "expiresAt"
        FROM account_data_exports
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 10;`,
        [userId]
    );

    // 2. Deletion requests
    const deletionsRes = await query(
        `SELECT
            id,
            'account_deletion' AS "type",
            status,
            grace_period_days AS "gracePeriodDays",
            scheduled_for AS "scheduledFor",
            cancelled_at AS "cancelledAt",
            created_at AS "createdAt"
        FROM account_deletion_requests
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 5;`,
        [userId]
    );

    // 3. Audit events
    const auditRes = await query(
        `SELECT
            id,
            request_type AS "requestType",
            details,
            created_at AS "createdAt"
        FROM privacy_request_audit
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT 20;`,
        [userId]
    );

    return {
        dataExports: exportsRes.rows,
        deletionRequests: deletionsRes.rows,
        auditLog: auditRes.rows,
    };
}
