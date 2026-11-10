// Frontend/src/types/workspace.ts

export type WorkspaceStatus = "active" | "suspended" | "archived";

export type WorkspaceMembershipStatus =
    | "invitation_pending"
    | "active"
    | "suspended"
    | "removed";

export interface TeamWorkspace {
    id: string;
    clubId: string;
    ownerId: string;
    managerUserId: string | null;
    managerAppointedAt: string | null;
    managerPermissions?: Record<string, any> | string[] | null;
    name: string;
    slug: string;
    description: string | null;
    iconUrl: string | null;
    workspaceStatus: WorkspaceStatus;
    schemaVersion: number;
    settings: {
        allowMemberInvites?: boolean;
        theme?: string;
        maxMembers?: number;
        defaultChannelId?: string | null;
        [key: string]: any;
    };
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceRole {
    id: string;
    workspaceId: string;
    name: string;
    slug: string;
    description: string | null;
    rank: number;
    isSystem: boolean;
    color: string;
    permissions: string[];
    createdAt: string;
    updatedAt: string;
}

export interface WorkspaceDepartment {
    id: string;
    workspaceId: string;
    clubTeamId: string | null;
    name: string;
    slug: string;
    description: string | null;
    icon: string;
    color: string;
    leadUserId: string | null;
    coLeadUserIds: string[];
    displayOrder: number;
    status: "active" | "archived";
    createdAt: string;
    updatedAt: string;
    memberCount?: number;
    leadUser?: {
        id: string;
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    } | null;
}

export interface WorkspaceDepartmentMember {
    id: string;
    workspaceId: string;
    departmentId: string;
    memberId: string;
    userId: string;
    departmentRole: "lead" | "co_lead" | "member";
    roleTitle: string;
    joinedAt: string;
    assignedBy: string | null;
    user?: {
        id: string;
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceMember {
    id: string;
    workspaceId: string;
    userId: string;
    clubMembershipId: string | null;
    departmentId: string | null;
    roleId: string;
    roleTitle: string;
    membershipStatus: WorkspaceMembershipStatus;
    isSuspended: boolean;
    suspendedAt: string | null;
    suspendedReason: string | null;
    suspendedBy: string | null;
    invitedBy: string | null;
    joinedAt: string;
    lastActiveAt: string | null;
    customPermissions?: Record<string, boolean>;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        email: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    role?: WorkspaceRole;
    department?: WorkspaceDepartment | null;
    departments?: Array<{
        id: string;
        name: string;
        slug: string;
        icon: string;
        color: string;
        departmentRole: string;
        roleTitle: string;
    }>;
    assignedTaskCount?: number;
}

export interface WorkspaceInvitation {
    id: string;
    workspaceId: string;
    inviterId: string;
    email: string;
    invitedUserId: string | null;
    roleId: string;
    departmentId: string | null;
    tokenHash: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    invitationMessage: string | null;
    expiresAt: string;
    acceptedAt: string | null;
    revokedAt: string | null;
    createdAt: string;
    role?: WorkspaceRole;
    department?: WorkspaceDepartment;
    inviter?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
    };
}

// ============================================================================
// PHASE 04: CHANNELS, CATEGORIES, OVERRIDES, MESSAGES & THREADS
// ============================================================================

export type WorkspaceChannelType =
    | "text"
    | "announcement"
    | "forum"
    | "task_discussion"
    | "department"
    | "private";

export interface WorkspaceChannelCategory {
    id: string;
    workspaceId: string;
    departmentId: string | null;
    name: string;
    displayOrder: number;
    isPrivate: boolean;
    createdAt: string;
    updatedAt: string;

    channels?: WorkspaceChannel[];
    department?: WorkspaceDepartment | null;
}

export interface WorkspaceChannel {
    id: string;
    workspaceId: string;
    categoryId: string | null;
    departmentId: string | null;
    name: string;
    slug: string;
    topic: string | null;
    channelType: WorkspaceChannelType;
    isPrivate: boolean;
    isArchived: boolean;
    isCategorySynced: boolean;
    position: number;
    defaultSlowmodeSeconds: number;
    createdBy: string | null;
    createdAt: string;
    updatedAt: string;

    categoryName?: string;
    departmentName?: string;
    unreadCount?: number;
    lastReadMessageId?: string | null;
}

export interface WorkspaceChannelOverride {
    id: string;
    workspaceId: string;
    categoryId: string | null;
    channelId: string | null;
    roleId: string | null;
    memberId: string | null;
    allowPermissions: string[];
    denyPermissions: string[];
    createdAt: string;
    updatedAt: string;

    role?: WorkspaceRole | null;
    member?: WorkspaceMember | null;
}

export type WorkspaceFileDeliveryType = "authenticated" | "private" | "upload";
export type WorkspaceFileAssetStatus = "active" | "archived" | "quarantined";
export type WorkspaceFileParentResourceType =
    | "task"
    | "task_submission"
    | "task_comment"
    | "channel"
    | "message"
    | "resource"
    | "attachment";

export interface WorkspaceFile {
    id: string;
    workspaceId: string;
    uploaderId: string;
    channelId: string | null;
    messageId: string | null;
    taskId: string | null;
    departmentId: string | null;
    submissionId: string | null;
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    cloudinaryPublicId: string;
    cloudinaryAssetId: string | null;
    cloudinaryUrl: string;
    cloudinarySecureUrl: string;
    resourceType: string;
    deliveryType: WorkspaceFileDeliveryType;
    format: string | null;
    checksum: string | null;
    purpose: string;
    parentResourceType: WorkspaceFileParentResourceType;
    parentResourceId: string | null;
    assetStatus: WorkspaceFileAssetStatus;
    isArchived: boolean;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;

    uploader?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    thumbnailUrl?: string | null;
    deliveryUrl?: string | null;
}

export interface WorkspaceFileUploadIntent {
    id: string;
    workspaceId: string;
    userId: string;
    departmentId: string | null;
    parentResourceType: WorkspaceFileParentResourceType;
    parentResourceId: string | null;
    publicId: string;
    folder: string;
    originalFilename: string;
    expectedMimeType: string;
    expectedSizeBytes: number;
    deliveryType: WorkspaceFileDeliveryType;
    resourceType: string;
    status: "pending" | "registered" | "expired" | "cancelled";
    expiresAt: string;
    createdAt: string;
    registeredAt: string | null;
}

export interface CreateUploadIntentRequest {
    fileName: string;
    fileSizeBytes: number;
    mimeType: string;
    checksum?: string;
    departmentId?: string | null;
    parentResourceType: WorkspaceFileParentResourceType;
    parentResourceId?: string | null;
    clubId?: string;
}

export interface UploadIntentResponse {
    intentId: string;
    publicId: string;
    folder: string;
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    deliveryType: string;
    resourceType: string;
    uploadUrl: string;
    expiresAt: string;
    maxBytes: number;
}

export interface RegisterUploadRequest {
    intentId: string;
    cloudinaryPublicId: string;
    cloudinaryAssetId?: string;
    secureUrl: string;
    url?: string;
    format?: string;
    fileSizeBytes: number;
    mimeType: string;
    checksum?: string;
    clubId?: string;
}

export interface FileDeliveryUrlResponse {
    fileId: string;
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    deliveryUrl: string;
    thumbnailUrl?: string | null;
    expiresAt: string;
}

export interface WorkspaceStorageQuotaInfo {
    workspaceId: string;
    usedBytes: number;
    quotaBytes: number;
    usedPercentage: number;
    fileCount: number;
}

export interface WorkspaceFileListFilters {
    departmentId?: string;
    channelId?: string;
    taskId?: string;
    submissionId?: string;
    parentResourceType?: WorkspaceFileParentResourceType;
    parentResourceId?: string;
    mimeTypeCategory?: "image" | "video" | "document" | "pdf";
    uploaderId?: string;
    status?: WorkspaceFileAssetStatus;
    search?: string;
    limit?: number;
    offset?: number;
    clubId?: string;
}

export interface WorkspaceMessageReaction {
    id: string;
    workspaceId: string;
    messageId: string;
    userId: string;
    emoji: string;
    createdAt: string;
    user?: {
        id: string;
        username: string;
        firstName: string;
    };
}

export interface WorkspaceThreadParticipant {
    threadId: string;
    userId: string;
    lastReadAt: string;
    isMuted: boolean;
    joinedAt: string;
    user?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceThread {
    id: string;
    workspaceId: string;
    channelId: string;
    parentMessageId: string;
    name: string;
    creatorId: string;
    isLocked: boolean;
    lockedAt: string | null;
    lockedBy: string | null;
    isArchived: boolean;
    archivedAt: string | null;
    archivedBy: string | null;
    messageCount: number;
    lastMessageAt: string;
    createdAt: string;
    updatedAt: string;

    creator?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
    };
    participants?: WorkspaceThreadParticipant[];
}

export interface WorkspaceMessage {
    id: string;
    workspaceId: string;
    channelId: string;
    senderId: string;
    senderMemberId: string;
    parentMessageId: string | null;
    threadId: string | null;
    content: string;
    messageType: "text" | "system" | "announcement" | "thread_starter";
    isPinned: boolean;
    pinnedAt: string | null;
    pinnedBy: string | null;
    isEdited: boolean;
    editedAt: string | null;
    isDeleted: boolean;
    deletedAt: string | null;
    mentions: {
        users: string[];
        roles: string[];
        everyone: boolean;
    };
    createdAt: string;
    updatedAt: string;

    sender?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    senderRole?: {
        id: string;
        name: string;
        color: string;
        rank: number;
    } | null;
    reactions?: Array<{
        emoji: string;
        count: number;
        users: string[];
        hasReacted?: boolean;
    }>;
    attachments?: WorkspaceFile[];
    thread?: WorkspaceThread | null;
}

export interface WorkspaceApiResponse {
    success: boolean;
    isNew?: boolean;
    workspace: TeamWorkspace;
    currentMember: WorkspaceMember;
    memberCount: number;
    roles: WorkspaceRole[];
    departments: WorkspaceDepartment[];
    message?: string;
}

export interface WorkspaceMembersApiResponse {
    success: boolean;
    members: WorkspaceMember[];
    total: number;
    message?: string;
}

// ============================================================================
// PHASE 05: TASK MANAGEMENT SYSTEM
// ============================================================================

export type WorkspaceTaskStatus =
    | "draft"
    | "assigned"
    | "in_progress"
    | "blocked"
    | "submitted"
    | "changes_requested"
    | "approved"
    | "completed"
    | "archived"
    | "cancelled";

export type WorkspaceTaskPriority = "low" | "medium" | "high" | "urgent";

export interface WorkspaceTaskChecklistItem {
    id: string;
    text: string;
    isCompleted: boolean;
    completedBy?: string | null;
    completedAt?: string | null;
}

export interface WorkspaceTaskReferenceLink {
    title: string;
    url: string;
}

export interface WorkspaceTaskAssignment {
    id: string;
    workspaceId: string;
    taskId: string;
    memberId: string;
    userId: string;
    assignedBy: string;
    assignedAt: string;
    unassignedAt?: string | null;
    isActive: boolean;
    user?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    member?: WorkspaceMember;
}

export interface WorkspaceTaskSubmission {
    id: string;
    workspaceId: string;
    taskId: string;
    submittedBy: string;
    content: string;
    attachments: Array<{
        name: string;
        url: string;
        sizeBytes?: number;
        mimeType?: string;
    }>;
    status: "pending" | "approved" | "changes_requested";
    createdAt: string;
    updatedAt: string;
    submitter?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    review?: WorkspaceTaskReview | null;
}

export interface WorkspaceTaskReview {
    id: string;
    workspaceId: string;
    taskId: string;
    submissionId: string;
    reviewerId: string;
    decision: "approved" | "changes_requested";
    comments: string;
    createdAt: string;
    reviewer?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceTaskComment {
    id: string;
    workspaceId: string;
    taskId: string;
    authorId: string;
    parentCommentId: string | null;
    content: string;
    mentions: string[];
    attachments: Array<{
        name: string;
        url: string;
        sizeBytes?: number;
        mimeType?: string;
    }>;
    isEdited: boolean;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
    author?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    replies?: WorkspaceTaskComment[];
}

export interface WorkspaceTaskWatcher {
    id: string;
    workspaceId: string;
    taskId: string;
    userId: string;
    createdAt: string;
    user?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceTaskActivity {
    id: string;
    workspaceId: string;
    taskId: string;
    actorId: string;
    action: string;
    details: Record<string, any>;
    createdAt: string;
    actor?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceTask {
    id: string;
    workspaceId: string;
    departmentId: string | null;
    creatorId: string;
    title: string;
    description: string | null;
    status: WorkspaceTaskStatus;
    priority: WorkspaceTaskPriority;
    startDate: string | null;
    dueDate: string | null;
    assignedRoleId: string | null;
    checklist: WorkspaceTaskChecklistItem[];
    referenceLinks: WorkspaceTaskReferenceLink[];
    version: number;
    isRestricted: boolean;
    isArchived: boolean;
    archivedAt: string | null;
    archivedBy: string | null;
    displayOrder: number;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;

    // Joined relations
    creator?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
    department?: WorkspaceDepartment | null;
    assignedRole?: WorkspaceRole | null;
    assignees?: WorkspaceTaskAssignment[];
    currentAssignees?: WorkspaceTaskAssignment[];
    reassignmentHistory?: WorkspaceTaskAssignment[];
    latestSubmission?: WorkspaceTaskSubmission | null;
    latestReview?: WorkspaceTaskReview | null;
    watchers?: WorkspaceTaskWatcher[];
    isWatching?: boolean;
    commentsCount?: number;
}

export interface WorkspaceNotification {
    id: string;
    workspaceId: string;
    recipientId: string;
    actorId: string | null;
    eventType: string;
    resourceType: string;
    resourceId: string;
    title: string;
    message: string;
    destinationUrl: string;
    metadata: Record<string, any>;
    isRead: boolean;
    readAt: string | null;
    expiresAt: string | null;
    createdAt: string;
    actor?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    };
}

export interface WorkspaceNotificationPreferences {
    workspaceId: string;
    userId: string;
    emailTaskAssigned: boolean;
    emailTaskReminders: boolean;
    emailMentions: boolean;
    emailDiscussions: boolean;
    emailDigestFrequency: "instant" | "daily" | "none";
    mutedUntil: string | null;
}

// ============================================================================
// PHASE 08: DASHBOARD, ACTIVITY, AUDIT & SEARCH
// ============================================================================

export interface WorkspaceActivityEvent {
    id: string;
    workspaceId: string;
    departmentId: string | null;
    actorId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    title: string;
    description: string | null;
    isRestricted: boolean;
    metadata: Record<string, any>;
    payload?: Record<string, any>;
    createdAt: string;
    actor?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    } | null;
    department?: {
        id: string;
        name: string;
        icon: string;
        color: string;
    } | null;
}

export interface WorkspaceOverviewMetrics {
    totalMembers: number;
    activeMembers: number;
    totalDepartments: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    tasksAwaitingReview: number;
    recentActivity: WorkspaceActivityEvent[];
}

export interface WorkspaceDepartmentInsight {
    departmentId: string;
    departmentName: string;
    slug: string;
    icon: string;
    color: string;
    memberCount: number;
    activeTasks: number;
    completedTasks: number;
    overdueTasks: number;
    submissionProgress: {
        total: number;
        submitted: number;
        approved: number;
        changesRequested: number;
    };
    recentActivity: WorkspaceActivityEvent[];
}

export interface WorkspaceAuditLogEntry {
    id: string;
    workspaceId: string;
    actorId: string | null;
    action: string;
    targetType: string;
    targetId: string | null;
    details: Record<string, any>;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: string;
    actor?: {
        id: string;
        username: string;
        firstName: string;
        lastName: string;
        avatarUrl?: string | null;
    } | null;
}

export interface WorkspaceSearchResultItem {
    id: string;
    type: "channel" | "message" | "member" | "department" | "task" | "file";
    title: string;
    snippet?: string | null;
    destinationUrl: string;
    departmentId?: string | null;
    departmentName?: string | null;
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface WorkspaceSearchResponse {
    results: WorkspaceSearchResultItem[];
    total: number;
    countsByType: Record<string, number>;
}

export type WorkspaceTemplateType =
    | "technical"
    | "coding"
    | "design"
    | "photography"
    | "entrepreneurship"
    | "general"
    | "custom"
    | "standard"
    | "tech"
    | "media"
    | "business";

export interface WorkspaceTemplateRole {
    name: string;
    description: string;
    rank: number;
    color: string;
    permissions: string[];
}

export interface WorkspaceTemplateDefinition {
    id: string;
    name: string;
    description: string;
    departments: Array<{
        name: string;
        slug: string;
        description: string;
        icon: string;
        color: string;
    }>;
    roles?: WorkspaceTemplateRole[];
    categories: Array<{
        name: string;
        channels: Array<{
            name: string;
            slug: string;
            topic: string;
            channelType: "text" | "announcement" | "forum";
        }>;
    }>;
}



