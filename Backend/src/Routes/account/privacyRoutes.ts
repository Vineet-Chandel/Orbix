// Backend/src/Routes/account/privacyRoutes.ts
import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
    getUserPrivacyPreferences,
    updateUserPrivacyPreferences,
    getPlatformDataInventory,
    requestAccountDeletion,
    cancelAccountDeletion,
    getPrivacyRequestHistory,
} from "../../services/account/privacyCenterService.js";

export const privacyRouter = express.Router();

/**
 * GET /api/account/privacy/preferences
 */
privacyRouter.get("/preferences", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const preferences = await getUserPrivacyPreferences(userId);
        return res.status(200).json({ success: true, preferences });
    } catch (err: any) {
        console.error("[Privacy] Get preferences error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * PUT /api/account/privacy/preferences
 */
privacyRouter.put("/preferences", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const preferences = await updateUserPrivacyPreferences(userId, req.body, ip, userAgent);
        return res.status(200).json({
            success: true,
            message: "Privacy preferences saved successfully.",
            preferences,
        });
    } catch (err: any) {
        console.error("[Privacy] Update preferences error:", err);
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/account/privacy/inventory
 * Public/authenticated endpoint listing data collection categories & governance
 */
privacyRouter.get("/inventory", (_req: Request, res: Response) => {
    const inventory = getPlatformDataInventory();
    return res.status(200).json({ success: true, inventory });
});

/**
 * POST /api/account/privacy/deletion
 * Schedule account deletion with 7-day grace period
 */
privacyRouter.post("/deletion", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";
        const reason = req.body?.reason;

        const result = await requestAccountDeletion(userId, reason, ip, userAgent);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[Privacy] Deletion request error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/account/privacy/deletion
 * Cancel scheduled account deletion
 */
privacyRouter.delete("/deletion", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await cancelAccountDeletion(userId, ip, userAgent);
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[Privacy] Cancel deletion error:", err);
        return res.status(400).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/account/privacy/history
 */
privacyRouter.get("/history", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const history = await getPrivacyRequestHistory(userId);
        return res.status(200).json({ success: true, ...history });
    } catch (err: any) {
        console.error("[Privacy] Get history error:", err);
        return res.status(500).json({ success: false, message: err.message });
    }
});
