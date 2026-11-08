/**
 * Certificate Studio Frontend API Client
 */
import type {
    CertificateDesign,
    CertificateTemplateRecord,
    CertificateBatchRecord,
    BatchProgressInfo,
    CsvReconciliationResult,
    ReconciledCsvRow,
} from "../types/certificateStudio";

export type {
    CertificateDesign,
    CertificateTemplateRecord,
    CertificateBatchRecord,
    BatchProgressInfo,
    CsvReconciliationResult,
    ReconciledCsvRow,
};

export interface TemplateListResponse {
    success: boolean;
    systemTemplates: CertificateTemplateRecord[];
    clubTemplates: CertificateTemplateRecord[];
}

export interface UploadBackgroundResponse {
    success: boolean;
    assetUrl: string;
    format: string;
    width?: number;
    height?: number;
    bytes: number;
    aspectRatio?: string;
    message: string;
}

export interface BatchIssuancePayload {
    templateId?: string | null;
    customDesign?: CertificateDesign | null;
    title: string;
    certificateType:
        | "participation"
        | "attendance"
        | "completion"
        | "winner"
        | "first_runner_up"
        | "second_runner_up"
        | "finalist"
        | "best_innovation"
        | "best_project"
        | "best_performer"
        | "speaker"
        | "mentor"
        | "judge"
        | "volunteer"
        | "organizer"
        | "excellence"
        | "merit"
        | "contributor"
        | "appreciation"
        | string;
    issuanceSource: "event" | "team" | "manual" | "csv";
    eventId?: string | null;
    teamId?: string | null;
    awardPosition?: string;
    description?: string;
    signerName?: string;
    signerRole?: string;
    issueDate?: string;
    metadata?: Record<string, any>;
    teamIssuanceMode?: "individual_only" | "team_only" | "both";
    teamSnapshots?: Array<{
        teamId: string;
        teamName: string;
        teamSlug?: string;
        members: Array<{
            userId?: string | null;
            isExternal?: boolean;
            name: string;
            username?: string;
            email?: string;
            role?: string;
            customPosition?: string;
        }>;
    }>;
    recipients: Array<{
        userId?: string;
        isExternal?: boolean;
        email?: string;
        name?: string;
        customName?: string;
        customRole?: string;
        customPosition?: string;
    }>;
    allowManualOverride?: boolean;
    overrideReason?: string;
    asyncMode?: boolean;
    idempotencyKey?: string;
}

export interface EventEligibilityReport {
    eventId: string;
    eventTitle: string;
    eventStartsAt: string | null;
    category: string;
    summary: {
        totalRegistrations: number;
        eligibleCount: number;
        verifiedAttendeesCount: number;
        ineligibleCount: number;
        manualReviewCount: number;
        missingInfoCount: number;
        teamEligibilityCount: number;
        alreadyIssuedCount: number;
    };
    eligibleRecipients: Array<{
        userId: string;
        registrationId: string;
        name: string;
        email: string;
        username: string;
        collegeName: string;
        status: string;
        checkedInAt: string | null;
        ticketCode: string;
        department?: string;
        yearOfStudy?: string;
        teamId?: string;
        teamName?: string;
        quizScore?: number;
        awardPosition?: string;
        alreadyHasCert: boolean;
    }>;
    ineligibleRecipients: Array<{
        userId: string;
        registrationId: string;
        name: string;
        email: string;
        username: string;
        status: string;
        checkedInAt: string | null;
        exclusionReason: string;
    }>;
    manualReviewCases: Array<{
        userId: string;
        name: string;
        email: string;
        issue: string;
        suggestedAction: string;
    }>;
}

export interface BatchIssuanceResult {
    success: boolean;
    batchId: string;
    totalRequested: number;
    successfulCount: number;
    skippedCount: number;
    failedCount: number;
    deduplicatedCount?: number;
    teamCertificatesCount?: number;
    individualCertificatesCount?: number;
    isAsync?: boolean;
    status?: string;
    issuedCertificates: Array<{
        id: string;
        isTeam?: boolean;
        teamId?: string;
        teamName?: string;
        recipientId: string | null;
        recipientName: string;
        credentialCode: string;
        sha256Hash?: string;
        claimToken?: string;
    }>;
    message: string;
}

export interface PublicVerificationResult {
    success: boolean;
    verified: boolean;
    message?: string;
    certificate?: {
        id: string;
        credentialCode: string;
        title: string;
        certificateType: string;
        recipientName: string;
        issueDate: string;
        signerName?: string;
        signerRole?: string;
        description?: string;
        sha256Hash?: string;
        isRevoked: boolean;
        revokedAt?: string;
        revocationReason?: string;
        verificationCount: number;
        clubName?: string;
        clubSlug?: string;
        collegeName?: string;
        clubLogoUrl?: string;
        eventTitle?: string;
        teamName?: string;
        isTeam?: boolean;
        teamMembers?: Array<{ name: string; role?: string; customPosition?: string }>;
        memberCount?: number;
    };
}

/**
 * Lists templates (system templates + club-owned templates)
 */
export async function fetchCertificateTemplates(category?: string): Promise<TemplateListResponse> {
    const params = new URLSearchParams();
    if (category && category !== "all") params.append("category", category);

    const res = await fetch(`/api/club/certificates/templates?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load certificate templates.");
    return data;
}

/**
 * Gets a single template by ID
 */
export async function fetchCertificateTemplate(templateId: string): Promise<CertificateTemplateRecord> {
    const res = await fetch(`/api/club/certificates/templates/${encodeURIComponent(templateId)}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load template.");
    return data.template;
}

/**
 * Creates a new club template
 */
export async function createCertificateTemplate(payload: {
    name: string;
    category?: string;
    design: CertificateDesign;
    backgroundAssetUrl?: string | null;
    backgroundFit?: "cover" | "contain" | "stretch";
    orientation?: "landscape" | "portrait";
    pageWidth?: number;
    pageHeight?: number;
}): Promise<CertificateTemplateRecord> {
    const res = await fetch("/api/club/certificates/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to save certificate template.");
    return data.template;
}

/**
 * Updates a club-owned template
 */
export async function updateCertificateTemplate(
    templateId: string,
    payload: {
        name?: string;
        category?: string;
        design?: CertificateDesign;
        backgroundAssetUrl?: string | null;
        backgroundFit?: "cover" | "contain" | "stretch";
        status?: "draft" | "published" | "archived";
    }
): Promise<CertificateTemplateRecord> {
    const res = await fetch(`/api/club/certificates/templates/${encodeURIComponent(templateId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to update template.");
    return data.template;
}

/**
 * Duplicates any template into a club-owned copy
 */
export async function duplicateCertificateTemplate(
    templateId: string,
    customName?: string
): Promise<CertificateTemplateRecord> {
    const res = await fetch(`/api/club/certificates/templates/${encodeURIComponent(templateId)}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ customName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to duplicate template.");
    return data.template;
}

/**
 * Renames a club template
 */
export async function renameCertificateTemplate(
    templateId: string,
    name: string
): Promise<CertificateTemplateRecord> {
    const res = await fetch(`/api/club/certificates/templates/${encodeURIComponent(templateId)}/rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to rename template.");
    return data.template;
}

/**
 * Archives a club template
 */
export async function archiveCertificateTemplate(templateId: string): Promise<void> {
    const res = await fetch(`/api/club/certificates/templates/${encodeURIComponent(templateId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to delete template.");
}

/**
 * Uploads a background asset with strict sanitization
 */
export async function uploadCertificateBackground(file: File): Promise<UploadBackgroundResponse> {
    const formData = new FormData();
    formData.append("background", file);

    const res = await fetch("/api/club/certificates/upload-background", {
        method: "POST",
        credentials: "include",
        body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to upload background.");
    return data;
}

/**
 * Evaluates comprehensive participant eligibility for an event (Phase 10)
 */
export async function fetchEventEligibilityReport(
    eventId: string,
    category: string = "participation",
    teamId?: string
): Promise<EventEligibilityReport> {
    const params = new URLSearchParams();
    if (category) params.append("category", category);
    if (teamId) params.append("teamId", teamId);

    const res = await fetch(`/api/club/certificates/events/${encodeURIComponent(eventId)}/eligibility?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load event eligibility report.");
    return data.report;
}

/**
 * Retrieves authoritative team membership roster for coordinator review before issuance (Phase 12)
 */
export async function fetchTeamRosterForReview(teamId: string, eventId?: string): Promise<{
    teamId: string;
    teamName: string;
    teamSlug: string;
    memberCount: number;
    members: Array<{
        id: string;
        userId?: string | null;
        isExternal: boolean;
        name: string;
        username?: string;
        email?: string;
        role: string;
        customPosition?: string;
    }>;
}> {
    const params = new URLSearchParams();
    if (eventId) params.append("eventId", eventId);
    const res = await fetch(`/api/club/certificates/teams/${encodeURIComponent(teamId)}/roster?${params.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to fetch team roster.");
    return data.team;
}

/**
 * Issues certificates in batch
 */
export async function issueCertificateBatch(payload: BatchIssuancePayload): Promise<BatchIssuanceResult> {
    const res = await fetch("/api/club/certificates/issue-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to issue certificate batch.");
    return data;
}

/**
 * Fetches batch history
 */
export async function fetchCertificateBatches(): Promise<CertificateBatchRecord[]> {
    const res = await fetch("/api/club/certificates/batches", {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load batches.");
    return data.batches || [];
}

/**
 * Fetches real-time async generation progress for a batch (Phase 13)
 */
export async function fetchBatchProgress(batchId: string): Promise<BatchProgressInfo> {
    const res = await fetch(`/api/club/certificates/batches/${batchId}/progress`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load batch progress.");
    return data.progress;
}

/**
 * Partial batch recovery: retries failed recipients in a batch (Phase 13)
 */
export async function retryFailedBatch(batchId: string): Promise<{ success: boolean; retriedCount: number }> {
    const res = await fetch(`/api/club/certificates/batches/${batchId}/retry-failed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to retry batch.");
    return data;
}

/**
 * Reconciles CSV recipient roster with campus directory and event registrations (Phase 14)
 */
export async function reconcileCsvRoster(params: {
    file?: File;
    csvText?: string;
    eventId?: string;
    customColumnMapping?: Record<string, string>;
}): Promise<CsvReconciliationResult> {
    let body: any;
    const headers: Record<string, string> = {};

    if (params.file) {
        const formData = new FormData();
        formData.append("file", params.file);
        if (params.eventId) formData.append("eventId", params.eventId);
        if (params.customColumnMapping) {
            formData.append("customColumnMapping", JSON.stringify(params.customColumnMapping));
        }
        body = formData;
    } else {
        headers["Content-Type"] = "application/json";
        body = JSON.stringify({
            csvText: params.csvText,
            eventId: params.eventId,
            customColumnMapping: params.customColumnMapping,
        });
    }

    const res = await fetch("/api/club/certificates/csv/reconcile", {
        method: "POST",
        headers,
        credentials: "include",
        body,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to reconcile CSV recipients.");
    return data.reconciliation;
}

/**
 * Downloads the official sanitized recipient CSV template (Phase 14)
 */
export async function downloadSampleCsvTemplate(): Promise<Blob> {
    const res = await fetch("/api/club/certificates/csv/sample-template", {
        credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to download CSV template.");
    return await res.blob();
}

/**
 * Generates test PDF blob from design + sample data
 */
export async function previewSampleCertificate(
    design: CertificateDesign,
    sampleData?: any
): Promise<Blob> {
    const res = await fetch("/api/club/certificates/preview-sample", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ design, sampleData }),
    });
    if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.message || "Failed to render sample preview PDF.");
    }
    return res.blob();
}

/**
 * Public certificate verification
 */
export async function verifyCertificatePublic(credentialCode: string): Promise<PublicVerificationResult> {
    const res = await fetch(`/api/club/certificates/verify/${encodeURIComponent(credentialCode)}`, {
        headers: { "Content-Type": "application/json" },
    });
    const data = await res.json();
    return data;
}

/**
 * Revokes a certificate with reason
 */
export async function revokeCertificate(certificateId: string, reason: string): Promise<void> {
    const res = await fetch(`/api/club/certificates/${encodeURIComponent(certificateId)}/revoke`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to revoke certificate.");
}

/**
 * Marks student certificate notification as revealed
 */
export async function revealCertificateNotification(certificateId: string): Promise<void> {
    const res = await fetch(`/api/club/certificates/user/${encodeURIComponent(certificateId)}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to reveal certificate.");
}

export interface CertificateDashboardStats {
    totalCertificatesIssued: number;
    eventCertificates: number;
    manualCertificates: number;
    individualCertificates: number;
    teamCertificates: number;
    pendingIssuance: number;
    failedGenerations: number;
    revokedCertificates: number;
}

export async function fetchCertificateStats(): Promise<CertificateDashboardStats> {
    const res = await fetch("/api/club/certificates/stats", {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load dashboard metrics.");
    return data.stats;
}

export interface CertificateHistoryItem {
    id: string;
    recipientName: string;
    recipientEmail?: string;
    title: string;
    certificateType: string;
    credentialCode: string;
    signerName?: string;
    signerRole?: string;
    issueDate: string;
    isRevoked: boolean;
    revokedAt?: string;
    revocationReason?: string;
    verificationCount: number;
    sha256Hash?: string;
    pdfUrl?: string;
    createdAt: string;
    eventTitle?: string;
}

export interface CertificateHistoryResponse {
    success: boolean;
    certificates: CertificateHistoryItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export async function fetchCertificateHistory(params: {
    page?: number;
    limit?: number;
    search?: string;
    filter?: string;
    sortBy?: string;
}): Promise<CertificateHistoryResponse> {
    const qs = new URLSearchParams();
    if (params.page) qs.append("page", String(params.page));
    if (params.limit) qs.append("limit", String(params.limit));
    if (params.search) qs.append("search", params.search);
    if (params.filter) qs.append("filter", params.filter);
    if (params.sortBy) qs.append("sortBy", params.sortBy);

    const res = await fetch(`/api/club/certificates/history?${qs.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load issuance history.");
    return data;
}

export interface CertificateClubSettings {
    defaultSignerName: string;
    defaultSignerRole: string;
    defaultTitle: string;
    requireAttendance: boolean;
    verificationPublic: boolean;
    signatureAssetUrl?: string | null;
}

export async function fetchCertificateSettings(): Promise<CertificateClubSettings> {
    const res = await fetch("/api/club/certificates/settings", {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to load settings.");
    return data.settings;
}

export async function updateCertificateSettings(
    settings: Partial<CertificateClubSettings>
): Promise<void> {
    const res = await fetch("/api/club/certificates/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to update settings.");
}

// =========================================================================
// RECIPIENT DIRECTORY & CLAIM WORKFLOW (PHASE 11)
// =========================================================================

export interface RecipientDirectoryItem {
    id: string;
    name: string;
    username: string;
    email?: string;
    isEmailMasked?: boolean;
    avatarUrl?: string | null;
    collegeName?: string | null;
    roleBadge?: string;
    sourceCategory: "club_member" | "event_participant" | "team_member" | "orbix_user";
}

export interface ClubTeamDirectoryItem {
    teamId: string;
    teamName: string;
    teamSlug?: string;
    description?: string;
    memberCount: number;
    members: Array<{
        userId: string;
        name: string;
        username: string;
        email?: string;
        role: string;
    }>;
}

export interface RecipientDirectoryResponse {
    success: boolean;
    recipients: RecipientDirectoryItem[];
    teams?: ClubTeamDirectoryItem[];
}

export async function fetchRecipientDirectory(
    source: "all" | "orbix_user" | "username" | "club_members" | "event_participants" | "team_members" | "teams" = "all",
    query = ""
): Promise<RecipientDirectoryResponse> {
    const qs = new URLSearchParams();
    if (source) qs.append("source", source);
    if (query) qs.append("query", query);

    const res = await fetch(`/api/club/certificates/recipient-directory?${qs.toString()}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to search recipient directory.");
    return data;
}

export interface CertificateClaimDetails {
    id: string;
    title: string;
    certificateType: string;
    recipientName: string;
    recipientEmailMasked: string;
    description?: string;
    credentialCode: string;
    issueDate: string;
    claimStatus: "pending_claim" | "claimed" | "expired";
    claimExpiresAt: string;
    clubName: string;
    clubSlug: string;
    collegeName?: string;
    clubLogoUrl?: string;
    eventTitle?: string;
}

export async function fetchCertificateClaim(claimToken: string): Promise<CertificateClaimDetails> {
    const res = await fetch(`/api/club/certificates/claim/${encodeURIComponent(claimToken)}`, {
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to retrieve claim details.");
    return data.claim;
}

export async function claimCertificate(claimToken: string): Promise<{
    success: boolean;
    id: string;
    credentialCode: string;
    recipientName: string;
    title: string;
    message: string;
}> {
    const res = await fetch(`/api/club/certificates/claim/${encodeURIComponent(claimToken)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to claim certificate.");
    return data;
}
