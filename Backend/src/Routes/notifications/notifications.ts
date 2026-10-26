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
                id,
                title,
                body,
                type,
                metadata,
                is_read AS "isRead",
                read_at AS "readAt",
                created_at AS "createdAt"
             FROM user_notifications
             WHERE (user_id = $1 OR LOWER(username) = $2 OR LOWER(username) = $3)
             ORDER BY created_at DESC
             LIMIT 50;`,
            [userId, userIdentifier, userGmail]
        );

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
            notifications: notificationsRes.rows,
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
