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
    imageUrl?: string | null | undefined;
    imagePublicId?: string | null | undefined;
    goToSectionId?: string | undefined; // "next_section" | "submit_form" | sectionId
    isOther?: boolean | undefined;
}

export interface FormValidationRules {
    required?: boolean | undefined;
    minLength?: number | undefined;
    maxLength?: number | undefined;
    pattern?: string | undefined;
    patternError?: string | undefined;
    minValue?: number | undefined;
    maxValue?: number | undefined;
    minSelected?: number | undefined;
    maxSelected?: number | undefined;
    exactSelected?: number | undefined;
    allowedFileTypes?: ("image" | "pdf" | "document" | "spreadsheet" | "zip")[] | undefined;
    maxFileSizeMb?: number | undefined;
    maxFiles?: number | undefined;
    requireResponseEachRow?: boolean | undefined;
    limitOnePerColumn?: boolean | undefined;
    numberType?: "greater_than" | "greater_or_equal" | "less_than" | "less_or_equal" | "equal" | "not_equal" | "between" | "is_number" | "whole_number" | undefined;
    numberValue?: number | undefined;
    numberValue2?: number | undefined;
    textValidationType?: "email" | "url" | "contains" | "not_contains" | undefined;
    textValidationValue?: string | undefined;
}

export interface FormQuestion {
    id: string;
    type: FormQuestionType;
    title: string;
    description?: string | undefined;
    required: boolean;
    imageUrl?: string | null | undefined;
    imagePublicId?: string | null | undefined;
    imageCaption?: string | undefined;
    imageAlignment?: "left" | "center" | "right" | undefined;
    videoUrl?: string | undefined;
    videoTitle?: string | undefined;
    shuffleOptions?: boolean | undefined;
    options?: FormOption[] | undefined;
    scaleConfig?: {
        min: number; // 0 or 1
        max: number; // 2..10
        minLabel?: string | undefined;
        maxLabel?: string | undefined;
    } | undefined;
    ratingConfig?: {
        icon: "star" | "heart" | "thumb";
        levels: number; // 3..10
    } | undefined;
    dateConfig?: {
        includeYear: boolean;
        includeTime: boolean;
    } | undefined;
    timeConfig?: {
        mode: "time" | "duration";
    } | undefined;
    gridConfig?: {
        rows: string[];
        columns: string[];
        requireEachRow?: boolean | undefined;
        limitOnePerColumn?: boolean | undefined;
    } | undefined;
    validation?: FormValidationRules | undefined;
    placeholder?: string | undefined;
    content?: string | undefined; // For markdown_card / title_card
    // Phase 3 Quiz & Answer Key Properties
    points?: number | undefined;
    correctAnswers?: string[] | undefined;
    answerExplanation?: string | undefined;
    feedbackLinks?: Array<{ title: string; url: string }> | undefined;
    isGraded?: boolean | undefined;
    allowPartialCredit?: boolean | undefined;
}

export interface FormSection {
    id: string;
    title: string;
    description?: string | undefined;
    questions: FormQuestion[];
    afterSectionAction: "next_section" | "submit_form" | string;
}

export interface FormStructure {
    sections: FormSection[];
}

export interface FormThemeSettings {
    accentColor: string;
    backgroundColor?: string | undefined;
    cardSurfaceColor?: string | undefined;
    cardShadowStyle?: "soft" | "crisp" | "bold" | undefined;
    buttonStyle?: "rounded" | "pill" | "sharp" | undefined;
    fontFamily: "sans" | "serif" | "mono" | "display";
    headerPosition?: "center" | "top" | "bottom" | undefined;
}

export interface QuizSettings {
    isQuiz?: boolean;
    releaseGrades?: "immediately" | "after_review";
    showMissedQuestions?: boolean;
    showCorrectAnswers?: boolean;
    showPointValues?: boolean;
    defaultPointsPerQuestion?: number | undefined;
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
    quiz?: QuizSettings | undefined;
    responses?: ResponseSettings | undefined;
    presentation?: PresentationSettings | undefined;
    questionDefaults?: QuestionDefaults | undefined;
    saveAsClubDefault?: boolean | undefined;

    // Phase 6.4 Architectural Future Expansion Definitions
    waitlist?: {
        enabled: boolean;
        maxWaitlistCapacity?: number | undefined;
        autoPromote?: boolean | undefined;
    } | undefined;
    teamRegistration?: {
        enabled: boolean;
        minTeamSize?: number | undefined;
        maxTeamSize?: number | undefined;
        requireTeamLead?: boolean | undefined;
    } | undefined;
    qrCheckIn?: {
        enabled: boolean;
        allowSelfCheckIn?: boolean | undefined;
    } | undefined;
    approvalWorkflow?: {
        mode?: "automatic" | "manual" | "tiered" | undefined;
    } | undefined;
    ticketTiers?: Array<{
        id: string;
        name: string;
        capacity: number;
        price?: number | undefined;
    }> | undefined;
}

export type FormStatus = "draft" | "published" | "archived" | "closed";

export interface ClubEventFormRecord {
    id: string;
    eventId: string;
    clubId: string;
    createdBy?: string | null | undefined;
    title: string;
    description: string | null;
    status: FormStatus;
    currentDraftVersionId?: string | null | undefined;
    publishedVersionId?: string | null | undefined;
    headerImageUrl: string | null;
    headerImagePublicId: string | null;
    themeSettings: FormThemeSettings;
    settings: FormSettings;
    defaultSettings: FormSettings;
    structure: FormStructure;
    isPublished: boolean;
    versionCount: number;
    schemaVersion: number;
    createdAt: string;
    updatedAt: string;
    publishedAt?: string | null | undefined;
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
    changeSummary?: string | null | undefined;
    isPublished: boolean;
    publishedBy?: string | null | undefined;
    createdBy?: string | null | undefined;
    createdAt: string;
    publishedAt?: string | null | undefined;
}

export interface MediaAssetRecord {
    id: string;
    formId?: string | null | undefined;
    eventId?: string | null | undefined;
    uploaderUserId?: string | null | undefined;
    publicId: string;
    secureUrl: string;
    resourceType: "image" | "raw" | "video" | string;
    format?: string | null | undefined;
    bytes?: number | null | undefined;
    width?: number | null | undefined;
    height?: number | null | undefined;
    assetPurpose: "form_header" | "question_image" | "option_image" | "student_attachment";
    questionId?: string | null | undefined;
    responseId?: string | null | undefined;
    metadata?: Record<string, any> | undefined;
    createdAt: string;
}

export interface FormResponseRecord {
    responseId: string;
    eventId: string;
    formId: string;
    formVersionId?: string | null | undefined;
    studentId: string;
    registrationId: string;
    ticketCode: string;
    applicantName: string;
    applicantEmail: string;
    department?: string | null | undefined;
    yearOfStudy?: string | null | undefined;
    rollNumber?: string | null | undefined;
    phoneNumber?: string | null | undefined;
    answers: Record<string, any>;
    fileAttachments: FileAttachmentMeta[];
    submissionStatus: string;
    submissionTimestamp: string;
    lastUpdatedAt: string;
    idempotencyKey?: string | null | undefined;
}

export interface FileAttachmentMeta {
    questionId: string;
    questionTitle?: string | undefined;
    fileName: string;
    fileUrl: string;
    filePublicId: string;
    fileSize: number;
    mimeType: string;
}

export interface FormSubmissionPayload {
    applicantName: string;
    applicantEmail: string;
    department?: string | undefined;
    yearOfStudy?: string | undefined;
    rollNumber?: string | undefined;
    phoneNumber?: string | undefined;
    notes?: string | undefined;
    answers: Record<string, any>;
    fileAttachments?: FileAttachmentMeta[] | undefined;
    idempotencyKey?: string | undefined;
}

export interface SaveDraftPayload {
    title?: string | undefined;
    description?: string | null | undefined;
    headerImageUrl?: string | null | undefined;
    headerImagePublicId?: string | null | undefined;
    themeSettings?: Partial<FormThemeSettings> | undefined;
    settings?: Partial<FormSettings> | undefined;
    structure?: FormStructure | undefined;
    isPublished?: boolean | undefined;
    expectedVersionCount?: number | undefined; // For optimistic concurrency check
}

export interface ReorderStructurePayload {
    sectionOrder?: string[] | undefined; // Ordered section IDs
    questionOrder?: Record<string, string[]> | undefined; // sectionId -> array of ordered question IDs
}
