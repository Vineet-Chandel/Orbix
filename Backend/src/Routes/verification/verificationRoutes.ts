import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { EmailVerificationService } from "../../services/email/emailVerificationService.js";
import { PhoneVerificationService } from "../../services/sms/phoneVerificationService.js";

const verificationRouter = Router();

/**
 * GET /status
 * Retrieves current email verification status, pending OTP status, and rate-limit cooldown.
 */
verificationRouter.get("/status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const email = req.user?.gmail;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const status = await EmailVerificationService.getStatus(userId, email || "");
        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (err: any) {
        console.error("[Verification API] Failed to get status:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve verification status",
        });
    }
});

/**
 * POST /send-otp
 * Dispatches a 6-digit OTP to the user's email via Resend with 60s cooldown.
 */
verificationRouter.post("/send-otp", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const requestedEmail = req.body?.email || req.user?.gmail;
        const name = req.user?.firstName || req.user?.username || "Developer";

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!requestedEmail || typeof requestedEmail !== "string") {
            return res.status(400).json({ success: false, message: "A valid email address is required" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(requestedEmail.trim())) {
            return res.status(400).json({ success: false, message: "Please provide a valid email format" });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await EmailVerificationService.sendOtp({
            userId,
            email: requestedEmail.trim(),
            name,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send verification code",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /verify-otp
 * Verifies the 6-digit OTP code, marks email verified in DB, and invalidates auth cache.
 */
verificationRouter.post("/verify-otp", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { otp } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit verification code is required" });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";

        const result = await EmailVerificationService.verifyOtp({
            userId,
            otp: otp.trim(),
            ipAddress: ip,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to verify code",
        });
    }
});

/**
 * POST /phone/verify-firebase
 * Securely associates a verified Firebase phone number with the authenticated Supabase user account.
 * Requires caller authentication and server-side cryptographic token validation.
 */
verificationRouter.post("/phone/verify-firebase", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { idToken, phone } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        if (!idToken || typeof idToken !== "string") {
            return res.status(400).json({ success: false, message: "Firebase ID token is required." });
        }

        if (!phone || typeof phone !== "string") {
            return res.status(400).json({ success: false, message: "Phone number is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await PhoneVerificationService.verifyFirebasePhoneAssociation({
            idToken,
            expectedPhone: phone,
            userId,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to associate phone number",
        });
    }
});

export default verificationRouter;
