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
     * GET /api/club/workspace/history OR /api/club/workspace/:workspaceId/history
     * Unified chronological workspace history (Activity Log + Administrative Audit Trail).
     */
    static async getHistory(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const rawLimit = req.query.limit ? parseInt(String(req.query.limit), 10) : 25;
            const limit = Number.isFinite(rawLimit) ? rawLimit : 25;

            const rawScope = req.query.scope ? String(req.query.scope) : undefined;
            if (rawScope && !["workspace", "department", "personal"].includes(rawScope)) {
                return res.status(400).json({ success: false, message: "Invalid scope parameter." });
            }

            const rawRecordType = req.query.recordType ? String(req.query.recordType) : undefined;
            if (rawRecordType && !["all", "activity", "audit"].includes(rawRecordType)) {
                return res.status(400).json({ success: false, message: "Invalid recordType parameter." });
            }

            const opts: Record<string, any> = { limit };
            if (rawScope) opts.scope = rawScope;
            if (rawRecordType) opts.recordType = rawRecordType;
            if (req.query.category) opts.category = String(req.query.category);
            if (req.query.departmentId) opts.departmentId = String(req.query.departmentId);
            if (req.query.actorId) opts.actorId = String(req.query.actorId);
            if (req.query.targetType) opts.targetType = String(req.query.targetType);
            if (req.query.search) opts.search = String(req.query.search);
            if (req.query.startDate) opts.startDate = String(req.query.startDate);
            if (req.query.endDate) opts.endDate = String(req.query.endDate);
            if (req.query.cursor) opts.cursor = String(req.query.cursor);

            const result = await WorkspaceDashboardService.getWorkspaceHistory(workspaceId, authUser.id, opts);

            return res.status(200).json({
                success: true,
                data: result,
            });
        } catch (err: any) {
            const msg = err.message || "Failed to load workspace history.";
            const status = msg.includes("Unauthorized")
                ? 401
                : msg.includes("Forbidden")
                ? 403
                : msg.includes("Bad Request") || msg.includes("Invalid")
                ? 400
                : 500;
            return res.status(status).json({ success: false, message: msg });
        }
    }

    /**
     * GET /api/club/workspace/history/:itemId/inspect
     * Fetches complete authorized inspection payload for a single history entry.
     */
    static async inspectHistoryItem(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const itemId = String(req.params.itemId);
            const source = req.query.source === "audit" ? "audit" : req.query.source === "activity" ? "activity" : null;
            if (!source) {
                return res.status(400).json({ success: false, message: "Valid source parameter ('activity' | 'audit') is required." });
            }

            const item = await WorkspaceDashboardService.inspectHistoryItem(workspaceId, authUser.id, itemId, source);
            return res.status(200).json({ success: true, data: item });
        } catch (err: any) {
            const msg = err.message || "Failed to inspect history record.";
            const status = msg.includes("Unauthorized")
                ? 401
                : msg.includes("Forbidden")
                ? 403
                : msg.includes("Bad Request") || msg.includes("Invalid")
                ? 400
                : 500;
            return res.status(status).json({ success: false, message: msg });
        }
    }

    /**
     * GET /api/club/workspace/history/export?format=csv|json
     * Streams filtered workspace history export for authorized audit/compliance users.
     */
    static async exportHistory(req: Request, res: Response) {
        try {
            const authUser = (req as any).user;
            if (!authUser?.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const workspaceId = String(req.params.workspaceId);
            const format = req.query.format === "json" ? "json" : req.query.format === "csv" || !req.query.format ? "csv" : null;
            if (!format) {
                return res.status(400).json({ success: false, message: "Export format must be 'csv' or 'json'." });
            }

            const rawScope = req.query.scope ? String(req.query.scope) : undefined;
            if (rawScope && !["workspace", "department", "personal"].includes(rawScope)) {
                return res.status(400).json({ success: false, message: "Invalid scope parameter." });
            }

            const rawRecordType = req.query.recordType ? String(req.query.recordType) : undefined;
            if (rawRecordType && !["all", "activity", "audit"].includes(rawRecordType)) {
                return res.status(400).json({ success: false, message: "Invalid recordType parameter." });
            }

            const opts: Record<string, any> = {};
            if (rawScope) opts.scope = rawScope;
            if (rawRecordType) opts.recordType = rawRecordType;
            if (req.query.category) opts.category = String(req.query.category);
            if (req.query.departmentId) opts.departmentId = String(req.query.departmentId);
            if (req.query.actorId) opts.actorId = String(req.query.actorId);
            if (req.query.targetType) opts.targetType = String(req.query.targetType);
            if (req.query.search) opts.search = String(req.query.search);
            if (req.query.startDate) opts.startDate = String(req.query.startDate);
            if (req.query.endDate) opts.endDate = String(req.query.endDate);

            // Validate authorization & filters BEFORE writing headers so JSON errors return cleanly
            let headersSent = false;
            const safeStamp = new Date().toISOString().slice(0, 10);
            const writeChunk = (chunk: string) => {
                if (!headersSent) {
                    headersSent = true;
                    res.status(200);
                    res.setHeader(
                        "Content-Type",
                        format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8"
                    );
                    res.setHeader(
                        "Content-Disposition",
                        `attachment; filename="workspace-history-${safeStamp}.${format}"`
                    );
                }
                res.write(chunk);
            };

            await WorkspaceDashboardService.exportWorkspaceHistory(workspaceId, authUser.id, format, opts, writeChunk);
            if (!headersSent) {
                return res.status(200).end();
            }
            return res.end();
        } catch (err: any) {
            const msg = err.message || "Failed to export workspace history.";
            if (res.headersSent) {
                return res.end();
            }
            const status = msg.includes("Unauthorized")
                ? 401
                : msg.includes("Forbidden")
                ? 403
                : msg.includes("Bad Request") || msg.includes("Invalid")
                ? 400
                : 500;
            return res.status(status).json({ success: false, message: msg });
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
