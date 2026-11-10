// Backend/src/workers/workspaceNotificationWorker.ts
import { Worker, Job } from "bullmq";
import {
    QUEUE_NAMES,
    getBullMQConnectionOptions,
    enqueueWorkspaceJob,
} from "../queues/workspaceQueues.js";
import { WorkspaceRepository } from "../repositories/workspaceRepository.js";
import { WorkspaceEmailService, type SendWorkspaceEmailOptions } from "../services/workspace/workspaceEmailService.js";
import { query } from "../database/client.js";

let emailWorker: Worker | null = null;
let reminderWorker: Worker | null = null;
let notificationWorker: Worker | null = null;
let isWorkersRunning = false;

/**
 * Worker for workspace emails
 */
function createEmailWorker(): Worker {
    const connection = getBullMQConnectionOptions();
    const worker = new Worker(
        QUEUE_NAMES.EMAILS,
        async (job: Job<SendWorkspaceEmailOptions>) => {
            const outcome = await WorkspaceEmailService.sendEmail(job.data);
            if (!outcome.success && !outcome.skipped) {
                throw new Error(outcome.error || "Email delivery failed");
            }
            return outcome;
        },
        {
            connection,
            concurrency: 5,
        }
    );

    worker.on("failed", (job, err) => {
        console.error(`[BullMQ:${QUEUE_NAMES.EMAILS}] Job ${job?.id} failed:`, err.message);
    });

    return worker;
}

/**
 * Worker for task deadline reminders with validation guards
 */
function createReminderWorker(): Worker {
    const connection = getBullMQConnectionOptions();
    const worker = new Worker(
        QUEUE_NAMES.REMINDERS,
        async (job: Job<{ taskId: string; recipientId: string; expectedDueDate: string; workspaceId: string }>) => {
            const { taskId, recipientId, expectedDueDate, workspaceId } = job.data;

            // 1. Guard: Check task status and due date
            const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);
            if (!task) {
                return { skipped: true, reason: "Task no longer exists" };
            }

            if (
                task.status === "completed" ||
                task.status === "approved" ||
                task.status === "cancelled" ||
                task.status === "archived"
            ) {
                return { skipped: true, reason: `Task is already ${task.status}` };
            }

            if (!task.dueDate || new Date(task.dueDate).toISOString() !== new Date(expectedDueDate).toISOString()) {
                return { skipped: true, reason: "Task due date was changed or cleared" };
            }

            // 2. Guard: Check recipient membership status
            const member = await WorkspaceRepository.findMember(workspaceId, recipientId);
            if (!member || member.membershipStatus !== "active") {
                return { skipped: true, reason: "Recipient is no longer an active workspace member" };
            }

            // 3. Guard: Check user
            const userRes = await query(`SELECT email, firstname, lastname, username FROM public.users WHERE id = $1;`, [recipientId]);
            const user = userRes.rows[0];
            if (!user) {
                return { skipped: true, reason: "User not found" };
            }

            const workspace = await WorkspaceRepository.findById(workspaceId);
            const workspaceName = workspace?.name || "Workspace";
            const clubId = workspace?.clubId || "";

            // 4. Create in-app notification
            await WorkspaceRepository.createNotification({
                workspaceId,
                recipientId,
                eventType: "task_deadline_approaching",
                resourceType: "task",
                resourceId: taskId,
                title: `Reminder: Task "${task.title}" is due soon`,
                message: `The deadline for task "${task.title}" is ${new Date(task.dueDate).toLocaleDateString()}.`,
                destinationUrl: `/club/${clubId}/workspace/tasks/${taskId}`,
            });

            // 5. Send reminder email
            const idempotencyKey = `task-reminder/${taskId}/${recipientId}/${new Date(task.dueDate).getTime()}`;
            return await WorkspaceEmailService.sendEmail({
                workspaceId,
                clubId,
                workspaceName,
                recipientId,
                recipientEmail: user.email,
                recipientName: `${user.firstname || ""} ${user.lastname || user.username}`.trim(),
                emailType: "task_deadline_reminder",
                idempotencyKey,
                context: {
                    resourceTitle: task.title,
                    dueDate: task.dueDate,
                    priority: task.priority,
                    actionUrl: `${process.env.APP_BASE_URL || "https://orbix.campus"}/club/${clubId}/workspace/tasks/${taskId}`,
                },
            });
        },
        {
            connection,
            concurrency: 5,
        }
    );

    return worker;
}

/**
 * Worker for in-app notification fan-out
 */
function createNotificationWorker(): Worker {
    const connection = getBullMQConnectionOptions();
    const worker = new Worker(
        QUEUE_NAMES.NOTIFICATIONS,
        async (job: Job<any>) => {
            const { recipients, notificationData } = job.data;
            if (!Array.isArray(recipients)) return;

            for (const recipientId of recipients) {
                try {
                    await WorkspaceRepository.createNotification({
                        ...notificationData,
                        recipientId,
                    });
                } catch (err: any) {
                    console.warn(`[BullMQ:Notifications] Failed to create notification for ${recipientId}:`, err.message);
                }
            }
        },
        {
            connection,
            concurrency: 5,
        }
    );

    return worker;
}

/**
 * Transactional Outbox Dispatcher:
 * Reads pending outbox records and publishes them to the appropriate queue.
 */
export async function dispatchOutboxEvents(batchSize = 25): Promise<number> {
    const events = await WorkspaceRepository.getPendingOutboxEvents(batchSize);
    let publishedCount = 0;

    for (const event of events) {
        try {
            await WorkspaceRepository.markOutboxEventStatus(event.id, "processing");

            const { payload, eventType } = event;
            let enqueued = false;

            if (eventType.startsWith("email_")) {
                const res = await enqueueWorkspaceJob(
                    QUEUE_NAMES.EMAILS,
                    eventType,
                    payload,
                    { jobId: payload.idempotencyKey }
                );
                enqueued = res.enqueued;
            } else if (eventType === "task_reminder_scheduled") {
                const delayMs = payload.delayMs || 0;
                const res = await enqueueWorkspaceJob(
                    QUEUE_NAMES.REMINDERS,
                    "task_reminder",
                    payload,
                    { delay: delayMs, jobId: `reminder-${payload.taskId}-${payload.recipientId}` }
                );
                enqueued = res.enqueued;
            } else if (eventType === "notification_fanout") {
                const res = await enqueueWorkspaceJob(
                    QUEUE_NAMES.NOTIFICATIONS,
                    "fanout",
                    payload
                );
                enqueued = res.enqueued;
            } else {
                enqueued = true;
            }

            // If BullMQ enqueued successfully or fallback direct dispatch succeeded
            if (enqueued) {
                await WorkspaceRepository.markOutboxEventStatus(event.id, "published");
                publishedCount++;
            } else {
                // If queue is temporarily offline, execute synchronously or keep pending
                if (eventType.startsWith("email_")) {
                    await WorkspaceEmailService.sendEmail(payload as any as SendWorkspaceEmailOptions);
                    await WorkspaceRepository.markOutboxEventStatus(event.id, "published");
                    publishedCount++;
                } else {
                    await WorkspaceRepository.markOutboxEventStatus(event.id, "failed", "BullMQ queue offline");
                }
            }
        } catch (err: any) {
            await WorkspaceRepository.markOutboxEventStatus(event.id, "failed", err.message);
        }
    }

    return publishedCount;
}

/**
 * Starts all workspace workers
 */
export function startWorkspaceWorkers(): void {
    if (isWorkersRunning) return;
    try {
        emailWorker = createEmailWorker();
        reminderWorker = createReminderWorker();
        notificationWorker = createNotificationWorker();
        isWorkersRunning = true;
        console.log("✅ Workspace BullMQ workers started successfully");
    } catch (err: any) {
        console.warn("[BullMQ] Failed to start workers:", err.message);
    }
}

/**
 * Stops all workspace workers
 */
export async function stopWorkspaceWorkers(): Promise<void> {
    if (!isWorkersRunning) return;
    if (emailWorker) await emailWorker.close();
    if (reminderWorker) await reminderWorker.close();
    if (notificationWorker) await notificationWorker.close();
    isWorkersRunning = false;
    console.log("🛑 Workspace BullMQ workers stopped");
}
