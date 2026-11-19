// Backend/src/services/workspace/workspaceDashboardService.ts
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceCapabilityService } from "./workspaceCapabilityService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { query } from "../../database/client.js";
import type {
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    WorkspaceActivityEvent,
    WorkspaceAuditLogEntry,
    WorkspaceHistoryItem,
    WorkspaceHistoryRecordType,
    WorkspaceHistoryResponse,
    WorkspaceHistoryScope,
    WorkspaceHistorySource,
    WorkspaceSearchResponse,
    WorkspaceSearchResultType,
} from "../../types/workspaceTypes.js";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeCsvCell(raw: unknown): string {
    if (raw === null || raw === undefined) return "";
    let str = typeof raw === "string" ? raw : JSON.stringify(raw);
    // Guard against spreadsheet formula injection
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }
    if (/[",\n\r]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

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
     * Resolves canonical workspace context + capability flags for history access.
     */
    private static async resolveHistoryAccess(workspaceId: string, actorUserId: string) {
        const context = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!context || (!context.member && !context.isOwner)) {
            throw new Error("Unauthorized: You are not an active member of this workspace.");
        }
        if (context.member && (context.member.isSuspended || context.member.membershipStatus !== "active")) {
            throw new Error("Forbidden: Active workspace membership is required.");
        }

        const capabilities = await WorkspaceCapabilityService.resolveMemberCapabilities(workspaceId, actorUserId);
        const isGlobal = Boolean(
            context.isClubAccount ||
            context.isOwner ||
            context.isAdmin ||
            context.isWorkspaceManager
        );
        const canViewAudit = Boolean(
            context.isClubAccount ||
            context.isOwner ||
            context.isAdmin ||
            capabilities.navigation.canViewAuditLogs
        );

        let allowedDepartmentIds: string[] | null = null;
        if (!isGlobal) {
            const deptIds = new Set<string>();
            if (context.member?.departmentId) deptIds.add(context.member.departmentId);
            (context.leadDepartmentIds || []).forEach((id) => deptIds.add(id));
            (capabilities.capabilities.departments.memberDepartmentIds || []).forEach((id) => deptIds.add(id));
            allowedDepartmentIds = Array.from(deptIds);
        }

        return { context, capabilities, isGlobal, canViewAudit, allowedDepartmentIds };
    }

    /**
     * Unified, strictly permission-filtered workspace history (Activity + Audit).
     */
    static async getWorkspaceHistory(
        workspaceId: string,
        actorUserId: string,
        options?: {
            scope?: WorkspaceHistoryScope;
            recordType?: WorkspaceHistoryRecordType;
            category?: string;
            departmentId?: string;
            actorId?: string;
            targetType?: string;
            search?: string;
            startDate?: string;
            endDate?: string;
            cursor?: string;
            limit?: number;
            includeAuditDetails?: boolean;
        }
    ): Promise<WorkspaceHistoryResponse> {
        const auth = await this.resolveHistoryAccess(workspaceId, actorUserId);

        const scope: WorkspaceHistoryScope =
            options?.scope === "department" || options?.scope === "personal"
                ? options.scope
                : "workspace";

        const recordType: WorkspaceHistoryRecordType =
            options?.recordType === "audit" || options?.recordType === "activity"
                ? options.recordType
                : "all";

        // Enforce audit boundary server-side
        if (recordType === "audit" && !auth.canViewAudit) {
            throw new Error("Forbidden: Only authorized administrators may view administrative audit records.");
        }

        // Validate UUID filters when supplied
        if (options?.departmentId) {
            if (!UUID_REGEX.test(options.departmentId)) {
                throw new Error("Bad Request: Invalid departmentId format.");
            }
            if (!auth.isGlobal && (!auth.allowedDepartmentIds || !auth.allowedDepartmentIds.includes(options.departmentId))) {
                throw new Error("Forbidden: You cannot view history for this restricted department.");
            }
        }

        if (options?.actorId && !UUID_REGEX.test(options.actorId)) {
            throw new Error("Bad Request: Invalid actorId format.");
        }

        if (options?.startDate && Number.isNaN(Date.parse(options.startDate))) {
            throw new Error("Bad Request: Invalid startDate parameter.");
        }
        if (options?.endDate && Number.isNaN(Date.parse(options.endDate))) {
            throw new Error("Bad Request: Invalid endDate parameter.");
        }

        // Personal scope strictly locks actor filter to authenticated caller
        const effectiveActorId = scope === "personal" ? actorUserId : options?.actorId;

        // Avoid sending full heavy audit payloads on list rows; Inspect fetches full payload on demand
        const includeAuditDetails = Boolean(options?.includeAuditDetails && auth.canViewAudit);

        const result = await WorkspaceRepository.getWorkspaceHistory(workspaceId, {
            allowedDepartmentIds: auth.allowedDepartmentIds,
            canViewAudit: auth.canViewAudit,
            scope,
            recordType,
            ...(options?.category !== undefined ? { category: options.category } : {}),
            ...(options?.departmentId !== undefined ? { departmentId: options.departmentId } : {}),
            ...(effectiveActorId !== undefined ? { actorId: effectiveActorId } : {}),
            ...(options?.targetType !== undefined ? { targetType: options.targetType } : {}),
            ...(options?.search !== undefined ? { search: options.search } : {}),
            ...(options?.startDate !== undefined ? { startDate: options.startDate } : {}),
            ...(options?.endDate !== undefined ? { endDate: options.endDate } : {}),
            ...(options?.cursor !== undefined ? { cursor: options.cursor } : {}),
            limit: Math.min(Math.max(options?.limit ?? 25, 1), 100),
            includeAuditDetails,
        });

        return {
            ...result,
            permissions: {
                canViewAudit: auth.canViewAudit,
                canExport: auth.canViewAudit,
                scope: auth.isGlobal ? "global" : scope === "personal" ? "personal" : "department",
            },
        };
    }

    /**
     * Retrieves complete authorized inspection payload for one history record.
     */
    static async inspectHistoryItem(
        workspaceId: string,
        actorUserId: string,
        itemId: string,
        source: WorkspaceHistorySource
    ): Promise<WorkspaceHistoryItem> {
        if (!UUID_REGEX.test(itemId)) {
            throw new Error("Bad Request: Invalid history record ID.");
        }
        if (source !== "activity" && source !== "audit") {
            throw new Error("Bad Request: Invalid history source.");
        }

        const auth = await this.resolveHistoryAccess(workspaceId, actorUserId);

        if (source === "audit" && !auth.canViewAudit) {
            throw new Error("Forbidden: Only authorized administrators may inspect audit records.");
        }

        const item = await WorkspaceRepository.inspectHistoryItem(
            workspaceId,
            itemId,
            source,
            auth.allowedDepartmentIds,
            auth.canViewAudit
        );

        if (!item) {
            throw new Error("Forbidden: History record not found or access denied.");
        }

        return item;
    }

    /**
     * Streams filtered history export (CSV or JSON) for authorized administrators/compliance users.
     */
    static async exportWorkspaceHistory(
        workspaceId: string,
        actorUserId: string,
        format: "csv" | "json",
        options: {
            scope?: WorkspaceHistoryScope;
            recordType?: WorkspaceHistoryRecordType;
            category?: string;
            departmentId?: string;
            actorId?: string;
            targetType?: string;
            search?: string;
            startDate?: string;
            endDate?: string;
        },
        writeChunk: (chunk: string) => void
    ): Promise<{ count: number }> {
        const auth = await this.resolveHistoryAccess(workspaceId, actorUserId);
        if (!auth.canViewAudit) {
            throw new Error("Forbidden: You do not have permission to export workspace history.");
        }

        if (options.departmentId && !UUID_REGEX.test(options.departmentId)) {
            throw new Error("Bad Request: Invalid departmentId format.");
        }
        if (options.actorId && !UUID_REGEX.test(options.actorId)) {
            throw new Error("Bad Request: Invalid actorId format.");
        }
        if (options.startDate && Number.isNaN(Date.parse(options.startDate))) {
            throw new Error("Bad Request: Invalid startDate parameter.");
        }
        if (options.endDate && Number.isNaN(Date.parse(options.endDate))) {
            throw new Error("Bad Request: Invalid endDate parameter.");
        }

        const scope: WorkspaceHistoryScope =
            options.scope === "department" || options.scope === "personal" ? options.scope : "workspace";
        const effectiveActorId = scope === "personal" ? actorUserId : options.actorId;
        const recordType: WorkspaceHistoryRecordType =
            options.recordType === "audit" || options.recordType === "activity" ? options.recordType : "all";

        if (format === "csv") {
            writeChunk(
                "Timestamp,Source,Sources,Category,EventType,ActorName,ActorUsername,Department,TargetType,TargetId,TargetLabel,Summary,IpAddress,UserAgent,Details\n"
            );
        } else {
            writeChunk("{\n  \"exportedAt\": " + JSON.stringify(new Date().toISOString()) + ",\n  \"items\": [\n");
        }

        let cursor: string | undefined = undefined;
        let hasMore = true;
        let count = 0;
        let firstJson = true;
        const maxExportRows = 10000;

        while (hasMore && count < maxExportRows) {
            const batch = await WorkspaceRepository.getWorkspaceHistory(workspaceId, {
                allowedDepartmentIds: auth.allowedDepartmentIds,
                canViewAudit: true,
                scope,
                recordType,
                ...(options.category !== undefined ? { category: options.category } : {}),
                ...(options.departmentId !== undefined ? { departmentId: options.departmentId } : {}),
                ...(effectiveActorId !== undefined ? { actorId: effectiveActorId } : {}),
                ...(options.targetType !== undefined ? { targetType: options.targetType } : {}),
                ...(options.search !== undefined ? { search: options.search } : {}),
                ...(options.startDate !== undefined ? { startDate: options.startDate } : {}),
                ...(options.endDate !== undefined ? { endDate: options.endDate } : {}),
                ...(cursor !== undefined ? { cursor } : {}),
                limit: 200,
                includeAuditDetails: true,
            });

            for (const item of batch.items) {
                if (count >= maxExportRows) break;
                count++;

                if (format === "csv") {
                    const row = [
                        item.createdAt,
                        item.source.toUpperCase(),
                        (item.sources || [item.source]).join("+"),
                        item.category,
                        item.eventType,
                        item.actor.name,
                        item.actor.username || "",
                        item.department?.name || "",
                        item.target?.type || "",
                        item.target?.id || "",
                        item.target?.label || "",
                        item.summary,
                        item.auditDetails?.ipAddress || "",
                        item.auditDetails?.userAgent || "",
                        item.auditDetails?.details || item.activityDetails?.metadata || {},
                    ]
                        .map(escapeCsvCell)
                        .join(",");
                    writeChunk(row + "\n");
                } else {
                    const prefix = firstJson ? "    " : ",\n    ";
                    firstJson = false;
                    writeChunk(prefix + JSON.stringify(item));
                }
            }

            hasMore = batch.hasMore;
            cursor = batch.nextCursor || undefined;
            if (!cursor) break;
        }

        if (format === "json") {
            writeChunk(`\n  ],\n  "count": ${count}\n}\n`);
        }

        return { count };
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
