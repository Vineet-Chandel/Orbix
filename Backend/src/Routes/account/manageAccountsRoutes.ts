import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { ManageAccountsService } from "../../services/account/manageAccountsService.js";
import { EmailVerificationService } from "../../services/email/emailVerificationService.js";
import { DataArchiveService } from "../../services/account/dataArchiveService.js";

const manageAccountsRouter = Router();

const isProduction = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const getAuthCookieOptions = () => ({
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProduction,
});

/**
 * GET /api/settings/manage-account/status
 * Fetches authoritative Manage Accounts status: current email & verification,
 * pending operation state, and monthly change quotas.
 */
manageAccountsRouter.get("/status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        const status = await ManageAccountsService.getStatus(userId);
        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to load account status.",
        });
    }
});

/**
 * POST /api/settings/manage-account/email/change/start
 * Step 1: Initiates an email change request.
 */
manageAccountsRouter.post("/email/change/start", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { newEmail } = req.body;
        if (!newEmail || typeof newEmail !== "string") {
            return res.status(400).json({ success: false, message: "Please provide a valid new email address." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.startEmailChange({
            userId,
            newEmail,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            code: err.code,
            limit: err.limit,
            action: err.action,
            nextEligibleAt: err.nextEligibleAt,
            message: err.message || "Failed to initiate email change.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/settings/manage-account/email/change/authorize-old
 * Step 2: Authorizes the old primary email via 6-digit OTP code.
 */
manageAccountsRouter.post("/email/change/authorize-old", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { operationId, otp } = req.body;
        if (!operationId || typeof operationId !== "string") {
            return res.status(400).json({ success: false, message: "Operation ID is required." });
        }
        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit authorization code is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.authorizeOldEmail({
            userId,
            operationId,
            otp,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Authorization failed.",
            attemptsRemaining: err.attemptsRemaining,
        });
    }
});

/**
 * POST /api/settings/manage-account/email/change/verify-new
 * Step 3: Verifies the code sent to the new email and atomically commits the change.
 */
manageAccountsRouter.post("/email/change/verify-new", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { operationId, otp } = req.body;
        if (!operationId || typeof operationId !== "string") {
            return res.status(400).json({ success: false, message: "Operation ID is required." });
        }
        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit verification code is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.verifyNewEmailAndCommit({
            userId,
            operationId,
            otp,
            ipAddress: ip,
            userAgent,
        });

        // Set refreshed cookies
        if (result.token) {
            res.cookie("token", result.token, {
                ...getAuthCookieOptions(),
                maxAge: ACCESS_TOKEN_EXPIRY_MS,
            });
        }
        if (result.refreshToken) {
            res.cookie("refreshToken", result.refreshToken, {
                ...getAuthCookieOptions(),
                maxAge: REFRESH_TOKEN_EXPIRY_MS,
            });
        }

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to verify new email.",
            attemptsRemaining: err.attemptsRemaining,
        });
    }
});

/**
 * POST /api/settings/manage-account/email/change/resend
 * Resends the verification code for the active stage (old or new).
 */
manageAccountsRouter.post("/email/change/resend", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { operationId, step } = req.body;
        if (!operationId || typeof operationId !== "string") {
            return res.status(400).json({ success: false, message: "Operation ID is required." });
        }
        if (step !== "old" && step !== "new") {
            return res.status(400).json({ success: false, message: "Invalid step parameter ('old' or 'new')." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.resendEmailChangeOtp({
            userId,
            operationId,
            step,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to resend code.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/settings/manage-account/email/change/cancel
 * Safely cancels an incomplete email change operation.
 */
manageAccountsRouter.post("/email/change/cancel", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { operationId } = req.body;
        const result = await ManageAccountsService.cancelEmailChange(userId, operationId);
        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to cancel email change.",
        });
    }
});

/**
 * POST /api/settings/manage-account/email/verify-primary/send
 * Dispatches verification OTP to the user's current unverified primary email.
 */
manageAccountsRouter.post("/email/verify-primary/send", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const email = req.user?.gmail || req.user?.email;
        const name = req.user?.firstName || req.user?.username || "Developer";

        if (!userId || !email) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await EmailVerificationService.sendOtp({
            userId,
            email,
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
 * POST /api/settings/manage-account/email/verify-primary/confirm
 * Validates verification OTP for current primary email and marks it verified.
 */
manageAccountsRouter.post("/email/verify-primary/confirm", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { otp } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit verification code is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";

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
            message: err.message || "Failed to verify primary email",
        });
    }
});

/**
 * GET /api/settings/manage-account/username/check?username=...
 * Checks format and database availability of a proposed username.
 */
manageAccountsRouter.get("/username/check", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const username = req.query.username as string;
        const result = await ManageAccountsService.checkUsernameAvailability(username, userId);
        return res.status(200).json({ success: true, ...result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to check username." });
    }
});

/**
 * POST /api/settings/manage-account/username/change/request
 * Step 1: Requests username change and triggers step-up verification.
 */
manageAccountsRouter.post("/username/change/request", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { newUsername } = req.body;
        if (!newUsername || typeof newUsername !== "string") {
            return res.status(400).json({ success: false, message: "Please provide a valid new username." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.requestUsernameChange({
            userId,
            newUsername,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            code: err.code,
            limit: err.limit,
            action: err.action,
            nextEligibleAt: err.nextEligibleAt,
            message: err.message || "Failed to request username change.",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/settings/manage-account/username/change/confirm
 * Step 2: Validates step-up authorization and commits username change atomically.
 */
manageAccountsRouter.post("/username/change/confirm", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { newUsername, operationId, otp, currentPassword } = req.body;
        if (!newUsername || typeof newUsername !== "string") {
            return res.status(400).json({ success: false, message: "New username is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await ManageAccountsService.confirmUsernameChange({
            userId,
            newUsername,
            operationId,
            otp,
            currentPassword,
            ipAddress: ip,
            userAgent,
        });

        // Set refreshed cookies
        if (result.token) {
            res.cookie("token", result.token, {
                ...getAuthCookieOptions(),
                maxAge: ACCESS_TOKEN_EXPIRY_MS,
            });
        }
        if (result.refreshToken) {
            res.cookie("refreshToken", result.refreshToken, {
                ...getAuthCookieOptions(),
                maxAge: REFRESH_TOKEN_EXPIRY_MS,
            });
        }

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to update username.",
            attemptsRemaining: err.attemptsRemaining,
        });
    }
});

/**
 * POST /api/settings/manage-account/password/change
 * Authenticated password update endpoint.
 */
manageAccountsRouter.post("/password/change", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const { ClubSettingsService } = await import("../../services/club/clubSettingsService.js");
        const result = await ClubSettingsService.changePassword(userId, currentPassword, newPassword, confirmPassword);
        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to update password.",
        });
    }
});

/**
 * ============================================================================
 * DATA ARCHIVE & PORTABILITY ENDPOINTS (GDPR Article 20 / CCPA Compliance)
 * ============================================================================
 */

/**
 * GET /api/settings/manage-account/data-archive/info
 * Retrieves available categories, daily rate limit status, and recent exports.
 */
manageAccountsRouter.get("/data-archive/info", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized. Please log in." });
        }

        const info = await DataArchiveService.getArchiveInfo(userId);
        return res.status(200).json({
            success: true,
            ...info,
        });
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to retrieve archive status.",
        });
    }
});

/**
 * POST /api/settings/manage-account/data-archive/request-code
 * Sends a single-use 6-digit email OTP for authorizing GDPR archive export.
 */
manageAccountsRouter.post("/data-archive/request-code", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const result = await DataArchiveService.requestStepUpCode(userId);
        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send verification code.",
        });
    }
});

/**
 * POST /api/settings/manage-account/data-archive/generate
 * Authenticated & step-up secured endpoint to generate a cryptographically sealed archive.
 */
manageAccountsRouter.post("/data-archive/generate", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const { categories, stepUpPassword, stepUpOtp } = req.body;
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await DataArchiveService.generateArchive({
            userId,
            categories: categories || "all",
            stepUpPassword,
            stepUpOtp,
            ipAddress: ip,
            userAgent,
        });

        res.setHeader("X-Orbix-Export-Id", result.exportId);
        res.setHeader("X-Orbix-SHA256-Checksum", result.sha256Checksum);

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to generate data archive.",
        });
    }
});

/**
 * GET /api/settings/manage-account/data-archive/download/:exportId
 * Streams the pre-generated data archive with attachment headers.
 */
manageAccountsRouter.get("/data-archive/download/:exportId", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const exportId = req.params.exportId as string;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        if (!exportId || typeof exportId !== "string") {
            return res.status(400).json({ success: false, message: "Export ID is required." });
        }

        const archive = await DataArchiveService.getCachedArchivePayload(userId, exportId);
        if (!archive) {
            return res.status(404).json({
                success: false,
                message: "Archive not found or expired. Data archives expire after 24 hours.",
            });
        }

        const username = req.user?.username || "developer";
        const dateFormatted = new Date().toISOString().split("T")[0];
        const filename = `orbix-data-archive-${username}-${dateFormatted}.json`;
        const jsonContent = JSON.stringify(archive, null, 2);

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("X-Orbix-Checksum-SHA256", archive.archiveManifest?.sha256Checksum || "");
        res.setHeader("Content-Length", Buffer.byteLength(jsonContent, "utf8"));

        return res.send(jsonContent);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to download archive.",
        });
    }
});

export default manageAccountsRouter;
