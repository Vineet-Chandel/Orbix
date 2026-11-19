// Backend/src/services/workspace/workspaceRecognitionReconciliationService.ts
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import {
    WorkspaceRecognitionRedisService,
    type RecognitionBoardType,
} from "../../redis/workspaceRecognitionRedis.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { workspaceEventBus } from "./workspaceChannelService.js";
import { enqueueWorkspaceJob, QUEUE_NAMES } from "../../queues/workspaceQueues.js";
import type { LeaderboardPeriod } from "../../types/workspaceTypes.js";

export class WorkspaceRecognitionReconciliationService {
    private static inFlight = new Map<string, Promise<void>>();

    /**
     * Authoritatively recalculates a member's net Orbits directly from the immutable PostgreSQL ledger
     */
    static async getAuthoritativeMemberTotals(
        workspaceId: string,
        userId: string
    ): Promise<{ allTime: number; monthly: number; weekly: number }> {
        const res = await query(
            `SELECT
                COALESCE(SUM(points_delta), 0)::integer AS "allTime",
                COALESCE(SUM(CASE WHEN created_at >= date_trunc('month', NOW()) THEN points_delta ELSE 0 END), 0)::integer AS "monthly",
                COALESCE(SUM(CASE WHEN created_at >= date_trunc('week', NOW()) THEN points_delta ELSE 0 END), 0)::integer AS "weekly"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 
               AND recipient_id = $2 
               AND status = 'completed' 
               AND transaction_type = 'award'
               AND is_reversed = false;`,
            [workspaceId, userId]
        );

        const row = res.rows[0] || { allTime: 0, monthly: 0, weekly: 0 };
        return {
            allTime: Math.max(0, parseInt(row.allTime, 10) || 0),
            monthly: Math.max(0, parseInt(row.monthly, 10) || 0),
            weekly: Math.max(0, parseInt(row.weekly, 10) || 0),
        };
    }

    /**
     * Idempotently processes an outbox event to update Redis leaderboard sorted sets
     * and broadcasts a sanitized real-time update.
     */
    static async processOutboxEvent(event: {
        workspaceId: string;
        eventType: string;
        payload: any;
    }): Promise<void> {
        const { workspaceId, eventType, payload } = event;
        if (!workspaceId) return;

        const recipientId = payload.recipientId || payload.recipientUserId;
        if (!recipientId) return;

        const lockKey = `${workspaceId}:${recipientId}`;
        const previous = this.inFlight.get(lockKey) || Promise.resolve();

        const execute = async () => {
            // 1. Fetch authoritative PostgreSQL balances
            const totals = await this.getAuthoritativeMemberTotals(workspaceId, recipientId);

            // 2. Fetch member department membership
            const deptRes = await query(
                `SELECT department_id FROM public.workspace_department_members 
                 WHERE workspace_id = $1 AND user_id = $2 LIMIT 1;`,
                [workspaceId, recipientId]
            );
            const departmentId = deptRes.rows[0]?.department_id || undefined;

            // 3. Absolute ZADD updates to Redis sorted sets (Idempotent across retries)
            const periods: Array<{ period: LeaderboardPeriod; score: number }> = [
                { period: "all_time", score: totals.allTime },
                { period: "this_month", score: totals.monthly },
                { period: "this_week", score: totals.weekly },
            ];

            for (const p of periods) {
                // Workspace-wide contributor leaderboard
                await WorkspaceRecognitionRedisService.updateScore(
                    workspaceId,
                    "contributors",
                    p.period,
                    recipientId,
                    p.score
                );

                // Department-filtered contributor leaderboard
                if (departmentId) {
                    await WorkspaceRecognitionRedisService.updateScore(
                        workspaceId,
                        "contributors",
                        p.period,
                        recipientId,
                        p.score,
                        departmentId
                    );
                }
            }

            // 4. Invalidate higher-level cache aggregations
            await WorkspaceRedisService.invalidateLeaderboards(workspaceId);
            await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);

            // 5. Query updated rank in this_month sorted set
            const { rank, score } = await WorkspaceRecognitionRedisService.getEntityRank(
                workspaceId,
                "contributors",
                "this_month",
                recipientId
            );

            // 6. Broadcast sanitized real-time update (Never leaking private notes or internal budgets)
            const sanitizedEventPayload = {
                workspaceId,
                boardType: "contributors",
                period: "this_month",
                affectedUserId: recipientId,
                updatedRank: rank,
                updatedScore: score !== null ? score : totals.monthly,
                eventType,
                timestamp: new Date().toISOString(),
            };

            workspaceEventBus.emit(`workspace:${workspaceId}`, {
                event: "recognition:leaderboard_updated",
                payload: sanitizedEventPayload,
                timestamp: new Date().toISOString(),
            });

            // 7. Multi-node Redis Pub/Sub broadcast
            try {
                if (redis && redis.status === "ready") {
                    await redis.publish(
                        `orbix:pubsub:workspace:${workspaceId}`,
                        JSON.stringify({
                            event: "recognition:leaderboard_updated",
                            payload: sanitizedEventPayload,
                        })
                    );
                }
            } catch {
                // Non-blocking pub/sub failure
            }
        };

        const current = previous
            .catch(() => {})
            .then(execute)
            .finally(() => {
                if (this.inFlight.get(lockKey) === current) {
                    this.inFlight.delete(lockKey);
                }
            });

        this.inFlight.set(lockKey, current);
        return current;
    }

    /**
     * Authoritatively rebuilds all Redis sorted set leaderboards for a workspace from PostgreSQL.
     * Restores complete ranking state in case of Redis restart, eviction, or cold start.
     */
    static async rebuildWorkspaceLeaderboards(
        workspaceId: string,
        period: LeaderboardPeriod = "this_month"
    ): Promise<{
        contributorsCount: number;
        leadersCount: number;
        departmentsCount: number;
    }> {
        // Fetch authoritative computed rankings directly from PostgreSQL
        const leaderboards = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period,
        });

        // 1. Populate Contributors ZSET
        const contributorEntries = leaderboards.contributors.map((c: any) => ({
            entityId: c.userId,
            score: Number(c.orbitsEarned ?? c.totalOrbits ?? 0),
        }));
        await WorkspaceRecognitionRedisService.batchUpdateScores(
            workspaceId,
            "contributors",
            period,
            contributorEntries
        );

        // Populate department-scoped contributor ZSETs
        const deptGrouped = new Map<string, Array<{ entityId: string; score: number }>>();
        for (const c of leaderboards.contributors as any[]) {
            if (c.departmentId) {
                if (!deptGrouped.has(c.departmentId)) deptGrouped.set(c.departmentId, []);
                deptGrouped.get(c.departmentId)!.push({
                    entityId: c.userId,
                    score: Number(c.orbitsEarned ?? c.totalOrbits ?? 0),
                });
            }
        }
        for (const [deptId, entries] of deptGrouped.entries()) {
            await WorkspaceRecognitionRedisService.batchUpdateScores(
                workspaceId,
                "contributors",
                period,
                entries,
                deptId
            );
        }

        // 2. Populate Leaders ZSET (Score is departmentPerformanceIndex)
        const leaderEntries = leaderboards.leads.map((l: any) => ({
            entityId: l.userId,
            score: Number(l.departmentPerformanceIndex ?? 0),
        }));
        await WorkspaceRecognitionRedisService.batchUpdateScores(
            workspaceId,
            "leaders",
            period,
            leaderEntries
        );

        // 3. Populate Departments ZSET (Score is departmentPerformanceIndex)
        const departmentEntries = leaderboards.departments.map((d: any) => ({
            entityId: d.departmentId,
            score: Number(d.departmentPerformanceIndex ?? 0),
        }));
        await WorkspaceRecognitionRedisService.batchUpdateScores(
            workspaceId,
            "departments",
            period,
            departmentEntries
        );

        return {
            contributorsCount: contributorEntries.length,
            leadersCount: leaderEntries.length,
            departmentsCount: departmentEntries.length,
        };
    }

    /**
     * Periodic reconciliation between Redis sorted sets and PostgreSQL source of truth.
     * Identifies any score drift or missing entities and reconciles Redis to match PostgreSQL.
     */
    static async reconcileLeaderboards(
        workspaceId: string,
        period: LeaderboardPeriod = "this_month"
    ): Promise<{
        matched: boolean;
        discrepanciesFound: number;
        correctedCount: number;
    }> {
        // Authoritative data from PostgreSQL
        const dbLeaderboards = await WorkspaceRepository.getThreeLeaderboards(workspaceId, {
            period,
        });

        let discrepanciesFound = 0;
        let correctedCount = 0;

        // Check contributors
        for (const c of dbLeaderboards.contributors as any[]) {
            const redisState = await WorkspaceRecognitionRedisService.getEntityRank(
                workspaceId,
                "contributors",
                period,
                c.userId
            );

            const expectedContribScore = Number(c.orbitsEarned ?? c.totalOrbits ?? 0);
            if (redisState.score === null || Math.round(redisState.score) !== expectedContribScore) {
                discrepanciesFound++;
                const ok = await WorkspaceRecognitionRedisService.updateScore(
                    workspaceId,
                    "contributors",
                    period,
                    c.userId,
                    expectedContribScore
                );
                if (ok) correctedCount++;
            }
        }

        // Check departments
        for (const d of dbLeaderboards.departments as any[]) {
            const redisState = await WorkspaceRecognitionRedisService.getEntityRank(
                workspaceId,
                "departments",
                period,
                d.departmentId
            );

            const expectedScore = Number(d.departmentPerformanceIndex ?? 0);
            if (redisState.score === null || Math.abs((redisState.score || 0) - expectedScore) > 0.05) {
                discrepanciesFound++;
                const ok = await WorkspaceRecognitionRedisService.updateScore(
                    workspaceId,
                    "departments",
                    period,
                    d.departmentId,
                    expectedScore
                );
                if (ok) correctedCount++;
            }
        }

        return {
            matched: discrepanciesFound === 0,
            discrepanciesFound,
            correctedCount,
        };
    }

    /**
     * Dispatches pending outbox events for recognition awards and reversals.
     * Enqueues via BullMQ if online, or processes synchronously as resilient fallback.
     */
    static async dispatchRecognitionOutboxBatch(batchSize = 25): Promise<number> {
        const events = await WorkspaceRepository.getPendingOutboxEvents(batchSize);
        const recognitionEvents = events.filter(
            (e) => e.eventType === "recognition:awarded" || e.eventType === "recognition:reversed"
        );

        let processed = 0;
        for (const ev of recognitionEvents) {
            try {
                await WorkspaceRepository.markOutboxEventStatus(ev.id, "processing");

                const enqueued = await enqueueWorkspaceJob(
                    QUEUE_NAMES.RECOGNITION,
                    "process_outbox_event",
                    {
                        outboxEventId: ev.id,
                        workspaceId: ev.workspaceId,
                        eventType: ev.eventType,
                        payload: ev.payload,
                    },
                    { jobId: `rec-outbox-${ev.id}` }
                );

                if (enqueued.enqueued) {
                    await WorkspaceRepository.markOutboxEventStatus(ev.id, "published");
                    processed++;
                } else {
                    // Fallback to synchronous execution
                    await this.processOutboxEvent({
                        workspaceId: ev.workspaceId,
                        eventType: ev.eventType,
                        payload: ev.payload,
                    });
                    await WorkspaceRepository.markOutboxEventStatus(ev.id, "published");
                    processed++;
                }
            } catch (err: any) {
                await WorkspaceRepository.markOutboxEventStatus(ev.id, "failed", err.message);
            }
        }

        return processed;
    }
}
