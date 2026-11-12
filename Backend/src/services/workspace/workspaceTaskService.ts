// Backend/src/services/workspace/workspaceTaskService.ts
import { pool, query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { workspaceEventBus } from "./workspaceChannelService.js";
import { WorkspaceNotificationService } from "./workspaceNotificationService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import type {
    WorkspaceTask,
    WorkspaceTaskStatus,
    WorkspaceTaskPriority,
    WorkspaceTaskChecklistItem,
    WorkspaceTaskReferenceLink,
    WorkspaceTaskAssignment,
    WorkspaceTaskSubmission,
    WorkspaceTaskReview,
    WorkspaceTaskComment,
    WorkspaceTaskActivity,
    WorkspaceContext,
} from "../../types/workspaceTypes.js";

export const VALID_STATUS_TRANSITIONS: Record<WorkspaceTaskStatus, WorkspaceTaskStatus[]> = {
    draft: ["assigned", "in_progress", "cancelled"],
    assigned: ["in_progress", "blocked", "cancelled"],
    in_progress: ["blocked", "submitted", "cancelled"],
    blocked: ["in_progress", "assigned", "cancelled"],
    submitted: ["changes_requested", "approved", "cancelled"],
    changes_requested: ["in_progress", "submitted", "cancelled"],
    approved: ["completed", "cancelled"],
    completed: ["archived", "in_progress"],
    cancelled: ["archived", "draft", "assigned"],
    archived: ["draft", "assigned", "completed"],
};

export class WorkspaceTaskService {
    // =========================================================================
    // 1. ACCESS CONTROL & PRIVACY GUARDS
    // =========================================================================

    /**
     * Resolves caller's workspace context and throws if unauthorized.
     */
    private static async getAuthorizedContext(
        workspaceId: string,
        userId: string
    ): Promise<WorkspaceContext> {
        const context = await WorkspaceService.resolveContext(workspaceId, userId);
        if (!context) {
            throw new Error("Unauthorized: You do not have an active membership in this workspace.");
        }
        return context;
    }

    /**
     * Determines whether the caller can view a specific task (department privacy & restricted tasks).
     */
    static canViewTask(context: WorkspaceContext, task: WorkspaceTask): boolean {
        // Workspace Owner, Admin, or Workspace Manager can view all tasks
        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return true;
        }

        // Creator can always view their own task
        if (task.creatorId === context.member.userId) {
            return true;
        }

        // Active assignees can view the task
        const isAssignee = task.currentAssignees?.some(
            (a) => a.userId === context.member.userId && a.isActive
        );
        if (isAssignee) {
            return true;
        }

        // If task is not restricted and not in a restricted department, all workspace members can view
        if (!task.isRestricted) {
            return true;
        }

        // If restricted, must belong to the department or be department lead
        if (task.departmentId) {
            if (context.leadDepartmentIds.includes(task.departmentId)) {
                return true;
            }
            if (context.member.departmentId === task.departmentId) {
                return true;
            }
            const userDepts = (context.member as any).departments || [];
            if (userDepts.some((d: any) => d.id === task.departmentId)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Authority check for live realtime event delivery and socket authorization
     */
    static async canUserViewTask(workspaceId: string, taskId: string, userId: string): Promise<boolean> {
        try {
            const context = await WorkspaceService.resolveContext(workspaceId, userId);
            if (!context || (!context.member && !context.isOwner)) return false;
            if (context.isOwner || context.isAdmin || context.isWorkspaceManager) return true;

            const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);
            if (!task || task.workspaceId !== workspaceId) return false;

            return this.canViewTask(context, task);
        } catch {
            return false;
        }
    }

    /**
     * Determines whether the caller can modify/edit task details.
     */
    static canModifyTask(context: WorkspaceContext, task: WorkspaceTask): boolean {
        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return true;
        }
        if (context.permissions.includes("tasks:edit_all")) {
            return true;
        }
        if (task.departmentId && context.leadDepartmentIds.includes(task.departmentId)) {
            return true;
        }
        if (
            task.departmentId &&
            context.permissions.includes("tasks:edit_department") &&
            context.member.departmentId === task.departmentId
        ) {
            return true;
        }
        // Task creator can modify if task is still in draft or assigned
        if (task.creatorId === context.member.userId && (task.status === "draft" || task.status === "assigned")) {
            return true;
        }
        return false;
    }

    /**
     * Determines whether caller can assign or reassign members to a task.
     */
    static canAssignTask(context: WorkspaceContext, task: WorkspaceTask): boolean {
        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return true;
        }
        if (context.permissions.includes("tasks:assign") || context.permissions.includes("tasks:reassign")) {
            return true;
        }
        if (task.departmentId && context.leadDepartmentIds.includes(task.departmentId)) {
            return true;
        }
        return false;
    }

    /**
     * Determines whether caller can review submitted work.
     */
    static canReviewTask(context: WorkspaceContext, task: WorkspaceTask): boolean {
        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return true;
        }
        if (context.permissions.includes("tasks:review")) {
            return true;
        }
        if (task.departmentId && context.leadDepartmentIds.includes(task.departmentId)) {
            return true;
        }
        return false;
    }

    // =========================================================================
    // 2. TASK CREATION & RETRIEVAL
    // =========================================================================

    /**
     * Creates a task within the workspace.
     */
    static async createTask(
        workspaceId: string,
        actorUserId: string,
        data: {
            title: string;
            description?: string | null;
            departmentId?: string | null;
            priority?: WorkspaceTaskPriority;
            startDate?: string | null;
            dueDate?: string | null;
            assignedRoleId?: string | null;
            checklist?: WorkspaceTaskChecklistItem[];
            referenceLinks?: WorkspaceTaskReferenceLink[];
            isRestricted?: boolean;
            assigneeUserIds?: string[];
            fileIds?: string[];
        }
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);

        // Permission check
        const canCreate =
            context.isOwner ||
            context.isAdmin ||
            context.isWorkspaceManager ||
            context.permissions.includes("tasks:create") ||
            (data.departmentId && context.leadDepartmentIds.includes(data.departmentId));

        if (!canCreate) {
            throw new Error("Unauthorized: You lack permission to create tasks in this workspace.");
        }

        // Validate department if specified
        if (data.departmentId) {
            const dept = await WorkspaceRepository.findDepartmentById(workspaceId, data.departmentId);
            if (!dept || dept.status === "archived") {
                throw new Error("Specified department does not exist or has been archived.");
            }
        }

        // Validate assignees if specified
        if (data.assigneeUserIds && data.assigneeUserIds.length > 0) {
            for (const uid of data.assigneeUserIds) {
                const mem = await WorkspaceRepository.findMember(workspaceId, uid);
                if (!mem || mem.membershipStatus !== "active" || mem.isSuspended) {
                    throw new Error(`Assignee user ${uid} is not an active member in this workspace.`);
                }

                // If restricted department task, validate assignee department membership
                if (data.isRestricted && data.departmentId) {
                    const assigneeDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, mem.id);
                    const hasDept = mem.departmentId === data.departmentId || assigneeDepts.some((d) => d.id === data.departmentId);
                    if (!hasDept && !context.isAdmin) {
                        throw new Error(`Assignee ${mem.user?.username || uid} does not belong to the restricted department.`);
                    }
                }
            }
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const task = await WorkspaceRepository.createTask(client, {
                workspaceId,
                creatorId: actorUserId,
                departmentId: data.departmentId || null,
                title: data.title.trim(),
                description: data.description?.trim() || null,
                priority: data.priority || "medium",
                startDate: data.startDate || null,
                dueDate: data.dueDate || null,
                assignedRoleId: data.assignedRoleId || null,
                checklist: data.checklist || [],
                referenceLinks: data.referenceLinks || [],
                isRestricted: Boolean(data.isRestricted),
                assigneeUserIds: data.assigneeUserIds || [],
            });

            // Associate uploaded attachments if provided
            if (data.fileIds && data.fileIds.length > 0) {
                await client.query(
                    `UPDATE public.workspace_files
                     SET task_id = $1, parent_resource_type = 'task', parent_resource_id = $1
                     WHERE id = ANY($2::uuid[]) AND workspace_id = $3;`,
                    [task.id, data.fileIds, workspaceId]
                );
            }

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:created", { task });

            if (data.assigneeUserIds && data.assigneeUserIds.length > 0) {
                const workspace = await WorkspaceRepository.findById(workspaceId);
                const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
                const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "A lead";
                for (const assigneeId of data.assigneeUserIds) {
                    if (assigneeId !== actorUserId) {
                        WorkspaceNotificationService.notifyTaskAssigned({
                            workspaceId,
                            clubId: workspace?.clubId || "",
                            workspaceName: workspace?.name || "Workspace",
                            taskId: task.id,
                            taskTitle: task.title,
                            taskVersion: task.version,
                            assigneeId,
                            actorId: actorUserId,
                            actorName,
                            priority: task.priority,
                            dueDate: task.dueDate,
                        }).catch((err) => console.warn("[TaskService] Notify assign failed:", err.message));
                    }
                }
            }

            return task;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Retrieves a single task with privacy verification.
     */
    static async getTask(
        workspaceId: string,
        actorUserId: string,
        taskId: string
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canViewTask(context, task)) {
            throw new Error("Unauthorized: You do not have permission to view this restricted task.");
        }

        // Check if caller is watching
        task.isWatching = task.watchers?.some((w) => w.userId === actorUserId) || false;

        return task;
    }

    /**
     * Lists tasks with search, filtering, and strict department-level isolation.
     */
    static async listTasks(
        workspaceId: string,
        actorUserId: string,
        filters: {
            departmentId?: string;
            status?: WorkspaceTaskStatus | WorkspaceTaskStatus[];
            priority?: WorkspaceTaskPriority;
            assigneeUserId?: string;
            assignedByUserId?: string;
            creatorId?: string;
            search?: string;
            isArchived?: boolean;
            sortBy?: "created_at" | "due_date" | "priority" | "display_order" | "title";
            sortDir?: "asc" | "desc";
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ tasks: WorkspaceTask[]; total: number }> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);

        const isUnrestrictedManager =
            context.isOwner || context.isAdmin || context.isWorkspaceManager;

        // Get allowed departments for this caller
        let allowedDeptIds: string[] = [];
        if (!isUnrestrictedManager) {
            const myDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, context.member.id);
            allowedDeptIds = myDepts.map((d) => d.id);
            if (context.member.departmentId && !allowedDeptIds.includes(context.member.departmentId)) {
                allowedDeptIds.push(context.member.departmentId);
            }
        }

        return WorkspaceRepository.listTasks(workspaceId, {
            ...filters,
            isRestrictedIsolation: !isUnrestrictedManager,
            allowedDepartmentIds: allowedDeptIds,
            actorUserId,
        });
    }

    /**
     * Retrieves categorized tasks for "My Tasks" view tabs.
     */
    static async getMyTasks(
        workspaceId: string,
        actorUserId: string,
        tab: "assigned_to_me" | "created_by_me" | "assigned_by_me" | "department_tasks" | "due_soon" | "overdue" | "completed" | "awaiting_review" | "archived"
    ): Promise<WorkspaceTask[]> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        if (context.isClubAccount) {
            throw new Error("Unauthorized: My Tasks is reserved for personal workspace member accounts.");
        }

        const myDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, context.member.id);
        const allowedDeptIds = Array.from(new Set([
            ...myDepts.map((d) => d.id),
            ...context.leadDepartmentIds,
            ...(context.member.departmentId ? [context.member.departmentId] : []),
        ]));

        const isReviewer =
            context.isOwner ||
            context.isAdmin ||
            context.isWorkspaceManager ||
            context.permissions.includes("tasks:review");

        return WorkspaceRepository.getMyTasks(workspaceId, actorUserId, tab, {
            allowedDepartmentIds: allowedDeptIds,
            isReviewer,
        });
    }

    /**
     * Retrieves aggregated workload and accountability views:
     * tasks awaiting review, unassigned tasks, tasks nearing deadlines, overdue tasks,
     * blocked tasks, department workloads, and member workload distributions.
     */
    static async getAccountabilityOverview(workspaceId: string, actorUserId: string) {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const isGlobalManager =
            context.isOwner || context.isAdmin || context.isWorkspaceManager || context.permissions.includes("tasks:manage_all");

        const myDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, context.member.id);
        const allowedDeptIds = Array.from(new Set([
            ...myDepts.map((d) => d.id),
            ...context.leadDepartmentIds,
            ...(context.member.departmentId ? [context.member.departmentId] : []),
        ]));

        const scopeKey = isGlobalManager ? "global" : `user:${actorUserId}`;
        const cacheKey = WorkspaceRedisService.buildKey("taskcounts", workspaceId, scopeKey);

        return await WorkspaceRedisService.getOrComputeWithStampedeProtection(
            cacheKey,
            async () => {
                return await WorkspaceRepository.getTaskAccountability(workspaceId, allowedDeptIds, isGlobalManager);
            },
            180
        );
    }

    /**
     * Retrieves detailed chronological reassignment history for a task.
     */
    static async getReassignmentHistory(workspaceId: string, actorUserId: string, taskId: string) {
        // Assert caller can view this task
        await this.getTask(workspaceId, actorUserId, taskId);
        return WorkspaceRepository.getTaskReassignments(workspaceId, taskId);
    }

    // =========================================================================
    // 3. TASK UPDATES & OPTIMISTIC CONCURRENCY
    // =========================================================================

    /**
     * Updates task information with optimistic locking verification.
     */
    static async updateTask(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        updates: {
            title?: string;
            description?: string | null;
            departmentId?: string | null;
            priority?: WorkspaceTaskPriority;
            startDate?: string | null;
            dueDate?: string | null;
            assignedRoleId?: string | null;
            checklist?: WorkspaceTaskChecklistItem[];
            referenceLinks?: WorkspaceTaskReferenceLink[];
            isRestricted?: boolean;
            displayOrder?: number;
        },
        expectedVersion?: number
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canModifyTask(context, task)) {
            throw new Error("Unauthorized: You lack permission to edit this task.");
        }

        // Validate department change
        if (updates.departmentId !== undefined && updates.departmentId !== null) {
            const dept = await WorkspaceRepository.findDepartmentById(workspaceId, updates.departmentId);
            if (!dept || dept.status === "archived") {
                throw new Error("Specified department does not exist or has been archived.");
            }
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const updated = await WorkspaceRepository.updateTask(
                client,
                workspaceId,
                taskId,
                updates,
                expectedVersion
            );

            // Log activity
            await client.query(
                `INSERT INTO public.workspace_task_activity (
                    workspace_id,
                    task_id,
                    actor_id,
                    action,
                    details
                ) VALUES ($1, $2, $3, 'updated', $4::jsonb);`,
                [
                    workspaceId,
                    taskId,
                    actorUserId,
                    JSON.stringify({
                        updatedFields: Object.keys(updates),
                    }),
                ]
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:updated", { task: updated });
            return updated;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 4. SERVER-SIDE STATUS TRANSITION ENGINE
    // =========================================================================

    /**
     * Enforces the explicit server-side state machine for status changes.
     */
    static async transitionTaskStatus(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        targetStatus: WorkspaceTaskStatus,
        expectedVersion?: number,
        reason?: string
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        const currentStatus = task.status;

        // No-op if status is unchanged
        if (currentStatus === targetStatus) {
            return task;
        }

        // 1. Verify valid state machine transition
        const allowedNext = VALID_STATUS_TRANSITIONS[currentStatus] || [];
        if (!allowedNext.includes(targetStatus)) {
            throw new Error(
                `Invalid status transition: Cannot transition task from '${currentStatus}' to '${targetStatus}'. Allowed transitions: ${allowedNext.join(", ")}.`
            );
        }

        // 2. Self-Review Protection
        // "A user cannot approve their own submission by default."
        if (targetStatus === "approved") {
            const isSubmitter = task.latestSubmission?.submittedBy === actorUserId;

            if (isSubmitter && !context.isOwner) {
                throw new Error(
                    "Self-review policy violation: You cannot approve your own submission. An authorized reviewer or department lead must review this deliverable."
                );
            }
        }

        // 3. Status Transition Authorization Checks
        if (targetStatus === "submitted") {
            // Must be an active assignee or have edit permissions
            const isAssignee = task.currentAssignees?.some((a) => a.userId === actorUserId);
            if (!isAssignee && !this.canModifyTask(context, task)) {
                throw new Error("Unauthorized: Only assigned members or managers can submit deliverables for this task.");
            }
        } else if (targetStatus === "approved" || targetStatus === "changes_requested") {
            if (!this.canReviewTask(context, task)) {
                throw new Error("Unauthorized: You lack permission to review deliverables for this task.");
            }
        } else if (targetStatus === "completed") {
            if (!this.canReviewTask(context, task) && !this.canModifyTask(context, task)) {
                throw new Error("Unauthorized: You lack permission to mark this task as completed.");
            }
        } else if (targetStatus === "archived") {
            if (!context.isOwner && !context.isAdmin && !context.isWorkspaceManager && !context.permissions.includes("tasks:delete")) {
                throw new Error("Unauthorized: You lack permission to archive tasks.");
            }
        } else if (targetStatus === "cancelled") {
            if (!this.canModifyTask(context, task)) {
                throw new Error("Unauthorized: You lack permission to cancel this task.");
            }
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const updated = await WorkspaceRepository.updateTask(
                client,
                workspaceId,
                taskId,
                { status: targetStatus },
                expectedVersion
            );

            // Log state transition
            await client.query(
                `INSERT INTO public.workspace_task_activity (
                    workspace_id,
                    task_id,
                    actor_id,
                    action,
                    details
                ) VALUES ($1, $2, $3, 'status_changed', $4::jsonb);`,
                [
                    workspaceId,
                    taskId,
                    actorUserId,
                    JSON.stringify({
                        fromStatus: currentStatus,
                        toStatus: targetStatus,
                        reason: reason || null,
                    }),
                ]
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:status_changed", {
                taskId,
                fromStatus: currentStatus,
                toStatus: targetStatus,
                actorId: actorUserId,
            });

            return updated;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 5. TASK ASSIGNMENT & REASSIGNMENT
    // =========================================================================

    /**
     * Reassigns members to a task with multi-assignee tracking and history log.
     */
    static async setTaskAssignees(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        assigneeUserIds: string[]
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canAssignTask(context, task)) {
            throw new Error("Unauthorized: You lack permission to assign or reassign members to this task.");
        }

        // Validate each assignee exists and belongs to workspace
        for (const uid of assigneeUserIds) {
            const mem = await WorkspaceRepository.findMember(workspaceId, uid);
            if (!mem || mem.membershipStatus !== "active" || mem.isSuspended) {
                throw new Error(`User ${uid} is not an active workspace member.`);
            }

            // Department assignment rule: If task is restricted to a department, verify assignee belongs to that department
            if (task.isRestricted && task.departmentId) {
                const assigneeDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, mem.id);
                const hasDept = mem.departmentId === task.departmentId || assigneeDepts.some((d) => d.id === task.departmentId);
                if (!hasDept && !context.isAdmin) {
                    throw new Error(`Assignee ${mem.user?.username || uid} does not belong to the restricted department.`);
                }
            }
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const updated = await WorkspaceRepository.setTaskAssignees(
                client,
                workspaceId,
                taskId,
                assigneeUserIds,
                actorUserId
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:assigned", {
                taskId,
                assigneeUserIds,
                actorId: actorUserId,
            });

            const workspace = await WorkspaceRepository.findById(workspaceId);
            const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
            const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "A lead";
            for (const assigneeId of assigneeUserIds) {
                if (assigneeId !== actorUserId) {
                    WorkspaceNotificationService.notifyTaskReassigned({
                        workspaceId,
                        clubId: workspace?.clubId || "",
                        workspaceName: workspace?.name || "Workspace",
                        taskId: updated.id,
                        taskTitle: updated.title,
                        taskVersion: updated.version,
                        assigneeId,
                        actorId: actorUserId,
                        actorName,
                    }).catch((err) => console.warn("[TaskService] Notify reassign failed:", err.message));
                }
            }

            return updated;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 6. DELIVERABLE SUBMISSION & REVIEW WORKFLOW
    // =========================================================================

    /**
     * Submits deliverable work for a task and transitions status to 'submitted'.
     */
    static async submitTask(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        content: string,
        attachments: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }> = [],
        expectedVersion?: number,
        fileIds?: string[]
    ): Promise<{ task: WorkspaceTask; submission: WorkspaceTaskSubmission }> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        // Only assignees or authorized editors can submit
        const isAssignee = task.currentAssignees?.some((a) => a.userId === actorUserId);
        if (!isAssignee && !this.canModifyTask(context, task)) {
            throw new Error("Unauthorized: Only assigned members or managers can submit work deliverables.");
        }

        // Status must be either in_progress or changes_requested or assigned
        if (task.status !== "in_progress" && task.status !== "changes_requested" && task.status !== "assigned") {
            throw new Error(`Cannot submit work for a task in '${task.status}' status. Task must be in progress.`);
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const submission = await WorkspaceRepository.createTaskSubmission(client, {
                workspaceId,
                taskId,
                submittedBy: actorUserId,
                content: content.trim(),
                attachments,
            });

            // Link any uploaded files to this submission
            if (fileIds && fileIds.length > 0) {
                await client.query(
                    `UPDATE public.workspace_files
                     SET submission_id = $1, task_id = $2, parent_resource_type = 'task_submission', parent_resource_id = $1
                     WHERE id = ANY($3::uuid[]) AND workspace_id = $4;`,
                    [submission.id, taskId, fileIds, workspaceId]
                );
            }

            // Transition status to 'submitted'
            const updatedTask = await WorkspaceRepository.updateTask(
                client,
                workspaceId,
                taskId,
                { status: "submitted" },
                expectedVersion
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:submitted", {
                taskId,
                submissionId: submission.id,
                submittedBy: actorUserId,
            });

            const workspace = await WorkspaceRepository.findById(workspaceId);
            const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
            const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "Assignee";
            const reviewers: string[] = [];
            if (task.creatorId && task.creatorId !== actorUserId) {
                reviewers.push(task.creatorId);
            }
            if (reviewers.length > 0) {
                WorkspaceNotificationService.notifyTaskSubmitted({
                    workspaceId,
                    clubId: workspace?.clubId || "",
                    workspaceName: workspace?.name || "Workspace",
                    taskId,
                    taskTitle: task.title,
                    reviewerIds: reviewers,
                    actorId: actorUserId,
                    actorName,
                }).catch((err) => console.warn("[TaskService] Notify submit failed:", err.message));
            }

            return { task: updatedTask, submission };
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Reviews submitted work: approves or requests changes.
     */
    static async reviewTask(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        submissionId: string,
        decision: "approved" | "changes_requested",
        comments: string,
        expectedVersion?: number
    ): Promise<{ task: WorkspaceTask; review: WorkspaceTaskReview }> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        // Self-Review Protection: Check if caller is submitter
        if (decision === "approved") {
            const targetSub = task.submissions?.find((s) => s.id === submissionId) || task.latestSubmission;
            const isSubmitter = targetSub?.submittedBy === actorUserId;

            if (isSubmitter && !context.isOwner) {
                throw new Error(
                    "Self-review policy violation: You cannot approve your own submission. An authorized reviewer or department lead must review this deliverable."
                );
            }
        }

        if (!this.canReviewTask(context, task)) {
            throw new Error("Unauthorized: You lack permission to review deliverables for this task.");
        }

        const nextStatus: WorkspaceTaskStatus = decision === "approved" ? "approved" : "changes_requested";

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const review = await WorkspaceRepository.createTaskReview(client, {
                workspaceId,
                taskId,
                submissionId,
                reviewerId: actorUserId,
                decision,
                comments: comments.trim(),
            });

            // Update task status according to decision
            const updatedTask = await WorkspaceRepository.updateTask(
                client,
                workspaceId,
                taskId,
                { status: nextStatus },
                expectedVersion
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:reviewed", {
                taskId,
                reviewId: review.id,
                decision,
                reviewerId: actorUserId,
            });

            const workspace = await WorkspaceRepository.findById(workspaceId);
            const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
            const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "Reviewer";
            const assigneeIds = (task.currentAssignees || []).map((a) => a.userId).filter((id) => id !== actorUserId);

            if (decision === "approved") {
                WorkspaceNotificationService.notifyTaskApproved({
                    workspaceId,
                    clubId: workspace?.clubId || "",
                    workspaceName: workspace?.name || "Workspace",
                    taskId,
                    taskTitle: task.title,
                    assigneeIds,
                    actorId: actorUserId,
                    actorName,
                    notes: comments,
                }).catch((err) => console.warn("[TaskService] Notify approve failed:", err.message));
            } else {
                WorkspaceNotificationService.notifyChangesRequested({
                    workspaceId,
                    clubId: workspace?.clubId || "",
                    workspaceName: workspace?.name || "Workspace",
                    taskId,
                    taskTitle: task.title,
                    assigneeIds,
                    actorId: actorUserId,
                    actorName,
                    notes: comments,
                }).catch((err) => console.warn("[TaskService] Notify changes failed:", err.message));
            }

            return { task: updatedTask, review };
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 7. TASK DISCUSSION & COLLABORATION
    // =========================================================================

    /**
     * Adds a comment or threaded reply to a task discussion.
     */
    static async addComment(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        content: string,
        parentCommentId?: string | null,
        mentions: string[] = [],
        attachments: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }> = []
    ): Promise<WorkspaceTaskComment> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canViewTask(context, task)) {
            throw new Error("Unauthorized: You cannot comment on this task.");
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const comment = await WorkspaceRepository.createTaskComment(client, {
                workspaceId,
                taskId,
                authorId: actorUserId,
                content: content.trim(),
                parentCommentId: parentCommentId || null,
                mentions,
                attachments,
            });

            // Log activity
            await client.query(
                `INSERT INTO public.workspace_task_activity (
                    workspace_id,
                    task_id,
                    actor_id,
                    action,
                    details
                ) VALUES ($1, $2, $3, 'comment_added', $4::jsonb);`,
                [
                    workspaceId,
                    taskId,
                    actorUserId,
                    JSON.stringify({
                        commentId: comment.id,
                        hasAttachments: attachments.length > 0,
                    }),
                ]
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:comment_added", {
                taskId,
                commentId: comment.id,
                authorId: actorUserId,
            });

            const workspace = await WorkspaceRepository.findById(workspaceId);
            const commenter = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
            const commenterName = commenter?.user ? `${commenter.user.firstName || ""} ${commenter.user.lastName || commenter.user.username}`.trim() : "A team member";

            const recipientIds = new Set<string>();
            task.currentAssignees?.forEach((a) => {
                if (a.userId !== actorUserId) recipientIds.add(a.userId);
            });
            task.watchers?.forEach((w) => {
                if (w.userId !== actorUserId) recipientIds.add(w.userId);
            });
            if (task.creatorId && task.creatorId !== actorUserId) {
                recipientIds.add(task.creatorId);
            }
            mentions.forEach((m) => {
                if (m !== actorUserId) recipientIds.add(m);
            });

            if (recipientIds.size > 0) {
                WorkspaceNotificationService.notifyTaskComment({
                    workspaceId,
                    clubId: workspace?.clubId || "",
                    workspaceName: workspace?.name || "Workspace",
                    taskId,
                    taskTitle: task.title,
                    commenterId: actorUserId,
                    commenterName,
                    content,
                    recipientIds: Array.from(recipientIds),
                }).catch((err) => console.warn("[TaskService] Notify comment failed:", err.message));
            }

            return comment;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Gets threaded comments for a task.
     */
    static async getComments(
        workspaceId: string,
        actorUserId: string,
        taskId: string
    ): Promise<WorkspaceTaskComment[]> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canViewTask(context, task)) {
            throw new Error("Unauthorized: You cannot view comments for this task.");
        }

        return WorkspaceRepository.getTaskComments(workspaceId, taskId);
    }

    /**
     * Toggles watcher subscription.
     */
    static async toggleWatcher(
        workspaceId: string,
        actorUserId: string,
        taskId: string
    ): Promise<{ isWatching: boolean }> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canViewTask(context, task)) {
            throw new Error("Unauthorized: You cannot watch this task.");
        }

        return WorkspaceRepository.toggleTaskWatcher(workspaceId, taskId, actorUserId);
    }

    /**
     * Gets chronological activity history for a task.
     */
    static async getActivity(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        limit = 50
    ): Promise<WorkspaceTaskActivity[]> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!this.canViewTask(context, task)) {
            throw new Error("Unauthorized: You cannot view activity for this task.");
        }

        return WorkspaceRepository.getTaskActivity(workspaceId, taskId, limit);
    }

    /**
     * Updates checklist items with optimistic concurrency locking.
     */
    static async updateChecklist(
        workspaceId: string,
        actorUserId: string,
        taskId: string,
        checklist: WorkspaceTaskChecklistItem[],
        expectedVersion?: number
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        // Assignees, creators, or authorized editors can update checklist
        const isAssignee = task.currentAssignees?.some((a) => a.userId === actorUserId);
        if (!isAssignee && !this.canModifyTask(context, task)) {
            throw new Error("Unauthorized: You lack permission to update this task's checklist.");
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const updated = await WorkspaceRepository.updateTask(
                client,
                workspaceId,
                taskId,
                { checklist },
                expectedVersion
            );

            // Log activity
            await client.query(
                `INSERT INTO public.workspace_task_activity (
                    workspace_id,
                    task_id,
                    actor_id,
                    action,
                    details
                ) VALUES ($1, $2, $3, 'checklist_updated', $4::jsonb);`,
                [
                    workspaceId,
                    taskId,
                    actorUserId,
                    JSON.stringify({
                        completedItems: checklist.filter((c) => c.isCompleted).length,
                        totalItems: checklist.length,
                    }),
                ]
            );

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:updated", { task: updated });
            return updated;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Soft-deletes / archives a task.
     */
    static async archiveTask(
        workspaceId: string,
        actorUserId: string,
        taskId: string
    ): Promise<WorkspaceTask> {
        const context = await this.getAuthorizedContext(workspaceId, actorUserId);
        const task = await WorkspaceRepository.findTaskById(workspaceId, taskId);

        if (!task) {
            throw new Error("Task not found.");
        }

        if (!context.isOwner && !context.isAdmin && !context.isWorkspaceManager && !context.permissions.includes("tasks:delete")) {
            throw new Error("Unauthorized: You lack permission to archive tasks.");
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            const archived = await WorkspaceRepository.archiveTask(client, workspaceId, taskId, actorUserId);

            await client.query("COMMIT;");

            this.broadcastEvent(workspaceId, "task:archived", { taskId });
            return archived;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // Broadcast helper
    private static broadcastEvent(workspaceId: string, event: string, payload: any) {
        workspaceEventBus.emit(`workspace:${workspaceId}`, {
            event,
            payload,
            timestamp: new Date().toISOString(),
        });
        // Asynchronously invalidate task accountability & dashboard metrics cache
        WorkspaceRedisService.invalidateOnTaskChange(workspaceId, payload?.taskId || payload?.task?.id).catch(() => {});
    }
}
