import { Router, type Request, type Response } from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { query } from "../../database/client.js";
import { ClubCredibilityService } from "../../services/club/clubCredibilityService.js";

export const clubCredibilityRouter = Router();

/**
 * Helper to resolve verified club ID for authenticated user
 */
async function resolveClubIdForUser(userId: string): Promise<string | null> {
    const clubRes = await query(
        `SELECT id FROM public.verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
        [userId]
    );
    if (clubRes.rows[0]) return clubRes.rows[0].id;

    // Also check if user is a club coordinator/member with admin privileges
    const memberRes = await query(
        `SELECT club_id FROM public.club_memberships WHERE user_id = $1 AND role IN ('admin', 'lead', 'coordinator') LIMIT 1;`,
        [userId]
    );
    return memberRes.rows[0]?.club_id || null;
}

/**
 * GET /api/club/credibility
 * Returns authenticated club's credibility overview snapshot
 */
clubCredibilityRouter.get("/credibility", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const snapshot = await ClubCredibilityService.getSnapshot(clubId);

        // Fetch top recent 3 ledger entries for dashboard preview
        const recentHistory = await ClubCredibilityService.getHistory(clubId, 1, 3);

        return res.json({
            success: true,
            snapshot,
            recentEntries: recentHistory.history,
        });
    } catch (err: any) {
        console.error("GET /api/club/credibility error:", err);
        return res.status(500).json({ success: false, message: "Failed to load club credibility snapshot." });
    }
});

/**
 * GET /api/club/credibility/history
 * Returns paginated credibility ledger records
 */
clubCredibilityRouter.get("/credibility/history", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const page = Math.max(1, parseInt(req.query.page as string) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));

        const history = await ClubCredibilityService.getHistory(clubId, page, limit);

        return res.json({
            success: true,
            ...history,
        });
    } catch (err: any) {
        console.error("GET /api/club/credibility/history error:", err);
        return res.status(500).json({ success: false, message: "Failed to load credibility history." });
    }
});

/**
 * POST /api/club/credibility/preview-impact
 * Live preview calculation for CredibilityImpactModal
 */
clubCredibilityRouter.post("/credibility/preview-impact", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const { eventId, action, reasonCategory, communicatedToAll, rescheduleOffered } = req.body;

        if (!eventId || !action) {
            return res.status(400).json({ success: false, message: "eventId and action are required." });
        }

        const preview = await ClubCredibilityService.previewImpact(clubId, eventId, action, {
            reasonCategory,
            communicatedToAll,
            rescheduleOffered,
        });

        return res.json({
            success: true,
            preview,
        });
    } catch (err: any) {
        console.error("POST /api/club/credibility/preview-impact error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to calculate impact preview." });
    }
});

/**
 * POST /api/club/credibility/appeals
 * Submit appeal against a credibility ledger penalty
 */
clubCredibilityRouter.post("/credibility/appeals", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const { ledgerId, reason, evidenceAttachments } = req.body;

        if (!ledgerId || !reason || reason.trim().length < 10) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid ledger entry ID and detailed reason (min 10 characters).",
            });
        }

        const appeal = await ClubCredibilityService.submitAppeal(clubId, ledgerId, reason, evidenceAttachments || []);

        return res.json({
            success: true,
            message: "Credibility appeal submitted successfully for review.",
            appeal,
        });
    } catch (err: any) {
        console.error("POST /api/club/credibility/appeals error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to submit credibility appeal." });
    }
});

/**
 * POST /api/club/credibility/recalculate
 * Recomputes club credibility snapshot from ledger
 */
clubCredibilityRouter.post("/credibility/recalculate", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const snapshot = await ClubCredibilityService.recalculateSnapshot(clubId);

        return res.json({
            success: true,
            message: "Credibility recalculated successfully.",
            snapshot,
        });
    } catch (err: any) {
        console.error("POST /api/club/credibility/recalculate error:", err);
        return res.status(500).json({ success: false, message: "Failed to recalculate credibility." });
    }
});

/**
 * POST /api/club/credibility/certificates/preflight
 * Pre-issuance validation for certificates
 */
clubCredibilityRouter.post("/credibility/certificates/preflight", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }

        const clubId = await resolveClubIdForUser(userId);
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club profile not found." });
        }

        const { eventId, recipientUserIds } = req.body;

        if (!eventId || !Array.isArray(recipientUserIds)) {
            return res.status(400).json({ success: false, message: "eventId and recipientUserIds array are required." });
        }

        const validation = await ClubCredibilityService.validateCertificateIssuanceIntegrity(
            clubId,
            eventId,
            recipientUserIds
        );

        return res.json({
            success: true,
            validation,
        });
    } catch (err: any) {
        console.error("POST /api/club/credibility/certificates/preflight error:", err);
        return res.status(500).json({ success: false, message: "Certificate preflight check failed." });
    }
});

/**
 * GET /api/club/:clubId/credibility/public
 * Public aggregated credibility card for student directory
 */
clubCredibilityRouter.get("/:clubId/credibility/public", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const clubId = String(req.params.clubId);
        const isUuid = Boolean(
            typeof clubId === "string" &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clubId)
        );
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Club not found." });
        }

        const snapshot = await ClubCredibilityService.getSnapshot(clubId);

        return res.json({
            success: true,
            credibility: {
                currentScore: snapshot.currentScore,
                scoreLevel: snapshot.scoreLevel,
                confidenceLevel: snapshot.confidenceLevel,
                isProvisional: snapshot.isProvisional,
                totalVerifiedEvents: snapshot.totalVerifiedEvents,
                successfulEventStreak: snapshot.successfulEventStreak,
            },
        });
    } catch (err: any) {
        console.error("GET /api/club/:clubId/credibility/public error:", err);
        return res.status(500).json({ success: false, message: "Failed to load public credibility data." });
    }
});
