import crypto from "node:crypto";
import { pool } from "../../database/client.js";
import { assertCloudinaryConfigured, cloudinary } from "../../config/cloudinary.js";
import { ClubTeamService } from "./clubTeamService.js";
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
        canSubmit: boolean;
        isClosed: boolean;
        closedReason?: string | undefined;
        registeredCount: number;
        publishedVersion?: FormVersionRecord | null;
        totalVersions: number;
    }> {
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

        const event = eventRes.rows[0];
        const club = {
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

        let form: ClubEventFormRecord;
        let isNew = false;

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
        let publishedVersion: FormVersionRecord | null = null;
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
        const totalVersions = totalVersionsRes.rows[0]?.count || 0;

        // Count current registrations
        const countRes = await query(
            `SELECT COUNT(*)::int AS count 
             FROM club_event_registrations 
             WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
            [eventId]
        );
        const registeredCount = countRes.rows[0]?.count || 0;

        // Check if closed
        let isClosed = false;
        let closedReason: string | undefined;

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

        // Check user's existing registration and verified student identity if logged in
        let userResponse: any = null;
        let studentProfile: any = null;
        let canSubmit = !isClosed;
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

        // Sanitize Quiz Answer Keys for Students: Never expose answers before release
        // Club staff always have full access to answer keys for editing and grading
        let sanitizedForm = form;
        const isQuiz = Boolean(form.settings.quiz?.isQuiz);
        const gradesReleased = Boolean(userResponse?.quizGradesReleased);

        if (!isStaff && isQuiz && !gradesReleased && form.structure?.sections) {
            sanitizedForm = {
                ...form,
                structure: {
                    ...form.structure,
                    sections: form.structure.sections.map((sec) => ({
                        ...sec,
                        questions: sec.questions.map((q) => {
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

        return {
            form: sanitizedForm,
            isNew,
            event,
            club,
            studentProfile,
            userResponse,
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

        const validatedStructure = this.sanitizeStructure(payload.structure, evCheck.rows[0].title);
        const title = payload.title?.trim() || `${evCheck.rows[0].title} — Registration`;
        const description = payload.description !== undefined ? payload.description : null;
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

            return {
                success: true,
                version: newVersion,
                form: formUpdate.rows[0],
            };
        } catch (err) {
            await client.query("ROLLBACK;");
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

            // Atomic Capacity Check
            const countRes = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM club_event_registrations
                 WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
                [eventId]
            );
            const currentCount = countRes.rows[0]?.count || 0;

            const maxResponsesCap = formSettings.responses?.maxResponses ?? formSettings.maxResponses;
            if (maxResponsesCap !== null && maxResponsesCap > 0 && currentCount >= maxResponsesCap) {
                const error: any = new Error("Registration limit has been reached for this event.");
                error.statusCode = 409;
                throw error;
            }

            if (event.capacity && currentCount >= event.capacity) {
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
            const activeStructure: FormStructure = formRow?.publishedStructure || formRow?.draftStructure || { sections: [] };
            const answers = payload.answers || {};
            const fileAttachments = payload.fileAttachments || [];

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
                        if (!formSettings.allowEditResponse) {
                            const error: any = new Error("You have already submitted a response for this event.");
                            error.statusCode = 409;
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

            await client.query("COMMIT;");

            return {
                success: true,
                message: formSettings.confirmationMessage || `Your application for ${event.title} has been submitted!`,
                registration: newReg,
                isUpdate: false,
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
     * Retrieve responses with pagination, filtering, and form version metadata
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

        const whereClauses: string[] = ["r.event_id = $1"];
        const params: any[] = [eventId];

        if (options.versionId) {
            params.push(options.versionId);
            whereClauses.push(`r.form_version_id = $${params.length}`);
        }

        if (options.status) {
            params.push(options.status);
            whereClauses.push(`r.status = $${params.length}`);
        }

        if (options.search) {
            params.push(`%${options.search.trim()}%`);
            whereClauses.push(`(r.applicant_name ILIKE $${params.length} OR r.applicant_email ILIKE $${params.length} OR r.ticket_code ILIKE $${params.length} OR r.roll_number ILIKE $${params.length})`);
        }

        const whereStr = whereClauses.join(" AND ");

        const totalRes = await query(`SELECT COUNT(*)::int AS count FROM club_event_registrations r WHERE ${whereStr};`, params);
        const total = totalRes.rows[0]?.count || 0;

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
                    v.version_number AS "versionNumber",
                    u.username, u.photo_url AS "userPhotoUrl"
             FROM club_event_registrations r
             LEFT JOIN club_event_form_versions v ON v.id = r.form_version_id
             LEFT JOIN users u ON u.id = r.user_id
             WHERE ${whereStr}
             ORDER BY r.registered_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length};`,
            params
        );

        return {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
            responses: listRes.rows.map((row) => ({
                ...row,
                answers: row.answers || row.formResponse || {},
                fileAttachments: row.fileAttachments || [],
            })),
        };
    }

    /**
     * Dynamic CSV export with version-aware question headers
     */
    static async exportResponsesCsv(eventId: string, userId: string, versionId?: string): Promise<{
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

        // Fetch form structure (use specific version or latest published/draft)
        let structure: FormStructure = { sections: [] };
        if (versionId) {
            const vRes = await query(`SELECT structure FROM club_event_form_versions WHERE id = $1 AND event_id = $2;`, [versionId, eventId]);
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

        // Fetch all registrations
        const regRes = await query(
            `SELECT r.ticket_code, r.applicant_name, r.applicant_email, r.roll_number,
                    r.department, r.year_of_study, r.phone_number, r.status,
                    r.answers, r.form_response, r.file_attachments,
                    v.version_number AS version_number,
                    r.registered_at
             FROM club_event_registrations r
             LEFT JOIN club_event_form_versions v ON v.id = r.form_version_id
             WHERE r.event_id = $1 AND r.status NOT IN ('cancelled', 'rejected')
             ORDER BY r.registered_at ASC;`,
            [eventId]
        );

        const escapeCsv = (val: any) => {
            if (val === null || val === undefined) return '""';
            const str = typeof val === "object" ? JSON.stringify(val) : String(val);
            return `"${str.replace(/"/g, '""')}"`;
        };

        const headers = [
            "Ticket Code",
            "Full Name",
            "Email",
            "Roll Number",
            "Department",
            "Year of Study",
            "Phone",
            "Status",
            "Form Version",
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

            return [
                escapeCsv(r.ticket_code),
                escapeCsv(r.applicant_name),
                escapeCsv(r.applicant_email),
                escapeCsv(r.roll_number || ""),
                escapeCsv(r.department || ""),
                escapeCsv(r.year_of_study || ""),
                escapeCsv(r.phone_number || ""),
                escapeCsv(r.status),
                escapeCsv(r.version_number ? `v${r.version_number}` : "v1"),
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
     * Compute analytics and summary breakdown per question
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

        const regRes = await query(
            `SELECT id, answers, form_response AS "formResponse", file_attachments AS "fileAttachments",
                    quiz_score AS "quizScore", quiz_max_score AS "quizMaxScore",
                    quiz_grades_released AS "quizGradesReleased",
                    registered_at AS "registeredAt", status
             FROM club_event_registrations
             WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
            [eventId]
        );

        const registrations = regRes.rows;
        const totalResponses = registrations.length;

        // Phase 3 Quiz Metrics Computation
        let quizStats: any = null;
        const isQuiz = Boolean(formRes.rows[0]?.settings?.quiz?.isQuiz);
        if (isQuiz) {
            const validScores: number[] = [];
            let maxPoints = 0;
            let releasedCount = 0;

            registrations.forEach((r) => {
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

        const questionStats: Record<string, any> = {};

        for (const sec of structure.sections || []) {
            for (const q of sec.questions || []) {
                if (q.type === "image_card" || q.type === "markdown_card") continue;

                if (q.type === "multiple_choice" || q.type === "dropdown") {
                    const optionCounts: Record<string, number> = {};
                    (q.options || []).forEach((opt) => (optionCounts[opt.text] = 0));

                    registrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = ansMap[q.id];
                        if (val && typeof val === "string") {
                            optionCounts[val] = (optionCounts[val] || 0) + 1;
                        }
                    });

                    questionStats[q.id] = {
                        type: q.type,
                        title: q.title,
                        totalAnswers: Object.values(optionCounts).reduce((a, b) => a + b, 0),
                        optionCounts,
                    };
                } else if (q.type === "checkboxes") {
                    const counts: Record<string, number> = {};
                    (q.options || []).forEach((opt) => (counts[opt.text] = 0));

                    registrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = ansMap[q.id];
                        if (Array.isArray(val)) {
                            val.forEach((item) => {
                                counts[item] = (counts[item] || 0) + 1;
                            });
                        }
                    });

                    questionStats[q.id] = {
                        type: q.type,
                        title: q.title,
                        selectionCounts: counts,
                    };
                } else if (q.type === "linear_scale") {
                    const scores: number[] = [];
                    const scoreDistribution: Record<number, number> = {};

                    registrations.forEach((r) => {
                        const ansMap = r.answers || r.formResponse || {};
                        const val = Number(ansMap[q.id]);
                        if (!isNaN(val) && val > 0) {
                            scores.push(val);
                            scoreDistribution[val] = (scoreDistribution[val] || 0) + 1;
                        }
                    });

                    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
                    questionStats[q.id] = {
                        type: q.type,
                        title: q.title,
                        average: Number(avg.toFixed(2)),
                        distribution: scoreDistribution,
                        count: scores.length,
                    };
                } else if (q.type === "file_upload") {
                    const files: any[] = [];
                    registrations.forEach((r) => {
                        const atts = r.fileAttachments || [];
                        const f = atts.find((item: any) => item.questionId === q.id);
                        if (f) files.push(f);
                    });

                    questionStats[q.id] = {
                        type: q.type,
                        title: q.title,
                        fileCount: files.length,
                        recentFiles: files.slice(0, 10),
                    };
                }
            }
        }

        const timeline: Record<string, number> = {};
        registrations.forEach((r) => {
            const dateStr = (new Date(r.registeredAt).toISOString().split("T")[0]) || "unknown";
            timeline[dateStr] = (timeline[dateStr] || 0) + 1;
        });

        return {
            totalResponses,
            questionStats,
            timeline,
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
}
