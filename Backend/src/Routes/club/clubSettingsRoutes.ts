import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { ClubSettingsService } from "../../services/club/clubSettingsService.js";
import { EmailVerificationService } from "../../services/email/emailVerificationService.js";

const clubSettingsRouter = express.Router();

/**
 * GET /api/club/settings/status
 * Fetches authoritative settings status for the authenticated club:
 * club identity, branding, privacy, user email verification, quotas & stats.
 */
clubSettingsRouter.get("/status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const status = await ClubSettingsService.getClubSettingsStatus(userId);
        return res.json({
            success: true,
            ...status,
        });
    } catch (err: any) {
        console.error("GET /api/club/settings/status error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load club settings status.",
        });
    }
});

/**
 * PATCH /api/club/settings/privacy
 * Updates club showcase visibility (public / private / unlisted) and recruitment status.
 */
clubSettingsRouter.patch("/privacy", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const result = await ClubSettingsService.updateClubPrivacy(userId, req.body);
        return res.json(result);
    } catch (err: any) {
        console.error("PATCH /api/club/settings/privacy error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update club privacy.",
        });
    }
});

/**
 * POST /api/club/settings/password/change
 * Authenticated & production-ready password change for the club administrator.
 */
clubSettingsRouter.post("/password/change", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const result = await ClubSettingsService.changePassword(userId, currentPassword, newPassword, confirmPassword);
        return res.json(result);
    } catch (err: any) {
        console.error("POST /api/club/settings/password/change error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to change club password.",
        });
    }
});

/**
 * POST /api/club/settings/verify-email/send
 * Sends 6-digit verification OTP to the club's registered primary email.
 */
clubSettingsRouter.post("/verify-email/send", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const { club, user } = await ClubSettingsService.getClubAndUser(userId);
        const email = req.body?.email || user?.gmail || club.public_email;
        if (!email) {
            return res.status(400).json({ success: false, message: "Valid club email address is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await EmailVerificationService.sendOtp({
            userId,
            email,
            name: club.name || "Club Representative",
            ipAddress: ip,
            userAgent,
        });

        return res.json(result);
    } catch (err: any) {
        console.error("POST /api/club/settings/verify-email/send error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to dispatch verification code.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/club/settings/verify-email/confirm
 * Validates the 6-digit OTP code and marks the club's primary email verified.
 */
clubSettingsRouter.post("/verify-email/confirm", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const { otp } = req.body;
        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit verification code is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";

        const result = await EmailVerificationService.verifyOtp({
            userId,
            otp: otp.trim(),
            ipAddress: ip,
        });

        return res.json(result);
    } catch (err: any) {
        console.error("POST /api/club/settings/verify-email/confirm error:", err);
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to verify email.",
        });
    }
});

/**
 * GET /api/club/settings/data-archive
 * Streams club data archive (organization metadata, coordinators, achievements, events, team roster).
 */
clubSettingsRouter.get("/data-archive", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const archive = await ClubSettingsService.exportClubData(userId);
        const filename = `orbix-club-archive-${archive.organization.slug}-${new Date().toISOString().split("T")[0]}.json`;
        const jsonContent = JSON.stringify(archive, null, 2);

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", Buffer.byteLength(jsonContent, "utf8"));

        return res.send(jsonContent);
    } catch (err: any) {
        console.error("GET /api/club/settings/data-archive error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to export club data.",
        });
    }
});

export default clubSettingsRouter;
