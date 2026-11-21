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
 * Records a verified share action with strict semantic differentiation:
 * 1. 'internal': Internal Orbix peer sharing (requires authenticated user + valid recipient)
 * 2. 'external': Completed native/external sharing (Web Share API resolved)
 * 3. 'copy_link': Successful clipboard link copy (tracked separately, does not increment public shareCount)
 */
export async function recordEventShareHandler(req: Request, res: Response): Promise<void> {
    try {
        const eventId = getCleanParam(req.params.eventId);
        const idempotencyKey = getCleanParam(req.body?.idempotencyKey) || `key-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const rawShareType = getCleanParam(req.body?.shareType);
        const rawPlatform = getCleanParam(req.body?.platform);
        const recipientUserId = getCleanParam(req.body?.recipientUserId) || null;
        const rawRecipientIds = req.body?.recipientUserIds;
        const recipientUserIds = Array.isArray(rawRecipientIds)
            ? rawRecipientIds.map((id: any) => getCleanParam(id)).filter(Boolean)
            : undefined;
        const note = getCleanParam(req.body?.note) || getCleanParam(req.body?.message) || undefined;
        const authUser = req.user as any;
        const userId = authUser?.id || null;
        const accountType = authUser?.accountType || authUser?.account_type || undefined;
        const ip = req.ip || req.socket.remoteAddress || "unknown_ip";

        if (!eventId) {
            res.status(400).json({ success: false, message: "Missing eventId parameter" });
            return;
        }

        // Normalize shareType and platform
        let shareType: "internal" | "external" | "copy_link" = "external";
        if (rawShareType === "internal" || rawShareType === "copy_link" || rawShareType === "external") {
            shareType = rawShareType;
        } else if (rawPlatform === "clipboard") {
            shareType = "copy_link";
        } else if (rawPlatform === "internal" || recipientUserId || (recipientUserIds && recipientUserIds.length > 0)) {
            shareType = "internal";
        }

        const platform = rawPlatform || (shareType === "copy_link" ? "clipboard" : shareType === "internal" ? "orbix_peer" : "web_share");
        const rateLimitIdentifier = userId || `ip_${ip}`;

        const result = await recordEventShare({
            eventIdOrSlug: eventId,
            idempotencyKey,
            userId,
            accountType,
            shareType,
            platform,
            recipientUserId,
            recipientUserIds,
            note,
            rateLimitIdentifier,
        });

        res.status(200).json({
            success: true,
            sharesCount: result.shareCount,
            publicCountIncremented: result.publicCountIncremented,
            shareType: result.shareType,
            data: result,
        });
    } catch (err: any) {
        console.error("[eventEngagementController] recordEventShareHandler error:", err);
        const statusCode =
            err.message?.includes("Authentication required") ? 401 :
            err.message?.includes("Club accounts are restricted") || err.message?.includes("restricted to external sharing only") ? 403 :
            err.message?.includes("not a connected peer") ? 403 :
            err.message?.includes("Notification limit reached") || err.message?.includes("Share limit reached") || err.code === "NOTIFICATION_LIMIT_REACHED" ? 429 :
            err.message?.includes("not found") ? 404 :
            err.message?.includes("required") || err.message?.includes("Cannot share") || err.message?.includes("Invalid") ? 400 :
            500;
        res.status(statusCode).json({ success: false, message: err.message || "Failed to record event share" });
    }
}
