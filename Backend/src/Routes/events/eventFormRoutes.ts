import express, { type Request, type Response } from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { ClubEventFormService } from "../../services/club/clubEventFormService.js";
import {
    requireClubFormManagementPermission,
    rateLimitFormSubmissions,
    preventConcurrentSubmissions,
    rateLimitDraftAutosave,
} from "../../middlewares/formSecurity.middleware.js";

export const eventFormRouter = express.Router();

/**
 * ---------------------------------------------------------------------------
 * CLUB WORKSPACE / FORM BUILDER ROUTES (STAFF ONLY)
 * ---------------------------------------------------------------------------
 */

const clubManageAuth = [authenticate, requireClubFormManagementPermission("manage")];
const clubPublishAuth = [authenticate, requireClubFormManagementPermission("publish")];
const clubExportAuth = [authenticate, requireClubFormManagementPermission("export")];

/**
 * GET /api/club/events/:eventId/form
 * Fetch form definition, current draft, published version, and event context
 */
eventFormRouter.get("/club/events/:eventId/form", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const data = await ClubEventFormService.getFormForEvent(eventId, userId);

        return res.status(200).json({
            success: true,
            form: data.form,
            isNew: data.isNew,
            event: data.event,
            club: data.club,
            studentProfile: data.studentProfile,
            userResponse: data.userResponse,
            canSubmit: data.canSubmit,
            isClosed: data.isClosed,
            closedReason: data.closedReason,
            registeredCount: data.registeredCount,
            publishedVersion: data.publishedVersion,
            totalVersions: data.totalVersions,
        });
    } catch (err: any) {
        console.error("GET /api/club/events/:eventId/form error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load event form.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form
 * Initialize or create registration form for an event
 */
eventFormRouter.post("/club/events/:eventId/form", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.saveFormDraft(eventId, userId, req.body);

        return res.status(201).json({
            success: true,
            message: "Registration form initialized successfully!",
            form: savedForm,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to initialize registration form.",
        });
    }
});

/**
 * PUT /api/club/events/:eventId/form/draft
 * PUT /api/club/events/:eventId/form
 * Save or update form draft with Optimistic Concurrency Control
 */
const handleSaveDraft = async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.saveFormDraft(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: "Registration form draft saved successfully!",
            form: savedForm,
        });
    } catch (err: any) {
        console.error("Save form draft error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            code: err.code,
            message: err.message || "Failed to save registration form draft.",
        });
    }
};

eventFormRouter.put("/club/events/:eventId/form/draft", ...clubManageAuth, handleSaveDraft);
eventFormRouter.put("/club/events/:eventId/form", ...clubManageAuth, handleSaveDraft);

/**
 * PATCH /api/club/events/:eventId/form/draft/autosave
 * Autosave draft without triggering heavy validation
 */
eventFormRouter.patch("/club/events/:eventId/form/draft/autosave", ...clubManageAuth, rateLimitDraftAutosave, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.saveFormDraft(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: "Draft autosaved.",
            versionCount: savedForm.versionCount,
            updatedAt: savedForm.updatedAt,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Autosave failed.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/publish
 * Publish draft into an immutable snapshot (FormVersion)
 */
eventFormRouter.post("/club/events/:eventId/form/publish", ...clubPublishAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { changeSummary } = req.body;

        const result = await ClubEventFormService.publishForm(eventId, userId, changeSummary);

        return res.status(200).json({
            success: true,
            message: `Form version ${result.version.versionNumber} published successfully!`,
            version: result.version,
            form: result.form,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/publish error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to publish form.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/close
 * Close registrations or reopen
 */
eventFormRouter.post("/club/events/:eventId/form/close", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { isOpen = false, closedMessage } = req.body;

        const result = await ClubEventFormService.closeOrToggleStatus(eventId, userId, isOpen, closedMessage);

        return res.status(200).json({
            success: true,
            message: isOpen ? "Registrations reopened." : "Registrations closed.",
            status: result.status,
            settings: result.settings,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/close error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update registration status.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/revert/:versionId
 * Revert draft to a prior immutable snapshot
 */
eventFormRouter.post("/club/events/:eventId/form/revert/:versionId", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const versionId = String(req.params.versionId);
        const userId = req.user!.id;

        const reverted = await ClubEventFormService.revertToVersion(eventId, userId, versionId);

        return res.status(200).json({
            success: true,
            message: "Form draft reverted to selected version.",
            form: reverted,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/revert/:versionId error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to revert form draft.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/questions
 * Add question to specified section
 */
eventFormRouter.post("/club/events/:eventId/form/questions", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { sectionId, question, targetIndex } = req.body;

        if (!sectionId || !question) {
            return res.status(400).json({ success: false, message: "sectionId and question payload required." });
        }

        const savedForm = await ClubEventFormService.addQuestion(eventId, userId, sectionId, question, targetIndex);

        return res.status(201).json({
            success: true,
            message: "Question added successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to add question.",
        });
    }
});

/**
 * PUT /api/club/events/:eventId/form/questions/:questionId
 * Update single question by stable ID
 */
eventFormRouter.put("/club/events/:eventId/form/questions/:questionId", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const questionId = String(req.params.questionId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.updateQuestion(eventId, userId, questionId, req.body);

        return res.status(200).json({
            success: true,
            message: "Question updated successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update question.",
        });
    }
});

/**
 * DELETE /api/club/events/:eventId/form/questions/:questionId
 * Delete question by stable ID
 */
eventFormRouter.delete("/club/events/:eventId/form/questions/:questionId", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const questionId = String(req.params.questionId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.deleteQuestion(eventId, userId, questionId);

        return res.status(200).json({
            success: true,
            message: "Question deleted successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to delete question.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/sections
 * Add a new section
 */
eventFormRouter.post("/club/events/:eventId/form/sections", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.addSection(eventId, userId, req.body);

        return res.status(201).json({
            success: true,
            message: "Section created successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to create section.",
        });
    }
});

/**
 * DELETE /api/club/events/:eventId/form/sections/:sectionId
 * Delete section by stable ID
 */
eventFormRouter.delete("/club/events/:eventId/form/sections/:sectionId", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const sectionId = String(req.params.sectionId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.deleteSection(eventId, userId, sectionId);

        return res.status(200).json({
            success: true,
            message: "Section deleted successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to delete section.",
        });
    }
});

/**
 * PUT /api/club/events/:eventId/form/reorder
 * Reorder sections and questions
 */
eventFormRouter.put("/club/events/:eventId/form/reorder", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedForm = await ClubEventFormService.reorderStructure(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: "Order updated successfully.",
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to reorder form structure.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/import-questions
 * Import questions into the form
 */
eventFormRouter.post("/club/events/:eventId/form/import-questions", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { questions, targetSectionId } = req.body;

        if (!Array.isArray(questions)) {
            return res.status(400).json({ success: false, message: "questions array is required." });
        }

        const savedForm = await ClubEventFormService.importQuestions(eventId, userId, questions, targetSectionId);

        return res.status(200).json({
            success: true,
            message: `${questions.length} questions imported successfully.`,
            form: savedForm,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to import questions.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/question-library
 * Retrieve questions from past club events to enable question reuse (Phase 6.1)
 */
eventFormRouter.get("/club/events/:eventId/form/question-library", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.getClubQuestionLibrary(eventId, userId);

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("GET /api/club/events/:eventId/form/question-library error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load club question library.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/ai-suggest
 * Generate AI-assisted questionnaire suggestions (Phase 6.3)
 */
eventFormRouter.post("/club/events/:eventId/form/ai-suggest", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { prompt, eventType, eventDescription } = req.body;

        const result = await ClubEventFormService.aiSuggestQuestions(eventId, userId, {
            prompt,
            eventType,
            eventDescription,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/ai-suggest error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate AI question suggestions.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/qr-checkin
 * Validate ticket pass code for quick QR check-in (Phase 6.4)
 */
eventFormRouter.post("/club/events/:eventId/form/qr-checkin", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { ticketCode } = req.body;

        if (!ticketCode) {
            return res.status(400).json({ success: false, message: "Ticket code is required." });
        }

        const result = await ClubEventFormService.verifyRegistrationQrCode(eventId, userId, ticketCode);

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/qr-checkin error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "QR check-in failed.",
        });
    }
});

/**
 * GET /api/club/:clubId/forms/cross-event-analytics
 * Multi-event registration & turnout analytics for the club (Phase 6.4)
 */
eventFormRouter.get("/club/:clubId/forms/cross-event-analytics", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const clubId = String(req.params.clubId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.getClubCrossEventStats(clubId, userId);

        return res.status(200).json(result);
    } catch (err: any) {
        console.error("GET /api/club/:clubId/forms/cross-event-analytics error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load cross-event analytics.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/versions
 * List all immutable published versions
 */
eventFormRouter.get("/club/events/:eventId/form/versions", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.getFormVersions(eventId, userId);

        return res.status(200).json({
            success: true,
            versions: result.versions,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load form versions.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/versions/:versionId
 * Get snapshot of a specific form version
 */
eventFormRouter.get("/club/events/:eventId/form/versions/:versionId", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const versionId = String(req.params.versionId);

        const version = await ClubEventFormService.getFormVersionSnapshot(eventId, versionId);

        return res.status(200).json({
            success: true,
            version,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load form version snapshot.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/responses
 * Retrieve paginated and filtered responses (Phase 5.4 Server-Side Filtering)
 */
eventFormRouter.get("/club/events/:eventId/form/responses", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const {
            page,
            limit,
            versionId,
            status,
            search,
            startDate,
            endDate,
            questionId,
            answerSearch,
            sortBy,
            sortOrder,
            responseIds,
        } = req.query;

        const queryOpts: {
            page?: number;
            limit?: number;
            versionId?: string;
            status?: string;
            search?: string;
            startDate?: string;
            endDate?: string;
            questionId?: string;
            answerSearch?: string;
            sortBy?: string;
            sortOrder?: string;
            responseIds?: string[];
        } = {};

        if (page) queryOpts.page = Number(page);
        if (limit) queryOpts.limit = Number(limit);
        if (versionId) queryOpts.versionId = String(versionId);
        if (status) queryOpts.status = String(status);
        if (search) queryOpts.search = String(search);
        if (startDate) queryOpts.startDate = String(startDate);
        if (endDate) queryOpts.endDate = String(endDate);
        if (questionId) queryOpts.questionId = String(questionId);
        if (answerSearch) queryOpts.answerSearch = String(answerSearch);
        if (sortBy) queryOpts.sortBy = String(sortBy);
        if (sortOrder) queryOpts.sortOrder = String(sortOrder);
        if (responseIds) {
            queryOpts.responseIds = typeof responseIds === "string"
                ? responseIds.split(",").map((s) => s.trim()).filter(Boolean)
                : (Array.isArray(responseIds) ? responseIds as string[] : []);
        }

        const result = await ClubEventFormService.getResponsesForClub(eventId, userId, queryOpts);

        return res.status(200).json({
            success: true,
            ...result,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load form responses.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/responses/export
 * Export responses as CSV with dynamic question columns (Phase 5.5)
 */
eventFormRouter.get("/club/events/:eventId/form/responses/export", ...clubExportAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { versionId, status, search, startDate, endDate, responseIds } = req.query;

        const opts: any = {};
        if (versionId) opts.versionId = String(versionId);
        if (status) opts.status = String(status);
        if (search) opts.search = String(search);
        if (startDate) opts.startDate = String(startDate);
        if (endDate) opts.endDate = String(endDate);
        if (responseIds) {
            opts.responseIds = typeof responseIds === "string"
                ? responseIds.split(",").map((s) => s.trim()).filter(Boolean)
                : (Array.isArray(responseIds) ? responseIds : []);
        }

        const { filename, csvContent } = await ClubEventFormService.exportResponsesCsv(eventId, userId, opts);

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to export responses.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/responses/export
 * Multi-select export via POST body to handle large selections cleanly
 */
eventFormRouter.post("/club/events/:eventId/form/responses/export", ...clubExportAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { versionId, status, search, startDate, endDate, responseIds } = req.body;

        const { filename, csvContent } = await ClubEventFormService.exportResponsesCsv(eventId, userId, {
            versionId,
            status,
            search,
            startDate,
            endDate,
            responseIds,
        });

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csvContent);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to export responses.",
        });
    }
});

/**
 * PUT /api/club/events/:eventId/form/responses/:registrationId/status
 * Update student response registration status (Phase 5.3)
 */
eventFormRouter.put("/club/events/:eventId/form/responses/:registrationId/status", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const registrationId = String(req.params.registrationId);
        const userId = req.user!.id;
        const { status, reviewNotes } = req.body;

        if (!status) {
            return res.status(400).json({ success: false, message: "Status is required." });
        }

        const updated = await ClubEventFormService.updateResponseStatus(eventId, userId, registrationId, status, reviewNotes);

        return res.status(200).json({
            success: true,
            message: `Registration status updated to ${status}.`,
            registration: updated,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update response status.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/form/stats
 * Form response metrics and question-by-question breakdown analytics
 */
eventFormRouter.get("/club/events/:eventId/form/stats", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const stats = await ClubEventFormService.getFormStats(eventId, userId);

        return res.status(200).json({
            success: true,
            stats,
        });
    } catch (err: any) {
        console.error("GET /api/club/events/:eventId/form/stats error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load form analytics.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/release-grades
 * Release quiz grades to respondents
 */
eventFormRouter.post("/club/events/:eventId/form/release-grades", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.releaseQuizGrades(eventId, userId);

        return res.status(200).json({
            success: true,
            message: result.message,
            releasedCount: result.releasedCount,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/release-grades error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to release quiz grades.",
        });
    }
});

/**
 * POST /api/club/events/:eventId/form/upload-signature
 * Generate Cloudinary signed credentials for form header, question image, or option image
 */
eventFormRouter.post("/club/events/:eventId/form/upload-signature", ...clubManageAuth, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { type = "banner", questionId } = req.body;

        const uploadConfig = await ClubEventFormService.generateUploadSignature(
            eventId,
            userId,
            type === "question" ? "question" : "banner",
            { questionId }
        );

        return res.status(200).json({
            success: true,
            uploadConfig,
        });
    } catch (err: any) {
        console.error("POST /api/club/events/:eventId/form/upload-signature error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate upload signature.",
        });
    }
});


/**
 * ---------------------------------------------------------------------------
 * STUDENT / PUBLIC RESPONDER ROUTES
 * ---------------------------------------------------------------------------
 */

/**
 * GET /api/events/:eventId/form
 * Public endpoint to fetch event form for students (served from immutable published version)
 */
eventFormRouter.get("/events/:eventId/form", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user?.id;

        const data = await ClubEventFormService.getFormForEvent(eventId, userId);

        // Serve active published snapshot structure if available
        const effectiveForm: any = { ...data.form };
        if (data.publishedVersion) {
            effectiveForm.title = data.publishedVersion.title;
            effectiveForm.description = data.publishedVersion.description;
            effectiveForm.headerImageUrl = data.publishedVersion.headerImageUrl;
            effectiveForm.structure = data.publishedVersion.structure;
            effectiveForm.settings = data.publishedVersion.settings;
            effectiveForm.themeSettings = data.publishedVersion.themeSettings;
            effectiveForm.publishedVersionId = data.publishedVersion.id;
        }

        return res.status(200).json({
            success: true,
            form: effectiveForm,
            publishedVersion: data.publishedVersion,
            event: data.event,
            club: data.club,
            studentProfile: data.studentProfile,
            isClosed: data.isClosed,
            closedReason: data.closedReason,
            canSubmit: data.canSubmit,
            userResponse: data.userResponse,
            draftResponse: data.draftResponse,
            registeredCount: data.registeredCount,
        });
    } catch (err: any) {
        console.error("GET /api/events/:eventId/form error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load registration form.",
        });
    }
});

/**
 * GET /api/events/:eventId/form/draft
 * Retrieve authenticated student's unfinished registration draft
 */
eventFormRouter.get("/events/:eventId/form/draft", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const draft = await ClubEventFormService.getStudentDraft(eventId, userId);

        return res.status(200).json({
            success: true,
            draft,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to load draft.",
        });
    }
});

/**
 * PUT /api/events/:eventId/form/draft
 * Autosave student's partially completed registration
 */
eventFormRouter.put("/events/:eventId/form/draft", authenticate, rateLimitDraftAutosave, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const savedDraft = await ClubEventFormService.saveStudentDraft(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: "Draft saved.",
            draft: savedDraft,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to save draft.",
        });
    }
});

/**
 * DELETE /api/events/:eventId/form/draft
 * Clear student's autosaved draft
 */
eventFormRouter.delete("/events/:eventId/form/draft", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        await ClubEventFormService.clearStudentDraft(eventId, userId);

        return res.status(200).json({
            success: true,
            message: "Draft cleared successfully.",
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to clear draft.",
        });
    }
});

/**
 * POST /api/events/:eventId/form/upload-signature
 * Authenticated student generates signed upload token for question attachments
 */
eventFormRouter.post("/events/:eventId/form/upload-signature", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const { questionId, fileType } = req.body;

        const uploadConfig = await ClubEventFormService.generateUploadSignature(
            eventId,
            userId,
            "attachment",
            { questionId, fileType }
        );

        return res.status(200).json({
            success: true,
            uploadConfig,
        });
    } catch (err: any) {
        console.error("POST /api/events/:eventId/form/upload-signature error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to generate file upload signature.",
        });
    }
});

/**
 * POST /api/events/:eventId/form/submit
 * POST /api/events/:eventId/register
 * Student submits their answers and attachments with idempotency and transactional capacity lock
 */
const handleFormSubmission = async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user?.id;

        const result = await ClubEventFormService.submitFormResponse(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: result.message,
            registration: result.registration,
            isUpdate: result.isUpdate,
        });
    } catch (err: any) {
        console.error("Submit form response error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            code: err.code,
            message: err.message || "Failed to submit event registration.",
        });
    }
};

eventFormRouter.post("/events/:eventId/form/submit", optionalAuthenticate, rateLimitFormSubmissions, preventConcurrentSubmissions, handleFormSubmission);
eventFormRouter.post("/events/:eventId/register", optionalAuthenticate, rateLimitFormSubmissions, preventConcurrentSubmissions, handleFormSubmission);

/**
 * GET /api/events/:eventId/form/registration
 * Retrieve student's own registration for this event
 */
eventFormRouter.get("/events/:eventId/form/registration", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const registration = await ClubEventFormService.getStudentRegistration(eventId, userId);

        return res.status(200).json({
            success: true,
            registration,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to fetch your registration.",
        });
    }
});

/**
 * PUT /api/events/:eventId/form/registration
 * Edit an existing registration when permitted
 */
eventFormRouter.put("/events/:eventId/form/registration", authenticate, rateLimitFormSubmissions, preventConcurrentSubmissions, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.editExistingRegistration(eventId, userId, req.body);

        return res.status(200).json({
            success: true,
            message: result.message,
            registration: result.registration,
            isUpdate: result.isUpdate,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to update registration.",
        });
    }
});

/**
 * POST /api/events/:eventId/form/cancel
 * Cancel an existing registration and release capacity seat (Requirement 4.3)
 */
eventFormRouter.post("/events/:eventId/form/cancel", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const result = await ClubEventFormService.cancelStudentRegistration(eventId, userId);

        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to cancel registration.",
        });
    }
});
