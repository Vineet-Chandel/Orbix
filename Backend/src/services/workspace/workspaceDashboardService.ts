// Backend/src/services/workspace/workspaceDashboardService.ts
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { query } from "../../database/client.js";
import type {
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    WorkspaceActivityEvent,
    WorkspaceAuditLogEntry,
    WorkspaceSearchResponse,
    WorkspaceSearchResultType,
} from "../../types/workspaceTypes.js";

export class WorkspaceDashboardService {
    /**
     * Resolves caller's allowed department IDs:
     * - Returns null if caller has global administrative access (Owner, Admin, Manager).
     * - Returns array of department IDs caller belongs to or leads.
     */
    private static async resolveDepartmentScope(
        workspaceId: string,
        actorUserId: string
    ): Promise<{
        isAdmin: boolean;
        allowedDepartmentIds: string[] | null;
        permissionTier: string;
    }> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context || (!context.member && !context.isOwner)) {
            throw new Error("Unauthorized: You are not an active member of this workspace.");
        }

        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            return {
                isAdmin: true,
                allowedDepartmentIds: null,
                permissionTier: "global",
            };
        }

        // Gather department IDs the user belongs to or leads
        const deptIds = new Set<string>();
        if (context.member?.departmentId) {
            deptIds.add(context.member.departmentId);
        }
        (context.leadDepartmentIds || []).forEach((id) => deptIds.add(id));

        // Also query workspace_department_members table for secondary departments
        if (context.member?.id) {
            const extraDepts = await WorkspaceRepository.listMemberDepartments(workspaceId, context.member.id);
            extraDepts.forEach((d) => deptIds.add(d.id));
        }

        return {
            isAdmin: false,
            allowedDepartmentIds: Array.from(deptIds),
            permissionTier: `user:${actorUserId}`,
        };
    }

    /**
     * Retrieves workspace overview metrics with permission-aware Redis caching.
     */
    static async getWorkspaceOverview(
        workspaceId: string,
        actorUserId: string
    ): Promise<WorkspaceOverviewMetrics> {
        const { allowedDepartmentIds, permissionTier } = await this.resolveDepartmentScope(workspaceId, actorUserId);
        const cacheKey = WorkspaceRedisService.buildKey("dashboard", workspaceId, permissionTier);

        return await WorkspaceRedisService.getOrComputeWithStampedeProtection(
            cacheKey,
            async () => {
                return await WorkspaceRepository.getWorkspaceOverviewMetrics(workspaceId, allowedDepartmentIds);
            },
            300
        );
    }

    /**
     * Retrieves statistics and submission progress for a department.
     */
    static async getDepartmentInsight(
        workspaceId: string,
        actorUserId: string,
        departmentId: string
    ): Promise<WorkspaceDepartmentInsight> {
        const { isAdmin, allowedDepartmentIds } = await this.resolveDepartmentScope(workspaceId, actorUserId);

        if (!isAdmin && (!allowedDepartmentIds || !allowedDepartmentIds.includes(departmentId))) {
            throw new Error("Forbidden: You do not have permission to view this department's insights.");
        }

        const cacheKey = WorkspaceRedisService.buildKey("deptinsight", workspaceId, departmentId);

        return await WorkspaceRedisService.getOrComputeWithStampedeProtection(
            cacheKey,
            async () => {
                const insight = await WorkspaceRepository.getDepartmentInsight(workspaceId, departmentId);
                if (!insight) {
                    throw new Error("Department not found.");
                }
                return insight;
            },
            300
        );
    }

    /**
     * Retrieves permission-filtered activity feed.
     */
    static async getActivityFeed(
        workspaceId: string,
        actorUserId: string,
        options?: {
            departmentId?: string;
            actorId?: string;
            eventType?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ events: WorkspaceActivityEvent[]; total: number }> {
        const { isAdmin, allowedDepartmentIds } = await this.resolveDepartmentScope(workspaceId, actorUserId);

        // If filtering by specific department, verify authorization
        if (options?.departmentId && !isAdmin) {
            if (!allowedDepartmentIds || !allowedDepartmentIds.includes(options.departmentId)) {
                throw new Error("Forbidden: You cannot view activity for this restricted department.");
            }
        }

        return WorkspaceRepository.getActivityFeed(workspaceId, allowedDepartmentIds, options);
    }

    /**
     * Retrieves administrative audit logs (strictly append-only).
     */
    static async getAuditLogs(
        workspaceId: string,
        actorUserId: string,
        options?: {
            actorId?: string;
            action?: string;
            targetType?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ logs: WorkspaceAuditLogEntry[]; total: number }> {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context || (!context.member && !context.isOwner)) {
            throw new Error("Unauthorized: You are not an active member of this workspace.");
        }

        const canViewAudit =
            context.isOwner ||
            context.isAdmin ||
            context.isWorkspaceManager ||
            context.permissions.includes("audit:view") ||
            context.permissions.includes("audit:read") ||
            context.permissions.includes("*");

        if (!canViewAudit) {
            throw new Error("Forbidden: Only authorized administrators may view audit logs.");
        }

        return WorkspaceRepository.listAuditLogs(workspaceId, options);
    }

    /**
     * Unified, strictly permission-filtered search across workspace resources.
     */
    static async searchWorkspace(
        workspaceId: string,
        actorUserId: string,
        queryText: string,
        options?: {
            type?: WorkspaceSearchResultType | "all";
            departmentId?: string;
            startDate?: string;
            endDate?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<WorkspaceSearchResponse> {
        const { allowedDepartmentIds } = await this.resolveDepartmentScope(workspaceId, actorUserId);

        // Identify private channels the user has permission to access
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context || (!context.member && !context.isOwner)) {
            throw new Error("Unauthorized: You are not an active member of this workspace.");
        }
        let allowedPrivateChannelIds: string[] = [];

        if (context.isOwner || context.isAdmin || context.isWorkspaceManager) {
            // Admins can search all private channels
            const allPrivateChannels = await query(
                `SELECT id FROM public.workspace_channels WHERE workspace_id = $1 AND is_private = true;`,
                [workspaceId]
            );
            allowedPrivateChannelIds = allPrivateChannels.rows.map((r) => r.id);
        } else {
            // Find private channels where user has department membership OR explicit override or role permit
            const accessibleChannels = await query(
                `SELECT c.id
                 FROM public.workspace_channels c
                 LEFT JOIN public.workspace_channel_overrides o 
                     ON o.channel_id = c.id AND (
                         (o.member_id = $2) OR
                         (o.role_id = $3)
                     )
                 WHERE c.workspace_id = $1 AND c.is_private = true
                   AND (
                       (c.department_id IS NOT NULL AND c.department_id = ANY($4::uuid[]))
                       OR (o.allow_permissions @> '["channels:view"]'::jsonb)
                   );`,
                [
                    workspaceId,
                    context.member?.id || "00000000-0000-0000-0000-000000000000",
                    context.member?.roleId || "00000000-0000-0000-0000-000000000000",
                    allowedDepartmentIds || [],
                ]
            );
            allowedPrivateChannelIds = accessibleChannels.rows.map((r) => r.id);
        }

        return WorkspaceRepository.searchWorkspace(
            workspaceId,
            queryText,
            allowedDepartmentIds,
            allowedPrivateChannelIds,
            options
        );
    }
}
