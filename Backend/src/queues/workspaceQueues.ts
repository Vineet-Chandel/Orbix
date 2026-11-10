// Backend/src/queues/workspaceQueues.ts
import { Queue, QueueEvents } from "bullmq";

export const QUEUE_NAMES = {
    NOTIFICATIONS: "workspace-notifications",
    EMAILS: "workspace-emails",
    REMINDERS: "workspace-reminders",
    MAINTENANCE: "workspace-maintenance",
} as const;

export type WorkspaceQueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

export function getBullMQConnectionOptions() {
    return {
        host: process.env.REDIS_HOST || "127.0.0.1",
        port: Number(process.env.REDIS_PORT) || 6379,
        username: process.env.REDIS_USERNAME || undefined,
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
    };
}

let queues: Record<string, Queue> = {};
let queuesInitialized = false;
let isRedisAvailable = true;

/**
 * Default retry configuration with exponential backoff:
 * 5 attempts, initial delay 2000ms, doubling on each retry
 */
export const DEFAULT_JOB_OPTIONS = {
    attempts: 5,
    backoff: {
        type: "exponential" as const,
        delay: 2000,
    },
    removeOnComplete: {
        count: 1000,
        age: 24 * 3600, // keep 24 hours
    },
    removeOnFail: {
        count: 5000,
        age: 7 * 24 * 3600, // keep 7 days for audit
    },
};

export function getWorkspaceQueue(name: WorkspaceQueueName): Queue | null {
    if (!isRedisAvailable) return null;

    if (!queues[name]) {
        try {
            const connection = getBullMQConnectionOptions();
            queues[name] = new Queue(name, {
                connection,
                defaultJobOptions: DEFAULT_JOB_OPTIONS,
            });

            queues[name].on("error", (err) => {
                console.warn(`[BullMQ:${name}] Redis connection error:`, err.message);
            });
        } catch (err: any) {
            console.warn(`[BullMQ] Failed to initialize queue ${name}:`, err.message);
            isRedisAvailable = false;
            return null;
        }
    }
    return queues[name];
}

/**
 * Enqueue a job into the appropriate BullMQ queue, or return false if Redis is unavailable.
 */
export async function enqueueWorkspaceJob(
    queueName: WorkspaceQueueName,
    jobName: string,
    data: Record<string, any>,
    options?: {
        jobId?: string;
        delay?: number;
        priority?: number;
    }
): Promise<{ enqueued: boolean; jobId?: string }> {
    try {
        const queue = getWorkspaceQueue(queueName);
        if (!queue) {
            return { enqueued: false };
        }

        const jobOptions: Record<string, any> = {
            ...DEFAULT_JOB_OPTIONS,
        };
        if (options?.jobId !== undefined) jobOptions.jobId = options.jobId;
        if (options?.delay !== undefined) jobOptions.delay = options.delay;
        if (options?.priority !== undefined) jobOptions.priority = options.priority;

        const job = await queue.add(jobName, data, jobOptions);

        return { enqueued: true, ...(job.id ? { jobId: job.id } : {}) };
    } catch (err: any) {
        console.warn(`[BullMQ] Failed to enqueue job '${jobName}' on '${queueName}':`, err.message);
        return { enqueued: false };
    }
}

/**
 * Gracefully close all BullMQ queues
 */
export async function closeWorkspaceQueues(): Promise<void> {
    for (const [name, queue] of Object.entries(queues)) {
        try {
            await queue.close();
        } catch (err: any) {
            console.warn(`[BullMQ] Error closing queue ${name}:`, err.message);
        }
    }
    queues = {};
}
