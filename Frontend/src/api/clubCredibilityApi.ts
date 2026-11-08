import { apiFetch } from "./apiClient";

export type ScoreLevel = "critical" | "developing" | "reliable" | "trusted" | "exceptional";
export type ConfidenceLevel = "low" | "medium" | "high";

export interface ClubCredibilitySnapshot {
    clubId: string;
    currentScore: number;
    lifetimeScore: number;
    recentScore: number;
    scoreLevel: ScoreLevel;
    confidenceLevel: ConfidenceLevel;
    isProvisional: boolean;
    totalVerifiedEvents: number;
    totalVerifiedIncidents: number;
    successfulEventStreak: number;
    totalEvidenceWeight: number;
    dimensionalScores: {
        eventDelivery: number;
        scheduleReliability: number;
        communication: number;
        participantExperience: number;
        cancellationReliability: number;
        certificateIntegrity: number;
    };
    scoringVersion: string;
    lastCalculatedAt: string;
}

export interface CredibilityLedgerEntry {
    id: string;
    clubId: string;
    eventId?: string;
    sourceAction: string;
    reasonCode: string;
    outcomeQuality: number;
    evidenceWeight: number;
    scoreBefore: number;
    scoreAfter: number;
    scoreDelta: number;
    evidenceConfidence: number;
    factorBreakdown: Record<string, any>;
    evidenceReferences?: Record<string, any>;
    status: "confirmed" | "reversed" | "pending";
    actorType: string;
    createdAt: string;
    eventTitle?: string;
    eventSlug?: string;
    eventScope?: "CAMPUS" | "PAN_INDIA";
    eventStatus?: string;
    hasAppeal?: boolean;
    latestAppealStatus?: "pending" | "under_review" | "approved" | "rejected";
    explanation: string;
}

export interface CredibilityImpactPreview {
    action: string;
    currentScore: number;
    estimatedDelta: number;
    projectedScore: number;
    estimatedRange: string;
    affectedParticipants: number;
    hoursNotice?: number;
    qualityScore: number;
    evidenceWeight: number;
    factors: string[];
    alternatives: string[];
    eventVersionToken: string;
}

export interface ScopeEligibilityStatus {
    eligible: boolean;
    minScore: number;
    currentScore: number;
    scorePassed: boolean;
    scoreDeficit: number;
    inCooldown: boolean;
    cooldownDurationHours: number;
    cooldownRemainingMs: number;
    cooldownExpiresAt: string | null;
    lastEventCreatedAt: string | null;
    reason: string;
}

export interface ClubEventCreationEligibility {
    clubId: string;
    currentScore: number;
    scoreLevel: ScoreLevel;
    confidenceLevel: ConfidenceLevel;
    isProvisional: boolean;
    campus: ScopeEligibilityStatus;
    panIndia: ScopeEligibilityStatus;
}

export interface CreationEligibilityResponse {
    success: boolean;
    eligibility: ClubEventCreationEligibility;
}

export interface CredibilityOverviewResponse {
    success: boolean;
    snapshot: ClubCredibilitySnapshot;
    recentEntries: CredibilityLedgerEntry[];
}

export interface CredibilityHistoryResponse {
    success: boolean;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    history: CredibilityLedgerEntry[];
}

/**
 * Fetch club credibility overview
 */
export async function fetchClubCredibility(): Promise<CredibilityOverviewResponse> {
    return apiFetch<CredibilityOverviewResponse>("/club/credibility");
}

/**
 * Fetch paginated credibility ledger timeline
 */
export async function fetchClubCredibilityHistory(page = 1, limit = 20): Promise<CredibilityHistoryResponse> {
    return apiFetch<CredibilityHistoryResponse>(`/club/credibility/history?page=${page}&limit=${limit}`);
}

/**
 * Calculate real-time impact preview for proposed action
 */
export async function previewCredibilityImpact(payload: {
    eventId: string;
    action: "cancel" | "delete" | "draft" | "complete";
    reasonCategory?: string;
    communicatedToAll?: boolean;
    rescheduleOffered?: boolean;
}): Promise<CredibilityImpactPreview> {
    const data = await apiFetch<{ success: boolean; preview: CredibilityImpactPreview }>("/club/credibility/preview-impact", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data.preview;
}

/**
 * Submit appeal against negative credibility deduction
 */
export async function submitCredibilityAppeal(payload: {
    ledgerId: string;
    reason: string;
    evidenceAttachments?: any[];
}) {
    return apiFetch("/club/credibility/appeals", {
        method: "POST",
        body: JSON.stringify(payload),
    });
}

/**
 * Pre-issuance certificate integrity check
 */
export async function preflightCertificateIntegrity(payload: {
    eventId: string;
    recipientUserIds: string[];
}) {
    const data = await apiFetch<{ success: boolean; validation: any }>("/club/credibility/certificates/preflight", {
        method: "POST",
        body: JSON.stringify(payload),
    });
    return data.validation;
}

/**
 * Recalculate credibility snapshot from verified ledger
 */
export async function recalculateClubCredibility() {
    return apiFetch("/club/credibility/recalculate", {
        method: "POST",
    });
}

/**
 * Public credibility badge for any club
 */
export async function fetchPublicClubCredibility(clubId: string) {
    const data = await apiFetch<{ success: boolean; credibility: any }>(`/clubs/${clubId}/credibility/public`);
    return data.credibility;
}

/**
 * Fetch real-time event creation eligibility (centralized score gating & cooldowns)
 */
export async function fetchEventCreationEligibility(): Promise<CreationEligibilityResponse> {
    return apiFetch<CreationEligibilityResponse>("/club/events/creation-eligibility");
}
