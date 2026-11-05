import crypto from "node:crypto";
import { pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { assertCloudinaryConfigured, cloudinary } from "../../config/cloudinary.js";
import { ClubTeamService } from "./clubTeamService.js";
import { FormLogger } from "../../utils/formLogger.js";
import { FormBackgroundQueue } from "../queue/formBackgroundQueue.js";
import {
    sanitizeText,
    escapeCsvFormula,
    validateAttachmentSecurity,
    validateQuestionSchema,
    sanitizeFormStructure,
    sanitizeStudentAnswers,
} from "../../utils/formSecuritySanitizer.js";
import type {
    ClubEventFormRecord,
    FormStructure,
    FormSettings,
    FormThemeSettings,
    FormSubmissionPayload,
    FileAttachmentMeta,
    FormQuestion,
    FormSection,
    FormOption,
    FormVersionRecord,
    MediaAssetRecord,
    SaveDraftPayload,
    ReorderStructurePayload,
} from "../../types/eventFormTypes.js";

const query = (text: string, params?: any[]) => pool.query(text, params);

/**
 * Generates unique stable IDs for questions and sections that remain consistent across edits.
 */
export function generateStableId(prefix: "q" | "sec" | "opt" = "q"): string {
    const timestamp = Date.now().toString(36);
    const randomSuffix = crypto.randomBytes(4).toString("hex");
    return `${prefix}_${timestamp}_${randomSuffix}`;
}

/**
 * Default initial template when an event has no custom form configured yet.
 * Identity fields (Name, Email, College, Roll Number) are automatically pre-filled
 * from the student's verified Orbix account so the form focuses on event-specific questions.
 */
export function buildDefaultFormStructure(eventTitle: string, eventDescription?: string | null): FormStructure {
    return {
        sections: [
            {
                id: generateStableId("sec"),
                title: "Participation & Track Preference",
                description: `Tell the organizers about your background and interests for ${eventTitle}.`,
                afterSectionAction: "next_section",
                questions: [
                    {
                        id: generateStableId("q"),
                        type: "multiple_choice",
                        title: "Are you registering as an individual or team?",
                        description: "Select whether you are hacking solo or with an established team.",
                        required: true,
                        options: [
                            { id: generateStableId("opt"), text: "Individual (Looking for a team)" },
                            { id: generateStableId("opt"), text: "Individual (Solo project)" },
                            { id: generateStableId("opt"), text: "Team Lead (Registering an existing team)" },
                            { id: generateStableId("opt"), text: "Team Member (Joining an existing team)" },
                        ],
                    },
                    {
                        id: generateStableId("q"),
                        type: "checkboxes",
                        title: "What is your primary technology stack?",
                        description: "Select all technologies and frameworks you plan to build with.",
                        required: true,
                        options: [
                            { id: generateStableId("opt"), text: "React / Next.js / TypeScript" },
                            { id: generateStableId("opt"), text: "Node.js / Express / NestJS" },
                            { id: generateStableId("opt"), text: "Python / Django / FastAPI" },
                            { id: generateStableId("opt"), text: "AI / Machine Learning / PyTorch" },
                            { id: generateStableId("opt"), text: "Go / Rust / Systems" },
                            { id: generateStableId("opt"), text: "Mobile (Flutter / React Native)" },
                            { id: generateStableId("opt"), text: "Other...", isOther: true },
                        ],
                        validation: {
                            minSelected: 1,
                        },
                    },
                    {
                        id: generateStableId("q"),
                        type: "dropdown",
                        title: "Select your preferred team role",
                        required: true,
                        options: [
                            { id: generateStableId("opt"), text: "Frontend Developer" },
                            { id: generateStableId("opt"), text: "Backend Developer" },
                            { id: generateStableId("opt"), text: "Full Stack Engineer" },
                            { id: generateStableId("opt"), text: "UI / UX Designer" },
                            { id: generateStableId("opt"), text: "AI / ML Engineer" },
                            { id: generateStableId("opt"), text: "Product Pitch & Presentation Lead" },
                        ],
                    },
                    {
                        id: generateStableId("q"),
                        type: "paragraph",
                        title: "What do you hope to build or learn?",
                        description: "Briefly outline your project idea or what problem you'd like to tackle.",
                        required: false,
                        validation: {
                            maxLength: 1000,
                        },
                    },
                    {
                        id: generateStableId("q"),
                        type: "file_upload",
                        title: "Upload your resume (Optional)",
                        description: "Reviewers and sponsoring companies may review resumes for internship and interview opportunities.",
                        required: false,
                        validation: {
                            allowedFileTypes: ["pdf"],
                            maxFileSizeMb: 10,
                            maxFiles: 1,
                        },
                    },
                ],
            },
        ],
    };
}

export class ClubEventFormService {
    /**
     * Resolves staff club authorization
     */
    static async assertStaffAccess(userId: string, clubId: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, clubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin && !perms.isTeamLead)) {
            const error: any = new Error("Forbidden: You do not have permission to manage forms for this club.");
            error.statusCode = 403;
            throw error;
        }
        return perms;
    }

    /**
     * Get or initialize form for a club event (staff view)
     */
    static async getFormForEvent(eventId: string, userId?: string): Promise<{
        form: ClubEventFormRecord;
        isNew: boolean;
        event: any;
        club: any;
        studentProfile?: any;
        userResponse?: any;
        draftResponse?: any;
        canSubmit: boolean;
        isClosed: boolean;
        closedReason?: string | undefined;
        registeredCount: number;
        publishedVersion?: FormVersionRecord | null;
        totalVersions: number;
    }> {
        // Fast Redis Cache Check for shared public published form metadata (Requirement 4.2)
        const publicCacheKey = `orbix:form:public:${eventId}`;
        let cachedShared: any = null;
        if (redis && redis.status === "ready") {
            try {
                const raw = await redis.get(publicCacheKey);
                if (raw) {
                    cachedShared = JSON.parse(raw);
                }
            } catch {
                // Ignore redis error and fall back to database
            }
        }

        let form: ClubEventFormRecord = null as any;
        let isNew = false;
        let event: any = null;
        let club: any = null;
        let registeredCount = 0;
        let publishedVersion: FormVersionRecord | null = null;
        let totalVersions = 1;
        let canSubmit = true;
        let isClosed = false;
        let closedReason: string | undefined = undefined;

        if (cachedShared) {
            form = cachedShared.form;
            isNew = cachedShared.isNew;
            event = cachedShared.event;
            club = cachedShared.club;
            registeredCount = cachedShared.registeredCount;
            publishedVersion = cachedShared.publishedVersion;
            totalVersions = cachedShared.totalVersions;
            canSubmit = cachedShared.canSubmit;
            isClosed = cachedShared.isClosed;
            closedReason = cachedShared.closedReason;
            FormLogger.info("CACHE_HIT", "Public form schema served from Redis cache", { eventId });
        } else {
            const eventRes = await query(
                `SELECT e.id, e.club_id AS "clubId", e.title, e.summary, e.description,
                        e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.timezone,
                        e.location_type AS "locationType", e.venue_or_location AS "venueOrLocation",
                        e.status, e.capacity, e.registered_count AS "registeredCount",
                        e.cover_image_url AS "coverImageUrl", e.eligibility,
                        c.name AS "clubName", c.slug AS "clubSlug", c.logo_url AS "clubLogoUrl",
                        c.college_id AS "clubCollegeId"
                 FROM club_events e
                 JOIN verified_clubs c ON c.id = e.club_id
                 WHERE e.id = $1 LIMIT 1;`,
                [eventId]
            );

            if (!eventRes.rows[0]) {
                const error: any = new Error("Event not found.");
                error.statusCode = 404;
                throw error;
            }

            event = eventRes.rows[0];
            club = {
                id: event.clubId,
                name: event.clubName,
                slug: event.clubSlug,
                logoUrl: event.clubLogoUrl,
                collegeId: event.clubCollegeId,
            };

            // Fetch form definition
            const formRes = await query(
                `SELECT id, event_id AS "eventId", club_id AS "clubId", created_by AS "createdBy",
                        title, description, status, current_draft_version_id AS "currentDraftVersionId",
                        published_version_id AS "publishedVersionId", header_image_url AS "headerImageUrl",
                        header_image_public_id AS "headerImagePublicId", theme_settings AS "themeSettings",
                        settings, default_settings AS "defaultSettings", structure,
                        is_published AS "isPublished", version_count AS "versionCount",
                        schema_version AS "schemaVersion", created_at AS "createdAt",
                        updated_at AS "updatedAt", published_at AS "publishedAt"
                 FROM club_event_forms
                 WHERE event_id = $1 LIMIT 1;`,
                [eventId]
            );

        const defaultFormSettings: FormSettings = {
            isOpen: true,
            closedMessage: "Registrations are currently closed for this event.",
            maxResponses: null,
            limitOneResponse: true,
            allowEditResponse: false,
            requireLogin: true,
            showProgressBar: true,
            confirmationMessage: "Thank you! Your registration has been submitted successfully.",
            notifyOnRegistration: true,
        };

        if (formRes.rows[0]) {
            const row = formRes.rows[0];
            form = {
                ...row,
                status: row.status || (row.isPublished ? "published" : "draft"),
                versionCount: row.versionCount || 1,
                defaultSettings: row.defaultSettings || defaultFormSettings,
            };
        } else {
            isNew = true;
            form = {
                id: "default",
                eventId: event.id,
                clubId: event.clubId,
                createdBy: userId || null,
                title: `${event.title} — Registration`,
                description: event.summary || event.description || "Fill out this form to register for the event.",
                status: "draft",
                currentDraftVersionId: null,
                publishedVersionId: null,
                headerImageUrl: event.coverImageUrl || null,
                headerImagePublicId: null,
                themeSettings: {
                    accentColor: "#38BDF8",
                    fontFamily: "sans",
                    headerPosition: "center",
                },
                settings: defaultFormSettings,
                defaultSettings: defaultFormSettings,
                structure: buildDefaultFormStructure(event.title, event.description),
                isPublished: false,
                versionCount: 1,
                schemaVersion: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
        }

        // Fetch published version snapshot if exists
        if (form.publishedVersionId) {
            const versionRes = await query(
                `SELECT id, form_id AS "formId", event_id AS "eventId", version_number AS "versionNumber",
                        title, description, header_image_url AS "headerImageUrl",
                        header_image_public_id AS "headerImagePublicId", structure, settings,
                        theme_settings AS "themeSettings", change_summary AS "changeSummary",
                        is_published AS "isPublished", published_by AS "publishedBy",
                        created_by AS "createdBy", created_at AS "createdAt", published_at AS "publishedAt"
                 FROM club_event_form_versions
                 WHERE id = $1 LIMIT 1;`,
                [form.publishedVersionId]
            );
            if (versionRes.rows[0]) {
                publishedVersion = versionRes.rows[0];
            }
        }

        // Count total published versions
        const totalVersionsRes = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_form_versions WHERE event_id = $1;`,
            [eventId]
        );
        totalVersions = totalVersionsRes.rows[0]?.count || 0;

        // Count current registrations
        const countRes = await query(
            `SELECT COUNT(*)::int AS count 
             FROM club_event_registrations 
             WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
            [eventId]
        );
        registeredCount = countRes.rows[0]?.count || 0;

        // Check if closed
        if (event.status === "completed" || event.status === "cancelled") {
            isClosed = true;
            closedReason = `This event is ${event.status}.`;
        } else if (form.status === "closed" || !form.settings.isOpen) {
            isClosed = true;
            closedReason = form.settings.closedMessage || "Registrations are currently closed by the organizers.";
        } else if (
            form.settings.maxResponses !== null &&
            form.settings.maxResponses > 0 &&
            registeredCount >= form.settings.maxResponses
        ) {
            isClosed = true;
            closedReason = "Registration limit has been reached for this event.";
        }

        canSubmit = !isClosed;
        } // End of if (!cachedShared) DB fetch block

        // Check user's existing registration and verified student identity if logged in
        let userResponse: any = null;
        let studentProfile: any = null;
        let isStaff = false;

        if (userId) {
            try {
                await this.assertStaffAccess(userId, event.clubId);
                isStaff = true;
            } catch {
                isStaff = false;
            }
        }

        if (userId) {
            // 1. Fetch rich student identity from users & institutions
            const userRes = await query(
                `SELECT u.id, u.username, u.email, u.firstname, u.lastname,
                        COALESCE(u.photo_url, u.avatar_url, 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png') AS "avatarUrl",
                        u.college AS "collegeText",
                        u.college_id AS "collegeId",
                        inst.official_name AS "collegeName",
                        u.roll_number AS "rollNumber",
                        u.department,
                        u.year_of_study AS "yearOfStudy",
                        u.phone AS "phoneNumber",
                        u.github,
                        u.linkedin,
                        u.website,
                        u.resume_url AS "resumeUrl",
                        u.resume_filename AS "resumeFilename"
                 FROM users u
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE u.id = $1 LIMIT 1;`,
                [userId]
            );

            if (userRes.rows[0]) {
                const u = userRes.rows[0];

                let pastRoll = u.rollNumber;
                let pastDept = u.department;
                let pastYear = u.yearOfStudy;
                let pastPhone = u.phoneNumber;

                // If academic details are null on users table, check past registrations
                if (!pastRoll || !pastDept || !pastPhone) {
                    const pastReg = await query(
                        `SELECT roll_number, department, year_of_study, phone_number
                         FROM club_event_registrations
                         WHERE user_id = $1 AND (roll_number IS NOT NULL OR department IS NOT NULL OR phone_number IS NOT NULL)
                         ORDER BY registered_at DESC LIMIT 1;`,
                        [userId]
                    );
                    if (pastReg.rows[0]) {
                        if (!pastRoll) pastRoll = pastReg.rows[0].roll_number;
                        if (!pastDept) pastDept = pastReg.rows[0].department;
                        if (!pastYear) pastYear = pastReg.rows[0].year_of_study;
                        if (!pastPhone) pastPhone = pastReg.rows[0].phone_number;
                    }
                }

                studentProfile = {
                    id: u.id,
                    fullName: (u.firstname ? `${u.firstname} ${u.lastname || ""}`.trim() : u.username) || "Student",
                    firstName: u.firstname || "",
                    lastName: u.lastname || "",
                    username: u.username,
                    email: u.email,
                    avatarUrl: u.avatarUrl,
                    college: u.collegeName || u.collegeText || "Not Linked",
                    collegeId: u.collegeId || null,
                    rollNumber: pastRoll || null,
                    department: pastDept || null,
                    yearOfStudy: pastYear || null,
                    phoneNumber: pastPhone || null,
                    github: u.github || null,
                    linkedin: u.linkedin || null,
                    website: u.website || null,
                    resumeUrl: u.resumeUrl || null,
                    resumeFilename: u.resumeFilename || null,
                    isVerifiedCampus: Boolean(u.collegeId),
                };
            }

            // 2. Fetch existing event registration
            const regRes = await query(
                `SELECT id, status, ticket_code AS "ticketCode", applicant_name AS "applicantName",
                        applicant_email AS "applicantEmail", department, year_of_study AS "yearOfStudy",
                        roll_number AS "rollNumber", phone_number AS "phoneNumber", notes,
                        answers, form_response AS "formResponse", file_attachments AS "fileAttachments",
                        form_version_id AS "formVersionId",
                        quiz_score AS "quizScore", quiz_max_score AS "quizMaxScore",
                        quiz_graded_answers AS "quizGradedAnswers", quiz_grades_released AS "quizGradesReleased",
                        registered_at AS "registeredAt", checked_in_at AS "checkedInAt"
                 FROM club_event_registrations
                 WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
                [eventId, userId]
            );

            if (regRes.rows[0]) {
                const reg = regRes.rows[0];
                userResponse = {
                    ...reg,
                    answers: reg.formResponse || reg.answers || {},
                    fileAttachments: reg.fileAttachments || [],
                };

                if (reg.status === "blocked") {
                    canSubmit = false;
                    isClosed = true;
                    closedReason = "Access restricted: You cannot register for this club's events.";
                } else if (reg.status === "registered" || reg.status === "attended" || reg.status === "pending") {
                    if (!form.settings.allowEditResponse) {
                        canSubmit = false;
                    }
                }
            }
        }

        // Fetch student's in-progress response draft if authenticated and has no submitted response
        let draftResponse: any = null;
        if (userId && !userResponse) {
            try {
                const draftRes = await query(
                    `SELECT answers, file_attachments AS "fileAttachments",
                            current_section_index AS "currentSectionIndex",
                            section_history AS "sectionHistory",
                            form_version_id AS "formVersionId",
                            updated_at AS "updatedAt"
                     FROM club_event_response_drafts
                     WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
                    [eventId, userId]
                );
                if (draftRes.rows[0]) {
                    draftResponse = draftRes.rows[0];
                }
            } catch (draftErr) {
                console.warn("[getFormForEvent] Could not query student draft:", draftErr);
            }
        }

        // Student Access Control: Never expose unpublished form structure to non-staff students (Phase 5)
        let sanitizedForm: ClubEventFormRecord = { ...form };
        if (!isStaff && sanitizedForm.status !== "published" && !publishedVersion) {
            canSubmit = false;
            isClosed = true;
            closedReason = form.settings?.closedMessage || "Registration is not published or currently unavailable.";
            sanitizedForm = {
                ...sanitizedForm,
                structure: { sections: [] },
            };
        }

        // Student Eligibility Restriction: Enforce same-college only when configured
        if (!isStaff && event.eligibility && event.eligibility === "same_college_only" && studentProfile?.collegeId && club.collegeId) {
            if (studentProfile.collegeId !== club.collegeId) {
                canSubmit = false;
                isClosed = true;
                closedReason = `Eligibility restriction: This event is only open to students of ${club.collegeName || "the host institution"}.`;
            }
        }

        // Sanitize Quiz Answer Keys for Students: Never expose answers before release
        // Club staff always have full access to answer keys for editing and grading
        const isQuiz = Boolean(form.settings.quiz?.isQuiz);
        const gradesReleased = Boolean(userResponse?.quizGradesReleased);

        if (!isStaff && isQuiz && !gradesReleased && sanitizedForm.structure?.sections) {
            sanitizedForm = {
                ...sanitizedForm,
                structure: {
                    ...sanitizedForm.structure,
                    sections: sanitizedForm.structure.sections.map((sec: FormSection) => ({
                        ...sec,
                        questions: (sec.questions || []).map((q: FormQuestion) => {
                            const sanitizedQ: any = { ...q };
                            delete sanitizedQ.correctAnswers;
                            delete sanitizedQ.answerExplanation;
                            delete sanitizedQ.feedbackLinks;
                            return sanitizedQ;
                        }),
                    })),
                },
            };
        }

        // Cache public published form metadata in Redis (Requirement 4.2)
        // Public cache strictly excludes studentProfile, userResponse, or draftResponse
        if (!cachedShared && redis && redis.status === "ready" && (sanitizedForm.status === "published" || publishedVersion)) {
            try {
                const publicSharedData = {
                    form: sanitizedForm,
                    isNew,
                    event,
                    club,
                    canSubmit,
                    isClosed,
                    closedReason,
                    registeredCount,
                    publishedVersion,
                    totalVersions,
                };
                await redis.set(publicCacheKey, JSON.stringify(publicSharedData), "EX", 300);
                FormLogger.info("CACHE_MISS", "Cached published form schema in Redis", { eventId });
            } catch {
                // Ignore cache write error
            }
        }

        return {
            form: sanitizedForm,
            isNew,
            event,
            club,
            studentProfile,
            userResponse,
            draftResponse,
            canSubmit,
            isClosed,
            closedReason,
            registeredCount,
            publishedVersion,
            totalVersions,
        };
    }

    /**
     * Sanitizes and guarantees stable IDs for sections and questions
     */
    static sanitizeStructure(rawStructure?: FormStructure, fallbackTitle = "Event"): FormStructure {
        if (!rawStructure || !Array.isArray(rawStructure.sections) || rawStructure.sections.length === 0) {
            return buildDefaultFormStructure(fallbackTitle);
        }

        return {
            sections: rawStructure.sections.map((sec, sIdx) => ({
                id: sec.id?.trim() || generateStableId("sec"),
                title: sec.title?.trim() || `Section ${sIdx + 1}`,
                description: sec.description || "",
                afterSectionAction: sec.afterSectionAction || "next_section",
                questions: (sec.questions || []).map((q, qIdx): FormQuestion => {
                    const qItem: FormQuestion = {
                        id: q.id?.trim() || generateStableId("q"),
                        type: q.type || "short_answer",
                        title: q.title?.trim() || `Question ${qIdx + 1}`,
                        required: Boolean(q.required),
                    };

                    if (q.description) qItem.description = q.description;
                    if (q.imageUrl) qItem.imageUrl = q.imageUrl;
                    if (q.imagePublicId) qItem.imagePublicId = q.imagePublicId;
                    if (q.imageCaption) qItem.imageCaption = q.imageCaption;

                    if (Array.isArray(q.options)) {
                        qItem.options = q.options.map((opt, oIdx) => {
                            const optItem: FormOption = {
                                id: opt.id?.trim() || generateStableId("opt"),
                                text: opt.text?.trim() || `Option ${oIdx + 1}`,
                            };
                            if (opt.imageUrl) optItem.imageUrl = opt.imageUrl;
                            if (opt.imagePublicId) optItem.imagePublicId = opt.imagePublicId;
                            if (opt.goToSectionId) optItem.goToSectionId = opt.goToSectionId;
                            if (opt.isOther !== undefined) optItem.isOther = Boolean(opt.isOther);
                            return optItem;
                        });
                    }

                    if (q.scaleConfig) {
                        qItem.scaleConfig = {
                            min: Number(q.scaleConfig.min ?? 1),
                            max: Number(q.scaleConfig.max ?? 5),
                            minLabel: q.scaleConfig.minLabel || undefined,
                            maxLabel: q.scaleConfig.maxLabel || undefined,
                        };
                    }

                    if (q.ratingConfig) {
                        qItem.ratingConfig = {
                            icon: q.ratingConfig.icon || "star",
                            levels: Math.min(10, Math.max(3, Number(q.ratingConfig.levels ?? 5))),
                        };
                    }

                    if (q.dateConfig) {
                        qItem.dateConfig = {
                            includeYear: q.dateConfig.includeYear ?? true,
                            includeTime: Boolean(q.dateConfig.includeTime),
                        };
                    }

                    if (q.timeConfig) {
                        qItem.timeConfig = {
                            mode: q.timeConfig.mode || "time",
                        };
                    }

                    if (q.gridConfig) {
                        qItem.gridConfig = {
                            rows: Array.isArray(q.gridConfig.rows) ? q.gridConfig.rows : [],
                            columns: Array.isArray(q.gridConfig.columns) ? q.gridConfig.columns : [],
                            requireEachRow: Boolean(q.gridConfig.requireEachRow),
                            limitOnePerColumn: Boolean(q.gridConfig.limitOnePerColumn),
                        };
                    }

                    if (q.videoUrl) qItem.videoUrl = q.videoUrl;
                    if (q.videoTitle) qItem.videoTitle = q.videoTitle;
                    if (q.imageAlignment) qItem.imageAlignment = q.imageAlignment;
                    if (q.shuffleOptions !== undefined) qItem.shuffleOptions = Boolean(q.shuffleOptions);

                    if (q.validation) qItem.validation = q.validation;
                    if (q.placeholder) qItem.placeholder = q.placeholder;
                    if (q.content) qItem.content = q.content;

                    return qItem;
                }),
            })),
        };
    }

    /**
     * Save Form Draft with Optimistic Concurrency Control
     */
    static async saveFormDraft(
        eventId: string,
        userId: string,
        payload: SaveDraftPayload
    ): Promise<ClubEventFormRecord> {
        const evCheck = await query(
            `SELECT club_id AS "clubId", title FROM club_events WHERE id = $1 LIMIT 1;`,
            [eventId]
        );
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }

        const clubId = evCheck.rows[0].clubId;
        await this.assertStaffAccess(userId, clubId);

        // Fetch existing form row for optimistic concurrency control
        const existingForm = await query(
            `SELECT id, version_count AS "versionCount", settings, theme_settings AS "themeSettings"
             FROM club_event_forms WHERE event_id = $1 LIMIT 1;`,
            [eventId]
        );

        if (existingForm.rows[0] && payload.expectedVersionCount !== undefined) {
            const currentCount = existingForm.rows[0].versionCount || 1;
            if (payload.expectedVersionCount !== currentCount) {
                const error: any = new Error(
                    "Concurrent update detected: The form was modified by another organizer. Please refresh to inspect the latest changes."
                );
                error.statusCode = 409;
                throw error;
            }
        }

        // Dynamic Question Schema Validation: Ensure all questions comply with allowed types and constraints
        if (payload.structure?.sections) {
            for (const sec of payload.structure.sections) {
                for (const q of sec.questions || []) {
                    const validation = validateQuestionSchema(q);
                    if (!validation.valid) {
                        const error: any = new Error(validation.error || "Invalid dynamic question schema.");
                        error.statusCode = 400;
                        throw error;
                    }
                }
            }
        }

        const rawStructure = this.sanitizeStructure(payload.structure, evCheck.rows[0].title);
        const validatedStructure = sanitizeFormStructure(rawStructure);
        const title = sanitizeText(payload.title?.trim() || `${evCheck.rows[0].title} — Registration`, 200);
        const description = payload.description !== undefined && payload.description !== null ? sanitizeText(payload.description, 2000) : null;
        const headerImageUrl = payload.headerImageUrl !== undefined ? payload.headerImageUrl : null;
        const headerImagePublicId = payload.headerImagePublicId !== undefined ? payload.headerImagePublicId : null;

        const defaultTheme: FormThemeSettings = {
            accentColor: payload.themeSettings?.accentColor || "#38BDF8",
            fontFamily: payload.themeSettings?.fontFamily || "sans",
            headerPosition: payload.themeSettings?.headerPosition || "center",
        };

        const existingSettings = existingForm.rows[0]?.settings || {};
        const mergedSettings: FormSettings = {
            isOpen: payload.settings?.isOpen ?? existingSettings.isOpen ?? true,
            closedMessage: payload.settings?.closedMessage || existingSettings.closedMessage || "Registrations are currently closed for this event.",
            maxResponses: payload.settings?.maxResponses !== undefined
                ? (payload.settings.maxResponses ? Number(payload.settings.maxResponses) : null)
                : (existingSettings.maxResponses ?? null),
            limitOneResponse: payload.settings?.limitOneResponse ?? existingSettings.limitOneResponse ?? true,
            allowEditResponse: payload.settings?.allowEditResponse ?? existingSettings.allowEditResponse ?? false,
            requireLogin: payload.settings?.requireLogin ?? existingSettings.requireLogin ?? true,
            showProgressBar: payload.settings?.showProgressBar ?? existingSettings.showProgressBar ?? true,
            confirmationMessage: payload.settings?.confirmationMessage || existingSettings.confirmationMessage || "Thank you! Your registration has been submitted successfully.",
            notifyOnRegistration: payload.settings?.notifyOnRegistration ?? existingSettings.notifyOnRegistration ?? true,
        };

        const upsertRes = await query(
            `INSERT INTO club_event_forms (
                event_id,
                club_id,
                created_by,
                title,
                description,
                status,
                header_image_url,
                header_image_public_id,
                theme_settings,
                settings,
                default_settings,
                structure,
                is_published,
                version_count,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $9, $10, false, 1, NOW())
            ON CONFLICT (event_id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                header_image_url = EXCLUDED.header_image_url,
                header_image_public_id = EXCLUDED.header_image_public_id,
                theme_settings = EXCLUDED.theme_settings,
                settings = EXCLUDED.settings,
                structure = EXCLUDED.structure,
                version_count = club_event_forms.version_count + 1,
                updated_at = NOW()
            RETURNING
                id,
                event_id AS "eventId",
                club_id AS "clubId",
                created_by AS "createdBy",
                title,
                description,
                status,
                current_draft_version_id AS "currentDraftVersionId",
                published_version_id AS "publishedVersionId",
                header_image_url AS "headerImageUrl",
                header_image_public_id AS "headerImagePublicId",
                theme_settings AS "themeSettings",
                settings,
                default_settings AS "defaultSettings",
                structure,
                is_published AS "isPublished",
                version_count AS "versionCount",
                schema_version AS "schemaVersion",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                published_at AS "publishedAt";`,
            [
                eventId,
                clubId,
                userId,
                title,
                description,
                headerImageUrl,
                headerImagePublicId,
                JSON.stringify(defaultTheme),
                JSON.stringify(mergedSettings),
                JSON.stringify(validatedStructure),
            ]
        );

        return upsertRes.rows[0];
    }

    /**
     * Backward-compatible alias for saveFormDraft
     */
    static async saveEventForm(eventId: string, userId: string, payload: any) {
        return this.saveFormDraft(eventId, userId, payload);
    }

    /**
     * Validates conditional branching graph:
     * - Checks that all section destinations exist.
     * - Detects broken routes or unreachable sections.
     */
    static validateBranchingGraph(structure: FormStructure): {
        isValid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];
        const sections = structure.sections || [];
        const sectionIds = new Set(sections.map((s) => s.id));

        if (sections.length === 0) {
            errors.push("Form must contain at least one section.");
            return { isValid: false, errors, warnings };
        }

        // Track reachable sections starting from section 0
        const reachable = new Set<string>();
        if (sections[0]) reachable.add(sections[0].id);

        sections.forEach((sec, sIdx) => {
            // Check afterSectionAction
            if (sec.afterSectionAction && sec.afterSectionAction !== "next_section" && sec.afterSectionAction !== "submit_form") {
                if (!sectionIds.has(sec.afterSectionAction)) {
                    errors.push(`Section "${sec.title || sIdx + 1}" navigates to a non-existent section.`);
                } else {
                    reachable.add(sec.afterSectionAction);
                }
            } else if (sec.afterSectionAction === "next_section" && sIdx < sections.length - 1) {
                const nextSec = sections[sIdx + 1];
                if (nextSec) reachable.add(nextSec.id);
            }

            // Check question options routing
            (sec.questions || []).forEach((q) => {
                if (q.type === "multiple_choice" || q.type === "dropdown") {
                    (q.options || []).forEach((opt) => {
                        if (opt.goToSectionId && opt.goToSectionId !== "next_section" && opt.goToSectionId !== "submit_form") {
                            if (!sectionIds.has(opt.goToSectionId)) {
                                errors.push(`Option "${opt.text}" in question "${q.title}" navigates to a non-existent section.`);
                            } else {
                                reachable.add(opt.goToSectionId);
                            }
                        }
                    });
                }
            });
        });

        // Check for unreachable sections
        if (sections.length > 1) {
            sections.slice(1).forEach((sec) => {
                if (!reachable.has(sec.id)) {
                    warnings.push(`Section "${sec.title}" is currently unreachable based on branching rules.`);
                }
            });
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Publish Form: Creates an immutable snapshot in club_event_form_versions
     */
    static async publishForm(
        eventId: string,
        userId: string,
        changeSummary?: string
    ): Promise<{
        success: boolean;
        version: FormVersionRecord;
        form: ClubEventFormRecord;
    }> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const evCheck = await client.query(
                `SELECT club_id AS "clubId", title FROM club_events WHERE id = $1 FOR UPDATE;`,
                [eventId]
            );
            if (!evCheck.rows[0]) {
                const error: any = new Error("Event not found.");
                error.statusCode = 404;
                throw error;
            }

            const clubId = evCheck.rows[0].clubId;
            await this.assertStaffAccess(userId, clubId);

            // Fetch current draft form
            const formRes = await client.query(
                `SELECT * FROM club_event_forms WHERE event_id = $1 FOR UPDATE;`,
                [eventId]
            );

            let formRow = formRes.rows[0];
            if (!formRow) {
                // Initialize if not present
                const defStructure = buildDefaultFormStructure(evCheck.rows[0].title);
                const inserted = await client.query(
                    `INSERT INTO club_event_forms (
                        event_id, club_id, created_by, title, structure, is_published, status, version_count, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, false, 'draft', 1, NOW())
                    RETURNING *;`,
                    [eventId, clubId, userId, `${evCheck.rows[0].title} — Registration`, JSON.stringify(defStructure)]
                );
                formRow = inserted.rows[0];
            }

            // Validate conditional branching graph before publishing
            const graphCheck = this.validateBranchingGraph(formRow.structure);
            if (!graphCheck.isValid) {
                const error: any = new Error(`Cannot publish form: ${graphCheck.errors.join("; ")}`);
                error.statusCode = 400;
                throw error;
            }

            // Compute next version number
            const versionCountRes = await client.query(
                `SELECT COALESCE(MAX(version_number), 0)::int AS max_ver
                 FROM club_event_form_versions WHERE form_id = $1;`,
                [formRow.id]
            );
            const nextVersionNumber = (versionCountRes.rows[0]?.max_ver || 0) + 1;

            // Mark prior versions of this form as not currently published
            await client.query(
                `UPDATE club_event_form_versions
                 SET is_published = false
                 WHERE form_id = $1;`,
                [formRow.id]
            );

            // Insert immutable version snapshot
            const versionInsert = await client.query(
                `INSERT INTO club_event_form_versions (
                    form_id,
                    event_id,
                    version_number,
                    title,
                    description,
                    header_image_url,
                    header_image_public_id,
                    structure,
                    settings,
                    theme_settings,
                    change_summary,
                    is_published,
                    published_by,
                    created_by,
                    created_at,
                    published_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, $12, $12, NOW(), NOW())
                RETURNING
                    id,
                    form_id AS "formId",
                    event_id AS "eventId",
                    version_number AS "versionNumber",
                    title,
                    description,
                    header_image_url AS "headerImageUrl",
                    header_image_public_id AS "headerImagePublicId",
                    structure,
                    settings,
                    theme_settings AS "themeSettings",
                    change_summary AS "changeSummary",
                    is_published AS "isPublished",
                    published_by AS "publishedBy",
                    created_by AS "createdBy",
                    created_at AS "createdAt",
                    published_at AS "publishedAt";`,
                [
                    formRow.id,
                    eventId,
                    nextVersionNumber,
                    formRow.title,
                    formRow.description,
                    formRow.header_image_url,
                    formRow.header_image_public_id,
                    JSON.stringify(formRow.structure),
                    JSON.stringify(formRow.settings),
                    JSON.stringify(formRow.theme_settings),
                    changeSummary || `Version ${nextVersionNumber} published`,
                    userId,
                ]
            );

            const newVersion: FormVersionRecord = versionInsert.rows[0];

            // Update master form row
            const formUpdate = await client.query(
                `UPDATE club_event_forms
                 SET published_version_id = $1,
                     status = 'published',
                     is_published = true,
                     published_at = NOW(),
                     version_count = version_count + 1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING
                    id,
                    event_id AS "eventId",
                    club_id AS "clubId",
                    created_by AS "createdBy",
                    title,
                    description,
                    status,
                    current_draft_version_id AS "currentDraftVersionId",
                    published_version_id AS "publishedVersionId",
                    header_image_url AS "headerImageUrl",
                    header_image_public_id AS "headerImagePublicId",
                    theme_settings AS "themeSettings",
                    settings,
                    default_settings AS "defaultSettings",
                    structure,
                    is_published AS "isPublished",
                    version_count AS "versionCount",
                    schema_version AS "schemaVersion",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt",
                    published_at AS "publishedAt";`,
                [newVersion.id, formRow.id]
            );

            await client.query("COMMIT;");

            // Invalidate Redis cached public form metadata (Requirement 4.2)
            if (redis && redis.status === "ready") {
                await redis.del(`orbix:form:public:${eventId}`);
                FormLogger.info("CACHE_INVALIDATED", `Form Version ${newVersion.versionNumber} published - cache cleared`, {
                    eventId,
                    clubId,
                    userId,
                });
            }

            return {
                success: true,
                version: newVersion,
                form: formUpdate.rows[0],
            };
        } catch (err: any) {
            await client.query("ROLLBACK;");
            FormLogger.error(
                "FORM_PUBLISH_ERROR",
                "Failed to publish form version",
                {
                    eventId,
                    userId,
                    meta: { error: err.message },
                },
                err
            );
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Unpublish or Close registrations
     */
    static async closeOrToggleStatus(
        eventId: string,
        userId: string,
        isOpen: boolean,
        closedMessage?: string
    ) {
        const evCheck = await query(`SELECT club_id AS "clubId" FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const res = await query(
            `UPDATE club_event_forms
             SET status = $1,
                 settings = jsonb_set(
                     jsonb_set(settings, '{isOpen}', $2::jsonb),
                     '{closedMessage}', $3::jsonb
                 ),
                 updated_at = NOW()
             WHERE event_id = $4
             RETURNING id, status, settings;`,
            [
                isOpen ? "published" : "closed",
                JSON.stringify(isOpen),
                JSON.stringify(closedMessage || "Registrations are currently closed."),
                eventId,
            ]
        );

        if (redis && redis.status === "ready") {
            await redis.del(`orbix:form:public:${eventId}`);
        }

        return res.rows[0];
    }

    /**
     * Revert current draft structure to an immutable version snapshot
     */
    static async revertToVersion(eventId: string, userId: string, versionId: string) {
        const evCheck = await query(`SELECT club_id AS "clubId" FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const versionRes = await query(
            `SELECT * FROM club_event_form_versions WHERE id = $1 AND event_id = $2 LIMIT 1;`,
            [versionId, eventId]
        );
        if (!versionRes.rows[0]) {
            const error: any = new Error("Form version snapshot not found.");
            error.statusCode = 404;
            throw error;
        }

        const v = versionRes.rows[0];

        const updated = await query(
            `UPDATE club_event_forms
             SET structure = $1,
                 settings = $2,
                 theme_settings = $3,
                 title = $4,
                 description = $5,
                 header_image_url = $6,
                 header_image_public_id = $7,
                 version_count = version_count + 1,
                 updated_at = NOW()
             WHERE event_id = $8
             RETURNING *;`,
            [
                JSON.stringify(v.structure),
                JSON.stringify(v.settings),
                JSON.stringify(v.theme_settings),
                v.title,
                v.description,
                v.header_image_url,
                v.header_image_public_id,
                eventId,
            ]
        );

        if (redis && redis.status === "ready") {
            await redis.del(`orbix:form:public:${eventId}`);
        }

        return updated.rows[0];
    }

    /**
     * Add question to a section
     */
    static async addQuestion(
        eventId: string,
        userId: string,
        sectionId: string,
        question: FormQuestion,
        targetIndex?: number
    ) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        const secIdx = structure.sections.findIndex((s) => s.id === sectionId);
        if (secIdx === -1) {
            const error: any = new Error("Section not found.");
            error.statusCode = 404;
            throw error;
        }

        const newQ: FormQuestion = {
            ...question,
            id: question.id?.trim() || generateStableId("q"),
            title: question.title?.trim() || "Untitled Question",
            required: Boolean(question.required),
        };

        const targetSec = structure.sections[secIdx];
        if (!targetSec) {
            const err: any = new Error("Target section not found.");
            err.statusCode = 404;
            throw err;
        }

        if (targetIndex !== undefined && targetIndex >= 0 && targetIndex <= targetSec.questions.length) {
            targetSec.questions.splice(targetIndex, 0, newQ);
        } else {
            targetSec.questions.push(newQ);
        }

        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Update an individual question by stable ID
     */
    static async updateQuestion(
        eventId: string,
        userId: string,
        questionId: string,
        updates: Partial<FormQuestion>
    ) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        let found = false;
        for (const sec of structure.sections) {
            const qIdx = sec.questions.findIndex((q) => q.id === questionId);
            if (qIdx !== -1) {
                sec.questions[qIdx] = {
                    ...sec.questions[qIdx],
                    ...updates,
                    id: questionId, // Keep stable ID immutable
                } as FormQuestion;
                found = true;
                break;
            }
        }

        if (!found) {
            const error: any = new Error(`Question with ID ${questionId} not found.`);
            error.statusCode = 404;
            throw error;
        }

        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Delete an individual question by stable ID
     */
    static async deleteQuestion(eventId: string, userId: string, questionId: string) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        let found = false;
        for (const sec of structure.sections) {
            const initialLen = sec.questions.length;
            sec.questions = sec.questions.filter((q) => q.id !== questionId);
            if (sec.questions.length < initialLen) {
                found = true;
                break;
            }
        }

        if (!found) {
            const error: any = new Error(`Question with ID ${questionId} not found.`);
            error.statusCode = 404;
            throw error;
        }

        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Add a new section
     */
    static async addSection(eventId: string, userId: string, section: Partial<FormSection>) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        const newSec: FormSection = {
            id: section.id?.trim() || generateStableId("sec"),
            title: section.title?.trim() || `Section ${structure.sections.length + 1}`,
            description: section.description || "",
            afterSectionAction: section.afterSectionAction || "next_section",
            questions: section.questions || [
                {
                    id: generateStableId("q"),
                    type: "short_answer",
                    title: "Untitled Question",
                    required: false,
                },
            ],
        };

        structure.sections.push(newSec);
        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Delete a section by stable ID
     */
    static async deleteSection(eventId: string, userId: string, sectionId: string) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        if (structure.sections.length <= 1) {
            const error: any = new Error("Cannot delete the only section of the form.");
            error.statusCode = 400;
            throw error;
        }

        structure.sections = structure.sections.filter((s) => s.id !== sectionId);
        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Reorder sections and questions while maintaining stable IDs
     */
    static async reorderStructure(
        eventId: string,
        userId: string,
        payload: ReorderStructurePayload
    ) {
        const form = await this.getFormForEvent(eventId, userId);
        let sections = [...form.form.structure.sections];

        if (payload.sectionOrder && Array.isArray(payload.sectionOrder)) {
            const secMap = new Map(sections.map((s) => [s.id, s]));
            const reorderedSecs: FormSection[] = [];
            for (const sId of payload.sectionOrder) {
                const s = secMap.get(sId);
                if (s) {
                    reorderedSecs.push(s);
                    secMap.delete(sId);
                }
            }
            // Append any sections not mentioned in sectionOrder
            secMap.forEach((s) => reorderedSecs.push(s));
            sections = reorderedSecs;
        }

        if (payload.questionOrder) {
            for (const sec of sections) {
                const qOrder = payload.questionOrder[sec.id];
                if (qOrder && Array.isArray(qOrder)) {
                    const qMap = new Map(sec.questions.map((q) => [q.id, q]));
                    const reorderedQuestions: FormQuestion[] = [];
                    for (const qId of qOrder) {
                        const q = qMap.get(qId);
                        if (q) {
                            reorderedQuestions.push(q);
                            qMap.delete(qId);
                        }
                    }
                    qMap.forEach((q) => reorderedQuestions.push(q));
                    sec.questions = reorderedQuestions;
                }
            }
        }

        return this.saveFormDraft(eventId, userId, { structure: { sections } });
    }

    /**
     * Import questions into a section (regenerating unique stable IDs to avoid collisions)
     */
    static async importQuestions(
        eventId: string,
        userId: string,
        questions: FormQuestion[],
        targetSectionId?: string
    ) {
        const form = await this.getFormForEvent(eventId, userId);
        const structure = { ...form.form.structure };

        let targetSec = structure.sections[0];
        if (targetSectionId) {
            const found = structure.sections.find((s) => s.id === targetSectionId);
            if (found) targetSec = found;
        }

        const freshQuestions = questions.map((q) => ({
            ...q,
            id: generateStableId("q"),
            options: q.options?.map((opt) => ({
                ...opt,
                id: generateStableId("opt"),
            })),
        }));

        if (targetSec) {
            targetSec.questions.push(...freshQuestions);
        } else {
            structure.sections.push({
                id: generateStableId("sec"),
                title: "Imported Questions",
                afterSectionAction: "submit_form",
                questions: freshQuestions,
            });
        }
        return this.saveFormDraft(eventId, userId, { structure });
    }

    /**
     * Phase 6.1 Question Library: Retrieve questions from club's previous events for reuse
     */
    static async getClubQuestionLibrary(eventId: string, userId: string): Promise<{
        success: boolean;
        library: Array<{
            eventId: string;
            eventTitle: string;
            formTitle: string;
            createdAt: string;
            sectionsCount: number;
            questions: FormQuestion[];
        }>;
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId" FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        const clubId = evCheck.rows[0].clubId;
        await this.assertStaffAccess(userId, clubId);

        const listRes = await query(
            `SELECT e.id AS "eventId", e.title AS "eventTitle", e.created_at AS "createdAt",
                    f.title AS "formTitle",
                    COALESCE(v.structure, f.structure) AS structure
             FROM club_events e
             JOIN club_event_forms f ON f.event_id = e.id
             LEFT JOIN club_event_form_versions v ON v.id = f.published_version_id
             WHERE e.club_id = $1 AND e.id != $2
             ORDER BY e.created_at DESC
             LIMIT 30;`,
            [clubId, eventId]
        );

        const library = listRes.rows.map((row) => {
            const structure: FormStructure = row.structure || { sections: [] };
            const questions: FormQuestion[] = [];
            (structure.sections || []).forEach((sec) => {
                (sec.questions || []).forEach((q) => {
                    if (q.type !== "image_card" && q.type !== "markdown_card") {
                        questions.push(q);
                    }
                });
            });
            return {
                eventId: row.eventId,
                eventTitle: row.eventTitle,
                formTitle: row.formTitle || row.eventTitle,
                createdAt: row.createdAt,
                sectionsCount: (structure.sections || []).length,
                questions,
            };
        }).filter((item) => item.questions.length > 0);

        return { success: true, library };
    }

    /**
     * Phase 6.3 AI-Assisted Form Creation: Suggest questionnaire based on event description & prompt
     */
    static async aiSuggestQuestions(
        eventId: string,
        userId: string,
        payload: { prompt?: string; eventType?: string; eventDescription?: string }
    ): Promise<{
        success: boolean;
        suggestedQuestions: FormQuestion[];
        generatedBy: "gemini" | "deterministic-engine";
        summary: string;
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId", title, summary, starts_at AS "startsAt" FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const event = evCheck.rows[0];
        const eventTitle = event.title || "Campus Event";
        const eventSummary = payload.eventDescription || event.summary || "";
        const userPrompt = payload.prompt || `Generate questions for ${eventTitle}`;

        const apiKey = process.env.GEMINI_API_KEY;
        let generatedQuestions: FormQuestion[] = [];
        let generatedBy: "gemini" | "deterministic-engine" = "deterministic-engine";
        let summary = "Questions generated tailored to your event requirements.";

        if (apiKey) {
            try {
                const systemPrompt = `You are an expert event organizer assistant for Orbix, a campus club event management platform.
Your task is to generate relevant, high-quality, practical registration questionnaire items based on the event description or user prompt.
Respond with a STRICT JSON array of question objects matching this schema:
[
  {
    "title": string,
    "description": string,
    "type": "short_answer" | "paragraph" | "multiple_choice" | "checkboxes" | "dropdown" | "linear_scale" | "file_upload" | "date" | "time",
    "required": boolean,
    "options": [{ "text": string }],
    "scaleConfig": { "min": 1, "max": 5, "minLabel": "Beginner", "maxLabel": "Advanced" }
  }
]
Do not output markdown code blocks, backticks, or any conversational text. Return between 4 and 8 tailored questions.`;

                const promptText = `Event Title: ${eventTitle}
Event Description: ${eventSummary}
Organizer Request: ${userPrompt}`;

                const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: [{ parts: [{ text: promptText }] }],
                        generationConfig: {
                            response_mime_type: "application/json",
                            temperature: 0.3,
                        },
                    }),
                });

                if (res.ok) {
                    const data = await res.json();
                    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (text) {
                        const parsed = JSON.parse(text);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            generatedQuestions = parsed.map((item: any) => ({
                                id: generateStableId("q"),
                                type: item.type || "short_answer",
                                title: item.title || "Custom Question",
                                description: item.description || undefined,
                                required: Boolean(item.required),
                                options: Array.isArray(item.options)
                                    ? item.options.map((opt: any) => ({
                                          id: generateStableId("opt"),
                                          text: typeof opt === "string" ? opt : (opt.text || "Option"),
                                      }))
                                    : undefined,
                                scaleConfig: item.scaleConfig || undefined,
                            }));
                            generatedBy = "gemini";
                            summary = `Gemini AI generated ${generatedQuestions.length} tailored questions for "${eventTitle}".`;
                        }
                    }
                }
            } catch (aiErr) {
                console.warn("[aiSuggestQuestions] Gemini call failed, falling back to deterministic generator:", aiErr);
            }
        }

        // Resilient Fallback Engine if Gemini is unavailable or not configured
        if (generatedQuestions.length === 0) {
            generatedQuestions = ClubEventFormService.generateDeterministicFallbackQuestions(eventTitle, userPrompt);
            generatedBy = "deterministic-engine";
            summary = `Deterministic template engine generated ${generatedQuestions.length} tailored questions for "${eventTitle}".`;
        }

        return {
            success: true,
            suggestedQuestions: generatedQuestions,
            generatedBy,
            summary,
        };
    }

    /**
     * Resilient deterministic fallback generator when AI API key is not present or offline (Phase 6.3)
     */
    static generateDeterministicFallbackQuestions(eventTitle: string, promptText: string): FormQuestion[] {
        const lower = `${eventTitle} ${promptText}`.toLowerCase();

        if (lower.includes("hackathon") || lower.includes("hack")) {
            return [
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Participation Track",
                    description: "Select the primary challenge theme your project will target.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "AI & Autonomous Agents" },
                        { id: generateStableId("opt"), text: "Web3 & Decentralized Apps" },
                        { id: generateStableId("opt"), text: "FinTech & Open Banking" },
                        { id: generateStableId("opt"), text: "Healthcare & MedTech" },
                        { id: generateStableId("opt"), text: "Open Innovation Track" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "checkboxes",
                    title: "Core Technical Stack",
                    description: "Select frameworks and languages you intend to build with.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "React / Next.js / TypeScript" },
                        { id: generateStableId("opt"), text: "Python / FastAPI / PyTorch" },
                        { id: generateStableId("opt"), text: "Node.js / Express / PostgreSQL" },
                        { id: generateStableId("opt"), text: "Flutter / React Native" },
                        { id: generateStableId("opt"), text: "Go / Rust / Systems" },
                        { id: generateStableId("opt"), text: "Cloud / Docker / Kubernetes" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "short_answer",
                    title: "GitHub or Portfolio URL",
                    description: "Share a link showcasing your code, repositories, or previous hacks.",
                    required: false,
                },
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Team Registration Status",
                    description: "Are you applying with a pre-formed team or seeking teammates?",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "Registered Team Lead (Registering team)" },
                        { id: generateStableId("opt"), text: "Team Member (Joining an existing team)" },
                        { id: generateStableId("opt"), text: "Solo Hacker (Seeking a team at mixer)" },
                        { id: generateStableId("opt"), text: "Solo Hacker (Building independently)" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "dropdown",
                    title: "T-Shirt Size & Logistics",
                    description: "For hackathon kit distribution.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "Small (S)" },
                        { id: generateStableId("opt"), text: "Medium (M)" },
                        { id: generateStableId("opt"), text: "Large (L)" },
                        { id: generateStableId("opt"), text: "Extra Large (XL)" },
                        { id: generateStableId("opt"), text: "Double Extra Large (XXL)" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "paragraph",
                    title: "Preliminary Project Pitch / Concept",
                    description: "A brief 2-3 sentence overview of the problem you aim to solve.",
                    required: false,
                },
            ];
        }

        if (lower.includes("workshop") || lower.includes("bootcamp") || lower.includes("hands-on")) {
            return [
                {
                    id: generateStableId("q"),
                    type: "linear_scale",
                    title: "Current Topic Familiarity",
                    description: "Rate your existing experience with the subject matter.",
                    required: true,
                    scaleConfig: { min: 1, max: 5, minLabel: "Absolute Beginner", maxLabel: "Proficient" },
                },
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Primary Laptop Operating System",
                    description: "Helps instructors verify prerequisite commands.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "macOS (Apple Silicon / Intel)" },
                        { id: generateStableId("opt"), text: "Windows 11 / WSL2" },
                        { id: generateStableId("opt"), text: "Linux (Ubuntu / Fedora / Arch)" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "checkboxes",
                    title: "Prerequisite Software Setup",
                    description: "Check all items already installed on your device.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "Git & GitHub CLI installed" },
                        { id: generateStableId("opt"), text: "Node.js v20+ or Python 3.11+" },
                        { id: generateStableId("opt"), text: "Visual Studio Code or Cursor" },
                        { id: generateStableId("opt"), text: "Docker Desktop installed" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "paragraph",
                    title: "What is your main goal for this workshop?",
                    description: "What project or practical capability do you want to achieve?",
                    required: true,
                },
            ];
        }

        if (lower.includes("competition") || lower.includes("contest") || lower.includes("cp") || lower.includes("coding")) {
            return [
                {
                    id: generateStableId("q"),
                    type: "short_answer",
                    title: "Competitive Programming Profile",
                    description: "LeetCode, Codeforces, or CodeChef username/handle.",
                    required: true,
                },
                {
                    id: generateStableId("q"),
                    type: "dropdown",
                    title: "Primary Contest Language",
                    description: "Select your preferred submission compiler.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "C++ (GCC 14 / C++20)" },
                        { id: generateStableId("opt"), text: "Java (OpenJDK 21)" },
                        { id: generateStableId("opt"), text: "Python (PyPy 3.10)" },
                        { id: generateStableId("opt"), text: "Rust (Edition 2021)" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Experience Tier",
                    description: "Select your bracket level.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "Novice Bracket (First year / beginners)" },
                        { id: generateStableId("opt"), text: "Intermediate Bracket" },
                        { id: generateStableId("opt"), text: "Grandmaster / Open Bracket" },
                    ],
                },
            ];
        }

        if (lower.includes("recruit") || lower.includes("hiring") || lower.includes("team") || lower.includes("induction")) {
            return [
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Primary Department Preference",
                    description: "Choose the wing of the club you are most eager to join.",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "Technical & Software Engineering" },
                        { id: generateStableId("opt"), text: "UI/UX & Creative Graphic Design" },
                        { id: generateStableId("opt"), text: "Event Logistics & Stage Management" },
                        { id: generateStableId("opt"), text: "Corporate Relations, PR & Sponsorship" },
                        { id: generateStableId("opt"), text: "Media, Content & Social Strategy" },
                    ],
                },
                {
                    id: generateStableId("q"),
                    type: "paragraph",
                    title: "Why do you want to join our organization?",
                    description: "Share your motivation, relevant skills, and expectations.",
                    required: true,
                },
                {
                    id: generateStableId("q"),
                    type: "short_answer",
                    title: "Portfolio, GitHub, or LinkedIn URL",
                    description: "Provide a link highlighting your previous projects or work.",
                    required: false,
                },
                {
                    id: generateStableId("q"),
                    type: "multiple_choice",
                    title: "Weekly Time Commitment",
                    description: "How many hours per week can you actively dedicate?",
                    required: true,
                    options: [
                        { id: generateStableId("opt"), text: "3 to 5 hours / week" },
                        { id: generateStableId("opt"), text: "6 to 10 hours / week" },
                        { id: generateStableId("opt"), text: "10+ hours / week" },
                    ],
                },
            ];
        }

        // Standard Default Event Questionnaire
        return [
            {
                id: generateStableId("q"),
                type: "multiple_choice",
                title: "How did you find out about this event?",
                description: "Help us understand our most effective outreach channels.",
                required: false,
                options: [
                    { id: generateStableId("opt"), text: "Campus WhatsApp & Discord Channels" },
                    { id: generateStableId("opt"), text: "Instagram Story & Club Page" },
                    { id: generateStableId("opt"), text: "Campus Posters & Notice Boards" },
                    { id: generateStableId("opt"), text: "Classmate / Peer Recommendation" },
                ],
            },
            {
                id: generateStableId("q"),
                type: "linear_scale",
                title: "Familiarity with Event Agenda",
                description: "Rate your background knowledge.",
                required: false,
                scaleConfig: { min: 1, max: 5, minLabel: "Introductory", maxLabel: "Expert" },
            },
            {
                id: generateStableId("q"),
                type: "paragraph",
                title: "Specific Questions or Expectations",
                description: "What would you like the organizers to address during the session?",
                required: false,
            },
        ];
    }

    /**
     * List all immutable form versions for an event
     */
    static async getFormVersions(eventId: string, userId: string): Promise<{
        versions: (FormVersionRecord & { responseCount: number })[];
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId" FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const versionsRes = await query(
            `SELECT v.id, v.form_id AS "formId", v.event_id AS "eventId", v.version_number AS "versionNumber",
                    v.title, v.description, v.header_image_url AS "headerImageUrl",
                    v.header_image_public_id AS "headerImagePublicId", v.structure, v.settings,
                    v.theme_settings AS "themeSettings", v.change_summary AS "changeSummary",
                    v.is_published AS "isPublished", v.published_by AS "publishedBy",
                    v.created_by AS "createdBy", v.created_at AS "createdAt", v.published_at AS "publishedAt",
                    COALESCE((
                        SELECT COUNT(*)::int
                        FROM club_event_registrations r
                        WHERE r.form_version_id = v.id AND r.status NOT IN ('cancelled', 'rejected')
                    ), 0) AS "responseCount"
             FROM club_event_form_versions v
             WHERE v.event_id = $1
             ORDER BY v.version_number DESC;`,
            [eventId]
        );

        return { versions: versionsRes.rows };
    }

    /**
     * Get exact snapshot of a specific form version
     */
    static async getFormVersionSnapshot(eventId: string, versionId: string): Promise<FormVersionRecord> {
        const res = await query(
            `SELECT id, form_id AS "formId", event_id AS "eventId", version_number AS "versionNumber",
                    title, description, header_image_url AS "headerImageUrl",
                    header_image_public_id AS "headerImagePublicId", structure, settings,
                    theme_settings AS "themeSettings", change_summary AS "changeSummary",
                    is_published AS "isPublished", published_by AS "publishedBy",
                    created_by AS "createdBy", created_at AS "createdAt", published_at AS "publishedAt"
             FROM club_event_form_versions
             WHERE id = $1 AND event_id = $2 LIMIT 1;`,
            [versionId, eventId]
        );

        if (!res.rows[0]) {
            const error: any = new Error("Form version not found.");
            error.statusCode = 404;
            throw error;
        }

        return res.rows[0];
    }

    /**
     * Register a media asset in the database
     */
    static async registerMediaAsset(data: {
        formId?: string | null;
        eventId?: string | null;
        uploaderUserId?: string | null;
        publicId: string;
        secureUrl: string;
        resourceType?: string;
        format?: string | null;
        bytes?: number | null;
        width?: number | null;
        height?: number | null;
        assetPurpose: "form_header" | "question_image" | "option_image" | "student_attachment";
        questionId?: string | null;
        responseId?: string | null;
        metadata?: Record<string, any>;
    }): Promise<MediaAssetRecord> {
        const res = await query(
            `INSERT INTO club_form_media_assets (
                form_id, event_id, uploader_user_id, public_id, secure_url, resource_type,
                format, bytes, width, height, asset_purpose, question_id, response_id, metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (public_id) DO UPDATE SET
                secure_url = EXCLUDED.secure_url,
                bytes = COALESCE(EXCLUDED.bytes, club_form_media_assets.bytes),
                response_id = COALESCE(EXCLUDED.response_id, club_form_media_assets.response_id),
                question_id = COALESCE(EXCLUDED.question_id, club_form_media_assets.question_id)
            RETURNING
                id, form_id AS "formId", event_id AS "eventId", uploader_user_id AS "uploaderUserId",
                public_id AS "publicId", secure_url AS "secureUrl", resource_type AS "resourceType",
                format, bytes, width, height, asset_purpose AS "assetPurpose",
                question_id AS "questionId", response_id AS "responseId", metadata, created_at AS "createdAt";`,
            [
                data.formId || null,
                data.eventId || null,
                data.uploaderUserId || null,
                data.publicId,
                data.secureUrl,
                data.resourceType || "image",
                data.format || null,
                data.bytes || null,
                data.width || null,
                data.height || null,
                data.assetPurpose,
                data.questionId || null,
                data.responseId || null,
                JSON.stringify(data.metadata || {}),
            ]
        );

        return res.rows[0];
    }

    /**
     * Generate Cloudinary signed credentials for media upload
     */
    static async generateUploadSignature(
        eventId: string,
        userId: string,
        purpose: "banner" | "question" | "attachment",
        options?: { questionId?: string; fileType?: string }
    ) {
        // Enforce club staff authorization for form banners and question images
        if (purpose === "banner" || purpose === "question") {
            const evCheck = await query(`SELECT club_id AS "clubId" FROM club_events WHERE id = $1 LIMIT 1;`, [eventId]);
            if (!evCheck.rows[0]) {
                const error: any = new Error("Event not found.");
                error.statusCode = 404;
                throw error;
            }
            await this.assertStaffAccess(userId, evCheck.rows[0].clubId);
        }

        const { cloudName, apiKey, apiSecret } = assertCloudinaryConfigured();
        const timestamp = Math.round(new Date().getTime() / 1000);

        let folder = `orbix/forms/${eventId}`;
        let maxBytes = 10 * 1024 * 1024; // 10MB
        let allowedFormats: string[] = ["jpg", "jpeg", "png", "webp"];

        if (purpose === "banner") {
            folder = `orbix/forms/${eventId}/banners`;
            maxBytes = 8 * 1024 * 1024;
        } else if (purpose === "question") {
            folder = `orbix/forms/${eventId}/questions`;
            maxBytes = 8 * 1024 * 1024;
        } else if (purpose === "attachment") {
            folder = `orbix/forms/${eventId}/attachments/${userId}`;
            maxBytes = 25 * 1024 * 1024;
            allowedFormats = ["pdf", "jpg", "jpeg", "png", "webp", "zip", "docx", "xlsx", "csv"];
        }

        const publicId = `${folder}/${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const paramsToSign: Record<string, any> = {
            folder,
            public_id: publicId,
            timestamp,
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        return {
            cloudName,
            apiKey,
            timestamp,
            publicId,
            folder,
            signature,
            uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
            maxBytes,
            allowedFormats,
        };
    }

    /**
     * Submit Form Response with:
     * - Atomic Transaction (`BEGIN ... COMMIT`)
     * - Atomic Capacity Lock (`SELECT ... FOR UPDATE`)
     * - Idempotency Guard (Prevents double clicks and duplicate submissions)
     * - Single response enforcement per student
     * - Server-side validation against the active published snapshot
     * - Tracking of media assets in club_form_media_assets
     */
    static async submitFormResponse(
        eventId: string,
        userId: string | undefined,
        payload: FormSubmissionPayload
    ): Promise<{
        success: boolean;
        message: string;
        registration: any;
        isUpdate: boolean;
    }> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // 1. Idempotency Check
            if (payload.idempotencyKey) {
                const idemRes = await client.query(
                    `SELECT id, event_id AS "eventId", club_id AS "clubId", status,
                            ticket_code AS "ticketCode", registered_at AS "registeredAt"
                     FROM club_event_registrations
                     WHERE idempotency_key = $1 LIMIT 1;`,
                    [payload.idempotencyKey]
                );
                if (idemRes.rows[0]) {
                    await client.query("COMMIT;");
                    return {
                        success: true,
                        message: "Your submission has already been recorded.",
                        registration: idemRes.rows[0],
                        isUpdate: false,
                    };
                }
            }

            // 2. Atomic Capacity Lock on Event
            const evRes = await client.query(
                `SELECT e.id, e.club_id AS "clubId", e.title, e.status, e.capacity,
                        e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.eligibility,
                        c.college_id AS "clubCollegeId"
                 FROM club_events e
                 JOIN verified_clubs c ON c.id = e.club_id
                 WHERE e.id = $1 FOR UPDATE;`,
                [eventId]
            );

            if (!evRes.rows[0]) {
                const error: any = new Error("Event not found.");
                error.statusCode = 404;
                throw error;
            }

            const event = evRes.rows[0];

            if (event.status === "completed" || event.status === "cancelled") {
                const error: any = new Error(`Cannot register: Event is already ${event.status}.`);
                error.statusCode = 400;
                throw error;
            }

            // 3. Fetch Form and Active Published Snapshot
            const formRes = await client.query(
                `SELECT f.id, f.title, f.settings, f.status, f.published_version_id AS "publishedVersionId",
                        f.structure AS "draftStructure",
                        v.structure AS "publishedStructure",
                        v.id AS "activeVersionId"
                 FROM club_event_forms f
                 LEFT JOIN club_event_form_versions v ON v.id = f.published_version_id
                 WHERE f.event_id = $1 FOR UPDATE;`,
                [eventId]
            );

            const formRow = formRes.rows[0];
            const formSettings: FormSettings = formRow?.settings || {
                isOpen: true,
                closedMessage: "Registrations are currently closed.",
                maxResponses: null,
                limitOneResponse: true,
                allowEditResponse: false,
                requireLogin: true,
                showProgressBar: true,
                confirmationMessage: "Thank you for registering!",
                notifyOnRegistration: true,
            };

            const isFormOpen = formSettings.responses ? formSettings.responses.isOpen : formSettings.isOpen;
            if (!isFormOpen || formRow?.status === "closed") {
                const error: any = new Error(formSettings.closedMessage || "Registrations are currently closed.");
                error.statusCode = 403;
                throw error;
            }

            // Scheduled closing date/time check
            const closingDateTime = formSettings.responses?.closingDateTime;
            if (closingDateTime && new Date() > new Date(closingDateTime)) {
                const error: any = new Error(formSettings.closedMessage || `Registrations closed on ${new Date(closingDateTime).toLocaleString()}.`);
                error.statusCode = 403;
                throw error;
            }

            // Event registration deadline check
            if (event.registrationDeadline && new Date() > new Date(event.registrationDeadline)) {
                const error: any = new Error("The event registration deadline has passed.");
                error.statusCode = 403;
                throw error;
            }

            // Event status check
            if (event.status === "completed" || event.status === "cancelled") {
                const error: any = new Error(`Cannot register: This event is ${event.status}.`);
                error.statusCode = 403;
                throw error;
            }

            // Atomic Capacity Check (Requirement 4.3)
            const countRes = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM club_event_registrations
                 WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
                [eventId]
            );
            const currentCount = Math.max(countRes.rows[0]?.count || 0, event.registeredCount || 0);

            const maxResponsesCap = formSettings.responses?.maxResponses ?? formSettings.maxResponses ?? event.capacity;
            if (maxResponsesCap !== null && maxResponsesCap !== undefined && maxResponsesCap > 0 && currentCount >= maxResponsesCap) {
                FormLogger.warn("CAPACITY_CONFLICT", "Registration attempt rejected: event capacity limit reached", {
                    eventId,
                    clubId: event.clubId,
                    userId,
                    meta: { currentCount, capacity: maxResponsesCap },
                });
                const error: any = new Error("Registration limit has been reached for this event.");
                error.statusCode = 409;
                throw error;
            }

            if (event.capacity && currentCount >= event.capacity) {
                FormLogger.warn("CAPACITY_CONFLICT", "Registration attempt rejected: venue capacity reached", {
                    eventId,
                    clubId: event.clubId,
                    userId,
                    meta: { currentCount, capacity: event.capacity },
                });
                const error: any = new Error("Event venue / participation capacity has been reached.");
                error.statusCode = 409;
                throw error;
            }

            // 4. Authenticated Student Verification
            if (formSettings.requireLogin && !userId) {
                const error: any = new Error("Authentication required: Please sign in with your Orbix account to register.");
                error.statusCode = 401;
                throw error;
            }

            let userRow: any = null;
            if (userId) {
                const uRes = await client.query(
                    `SELECT id, username, email, firstname, lastname, college_id, roll_number, department, year_of_study, phone
                     FROM users WHERE id = $1 LIMIT 1;`,
                    [userId]
                );
                userRow = uRes.rows[0];
            }

            // Campus Eligibility Check
            if (event.eligibility === "college_only" && event.clubCollegeId && userRow) {
                if (userRow.college_id !== event.clubCollegeId) {
                    const error: any = new Error("Campus Restricted: This event is only open to students of the organizing college.");
                    error.statusCode = 403;
                    throw error;
                }
            }

            // 5. Server-Side Schema Validation against the Published Version
            if (!formRow?.publishedVersionId && !formRow?.isPublished) {
                const error: any = new Error("Registration is currently closed: This form has not been published yet.");
                error.statusCode = 403;
                throw error;
            }

            const activeStructure: FormStructure = formRow?.publishedStructure || formRow?.draftStructure || { sections: [] };
            const rawAnswers = payload.answers || {};
            const answers = sanitizeStudentAnswers(rawAnswers);
            const fileAttachments = payload.fileAttachments || [];

            // Validate file attachment security, MIME restrictions, size limits, and Cloudinary upload ownership (Phase 5)
            for (const att of fileAttachments) {
                const matchingQ = (activeStructure.sections || [])
                    .flatMap((s) => s.questions || [])
                    .find((q) => q.id === att.questionId);
                const allowedTypes = matchingQ?.validation?.allowedFileTypes;

                const secValidation = validateAttachmentSecurity(att, allowedTypes);
                if (!secValidation.valid) {
                    const error: any = new Error(secValidation.error || `Invalid file attachment "${att.fileName}".`);
                    error.statusCode = 400;
                    throw error;
                }

                // Enforce Cloudinary upload ownership path for authenticated student
                if (att.filePublicId && att.filePublicId !== "verified_profile_resume" && userId) {
                    const expectedPrefix = `orbix/forms/${eventId}/attachments/${userId}`;
                    if (!att.filePublicId.startsWith(expectedPrefix)) {
                        const assetCheck = await client.query(
                            `SELECT id FROM club_form_media_assets
                             WHERE public_id = $1 AND uploader_user_id = $2 LIMIT 1;`,
                            [att.filePublicId, userId]
                        );
                        if (!assetCheck.rows[0]) {
                            const error: any = new Error(`Unauthorized file upload metadata for "${att.fileName}".`);
                            error.statusCode = 403;
                            throw error;
                        }
                    }
                }
            }

            for (const section of activeStructure.sections || []) {
                for (const question of section.questions || []) {
                    if (question.type === "image_card" || question.type === "markdown_card") continue;

                    const val = answers[question.id];
                    const isProvided = val !== undefined && val !== null && (typeof val === "string" ? val.trim() !== "" : true);

                    if (question.required) {
                        if (question.type === "file_upload") {
                            const hasFile = fileAttachments.some((f: any) => f.questionId === question.id);
                            if (!hasFile) {
                                const error: any = new Error(`Required file missing: Please upload a file for "${question.title}".`);
                                error.statusCode = 400;
                                throw error;
                            }
                        } else if (!isProvided) {
                            const error: any = new Error(`Required question unanswered: "${question.title}".`);
                            error.statusCode = 400;
                            throw error;
                        }
                    }

                    if (typeof val === "string" && val.trim().length > 0) {
                        if (question.validation?.minLength && val.trim().length < question.validation.minLength) {
                            const error: any = new Error(`"${question.title}" must be at least ${question.validation.minLength} characters.`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (question.validation?.maxLength && val.trim().length > question.validation.maxLength) {
                            const error: any = new Error(`"${question.title}" cannot exceed ${question.validation.maxLength} characters.`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (question.validation?.pattern) {
                            try {
                                const regex = new RegExp(question.validation.pattern);
                                if (!regex.test(val.trim())) {
                                    const error: any = new Error(question.validation.patternError || `Invalid format for "${question.title}".`);
                                    error.statusCode = 400;
                                    throw error;
                                }
                            } catch {}
                        }
                    }

                    if (question.type === "checkboxes" && Array.isArray(val)) {
                        if (question.validation?.minSelected && val.length < question.validation.minSelected) {
                            const error: any = new Error(`Please select at least ${question.validation.minSelected} option(s) for "${question.title}".`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (question.validation?.maxSelected && val.length > question.validation.maxSelected) {
                            const error: any = new Error(`Please select at most ${question.validation.maxSelected} option(s) for "${question.title}".`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (question.validation?.exactSelected && val.length !== question.validation.exactSelected) {
                            const error: any = new Error(`Please select exactly ${question.validation.exactSelected} option(s) for "${question.title}".`);
                            error.statusCode = 400;
                            throw error;
                        }
                    }

                    // Number validation
                    if (question.type === "short_answer" && question.validation?.numberType && val !== undefined && val !== "") {
                        const numVal = Number(val);
                        if (isNaN(numVal)) {
                            const error: any = new Error(`"${question.title}" must be a valid number.`);
                            error.statusCode = 400;
                            throw error;
                        }
                        const t = question.validation.numberType;
                        const target = Number(question.validation.numberValue ?? 0);
                        const target2 = Number(question.validation.numberValue2 ?? 0);
                        if (t === "greater_than" && numVal <= target) {
                            const error: any = new Error(`"${question.title}" must be greater than ${target}.`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (t === "less_than" && numVal >= target) {
                            const error: any = new Error(`"${question.title}" must be less than ${target}.`);
                            error.statusCode = 400;
                            throw error;
                        }
                        if (t === "between" && (numVal < target || numVal > target2)) {
                            const error: any = new Error(`"${question.title}" must be between ${target} and ${target2}.`);
                            error.statusCode = 400;
                            throw error;
                        }
                    }

                    // Rating validation
                    if (question.type === "rating" && val !== undefined && val !== null) {
                        const maxLevels = question.ratingConfig?.levels || 5;
                        const ratingNum = Number(val);
                        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > maxLevels) {
                            const error: any = new Error(`Rating for "${question.title}" must be between 1 and ${maxLevels}.`);
                            error.statusCode = 400;
                            throw error;
                        }
                    }

                    // Grid validation
                    if ((question.type === "multiple_choice_grid" || question.type === "checkbox_grid") && question.gridConfig) {
                        const rows = question.gridConfig.rows || [];
                        if (question.gridConfig.requireEachRow) {
                            for (const row of rows) {
                                const rowAns = val?.[row];
                                if (!rowAns || (Array.isArray(rowAns) && rowAns.length === 0)) {
                                    const error: any = new Error(`Please provide a response for row "${row}" in "${question.title}".`);
                                    error.statusCode = 400;
                                    throw error;
                                }
                            }
                        }
                        if (question.gridConfig.limitOnePerColumn && question.type === "multiple_choice_grid" && val) {
                            const seenCols = new Set<string>();
                            for (const row of rows) {
                                const colSelected = val[row];
                                if (colSelected) {
                                    if (seenCols.has(colSelected)) {
                                        const error: any = new Error(`Cannot select column "${colSelected}" more than once in "${question.title}".`);
                                        error.statusCode = 400;
                                        throw error;
                                    }
                                    seenCols.add(colSelected);
                                }
                            }
                        }
                    }
                }
            }

            // Candidate Name & Contact fallback
            const defaultName = userRow?.firstname
                ? `${userRow.firstname} ${userRow.lastname || ""}`.trim()
                : userRow?.username || "Student";
            const applicantName = (payload.applicantName && payload.applicantName.trim()) || answers["q_student_name"] || defaultName;
            const applicantEmail = (payload.applicantEmail && payload.applicantEmail.trim()) || answers["q_student_email"] || userRow?.email || "";
            const department = payload.department || answers["q_department"] || userRow?.department || null;
            const yearOfStudy = payload.yearOfStudy || answers["q_year"] || userRow?.year_of_study || null;
            const rollNumber = payload.rollNumber || answers["q_roll_number"] || userRow?.roll_number || null;
            const phoneNumber = payload.phoneNumber || answers["q_phone"] || userRow?.phone || null;
            const notes = payload.notes || answers["q_notes"] || null;
            const formVersionId = formRow?.activeVersionId || null;
            const formId = formRow?.id || null;

            // Phase 3 Quiz Grading Calculation
            let quizScore: number | null = null;
            let quizMaxScore: number | null = null;
            let quizGradedAnswers: Record<string, any> | null = null;
            let quizGradesReleased = false;

            if (formSettings.quiz?.isQuiz) {
                quizScore = 0;
                quizMaxScore = 0;
                quizGradedAnswers = {};

                for (const section of activeStructure.sections || []) {
                    for (const question of section.questions || []) {
                        if (
                            question.type === "image_card" ||
                            question.type === "image_block" ||
                            question.type === "video_block" ||
                            question.type === "markdown_card" ||
                            question.type === "title_card"
                        ) {
                            continue;
                        }

                        const qPoints = question.points ?? formSettings.quiz?.defaultPointsPerQuestion ?? 1;
                        const correctAnswers = question.correctAnswers || [];
                        quizMaxScore += qPoints;

                        const studentAns = answers[question.id];
                        let earned = 0;
                        let isCorrect = false;

                        if (question.type === "multiple_choice" || question.type === "dropdown") {
                            if (studentAns && correctAnswers.includes(String(studentAns).trim())) {
                                earned = qPoints;
                                isCorrect = true;
                            }
                        } else if (question.type === "checkboxes") {
                            const selectedArr = Array.isArray(studentAns)
                                ? studentAns.map((s: any) => String(s).trim())
                                : [];
                            if (question.allowPartialCredit && correctAnswers.length > 0) {
                                const correctPicks = selectedArr.filter((a) => correctAnswers.includes(a)).length;
                                const incorrectPicks = selectedArr.filter((a) => !correctAnswers.includes(a)).length;
                                const raw =
                                    (correctPicks / correctAnswers.length) * qPoints -
                                    (incorrectPicks / correctAnswers.length) * (qPoints * 0.5);
                                earned = Math.max(0, Math.round(raw * 10) / 10);
                                isCorrect = earned === qPoints;
                            } else {
                                const match =
                                    selectedArr.length === correctAnswers.length &&
                                    selectedArr.every((a) => correctAnswers.includes(a));
                                if (match) {
                                    earned = qPoints;
                                    isCorrect = true;
                                }
                            }
                        } else if (question.type === "short_answer") {
                            if (
                                studentAns &&
                                correctAnswers.some((c) => c.trim().toLowerCase() === String(studentAns).trim().toLowerCase())
                            ) {
                                earned = qPoints;
                                isCorrect = true;
                            }
                        }

                        quizScore += earned;
                        quizGradedAnswers[question.id] = {
                            earnedPoints: earned,
                            maxPoints: qPoints,
                            isCorrect,
                            studentAnswer: studentAns,
                            feedback: question.answerExplanation || null,
                            links: question.feedbackLinks || [],
                        };
                    }
                }

                if (formSettings.quiz.releaseGrades === "immediately") {
                    quizGradesReleased = true;
                }
            }

            // 6. Check Existing Registration
            if (userId) {
                const existingReg = await client.query(
                    `SELECT id, status, ticket_code FROM club_event_registrations
                     WHERE event_id = $1 AND user_id = $2 FOR UPDATE;`,
                    [eventId, userId]
                );

                if (existingReg.rows[0]) {
                    const currentStatus = existingReg.rows[0].status;
                    if (currentStatus === "blocked") {
                        const error: any = new Error("Access Restricted: You don't have permission to register for this event.");
                        error.statusCode = 403;
                        throw error;
                    }

                    if (currentStatus === "registered" || currentStatus === "attended" || currentStatus === "pending") {
                        const canEdit = Boolean(
                            formSettings.allowEditResponse ||
                            (formSettings as any).allowEditResponses ||
                            formSettings.responses?.allowEditResponse ||
                            (formSettings.responses as any)?.allowEditResponses
                        );
                        if (!canEdit) {
                            const error: any = new Error("You have already submitted a response for this event. Response editing is not permitted.");
                            error.statusCode = 409;
                            throw error;
                        }

                        if (event.startsAt && new Date(event.startsAt).getTime() < Date.now()) {
                            const error: any = new Error("Response editing is not permitted once the event has started.");
                            error.statusCode = 403;
                            throw error;
                        }

                        // Update response
                        const updateRes = await client.query(
                            `UPDATE club_event_registrations
                             SET applicant_name = COALESCE($1, applicant_name),
                                 applicant_email = COALESCE($2, applicant_email),
                                 department = COALESCE($3, department),
                                 year_of_study = COALESCE($4, year_of_study),
                                 roll_number = COALESCE($5, roll_number),
                                 phone_number = COALESCE($6, phone_number),
                                 notes = COALESCE($7, notes),
                                 answers = $8,
                                 form_response = $8,
                                 file_attachments = $9,
                                 form_id = COALESCE($10, form_id),
                                 form_version_id = COALESCE($11, form_version_id),
                                 idempotency_key = COALESCE($12, idempotency_key),
                                 quiz_score = $13,
                                 quiz_max_score = $14,
                                 quiz_graded_answers = $15,
                                 quiz_grades_released = $16,
                                 last_updated_at = NOW(),
                                 updated_at = NOW()
                             WHERE id = $17
                             RETURNING id, event_id AS "eventId", club_id AS "clubId", status, ticket_code AS "ticketCode",
                                       applicant_name AS "applicantName", applicant_email AS "applicantEmail",
                                       department, year_of_study AS "yearOfStudy", roll_number AS "rollNumber",
                                       phone_number AS "phoneNumber", answers, file_attachments AS "fileAttachments", notes,
                                       form_version_id AS "formVersionId",
                                       quiz_score AS "quizScore", quiz_max_score AS "quizMaxScore",
                                       quiz_graded_answers AS "quizGradedAnswers", quiz_grades_released AS "quizGradesReleased",
                                       registered_at AS "registeredAt";`,
                            [
                                applicantName,
                                applicantEmail,
                                department,
                                yearOfStudy,
                                rollNumber,
                                phoneNumber,
                                notes,
                                JSON.stringify(answers),
                                JSON.stringify(fileAttachments),
                                formId,
                                formVersionId,
                                payload.idempotencyKey || null,
                                quizScore,
                                quizMaxScore,
                                quizGradedAnswers ? JSON.stringify(quizGradedAnswers) : null,
                                quizGradesReleased,
                                existingReg.rows[0].id,
                            ]
                        );

                        // Track media assets
                        for (const att of fileAttachments) {
                            if (att.filePublicId) {
                                await this.registerMediaAsset({
                                    formId,
                                    eventId,
                                    uploaderUserId: userId,
                                    publicId: att.filePublicId,
                                    secureUrl: att.fileUrl,
                                    assetPurpose: "student_attachment",
                                    questionId: att.questionId,
                                    responseId: updateRes.rows[0].id,
                                    bytes: att.fileSize,
                                });
                            }
                        }

                        await client.query("COMMIT;");
                        return {
                            success: true,
                            message: formSettings.confirmationMessage || "Your response has been updated successfully!",
                            registration: updateRes.rows[0],
                            isUpdate: true,
                        };
                    }

                    if (currentStatus === "cancelled" || currentStatus === "rejected") {
                        const reactivated = await client.query(
                            `UPDATE club_event_registrations
                             SET status = 'pending',
                                 applicant_name = $1,
                                 applicant_email = $2,
                                 department = $3,
                                 year_of_study = $4,
                                 roll_number = $5,
                                 phone_number = $6,
                                 notes = $7,
                                 answers = $8,
                                 form_response = $8,
                                 file_attachments = $9,
                                 form_id = COALESCE($10, form_id),
                                 form_version_id = COALESCE($11, form_version_id),
                                 idempotency_key = COALESCE($12, idempotency_key),
                                 quiz_score = $13,
                                 quiz_max_score = $14,
                                 quiz_graded_answers = $15,
                                 quiz_grades_released = $16,
                                 registered_at = NOW(),
                                 last_updated_at = NOW(),
                                 reviewed_at = NULL,
                                 reviewed_by_user_id = NULL,
                                 review_notes = NULL,
                                 updated_at = NOW()
                             WHERE id = $17
                             RETURNING id, event_id AS "eventId", club_id AS "clubId", status, ticket_code AS "ticketCode",
                                       applicant_name AS "applicantName", applicant_email AS "applicantEmail",
                                       department, year_of_study AS "yearOfStudy", roll_number AS "rollNumber",
                                       phone_number AS "phoneNumber", answers, file_attachments AS "fileAttachments", notes,
                                       form_version_id AS "formVersionId",
                                       quiz_score AS "quizScore", quiz_max_score AS "quizMaxScore",
                                       quiz_graded_answers AS "quizGradedAnswers", quiz_grades_released AS "quizGradesReleased",
                                       registered_at AS "registeredAt";`,
                            [
                                applicantName,
                                applicantEmail,
                                department,
                                yearOfStudy,
                                rollNumber,
                                phoneNumber,
                                notes,
                                JSON.stringify(answers),
                                JSON.stringify(fileAttachments),
                                formId,
                                formVersionId,
                                payload.idempotencyKey || null,
                                quizScore,
                                quizMaxScore,
                                quizGradedAnswers ? JSON.stringify(quizGradedAnswers) : null,
                                quizGradesReleased,
                                existingReg.rows[0].id,
                            ]
                        );

                        await client.query("COMMIT;");
                        return {
                            success: true,
                            message: formSettings.confirmationMessage || `Application submitted for review for ${event.title}!`,
                            registration: reactivated.rows[0],
                            isUpdate: false,
                        };
                    }
                }
            } else if (applicantEmail && (formSettings.limitOneResponse || formSettings.responses?.limitOneResponse)) {
                // For non-authenticated submissions, enforce single submission per email
                const existingEmailReg = await client.query(
                    `SELECT id, status FROM club_event_registrations
                     WHERE event_id = $1 AND LOWER(applicant_email) = LOWER($2)
                     AND status NOT IN ('cancelled', 'rejected') LIMIT 1;`,
                    [eventId, applicantEmail.trim()]
                );
                if (existingEmailReg.rows[0]) {
                    const error: any = new Error("A registration has already been submitted with this email address.");
                    error.statusCode = 409;
                    throw error;
                }
            }

            // 7. Insert new registration record
            const insertRes = await client.query(
                `INSERT INTO club_event_registrations (
                    event_id,
                    club_id,
                    user_id,
                    status,
                    applicant_name,
                    applicant_email,
                    department,
                    year_of_study,
                    roll_number,
                    phone_number,
                    notes,
                    answers,
                    form_response,
                    file_attachments,
                    form_id,
                    form_version_id,
                    idempotency_key,
                    quiz_score,
                    quiz_max_score,
                    quiz_graded_answers,
                    quiz_grades_released,
                    registered_at,
                    last_updated_at,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW(), NOW(), NOW(), NOW())
                RETURNING id, event_id AS "eventId", club_id AS "clubId", status, ticket_code AS "ticketCode",
                          applicant_name AS "applicantName", applicant_email AS "applicantEmail",
                          department, year_of_study AS "yearOfStudy", roll_number AS "rollNumber",
                          phone_number AS "phoneNumber", answers, file_attachments AS "fileAttachments", notes,
                          form_version_id AS "formVersionId",
                          quiz_score AS "quizScore", quiz_max_score AS "quizMaxScore",
                          quiz_graded_answers AS "quizGradedAnswers", quiz_grades_released AS "quizGradesReleased",
                          registered_at AS "registeredAt";`,
                [
                    eventId,
                    event.clubId,
                    userId || null,
                    applicantName,
                    applicantEmail,
                    department,
                    yearOfStudy,
                    rollNumber,
                    phoneNumber,
                    notes,
                    JSON.stringify(answers),
                    JSON.stringify(fileAttachments),
                    formId,
                    formVersionId,
                    payload.idempotencyKey || null,
                    quizScore,
                    quizMaxScore,
                    quizGradedAnswers ? JSON.stringify(quizGradedAnswers) : null,
                    quizGradesReleased,
                ]
            );

            const newReg = insertRes.rows[0];

            // Track uploaded attachments in media assets table
            for (const att of fileAttachments) {
                if (att.filePublicId) {
                    await this.registerMediaAsset({
                        formId,
                        eventId,
                        uploaderUserId: userId || null,
                        publicId: att.filePublicId,
                        secureUrl: att.fileUrl,
                        assetPurpose: "student_attachment",
                        questionId: att.questionId,
                        responseId: newReg.id,
                        bytes: att.fileSize ?? null,
                    });
                }
            }

            // Sync newly provided academic info to student profile
            if (userId && (rollNumber || department || yearOfStudy || phoneNumber)) {
                await client.query(
                    `UPDATE users
                     SET roll_number = COALESCE($1, roll_number),
                         department = COALESCE($2, department),
                         year_of_study = COALESCE($3, year_of_study),
                         phone = COALESCE($4, phone)
                     WHERE id = $5;`,
                    [rollNumber || null, department || null, yearOfStudy || null, phoneNumber || null, userId]
                );
            }

            // Remove unfinished autosave draft on successful submission
            if (userId) {
                try {
                    await client.query(
                        `DELETE FROM club_event_response_drafts WHERE event_id = $1 AND user_id = $2;`,
                        [eventId, userId]
                    );
                } catch (draftCleanErr) {
                    console.warn("Could not clean up student response draft:", draftCleanErr);
                }
            }

            // Atomically increment registered_count with strict capacity check (Requirement 4.3)
            const capUpdate = await client.query(
                `UPDATE club_events
                 SET registered_count = registered_count + 1
                 WHERE id = $1
                   AND ($2::int IS NULL OR $2::int <= 0 OR registered_count < $2::int)
                 RETURNING registered_count;`,
                [eventId, maxResponsesCap]
            );

            if (!capUpdate.rows[0]) {
                FormLogger.warn("CAPACITY_CONFLICT", "Atomic capacity guard triggered: event capacity was filled during transaction", {
                    eventId,
                    clubId: event.clubId,
                    userId,
                    meta: { capacity: maxResponsesCap },
                });
                const error: any = new Error("Event capacity was just filled. No seats remaining.");
                error.statusCode = 409;
                throw error;
            }

            await client.query("COMMIT;");

            // Invalidate Redis cached public form metadata (Requirement 4.2)
            if (redis && redis.status === "ready") {
                await redis.del(`orbix:form:public:${eventId}`);
            }

            // Enqueue background notifications & analytics cache refresh (Requirement 4.5)
            await FormBackgroundQueue.enqueue(
                "DISPATCH_NOTIFICATIONS",
                eventId,
                {
                    eventId,
                    eventTitle: String(event.title || "Event"),
                    clubId: String(event.clubId),
                    userId: userId || undefined,
                    applicantName: String(newReg.applicantName || "Student"),
                    applicantEmail: String(newReg.applicantEmail || ""),
                    ticketCode: newReg.ticketCode || undefined,
                    registrationId: String(newReg.id),
                    status: String(newReg.status),
                },
                { clubId: String(event.clubId), userId }
            );

            await FormBackgroundQueue.enqueue(
                "INVALIDATE_ANALYTICS_CACHE",
                eventId,
                {},
                { clubId: String(event.clubId), userId }
            );

            FormLogger.info("REGISTRATION_SUBMITTED", "Registration transaction completed successfully", {
                eventId,
                clubId: event.clubId,
                userId,
                meta: {
                    registrationId: newReg.id,
                    ticketCode: newReg.ticketCode,
                },
            });

            return {
                success: true,
                message: formSettings.confirmationMessage || `Your application for ${event.title} has been submitted!`,
                registration: newReg,
                isUpdate: false,
            };
        } catch (err: any) {
            await client.query("ROLLBACK;");
            if (err.statusCode === 409) {
                // Handled concurrency / capacity conflict
            } else if (err.statusCode === 400) {
                FormLogger.warn("INVALID_SUBMISSION", "Registration validation error", {
                    eventId,
                    userId,
                    meta: { error: err.message },
                });
            } else {
                FormLogger.error(
                    "DB_ERROR",
                    "Unexpected database error during registration submission",
                    {
                        eventId,
                        userId,
                        meta: { error: err.message },
                    },
                    err
                );
            }
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Cancel an existing student registration and atomically release the capacity seat (Requirement 4.3)
     */
    static async cancelStudentRegistration(eventId: string, userId: string): Promise<{
        success: boolean;
        message: string;
    }> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const regRes = await client.query(
                `SELECT id, status FROM club_event_registrations
                 WHERE event_id = $1 AND user_id = $2 FOR UPDATE;`,
                [eventId, userId]
            );

            if (!regRes.rows[0]) {
                const error: any = new Error("No active registration found to cancel.");
                error.statusCode = 404;
                throw error;
            }

            const currentStatus = regRes.rows[0].status;
            if (currentStatus === "cancelled") {
                await client.query("COMMIT;");
                return { success: true, message: "Registration is already cancelled." };
            }

            // Mark registration cancelled
            await client.query(
                `UPDATE club_event_registrations
                 SET status = 'cancelled', updated_at = NOW()
                 WHERE id = $1;`,
                [regRes.rows[0].id]
            );

            // Atomically decrement event registered_count
            await client.query(
                `UPDATE club_events
                 SET registered_count = GREATEST(0, registered_count - 1)
                 WHERE id = $1;`,
                [eventId]
            );

            await client.query("COMMIT;");

            // Invalidate Redis cache
            if (redis && redis.status === "ready") {
                await redis.del(`orbix:form:public:${eventId}`);
            }

            FormLogger.info("REGISTRATION_CANCELLED", "Registration cancelled and capacity seat released", {
                eventId,
                userId,
                meta: { registrationId: regRes.rows[0].id },
            });

            return {
                success: true,
                message: "Your registration has been cancelled and seat released.",
            };
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Retrieve individual student registration by user ID
     */
    static async getStudentRegistration(eventId: string, userId: string) {
        const res = await query(
            `SELECT r.id, r.event_id AS "eventId", r.club_id AS "clubId", r.user_id AS "userId",
                    r.status, r.ticket_code AS "ticketCode", r.applicant_name AS "applicantName",
                    r.applicant_email AS "applicantEmail", r.department, r.year_of_study AS "yearOfStudy",
                    r.roll_number AS "rollNumber", r.phone_number AS "phoneNumber", r.notes,
                    r.answers, r.form_response AS "formResponse", r.file_attachments AS "fileAttachments",
                    r.form_id AS "formId", r.form_version_id AS "formVersionId",
                    r.registered_at AS "registeredAt", r.last_updated_at AS "lastUpdatedAt",
                    v.version_number AS "versionNumber"
             FROM club_event_registrations r
             LEFT JOIN club_event_form_versions v ON v.id = r.form_version_id
             WHERE r.event_id = $1 AND r.user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );

        if (!res.rows[0]) {
            const error: any = new Error("Registration not found.");
            error.statusCode = 404;
            throw error;
        }

        const row = res.rows[0];
        return {
            ...row,
            answers: row.answers || row.formResponse || {},
            fileAttachments: row.fileAttachments || [],
        };
    }

    /**
     * Edit an existing registration when permitted
     */
    static async editExistingRegistration(
        eventId: string,
        userId: string,
        payload: FormSubmissionPayload
    ) {
        return this.submitFormResponse(eventId, userId, payload);
    }

    /**
     * Retrieve student's unfinished draft for an event form
     */
    static async getStudentDraft(eventId: string, userId: string) {
        const res = await query(
            `SELECT id, event_id AS "eventId", form_id AS "formId",
                    form_version_id AS "formVersionId", user_id AS "userId",
                    answers, file_attachments AS "fileAttachments",
                    current_section_index AS "currentSectionIndex",
                    section_history AS "sectionHistory",
                    created_at AS "createdAt", updated_at AS "updatedAt"
             FROM club_event_response_drafts
             WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );
        return res.rows[0] || null;
    }

    /**
     * Save/upsert student's unfinished draft (debounced autosave)
     */
    static async saveStudentDraft(
        eventId: string,
        userId: string,
        payload: {
            answers?: Record<string, any>;
            fileAttachments?: FileAttachmentMeta[];
            currentSectionIndex?: number;
            sectionHistory?: number[];
            formVersionId?: string;
        }
    ) {
        // Fetch form info
        const formRes = await query(
            `SELECT id, published_version_id AS "publishedVersionId" FROM club_event_forms WHERE event_id = $1 LIMIT 1;`,
            [eventId]
        );
        const formId = formRes.rows[0]?.id || null;
        const formVersionId = payload.formVersionId || formRes.rows[0]?.publishedVersionId || null;

        const answers = payload.answers || {};
        const fileAttachments = payload.fileAttachments || [];
        const currentSectionIndex = Number(payload.currentSectionIndex ?? 0);
        const sectionHistory = Array.isArray(payload.sectionHistory) ? payload.sectionHistory : [0];

        const res = await query(
            `INSERT INTO club_event_response_drafts (
                event_id,
                form_id,
                form_version_id,
                user_id,
                answers,
                file_attachments,
                current_section_index,
                section_history,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (event_id, user_id) DO UPDATE SET
                form_id = COALESCE(EXCLUDED.form_id, club_event_response_drafts.form_id),
                form_version_id = COALESCE(EXCLUDED.form_version_id, club_event_response_drafts.form_version_id),
                answers = EXCLUDED.answers,
                file_attachments = EXCLUDED.file_attachments,
                current_section_index = EXCLUDED.current_section_index,
                section_history = EXCLUDED.section_history,
                updated_at = NOW()
            RETURNING id, event_id AS "eventId", form_version_id AS "formVersionId",
                      answers, file_attachments AS "fileAttachments",
                      current_section_index AS "currentSectionIndex",
                      section_history AS "sectionHistory",
                      updated_at AS "updatedAt";`,
            [
                eventId,
                formId,
                formVersionId,
                userId,
                JSON.stringify(answers),
                JSON.stringify(fileAttachments),
                currentSectionIndex,
                JSON.stringify(sectionHistory),
            ]
        );

        return res.rows[0];
    }

    /**
     * Clear student's unfinished draft
     */
    static async clearStudentDraft(eventId: string, userId: string) {
        await query(
            `DELETE FROM club_event_response_drafts WHERE event_id = $1 AND user_id = $2;`,
            [eventId, userId]
        );
        return { success: true };
    }

    /**
     * Retrieve responses with pagination, filtering, and form version metadata (Phase 5.3 & 5.4)
     */
    static async getResponsesForClub(
        eventId: string,
        userId: string,
        options: {
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
            sortOrder?: "ASC" | "DESC" | string;
            responseIds?: string[];
        } = {}
    ) {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const page = Math.max(1, Number(options.page || 1));
        const limit = Math.max(1, Math.min(100, Number(options.limit || 50)));
        const offset = (page - 1) * limit;

        // Query status aggregate counts across this event
        const statusCountsRes = await query(
            `SELECT 
                COUNT(*)::int AS "totalCount",
                COUNT(CASE WHEN r.status IN ('registered', 'attended') THEN 1 END)::int AS "successfulCount",
                COUNT(CASE WHEN r.status = 'pending' THEN 1 END)::int AS "pendingCount",
                COUNT(CASE WHEN r.status = 'attended' THEN 1 END)::int AS "attendedCount",
                COUNT(CASE WHEN r.status = 'rejected' THEN 1 END)::int AS "rejectedCount",
                COUNT(CASE WHEN r.status = 'cancelled' THEN 1 END)::int AS "cancelledCount"
             FROM club_event_registrations r
             WHERE r.event_id = $1;`,
            [eventId]
        );
        const statusCounts = statusCountsRes.rows[0] || {
            totalCount: 0,
            successfulCount: 0,
            pendingCount: 0,
            attendedCount: 0,
            rejectedCount: 0,
            cancelledCount: 0,
        };

        const whereClauses: string[] = ["r.event_id = $1"];
        const params: any[] = [eventId];

        if (options.versionId) {
            params.push(options.versionId);
            whereClauses.push(`r.form_version_id = $${params.length}`);
        }

        if (options.status && options.status !== "all") {
            params.push(options.status);
            whereClauses.push(`r.status = $${params.length}`);
        }

        if (options.search && options.search.trim()) {
            params.push(`%${options.search.trim()}%`);
            whereClauses.push(
                `(r.applicant_name ILIKE $${params.length} OR r.applicant_email ILIKE $${params.length} OR r.ticket_code ILIKE $${params.length} OR r.roll_number ILIKE $${params.length} OR u.username ILIKE $${params.length})`
            );
        }

        if (options.startDate) {
            params.push(options.startDate);
            whereClauses.push(`r.registered_at >= $${params.length}`);
        }

        if (options.endDate) {
            const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(options.endDate);
            const endTimestamp = isIsoDateOnly ? `${options.endDate}T23:59:59.999Z` : options.endDate;
            params.push(endTimestamp);
            whereClauses.push(`r.registered_at <= $${params.length}`);
        }

        if (options.questionId && options.answerSearch && options.answerSearch.trim()) {
            params.push(options.questionId);
            params.push(`%${options.answerSearch.trim()}%`);
            whereClauses.push(
                `(r.answers->>$${params.length - 1} ILIKE $${params.length} OR r.form_response->>$${params.length - 1} ILIKE $${params.length})`
            );
        }

        if (Array.isArray(options.responseIds) && options.responseIds.length > 0) {
            params.push(options.responseIds);
            whereClauses.push(`r.id = ANY($${params.length})`);
        }

        const whereStr = whereClauses.join(" AND ");

        const totalRes = await query(
            `SELECT COUNT(*)::int AS count 
             FROM club_event_registrations r
             LEFT JOIN users u ON u.id = r.user_id
             WHERE ${whereStr};`,
            params
        );
        const total = totalRes.rows[0]?.count || 0;

        let sortCol = "r.registered_at";
        if (options.sortBy === "applicant_name") sortCol = "r.applicant_name";
        else if (options.sortBy === "quiz_score") sortCol = "COALESCE(r.quiz_score, -1)";
        else if (options.sortBy === "status") sortCol = "r.status";
        else if (options.sortBy === "roll_number") sortCol = "r.roll_number";

        const sortDir = options.sortOrder?.toUpperCase() === "ASC" ? "ASC" : "DESC";

        params.push(limit, offset);
        const listRes = await query(
            `SELECT r.id, r.event_id AS "eventId", r.club_id AS "clubId", r.user_id AS "userId",
                    r.status, r.ticket_code AS "ticketCode", r.applicant_name AS "applicantName",
                    r.applicant_email AS "applicantEmail", r.department, r.year_of_study AS "yearOfStudy",
                    r.roll_number AS "rollNumber", r.phone_number AS "phoneNumber", r.notes,
                    r.answers, r.form_response AS "formResponse", r.file_attachments AS "fileAttachments",
                    r.form_version_id AS "formVersionId", r.registered_at AS "registeredAt",
                    r.last_updated_at AS "lastUpdatedAt",
                    r.quiz_score AS "quizScore", r.quiz_max_score AS "quizMaxScore",
                    r.quiz_graded_answers AS "quizGradedAnswers", r.quiz_grades_released AS "quizGradesReleased",
                    r.reviewed_at AS "reviewedAt", r.review_notes AS "reviewNotes",
                    v.version_number AS "versionNumber",
                    u.username, u.photo_url AS "userPhotoUrl"
             FROM club_event_registrations r
             LEFT JOIN club_event_form_versions v ON v.id = r.form_version_id
             LEFT JOIN users u ON u.id = r.user_id
             WHERE ${whereStr}
             ORDER BY ${sortCol} ${sortDir}
             LIMIT $${params.length - 1} OFFSET $${params.length};`,
            params
        );

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            statusCounts,
            responses: listRes.rows.map((row) => ({
                ...row,
                answers: row.answers || row.formResponse || {},
                fileAttachments: row.fileAttachments || [],
            })),
        };
    }

    /**
     * Update individual response status (e.g. approve, mark attended, reject)
     */
    static async updateResponseStatus(
        eventId: string,
        userId: string,
        registrationId: string,
        status: string,
        reviewNotes?: string
    ) {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const validStatuses = ["pending", "registered", "attended", "rejected", "cancelled"];
        if (!validStatuses.includes(status)) {
            const error: any = new Error(`Invalid status: ${status}. Must be one of ${validStatuses.join(", ")}`);
            error.statusCode = 400;
            throw error;
        }

        const isAttended = status === "attended";
        const updateRes = await query(
            `UPDATE club_event_registrations
             SET status = $1,
                 reviewed_at = NOW(),
                 reviewed_by_user_id = $2,
                 review_notes = COALESCE($3, review_notes),
                 checked_in_at = CASE WHEN $4 = true AND checked_in_at IS NULL THEN NOW() ELSE checked_in_at END,
                 updated_at = NOW()
             WHERE id = $5 AND event_id = $6
             RETURNING id, user_id AS "userId", status, ticket_code AS "ticketCode", checked_in_at AS "checkedInAt", reviewed_at AS "reviewedAt", updated_at AS "updatedAt";`,
            [status, userId, reviewNotes || null, isAttended, registrationId, eventId]
        );

        if (!updateRes.rows[0]) {
            const error: any = new Error("Registration record not found.");
            error.statusCode = 404;
            throw error;
        }

        // Keep event registered count synchronized
        try {
            await query(
                `UPDATE club_events
                 SET registered_count = (
                     SELECT COUNT(*)::int FROM club_event_registrations
                     WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected')
                 )
                 WHERE id = $1;`,
                [eventId]
            );
        } catch (countErr) {
            console.warn("Could not synchronize event registered_count:", countErr);
        }

        return updateRes.rows[0];
    }

    /**
     * Dynamic CSV export with version-aware question headers, filtering, selection, and CSV sanitization (Phase 5.5)
     */
    static async exportResponsesCsv(
        eventId: string,
        userId: string,
        optionsOrVersionId?: string | {
            versionId?: string;
            status?: string;
            responseIds?: string[];
            search?: string;
            startDate?: string;
            endDate?: string;
        }
    ): Promise<{
        filename: string;
        csvContent: string;
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const options = typeof optionsOrVersionId === "string" ? { versionId: optionsOrVersionId } : (optionsOrVersionId || {});

        // Fetch form structure (use specific version or latest published/draft)
        let structure: FormStructure = { sections: [] };
        if (options.versionId) {
            const vRes = await query(`SELECT structure FROM club_event_form_versions WHERE id = $1 AND event_id = $2;`, [options.versionId, eventId]);
            if (vRes.rows[0]?.structure) structure = vRes.rows[0].structure;
        } else {
            const fRes = await query(
                `SELECT COALESCE(v.structure, f.structure) AS structure
                 FROM club_event_forms f
                 LEFT JOIN club_event_form_versions v ON v.id = f.published_version_id
                 WHERE f.event_id = $1;`,
                [eventId]
            );
            if (fRes.rows[0]?.structure) structure = fRes.rows[0].structure;
        }

        // Collect custom questions in order
        const customQuestions: { id: string; title: string }[] = [];
        (structure.sections || []).forEach((sec) => {
            (sec.questions || []).forEach((q) => {
                if (q.type !== "image_card" && q.type !== "markdown_card") {
                    customQuestions.push({ id: q.id, title: q.title });
                }
            });
        });

        const whereClauses: string[] = ["r.event_id = $1"];
        const params: any[] = [eventId];

        if (Array.isArray(options.responseIds) && options.responseIds.length > 0) {
            params.push(options.responseIds);
            whereClauses.push(`r.id = ANY($${params.length})`);
        } else {
            if (options.status && options.status !== "all") {
                params.push(options.status);
                whereClauses.push(`r.status = $${params.length}`);
            } else if (!options.status) {
                whereClauses.push(`r.status NOT IN ('cancelled', 'rejected')`);
            }

            if (options.versionId) {
                params.push(options.versionId);
                whereClauses.push(`r.form_version_id = $${params.length}`);
            }

            if (options.search && options.search.trim()) {
                params.push(`%${options.search.trim()}%`);
                whereClauses.push(
                    `(r.applicant_name ILIKE $${params.length} OR r.applicant_email ILIKE $${params.length} OR r.ticket_code ILIKE $${params.length} OR r.roll_number ILIKE $${params.length} OR u.username ILIKE $${params.length})`
                );
            }

            if (options.startDate) {
                params.push(options.startDate);
                whereClauses.push(`r.registered_at >= $${params.length}`);
            }

            if (options.endDate) {
                const isIsoDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(options.endDate);
                const endTimestamp = isIsoDateOnly ? `${options.endDate}T23:59:59.999Z` : options.endDate;
                params.push(endTimestamp);
                whereClauses.push(`r.registered_at <= $${params.length}`);
            }
        }

        const whereStr = whereClauses.join(" AND ");

        // Fetch matching registrations
        const regRes = await query(
            `SELECT r.id, r.ticket_code, r.applicant_name, r.applicant_email, r.roll_number,
                    r.department, r.year_of_study, r.phone_number, r.status,
                    r.answers, r.form_response, r.file_attachments,
                    r.quiz_score, r.quiz_max_score,
                    v.version_number AS version_number,
                    u.username,
                    r.registered_at
             FROM club_event_registrations r
             LEFT JOIN club_event_form_versions v ON v.id = r.form_version_id
             LEFT JOIN users u ON u.id = r.user_id
             WHERE ${whereStr}
             ORDER BY r.registered_at ASC;`,
            params
        );

        // Protect all cells against CSV / Spreadsheet formula injection (Phase 5)
        const escapeCsv = escapeCsvFormula;

        const headers = [
            "Registration ID",
            "Ticket Code",
            "Full Name",
            "Email",
            "Username",
            "Roll Number",
            "Department",
            "Year of Study",
            "Phone",
            "Status",
            "Form Version",
            "Quiz Score",
            "Submitted At",
            ...customQuestions.map((q) => q.title),
        ];

        const rows = regRes.rows.map((r) => {
            const answers = r.answers || r.form_response || {};
            const attachments = r.file_attachments || [];

            const customVals = customQuestions.map((q) => {
                let ans = answers[q.id];
                const matchingFile = attachments.find((f: any) => f.questionId === q.id);
                if (matchingFile) {
                    ans = matchingFile.fileUrl;
                }
                if (Array.isArray(ans)) return ans.join("; ");
                if (typeof ans === "object" && ans !== null) return JSON.stringify(ans);
                return ans ?? "";
            });

            const quizStr = r.quiz_score !== null && r.quiz_score !== undefined
                ? `${r.quiz_score} / ${r.quiz_max_score ?? "?"}`
                : "N/A";

            return [
                escapeCsv(r.id),
                escapeCsv(r.ticket_code),
                escapeCsv(r.applicant_name),
                escapeCsv(r.applicant_email),
                escapeCsv(r.username || ""),
                escapeCsv(r.roll_number || ""),
                escapeCsv(r.department || ""),
                escapeCsv(r.year_of_study || ""),
                escapeCsv(r.phone_number || ""),
                escapeCsv(r.status),
                escapeCsv(r.version_number ? `v${r.version_number}` : "v1"),
                escapeCsv(quizStr),
                escapeCsv(new Date(r.registered_at).toLocaleString()),
                ...customVals.map(escapeCsv),
            ].join(",");
        });

        const csvContent = [headers.map(escapeCsv).join(","), ...rows].join("\n");
        const safeTitle = (evCheck.rows[0].title || "event").toLowerCase().replace(/[^a-z0-9]/g, "_");
        const filename = `${safeTitle}_responses_${Date.now()}.csv`;

        return { filename, csvContent };
    }

    /**
     * Compute analytics, summary metrics, and question-by-question breakdown analytics (Phase 5.1 & 5.2)
     */
    static async getFormStats(eventId: string, userId: string) {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1 LIMIT 1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const formRes = await query(
            `SELECT f.id, f.title,
                    COALESCE(v.structure, f.structure) AS structure,
                    f.settings
             FROM club_event_forms f
             LEFT JOIN club_event_form_versions v ON v.id = f.published_version_id
             WHERE f.event_id = $1 LIMIT 1;`,
            [eventId]
        );

        const structure: FormStructure = formRes.rows[0]?.structure || { sections: [] };

        // Fetch all registrations for this event across all statuses
        const regRes = await query(
            `SELECT r.id, r.answers, r.form_response AS "formResponse", r.file_attachments AS "fileAttachments",
                    r.quiz_score AS "quizScore", r.quiz_max_score AS "quizMaxScore",
                    r.quiz_graded_answers AS "quizGradedAnswers",
                    r.quiz_grades_released AS "quizGradesReleased",
                    r.registered_at AS "registeredAt", r.status,
                    r.applicant_name AS "applicantName", r.applicant_email AS "applicantEmail",
                    u.username
             FROM club_event_registrations r
             LEFT JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1;`,
            [eventId]
        );

        const allRegistrations = regRes.rows;
        const totalRegistrations = allRegistrations.length;

        // Metric tallies for Phase 5.1 Summary View
        const successfulCount = allRegistrations.filter((r) => r.status === "registered" || r.status === "attended").length;
        const pendingCount = allRegistrations.filter((r) => r.status === "pending").length;
        const attendedCount = allRegistrations.filter((r) => r.status === "attended").length;
        const rejectedCount = allRegistrations.filter((r) => r.status === "rejected").length;
        const cancelledCount = allRegistrations.filter((r) => r.status === "cancelled").length;

        const statusDistribution = {
            registered: allRegistrations.filter((r) => r.status === "registered").length,
            pending: pendingCount,
            attended: attendedCount,
            rejected: rejectedCount,
            cancelled: cancelledCount,
        };

        // File upload aggregate metrics
        let totalFilesCount = 0;
        let totalFilesBytes = 0;
        allRegistrations.forEach((r) => {
            const atts = Array.isArray(r.fileAttachments) ? r.fileAttachments : [];
            totalFilesCount += atts.length;
            atts.forEach((f: any) => {
                if (typeof f.fileSize === "number") totalFilesBytes += f.fileSize;
            });
        });

        // Question-by-question analytics (active respondents)
        const activeRegistrations = allRegistrations.filter((r) => r.status !== "cancelled");
        const questionStats: Record<string, any> = {};

        for (const sec of structure.sections || []) {
            for (const q of sec.questions || []) {
                if (q.type === "image_card" || q.type === "markdown_card") continue;

                let answeredCount = 0;
                let skippedCount = 0;

                if (q.type === "multiple_choice" || q.type === "dropdown") {
                    const optionCounts: Record<string, number> = {};
                    (q.options || []).forEach((opt) => (optionCounts[opt.text] = 0));
                    const otherAnswers: string[] = [];

                    activeRegistrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = ansMap[q.id];
                        if (val !== undefined && val !== null && String(val).trim() !== "") {
                            answeredCount++;
                            const valStr = String(val);
                            if (optionCounts[valStr] !== undefined) {
                                optionCounts[valStr]++;
                            } else {
                                optionCounts[valStr] = (optionCounts[valStr] || 0) + 1;
                                otherAnswers.push(valStr);
                            }
                        } else {
                            skippedCount++;
                        }
                    });

                    const optionPercentages: Record<string, number> = {};
                    let popularChoice = { text: "None", count: 0, percentage: 0 };

                    Object.entries(optionCounts).forEach(([text, count]) => {
                        const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                        optionPercentages[text] = pct;
                        if (count > popularChoice.count) {
                            popularChoice = { text, count, percentage: pct };
                        }
                    });

                    questionStats[q.id] = {
                        id: q.id,
                        title: q.title,
                        type: q.type,
                        description: q.description,
                        required: Boolean(q.required),
                        sectionTitle: sec.title,
                        answeredCount,
                        skippedCount,
                        responseRate: totalRegistrations > 0 ? Math.round((answeredCount / totalRegistrations) * 100) : 0,
                        optionCounts,
                        optionPercentages,
                        popularChoice: popularChoice.count > 0 ? popularChoice : null,
                        otherAnswers,
                        options: q.options || [],
                        points: q.points || 0,
                        isQuizQuestion: Boolean(q.points && q.correctAnswers && q.correctAnswers.length > 0),
                        correctAnswers: q.correctAnswers || [],
                    };
                } else if (q.type === "checkboxes") {
                    const counts: Record<string, number> = {};
                    (q.options || []).forEach((opt) => (counts[opt.text] = 0));

                    activeRegistrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = ansMap[q.id];
                        if (Array.isArray(val) && val.length > 0) {
                            answeredCount++;
                            val.forEach((item) => {
                                const itemStr = String(item);
                                counts[itemStr] = (counts[itemStr] || 0) + 1;
                            });
                        } else if (val && typeof val === "string") {
                            answeredCount++;
                            counts[val] = (counts[val] || 0) + 1;
                        } else {
                            skippedCount++;
                        }
                    });

                    const optionPercentages: Record<string, number> = {};
                    let popularChoice = { text: "None", count: 0, percentage: 0 };

                    Object.entries(counts).forEach(([text, count]) => {
                        const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                        optionPercentages[text] = pct;
                        if (count > popularChoice.count) {
                            popularChoice = { text, count, percentage: pct };
                        }
                    });

                    questionStats[q.id] = {
                        id: q.id,
                        title: q.title,
                        type: q.type,
                        description: q.description,
                        required: Boolean(q.required),
                        sectionTitle: sec.title,
                        answeredCount,
                        skippedCount,
                        responseRate: totalRegistrations > 0 ? Math.round((answeredCount / totalRegistrations) * 100) : 0,
                        selectionCounts: counts,
                        optionPercentages,
                        popularChoice: popularChoice.count > 0 ? popularChoice : null,
                        options: q.options || [],
                        points: q.points || 0,
                        isQuizQuestion: Boolean(q.points && q.correctAnswers && q.correctAnswers.length > 0),
                        correctAnswers: q.correctAnswers || [],
                    };
                } else if (q.type === "linear_scale") {
                    const scores: number[] = [];
                    const distribution: Record<number, number> = {};

                    const min = q.scaleConfig?.min ?? 1;
                    const max = q.scaleConfig?.max ?? 5;
                    for (let i = min; i <= max; i++) {
                        distribution[i] = 0;
                    }

                    activeRegistrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = Number(ansMap[q.id]);
                        if (!isNaN(val) && val >= min && val <= max) {
                            answeredCount++;
                            scores.push(val);
                            distribution[val] = (distribution[val] || 0) + 1;
                        } else {
                            skippedCount++;
                        }
                    });

                    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                    const distributionPercentages: Record<number, number> = {};
                    let popularChoice = { text: "None", count: 0, percentage: 0 };

                    Object.entries(distribution).forEach(([scStr, count]) => {
                        const pct = answeredCount > 0 ? Math.round((count / answeredCount) * 100) : 0;
                        distributionPercentages[Number(scStr)] = pct;
                        if (count > popularChoice.count) {
                            popularChoice = { text: `${scStr} pts`, count, percentage: pct };
                        }
                    });

                    questionStats[q.id] = {
                        id: q.id,
                        title: q.title,
                        type: q.type,
                        description: q.description,
                        required: Boolean(q.required),
                        sectionTitle: sec.title,
                        answeredCount,
                        skippedCount,
                        responseRate: totalRegistrations > 0 ? Math.round((answeredCount / totalRegistrations) * 100) : 0,
                        average: Number(avg.toFixed(2)),
                        distribution,
                        distributionPercentages,
                        minScale: min,
                        maxScale: max,
                        minLabel: q.scaleConfig?.minLabel,
                        maxLabel: q.scaleConfig?.maxLabel,
                        popularChoice: popularChoice.count > 0 ? popularChoice : null,
                    };
                } else if (q.type === "file_upload") {
                    const files: any[] = [];
                    let questionFileBytes = 0;

                    activeRegistrations.forEach((r) => {
                        const atts = r.fileAttachments || [];
                        const matchingFiles = atts.filter((item: any) => item.questionId === q.id);
                        if (matchingFiles.length > 0) {
                            answeredCount++;
                            matchingFiles.forEach((f: any) => {
                                questionFileBytes += f.fileSize || 0;
                                files.push({
                                    ...f,
                                    respondentName: r.applicantName || r.username || "Student",
                                    applicantEmail: r.applicantEmail,
                                    submittedAt: r.registeredAt,
                                });
                            });
                        } else {
                            skippedCount++;
                        }
                    });

                    questionStats[q.id] = {
                        id: q.id,
                        title: q.title,
                        type: q.type,
                        description: q.description,
                        required: Boolean(q.required),
                        sectionTitle: sec.title,
                        answeredCount,
                        skippedCount,
                        responseRate: totalRegistrations > 0 ? Math.round((answeredCount / totalRegistrations) * 100) : 0,
                        fileCount: files.length,
                        totalBytes: questionFileBytes,
                        recentFiles: files.slice(0, 50),
                    };
                } else {
                    // Textual descriptive answers: show readable samples rather than forcing a chart (Phase 5.2)
                    const readableSamples: any[] = [];

                    activeRegistrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = ansMap[q.id];
                        if (val !== undefined && val !== null && String(val).trim() !== "") {
                            answeredCount++;
                            if (readableSamples.length < 50) {
                                readableSamples.push({
                                    id: r.id,
                                    answer: String(val).trim(),
                                    respondentName: r.applicantName || r.username || "Student",
                                    applicantEmail: r.applicantEmail,
                                    submittedAt: r.registeredAt,
                                });
                            }
                        } else {
                            skippedCount++;
                        }
                    });

                    questionStats[q.id] = {
                        id: q.id,
                        title: q.title,
                        type: q.type,
                        description: q.description,
                        required: Boolean(q.required),
                        sectionTitle: sec.title,
                        answeredCount,
                        skippedCount,
                        responseRate: totalRegistrations > 0 ? Math.round((answeredCount / totalRegistrations) * 100) : 0,
                        readableSamples,
                        points: q.points || 0,
                        isQuizQuestion: Boolean(q.points && q.correctAnswers && q.correctAnswers.length > 0),
                        correctAnswers: q.correctAnswers || [],
                    };
                }
            }
        }

        // Daily registration timeline (Phase 5.1)
        const timeline: Record<string, number> = {};
        allRegistrations.forEach((r) => {
            if (r.registeredAt) {
                const dateStr = new Date(r.registeredAt).toISOString().split("T")[0] || "unknown";
                timeline[dateStr] = (timeline[dateStr] || 0) + 1;
            }
        });

        // Phase 3 Quiz Metrics Computation
        let quizStats: any = null;
        const isQuiz = Boolean(formRes.rows[0]?.settings?.quiz?.isQuiz);
        if (isQuiz) {
            const validScores: number[] = [];
            let maxPoints = 0;
            let releasedCount = 0;

            allRegistrations.forEach((r) => {
                if (r.quizScore !== null && r.quizScore !== undefined) {
                    validScores.push(Number(r.quizScore));
                }
                if (r.quizMaxScore) {
                    maxPoints = Math.max(maxPoints, Number(r.quizMaxScore));
                }
                if (r.quizGradesReleased) {
                    releasedCount++;
                }
            });

            if (validScores.length > 0) {
                const total = validScores.reduce((acc, curr) => acc + curr, 0);
                const avg = Number((total / validScores.length).toFixed(1));
                const sorted = [...validScores].sort((a, b) => a - b);
                const median = sorted[Math.floor(sorted.length / 2)];
                const min = sorted[0];
                const max = sorted[sorted.length - 1];

                const distribution: Record<string, number> = {};
                validScores.forEach((sc) => {
                    const bucket = `${Math.floor(sc / 5) * 5}-${Math.floor(sc / 5) * 5 + 4} pts`;
                    distribution[bucket] = (distribution[bucket] || 0) + 1;
                });

                quizStats = {
                    average: avg,
                    median,
                    min,
                    max,
                    maxPossiblePoints: maxPoints,
                    gradedCount: validScores.length,
                    releasedCount,
                    distribution,
                };
            }
        }

        return {
            totalResponses: totalRegistrations,
            totalRegistrations,
            successfulCount,
            pendingCount,
            attendedCount,
            rejectedCount,
            cancelledCount,
            statusDistribution,
            timeline,
            totalFilesCount,
            totalFilesBytes,
            questionStats,
            quizStats,
            eventTitle: evCheck.rows[0].title,
        };
    }

    /**
     * Release quiz grades to respondents
     */
    static async releaseQuizGrades(eventId: string, userId: string): Promise<{
        success: boolean;
        message: string;
        releasedCount: number;
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        // Update all registrations for this event to release grades
        const updateRes = await query(
            `UPDATE club_event_registrations
             SET quiz_grades_released = true, updated_at = NOW()
             WHERE event_id = $1 AND (quiz_grades_released = false OR quiz_grades_released IS NULL);`,
            [eventId]
        );

        // Update form settings to mark releaseGrades as immediately
        await query(
            `UPDATE club_event_forms
             SET settings = jsonb_set(
                 COALESCE(settings, '{}'::jsonb),
                 '{quiz,releaseGrades}',
                 '"immediately"'::jsonb,
                 true
             ),
             updated_at = NOW()
             WHERE event_id = $1;`,
            [eventId]
        );

        return {
            success: true,
            message: `Quiz grades successfully released to ${updateRes.rowCount || 0} student(s).`,
            releasedCount: updateRes.rowCount || 0,
        };
    }

    /**
     * Non-blocking background notification dispatcher for event registrations (Phase 5.6)
     */
    static async dispatchSubmissionNotifications(payload: {
        eventId: string;
        eventTitle: string;
        clubId: string;
        userId?: string | undefined;
        applicantName: string;
        applicantEmail: string;
        ticketCode?: string | undefined;
        registrationId: string;
        status: string;
    }) {
        try {
            // 1. Notify student (in-app user_notifications)
            if (payload.userId) {
                const userRes = await query(`SELECT username FROM users WHERE id = $1 LIMIT 1;`, [payload.userId]);
                const username = userRes.rows[0]?.username || "student";
                const idempotencyKey = `reg_notif_student_${payload.registrationId}`;

                await query(
                    `INSERT INTO user_notifications (
                        user_id,
                        recipient_id,
                        username,
                        title,
                        body,
                        type,
                        notification_type,
                        metadata,
                        idempotency_key,
                        is_read,
                        created_at
                    ) VALUES ($1, $1, $2, $3, $4, 'event_registration', 'event_registration', $5, $6, false, NOW())
                    ON CONFLICT (idempotency_key) DO NOTHING;`,
                    [
                        payload.userId,
                        username,
                        `Registration Confirmed: ${payload.eventTitle}`,
                        `Your registration for "${payload.eventTitle}" was received! Ticket Pass: ${payload.ticketCode || "PENDING"}`,
                        JSON.stringify({
                            eventId: payload.eventId,
                            registrationId: payload.registrationId,
                            ticketCode: payload.ticketCode,
                            eventTitle: payload.eventTitle,
                        }),
                        idempotencyKey,
                    ]
                );
            }

            // 2. Notify club owner & coordinators
            const clubRes = await query(`SELECT auth_user_id AS "ownerId", name FROM verified_clubs WHERE id = $1 LIMIT 1;`, [payload.clubId]);
            const ownerId = clubRes.rows[0]?.ownerId;
            if (ownerId && ownerId !== payload.userId) {
                const ownerUserRes = await query(`SELECT username FROM users WHERE id = $1 LIMIT 1;`, [ownerId]);
                const ownerUsername = ownerUserRes.rows[0]?.username || "organizer";
                const idempotencyKey = `reg_notif_club_${payload.registrationId}`;

                await query(
                    `INSERT INTO user_notifications (
                        user_id,
                        recipient_id,
                        username,
                        title,
                        body,
                        type,
                        notification_type,
                        metadata,
                        idempotency_key,
                        is_read,
                        created_at
                    ) VALUES ($1, $1, $2, $3, $4, 'event_registration_received', 'event_registration_received', $5, $6, false, NOW())
                    ON CONFLICT (idempotency_key) DO NOTHING;`,
                    [
                        ownerId,
                        ownerUsername,
                        `New RSVP: ${payload.eventTitle}`,
                        `${payload.applicantName} registered (${payload.ticketCode || "RSVP"}). Status: ${payload.status}.`,
                        JSON.stringify({
                            eventId: payload.eventId,
                            registrationId: payload.registrationId,
                            applicantName: payload.applicantName,
                            applicantEmail: payload.applicantEmail,
                            ticketCode: payload.ticketCode,
                        }),
                        idempotencyKey,
                    ]
                );
            }
        } catch (err) {
            console.warn("[dispatchSubmissionNotifications] Non-critical notification error:", err);
        }
    }

    /**
     * Phase 6.4 QR Code Verification Architecture: Validate ticket pass and mark attendance
     */
    static async verifyRegistrationQrCode(
        eventId: string,
        userId: string,
        ticketCode: string
    ): Promise<{
        success: boolean;
        valid: boolean;
        message: string;
        registration?: any;
    }> {
        const evCheck = await query(`SELECT club_id AS "clubId", title FROM club_events WHERE id = $1;`, [eventId]);
        if (!evCheck.rows[0]) {
            const error: any = new Error("Event not found.");
            error.statusCode = 404;
            throw error;
        }
        await this.assertStaffAccess(userId, evCheck.rows[0].clubId);

        const regRes = await query(
            `SELECT r.id, r.applicant_name AS "applicantName", r.applicant_email AS "applicantEmail",
                    r.ticket_code AS "ticketCode", r.status, r.checked_in_at AS "checkedInAt",
                    u.username, u.photo_url AS "photoUrl"
             FROM club_event_registrations r
             LEFT JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1 AND (r.ticket_code = $2 OR r.id::text = $2);`,
            [eventId, ticketCode.trim()]
        );

        if (!regRes.rows[0]) {
            return {
                success: false,
                valid: false,
                message: "No registration matching this ticket QR pass code.",
            };
        }

        const reg = regRes.rows[0];
        const alreadyCheckedIn = Boolean(reg.checkedInAt);

        // Mark attended & checked in if not yet
        if (!alreadyCheckedIn) {
            await query(
                `UPDATE club_event_registrations
                 SET status = 'attended', checked_in_at = NOW(), updated_at = NOW()
                 WHERE id = $1;`,
                [reg.id]
            );
            reg.status = "attended";
            reg.checkedInAt = new Date().toISOString();
        }

        return {
            success: true,
            valid: true,
            message: alreadyCheckedIn
                ? `Attendee already checked in at ${new Date(reg.checkedInAt).toLocaleTimeString()}.`
                : `Verified pass for ${reg.applicantName}. Check-in confirmed!`,
            registration: reg,
        };
    }

    /**
     * Phase 6.4 Cross-Event Analytics: Aggregate metrics across all events hosted by this club
     */
    static async getClubCrossEventStats(clubId: string, userId: string): Promise<{
        success: boolean;
        totalEvents: number;
        totalRegistrations: number;
        totalAttendees: number;
        overallTurnoutRate: number;
        events: Array<{
            eventId: string;
            title: string;
            startsAt: string;
            registeredCount: number;
            attendedCount: number;
            publishedVersion: number;
        }>;
    }> {
        await this.assertStaffAccess(userId, clubId);

        const res = await query(
            `SELECT e.id AS "eventId", e.title, e.starts_at AS "startsAt",
                    COUNT(r.id)::int AS "registeredCount",
                    COUNT(CASE WHEN r.status = 'attended' THEN 1 END)::int AS "attendedCount",
                    COALESCE(v.version_number, 1) AS "publishedVersion"
             FROM club_events e
             LEFT JOIN club_event_registrations r ON r.event_id = e.id AND r.status NOT IN ('cancelled', 'rejected')
             LEFT JOIN club_event_forms f ON f.event_id = e.id
             LEFT JOIN club_event_form_versions v ON v.id = f.published_version_id
             WHERE e.club_id = $1
             GROUP BY e.id, e.title, e.starts_at, v.version_number
             ORDER BY e.starts_at DESC;`,
            [clubId]
        );

        const rows = res.rows;
        const totalEvents = rows.length;
        const totalRegistrations = rows.reduce((acc, row) => acc + (row.registeredCount || 0), 0);
        const totalAttendees = rows.reduce((acc, row) => acc + (row.attendedCount || 0), 0);
        const overallTurnoutRate = totalRegistrations > 0 ? Math.round((totalAttendees / totalRegistrations) * 100) : 0;

        return {
            success: true,
            totalEvents,
            totalRegistrations,
            totalAttendees,
            overallTurnoutRate,
            events: rows,
        };
    }
}
