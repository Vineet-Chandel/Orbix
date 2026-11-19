// Backend/src/controllers/workspace/workspaceNotificationController.ts
import crypto from "crypto";
import type { Request, Response } from "express";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "../../services/workspace/workspaceService.js";
import { query } from "../../database/client.js";

export class WorkspaceNotificationController {
    /**
     * GET /api/club/workspace/:workspaceId/notifications
     * Lists in-app notifications for the authenticated user.
     */
    static async listNotifications(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required" });
            }

            const workspaceId = String(req.params.workspaceId);
            const context = await WorkspaceService.resolveContext(workspaceId, authUser.id);
            if (!context || (!context.member && !context.isOwner)) {
                return res.status(403).json({ success: false, message: "Forbidden: Not a member of this workspace" });
            }

            const unreadOnly = req.query.unreadOnly === "true" || req.query.unreadOnly === "1";
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

            const result = await WorkspaceRepository.getUserNotifications(workspaceId, authUser.id, {
                unreadOnly,
                limit,
                offset,
            });

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (err: any) {
            console.error("[NotificationController] listNotifications error:", err);
            return res.status(500).json({ success: false, message: err.message || "Internal server error" });
        }
    }

    /**
     * PATCH /api/club/workspace/:workspaceId/notifications/:notificationId/read
     * Marks a specific notification as read.
     */
    static async markAsRead(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required" });
            }

            const workspaceId = String(req.params.workspaceId);
            const notificationId = String(req.params.notificationId);
            const success = await WorkspaceRepository.markNotificationRead(workspaceId, authUser.id, notificationId);

            return res.status(200).json({
                success: true,
                data: { updated: success },
            });
        } catch (err: any) {
            console.error("[NotificationController] markAsRead error:", err);
            return res.status(500).json({ success: false, message: err.message || "Internal server error" });
        }
    }

    /**
     * POST /api/club/workspace/:workspaceId/notifications/read-all
     * Marks all unread notifications as read.
     */
    static async markAllAsRead(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required" });
            }

            const workspaceId = String(req.params.workspaceId);
            const count = await WorkspaceRepository.markAllNotificationsRead(workspaceId, authUser.id);

            return res.status(200).json({
                success: true,
                data: { markedCount: count },
            });
        } catch (err: any) {
            console.error("[NotificationController] markAllAsRead error:", err);
            return res.status(500).json({ success: false, message: err.message || "Internal server error" });
        }
    }

    /**
     * GET /api/club/workspace/:workspaceId/notifications/preferences
     * Retrieves notification preferences for the authenticated member.
     */
    static async getPreferences(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required" });
            }

            const workspaceId = String(req.params.workspaceId);
            const preferences = await WorkspaceRepository.getUserNotificationPreferences(workspaceId, authUser.id);

            return res.status(200).json({
                success: true,
                data: preferences,
            });
        } catch (err: any) {
            console.error("[NotificationController] getPreferences error:", err);
            return res.status(500).json({ success: false, message: err.message || "Internal server error" });
        }
    }

    /**
     * PUT /api/club/workspace/:workspaceId/notifications/preferences
     * Updates notification preferences for the authenticated member.
     */
    static async updatePreferences(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required" });
            }

            const workspaceId = String(req.params.workspaceId);
            const {
                emailTaskAssigned,
                emailTaskReminders,
                emailMentions,
                emailDiscussions,
                emailDigestFrequency,
                mutedUntil,
            } = req.body;

            const prefsToUpdate: Record<string, any> = {};
            if (typeof emailTaskAssigned === "boolean") prefsToUpdate.emailTaskAssigned = emailTaskAssigned;
            if (typeof emailTaskReminders === "boolean") prefsToUpdate.emailTaskReminders = emailTaskReminders;
            if (typeof emailMentions === "boolean") prefsToUpdate.emailMentions = emailMentions;
            if (typeof emailDiscussions === "boolean") prefsToUpdate.emailDiscussions = emailDiscussions;
            if (["instant", "daily", "none"].includes(emailDigestFrequency)) prefsToUpdate.emailDigestFrequency = emailDigestFrequency;
            if (mutedUntil !== undefined) prefsToUpdate.mutedUntil = mutedUntil;

            const updated = await WorkspaceRepository.upsertUserNotificationPreferences(
                workspaceId,
                authUser.id,
                prefsToUpdate
            );

            return res.status(200).json({
                success: true,
                data: updated,
            });
        } catch (err: any) {
            console.error("[NotificationController] updatePreferences error:", err);
            return res.status(500).json({ success: false, message: err.message || "Internal server error" });
        }
    }

    /**
     * POST /api/club/workspace/webhooks/resend
     * Verified Resend webhook endpoint with signature verification & replay protection.
     */
    static async handleResendWebhook(req: Request, res: Response) {
        try {
            const secret = process.env.RESEND_WEBHOOK_SECRET || "whsec_test_secret_for_orbix_2026";
            const svixId = (req.headers["svix-id"] as string) || (req.headers["webhook-id"] as string);
            const svixTimestamp = (req.headers["svix-timestamp"] as string) || (req.headers["webhook-timestamp"] as string);
            const svixSignature = (req.headers["svix-signature"] as string) || (req.headers["webhook-signature"] as string);

            // 1. Validate signature presence
            if (!svixId || !svixTimestamp || !svixSignature) {
                return res.status(400).json({
                    success: false,
                    message: "Missing webhook signature headers (svix-id, svix-timestamp, svix-signature)",
                });
            }

            // 2. Replay protection: Check timestamp drift (5 minute tolerance)
            const timestampSec = parseInt(svixTimestamp, 10);
            const nowSec = Math.floor(Date.now() / 1000);
            if (isNaN(timestampSec) || Math.abs(nowSec - timestampSec) > 300) {
                return res.status(400).json({
                    success: false,
                    message: "Webhook timestamp expired or out of tolerance (replay detected)",
                });
            }

            // 3. Raw payload verification
            const rawBody = (req as any).rawBody || JSON.stringify(req.body);
            const signedPayload = `${svixId}.${svixTimestamp}.${rawBody}`;

            const secretKey = secret.startsWith("whsec_") ? secret.slice(6) : secret;
            let secretBuffer: Buffer;
            try {
                secretBuffer = Buffer.from(secretKey, "base64");
                if (secretBuffer.length === 0) {
                    secretBuffer = Buffer.from(secretKey, "utf-8");
                }
            } catch {
                secretBuffer = Buffer.from(secretKey, "utf-8");
            }

            const expectedSignature = crypto
                .createHmac("sha256", secretBuffer)
                .update(signedPayload)
                .digest("base64");

            // Split multi-signatures (e.g. "v1,signature1 v1,signature2")
            const signatures = svixSignature
                .split(" ")
                .map((part) => (part.startsWith("v1,") ? part.slice(3) : part));

            const isValid = signatures.some((sig) => {
                try {
                    const a = Buffer.from(sig, "base64");
                    const b = Buffer.from(expectedSignature, "base64");
                    return a.length === b.length && crypto.timingSafeEqual(a, b);
                } catch {
                    return false;
                }
            });

            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    message: "Invalid webhook signature",
                });
            }

            // 4. Replay protection: Check if event ID was already processed
            const payload = req.body;
            const eventType = payload.type || "unknown";
            const isNew = await WorkspaceRepository.recordWebhookEvent(
                "resend",
                svixId,
                eventType,
                payload
            );

            if (!isNew) {
                // Already processed, return 200 without duplicate action
                return res.status(200).json({ success: true, message: "Duplicate webhook event already handled" });
            }

            // 5. Process email event update
            const emailId = payload.data?.email_id || payload.data?.id;
            if (emailId) {
                const delivery = await WorkspaceRepository.findEmailDeliveryByResendId(emailId);
                if (delivery) {
                    if (eventType === "email.sent") {
                        await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                            status: "sent",
                            sentAt: new Date(payload.created_at || Date.now()),
                        });
                    } else if (eventType === "email.delivered") {
                        await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                            status: "delivered",
                            deliveredAt: new Date(payload.created_at || Date.now()),
                        });
                    } else if (eventType === "email.bounced") {
                        await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                            status: "bounced",
                            error: payload.data?.bounce?.message || "Email bounced",
                        });
                    } else if (eventType === "email.complained") {
                        await WorkspaceRepository.updateEmailDelivery(delivery.id, {
                            status: "complained",
                            error: "Recipient marked as spam/complaint",
                        });
                    }
                }
            }

            return res.status(200).json({
                success: true,
                message: "Webhook processed successfully",
            });
        } catch (err: any) {
            console.error("[NotificationController] handleResendWebhook error:", err);
            return res.status(500).json({ success: false, message: err.message || "Webhook processing error" });
        }
    }
}
