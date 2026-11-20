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
    allowedFileTypes?: string[];
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
    publishedVersion?: FormVersionRecord | null;
    totalVersions?: number;
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
export async function fetchClubEventForm(eventId: string, signal?: AbortSignal): Promise<ClubEventFormResponse> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form`, {
        credentials: "include",
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000),
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
        signal: AbortSignal.timeout(30000),
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
        signal: AbortSignal.timeout(30000),
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

        xhr.timeout = 120000;
        xhr.addEventListener("timeout", () => reject(new Error("Image upload timed out. Please try again.")));
        xhr.open("POST", config.uploadUrl);
        xhr.send(formData);
    });
}

/**
 * Upload student attachment directly to backend fallback endpoint (Multi-part stream)
 */
export function uploadAttachmentDirectToServer(
    eventId: string,
    questionId: string,
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
                    const data = JSON.parse(xhr.responseText);
                    if (data.success && data.attachment) {
                        resolve({
                            secureUrl: data.attachment.fileUrl,
                            publicId: data.attachment.filePublicId,
                            fileName: data.attachment.fileName,
                            fileSize: data.attachment.fileSize,
                            mimeType: data.attachment.mimeType,
                        });
                    } else {
                        reject(new Error(data.message || "Server upload failed."));
                    }
                } catch {
                    reject(new Error("Failed to parse server upload response."));
                }
            } else {
                try {
                    const err = JSON.parse(xhr.responseText);
                    reject(new Error(err.message || `Upload failed with HTTP ${xhr.status}`));
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
        formData.append("questionId", questionId);

        xhr.open("POST", `/api/events/${encodeURIComponent(eventId)}/form/upload`);
        xhr.withCredentials = true;
        xhr.send(formData);
    });
}

/**
 * Resilient student file upload: tries Cloudinary direct upload first,
 * and automatically falls back to server-side multipart stream if needed.
 */
export async function uploadStudentAttachment(
    eventId: string,
    questionId: string,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ secureUrl: string; publicId: string; fileName: string; fileSize: number; mimeType: string }> {
    try {
        const config = await requestAttachmentUploadSignature(eventId, questionId, file.type);
        return await uploadFileToCloudinary(config, file, onProgress);
    } catch (directErr: any) {
        console.warn("Direct Cloudinary upload failed or was blocked, falling back to server upload:", directErr);
        return await uploadAttachmentDirectToServer(eventId, questionId, file, onProgress);
    }
}

/**
 * Format Definitions Registry for UI & Validation
 */
export const FILE_FORMAT_DEFINITIONS: Record<string, { extensions: string[]; mimeTypes: string[]; label: string; badge: string }> = {
    pdf: {
        extensions: ["pdf"],
        mimeTypes: ["application/pdf"],
        label: "PDF Document (.pdf)",
        badge: "PDF",
    },
    png: {
        extensions: ["png"],
        mimeTypes: ["image/png"],
        label: "PNG Image (.png)",
        badge: "PNG",
    },
    jpg: {
        extensions: ["jpg", "jpeg"],
        mimeTypes: ["image/jpeg"],
        label: "Image (JPG / JPEG)",
        badge: "JPG",
    },
    image: {
        extensions: ["jpg", "jpeg", "png", "webp"],
        mimeTypes: ["image/jpeg", "image/png", "image/webp"],
        label: "Images (JPG, PNG)",
        badge: "Image",
    },
    docx: {
        extensions: ["doc", "docx"],
        mimeTypes: [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        label: "Word / DOCX (.doc, .docx)",
        badge: "DOCX",
    },
    docs: {
        extensions: ["doc", "docx"],
        mimeTypes: [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        label: "Word / DOCX (.doc, .docx)",
        badge: "DOCS",
    },
    txt: {
        extensions: ["txt"],
        mimeTypes: ["text/plain"],
        label: "Plain Text (.txt)",
        badge: "TXT",
    },
    document: {
        extensions: ["doc", "docx", "txt", "rtf"],
        mimeTypes: [
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "text/plain",
        ],
        label: "Word / DOCX / TXT",
        badge: "Docs",
    },
    excel: {
        extensions: ["xls", "xlsx", "csv"],
        mimeTypes: [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv",
        ],
        label: "Excel / Spreadsheet (.xlsx, .csv)",
        badge: "Excel",
    },
    spreadsheet: {
        extensions: ["xls", "xlsx", "csv"],
        mimeTypes: [
            "application/vnd.ms-excel",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "text/csv",
        ],
        label: "Excel / Spreadsheet (.xlsx, .csv)",
        badge: "Excel",
    },
    zip: {
        extensions: ["zip", "rar", "7z", "tar", "gz"],
        mimeTypes: [
            "application/zip",
            "application/x-zip-compressed",
            "application/x-rar-compressed",
            "application/x-7z-compressed",
            "application/x-tar",
            "application/gzip",
        ],
        label: "ZIP / Tarball Archive (.zip, .tar, .7z)",
        badge: "ZIP",
    },
};

export function getAcceptStringForAllowedTypes(allowedTypes?: string[]): string {
    if (!allowedTypes || allowedTypes.length === 0) {
        return ".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip";
    }
    const parts: string[] = [];
    for (const t of allowedTypes) {
        const key = t.toLowerCase().replace(/^\./, "").trim();
        const def = FILE_FORMAT_DEFINITIONS[key];
        if (def) {
            def.extensions.forEach((e) => parts.push(`.${e}`));
            def.mimeTypes.forEach((m) => parts.push(m));
        } else {
            parts.push(`.${key}`);
        }
    }
    return Array.from(new Set(parts)).join(",");
}

export function getAllowedTypeBadges(allowedTypes?: string[]): { id: string; label: string; badge: string }[] {
    if (!allowedTypes || allowedTypes.length === 0) {
        return [{ id: "any", label: "All Supported Formats", badge: "ANY" }];
    }
    const badges: { id: string; label: string; badge: string }[] = [];
    const seen = new Set<string>();
    for (const t of allowedTypes) {
        const key = t.toLowerCase().replace(/^\./, "").trim();
        const def = FILE_FORMAT_DEFINITIONS[key];
        if (def && !seen.has(def.badge)) {
            seen.add(def.badge);
            badges.push({ id: key, label: def.label, badge: def.badge });
        } else if (!seen.has(key.toUpperCase())) {
            seen.add(key.toUpperCase());
            badges.push({ id: key, label: `.${key.toUpperCase()}`, badge: key.toUpperCase() });
        }
    }
    return badges;
}

export function validateLocalFile(
    file: File,
    validation?: { allowedFileTypes?: string[]; maxFileSizeMb?: number }
): { valid: boolean; error?: string } {
    if (!file) return { valid: false, error: "No file provided." };

    const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
    const ext = extMatch ? extMatch[1] : "";

    const maxMb = validation?.maxFileSizeMb ?? 10;
    if (file.size > maxMb * 1024 * 1024) {
        const actualMb = (file.size / (1024 * 1024)).toFixed(1);
        return { valid: false, error: `File "${file.name}" (${actualMb} MB) exceeds maximum allowed size of ${maxMb} MB.` };
    }

    if (validation?.allowedFileTypes && validation.allowedFileTypes.length > 0) {
        const validExts = new Set<string>();
        for (const t of validation.allowedFileTypes) {
            const key = t.toLowerCase().replace(/^\./, "").trim();
            const def = FILE_FORMAT_DEFINITIONS[key];
            if (def) {
                def.extensions.forEach((e) => validExts.add(e));
            } else {
                validExts.add(key);
            }
        }

        if (!validExts.has(ext)) {
            const badges = getAllowedTypeBadges(validation.allowedFileTypes).map((b) => b.badge).join(", ");
            return {
                valid: false,
                error: `File type ".${ext}" is not allowed. Organizers only accept: ${badges}.`,
            };
        }
    }

    return { valid: true };
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
): Promise<{ success: boolean; isUnchanged?: boolean; message: string; version: FormVersionRecord; form: ClubEventFormRecord }> {
    const res = await fetch(`/api/club/events/${encodeURIComponent(eventId)}/form/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        signal: AbortSignal.timeout(30000),
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

/**
 * ---------------------------------------------------------------------------
 * FORM CONTENT EQUALITY & SEMANTIC CANONICALIZER
 * ---------------------------------------------------------------------------
 * Deep deterministic comparison between working draft and published version.
 * Accurately tracks whether cards, questions, validation rules, settings, or
 * themes have changed without false positives from UI transient state.
 */

function sortKeysDeterministic(val: any): any {
    if (val === null || val === undefined) return null;
    if (Array.isArray(val)) {
        return val.map(sortKeysDeterministic);
    }
    if (typeof val === "object" && !(val instanceof Date)) {
        const sorted: Record<string, any> = {};
        const keys = Object.keys(val).sort();
        for (const k of keys) {
            const v = val[k];
            if (k === "_uiTemp" || k === "isDragging" || k === "isEditing" || k === "tempId") continue;
            sorted[k] = sortKeysDeterministic(v);
        }
        return sorted;
    }
    return val;
}

export function canonicalizeFormContent(raw: any): Record<string, any> {
    if (!raw || typeof raw !== "object") return {};

    const structure = typeof raw.structure === "string" ? (() => { try { return JSON.parse(raw.structure); } catch { return {}; } })() : (raw.structure || {});
    const settings = typeof raw.settings === "string" ? (() => { try { return JSON.parse(raw.settings); } catch { return {}; } })() : (raw.settings || {});
    const themeSettings = typeof raw.themeSettings === "string" ? (() => { try { return JSON.parse(raw.themeSettings); } catch { return {}; } })() : (raw.themeSettings || raw.theme_settings || {});

    // Compare the actual schema, including media, option text, routing, required,
    // quiz, validation and theme fields. Whitelisting legacy field names silently
    // treated real edits as already published.
    return {
        title: raw.title || "",
        description: raw.description || "",
        headerImageUrl: raw.headerImageUrl || raw.header_image_url || null,
        headerImagePublicId: raw.headerImagePublicId || null,
        structure,
        settings,
        themeSettings,
    };
}

export function getCanonicalFormString(form: any): string {
    const canonical = canonicalizeFormContent(form);
    const sorted = sortKeysDeterministic(canonical);
    return JSON.stringify(sorted);
}

export function isFormContentEqual(a: any, b: any): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    return getCanonicalFormString(a) === getCanonicalFormString(b);
}
