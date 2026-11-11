// Backend/src/controllers/workspace/workspaceRecognitionController.ts
import type { Request, Response } from "express";
import { WorkspaceRecognitionService } from "../../services/workspace/workspaceRecognitionService.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";

export class WorkspaceRecognitionController {
    /**
     * Helper to resolve workspaceId from params or club query
     */
    private static async resolveWorkspaceId(req: Request): Promise<string> {
        let wsId = req.params.workspaceId;
        if (!wsId || wsId.length < 10) {
            const clubId = (req.query.clubId as string) || (req.body?.clubId as string);
            if (clubId) {
                const ws = await WorkspaceRepository.findByClubId(clubId);
                if (ws) wsId = ws.id;
            }
        }
        if (!wsId) {
            throw new Error("Target workspace could not be determined.");
        }
        return wsId;
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
                { ipAddress, userAgent }
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

            const awardId = req.params.awardId;
            if (!awardId) {
                return res.status(400).json({ success: false, message: "Award ID parameter is required." });
            }

            const ipAddress = req.ip || req.socket.remoteAddress || undefined;
            const userAgent = req.headers["user-agent"] || undefined;

            const result = await WorkspaceRecognitionService.reverseAward(
                workspaceId,
                authUser.id,
                awardId,
                req.body,
                { ipAddress, userAgent }
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
                limit: limit ? parseInt(limit as string, 10) : undefined,
                offset: offset ? parseInt(offset as string, 10) : undefined,
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
            const workspaceId = await WorkspaceRecognitionController.resolveWorkspaceId(req);
            const authUser = (req as any).user;
            const targetUserId = (req.query.userId as string) || authUser.id;

            const summary = await WorkspaceRecognitionService.getMyRecognitionSummary(workspaceId, targetUserId);
            return res.json({ success: true, summary });
        } catch (err: any) {
            return res.status(400).json({ success: false, message: err.message });
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
            const categoryId = req.params.categoryId;

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
            const awardId = req.params.awardId;

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
            const departmentId = req.params.departmentId;

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
            const targetUserId = req.params.userId;

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
            const awardId = req.params.awardId;
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
            const awardId = req.params.awardId;

            const notes = await WorkspaceRecognitionService.getAwardNotes(workspaceId, authUser.id, awardId);
            return res.json({ success: true, notes });
        } catch (err: any) {
            const status = err.message.includes("Access denied") ? 403 : 400;
            return res.status(status).json({ success: false, message: err.message });
        }
    }
}
