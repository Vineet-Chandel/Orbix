// Backend/src/controllers/workspace/workspaceDashboardController.ts
import type { Request, Response } from "express";
import { WorkspaceDashboardService } from "../../services/workspace/workspaceDashboardService.js";

export class WorkspaceDashboardController {
    /**
     * GET /api/club/workspace/:workspaceId/dashboard/overview
     * Retrieves workspace overview metrics with permission filtering.
     */
    static async getOverview(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const metrics = await WorkspaceDashboardService.getWorkspaceOverview(workspaceId, authUser.id);

            return res.status(200).json({
                success: true,
                data: metrics,
            });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 401 : err.message.includes("Forbidden") ? 403 : 500;
            return res.status(status).json({ success: false, message: err.message || "Failed to load overview." });
        }
    }

    /**
     * GET /api/club/workspace/:workspaceId/dashboard/departments/:departmentId
     * Retrieves department statistics and submission progress.
     */
    static async getDepartmentInsight(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const departmentId = String(req.params.departmentId);
            const insight = await WorkspaceDashboardService.getDepartmentInsight(workspaceId, authUser.id, departmentId);

            return res.status(200).json({
                success: true,
                data: insight,
            });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") ? 403 : err.message.includes("not found") ? 404 : 500;
            return res.status(status).json({ success: false, message: err.message || "Failed to load department insight." });
        }
    }

    /**
     * GET /api/club/workspace/:workspaceId/activity
     * Retrieves chronological activity feed with filtering.
     */
    static async getActivityFeed(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 25;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const opts: Record<string, any> = { limit, offset };
            if (req.query.departmentId) opts.departmentId = String(req.query.departmentId);
            if (req.query.actorId) opts.actorId = String(req.query.actorId);
            if (req.query.eventType) opts.eventType = String(req.query.eventType);

            const result = await WorkspaceDashboardService.getActivityFeed(workspaceId, authUser.id, opts);

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") ? 403 : 500;
            return res.status(status).json({ success: false, message: err.message || "Failed to load activity feed." });
        }
    }

    /**
     * GET /api/club/workspace/:workspaceId/audit-logs
     * Retrieves administrative audit trail (strictly append-only).
     */
    static async getAuditLogs(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const opts: Record<string, any> = { limit, offset };
            if (req.query.actorId) opts.actorId = String(req.query.actorId);
            if (req.query.action) opts.action = String(req.query.action);
            if (req.query.targetType) opts.targetType = String(req.query.targetType);

            const result = await WorkspaceDashboardService.getAuditLogs(workspaceId, authUser.id, opts);

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") ? 403 : 500;
            return res.status(status).json({ success: false, message: err.message || "Failed to load audit logs." });
        }
    }

    /**
     * GET /api/club/workspace/:workspaceId/search
     * Unified, permission-filtered workspace search.
     */
    static async search(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const queryText = req.query.q ? String(req.query.q) : "";
            const type = req.query.type ? (String(req.query.type) as any) : "all";
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const opts: Record<string, any> = { limit, offset, type };
            if (req.query.departmentId) opts.departmentId = String(req.query.departmentId);

            const result = await WorkspaceDashboardService.searchWorkspace(workspaceId, authUser.id, queryText, opts);

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (err: any) {
            return res.status(500).json({ success: false, message: err.message || "Failed to search workspace." });
        }
    }
}
