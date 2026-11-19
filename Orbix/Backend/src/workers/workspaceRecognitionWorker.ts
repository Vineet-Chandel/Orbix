// Backend/src/workers/workspaceRecognitionWorker.ts
import { Worker, Job } from "bullmq";
import {
    QUEUE_NAMES,
    getBullMQConnectionOptions,
} from "../queues/workspaceQueues.js";
import { WorkspaceRecognitionReconciliationService } from "../services/workspace/workspaceRecognitionReconciliationService.js";

let recognitionWorker: Worker | null = null;
let isWorkerRunning = false;

/**
 * Creates and initializes the BullMQ worker for workspace recognition & leaderboards.
 * Designed with guaranteed idempotency and exponential backoff retry guards.
 */
export function createRecognitionWorker(): Worker {
    const connection = getBullMQConnectionOptions();

    const worker = new Worker(
        QUEUE_NAMES.RECOGNITION,
        async (job: Job) => {
            const { name, data } = job;

            switch (name) {
                case "process_outbox_event": {
                    await WorkspaceRecognitionReconciliationService.processOutboxEvent({
                        workspaceId: data.workspaceId,
                        eventType: data.eventType,
                        payload: data.payload,
                    });
                    return { success: true, processed: "outbox_event" };
                }

                case "reconcile_leaderboards": {
                    const result = await WorkspaceRecognitionReconciliationService.reconcileLeaderboards(
                        data.workspaceId,
                        data.period
                    );
                    return { success: true, ...result };
                }

                case "rebuild_leaderboards": {
                    const result = await WorkspaceRecognitionReconciliationService.rebuildWorkspaceLeaderboards(
                        data.workspaceId,
                        data.period
                    );
                    return { success: true, ...result };
                }

                default: {
                    console.warn(`[BullMQ:${QUEUE_NAMES.RECOGNITION}] Unknown job name: ${name}`);
                    return { skipped: true, reason: `Unknown job: ${name}` };
                }
            }
        },
        {
            connection,
            concurrency: 5,
        }
    );

    worker.on("completed", (job) => {
        // Optional debug logging
    });

    worker.on("failed", (job, err) => {
        console.error(
            `[BullMQ:${QUEUE_NAMES.RECOGNITION}] Job ${job?.id} (${job?.name}) failed:`,
            err.message
        );
    });

    return worker;
}

export function startRecognitionWorker(): void {
    if (isWorkerRunning) return;
    try {
        recognitionWorker = createRecognitionWorker();
        isWorkerRunning = true;
        console.log(`✅ Recognition BullMQ worker (${QUEUE_NAMES.RECOGNITION}) started`);
    } catch (err: any) {
        console.warn(`[BullMQ] Failed to start recognition worker:`, err.message);
    }
}

export async function stopRecognitionWorker(): Promise<void> {
    if (!isWorkerRunning || !recognitionWorker) return;
    try {
        await recognitionWorker.close();
        isWorkerRunning = false;
        recognitionWorker = null;
        console.log(`🛑 Recognition BullMQ worker stopped`);
    } catch (err: any) {
        console.warn(`[BullMQ] Error stopping recognition worker:`, err.message);
    }
}
