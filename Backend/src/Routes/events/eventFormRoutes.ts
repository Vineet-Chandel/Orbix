import express, { type Request, type Response } from "express";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { ClubEventFormService } from "../../services/club/clubEventFormService.js";

export const eventFormRouter = express.Router();

/**
 * ---------------------------------------------------------------------------
 * CLUB WORKSPACE / FORM BUILDER ROUTES (STAFF ONLY)
 * ---------------------------------------------------------------------------
 */

/**
 * GET /api/club/events/:eventId/form
 * Fetch form definition, current draft, published version, and event context
 */
eventFormRouter.get("/club/events/:eventId/form", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form", authenticate, async (req: Request, res: Response) => {
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

eventFormRouter.put("/club/events/:eventId/form/draft", authenticate, handleSaveDraft);
eventFormRouter.put("/club/events/:eventId/form", authenticate, handleSaveDraft);

/**
 * PATCH /api/club/events/:eventId/form/draft/autosave
 * Autosave draft without triggering heavy validation
 */
eventFormRouter.patch("/club/events/:eventId/form/draft/autosave", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/publish", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/close", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/revert/:versionId", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/questions", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.put("/club/events/:eventId/form/questions/:questionId", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.delete("/club/events/:eventId/form/questions/:questionId", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/sections", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.delete("/club/events/:eventId/form/sections/:sectionId", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.put("/club/events/:eventId/form/reorder", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/import-questions", authenticate, async (req: Request, res: Response) => {
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
 * GET /api/club/events/:eventId/form/versions
 * List all immutable published versions
 */
eventFormRouter.get("/club/events/:eventId/form/versions", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.get("/club/events/:eventId/form/versions/:versionId", authenticate, async (req: Request, res: Response) => {
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
 * Retrieve paginated and filtered responses
 */
eventFormRouter.get("/club/events/:eventId/form/responses", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;

        const { page, limit, versionId, status, search } = req.query;

        const queryOpts: {
            page?: number;
            limit?: number;
            versionId?: string;
            status?: string;
            search?: string;
        } = {};
        if (page) queryOpts.page = Number(page);
        if (limit) queryOpts.limit = Number(limit);
        if (versionId) queryOpts.versionId = String(versionId);
        if (status) queryOpts.status = String(status);
        if (search) queryOpts.search = String(search);

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
 * Export responses as CSV with dynamic question columns
 */
eventFormRouter.get("/club/events/:eventId/form/responses/export", authenticate, async (req: Request, res: Response) => {
    try {
        const eventId = String(req.params.eventId);
        const userId = req.user!.id;
        const versionId = req.query.versionId ? String(req.query.versionId) : undefined;

        const { filename, csvContent } = await ClubEventFormService.exportResponsesCsv(eventId, userId, versionId);

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
 * GET /api/club/events/:eventId/form/stats
 * Form response metrics and question-by-question breakdown analytics
 */
eventFormRouter.get("/club/events/:eventId/form/stats", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/release-grades", authenticate, async (req: Request, res: Response) => {
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
eventFormRouter.post("/club/events/:eventId/form/upload-signature", authenticate, async (req: Request, res: Response) => {
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

eventFormRouter.post("/events/:eventId/form/submit", optionalAuthenticate, handleFormSubmission);
eventFormRouter.post("/events/:eventId/register", optionalAuthenticate, handleFormSubmission);

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
eventFormRouter.put("/events/:eventId/form/registration", authenticate, async (req: Request, res: Response) => {
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
