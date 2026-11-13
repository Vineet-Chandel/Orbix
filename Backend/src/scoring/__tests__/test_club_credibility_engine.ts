import assert from "node:assert";
import { describe, it } from "node:test";
import {
    ClubCredibilityEngine,
    type CredibilityEvidenceItem,
    DEFAULT_SCORING_CONFIG,
} from "../clubCredibilityEngine.js";

describe("ClubCredibilityEngine Comprehensive Test Suite", () => {
    const engine = new ClubCredibilityEngine();

    it("1. Initializes with neutral prior score 50, provisional status, and low confidence", () => {
        const result = engine.calculateScoreFromEvidence([]);
        assert.strictEqual(result.finalScore, 50);
        assert.strictEqual(result.lifetimeScore, 50);
        assert.strictEqual(result.recentScore, 50);
        assert.strictEqual(result.isProvisional, true);
        assert.strictEqual(result.scoreLevel, "developing");
        assert.strictEqual(result.confidenceLevel, "low");
        assert.strictEqual(result.totalEvidenceWeight, 0);
    });

    it("2. Score is clamped between 0 and 100 under extreme positive and negative evidence", () => {
        // Extreme positive
        const extremePositive: CredibilityEvidenceItem[] = Array(50).fill({
            outcomeQuality: 100,
            evidenceWeight: 4.0,
            createdAt: new Date(),
        });
        const posResult = engine.calculateScoreFromEvidence(extremePositive);
        assert.ok(posResult.finalScore <= 100);
        assert.ok(posResult.finalScore >= 95);
        assert.strictEqual(posResult.scoreLevel, "exceptional");
        assert.strictEqual(posResult.isProvisional, false);
        assert.strictEqual(posResult.confidenceLevel, "high");

        // Extreme negative
        const extremeNegative: CredibilityEvidenceItem[] = Array(50).fill({
            outcomeQuality: 0,
            evidenceWeight: 8.0,
            createdAt: new Date(),
        });
        const negResult = engine.calculateScoreFromEvidence(extremeNegative);
        assert.ok(negResult.finalScore >= 0);
        assert.ok(negResult.finalScore <= 10);
        assert.strictEqual(negResult.scoreLevel, "critical");
    });

    it("3. Dynamic evidence weight: Scope Factor (Campus 1.0 vs Pan India 1.2)", () => {
        const campusWeight = engine.calculateEvidenceWeight({
            scope: "CAMPUS",
            verifiedRegistrations: 50,
            verifiedAttendees: 40,
        });

        const panIndiaWeight = engine.calculateEvidenceWeight({
            scope: "PAN_INDIA",
            verifiedRegistrations: 50,
            verifiedAttendees: 40,
        });

        assert.ok(panIndiaWeight.weight > campusWeight.weight, "Pan India weight must exceed Campus weight");
        assert.strictEqual(campusWeight.breakdown.scopeFactor, 1.0);
        assert.strictEqual(panIndiaWeight.breakdown.scopeFactor, 1.2);
    });

    it("4. Dynamic evidence weight: Reach Factor scales with verified participants", () => {
        const smallEvent = engine.calculateEvidenceWeight({
            scope: "CAMPUS",
            verifiedRegistrations: 5,
            verifiedAttendees: 5,
        });

        const massiveEvent = engine.calculateEvidenceWeight({
            scope: "CAMPUS",
            verifiedRegistrations: 500,
            verifiedAttendees: 400,
        });

        assert.ok(massiveEvent.weight > smallEvent.weight, "Massive event must carry higher weight than small gathering");
        assert.ok(massiveEvent.breakdown.reachFactor <= 1.5, "Reach factor must cap at 1.5");
        assert.ok(smallEvent.breakdown.reachFactor >= 0.8, "Reach factor must start at or above 0.8");
    });

    it("5. Streak factor increases weight of subsequent events up to 1.20 cap", () => {
        const noStreak = engine.calculateEvidenceWeight({
            successfulStreak: 0,
        });

        const streak3 = engine.calculateEvidenceWeight({
            successfulStreak: 3,
        });

        const streak5 = engine.calculateEvidenceWeight({
            successfulStreak: 5,
        });

        const streak10 = engine.calculateEvidenceWeight({
            successfulStreak: 10,
        });

        assert.strictEqual(noStreak.breakdown.streakFactor, 1.0);
        assert.strictEqual(streak3.breakdown.streakFactor, 1.12); // 1 + 0.04 * 3
        assert.strictEqual(streak5.breakdown.streakFactor, 1.20); // 1 + 0.04 * 5
        assert.strictEqual(streak10.breakdown.streakFactor, 1.20, "Streak factor must be capped at 1.20");
    });

    it("6. Repeat incidents multiplier compounds negative outcomes up to 2.0 cap", () => {
        const firstIncident = engine.calculateEvidenceWeight({
            isNegativeOutcome: true,
            similarIncidentsIn365Days: 0,
        });

        const repeatedIncident2 = engine.calculateEvidenceWeight({
            isNegativeOutcome: true,
            similarIncidentsIn365Days: 2,
        });

        const repeatedIncident4 = engine.calculateEvidenceWeight({
            isNegativeOutcome: true,
            similarIncidentsIn365Days: 4,
        });

        const repeatedIncident10 = engine.calculateEvidenceWeight({
            isNegativeOutcome: true,
            similarIncidentsIn365Days: 10,
        });

        assert.strictEqual(firstIncident.breakdown.repeatIncidentMultiplier, 1.0);
        assert.strictEqual(repeatedIncident2.breakdown.repeatIncidentMultiplier, 1.5); // 1 + 0.25 * 2
        assert.strictEqual(repeatedIncident4.breakdown.repeatIncidentMultiplier, 2.0); // 1 + 0.25 * 4
        assert.strictEqual(repeatedIncident10.breakdown.repeatIncidentMultiplier, 2.0, "Multiplier must be capped at 2.0");

        // When positive outcome, repeat incident multiplier must NOT apply!
        const positiveWithOldIncidents = engine.calculateEvidenceWeight({
            isNegativeOutcome: false,
            similarIncidentsIn365Days: 4,
        });
        assert.strictEqual(positiveWithOldIncidents.breakdown.repeatIncidentMultiplier, 1.0);
    });

    it("7. Weight caps: Max positive weight = 4.0, Max negative weight = 8.0", () => {
        // Enormous positive parameters
        const hugePos = engine.calculateEvidenceWeight({
            baseWeight: 3.0,
            scope: "PAN_INDIA",
            verifiedRegistrations: 5000,
            verifiedAttendees: 5000,
            successfulStreak: 10,
            isNegativeOutcome: false,
        });
        assert.ok(hugePos.weight <= 4.0, "Positive weight must not exceed 4.0");

        // Enormous negative parameters
        const hugeNeg = engine.calculateEvidenceWeight({
            baseWeight: 3.0, // severe misconduct
            scope: "PAN_INDIA",
            verifiedRegistrations: 5000,
            verifiedAttendees: 5000,
            similarIncidentsIn365Days: 10,
            isNegativeOutcome: true,
        });
        assert.ok(hugeNeg.weight <= 8.0, "Negative weight must not exceed 8.0");
    });

    it("8. Cancellation rubric: 7 days advance notice with 0 registrations vs last minute with 100 registrations", () => {
        const responsibleCancel = engine.evaluateCancellationQuality({
            hoursNoticeBeforeEvent: 180, // > 7 days
            affectedRegistrationsCount: 0,
            reasonCategory: "weather_force_majeure",
            communicatedToAllParticipants: true,
            rescheduleOrRemedyOffered: true,
        });

        const irresponsibleCancel = engine.evaluateCancellationQuality({
            hoursNoticeBeforeEvent: 1.5, // 1.5 hours
            affectedRegistrationsCount: 150,
            reasonCategory: "unexplained",
            communicatedToAllParticipants: false,
            rescheduleOrRemedyOffered: false,
        });

        assert.ok(responsibleCancel.qualityScore >= 90, "Responsible cancellation should score high (>=90)");
        assert.ok(irresponsibleCancel.qualityScore <= 15, "Last minute unexplained cancellation must score very low (<=15)");
    });

    it("9. Completed event rubric: Calculates 6-dimensional weighted quality accurately", () => {
        const completed = engine.evaluateCompletedEventQuality({
            deliveryAgainstCommitments: 100, // 30% -> 30
            scheduleReliability: 100, // 15% -> 15
            participantCommunication: 100, // 15% -> 15
            verifiedExperience: 100, // 20% -> 20
            complaintResolution: 100, // 10% -> 10
            certificateAccuracy: 100, // 10% -> 10
        });

        assert.strictEqual(completed.qualityScore, 100);

        const partial = engine.evaluateCompletedEventQuality({
            deliveryAgainstCommitments: 80, // 24
            scheduleReliability: 70, // 10.5
            participantCommunication: 80, // 12
            verifiedExperience: 75, // 15
            complaintResolution: 90, // 9
            certificateAccuracy: 90, // 9
        });
        // 24 + 10.5 + 12 + 15 + 9 + 9 = 79.5 -> 80
        assert.strictEqual(partial.qualityScore, 80);
    });

    it("10. Recency & Lifetime blend: 0.70 L + 0.30 R allows recovery through recent excellence", () => {
        // Club had bad history 2 years ago (out of 365 days window)
        const twoYearsAgo = new Date(Date.now() - 700 * 24 * 60 * 60 * 1000);
        const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

        const oldEvidence: CredibilityEvidenceItem = {
            outcomeQuality: 20, // bad past
            evidenceWeight: 3.0,
            createdAt: twoYearsAgo,
        };

        const recentEvidence: CredibilityEvidenceItem = {
            outcomeQuality: 95, // excellent recent work
            evidenceWeight: 3.0,
            createdAt: yesterday,
        };

        const result = engine.calculateScoreFromEvidence([oldEvidence, recentEvidence]);

        // Recent score must be significantly higher than lifetime score
        assert.ok(result.recentScore > result.lifetimeScore, "Recent score must reflect recent performance without old penalty");
        assert.ok(result.finalScore > 50, "Club with stellar recent performance recovers past starting baseline 50");
    });
});
