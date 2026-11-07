import type { Request, Response, NextFunction } from "express";
import { query } from "../database/client.js";
import redis from "../redis/client.js";
import { ClubTeamService, type ClubUserPermissions } from "../services/club/clubTeamService.js";
import { FormLogger } from "../utils/formLogger.js";

// In-memory fallback rate limit map if Redis is temporarily offline
const memoryRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number): boolean {
    const now = Date.now();
    const entry = memoryRateLimitMap.get(key);
    if (!entry || now > entry.resetAt) {
        memoryRateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return true;
    }
    if (entry.count >= limit) {
        return false;
    }
    entry.count += 1;
    return true;
}

/**
 * Middleware: Verify that the caller has authoritative management permissions for the club event
 * Verifies event existence, club ownership, and club team membership roles.
 */
export function requireClubFormManagementPermission(action: "manage" | "publish" | "delete" | "export" = "manage") {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required to access club form builder.",
                });
            }

            const eventId = String(req.params.eventId || req.body?.eventId || "");
            const directClubId = String(req.params.clubId || req.body?.clubId || req.query?.clubId || "");

            let targetClubId = directClubId;
            let eventRow: any = null;

            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId);
            if (eventId && isUuid) {
                const eventRes = await query(
                    `SELECT e.id AS "eventId", e.club_id AS "clubId", e.title AS "eventTitle",
                            vc.auth_user_id AS "clubOwnerId", vc.name AS "clubName"
                     FROM club_events e
                     JOIN verified_clubs vc ON vc.id = e.club_id
                     WHERE e.id = $1 LIMIT 1;`,
                    [eventId]
                );

                if (!eventRes.rows[0]) {
                    return res.status(404).json({
                        success: false,
                        message: "Event not found or does not belong to a verified club.",
                    });
                }

                eventRow = eventRes.rows[0];
                targetClubId = eventRow.clubId;
            } else if (eventId && !isUuid) {
                // Draft or non-UUID event (e.g. "create-draft")
                if (!targetClubId) {
                    const staffRes = await query(
                        `SELECT id FROM verified_clubs WHERE auth_user_id = $1
                         UNION
                         SELECT club_id AS id FROM club_team_members WHERE user_id = $1 LIMIT 1;`,
                        [userId]
                    );
                    if (staffRes.rows[0]) {
                        targetClubId = staffRes.rows[0].id;
                    }
                }
            }

            if (!targetClubId) {
                return res.status(400).json({
                    success: false,
                    message: "Event ID or Club ID is required for authorization check.",
                });
            }

            // Global platform administrator override
            const isAdminAccount = (req.user as any)?.accountType === "admin" || (req.user as any)?.account_type === "admin";
            if (isAdminAccount) {
                (req as any).clubEvent = eventRow;
                return next();
            }

            // Direct club creator / owner check
            if (eventRow && eventRow.clubOwnerId === userId) {
                (req as any).clubEvent = eventRow;
                return next();
            }

            // Authoritative club team permissions check
            const perms: ClubUserPermissions | null = await ClubTeamService.resolveUserClubPermissions(userId, targetClubId);

            if (!perms || perms.userRole === "none") {
                FormLogger.warn("FORM_SECURITY_VIOLATION" as any, "Unauthorized club management access attempt", {
                    eventId,
                    clubId: targetClubId,
                    userId,
                    meta: { action, reason: "User has no membership in this club" },
                });
                return res.status(403).json({
                    success: false,
                    message: "Access forbidden: You are not an authorized staff member or leader of this club.",
                });
            }

            // Elevated actions (publish, delete draft, export student data) require leadership/admin roles
            if (action === "publish" || action === "delete" || action === "export") {
                if (!perms.isOwner && !perms.isAdmin && !perms.isTeamLead) {
                    FormLogger.warn("FORM_SECURITY_VIOLATION" as any, `Insufficient permissions for elevated form action: ${action}`, {
                        eventId,
                        clubId: targetClubId,
                        userId,
                        meta: { action, role: perms.userRole },
                    });
                    return res.status(403).json({
                        success: false,
                        message: `Access forbidden: ${action.toUpperCase()} action requires club leadership or administrator permissions.`,
                    });
                }
            }

            (req as any).clubEvent = eventRow;
            (req as any).clubPermissions = perms;
            return next();
        } catch (err: any) {
            console.error("requireClubFormManagementPermission error:", err);
            return res.status(500).json({
                success: false,
                message: "Internal server error verifying club permissions.",
            });
        }
    };
}

/**
 * Middleware: Rate limit student registration submissions to prevent bot spam and DDoS
 * Limits: 10 requests per minute per IP, 5 requests per 30 seconds per user
 */
export async function rateLimitFormSubmissions(req: Request, res: Response, next: NextFunction) {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const userId = req.user?.id;
    const ipKey = `rate:form:submit:ip:${ip}`;
    const userKey = userId ? `rate:form:submit:user:${userId}` : null;

    try {
        if (redis && redis.status === "ready") {
            const multi = redis.multi();
            multi.incr(ipKey);
            multi.ttl(ipKey);
            if (userKey) {
                multi.incr(userKey);
                multi.ttl(userKey);
            }
            const results = await multi.exec();

            if (results) {
                const ipAttempts = (results[0]?.[1] as number) || 1;
                const ipTtl = (results[1]?.[1] as number) || -1;
                if (ipTtl === -1) {
                    await redis.expire(ipKey, 60).catch(() => {});
                }

                if (ipAttempts > 12) {
                    FormLogger.warn("RATE_LIMIT_EXCEEDED" as any, "Submission rate limit exceeded by IP", {
                        userId,
                        meta: { ip, ipAttempts },
                    });
                    return res.status(429).json({
                        success: false,
                        message: "Too many registration attempts. Please wait a moment before trying again.",
                        retryAfterSeconds: Math.max(1, ipTtl),
                    });
                }

                if (userKey) {
                    const userAttempts = (results[2]?.[1] as number) || 1;
                    const userTtl = (results[3]?.[1] as number) || -1;
                    if (userTtl === -1) {
                        await redis.expire(userKey, 30).catch(() => {});
                    }

                    if (userAttempts > 6) {
                        FormLogger.warn("RATE_LIMIT_EXCEEDED" as any, "Submission rate limit exceeded by authenticated user", {
                            userId,
                            meta: { userAttempts },
                        });
                        return res.status(429).json({
                            success: false,
                            message: "Too many registration attempts on your account. Please wait 30 seconds.",
                            retryAfterSeconds: Math.max(1, userTtl),
                        });
                    }
                }
            }
        } else {
            // In-memory fallback rate limiting
            const ipAllowed = checkMemoryRateLimit(ipKey, 12, 60);
            if (!ipAllowed) {
                return res.status(429).json({
                    success: false,
                    message: "Too many registration attempts. Please wait a moment.",
                });
            }
            if (userKey) {
                const userAllowed = checkMemoryRateLimit(userKey, 6, 30);
                if (!userAllowed) {
                    return res.status(429).json({
                        success: false,
                        message: "Too many registration attempts. Please wait a moment.",
                    });
                }
            }
        }

        return next();
    } catch (err) {
        console.warn("rateLimitFormSubmissions check warning:", err);
        return next(); // Fail open if rate-limiter encounters unexpected error
    }
}

/**
 * Middleware: Mutex lock to prevent simultaneous concurrent form submissions from the same student/IP
 */
export async function preventConcurrentSubmissions(req: Request, res: Response, next: NextFunction) {
    const eventId = String(req.params.eventId || req.body?.eventId || "");
    const identifier = req.user?.id || req.ip || req.socket.remoteAddress || "client";
    const lockKey = `orbix:lock:form_sub:${eventId}:${identifier}`;

    let lockAcquired = false;
    try {
        if (redis && redis.status === "ready") {
            const result = await redis.set(lockKey, "locked", "EX", 8, "NX");
            if (!result) {
                return res.status(409).json({
                    success: false,
                    message: "A registration submission is already processing for your account. Please wait.",
                });
            }
            lockAcquired = true;
        }

        const cleanup = () => {
            if (lockAcquired && redis && redis.status === "ready") {
                redis.del(lockKey).catch(() => {});
            }
        };

        res.on("finish", cleanup);
        res.on("close", cleanup);

        return next();
    } catch (err) {
        console.warn("preventConcurrentSubmissions error:", err);
        return next();
    }
}

/**
 * Middleware: Rate limit student draft autosaves
 * Limits: 35 autosaves per minute per user/IP
 */
export async function rateLimitDraftAutosave(req: Request, res: Response, next: NextFunction) {
    const identifier = req.user?.id || req.ip || "client";
    const key = `rate:form:autosave:${identifier}`;

    try {
        if (redis && redis.status === "ready") {
            const count = await redis.incr(key);
            if (count === 1) {
                await redis.expire(key, 60).catch(() => {});
            }
            if (count > 40) {
                return res.status(429).json({
                    success: false,
                    message: "Autosave rate limit reached. Pausing sync for 60 seconds.",
                });
            }
        } else {
            const allowed = checkMemoryRateLimit(key, 40, 60);
            if (!allowed) {
                return res.status(429).json({
                    success: false,
                    message: "Autosave rate limit reached.",
                });
            }
        }
        return next();
    } catch {
        return next();
    }
}
