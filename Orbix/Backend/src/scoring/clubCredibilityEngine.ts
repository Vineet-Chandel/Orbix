/**
 * Orbix Club Credibility Engine
 * Mathematical reputation engine utilizing Bayesian dynamic priors, evidence weighting,
 * recency decay, and repeat incident compounding.
 */

export type ScoreLevel = "critical" | "developing" | "reliable" | "trusted" | "exceptional";
export type ConfidenceLevel = "low" | "medium" | "high";
export type EventScope = "CAMPUS" | "PAN_INDIA";

export interface CredibilityEvidenceItem {
    id?: string;
    outcomeQuality: number; // Qi: 0 to 100
    evidenceWeight: number; // Wi: dynamic weight
    createdAt: Date | string;
    isNegative?: boolean;
    reasonCode?: string;
}

export interface DynamicWeightInputs {
    baseWeight?: number; // B: 1.0 (normal/completed), 1.5 (cancelled), 2.0 (deleted with registrations), 1.2 (unpublish to draft), 0.8 (certificate issuance)
    scope?: EventScope; // S: CAMPUS = 1.0, PAN_INDIA = 1.2
    verifiedRegistrations?: number; // A (part 1)
    verifiedAttendees?: number; // A (part 2)
    confidence?: number; // 0.5 to 1.0
    successfulStreak?: number; // T: 0+
    similarIncidentsIn365Days?: number; // P: 0+ (only applies if Qi < 50)
    isNegativeOutcome?: boolean;
    noticeHours?: number; // V: Advance notice hours before scheduled event start
}

export interface CompletedEventRubricInputs {
    deliveryAgainstCommitments?: number; // 0-100 (weight 30%)
    scheduleReliability?: number; // 0-100 (weight 15%)
    participantCommunication?: number; // 0-100 (weight 15%)
    verifiedExperience?: number; // 0-100 (weight 20%)
    complaintResolution?: number; // 0-100 (weight 10%)
    certificateAccuracy?: number; // 0-100 (weight 10%)
}

export interface CancellationRubricInputs {
    hoursNoticeBeforeEvent: number; // Advance notice
    affectedRegistrationsCount: number; // Participant impact
    reasonCategory: "emergency_verified" | "weather_force_majeure" | "academic_institutional" | "operational_delay" | "low_registration" | "unexplained";
    communicatedToAllParticipants: boolean;
    rescheduleOrRemedyOffered: boolean;
}

export interface CredibilityCalculationResult {
    lifetimeScore: number;
    recentScore: number;
    finalScore: number;
    scoreLevel: ScoreLevel;
    confidenceLevel: ConfidenceLevel;
    isProvisional: boolean;
    totalEvidenceWeight: number;
    scoreDelta?: number;
}

export interface ScoringConfig {
    priorScore: number; // 50.0
    priorWeight: number; // 10.0
    lifetimeBlend: number; // 0.70
    recentBlend: number; // 0.30
    recencyWindowDays: number; // 365
    maxPositiveWeight: number; // 4.0
    maxNegativeWeight: number; // 8.0
    baseWeights: {
        normal: number;
        majorIncident: number;
        severeMisconduct: number;
    };
    scopeFactors: {
        CAMPUS: number;
        PAN_INDIA: number;
    };
}

export const DEFAULT_SCORING_CONFIG: ScoringConfig = {
    priorScore: 50.0,
    priorWeight: 10.0,
    lifetimeBlend: 0.70,
    recentBlend: 0.30,
    recencyWindowDays: 365,
    maxPositiveWeight: 4.0,
    maxNegativeWeight: 8.0,
    baseWeights: {
        normal: 1.0,
        majorIncident: 2.0,
        severeMisconduct: 3.0,
    },
    scopeFactors: {
        CAMPUS: 1.0,
        PAN_INDIA: 1.2,
    },
};

export class ClubCredibilityEngine {
    private config: ScoringConfig;

    constructor(customConfig?: Partial<ScoringConfig>) {
        this.config = {
            ...DEFAULT_SCORING_CONFIG,
            ...customConfig,
        };
    }

    /**
     * Compute Dynamic Evidence Weight (Wi)
     * Wi = min(Cap, B * S * A * V * T * P)
     */
    public calculateEvidenceWeight(inputs: DynamicWeightInputs): {
        weight: number;
        breakdown: {
            baseWeight: number;
            scopeFactor: number;
            reachFactor: number;
            confidenceFactor: number;
            streakFactor: number;
            repeatIncidentMultiplier: number;
            rawWeight: number;
            cappedWeight: number;
        };
    } {
        const B = inputs.baseWeight ?? this.config.baseWeights.normal;
        const S = inputs.scope === "PAN_INDIA" ? this.config.scopeFactors.PAN_INDIA : this.config.scopeFactors.CAMPUS;

        const regs = Math.max(0, inputs.verifiedRegistrations || 0);
        const attendees = Math.max(0, inputs.verifiedAttendees || 0);
        const totalPeople = regs + attendees;
        // Reach: 0.6 if 0 people, otherwise min(1.5, 0.8 + 0.2 * ln(1 + totalPeople))
        const rawReach = totalPeople === 0 ? 0.6 : 0.8 + 0.2 * Math.log(1 + totalPeople);
        const A = totalPeople === 0 ? 0.6 : Math.min(1.5, Math.max(0.8, rawReach));

        // Advance notice factor (V) for negative outcomes / cancellations:
        // >= 7 days notice (168h): 0.6x cushion
        // 3 - 6 days notice (72h): 0.9x
        // 24 - 72 hours: 1.2x
        // < 24 hours: 1.6x penalty
        let noticeFactor = 1.0;
        if (inputs.isNegativeOutcome && typeof inputs.noticeHours === "number") {
            if (inputs.noticeHours >= 168) {
                noticeFactor = 0.6;
            } else if (inputs.noticeHours >= 72) {
                noticeFactor = 0.9;
            } else if (inputs.noticeHours >= 24) {
                noticeFactor = 1.2;
            } else {
                noticeFactor = 1.6;
            }
        }

        const baseConfidence = Math.min(1.0, Math.max(0.5, inputs.confidence ?? 1.0));
        const V = Number((baseConfidence * noticeFactor).toFixed(2));

        // Positive streak factor: min(1.20, 1 + 0.04 * min(streak, 5))
        const streak = Math.max(0, inputs.successfulStreak || 0);
        const T = Math.min(1.20, 1 + 0.04 * Math.min(streak, 5));

        // Repeat incidents multiplier: min(2.0, 1 + 0.25 * min(similarVerifiedIncidents, 4))
        // Only applied if isNegativeOutcome is true
        const repeatCount = Math.max(0, inputs.similarIncidentsIn365Days || 0);
        const P = inputs.isNegativeOutcome ? Math.min(2.0, 1 + 0.25 * Math.min(repeatCount, 4)) : 1.0;

        const rawWeight = B * S * A * V * T * P;

        // Apply positive vs negative caps
        const cap = inputs.isNegativeOutcome ? this.config.maxNegativeWeight : this.config.maxPositiveWeight;
        const cappedWeight = Math.min(cap, Math.max(0.1, Number(rawWeight.toFixed(2))));

        return {
            weight: cappedWeight,
            breakdown: {
                baseWeight: Number(B.toFixed(2)),
                scopeFactor: Number(S.toFixed(2)),
                reachFactor: Number(A.toFixed(2)),
                confidenceFactor: Number(V.toFixed(2)),
                streakFactor: Number(T.toFixed(2)),
                repeatIncidentMultiplier: Number(P.toFixed(2)),
                rawWeight: Number(rawWeight.toFixed(2)),
                cappedWeight,
            },
        };
    }

    /**
     * Compute Lifetime, Recent, and Blended Score from historical evidence
     */
    public calculateScoreFromEvidence(
        evidenceList: CredibilityEvidenceItem[],
        referenceDate: Date = new Date()
    ): CredibilityCalculationResult {
        const { priorScore, priorWeight, lifetimeBlend, recentBlend, recencyWindowDays } = this.config;

        let sumLifetimeWeightedQuality = 0;
        let sumLifetimeWeights = 0;

        let sumRecentWeightedQuality = 0;
        let sumRecentWeights = 0;

        const cutoffTime = referenceDate.getTime() - recencyWindowDays * 24 * 60 * 60 * 1000;

        for (const item of evidenceList) {
            const Qi = Math.min(100, Math.max(0, item.outcomeQuality));
            const Wi = Math.max(0, item.evidenceWeight);

            sumLifetimeWeightedQuality += Wi * Qi;
            sumLifetimeWeights += Wi;

            const itemTime = new Date(item.createdAt).getTime();
            if (itemTime >= cutoffTime) {
                sumRecentWeightedQuality += Wi * Qi;
                sumRecentWeights += Wi;
            }
        }

        // Formula: L = (50 * 10 + SUM(Wi * Qi)) / (10 + SUM(Wi))
        const L = (priorScore * priorWeight + sumLifetimeWeightedQuality) / (priorWeight + sumLifetimeWeights);

        // Formula: R = (50 * 10 + SUM_recent(Wi * Qi)) / (10 + SUM_recent(Wi))
        const R = (priorScore * priorWeight + sumRecentWeightedQuality) / (priorWeight + sumRecentWeights);

        // Blended score = round(0.70 * L + 0.30 * R)
        const rawFinal = lifetimeBlend * L + recentBlend * R;
        const finalScore = Math.min(100, Math.max(0, Math.round(rawFinal)));

        const scoreLevel = this.getScoreLevel(finalScore);

        // Confidence and provisional status determination
        const totalItems = evidenceList.length;
        const isProvisional = totalItems < 3;
        const confidenceLevel: ConfidenceLevel = totalItems < 3 ? "low" : totalItems < 7 ? "medium" : "high";

        return {
            lifetimeScore: Number(L.toFixed(2)),
            recentScore: Number(R.toFixed(2)),
            finalScore,
            scoreLevel,
            confidenceLevel,
            isProvisional,
            totalEvidenceWeight: Number(sumLifetimeWeights.toFixed(2)),
        };
    }

    /**
     * Evaluate outcome quality Qi (0-100) for a successfully completed event
     */
    public evaluateCompletedEventQuality(inputs: CompletedEventRubricInputs): {
        qualityScore: number;
        dimensionalBreakdown: Record<string, number>;
    } {
        const delivery = Math.min(100, Math.max(0, inputs.deliveryAgainstCommitments ?? 85));
        const schedule = Math.min(100, Math.max(0, inputs.scheduleReliability ?? 90));
        const comms = Math.min(100, Math.max(0, inputs.participantCommunication ?? 85));
        const experience = Math.min(100, Math.max(0, inputs.verifiedExperience ?? 80));
        const complaint = Math.min(100, Math.max(0, inputs.complaintResolution ?? 95));
        const certificate = Math.min(100, Math.max(0, inputs.certificateAccuracy ?? 90));

        // Weights:
        // Delivery: 30%, Schedule: 15%, Communication: 15%, Experience: 20%, Complaints: 10%, Certificates: 10%
        const weightedScore =
            delivery * 0.30 +
            schedule * 0.15 +
            comms * 0.15 +
            experience * 0.20 +
            complaint * 0.10 +
            certificate * 0.10;

        const qualityScore = Math.min(100, Math.max(0, Math.round(weightedScore)));

        return {
            qualityScore,
            dimensionalBreakdown: {
                deliveryAgainstCommitments: delivery,
                scheduleReliability: schedule,
                participantCommunication: comms,
                verifiedExperience: experience,
                complaintResolution: complaint,
                certificateAccuracy: certificate,
            },
        };
    }

    /**
     * Evaluate outcome quality Qi (0-100) for an event cancellation
     */
    public evaluateCancellationQuality(inputs: CancellationRubricInputs): {
        qualityScore: number;
        dimensionalBreakdown: Record<string, number>;
        explanation: string;
    } {
        // 1. Advance notice (30% weight)
        let advanceNoticeScore = 0;
        if (inputs.hoursNoticeBeforeEvent >= 168) {
            // >= 7 days
            advanceNoticeScore = 100;
        } else if (inputs.hoursNoticeBeforeEvent >= 72) {
            // 3 to 7 days
            advanceNoticeScore = 80;
        } else if (inputs.hoursNoticeBeforeEvent >= 24) {
            // 24 to 72 hours
            advanceNoticeScore = 55;
        } else if (inputs.hoursNoticeBeforeEvent >= 4) {
            // 4 to 24 hours
            advanceNoticeScore = 25;
        } else {
            // < 4 hours (last minute)
            advanceNoticeScore = 5;
        }

        // 2. Impact on registered participants (25% weight)
        let impactScore = 100;
        const affected = Math.max(0, inputs.affectedRegistrationsCount || 0);
        if (affected === 0) {
            impactScore = 100; // No registered participants impacted
        } else if (affected <= 5) {
            impactScore = 80;
        } else if (affected <= 25) {
            impactScore = 55;
        } else if (affected <= 100) {
            impactScore = 30;
        } else {
            impactScore = 10; // Massive participant impact
        }

        // 3. Reason validity & verification (20% weight)
        let reasonScore = 20;
        switch (inputs.reasonCategory) {
            case "emergency_verified":
            case "weather_force_majeure":
                reasonScore = 95;
                break;
            case "academic_institutional":
                reasonScore = 75;
                break;
            case "operational_delay":
                reasonScore = 40;
                break;
            case "low_registration":
                reasonScore = 25;
                break;
            case "unexplained":
            default:
                reasonScore = 5;
                break;
        }

        // 4. Communication & transparency (15% weight)
        const commsScore = inputs.communicatedToAllParticipants ? 90 : 10;

        // 5. Rescheduling or remedies (10% weight)
        const remedyScore = inputs.rescheduleOrRemedyOffered ? 90 : 20;

        const weighted =
            advanceNoticeScore * 0.30 +
            impactScore * 0.25 +
            reasonScore * 0.20 +
            commsScore * 0.15 +
            remedyScore * 0.10;

        const qualityScore = Math.min(100, Math.max(0, Math.round(weighted)));

        let explanation = "";
        if (affected === 0) {
            explanation = "Event cancelled with zero student registrations. Minimal to no credibility impact.";
        } else if (inputs.hoursNoticeBeforeEvent < 4) {
            explanation = `Last-minute cancellation (${Math.round(inputs.hoursNoticeBeforeEvent)} hours before start) affecting ${affected} registered students. High negative impact.`;
        } else if (inputs.reasonCategory === "emergency_verified" || inputs.reasonCategory === "weather_force_majeure") {
            explanation = `Verified emergency/force-majeure cancellation handled with responsible communication to ${affected} students.`;
        } else {
            explanation = `Event cancelled with ${Math.round(inputs.hoursNoticeBeforeEvent)}h advance notice affecting ${affected} students.`;
        }

        return {
            qualityScore,
            dimensionalBreakdown: {
                advanceNotice: advanceNoticeScore,
                participantImpact: impactScore,
                reasonValidity: reasonScore,
                communication: commsScore,
                remedy: remedyScore,
            },
            explanation,
        };
    }

    /**
     * Map numerical score (0-100) to credibility tier
     */
    public getScoreLevel(score: number): ScoreLevel {
        if (score < 40) return "critical"; // 0-39: Red
        if (score < 60) return "developing"; // 40-59: Yellow
        if (score < 75) return "reliable"; // 60-74: Yellow
        if (score < 90) return "trusted"; // 75-89: Green
        return "exceptional"; // 90-100: Green
    }
}
