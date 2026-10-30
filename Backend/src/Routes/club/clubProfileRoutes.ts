import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { ClubProfileService } from "../../services/club/clubProfileService.js";

const clubProfileRouter = express.Router();

/**
 * GET /api/club/profile
 * Returns the complete club profile, coordinators, achievements, stats, completion score, and permissions.
 */
clubProfileRouter.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || undefined;
        const profileData = await ClubProfileService.getFullClubProfile(userId, requestedClubId);

        return res.json({
            success: true,
            ...profileData,
        });
    } catch (err: any) {
        console.error("GET /api/club/profile error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve club profile.",
        });
    }
});

/**
 * PATCH /api/club/profile
 * Updates club profile fields, branding, about story, focus areas, and publication visibility.
 */
clubProfileRouter.patch("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const updatedProfile = await ClubProfileService.updateClubProfile(userId, req.body, requestedClubId);

        return res.json({
            success: true,
            message: "Club profile updated successfully.",
            ...updatedProfile,
        });
    } catch (err: any) {
        console.error("PATCH /api/club/profile error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update club profile.",
        });
    }
});

/**
 * POST /api/club/profile/upload-signature
 * Generates signed direct Cloudinary upload params for logo, banner, coordinator photo, or achievement badge.
 */
clubProfileRouter.post("/upload-signature", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const type = req.body?.type;
        if (!type || !["logo", "banner", "coordinator", "achievement"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Valid upload type is required: 'logo', 'banner', 'coordinator', or 'achievement'.",
            });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const uploadConfig = await ClubProfileService.getUploadSignature(userId, type, requestedClubId);

        return res.json({
            success: true,
            uploadConfig,
        });
    } catch (err: any) {
        console.error("POST /api/club/profile/upload-signature error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate image upload signature.",
        });
    }
});

// =========================================================================
// COORDINATOR ROUTES
// =========================================================================

clubProfileRouter.post("/coordinators", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const coordinator = await ClubProfileService.addCoordinator(userId, req.body, requestedClubId);

        return res.status(201).json({
            success: true,
            message: "Coordinator added successfully.",
            coordinator,
        });
    } catch (err: any) {
        console.error("POST /coordinators error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to add coordinator.",
        });
    }
});

clubProfileRouter.patch("/coordinators/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Coordinator ID is required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const coordinator = await ClubProfileService.updateCoordinator(userId, id, req.body, requestedClubId);

        return res.json({
            success: true,
            message: "Coordinator updated successfully.",
            coordinator,
        });
    } catch (err: any) {
        console.error("PATCH /coordinators/:id error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update coordinator.",
        });
    }
});

clubProfileRouter.delete("/coordinators/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Coordinator ID is required." });
        }

        const requestedClubId = (req.query.clubId as string) || undefined;
        const result = await ClubProfileService.deleteCoordinator(userId, id, requestedClubId);

        return res.json({
            message: "Coordinator removed successfully.",
            ...result,
        });
    } catch (err: any) {
        console.error("DELETE /coordinators/:id error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to remove coordinator.",
        });
    }
});

clubProfileRouter.post("/coordinators/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        await ClubProfileService.reorderCoordinators(userId, req.body?.coordinatorIds, requestedClubId);

        return res.json({
            success: true,
            message: "Coordinators reordered successfully.",
        });
    } catch (err: any) {
        console.error("POST /coordinators/reorder error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to reorder coordinators.",
        });
    }
});

// =========================================================================
// ACHIEVEMENT ROUTES
// =========================================================================

clubProfileRouter.post("/achievements", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const achievement = await ClubProfileService.addAchievement(userId, req.body, requestedClubId);

        return res.status(201).json({
            success: true,
            message: "Achievement added successfully.",
            achievement,
        });
    } catch (err: any) {
        console.error("POST /achievements error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to add achievement.",
        });
    }
});

clubProfileRouter.patch("/achievements/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Achievement ID is required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        const achievement = await ClubProfileService.updateAchievement(userId, id, req.body, requestedClubId);

        return res.json({
            success: true,
            message: "Achievement updated successfully.",
            achievement,
        });
    } catch (err: any) {
        console.error("PATCH /achievements/:id error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update achievement.",
        });
    }
});

clubProfileRouter.delete("/achievements/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        if (!id) {
            return res.status(400).json({ success: false, message: "Achievement ID is required." });
        }

        const requestedClubId = (req.query.clubId as string) || undefined;
        const result = await ClubProfileService.deleteAchievement(userId, id, requestedClubId);

        return res.json({
            message: "Achievement removed successfully.",
            ...result,
        });
    } catch (err: any) {
        console.error("DELETE /achievements/:id error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to remove achievement.",
        });
    }
});

clubProfileRouter.post("/achievements/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const requestedClubId = (req.query.clubId as string) || req.body?.clubId || undefined;
        await ClubProfileService.reorderAchievements(userId, req.body?.achievementIds, requestedClubId);

        return res.json({
            success: true,
            message: "Achievements reordered successfully.",
        });
    } catch (err: any) {
        console.error("POST /achievements/reorder error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to reorder achievements.",
        });
    }
});

export default clubProfileRouter;
