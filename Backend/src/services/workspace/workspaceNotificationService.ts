// Backend/src/services/workspace/workspaceNotificationService.ts
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { query } from "../../database/client.js";
import { enqueueWorkspaceJob, QUEUE_NAMES } from "../../queues/workspaceQueues.js";
import { WorkspaceEmailService } from "./workspaceEmailService.js";
import type {
    WorkspaceNotification,
    WorkspaceNotificationEventType,
    WorkspaceNotificationResourceType,
    WorkspaceEmailType,
} from "../../types/workspaceTypes.js";

const APP_BASE_URL = process.env.APP_BASE_URL || "https://orbix.campus";

export class WorkspaceNotificationService {
    /**
     * Helper to get user profile details for notifications & emails
     */
    private static async getUserDetails(userId: string): Promise<{ id: string; email: string; name: string; username: string } | null> {
        const res = await query(
            `SELECT id, email, username, firstname, lastname FROM public.users WHERE id = $1;`,
            [userId]
        );
        const u = res.rows[0];
        if (!u) return null;
        const name = `${u.firstname || ""} ${u.lastname || u.username}`.trim();
        return { id: u.id, email: u.email, name, username: u.username };
    }

    /**
     * Dispatches an in-app notification AND creates an outbox event for email/async delivery.
     */
    private static async emitNotification(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientId: string;
        actorId?: string | null;
        actorName?: string;
        eventType: WorkspaceNotificationEventType;
        resourceType: WorkspaceNotificationResourceType;
        resourceId: string;
        title: string;
        message: string;
        destinationUrl: string;
        metadata?: Record<string, any>;
        emailType?: WorkspaceEmailType;
        emailContext?: Record<string, any>;
        idempotencyKey?: string;
        isEssentialEmail?: boolean;
        clientOrNull?: any;
    }): Promise<WorkspaceNotification> {
        // 1. Create durable in-app notification
        const notification = await WorkspaceRepository.createNotification(
            {
                workspaceId: params.workspaceId,
                recipientId: params.recipientId,
                actorId: params.actorId || null,
                eventType: params.eventType,
                resourceType: params.resourceType,
                resourceId: params.resourceId,
                title: params.title,
                message: params.message,
                destinationUrl: params.destinationUrl,
                metadata: params.metadata || {},
            },
            params.clientOrNull
        );

        // 2. If an email is associated, record an outbox event
        if (params.emailType && params.idempotencyKey) {
            const recipientUser = await this.getUserDetails(params.recipientId);
            if (recipientUser) {
                const emailPayload = {
                    workspaceId: params.workspaceId,
                    clubId: params.clubId,
                    workspaceName: params.workspaceName,
                    recipientId: params.recipientId,
                    recipientEmail: recipientUser.email,
                    recipientName: recipientUser.name,
                    emailType: params.emailType,
                    idempotencyKey: params.idempotencyKey,
                    isEssential: params.isEssentialEmail || false,
                    context: {
                        actorName: params.actorName,
                        actionUrl: `${APP_BASE_URL}${params.destinationUrl}`,
                        ...params.emailContext,
                    },
                };

                await WorkspaceRepository.createOutboxEvent(
                    {
                        workspaceId: params.workspaceId,
                        eventType: `email_${params.emailType}`,
                        payload: emailPayload,
                    },
                    params.clientOrNull
                );

                // Asynchronously attempt queue delivery without blocking callers
                enqueueWorkspaceJob(
                    QUEUE_NAMES.EMAILS,
                    `email_${params.emailType}`,
                    emailPayload,
                    { jobId: params.idempotencyKey }
                ).catch((err) => {
                    console.warn("[NotificationService] Queue dispatch error:", err.message);
                });
            }
        }

        return notification;
    }

    // =========================================================================
    // TASK NOTIFICATIONS
    // =========================================================================

    static async notifyTaskAssigned(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        taskVersion: number;
        assigneeId: string;
        actorId: string;
        actorName: string;
        departmentName?: string;
        priority?: string;
        dueDate?: string | null;
        clientOrNull?: any;
    }): Promise<WorkspaceNotification> {
        const idempotencyKey = `task-assigned/${params.taskId}/${params.assigneeId}/${params.taskVersion}`;
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;

        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.assigneeId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "task_assigned",
            resourceType: "task",
            resourceId: params.taskId,
            title: `New Task Assigned: ${params.taskTitle}`,
            message: `${params.actorName} assigned you to "${params.taskTitle}".`,
            destinationUrl,
            metadata: {
                priority: params.priority,
                dueDate: params.dueDate,
                departmentName: params.departmentName,
            },
            emailType: "task_assigned",
            idempotencyKey,
            emailContext: {
                resourceTitle: params.taskTitle,
                priority: params.priority,
                dueDate: params.dueDate,
                departmentName: params.departmentName,
            },
            clientOrNull: params.clientOrNull,
        });
    }

    static async notifyTaskReassigned(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        taskVersion: number;
        assigneeId: string;
        actorId: string;
        actorName: string;
        notes?: string;
        clientOrNull?: any;
    }): Promise<WorkspaceNotification> {
        const idempotencyKey = `task-reassigned/${params.taskId}/${params.assigneeId}/${params.taskVersion}`;
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;

        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.assigneeId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "task_reassigned",
            resourceType: "task",
            resourceId: params.taskId,
            title: `Task Reassigned: ${params.taskTitle}`,
            message: `${params.actorName} reassigned task "${params.taskTitle}" to you.`,
            destinationUrl,
            emailType: "task_reassigned",
            idempotencyKey,
            emailContext: {
                resourceTitle: params.taskTitle,
                notes: params.notes,
            },
            clientOrNull: params.clientOrNull,
        });
    }

    static async notifyTaskSubmitted(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        reviewerIds: string[];
        actorId: string;
        actorName: string;
    }): Promise<void> {
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;
        for (const reviewerId of params.reviewerIds) {
            await this.emitNotification({
                workspaceId: params.workspaceId,
                clubId: params.clubId,
                workspaceName: params.workspaceName,
                recipientId: reviewerId,
                actorId: params.actorId,
                actorName: params.actorName,
                eventType: "task_submitted",
                resourceType: "task",
                resourceId: params.taskId,
                title: `Task Submitted: ${params.taskTitle}`,
                message: `${params.actorName} submitted work for "${params.taskTitle}".`,
                destinationUrl,
            });
        }
    }

    static async notifyTaskApproved(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        assigneeIds: string[];
        actorId: string;
        actorName: string;
        notes?: string;
    }): Promise<void> {
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;
        for (const assigneeId of params.assigneeIds) {
            const idempotencyKey = `task-approved/${params.taskId}/${assigneeId}/${Date.now()}`;
            await this.emitNotification({
                workspaceId: params.workspaceId,
                clubId: params.clubId,
                workspaceName: params.workspaceName,
                recipientId: assigneeId,
                actorId: params.actorId,
                actorName: params.actorName,
                eventType: "task_approved",
                resourceType: "task",
                resourceId: params.taskId,
                title: `Task Approved: ${params.taskTitle}`,
                message: `${params.actorName} approved your submission for "${params.taskTitle}".`,
                destinationUrl,
                emailType: "task_review_completed",
                idempotencyKey,
                emailContext: {
                    resourceTitle: params.taskTitle,
                    notes: params.notes,
                },
            });
        }
    }

    static async notifyChangesRequested(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        assigneeIds: string[];
        actorId: string;
        actorName: string;
        notes?: string;
    }): Promise<void> {
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;
        for (const assigneeId of params.assigneeIds) {
            const idempotencyKey = `task-changes-requested/${params.taskId}/${assigneeId}/${Date.now()}`;
            await this.emitNotification({
                workspaceId: params.workspaceId,
                clubId: params.clubId,
                workspaceName: params.workspaceName,
                recipientId: assigneeId,
                actorId: params.actorId,
                actorName: params.actorName,
                eventType: "task_changes_requested",
                resourceType: "task",
                resourceId: params.taskId,
                title: `Changes Requested: ${params.taskTitle}`,
                message: `${params.actorName} requested changes on "${params.taskTitle}".`,
                destinationUrl,
                emailType: "task_changes_requested",
                idempotencyKey,
                emailContext: {
                    resourceTitle: params.taskTitle,
                    notes: params.notes,
                },
            });
        }
    }

    static async notifyTaskComment(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        taskId: string;
        taskTitle: string;
        commenterId: string;
        commenterName: string;
        content: string;
        recipientIds: string[];
    }): Promise<void> {
        const destinationUrl = `/club/${params.clubId}/workspace/tasks/${params.taskId}`;

        // Parse @username mentions
        const mentionMatches = params.content.match(/@(\w+)/g);
        const mentionedUsernames = mentionMatches ? mentionMatches.map((m) => m.slice(1).toLowerCase()) : [];

        for (const recipientId of params.recipientIds) {
            if (recipientId === params.commenterId) continue;

            await this.emitNotification({
                workspaceId: params.workspaceId,
                clubId: params.clubId,
                workspaceName: params.workspaceName,
                recipientId,
                actorId: params.commenterId,
                actorName: params.commenterName,
                eventType: "task_comment",
                resourceType: "task",
                resourceId: params.taskId,
                title: `New Comment on ${params.taskTitle}`,
                message: `${params.commenterName} commented: "${params.content.slice(0, 80)}${params.content.length > 80 ? "..." : ""}"`,
                destinationUrl,
            });
        }
    }

    // =========================================================================
    // MEMBER & DEPARTMENT NOTIFICATIONS
    // =========================================================================

    static async notifyWorkspaceInvitation(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientEmail: string;
        recipientName?: string;
        invitationToken: string;
        inviterName: string;
        roleName?: string;
        departmentName?: string;
    }): Promise<void> {
        const actionUrl = `${APP_BASE_URL}/workspace-invite?token=${params.invitationToken}`;
        const idempotencyKey = `invite/${params.workspaceId}/${params.recipientEmail}/${params.invitationToken.slice(0, 16)}`;

        // Check if recipient is an existing user
        const userRes = await query(`SELECT id FROM public.users WHERE LOWER(email) = LOWER($1);`, [params.recipientEmail]);
        const existingUserId = userRes.rows[0]?.id;

        if (existingUserId) {
            await WorkspaceRepository.createNotification({
                workspaceId: params.workspaceId,
                recipientId: existingUserId,
                eventType: "workspace_invitation",
                resourceType: "workspace",
                resourceId: params.workspaceId,
                title: `Invitation to join ${params.workspaceName}`,
                message: `${params.inviterName} invited you to join ${params.workspaceName}.`,
                destinationUrl: `/club/${params.clubId}/workspace`,
            });
        }

        // Always send transactional invitation email (Essential)
        await WorkspaceEmailService.sendEmail({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: existingUserId || "unregistered",
            recipientEmail: params.recipientEmail,
            recipientName: params.recipientName || "Member",
            emailType: "workspace_invitation",
            idempotencyKey,
            isEssential: true,
            context: {
                actorName: params.inviterName,
                ...(params.roleName ? { roleName: params.roleName } : {}),
                ...(params.departmentName ? { departmentName: params.departmentName } : {}),
                actionUrl,
            },
        });
    }

    static async notifyRoleChanged(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientId: string;
        actorId: string;
        actorName: string;
        newRoleName: string;
    }): Promise<WorkspaceNotification> {
        const idempotencyKey = `role-changed/${params.workspaceId}/${params.recipientId}/${Date.now()}`;
        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.recipientId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "role_assigned",
            resourceType: "role",
            resourceId: params.newRoleName,
            title: `Role Updated in ${params.workspaceName}`,
            message: `Your role was updated to "${params.newRoleName}" by ${params.actorName}.`,
            destinationUrl: `/club/${params.clubId}/workspace`,
            emailType: "role_assigned_changed",
            idempotencyKey,
            isEssentialEmail: true,
            emailContext: {
                roleName: params.newRoleName,
            },
        });
    }

    static async notifyDepartmentAdded(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientId: string;
        actorId: string;
        actorName: string;
        departmentId: string;
        departmentName: string;
    }): Promise<WorkspaceNotification> {
        const idempotencyKey = `dept-added/${params.workspaceId}/${params.recipientId}/${params.departmentId}`;
        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.recipientId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "department_membership_added",
            resourceType: "department",
            resourceId: params.departmentId,
            title: `Added to ${params.departmentName}`,
            message: `${params.actorName} added you to the ${params.departmentName} department.`,
            destinationUrl: `/club/${params.clubId}/workspace/departments/${params.departmentId}`,
            emailType: "department_assignment",
            idempotencyKey,
            emailContext: {
                departmentName: params.departmentName,
            },
        });
    }

    static async notifyDepartmentRemoved(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientId: string;
        actorId: string;
        actorName: string;
        departmentId: string;
        departmentName: string;
    }): Promise<WorkspaceNotification> {
        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.recipientId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "department_membership_removed",
            resourceType: "department",
            resourceId: params.departmentId,
            title: `Removed from ${params.departmentName}`,
            message: `${params.actorName} removed you from ${params.departmentName}.`,
            destinationUrl: `/club/${params.clubId}/workspace`,
        });
    }

    // =========================================================================
    // MENTION & CHANNEL NOTIFICATIONS
    // =========================================================================

    static async notifyMention(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        recipientId: string;
        actorId: string;
        actorName: string;
        resourceType: "channel" | "task";
        resourceId: string;
        resourceTitle: string;
        contentSnippet: string;
        destinationUrl: string;
    }): Promise<WorkspaceNotification> {
        const idempotencyKey = `mention/${params.resourceType}/${params.resourceId}/${params.recipientId}/${Date.now()}`;
        return this.emitNotification({
            workspaceId: params.workspaceId,
            clubId: params.clubId,
            workspaceName: params.workspaceName,
            recipientId: params.recipientId,
            actorId: params.actorId,
            actorName: params.actorName,
            eventType: "mention",
            resourceType: params.resourceType,
            resourceId: params.resourceId,
            title: `Mentioned in ${params.resourceTitle}`,
            message: `${params.actorName} mentioned you: "${params.contentSnippet.slice(0, 120)}${params.contentSnippet.length > 120 ? "..." : ""}"`,
            destinationUrl: params.destinationUrl,
            emailType: "mention",
            idempotencyKey,
            emailContext: {
                resourceTitle: params.resourceTitle,
                notes: params.contentSnippet,
            },
        });
    }

    static async notifyChannelUpdate(params: {
        workspaceId: string;
        clubId: string;
        workspaceName: string;
        channelId: string;
        channelName: string;
        recipientIds: string[];
        actorId: string;
        actorName: string;
        updateType: "announcement" | "settings_changed" | "channel_archived";
        message: string;
    }): Promise<void> {
        const destinationUrl = `/club/${params.clubId}/workspace/channels/${params.channelId}`;
        for (const recipientId of params.recipientIds) {
            if (recipientId === params.actorId) continue;
            await this.emitNotification({
                workspaceId: params.workspaceId,
                clubId: params.clubId,
                workspaceName: params.workspaceName,
                recipientId,
                actorId: params.actorId,
                actorName: params.actorName,
                eventType: "channel_message",
                resourceType: "channel",
                resourceId: params.channelId,
                title: `#${params.channelName} Update`,
                message: params.message,
                destinationUrl,
            }).catch(() => {});
        }
    }
}
