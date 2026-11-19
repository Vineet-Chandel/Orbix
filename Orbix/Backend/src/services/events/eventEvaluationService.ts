import { query } from "../../database/client.js";
import { EventNotificationService } from "./eventNotificationService.js";

export class EventEvaluationService {
    /**
     * Get judging criteria for a stage
     */
    static async getJudgingCriteria(stageId: string): Promise<any[]> {
        const res = await query(
            `SELECT * FROM club_event_judging_criteria WHERE stage_id = $1 ORDER BY sort_order ASC;`,
            [stageId]
        );
        return res.rows;
    }

    /**
     * Save judging criteria (rubric) for a stage
     */
    static async saveJudgingCriteria(
        stageId: string,
        eventId: string,
        criteriaList: Array<{
            id?: string;
            title: string;
            description?: string;
            maxScore: number;
            weightPercent: number;
            sortOrder?: number;
        }>
    ): Promise<any[]> {
        // Delete existing and reinsert cleanly
        await query(`DELETE FROM club_event_judging_criteria WHERE stage_id = $1;`, [stageId]);

        const saved: any[] = [];
        let i = 0;
        for (const c of criteriaList) {
            i++;
            const res = await query(
                `INSERT INTO club_event_judging_criteria (
                    stage_id, event_id, title, description, max_score, weight_percent, sort_order
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                 RETURNING *;`,
                [
                    stageId,
                    eventId,
                    c.title.trim(),
                    c.description || null,
                    c.maxScore || 10,
                    c.weightPercent || (100 / (criteriaList.length || 1)),
                    c.sortOrder ?? i,
                ]
            );
            saved.push(res.rows[0]);
        }

        return saved;
    }

    /**
     * Assign judges to an event stage
     */
    static async assignJudges(
        stageId: string,
        eventId: string,
        judges: Array<{ userId: string; name?: string; email?: string; role?: string }>
    ): Promise<any[]> {
        const results: any[] = [];
        for (const j of judges) {
            const res = await query(
                `INSERT INTO club_event_judges (event_id, stage_id, user_id, name, email, role)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 ON CONFLICT (stage_id, user_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    email = EXCLUDED.email,
                    role = EXCLUDED.role
                 RETURNING *;`,
                [eventId, stageId, j.userId, j.name || null, j.email || null, j.role || "judge"]
            );
            results.push(res.rows[0]);
        }
        return results;
    }

    /**
     * Get assigned judges for a stage
     */
    static async getAssignedJudges(stageId: string): Promise<any[]> {
        const res = await query(
            `SELECT j.*, u.username, u.name AS user_name, u.email AS user_email
             FROM club_event_judges j
             JOIN users u ON u.id = j.user_id
             WHERE j.stage_id = $1
             ORDER BY j.created_at ASC;`,
            [stageId]
        );
        return res.rows;
    }

    /**
     * Submit an evaluation score and feedback for a submission
     */
    static async submitEvaluation(
        submissionId: string,
        stageId: string,
        judgeId: string,
        scores: Record<string, number>,
        feedback?: string,
        privateNotes?: string
    ): Promise<any> {
        // Fetch criteria to compute weighted score
        const criteria = await this.getJudgingCriteria(stageId);
        let totalScore = 0;
        let weightedScore = 0;

        for (const c of criteria) {
            const score = Number(scores[c.id] || 0);
            totalScore += score;
            const weight = Number(c.weight_percent || 0) / 100;
            const max = Number(c.max_score || 10);
            weightedScore += (score / max) * weight * 100;
        }

        const res = await query(
            `INSERT INTO club_event_evaluations (
                stage_id, submission_id, judge_id, scores, total_score, weighted_score,
                feedback, private_notes, status, evaluated_at, updated_at
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'submitted', NOW(), NOW())
             ON CONFLICT (submission_id, judge_id) DO UPDATE SET
                scores = EXCLUDED.scores,
                total_score = EXCLUDED.total_score,
                weighted_score = EXCLUDED.weighted_score,
                feedback = EXCLUDED.feedback,
                private_notes = EXCLUDED.private_notes,
                status = 'submitted',
                updated_at = NOW()
             RETURNING *;`,
            [
                stageId,
                submissionId,
                judgeId,
                JSON.stringify(scores),
                totalScore,
                weightedScore,
                feedback || null,
                privateNotes || null,
            ]
        );

        // Update submission status to evaluated
        await query(
            `UPDATE club_event_stage_submissions SET status = 'evaluated', updated_at = NOW() WHERE id = $1;`,
            [submissionId]
        );

        return res.rows[0];
    }

    /**
     * Shortlist participants / teams and advance them to the next stage
     */
    static async shortlistAndAdvance(
        eventId: string,
        fromStageId: string,
        toStageId: string,
        advancements: Array<{
            registrationId: string;
            teamId?: string | null;
            rank?: number;
            awardTitle?: string;
            notes?: string;
        }>
    ): Promise<any[]> {
        // Verify fromStage and toStage belong to this event
        const stagesCheck = await query(
            `SELECT id, name FROM club_event_stages WHERE event_id = $1 AND id IN ($2, $3);`,
            [eventId, fromStageId, toStageId]
        );
        if (stagesCheck.rows.length < 2) throw new Error("Invalid stage progression configuration");

        const toStage = stagesCheck.rows.find((s: any) => s.id === toStageId);
        const eventRes = await query(`SELECT title, club_id FROM club_events WHERE id = $1;`, [eventId]);
        const clubRes = await query(`SELECT name FROM verified_clubs WHERE id = $1;`, [eventRes.rows[0]?.club_id]);
        const eventTitle = eventRes.rows[0]?.title || "Campus Event";
        const clubName = clubRes.rows[0]?.name || "Club";

        const savedAdvancements: any[] = [];

        for (const item of advancements) {
            const res = await query(
                `INSERT INTO club_event_stage_advancements (
                    event_id, from_stage_id, to_stage_id, registration_id, team_id,
                    status, rank, award_title, notes
                 ) VALUES ($1, $2, $3, $4, $5, 'shortlisted', $6, $7, $8)
                 ON CONFLICT (from_stage_id, to_stage_id, registration_id) DO UPDATE SET
                    status = 'shortlisted',
                    rank = EXCLUDED.rank,
                    award_title = EXCLUDED.award_title,
                    notes = EXCLUDED.notes
                 RETURNING *;`,
                [
                    eventId,
                    fromStageId,
                    toStageId,
                    item.registrationId,
                    item.teamId || null,
                    item.rank || null,
                    item.awardTitle || null,
                    item.notes || null,
                ]
            );

            savedAdvancements.push(res.rows[0]);

            // Dispatch shortlisting email to participant
            const regRes = await query(
                `SELECT applicant_name, applicant_email, user_id FROM club_event_registrations WHERE id = $1;`,
                [item.registrationId]
            );
            const firstRow = regRes.rows[0];
            if (firstRow && firstRow.applicant_email) {
                const stageName = toStage?.name || "Next Round";
                EventNotificationService.dispatchEventEmail({
                    eventId,
                    stageId: toStageId,
                    triggerType: "shortlisted",
                    recipientEmail: firstRow.applicant_email,
                    recipientUserId: firstRow.user_id,
                    participantName: firstRow.applicant_name || "Participant",
                    eventTitle,
                    clubName,
                    stageName,
                    headline: `Congratulations! You Qualified for ${stageName}`,
                    message: `You have been selected and advanced to the next round of ${eventTitle}: ${stageName}. Check your portal for updated timeline and round details.`,
                    badgeText: "Qualified",
                    actionLabel: "View Next Round",
                }).catch(console.error);
            }
        }

        return savedAdvancements;
    }

    /**
     * Get advancements for an event stage
     */
    static async getStageAdvancements(stageId: string): Promise<any[]> {
        const res = await query(
            `SELECT a.*, r.applicant_name, r.applicant_email, r.institution_name, t.name AS team_name
             FROM club_event_stage_advancements a
             JOIN club_event_registrations r ON r.id = a.registration_id
             LEFT JOIN club_event_teams t ON t.id = a.team_id
             WHERE a.to_stage_id = $1 OR a.from_stage_id = $1
             ORDER BY a.rank ASC NULLS LAST;`,
            [stageId]
        );
        return res.rows;
    }
}
