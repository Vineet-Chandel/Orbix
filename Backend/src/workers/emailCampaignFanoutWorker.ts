/**
 * Email Campaign Fan-Out Worker
 * Fans out bulk notification campaigns (e.g. Event Cancellations, Event Reschedules)
 * into individual recipient jobs in paged batches.
 * Guarantees that even 10,000+ recipients are isolated with independent delivery lifecycles.
 */
import { Worker, type Job } from "bullmq";
import { query } from "../database/client.js";
import { getBullMQConnectionOptions } from "../queues/workspaceQueues.js";
import {
    EMAIL_QUEUE_NAMES,
    EmailQueueService,
    type EnqueueCampaignFanoutPayload,
} from "../services/email/emailQueueService.js";
import { EmailDeliveryService } from "../services/email/emailDeliveryService.js";

const FANOUT_BATCH_SIZE = Math.max(50, parseInt(process.env.EMAIL_FANOUT_BATCH_SIZE || "200", 10));

let fanoutWorker: Worker | null = null;

export async function processCampaignFanout(campaignId: string): Promise<{ total: number; generated: number }> {
    const campaignRes = await query(
        `SELECT * FROM public.email_outbox_campaigns WHERE id = $1::uuid LIMIT 1;`,
        [campaignId]
    );

    if (!campaignRes.rows[0]) {
        console.warn(`[CampaignFanout] Campaign ${campaignId} not found.`);
        return { total: 0, generated: 0 };
    }

    const campaign = campaignRes.rows[0];
    if (campaign.status === "COMPLETED" || campaign.status === "CANCELLED") {
        return { total: campaign.total_recipients, generated: campaign.processed_recipients };
    }

    // Mark campaign processing
    await query(
        `UPDATE public.email_outbox_campaigns
         SET status = 'PROCESSING', updated_at = now()
         WHERE id = $1::uuid AND status = 'PENDING';`,
        [campaignId]
    );

    const eventId = campaign.event_id;
    const payload = campaign.payload || {};
    const subject = payload.subject || campaign.title;
    const htmlBody = payload.htmlBody || `<p>${campaign.title}</p>`;
    const textBody = payload.textBody || undefined;
    const emailType = campaign.campaign_type || "campaign_notification";

    let offset = 0;
    let totalGenerated = 0;
    let hasMore = true;

    // Stream/paginate through registered applicants
    while (hasMore) {
        let applicantsRes;
        if (eventId) {
            applicantsRes = await query(
                `SELECT DISTINCT
                    r.id AS "registrationId",
                    r.user_id AS "userId",
                    COALESCE(NULLIF(TRIM(r.applicant_name), ''), NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, 'Student') AS "recipientName",
                    COALESCE(NULLIF(TRIM(r.applicant_email), ''), u.email) AS "recipientEmail"
                 FROM public.club_event_registrations r
                 JOIN public.users u ON u.id = r.user_id
                 WHERE r.event_id = $1::uuid
                 ORDER BY r.user_id
                 LIMIT $2 OFFSET $3;`,
                [eventId, FANOUT_BATCH_SIZE, offset]
            );
        } else {
            // General campaign without specific event
            hasMore = false;
            break;
        }

        const applicants = applicantsRes.rows || [];
        if (applicants.length === 0) {
            hasMore = false;
            break;
        }

        for (const applicant of applicants) {
            if (!applicant.recipientEmail) continue;

            const idempotencyKey = `camp-${campaignId}-${applicant.userId}`;

            // Create individual recipient job
            const { job } = await EmailDeliveryService.createDeliveryJob({
                campaignId,
                eventId,
                userId: applicant.userId,
                recipientEmail: applicant.recipientEmail,
                recipientName: applicant.recipientName,
                subject,
                htmlBody,
                textBody,
                emailType,
                priority: "NORMAL",
                idempotencyKey,
                metadata: {
                    campaignId,
                    eventId,
                    registrationId: applicant.registrationId,
                },
            });

            // Enqueue individual recipient into BullMQ
            await EmailQueueService.enqueueEmailJob({
                jobId: job.id,
                priority: "NORMAL",
                emailType: job.emailType,
                recipientEmail: job.recipientEmail,
            });

            totalGenerated++;
        }

        offset += applicants.length;
        if (applicants.length < FANOUT_BATCH_SIZE) {
            hasMore = false;
        }
    }

    // Update campaign summary
    await query(
        `UPDATE public.email_outbox_campaigns
         SET total_recipients = $2,
             status = 'PROCESSING',
             updated_at = now()
         WHERE id = $1::uuid;`,
        [campaignId, totalGenerated]
    );

    console.log(
        `[CampaignFanout] Campaign ${campaignId} (${campaign.title}): Generated ${totalGenerated} individual recipient jobs.`
    );

    return { total: totalGenerated, generated: totalGenerated };
}

export function startCampaignFanoutWorker(): void {
    if (fanoutWorker) return;

    try {
        const connection = getBullMQConnectionOptions();

        fanoutWorker = new Worker(
            EMAIL_QUEUE_NAMES.CAMPAIGN_FANOUT,
            async (job: Job<EnqueueCampaignFanoutPayload>) => {
                const { campaignId } = job.data;
                await processCampaignFanout(campaignId);
            },
            {
                connection,
                concurrency: 2,
            }
        );

        fanoutWorker.on("error", (err) => console.warn("[BullMQ:CampaignFanout] Error:", err.message));
        console.log("[CampaignFanoutWorker] Started campaign fan-out worker");
    } catch (err: any) {
        console.warn("[CampaignFanoutWorker] Failed to start fan-out worker:", err.message);
    }
}

export async function stopCampaignFanoutWorker(): Promise<void> {
    if (fanoutWorker) {
        await fanoutWorker.close();
        fanoutWorker = null;
    }
}
