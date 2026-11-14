/**
 * Email Outbox Dispatcher & Recovery Poller
 * Continuously polls PostgreSQL for:
 * 1. Pending outbox campaigns needing fan-out.
 * 2. Pending or RETRY_WAIT jobs ready for delivery (provides direct-DB delivery if Redis is offline).
 * 3. Stale processing jobs abandoned by crashed workers (self-healing recovery).
 */
import { query } from "../database/client.js";
import { EmailQueueService } from "../services/email/emailQueueService.js";
import { processCampaignFanout } from "./emailCampaignFanoutWorker.js";
import { processEmailDeliveryJob } from "./emailWorker.js";

const POLL_INTERVAL_MS = Math.max(5000, parseInt(process.env.EMAIL_OUTBOX_POLL_INTERVAL_MS || "15000", 10));

let dispatcherTimer: NodeJS.Timeout | null = null;
let isDispatching = false;

export async function runOutboxDispatcherCycle(): Promise<{
    campaignsProcessed: number;
    jobsDispatched: number;
    staleRecovered: number;
}> {
    if (isDispatching) return { campaignsProcessed: 0, jobsDispatched: 0, staleRecovered: 0 };
    isDispatching = true;

    let campaignsProcessed = 0;
    let jobsDispatched = 0;
    let staleRecovered = 0;

    try {
        // 1. Process Pending Campaigns
        const pendingCampaigns = await query(
            `SELECT id FROM public.email_outbox_campaigns
             WHERE status = 'PENDING'
             ORDER BY created_at ASC
             LIMIT 5;`
        );

        for (const camp of pendingCampaigns.rows || []) {
            try {
                const enqueued = await EmailQueueService.enqueueCampaignFanout({
                    campaignId: camp.id,
                    campaignType: "outbox_fanout",
                });
                if (!enqueued) {
                    // Redis offline: execute fanout inline
                    await processCampaignFanout(camp.id);
                }
                campaignsProcessed++;
            } catch (campErr: any) {
                console.error(`[OutboxDispatcher] Error processing campaign ${camp.id}:`, campErr.message);
            }
        }

        // 2. Self-Healing: Reclaim Stale Abandoned Jobs (processing > 10 minutes)
        const reclaimRes = await query(
            `UPDATE public.email_delivery_jobs
             SET status = 'RETRY_WAIT',
                 next_attempt_at = now(),
                 locked_by = NULL,
                 locked_at = NULL,
                 last_error = 'Reclaimed after abandoned worker lock timeout',
                 updated_at = now()
             WHERE status = 'PROCESSING'
               AND locked_at < now() - INTERVAL '10 minutes'
             RETURNING id;`
        );
        staleRecovered = reclaimRes.rowCount ?? 0;
        if (staleRecovered > 0) {
            console.log(`[OutboxDispatcher] Reclaimed ${staleRecovered} stale abandoned processing email jobs.`);
        }

        // 3. Dispatch Ready Delivery Jobs (PENDING or RETRY_WAIT with next_attempt_at <= now)
        const readyJobsRes = await query(
            `SELECT id, priority, email_type, recipient_email
             FROM public.email_delivery_jobs
             WHERE status IN ('PENDING', 'RETRY_WAIT')
               AND next_attempt_at <= now()
             ORDER BY next_attempt_at ASC
             LIMIT 50;`
        );

        const readyJobs = readyJobsRes.rows || [];
        for (const job of readyJobs) {
            try {
                const enqueued = await EmailQueueService.enqueueEmailJob({
                    jobId: job.id,
                    priority: job.priority || "NORMAL",
                    emailType: job.email_type,
                    recipientEmail: job.recipient_email,
                });

                if (!enqueued) {
                    // Redis is offline/unavailable: process directly via Node worker
                    await processEmailDeliveryJob(job.id, "outbox-db-fallback");
                }
                jobsDispatched++;
            } catch (jobErr: any) {
                console.error(`[OutboxDispatcher] Error dispatching job ${job.id}:`, jobErr.message);
            }
        }

        // 4. Mark completed campaigns
        await query(
            `UPDATE public.email_outbox_campaigns
             SET status = 'COMPLETED', updated_at = now()
             WHERE status = 'PROCESSING'
               AND total_recipients > 0
               AND processed_recipients >= total_recipients;`
        );
    } catch (err: any) {
        console.error("[OutboxDispatcher] Polling cycle error:", err.message);
    } finally {
        isDispatching = false;
    }

    return { campaignsProcessed, jobsDispatched, staleRecovered };
}

export function startEmailOutboxDispatcher(): void {
    if (dispatcherTimer) return;

    // Run first cycle immediately
    setTimeout(() => {
        runOutboxDispatcherCycle().catch((err) => console.error("[OutboxDispatcher] Initial cycle error:", err));
    }, 2000);

    dispatcherTimer = setInterval(() => {
        runOutboxDispatcherCycle().catch((err) => console.error("[OutboxDispatcher] Cycle error:", err));
    }, POLL_INTERVAL_MS);

    console.log(`[OutboxDispatcher] Started transactional outbox poller (Interval: ${POLL_INTERVAL_MS}ms)`);
}

export function stopEmailOutboxDispatcher(): void {
    if (dispatcherTimer) {
        clearInterval(dispatcherTimer);
        dispatcherTimer = null;
    }
}
