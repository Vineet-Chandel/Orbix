// Backend/src/controllers/events/eventEngagementController.ts
import type { Request, Response } from "express";
import {
    getEventEngagement,
    getBatchEventEngagement,
    likeEvent,
    unlikeEvent,
    toggleEventLike,
    recordEventShare,
    resolveEventId,
} from "../../services/events/eventEngagementService.js";

function getCleanParam(val: any): string {
    if (!val) return "";
    return Array.isArray(val) ? String(val[0] || "").trim() : String(val).trim();
}

/**
 * GET /api/events/:eventId/engagement
 * Retrieves like count, share count, and viewer liked state.
 * Public endpoint (optionalAuthenticate).
 */
export async function getEventEngagementHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        const viewerId = req.user?.id || null;
        const result = await getEventEngagement(eventId, viewerId);

        if (!result) {
            res.status(404).json({ success: false, message: "Event not found" });
            return;
        }

        res.status(200).json({
            success: true,
            data: result,
            liked: result.likedByViewer,
            likesCount: result.likeCount,
            sharesCount: result.shareCount,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] getEventEngagementHandler error:", err);
        res.status(500).json({ success: false, message: "Failed to retrieve event engagement" });
    }
}

/**
 * POST /api/events/engagement/batch
 * Batch retrieval of like and share counts for multiple events.
 * Limits to 50 events per request.
 */
export async function getBatchEventEngagementHandler(req: Request, res: Response): Promise<void> {
    try {
        const rawList = req.body?.eventIds || req.body?.events || [];
        if (!Array.isArray(rawList)) {
            res.status(400).json({ success: false, message: "Payload must contain an array of eventIds" });
            return;
        }

        const eventIds = rawList.map(getCleanParam).filter(Boolean);
        if (eventIds.length === 0) {
            res.status(200).json({ success: true, data: { events: [] } });
            return;
        }

        const viewerId = req.user?.id || null;
        const results = await getBatchEventEngagement(eventIds, viewerId);

        res.status(200).json({
            success: true,
            data: {
                events: results,
            },
        });
    } catch (err: any) {
        console.error("[eventEngagementController] getBatchEventEngagementHandler error:", err);
        res.status(500).json({ success: false, message: "Failed to retrieve batch event engagement" });
    }
}

/**
 * POST /api/events/:eventId/likes
 * Idempotently adds a like to an event.
 * Authenticated endpoint.
 */
export async function likeEventHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        const userId = req.user?.id;

        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        if (!userId) {
            res.status(401).json({ success: false, message: "Authentication required to like events" });
            return;
        }

        const result = await likeEvent(eventId, userId);

        res.status(200).json({
            success: true,
            liked: true,
            likesCount: result.likeCount,
            data: result,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] likeEventHandler error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to like event" });
    }
}

/**
 * DELETE /api/events/:eventId/likes
 * Idempotently removes a like from an event.
 * Authenticated endpoint.
 */
export async function unlikeEventHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        const userId = req.user?.id;

        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        if (!userId) {
            res.status(401).json({ success: false, message: "Authentication required to unlike events" });
            return;
        }

        const result = await unlikeEvent(eventId, userId);

        res.status(200).json({
            success: true,
            liked: false,
            likesCount: result.likeCount,
            data: result,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] unlikeEventHandler error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to unlike event" });
    }
}

/**
 * POST /api/events/:eventId/like (Legacy / Toggle Endpoint)
 * Toggles like status on an event.
 * Preserves compatibility with existing frontend calls.
 */
export async function toggleEventLikeHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        const userId = req.user?.id;

        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        if (!userId) {
            res.status(401).json({ success: false, message: "Authentication required to like events" });
            return;
        }

        const result = await toggleEventLike(eventId, userId);

        res.status(200).json({
            success: true,
            liked: result.likedByViewer,
            likesCount: result.likeCount,
            data: result,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] toggleEventLikeHandler error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to toggle event like" });
    }
}

/**
 * POST /api/events/:eventId/shares
 * Records a successful share action with idempotency.
 * Supports both authenticated users and guests.
 */
export async function recordEventShareHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        const idempotencyKey = getCleanParam(req.body?.idempotencyKey) || `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const platform = getCleanParam(req.body?.platform) || "web_share";
        const userId = req.user?.id || null;
        const ip = req.ip || req.socket.remoteAddress || "unknown_ip";

        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        const rateLimitIdentifier = userId || `ip_${ip}`;
        const result = await recordEventShare(eventId, idempotencyKey, userId, platform, rateLimitIdentifier);

        res.status(200).json({
            success: true,
            sharesCount: result.shareCount,
            data: result,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] recordEventShareHandler error:", err);
        res.status(500).json({ success: false, message: err.message || "Failed to record event share" });
    }
}
