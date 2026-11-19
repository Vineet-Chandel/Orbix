/**
 * Form Studio Asynchronous Background Queue
 * Decouples notifications, analytics cache refreshes, and media cleanup from the core database registration transaction.
 */
import redis from "../../redis/client.js";
import { FormLogger } from "../../utils/formLogger.js";

export type BackgroundTaskType =
    | "DISPATCH_NOTIFICATIONS"
    | "INVALIDATE_ANALYTICS_CACHE"
    | "CLEANUP_ORPHAN_MEDIA"
    | "GENERATE_LARGE_EXPORT";

export interface BackgroundTaskPayload {
    type: BackgroundTaskType;
    eventId: string;
    clubId?: string | undefined;
    userId?: string | undefined;
    data: Record<string, any>;
    enqueuedAt: string;
}

export class FormBackgroundQueue {
    private static QUEUE_KEY = "orbix:queue:form_tasks";

    /**
     * Enqueue a background task for asynchronous execution
     * Guarantees that failures in background dispatch never throw or block the main HTTP request
     */
    static async enqueue(
        type: BackgroundTaskType,
        eventId: string,
        data: Record<string, any>,
        context?: { clubId?: string | undefined; userId?: string | undefined }
    ): Promise<void> {
        const payload: BackgroundTaskPayload = {
            type,
            eventId,
            clubId: context?.clubId,
            userId: context?.userId,
            data,
            enqueuedAt: new Date().toISOString(),
        };

        try {
            if (redis && redis.status === "ready") {
                await redis.rpush(this.QUEUE_KEY, JSON.stringify(payload));
                // Trigger immediate non-blocking worker step
                setImmediate(() => {
                    FormBackgroundQueue.processNextJob().catch((err) => {
                        FormLogger.warn("DB_ERROR", "Background task worker error", {
                            eventId,
                            meta: { error: err.message },
                        });
                    });
                });
            } else {
                // Redis is offline/standby: execute via non-blocking Node.js event-loop tick
                setImmediate(async () => {
                    await FormBackgroundQueue.executeTask(payload);
                });
            }
        } catch (err: any) {
            FormLogger.warn("DB_ERROR", "Could not enqueue background task to Redis. Executing locally.", {
                eventId,
                meta: { taskType: type, error: err.message },
            });
            setImmediate(async () => {
                await FormBackgroundQueue.executeTask(payload);
            });
        }
    }

    /**
     * Process next job from Redis list queue
     */
    private static async processNextJob(): Promise<void> {
        if (!redis || redis.status !== "ready") return;

        try {
            const raw = await redis.lpop(this.QUEUE_KEY);
            if (!raw) return;

            const payload: BackgroundTaskPayload = JSON.parse(raw);
            await this.executeTask(payload);
        } catch (err: any) {
            FormLogger.warn("DB_ERROR", "Error executing job from Redis queue", {
                meta: { error: err.message },
            });
        }
    }

    /**
     * Task Execution Router
     */
    private static async executeTask(payload: BackgroundTaskPayload): Promise<void> {
        const startTime = Date.now();
        try {
            switch (payload.type) {
                case "DISPATCH_NOTIFICATIONS": {
                    // Dynamically import service to prevent circular dependency
                    const { ClubEventFormService } = await import("../club/clubEventFormService.js");
                    await ClubEventFormService.dispatchSubmissionNotifications(payload.data as any);
                    break;
                }

                case "INVALIDATE_ANALYTICS_CACHE": {
                    if (redis && redis.status === "ready") {
                        await redis.del(`orbix:analytics:form:${payload.eventId}`);
                        await redis.del(`orbix:stats:cross_event:${payload.clubId}`);
                    }
                    break;
                }

                case "CLEANUP_ORPHAN_MEDIA": {
                    const publicId = payload.data.publicId;
                    if (publicId && typeof publicId === "string") {
                        const { v2: cloudinary } = await import("cloudinary");
                        await cloudinary.uploader.destroy(publicId).catch(() => {});
                    }
                    break;
                }

                case "GENERATE_LARGE_EXPORT": {
                    // Reserved for async large export generation
                    break;
                }

                default:
                    break;
            }

            FormLogger.info("REGISTRATION_SUBMITTED", `Background task ${payload.type} processed successfully`, {
                eventId: payload.eventId,
                clubId: payload.clubId,
                userId: payload.userId,
                durationMs: Date.now() - startTime,
                meta: { taskType: payload.type },
            });
        } catch (taskErr: any) {
            FormLogger.error(
                "DB_ERROR",
                `Failed to execute background task ${payload.type}`,
                {
                    eventId: payload.eventId,
                    clubId: payload.clubId,
                    userId: payload.userId,
                    durationMs: Date.now() - startTime,
                    meta: { taskType: payload.type },
                },
                taskErr
            );
        }
    }
}
