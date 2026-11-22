// Backend/src/controllers/workspace/workspaceRecognitionController.ts
import type { Request, Response } from "express";
import { WorkspaceRecognitionService } from "../../services/workspace/workspaceRecognitionService.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";

function requiredParam(req: Request, name: string): string {
    const value = req.params[name];
    if (typeof value !== "string" || !value) throw new Error(`Missing ${name} parameter.`);
    return value;
}

export class WorkspaceRecognitionController {
    /**
     * Helper to resolve workspaceId from params or club query
     */
    private static async resolveWorkspaceId(req: Request): Promise<string> {
        const workspaceId = req.params.workspaceId;
        if (typeof workspaceId === "string" && workspaceId.length >= 10) return workspaceId;

        const clubId = req.query.clubId || req.body?.clubId;
        if (typeof clubId === "string" && clubId) {
            const workspace = await WorkspaceRepository.findByClubId(clubId);
            if (workspace) return workspace.id;
        }
        throw new Error("Target workspace could not be determined.");
    }

    /**
     * POST /recognition/awards
     */
    static async awardOrbits(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            if (!authUser || !authUser.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const ipAddress = req.ip || req.socket.remoteAddress || undefined;
            const userAgent = req.headers["user-agent"] || undefined;

            const award = await WorkspaceRecognitionService.awardOrbits(
                workspaceId,
                authUser.id,
                req.body,
                { ...(ipAddress && { ipAddress }), ...(userAgent && { userAgent }) }
            );

            return res.status(201).json({
                success: true,
                message: `Successfully awarded +${award.pointsDelta} Orbits!`,
                award,
            });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") || err.message.includes("restriction") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * POST /recognition/awards/:awardId/reverse
     */
    static async reverseAward(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            if (!authUser || !authUser.id) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }

            const awardId = requiredParam(req, "awardId");

            const ipAddress = req.ip || req.socket.remoteAddress || undefined;
            const userAgent = req.headers["user-agent"] || undefined;

            const result = await WorkspaceRecognitionService.reverseAward(
                workspaceId,
                authUser.id,
                awardId,
                req.body,
                { ...(ipAddress && { ipAddress }), ...(userAgent && { userAgent }) }
            );

            return res.json({
                success: true,
                message: "Recognition award reversed successfully.",
                reversal: result.reversalEntry,
                original: result.originalEntry,
            });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") || err.message.includes("authority") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/policy
     */
    static async getPolicy(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const policy = await WorkspaceRecognitionService.getPolicy(workspaceId, authUser.id);
            return res.json({ success: true, policy });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    /**
     * PATCH /recognition/policy
     */
    static async updatePolicy(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const policy = await WorkspaceRecognitionService.updatePolicy(workspaceId, authUser.id, req.body);
            return res.json({ success: true, policy, message: "Recognition policy updated successfully." });
        } catch (err: any) {
            const status = err.message.includes("Only the Club Owner") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/categories
     */
    static async getCategories(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const categories = await WorkspaceRecognitionService.getCategories(workspaceId, authUser.id);
            return res.json({ success: true, categories });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/history
     */
    static async getHistory(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const { recipientId, issuerId, departmentId, categoryId, limit, offset } = req.query;

            const result = await WorkspaceRecognitionService.getLedgerHistory(workspaceId, authUser.id, {
                recipientId: recipientId as string,
                issuerId: issuerId as string,
                departmentId: departmentId as string,
                categoryId: categoryId as string,
                ...(typeof limit === "string" && { limit: parseInt(limit, 10) }),
                ...(typeof offset === "string" && { offset: parseInt(offset, 10) }),
            });

            return res.json({ success: true, ...result });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/summary
     */
    static async getSummary(req: Request, res: Response) {
        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, message: "Authentication required." });
            }
            if (req.query.userId !== undefined && req.query.userId !== userId) {
                return res.status(403).json({ success: false, message: "This summary is available to its owner." });
            }

            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const summary = await WorkspaceRecognitionService.getMyRecognitionSummary(workspaceId, userId);
            return res.json({ success: true, summary });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * POST /recognition/budget
     */
    static async allocateBudget(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const { managerUserId, allocatedBudget, yearMonth } = req.body;

            const budget = await WorkspaceRecognitionService.allocateManagerBudget(
                workspaceId,
                authUser.id,
                managerUserId,
                allocatedBudget,
                yearMonth
            );

            return res.json({ success: true, budget, message: "Manager award budget updated successfully." });
        } catch (err: any) {
            const status = err.message.includes("Only the Club Owner") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/budgets
     */
    static async listBudgets(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const yearMonth = req.query.yearMonth as string | undefined;

            const budgets = await WorkspaceRecognitionService.listBudgets(workspaceId, authUser.id, yearMonth);
            return res.json({ success: true, budgets });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/analytics
     */
    static async getAnalytics(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;

            const analytics = await WorkspaceRecognitionService.getAnalytics(workspaceId, authUser.id);
            return res.json({ success: true, analytics });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
        }
    }

    /**
     * PATCH /recognition/categories/:categoryId
     */
    static async updateCategory(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const categoryId = requiredParam(req, "categoryId");

            const category = await WorkspaceRecognitionService.updateCategory(
                workspaceId,
                authUser.id,
                categoryId,
                req.body
            );
            return res.json({ success: true, category, message: "Recognition category updated successfully." });
        } catch (err: any) {
            const status = err.message.includes("Only the Club Owner") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/awards/:awardId
     */
    static async getAwardById(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const awardId = requiredParam(req, "awardId");

            const award = await WorkspaceRecognitionService.getAwardById(workspaceId, authUser.id, awardId);
            return res.json({ success: true, award });
        } catch (err: any) {
            const status = err.message.includes("Access denied") ? 403 : err.message.includes("not found") ? 404 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/departments/:departmentId
     */
    static async getDepartmentRecognition(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const departmentId = requiredParam(req, "departmentId");

            const summary = await WorkspaceRecognitionService.getDepartmentRecognition(
                workspaceId,
                authUser.id,
                departmentId
            );
            return res.json({ success: true, department: summary });
        } catch (err: any) {
            const status = err.message.includes("Access denied") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/members/:userId/profile
     */
    static async getMemberProfile(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const targetUserId = requiredParam(req, "userId");

            const profile = await WorkspaceRecognitionService.getMemberRecognitionProfile(
                workspaceId,
                authUser.id,
                targetUserId
            );
            return res.json({ success: true, profile });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * POST /recognition/awards/:awardId/notes
     */
    static async addAppreciationNote(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const awardId = requiredParam(req, "awardId");
            const { note } = req.body;

            const noteRecord = await WorkspaceRecognitionService.addAppreciationNote(
                workspaceId,
                authUser.id,
                awardId,
                note
            );
            return res.status(201).json({
                success: true,
                message: "Appreciation note added successfully.",
                note: noteRecord,
            });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/awards/:awardId/notes
     */
    static async getAwardNotes(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const awardId = requiredParam(req, "awardId");

            const notes = await WorkspaceRecognitionService.getAwardNotes(workspaceId, authUser.id, awardId);
            return res.json({ success: true, notes });
        } catch (err: any) {
            const status = err.message.includes("Access denied") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/leaderboards
     * Query:
     *   period?: "this_week" | "this_month" | "all_time" | "last_30_days" | "last_90_days"
     *   departmentId?: string
     */
    static async getLeaderboards(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const period = (req.query.period as any) || "this_month";
            const departmentId = (req.query.departmentId as string) || undefined;

            const leaderboards = await WorkspaceRecognitionService.getThreeLeaderboards(
                workspaceId,
                authUser.id,
                { period, ...(departmentId && { departmentId }) }
            );

            return res.json({ success: true, leaderboards });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/analytics/comprehensive
     * Query:
     *   period?: "this_week" | "this_month" | "all_time" | "last_30_days" | "last_90_days"
     *   departmentId?: string
     */
    static async getComprehensiveAnalytics(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const period = (req.query.period as any) || "this_month";
            const departmentId = (req.query.departmentId as string) || undefined;

            const analytics = await WorkspaceRecognitionService.getComprehensiveAnalytics(
                workspaceId,
                authUser.id,
                { period, ...(departmentId && { departmentId }) }
            );

            return res.json({ success: true, analytics });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/analytics/members/:userId
     * Query:
     *   period?: "this_week" | "this_month" | "all_time" | "last_30_days" | "last_90_days"
     */
    static async getIndividualAnalytics(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const targetUserId = requiredParam(req, "userId");
            const period = (req.query.period as any) || "this_month";

            const analytics = await WorkspaceRecognitionService.getIndividualMemberAnalytics(
                workspaceId,
                authUser.id,
                targetUserId,
                { period }
            );

            return res.json({ success: true, analytics });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/leaderboards/redis/top
     * Query:
     *   boardType: "contributors" | "leaders" | "departments"
     *   period?: "this_week" | "this_month" | "all_time" | "last_30_days" | "last_90_days"
     *   limit?: number (max 100)
     *   offset?: number
     *   departmentId?: string
     */
    static async getRedisTopRankings(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const boardType = (req.query.boardType as any) || "contributors";
            const period = (req.query.period as any) || "this_month";
            const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
            const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;
            const departmentId = (req.query.departmentId as string) || undefined;

            const result = await WorkspaceRecognitionService.getRedisTopRankings(
                workspaceId,
                authUser.id,
                { boardType, period, limit, offset, ...(departmentId && { departmentId }) }
            );

            return res.json({ success: true, ...result });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * GET /recognition/leaderboards/redis/nearby
     * Query:
     *   boardType?: "contributors" | "leaders" | "departments"
     *   period?: "this_week" | "this_month" | "all_time" | "last_30_days" | "last_90_days"
     *   userId?: string (defaults to authUser.id)
     *   radius?: number (default 2)
     *   departmentId?: string
     */
    static async getRedisNearbyRankings(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const boardType = (req.query.boardType as any) || "contributors";
            const period = (req.query.period as any) || "this_month";
            const targetUserId = (req.query.userId as string) || authUser.id;
            const radius = req.query.radius ? parseInt(req.query.radius as string, 10) : 2;
            const departmentId = (req.query.departmentId as string) || undefined;

            const result = await WorkspaceRecognitionService.getRedisNearbyRankings(
                workspaceId,
                authUser.id,
                { boardType, period, targetUserId, radius, ...(departmentId && { departmentId }) }
            );

            return res.json({ success: true, ...result });
        } catch (err: any) {
            const status = err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * POST /recognition/leaderboards/rebuild
     * Body:
     *   period?: "this_week" | "this_month" | "all_time"
     */
    static async rebuildLeaderboards(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const period = (req.body?.period as any) || "this_month";

            const result = await WorkspaceRecognitionService.rebuildWorkspaceLeaderboards(
                workspaceId,
                authUser.id,
                period
            );

            return res.json({
                message: "Successfully rebuilt Redis leaderboards from PostgreSQL source of truth.",
                ...result,
            });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }

    /**
     * POST /recognition/leaderboards/reconcile
     * Body:
     *   period?: "this_week" | "this_month" | "all_time"
     */
    static async reconcileLeaderboards(req: Request, res: Response) {
        try {
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const period = (req.body?.period as any) || "this_month";

            const result = await WorkspaceRecognitionService.reconcileLeaderboards(
                workspaceId,
                authUser.id,
                period
            );

            return res.json({
                message: result.matched
                    ? "Leaderboards are perfectly synchronized between Redis and PostgreSQL."
                    : `Reconciled ${result.correctedCount} discrepancies.`,
                ...result,
            });
        } catch (err: any) {
            const status = err.message.includes("Forbidden") || err.message.includes("Unauthorized") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }
}
