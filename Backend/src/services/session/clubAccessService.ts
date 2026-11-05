// Backend/src/services/session/clubAccessService.ts
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";

const ROUTINE_ACCESS_THROTTLE_SECONDS = 600; // 10 minutes

export interface ClubAccessItem {
    id: string;
    clubId: string;
    userId: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    userRoleAtTime: string;
    action: string;
    actionLabel: string;
    deviceName: string;
    browser: string;
    operatingSystem: string;
    locationSummary: string;
    ipAddressMasked: string;
    sessionStatus: string;
    createdAt: string;
    metadata: Record<string, any>;
}

/**
 * Record a club access audit event
 */
export async function recordClubAccessEvent(params: {
    clubId: string;
    userId: string;
    sessionId?: string | null;
    action: string;
    metadata?: Record<string, any>;
}): Promise<void> {
    const { clubId, userId, sessionId, action, metadata = {} } = params;

    // 1. Resolve member's role in the club
    let userRole = "member";
    let membershipId: string | null = null;

    try {
        const memRes = await query(
            `SELECT id, access_role, club_role FROM club_memberships
             WHERE club_id = $1 AND user_id = $2 AND status = 'active'
             LIMIT 1;`,
            [clubId, userId]
        );

        if (memRes.rows[0]) {
            membershipId = memRes.rows[0].id;
            userRole = memRes.rows[0].access_role || memRes.rows[0].club_role || "member";
        } else {
            // Check if user is the founding creator / auth_user_id of verified_clubs
            const clubRes = await query(
                `SELECT auth_user_id FROM verified_clubs WHERE id = $1 LIMIT 1;`,
                [clubId]
            );
            if (clubRes.rows[0]?.auth_user_id === userId) {
                userRole = "lead";
            }
        }
    } catch {
        // Fallback default role
    }

    // 2. Throttle routine actions (e.g. 'club_dashboard_opened', 'club_accessed')
    const isRoutine = ["club_accessed", "club_dashboard_opened", "club_settings_viewed"].includes(action);
    if (isRoutine && sessionId) {
        const throttleKey = `club:access:throttle:${clubId}:${userId}:${action}`;
        try {
            if (redis && redis.status === "ready") {
                const isThrottled = await redis.set(throttleKey, "1", "EX", ROUTINE_ACCESS_THROTTLE_SECONDS, "NX");
                if (!isThrottled) {
                    return; // Already logged recently
                }
            }
        } catch {
            // Ignore Redis throttle error and continue
        }
    }

    // 3. Insert record into club_access_events
    try {
        await query(
            `INSERT INTO club_access_events (
                club_id,
                user_id,
                membership_id,
                session_id,
                action,
                user_role_at_time,
                metadata,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW());`,
            [
                clubId,
                userId,
                membershipId,
                sessionId || null,
                action,
                userRole,
                JSON.stringify(metadata),
            ]
        );
    } catch (err: any) {
        console.warn("[ClubAccess] Non-blocking log error:", err?.message);
    }
}

/**
 * Get club access audit log for authorized club administrators
 */
export async function getClubAccessActivity(params: {
    clubId: string;
    userId: string;
    limit?: number | undefined;
    offset?: number | undefined;
    filterAction?: string | undefined;
}): Promise<{
    events: ClubAccessItem[];
    total: number;
    activeTeamSessionsCount: number;
}> {
    const { clubId, userId, limit = 20, offset = 0, filterAction } = params;

    // 1. Authorization check: User must be a member or admin of the club
    const clubAuth = await query(
        `SELECT
            c.id,
            c.auth_user_id,
            m.access_role
         FROM verified_clubs c
         LEFT JOIN club_memberships m ON m.club_id = c.id AND m.user_id = $2 AND m.status = 'active'
         WHERE c.id = $1
         LIMIT 1;`,
        [clubId, userId]
    );

    if (!clubAuth.rows[0]) {
        throw new Error("Club not found.");
    }

    const { auth_user_id, access_role } = clubAuth.rows[0];
    const isLeadOrAdmin =
        auth_user_id === userId || ["lead", "co-lead", "admin", "moderator"].includes(access_role);

    if (!isLeadOrAdmin) {
        throw new Error("Access forbidden: Club team audit logs are restricted to authorized organizers.");
    }

    // 2. Query total count
    let countSql = `SELECT COUNT(*)::int AS total FROM club_access_events WHERE club_id = $1`;
    const countParams: any[] = [clubId];
    if (filterAction && filterAction !== "all") {
        countParams.push(filterAction);
        countSql += ` AND action = $2`;
    }
    const countRes = await query(countSql, countParams);

    // 3. Query access events with user and session details
    let listSql = `
        SELECT
            e.id,
            e.club_id AS "clubId",
            e.user_id AS "userId",
            e.session_id AS "sessionId",
            e.action,
            e.user_role_at_time AS "userRoleAtTime",
            e.metadata,
            e.created_at AS "createdAt",
            u.username,
            u.firstname,
            u.lastname,
            COALESCE(u.avatar_url, u.photo_url) AS "avatarUrl",
            s.device_name AS "deviceName",
            s.browser,
            s.operating_system AS "operatingSystem",
            s.location_summary AS "locationSummary",
            s.ip_address_masked AS "ipAddressMasked",
            s.status AS "sessionStatus"
        FROM club_access_events e
        JOIN users u ON u.id = e.user_id
        LEFT JOIN user_sessions s ON s.session_id = e.session_id
        WHERE e.club_id = $1
    `;
    const listParams: any[] = [clubId];
    if (filterAction && filterAction !== "all") {
        listParams.push(filterAction);
        listSql += ` AND e.action = $${listParams.length}`;
    }
    listSql += ` ORDER BY e.created_at DESC LIMIT $${listParams.length + 1} OFFSET $${listParams.length + 2};`;
    listParams.push(Math.min(limit, 50));
    listParams.push(offset);

    const listRes = await query(listSql, listParams);

    // 4. Count active team sessions currently logged into the club
    const activeSessionsRes = await query(
        `SELECT COUNT(DISTINCT e.session_id)::int AS count
         FROM club_access_events e
         JOIN user_sessions s ON s.session_id = e.session_id
         WHERE e.club_id = $1 AND s.status = 'active' AND s.expires_at > NOW()
           AND e.created_at > NOW() - INTERVAL '24 hours';`,
        [clubId]
    );

    const actionLabels: Record<string, string> = {
        club_accessed: "Chapter Accessed",
        club_dashboard_opened: "Dashboard Opened",
        club_settings_viewed: "Settings Viewed",
        settings_updated: "Settings Modified",
        member_promoted: "Team Member Promoted",
        member_access_revoked: "Member Access Revoked",
        club_session_ended: "Club Session Ended",
    };

    const events: ClubAccessItem[] = listRes.rows.map((row) => ({
        id: row.id,
        clubId: row.clubId,
        userId: row.userId,
        username: row.username,
        fullName: `${row.firstname || ""} ${row.lastname || ""}`.trim() || row.username,
        avatarUrl: row.avatarUrl || null,
        userRoleAtTime: row.userRoleAtTime,
        action: row.action,
        actionLabel: actionLabels[row.action] || row.action.replace(/_/g, " "),
        deviceName: row.deviceName || "Desktop Workstation",
        browser: row.browser || "Browser",
        operatingSystem: row.operatingSystem || "OS",
        locationSummary: row.locationSummary || "Location unavailable",
        ipAddressMasked: row.ipAddressMasked || "IP protected",
        sessionStatus: row.sessionStatus || "active",
        createdAt: row.createdAt,
        metadata: row.metadata || {},
    }));

    return {
        total: countRes.rows[0]?.total || 0,
        activeTeamSessionsCount: activeSessionsRes.rows[0]?.count || 0,
        events,
    };
}
