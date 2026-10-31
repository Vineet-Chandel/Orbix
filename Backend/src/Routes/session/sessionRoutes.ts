// Backend/src/Routes/session/sessionRoutes.ts
import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
    getActiveSessions,
    getSessionHistory,
    revokeSession,
    revokeOtherSessions,
    revokeAllSessions,
    getSecurityEvents,
    getLoginOverview,
} from "../../services/session/sessionService.js";
import {
    getClubAccessActivity,
    recordClubAccessEvent,
} from "../../services/session/clubAccessService.js";

export const sessionRouter = express.Router();

/**
 * GET /api/account/sessions/overview
 * Overview of user's active sessions, current device, recognized devices count
 */
sessionRouter.get("/overview", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const currentSessionId = (req as any).sessionId || undefined;
        const overview = await getLoginOverview(userId, currentSessionId);

        return res.status(200).json({
            success: true,
            overview,
        });
    } catch (err: any) {
        console.error("[Session] Overview error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve session overview." });
    }
});

/**
 * GET /api/account/sessions
 * List active sessions for the authenticated user
 */
sessionRouter.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const currentSessionId = (req as any).sessionId || undefined;
        const sessions = await getActiveSessions(userId, currentSessionId);

        return res.status(200).json({
            success: true,
            sessions,
        });
    } catch (err: any) {
        console.error("[Session] List sessions error:", err);
        return res.status(500).json({ success: false, message: "Failed to list active sessions." });
    }
});

/**
 * GET /api/account/sessions/history
 * List historical/past sessions with pagination
 */
sessionRouter.get("/history", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const limit = Number(req.query.limit) || 20;
        const offset = Number(req.query.offset) || 0;

        const data = await getSessionHistory(userId, limit, offset);

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("[Session] History error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve session history." });
    }
});

/**
 * DELETE /api/account/sessions/:sessionId
 * Terminate a specific session remotely
 */
sessionRouter.delete("/:sessionId", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const sessionId = String(req.params.sessionId || "");

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        if (!sessionId) {
            return res.status(400).json({ success: false, message: "Session ID is required." });
        }

        const result = await revokeSession(userId, sessionId, "user_remote_termination");
        return res.status(200).json(result);
    } catch (err: any) {
        console.error("[Session] Revoke error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to terminate session." });
    }
});

/**
 * POST /api/account/sessions/revoke-others
 * Log out of all other active sessions, preserving current device session
 */
sessionRouter.post("/revoke-others", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const currentSessionId = (req as any).sessionId;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        if (!currentSessionId) {
            return res.status(400).json({
                success: false,
                message: "Current session identifier is unavailable.",
            });
        }

        const result = await revokeOtherSessions(userId, currentSessionId);
        return res.status(200).json({
            success: true,
            message: `Logged out of ${result.revokedCount} other active device(s).`,
            revokedCount: result.revokedCount,
        });
    } catch (err: any) {
        console.error("[Session] Revoke others error:", err);
        return res.status(500).json({ success: false, message: "Failed to terminate other sessions." });
    }
});

/**
 * POST /api/account/sessions/revoke-all
 * Log out of all active sessions including current device
 */
sessionRouter.post("/revoke-all", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const result = await revokeAllSessions(userId, "user_logout_all");

        // Clear cookies on current response
        res.clearCookie("token", { path: "/" });
        res.clearCookie("refreshToken", { path: "/" });

        return res.status(200).json({
            success: true,
            message: `Successfully logged out of all ${result.revokedCount} active device(s).`,
            revokedCount: result.revokedCount,
        });
    } catch (err: any) {
        console.error("[Session] Revoke all error:", err);
        return res.status(500).json({ success: false, message: "Failed to terminate all sessions." });
    }
});

/**
 * GET /api/account/security-events
 * Get user's security timeline
 */
sessionRouter.get("/security-events", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const limit = Number(req.query.limit) || 20;
        const offset = Number(req.query.offset) || 0;

        const data = await getSecurityEvents(userId, limit, offset);

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("[Session] Security events error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve security events." });
    }
});

/**
 * =========================================================================
 * CLUB TEAM ACCESS AUDIT ROUTES
 * =========================================================================
 */

/**
 * GET /api/clubs/:clubId/activity
 * Retrieve club team access audit history (restricted to club leads/admins)
 */
sessionRouter.get("/clubs/:clubId/activity", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const clubId = String(req.params.clubId || "");
        const limit = Number(req.query.limit) || 20;
        const offset = Number(req.query.offset) || 0;
        const filterAction = req.query.action as string | undefined;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }
        if (!clubId) {
            return res.status(400).json({ success: false, message: "Club ID is required." });
        }

        const data = await getClubAccessActivity({
            clubId,
            userId,
            limit,
            offset,
            filterAction,
        });

        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("[ClubActivity] Audit fetch error:", err);
        return res.status(403).json({ success: false, message: err.message || "Failed to retrieve club access logs." });
    }
});

/**
 * POST /api/clubs/:clubId/activity/log
 * Record member access to club dashboard/settings
 */
sessionRouter.post("/clubs/:clubId/activity/log", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const sessionId = (req as any).sessionId || null;
        const clubId = String(req.params.clubId || "");
        const { action = "club_dashboard_opened", metadata = {} } = req.body;

        if (!userId || !clubId) {
            return res.status(400).json({ success: false, message: "Missing required parameters." });
        }

        await recordClubAccessEvent({
            clubId,
            userId,
            sessionId,
            action,
            metadata,
        });

        return res.status(200).json({ success: true });
    } catch (err: any) {
        // Non-blocking logging
        return res.status(200).json({ success: false, message: err.message });
    }
});
