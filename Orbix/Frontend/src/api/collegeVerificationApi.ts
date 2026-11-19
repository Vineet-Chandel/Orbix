/**
 * Frontend College Verification API Client
 */

export interface OcrExtractedFields {
    studentName: string | null;
    collegeName: string | null;
    enrollmentNumber: string | null;
    courseName: string | null;
    academicYear: string | null;
    institutionEmail: string | null;
    phoneNumber: string | null;
}

export interface OcrPreviewResponse {
    success: boolean;
    confidence: number;
    extractedFields: OcrExtractedFields;
    fieldConfidence: Record<keyof OcrExtractedFields, number>;
    rawTextPreview?: string;
    error?: string;
    warning?: string;
}

export interface CollegeVerificationRecord {
    id: string;
    user_id: string;
    college_id: string;
    status: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "INVALIDATED";
    document_type: string;
    student_name: string | null;
    enrollment_number: string | null;
    course_name: string | null;
    academic_year: string | null;
    institution_email: string | null;
    is_email_verified: boolean;
    email_verified_at: string | null;
    phone_number: string | null;
    is_phone_verified: boolean;
    phone_verified_at: string | null;
    ocr_confidence: number;
    extracted_data: OcrExtractedFields;
    rejection_reason: string | null;
    reviewer_notes: string | null;
    reviewed_by: string | null;
    reviewer_username: string | null;
    reviewed_at: string | null;
    created_at: string;
    updated_at: string;
    college_name: string | null;
    college_city: string | null;
    college_state: string | null;
    college_website: string | null;
    user_username?: string | null;
    user_email?: string | null;
    user_display_name?: string | null;
    user_avatar_url?: string | null;
    user_created_at?: string | null;
    document_previews?: Array<{
        url: string;
        originalName: string;
        size: number;
        format: string;
    }>;
}

export interface VerificationStatusResponse {
    success: boolean;
    status: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "INVALIDATED";
    isCollegeVerified: boolean;
    currentCollege: {
        id: string;
        officialName: string;
        city?: string;
        state?: string;
        aisheCode?: string;
        website?: string;
    } | null;
    activeApplication: CollegeVerificationRecord | null;
    latestApplication: CollegeVerificationRecord | null;
    history: CollegeVerificationRecord[];
    verifiedChannels?: {
        email: string | null;
        emailVerifiedAt: string | null;
        phone: string | null;
        phoneVerifiedAt: string | null;
    };
}

export interface FounderQueueResponse {
    success: boolean;
    total: number;
    limit: number;
    offset: number;
    applications: CollegeVerificationRecord[];
}

/**
 * Fetch current user's college verification status and history.
 */
export async function fetchCollegeVerificationStatus(): Promise<VerificationStatusResponse> {
    const res = await fetch("/api/verification/college/status", {
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load college verification status.");
    }
    return data;
}

/**
 * Run OCR scan on student document without saving application.
 */
export async function previewDocumentOcr(file: File, collegeName?: string): Promise<OcrPreviewResponse> {
    const formData = new FormData();
    formData.append("document", file);
    if (collegeName) {
        formData.append("collegeName", collegeName);
    }

    const res = await fetch("/api/verification/college/ocr-preview", {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to process document with OCR.");
    }
    return data;
}

/**
 * Submit official college verification application.
 */
export async function submitCollegeVerification(payload: FormData): Promise<{
    success: boolean;
    message: string;
    application: CollegeVerificationRecord;
}> {
    const res = await fetch("/api/verification/college/submit", {
        method: "POST",
        credentials: "include",
        body: payload,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to submit college verification.");
    }
    return data;
}

/**
 * Send institutional email verification link.
 */
export async function sendInstitutionalEmail(email: string, collegeId: string): Promise<{
    success: boolean;
    message: string;
    domainMatched: boolean;
    matchedDomain: string | null;
    cooldownSeconds?: number;
}> {
    const res = await fetch("/api/verification/college/email/send", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, collegeId }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to send institutional verification email.");
    }
    return data;
}

/**
 * Verify institutional email link token.
 */
export async function verifyInstitutionalEmailToken(token: string): Promise<{
    success: boolean;
    message: string;
    email: string;
}> {
    const res = await fetch(`/api/verification/college/email/verify?token=${encodeURIComponent(token)}`, {
        method: "GET",
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to verify email token.");
    }
    return data;
}

/**
 * Send phone verification SMS code.
 */
export async function sendCollegePhoneOtp(phone: string): Promise<{
    success: boolean;
    message: string;
    phone: string;
    cooldownSeconds?: number;
}> {
    const res = await fetch("/api/verification/college/phone/send-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to send SMS verification code.");
    }
    return data;
}

/**
 * Authoritatively verify phone OTP code.
 */
export async function verifyCollegePhoneOtp(phone: string, otp: string): Promise<{
    success: boolean;
    message: string;
    phone: string;
    canonical?: string;
    verifiedAt?: string;
}> {
    const res = await fetch("/api/verification/college/phone/verify-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to verify phone code.");
    }
    return data;
}

// =========================================================================
// FOUNDER REVIEW API METHODS
// =========================================================================

/**
 * Check if logged-in user is an authorized founder.
 */
export async function checkFounderPrivilege(): Promise<{
    success: boolean;
    isFounder: boolean;
    userId?: string;
    username?: string;
}> {
    const res = await fetch("/api/internal/college-verifications/auth-check", {
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    return data || { success: false, isFounder: false };
}

/**
 * Fetch founder queue applications with filters.
 */
export async function fetchFounderQueue(params: {
    status?: string;
    search?: string;
    limit?: number;
    offset?: number;
}): Promise<FounderQueueResponse> {
    const query = new URLSearchParams();
    if (params.status && params.status !== "all") query.set("status", params.status);
    if (params.search) query.set("search", params.search);
    if (params.limit) query.set("limit", String(params.limit));
    if (params.offset) query.set("offset", String(params.offset));

    const res = await fetch(`/api/internal/college-verifications/queue?${query.toString()}`, {
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch verification queue.");
    }
    return data;
}

/**
 * Fetch single application details with short-lived signed URLs.
 */
export async function fetchApplicationDetails(id: string): Promise<{
    success: boolean;
    application: CollegeVerificationRecord;
}> {
    const res = await fetch(`/api/internal/college-verifications/application/${encodeURIComponent(id)}`, {
        credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to load application details.");
    }
    return data;
}

/**
 * Approve application as founder.
 */
export async function approveApplication(id: string, notes?: string): Promise<{
    success: boolean;
    message: string;
    application: CollegeVerificationRecord;
}> {
    const res = await fetch(`/api/internal/college-verifications/application/${encodeURIComponent(id)}/approve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to approve application.");
    }
    return data;
}

/**
 * Reject application as founder (mandatory reason).
 */
export async function rejectApplication(id: string, reason: string, notes?: string): Promise<{
    success: boolean;
    message: string;
    application: CollegeVerificationRecord;
}> {
    const res = await fetch(`/api/internal/college-verifications/application/${encodeURIComponent(id)}/reject`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, notes }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || "Failed to reject application.");
    }
    return data;
}
