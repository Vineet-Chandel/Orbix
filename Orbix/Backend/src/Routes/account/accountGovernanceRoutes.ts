// Backend/src/Routes/account/accountGovernanceRoutes.ts
import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { requireGovernanceAdmin } from "../../middlewares/staff.middleware.js";
import {
    getUserGovernanceOverview,
    getUserStatusTimeline,
    updateAccountStandingAdmin,
    applyRestrictionAdmin,
    revokeRestrictionAdmin,
    searchUsersForGovernance,
} from "../../services/account/accountGovernanceService.js";

export const accountGovernanceRouter = express.Router();

/**
 * GET /api/account/governance/status
 * Read-only status, platform health, capabilities and collegiate cooldown for the authenticated user.
 * Users CANNOT mutate governance fields through this or any public endpoint.
 */
accountGovernanceRouter.get("/status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const data = await getUserGovernanceOverview(userId);
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("[Governance] Fetch status error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve account status.",
        });
    }
});

/**
 * GET /api/account/governance/timeline
 * User-visible audit timeline (sanitized of private internal staff notes).
 */
accountGovernanceRouter.get("/timeline", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const timeline = await getUserStatusTimeline(userId);
        return res.status(200).json({
            success: true,
            timeline,
        });
    } catch (err: any) {
        console.error("[Governance] Fetch timeline error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve status timeline.",
        });
    }
});

// =============================================================================
// STAFF / ADMIN PROTECTED OPERATIONS
// =============================================================================

/**
 * GET /api/account/governance/admin/search?q=...
 */
accountGovernanceRouter.get(
    "/admin/search",
    authenticate,
    requireGovernanceAdmin,
    async (req: Request, res: Response) => {
        try {
            const q = String(req.query.q || "");
            if (q.trim().length < 2) {
                return res.status(400).json({
                    success: false,
                    message: "Search query must be at least 2 characters.",
                });
            }

            const users = await searchUsersForGovernance(q);
            return res.status(200).json({ success: true, users });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/account/governance/admin/user/:userId
 */
accountGovernanceRouter.get(
    "/admin/user/:userId",
    authenticate,
    requireGovernanceAdmin,
    async (req: Request, res: Response) => {
        try {
            const targetUserId = req.params.userId as string;
            const overview = await getUserGovernanceOverview(targetUserId);
            return res.status(200).json({ success: true, overview });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/account/governance/admin/standing
 * Updates standing (Good Standing, Warning, Under Review, Restricted, Suspended, Deactivated)
 */
accountGovernanceRouter.post(
    "/admin/standing",
    authenticate,
    requireGovernanceAdmin,
    async (req: Request, res: Response) => {
        try {
            const {
                targetUserId,
                newStatus,
                severity = "none",
                publicReasonCode,
                publicReason,
                internalNote,
                expiresAt,
                nextReviewAt,
            } = req.body;

            if (!targetUserId || !newStatus || !publicReasonCode || !publicReason) {
                return res.status(400).json({
                    success: false,
                    message: "targetUserId, newStatus, publicReasonCode, and publicReason are required.",
                });
            }

            const actorId = req.user!.id;
            const actorRole = (req as any).staffRole || "admin";

            const result = await updateAccountStandingAdmin({
                targetUserId,
                newStatus,
                severity,
                publicReasonCode,
                publicReason,
                internalNote,
                expiresAt,
                nextReviewAt,
                actorId,
                actorRole,
            });

            return res.status(200).json(result);
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/account/governance/admin/restriction
 */
accountGovernanceRouter.post(
    "/admin/restriction",
    authenticate,
    requireGovernanceAdmin,
    async (req: Request, res: Response) => {
        try {
            const {
                targetUserId,
                restrictionType,
                affectedResource,
                reasonCode,
                publicExplanation,
                internalNote,
                expiresAt,
            } = req.body;

            if (!targetUserId || !restrictionType || !reasonCode || !publicExplanation) {
                return res.status(400).json({
                    success: false,
                    message: "targetUserId, restrictionType, reasonCode, and publicExplanation are required.",
                });
            }

            const actorId = req.user!.id;
            const actorRole = (req as any).staffRole || "admin";

            const result = await applyRestrictionAdmin({
                targetUserId,
                restrictionType,
                affectedResource,
                reasonCode,
                publicExplanation,
                internalNote,
                expiresAt,
                actorId,
                actorRole,
            });

            return res.status(200).json(result);
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * DELETE /api/account/governance/admin/restriction/:id
 */
accountGovernanceRouter.delete(
    "/admin/restriction/:id",
    authenticate,
    requireGovernanceAdmin,
    async (req: Request, res: Response) => {
        try {
            const restrictionId = req.params.id as string;
            const actorId = req.user!.id;
            const actorRole = (req as any).staffRole || "admin";
            const note = req.body?.internalNote || "Revoked by administrator";

            const result = await revokeRestrictionAdmin(restrictionId, actorId, actorRole, note);
            return res.status(200).json(result);
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message });
        }
    }
);
