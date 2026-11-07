export type FormQuestionType =
    | "short_answer"
    | "paragraph"
    | "multiple_choice"
    | "checkboxes"
    | "dropdown"
    | "linear_scale"
    | "rating"
    | "file_upload"
    | "multiple_choice_grid"
    | "checkbox_grid"
    | "date"
    | "time"
    | "title_card"
    | "image_block"
    | "video_block"
    | "image_card"
    | "markdown_card";

export interface FormOption {
    id: string;
    text: string;
    imageUrl?: string | null;
    imagePublicId?: string | null;
    goToSectionId?: string; // "next_section" | "submit_form" | sectionId
    isOther?: boolean;
}

export interface FormValidationRules {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    patternError?: string;
    minValue?: number;
    maxValue?: number;
    minSelected?: number;
    maxSelected?: number;
    exactSelected?: number;
    allowedFileTypes?: ("image" | "pdf" | "document" | "spreadsheet" | "zip")[];
    maxFileSizeMb?: number;
    maxFiles?: number;
    requireResponseEachRow?: boolean;
    limitOnePerColumn?: boolean;
    numberType?: "greater_than" | "greater_or_equal" | "less_than" | "less_or_equal" | "equal" | "not_equal" | "between" | "is_number" | "whole_number";
    numberValue?: number;
    numberValue2?: number;
    textValidationType?: "email" | "url" | "contains" | "not_contains";
    textValidationValue?: string;
}

export interface FormQuestion {
    id: string;
    type: FormQuestionType;
    title: string;
    description?: string;
    required: boolean;
    imageUrl?: string | null;
    imagePublicId?: string | null;
    imageCaption?: string;
    imageAlignment?: "left" | "center" | "right";
    videoUrl?: string;
    videoTitle?: string;
    shuffleOptions?: boolean;
    options?: FormOption[];
    scaleConfig?: {
        min: number; // 0 or 1
        max: number; // 2..10
        minLabel?: string;
        maxLabel?: string;
    };
    ratingConfig?: {
        icon: "star" | "heart" | "thumb";
        levels: number; // 3..10
    };
    dateConfig?: {
        includeYear: boolean;
        includeTime: boolean;
    };
    timeConfig?: {
        mode: "time" | "duration";
    };
    gridConfig?: {
        rows: string[];
        columns: string[];
        requireEachRow?: boolean;
        limitOnePerColumn?: boolean;
    };
    validation?: FormValidationRules;
    placeholder?: string;
    content?: string; // For markdown_card / title_card
    // Phase 3 Quiz & Answer Key Properties
    points?: number;
    correctAnswers?: string[];
    answerExplanation?: string;
    feedbackLinks?: Array<{ title: string; url: string }>;
    isGraded?: boolean;
    allowPartialCredit?: boolean;
}

export interface FormSection {
    id: string;
    title: string;
    description?: string;
    questions: FormQuestion[];
    afterSectionAction: "next_section" | "submit_form" | string;
}

export interface FormStructure {
    sections: FormSection[];
}

export interface FormThemeSettings {
    accentColor: string;
    backgroundColor?: string;
    cardSurfaceColor?: string;
    cardShadowStyle?: "soft" | "crisp" | "bold";
    buttonStyle?: "rounded" | "pill" | "sharp";
    fontFamily: "sans" | "serif" | "mono" | "display";
    headerPosition?: "center" | "top" | "bottom";
}

export interface QuizSettings {
    isQuiz?: boolean;
    releaseGrades?: "immediately" | "after_review";
    showMissedQuestions?: boolean;
    showCorrectAnswers?: boolean;
    showPointValues?: boolean;
    defaultPointsPerQuestion?: number;
}

export interface ResponseSettings {
    collectOrbixIdentity?: boolean;
    collectVerifiedEmail?: boolean;
    allowAdditionalEmail?: boolean;
    useStudentProfile?: boolean;
    limitOneResponse?: boolean;
    allowMultipleResponses?: boolean;
    allowEditResponse?: boolean;
    requireLogin?: boolean;
    enforceEventEligibility?: boolean;
    sendConfirmationEmail?: boolean;
    allowStudentResponseAccess?: boolean;
    sendResponseCopy?: "never" | "optional" | "always";
    notifyClubAdmins?: boolean;
    notifyAdminsOnSubmission?: boolean;
    isOpen?: boolean;
    closingDateTime?: string | null;
    maxResponses?: number | null;
    autoCloseOnMax?: boolean;
    autoCloseOnLimit?: boolean;
    closedMessage?: string;
    responseReceipts?: "off" | "when_requested" | "always";
}

export interface PresentationSettings {
    showProgressBar?: boolean;
    shuffleQuestionOrder?: boolean;
    shuffleAnswerOptions?: boolean;
    shuffleOptionOrder?: boolean;
    confirmationMessage?: string;
    showSubmitAnotherLink?: boolean;
    autosaveRespondentProgress?: boolean;
    autosaveProgress?: boolean;
    disableRespondentAutosave?: boolean;
    disableAutosave?: boolean;
    showResultsSummary?: boolean;
    viewResultsSummary?: boolean;
    privacyFirstRestricted?: boolean;
}

export interface QuestionDefaults {
    defaultRequired?: boolean;
    defaultValidation?: boolean;
    defaultPointValue?: number;
}

export interface FormSettings {
    isOpen: boolean;
    closedMessage: string;
    maxResponses: number | null;
    limitOneResponse: boolean;
    allowEditResponse: boolean;
    requireLogin: boolean;
    showProgressBar: boolean;
    confirmationMessage: string;
    notifyOnRegistration: boolean;

    // Phase 3 Deep Configuration Sections
    quiz?: QuizSettings;
    responses?: ResponseSettings;
    presentation?: PresentationSettings;
    questionDefaults?: QuestionDefaults;
    saveAsClubDefault?: boolean;
}

export type FormStatus = "draft" | "published" | "archived" | "closed";

export interface ClubEventFormRecord {
    id: string;
    eventId: string;
    clubId: string;
    createdBy?: string | null;
    title: string;
    description: string | null;
    status: FormStatus;
    currentDraftVersionId?: string | null;
    publishedVersionId?: string | null;
    headerImageUrl: string | null;
    headerImagePublicId: string | null;
    themeSettings: FormThemeSettings;
    settings: FormSettings;
    defaultSettings?: FormSettings;
    structure: FormStructure;
    isPublished: boolean;
    versionCount?: number;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null;
}

export interface FormVersionRecord {
    id: string;
    formId: string;
    eventId: string;
    versionNumber: number;
    title: string;
    description: string | null;
    headerImageUrl: string | null;
    headerImagePublicId: string | null;
    structure: FormStructure;
    settings: FormSettings;
    themeSettings: FormThemeSettings;
    changeSummary?: string | null;
    isPublished: boolean;
    publishedBy?: string | null;
    createdBy?: string | null;
    createdAt: string;
    publishedAt?: string | null;
    responseCount?: number;
}

export interface FileAttachmentMeta {
    questionId: string;
    questionTitle?: string;
    fileName: string;
    fileUrl: string;
    filePublicId: string;
    fileSize: number;
    mimeType: string;
}

export interface FormSubmissionPayload {
    applicantName: string;
    applicantEmail: string;
    department?: string;
    yearOfStudy?: string;
    rollNumber?: string;
    phoneNumber?: string;
    notes?: string;
    answers: Record<string, any>;
    fileAttachments?: FileAttachmentMeta[];
    idempotencyKey?: string;
    formVersionId?: string;
    institutionId?: string;
    institutionName?: string;
    universityName?: string;
    campusName?: string;
    institutionCity?: string;
    institutionState?: string;
    isUnlistedInstitution?: boolean;
}

export interface UploadSignatureConfig {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    publicId: string;
    folder: string;
    signature: string;
    uploadUrl: string;
    maxBytes: number;
    allowedFormats: string[];
}

export interface StudentIdentityProfile {
    id: string;
    fullName: string;
    firstName: string;
    lastName: string;
    username: string;
    email: string;
    avatarUrl: string;
    college: string;
    collegeId: string | null;
    rollNumber: string | null;
    department: string | null;
    yearOfStudy: string | null;
    phoneNumber: string | null;
    github: string | null;
    linkedin: string | null;
    website: string | null;
    resumeUrl: string | null;
    resumeFilename: string | null;
    isVerifiedCampus: boolean;
}

export interface ClubEventFormResponse {
    success: boolean;
    form: ClubEventFormRecord;
    isNew: boolean;
    event: any;
    club: any;
    studentProfile?: StudentIdentityProfile | null;
    userResponse?: any;
    canSubmit: boolean;
    isClosed: boolean;
    closedReason?: string;
    registeredCount: number;
}

export interface PublicFormResponse {
    success: boolean;
    form: ClubEventFormRecord;
    event: any;
    club: any;
    studentProfile?: StudentIdentityProfile | null;
    isClosed: boolean;
    closedReason?: string;
    canSubmit: boolean;
    userResponse?: any;
    draftResponse?: {
        answers?: Record<string, any>;
        fileAttachments?: FileAttachmentMeta[];
        currentSectionIndex?: number;
        sectionHistory?: number[];
        formVersionId?: string;
        updatedAt?: string;
    } | null;
    registeredCount: number;
}

export interface FormStatsResponse {
    success: boolean;
    stats: {
        totalResponses: number;
        totalRegistrations?: number;
        successfulCount?: number;
        pendingCount?: number;
        attendedCount?: number;
        rejectedCount?: number;
        cancelledCount?: number;
        statusDistribution?: {
            registered: number;
            pending: number;
            attended: number;
            rejected: number;
            cancelled: number;
        };
        totalFilesCount?: number;
        totalFilesBytes?: number;
        questionStats: Record<string, any>;
        timeline: Record<string, number>;
        eventTitle: string;
        quizStats?: {
            average: number;
            median: number;
            min: number;
            max: number;
            maxPossiblePoints: number;
            gradedCount: number;
            releasedCount: number;
            distribution?: Record<string, number>;
        } | null;
    };
}

/**
 * Fetch form definition and context for Club Staff (Builder mode)
 */
export async function fetchClubEventForm(eventId: string): Promise<ClubEventFormResponse> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load event form.");
    }
    return data;
}

/**
 * Save form definition (Builder mode)
 */
export async function saveClubEventForm(
    eventId: string,
    payload: {
        title?: string;
        description?: string | null;
        headerImageUrl?: string | null;
        headerImagePublicId?: string | null;
        themeSettings?: Partial<FormThemeSettings>;
        settings?: Partial<FormSettings>;
        structure?: FormStructure;
        isPublished?: boolean;
    }
): Promise<{ success: boolean; message: string; form: ClubEventFormRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to save form.");
    }
    return data;
}

/**
 * Request Cloudinary signed signature for club media (header banner, question image)
 */
export async function requestFormMediaSignature(
    eventId: string,
    type: "banner" | "question",
    questionId?: string
): Promise<UploadSignatureConfig> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/upload-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ type, questionId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to generate upload signature.");
    }
    return data.uploadConfig;
}

/**
 * Fetch analytics and stats for form questions
 */
export async function fetchFormStats(eventId: string): Promise<FormStatsResponse> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/stats`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load form analytics.");
    }
    return data;
}

/**
 * Fetch public form for student responder
 */
export async function fetchPublicEventForm(eventId: string): Promise<PublicFormResponse> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load registration form.");
    }
    return data;
}

/**
 * Request Cloudinary signature for student file upload attachment
 */
export async function requestAttachmentUploadSignature(
    eventId: string,
    questionId: string,
    fileType?: string
): Promise<UploadSignatureConfig> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/upload-signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questionId, fileType }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to generate upload signature.");
    }
    return data.uploadConfig;
}

/**
 * Upload file directly to Cloudinary using signed credentials
 */
export function uploadFileToCloudinary(
    config: UploadSignatureConfig,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ secureUrl: string; publicId: string; fileName: string; fileSize: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        secureUrl: response.secure_url,
                        publicId: response.public_id || config.publicId,
                        fileName: file.name,
                        fileSize: file.size,
                        mimeType: file.type || "application/octet-stream",
                    });
                } catch {
                    reject(new Error("Failed to parse Cloudinary response."));
                }
            } else {
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    reject(new Error(errRes.error?.message || `Upload failed with HTTP ${xhr.status}`));
                } catch {
                    reject(new Error(`Upload failed with HTTP ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Network connection error during file upload."));
        });

        xhr.addEventListener("abort", () => {
            reject(new Error("File upload was cancelled."));
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", config.apiKey);
        formData.append("timestamp", String(config.timestamp));
        formData.append("signature", config.signature);
        formData.append("public_id", config.publicId);

        xhr.open("POST", config.uploadUrl);
        xhr.send(formData);
    });
}

/**
 * Submit student form response
 */
export async function submitEventFormResponse(
    eventId: string,
    payload: FormSubmissionPayload
): Promise<{
    success: boolean;
    message: string;
    registration: any;
    isUpdate: boolean;
}> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        const err: any = new Error(data?.message || "Failed to submit event registration.");
        if (data?.code) err.code = data.code;
        throw err;
    }
    return data;
}

/**
 * Publish form draft into an immutable snapshot
 */
export async function publishClubEventForm(
    eventId: string,
    changeSummary?: string
): Promise<{ success: boolean; message: string; version: FormVersionRecord; form: ClubEventFormRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ changeSummary }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to publish form.");
    }
    return data;
}

/**
 * Close or reopen event form registrations
 */
export async function closeOrReopenForm(
    eventId: string,
    isOpen: boolean,
    closedMessage?: string
): Promise<{ success: boolean; message: string; status: string; settings: FormSettings }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ isOpen, closedMessage }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update registration status.");
    }
    return data;
}

/**
 * Revert draft to an immutable version snapshot
 */
export async function revertFormVersion(
    eventId: string,
    versionId: string
): Promise<{ success: boolean; message: string; form: ClubEventFormRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/revert/${encodeURIComponent(versionId)}`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to revert form version.");
    }
    return data;
}

/**
 * Fetch all immutable form versions
 */
export async function fetchFormVersions(eventId: string): Promise<{ versions: FormVersionRecord[] }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/versions`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load form versions.");
    }
    return data;
}

/**
 * Fetch exact snapshot of a form version
 */
export async function fetchFormVersionSnapshot(eventId: string, versionId: string): Promise<{ version: FormVersionRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/versions/${encodeURIComponent(versionId)}`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load version snapshot.");
    }
    return data;
}

export interface FetchResponsesParams {
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
}

export interface FetchResponsesResult {
    success: boolean;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    statusCounts?: {
        totalCount: number;
        successfulCount: number;
        pendingCount: number;
        attendedCount: number;
        rejectedCount: number;
        cancelledCount: number;
    };
    responses: any[];
}

/**
 * Fetch responses with pagination, search, question filtering, date range, and sorting (Phase 5.4)
 */
export async function fetchFormResponses(
    eventId: string,
    params?: FetchResponsesParams
): Promise<FetchResponsesResult> {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.versionId) query.set("versionId", params.versionId);
    if (params?.status) query.set("status", params.status);
    if (params?.search) query.set("search", params.search);
    if (params?.startDate) query.set("startDate", params.startDate);
    if (params?.endDate) query.set("endDate", params.endDate);
    if (params?.questionId) query.set("questionId", params.questionId);
    if (params?.answerSearch) query.set("answerSearch", params.answerSearch);
    if (params?.sortBy) query.set("sortBy", params.sortBy);
    if (params?.sortOrder) query.set("sortOrder", params.sortOrder);
    if (params?.responseIds && params.responseIds.length > 0) {
        query.set("responseIds", params.responseIds.join(","));
    }

    const qs = query.toString();
    const url = `/api/club/events/${encodeURIComponent(eventId)}/form/responses${qs ? `?${qs}` : ""}`;
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load form responses.");
    }
    return data;
}

/**
 * Export responses as CSV file (Phase 5.5)
 */
export async function exportFormResponsesCsv(
    eventId: string,
    options?: {
        versionId?: string;
        status?: string;
        search?: string;
        startDate?: string;
        endDate?: string;
        responseIds?: string[];
    }
): Promise<Blob> {
    const query = new URLSearchParams();
    if (options?.versionId) query.set("versionId", options.versionId);
    if (options?.status) query.set("status", options.status);
    if (options?.search) query.set("search", options.search);
    if (options?.startDate) query.set("startDate", options.startDate);
    if (options?.endDate) query.set("endDate", options.endDate);
    if (options?.responseIds && options.responseIds.length > 0) {
        query.set("responseIds", options.responseIds.join(","));
    }

    const qs = query.toString();
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/responses/export${qs ? `?${qs}` : ""}`, {
        credentials: "include",
    });
    if (!res.ok) {
        throw new Error("Failed to export responses CSV.");
    }
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `event_responses_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
    return blob;
}

/**
 * Update individual response registration status (Phase 5.3)
 */
export async function updateResponseStatus(
    eventId: string,
    registrationId: string,
    status: string,
    reviewNotes?: string
): Promise<{ success: boolean; message: string; registration: any }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/responses/${encodeURIComponent(registrationId)}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, reviewNotes }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update response status.");
    }
    return data;
}

/**
 * Fetch student's own registration for this event
 */
export async function fetchStudentRegistration(eventId: string): Promise<{ success: boolean; registration: any }> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/registration`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to fetch registration.");
    }
    return data;
}

/**
 * Edit student's existing registration
 */
export async function updateStudentRegistration(
    eventId: string,
    payload: FormSubmissionPayload
): Promise<{ success: boolean; message: string; registration: any; isUpdate: boolean }> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/registration`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to update registration.");
    }
    return data;
}

/**
 * Release quiz grades to respondents
 */
export async function releaseFormQuizGrades(
    eventId: string
): Promise<{ success: boolean; message: string; releasedCount: number }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/release-grades`, {
        method: "POST",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to release quiz grades.");
    }
    return data;
}

/**
 * Fetch authenticated student's autosaved registration draft
 */
export async function fetchStudentDraft(eventId: string): Promise<{
    success: boolean;
    draft: {
        answers?: Record<string, any>;
        fileAttachments?: FileAttachmentMeta[];
        currentSectionIndex?: number;
        sectionHistory?: number[];
        formVersionId?: string;
        updatedAt?: string;
    } | null;
}> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/draft`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load draft.");
    }
    return data;
}

/**
 * Autosave student's unfinished registration draft
 */
export async function saveStudentDraft(
    eventId: string,
    payload: {
        answers?: Record<string, any>;
        fileAttachments?: FileAttachmentMeta[];
        currentSectionIndex?: number;
        sectionHistory?: number[];
        formVersionId?: string;
    }
): Promise<{ success: boolean; message: string; draft: any }> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/draft`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to save draft.");
    }
    return data;
}

/**
 * Clear student's autosaved draft
 */
export async function clearStudentDraft(eventId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/events/${encodeURIComponent(eventId)}/form/draft`, {
        method: "DELETE",
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to clear draft.");
    }
    return data;
}

/**
 * Phase 6.1 Question Library: Fetch questions from past club events
 */
export async function fetchClubQuestionLibrary(
    eventId: string,
    clubId?: string
): Promise<{
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
    const queryParam = clubId ? `?clubId=${encodeURIComponent(clubId)}` : "";
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/question-library${queryParam}`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load club question library.");
    }
    return data;
}

/**
 * Import questions into the form (Phase 6.1)
 */
export async function importQuestionsToForm(
    eventId: string,
    questions: FormQuestion[],
    targetSectionId?: string
): Promise<{ success: boolean; message: string; form: ClubEventFormRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/import-questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ questions, targetSectionId }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to import questions.");
    }
    return data;
}

/**
 * Phase 6.3 AI-Assisted Form Creation: Suggest questionnaire based on prompt & event info
 */
export async function requestAiQuestionSuggestions(
    eventId: string,
    payload: { prompt?: string; eventType?: string; eventDescription?: string; eventTitle?: string; clubId?: string }
): Promise<{
    success: boolean;
    suggestedQuestions: FormQuestion[];
    generatedBy: "gemini" | "deterministic-engine";
    summary: string;
}> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/ai-suggest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to generate AI question suggestions.");
    }
    return data;
}

/**
 * Phase 6.4 QR Code Verification: Verify ticket pass code for quick check-in
 */
export async function verifyRegistrationQrCheckIn(
    eventId: string,
    ticketCode: string
): Promise<{
    success: boolean;
    valid: boolean;
    message: string;
    registration?: any;
}> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/qr-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ticketCode }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "QR Check-in verification failed.");
    }
    return data;
}

/**
 * Phase 6.4 Cross-Event Analytics: Multi-event registration & turnout metrics
 */
export async function fetchClubCrossEventAnalytics(clubId: string): Promise<{
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
    const res = await fetch(`/api/club/${encodeURIComponent(clubId)}/forms/cross-event-analytics`, {
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
        throw new Error(data?.message || "Failed to load cross-event analytics.");
    }
    return data;
}
