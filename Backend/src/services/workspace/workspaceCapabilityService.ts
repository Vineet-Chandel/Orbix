// Backend/src/services/workspace/workspaceCapabilityService.ts
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import type {
    WorkspaceContext,
    MemberCapabilityResolution,
    WorkspaceModuleCapabilities,
    WorkspaceNavigationCapabilities,
} from "../../types/workspaceTypes.js";

export class WorkspaceCapabilityService {
    /**
     * Resolves caller's granular capabilities across all 12 modules.
     * Guaranteed to reuse existing WorkspaceService.resolveContext and Redis cache.
     */
    static async resolveMemberCapabilities(
        workspaceId: string,
        userId: string
    ): Promise<MemberCapabilityResolution> {
        // 1. Check Redis Cache first
        const cached = await WorkspaceRedisService.getCachedCapabilities(workspaceId, userId);
        if (cached) {
            return cached;
        }

        // 2. Resolve WorkspaceContext from canonical engine
        const ctx = await WorkspaceService.resolveContext(workspaceId, userId);
        if (!ctx || ctx.member.isSuspended || ctx.member.membershipStatus !== "active") {
            const fallback: MemberCapabilityResolution = {
                workspaceId,
                userId,
                effectiveRole: {
                    id: "",
                    name: "Suspended",
                    slug: "suspended",
                    rank: 0,
                    isSystem: true,
                    color: "#71717a",
                },
                highestRank: 0,
                highestManageableRank: 0,
                isOwner: false,
                isAdmin: false,
                isWorkspaceManager: false,
                leadDepartmentIds: [],
                memberDepartmentIds: [],
                effectivePermissions: [],
                capabilities: this.createEmptyCapabilities(),
                navigation: this.createEmptyNavigation(),
            };
            return fallback;
        }

        // 3. Compute Granular Dimensions
        const effectiveRole = {
            id: ctx.member.role?.id || ctx.member.roleId,
            name: ctx.member.role?.name || "Member",
            slug: ctx.member.role?.slug || "member",
            rank: ctx.member.role?.rank || 200,
            isSystem: ctx.member.role?.isSystem ?? true,
            color: ctx.member.role?.color || "#16a34a",
        };

        const highestRank = effectiveRole.rank;
        // Role hierarchy rule: Actor can only manage users with rank strictly below their own,
        // unless they are the Owner (who can manage everyone except other owners).
        const highestManageableRank = ctx.isOwner ? 1000 : Math.max(0, highestRank - 1);

        const leadDepartmentIds = ctx.leadDepartmentIds || [];
        const memberDepartmentIds = (ctx.member.departments || []).map((d) => d.id);
        if (ctx.member.departmentId && !memberDepartmentIds.includes(ctx.member.departmentId)) {
            memberDepartmentIds.push(ctx.member.departmentId);
        }

        const effectivePermissions = ctx.permissions || [];
        const hasWildcard = ctx.isOwner || effectivePermissions.includes("*");
        const hasPerm = (perm: string) => hasWildcard || effectivePermissions.includes(perm);

        // Check workspace manager delegated permissions
        const mgrPerms = (ctx.workspace.managerPermissions || {}) as Record<string, any>;
        const isMgr = ctx.isWorkspaceManager;

        // 4. Compute Capabilities per Module
        const canManageSettings =
            hasWildcard ||
            hasPerm("workspace:manage_settings") ||
            (isMgr && !!mgrPerms.can_manage_settings);

        const canManageAllDepts =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("departments:manage") ||
            (isMgr && !!mgrPerms.can_manage_departments);

        const canCreateDepts =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("departments:create") ||
            (isMgr && !!mgrPerms.can_manage_departments);

        const canManageDeptsAssigned = canManageAllDepts || leadDepartmentIds.length > 0;
        const canManageDeptMembers =
            canManageAllDepts ||
            hasPerm("departments:manage_members") ||
            leadDepartmentIds.length > 0;

        const manageableDeptIds = canManageAllDepts ? ["*"] : leadDepartmentIds;

        const canInviteMembers =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("members:invite") ||
            (isMgr && !!mgrPerms.can_manage_members);

        const canManageMembers =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("members:remove") ||
            hasPerm("members:assign_role") ||
            (isMgr && !!mgrPerms.can_manage_members);

        const canAssignRole =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("members:assign_role") ||
            (isMgr && !!mgrPerms.can_manage_members);

        const canCreateRoles = hasWildcard || ctx.isAdmin || hasPerm("roles:create");
        const canManageRoles = hasWildcard || ctx.isAdmin || hasPerm("roles:manage");

        const canCreateChannels =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("channels:create") ||
            (isMgr && !!mgrPerms.can_manage_channels);

        const canManageChannels =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("channels:manage") ||
            (isMgr && !!mgrPerms.can_manage_channels);

        const canSendMessages = hasWildcard || hasPerm("messages:send");
        const canModerate =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("messages:moderate") ||
            hasPerm("messages:delete_any");

        const canViewAllTasks =
            hasWildcard ||
            ctx.isAdmin ||
            isMgr ||
            hasPerm("tasks:edit_all");

        const canCreateTasks =
            hasWildcard ||
            hasPerm("tasks:create") ||
            leadDepartmentIds.length > 0;

        const canAssignTasks =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("tasks:assign") ||
            leadDepartmentIds.length > 0 ||
            (isMgr && !!mgrPerms.can_manage_tasks);

        const canReviewTasks =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("tasks:review") ||
            leadDepartmentIds.length > 0 ||
            (isMgr && !!mgrPerms.can_manage_tasks);

        const canDeleteTasks =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("tasks:delete") ||
            (isMgr && !!mgrPerms.can_manage_tasks);

        const canManageFiles =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("files:manage");

        const canViewAuditLogs =
            hasWildcard ||
            ctx.isAdmin ||
            hasPerm("audit:view") ||
            hasPerm("audit:read");

        const capabilities: WorkspaceModuleCapabilities = {
            workspace: {
                view: true,
                manageSettings: canManageSettings,
                manageRoles: canManageRoles,
                viewAuditLogs: canViewAuditLogs,
            },
            departments: {
                viewAll: canManageAllDepts || ctx.isAdmin || isMgr,
                viewAssigned: true,
                create: canCreateDepts,
                manageAll: canManageAllDepts,
                manageAssigned: canManageDeptsAssigned,
                manageMembers: canManageDeptMembers,
                manageableDepartmentIds: manageableDeptIds,
                memberDepartmentIds,
            },
            members: {
                view: true,
                invite: canInviteMembers,
                manage: canManageMembers,
                assignRole: canAssignRole,
                highestManageableRank,
            },
            roles: {
                view: true,
                create: canCreateRoles,
                manage: canManageRoles,
                assign: canAssignRole,
            },
            channels: {
                view: true,
                create: canCreateChannels,
                manage: canManageChannels,
                managePermissions: canManageChannels,
                sendMessages: canSendMessages,
                moderate: canModerate,
            },
            tasks: {
                viewAll: canViewAllTasks,
                viewAssigned: true,
                create: canCreateTasks,
                assign: canAssignTasks,
                review: canReviewTasks,
                approve: canReviewTasks,
                delete: canDeleteTasks,
                manageableDepartmentIds: canViewAllTasks ? ["*"] : leadDepartmentIds,
            },
            assets: {
                view: true,
                upload: hasWildcard || hasPerm("files:upload"),
                download: true,
                manage: canManageFiles,
            },
            audit: {
                view: canViewAuditLogs,
            },
        };

        // 5. Dynamic Navigation Mapping
        const allowedTabs: string[] = ["overview"];

        const canViewDepartments =
            capabilities.departments.viewAll ||
            capabilities.departments.viewAssigned ||
            memberDepartmentIds.length > 0;
        if (canViewDepartments) allowedTabs.push("departments");

        allowedTabs.push("roster");

        const canViewInvitations = capabilities.members.invite;
        if (canViewInvitations) allowedTabs.push("invitations");

        allowedTabs.push("channels");

        const canViewAllTasksNav = capabilities.tasks.viewAll || leadDepartmentIds.length > 0;
        if (canViewAllTasksNav) allowedTabs.push("all-tasks");

        allowedTabs.push("my-tasks");
        allowedTabs.push("activity");

        if (canViewAuditLogs) allowedTabs.push("audit");
        if (canManageSettings) allowedTabs.push("settings");

        const navigation: WorkspaceNavigationCapabilities = {
            canViewOverview: true,
            canViewDepartments,
            canViewMembers: true,
            canViewInvitations,
            canViewRoles: canManageRoles || canCreateRoles,
            canViewChannels: true,
            canViewAllTasks: canViewAllTasksNav,
            canViewMyTasks: true,
            canViewActivity: true,
            canViewAuditLogs,
            canViewSettings: canManageSettings,
            allowedTabs,
        };

        const resolution: MemberCapabilityResolution = {
            workspaceId,
            userId,
            effectiveRole,
            highestRank,
            highestManageableRank,
            isOwner: ctx.isOwner,
            isAdmin: ctx.isAdmin,
            isWorkspaceManager: ctx.isWorkspaceManager,
            leadDepartmentIds,
            memberDepartmentIds,
            effectivePermissions,
            capabilities,
            navigation,
        };

        // 6. Write-through to Redis cache
        await WorkspaceRedisService.setCachedCapabilities(workspaceId, userId, resolution);

        return resolution;
    }

    /**
     * Point-in-time check whether a user holds a specific capability
     */
    static async hasCapability(
        workspaceId: string,
        userId: string,
        moduleName: keyof WorkspaceModuleCapabilities,
        actionName: string,
        scope?: { departmentId?: string; targetRank?: number }
    ): Promise<boolean> {
        const resolution = await this.resolveMemberCapabilities(workspaceId, userId);
        const moduleCaps = (resolution.capabilities as any)[moduleName];
        if (!moduleCaps) return false;

        const isAllowed = !!moduleCaps[actionName];
        if (!isAllowed) return false;

        // Department-specific scope check
        if (scope?.departmentId) {
            const manageableDepts = moduleCaps.manageableDepartmentIds || [];
            if (!manageableDepts.includes("*") && !manageableDepts.includes(scope.departmentId)) {
                return false;
            }
        }

        // Rank hierarchy scope check
        if (scope?.targetRank !== undefined) {
            if (scope.targetRank >= resolution.highestManageableRank) {
                return false;
            }
        }

        return true;
    }

    /**
     * Invalidate cached capabilities for a single member or an entire workspace
     */
    static async invalidate(workspaceId: string, userId?: string): Promise<void> {
        if (userId) {
            await WorkspaceRedisService.invalidateMemberCapabilities(workspaceId, userId);
        } else {
            await WorkspaceRedisService.invalidateAllWorkspaceCapabilities(workspaceId);
        }
    }

    private static createEmptyCapabilities(): WorkspaceModuleCapabilities {
        return {
            workspace: { view: false, manageSettings: false, manageRoles: false, viewAuditLogs: false },
            departments: {
                viewAll: false,
                viewAssigned: false,
                create: false,
                manageAll: false,
                manageAssigned: false,
                manageMembers: false,
                manageableDepartmentIds: [],
                memberDepartmentIds: [],
            },
            members: { view: false, invite: false, manage: false, assignRole: false, highestManageableRank: 0 },
            roles: { view: false, create: false, manage: false, assign: false },
            channels: { view: false, create: false, manage: false, managePermissions: false, sendMessages: false, moderate: false },
            tasks: {
                viewAll: false,
                viewAssigned: false,
                create: false,
                assign: false,
                review: false,
                approve: false,
                delete: false,
                manageableDepartmentIds: [],
            },
            assets: { view: false, upload: false, download: false, manage: false },
            audit: { view: false },
        };
    }

    private static createEmptyNavigation(): WorkspaceNavigationCapabilities {
        return {
            canViewOverview: false,
            canViewDepartments: false,
            canViewMembers: false,
            canViewInvitations: false,
            canViewRoles: false,
            canViewChannels: false,
            canViewAllTasks: false,
            canViewMyTasks: false,
            canViewActivity: false,
            canViewAuditLogs: false,
            canViewSettings: false,
            allowedTabs: [],
        };
    }
}
