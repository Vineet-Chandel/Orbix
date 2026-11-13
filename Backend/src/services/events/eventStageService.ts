import { query } from "../../database/client.js";
import { EventNotificationService } from "./eventNotificationService.js";

export interface CreateStageInput {
    name: string;
    type?: string;
    description?: string;
    instructions?: string;
    stageOrder?: number;
    startsAt: string | Date;
    endsAt: string | Date;
    timezone?: string;
    eligibilityType?: string;
    eligibleTeamIds?: string[];
    eligibleUserIds?: string[];
    actionType?: string;
    requirements?: Record<string, any>;
    bannerUrl?: string;
}

export class EventStageService {
    /**
     * Get all stages for an event, automatically reconciling their schedule against the current time.
     */
    static async getEventStages(eventId: string): Promise<any[]> {
        // Automatically reconcile lifecycle transitions
        await this.reconcileEventStages(eventId);

        const res = await query(
            `SELECT 
                s.*,
                (SELECT count(*) FROM club_event_stage_submissions sub WHERE sub.stage_id = s.id)::int AS submissions_count,
                (SELECT count(*) FROM club_event_judges j WHERE j.stage_id = s.id)::int AS judges_count,
                (SELECT count(*) FROM club_event_judging_criteria c WHERE c.stage_id = s.id)::int AS criteria_count
             FROM club_event_stages s
             WHERE s.event_id = $1
             ORDER BY s.stage_order ASC, s.starts_at ASC;`,
            [eventId]
        );

        return res.rows;
    }

    /**
     * Create multiple stages for an event in batch (used by Wizard Step 2 & API)
     */
    static async createStagesBatch(eventId: string, clubId: string, stages: CreateStageInput[]): Promise<any[]> {
        const createdStages: any[] = [];

        let i = 0;
        for (const s of stages) {
            i++;
            const order = s.stageOrder ?? i;
            const res = await query(
                `INSERT INTO club_event_stages (
                    event_id, club_id, name, type, description, instructions, stage_order,
                    starts_at, ends_at, timezone, eligibility_type, eligible_team_ids, eligible_user_ids,
                    action_type, requirements, banner_url, status
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
                 RETURNING *;`,
                [
                    eventId,
                    clubId,
                    s.name.trim(),
                    s.type || "custom",
                    s.description || null,
                    s.instructions || null,
                    order,
                    new Date(s.startsAt),
                    new Date(s.endsAt),
                    s.timezone || "Asia/Kolkata",
                    s.eligibilityType || "all_registered",
                    JSON.stringify(s.eligibleTeamIds || []),
                    JSON.stringify(s.eligibleUserIds || []),
                    s.actionType || "none",
                    JSON.stringify(s.requirements || {
                        allowResubmission: true,
                        maxSubmissions: 1,
                        teamSubmissionOnly: false,
                        leaderOnlySubmit: true,
                        allMembersCanView: true,
                        lateSubmissionPolicy: "disallow",
                        requireApprovalToAdvance: false,
                    }),
                    s.bannerUrl || null,
                    new Date(s.startsAt) <= new Date() && new Date() < new Date(s.endsAt) ? "active" : "scheduled"
                ]
            );

            createdStages.push(res.rows[0]);
        }

        return createdStages;
    }

    /**
     * Syncs event stages safely (called on event creation & editing)
     */
    static async syncEventStages(eventId: string, clubId: string, stages: any[]): Promise<any[]> {
        if (!stages || !Array.isArray(stages) || stages.length === 0) return [];

        const subCheck = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_stage_submissions sess
             JOIN club_event_stages st ON st.id = sess.stage_id
             WHERE st.event_id = $1;`,
            [eventId]
        );
        const hasSubmissions = (subCheck.rows[0]?.count || 0) > 0;

        if (!hasSubmissions) {
            await query(`DELETE FROM club_event_stages WHERE event_id = $1;`, [eventId]);
        } else {
            return await this.getEventStages(eventId);
        }

        const inputList: CreateStageInput[] = stages.map((s, idx) => ({
            name: s.stageName || s.name || `Stage ${idx + 1}`,
            type: s.stageType || s.type || "custom",
            description: s.description || null,
            instructions: s.instructions || null,
            stageOrder: typeof s.orderIndex === "number" ? s.orderIndex : (typeof s.stageOrder === "number" ? s.stageOrder : idx),
            startsAt: s.startsAt,
            endsAt: s.endsAt,
            timezone: s.timezone || "Asia/Kolkata",
            eligibilityType: s.eligibilityType || "all_registered",
            actionType: s.participantActionType || s.actionType || (s.requiresSubmission ? "file_submission" : "none"),
            requirements: {
                ...(s.submissionRequirements || {}),
                isElimination: Boolean(s.isElimination),
                requiresSubmission: Boolean(s.requiresSubmission),
            },
            bannerUrl: s.bannerUrl || null,
        }));

        return await this.createStagesBatch(eventId, clubId, inputList);
    }

    /**
     * Update an individual stage
     */
    static async updateStage(stageId: string, eventId: string, actorId: string, updates: Partial<CreateStageInput>): Promise<any> {
        // Fetch current stage for audit log
        const currentRes = await query(`SELECT * FROM club_event_stages WHERE id = $1 AND event_id = $2;`, [stageId, eventId]);
        if (currentRes.rows.length === 0) {
            throw new Error("Stage not found");
        }
        const oldState = currentRes.rows[0];

        const setClauses: string[] = [];
        const params: any[] = [stageId, eventId];

        const allowedFields: Record<string, string> = {
            name: "name",
            type: "type",
            description: "description",
            instructions: "instructions",
            stageOrder: "stage_order",
            timezone: "timezone",
            eligibilityType: "eligibility_type",
            actionType: "action_type",
            bannerUrl: "banner_url",
        };

        for (const [key, col] of Object.entries(allowedFields)) {
            if ((updates as any)[key] !== undefined) {
                params.push((updates as any)[key]);
                setClauses.push(`${col} = $${params.length}`);
            }
        }

        if (updates.startsAt) {
            params.push(new Date(updates.startsAt));
            setClauses.push(`starts_at = $${params.length}`);
        }
        if (updates.endsAt) {
            params.push(new Date(updates.endsAt));
            setClauses.push(`ends_at = $${params.length}`);
        }
        if (updates.requirements) {
            params.push(JSON.stringify(updates.requirements));
            setClauses.push(`requirements = $${params.length}`);
        }
        if (updates.eligibleTeamIds) {
            params.push(JSON.stringify(updates.eligibleTeamIds));
            setClauses.push(`eligible_team_ids = $${params.length}`);
        }
        if (updates.eligibleUserIds) {
            params.push(JSON.stringify(updates.eligibleUserIds));
            setClauses.push(`eligible_user_ids = $${params.length}`);
        }

        setClauses.push(`updated_at = NOW()`);

        const updateSql = `UPDATE club_event_stages SET ${setClauses.join(", ")} WHERE id = $1 AND event_id = $2 RETURNING *;`;
        const updatedRes = await query(updateSql, params);
        const newState = updatedRes.rows[0];

        // Audit Log
        await query(
            `INSERT INTO club_event_audit_logs (event_id, stage_id, actor_id, action, entity_type, entity_id, old_state, new_state)
             VALUES ($1, $2, $3, 'STAGE_UPDATED', 'stage', $4, $5, $6);`,
            [eventId, stageId, actorId, stageId, JSON.stringify(oldState), JSON.stringify(newState)]
        );

        return newState;
    }

    /**
     * Delete a stage
     */
    static async deleteStage(stageId: string, eventId: string, actorId: string): Promise<boolean> {
        // Check if there are active submissions
        const subCount = await query(`SELECT count(*) FROM club_event_stage_submissions WHERE stage_id = $1;`, [stageId]);
        if (parseInt(subCount.rows[0].count, 10) > 0) {
            throw new Error("Cannot delete a stage with existing participant submissions. Pause or complete it instead.");
        }

        await query(`DELETE FROM club_event_stages WHERE id = $1 AND event_id = $2;`, [stageId, eventId]);

        await query(
            `INSERT INTO club_event_audit_logs (event_id, stage_id, actor_id, action, entity_type, entity_id)
             VALUES ($1, $2, $3, 'STAGE_DELETED', 'stage', $4);`,
            [eventId, stageId, actorId, stageId]
        );

        return true;
    }

    /**
     * Reorder stages
     */
    static async reorderStages(eventId: string, stageOrders: { id: string; stageOrder: number }[]): Promise<void> {
        for (const item of stageOrders) {
            await query(
                `UPDATE club_event_stages SET stage_order = $1, updated_at = NOW() WHERE id = $2 AND event_id = $3;`,
                [item.stageOrder, item.id, eventId]
            );
        }
    }

    /**
     * CORE EXECUTION ENGINE:
     * Idempotently reconcile stage lifecycle states against current server timestamp.
     * Activates stages, closes deadlines, sends notifications, and writes audit history.
     */
    static async reconcileEventStages(eventId: string): Promise<void> {
        const now = new Date();

        // 1. Scheduled stages that should become ACTIVE
        const toActivate = await query(
            `SELECT s.*, e.title AS event_title, c.name AS club_name 
             FROM club_event_stages s
             JOIN club_events e ON e.id = s.event_id
             JOIN verified_clubs c ON c.id = s.club_id
             WHERE s.event_id = $1 
               AND s.status = 'scheduled'
               AND s.starts_at <= $2
               AND s.ends_at > $2;`,
            [eventId, now]
        );

        for (const stage of toActivate.rows) {
            await query(`UPDATE club_event_stages SET status = 'active', updated_at = NOW() WHERE id = $1;`, [stage.id]);

            // Audit log
            await query(
                `INSERT INTO club_event_audit_logs (event_id, stage_id, actor_id, action, entity_type, entity_id, new_state)
                 VALUES ($1, $2, (SELECT auth_user_id FROM verified_clubs WHERE id = $3), 'AUTO_STAGE_ACTIVATED', 'stage', $4, $5);`,
                [eventId, stage.id, stage.club_id, stage.id, JSON.stringify({ status: "active", activatedAt: now })]
            );

            // Broadcast Stage Opening Email to Eligible Participants
            if (stage.action_type !== "none" && stage.action_type !== "internal_review") {
                this.notifyStageParticipants(stage, "stage_opened").catch(console.error);
            }
        }

        // 2. Active stages that should become COMPLETED or EVALUATING
        const toComplete = await query(
            `SELECT s.* 
             FROM club_event_stages s
             WHERE s.event_id = $1 
               AND s.status = 'active'
               AND s.ends_at <= $2;`,
            [eventId, now]
        );

        for (const stage of toComplete.rows) {
            const nextStatus = stage.type === "evaluation" || stage.type === "screening" ? "evaluating" : "completed";
            await query(`UPDATE club_event_stages SET status = $1, updated_at = NOW() WHERE id = $2;`, [nextStatus, stage.id]);

            await query(
                `INSERT INTO club_event_audit_logs (event_id, stage_id, actor_id, action, entity_type, entity_id, new_state)
                 VALUES ($1, $2, (SELECT auth_user_id FROM verified_clubs WHERE id = $3), 'AUTO_STAGE_CLOSED', 'stage', $4, $5);`,
                [eventId, stage.id, stage.club_id, stage.id, JSON.stringify({ status: nextStatus, closedAt: now })]
            );
        }
    }

    /**
     * Broadcast stage lifecycle emails to eligible participants
     */
    private static async notifyStageParticipants(stage: any, triggerType: string): Promise<void> {
        let participantsQuery = `
            SELECT r.id AS reg_id, r.applicant_name, r.applicant_email, r.user_id, u.name AS user_name, u.email AS user_email
            FROM club_event_registrations r
            LEFT JOIN users u ON u.id = r.user_id
            WHERE r.event_id = $1 AND r.status IN ('registered', 'attended')
        `;

        // If stage is restricted to shortlisted only
        if (stage.eligibility_type === "shortlisted_only") {
            participantsQuery += ` AND r.id IN (
                SELECT registration_id FROM club_event_stage_advancements WHERE to_stage_id = '${stage.id}' AND status IN ('shortlisted', 'advanced')
            )`;
        }

        const participants = await query(participantsQuery, [stage.event_id]);

        const deadlineStr = new Date(stage.ends_at).toLocaleString("en-IN", {
            timeZone: stage.timezone || "Asia/Kolkata",
            dateStyle: "medium",
            timeStyle: "short",
        });

        for (const p of participants.rows) {
            const email = p.applicant_email || p.user_email;
            if (!email) continue;
            const name = p.applicant_name || p.user_name || "Participant";

            await EventNotificationService.dispatchEventEmail({
                eventId: stage.event_id,
                stageId: stage.id,
                triggerType,
                recipientEmail: email,
                recipientUserId: p.user_id,
                participantName: name,
                eventTitle: stage.event_title || "Campus Event",
                clubName: stage.club_name || "Organizing Club",
                stageName: stage.name,
                headline: `Round Opened: ${stage.name}`,
                message: stage.instructions || `The ${stage.name} round is now active! Please review guidelines and submit your required materials before the deadline.`,
                deadline: deadlineStr,
                badgeText: "Stage Live",
                actionLabel: "Submit Round Materials",
            });
        }
    }

    /**
     * Manual Organizer Overrides
     */
    static async manualOverride(
        stageId: string,
        eventId: string,
        actorId: string,
        action: "pause" | "resume" | "extend" | "close" | "reopen",
        payload?: { newEndsAt?: string; note?: string }
    ): Promise<any> {
        const cur = await query(`SELECT * FROM club_event_stages WHERE id = $1 AND event_id = $2;`, [stageId, eventId]);
        if (cur.rows.length === 0) throw new Error("Stage not found");
        const stage = cur.rows[0];

        let newStatus = stage.status;
        let setClause = "";
        const params: any[] = [stageId, eventId];

        switch (action) {
            case "pause":
                newStatus = "paused";
                setClause = "status = 'paused', updated_at = NOW()";
                break;
            case "resume":
                newStatus = "active";
                setClause = "status = 'active', updated_at = NOW()";
                break;
            case "close":
                newStatus = "completed";
                setClause = "status = 'completed', ends_at = NOW(), updated_at = NOW()";
                break;
            case "reopen":
                newStatus = "active";
                if (payload?.newEndsAt) {
                    params.push(new Date(payload.newEndsAt));
                    setClause = `status = 'active', ends_at = $${params.length}, updated_at = NOW()`;
                } else {
                    setClause = "status = 'active', updated_at = NOW()";
                }
                break;
            case "extend":
                if (!payload?.newEndsAt) throw new Error("newEndsAt is required for deadline extension");
                params.push(new Date(payload.newEndsAt));
                setClause = `ends_at = $${params.length}, updated_at = NOW()`;
                break;
        }

        const updateSql = `UPDATE club_event_stages SET ${setClause} WHERE id = $1 AND event_id = $2 RETURNING *;`;
        const updatedRes = await query(updateSql, params);

        await query(
            `INSERT INTO club_event_audit_logs (event_id, stage_id, actor_id, action, entity_type, entity_id, old_state, new_state)
             VALUES ($1, $2, $3, $4, 'stage', $5, $6, $7);`,
            [
                eventId,
                stageId,
                actorId,
                `STAGE_OVERRIDE_${action.toUpperCase()}`,
                stageId,
                JSON.stringify({ status: stage.status, endsAt: stage.ends_at }),
                JSON.stringify({ status: newStatus, endsAt: updatedRes.rows[0]?.ends_at, note: payload?.note }),
            ]
        );

        return updatedRes.rows[0];
    }
}
