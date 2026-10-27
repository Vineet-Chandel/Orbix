import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";

const notificationsRouter = express.Router();

/**
 * GET /api/notifications
 * Retrieves notifications for authenticated user.
 * Optional query parameter ?autoMarkRead=true to automatically mark returned notifications as read.
 */
notificationsRouter.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const autoMarkRead = req.query.autoMarkRead === "true" || req.query.autoMarkRead === "1";

        const userIdentifier = (authUser.username || "").toLowerCase();
        const userGmail = (authUser.gmail || "").toLowerCase();
        const userId = authUser.id || null;

        const unreadCountRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM user_notifications
             WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3) AND is_read = false;`,
            [userId, userIdentifier, userGmail]
        );
        const unreadCount = unreadCountRes.rows[0]?.count ?? 0;

        const notificationsRes = await query(
            `SELECT
                n.id,
                n.title,
                n.body,
                COALESCE(n.notification_type, n.type) AS type,
                n.metadata,
                n.is_read AS "isRead",
                n.read_at AS "readAt",
                n.created_at AS "createdAt",
                n.actor_id AS "actorId",
                n.relationship_id AS "relationshipId",
                u.id AS "senderId",
                u.username AS "senderUsername",
                u.firstname AS "senderFirstName",
                u.lastname AS "senderLastName",
                NULLIF(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), '') AS "senderDisplayName",
                COALESCE(u.photo_url, u.avatar_url, 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png') AS "senderAvatarUrl",
                u.headline AS "senderHeadline",
                u.bio AS "senderBio",
                u.college AS "senderCollege",
                u.location AS "senderLocation",
                u.orbix_score AS "senderOrbixScore",
                u.total_solved AS "senderTotalSolved",
                u.is_verified_coder AS "senderIsVerifiedCoder"
             FROM user_notifications n
             LEFT JOIN users u ON (n.actor_id IS NOT NULL AND u.id = n.actor_id)
                               OR (n.actor_id IS NULL AND n.metadata->>'username' IS NOT NULL AND LOWER(u.username) = LOWER(n.metadata->>'username'))
             WHERE (n.user_id = $1 OR LOWER(n.username) = $2 OR LOWER(n.username) = $3)
             ORDER BY n.created_at DESC
             LIMIT 50;`,
            [userId, userIdentifier, userGmail]
        );

        const enrichedNotifications = notificationsRes.rows.map((row) => {
            const meta = { ...(row.metadata || {}) };

            // If notification is associated with an actor or sender
            if (row.senderUsername || row.senderDisplayName || row.actorId) {
                const displayName =
                    row.senderDisplayName ||
                    meta.displayName ||
                    meta.senderName ||
                    row.senderUsername ||
                    "A developer";

                meta.senderProfile = {
                    id: row.senderId || row.actorId || meta.actorId,
                    username: row.senderUsername || meta.username,
                    displayName,
                    avatarUrl: row.senderAvatarUrl || meta.avatarUrl,
                    headline: row.senderHeadline || meta.headline || null,
                    bio: row.senderBio || meta.bio || null,
                    college: row.senderCollege || meta.college || null,
                    location: row.senderLocation || meta.location || null,
                    orbixScore: row.senderOrbixScore ?? meta.orbixScore ?? 0,
                    totalSolved: row.senderTotalSolved ?? meta.totalSolved ?? 0,
                    isVerifiedCoder: Boolean(row.senderIsVerifiedCoder ?? meta.isVerifiedCoder),
                };

                // Normalize top-level meta so legacy callers get correct sender name & avatar
                meta.senderName = displayName;
                meta.username = row.senderUsername || meta.username;
                meta.actorId = row.senderId || row.actorId || meta.actorId;
                meta.avatarUrl = row.senderAvatarUrl || meta.avatarUrl;
                meta.headline = row.senderHeadline || meta.headline;
                meta.college = row.senderCollege || meta.college;
                meta.location = row.senderLocation || meta.location;
            }

            return {
                id: row.id,
                title: row.title,
                body: row.body,
                type: row.type,
                metadata: meta,
                isRead: row.isRead,
                readAt: row.readAt,
                createdAt: row.createdAt,
            };
        });

        // If autoMarkRead requested, update unread records automatically
        if (autoMarkRead && unreadCount > 0) {
            await query(
                `UPDATE user_notifications
                 SET is_read = true, read_at = CURRENT_TIMESTAMP
                 WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3) AND is_read = false;`,
                [userId, userIdentifier, userGmail]
            );
        }

        return res.status(200).json({
            success: true,
            notifications: enrichedNotifications,
            unreadCount: autoMarkRead ? 0 : unreadCount,
        });
    } catch (err: any) {
        console.error("GET /api/notifications error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve notifications",
            error: err.message,
        });
    }
});

/**
 * GET /api/notifications/unread-count
 * Fast endpoint for polling unread notification count.
 */
notificationsRouter.get("/unread-count", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const userIdentifier = (authUser.username || "").toLowerCase();
        const userGmail = (authUser.gmail || "").toLowerCase();
        const userId = authUser.id || null;

        const countRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM user_notifications
             WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3) AND is_read = false;`,
            [userId, userIdentifier, userGmail]
        );

        return res.status(200).json({
            success: true,
            unreadCount: countRes.rows[0]?.count ?? 0,
        });
    } catch (err: any) {
        console.error("GET /api/notifications/unread-count error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch unread count",
            error: err.message,
        });
    }
});

/**
 * POST /api/notifications/mark-read
 * Automatically or explicitly marks notifications as read.
 * Body: { notificationIds?: string[] } (if empty/omitted, marks all unread as read)
 */
notificationsRouter.post("/mark-read", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const userIdentifier = (authUser.username || "").toLowerCase();
        const userGmail = (authUser.gmail || "").toLowerCase();
        const userId = authUser.id || null;
        const { notificationIds } = req.body;

        if (Array.isArray(notificationIds) && notificationIds.length > 0) {
            await query(
                `UPDATE user_notifications
                 SET is_read = true, read_at = CURRENT_TIMESTAMP
                 WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3) AND id = ANY($4::uuid[]);`,
                [userId, userIdentifier, userGmail, notificationIds]
            );
        } else {
            // Mark all notifications as read for this user
            await query(
                `UPDATE user_notifications
                 SET is_read = true, read_at = CURRENT_TIMESTAMP
                 WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3) AND is_read = false;`,
                [userId, userIdentifier, userGmail]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Notifications marked as read",
            unreadCount: 0,
        });
    } catch (err: any) {
        console.error("POST /api/notifications/mark-read error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to mark notifications as read",
            error: err.message,
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Deletes a notification belonging to the authenticated user.
 */
notificationsRouter.delete("/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const userIdentifier = (authUser.username || "").toLowerCase();
        const userGmail = (authUser.gmail || "").toLowerCase();
        const userId = authUser.id || null;
        const { id } = req.params;

        await query(
            `DELETE FROM user_notifications
             WHERE id = $1 AND (user_id = $2 OR LOWER(username) = $3 OR LOWER(username) = $4);`,
            [id, userId, userIdentifier, userGmail]
        );

        return res.status(200).json({
            success: true,
            message: "Notification deleted",
        });
    } catch (err: any) {
        console.error("DELETE /api/notifications/:id error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to delete notification",
            error: err.message,
        });
    }
});

/**
 * POST /api/notifications/send
 * Sends an eligible user-triggered notification (with 3 per 24h rolling limit).
 */
import { handleSendNotification } from "../relationships/relationshipRoutes.js";
notificationsRouter.post("/send", authenticate, handleSendNotification);

export default notificationsRouter;
