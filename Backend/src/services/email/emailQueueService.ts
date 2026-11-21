/**
 * Email Queue Service
 * Manages BullMQ priority queues for email delivery and campaign fan-out.
 * Gracefully degrades to direct PostgreSQL processing when Redis is offline.
 */
import { Queue, type JobsOptions } from "bullmq";
import { getBullMQConnectionOptions } from "../../queues/workspaceQueues.js";
import type { EmailJobPriority } from "./emailDeliveryService.js";

export const EMAIL_QUEUE_NAMES = {
    HIGH: "orbix-email-high",
    NORMAL: "orbix-email-normal",
    LOW: "orbix-email-low",
    CAMPAIGN_FANOUT: "orbix-email-campaign-fanout",
} as const;

export interface EnqueueEmailJobPayload {
    jobId: string;
    priority: EmailJobPriority;
    emailType: string;
    recipientEmail: string;
}

export interface EnqueueCampaignFanoutPayload {
    campaignId: string;
    eventId?: string | null | undefined;
    clubId?: string | null | undefined;
    campaignType: string;
}

let queues: Record<string, Queue> = {};
let isQueueRedisAvailable = true;

function getQueueInstance(name: string): Queue | null {
    if (!isQueueRedisAvailable) return null;

    if (!queues[name]) {
        try {
            const connection = getBullMQConnectionOptions();
            queues[name] = new Queue(name, {
                connection,
                defaultJobOptions: {
                    attempts: 1, // BullMQ attempts = 1; application-level EmailDeliveryService controls authoritative retry & backoff
                    removeOnComplete: { count: 2000, age: 24 * 3600 },
                    removeOnFail: { count: 5000, age: 7 * 24 * 3600 },
                },
            });

            queues[name].on("error", (err) => {
                console.warn(`[BullMQ:${name}] Connection warning:`, err.message);
            });
        } catch (err: any) {
            console.warn(`[BullMQ] Failed to initialize email queue ${name}:`, err.message);
            isQueueRedisAvailable = false;
            return null;
        }
    }

    return queues[name];
}

export class EmailQueueService {
    /**
     * Enqueues an individual recipient email delivery job into the priority BullMQ queue.
     * Uses deterministic jobId to prevent duplicate queue items.
     */
    static async enqueueEmailJob(payload: EnqueueEmailJobPayload, delayMs = 0): Promise<boolean> {
        const queueName =
            payload.priority === "HIGH"
                ? EMAIL_QUEUE_NAMES.HIGH
                : payload.priority === "LOW"
                ? EMAIL_QUEUE_NAMES.LOW
                : EMAIL_QUEUE_NAMES.NORMAL;

        const queue = getQueueInstance(queueName);
        if (!queue) {
            // Redis offline: Job is safely persisted in PostgreSQL email_delivery_jobs.
            // Outbox dispatcher poller will pump it directly.
            return false;
        }

        try {
            const jobOptions: JobsOptions = {
                jobId: `email-${payload.jobId}`,
                ...(delayMs > 0 ? { delay: delayMs } : {}),
            };

            await queue.add("deliver_email", payload, jobOptions);
            return true;
        } catch (err: any) {
            console.warn(`[EmailQueueService.enqueueEmailJob] Failed to enqueue job ${payload.jobId} to Redis:`, err.message);
            return false;
        }
    }

    /**
     * Enqueues a notification campaign for asynchronous recipient fan-out.
     */
    static async enqueueCampaignFanout(payload: EnqueueCampaignFanoutPayload): Promise<boolean> {
        const queue = getQueueInstance(EMAIL_QUEUE_NAMES.CAMPAIGN_FANOUT);
        if (!queue) {
            return false;
        }

        try {
            await queue.add("fanout_campaign", payload, {
                jobId: `campaign-${payload.campaignId}`,
            });
            return true;
        } catch (err: any) {
            console.warn(`[EmailQueueService.enqueueCampaignFanout] Failed to enqueue campaign ${payload.campaignId}:`, err.message);
            return false;
        }
    }

    /**
     * Checks health and connection of all email queues.
     */
    static async getQueueHealth(): Promise<{ redisAvailable: boolean; queues: Record<string, boolean> }> {
        const health: Record<string, boolean> = {};
        for (const [key, name] of Object.entries(EMAIL_QUEUE_NAMES)) {
            try {
                const q = getQueueInstance(name);
                if (q) {
                    await q.isPaused();
                    health[key] = true;
                } else {
                    health[key] = false;
                }
            } catch {
                health[key] = false;
            }
        }
        return {
            redisAvailable: Object.values(health).some(Boolean),
            queues: health,
        };
    }

    /**
     * Gets job counts across email queues.
     */
    static async getQueueCounts(): Promise<Record<string, { waiting: number; active: number; delayed: number; failed: number }>> {
        const counts: Record<string, any> = {};
        for (const [key, name] of Object.entries(EMAIL_QUEUE_NAMES)) {
            try {
                const q = getQueueInstance(name);
                if (q) {
                    const [waiting, active, delayed, failed] = await Promise.all([
                        q.getWaitingCount(),
                        q.getActiveCount(),
                        q.getDelayedCount(),
                        q.getFailedCount(),
                    ]);
                    counts[key] = { waiting, active, delayed, failed };
                } else {
                    counts[key] = { waiting: 0, active: 0, delayed: 0, failed: 0 };
                }
            } catch {
                counts[key] = { waiting: 0, active: 0, delayed: 0, failed: 0 };
            }
        }
        return counts;
    }

    /**
     * Graceful shutdown of all queue connections.
     */
    static async closeAll(): Promise<void> {
        for (const q of Object.values(queues)) {
            try {
                await q.close();
            } catch { }
        }
        queues = {};
    }
}
