/**
 * Email Delivery Worker
 * Dedicated asynchronous BullMQ worker for executing individual recipient delivery jobs.
 * Ensures total fault isolation: one recipient failure never blocks or halts other jobs or the application.
 */
import { Worker, type Job } from "bullmq";
import { getBullMQConnectionOptions } from "../queues/workspaceQueues.js";
import { EMAIL_QUEUE_NAMES, type EnqueueEmailJobPayload } from "../services/email/emailQueueService.js";
import { EmailDeliveryService } from "../services/email/emailDeliveryService.js";
import { executeDirectProviderDispatch } from "../services/email/resendService.js";

const WORKER_ID = `email-worker-${process.pid}-${Math.random().toString(36).slice(2, 7)}`;
const CONCURRENCY = Math.max(1, parseInt(process.env.EMAIL_WORKER_CONCURRENCY || "10", 10));

let highWorker: Worker | null = null;
let normalWorker: Worker | null = null;
let lowWorker: Worker | null = null;

/**
 * Core processor for an individual email job.
 * Guaranteed to never throw unhandled rejections to the caller.
 */
export async function processEmailDeliveryJob(jobId: string, workerId = WORKER_ID): Promise<boolean> {
    const job = await EmailDeliveryService.getJobById(jobId);
    if (!job) {
        console.warn(`[EmailWorker] Job ${jobId} not found in database. Skipping.`);
        return false;
    }

    // Idempotency: skip if already sent or cancelled
    if (job.status === "SENT") {
        return true;
    }
    if (job.status === "CANCELLED") {
        return false;
    }

    // Atomically claim the job
    const claimed = await EmailDeliveryService.claimJob(jobId, workerId);
    if (!claimed) {
        // Another worker claimed or state changed
        return false;
    }

    const startedAt = new Date();
    const currentAttempt = job.attempts + 1;

    try {
        // Execute direct provider dispatch
        const sendResult = await executeDirectProviderDispatch({
            to: job.recipientEmail,
            subject: job.subject,
            html: job.htmlBody,
            text: job.textBody || undefined,
            logContext: `[Worker ${workerId} -> ${job.recipientEmail}]`,
        });

        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        if (sendResult.success) {
            // Record successful attempt in audit table
            await EmailDeliveryService.recordAttempt({
                jobId: job.id,
                attemptNumber: currentAttempt,
                workerId,
                startedAt,
                completedAt,
                durationMs,
                status: "SUCCESS",
                provider: sendResult.provider || "resend",
                providerMessageId: sendResult.messageId || sendResult.id,
                providerResponse: sendResult,
            });

            // Mark job SENT in PostgreSQL
            await EmailDeliveryService.markSuccess(job.id, sendResult.provider || "resend", sendResult.messageId || sendResult.id);
            return true;
        } else {
            // Provider returned non-throwing delivery failure
            const failureError = new Error(sendResult.error || "Email provider rejected message");
            await EmailDeliveryService.recordAttempt({
                jobId: job.id,
                attemptNumber: currentAttempt,
                workerId,
                startedAt,
                completedAt,
                durationMs,
                status: "TRANSIENT_FAILURE",
                provider: sendResult.provider || "resend",
                errorMessage: failureError.message,
            });

            await EmailDeliveryService.markFailure(job.id, failureError, workerId, currentAttempt);
            return false;
        }
    } catch (err: any) {
        const completedAt = new Date();
        const durationMs = completedAt.getTime() - startedAt.getTime();

        console.error(`[EmailWorker] Delivery error for job ${job.id} to ${job.recipientEmail}:`, err.message);

        // Record failed attempt
        await EmailDeliveryService.recordAttempt({
            jobId: job.id,
            attemptNumber: currentAttempt,
            workerId,
            startedAt,
            completedAt,
            durationMs,
            status: "TRANSIENT_FAILURE",
            errorMessage: err.message,
        });

        // Mark failure & transition to RETRY_WAIT or DEAD_LETTER
        await EmailDeliveryService.markFailure(job.id, err, workerId, currentAttempt);
        return false;
    }
}

/**
 * Starts all BullMQ priority email workers.
 */
export function startEmailWorkers(): void {
    if (highWorker || normalWorker || lowWorker) {
        return; // Already initialized
    }

    try {
        const connection = getBullMQConnectionOptions();

        const jobHandler = async (bullJob: Job<EnqueueEmailJobPayload>) => {
            const { jobId } = bullJob.data;
            await processEmailDeliveryJob(jobId, WORKER_ID);
        };

        // 1. High-priority queue worker (OTP, password resets, security)
        highWorker = new Worker(EMAIL_QUEUE_NAMES.HIGH, jobHandler, {
            connection,
            concurrency: Math.max(5, CONCURRENCY),
        });

        // 2. Normal-priority queue worker (Cancellations, tickets, event registrations)
        normalWorker = new Worker(EMAIL_QUEUE_NAMES.NORMAL, jobHandler, {
            connection,
            concurrency: CONCURRENCY,
        });

        // 3. Low-priority queue worker (Digests, non-urgent summaries)
        lowWorker = new Worker(EMAIL_QUEUE_NAMES.LOW, jobHandler, {
            connection,
            concurrency: Math.max(2, Math.floor(CONCURRENCY / 2)),
        });

        highWorker.on("error", (err) => console.warn("[BullMQ:HighWorker] Error:", err.message));
        normalWorker.on("error", (err) => console.warn("[BullMQ:NormalWorker] Error:", err.message));
        lowWorker.on("error", (err) => console.warn("[BullMQ:LowWorker] Error:", err.message));

        console.log(`[EmailWorker] Started background email workers [ID: ${WORKER_ID}, Concurrency: ${CONCURRENCY}]`);
    } catch (err: any) {
        console.warn(`[EmailWorker] Failed to initialize BullMQ email workers (Redis may be offline):`, err.message);
    }
}

/**
 * Stops workers gracefully.
 */
export async function stopEmailWorkers(): Promise<void> {
    const promises: Promise<void>[] = [];
    if (highWorker) promises.push(highWorker.close());
    if (normalWorker) promises.push(normalWorker.close());
    if (lowWorker) promises.push(lowWorker.close());
    await Promise.allSettled(promises);
    highWorker = null;
    normalWorker = null;
    lowWorker = null;
}
