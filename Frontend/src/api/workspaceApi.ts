// Frontend/src/api/workspaceApi.ts
import { apiClient } from "./apiClient";
import type {
    WorkspaceApiResponse,
    WorkspaceMembersApiResponse,
    WorkspaceRole,
    WorkspaceDepartment,
    WorkspaceDepartmentMember,
    WorkspaceInvitation,
    WorkspaceChannelCategory,
    WorkspaceChannel,
    WorkspaceMessage,
    WorkspaceThread,
    WorkspaceChannelOverride,
    WorkspaceTask,
    WorkspaceTaskStatus,
    WorkspaceTaskPriority,
    WorkspaceTaskChecklistItem,
    WorkspaceTaskReferenceLink,
    WorkspaceTaskSubmission,
    WorkspaceTaskReview,
    WorkspaceTaskComment,
    WorkspaceTaskActivity,
    WorkspaceFile,
    CreateUploadIntentRequest,
    UploadIntentResponse,
    RegisterUploadRequest,
    FileDeliveryUrlResponse,
    WorkspaceStorageQuotaInfo,
    WorkspaceFileListFilters,
    WorkspaceNotification,
    WorkspaceNotificationPreferences,
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    WorkspaceActivityEvent,
    WorkspaceAuditLogEntry,
    WorkspaceSearchResponse,
    WorkspaceTemplateDefinition,
    MemberCapabilityResolution,
    UserClubWorkspaceSummary,
    WorkspaceSettingsData,
    WorkspacePermissionPreviewResult,
    WorkspaceRecognitionPolicy,
    WorkspaceRecognitionCategory,
    WorkspaceRecognitionBudget,
    WorkspaceRecognitionLedgerEntry,
    AwardOrbitsDTO,
    ReverseAwardDTO,
    MemberRecognitionSummary,
    DepartmentRecognitionSummary,
    MemberRecognitionProfile,
    LeaderboardPeriod,
    ThreeLeaderboardsResponse,
    WorkspaceAnalyticsSummary,
    IndividualMemberAnalytics,
} from "../types/workspace";

export const workspaceApi = {
    /**
     * Idempotently retrieves or provisions the Team Workspace for a club
     */
    getWorkspace: (clubId?: string) =>
        apiClient.get<WorkspaceApiResponse>("/club/workspace", {
            params: clubId ? { clubId } : undefined,
        }),

    /**
     * Lists workspace members with optional filters
     */
    getMembers: (params: {
        clubId?: string;
        status?: string;
        departmentId?: string;
        roleId?: string;
        search?: string;
        limit?: number;
        offset?: number;
    } = {}) =>
        apiClient.get<WorkspaceMembersApiResponse>("/club/workspace/members", {
            params,
        }),

    /**
     * Fetches all available workspace roles
     */
    getRoles: (clubId?: string) =>
        apiClient.get<{ success: boolean; roles: WorkspaceRole[] }>(
            "/club/workspace/roles",
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Promotes or demotes a member (assigns new role)
     */
    assignMemberRole: (
        targetUserId: string,
        roleId: string,
        roleTitle?: string,
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; message: string; member: any }>(
            `/club/workspace/members/${targetUserId}/role`,
            { roleId, roleTitle, clubId }
        ),

    /**
     * Updates suspension state of a member
     */
    setMemberSuspension: (
        targetUserId: string,
        suspend: boolean,
        reason?: string,
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; message: string; member: any }>(
            `/club/workspace/members/${targetUserId}/suspension`,
            { suspend, reason, clubId }
        ),

    removeMember: (targetUserId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/members/${targetUserId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // DEPARTMENTS
    // =========================================================================

    getDepartments: (clubId?: string, includeArchived = false) =>
        apiClient.get<{ success: boolean; departments: WorkspaceDepartment[] }>(
            "/club/workspace/departments",
            { params: { clubId, includeArchived } }
        ),

    seedDefaultDepartments: (clubId?: string) =>
        apiClient.post<{ success: boolean; departments: WorkspaceDepartment[]; message: string }>(
            "/club/workspace/departments/seed-defaults",
            { clubId }
        ),

    createDepartment: (
        data: {
            name: string;
            description?: string;
            icon?: string;
            color?: string;
            leadUserId?: string;
            coLeadUserIds?: string[];
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; department: WorkspaceDepartment; message: string }>(
            "/club/workspace/departments",
            { ...data, clubId }
        ),

    getDepartmentDetails: (departmentId: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            department: WorkspaceDepartment;
            members: WorkspaceDepartmentMember[];
        }>(`/club/workspace/departments/${departmentId}`, {
            params: clubId ? { clubId } : undefined,
        }),

    updateDepartment: (
        departmentId: string,
        data: Partial<WorkspaceDepartment>,
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; department: WorkspaceDepartment; message: string }>(
            `/club/workspace/departments/${departmentId}`,
            { ...data, clubId }
        ),

    archiveDepartment: (departmentId: string, clubId?: string) =>
        apiClient.post<{ success: boolean; department: WorkspaceDepartment; message: string }>(
            `/club/workspace/departments/${departmentId}/archive`,
            { clubId }
        ),

    restoreDepartment: (departmentId: string, clubId?: string) =>
        apiClient.post<{ success: boolean; department: WorkspaceDepartment; message: string }>(
            `/club/workspace/departments/${departmentId}/restore`,
            { clubId }
        ),

    addDepartmentMember: (
        departmentId: string,
        data: { memberId: string; role?: "lead" | "co_lead" | "member"; roleTitle?: string },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; deptMember: WorkspaceDepartmentMember; message: string }>(
            `/club/workspace/departments/${departmentId}/members`,
            { ...data, clubId }
        ),

    removeDepartmentMember: (departmentId: string, memberId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/departments/${departmentId}/members/${memberId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    transferDepartmentMember: (
        data: { memberId: string; fromDeptId: string; toDeptId: string },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; message: string }>(
            "/club/workspace/departments/transfer",
            { ...data, clubId }
        ),

    reorderDepartments: (departmentIds: string[], clubId?: string) =>
        apiClient.put<{ success: boolean; message: string }>(
            "/club/workspace/departments/reorder",
            { departmentIds, clubId }
        ),

    updateDepartmentMemberRole: (
        departmentId: string,
        memberId: string,
        data: { departmentRole?: "lead" | "co_lead" | "member"; roleTitle?: string },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; message: string }>(
            `/club/workspace/departments/${departmentId}/members/${memberId}/role`,
            { ...data, clubId }
        ),

    // =========================================================================
    // WORKSPACE MANAGER
    // =========================================================================

    appointManager: (
        dataOrUserId: string | { managerUserId: string; permissions?: Record<string, any> | string[]; clubId?: string },
        permissions: Record<string, any> | string[] = {},
        clubId?: string
    ) => {
        const body =
            typeof dataOrUserId === "object"
                ? dataOrUserId
                : { managerUserId: dataOrUserId, permissions, clubId };
        return apiClient.post<{ success: boolean; workspace: any; message: string }>(
            "/club/workspace/manager",
            body
        );
    },

    revokeManager: (clubId?: string) =>
        apiClient.delete<{ success: boolean; workspace: any; message: string }>(
            "/club/workspace/manager",
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // INVITATIONS
    // =========================================================================

    createInvitation: (
        data: { email: string; roleId: string; departmentId?: string; invitationMessage?: string },
        clubId?: string
    ) =>
        apiClient.post<{
            success: boolean;
            invitation: WorkspaceInvitation;
            token: string;
            inviteLink: string;
            message: string;
        }>("/club/workspace/invitations", { ...data, clubId }),

    getInvitations: (
        statusOrParams?: string | { status?: string; clubId?: string },
        clubId?: string
    ) => {
        let params: { status?: string; clubId?: string } = {};
        if (typeof statusOrParams === "string") {
            params = { status: statusOrParams, clubId };
        } else if (statusOrParams) {
            params = statusOrParams;
        } else if (clubId) {
            params = { clubId };
        }
        return apiClient.get<{ success: boolean; invitations: WorkspaceInvitation[] }>(
            "/club/workspace/invitations",
            { params }
        );
    },

    revokeInvitation: (invitationId: string, clubId?: string) =>
        apiClient.post<{ success: boolean; message: string }>(
            `/club/workspace/invitations/${invitationId}/revoke`,
            { clubId }
        ),

    verifyInvitation: (token: string) =>
        apiClient.get<{
            success: boolean;
            isValid: boolean;
            reason?: string;
            invitation?: {
                id: string;
                email?: string;
                workspaceId?: string;
                workspaceName?: string;
                workspaceSlug?: string;
                clubId?: string;
                clubName: string | null;
                clubSlug?: string | null;
                clubLogoUrl?: string | null;
                collegeName?: string | null;
                roleName: string;
                roleRank?: number;
                departmentName?: string | null;
                inviterName: string;
                invitationMessage?: string | null;
                expiresAt: string | Date;
                invitationType?: "workspace" | "club_team";
            };
        }>("/club/workspace/invitations/verify", { params: { token } }),

    getMyPendingInvitations: () =>
        apiClient.get<{
            success: boolean;
            invitations: Array<{
                id: string;
                type: "workspace" | "club_team";
                token?: string | null;
                clubId?: string;
                clubName: string;
                clubSlug?: string;
                clubLogoUrl?: string | null;
                collegeName?: string | null;
                roleName: string;
                departmentName?: string | null;
                inviterName: string;
                invitationMessage?: string | null;
                expiresAt: string;
                createdAt: string;
            }>;
        }>("/club/workspace/invitations/my-pending"),

    acceptInvitation: (payload: string | { token?: string; invitationId?: string; type?: string }) => {
        const body = typeof payload === "string" ? { token: payload } : payload;
        return apiClient.post<{
            success: boolean;
            workspace: any;
            member: any;
            clubId?: string;
            clubName?: string;
            message: string;
        }>("/club/workspace/invitations/accept", body);
    },

    // =========================================================================
    // CHANNEL CATEGORIES (PHASE 04)
    // =========================================================================

    getCategories: (clubId?: string) =>
        apiClient.get<{ success: boolean; categories: WorkspaceChannelCategory[] }>(
            "/club/workspace/categories",
            { params: clubId ? { clubId } : undefined }
        ),

    createCategory: (
        data: {
            name: string;
            departmentId?: string | null;
            isPrivate?: boolean;
            position?: number;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; category: WorkspaceChannelCategory }>(
            "/club/workspace/categories",
            { ...data, clubId }
        ),

    updateCategory: (
        categoryId: string,
        data: Partial<WorkspaceChannelCategory>,
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; category: WorkspaceChannelCategory }>(
            `/club/workspace/categories/${categoryId}`,
            { ...data, clubId }
        ),

    deleteCategory: (categoryId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/categories/${categoryId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    reorderCategories: (categoryIds: string[], clubId?: string) =>
        apiClient.put<{ success: boolean; message: string }>(
            "/club/workspace/categories/reorder",
            { categoryIds, clubId }
        ),

    setCategoryOverride: (
        categoryId: string,
        data: {
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; override: WorkspaceChannelOverride }>(
            `/club/workspace/categories/${categoryId}/overrides`,
            { ...data, clubId }
        ),

    // =========================================================================
    // CHANNELS (PHASE 04)
    // =========================================================================

    createChannel: (
        data: {
            name: string;
            categoryId?: string | null;
            departmentId?: string | null;
            channelType?: string;
            topic?: string;
            isPrivate?: boolean;
            isCategorySynced?: boolean;
            position?: number;
            defaultSlowmodeSeconds?: number;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; channel: WorkspaceChannel }>(
            "/club/workspace/channels",
            { ...data, clubId }
        ),

    getChannelDetails: (channelId: string, clubId?: string) =>
        apiClient.get<{ success: boolean; channel: WorkspaceChannel }>(
            `/club/workspace/channels/${channelId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    updateChannel: (
        channelId: string,
        data: Partial<WorkspaceChannel> & { syncWithNewCategory?: boolean },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; channel: WorkspaceChannel }>(
            `/club/workspace/channels/${channelId}`,
            { ...data, clubId }
        ),

    deleteChannel: (channelId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/channels/${channelId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    reorderChannels: (channelIds: string[], clubId?: string) =>
        apiClient.put<{ success: boolean; message: string }>(
            "/club/workspace/channels/reorder",
            { channelIds, clubId }
        ),

    syncChannelWithCategory: (channelId: string, clubId?: string) =>
        apiClient.post<{ success: boolean; message: string }>(
            `/club/workspace/channels/${channelId}/sync`,
            { clubId }
        ),

    setChannelOverride: (
        channelId: string,
        data: {
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; override: WorkspaceChannelOverride }>(
            `/club/workspace/channels/${channelId}/overrides`,
            { ...data, clubId }
        ),

    deleteChannelOverride: (channelId: string, overrideId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/channels/${channelId}/overrides/${overrideId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // MESSAGING & REACTIONS (PHASE 04)
    // =========================================================================

    getMessages: (
        channelId: string,
        params: {
            before?: string;
            after?: string;
            limit?: number;
            threadId?: string | null;
            clubId?: string;
        } = {}
    ) =>
        apiClient.get<{ success: boolean; messages: WorkspaceMessage[] }>(
            `/club/workspace/channels/${channelId}/messages`,
            { params }
        ),

    sendMessage: (
        channelId: string,
        data: {
            content: string;
            messageType?: "text" | "announcement" | "system";
            parentMessageId?: string | null;
            threadId?: string | null;
            attachments?: Array<{
                fileName: string;
                fileSizeBytes: number;
                mimeType: string;
                cloudinaryUrl: string;
                cloudinarySecureUrl: string;
                cloudinaryPublicId: string;
            }>;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; message: WorkspaceMessage }>(
            `/club/workspace/channels/${channelId}/messages`,
            { ...data, clubId }
        ),

    editMessage: (
        channelId: string,
        messageId: string,
        content: string,
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; message: WorkspaceMessage }>(
            `/club/workspace/channels/${channelId}/messages/${messageId}`,
            { content, clubId }
        ),

    deleteMessage: (
        channelId: string,
        messageId: string,
        clubId?: string
    ) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/channels/${channelId}/messages/${messageId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    togglePinMessage: (
        channelId: string,
        messageId: string,
        isPinned = true,
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; isPinned: boolean }>(
            `/club/workspace/channels/${channelId}/messages/${messageId}/pin`,
            { isPinned, clubId }
        ),

    toggleReaction: (
        channelId: string,
        messageId: string,
        emoji: string,
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; added: boolean }>(
            `/club/workspace/channels/${channelId}/messages/${messageId}/reactions`,
            { emoji, clubId }
        ),

    searchMessages: (
        query: string,
        clubId?: string,
        limit = 30
    ) =>
        apiClient.get<{ success: boolean; messages: WorkspaceMessage[] }>(
            "/club/workspace/messages/search",
            { params: { q: query, clubId, limit } }
        ),

    markChannelRead: (
        channelId: string,
        lastReadMessageId?: string | null,
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean }>(
            `/club/workspace/channels/${channelId}/read`,
            { lastReadMessageId, clubId }
        ),

    getUnreadCounts: (clubId?: string) =>
        apiClient.get<{ success: boolean; unreadCounts: Record<string, number> }>(
            "/club/workspace/channels-unread",
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // THREADS (PHASE 04)
    // =========================================================================

    createThread: (
        channelId: string,
        data: {
            parentMessageId: string;
            name: string;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; thread: WorkspaceThread }>(
            `/club/workspace/channels/${channelId}/threads`,
            { ...data, clubId }
        ),

    getThread: (threadId: string, clubId?: string) =>
        apiClient.get<{ success: boolean; thread: WorkspaceThread }>(
            `/club/workspace/threads/${threadId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    getThreads: (
        channelId: string,
        includeArchived = false,
        clubId?: string
    ) =>
        apiClient.get<{ success: boolean; threads: WorkspaceThread[] }>(
            `/club/workspace/channels/${channelId}/threads`,
            { params: { includeArchived, clubId } }
        ),

    updateThread: (
        threadId: string,
        data: {
            name?: string;
            isLocked?: boolean;
            isArchived?: boolean;
        },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; thread: WorkspaceThread }>(
            `/club/workspace/threads/${threadId}`,
            { ...data, clubId }
        ),

    // =========================================================================
    // PHASE 05: TASK MANAGEMENT SYSTEM ENDPOINTS
    // =========================================================================

    createTask: (
        data: {
            title: string;
            description?: string;
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
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask }>(
            "/club/workspace/tasks",
            { ...data, clubId }
        ),

    listTasks: (
        params: {
            clubId?: string;
            departmentId?: string;
            status?: string;
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
    ) =>
        apiClient.get<{ success: boolean; tasks: WorkspaceTask[]; total: number }>(
            "/club/workspace/tasks",
            { params }
        ),

    getMyTasks: (
        tab: "assigned_to_me" | "created_by_me" | "assigned_by_me" | "department_tasks" | "due_soon" | "overdue" | "completed" | "awaiting_review" | "archived",
        clubId?: string
    ) =>
        apiClient.get<{ success: boolean; tab: string; tasks: WorkspaceTask[] }>(
            "/club/workspace/tasks/my-tasks",
            { params: { tab, clubId } }
        ),

    getTask: (taskId: string, clubId?: string) =>
        apiClient.get<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    updateTask: (
        taskId: string,
        data: {
            title?: string;
            description?: string;
            departmentId?: string | null;
            priority?: WorkspaceTaskPriority;
            startDate?: string | null;
            dueDate?: string | null;
            assignedRoleId?: string | null;
            checklist?: WorkspaceTaskChecklistItem[];
            referenceLinks?: WorkspaceTaskReferenceLink[];
            isRestricted?: boolean;
            displayOrder?: number;
            expectedVersion?: number;
        },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}`,
            { ...data, clubId }
        ),

    transitionTaskStatus: (
        taskId: string,
        data: {
            targetStatus: WorkspaceTaskStatus;
            expectedVersion?: number;
            reason?: string;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}/transition`,
            { ...data, clubId }
        ),

    assignTask: (
        taskId: string,
        assigneeUserIds: string[],
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}/assign`,
            { assigneeUserIds, clubId }
        ),

    submitTask: (
        taskId: string,
        data: {
            content: string;
            attachments?: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }>;
            expectedVersion?: number;
            fileIds?: string[];
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask; submission: WorkspaceTaskSubmission }>(
            `/club/workspace/tasks/${taskId}/submit`,
            { ...data, clubId }
        ),

    reviewTask: (
        taskId: string,
        data: {
            submissionId: string;
            decision: "approved" | "changes_requested";
            comments: string;
            expectedVersion?: number;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask; review: WorkspaceTaskReview }>(
            `/club/workspace/tasks/${taskId}/review`,
            { ...data, clubId }
        ),

    addTaskComment: (
        taskId: string,
        data: {
            content: string;
            parentCommentId?: string | null;
            mentions?: string[];
            attachments?: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }>;
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; comment: WorkspaceTaskComment }>(
            `/club/workspace/tasks/${taskId}/comments`,
            { ...data, clubId }
        ),

    getTaskComments: (taskId: string, clubId?: string) =>
        apiClient.get<{ success: boolean; comments: WorkspaceTaskComment[] }>(
            `/club/workspace/tasks/${taskId}/comments`,
            { params: clubId ? { clubId } : undefined }
        ),

    toggleTaskWatcher: (taskId: string, clubId?: string) =>
        apiClient.post<{ success: boolean; isWatching: boolean }>(
            `/club/workspace/tasks/${taskId}/watch`,
            { clubId }
        ),

    getTaskActivity: (taskId: string, limit = 50, clubId?: string) =>
        apiClient.get<{ success: boolean; activity: WorkspaceTaskActivity[] }>(
            `/club/workspace/tasks/${taskId}/activity`,
            { params: { limit, clubId } }
        ),

    updateTaskChecklist: (
        taskId: string,
        checklist: WorkspaceTaskChecklistItem[],
        expectedVersion?: number,
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}/checklist`,
            { checklist, expectedVersion, clubId }
        ),

    archiveTask: (taskId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; task: WorkspaceTask }>(
            `/club/workspace/tasks/${taskId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // 6. MEDIA & DOCUMENT MANAGEMENT (PHASE 06)
    // =========================================================================

    /**
     * Requests a short-lived signed upload intent to Cloudinary
     */
    getUploadIntent: (data: CreateUploadIntentRequest, clubId?: string) =>
        apiClient.post<{ success: boolean; intent: UploadIntentResponse }>(
            "/club/workspace/files/upload-intent",
            { ...data, clubId: clubId || data.clubId }
        ),

    /**
     * Registers a verified upload with single-use intent confirmation
     */
    registerUpload: (data: RegisterUploadRequest, clubId?: string) =>
        apiClient.post<{ success: boolean; file: WorkspaceFile }>(
            "/club/workspace/files/register-upload",
            { ...data, clubId: clubId || data.clubId }
        ),

    /**
     * Server-side stream upload with binary magic-byte & XSS inspection
     */
    directUploadFile: (formData: FormData, clubId?: string) =>
        apiClient.post<{ success: boolean; file: WorkspaceFile }>(
            "/club/workspace/files/direct-upload",
            formData,
            {
                params: clubId ? { clubId } : undefined,
                headers: { "Content-Type": "multipart/form-data" },
            }
        ),

    /**
     * Authorizes access and generates an ephemeral signed delivery URL
     */
    getFileDeliveryUrl: (
        fileId: string,
        options: { thumbnail?: boolean; download?: boolean; page?: number } = {},
        clubId?: string
    ) =>
        apiClient.get<{ success: boolean } & FileDeliveryUrlResponse>(
            `/club/workspace/files/${fileId}/delivery-url`,
            {
                params: {
                    ...options,
                    clubId,
                },
            }
        ),

    /**
     * Lists workspace files with optional filters
     */
    listFiles: (filters: WorkspaceFileListFilters = {}, clubId?: string) =>
        apiClient.get<{ success: boolean; files: WorkspaceFile[]; total: number }>(
            "/club/workspace/files",
            {
                params: {
                    ...filters,
                    clubId: clubId || filters.clubId,
                },
            }
        ),

    /**
     * Gets storage quota and utilization details
     */
    getStorageUsage: (clubId?: string) =>
        apiClient.get<{ success: boolean; storage: WorkspaceStorageQuotaInfo }>(
            "/club/workspace/files/storage/usage",
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Safely deletes an asset from Cloudinary and removes database record
     */
    deleteFile: (fileId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/files/${fileId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Renames an asset's display name
     */
    renameFile: (fileId: string, newFileName: string, clubId?: string) =>
        apiClient.patch<{ success: boolean; file: WorkspaceFile }>(
            `/club/workspace/files/${fileId}/rename`,
            { newFileName },
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Replaces an asset's binary payload in Cloudinary
     */
    replaceFile: (fileId: string, formData: FormData, clubId?: string) =>
        apiClient.post<{ success: boolean; file: WorkspaceFile }>(
            `/club/workspace/files/${fileId}/replace`,
            formData,
            {
                params: clubId ? { clubId } : undefined,
                headers: { "Content-Type": "multipart/form-data" },
            }
        ),

    /**
     * Generates an authorized signed share link with customizable expiry
     */
    getShareUrl: (fileId: string, expiresIn?: number, clubId?: string) =>
        apiClient.get<{ success: boolean; shareUrl: string; expiresAt: string; fileName: string }>(
            `/club/workspace/files/${fileId}/share-url`,
            {
                params: {
                    expiresIn,
                    clubId,
                },
            }
        ),

    /**
     * Subsystem health check
     */
    getHealth: () =>
        apiClient.get<{
            success: boolean;
            subsystem: string;
            redisHealthy: boolean;
            redisNamespace: string;
        }>("/club/workspace/health"),

    // =========================================================================
    // 10. NOTIFICATIONS & PREFERENCES (PHASE 07)
    // =========================================================================
    getNotifications: (options?: { clubId?: string; unreadOnly?: boolean; limit?: number; offset?: number }) =>
        apiClient.get<{
            success: boolean;
            data: { notifications: WorkspaceNotification[]; total: number; unreadCount: number };
        }>("/club/workspace/notifications", { params: options }),

    markNotificationRead: (notificationId: string, clubId?: string) =>
        apiClient.patch<{ success: boolean; data: { updated: boolean } }>(
            `/club/workspace/notifications/${notificationId}/read`,
            {},
            { params: clubId ? { clubId } : undefined }
        ),

    markAllNotificationsRead: (clubId?: string) =>
        apiClient.post<{ success: boolean; data: { markedCount: number } }>(
            "/club/workspace/notifications/read-all",
            {},
            { params: clubId ? { clubId } : undefined }
        ),

    getNotificationPreferences: (clubId?: string) =>
        apiClient.get<{ success: boolean; data: WorkspaceNotificationPreferences }>(
            "/club/workspace/notifications/preferences",
            { params: clubId ? { clubId } : undefined }
        ),

    updateNotificationPreferences: (prefs: Partial<WorkspaceNotificationPreferences>, clubId?: string) =>
        apiClient.put<{ success: boolean; data: WorkspaceNotificationPreferences }>(
            "/club/workspace/notifications/preferences",
            prefs,
            { params: clubId ? { clubId } : undefined }
        ),

    // =========================================================================
    // 11. DASHBOARD, ACTIVITY, AUDIT & SEARCH (PHASE 08)
    // =========================================================================

    /**
     * Retrieves high-level workspace overview metrics scoped to user permissions
     */
    getWorkspaceOverview: (clubId?: string) =>
        apiClient.get<{ success: boolean; data: WorkspaceOverviewMetrics }>(
            "/club/workspace/dashboard/overview",
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Retrieves specific department health & progress insight
     */
    getDepartmentInsight: (departmentId: string, clubId?: string) =>
        apiClient.get<{ success: boolean; data: WorkspaceDepartmentInsight }>(
            `/club/workspace/dashboard/departments/${departmentId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Retrieves chronological workspace activity feed with permission filtering
     */
    getActivityFeed: (options?: {
        clubId?: string;
        departmentId?: string;
        actorId?: string;
        eventType?: string;
        limit?: number;
        offset?: number;
    }) =>
        apiClient.get<{
            success: boolean;
            data: { events: WorkspaceActivityEvent[]; total: number };
        }>("/club/workspace/activity", { params: options }),

    /**
     * Lists administrative audit logs (strictly append-only, admin-restricted)
     */
    getAuditLogs: (options?: {
        clubId?: string;
        actorId?: string;
        action?: string;
        targetType?: string;
        limit?: number;
        offset?: number;
    }) =>
        apiClient.get<{
            success: boolean;
            data: { logs: WorkspaceAuditLogEntry[]; total: number };
        }>("/club/workspace/audit-logs", { params: options }),

    /**
     * Unified permission-filtered workspace search across channels, messages, members, departments, tasks, files
     */
    searchWorkspace: (
        query: string,
        options?: {
            clubId?: string;
            type?: string;
            departmentId?: string;
            limit?: number;
            offset?: number;
        }
    ) =>
        apiClient.get<{ success: boolean; data: WorkspaceSearchResponse }>(
            "/club/workspace/search",
            { params: { q: query, ...options } }
        ),

    // =========================================================================
    // ROLES & TEMPLATES (PHASE 09)
    // =========================================================================

    createRole: (
        data: {
            name: string;
            description?: string;
            rank: number;
            color?: string;
            permissions: string[];
        },
        clubId?: string
    ) =>
        apiClient.post<{ success: boolean; role: WorkspaceRole }>(
            "/club/workspace/roles",
            { ...data, clubId }
        ),

    updateRole: (
        roleId: string,
        data: {
            name?: string;
            description?: string;
            rank?: number;
            color?: string;
            permissions?: string[];
        },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; role: WorkspaceRole }>(
            `/club/workspace/roles/${roleId}`,
            { ...data, clubId }
        ),

    deleteRole: (roleId: string, clubId?: string) =>
        apiClient.delete<{ success: boolean; message: string }>(
            `/club/workspace/roles/${roleId}`,
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Phase 07: Reorders custom role hierarchy ranks
     */
    reorderRoles: (
        roleOrder: Array<{ id: string; rank?: number }> | string[],
        clubId?: string
    ) =>
        apiClient.put<{ success: boolean; roles: WorkspaceRole[]; message: string }>(
            "/club/workspace/roles/reorder",
            { roleOrder, clubId }
        ),

    /**
     * Phase 07: Read-only capability simulation preview for role or member
     */
    previewPermissions: (
        params: { roleId?: string; targetUserId?: string },
        clubId?: string
    ) =>
        apiClient.get<{ success: boolean; preview: WorkspacePermissionPreviewResult }>(
            "/club/workspace/permissions/preview",
            { params: { ...params, clubId } }
        ),

    /**
     * Phase 07: Retrieves workspace settings & delegated management configuration
     */
    getSettings: (clubId?: string) =>
        apiClient.get<{ success: boolean; settings: WorkspaceSettingsData }>(
            "/club/workspace/settings",
            { params: clubId ? { clubId } : undefined }
        ),

    /**
     * Phase 07: Updates workspace configuration, name, description, and settings
     */
    updateSettings: (
        data: {
            name?: string;
            description?: string;
            customSettings?: Record<string, any>;
        },
        clubId?: string
    ) =>
        apiClient.patch<{ success: boolean; workspace: any; message: string }>(
            "/club/workspace/settings",
            { ...data, clubId }
        ),

    getTemplates: (clubId?: string) =>
        apiClient.get<{ success: boolean; templates: WorkspaceTemplateDefinition[] }>(
            "/club/workspace/templates",
            { params: clubId ? { clubId } : undefined }
        ),

    applyTemplate: (templateId: string, clubId?: string) =>
        apiClient.post<{
            success: boolean;
            data: {
                template: WorkspaceTemplateDefinition;
                departmentsCreated: number;
                categoriesCreated: number;
                channelsCreated: number;
            };
            message: string;
        }>("/club/workspace/templates/apply", { templateId, clubId }),

    /**
     * Phase 01: Resolves granular member capabilities & dynamic navigation
     */
    getCapabilities: (clubId: string) =>
        apiClient.get<{ success: boolean; capabilities: MemberCapabilityResolution }>(
            "/club/workspace/capabilities",
            { params: { clubId } }
        ),

    /**
     * Phase 01: Discovers all club workspaces the user belongs to
     */
    getMyWorkspaces: () =>
        apiClient.get<{
            success: boolean;
            workspaces: UserClubWorkspaceSummary[];
            isClubManager?: boolean;
            managedClub?: { id: string; name: string; slug: string } | null;
        }>("/club/workspace/my-workspaces"),

    /**
     * Phase 01: Updates custom permission overrides for a specific member
     */
    updateMemberCustomPermissions: (
        clubId: string,
        targetUserId: string,
        customPermissions: Record<string, boolean>
    ) =>
        apiClient.patch<{ success: boolean; member: any; message: string }>(
            `/club/workspace/members/${targetUserId}/custom-permissions`,
            { clubId, customPermissions }
        ),

    // =========================================================================
    // PHASE 02/03: ORBIX RECOGNITION & ORBITS ENGINE
    // =========================================================================

    awardOrbits: (data: AwardOrbitsDTO, clubId?: string) =>
        apiClient.post<{
            success: boolean;
            message: string;
            award: WorkspaceRecognitionLedgerEntry;
        }>("/club/workspace/recognition/awards", { ...data, clubId }),

    reverseAward: (awardId: string, data: ReverseAwardDTO, clubId?: string) =>
        apiClient.post<{
            success: boolean;
            message: string;
            reversal: WorkspaceRecognitionLedgerEntry;
            original: WorkspaceRecognitionLedgerEntry;
        }>(`/club/workspace/recognition/awards/${awardId}/reverse`, { ...data, clubId }),

    getRecognitionSummary: (userId?: string, clubId?: string) =>
        apiClient.get<{ success: boolean; summary: MemberRecognitionSummary }>(
            "/club/workspace/recognition/summary",
            { params: { userId, clubId } }
        ),

    getRecognitionHistory: (
        params?: {
            recipientId?: string;
            issuerId?: string;
            departmentId?: string;
            categoryId?: string;
            limit?: number;
            offset?: number;
        },
        clubId?: string
    ) =>
        apiClient.get<{
            success: boolean;
            entries: WorkspaceRecognitionLedgerEntry[];
            total: number;
        }>("/club/workspace/recognition/history", {
            params: { ...params, clubId },
        }),

    getRecognitionPolicy: (clubId?: string) =>
        apiClient.get<{ success: boolean; policy: WorkspaceRecognitionPolicy }>(
            "/club/workspace/recognition/policy",
            { params: clubId ? { clubId } : undefined }
        ),

    updateRecognitionPolicy: (data: Partial<WorkspaceRecognitionPolicy>, clubId?: string) =>
        apiClient.patch<{
            success: boolean;
            policy: WorkspaceRecognitionPolicy;
            message: string;
        }>("/club/workspace/recognition/policy", { ...data, clubId }),

    getRecognitionCategories: (clubId?: string) =>
        apiClient.get<{ success: boolean; categories: WorkspaceRecognitionCategory[] }>(
            "/club/workspace/recognition/categories",
            { params: clubId ? { clubId } : undefined }
        ),

    updateRecognitionCategory: (
        categoryId: string,
        data: { isActive?: boolean; name?: string; description?: string; icon?: string },
        clubId?: string
    ) =>
        apiClient.patch<{
            success: boolean;
            category: WorkspaceRecognitionCategory;
            message: string;
        }>(`/club/workspace/recognition/categories/${categoryId}`, { ...data, clubId }),

    allocateRecognitionBudget: (
        data: { managerUserId: string; allocatedBudget: number; yearMonth?: string },
        clubId?: string
    ) =>
        apiClient.post<{
            success: boolean;
            budget: WorkspaceRecognitionBudget;
            message: string;
        }>("/club/workspace/recognition/budget", { ...data, clubId }),

    getRecognitionBudgets: (yearMonth?: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            budgets: Array<WorkspaceRecognitionBudget & { user: any }>;
        }>("/club/workspace/recognition/budgets", {
            params: { yearMonth, clubId },
        }),

    getRecognitionAnalytics: (clubId?: string) =>
        apiClient.get<{
            success: boolean;
            analytics: {
                totalOrbitsAwarded: number;
                totalAwardsCount: number;
                monthlyOrbitsAwarded: number;
                monthlyAwardsCount: number;
                activeCategoriesCount: number;
                categoryBreakdown: Array<{
                    categoryId: string;
                    categoryName: string;
                    categorySlug: string;
                    icon: string;
                    totalPoints: number;
                    awardCount: number;
                }>;
                topRecipients: Array<{
                    userId: string;
                    name: string;
                    username: string;
                    avatarUrl?: string;
                    totalPoints: number;
                    awardCount: number;
                }>;
                topIssuers: Array<{
                    userId: string;
                    name: string;
                    username: string;
                    avatarUrl?: string;
                    totalPoints: number;
                    awardCount: number;
                }>;
            };
        }>("/club/workspace/recognition/analytics", {
            params: clubId ? { clubId } : undefined,
        }),

    getRecognitionAwardById: (awardId: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            award: WorkspaceRecognitionLedgerEntry;
        }>(`/club/workspace/recognition/awards/${awardId}`, {
            params: clubId ? { clubId } : undefined,
        }),

    getDepartmentRecognition: (departmentId: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            department: DepartmentRecognitionSummary;
        }>(`/club/workspace/recognition/departments/${departmentId}`, {
            params: clubId ? { clubId } : undefined,
        }),

    getMemberRecognitionProfile: (userId: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            profile: MemberRecognitionProfile;
        }>(`/club/workspace/recognition/members/${userId}/profile`, {
            params: clubId ? { clubId } : undefined,
        }),

    addAppreciationNote: (awardId: string, note: string, clubId?: string) =>
        apiClient.post<{
            success: boolean;
            message: string;
            note: { id: string; awardId: string; authorId: string; note: string; createdAt: string };
        }>(`/club/workspace/recognition/awards/${awardId}/notes`, { note, clubId }),

    getAwardNotes: (awardId: string, clubId?: string) =>
        apiClient.get<{
            success: boolean;
            notes: Array<{ id: string; awardId: string; note: string; createdAt: string; author: any }>;
        }>(`/club/workspace/recognition/awards/${awardId}/notes`, {
            params: clubId ? { clubId } : undefined,
        }),

    getLeaderboards: (
        period?: LeaderboardPeriod,
        departmentId?: string,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/leaderboards`
            : "/club/workspace/recognition/leaderboards";
        return apiClient.get<{
            success: boolean;
            leaderboards: ThreeLeaderboardsResponse;
        }>(url, {
            params: {
                period,
                departmentId,
                clubId: !workspaceId ? clubId : undefined,
            },
        });
    },

    getComprehensiveAnalytics: (
        period?: LeaderboardPeriod,
        departmentId?: string,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/analytics/comprehensive`
            : "/club/workspace/recognition/analytics/comprehensive";
        return apiClient.get<{
            success: boolean;
            analytics: WorkspaceAnalyticsSummary;
        }>(url, {
            params: {
                period,
                departmentId,
                clubId: !workspaceId ? clubId : undefined,
            },
        });
    },

    getIndividualMemberAnalytics: (
        userId: string,
        period?: LeaderboardPeriod,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/analytics/members/${userId}`
            : `/club/workspace/recognition/analytics/members/${userId}`;
        return apiClient.get<{
            success: boolean;
            analytics: IndividualMemberAnalytics;
        }>(url, {
            params: {
                period,
                clubId: !workspaceId ? clubId : undefined,
            },
        });
    },

    getRedisTopRankings: (
        boardType: "contributors" | "leaders" | "departments",
        period?: LeaderboardPeriod,
        departmentId?: string,
        limit = 50,
        offset = 0,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/leaderboards/redis/top`
            : "/club/workspace/recognition/leaderboards/redis/top";
        return apiClient.get<{
            success: boolean;
            source: "redis" | "postgres";
            entries: any[];
            period: LeaderboardPeriod;
            boardType: string;
        }>(url, {
            params: {
                boardType,
                period,
                departmentId,
                limit,
                offset,
                clubId: !workspaceId ? clubId : undefined,
            },
        });
    },

    getRedisNearbyRankings: (
        boardType?: "contributors" | "leaders" | "departments",
        period?: LeaderboardPeriod,
        userId?: string,
        radius = 2,
        departmentId?: string,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/leaderboards/redis/nearby`
            : "/club/workspace/recognition/leaderboards/redis/nearby";
        return apiClient.get<{
            success: boolean;
            nearby: Array<{
                entityId: string;
                score: number;
                rank: number;
                isTarget?: boolean;
            }>;
            targetUserId: string;
            targetRank: number | null;
            targetScore: number | null;
            period: LeaderboardPeriod;
        }>(url, {
            params: {
                boardType,
                period,
                userId,
                radius,
                departmentId,
                clubId: !workspaceId ? clubId : undefined,
            },
        });
    },

    rebuildLeaderboards: (
        period?: LeaderboardPeriod,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/leaderboards/rebuild`
            : "/club/workspace/recognition/leaderboards/rebuild";
        return apiClient.post<{
            success: boolean;
            message: string;
            contributorsCount: number;
            leadersCount: number;
            departmentsCount: number;
        }>(url, { period, clubId: !workspaceId ? clubId : undefined });
    },

    reconcileLeaderboards: (
        period?: LeaderboardPeriod,
        clubId?: string,
        workspaceId?: string
    ) => {
        const url = workspaceId
            ? `/team-workspaces/${workspaceId}/recognition/leaderboards/reconcile`
            : "/club/workspace/recognition/leaderboards/reconcile";
        return apiClient.post<{
            success: boolean;
            message: string;
            matched: boolean;
            discrepanciesFound: number;
            correctedCount: number;
        }>(url, { period, clubId: !workspaceId ? clubId : undefined });
    },
};

export default workspaceApi;
