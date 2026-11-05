// Backend/src/services/session/sessionService.ts
import crypto from "crypto";
import type { Request } from "express";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { parseUserAgentAndDevice } from "./deviceParser.js";
import { resolveApproximateLocation } from "./geolocationService.js";

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ACTIVITY_TOUCH_THROTTLE_SECONDS = 300; // 5 minutes

export interface UserSessionItem {
    id: string;
    sessionId: string;
    deviceName: string;
    deviceType: string;
    browser: string;
    browserVersion: string | null;
    operatingSystem: string;
    operatingSystemVersion: string | null;
    userAgentSummary: string;
    ipAddressMasked: string;
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    locationSummary: string;
    loginMethod: string;
    isMfaAuthenticated: boolean;
    isNewDevice: boolean;
    riskLevel: string;
    status: string;
    isCurrentSession: boolean;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
    revokedAt?: string | null;
    revocationReason?: string | null;
}

export interface SecurityEventItem {
    id: string;
    eventType: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "high" | "critical";
    ipAddressMasked: string | null;
    locationSummary: string | null;
    deviceSummary: string | null;
    metadata: Record<string, any>;
    createdAt: string;
}

/**
 * 1. CREATE NEW SESSION (Called exclusively on genuine successful authentications)
 */
export async function createSession(params: {
    userId: string;
    req: Request;
    loginMethod?: string;
    isMfa?: boolean;
}): Promise<{
    sessionId: string;
    session: UserSessionItem;
    isNewDevice: boolean;
}> {
    const { userId, req, loginMethod = "password", isMfa = false } = params;

    // 1. Device and network parsing
    const deviceInfo = parseUserAgentAndDevice(req);
    const locationInfo = await resolveApproximateLocation(deviceInfo.clientIp);

    // 2. Check if device is recognized for this user
    const previousDeviceCheck = await query(
        `SELECT id FROM user_sessions
         WHERE user_id = $1 AND device_id_hash = $2 AND status != 'revoked'
         LIMIT 1;`,
        [userId, deviceInfo.deviceIdHash]
    );

    const isNewDevice = previousDeviceCheck.rows.length === 0;

    // 3. Risk rule evaluation
    let riskLevel = "low";
    const riskReasons: string[] = [];

    if (isNewDevice) {
        riskReasons.push("NEW_DEVICE_DETECTED");
        // Check if country changed from previous active sessions
        const previousCountryCheck = await query(
            `SELECT country_code FROM user_sessions
             WHERE user_id = $1 AND country_code IS NOT NULL
             ORDER BY created_at DESC LIMIT 3;`,
            [userId]
        );
        const prevCountries = previousCountryCheck.rows.map((r) => r.country_code);
        if (
            prevCountries.length > 0 &&
            locationInfo.countryCode &&
            !prevCountries.includes(locationInfo.countryCode)
        ) {
            riskLevel = "medium";
            riskReasons.push("GEOGRAPHIC_ANOMALY");
        }
    }

    // 4. Generate unique session token
    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // 5. Insert canonical session record
    const insertRes = await query(
        `INSERT INTO user_sessions (
            user_id,
            session_id,
            device_id_hash,
            device_name,
            device_type,
            browser,
            browser_version,
            operating_system,
            operating_system_version,
            user_agent_summary,
            raw_user_agent,
            ip_address_masked,
            ip_address_hash,
            city,
            region,
            country,
            country_code,
            location_summary,
            login_method,
            is_mfa_authenticated,
            is_new_device,
            risk_level,
            risk_reasons,
            status,
            created_at,
            last_active_at,
            expires_at
        ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, 'active', NOW(), NOW(), $24
        ) RETURNING *;`,
        [
            userId,
            sessionId,
            deviceInfo.deviceIdHash,
            deviceInfo.deviceName,
            deviceInfo.deviceType,
            deviceInfo.browser,
            deviceInfo.browserVersion,
            deviceInfo.operatingSystem,
            deviceInfo.operatingSystemVersion,
            deviceInfo.userAgentSummary,
            deviceInfo.rawUserAgent,
            deviceInfo.ipAddressMasked,
            deviceInfo.ipAddressHash,
            locationInfo.city,
            locationInfo.region,
            locationInfo.country,
            locationInfo.countryCode,
            locationInfo.locationSummary,
            loginMethod,
            isMfa,
            isNewDevice,
            riskLevel,
            riskReasons,
            expiresAt,
        ]
    );

    const row = insertRes.rows[0];

    // 6. Record Security Event: Successful Login
    await recordSecurityEvent({
        userId,
        sessionId,
        eventType: isNewDevice ? "login_new_device" : "login_success",
        title: isNewDevice ? "Login from New Device Detected" : "Successful Account Login",
        description: isNewDevice
            ? `Your account was accessed from a new device (${deviceInfo.deviceName} · ${deviceInfo.browser}) in ${locationInfo.locationSummary}.`
            : `Logged in using ${loginMethod.toUpperCase()} from ${deviceInfo.deviceName} (${locationInfo.locationSummary}).`,
        severity: isNewDevice ? "warning" : "info",
        ipAddressMasked: deviceInfo.ipAddressMasked,
        locationSummary: locationInfo.locationSummary,
        deviceSummary: deviceInfo.userAgentSummary,
        metadata: {
            isNewDevice,
            loginMethod,
            riskLevel,
            riskReasons,
        },
    });

    // 7. If new device detected: Trigger in-app security notification
    if (isNewDevice) {
        try {
            const uRes = await query(`SELECT username FROM users WHERE id = $1 LIMIT 1;`, [userId]);
            const username = uRes.rows[0]?.username || "user";

            await query(
                `INSERT INTO user_notifications (
                    user_id,
                    username,
                    recipient_id,
                    title,
                    body,
                    type,
                    notification_type,
                    metadata,
                    is_read,
                    is_user_initiated,
                    delivery_status,
                    created_at
                ) VALUES ($1, $2, $1, $3, $4, 'security_alert', 'new_device_login', $5, false, false, 'delivered', NOW());`,
                [
                    userId,
                    username,
                    `New Login Detected: ${deviceInfo.deviceName}`,
                    `A new device signed into your Orbix account from ${locationInfo.locationSummary} (${deviceInfo.browser} on ${deviceInfo.operatingSystem}). If this wasn't you, review your active sessions immediately.`,
                    JSON.stringify({
                        sessionId,
                        deviceName: deviceInfo.deviceName,
                        browser: deviceInfo.browser,
                        os: deviceInfo.operatingSystem,
                        location: locationInfo.locationSummary,
                        timestamp: new Date().toISOString(),
                    }),
                ]
            );
        } catch (notifErr: any) {
            console.warn("[Session] In-app notification non-blocking error:", notifErr?.message);
        }
    }

    // 8. Cache session in Redis
    try {
        if (redis && redis.status === "ready") {
            await redis.set(`session:active:${sessionId}`, userId, "EX", SESSION_TTL_SECONDS);
        }
    } catch {
        // Non-blocking cache error
    }

    const sessionItem: UserSessionItem = {
        id: row.id,
        sessionId: row.session_id,
        deviceName: row.device_name,
        deviceType: row.device_type,
        browser: row.browser,
        browserVersion: row.browser_version,
        operatingSystem: row.operating_system,
        operatingSystemVersion: row.operating_system_version,
        userAgentSummary: row.user_agent_summary,
        ipAddressMasked: row.ip_address_masked,
        city: row.city,
        region: row.region,
        country: row.country,
        countryCode: row.country_code,
        locationSummary: row.location_summary || "Location unavailable",
        loginMethod: row.login_method,
        isMfaAuthenticated: row.is_mfa_authenticated,
        isNewDevice: row.is_new_device,
        riskLevel: row.risk_level,
        status: row.status,
        isCurrentSession: true,
        createdAt: row.created_at,
        lastActiveAt: row.last_active_at,
        expiresAt: row.expires_at,
    };

    return {
        sessionId,
        session: sessionItem,
        isNewDevice,
    };
}

/**
 * 2. GET ACTIVE SESSIONS FOR USER
 */
export async function getActiveSessions(
    userId: string,
    currentSessionId?: string
): Promise<UserSessionItem[]> {
    const res = await query(
        `SELECT
            id,
            session_id AS "sessionId",
            device_name AS "deviceName",
            device_type AS "deviceType",
            browser,
            browser_version AS "browserVersion",
            operating_system AS "operatingSystem",
            operating_system_version AS "operatingSystemVersion",
            user_agent_summary AS "userAgentSummary",
            ip_address_masked AS "ipAddressMasked",
            city,
            region,
            country,
            country_code AS "countryCode",
            location_summary AS "locationSummary",
            login_method AS "loginMethod",
            is_mfa_authenticated AS "isMfaAuthenticated",
            is_new_device AS "isNewDevice",
            risk_level AS "riskLevel",
            status,
            created_at AS "createdAt",
            last_active_at AS "lastActiveAt",
            expires_at AS "expiresAt",
            revoked_at AS "revokedAt",
            revocation_reason AS "revocationReason"
        FROM user_sessions
        WHERE user_id = $1 AND status = 'active' AND expires_at > NOW()
        ORDER BY
            CASE WHEN session_id = $2 THEN 0 ELSE 1 END ASC,
            last_active_at DESC;`,
        [userId, currentSessionId || ""]
    );

    return res.rows.map((row) => ({
        ...row,
        locationSummary: row.locationSummary || "Location unavailable",
        isCurrentSession: Boolean(currentSessionId && row.sessionId === currentSessionId),
    }));
}

/**
 * 3. GET SESSION HISTORY (Past & Inactive Sessions)
 */
export async function getSessionHistory(
    userId: string,
    limit = 20,
    offset = 0
): Promise<{ sessions: UserSessionItem[]; total: number }> {
    const countRes = await query(
        `SELECT COUNT(*)::int AS total FROM user_sessions WHERE user_id = $1;`,
        [userId]
    );

    const res = await query(
        `SELECT
            id,
            session_id AS "sessionId",
            device_name AS "deviceName",
            device_type AS "deviceType",
            browser,
            browser_version AS "browserVersion",
            operating_system AS "operatingSystem",
            operating_system_version AS "operatingSystemVersion",
            user_agent_summary AS "userAgentSummary",
            ip_address_masked AS "ipAddressMasked",
            city,
            region,
            country,
            country_code AS "countryCode",
            location_summary AS "locationSummary",
            login_method AS "loginMethod",
            is_mfa_authenticated AS "isMfaAuthenticated",
            is_new_device AS "isNewDevice",
            risk_level AS "riskLevel",
            status,
            created_at AS "createdAt",
            last_active_at AS "lastActiveAt",
            expires_at AS "expiresAt",
            revoked_at AS "revokedAt",
            revocation_reason AS "revocationReason"
        FROM user_sessions
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;`,
        [userId, Math.min(limit, 50), offset]
    );

    return {
        total: countRes.rows[0]?.total || 0,
        sessions: res.rows.map((row) => ({
            ...row,
            locationSummary: row.locationSummary || "Location unavailable",
            isCurrentSession: false,
        })),
    };
}

/**
 * 4. REVOKE A SINGLE SESSION (Remote Logout)
 */
export async function revokeSession(
    userId: string,
    sessionIdOrId: string,
    reason = "user_remote_termination"
): Promise<{ success: boolean; message: string }> {
    const sessionRes = await query(
        `SELECT * FROM user_sessions
         WHERE user_id = $1 AND (session_id = $2 OR id::text = $2)
         LIMIT 1;`,
        [userId, sessionIdOrId]
    );

    if (!sessionRes.rows[0]) {
        throw new Error("Session not found or already terminated.");
    }

    const session = sessionRes.rows[0];

    // Mark revoked in database
    await query(
        `UPDATE user_sessions
         SET status = 'revoked',
             revoked_at = NOW(),
             revocation_reason = $1
         WHERE id = $2;`,
        [reason, session.id]
    );

    // Invalidate in Redis
    try {
        if (redis && redis.status === "ready") {
            await redis.set(`session:revoked:${session.session_id}`, "1", "EX", SESSION_TTL_SECONDS);
            await redis.del(`session:active:${session.session_id}`);
        }
    } catch {
        // Non-blocking cache error
    }

    // Record Security Event
    await recordSecurityEvent({
        userId,
        sessionId: session.session_id,
        eventType: "session_revoked_remote",
        title: "Session Terminated Remotely",
        description: `Terminated active session on ${session.device_name} (${session.browser} on ${session.operating_system}).`,
        severity: "warning",
        ipAddressMasked: session.ip_address_masked,
        locationSummary: session.location_summary,
        deviceSummary: session.user_agent_summary,
        metadata: {
            terminatedSessionId: session.session_id,
            reason,
        },
    });

    return {
        success: true,
        message: `Successfully terminated session on ${session.device_name}.`,
    };
}

/**
 * 5. REVOKE OTHER SESSIONS (Log out of all other devices)
 */
export async function revokeOtherSessions(
    userId: string,
    currentSessionId: string
): Promise<{ success: boolean; revokedCount: number }> {
    const otherSessionsRes = await query(
        `SELECT id, session_id, device_name, browser, operating_system, ip_address_masked, location_summary, user_agent_summary
         FROM user_sessions
         WHERE user_id = $1 AND session_id != $2 AND status = 'active';`,
        [userId, currentSessionId]
    );

    const sessionsToRevoke = otherSessionsRes.rows;
    if (sessionsToRevoke.length === 0) {
        return { success: true, revokedCount: 0 };
    }

    // Update in Database
    await query(
        `UPDATE user_sessions
         SET status = 'revoked',
             revoked_at = NOW(),
             revocation_reason = 'revoke_other_sessions'
         WHERE user_id = $1 AND session_id != $2 AND status = 'active';`,
        [userId, currentSessionId]
    );

    // Invalidate in Redis
    try {
        if (redis && redis.status === "ready") {
            const pipeline = redis.pipeline();
            for (const s of sessionsToRevoke) {
                pipeline.set(`session:revoked:${s.session_id}`, "1", "EX", SESSION_TTL_SECONDS);
                pipeline.del(`session:active:${s.session_id}`);
            }
            await pipeline.exec();
        }
    } catch {
        // Non-blocking
    }

    // Record Security Event
    await recordSecurityEvent({
        userId,
        sessionId: currentSessionId,
        eventType: "sessions_revoked_all",
        title: "Logged Out of Other Devices",
        description: `Terminated ${sessionsToRevoke.length} other active device session(s).`,
        severity: "warning",
        metadata: {
            revokedCount: sessionsToRevoke.length,
            currentSessionId,
        },
    });

    return {
        success: true,
        revokedCount: sessionsToRevoke.length,
    };
}

/**
 * 6. REVOKE ALL SESSIONS (Complete Logout across all devices)
 */
export async function revokeAllSessions(
    userId: string,
    reason = "user_logout_all"
): Promise<{ success: boolean; revokedCount: number }> {
    const allActiveRes = await query(
        `SELECT id, session_id FROM user_sessions
         WHERE user_id = $1 AND status = 'active';`,
        [userId]
    );

    const count = allActiveRes.rows.length;

    await query(
        `UPDATE user_sessions
         SET status = 'revoked',
             revoked_at = NOW(),
             revocation_reason = $1
         WHERE user_id = $2 AND status = 'active';`,
        [reason, userId]
    );

    try {
        if (redis && redis.status === "ready") {
            const pipeline = redis.pipeline();
            for (const s of allActiveRes.rows) {
                pipeline.set(`session:revoked:${s.session_id}`, "1", "EX", SESSION_TTL_SECONDS);
                pipeline.del(`session:active:${s.session_id}`);
            }
            await pipeline.exec();
        }
    } catch {
        // Non-blocking
    }

    await recordSecurityEvent({
        userId,
        eventType: "sessions_revoked_all",
        title: "All Sessions Terminated",
        description: `Terminated all ${count} active device session(s) across all platforms.`,
        severity: "critical",
        metadata: { revokedCount: count, reason },
    });

    return { success: true, revokedCount: count };
}

/**
 * 7. SESSION REVOCATION CHECK (Called in auth middleware)
 */
export async function isSessionRevoked(sessionId: string): Promise<boolean> {
    if (!sessionId) return true;

    // Fast O(1) Redis check
    try {
        if (redis && redis.status === "ready") {
            const isRevoked = await redis.get(`session:revoked:${sessionId}`);
            if (isRevoked) return true;

            const isActive = await redis.get(`session:active:${sessionId}`);
            if (isActive) return false;
        }
    } catch {
        // Fallback to Postgres
    }

    const check = await query(
        `SELECT status, expires_at FROM user_sessions WHERE session_id = $1 LIMIT 1;`,
        [sessionId]
    );

    if (!check.rows[0]) return true; // Session unknown -> invalid
    const row = check.rows[0];
    if (row.status !== "active" || new Date(row.expires_at) <= new Date()) {
        return true;
    }

    return false;
}

/**
 * 8. THROTTLED TOUCH OF SESSION LAST ACTIVE (Once per 5 mins per session)
 */
export async function throttleTouchSession(sessionId: string): Promise<void> {
    if (!sessionId) return;

    try {
        if (redis && redis.status === "ready") {
            const touched = await redis.set(
                `session:touch:${sessionId}`,
                "1",
                "EX",
                ACTIVITY_TOUCH_THROTTLE_SECONDS,
                "NX"
            );
            // If key was newly set, execute database touch asynchronously
            if (touched) {
                query(
                    `UPDATE user_sessions SET last_active_at = NOW() WHERE session_id = $1;`,
                    [sessionId]
                ).catch(() => {});
            }
        } else {
            // Database touch fallback
            query(
                `UPDATE user_sessions
                 SET last_active_at = NOW()
                 WHERE session_id = $1 AND last_active_at < NOW() - INTERVAL '5 minutes';`,
                [sessionId]
            ).catch(() => {});
        }
    } catch {
        // Silent non-blocking touch
    }
}

/**
 * 9. RECORD SECURITY EVENT
 */
export async function recordSecurityEvent(params: {
    userId: string;
    sessionId?: string | null;
    eventType: string;
    title: string;
    description: string;
    severity?: "info" | "warning" | "high" | "critical";
    ipAddressMasked?: string | null;
    locationSummary?: string | null;
    deviceSummary?: string | null;
    metadata?: Record<string, any>;
}): Promise<void> {
    try {
        await query(
            `INSERT INTO account_security_events (
                user_id,
                session_id,
                event_type,
                title,
                description,
                severity,
                ip_address_masked,
                location_summary,
                device_summary,
                metadata,
                created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW());`,
            [
                params.userId,
                params.sessionId || null,
                params.eventType,
                params.title,
                params.description,
                params.severity || "info",
                params.ipAddressMasked || null,
                params.locationSummary || null,
                params.deviceSummary || null,
                JSON.stringify(params.metadata || {}),
            ]
        );
    } catch (err: any) {
        console.warn("[Session] Security event logging non-blocking error:", err?.message);
    }
}

/**
 * 10. GET SECURITY TIMELINE FOR USER
 */
export async function getSecurityEvents(
    userId: string,
    limit = 20,
    offset = 0
): Promise<{ events: SecurityEventItem[]; total: number }> {
    const countRes = await query(
        `SELECT COUNT(*)::int AS total FROM account_security_events WHERE user_id = $1;`,
        [userId]
    );

    const res = await query(
        `SELECT
            id,
            event_type AS "eventType",
            title,
            description,
            severity,
            ip_address_masked AS "ipAddressMasked",
            location_summary AS "locationSummary",
            device_summary AS "deviceSummary",
            metadata,
            created_at AS "createdAt"
        FROM account_security_events
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3;`,
        [userId, Math.min(limit, 50), offset]
    );

    return {
        total: countRes.rows[0]?.total || 0,
        events: res.rows,
    };
}

/**
 * 11. GET LOGIN & SESSION OVERVIEW METRICS
 */
export async function getLoginOverview(
    userId: string,
    currentSessionId?: string
): Promise<{
    totalActiveSessions: number;
    recognizedDevicesCount: number;
    latestLoginAt: string | null;
    currentSession: UserSessionItem | null;
    activeSessions: UserSessionItem[];
}> {
    const activeSessions = await getActiveSessions(userId, currentSessionId);

    const devCountRes = await query(
        `SELECT COUNT(DISTINCT device_id_hash)::int AS count
         FROM user_sessions
         WHERE user_id = $1 AND status != 'revoked';`,
        [userId]
    );

    const latestLoginRes = await query(
        `SELECT created_at FROM user_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC LIMIT 1;`,
        [userId]
    );

    const currentSession = activeSessions.find((s) => s.isCurrentSession) || activeSessions[0] || null;

    return {
        totalActiveSessions: activeSessions.length,
        recognizedDevicesCount: devCountRes.rows[0]?.count || 1,
        latestLoginAt: latestLoginRes.rows[0]?.created_at || null,
        currentSession,
        activeSessions,
    };
}
