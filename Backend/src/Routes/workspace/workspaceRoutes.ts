// Backend/src/Routes/workspace/workspaceRoutes.ts
import { Router, type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { WorkspaceService } from "../../services/workspace/workspaceService.js";
import { WorkspaceDepartmentService } from "../../services/workspace/workspaceDepartmentService.js";
import { WorkspaceMemberService } from "../../services/workspace/workspaceMemberService.js";
import { WorkspaceChannelService, workspaceEventBus } from "../../services/workspace/workspaceChannelService.js";
import { WorkspaceTaskService } from "../../services/workspace/workspaceTaskService.js";
import { WorkspaceFileService } from "../../services/workspace/workspaceFileService.js";
import { WorkspaceNotificationController } from "../../controllers/workspace/workspaceNotificationController.js";
import { WorkspaceDashboardController } from "../../controllers/workspace/workspaceDashboardController.js";
import { WorkspaceRecognitionController } from "../../controllers/workspace/workspaceRecognitionController.js";
import { WorkspaceTemplateService } from "../../services/workspace/workspaceTemplateService.js";
import { WorkspaceCapabilityService } from "../../services/workspace/workspaceCapabilityService.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { ClubTeamService } from "../../services/club/clubTeamService.js";
import { query } from "../../database/client.js";
import multer from "multer";

const fileUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB max video limit
});

export const workspaceRouter = Router();

/**
 * Middleware helper to resolve clubId from query, body, or caller's verified club
 */
async function resolveClubId(req: Request, res: Response): Promise<string | null> {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return null;
    }

    const isPersonalAccount = authUser.accountType === "personal" || !authUser.accountType;
    const requestedClubId = (req.query.clubId as string) || req.body?.clubId || req.params?.clubId;

    if (requestedClubId) {
        // Enforce rule: Club representatives/managers cannot access the club workspace from personal account
        if (isPersonalAccount) {
            const managerCheck = await query(
                `SELECT 1 FROM public.verified_clubs vc
                 LEFT JOIN public.team_workspaces tw ON tw.club_id = vc.id
                 WHERE vc.id = $1 AND (vc.auth_user_id = $2 OR tw.owner_id = $2)
                 LIMIT 1;`,
                [requestedClubId, authUser.id]
            );
            if (managerCheck.rows.length > 0) {
                res.status(403).json({
                    success: false,
                    isClubManagerBlocked: true,
                    message: "Club managers must sign in via the Club Portal using club credentials to access this workspace.",
                });
                return null;
            }
        }

        // Strict tenant isolation: verify caller belongs to the requested club or workspace
        const hasAccess = await query(
            `SELECT 1 FROM public.verified_clubs vc
             LEFT JOIN public.club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
             LEFT JOIN public.team_workspaces tw ON tw.club_id = vc.id
             LEFT JOIN public.workspace_members wm ON wm.workspace_id = tw.id AND wm.user_id = $1 AND wm.membership_status = 'active' AND wm.is_suspended = false
             LEFT JOIN public.workspace_roles r ON r.id = wm.role_id
             WHERE vc.id = $2 AND (
                 -- Club session: full access
                 (NOT $3 AND (vc.auth_user_id = $1 OR tw.owner_id = $1 OR cm.user_id = $1 OR wm.user_id = $1))
                 -- Personal session: strictly subordinate roles (rank < 1000, e.g. Workspace Manager, Dept Lead, Member)
                 OR ($3 AND wm.user_id = $1 AND r.rank < 1000 AND r.slug != 'owner')
             )
             LIMIT 1;`,
            [authUser.id, requestedClubId, isPersonalAccount]
        );

        if (hasAccess.rows.length === 0) {
            res.status(403).json({ success: false, message: "Access denied to the specified club workspace." });
            return null;
        }

        return requestedClubId;
    }

    const clubRes = await query(
        `SELECT vc.id FROM public.verified_clubs vc
         LEFT JOIN public.club_memberships cm ON cm.club_id = vc.id AND cm.user_id = $1 AND cm.status = 'active'
         WHERE (
             (NOT $2 AND vc.auth_user_id = $1)
             OR cm.user_id = $1
         )
         LIMIT 1;`,
        [authUser.id, isPersonalAccount]
    );

    if (clubRes.rows.length === 0) {
        res.status(404).json({ success: false, message: "No club found associated with your account." });
        return null;
    }

    return clubRes.rows[0].id;
}

// =========================================================================
// 1. HEALTH & DIAGNOSTICS
// =========================================================================

/**
 * GET /api/club/workspace/health
 */
workspaceRouter.get("/health", async (_req: Request, res: Response) => {
    const redisHealthy = await WorkspaceRedisService.isHealthy();
    return res.json({
        success: true,
        subsystem: "team-workspace",
        redisHealthy,
        redisNamespace: process.env.WORKSPACE_REDIS_NAMESPACE || "orbix:team-workspace:",
        timestamp: new Date().toISOString(),
    });
});

// =========================================================================
// AUDIT CONTEXT HELPER
// =========================================================================

function getAuditContext(req: Request): { ipAddress?: string; userAgent?: string } {
    const ctx: { ipAddress?: string; userAgent?: string } = {};
    const ip = req.ip || req.socket.remoteAddress;
    if (ip) ctx.ipAddress = ip;
    const ua = req.headers["user-agent"];
    if (ua) ctx.userAgent = typeof ua === "string" ? ua : ua[0];
    return ctx;
}

// =========================================================================
// 2. WORKSPACE RETRIEVAL & PROVISIONING
// =========================================================================

/**
 * GET /api/club/workspace
 */
workspaceRouter.get("/", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const auditCtx = getAuditContext(req);

        const { workspace, member, isNew } = await WorkspaceService.getOrCreateWorkspaceForClub(
            clubId,
            authUser.id,
            auditCtx
        );

        const roles = await WorkspaceRepository.listRoles(workspace.id);
        const departments = await WorkspaceDepartmentService.listDepartments(workspace.id);
        const { total: memberCount } = await WorkspaceRepository.listMembers(workspace.id, { status: "active" });

        // Phase 01: Resolve member capabilities & dynamic navigation
        const capabilities = await WorkspaceCapabilityService.resolveMemberCapabilities(
            workspace.id,
            authUser.id
        );

        return res.json({
            success: true,
            isNew,
            workspace,
            currentMember: member,
            capabilities,
            memberCount,
            roles,
            departments,
        });
    } catch (err: any) {
        console.error("GET /api/club/workspace error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve or provision workspace.",
        });
    }
});

/**
 * GET /api/club/workspace/capabilities
 * Resolves member's granular capabilities across all 12 modules
 */
workspaceRouter.get("/capabilities", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found for this club." });
        }

        const capabilities = await WorkspaceCapabilityService.resolveMemberCapabilities(
            workspace.id,
            authUser.id
        );

        return res.json({
            success: true,
            capabilities,
        });
    } catch (err: any) {
        console.error("GET /api/club/workspace/capabilities error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to resolve workspace capabilities.",
        });
    }
});

/**
 * GET /api/club/workspace/my-workspaces
 * Discovers all active club workspaces where the user is an active member
 */
workspaceRouter.get("/my-workspaces", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        // Check if user is a club manager of an active verified club
        const clubManagerRes = await query(
            `SELECT vc.id, vc.name, vc.slug FROM public.verified_clubs vc
             WHERE vc.auth_user_id = $1 AND vc.is_active = true
             LIMIT 1;`,
            [authUser.id]
        );
        const isClubManager = clubManagerRes.rows.length > 0;
        const managedClub = isClubManager ? clubManagerRes.rows[0] : null;

        // Club managers cannot access workspaces from their personal account
        const workspaces = isClubManager ? [] : await WorkspaceRepository.findUserWorkspaces(authUser.id);

        return res.json({
            success: true,
            workspaces,
            isClubManager,
            managedClub,
        });
    } catch (err: any) {
        console.error("GET /api/club/workspace/my-workspaces error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to retrieve user workspaces.",
        });
    }
});

// =========================================================================
// 2.1 WORKSPACE TEMPLATES
// =========================================================================

/**
 * GET /api/club/workspace/templates
 * List available templates
 */
workspaceRouter.get("/templates", authenticate, async (_req: Request, res: Response) => {
    const templates = WorkspaceTemplateService.getAvailableTemplates();
    return res.json({ success: true, templates });
});

/**
 * POST /api/club/workspace/templates/apply
 * Applies a template to the workspace
 */
workspaceRouter.post("/templates/apply", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { templateId } = req.body;
        if (!templateId) {
            return res.status(400).json({ success: false, message: "templateId is required." });
        }

        const result = await WorkspaceTemplateService.applyTemplate(
            workspace.id,
            authUser.id,
            templateId,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            data: result,
            message: `Template '${result.template.name}' applied successfully.`,
        });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("Unknown template") ? 400 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to apply template." });
    }
});

// =========================================================================
// 3. WORKSPACE MANAGER DESIGNATION (CLUB OWNER ONLY)
// =========================================================================

/**
 * POST /api/club/workspace/manager
 * Appoints or replaces the designated Workspace Manager
 */
workspaceRouter.post("/manager", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { managerUserId, permissions } = req.body;
        if (!managerUserId) {
            return res.status(400).json({ success: false, message: "managerUserId is required." });
        }

        const updated = await WorkspaceMemberService.appointWorkspaceManager(
            workspace.id,
            authUser.id,
            managerUserId,
            permissions || [],
            getAuditContext(req)
        );

        return res.json({
            success: true,
            workspace: updated,
            message: "Workspace Manager appointed successfully.",
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to appoint Workspace Manager." });
    }
});

/**
 * DELETE /api/club/workspace/manager
 * Revokes the Workspace Manager designation
 */
workspaceRouter.delete("/manager", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;

        const updated = await WorkspaceMemberService.revokeWorkspaceManager(
            workspace.id,
            authUser.id,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            workspace: updated,
            message: "Workspace Manager revoked successfully.",
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to revoke Workspace Manager." });
    }
});

// =========================================================================
// 3B. WORKSPACE CONFIGURATIONS & SETTINGS (PHASE 07)
// =========================================================================

/**
 * GET /api/club/workspace/settings
 * Retrieves workspace configuration and management status
 */
workspaceRouter.get("/settings", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const ctx = await WorkspaceService.resolveContext(workspace.id, authUser.id);
        if (!ctx) return res.status(403).json({ success: false, message: "Workspace access denied." });

        const canManage =
            ctx.isOwner ||
            ctx.isAdmin ||
            ctx.permissions.includes("workspace:manage_settings") ||
            (ctx.isWorkspaceManager && !!(workspace.managerPermissions as any)?.can_manage_settings);

        return res.json({
            success: true,
            settings: {
                id: workspace.id,
                clubId: workspace.clubId,
                name: workspace.name,
                slug: workspace.slug,
                description: workspace.description,
                iconUrl: workspace.iconUrl,
                workspaceStatus: workspace.workspaceStatus,
                managerUserId: workspace.managerUserId,
                managerAppointedAt: workspace.managerAppointedAt,
                managerPermissions: workspace.managerPermissions,
                customSettings: workspace.settings || {},
                isOwner: ctx.isOwner,
                isWorkspaceManager: ctx.isWorkspaceManager,
                canManageSettings: canManage,
            },
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load settings." });
    }
});

/**
 * PATCH /api/club/workspace/settings
 * Updates workspace configuration & custom settings
 */
workspaceRouter.patch("/settings", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const ctx = await WorkspaceService.resolveContext(workspace.id, authUser.id);
        if (!ctx) return res.status(403).json({ success: false, message: "Workspace access denied." });

        const canManage =
            ctx.isOwner ||
            ctx.isAdmin ||
            ctx.permissions.includes("workspace:manage_settings") ||
            (ctx.isWorkspaceManager && !!(workspace.managerPermissions as any)?.can_manage_settings);

        if (!canManage) {
            return res.status(403).json({ success: false, message: "Unauthorized to modify workspace settings." });
        }

        const { name, description, customSettings } = req.body;
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const setClauses: string[] = [];
            const params: any[] = [workspace.id];

            if (name !== undefined) {
                params.push(name.trim());
                setClauses.push(`name = $${params.length}`);
            }
            if (description !== undefined) {
                params.push(description.trim());
                setClauses.push(`description = $${params.length}`);
            }
            if (customSettings !== undefined) {
                params.push(JSON.stringify(customSettings));
                setClauses.push(`settings = COALESCE(settings, '{}'::jsonb) || $${params.length}::jsonb`);
            }

            if (setClauses.length > 0) {
                setClauses.push(`updated_at = NOW()`);
                await client.query(
                    `UPDATE public.team_workspaces SET ${setClauses.join(", ")} WHERE id = $1;`,
                    params
                );
            }

            await client.query("COMMIT;");
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }

        // Invalidate Redis cache
        await WorkspaceRedisService.invalidateWorkspace(clubId);

        await WorkspaceRepository.logAudit(null, {
            workspaceId: workspace.id,
            actorId: authUser.id,
            action: "workspace_settings_updated",
            targetType: "workspace",
            targetId: workspace.id,
            details: { name, description, customSettings },
            ...getAuditContext(req),
        });

        const updated = await WorkspaceRepository.findById(workspace.id);
        return res.json({ success: true, workspace: updated, message: "Workspace settings updated successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update settings." });
    }
});

// =========================================================================
// 4. DEPARTMENTS MANAGEMENT
// =========================================================================

/**
 * GET /api/club/workspace/departments
 * List departments for active workspace
 */
workspaceRouter.get("/departments", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const ctx = await WorkspaceService.resolveContext(workspace.id, authUser.id);
        if (!ctx) {
            return res.status(403).json({ success: false, message: "Workspace access denied." });
        }

        const includeArchived = req.query.includeArchived === "true" || req.query.includeArchived === "1";
        const departments = await WorkspaceDepartmentService.listDepartments(workspace.id, includeArchived);

        return res.json({ success: true, departments });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to list departments." });
    }
});

/**
 * POST /api/club/workspace/departments/seed-defaults
 * Seed suggested default departments (Tech, Design, Content, Operations, Media)
 */
workspaceRouter.post("/departments/seed-defaults", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;

        const departments = await WorkspaceDepartmentService.seedSuggestedDepartments(
            workspace.id,
            authUser.id,
            getAuditContext(req)
        );

        return res.status(201).json({
            success: true,
            departments,
            message: `Created ${departments.length} suggested departments.`,
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to seed default departments." });
    }
});

/**
 * POST /api/club/workspace/departments
 * Create custom department
 */
workspaceRouter.post("/departments", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;

        const department = await WorkspaceDepartmentService.createDepartment(
            workspace.id,
            authUser.id,
            req.body,
            getAuditContext(req)
        );

        return res.status(201).json({
            success: true,
            department,
            message: `Department "${department.name}" created successfully.`,
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to create department." });
    }
});

/**
 * PUT /api/club/workspace/departments/reorder
 * Reorder departments
 */
workspaceRouter.put("/departments/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { departmentIds } = req.body;
        if (!Array.isArray(departmentIds)) {
            return res.status(400).json({ success: false, message: "departmentIds array is required." });
        }

        const success = await WorkspaceDepartmentService.reorderDepartments(
            workspace.id,
            authUser.id,
            departmentIds,
            getAuditContext(req)
        );

        return res.json({ success, message: "Departments reordered successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to reorder departments." });
    }
});

/**
 * GET /api/club/workspace/departments/:deptId
 * View department details and members
 */
workspaceRouter.get("/departments/:deptId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        if (!deptId) return res.status(400).json({ success: false, message: "Department ID is required." });
        const result = await WorkspaceDepartmentService.getDepartmentDetails(workspace.id, deptId);

        return res.json({ success: true, ...result });
    } catch (err: any) {
        return res.status(404).json({ success: false, message: err.message || "Department not found." });
    }
});

/**
 * PATCH /api/club/workspace/departments/:deptId
 * Edit department details
 */
workspaceRouter.patch("/departments/:deptId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        if (!deptId) return res.status(400).json({ success: false, message: "Department ID is required." });
        const authUser = (req as any).user;

        const updated = await WorkspaceDepartmentService.updateDepartment(
            workspace.id,
            authUser.id,
            deptId,
            req.body,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            department: updated,
            message: `Department "${updated.name}" updated successfully.`,
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update department." });
    }
});

/**
 * POST /api/club/workspace/departments/:deptId/archive
 */
workspaceRouter.post("/departments/:deptId/archive", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        if (!deptId) return res.status(400).json({ success: false, message: "Department ID is required." });
        const authUser = (req as any).user;

        const updated = await WorkspaceDepartmentService.archiveDepartment(
            workspace.id,
            authUser.id,
            deptId,
            getAuditContext(req)
        );

        return res.json({ success: true, department: updated, message: "Department archived." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to archive department." });
    }
});

/**
 * POST /api/club/workspace/departments/:deptId/restore
 */
workspaceRouter.post("/departments/:deptId/restore", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        if (!deptId) return res.status(400).json({ success: false, message: "Department ID is required." });
        const authUser = (req as any).user;

        const updated = await WorkspaceDepartmentService.restoreDepartment(
            workspace.id,
            authUser.id,
            deptId,
            getAuditContext(req)
        );

        return res.json({ success: true, department: updated, message: "Department restored." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to restore department." });
    }
});

/**
 * POST /api/club/workspace/departments/:deptId/members
 * Add member to department (supports multi-department membership)
 */
workspaceRouter.post("/departments/:deptId/members", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        if (!deptId) return res.status(400).json({ success: false, message: "Department ID is required." });
        const { memberId, role, roleTitle } = req.body;
        if (!memberId) {
            return res.status(400).json({ success: false, message: "memberId is required." });
        }

        const authUser = (req as any).user;

        const deptMember = await WorkspaceDepartmentService.addMemberToDepartment(
            workspace.id,
            authUser.id,
            deptId,
            memberId,
            role || "member",
            roleTitle,
            getAuditContext(req)
        );

        return res.status(201).json({
            success: true,
            deptMember,
            message: "Member added to department successfully.",
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to add member to department." });
    }
});

/**
 * DELETE /api/club/workspace/departments/:deptId/members/:memberId
 */
workspaceRouter.delete("/departments/:deptId/members/:memberId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        const memberId = String(req.params.memberId);
        if (!deptId || !memberId) return res.status(400).json({ success: false, message: "Both deptId and memberId are required." });
        const authUser = (req as any).user;

        const removed = await WorkspaceDepartmentService.removeMemberFromDepartment(
            workspace.id,
            authUser.id,
            deptId,
            memberId,
            getAuditContext(req)
        );

        return res.json({ success: removed, message: "Member removed from department." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to remove member." });
    }
});

/**
 * PATCH /api/club/workspace/departments/:deptId/members/:memberId/role
 * Updates scoped role (lead, co_lead, member) and role title for department member
 */
workspaceRouter.patch("/departments/:deptId/members/:memberId/role", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const deptId = String(req.params.deptId);
        const memberId = String(req.params.memberId);
        const { departmentRole, roleTitle } = req.body;
        const authUser = (req as any).user;

        const success = await WorkspaceDepartmentService.updateDepartmentMemberRole(
            workspace.id,
            authUser.id,
            deptId,
            memberId,
            { departmentRole, roleTitle },
            getAuditContext(req)
        );

        return res.json({ success, message: "Department member role updated successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update department member role." });
    }
});

/**
 * POST /api/club/workspace/departments/transfer
 * Transfer a member from one department to another with historical preservation
 */
workspaceRouter.post("/departments/transfer", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { memberId, fromDeptId, toDeptId, reason } = req.body;
        if (!memberId || !fromDeptId || !toDeptId) {
            return res.status(400).json({ success: false, message: "memberId, fromDeptId, and toDeptId are required." });
        }

        const authUser = (req as any).user;

        await WorkspaceDepartmentService.transferMember(
            workspace.id,
            authUser.id,
            memberId,
            fromDeptId,
            toDeptId,
            reason,
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Member transferred to new department successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to transfer member." });
    }
});

/**
 * GET /api/club/workspace/departments/transfers
 * History of member department transfers
 */
workspaceRouter.get("/departments/transfers", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { userId, departmentId, limit, offset } = req.query;

        const transferOpts: any = {};
        if (userId) transferOpts.userId = userId as string;
        if (departmentId) transferOpts.departmentId = departmentId as string;
        if (limit) transferOpts.limit = parseInt(limit as string, 10);
        if (offset) transferOpts.offset = parseInt(offset as string, 10);

        const transfers = await WorkspaceDepartmentService.getDepartmentTransfers(workspace.id, authUser.id, transferOpts);

        return res.json({ success: true, transfers });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to load department transfers." });
    }
});

// =========================================================================
// 5. MEMBER DIRECTORY & ROLE OPERATIONS
// =========================================================================

/**
 * GET /api/club/workspace/members
 */
workspaceRouter.get("/members", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const ctx = await WorkspaceService.resolveContext(workspace.id, authUser.id);
        if (!ctx || (!ctx.member && !ctx.isOwner) || (ctx.member?.isSuspended)) {
            return res.status(403).json({ success: false, message: "Workspace access denied." });
        }

        const { status, departmentId, roleId, search, limit, offset } = req.query as Record<string, string>;
        const queryLimit = Math.min(Math.max(limit ? parseInt(limit, 10) : 50, 1), 100);
        const queryOffset = Math.max(offset ? parseInt(offset, 10) : 0, 0);

        const queryOpts: {
            status?: string;
            departmentId?: string;
            roleId?: string;
            search?: string;
            limit?: number;
            offset?: number;
        } = {
            limit: queryLimit,
            offset: queryOffset,
        };
        if (status) queryOpts.status = status;
        if (departmentId) queryOpts.departmentId = departmentId;
        if (roleId) queryOpts.roleId = roleId;
        if (search) queryOpts.search = search;

        const canSeePrivate = ctx.isOwner || ctx.isAdmin || ctx.isWorkspaceManager;

        // Bounded Redis caching for non-search directory queries (TTL: 120s)
        if (!search) {
            const pageKey = `${departmentId || "all"}:${roleId || "all"}:${status || "all"}:${queryOffset}:${queryLimit}:${canSeePrivate ? "admin" : "member"}`;
            const cached = await WorkspaceRedisService.getCachedMemberDirectory(workspace.id, pageKey);
            if (cached) {
                return res.json({
                    success: true,
                    members: cached.members,
                    total: cached.total,
                    cached: true,
                });
            }

            const result = await WorkspaceRepository.listMembers(workspace.id, queryOpts);
            const sanitized = canSeePrivate
                ? result.members
                : result.members.map((m) => ({
                    ...m,
                    user: m.user ? { ...m.user, email: undefined } : m.user,
                }));

            await WorkspaceRedisService.setCachedMemberDirectory(workspace.id, pageKey, {
                members: sanitized,
                total: result.total,
            });

            return res.json({
                success: true,
                members: sanitized,
                total: result.total,
            });
        }

        const result = await WorkspaceRepository.listMembers(workspace.id, queryOpts);

        // Sanitize private information (email, etc.) if caller is not an administrator or workspace manager
        const sanitizedMembers = canSeePrivate
            ? result.members
            : result.members.map((m) => ({
                ...m,
                user: m.user
                    ? {
                        ...m.user,
                        email: undefined,
                    }
                    : m.user,
            }));

        return res.json({
            success: true,
            members: sanitizedMembers,
            total: result.total,
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load workspace members." });
    }
});

/**
 * PATCH /api/club/workspace/members/:targetUserId/role
 * Assign roles (promote / demote with rank validation)
 */
workspaceRouter.patch("/members/:targetUserId/role", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const targetUserId = String(req.params.targetUserId);
        if (!targetUserId) return res.status(400).json({ success: false, message: "targetUserId is required." });
        const { roleId, roleTitle } = req.body;
        if (!roleId) return res.status(400).json({ success: false, message: "roleId is required." });

        const authUser = (req as any).user;

        const updated = await WorkspaceMemberService.assignMemberRole(
            workspace.id,
            authUser.id,
            targetUserId,
            roleId,
            roleTitle,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            member: updated,
            message: "Member role updated successfully.",
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to assign role." });
    }
});

/**
 * PATCH /api/club/workspace/members/:targetUserId/suspension
 */
workspaceRouter.patch("/members/:targetUserId/suspension", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const targetUserId = String(req.params.targetUserId);
        if (!targetUserId) return res.status(400).json({ success: false, message: "Target user ID is required." });
        const { suspend, reason } = req.body;

        const updated = await WorkspaceService.setMemberSuspension(
            workspace.id,
            targetUserId,
            authUser.id,
            Boolean(suspend),
            reason,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            member: updated,
            message: suspend
                ? "Member has been suspended from this workspace."
                : "Member has been reinstated in this workspace.",
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update suspension status." });
    }
});

/**
 * PATCH /api/club/workspace/members/:targetUserId/permissions
 * PATCH /api/club/workspace/members/:targetUserId/custom-permissions
 * Updates custom permission overrides for an individual member
 */
const handleMemberPermissionsUpdate = async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const targetUserId = String(req.params.targetUserId);
        const { customPermissions } = req.body;

        if (!customPermissions || typeof customPermissions !== "object") {
            return res.status(400).json({ success: false, message: "customPermissions object is required." });
        }

        const updated = await WorkspaceMemberService.updateMemberCustomPermissions(
            workspace.id,
            targetUserId,
            authUser.id,
            customPermissions,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            member: updated,
            message: "Member custom permissions updated successfully.",
        });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("Cannot") ? 400 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to update member permissions." });
    }
};

workspaceRouter.patch("/members/:targetUserId/permissions", authenticate, handleMemberPermissionsUpdate);
workspaceRouter.patch("/members/:targetUserId/custom-permissions", authenticate, handleMemberPermissionsUpdate);

/**
 * DELETE /api/club/workspace/members/:targetUserId
 * Removes a member from workspace and all departments, respecting role hierarchy
 */
workspaceRouter.delete("/members/:targetUserId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const targetUserId = String(req.params.targetUserId);
        if (!targetUserId) return res.status(400).json({ success: false, message: "targetUserId is required." });

        const success = await WorkspaceMemberService.removeMember(
            workspace.id,
            authUser.id,
            targetUserId,
            getAuditContext(req)
        );

        return res.json({ success, message: "Member removed from workspace successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to remove member." });
    }
});

/**
 * PATCH /api/club/workspace/members/:targetUserId/custom-permissions
 * Updates granular grant/revocation overrides for a member
 */
workspaceRouter.patch("/members/:targetUserId/custom-permissions", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const targetUserId = req.params.targetUserId;
        const customPermissions = req.body.customPermissions;

        if (!customPermissions || typeof customPermissions !== "object") {
            return res.status(400).json({ success: false, message: "Valid customPermissions object is required." });
        }

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const auditCtx = getAuditContext(req);
        const updated = await WorkspaceMemberService.updateMemberCustomPermissions(
            workspace.id,
            targetUserId,
            authUser.id,
            customPermissions,
            auditCtx
        );

        return res.json({
            success: true,
            member: updated,
            message: "Member custom permissions updated successfully.",
        });
    } catch (err: any) {
        console.error("PATCH /api/club/workspace/members/:targetUserId/custom-permissions error:", err);
        return res.status(400).json({ success: false, message: err.message || "Failed to update custom permissions." });
    }
});

// =========================================================================
// 6. CRYPTOGRAPHIC INVITATIONS
// =========================================================================

/**
 * POST /api/club/workspace/invitations
 * Generates single-use invitation token with SHA-256 hash
 */
workspaceRouter.post("/invitations", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;

        const { email, roleId, departmentId, invitationMessage } = req.body;
        if (!email || !roleId) {
            return res.status(400).json({ success: false, message: "Both email and roleId are required." });
        }

        const { invitation, rawToken } = await WorkspaceMemberService.createInvitation(
            workspace.id,
            authUser.id,
            { email, roleId, departmentId, invitationMessage },
            getAuditContext(req)
        );

        return res.status(201).json({
            success: true,
            invitation,
            token: rawToken,
            inviteLink: `/club/team-workspace/join?token=${rawToken}`,
            message: `Invitation generated for ${email}.`,
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to create invitation." });
    }
});

/**
 * GET /api/club/workspace/invitations
 */
workspaceRouter.get("/invitations", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const status = (req.query.status as string) || undefined;
        const invitations = await WorkspaceRepository.listInvitations(workspace.id, status);

        return res.json({ success: true, invitations });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load invitations." });
    }
});

/**
 * POST /api/club/workspace/invitations/:invitationId/revoke
 */
workspaceRouter.post("/invitations/:invitationId/revoke", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const invitationId = String(req.params.invitationId);
        if (!invitationId) return res.status(400).json({ success: false, message: "invitationId is required." });
        const authUser = (req as any).user;

        await WorkspaceMemberService.revokeInvitation(
            workspace.id,
            authUser.id,
            invitationId,
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Invitation revoked successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to revoke invitation." });
    }
});

/**
 * GET /api/club/workspace/invitations/verify
 * Public verification endpoint to inspect target workspace and intended role before acceptance
 */
workspaceRouter.get("/invitations/verify", async (req: Request, res: Response) => {
    try {
        const token = req.query.token as string;
        if (!token) {
            return res.status(400).json({ success: false, message: "Invitation token parameter is required." });
        }

        const result = await WorkspaceMemberService.verifyInvitation(token);
        return res.json({ success: true, ...result });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to verify invitation." });
    }
});

/**
 * GET /api/club/workspace/invitations/my-pending
 * Lists all pending invitations for the authenticated user (club team & workspace)
 */
workspaceRouter.get("/invitations/my-pending", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        // 1. Pending club team invitations for this user
        const clubInvRes = await query(
            `SELECT inv.id, inv.token, inv.club_id AS "clubId", c.name AS "clubName", c.slug AS "clubSlug",
                    c.logo_url AS "clubLogoUrl", c.college_name AS "collegeName",
                    t.name AS "teamName",
                    COALESCE(inv.position_title, inv.team_title, inv.title, 'Member') AS "roleName",
                    u_by.username AS "inviterUsername", u_by.firstname AS "inviterFirstName", u_by.lastname AS "inviterLastName",
                    inv.invitation_message AS "invitationMessage",
                    inv.expires_at AS "expiresAt",
                    inv.created_at AS "createdAt"
             FROM public.club_team_invitations inv
             JOIN public.verified_clubs c ON c.id = inv.club_id
             LEFT JOIN public.club_teams t ON t.id = inv.team_id
             LEFT JOIN public.users u_by ON u_by.id = inv.inviter_user_id
             WHERE inv.invited_user_id = $1 AND inv.status = 'pending' AND inv.expires_at > NOW()
             ORDER BY inv.created_at DESC;`,
            [authUser.id]
        );

        // 2. Pending workspace invitations matching user's email or user id
        const userEmail = (authUser.email || authUser.gmail || "").toLowerCase().trim();
        const wsInvRes = await query(
            `SELECT wi.id, wi.workspace_id AS "workspaceId", tw.name AS "workspaceName", tw.slug AS "workspaceSlug",
                    vc.id AS "clubId", vc.name AS "clubName", vc.slug AS "clubSlug", vc.logo_url AS "clubLogoUrl", vc.college_name AS "collegeName",
                    r.name AS "roleName", wd.name AS "departmentName",
                    u_by.username AS "inviterUsername", u_by.firstname AS "inviterFirstName", u_by.lastname AS "inviterLastName",
                    wi.invitation_message AS "invitationMessage",
                    wi.expires_at AS "expiresAt",
                    wi.created_at AS "createdAt"
             FROM public.workspace_invitations wi
             JOIN public.team_workspaces tw ON tw.id = wi.workspace_id
             JOIN public.verified_clubs vc ON vc.id = tw.club_id
             JOIN public.workspace_roles r ON r.id = wi.role_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wi.department_id
             LEFT JOIN public.users u_by ON u_by.id = wi.inviter_id
             WHERE (wi.invited_user_id = $1 OR (wi.email IS NOT NULL AND LOWER(wi.email) = $2))
               AND wi.status = 'pending' AND wi.expires_at > NOW()
             ORDER BY wi.created_at DESC;`,
            [authUser.id, userEmail]
        );

        const invitations = [
            ...clubInvRes.rows.map((r) => ({
                id: r.id,
                type: "club_team" as const,
                token: r.token,
                clubId: r.clubId,
                clubName: r.clubName,
                clubSlug: r.clubSlug,
                clubLogoUrl: r.clubLogoUrl,
                collegeName: r.collegeName,
                roleName: r.roleName,
                departmentName: r.teamName || null,
                inviterName: `${r.inviterFirstName || ""} ${r.inviterLastName || ""}`.trim() || r.inviterUsername || "Club Manager",
                invitationMessage: r.invitationMessage,
                expiresAt: r.expiresAt,
                createdAt: r.createdAt,
            })),
            ...wsInvRes.rows.map((r) => ({
                id: r.id,
                type: "workspace" as const,
                token: null,
                clubId: r.clubId,
                clubName: r.clubName,
                clubSlug: r.clubSlug,
                clubLogoUrl: r.clubLogoUrl,
                collegeName: r.collegeName,
                roleName: r.roleName,
                departmentName: r.departmentName || null,
                inviterName: `${r.inviterFirstName || ""} ${r.inviterLastName || ""}`.trim() || r.inviterUsername || "Workspace Manager",
                invitationMessage: r.invitationMessage,
                expiresAt: r.expiresAt,
                createdAt: r.createdAt,
            })),
        ];

        return res.json({ success: true, invitations });
    } catch (err: any) {
        console.error("GET /api/club/workspace/invitations/my-pending error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to load pending invitations." });
    }
});

/**
 * POST /api/club/workspace/invitations/accept
 * Accept invitation using raw token or pending invitation ID
 */
workspaceRouter.post("/invitations/accept", authenticate, async (req: Request, res: Response) => {
    try {
        const { token, invitationId, type } = req.body;
        const authUser = (req as any).user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        // 1. Direct acceptance via invitationId
        if (invitationId && (!token || typeof token !== "string" || !token.trim())) {
            if (type === "club_team") {
                const result = await ClubTeamService.acceptInvitation(invitationId, authUser.id);
                let workspace = await WorkspaceRepository.findByClubId(result.clubId);
                if (!workspace) {
                    workspace = await WorkspaceService.initializeForClub(result.clubId, authUser.id);
                }
                const member = workspace ? await WorkspaceRepository.findMember(workspace.id, authUser.id) : null;
                return res.json({
                    success: true,
                    workspace,
                    member,
                    clubId: result.clubId,
                    clubName: result.clubName,
                    message: result.message,
                });
            } else {
                // Workspace invitation acceptance by ID
                const invRes = await query(
                    `SELECT id, workspace_id, role_id, department_id, inviter_id, email, expires_at, status
                     FROM public.workspace_invitations
                     WHERE id = $1 LIMIT 1;`,
                    [invitationId]
                );
                const inv = invRes.rows[0];
                if (!inv) return res.status(404).json({ success: false, message: "Invitation not found." });
                if (inv.status !== "pending") return res.status(400).json({ success: false, message: `Invitation already ${inv.status}.` });
                if (new Date(inv.expires_at) < new Date()) return res.status(400).json({ success: false, message: "Invitation has expired." });

                const workspace = await WorkspaceRepository.findById(inv.workspace_id);
                if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

                const member = await WorkspaceRepository.createMember(null, {
                    workspaceId: workspace.id,
                    userId: authUser.id,
                    roleId: inv.role_id,
                    departmentId: inv.department_id || null,
                    membershipStatus: "active",
                    invitedBy: inv.inviter_id,
                });

                if (inv.department_id) {
                    await WorkspaceRepository.addDepartmentMember(null, {
                        workspaceId: workspace.id,
                        departmentId: inv.department_id,
                        memberId: member.id,
                        userId: authUser.id,
                        departmentRole: "member",
                        roleTitle: "Department Member",
                        assignedBy: inv.inviter_id,
                    });
                }

                await query(
                    `UPDATE public.workspace_invitations SET status = 'accepted', accepted_at = NOW(), invited_user_id = $2, updated_at = NOW() WHERE id = $1;`,
                    [inv.id, authUser.id]
                );

                if (workspace.clubId) {
                    await query(
                        `INSERT INTO public.club_memberships
                            (club_id, user_id, club_role, access_role, title, status, invited_by, joined_at)
                         VALUES ($1, $2, 'member', 'member', 'Member', 'active', $3, NOW())
                         ON CONFLICT (club_id, user_id) DO UPDATE SET status = 'active', updated_at = NOW();`,
                        [workspace.clubId, authUser.id, inv.inviter_id]
                    );
                }

                return res.json({
                    success: true,
                    workspace,
                    member,
                    clubId: workspace.clubId,
                    clubName: workspace.name,
                    message: `Successfully joined ${workspace.name}!`,
                });
            }
        }

        // 2. Acceptance via raw token
        if (!token || typeof token !== "string" || !token.trim()) {
            return res.status(400).json({ success: false, message: "Invitation token or invitation ID is required." });
        }

        const { workspace, member } = await WorkspaceMemberService.acceptInvitation(
            token.trim(),
            authUser.id,
            getAuditContext(req)
        );

        return res.json({
            success: true,
            workspace,
            member,
            clubId: workspace?.clubId,
            clubName: workspace?.name,
            message: `Successfully joined ${workspace.name}!`,
        });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to accept invitation." });
    }
});

// =========================================================================
// 7. ROLES
// =========================================================================

/**
 * GET /api/club/workspace/roles
 */
workspaceRouter.get("/roles", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const ctx = await WorkspaceService.resolveContext(workspace.id, authUser.id);
        if (!ctx) {
            return res.status(403).json({ success: false, message: "Workspace access denied." });
        }

        const roles = await WorkspaceRepository.listRoles(workspace.id);
        return res.json({ success: true, roles });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to load roles." });
    }
});

/**
 * POST /api/club/workspace/roles
 * Create custom role
 */
workspaceRouter.post("/roles", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { name, description, rank, color, permissions } = req.body;

        if (!name || rank === undefined) {
            return res.status(400).json({ success: false, message: "Role name and rank are required." });
        }

        const role = await WorkspaceMemberService.createCustomRole(
            workspace.id,
            authUser.id,
            { name, description, rank: Number(rank), color, permissions: permissions || [] },
            getAuditContext(req)
        );

        return res.status(201).json({ success: true, role });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("Cannot") ? 400 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to create role." });
    }
});

/**
 * PATCH /api/club/workspace/roles/:roleId
 * Update custom role
 */
workspaceRouter.patch("/roles/:roleId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const roleId = String(req.params.roleId);
        const { name, description, rank, color, permissions } = req.body;

        const updateData: Record<string, any> = {};
        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (rank !== undefined) updateData.rank = Number(rank);
        if (color !== undefined) updateData.color = color;
        if (permissions !== undefined) updateData.permissions = permissions;

        const updated = await WorkspaceMemberService.updateCustomRole(
            workspace.id,
            authUser.id,
            roleId,
            updateData,
            getAuditContext(req)
        );

        return res.json({ success: true, role: updated });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("Cannot") || err.message?.includes("System roles") ? 400 : err.message?.includes("not found") ? 404 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to update role." });
    }
});

/**
 * DELETE /api/club/workspace/roles/:roleId
 * Delete custom role (reassigns members to default member role)
 */
workspaceRouter.delete("/roles/:roleId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const roleId = String(req.params.roleId);

        const deleted = await WorkspaceMemberService.deleteCustomRole(
            workspace.id,
            authUser.id,
            roleId,
            getAuditContext(req)
        );

        return res.json({ success: true, deleted, message: "Role deleted and members reassigned." });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("System roles") || err.message?.includes("Cannot") ? 400 : err.message?.includes("not found") ? 404 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to delete role." });
    }
});

/**
 * PUT /api/club/workspace/roles/reorder
 * Reorders custom roles hierarchy
 */
workspaceRouter.put("/roles/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const { roleOrder } = req.body;

        if (!roleOrder || !Array.isArray(roleOrder)) {
            return res.status(400).json({ success: false, message: "roleOrder array is required." });
        }

        const roles = await WorkspaceMemberService.reorderRoles(
            workspace.id,
            authUser.id,
            roleOrder,
            getAuditContext(req)
        );

        return res.json({ success: true, roles, message: "Roles reordered successfully." });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("Cannot") ? 400 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to reorder roles." });
    }
});

/**
 * GET /api/club/workspace/permissions/preview
 * Read-only capability simulation for a role or member
 */
workspaceRouter.get("/permissions/preview", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const authUser = (req as any).user;
        const roleId = req.query.roleId as string | undefined;
        const targetUserId = req.query.targetUserId as string | undefined;

        const simulation = await WorkspaceCapabilityService.previewCapabilities(
            workspace.id,
            authUser.id,
            { roleId, targetUserId }
        );

        return res.json({ success: true, preview: simulation });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : err.message?.includes("not found") ? 404 : 400;
        return res.status(status).json({ success: false, message: err.message || "Failed to generate permission preview." });
    }
});

// =========================================================================
// 8. CHANNEL CATEGORIES (PHASE 04)
// =========================================================================

/**
 * GET /api/club/workspace/categories
 * Lists categories and channels visible to the authenticated user
 */
workspaceRouter.get("/categories", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const categories = await WorkspaceChannelService.listCategoriesWithChannels(workspace.id, authUser.id);
        return res.json({ success: true, categories });
    } catch (err: any) {
        const status = err.message?.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message || "Failed to list categories." });
    }
});

/**
 * POST /api/club/workspace/categories
 * Create a new channel category (workspace-wide or department-specific)
 */
workspaceRouter.post("/categories", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const category = await WorkspaceChannelService.createCategory(
            workspace.id,
            authUser.id,
            req.body,
            getAuditContext(req)
        );

        return res.status(201).json({ success: true, category });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to create category." });
    }
});

/**
 * PUT /api/club/workspace/categories/reorder
 * Reorder channel categories display orders
 */
workspaceRouter.put("/categories/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { categoryIds } = req.body;
        if (!Array.isArray(categoryIds) || categoryIds.length === 0) {
            return res.status(400).json({ success: false, message: "categoryIds array is required." });
        }

        await WorkspaceChannelService.reorderCategories(
            workspace.id,
            authUser.id,
            categoryIds,
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Categories reordered successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to reorder categories." });
    }
});

/**
 * PATCH /api/club/workspace/categories/:categoryId
 */
workspaceRouter.patch("/categories/:categoryId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const updated = await WorkspaceChannelService.updateCategory(
            workspace.id,
            authUser.id,
            String(req.params.categoryId),
            req.body,
            getAuditContext(req)
        );

        return res.json({ success: true, category: updated });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update category." });
    }
});

/**
 * DELETE /api/club/workspace/categories/:categoryId
 */
workspaceRouter.delete("/categories/:categoryId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.deleteCategory(
            workspace.id,
            authUser.id,
            String(req.params.categoryId),
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Category deleted successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to delete category." });
    }
});

/**
 * POST /api/club/workspace/categories/:categoryId/overrides
 */
workspaceRouter.post("/categories/:categoryId/overrides", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const override = await WorkspaceChannelService.setCategoryOverride(
            workspace.id,
            authUser.id,
            String(req.params.categoryId),
            req.body,
            getAuditContext(req)
        );

        return res.json({ success: true, override });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to set category override." });
    }
});

// =========================================================================
// 9. CHANNELS (PHASE 04)
// =========================================================================

/**
 * POST /api/club/workspace/channels
 * Create a new channel
 */
workspaceRouter.post("/channels", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const channel = await WorkspaceChannelService.createChannel(
            workspace.id,
            authUser.id,
            req.body,
            getAuditContext(req)
        );

        return res.status(201).json({ success: true, channel });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to create channel." });
    }
});

/**
 * PUT /api/club/workspace/channels/reorder
 * Reorder channels within or across categories
 */
workspaceRouter.put("/channels/reorder", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { channelIds } = req.body;
        if (!Array.isArray(channelIds) || channelIds.length === 0) {
            return res.status(400).json({ success: false, message: "channelIds array is required." });
        }

        await WorkspaceChannelService.reorderChannels(
            workspace.id,
            authUser.id,
            channelIds,
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Channels reordered successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to reorder channels." });
    }
});

/**
 * GET /api/club/workspace/channels/:channelId
 * Strictly enforces privacy: unauthorized callers receive 404
 */
workspaceRouter.get("/channels/:channelId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const channel = await WorkspaceChannelService.getChannelDetails(
            workspace.id,
            authUser.id,
            String(req.params.channelId)
        );

        return res.json({ success: true, channel });
    } catch (err: any) {
        // Return 404 for unauthorized or not found to prevent private channel existence leakage
        return res.status(404).json({ success: false, message: "Channel not found." });
    }
});

/**
 * PATCH /api/club/workspace/channels/:channelId
 */
workspaceRouter.patch("/channels/:channelId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const updated = await WorkspaceChannelService.updateChannel(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            req.body,
            getAuditContext(req)
        );

        return res.json({ success: true, channel: updated });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to update channel." });
    }
});

/**
 * DELETE /api/club/workspace/channels/:channelId
 */
workspaceRouter.delete("/channels/:channelId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.deleteChannel(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Channel deleted successfully." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to delete channel." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/sync
 * Sync channel permissions with parent category
 */
workspaceRouter.post("/channels/:channelId/sync", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.syncChannelWithCategory(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Channel permissions synced with category." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to sync channel." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/overrides
 */
workspaceRouter.post("/channels/:channelId/overrides", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const override = await WorkspaceChannelService.setChannelOverride(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            req.body,
            getAuditContext(req)
        );

        return res.json({ success: true, override });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to set channel override." });
    }
});

/**
 * DELETE /api/club/workspace/channels/:channelId/overrides/:overrideId
 */
workspaceRouter.delete("/channels/:channelId/overrides/:overrideId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.deleteOverride(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            String(req.params.overrideId),
            getAuditContext(req)
        );

        return res.json({ success: true, message: "Channel override removed." });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to delete channel override." });
    }
});

// =========================================================================
// 10. MESSAGES & REACTIONS (PHASE 04)
// =========================================================================

/**
 * GET /api/club/workspace/channels/:channelId/messages
 * List messages with pagination (before, after, limit, threadId)
 * Returns 404 if channel is private and user is unauthorized
 */
workspaceRouter.get("/channels/:channelId/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const queryOpts: { threadId?: string | null; before?: string; after?: string; limit?: number } = {
            threadId: (req.query.threadId as string) || null,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
        };
        if (req.query.before) queryOpts.before = String(req.query.before);
        if (req.query.after) queryOpts.after = String(req.query.after);

        const messages = await WorkspaceChannelService.listMessages(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            queryOpts
        );

        return res.json({ success: true, messages });
    } catch (err: any) {
        return res.status(404).json({ success: false, message: "Channel not found." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/messages
 * Send a message
 */
workspaceRouter.post("/channels/:channelId/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const message = await WorkspaceChannelService.sendMessage(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            req.body,
            getAuditContext(req)
        );

        return res.status(201).json({ success: true, message });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to post message." });
    }
});

/**
 * PATCH /api/club/workspace/channels/:channelId/messages/:messageId
 * Edit own message
 */
workspaceRouter.patch("/channels/:channelId/messages/:messageId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { content } = req.body;
        if (!content || typeof content !== "string" || !content.trim()) {
            return res.status(400).json({ success: false, message: "Message content cannot be empty." });
        }

        const updated = await WorkspaceChannelService.editMessage(
            workspace.id,
            authUser.id,
            String(req.params.messageId),
            content
        );

        return res.json({ success: true, message: updated });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to edit message." });
    }
});

/**
 * DELETE /api/club/workspace/channels/:channelId/messages/:messageId
 * Delete own message or delete any if admin
 */
workspaceRouter.delete("/channels/:channelId/messages/:messageId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.deleteMessage(
            workspace.id,
            authUser.id,
            String(req.params.messageId)
        );

        return res.json({ success: true, message: "Message deleted successfully." });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to delete message." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/messages/:messageId/pin
 * Pin / unpin message
 */
workspaceRouter.post("/channels/:channelId/messages/:messageId/pin", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const isPinned = req.body.isPinned !== false;
        await WorkspaceChannelService.togglePinMessage(
            workspace.id,
            authUser.id,
            String(req.params.messageId),
            isPinned
        );

        return res.json({ success: true, isPinned });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to pin/unpin message." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/messages/:messageId/reactions
 * Toggle emoji reaction
 */
workspaceRouter.post("/channels/:channelId/messages/:messageId/reactions", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { emoji } = req.body;
        if (!emoji || typeof emoji !== "string") {
            return res.status(400).json({ success: false, message: "Emoji string is required." });
        }

        const added = await WorkspaceChannelService.toggleReaction(
            workspace.id,
            authUser.id,
            String(req.params.messageId),
            emoji
        );

        return res.json({ success: true, added });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to toggle reaction." });
    }
});

/**
 * GET /api/club/workspace/messages/search
 * Search messages with privacy isolation
 */
workspaceRouter.get("/messages/search", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const queryText = (req.query.q as string) || "";
        if (!queryText.trim()) {
            return res.json({ success: true, messages: [] });
        }

        const messages = await WorkspaceChannelService.searchMessages(
            workspace.id,
            authUser.id,
            queryText,
            req.query.limit ? parseInt(req.query.limit as string, 10) : 30
        );

        return res.json({ success: true, messages });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Search failed." });
    }
});

/**
 * POST /api/club/workspace/channels/:channelId/read
 * Mark channel read
 */
workspaceRouter.post("/channels/:channelId/read", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        await WorkspaceChannelService.markChannelRead(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            req.body?.lastReadMessageId || null
        );

        return res.json({ success: true });
    } catch (err: any) {
        return res.status(400).json({ success: false, message: err.message || "Failed to mark read." });
    }
});

/**
 * GET /api/club/workspace/channels/unread
 * Get unread message counts per channel
 */
workspaceRouter.get("/channels-unread", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const unreadCounts = await WorkspaceChannelService.getUnreadCounts(workspace.id, authUser.id);
        return res.json({ success: true, unreadCounts });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to get unread counts." });
    }
});

// =========================================================================
// 11. THREADS (PHASE 04)
// =========================================================================

/**
 * POST /api/club/workspace/channels/:channelId/threads
 * Create a new thread
 */
workspaceRouter.post("/channels/:channelId/threads", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const { parentMessageId, name } = req.body;
        if (!parentMessageId || !name) {
            return res.status(400).json({ success: false, message: "parentMessageId and name are required." });
        }

        const thread = await WorkspaceChannelService.createThread(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            parentMessageId,
            name,
            getAuditContext(req)
        );

        return res.status(201).json({ success: true, thread });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to create thread." });
    }
});

/**
 * GET /api/club/workspace/threads/:threadId
 * Strictly enforces privacy: unauthorized callers receive 404
 */
workspaceRouter.get("/threads/:threadId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const thread = await WorkspaceChannelService.getThread(
            workspace.id,
            authUser.id,
            String(req.params.threadId)
        );

        return res.json({ success: true, thread });
    } catch (err: any) {
        return res.status(404).json({ success: false, message: "Thread not found." });
    }
});

/**
 * GET /api/club/workspace/channels/:channelId/threads
 * List threads in a channel
 */
workspaceRouter.get("/channels/:channelId/threads", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const threads = await WorkspaceChannelService.listThreads(
            workspace.id,
            authUser.id,
            String(req.params.channelId),
            req.query.includeArchived === "true"
        );

        return res.json({ success: true, threads });
    } catch (err: any) {
        return res.status(404).json({ success: false, message: "Channel not found." });
    }
});

/**
 * PATCH /api/club/workspace/threads/:threadId
 * Lock or archive thread
 */
workspaceRouter.patch("/threads/:threadId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });

        const thread = await WorkspaceChannelService.updateThread(
            workspace.id,
            authUser.id,
            String(req.params.threadId),
            req.body,
            getAuditContext(req)
        );

        return res.json({ success: true, thread });
    } catch (err: any) {
        return res.status(403).json({ success: false, message: err.message || "Failed to update thread." });
    }
});

// =========================================================================
// 12. REALTIME SSE STREAM (PHASE 04)
// =========================================================================

/**
 * GET /api/club/workspace/realtime/stream
 * Authenticated Server-Sent Events stream with privacy isolation
 */
workspaceRouter.get("/realtime/stream", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        // Establish SSE stream
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders?.();

        // Send connection initialization event
        res.write(`data: ${JSON.stringify({ event: "connected", workspaceId: workspace.id, timestamp: new Date().toISOString() })}\n\n`);

        // Event listener callback with strict privacy isolation & authorization
        const eventHandler = async (data: { event: string; payload: any; timestamp: string }) => {
            try {
                const { event, payload } = data;

                // 1. Channel & message permission check (Drop event for unauthorized clients)
                const channelId = payload?.channelId || payload?.channel?.id || payload?.message?.channelId;
                if (channelId) {
                    const allowed = await WorkspaceChannelService.canViewChannel(workspace.id, channelId, authUser.id);
                    if (!allowed) {
                        return; // Drop event (Zero-leak privacy)
                    }
                }

                // 2. Task permission check (Zero-leak for restricted tasks)
                const taskId = payload?.taskId || payload?.task?.id;
                if (taskId) {
                    const allowed = await WorkspaceTaskService.canUserViewTask(workspace.id, taskId, authUser.id);
                    if (!allowed) {
                        return; // Drop event for restricted task
                    }
                }

                // 3. Department confidential event check
                const deptId = payload?.departmentId || payload?.department?.id;
                if (deptId && payload?.isConfidential) {
                    const allowed = await WorkspaceDepartmentService.canUserAccessDepartment(workspace.id, deptId, authUser.id);
                    if (!allowed) {
                        return;
                    }
                }

                // 4. Targeted private user notifications
                if (payload?.targetUserId && payload.targetUserId !== authUser.id && payload.isPrivateNotification) {
                    return;
                }

                res.write(`data: ${JSON.stringify(data)}\n\n`);
            } catch (err) {
                // Ignore serialization / permission errors during streaming
            }
        };

        const eventName = `workspace:${workspace.id}`;
        workspaceEventBus.on(eventName, eventHandler);

        // Keep-alive heartbeat every 25 seconds
        const heartbeat = setInterval(() => {
            res.write(`: heartbeat\n\n`);
        }, 25000);

        req.on("close", () => {
            clearInterval(heartbeat);
            workspaceEventBus.off(eventName, eventHandler);
            res.end();
        });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: err.message || "Failed to establish SSE stream." });
    }
});

// =========================================================================
// 8. PHASE 05: TASK MANAGEMENT SYSTEM ENDPOINTS
// =========================================================================

/**
 * POST /api/club/workspace/tasks
 * Creates a new task in the workspace.
 */
workspaceRouter.post("/tasks", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const {
            title,
            description,
            departmentId,
            priority,
            startDate,
            dueDate,
            assignedRoleId,
            checklist,
            referenceLinks,
            isRestricted,
            assigneeUserIds,
            fileIds,
        } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: "Task title is required." });
        }

        const task = await WorkspaceTaskService.createTask(workspace.id, authUser.id, {
            title,
            description,
            departmentId: departmentId || null,
            priority,
            startDate,
            dueDate,
            assignedRoleId: assignedRoleId || null,
            checklist,
            referenceLinks,
            isRestricted,
            assigneeUserIds,
            fileIds,
        });

        return res.status(201).json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks
 * Lists tasks with filtering, search, and department isolation.
 */
workspaceRouter.get("/tasks", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const {
            departmentId,
            status,
            priority,
            assigneeUserId,
            assignedByUserId,
            creatorId,
            search,
            isArchived,
            sortBy,
            sortDir,
            limit,
            offset,
        } = req.query;

        const filter: any = {};
        if (departmentId) filter.departmentId = departmentId as string;
        if (status) filter.status = status as any;
        if (priority) filter.priority = priority as any;
        if (assigneeUserId) filter.assigneeUserId = assigneeUserId as string;
        if (assignedByUserId) filter.assignedByUserId = assignedByUserId as string;
        if (creatorId) filter.creatorId = creatorId as string;
        if (search) filter.search = search as string;
        if (isArchived !== undefined) filter.isArchived = isArchived === "true";
        if (sortBy) filter.sortBy = sortBy as any;
        if (sortDir) filter.sortDir = sortDir as any;
        if (limit) filter.limit = parseInt(limit as string, 10);
        if (offset) filter.offset = parseInt(offset as string, 10);

        const result = await WorkspaceTaskService.listTasks(workspace.id, authUser.id, filter);

        return res.json({ success: true, tasks: result.tasks, total: result.total });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/my-tasks
 * Categorized tasks for "My Tasks" views.
 */
workspaceRouter.get("/tasks/my-tasks", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const tab = (req.query.tab as any) || "assigned_to_me";
        const tasks = await WorkspaceTaskService.getMyTasks(workspace.id, authUser.id, tab);

        return res.json({ success: true, tab, tasks });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/accountability
 * Workload and task accountability metrics: awaiting review, unassigned, nearing deadline, overdue, blocked,
 * department workload, and member distributions.
 */
workspaceRouter.get("/tasks/accountability", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const accountability = await WorkspaceTaskService.getAccountabilityOverview(workspace.id, authUser.id);
        return res.json({ success: true, ...accountability });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/:taskId
 * Retrieves full task details.
 */
workspaceRouter.get("/tasks/:taskId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const task = await WorkspaceTaskService.getTask(workspace.id, authUser.id, req.params.taskId as string);
        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("not found") ? 404 : err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/:taskId/reassignments
 * Chronological reassignment history.
 */
workspaceRouter.get("/tasks/:taskId/reassignments", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const reassignments = await WorkspaceTaskService.getReassignmentHistory(
            workspace.id,
            authUser.id,
            req.params.taskId as string
        );
        return res.json({ success: true, reassignments });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * PATCH /api/club/workspace/tasks/:taskId
 * Updates task fields with optimistic concurrency protection.
 */
workspaceRouter.patch("/tasks/:taskId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const {
            title,
            description,
            departmentId,
            priority,
            startDate,
            dueDate,
            assignedRoleId,
            checklist,
            referenceLinks,
            isRestricted,
            displayOrder,
            expectedVersion,
        } = req.body;

        const task = await WorkspaceTaskService.updateTask(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            {
                title,
                description,
                departmentId,
                priority,
                startDate,
                dueDate,
                assignedRoleId,
                checklist,
                referenceLinks,
                isRestricted,
                displayOrder,
            },
            expectedVersion
        );

        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Concurrency conflict")
            ? 409
            : err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/transition
 * Executes a status transition according to the explicit state machine.
 */
workspaceRouter.post("/tasks/:taskId/transition", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { targetStatus, expectedVersion, reason } = req.body;
        if (!targetStatus) {
            return res.status(400).json({ success: false, message: "targetStatus is required." });
        }

        const task = await WorkspaceTaskService.transitionTaskStatus(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            targetStatus,
            expectedVersion,
            reason
        );

        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Concurrency conflict")
            ? 409
            : err.message.includes("Self-review") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/assign
 * Reassigns members to a task with reassignment history tracking.
 */
workspaceRouter.post("/tasks/:taskId/assign", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { assigneeUserIds } = req.body;
        if (!Array.isArray(assigneeUserIds)) {
            return res.status(400).json({ success: false, message: "assigneeUserIds array is required." });
        }

        const task = await WorkspaceTaskService.setTaskAssignees(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            assigneeUserIds
        );

        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/submit
 * Submits work deliverables for review.
 */
workspaceRouter.post("/tasks/:taskId/submit", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { content, attachments, expectedVersion, fileIds } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Submission content is required." });
        }

        const result = await WorkspaceTaskService.submitTask(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            content,
            attachments || [],
            expectedVersion,
            fileIds
        );

        return res.status(201).json({ success: true, task: result.task, submission: result.submission });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/review
 * Reviews deliverable: approve or request changes (enforcing self-review protection).
 */
workspaceRouter.post("/tasks/:taskId/review", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { submissionId, decision, comments, expectedVersion } = req.body;
        if (!submissionId || !decision || !comments || !comments.trim()) {
            return res.status(400).json({
                success: false,
                message: "submissionId, decision ('approved' | 'changes_requested'), and comments are required.",
            });
        }

        const result = await WorkspaceTaskService.reviewTask(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            submissionId,
            decision,
            comments,
            expectedVersion
        );

        return res.json({ success: true, task: result.task, review: result.review });
    } catch (err: any) {
        const status = err.message.includes("Self-review") || err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/comments
 * Adds a comment or reply to the task discussion.
 */
workspaceRouter.post("/tasks/:taskId/comments", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { content, parentCommentId, mentions, attachments } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ success: false, message: "Comment content cannot be empty." });
        }

        const comment = await WorkspaceTaskService.addComment(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            content,
            parentCommentId,
            mentions,
            attachments
        );

        return res.status(201).json({ success: true, comment });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/:taskId/comments
 * Retrieves threaded comments for a task.
 */
workspaceRouter.get("/tasks/:taskId/comments", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const comments = await WorkspaceTaskService.getComments(workspace.id, authUser.id, req.params.taskId as string);
        return res.json({ success: true, comments });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/watch
 * Toggles watcher subscription.
 */
workspaceRouter.post("/tasks/:taskId/watch", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const result = await WorkspaceTaskService.toggleWatcher(workspace.id, authUser.id, req.params.taskId as string);
        return res.json({ success: true, isWatching: result.isWatching });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/tasks/:taskId/activity
 * Retrieves chronological task audit stream.
 */
workspaceRouter.get("/tasks/:taskId/activity", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
        const activity = await WorkspaceTaskService.getActivity(workspace.id, authUser.id, req.params.taskId as string, limit);
        return res.json({ success: true, activity });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 500;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/tasks/:taskId/checklist
 * Updates checklist items.
 */
workspaceRouter.post("/tasks/:taskId/checklist", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { checklist, expectedVersion } = req.body;
        if (!Array.isArray(checklist)) {
            return res.status(400).json({ success: false, message: "checklist array is required." });
        }

        const task = await WorkspaceTaskService.updateChecklist(
            workspace.id,
            authUser.id,
            req.params.taskId as string,
            checklist,
            expectedVersion
        );

        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Concurrency conflict")
            ? 409
            : err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/club/workspace/tasks/:taskId
 * Soft-deletes (archives) a task.
 */
workspaceRouter.delete("/tasks/:taskId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const task = await WorkspaceTaskService.archiveTask(workspace.id, authUser.id, req.params.taskId as string);
        return res.json({ success: true, task });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

// =========================================================================
// 8. MEDIA & DOCUMENT MANAGEMENT (PHASE 06)
// =========================================================================

/**
 * POST /api/club/workspace/files/upload-intent
 * Requests a short-lived signed authorization for client direct upload to Cloudinary.
 */
workspaceRouter.post("/files/upload-intent", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const {
            fileName,
            fileSizeBytes,
            mimeType,
            checksum,
            departmentId,
            parentResourceType,
            parentResourceId,
        } = req.body;

        if (!fileName || !fileSizeBytes || !mimeType || !parentResourceType) {
            return res.status(400).json({
                success: false,
                message: "fileName, fileSizeBytes, mimeType, and parentResourceType are required.",
            });
        }

        const intent = await WorkspaceFileService.createUploadIntent(
            workspace.id,
            authUser.id,
            {
                fileName,
                fileSizeBytes: Number(fileSizeBytes),
                mimeType,
                checksum,
                departmentId,
                parentResourceType,
                parentResourceId,
            }
        );

        return res.status(201).json({ success: true, intent });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/files/register-upload
 * Completes single-use upload registration and persists asset metadata.
 */
workspaceRouter.post("/files/register-upload", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const {
            intentId,
            cloudinaryPublicId,
            cloudinaryAssetId,
            secureUrl,
            url,
            format,
            fileSizeBytes,
            mimeType,
            checksum,
        } = req.body;

        if (!intentId || !cloudinaryPublicId || !secureUrl) {
            return res.status(400).json({
                success: false,
                message: "intentId, cloudinaryPublicId, and secureUrl are required.",
            });
        }

        const file = await WorkspaceFileService.registerUpload(
            workspace.id,
            authUser.id,
            {
                intentId,
                cloudinaryPublicId,
                cloudinaryAssetId,
                secureUrl,
                url,
                format,
                fileSizeBytes: Number(fileSizeBytes),
                mimeType,
                checksum,
            }
        );

        return res.status(201).json({ success: true, file });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/files/direct-upload
 * Server-side stream upload with binary magic-byte & stored XSS inspection.
 */
workspaceRouter.post(
    "/files/direct-upload",
    authenticate,
    fileUpload.single("file"),
    async (req: Request, res: Response) => {
        try {
            const clubId = await resolveClubId(req, res);
            if (!clubId) return;

            const authUser = (req as any).user;
            const workspace = await WorkspaceRepository.findByClubId(clubId);
            if (!workspace) {
                return res.status(404).json({ success: false, message: "Workspace not found." });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: "No file provided in form-data ('file')." });
            }

            const { departmentId, parentResourceType, parentResourceId } = req.body;

            const file = await WorkspaceFileService.directUpload(
                workspace.id,
                authUser.id,
                req.file.buffer,
                {
                    originalFilename: req.file.originalname,
                    mimeType: req.file.mimetype,
                    departmentId: departmentId || null,
                    parentResourceType: parentResourceType || "attachment",
                    parentResourceId: parentResourceId || null,
                }
            );

            return res.status(201).json({ success: true, file });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
                ? 403
                : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/club/workspace/files/:fileId/delivery-url
 * Authorizes access and generates an ephemeral signed delivery URL.
 */
workspaceRouter.get("/files/:fileId/delivery-url", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const thumbnail = req.query.thumbnail === "true";
        const download = req.query.download === "true";
        const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;

        const deliveryOpts: { thumbnail?: boolean; download?: boolean; page?: number } = {
            thumbnail,
            download,
        };
        if (page !== undefined) deliveryOpts.page = page;

        const delivery = await WorkspaceFileService.getAuthorizedDeliveryUrl(
            workspace.id,
            authUser.id,
            String(req.params.fileId),
            deliveryOpts
        );

        return res.json({ success: true, ...delivery });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/files
 * Lists workspace files with optional filters and access checks.
 */
workspaceRouter.get("/files", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const filters: any = {
            departmentId: req.query.departmentId as string,
            channelId: req.query.channelId as string,
            taskId: req.query.taskId as string,
            submissionId: req.query.submissionId as string,
            parentResourceType: req.query.parentResourceType as any,
            parentResourceId: req.query.parentResourceId as string,
            mimeTypeCategory: req.query.mimeTypeCategory as any,
            uploaderId: req.query.uploaderId as string,
            status: req.query.status as any,
            search: req.query.search as string,
            limit: req.query.limit ? parseInt(req.query.limit as string, 10) : undefined,
            offset: req.query.offset ? parseInt(req.query.offset as string, 10) : undefined,
        };

        const result = await WorkspaceFileService.listFiles(workspace.id, authUser.id, filters);
        return res.json({ success: true, files: result.files, total: result.total });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/club/workspace/files/storage/usage
 * Retrieves workspace storage quota utilization.
 */
workspaceRouter.get("/files/storage/usage", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const storage = await WorkspaceFileService.getWorkspaceStorageUsage(workspace.id, authUser.id);
        return res.json({ success: true, storage });
    } catch (err: any) {
        const status = err.message.includes("Unauthorized") ? 403 : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * DELETE /api/club/workspace/files/:fileId
 * Securely deletes an asset from Cloudinary and cleans database records.
 */
workspaceRouter.delete("/files/:fileId", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        await WorkspaceFileService.deleteFile(workspace.id, authUser.id, String(req.params.fileId));
        return res.json({ success: true, message: "File successfully deleted from workspace." });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * PATCH /api/club/workspace/files/:fileId/rename
 * Renames an existing file/asset.
 */
workspaceRouter.patch("/files/:fileId/rename", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const { newFileName } = req.body;
        if (!newFileName || typeof newFileName !== "string") {
            return res.status(400).json({ success: false, message: "newFileName is required." });
        }

        const file = await WorkspaceFileService.renameFile(
            workspace.id,
            authUser.id,
            String(req.params.fileId),
            newFileName
        );
        return res.json({ success: true, file });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

/**
 * POST /api/club/workspace/files/:fileId/replace
 * Replaces an existing file's binary content in Cloudinary.
 */
workspaceRouter.post(
    "/files/:fileId/replace",
    authenticate,
    fileUpload.single("file"),
    async (req: Request, res: Response) => {
        try {
            const clubId = await resolveClubId(req, res);
            if (!clubId) return;

            const authUser = (req as any).user;
            const workspace = await WorkspaceRepository.findByClubId(clubId);
            if (!workspace) {
                return res.status(404).json({ success: false, message: "Workspace not found." });
            }

            if (!req.file) {
                return res.status(400).json({ success: false, message: "No replacement file provided in form-data ('file')." });
            }

            const file = await WorkspaceFileService.replaceFile(
                workspace.id,
                authUser.id,
                String(req.params.fileId),
                req.file.buffer,
                {
                    originalFilename: req.file.originalname,
                    mimeType: req.file.mimetype,
                }
            );

            return res.json({ success: true, file });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
                ? 403
                : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/club/workspace/files/:fileId/share-url
 * Generates an authorized signed share link with customizable expiry.
 */
workspaceRouter.get("/files/:fileId/share-url", authenticate, async (req: Request, res: Response) => {
    try {
        const clubId = await resolveClubId(req, res);
        if (!clubId) return;

        const authUser = (req as any).user;
        const workspace = await WorkspaceRepository.findByClubId(clubId);
        if (!workspace) {
            return res.status(404).json({ success: false, message: "Workspace not found." });
        }

        const expiresIn = req.query.expiresIn ? parseInt(req.query.expiresIn as string, 10) : 86400;

        const result = await WorkspaceFileService.generateShareUrl(
            workspace.id,
            authUser.id,
            String(req.params.fileId),
            expiresIn
        );

        return res.json({ success: true, ...result });
    } catch (err: any) {
        const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized")
            ? 403
            : 400;
        return res.status(status).json({ success: false, message: err.message });
    }
});

// =========================================================================
// PHASE 07: NOTIFICATIONS, PREFERENCES & RESEND WEBHOOK
// =========================================================================

/**
 * POST /api/club/workspace/webhooks/resend
 * Public Resend webhook receiver (signed payload verification)
 */
workspaceRouter.post("/webhooks/resend", WorkspaceNotificationController.handleResendWebhook);

/**
 * GET /api/club/workspace/notifications
 */
workspaceRouter.get("/notifications", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceNotificationController.listNotifications(req, res);
});

/**
 * PATCH /api/club/workspace/notifications/:notificationId/read
 */
workspaceRouter.patch("/notifications/:notificationId/read", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceNotificationController.markAsRead(req, res);
});

/**
 * POST /api/club/workspace/notifications/read-all
 */
workspaceRouter.post("/notifications/read-all", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceNotificationController.markAllAsRead(req, res);
});

/**
 * GET /api/club/workspace/notifications/preferences
 */
workspaceRouter.get("/notifications/preferences", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceNotificationController.getPreferences(req, res);
});

/**
 * PUT /api/club/workspace/notifications/preferences
 */
workspaceRouter.put("/notifications/preferences", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceNotificationController.updatePreferences(req, res);
});

/**
 * Parameterized workspace routes
 */
workspaceRouter.get("/:workspaceId/notifications", authenticate, WorkspaceNotificationController.listNotifications);
workspaceRouter.patch("/:workspaceId/notifications/:notificationId/read", authenticate, WorkspaceNotificationController.markAsRead);
workspaceRouter.post("/:workspaceId/notifications/read-all", authenticate, WorkspaceNotificationController.markAllAsRead);
workspaceRouter.get("/:workspaceId/notifications/preferences", authenticate, WorkspaceNotificationController.getPreferences);
workspaceRouter.put("/:workspaceId/notifications/preferences", authenticate, WorkspaceNotificationController.updatePreferences);

// =========================================================================
// PHASE 08: WORKSPACE DASHBOARD, ACTIVITY, AUDIT & SEARCH
// =========================================================================

/**
 * GET /api/club/workspace/dashboard/overview
 */
workspaceRouter.get("/dashboard/overview", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceDashboardController.getOverview(req, res);
});

/**
 * GET /api/club/workspace/dashboard/departments/:departmentId
 */
workspaceRouter.get("/dashboard/departments/:departmentId", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceDashboardController.getDepartmentInsight(req, res);
});

/**
 * GET /api/club/workspace/activity
 */
workspaceRouter.get("/activity", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceDashboardController.getActivityFeed(req, res);
});

/**
 * GET /api/club/workspace/audit-logs
 */
workspaceRouter.get("/audit-logs", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceDashboardController.getAuditLogs(req, res);
});

/**
 * GET /api/club/workspace/search
 */
workspaceRouter.get("/search", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceDashboardController.search(req, res);
});

/**
 * Parameterized dashboard, activity, audit & search routes
 */
workspaceRouter.get("/:workspaceId/dashboard/overview", authenticate, WorkspaceDashboardController.getOverview);
workspaceRouter.get("/:workspaceId/dashboard/departments/:departmentId", authenticate, WorkspaceDashboardController.getDepartmentInsight);
workspaceRouter.get("/:workspaceId/activity", authenticate, WorkspaceDashboardController.getActivityFeed);
workspaceRouter.get("/:workspaceId/audit-logs", authenticate, WorkspaceDashboardController.getAuditLogs);
workspaceRouter.get("/:workspaceId/search", authenticate, WorkspaceDashboardController.search);

// =========================================================================
// ORBIX RECOGNITION, IMMUTABLE LEDGER & ORBITS ENGINE
// =========================================================================

// Club-resolved recognition routes (e.g. /api/club/workspace/recognition/...)
workspaceRouter.post("/recognition/awards", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.awardOrbits(req, res);
});

workspaceRouter.post("/recognition/awards/:awardId/reverse", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.reverseAward(req, res);
});

workspaceRouter.get("/recognition/policy", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getPolicy(req, res);
});

workspaceRouter.patch("/recognition/policy", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.updatePolicy(req, res);
});

workspaceRouter.get("/recognition/categories", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getCategories(req, res);
});

workspaceRouter.get("/recognition/history", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getHistory(req, res);
});

workspaceRouter.get("/recognition/summary", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getSummary(req, res);
});

workspaceRouter.post("/recognition/budget", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.allocateBudget(req, res);
});

workspaceRouter.get("/recognition/budgets", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.listBudgets(req, res);
});

workspaceRouter.get("/recognition/analytics", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getAnalytics(req, res);
});

workspaceRouter.patch("/recognition/categories/:categoryId", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.updateCategory(req, res);
});

workspaceRouter.get("/recognition/awards/:awardId", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getAwardById(req, res);
});

workspaceRouter.get("/recognition/departments/:departmentId", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getDepartmentRecognition(req, res);
});

workspaceRouter.get("/recognition/members/:userId/profile", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getMemberProfile(req, res);
});

workspaceRouter.post("/recognition/awards/:awardId/notes", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.addAppreciationNote(req, res);
});

workspaceRouter.get("/recognition/awards/:awardId/notes", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getAwardNotes(req, res);
});

workspaceRouter.get("/recognition/leaderboards", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getLeaderboards(req, res);
});

workspaceRouter.get("/recognition/analytics/comprehensive", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getComprehensiveAnalytics(req, res);
});

workspaceRouter.get("/recognition/analytics/members/:userId", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getIndividualAnalytics(req, res);
});

// Phase 07: Redis Leaderboard projections & Reconciliation routes (club query-based)
workspaceRouter.get("/recognition/leaderboards/redis/top", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getRedisTopRankings(req, res);
});

workspaceRouter.get("/recognition/leaderboards/redis/nearby", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.getRedisNearbyRankings(req, res);
});

workspaceRouter.post("/recognition/leaderboards/rebuild", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.rebuildLeaderboards(req, res);
});

workspaceRouter.post("/recognition/leaderboards/reconcile", authenticate, async (req: Request, res: Response) => {
    const clubId = await resolveClubId(req, res);
    if (!clubId) return;
    const workspace = await WorkspaceRepository.findByClubId(clubId);
    if (!workspace) return res.status(404).json({ success: false, message: "Workspace not found." });
    req.params.workspaceId = workspace.id;
    return WorkspaceRecognitionController.reconcileLeaderboards(req, res);
});

// Parameterized workspace recognition routes (e.g. /api/team-workspaces/:workspaceId/recognition/...)
workspaceRouter.post("/:workspaceId/recognition/awards", authenticate, WorkspaceRecognitionController.awardOrbits);
workspaceRouter.post("/:workspaceId/recognition/awards/:awardId/reverse", authenticate, WorkspaceRecognitionController.reverseAward);
workspaceRouter.get("/:workspaceId/recognition/awards/:awardId", authenticate, WorkspaceRecognitionController.getAwardById);
workspaceRouter.get("/:workspaceId/recognition/departments/:departmentId", authenticate, WorkspaceRecognitionController.getDepartmentRecognition);
workspaceRouter.get("/:workspaceId/recognition/members/:userId/profile", authenticate, WorkspaceRecognitionController.getMemberProfile);
workspaceRouter.post("/:workspaceId/recognition/awards/:awardId/notes", authenticate, WorkspaceRecognitionController.addAppreciationNote);
workspaceRouter.get("/:workspaceId/recognition/awards/:awardId/notes", authenticate, WorkspaceRecognitionController.getAwardNotes);
workspaceRouter.get("/:workspaceId/recognition/leaderboards", authenticate, WorkspaceRecognitionController.getLeaderboards);
workspaceRouter.get("/:workspaceId/recognition/leaderboards/redis/top", authenticate, WorkspaceRecognitionController.getRedisTopRankings);
workspaceRouter.get("/:workspaceId/recognition/leaderboards/redis/nearby", authenticate, WorkspaceRecognitionController.getRedisNearbyRankings);
workspaceRouter.post("/:workspaceId/recognition/leaderboards/rebuild", authenticate, WorkspaceRecognitionController.rebuildLeaderboards);
workspaceRouter.post("/:workspaceId/recognition/leaderboards/reconcile", authenticate, WorkspaceRecognitionController.reconcileLeaderboards);
workspaceRouter.get("/:workspaceId/recognition/policy", authenticate, WorkspaceRecognitionController.getPolicy);
workspaceRouter.patch("/:workspaceId/recognition/policy", authenticate, WorkspaceRecognitionController.updatePolicy);
workspaceRouter.get("/:workspaceId/recognition/categories", authenticate, WorkspaceRecognitionController.getCategories);
workspaceRouter.patch("/:workspaceId/recognition/categories/:categoryId", authenticate, WorkspaceRecognitionController.updateCategory);
workspaceRouter.get("/:workspaceId/recognition/history", authenticate, WorkspaceRecognitionController.getHistory);
workspaceRouter.get("/:workspaceId/recognition/summary", authenticate, WorkspaceRecognitionController.getSummary);
workspaceRouter.post("/:workspaceId/recognition/budget", authenticate, WorkspaceRecognitionController.allocateBudget);
workspaceRouter.get("/:workspaceId/recognition/budgets", authenticate, WorkspaceRecognitionController.listBudgets);
workspaceRouter.get("/:workspaceId/recognition/analytics", authenticate, WorkspaceRecognitionController.getAnalytics);
workspaceRouter.get("/:workspaceId/recognition/analytics/comprehensive", authenticate, WorkspaceRecognitionController.getComprehensiveAnalytics);
workspaceRouter.get("/:workspaceId/recognition/analytics/members/:userId", authenticate, WorkspaceRecognitionController.getIndividualAnalytics);





