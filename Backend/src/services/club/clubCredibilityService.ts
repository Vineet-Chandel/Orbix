import { query } from "../../database/client.js";
import {
    ClubCredibilityEngine,
    type CredibilityEvidenceItem,
    type DynamicWeightInputs,
    type ScoreLevel,
    type ConfidenceLevel,
    type CompletedEventRubricInputs,
    type CancellationRubricInputs,
} from "../../scoring/clubCredibilityEngine.js";

export interface CredibilitySnapshot {
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

export interface RecordCredibilityEventParams {
    clubId: string;
    eventId?: string | undefined;
    sourceAction:
        | "event_completed"
        | "event_cancelled"
        | "event_postponed"
        | "event_deleted"
        | "certificate_issued"
        | "complaint_resolved"
        | "incident_verified"
        | "appeal_reversed"
        | "manual_adjustment";
    reasonCode: string;
    outcomeQuality: number; // 0 - 100
    weightInputs: DynamicWeightInputs;
    evidenceConfidence?: number | undefined;
    factorBreakdown?: Record<string, any> | undefined;
    evidenceReferences?: Record<string, any> | undefined;
    actorId?: string | undefined;
    actorType?: "club_admin" | "system" | "platform_admin" | undefined;
    idempotencyKey?: string | undefined;
}

const engine = new ClubCredibilityEngine();

export class ClubCredibilityService {
    /**
     * Get or initialize club credibility snapshot
     */
    public static async getSnapshot(clubId: string): Promise<CredibilitySnapshot> {
        const res = await query(
            `SELECT
                club_id AS "clubId",
                current_score::float AS "currentScore",
                lifetime_score::float AS "lifetimeScore",
                recent_score::float AS "recentScore",
                score_level AS "scoreLevel",
                confidence_level AS "confidenceLevel",
                is_provisional AS "isProvisional",
                total_verified_events AS "totalVerifiedEvents",
                total_verified_incidents AS "totalVerifiedIncidents",
                successful_event_streak AS "successfulEventStreak",
                total_evidence_weight::float AS "totalEvidenceWeight",
                dimensional_scores AS "dimensionalScores",
                scoring_version AS "scoringVersion",
                last_calculated_at AS "lastCalculatedAt"
             FROM public.club_credibility_snapshots
             WHERE club_id = $1
             LIMIT 1;`,
            [clubId]
        );

        if (res.rows[0]) {
            return res.rows[0];
        }

        // Initialize default snapshot for newly enrolled club
        const insertRes = await query(
            `INSERT INTO public.club_credibility_snapshots (
                club_id, current_score, lifetime_score, recent_score,
                score_level, confidence_level, is_provisional,
                total_verified_events, total_verified_incidents,
                successful_event_streak, total_evidence_weight
            ) VALUES (
                $1, 50.00, 50.00, 50.00,
                'developing', 'low', true,
                0, 0, 0, 0.00
            )
            ON CONFLICT (club_id) DO UPDATE
                SET updated_at = NOW()
            RETURNING
                club_id AS "clubId",
                current_score::float AS "currentScore",
                lifetime_score::float AS "lifetimeScore",
                recent_score::float AS "recentScore",
                score_level AS "scoreLevel",
                confidence_level AS "confidenceLevel",
                is_provisional AS "isProvisional",
                total_verified_events AS "totalVerifiedEvents",
                total_verified_incidents AS "totalVerifiedIncidents",
                successful_event_streak AS "successfulEventStreak",
                total_evidence_weight::float AS "totalEvidenceWeight",
                dimensional_scores AS "dimensionalScores",
                scoring_version AS "scoringVersion",
                last_calculated_at AS "lastCalculatedAt";`,
            [clubId]
        );

        return insertRes.rows[0];
    }

    /**
     * Get paginated credibility ledger timeline
     */
    public static async getHistory(clubId: string, page = 1, limit = 20) {
        const offset = Math.max(0, (page - 1) * limit);

        const [recordsRes, countRes] = await Promise.all([
            query(
                `SELECT
                    l.id,
                    l.club_id AS "clubId",
                    l.event_id AS "eventId",
                    l.source_action AS "sourceAction",
                    l.reason_code AS "reasonCode",
                    l.outcome_quality::float AS "outcomeQuality",
                    l.evidence_weight::float AS "evidenceWeight",
                    l.score_before::float AS "scoreBefore",
                    l.score_after::float AS "scoreAfter",
                    l.score_delta::float AS "scoreDelta",
                    l.evidence_confidence::float AS "evidenceConfidence",
                    l.factor_breakdown AS "factorBreakdown",
                    l.evidence_references AS "evidenceReferences",
                    l.status,
                    l.actor_type AS "actorType",
                    l.scoring_version AS "scoringVersion",
                    l.created_at AS "createdAt",
                    l.finalised_at AS "finalisedAt",
                    e.title AS "eventTitle",
                    e.slug AS "eventSlug",
                    e.scope AS "eventScope",
                    e.status AS "eventStatus",
                    (SELECT COUNT(*)::int FROM public.club_credibility_appeals a WHERE a.ledger_id = l.id) > 0 AS "hasAppeal",
                    (SELECT a.appeal_status FROM public.club_credibility_appeals a WHERE a.ledger_id = l.id ORDER BY a.created_at DESC LIMIT 1) AS "latestAppealStatus"
                 FROM public.club_credibility_ledger l
                 LEFT JOIN public.club_events e ON e.id = l.event_id
                 WHERE l.club_id = $1
                 ORDER BY l.created_at DESC
                 LIMIT $2 OFFSET $3;`,
                [clubId, limit, offset]
            ),
            query(
                `SELECT COUNT(*)::int AS total FROM public.club_credibility_ledger WHERE club_id = $1;`,
                [clubId]
            ),
        ]);

        const total = countRes.rows[0]?.total || 0;

        return {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            history: recordsRes.rows.map((row: any) => ({
                ...row,
                explanation: this.formatHumanExplanation(row),
            })),
        };
    }

    /**
     * Record an immutable credibility ledger entry & update club snapshot
     */
    public static async recordCredibilityEvent(params: RecordCredibilityEventParams) {
        // Idempotency check: prevent duplicate credit/penalty on retries
        if (params.idempotencyKey) {
            const existingRes = await query(
                `SELECT id, score_after::float AS "scoreAfter", score_delta::float AS "scoreDelta"
                 FROM public.club_credibility_ledger
                 WHERE idempotency_key = $1
                 LIMIT 1;`,
                [params.idempotencyKey]
            );
            if (existingRes.rows[0]) {
                const snapshot = await this.getSnapshot(params.clubId);
                return {
                    ledgerEntry: existingRes.rows[0],
                    snapshot,
                    idempotentReplay: true,
                };
            }
        }

        const snapshot = await this.getSnapshot(params.clubId);

        // Fetch past confirmed ledger entries to build dynamic streak and historical evidence list
        const pastEntriesRes = await query(
            `SELECT outcome_quality::float AS "outcomeQuality", evidence_weight::float AS "evidenceWeight", created_at AS "createdAt"
             FROM public.club_credibility_ledger
             WHERE club_id = $1 AND status = 'confirmed'
             ORDER BY created_at ASC;`,
            [params.clubId]
        );

        const pastEvidence: CredibilityEvidenceItem[] = pastEntriesRes.rows;

        // Calculate dynamic evidence weight
        const isNegativeOutcome = params.outcomeQuality < 50;
        const weightCalc = engine.calculateEvidenceWeight({
            ...params.weightInputs,
            successfulStreak: snapshot.successfulEventStreak,
            isNegativeOutcome,
        });

        const newEvidenceItem: CredibilityEvidenceItem = {
            outcomeQuality: params.outcomeQuality,
            evidenceWeight: weightCalc.weight,
            createdAt: new Date(),
        };

        const simulatedEvidenceList = [...pastEvidence, newEvidenceItem];
        const newScoreResult = engine.calculateScoreFromEvidence(simulatedEvidenceList);

        const scoreBefore = snapshot.currentScore;
        const scoreAfter = newScoreResult.finalScore;
        const scoreDelta = Number((scoreAfter - scoreBefore).toFixed(2));

        // Update streaks and counts
        let newStreak = snapshot.successfulEventStreak;
        let newTotalVerified = snapshot.totalVerifiedEvents;
        let newTotalIncidents = snapshot.totalVerifiedIncidents;

        if (params.sourceAction === "event_completed") {
            newTotalVerified += 1;
            if (params.outcomeQuality >= 70) {
                newStreak += 1;
            }
        } else if (isNegativeOutcome) {
            newTotalIncidents += 1;
            newStreak = 0; // Streak broken on verified negative incident
        }

        // Update dimensional scores
        const dimScores = { ...snapshot.dimensionalScores };
        if (params.sourceAction === "event_completed") {
            dimScores.eventDelivery = Math.round(dimScores.eventDelivery * 0.7 + params.outcomeQuality * 0.3);
            dimScores.scheduleReliability = Math.min(100, dimScores.scheduleReliability + 2);
        } else if (params.sourceAction === "event_cancelled") {
            dimScores.cancellationReliability = Math.round(dimScores.cancellationReliability * 0.6 + params.outcomeQuality * 0.4);
        } else if (params.sourceAction === "certificate_issued") {
            dimScores.certificateIntegrity = Math.round(dimScores.certificateIntegrity * 0.8 + params.outcomeQuality * 0.2);
        }

        // Insert into ledger (append-only)
        const insertLedgerRes = await query(
            `INSERT INTO public.club_credibility_ledger (
                club_id, event_id, source_action, reason_code,
                outcome_quality, evidence_weight, score_before, score_after, score_delta,
                evidence_confidence, factor_breakdown, evidence_references,
                status, actor_id, actor_type, idempotency_key, scoring_version
            ) VALUES (
                $1, $2, $3, $4,
                $5, $6, $7, $8, $9,
                $10, $11, $12,
                'confirmed', $13, $14, $15, 'v1.0'
            )
            RETURNING
                id, club_id AS "clubId", event_id AS "eventId", source_action AS "sourceAction",
                reason_code AS "reasonCode", outcome_quality::float AS "outcomeQuality",
                evidence_weight::float AS "evidenceWeight", score_before::float AS "scoreBefore",
                score_after::float AS "scoreAfter", score_delta::float AS "scoreDelta",
                status, created_at AS "createdAt";`,
            [
                params.clubId,
                params.eventId || null,
                params.sourceAction,
                params.reasonCode,
                params.outcomeQuality,
                weightCalc.weight,
                scoreBefore,
                scoreAfter,
                scoreDelta,
                params.evidenceConfidence ?? 1.0,
                JSON.stringify({
                    ...params.factorBreakdown,
                    weightBreakdown: weightCalc.breakdown,
                }),
                JSON.stringify(params.evidenceReferences || {}),
                params.actorId || null,
                params.actorType || "club_admin",
                params.idempotencyKey || null,
            ]
        );

        // Update cached snapshot
        const updateSnapshotRes = await query(
            `UPDATE public.club_credibility_snapshots
             SET
                current_score = $1,
                lifetime_score = $2,
                recent_score = $3,
                score_level = $4,
                confidence_level = $5,
                is_provisional = $6,
                total_verified_events = $7,
                total_verified_incidents = $8,
                successful_event_streak = $9,
                total_evidence_weight = $10,
                dimensional_scores = $11,
                last_calculated_at = NOW(),
                updated_at = NOW()
             WHERE club_id = $12
             RETURNING
                club_id AS "clubId",
                current_score::float AS "currentScore",
                lifetime_score::float AS "lifetimeScore",
                recent_score::float AS "recentScore",
                score_level AS "scoreLevel",
                confidence_level AS "confidenceLevel",
                is_provisional AS "isProvisional",
                total_verified_events AS "totalVerifiedEvents",
                total_verified_incidents AS "totalVerifiedIncidents",
                successful_event_streak AS "successfulEventStreak",
                total_evidence_weight::float AS "totalEvidenceWeight",
                dimensional_scores AS "dimensionalScores",
                last_calculated_at AS "lastCalculatedAt";`,
            [
                newScoreResult.finalScore,
                newScoreResult.lifetimeScore,
                newScoreResult.recentScore,
                newScoreResult.scoreLevel,
                newScoreResult.confidenceLevel,
                newScoreResult.isProvisional,
                newTotalVerified,
                newTotalIncidents,
                newStreak,
                newScoreResult.totalEvidenceWeight,
                JSON.stringify(dimScores),
                params.clubId,
            ]
        );

        return {
            ledgerEntry: insertLedgerRes.rows[0],
            snapshot: updateSnapshotRes.rows[0],
            idempotentReplay: false,
        };
    }

    /**
     * Preview credibility impact without writing to the database
     * Used by CredibilityImpactModal
     */
    public static async previewImpact(
        clubId: string,
        eventId: string,
        proposedAction: "cancel" | "delete" | "draft" | "complete",
        extraInputs?: {
            reasonCategory?: string;
            communicatedToAll?: boolean;
            rescheduleOffered?: boolean;
            emergencyBypass?: boolean;
        }
    ): Promise<CredibilityImpactPreview> {
        const snapshot = await this.getSnapshot(clubId);

        // Fetch event metadata
        const eventRes = await query(
            `SELECT
                e.id, e.title, e.starts_at, e.status, e.scope, e.updated_at,
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations r WHERE r.event_id = e.id AND r.status IN ('registered', 'attended')), 0) AS "registrationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations r WHERE r.event_id = e.id AND r.status = 'attended'), 0) AS "attendeesCount"
             FROM public.club_events e
             WHERE e.id = $1 AND e.club_id = $2
             LIMIT 1;`,
            [eventId, clubId]
        );

        if (!eventRes.rows[0]) {
            throw new Error("Event not found or not owned by this club.");
        }

        const ev = eventRes.rows[0];
        const registrationsCount = ev.registrationsCount || 0;
        const attendeesCount = ev.attendeesCount || 0;
        const scope = (ev.scope || "CAMPUS") as "CAMPUS" | "PAN_INDIA";

        const startsAtMs = new Date(ev.starts_at).getTime();
        const nowMs = Date.now();
        const hoursNotice = Math.max(0, (startsAtMs - nowMs) / (1000 * 60 * 60));

        let qualityScore = 50;
        let isNegative = false;
        const factors: string[] = [];
        const alternatives: string[] = [];

        if (proposedAction === "cancel" || proposedAction === "delete" || proposedAction === "draft") {
            if (ev.status === "draft") {
                // Draft events have ZERO credibility impact!
                return {
                    action: proposedAction,
                    currentScore: snapshot.currentScore,
                    estimatedDelta: 0,
                    projectedScore: snapshot.currentScore,
                    estimatedRange: "0 pts",
                    affectedParticipants: 0,
                    qualityScore: 50,
                    evidenceWeight: 0,
                    factors: ["Draft event: offline actions on unpublished drafts have zero credibility impact."],
                    alternatives: ["You can safely edit or delete drafts without affecting club standing."],
                    eventVersionToken: new Date(ev.updated_at).toISOString(),
                };
            }

            // Cancellation / Unpublishing of live published event
            const reasonCat = (extraInputs?.reasonCategory || "operational_delay") as CancellationRubricInputs["reasonCategory"];
            const evalResult = engine.evaluateCancellationQuality({
                hoursNoticeBeforeEvent: hoursNotice,
                affectedRegistrationsCount: registrationsCount,
                reasonCategory: reasonCat,
                communicatedToAllParticipants: extraInputs?.communicatedToAll ?? true,
                rescheduleOrRemedyOffered: extraInputs?.rescheduleOffered ?? false,
            });

            qualityScore = evalResult.qualityScore;
            isNegative = qualityScore < 50;

            if (registrationsCount > 0) {
                factors.push(`${registrationsCount} registered student${registrationsCount === 1 ? "" : "s"} affected`);
            } else {
                factors.push("0 registered students affected (low blast radius)");
            }

            if (hoursNotice < 4) {
                factors.push(`Urgent last-minute cancellation (${Math.ceil(hoursNotice * 60)} minutes notice before start)`);
            } else if (hoursNotice < 24) {
                factors.push(`Short notice cancellation (${Math.round(hoursNotice)} hours before start)`);
            } else {
                factors.push(`${Math.round(hoursNotice / 24)} days advance notice provided`);
            }

            if (extraInputs?.rescheduleOffered) {
                factors.push("Reschedule option offered to participants (+10% remedy weight)");
            }

            if (scope === "PAN_INDIA") {
                factors.push("Pan-India event reach (1.2x scope evidence multiplier)");
            }

            alternatives.push("Postpone and reschedule to a future date instead of cancelling outright");
            alternatives.push("Notify registered students with a detailed explanation to preserve trust");
        } else if (proposedAction === "complete") {
            const compResult = engine.evaluateCompletedEventQuality({
                deliveryAgainstCommitments: 85,
                scheduleReliability: 90,
                participantCommunication: 85,
                verifiedExperience: attendeesCount > 0 ? 85 : 70,
                complaintResolution: 95,
                certificateAccuracy: 90,
            });
            qualityScore = compResult.qualityScore;
            isNegative = false;
            factors.push(`Event fulfilled with ${attendeesCount} verified attendees`);
            factors.push("Completion increases reliability streak and lifetime standing");
        }

        // Fetch past confirmed evidence
        const pastRes = await query(
            `SELECT outcome_quality::float AS "outcomeQuality", evidence_weight::float AS "evidenceWeight", created_at AS "createdAt"
             FROM public.club_credibility_ledger
             WHERE club_id = $1 AND status = 'confirmed'
             ORDER BY created_at ASC;`,
            [clubId]
        );

        const baseWeight =
            proposedAction === "delete"
                ? 2.0
                : proposedAction === "cancel"
                ? 1.5
                : proposedAction === "draft"
                ? 1.2
                : 1.0;

        const weightCalc = engine.calculateEvidenceWeight({
            baseWeight,
            scope,
            verifiedRegistrations: registrationsCount,
            verifiedAttendees: attendeesCount,
            successfulStreak: snapshot.successfulEventStreak,
            isNegativeOutcome: isNegative,
            noticeHours: hoursNotice,
        });

        const simulatedItem: CredibilityEvidenceItem = {
            outcomeQuality: qualityScore,
            evidenceWeight: weightCalc.weight,
            createdAt: new Date(),
        };

        const simulatedResult = engine.calculateScoreFromEvidence([...pastRes.rows, simulatedItem]);
        const delta = Math.round(simulatedResult.finalScore - snapshot.currentScore);

        const deltaMin = delta <= 0 ? delta - 2 : delta - 1;
        const deltaMax = delta <= 0 ? Math.min(0, delta + 2) : delta + 2;
        const estimatedRange = delta === 0 ? "0 pts" : `${deltaMin} to ${deltaMax} pts`;

        return {
            action: proposedAction,
            currentScore: snapshot.currentScore,
            estimatedDelta: delta,
            projectedScore: simulatedResult.finalScore,
            estimatedRange,
            affectedParticipants: registrationsCount,
            hoursNotice: Number(hoursNotice.toFixed(1)),
            qualityScore,
            evidenceWeight: weightCalc.weight,
            factors,
            alternatives,
            eventVersionToken: new Date(ev.updated_at).toISOString(),
        };
    }

    /**
     * Submit an appeal against a negative credibility entry
     */
    public static async submitAppeal(clubId: string, ledgerId: string, reason: string, attachments: any[] = []) {
        // Verify ledger entry belongs to this club
        const ledgerRes = await query(
            `SELECT id, score_delta::float AS "scoreDelta", source_action AS "sourceAction"
             FROM public.club_credibility_ledger
             WHERE id = $1 AND club_id = $2
             LIMIT 1;`,
            [ledgerId, clubId]
        );

        if (!ledgerRes.rows[0]) {
            throw new Error("Credibility record not found or does not belong to your club.");
        }

        const insertRes = await query(
            `INSERT INTO public.club_credibility_appeals (
                club_id, ledger_id, reason, evidence_attachments, appeal_status
            ) VALUES (
                $1, $2, $3, $4, 'pending'
            )
            RETURNING
                id, club_id AS "clubId", ledger_id AS "ledgerId", reason,
                evidence_attachments AS "evidenceAttachments",
                appeal_status AS "appealStatus", created_at AS "createdAt";`,
            [clubId, ledgerId, reason.trim(), JSON.stringify(attachments)]
        );

        return insertRes.rows[0];
    }

    /**
     * Platform Admin Review Appeal
     */
    public static async reviewAppeal(
        appealId: string,
        decision: "approved" | "rejected",
        reviewerId: string,
        reviewerReason: string
    ) {
        const appealRes = await query(
            `SELECT a.id, a.club_id AS "clubId", a.ledger_id AS "ledgerId", a.appeal_status AS "appealStatus",
                    l.outcome_quality::float AS "outcomeQuality", l.evidence_weight::float AS "evidenceWeight",
                    l.score_delta::float AS "scoreDelta", l.source_action AS "sourceAction"
             FROM public.club_credibility_appeals a
             JOIN public.club_credibility_ledger l ON l.id = a.ledger_id
             WHERE a.id = $1
             LIMIT 1;`,
            [appealId]
        );

        if (!appealRes.rows[0]) {
            throw new Error("Appeal record not found.");
        }

        const appeal = appealRes.rows[0];

        await query(
            `UPDATE public.club_credibility_appeals
             SET appeal_status = $1, reviewer_id = $2, review_decision = $1, reviewer_reason = $3, reviewed_at = NOW()
             WHERE id = $4;`,
            [decision, reviewerId, reviewerReason, appealId]
        );

        if (decision === "approved") {
            // Mark original ledger entry as reversed
            await query(
                `UPDATE public.club_credibility_ledger
                 SET status = 'reversed'
                 WHERE id = $1;`,
                [appeal.ledgerId]
            );

            // Recompute snapshot
            await this.recalculateSnapshot(appeal.clubId);
        }

        return { success: true, decision };
    }

    /**
     * Full recomputation of club snapshot from confirmed ledger records
     */
    public static async recalculateSnapshot(clubId: string): Promise<CredibilitySnapshot> {
        const recordsRes = await query(
            `SELECT
                outcome_quality::float AS "outcomeQuality",
                evidence_weight::float AS "evidenceWeight",
                source_action AS "sourceAction",
                created_at AS "createdAt"
             FROM public.club_credibility_ledger
             WHERE club_id = $1 AND status = 'confirmed'
             ORDER BY created_at ASC;`,
            [clubId]
        );

        const pastEvidence: CredibilityEvidenceItem[] = recordsRes.rows;
        const newScoreResult = engine.calculateScoreFromEvidence(pastEvidence);

        let streak = 0;
        let verifiedEvents = 0;
        let verifiedIncidents = 0;

        for (const r of recordsRes.rows) {
            if (r.sourceAction === "event_completed") {
                verifiedEvents++;
                if (r.outcomeQuality >= 70) streak++;
            } else if (r.outcomeQuality < 50) {
                verifiedIncidents++;
                streak = 0;
            }
        }

        const updateRes = await query(
            `UPDATE public.club_credibility_snapshots
             SET
                current_score = $1,
                lifetime_score = $2,
                recent_score = $3,
                score_level = $4,
                confidence_level = $5,
                is_provisional = $6,
                total_verified_events = $7,
                total_verified_incidents = $8,
                successful_event_streak = $9,
                total_evidence_weight = $10,
                last_calculated_at = NOW(),
                updated_at = NOW()
             WHERE club_id = $11
             RETURNING
                club_id AS "clubId",
                current_score::float AS "currentScore",
                lifetime_score::float AS "lifetimeScore",
                recent_score::float AS "recentScore",
                score_level AS "scoreLevel",
                confidence_level AS "confidenceLevel",
                is_provisional AS "isProvisional",
                total_verified_events AS "totalVerifiedEvents",
                total_verified_incidents AS "totalVerifiedIncidents",
                successful_event_streak AS "successfulEventStreak",
                total_evidence_weight::float AS "totalEvidenceWeight",
                dimensional_scores AS "dimensionalScores",
                last_calculated_at AS "lastCalculatedAt";`,
            [
                newScoreResult.finalScore,
                newScoreResult.lifetimeScore,
                newScoreResult.recentScore,
                newScoreResult.scoreLevel,
                newScoreResult.confidenceLevel,
                newScoreResult.isProvisional,
                verifiedEvents,
                verifiedIncidents,
                streak,
                newScoreResult.totalEvidenceWeight,
                clubId,
            ]
        );

        return updateRes.rows[0];
    }

    /**
     * Phase 4: Pre-issuance certificate integrity validation
     */
    public static async validateCertificateIssuanceIntegrity(
        clubId: string,
        eventId: string,
        recipientUserIds: string[]
    ) {
        if (!recipientUserIds || recipientUserIds.length === 0) {
            return {
                valid: false,
                message: "No recipients provided for certificate issuance.",
                eligibleCount: 0,
                ineligibleCount: 0,
                duplicateCount: 0,
                warnings: ["Recipient list is empty."],
            };
        }

        // Fetch verified registrations for this event
        const regRes = await query(
            `SELECT user_id, status FROM public.club_event_registrations
             WHERE event_id = $1 AND club_id = $2 AND user_id = ANY($3::uuid[]);`,
            [eventId, clubId, recipientUserIds]
        );

        const registeredUserSet = new Set(regRes.rows.map((r: any) => r.user_id));
        const attendedUserSet = new Set(regRes.rows.filter((r: any) => r.status === "attended").map((r: any) => r.user_id));

        // Fetch already issued certificates
        const existingCertsRes = await query(
            `SELECT user_id FROM public.club_certificates
             WHERE event_id = $1 AND club_id = $2 AND user_id = ANY($3::uuid[]);`,
            [eventId, clubId, recipientUserIds]
        );

        const alreadyIssuedSet = new Set(existingCertsRes.rows.map((c: any) => c.user_id));

        const warnings: string[] = [];
        let eligibleCount = 0;
        let ineligibleCount = 0;
        let duplicateCount = 0;
        let missingAttendanceCount = 0;

        for (const uid of recipientUserIds) {
            if (alreadyIssuedSet.has(uid)) {
                duplicateCount++;
            } else if (!registeredUserSet.has(uid)) {
                ineligibleCount++;
            } else {
                eligibleCount++;
                if (!attendedUserSet.has(uid)) {
                    missingAttendanceCount++;
                }
            }
        }

        if (duplicateCount > 0) {
            warnings.push(`${duplicateCount} recipient${duplicateCount === 1 ? "" : "s"} already received a certificate for this event.`);
        }
        if (ineligibleCount > 0) {
            warnings.push(`${ineligibleCount} recipient${ineligibleCount === 1 ? "" : "s"} have no verified RSVP registration record.`);
        }
        if (missingAttendanceCount > 0) {
            warnings.push(`${missingAttendanceCount} recipient${missingAttendanceCount === 1 ? "" : "s"} have not completed verified check-in attendance.`);
        }

        return {
            valid: ineligibleCount === 0 && duplicateCount === 0,
            eligibleCount,
            ineligibleCount,
            duplicateCount,
            missingAttendanceCount,
            warnings,
        };
    }

    /**
     * Cooldown constants & Score thresholds
     */
    public static readonly MIN_CAMPUS_SCORE = 20.0;
    public static readonly MIN_PAN_INDIA_SCORE = 50.0;
    public static readonly CAMPUS_COOLDOWN_MS = 12 * 60 * 60 * 1000; // 12 hours
    public static readonly PAN_INDIA_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (72 hours)

    /**
     * Check centralized event creation eligibility (Credibility score + scope cooldown)
     */
    public static async checkEventCreationEligibility(clubId: string): Promise<ClubEventCreationEligibility> {
        const snapshot = await this.getSnapshot(clubId);
        const currentScore = Number(snapshot.currentScore.toFixed(1));

        // Query the most recent creation timestamp for both scopes
        // Using GREATEST across club_events and immutable club_event_creation_history
        const campusLastRes = await query(
            `SELECT GREATEST(
                (SELECT MAX(created_at) FROM public.club_events WHERE club_id = $1 AND scope = 'CAMPUS'),
                (SELECT MAX(created_at) FROM public.club_event_creation_history WHERE club_id = $1 AND scope = 'CAMPUS')
            ) AS "lastCreatedAt";`,
            [clubId]
        ).catch(() => {
            return query(
                `SELECT MAX(created_at) AS "lastCreatedAt" FROM public.club_events WHERE club_id = $1 AND scope = 'CAMPUS';`,
                [clubId]
            );
        });

        const panIndiaLastRes = await query(
            `SELECT GREATEST(
                (SELECT MAX(created_at) FROM public.club_events WHERE club_id = $1 AND scope = 'PAN_INDIA'),
                (SELECT MAX(created_at) FROM public.club_event_creation_history WHERE club_id = $1 AND scope = 'PAN_INDIA')
            ) AS "lastCreatedAt";`,
            [clubId]
        ).catch(() => {
            return query(
                `SELECT MAX(created_at) AS "lastCreatedAt" FROM public.club_events WHERE club_id = $1 AND scope = 'PAN_INDIA';`,
                [clubId]
            );
        });

        const now = Date.now();

        // Calculate Campus status
        const campusLastCreatedAt = campusLastRes.rows[0]?.lastCreatedAt
            ? new Date(campusLastRes.rows[0].lastCreatedAt).toISOString()
            : null;
        let campusInCooldown = false;
        let campusRemainingMs = 0;
        let campusExpiresAt: string | null = null;

        if (campusLastCreatedAt) {
            const lastMs = new Date(campusLastCreatedAt).getTime();
            const expiresMs = lastMs + this.CAMPUS_COOLDOWN_MS;
            if (now < expiresMs) {
                campusInCooldown = true;
                campusRemainingMs = expiresMs - now;
                campusExpiresAt = new Date(expiresMs).toISOString();
            }
        }

        const campusScorePassed = currentScore >= this.MIN_CAMPUS_SCORE;
        const campusScoreDeficit = campusScorePassed ? 0 : Number((this.MIN_CAMPUS_SCORE - currentScore).toFixed(1));
        const campusEligible = campusScorePassed && !campusInCooldown;

        let campusReason = "Eligible to create Campus events.";
        if (!campusScorePassed && campusInCooldown) {
            campusReason = `Credibility score of ${currentScore} is below the required 20.0, and 12-hour creation cooldown is active (${this.formatDuration(campusRemainingMs)} remaining).`;
        } else if (!campusScorePassed) {
            campusReason = `Credibility score of ${currentScore} is below the minimum required 20.0. Club operations are restricted due to critical trust standing.`;
        } else if (campusInCooldown) {
            campusReason = `12-hour campus event creation cooldown is active. Next event can be created in ${this.formatDuration(campusRemainingMs)}.`;
        }

        // Calculate Pan India status
        const panIndiaLastCreatedAt = panIndiaLastRes.rows[0]?.lastCreatedAt
            ? new Date(panIndiaLastRes.rows[0].lastCreatedAt).toISOString()
            : null;
        let panIndiaInCooldown = false;
        let panIndiaRemainingMs = 0;
        let panIndiaExpiresAt: string | null = null;

        if (panIndiaLastCreatedAt) {
            const lastMs = new Date(panIndiaLastCreatedAt).getTime();
            const expiresMs = lastMs + this.PAN_INDIA_COOLDOWN_MS;
            if (now < expiresMs) {
                panIndiaInCooldown = true;
                panIndiaRemainingMs = expiresMs - now;
                panIndiaExpiresAt = new Date(expiresMs).toISOString();
            }
        }

        const panIndiaScorePassed = currentScore >= this.MIN_PAN_INDIA_SCORE;
        const panIndiaScoreDeficit = panIndiaScorePassed ? 0 : Number((this.MIN_PAN_INDIA_SCORE - currentScore).toFixed(1));
        const panIndiaEligible = panIndiaScorePassed && !panIndiaInCooldown;

        let panIndiaReason = "Eligible to create Pan-India events across colleges.";
        if (!panIndiaScorePassed && panIndiaInCooldown) {
            panIndiaReason = `Credibility score of ${currentScore} is below the required 50.0, and 3-day Pan-India creation cooldown is active (${this.formatDuration(panIndiaRemainingMs)} remaining).`;
        } else if (!panIndiaScorePassed) {
            panIndiaReason = `Credibility score of ${currentScore} is below the required 50.0 for Pan-India events. Deliver successful campus events to raise your score by +${panIndiaScoreDeficit} pts.`;
        } else if (panIndiaInCooldown) {
            panIndiaReason = `3-day Pan-India event creation cooldown is active. Next Pan-India event can be created in ${this.formatDuration(panIndiaRemainingMs)}.`;
        }

        return {
            clubId,
            currentScore,
            scoreLevel: snapshot.scoreLevel,
            confidenceLevel: snapshot.confidenceLevel,
            isProvisional: snapshot.isProvisional,
            campus: {
                eligible: campusEligible,
                minScore: this.MIN_CAMPUS_SCORE,
                currentScore,
                scorePassed: campusScorePassed,
                scoreDeficit: campusScoreDeficit,
                inCooldown: campusInCooldown,
                cooldownDurationHours: 12,
                cooldownRemainingMs: campusRemainingMs,
                cooldownExpiresAt: campusExpiresAt,
                lastEventCreatedAt: campusLastCreatedAt,
                reason: campusReason,
            },
            panIndia: {
                eligible: panIndiaEligible,
                minScore: this.MIN_PAN_INDIA_SCORE,
                currentScore,
                scorePassed: panIndiaScorePassed,
                scoreDeficit: panIndiaScoreDeficit,
                inCooldown: panIndiaInCooldown,
                cooldownDurationHours: 72,
                cooldownRemainingMs: panIndiaRemainingMs,
                cooldownExpiresAt: panIndiaExpiresAt,
                lastEventCreatedAt: panIndiaLastCreatedAt,
                reason: panIndiaReason,
            },
        };
    }

    /**
     * Record immutable event creation for cooldown enforcement
     */
    public static async recordEventCreation(clubId: string, eventId: string, scope: "CAMPUS" | "PAN_INDIA"): Promise<void> {
        try {
            await query(
                `INSERT INTO public.club_event_creation_history (club_id, event_id, scope, created_at)
                 VALUES ($1, $2, $3, NOW());`,
                [clubId, eventId, scope]
            );
        } catch (err) {
            console.error("[ClubCredibilityService] recordEventCreation error:", err);
        }
    }

    /**
     * Helper to format millisecond duration into human-readable string
     */
    public static formatDuration(ms: number): string {
        if (ms <= 0) return "0m";
        const totalSeconds = Math.floor(ms / 1000);
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        if (days > 0) {
            return `${days}d ${hours}h`;
        }
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${Math.max(1, minutes)}m`;
    }

    /**
     * Helper to render human-readable timeline descriptions
     */
    private static formatHumanExplanation(record: any): string {
        switch (record.sourceAction) {
            case "event_completed":
                return `Event "${record.eventTitle || "Session"}" completed successfully with verified attendance. Quality score: ${Math.round(record.outcomeQuality)}/100.`;
            case "event_cancelled":
                return `Event "${record.eventTitle || "Session"}" cancelled. ${record.scoreDelta < 0 ? `Credibility reduced by ${Math.abs(record.scoreDelta)} pts.` : "Neutral impact handled with responsible advance notice."}`;
            case "certificate_issued":
                return `Verified participation certificates issued for "${record.eventTitle || "Session"}".`;
            case "appeal_reversed":
                return `Platform appeal granted: reversed previous incident penalty. Credibility restored.`;
            case "incident_verified":
                return `Verified policy infraction or complaint confirmed. Quality evaluation: ${Math.round(record.outcomeQuality)}/100.`;
            default:
                return `Reputation update: ${record.reasonCode || record.sourceAction}.`;
        }
    }
}
