// Backend/src/Routes/relationships/relationshipRoutes.ts
import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { query } from "../../database/client.js";
import {
    resolveRelationshipState,
    resolveRelationshipStatesBatch,
    requestConnection,
    acceptConnection,
    declineConnection,
    cancelConnection,
    removeConnection,
    getUserConnections,
    getPendingRequests,
} from "../../services/relationship/relationshipService.js";
import {
    blockUser,
    unblockUser,
    getBlockedUsers,
} from "../../services/relationship/blockService.js";
import {
    dispatchNotification,
    checkNotificationQuota,
} from "../../services/notification/quotaService.js";
import {
    getActionQuotaStatus,
} from "../../services/relationship/relationshipQuotaService.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Resolves a target user parameter (UUID or username) to canonical user ID.
 */
export async function resolveTargetUserId(param: string | string[] | undefined): Promise<string | null> {
    if (!param) return null;
    const raw = Array.isArray(param) ? (param[0] ?? "") : param;
    const cleanParam = raw ? String(raw).trim() : "";
    if (!cleanParam) return null;
    if (UUID_REGEX.test(cleanParam)) return cleanParam;

    const res = await query(
        `SELECT id FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1;`,
        [cleanParam]
    );
    return res.rows[0]?.id || null;
}

export const relationshipRouter = express.Router();
export const blockRouter = express.Router();
export const settingsRelationshipRouter = express.Router();

// ============================================================================
// RELATIONSHIPS ENDPOINTS (/api/relationships)
// ============================================================================

/**
 * POST /api/relationships/batch
 * Resolves relationship states for an array of target user IDs or handles in a single query.
 */
relationshipRouter.post("/batch", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const { userIds } = req.body;

        if (!Array.isArray(userIds) || userIds.length === 0) {
            return res.status(200).json({
                success: true,
                relationships: {},
            });
        }

        const cappedIds = userIds.slice(0, 100);
        const relationships = await resolveRelationshipStatesBatch(viewerId, cappedIds);

        return res.status(200).json({
            success: true,
            relationships,
        });
    } catch (err: any) {
        console.error("POST /api/relationships/batch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to resolve relationship states batch.",
            error: err.message,
        });
    }
});

/**
 * GET /api/relationships/requests/pending
 * High-performance paginated retrieval of incoming and outgoing pending requests.
 */
relationshipRouter.get("/requests/pending", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const filter = (req.query.type as "incoming" | "outgoing" | "all") || "all";
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

        const data = await getPendingRequests(viewerId, filter, limit, cursor);
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("GET /api/relationships/requests/pending error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch pending requests.",
            error: err.message,
        });
    }
});

/**
 * GET /api/relationships/quota
 * Returns current real-time quota status for connection requests and blocks.
 */
relationshipRouter.get("/quota", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const quota = await getActionQuotaStatus(viewerId);
        return res.status(200).json({
            success: true,
            quota,
        });
    } catch (err: any) {
        console.error("GET /api/relationships/quota error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve relationship quota status.",
            error: err.message,
        });
    }
});

/**
 * GET /api/relationships/:userId
 * Obtains viewer-specific relationship state with target user.
 */
relationshipRouter.get("/:userId", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const stateResult = await resolveRelationshipState(viewerId, targetUserId);
        return res.status(200).json({
            success: true,
            ...stateResult,
        });
    } catch (err: any) {
        console.error("GET /api/relationships/:userId error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to resolve relationship state.",
            error: err.message,
        });
    }
});

/**
 * POST /api/relationships/:userId/request
 * Initiates a connection request to target user.
 */
relationshipRouter.post("/:userId/request", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await requestConnection(viewerId, targetUserId, {
            username: req.user!.username,
            firstName: req.user!.firstName,
            lastName: req.user!.lastName,
        });

        if (!result.success && result.outcome === "rate_limited") {
            if (result.retryAfter) {
                res.setHeader("Retry-After", String(result.retryAfter));
            }
            return res.status(429).json(result);
        }

        const statusCode = result.success ? 200 : (result.outcome === "blocked" ? 403 : 400);
        return res.status(statusCode).json(result);
    } catch (err: any) {
        console.error("POST /api/relationships/:userId/request error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send connection request.",
            error: err.message,
        });
    }
});

/**
 * POST /api/relationships/:userId/accept
 * Accepts an incoming connection request.
 */
relationshipRouter.post("/:userId/accept", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await acceptConnection(viewerId, targetUserId, {
            username: req.user!.username,
            firstName: req.user!.firstName,
            lastName: req.user!.lastName,
        });

        const statusCode = result.success ? 200 : 400;
        return res.status(statusCode).json(result);
    } catch (err: any) {
        console.error("POST /api/relationships/:userId/accept error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to accept connection request.",
            error: err.message,
        });
    }
});

/**
 * POST /api/relationships/:userId/decline
 * Declines an incoming connection request.
 */
relationshipRouter.post("/:userId/decline", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await declineConnection(viewerId, targetUserId);
        const statusCode = result.success ? 200 : 400;
        return res.status(statusCode).json(result);
    } catch (err: any) {
        console.error("POST /api/relationships/:userId/decline error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to decline connection request.",
            error: err.message,
        });
    }
});

/**
 * POST /api/relationships/:userId/cancel
 * Cancels an outgoing connection request.
 */
relationshipRouter.post("/:userId/cancel", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await cancelConnection(viewerId, targetUserId);
        const statusCode = result.success ? 200 : 400;
        return res.status(statusCode).json(result);
    } catch (err: any) {
        console.error("POST /api/relationships/:userId/cancel error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to cancel connection request.",
            error: err.message,
        });
    }
});

/**
 * DELETE /api/relationships/:userId
 * Removes an existing connection.
 */
relationshipRouter.delete("/:userId", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await removeConnection(viewerId, targetUserId);
        const statusCode = result.success ? 200 : 400;
        return res.status(statusCode).json(result);
    } catch (err: any) {
        console.error("DELETE /api/relationships/:userId error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to remove connection.",
            error: err.message,
        });
    }
});

// ============================================================================
// USER BLOCKS ENDPOINTS (/api/blocks)
// ============================================================================

/**
 * POST /api/blocks/:userId
 * Blocks a target user.
 */
blockRouter.post("/:userId", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);
        const { reason } = req.body;

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        if (viewerId === targetUserId) {
            return res.status(400).json({
                success: false,
                message: "You cannot block yourself.",
            });
        }

        const result = await blockUser(viewerId, targetUserId, reason);

        if (!result.success && result.outcome === "rate_limited") {
            if (result.retryAfter) {
                res.setHeader("Retry-After", String(result.retryAfter));
            }
            return res.status(429).json(result);
        }

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("POST /api/blocks/:userId error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to block user.",
            error: err.message,
        });
    }
});

/**
 * DELETE /api/blocks/:userId
 * Unblocks a target user.
 */
blockRouter.delete("/:userId", authenticate, async (req: Request, res: Response) => {
    try {
        const viewerId = req.user!.id;
        const targetUserId = await resolveTargetUserId(req.params.userId);

        if (!targetUserId) {
            return res.status(404).json({
                success: false,
                message: "Target user not found.",
            });
        }

        const result = await unblockUser(viewerId, targetUserId);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("DELETE /api/blocks/:userId error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to unblock user.",
            error: err.message,
        });
    }
});

// ============================================================================
// SETTINGS RELATIONSHIPS ENDPOINTS (/api/settings)
// ============================================================================

/**
 * GET /api/settings/connections
 * Retrieves current user's accepted connections with cursor pagination and search.
 */
settingsRelationshipRouter.get("/connections", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
        const search = req.query.search ? String(req.query.search) : undefined;

        const data = await getUserConnections(userId, limit, cursor, search);
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("GET /api/settings/connections error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch connections.",
            error: err.message,
        });
    }
});

/**
 * GET /api/settings/blocked
 * Retrieves current user's blocked accounts with cursor pagination.
 */
settingsRelationshipRouter.get("/blocked", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || 20), 10)));
        const cursor = req.query.cursor ? String(req.query.cursor) : undefined;

        const data = await getBlockedUsers(userId, limit, cursor);
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("GET /api/settings/blocked error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch blocked users.",
            error: err.message,
        });
    }
});

/**
 * POST /api/notifications/send
 * Sends an eligible user-triggered notification adhering to the strict 3-per-24h rate limit.
 */
export async function handleSendNotification(req: Request, res: Response) {
    try {
        const actorId = req.user!.id;
        const { recipientId, title, body, notificationType, metadata, idempotencyKey } = req.body;

        if (!recipientId || !title || !body) {
            return res.status(400).json({
                success: false,
                message: "recipientId, title, and body are required.",
            });
        }

        const resolvedRecipientId = await resolveTargetUserId(recipientId);
        if (!resolvedRecipientId) {
            return res.status(404).json({
                success: false,
                message: "Recipient user not found.",
            });
        }

        // Verify not blocked
        const blockCheck = await resolveRelationshipState(actorId, resolvedRecipientId);
        if (blockCheck.state === "blocked_by_me" || blockCheck.state === "blocked_by_them") {
            return res.status(403).json({
                success: false,
                code: "BLOCKED",
                message: "Cannot notify blocked user.",
            });
        }

        // Verify connected or allowed to notify
        if (blockCheck.state !== "connected") {
            return res.status(403).json({
                success: false,
                code: "NOT_CONNECTED",
                message: "You can only notify connected peers.",
            });
        }

        const result = await dispatchNotification({
            recipientId: resolvedRecipientId,
            actorId,
            title: String(title).slice(0, 200),
            body: String(body).slice(0, 1000),
            notificationType: notificationType || "user_mention",
            metadata: metadata || {},
            idempotencyKey: idempotencyKey || null,
            isUserInitiated: true,
        });

        if (!result.success) {
            const status = result.code === "NOTIFICATION_LIMIT_REACHED" ? 429 : 500;
            return res.status(status).json({
                success: false,
                code: result.code,
                message: result.error,
                retryAfter: result.retryAfterSeconds,
            });
        }

        return res.status(200).json({
            success: true,
            message: "Notification sent successfully.",
            notification: result.notification,
        });
    } catch (err: any) {
        console.error("POST /api/notifications/send error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send notification.",
            error: err.message,
        });
    }
}
