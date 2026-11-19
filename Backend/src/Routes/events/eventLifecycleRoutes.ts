import { Router, type Request, type Response } from "express";
import { authenticate, optionalAuthenticate, requireClubAccount } from "../../middlewares/auth.middleware.js";
import { query } from "../../database/client.js";
import { EventStageService } from "../../services/events/eventStageService.js";
import { EventSubmissionService } from "../../services/events/eventSubmissionService.js";
import { EventEvaluationService } from "../../services/events/eventEvaluationService.js";

export const eventLifecycleRouter = Router();

// ============================================================================
// 1. ORGANIZER STAGE & TIMELINE MANAGEMENT ROUTES
// ============================================================================

/**
 * GET /api/club/events/:eventId/stages
 * List all configured stages with submission & evaluation counts
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stages = await EventStageService.getEventStages(eventId);
            res.json({ success: true, stages });
        } catch (err: any) {
            console.error("GET /club/events/:eventId/stages error:", err);
            res.status(500).json({ success: false, message: err.message || "Failed to fetch event stages" });
        }
    }
);

/**
 * POST /api/club/events/:eventId/stages/batch
 * Batch create or sync stages from the wizard
 */
eventLifecycleRouter.post(
    "/club/events/:eventId/stages/batch",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const clubId = String((req as any).club?.id);
            const { stages } = req.body;

            if (!Array.isArray(stages)) {
                return res.status(400).json({ success: false, message: "stages array is required" });
            }

            const created = await EventStageService.createStagesBatch(eventId, clubId, stages);
            res.json({ success: true, stages: created });
        } catch (err: any) {
            console.error("POST /club/events/:eventId/stages/batch error:", err);
            res.status(500).json({ success: false, message: err.message || "Failed to create stages" });
        }
    }
);

/**
 * PATCH /api/club/events/:eventId/stages/:stageId
 * Update an individual stage
 */
eventLifecycleRouter.patch(
    "/club/events/:eventId/stages/:stageId",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const actorId = String((req as any).user?.id);
            const stage = await EventStageService.updateStage(stageId, eventId, actorId, req.body);
            res.json({ success: true, stage });
        } catch (err: any) {
            console.error("PATCH /club/events/:eventId/stages/:stageId error:", err);
            res.status(500).json({ success: false, message: err.message || "Failed to update stage" });
        }
    }
);

/**
 * DELETE /api/club/events/:eventId/stages/:stageId
 * Delete a stage
 */
eventLifecycleRouter.delete(
    "/club/events/:eventId/stages/:stageId",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const actorId = String((req as any).user?.id);
            await EventStageService.deleteStage(stageId, eventId, actorId);
            res.json({ success: true, message: "Stage deleted successfully" });
        } catch (err: any) {
            console.error("DELETE /club/events/:eventId/stages/:stageId error:", err);
            res.status(400).json({ success: false, message: err.message || "Failed to delete stage" });
        }
    }
);

/**
 * POST /api/club/events/:eventId/stages/reorder
 * Reorder stages
 */
eventLifecycleRouter.post(
    "/club/events/:eventId/stages/reorder",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const { stageOrders } = req.body;
            await EventStageService.reorderStages(eventId, stageOrders);
            res.json({ success: true, message: "Stages reordered successfully" });
        } catch (err: any) {
            console.error("POST /club/events/:eventId/stages/reorder error:", err);
            res.status(500).json({ success: false, message: err.message || "Failed to reorder stages" });
        }
    }
);

/**
 * POST /api/club/events/:eventId/stages/:stageId/override
 * Manual stage override: pause, resume, extend, close, reopen
 */
eventLifecycleRouter.post(
    "/club/events/:eventId/stages/:stageId/override",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const actorId = String((req as any).user?.id);
            const { action, newEndsAt, note } = req.body;

            const stage = await EventStageService.manualOverride(stageId, eventId, actorId, action, {
                newEndsAt,
                note,
            });
            res.json({ success: true, stage });
        } catch (err: any) {
            console.error("POST /club/events/:eventId/stages/:stageId/override error:", err);
            res.status(400).json({ success: false, message: err.message || "Failed to execute stage override" });
        }
    }
);

// ============================================================================
// 2. STAGE FORMS & SUBMISSIONS MANAGEMENT (ORGANIZER)
// ============================================================================

/**
 * GET /api/club/events/:eventId/stages/:stageId/form
 * Get stage submission form
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages/:stageId/form",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const stageId = String(req.params.stageId);
            const form = await EventSubmissionService.getStageForm(stageId);
            res.json({ success: true, form });
        } catch (err: any) {
            console.error("GET stage form error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * PUT /api/club/events/:eventId/stages/:stageId/form
 * Save dynamic submission form for stage
 */
eventLifecycleRouter.put(
    "/club/events/:eventId/stages/:stageId/form",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const form = await EventSubmissionService.saveStageForm(stageId, eventId, req.body);
            res.json({ success: true, form });
        } catch (err: any) {
            console.error("PUT stage form error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/club/events/:eventId/stages/:stageId/submissions
 * Get all participant submissions for a stage
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages/:stageId/submissions",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const submissions = await EventSubmissionService.getStageSubmissions(stageId, eventId);
            res.json({ success: true, submissions });
        } catch (err: any) {
            console.error("GET stage submissions error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// ============================================================================
// 3. EVALUATION, RUBRICS & SHORTLISTING (ORGANIZER & JUDGES)
// ============================================================================

/**
 * GET /api/club/events/:eventId/stages/:stageId/criteria
 * Get rubric criteria
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages/:stageId/criteria",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const stageId = String(req.params.stageId);
            const criteria = await EventEvaluationService.getJudgingCriteria(stageId);
            res.json({ success: true, criteria });
        } catch (err: any) {
            console.error("GET judging criteria error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * PUT /api/club/events/:eventId/stages/:stageId/criteria
 * Save rubric criteria
 */
eventLifecycleRouter.put(
    "/club/events/:eventId/stages/:stageId/criteria",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const { criteria } = req.body;
            const saved = await EventEvaluationService.saveJudgingCriteria(stageId, eventId, criteria || []);
            res.json({ success: true, criteria: saved });
        } catch (err: any) {
            console.error("PUT judging criteria error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/club/events/:eventId/stages/:stageId/judges
 * Get assigned judges
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages/:stageId/judges",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const stageId = String(req.params.stageId);
            const judges = await EventEvaluationService.getAssignedJudges(stageId);
            res.json({ success: true, judges });
        } catch (err: any) {
            console.error("GET judges error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/club/events/:eventId/stages/:stageId/judges
 * Assign judges
 */
eventLifecycleRouter.post(
    "/club/events/:eventId/stages/:stageId/judges",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const { judges } = req.body;
            const assigned = await EventEvaluationService.assignJudges(stageId, eventId, judges || []);
            res.json({ success: true, judges: assigned });
        } catch (err: any) {
            console.error("POST judges error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/club/events/:eventId/stages/:stageId/shortlist
 * Shortlist candidates and advance to target stage
 */
eventLifecycleRouter.post(
    "/club/events/:eventId/stages/:stageId/shortlist",
    authenticate,
    requireClubAccount,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const { toStageId, advancements } = req.body;
            const results = await EventEvaluationService.shortlistAndAdvance(
                eventId,
                stageId,
                String(toStageId),
                advancements || []
            );
            res.json({ success: true, advancements: results });
        } catch (err: any) {
            console.error("POST shortlist error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * GET /api/club/events/:eventId/stages/:stageId/advancements
 * Get shortlisted candidates for a stage
 */
eventLifecycleRouter.get(
    "/club/events/:eventId/stages/:stageId/advancements",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const stageId = String(req.params.stageId);
            const advancements = await EventEvaluationService.getStageAdvancements(stageId);
            res.json({ success: true, advancements });
        } catch (err: any) {
            console.error("GET advancements error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

// ============================================================================
// 4. PARTICIPANT-FACING ROUTES
// ============================================================================

/**
 * GET /api/events/:eventId/timeline
 * Get public event stages timeline
 */
eventLifecycleRouter.get("/events/:eventId/timeline", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const stages = await EventStageService.getEventStages(eventId);
        res.json({ success: true, stages });
    } catch (err: any) {
        console.error("GET /events/:eventId/timeline error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * GET /api/events/:eventId/stages/:stageId/my-submission
 * Get participant's submission for this stage
 */
eventLifecycleRouter.get(
    "/events/:eventId/stages/:stageId/my-submission",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const userId = String((req as any).user?.id);

            // Find participant's registration for this event
            const regRes = await query(
                `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
                [eventId, userId]
            );
            if (regRes.rows.length === 0) {
                return res.json({ success: true, submission: null, registration: null });
            }

            const registrationId = regRes.rows[0].id;
            const submission = await EventSubmissionService.getParticipantSubmission(stageId, registrationId);
            res.json({ success: true, submission, registrationId });
        } catch (err: any) {
            console.error("GET my-submission error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/events/:eventId/stages/:stageId/upload-signature
 * Request signed Cloudinary upload params for a stage deliverable
 */
eventLifecycleRouter.post(
    "/events/:eventId/stages/:stageId/upload-signature",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const userId = String((req as any).user?.id);
            const { filename, format } = req.body;

            const sigData = await EventSubmissionService.requestUploadSignature(
                eventId,
                stageId,
                userId,
                filename || "file",
                format || "raw"
            );
            res.json({ success: true, ...sigData });
        } catch (err: any) {
            console.error("POST upload-signature error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);

/**
 * POST /api/events/:eventId/stages/:stageId/submit
 * Submit participant deliverables for a stage
 */
eventLifecycleRouter.post(
    "/events/:eventId/stages/:stageId/submit",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const eventId = String(req.params.eventId);
            const stageId = String(req.params.stageId);
            const userId = String((req as any).user?.id);
            const { registrationId, teamId, title, description, answers, githubUrl, liveUrl, videoUrl, status, assets } =
                req.body;

            // If registrationId wasn't passed, look it up from user + event
            let finalRegId = registrationId;
            if (!finalRegId) {
                const regRes = await query(
                    `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
                    [eventId, userId]
                );
                if (regRes.rows.length === 0) {
                    return res.status(400).json({ success: false, message: "You are not registered for this event." });
                }
                finalRegId = regRes.rows[0].id;
            }

            const submission = await EventSubmissionService.submitStageDeliverable({
                stageId,
                eventId,
                registrationId: finalRegId,
                userId,
                teamId: teamId || null,
                title,
                description,
                answers,
                githubUrl,
                liveUrl,
                videoUrl,
                status: status || "submitted",
                assets,
            });

            res.json({ success: true, submission });
        } catch (err: any) {
            console.error("POST stage submit error:", err);
            res.status(400).json({ success: false, message: err.message || "Failed to submit stage materials." });
        }
    }
);

// ============================================================================
// 5. JUDGE EVALUATION ROUTES
// ============================================================================

/**
 * POST /api/judging/stages/:stageId/submissions/:submissionId/evaluate
 * Judge submits evaluation
 */
eventLifecycleRouter.post(
    "/judging/stages/:stageId/submissions/:submissionId/evaluate",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const stageId = String(req.params.stageId);
            const submissionId = String(req.params.submissionId);
            const judgeId = String((req as any).user?.id);
            const { scores, feedback, privateNotes } = req.body;

            const evaluation = await EventEvaluationService.submitEvaluation(
                submissionId,
                stageId,
                judgeId,
                scores || {},
                feedback,
                privateNotes
            );

            res.json({ success: true, evaluation });
        } catch (err: any) {
            console.error("POST evaluate error:", err);
            res.status(500).json({ success: false, message: err.message });
        }
    }
);
