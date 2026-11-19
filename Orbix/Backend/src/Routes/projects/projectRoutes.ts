import express, { type Request, type Response } from "express";
import crypto from "crypto";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { validateProjectPayload, ProjectValidationError } from "../../validators/ProjectValidator.js";
import { GithubUrlValidationError } from "../../services/project/githubUrlParser.js";
import { PrivateRepositoryDetectedError } from "../../services/project/githubIntelligenceService.js";
import {
    cloudinary,
    isCloudinaryConfigured,
    assertCloudinaryConfigured,
} from "../../config/cloudinary.js";
import {
    generateInstallationState,
    verifyInstallationState,
    getGitHubAppInstallUrl,
    handleInstallationCallback,
    getUserGithubConnectionStatus,
    disconnectUserGithub,
} from "../../services/project/githubAppService.js";
import {
    getUserProjects,
    getPublicProjectsByUsername,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
    toggleProjectPublish,
    analyzeGithubRepo,
    checkProjectSyncDiff,
    applyProjectSyncMerge,
    resetProjectFieldToExtracted,
} from "../../services/project/projectService.js";

const projectRouter = express.Router();

/**
 * GET /api/projects
 * Retrieves all projects for the currently authenticated user with 4-slot capacity metadata.
 */
projectRouter.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const data = await getUserProjects(userId);
        return res.status(200).json({
            success: true,
            ...data,
        });
    } catch (err: any) {
        console.error("[Projects API] GET / error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve user projects",
        });
    }
});

/**
 * POST /api/projects/analyze-repo
 * GitHub Repository Intelligence Engine.
 * Analyzes repository metadata, languages, and README for user review without auto-saving.
 */
projectRouter.post("/analyze-repo", authenticate, async (req: Request, res: Response) => {
    try {
        const { repoUrl, repository } = req.body;
        const target = repoUrl || repository;
        if (!target || typeof target !== "string") {
            return res.status(400).json({
                success: false,
                message: "Repository URL or identifier is required.",
            });
        }

        const userId = req.user?.id;
        const analysis = await analyzeGithubRepo(target, userId);
        return res.status(200).json({
            success: true,
            message: "Repository analysis completed successfully.",
            analysis,
        });
    } catch (err: any) {
        // Phase 3.1: Private repository detection
        if (err instanceof PrivateRepositoryDetectedError || err.name === "PrivateRepositoryDetectedError") {
            return res.status(200).json({
                success: false,
                isLikelyPrivate: true,
                message: "We couldn't access the complete repository information. This repository may be private, or Orbix may not have the required permissions.",
                owner: err.owner,
                repo: err.repo,
                repoName: `${err.owner}/${err.repo}`,
                repoUrl: err.canonicalUrl,
                canConnectGitHub: true,
                canEnterManually: true,
            });
        }

        const isClientError = err instanceof ProjectValidationError || err instanceof GithubUrlValidationError;
        const status = isClientError ? 400 : 500;
        return res.status(status).json({
            success: false,
            message: err.message || "Failed to analyze repository.",
            isUnsupportedProvider: Boolean(err.isUnsupportedProvider),
        });
    }
});

/**
 * GET /api/projects/github-app/install
 * Initiates GitHub App installation / repository authorization with HMAC-SHA256 CSRF protection
 */
projectRouter.get("/github-app/install", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const repoHint = (req.query.repo as string) || undefined;
        const state = generateInstallationState(userId, repoHint);
        const installUrl = getGitHubAppInstallUrl(state);

        return res.status(200).json({
            success: true,
            installUrl,
        });
    } catch (err: any) {
        console.error("[Projects API] /github-app/install error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to initiate GitHub authorization",
        });
    }
});

/**
 * GET /api/projects/github-app/callback
 * Handles GitHub App / OAuth callback with state verification
 */
projectRouter.get("/github-app/callback", async (req: Request, res: Response) => {
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

    try {
        const incomingState = req.query.state as string;
        if (!incomingState) {
            return res.redirect(`${frontendUrl}/dashboard?tab=projects&gh_error=Missing+authorization+state`);
        }

        // Verify HMAC-SHA256 state signature and expiry
        const { userId, repoHint } = verifyInstallationState(incomingState);

        const code = req.query.code as string;
        const installationId = (req.query.installation_id as string) || undefined;
        const setupAction = (req.query.setup_action as string) || undefined;

        await handleInstallationCallback(userId, {
            installation_id: installationId,
            code,
            setup_action: setupAction,
        });

        const retryParam = repoHint ? `&retry_repo=${encodeURIComponent(repoHint)}` : "";
        return res.redirect(`${frontendUrl}/dashboard?tab=projects&gh_connected=true${retryParam}`);
    } catch (err: any) {
        console.error("[Projects API] /github-app/callback error:", err);
        return res.redirect(
            `${frontendUrl}/dashboard?tab=projects&gh_error=${encodeURIComponent(
                err.message || "GitHub authorization failed"
            )}`
        );
    }
});

/**
 * GET /api/projects/github-app/status
 * Retrieves current user's GitHub connection status
 */
projectRouter.get("/github-app/status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const status = await getUserGithubConnectionStatus(userId);
        return res.status(200).json({
            success: true,
            ...status,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve GitHub connection status",
        });
    }
});

/**
 * DELETE /api/projects/github-app/disconnect
 * Disconnects GitHub App authorization for user
 */
projectRouter.delete("/github-app/disconnect", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        await disconnectUserGithub(userId);
        return res.status(200).json({
            success: true,
            message: "GitHub repository access disconnected.",
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to disconnect GitHub access",
        });
    }
});

/**
 * GET /api/projects/user/:username
 * Retrieves public projects showcase for a user profile.
 * If viewer is the owner, returns draft projects as well.
 */
projectRouter.get("/user/:username", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const username = req.params.username;
        if (!username) {
            return res.status(400).json({ success: false, message: "Username parameter is required" });
        }

        const viewerId = req.user?.id;
        const result = await getPublicProjectsByUsername(username, viewerId);
        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err: any) {
        const status = err instanceof ProjectValidationError ? 404 : 500;
        return res.status(status).json({
            success: false,
            message: err.message || "Failed to retrieve projects showcase",
        });
    }
});

/**
 * GET /api/projects/:id
 * Retrieves a single project.
 */
projectRouter.get("/:id", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const projectId = req.params.id;
        const project = await getProjectById(projectId, req.user?.id);
        return res.status(200).json({
            success: true,
            project,
        });
    } catch (err: any) {
        const status = err instanceof ProjectValidationError ? 404 : 500;
        return res.status(status).json({
            success: false,
            message: err.message || "Failed to retrieve project",
        });
    }
});

/**
 * POST /api/projects
 * Creates a new project showcase slot.
 * Enforces atomic 4-project capacity limit.
 */
projectRouter.post("/", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const validated = validateProjectPayload(req.body, false);
        const project = await createProject(userId, validated);

        return res.status(201).json({
            success: true,
            message: project.isPublished ? "Project successfully published to your showcase!" : "Project saved as draft.",
            project,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError || err.code === "23514";
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to create project",
        });
    }
});

/**
 * PUT /api/projects/:id
 * Updates an existing project.
 */
projectRouter.put("/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const validated = validateProjectPayload(req.body, true);
        const updated = await updateProject(projectId, userId, validated);

        return res.status(200).json({
            success: true,
            message: "Project updated successfully.",
            project: updated,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to update project",
        });
    }
});

/**
 * DELETE /api/projects/:id
 * Deletes a project from the user's showcase and frees up a capacity slot.
 */
projectRouter.delete("/:id", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        await deleteProject(projectId, userId);

        return res.status(200).json({
            success: true,
            message: "Project removed successfully. A new showcase slot is now available.",
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to delete project",
        });
    }
});

/**
 * PATCH /api/projects/reorder
 * Reorders user projects.
 */
projectRouter.patch("/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { projectIds } = req.body;
        if (!Array.isArray(projectIds)) {
            return res.status(400).json({
                success: false,
                message: "projectIds array is required.",
            });
        }

        const reordered = await reorderProjects(userId, projectIds);

        return res.status(200).json({
            success: true,
            message: "Project order updated.",
            projects: reordered,
        });
    } catch (err: any) {
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to reorder projects",
        });
    }
});

/**
 * PATCH /api/projects/:id/publish
 * Toggles or updates publication status of a project.
 */
projectRouter.patch("/:id/publish", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const isPublished = typeof req.body.isPublished === "boolean" ? req.body.isPublished : undefined;
        const updated = await toggleProjectPublish(projectId, userId, isPublished);

        return res.status(200).json({
            success: true,
            message: updated.isPublished ? "Project published to public showcase!" : "Project moved to drafts.",
            project: updated,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to update publication status",
        });
    }
});

/**
 * POST /api/projects/media/signature
 * Generates secure, signed upload authorization for project cover, screenshots, and diagrams.
 * Direct-to-Cloudinary upload ensures secrets never leave backend.
 */
projectRouter.post("/media/signature", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        if (!isCloudinaryConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Cloud storage is not currently configured. You can use direct image URLs instead.",
            });
        }

        const { cloudName, apiKey, apiSecret } = assertCloudinaryConfigured();
        const timestamp = Math.round(Date.now() / 1000);
        const randomHex = crypto.randomBytes(6).toString("hex");
        const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, "");
        const folder = "orbix/projects";
        const publicId = `${folder}/proj_${safeUserId}_${timestamp}_${randomHex}`;

        const paramsToSign: Record<string, any> = {
            public_id: publicId,
            timestamp,
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        return res.status(200).json({
            success: true,
            uploadConfig: {
                cloudName,
                apiKey,
                timestamp,
                signature,
                publicId,
                folder,
                uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                maxBytes: 10 * 1024 * 1024, // 10MB
                allowedFormats: ["jpg", "jpeg", "png", "webp", "gif", "svg"],
            },
        });
    } catch (err: any) {
        console.error("Project media signature error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to generate media upload signature",
        });
    }
});

/**
 * GET /api/projects/:id/sync/diff
 * Checks repository synchronization diffs without overwriting user data.
 */
projectRouter.get("/:id/sync/diff", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const diffAnalysis = await checkProjectSyncDiff(projectId, userId);

        return res.status(200).json({
            success: true,
            analysis: diffAnalysis,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to inspect repository sync diffs",
        });
    }
});

/**
 * POST /api/projects/:id/sync/merge
 * Merges fresh GitHub repository intelligence while preserving user-overridden fields.
 */
projectRouter.post("/:id/sync/merge", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const decisions = req.body.decisions && typeof req.body.decisions === "object" ? req.body.decisions : {};
        const result = await applyProjectSyncMerge(projectId, userId, decisions);

        return res.status(200).json({
            success: true,
            message: "Project repository synchronization complete. Custom edits preserved.",
            ...result,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to merge repository intelligence",
        });
    }
});

/**
 * POST /api/projects/:id/sync/reset-field
 * Resets an individual field to the latest extracted repository value.
 */
projectRouter.post("/:id/sync/reset-field", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const projectId = req.params.id;
        const fieldName = req.body.field;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        if (!fieldName || typeof fieldName !== "string") {
            return res.status(400).json({ success: false, message: "field name is required." });
        }

        const updated = await resetProjectFieldToExtracted(projectId, userId, fieldName);

        return res.status(200).json({
            success: true,
            message: `Field '${fieldName}' reset to latest extracted repository value.`,
            project: updated,
        });
    } catch (err: any) {
        const isValidation = err instanceof ProjectValidationError;
        return res.status(isValidation ? 400 : 500).json({
            success: false,
            message: err.message || "Failed to reset field",
        });
    }
});

export default projectRouter;
