// Backend/src/repositories/workspaceRepository.ts
import { pool, query } from "../database/client.js";
import type {
    TeamWorkspace,
    WorkspaceRole,
    WorkspaceMember,
    WorkspaceDepartment,
    WorkspaceDepartmentMember,
    WorkspaceInvitation,
    WorkspaceAuditLog,
    WorkspaceMembershipStatus,
    WorkspaceChannelCategory,
    WorkspaceChannelType,
    WorkspaceChannel,
    WorkspaceChannelOverride,
    WorkspaceMessage,
    WorkspaceThread,
    WorkspaceFile,
    WorkspaceTask,
    WorkspaceTaskStatus,
    WorkspaceTaskPriority,
    WorkspaceTaskChecklistItem,
    WorkspaceTaskReferenceLink,
    WorkspaceTaskAssignment,
    WorkspaceTaskSubmission,
    WorkspaceTaskReview,
    WorkspaceTaskComment,
    WorkspaceTaskWatcher,
    WorkspaceTaskActivity,
    WorkspaceFileUploadIntent,
    WorkspaceFileListFilters,
    WorkspaceStorageQuotaInfo,
    WorkspaceNotification,
    WorkspaceNotificationEventType,
    WorkspaceNotificationResourceType,
    WorkspaceOutboxEvent,
    WorkspaceOutboxStatus,
    WorkspaceEmailType,
    WorkspaceEmailDeliveryStatus,
    WorkspaceEmailDelivery,
    WorkspaceNotificationPreferences,
    WorkspaceActivityEvent,
    WorkspaceActivityEventType,
    WorkspaceOverviewMetrics,
    WorkspaceDepartmentInsight,
    WorkspaceAuditLogEntry,
    WorkspaceSearchResultItem,
    WorkspaceSearchResultType,
    WorkspaceSearchResponse,
    WorkspaceRecognitionPolicy,
    WorkspaceRecognitionCategory,
    WorkspaceRecognitionBudget,
    WorkspaceRecognitionLedgerEntry,
    WorkspaceRecognitionPeriodAggregate,
    MemberRecognitionSummary,
    LeaderboardPeriod,
    ThreeLeaderboardsResponse,
    WorkspaceAnalyticsSummary,
    IndividualMemberAnalytics,
} from "../types/workspaceTypes.js";

export class WorkspaceRepository {
    // =========================================================================
    // 1. WORKSPACE CORE & WORKSPACE MANAGER
    // =========================================================================

    static async findById(workspaceId: string): Promise<TeamWorkspace | null> {
        const res = await query(
            `SELECT
                id,
                club_id AS "clubId",
                owner_id AS "ownerId",
                manager_user_id AS "managerUserId",
                manager_appointed_at AS "managerAppointedAt",
                COALESCE(manager_permissions, '[]'::jsonb) AS "managerPermissions",
                name,
                slug,
                description,
                icon_url AS "iconUrl",
                workspace_status AS "workspaceStatus",
                schema_version AS "schemaVersion",
                settings,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.team_workspaces
             WHERE id = $1
             LIMIT 1;`,
            [workspaceId]
        );
        return res.rows[0] || null;
    }


    static async findByClubId(clubId: string): Promise<TeamWorkspace | null> {
        const res = await query(
            `SELECT
                id,
                club_id AS "clubId",
                owner_id AS "ownerId",
                manager_user_id AS "managerUserId",
                manager_appointed_at AS "managerAppointedAt",
                COALESCE(manager_permissions, '[]'::jsonb) AS "managerPermissions",
                name,
                slug,
                description,
                icon_url AS "iconUrl",
                workspace_status AS "workspaceStatus",
                schema_version AS "schemaVersion",
                settings,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.team_workspaces
             WHERE club_id = $1
             LIMIT 1;`,
            [clubId]
        );
        return res.rows[0] || null;
    }


    static async create(client: any, data: {
        clubId: string;
        ownerId: string;
        name: string;
        slug: string;
        description?: string | null;
        iconUrl?: string | null;
        settings?: Record<string, any>;
    }): Promise<TeamWorkspace> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.team_workspaces (
                club_id,
                owner_id,
                name,
                slug,
                description,
                icon_url,
                settings,
                workspace_status,
                schema_version,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7::jsonb, 'active', 1, NOW(), NOW()
            )
            RETURNING
                id,
                club_id AS "clubId",
                owner_id AS "ownerId",
                manager_user_id AS "managerUserId",
                manager_appointed_at AS "managerAppointedAt",
                manager_permissions AS "managerPermissions",
                name,
                slug,
                description,
                icon_url AS "iconUrl",
                workspace_status AS "workspaceStatus",
                schema_version AS "schemaVersion",
                settings,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.clubId,
                data.ownerId,
                data.name,
                data.slug,
                data.description || null,
                data.iconUrl || null,
                JSON.stringify(data.settings || { allowMemberInvites: true, theme: "neo" }),
            ]
        );
        return res.rows[0];
    }

    static async setWorkspaceManager(
        workspaceId: string,
        managerUserId: string | null,
        permissions: Record<string, any> | string[] = []
    ): Promise<TeamWorkspace | null> {
        const permsJson = typeof permissions === "string" ? permissions : JSON.stringify(permissions);
        const res = await query(
            `UPDATE public.team_workspaces
             SET manager_user_id = $2::uuid,
                 manager_appointed_at = CASE WHEN $2::uuid IS NOT NULL THEN NOW() ELSE NULL END,
                 manager_permissions = $3::jsonb,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING
                id,
                club_id AS "clubId",
                owner_id AS "ownerId",
                manager_user_id AS "managerUserId",
                manager_appointed_at AS "managerAppointedAt",
                manager_permissions AS "managerPermissions",
                name,
                slug,
                description,
                icon_url AS "iconUrl",
                workspace_status AS "workspaceStatus",
                schema_version AS "schemaVersion",
                settings,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [workspaceId, managerUserId, permsJson]
        );
        return res.rows[0] || null;
    }


    static async updateSettings(
        workspaceId: string,
        settings: Record<string, any>
    ): Promise<TeamWorkspace | null> {
        const res = await query(
            `UPDATE public.team_workspaces
             SET settings = settings || $2::jsonb,
                 updated_at = NOW()
             WHERE id = $1
             RETURNING
                id,
                club_id AS "clubId",
                owner_id AS "ownerId",
                manager_user_id AS "managerUserId",
                manager_appointed_at AS "managerAppointedAt",
                manager_permissions AS "managerPermissions",
                name,
                slug,
                description,
                icon_url AS "iconUrl",
                workspace_status AS "workspaceStatus",
                schema_version AS "schemaVersion",
                settings,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [workspaceId, JSON.stringify(settings)]
        );
        return res.rows[0] || null;
    }


    // =========================================================================
    // 2. WORKSPACE DEPARTMENTS
    // =========================================================================

    static async listDepartments(workspaceId: string, includeArchived = false): Promise<WorkspaceDepartment[]> {
        const filter = includeArchived ? "" : "AND wd.status = 'active'";
        const res = await query(
            `SELECT
                wd.id,
                wd.workspace_id AS "workspaceId",
                wd.club_team_id AS "clubTeamId",
                wd.name,
                wd.slug,
                wd.description,
                wd.icon,
                wd.color,
                wd.lead_user_id AS "leadUserId",
                COALESCE(wd.co_lead_user_ids, '[]'::jsonb) AS "coLeadUserIds",
                wd.display_order AS "displayOrder",
                wd.status,
                wd.created_at AS "createdAt",
                wd.updated_at AS "updatedAt",
                (SELECT COUNT(*)::int FROM public.workspace_department_members wdm WHERE wdm.department_id = wd.id) AS "memberCount",
                CASE WHEN u.id IS NOT NULL THEN
                    json_build_object(
                        'id', u.id,
                        'email', u.email,
                        'username', u.username,
                        'firstName', u.firstname,
                        'lastName', u.lastname,
                        'avatarUrl', u.avatar_url
                    )
                ELSE NULL END AS "leadUser"
             FROM public.workspace_departments wd
             LEFT JOIN public.users u ON u.id = wd.lead_user_id
             WHERE wd.workspace_id = $1 ${filter}
             ORDER BY wd.display_order ASC, wd.created_at ASC;`,
            [workspaceId]
        );
        return res.rows;
    }

    static async findDepartmentById(workspaceId: string, departmentId: string): Promise<WorkspaceDepartment | null> {
        const res = await query(
            `SELECT
                wd.id,
                wd.workspace_id AS "workspaceId",
                wd.club_team_id AS "clubTeamId",
                wd.name,
                wd.slug,
                wd.description,
                wd.icon,
                wd.color,
                wd.lead_user_id AS "leadUserId",
                COALESCE(wd.co_lead_user_ids, '[]'::jsonb) AS "coLeadUserIds",
                wd.display_order AS "displayOrder",
                wd.status,
                wd.created_at AS "createdAt",
                wd.updated_at AS "updatedAt",
                (SELECT COUNT(*)::int FROM public.workspace_department_members wdm WHERE wdm.department_id = wd.id) AS "memberCount",
                CASE WHEN u.id IS NOT NULL THEN
                    json_build_object(
                        'id', u.id,
                        'email', u.email,
                        'username', u.username,
                        'firstName', u.firstname,
                        'lastName', u.lastname,
                        'avatarUrl', u.avatar_url
                    )
                ELSE NULL END AS "leadUser"
             FROM public.workspace_departments wd
             LEFT JOIN public.users u ON u.id = wd.lead_user_id
             WHERE wd.workspace_id = $1 AND wd.id = $2
             LIMIT 1;`,
            [workspaceId, departmentId]
        );
        return res.rows[0] || null;
    }


    static async findDepartmentBySlug(workspaceId: string, slug: string): Promise<WorkspaceDepartment | null> {
        const res = await query(
            `SELECT
                wd.id,
                wd.workspace_id AS "workspaceId",
                wd.club_team_id AS "clubTeamId",
                wd.name,
                wd.slug,
                wd.description,
                wd.icon,
                wd.color,
                wd.lead_user_id AS "leadUserId",
                COALESCE(wd.co_lead_user_ids, '[]'::jsonb) AS "coLeadUserIds",
                wd.display_order AS "displayOrder",
                wd.status,
                wd.created_at AS "createdAt",
                wd.updated_at AS "updatedAt"
             FROM public.workspace_departments wd
             WHERE wd.workspace_id = $1 AND wd.slug = $2
             LIMIT 1;`,
            [workspaceId, slug]
        );
        return res.rows[0] || null;
    }


    static async createDepartment(client: any, data: {
        workspaceId: string;
        name: string;
        slug: string;
        description?: string | null;
        icon?: string;
        color?: string;
        leadUserId?: string | null;
        coLeadUserIds?: string[];
        displayOrder?: number;
    }): Promise<WorkspaceDepartment> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_departments (
                workspace_id,
                name,
                slug,
                description,
                icon,
                color,
                lead_user_id,
                co_lead_user_ids,
                display_order,
                status,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, 'active', NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                club_team_id AS "clubTeamId",
                name,
                slug,
                description,
                icon,
                color,
                lead_user_id AS "leadUserId",
                co_lead_user_ids AS "coLeadUserIds",
                display_order AS "displayOrder",
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.name,
                data.slug,
                data.description || null,
                data.icon || "Folder",
                data.color || "#2563eb",
                data.leadUserId || null,
                JSON.stringify(data.coLeadUserIds || []),
                data.displayOrder ?? 0,
            ]
        );
        return res.rows[0];
    }

    static async updateDepartment(
        workspaceId: string,
        departmentId: string,
        updates: {
            name?: string;
            description?: string | null;
            icon?: string;
            color?: string;
            leadUserId?: string | null;
            coLeadUserIds?: string[];
            displayOrder?: number;
        }
    ): Promise<WorkspaceDepartment | null> {
        const setClauses: string[] = ["updated_at = NOW()"];
        const params: any[] = [workspaceId, departmentId];
        let idx = 3;

        if (updates.name !== undefined) {
            setClauses.push(`name = $${idx++}`);
            params.push(updates.name);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${idx++}`);
            params.push(updates.description);
        }
        if (updates.icon !== undefined) {
            setClauses.push(`icon = $${idx++}`);
            params.push(updates.icon);
        }
        if (updates.color !== undefined) {
            setClauses.push(`color = $${idx++}`);
            params.push(updates.color);
        }
        if (updates.leadUserId !== undefined) {
            setClauses.push(`lead_user_id = $${idx++}`);
            params.push(updates.leadUserId);
        }
        if (updates.coLeadUserIds !== undefined) {
            setClauses.push(`co_lead_user_ids = $${idx++}::jsonb`);
            params.push(JSON.stringify(updates.coLeadUserIds));
        }
        if (updates.displayOrder !== undefined) {
            setClauses.push(`display_order = $${idx++}`);
            params.push(updates.displayOrder);
        }

        const res = await query(
            `UPDATE public.workspace_departments
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                club_team_id AS "clubTeamId",
                name,
                slug,
                description,
                icon,
                color,
                lead_user_id AS "leadUserId",
                co_lead_user_ids AS "coLeadUserIds",
                display_order AS "displayOrder",
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            params
        );
        return res.rows[0] || null;
    }


    static async setDepartmentStatus(
        workspaceId: string,
        departmentId: string,
        status: "active" | "archived"
    ): Promise<WorkspaceDepartment | null> {
        await query(
            `UPDATE public.workspace_departments
             SET status = $3,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, departmentId, status]
        );
        return this.findDepartmentById(workspaceId, departmentId);
    }

    static async reorderDepartments(
        workspaceId: string,
        departmentIds: string[]
    ): Promise<boolean> {
        for (let i = 0; i < departmentIds.length; i++) {
            await query(
                `UPDATE public.workspace_departments
                 SET display_order = $1, updated_at = NOW()
                 WHERE workspace_id = $2 AND id = $3;`,
                [i, workspaceId, departmentIds[i]]
            );
        }
        return true;
    }

    // =========================================================================
    // 3. MULTI-DEPARTMENT MEMBERSHIP JUNCTION
    // =========================================================================

    static async addDepartmentMember(client: any, data: {
        workspaceId: string;
        departmentId: string;
        memberId: string;
        userId: string;
        departmentRole?: "lead" | "co_lead" | "member";
        roleTitle?: string;
        assignedBy?: string | null;
    }): Promise<WorkspaceDepartmentMember> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_department_members (
                workspace_id,
                department_id,
                member_id,
                user_id,
                department_role,
                role_title,
                assigned_by,
                joined_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, NOW()
            )
            ON CONFLICT (department_id, member_id) DO UPDATE SET
                department_role = EXCLUDED.department_role,
                role_title = EXCLUDED.role_title
            RETURNING
                id,
                workspace_id AS "workspaceId",
                department_id AS "departmentId",
                member_id AS "memberId",
                user_id AS "userId",
                department_role AS "departmentRole",
                role_title AS "roleTitle",
                joined_at AS "joinedAt",
                assigned_by AS "assignedBy";`,
            [
                data.workspaceId,
                data.departmentId,
                data.memberId,
                data.userId,
                data.departmentRole || "member",
                data.roleTitle || "Department Member",
                data.assignedBy || null,
            ]
        );
        return res.rows[0];
    }

    static async removeDepartmentMember(
        workspaceId: string,
        departmentId: string,
        memberId: string
    ): Promise<boolean> {
        const res = await query(
            `DELETE FROM public.workspace_department_members
             WHERE workspace_id = $1 AND department_id = $2 AND member_id = $3;`,
            [workspaceId, departmentId, memberId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    static async updateDepartmentMemberRole(
        workspaceId: string,
        departmentId: string,
        memberId: string,
        updates: { departmentRole?: "lead" | "co_lead" | "member"; roleTitle?: string }
    ): Promise<boolean> {
        const setClauses: string[] = [];
        const params: any[] = [workspaceId, departmentId, memberId];
        let idx = 4;

        if (updates.departmentRole) {
            setClauses.push(`department_role = $${idx++}`);
            params.push(updates.departmentRole);
        }
        if (updates.roleTitle !== undefined) {
            setClauses.push(`role_title = $${idx++}`);
            params.push(updates.roleTitle);
        }

        if (setClauses.length === 0) return false;

        const res = await query(
            `UPDATE public.workspace_department_members
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND department_id = $2 AND member_id = $3;`,
            params
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async transferDepartmentMember(
        workspaceId: string,
        memberId: string,
        userId: string,
        fromDeptId: string,
        toDeptId: string,
        assignedBy?: string | null
    ): Promise<boolean> {
        // Delete from previous department and insert into target department in one step
        await query(
            `DELETE FROM public.workspace_department_members
             WHERE workspace_id = $1 AND department_id = $2 AND member_id = $3;`,
            [workspaceId, fromDeptId, memberId]
        );

        await this.addDepartmentMember(null, {
            workspaceId,
            departmentId: toDeptId,
            memberId,
            userId,
            departmentRole: "member",
            roleTitle: "Department Member",
            assignedBy: assignedBy || null,
        });

        return true;
    }

    static async listDepartmentMembers(
        workspaceId: string,
        departmentId: string
    ): Promise<WorkspaceDepartmentMember[]> {
        const res = await query(
            `SELECT
                wdm.id,
                wdm.workspace_id AS "workspaceId",
                wdm.department_id AS "departmentId",
                wdm.member_id AS "memberId",
                wdm.user_id AS "userId",
                wdm.department_role AS "departmentRole",
                wdm.role_title AS "roleTitle",
                wdm.joined_at AS "joinedAt",
                wdm.assigned_by AS "assignedBy",
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "user"
             FROM public.workspace_department_members wdm
             JOIN public.users u ON u.id = wdm.user_id
             WHERE wdm.workspace_id = $1 AND wdm.department_id = $2
             ORDER BY
                CASE wdm.department_role WHEN 'lead' THEN 1 WHEN 'co_lead' THEN 2 ELSE 3 END,
                wdm.joined_at ASC;`,
            [workspaceId, departmentId]
        );
        return res.rows;
    }

    static async listMemberDepartments(
        workspaceId: string,
        memberId: string
    ): Promise<WorkspaceDepartment[]> {
        const res = await query(
            `SELECT
                wd.id,
                wd.workspace_id AS "workspaceId",
                wd.name,
                wd.slug,
                wd.description,
                wd.icon,
                wd.color,
                wd.status,
                wdm.department_role AS "departmentRole",
                wdm.role_title AS "roleTitle"
             FROM public.workspace_department_members wdm
             JOIN public.workspace_departments wd ON wd.id = wdm.department_id
             WHERE wdm.workspace_id = $1 AND wdm.member_id = $2 AND wd.status = 'active'
             ORDER BY wd.display_order ASC;`,
            [workspaceId, memberId]
        );
        return res.rows;
    }

    // =========================================================================
    // 4. WORKSPACE ROLES
    // =========================================================================

    static async listRoles(workspaceId: string): Promise<WorkspaceRole[]> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                rank,
                is_system AS "isSystem",
                color,
                permissions,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_roles
             WHERE workspace_id = $1
             ORDER BY rank DESC;`,
            [workspaceId]
        );
        return res.rows;
    }

    static async findRoleBySlug(workspaceId: string, slug: string): Promise<WorkspaceRole | null> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                rank,
                is_system AS "isSystem",
                color,
                permissions,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_roles
             WHERE workspace_id = $1 AND slug = $2
             LIMIT 1;`,
            [workspaceId, slug]
        );
        return res.rows[0] || null;
    }


    static async findRoleById(workspaceId: string, roleId: string): Promise<WorkspaceRole | null> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                rank,
                is_system AS "isSystem",
                color,
                permissions,
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_roles
             WHERE workspace_id = $1 AND id = $2
             LIMIT 1;`,
            [workspaceId, roleId]
        );
        return res.rows[0] || null;
    }


    static async createRole(client: any, data: {
        workspaceId: string;
        name: string;
        slug: string;
        description?: string;
        rank: number;
        isSystem?: boolean;
        color?: string;
        permissions: string[];
    }): Promise<WorkspaceRole> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_roles (
                workspace_id,
                name,
                slug,
                description,
                rank,
                is_system,
                color,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8::jsonb, NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                rank,
                is_system AS "isSystem",
                color,
                permissions,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.name,
                data.slug,
                data.description || null,
                data.rank,
                data.isSystem ?? false,
                data.color || "#000000",
                JSON.stringify(data.permissions || []),
            ]
        );
        return res.rows[0];
    }

    static async updateRole(
        workspaceId: string,
        roleId: string,
        data: {
            name?: string;
            description?: string;
            rank?: number;
            color?: string;
            permissions?: string[];
        }
    ): Promise<WorkspaceRole | null> {
        const fields: string[] = [];
        const params: any[] = [workspaceId, roleId];

        if (data.name !== undefined) {
            params.push(data.name);
            fields.push(`name = $${params.length}`);
        }
        if (data.description !== undefined) {
            params.push(data.description);
            fields.push(`description = $${params.length}`);
        }
        if (data.rank !== undefined) {
            params.push(data.rank);
            fields.push(`rank = $${params.length}`);
        }
        if (data.color !== undefined) {
            params.push(data.color);
            fields.push(`color = $${params.length}`);
        }
        if (data.permissions !== undefined) {
            params.push(JSON.stringify(data.permissions));
            fields.push(`permissions = $${params.length}::jsonb`);
        }

        if (fields.length === 0) {
            return this.findRoleById(workspaceId, roleId);
        }

        fields.push(`updated_at = NOW()`);

        const res = await query(
            `UPDATE public.workspace_roles
             SET ${fields.join(", ")}
             WHERE workspace_id = $1 AND id = $2 AND is_system = false
             RETURNING
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                rank,
                is_system AS "isSystem",
                color,
                permissions,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            params
        );

        return res.rows[0] || null;
    }

    static async deleteRole(
        workspaceId: string,
        roleId: string,
        fallbackRoleId: string
    ): Promise<boolean> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // Reassign any members using this role to fallback role
            await client.query(
                `UPDATE public.workspace_members
                 SET role_id = $3, updated_at = NOW()
                 WHERE workspace_id = $1 AND role_id = $2;`,
                [workspaceId, roleId, fallbackRoleId]
            );

            // Reassign tasks assigned to this role
            await client.query(
                `UPDATE public.workspace_tasks
                 SET assigned_role_id = NULL, updated_at = NOW()
                 WHERE workspace_id = $1 AND assigned_role_id = $2;`,
                [workspaceId, roleId]
            );

            // Delete overrides referencing this role
            await client.query(
                `DELETE FROM public.workspace_channel_overrides
                 WHERE role_id = $1;`,
                [roleId]
            );

            // Delete the custom role
            const delRes = await client.query(
                `DELETE FROM public.workspace_roles
                 WHERE workspace_id = $1 AND id = $2 AND is_system = false
                 RETURNING id;`,
                [workspaceId, roleId]
            );

            await client.query("COMMIT;");
            return (delRes.rowCount || 0) > 0;
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Updates ranks for custom roles in a single transaction.
     */
    static async reorderRoles(
        workspaceId: string,
        roleRankUpdates: { id: string; rank: number }[]
    ): Promise<WorkspaceRole[]> {
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            for (const item of roleRankUpdates) {
                await client.query(
                    `UPDATE public.workspace_roles
                     SET rank = $3, updated_at = NOW()
                     WHERE workspace_id = $1 AND id = $2 AND is_system = false;`,
                    [workspaceId, item.id, item.rank]
                );
            }

            await client.query("COMMIT;");
            return await this.listRoles(workspaceId);
        } catch (err) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    // =========================================================================
    // 5. WORKSPACE MEMBERSHIP (WITH MULTI-DEPARTMENT AGGREGATION)
    // =========================================================================

    static async findMember(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
        const res = await query(
            `SELECT
                wm.id,
                wm.workspace_id AS "workspaceId",
                wm.user_id AS "userId",
                wm.club_membership_id AS "clubMembershipId",
                wm.department_id AS "departmentId",
                wm.role_id AS "roleId",
                wm.role_title AS "roleTitle",
                wm.membership_status AS "membershipStatus",
                wm.is_suspended AS "isSuspended",
                wm.suspended_at AS "suspendedAt",
                wm.suspended_reason AS "suspendedReason",
                wm.suspended_by AS "suspendedBy",
                wm.invited_by AS "invitedBy",
                wm.joined_at AS "joinedAt",
                wm.last_active_at AS "lastActiveAt",
                wm.custom_permissions AS "customPermissions",
                wm.created_at AS "createdAt",
                wm.updated_at AS "updatedAt",
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "user",
                json_build_object(
                    'id', r.id,
                    'name', r.name,
                    'slug', r.slug,
                    'rank', r.rank,
                    'isSystem', r.is_system,
                    'color', r.color,
                    'permissions', r.permissions
                ) AS "role",
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'icon', wd.icon,
                        'color', wd.color,
                        'departmentRole', wdm.department_role,
                        'roleTitle', wdm.role_title
                    ))
                    FROM public.workspace_department_members wdm
                    JOIN public.workspace_departments wd ON wd.id = wdm.department_id
                    WHERE wdm.member_id = wm.id AND wd.status = 'active'
                ), '[]'::json) AS "departments"
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             WHERE wm.workspace_id = $1 AND wm.user_id = $2
             LIMIT 1;`,
            [workspaceId, userId]
        );
        return res.rows[0] || null;
    }

    static async findMemberByUserId(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
        return this.findMember(workspaceId, userId);
    }

    static async listMembers(
        workspaceId: string,
        options: {
            status?: string;
            departmentId?: string;
            roleId?: string;
            search?: string;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ members: WorkspaceMember[]; total: number }> {
        const { status, departmentId, roleId, search, limit = 50, offset = 0 } = options;

        let whereClause = `WHERE wm.workspace_id = $1`;
        const params: any[] = [workspaceId];
        let idx = 2;

        if (status) {
            whereClause += ` AND wm.membership_status = $${idx++}`;
            params.push(status);
        }
        if (departmentId) {
            whereClause += ` AND (wm.id IN (SELECT member_id FROM public.workspace_department_members WHERE department_id = $${idx}))`;
            params.push(departmentId);
            idx++;
        }
        if (roleId) {
            whereClause += ` AND wm.role_id = $${idx++}`;
            params.push(roleId);
        }
        if (search) {
            whereClause += ` AND (u.firstname ILIKE $${idx} OR u.lastname ILIKE $${idx} OR u.username ILIKE $${idx} OR u.email ILIKE $${idx})`;
            params.push(`%${search}%`);
            idx++;
        }

        const countRes = await query(
            `SELECT COUNT(*)::int AS total 
             FROM public.workspace_members wm 
             JOIN public.users u ON u.id = wm.user_id
             ${whereClause};`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        const listQuery = `
            SELECT
                wm.id,
                wm.workspace_id AS "workspaceId",
                wm.user_id AS "userId",
                wm.club_membership_id AS "clubMembershipId",
                wm.department_id AS "departmentId",
                wm.role_id AS "roleId",
                wm.role_title AS "roleTitle",
                wm.membership_status AS "membershipStatus",
                wm.is_suspended AS "isSuspended",
                wm.suspended_at AS "suspendedAt",
                wm.suspended_reason AS "suspendedReason",
                wm.suspended_by AS "suspendedBy",
                wm.invited_by AS "invitedBy",
                wm.joined_at AS "joinedAt",
                wm.last_active_at AS "lastActiveAt",
                wm.custom_permissions AS "customPermissions",
                wm.created_at AS "createdAt",
                wm.updated_at AS "updatedAt",
                json_build_object(
                    'id', u.id,
                    'email', u.email,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "user",
                json_build_object(
                    'id', r.id,
                    'name', r.name,
                    'slug', r.slug,
                    'rank', r.rank,
                    'isSystem', r.is_system,
                    'color', r.color,
                    'permissions', r.permissions
                ) AS "role",
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'icon', wd.icon,
                        'color', wd.color,
                        'departmentRole', wdm.department_role,
                        'roleTitle', wdm.role_title
                    ))
                    FROM public.workspace_department_members wdm
                    JOIN public.workspace_departments wd ON wd.id = wdm.department_id
                    WHERE wdm.member_id = wm.id AND wd.status = 'active'
                ), '[]'::json) AS "departments"
            FROM public.workspace_members wm
            JOIN public.users u ON u.id = wm.user_id
            JOIN public.workspace_roles r ON r.id = wm.role_id
            ${whereClause}
            ORDER BY r.rank DESC, wm.joined_at ASC
            LIMIT $${idx++} OFFSET $${idx++};
        `;
        params.push(limit, offset);

        const listRes = await query(listQuery, params);
        return { members: listRes.rows, total };
    }

    static async createMember(client: any, data: {
        workspaceId: string;
        userId: string;
        roleId: string;
        clubMembershipId?: string | null;
        departmentId?: string | null;
        roleTitle?: string;
        membershipStatus?: WorkspaceMembershipStatus;
        invitedBy?: string | null;
    }): Promise<WorkspaceMember> {
        const targetClient = client?.query ? client : { query };

        // Enforce rule: Club managers cannot join other club workspaces with any role
        const wsRes = await targetClient.query(
            `SELECT club_id, owner_id FROM public.team_workspaces WHERE id = $1 LIMIT 1;`,
            [data.workspaceId]
        );
        const ws = wsRes.rows[0];
        if (ws && ws.owner_id !== data.userId) {
            const isClubManager = await targetClient.query(
                `SELECT id, name FROM public.verified_clubs WHERE auth_user_id = $1 AND id != $2 AND is_active = true LIMIT 1;`,
                [data.userId, ws.club_id]
            );
            if (isClubManager.rows.length > 0) {
                throw new Error("Club managers are not permitted to join other club workspaces with any role.");
            }
        }

        const res = await targetClient.query(
            `INSERT INTO public.workspace_members (
                workspace_id,
                user_id,
                club_membership_id,
                department_id,
                role_id,
                role_title,
                membership_status,
                is_suspended,
                invited_by,
                joined_at,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, false, $8, NOW(), NOW(), NOW()
            )
            ON CONFLICT (workspace_id, user_id) DO UPDATE SET
                membership_status = EXCLUDED.membership_status,
                role_id = EXCLUDED.role_id,
                role_title = EXCLUDED.role_title,
                updated_at = NOW()
            RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                club_membership_id AS "clubMembershipId",
                department_id AS "departmentId",
                role_id AS "roleId",
                role_title AS "roleTitle",
                membership_status AS "membershipStatus",
                is_suspended AS "isSuspended",
                suspended_at AS "suspendedAt",
                suspended_reason AS "suspendedReason",
                suspended_by AS "suspendedBy",
                invited_by AS "invitedBy",
                joined_at AS "joinedAt",
                last_active_at AS "lastActiveAt",
                custom_permissions AS "customPermissions",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.userId,
                data.clubMembershipId || null,
                data.departmentId || null,
                data.roleId,
                data.roleTitle || "Member",
                data.membershipStatus || "active",
                data.invitedBy || null,
            ]
        );
        return res.rows[0];
    }

    static async updateMemberSuspension(
        workspaceId: string,
        userId: string,
        suspend: boolean,
        reason?: string,
        suspendedBy?: string
    ): Promise<WorkspaceMember | null> {
        const res = await query(
            `UPDATE public.workspace_members
             SET is_suspended = $3,
                 membership_status = CASE WHEN $3 = true THEN 'suspended' ELSE 'active' END,
                 suspended_at = CASE WHEN $3 = true THEN NOW() ELSE NULL END,
                 suspended_reason = CASE WHEN $3 = true THEN $4 ELSE NULL END,
                 suspended_by = CASE WHEN $3 = true THEN $5::uuid ELSE NULL END,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND user_id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                membership_status AS "membershipStatus",
                is_suspended AS "isSuspended",
                suspended_at AS "suspendedAt",
                suspended_reason AS "suspendedReason",
                suspended_by AS "suspendedBy",
                updated_at AS "updatedAt";`,
            [workspaceId, userId, suspend, reason || null, suspendedBy || null]
        );
        return res.rows[0] || null;
    }


    static async updateMemberRole(
        workspaceId: string,
        userId: string,
        roleId: string,
        roleTitle?: string
    ): Promise<WorkspaceMember | null> {
        await query(
            `UPDATE public.workspace_members
             SET role_id = $3,
                 role_title = COALESCE($4, role_title),
                 updated_at = NOW()
             WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, userId, roleId, roleTitle || null]
        );
        return this.findMember(workspaceId, userId);
    }

    // =========================================================================
    // 6. CRYPTOGRAPHIC INVITATIONS
    // =========================================================================

    static async createInvitation(client: any, data: {
        workspaceId: string;
        inviterId: string;
        email: string;
        roleId: string;
        tokenHash: string;
        departmentId?: string | null;
        invitedUserId?: string | null;
        invitationMessage?: string | null;
        expiresAt?: Date;
    }): Promise<WorkspaceInvitation> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_invitations (
                workspace_id,
                inviter_id,
                email,
                role_id,
                department_id,
                invited_user_id,
                token_hash,
                status,
                invitation_message,
                expires_at,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, LOWER($3), $4, $5, $6, $7, 'pending', $8, COALESCE($9, NOW() + INTERVAL '7 days'), NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                inviter_id AS "inviterId",
                email,
                role_id AS "roleId",
                department_id AS "departmentId",
                invited_user_id AS "invitedUserId",
                token_hash AS "tokenHash",
                status,
                invitation_message AS "invitationMessage",
                expires_at AS "expiresAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.inviterId,
                data.email.trim(),
                data.roleId,
                data.departmentId || null,
                data.invitedUserId || null,
                data.tokenHash,
                data.invitationMessage || null,
                data.expiresAt || null,
            ]
        );
        return res.rows[0];
    }

    static async findInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | null> {
        const res = await query(
            `SELECT
                wi.id,
                wi.workspace_id AS "workspaceId",
                wi.inviter_id AS "inviterId",
                wi.email,
                wi.role_id AS "roleId",
                wi.department_id AS "departmentId",
                wi.token_hash AS "tokenHash",
                wi.status,
                wi.invitation_message AS "invitationMessage",
                wi.expires_at AS "expiresAt",
                wi.accepted_at AS "acceptedAt",
                wi.revoked_at AS "revokedAt",
                wi.created_at AS "createdAt",
                wi.updated_at AS "updatedAt",
                json_build_object(
                    'id', r.id,
                    'name', r.name,
                    'slug', r.slug,
                    'rank', r.rank,
                    'color', r.color
                ) AS "role",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'icon', wd.icon,
                        'color', wd.color
                    )
                ELSE NULL END AS "department"
             FROM public.workspace_invitations wi
             JOIN public.workspace_roles r ON r.id = wi.role_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wi.department_id
             WHERE wi.token_hash = $1
             LIMIT 1;`,
            [tokenHash]
        );
        return res.rows[0] || null;
    }


    static async findInvitationById(workspaceId: string, invitationId: string): Promise<WorkspaceInvitation | null> {
        const res = await query(
            `SELECT
                wi.id,
                wi.workspace_id AS "workspaceId",
                wi.inviter_id AS "inviterId",
                wi.email,
                wi.role_id AS "roleId",
                wi.department_id AS "departmentId",
                wi.status,
                wi.expires_at AS "expiresAt",
                wi.created_at AS "createdAt"
             FROM public.workspace_invitations wi
             WHERE wi.workspace_id = $1 AND wi.id = $2
             LIMIT 1;`,
            [workspaceId, invitationId]
        );
        return res.rows[0] || null;
    }


    static async listInvitations(workspaceId: string, status?: string): Promise<WorkspaceInvitation[]> {
        let where = `WHERE wi.workspace_id = $1`;
        const params: any[] = [workspaceId];
        if (status) {
            where += ` AND wi.status = $2`;
            params.push(status);
        }

        const res = await query(
            `SELECT
                wi.id,
                wi.workspace_id AS "workspaceId",
                wi.inviter_id AS "inviterId",
                wi.email,
                wi.role_id AS "roleId",
                wi.department_id AS "departmentId",
                wi.status,
                wi.invitation_message AS "invitationMessage",
                wi.expires_at AS "expiresAt",
                wi.accepted_at AS "acceptedAt",
                wi.revoked_at AS "revokedAt",
                wi.created_at AS "createdAt",
                json_build_object(
                    'id', r.id,
                    'name', r.name,
                    'slug', r.slug,
                    'rank', r.rank,
                    'color', r.color
                ) AS "role",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'icon', wd.icon,
                        'color', wd.color
                    )
                ELSE NULL END AS "department",
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname
                ) AS "inviter"
             FROM public.workspace_invitations wi
             JOIN public.workspace_roles r ON r.id = wi.role_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wi.department_id
             JOIN public.users u ON u.id = wi.inviter_id
             ${where}
             ORDER BY wi.created_at DESC;`,
            params
        );
        return res.rows;
    }

    static async updateInvitationStatus(
        invitationId: string,
        status: "pending" | "accepted" | "revoked" | "expired",
        options: { acceptedAt?: Date; revokedAt?: Date; revokedBy?: string } = {}
    ): Promise<boolean> {
        const res = await query(
            `UPDATE public.workspace_invitations
             SET status = $2::varchar,
                 accepted_at = CASE WHEN $2::varchar = 'accepted' THEN NOW() ELSE accepted_at END,
                 revoked_at = CASE WHEN $2::varchar = 'revoked' THEN NOW() ELSE revoked_at END,
                 revoked_by = CASE WHEN $2::varchar = 'revoked' THEN $3::uuid ELSE revoked_by END,
                 updated_at = NOW()
             WHERE id = $1;`,
            [invitationId, status, options.revokedBy || null]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    // =========================================================================
    // 7. AUDIT LOGGING
    // =========================================================================

    static async logAudit(
        clientOrQuery: any,
        log: {
            workspaceId: string;
            actorId: string | null;
            action: string;
            targetType: string;
            targetId?: string | null;
            details?: Record<string, any>;
            ipAddress?: string | null;
            userAgent?: string | null;
        }
    ): Promise<WorkspaceAuditLog> {
        const targetQuery = clientOrQuery?.query ? clientOrQuery : { query };
        const res = await targetQuery.query(
            `INSERT INTO public.workspace_audit_logs (
                workspace_id,
                actor_id,
                action,
                target_type,
                target_id,
                details,
                ip_address,
                user_agent,
                created_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6::jsonb, $7, $8, NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                actor_id AS "actorId",
                action,
                target_type AS "targetType",
                target_id AS "targetId",
                details,
                ip_address AS "ipAddress",
                user_agent AS "userAgent",
                created_at AS "createdAt";`,
            [
                log.workspaceId,
                log.actorId,
                log.action,
                log.targetType,
                log.targetId || null,
                JSON.stringify(log.details || {}),
                log.ipAddress || null,
                log.userAgent || null,
            ]
        );
        return res.rows[0];
    }

    // =========================================================================
    // 8. CHANNELS, CATEGORIES & PERMISSION OVERRIDES (PHASE 04)
    // =========================================================================

    static async createCategory(
        client: any,
        data: {
            workspaceId: string;
            name: string;
            departmentId?: string | null;
            displayOrder?: number;
            isPrivate?: boolean;
        }
    ): Promise<WorkspaceChannelCategory> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_channel_categories (
                workspace_id,
                name,
                department_id,
                display_order,
                is_private,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, COALESCE($4, 0), COALESCE($5, false), NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                name,
                department_id AS "departmentId",
                display_order AS "displayOrder",
                is_private AS "isPrivate",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.name,
                data.departmentId || null,
                data.displayOrder ?? 0,
                data.isPrivate ?? false,
            ]
        );
        return res.rows[0];
    }

    static async listCategories(
        workspaceId: string,
        departmentId?: string | null
    ): Promise<WorkspaceChannelCategory[]> {
        let where = `WHERE wcc.workspace_id = $1`;
        const params: any[] = [workspaceId];

        if (departmentId !== undefined) {
            if (departmentId === null) {
                where += ` AND wcc.department_id IS NULL`;
            } else {
                params.push(departmentId);
                where += ` AND wcc.department_id = $${params.length}`;
            }
        }

        const res = await query(
            `SELECT
                wcc.id,
                wcc.workspace_id AS "workspaceId",
                wcc.name,
                wcc.department_id AS "departmentId",
                wcc.display_order AS "displayOrder",
                wcc.is_private AS "isPrivate",
                wcc.created_at AS "createdAt",
                wcc.updated_at AS "updatedAt",
                wd.name AS "departmentName"
             FROM public.workspace_channel_categories wcc
             LEFT JOIN public.workspace_departments wd ON wd.id = wcc.department_id
             ${where}
             ORDER BY wcc.display_order ASC, wcc.created_at ASC;`,
            params
        );
        return res.rows;
    }

    static async findCategoryById(
        workspaceId: string,
        categoryId: string
    ): Promise<WorkspaceChannelCategory | null> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                department_id AS "departmentId",
                display_order AS "displayOrder",
                is_private AS "isPrivate",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_channel_categories
             WHERE workspace_id = $1 AND id = $2
             LIMIT 1;`,
            [workspaceId, categoryId]
        );
        return res.rows[0] || null;
    }


    static async updateCategory(
        workspaceId: string,
        categoryId: string,
        data: {
            name?: string;
            displayOrder?: number;
            departmentId?: string | null;
            isPrivate?: boolean;
        }
    ): Promise<WorkspaceChannelCategory | null> {
        const setClauses: string[] = ["updated_at = NOW()"];
        const params: any[] = [workspaceId, categoryId];
        let idx = 3;

        if (data.name !== undefined) {
            setClauses.push(`name = $${idx++}`);
            params.push(data.name);
        }
        if (data.displayOrder !== undefined) {
            setClauses.push(`display_order = $${idx++}`);
            params.push(data.displayOrder);
        }
        if (data.departmentId !== undefined) {
            setClauses.push(`department_id = $${idx++}`);
            params.push(data.departmentId);
        }
        if (data.isPrivate !== undefined) {
            setClauses.push(`is_private = $${idx++}`);
            params.push(data.isPrivate);
        }

        const res = await query(
            `UPDATE public.workspace_channel_categories
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                name,
                department_id AS "departmentId",
                display_order AS "displayOrder",
                is_private AS "isPrivate",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            params
        );
        return res.rows[0] || null;
    }


    static async deleteCategory(workspaceId: string, categoryId: string): Promise<boolean> {
        const res = await query(
            `DELETE FROM public.workspace_channel_categories
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, categoryId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    static async reorderCategories(
        workspaceId: string,
        categoryIds: string[]
    ): Promise<boolean> {
        for (let i = 0; i < categoryIds.length; i++) {
            await query(
                `UPDATE public.workspace_channel_categories
                 SET display_order = $1, updated_at = NOW()
                 WHERE workspace_id = $2 AND id = $3;`,
                [i, workspaceId, categoryIds[i]]
            );
        }
        return true;
    }

    // =========================================================================

    static async createChannel(
        client: any,
        data: {
            workspaceId: string;
            categoryId?: string | null;
            departmentId?: string | null;
            name: string;
            slug: string;
            topic?: string | null;
            channelType?: WorkspaceChannelType;
            isPrivate?: boolean;
            isCategorySynced?: boolean;
            position?: number;
            defaultSlowmodeSeconds?: number;
            createdBy?: string | null;
        }
    ): Promise<WorkspaceChannel> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_channels (
                workspace_id,
                category_id,
                department_id,
                name,
                slug,
                topic,
                channel_type,
                is_private,
                is_category_synced,
                position,
                default_slowmode_seconds,
                created_by,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, COALESCE($7, 'text'),
                COALESCE($8, false), COALESCE($9, true), COALESCE($10, 0),
                COALESCE($11, 0), $12, NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                category_id AS "categoryId",
                department_id AS "departmentId",
                name,
                slug,
                topic,
                channel_type AS "channelType",
                is_private AS "isPrivate",
                is_archived AS "isArchived",
                is_category_synced AS "isCategorySynced",
                position,
                default_slowmode_seconds AS "defaultSlowmodeSeconds",
                created_by AS "createdBy",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.categoryId || null,
                data.departmentId || null,
                data.name,
                data.slug,
                data.topic || null,
                data.channelType || "text",
                data.isPrivate ?? false,
                data.isCategorySynced ?? true,
                data.position ?? 0,
                data.defaultSlowmodeSeconds ?? 0,
                data.createdBy || null,
            ]
        );
        return res.rows[0];
    }

    static async findChannelById(
        workspaceId: string,
        channelId: string
    ): Promise<WorkspaceChannel | null> {
        const res = await query(
            `SELECT
                wc.id,
                wc.workspace_id AS "workspaceId",
                wc.category_id AS "categoryId",
                wc.department_id AS "departmentId",
                wc.name,
                wc.slug,
                wc.topic,
                wc.channel_type AS "channelType",
                wc.is_private AS "isPrivate",
                wc.is_archived AS "isArchived",
                wc.is_category_synced AS "isCategorySynced",
                wc.position,
                wc.default_slowmode_seconds AS "defaultSlowmodeSeconds",
                wc.created_by AS "createdBy",
                wc.created_at AS "createdAt",
                wc.updated_at AS "updatedAt",
                wcc.name AS "categoryName",
                wd.name AS "departmentName"
             FROM public.workspace_channels wc
             LEFT JOIN public.workspace_channel_categories wcc ON wcc.id = wc.category_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wc.department_id
             WHERE wc.workspace_id = $1 AND wc.id = $2
             LIMIT 1;`,
            [workspaceId, channelId]
        );
        return res.rows[0] || null;
    }


    static async findChannelBySlug(
        workspaceId: string,
        slug: string
    ): Promise<WorkspaceChannel | null> {
        const res = await query(
            `SELECT
                wc.id,
                wc.workspace_id AS "workspaceId",
                wc.category_id AS "categoryId",
                wc.department_id AS "departmentId",
                wc.name,
                wc.slug,
                wc.topic,
                wc.channel_type AS "channelType",
                wc.is_private AS "isPrivate",
                wc.is_archived AS "isArchived",
                wc.is_category_synced AS "isCategorySynced",
                wc.position,
                wc.default_slowmode_seconds AS "defaultSlowmodeSeconds",
                wc.created_by AS "createdBy",
                wc.created_at AS "createdAt",
                wc.updated_at AS "updatedAt"
             FROM public.workspace_channels wc
             WHERE wc.workspace_id = $1 AND wc.slug = $2
             LIMIT 1;`,
            [workspaceId, slug]
        );
        return res.rows[0] || null;
    }


    static async listChannels(
        workspaceId: string,
        options: {
            categoryId?: string | null;
            departmentId?: string | null;
            includeArchived?: boolean;
        } = {}
    ): Promise<WorkspaceChannel[]> {
        let where = `WHERE wc.workspace_id = $1`;
        const params: any[] = [workspaceId];

        if (!options.includeArchived) {
            where += ` AND wc.is_archived = false`;
        }
        if (options.categoryId !== undefined) {
            if (options.categoryId === null) {
                where += ` AND wc.category_id IS NULL`;
            } else {
                params.push(options.categoryId);
                where += ` AND wc.category_id = $${params.length}`;
            }
        }
        if (options.departmentId !== undefined) {
            if (options.departmentId === null) {
                where += ` AND wc.department_id IS NULL`;
            } else {
                params.push(options.departmentId);
                where += ` AND wc.department_id = $${params.length}`;
            }
        }

        const res = await query(
            `SELECT
                wc.id,
                wc.workspace_id AS "workspaceId",
                wc.category_id AS "categoryId",
                wc.department_id AS "departmentId",
                wc.name,
                wc.slug,
                wc.topic,
                wc.channel_type AS "channelType",
                wc.is_private AS "isPrivate",
                wc.is_archived AS "isArchived",
                wc.is_category_synced AS "isCategorySynced",
                wc.position,
                wc.default_slowmode_seconds AS "defaultSlowmodeSeconds",
                wc.created_by AS "createdBy",
                wc.created_at AS "createdAt",
                wc.updated_at AS "updatedAt",
                wcc.name AS "categoryName",
                wd.name AS "departmentName"
             FROM public.workspace_channels wc
             LEFT JOIN public.workspace_channel_categories wcc ON wcc.id = wc.category_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wc.department_id
             ${where}
             ORDER BY wc.position ASC, wc.created_at ASC;`,
            params
        );
        return res.rows;
    }

    static async updateChannel(
        workspaceId: string,
        channelId: string,
        data: Partial<WorkspaceChannel>
    ): Promise<WorkspaceChannel | null> {
        const setClauses: string[] = ["updated_at = NOW()"];
        const params: any[] = [workspaceId, channelId];
        let idx = 3;

        if (data.name !== undefined) {
            setClauses.push(`name = $${idx++}`);
            params.push(data.name);
        }
        if (data.slug !== undefined) {
            setClauses.push(`slug = $${idx++}`);
            params.push(data.slug);
        }
        if (data.topic !== undefined) {
            setClauses.push(`topic = $${idx++}`);
            params.push(data.topic);
        }
        if (data.categoryId !== undefined) {
            setClauses.push(`category_id = $${idx++}`);
            params.push(data.categoryId);
        }
        if (data.departmentId !== undefined) {
            setClauses.push(`department_id = $${idx++}`);
            params.push(data.departmentId);
        }
        if (data.channelType !== undefined) {
            setClauses.push(`channel_type = $${idx++}`);
            params.push(data.channelType);
        }
        if (data.isPrivate !== undefined) {
            setClauses.push(`is_private = $${idx++}`);
            params.push(data.isPrivate);
        }
        if (data.isArchived !== undefined) {
            setClauses.push(`is_archived = $${idx++}`);
            params.push(data.isArchived);
        }
        if (data.isCategorySynced !== undefined) {
            setClauses.push(`is_category_synced = $${idx++}`);
            params.push(data.isCategorySynced);
        }
        if (data.position !== undefined) {
            setClauses.push(`position = $${idx++}`);
            params.push(data.position);
        }
        if (data.defaultSlowmodeSeconds !== undefined) {
            setClauses.push(`default_slowmode_seconds = $${idx++}`);
            params.push(data.defaultSlowmodeSeconds);
        }

        const res = await query(
            `UPDATE public.workspace_channels
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                category_id AS "categoryId",
                department_id AS "departmentId",
                name,
                slug,
                topic,
                channel_type AS "channelType",
                is_private AS "isPrivate",
                is_archived AS "isArchived",
                is_category_synced AS "isCategorySynced",
                position,
                default_slowmode_seconds AS "defaultSlowmodeSeconds",
                created_by AS "createdBy",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            params
        );
        return res.rows[0] || null;
    }


    static async deleteChannel(workspaceId: string, channelId: string): Promise<boolean> {
        const res = await query(
            `DELETE FROM public.workspace_channels
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, channelId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    static async reorderChannels(
        workspaceId: string,
        channelIds: string[]
    ): Promise<boolean> {
        for (let i = 0; i < channelIds.length; i++) {
            await query(
                `UPDATE public.workspace_channels
                 SET position = $1, updated_at = NOW()
                 WHERE workspace_id = $2 AND id = $3;`,
                [i, workspaceId, channelIds[i]]
            );
        }
        return true;
    }

    // =========================================================================

    // =========================================================================
    // 9. CHANNEL & CATEGORY PERMISSION OVERRIDES (DISCORD-STYLE)
    // =========================================================================

    static async setChannelOverride(
        workspaceId: string,
        data: {
            categoryId?: string | null;
            channelId?: string | null;
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        }
    ): Promise<WorkspaceChannelOverride> {
        const allows = JSON.stringify(data.allowPermissions || []);
        const denies = JSON.stringify(data.denyPermissions || []);

        // Delete existing matching override to avoid conflict on partial indexes
        if (data.channelId && data.roleId) {
            await query(
                `DELETE FROM public.workspace_channel_overrides
                 WHERE workspace_id = $1 AND channel_id = $2 AND role_id = $3;`,
                [workspaceId, data.channelId, data.roleId]
            );
        } else if (data.channelId && data.memberId) {
            await query(
                `DELETE FROM public.workspace_channel_overrides
                 WHERE workspace_id = $1 AND channel_id = $2 AND member_id = $3;`,
                [workspaceId, data.channelId, data.memberId]
            );
        } else if (data.categoryId && data.roleId) {
            await query(
                `DELETE FROM public.workspace_channel_overrides
                 WHERE workspace_id = $1 AND category_id = $2 AND role_id = $3;`,
                [workspaceId, data.categoryId, data.roleId]
            );
        } else if (data.categoryId && data.memberId) {
            await query(
                `DELETE FROM public.workspace_channel_overrides
                 WHERE workspace_id = $1 AND category_id = $2 AND member_id = $3;`,
                [workspaceId, data.categoryId, data.memberId]
            );
        }

        const res = await query(
            `INSERT INTO public.workspace_channel_overrides (
                workspace_id,
                category_id,
                channel_id,
                role_id,
                member_id,
                allow_permissions,
                deny_permissions,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                category_id AS "categoryId",
                channel_id AS "channelId",
                role_id AS "roleId",
                member_id AS "memberId",
                allow_permissions AS "allowPermissions",
                deny_permissions AS "denyPermissions",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                workspaceId,
                data.categoryId || null,
                data.channelId || null,
                data.roleId || null,
                data.memberId || null,
                allows,
                denies,
            ]
        );
        return res.rows[0];
    }

    static async setCategoryOverride(
        workspaceId: string,
        data: {
            categoryId: string;
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        }
    ): Promise<WorkspaceChannelOverride> {
        const payload: {
            categoryId?: string | null;
            channelId?: string | null;
            roleId?: string | null;
            memberId?: string | null;
            allowPermissions?: string[];
            denyPermissions?: string[];
        } = {
            categoryId: data.categoryId,
            channelId: null,
            roleId: data.roleId ?? null,
            memberId: data.memberId ?? null,
        };
        if (data.allowPermissions) payload.allowPermissions = data.allowPermissions;
        if (data.denyPermissions) payload.denyPermissions = data.denyPermissions;
        return this.setChannelOverride(workspaceId, payload);
    }

    static async getOverridesForChannel(
        workspaceId: string,
        channelId: string
    ): Promise<WorkspaceChannelOverride[]> {
        const res = await query(
            `SELECT
                wco.id,
                wco.workspace_id AS "workspaceId",
                wco.category_id AS "categoryId",
                wco.channel_id AS "channelId",
                wco.role_id AS "roleId",
                wco.member_id AS "memberId",
                wco.allow_permissions AS "allowPermissions",
                wco.deny_permissions AS "denyPermissions",
                wco.created_at AS "createdAt",
                wco.updated_at AS "updatedAt",
                wr.name AS "roleName",
                wr.color AS "roleColor",
                u.username AS "memberUsername",
                u.firstname AS "memberFirstName",
                u.lastname AS "memberLastName"
             FROM public.workspace_channel_overrides wco
             LEFT JOIN public.workspace_roles wr ON wr.id = wco.role_id
             LEFT JOIN public.workspace_members wm ON wm.id = wco.member_id
             LEFT JOIN public.users u ON u.id = wm.user_id
             WHERE wco.workspace_id = $1 AND wco.channel_id = $2;`,
            [workspaceId, channelId]
        );
        return res.rows;
    }

    static async getOverridesForCategory(
        workspaceId: string,
        categoryId: string
    ): Promise<WorkspaceChannelOverride[]> {
        const res = await query(
            `SELECT
                wco.id,
                wco.workspace_id AS "workspaceId",
                wco.category_id AS "categoryId",
                wco.channel_id AS "channelId",
                wco.role_id AS "roleId",
                wco.member_id AS "memberId",
                wco.allow_permissions AS "allowPermissions",
                wco.deny_permissions AS "denyPermissions",
                wco.created_at AS "createdAt",
                wco.updated_at AS "updatedAt"
             FROM public.workspace_channel_overrides wco
             WHERE wco.workspace_id = $1 AND wco.category_id = $2;`,
            [workspaceId, categoryId]
        );
        return res.rows;
    }

    static async deleteOverride(workspaceId: string, overrideId: string): Promise<boolean> {
        const res = await query(
            `DELETE FROM public.workspace_channel_overrides
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, overrideId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async syncChannelWithCategory(
        workspaceId: string,
        channelId: string,
        categoryId: string
    ): Promise<boolean> {
        // Delete all channel-level overrides
        await query(
            `DELETE FROM public.workspace_channel_overrides
             WHERE workspace_id = $1 AND channel_id = $2;`,
            [workspaceId, channelId]
        );

        // Copy category-level overrides to channel
        await query(
            `INSERT INTO public.workspace_channel_overrides (
                workspace_id,
                channel_id,
                role_id,
                member_id,
                allow_permissions,
                deny_permissions,
                created_at,
                updated_at
            )
            SELECT
                workspace_id,
                $2,
                role_id,
                member_id,
                allow_permissions,
                deny_permissions,
                NOW(),
                NOW()
            FROM public.workspace_channel_overrides
            WHERE workspace_id = $1 AND category_id = $3;`,
            [workspaceId, channelId, categoryId]
        );

        // Mark channel as category-synced
        await query(
            `UPDATE public.workspace_channels
             SET is_category_synced = true,
                 category_id = $3,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, channelId, categoryId]
        );

        return true;
    }

    // =========================================================================
    // 10. MESSAGES, REACTIONS, THREADS & ATTACHMENTS
    // =========================================================================

    static async createMessage(
        client: any,
        data: {
            workspaceId: string;
            channelId: string;
            senderId: string;
            senderMemberId: string;
            content: string;
            messageType?: "text" | "system" | "announcement" | "thread_starter";
            parentMessageId?: string | null;
            threadId?: string | null;
            mentions?: { users: string[]; roles: string[]; everyone: boolean };
        }
    ): Promise<WorkspaceMessage> {
        const targetClient = client?.query ? client : { query };
        const mentionsJson = JSON.stringify(data.mentions || { users: [], roles: [], everyone: false });

        const res = await targetClient.query(
            `INSERT INTO public.workspace_messages (
                workspace_id,
                channel_id,
                sender_id,
                sender_member_id,
                content,
                message_type,
                parent_message_id,
                thread_id,
                mentions,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, COALESCE($6, 'text'), $7, $8, $9::jsonb, NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                channel_id AS "channelId",
                sender_id AS "senderId",
                sender_member_id AS "senderMemberId",
                content,
                message_type AS "messageType",
                parent_message_id AS "parentMessageId",
                thread_id AS "threadId",
                is_pinned AS "isPinned",
                pinned_at AS "pinnedAt",
                pinned_by AS "pinnedBy",
                is_edited AS "isEdited",
                edited_at AS "editedAt",
                is_deleted AS "isDeleted",
                mentions,
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.channelId,
                data.senderId,
                data.senderMemberId,
                data.content,
                data.messageType || "text",
                data.parentMessageId || null,
                data.threadId || null,
                mentionsJson,
            ]
        );

        const msg = res.rows[0];

        // If part of a thread, increment thread message_count & last_message_at
        if (data.threadId) {
            await targetClient.query(
                `UPDATE public.workspace_threads
                 SET message_count = message_count + 1,
                     last_message_at = NOW(),
                     updated_at = NOW()
                 WHERE id = $1;`,
                [data.threadId]
            );
        }

        return msg;
    }

    static async findMessageById(
        workspaceId: string,
        messageId: string
    ): Promise<WorkspaceMessage | null> {
        const res = await query(
            `SELECT
                wm.id,
                wm.workspace_id AS "workspaceId",
                wm.channel_id AS "channelId",
                wm.sender_id AS "senderId",
                wm.sender_member_id AS "senderMemberId",
                wm.content,
                wm.message_type AS "messageType",
                wm.parent_message_id AS "parentMessageId",
                wm.thread_id AS "threadId",
                wm.is_pinned AS "isPinned",
                wm.pinned_at AS "pinnedAt",
                wm.pinned_by AS "pinnedBy",
                wm.is_edited AS "isEdited",
                wm.edited_at AS "editedAt",
                wm.is_deleted AS "isDeleted",
                wm.mentions,
                wm.created_at AS "createdAt",
                wm.updated_at AS "updatedAt",
                u.username AS "senderUsername",
                u.firstname AS "senderFirstName",
                u.lastname AS "senderLastName",
                u.avatar_url AS "senderAvatarUrl",
                wr.name AS "roleName",
                wr.color AS "roleColor",
                wr.rank AS "roleRank"
             FROM public.workspace_messages wm
             JOIN public.users u ON u.id = wm.sender_id
             LEFT JOIN public.workspace_members wmem ON wmem.id = wm.sender_member_id
             LEFT JOIN public.workspace_roles wr ON wr.id = wmem.role_id
             WHERE wm.workspace_id = $1 AND wm.id = $2
             LIMIT 1;`,
            [workspaceId, messageId]
        );

        if (!res.rows[0]) return null;
        const row = res.rows[0];

        return {
            ...row,
            sender: {
                id: row.senderId,
                username: row.senderUsername,
                firstName: row.senderFirstName,
                lastName: row.senderLastName,
                avatarUrl: row.senderAvatarUrl,
            },
            senderRole: row.roleName
                ? {
                      id: row.roleId,
                      name: row.roleName,
                      color: row.roleColor,
                      rank: row.roleRank,
                  }
                : null,
        };
    }

    static async listMessages(
        workspaceId: string,
        channelId: string,
        options: {
            threadId?: string | null;
            before?: string;
            after?: string;
            limit?: number;
        } = {}
    ): Promise<WorkspaceMessage[]> {
        const limit = Math.min(options.limit || 50, 100);
        let where = `WHERE wm.workspace_id = $1 AND wm.channel_id = $2`;
        const params: any[] = [workspaceId, channelId];

        if (options.threadId !== undefined) {
            if (options.threadId === null) {
                where += ` AND wm.thread_id IS NULL`;
            } else {
                params.push(options.threadId);
                where += ` AND wm.thread_id = $${params.length}`;
            }
        }

        if (options.before) {
            params.push(options.before);
            where += ` AND wm.created_at < (SELECT created_at FROM public.workspace_messages WHERE id = $${params.length})`;
        }

        if (options.after) {
            params.push(options.after);
            where += ` AND wm.created_at > (SELECT created_at FROM public.workspace_messages WHERE id = $${params.length})`;
        }

        params.push(limit);

        const res = await query(
            `SELECT
                wm.id,
                wm.workspace_id AS "workspaceId",
                wm.channel_id AS "channelId",
                wm.sender_id AS "senderId",
                wm.sender_member_id AS "senderMemberId",
                CASE WHEN wm.is_deleted THEN '[Message deleted]' ELSE wm.content END AS content,
                wm.message_type AS "messageType",
                wm.parent_message_id AS "parentMessageId",
                wm.thread_id AS "threadId",
                wm.is_pinned AS "isPinned",
                wm.pinned_at AS "pinnedAt",
                wm.pinned_by AS "pinnedBy",
                wm.is_edited AS "isEdited",
                wm.edited_at AS "editedAt",
                wm.is_deleted AS "isDeleted",
                wm.mentions,
                wm.created_at AS "createdAt",
                wm.updated_at AS "updatedAt",
                u.username AS "senderUsername",
                u.firstname AS "senderFirstName",
                u.lastname AS "senderLastName",
                u.avatar_url AS "senderAvatarUrl",
                wr.name AS "roleName",
                wr.color AS "roleColor",
                wr.rank AS "roleRank",
                wt.id AS "threadInstanceId",
                wt.name AS "threadInstanceName",
                wt.message_count AS "threadMessageCount"
             FROM public.workspace_messages wm
             JOIN public.users u ON u.id = wm.sender_id
             LEFT JOIN public.workspace_members wmem ON wmem.id = wm.sender_member_id
             LEFT JOIN public.workspace_roles wr ON wr.id = wmem.role_id
             LEFT JOIN public.workspace_threads wt ON wt.parent_message_id = wm.id
             ${where}
             ORDER BY wm.created_at ASC
             LIMIT $${params.length};`,
            params
        );

        if (res.rows.length === 0) return [];

        const messageIds = res.rows.map((r: any) => r.id);

        // Fetch reactions in bulk
        const reactionsRes = await query(
            `SELECT
                message_id AS "messageId",
                emoji,
                json_agg(user_id) AS users,
                COUNT(*)::int AS count
             FROM public.workspace_message_reactions
             WHERE message_id = ANY($1::uuid[])
             GROUP BY message_id, emoji;`,
            [messageIds]
        );

        const reactionsMap = new Map<string, Array<{ emoji: string; count: number; users: string[] }>>();
        for (const r of reactionsRes.rows) {
            if (!reactionsMap.has(r.messageId)) reactionsMap.set(r.messageId, []);
            reactionsMap.get(r.messageId)!.push({
                emoji: r.emoji,
                count: r.count,
                users: r.users,
            });
        }

        // Fetch attachments in bulk
        const filesRes = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                uploader_id AS "uploaderId",
                channel_id AS "channelId",
                message_id AS "messageId",
                file_name AS "fileName",
                file_size_bytes AS "fileSizeBytes",
                mime_type AS "mimeType",
                cloudinary_url AS "cloudinaryUrl",
                cloudinary_secure_url AS "cloudinarySecureUrl",
                resource_type AS "resourceType",
                created_at AS "createdAt"
             FROM public.workspace_files
             WHERE message_id = ANY($1::uuid[]);`,
            [messageIds]
        );

        const filesMap = new Map<string, WorkspaceFile[]>();
        for (const f of filesRes.rows) {
            if (!filesMap.has(f.messageId)) filesMap.set(f.messageId, []);
            filesMap.get(f.messageId)!.push(f);
        }

        return res.rows.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspaceId,
            channelId: row.channelId,
            senderId: row.senderId,
            senderMemberId: row.senderMemberId,
            content: row.content,
            messageType: row.messageType,
            parentMessageId: row.parentMessageId,
            threadId: row.threadId,
            isPinned: row.isPinned,
            pinnedAt: row.pinnedAt,
            pinnedBy: row.pinnedBy,
            isEdited: row.isEdited,
            editedAt: row.editedAt,
            isDeleted: row.isDeleted,
            deletedAt: row.deletedAt || null,
            mentions: row.mentions,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            sender: {
                id: row.senderId,
                username: row.senderUsername,
                firstName: row.senderFirstName,
                lastName: row.senderLastName,
                avatarUrl: row.senderAvatarUrl,
            },
            senderRole: row.roleName
                ? {
                      id: row.roleId,
                      name: row.roleName,
                      color: row.roleColor,
                      rank: row.roleRank,
                  }
                : null,
            reactions: reactionsMap.get(row.id) || [],
            attachments: filesMap.get(row.id) || [],
            thread: row.threadInstanceId
                ? {
                      id: row.threadInstanceId,
                      workspaceId: row.workspaceId,
                      channelId: row.channelId,
                      parentMessageId: row.id,
                      name: row.threadInstanceName,
                      creatorId: row.senderId,
                      isLocked: false,
                      lockedAt: null,
                      lockedBy: null,
                      isArchived: false,
                      archivedAt: null,
                      archivedBy: null,
                      messageCount: row.threadMessageCount,
                      lastMessageAt: row.createdAt,
                      createdAt: row.createdAt,
                      updatedAt: row.updatedAt,
                  }
                : null,
        }));
    }

    static async updateMessage(
        workspaceId: string,
        messageId: string,
        senderId: string,
        content: string
    ): Promise<WorkspaceMessage | null> {
        const res = await query(
            `UPDATE public.workspace_messages
             SET content = $4,
                 is_edited = true,
                 edited_at = NOW(),
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2 AND sender_id = $3 AND is_deleted = false
             RETURNING id;`,
            [workspaceId, messageId, senderId, content]
        );

        if (!res.rows[0]) return null;
        return this.findMessageById(workspaceId, messageId);
    }

    static async deleteMessage(
        workspaceId: string,
        messageId: string,
        actorId: string,
        canDeleteAny: boolean
    ): Promise<boolean> {
        let sql = `UPDATE public.workspace_messages
                   SET is_deleted = true,
                       deleted_at = NOW(),
                       content = '[Message deleted]',
                       updated_at = NOW()
                   WHERE workspace_id = $1 AND id = $2`;
        const params: any[] = [workspaceId, messageId];

        if (!canDeleteAny) {
            params.push(actorId);
            sql += ` AND sender_id = $3`;
        }

        const res = await query(sql, params);
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async setPinnedMessage(
        workspaceId: string,
        messageId: string,
        actorId: string,
        isPinned: boolean
    ): Promise<boolean> {
        const res = await query(
            `UPDATE public.workspace_messages
             SET is_pinned = $3,
                 pinned_at = CASE WHEN $3 THEN NOW() ELSE NULL END,
                 pinned_by = CASE WHEN $3 THEN $4::uuid ELSE NULL END,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, messageId, isPinned, actorId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async searchMessages(
        workspaceId: string,
        searchQuery: string,
        channelId?: string,
        limit = 30
    ): Promise<WorkspaceMessage[]> {
        let where = `WHERE wm.workspace_id = $1 AND wm.is_deleted = false AND wm.content ILIKE $2`;
        const params: any[] = [workspaceId, `%${searchQuery}%`];

        if (channelId) {
            params.push(channelId);
            where += ` AND wm.channel_id = $${params.length}`;
        }

        params.push(limit);

        const res = await query(
            `SELECT
                wm.id,
                wm.workspace_id AS "workspaceId",
                wm.channel_id AS "channelId",
                wm.sender_id AS "senderId",
                wm.content,
                wm.created_at AS "createdAt",
                wc.name AS "channelName",
                u.username AS "senderUsername",
                u.firstname AS "senderFirstName",
                u.lastname AS "senderLastName"
             FROM public.workspace_messages wm
             JOIN public.users u ON u.id = wm.sender_id
             JOIN public.workspace_channels wc ON wc.id = wm.channel_id
             ${where}
             ORDER BY wm.created_at DESC
             LIMIT $${params.length};`,
            params
        );

        return res.rows.map((row: any) => ({
            id: row.id,
            workspaceId: row.workspaceId,
            channelId: row.channelId,
            senderId: row.senderId,
            senderMemberId: "",
            parentMessageId: null,
            threadId: null,
            content: row.content,
            messageType: "text",
            isPinned: false,
            pinnedAt: null,
            pinnedBy: null,
            isEdited: false,
            editedAt: null,
            isDeleted: false,
            deletedAt: null,
            mentions: { users: [], roles: [], everyone: false },
            createdAt: row.createdAt,
            updatedAt: row.createdAt,
            sender: {
                id: row.senderId,
                username: row.senderUsername,
                firstName: row.senderFirstName,
                lastName: row.senderLastName,
            },
        }));
    }

    static async addReaction(
        workspaceId: string,
        messageId: string,
        userId: string,
        emoji: string
    ): Promise<boolean> {
        const res = await query(
            `INSERT INTO public.workspace_message_reactions (
                workspace_id,
                message_id,
                user_id,
                emoji,
                created_at
            ) VALUES (
                $1, $2, $3, $4, NOW()
            )
            ON CONFLICT (message_id, user_id, emoji) DO NOTHING;`,
            [workspaceId, messageId, userId, emoji]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async removeReaction(
        workspaceId: string,
        messageId: string,
        userId: string,
        emoji: string
    ): Promise<boolean> {
        const res = await query(
            `DELETE FROM public.workspace_message_reactions
             WHERE workspace_id = $1 AND message_id = $2 AND user_id = $3 AND emoji = $4;`,
            [workspaceId, messageId, userId, emoji]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    // =========================================================================
    // 11. THREADS
    // =========================================================================

    static async createThread(
        client: any,
        data: {
            workspaceId: string;
            channelId: string;
            parentMessageId: string;
            name: string;
            creatorId: string;
        }
    ): Promise<WorkspaceThread> {
        const targetClient = client?.query ? client : { query };
        const res = await targetClient.query(
            `INSERT INTO public.workspace_threads (
                workspace_id,
                channel_id,
                parent_message_id,
                name,
                creator_id,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                channel_id AS "channelId",
                parent_message_id AS "parentMessageId",
                name,
                creator_id AS "creatorId",
                is_locked AS "isLocked",
                locked_at AS "lockedAt",
                locked_by AS "lockedBy",
                is_archived AS "isArchived",
                archived_at AS "archivedAt",
                archived_by AS "archivedBy",
                message_count AS "messageCount",
                last_message_at AS "lastMessageAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [data.workspaceId, data.channelId, data.parentMessageId, data.name, data.creatorId]
        );

        const thread = res.rows[0];

        // Add creator as thread participant
        await targetClient.query(
            `INSERT INTO public.workspace_thread_participants (
                thread_id,
                user_id,
                last_read_at,
                joined_at
            ) VALUES (
                $1, $2, NOW(), NOW()
            )
            ON CONFLICT DO NOTHING;`,
            [thread.id, data.creatorId]
        );

        return thread;
    }

    static async findThreadById(
        workspaceId: string,
        threadId: string
    ): Promise<WorkspaceThread | null> {
        const res = await query(
            `SELECT
                wt.id,
                wt.workspace_id AS "workspaceId",
                wt.channel_id AS "channelId",
                wt.parent_message_id AS "parentMessageId",
                wt.name,
                wt.creator_id AS "creatorId",
                wt.is_locked AS "isLocked",
                wt.locked_at AS "lockedAt",
                wt.locked_by AS "lockedBy",
                wt.is_archived AS "isArchived",
                wt.archived_at AS "archivedAt",
                wt.archived_by AS "archivedBy",
                wt.message_count AS "messageCount",
                wt.last_message_at AS "lastMessageAt",
                wt.created_at AS "createdAt",
                wt.updated_at AS "updatedAt",
                u.username AS "creatorUsername",
                u.firstname AS "creatorFirstName",
                u.lastname AS "creatorLastName"
             FROM public.workspace_threads wt
             JOIN public.users u ON u.id = wt.creator_id
             WHERE wt.workspace_id = $1 AND wt.id = $2
             LIMIT 1;`,
            [workspaceId, threadId]
        );

        if (!res.rows[0]) return null;
        const row = res.rows[0];

        return {
            ...row,
            creator: {
                id: row.creatorId,
                username: row.creatorUsername,
                firstName: row.creatorFirstName,
                lastName: row.creatorLastName,
            },
        };
    }

    static async listThreadsForChannel(
        workspaceId: string,
        channelId: string,
        includeArchived = false
    ): Promise<WorkspaceThread[]> {
        let where = `WHERE wt.workspace_id = $1 AND wt.channel_id = $2`;
        if (!includeArchived) {
            where += ` AND wt.is_archived = false`;
        }

        const res = await query(
            `SELECT
                wt.id,
                wt.workspace_id AS "workspaceId",
                wt.channel_id AS "channelId",
                wt.parent_message_id AS "parentMessageId",
                wt.name,
                wt.creator_id AS "creatorId",
                wt.is_locked AS "isLocked",
                wt.is_archived AS "isArchived",
                wt.message_count AS "messageCount",
                wt.last_message_at AS "lastMessageAt",
                wt.created_at AS "createdAt",
                u.username AS "creatorUsername",
                u.firstname AS "creatorFirstName"
             FROM public.workspace_threads wt
             JOIN public.users u ON u.id = wt.creator_id
             ${where}
             ORDER BY wt.last_message_at DESC;`,
            [workspaceId, channelId]
        );

        return res.rows.map((r: any) => ({
            ...r,
            creator: {
                id: r.creatorId,
                username: r.creatorUsername,
                firstName: r.creatorFirstName,
            },
        }));
    }

    static async updateThread(
        workspaceId: string,
        threadId: string,
        data: { name?: string; isLocked?: boolean; isArchived?: boolean },
        actorId: string
    ): Promise<WorkspaceThread | null> {
        const setClauses: string[] = ["updated_at = NOW()"];
        const params: any[] = [workspaceId, threadId];
        let idx = 3;

        if (data.name !== undefined) {
            setClauses.push(`name = $${idx++}`);
            params.push(data.name);
        }
        if (data.isLocked !== undefined) {
            setClauses.push(`is_locked = $${idx++}`);
            params.push(data.isLocked);
            setClauses.push(`locked_at = CASE WHEN $${idx - 1} THEN NOW() ELSE NULL END`);
            setClauses.push(`locked_by = CASE WHEN $${idx - 1} THEN $${idx++}::uuid ELSE NULL END`);
            params.push(actorId);
        }
        if (data.isArchived !== undefined) {
            setClauses.push(`is_archived = $${idx++}`);
            params.push(data.isArchived);
            setClauses.push(`archived_at = CASE WHEN $${idx - 1} THEN NOW() ELSE NULL END`);
            setClauses.push(`archived_by = CASE WHEN $${idx - 1} THEN $${idx++}::uuid ELSE NULL END`);
            params.push(actorId);
        }

        const res = await query(
            `UPDATE public.workspace_threads
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2
             RETURNING id;`,
            params
        );

        if (!res.rows[0]) return null;
        return this.findThreadById(workspaceId, threadId);
    }

    static async markChannelRead(
        channelId: string,
        userId: string,
        lastReadMessageId?: string | null
    ): Promise<void> {
        await query(
            `INSERT INTO public.workspace_channel_reads (
                channel_id,
                user_id,
                last_read_message_id,
                last_read_at
            ) VALUES (
                $1, $2, $3, NOW()
            )
            ON CONFLICT (channel_id, user_id) DO UPDATE
            SET last_read_message_id = COALESCE(EXCLUDED.last_read_message_id, workspace_channel_reads.last_read_message_id),
                last_read_at = NOW();`,
            [channelId, userId, lastReadMessageId || null]
        );
    }

    static async getChannelUnreadCounts(
        workspaceId: string,
        userId: string
    ): Promise<Record<string, number>> {
        const res = await query(
            `SELECT
                wc.id AS "channelId",
                COUNT(wm.id)::int AS "unreadCount"
             FROM public.workspace_channels wc
             LEFT JOIN public.workspace_channel_reads wcr ON wcr.channel_id = wc.id AND wcr.user_id = $2
             LEFT JOIN public.workspace_messages wm ON wm.channel_id = wc.id
                AND wm.created_at > COALESCE(wcr.last_read_at, '1970-01-01'::timestamptz)
                AND wm.sender_id != $2
                AND wm.is_deleted = false
                AND wm.thread_id IS NULL
             WHERE wc.workspace_id = $1
             GROUP BY wc.id;`,
            [workspaceId, userId]
        );

        const map: Record<string, number> = {};
        for (const row of res.rows) {
            map[row.channelId] = row.unreadCount;
        }
        return map;
    }

    // =========================================================================
    // 6. PHASE 05: TASK MANAGEMENT SYSTEM
    // =========================================================================

    /**
     * Creates a workspace task with optional initial assignees and activity logging.
     */
    static async createTask(
        clientOrNull: any,
        data: {
            workspaceId: string;
            departmentId?: string | null;
            creatorId: string;
            title: string;
            description?: string | null;
            status?: WorkspaceTaskStatus;
            priority?: WorkspaceTaskPriority;
            startDate?: string | null;
            dueDate?: string | null;
            assignedRoleId?: string | null;
            checklist?: WorkspaceTaskChecklistItem[];
            referenceLinks?: WorkspaceTaskReferenceLink[];
            isRestricted?: boolean;
            assigneeUserIds?: string[];
        }
    ): Promise<WorkspaceTask> {
        const executor = clientOrNull || { query };

        const initialStatus = data.status || (data.assigneeUserIds && data.assigneeUserIds.length > 0 ? "assigned" : "draft");

        const insertRes = await executor.query(
            `INSERT INTO public.workspace_tasks (
                workspace_id,
                department_id,
                creator_id,
                title,
                description,
                status,
                priority,
                start_date,
                due_date,
                assigned_role_id,
                checklist,
                reference_links,
                is_restricted,
                version
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, COALESCE($7, 'medium'), $8, $9, $10,
                $11::jsonb, $12::jsonb, COALESCE($13, false), 1
            ) RETURNING id;`,
            [
                data.workspaceId,
                data.departmentId || null,
                data.creatorId,
                data.title,
                data.description || null,
                initialStatus,
                data.priority || "medium",
                data.startDate || null,
                data.dueDate || null,
                data.assignedRoleId || null,
                JSON.stringify(data.checklist || []),
                JSON.stringify(data.referenceLinks || []),
                Boolean(data.isRestricted),
            ]
        );

        const taskId = insertRes.rows[0].id;

        // Add initial assignees if provided
        if (data.assigneeUserIds && data.assigneeUserIds.length > 0) {
            for (const userId of data.assigneeUserIds) {
                const memRes = await executor.query(
                    `SELECT id FROM public.workspace_members 
                     WHERE workspace_id = $1 AND user_id = $2
                     LIMIT 1;`,
                    [data.workspaceId, userId]
                );
                if (memRes.rows[0]) {
                    await executor.query(
                        `INSERT INTO public.workspace_task_assignments (
                            workspace_id,
                            task_id,
                            member_id,
                            user_id,
                            assigned_by,
                            is_active
                        ) VALUES ($1, $2, $3, $4, $5, true);`,
                        [data.workspaceId, taskId, memRes.rows[0].id, userId, data.creatorId]
                    );
                }
            }
        }

        // Add creator as watcher automatically
        await executor.query(
            `INSERT INTO public.workspace_task_watchers (workspace_id, task_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (task_id, user_id) DO NOTHING;`,
            [data.workspaceId, taskId, data.creatorId]
        );

        // Record initial activity
        await executor.query(
            `INSERT INTO public.workspace_task_activity (
                workspace_id,
                task_id,
                actor_id,
                action,
                details
            ) VALUES ($1, $2, $3, 'created', $4::jsonb);`,
            [
                data.workspaceId,
                taskId,
                data.creatorId,
                JSON.stringify({
                    title: data.title,
                    priority: data.priority || "medium",
                    status: initialStatus,
                    assigneeCount: data.assigneeUserIds?.length || 0,
                }),
            ]
        );

        const fullTask = await this.findTaskById(data.workspaceId, taskId, clientOrNull);
        if (!fullTask) throw new Error("Failed to retrieve created workspace task.");
        return fullTask;
    }

    /**
     * Finds a task by ID including relations, current assignees, latest submission, and watchers.
     */
    static async findTaskById(
        workspaceId: string,
        taskId: string,
        clientOrNull?: any
    ): Promise<WorkspaceTask | null> {
        const executor = clientOrNull || { query };

        const res = await executor.query(
            `SELECT
                wt.id,
                wt.workspace_id AS "workspaceId",
                wt.department_id AS "departmentId",
                wt.creator_id AS "creatorId",
                wt.title,
                wt.description,
                wt.status,
                wt.priority,
                wt.start_date AS "startDate",
                wt.due_date AS "dueDate",
                wt.assigned_role_id AS "assignedRoleId",
                COALESCE(wt.checklist, '[]'::jsonb) AS "checklist",
                COALESCE(wt.reference_links, '[]'::jsonb) AS "referenceLinks",
                wt.version,
                wt.is_restricted AS "isRestricted",
                wt.is_archived AS "isArchived",
                wt.archived_at AS "archivedAt",
                wt.archived_by AS "archivedBy",
                wt.display_order AS "displayOrder",
                wt.completed_at AS "completedAt",
                wt.created_at AS "createdAt",
                wt.updated_at AS "updatedAt",
                json_build_object(
                    'id', cu.id,
                    'username', cu.username,
                    'firstName', cu.firstname,
                    'lastName', cu.lastname,
                    'avatarUrl', cu.avatar_url
                ) AS "creator",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'color', wd.color,
                        'icon', wd.icon
                    )
                ELSE NULL END AS "department",
                CASE WHEN wr.id IS NOT NULL THEN
                    json_build_object(
                        'id', wr.id,
                        'name', wr.name,
                        'slug', wr.slug,
                        'color', wr.color,
                        'rank', wr.rank
                    )
                ELSE NULL END AS "assignedRole",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', wta.id,
                            'workspaceId', wta.workspace_id,
                            'taskId', wta.task_id,
                            'memberId', wta.member_id,
                            'userId', wta.user_id,
                            'assignedBy', wta.assigned_by,
                            'assignedAt', wta.assigned_at,
                            'unassignedAt', wta.unassigned_at,
                            'isActive', wta.is_active,
                            'user', json_build_object(
                                'id', au.id,
                                'username', au.username,
                                'firstName', au.firstname,
                                'lastName', au.lastname,
                                'avatarUrl', au.avatar_url
                            )
                        ) ORDER BY wta.assigned_at ASC
                    )
                    FROM public.workspace_task_assignments wta
                    JOIN public.users au ON au.id = wta.user_id
                    WHERE wta.task_id = wt.id AND wta.is_active = true
                ), '[]'::json) AS "currentAssignees",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', wta.id,
                            'workspaceId', wta.workspace_id,
                            'taskId', wta.task_id,
                            'memberId', wta.member_id,
                            'userId', wta.user_id,
                            'assignedBy', wta.assigned_by,
                            'assignedAt', wta.assigned_at,
                            'unassignedAt', wta.unassigned_at,
                            'isActive', wta.is_active,
                            'user', json_build_object(
                                'id', au.id,
                                'username', au.username,
                                'firstName', au.firstname,
                                'lastName', au.lastname,
                                'avatarUrl', au.avatar_url
                            )
                        ) ORDER BY wta.assigned_at DESC
                    )
                    FROM public.workspace_task_assignments wta
                    JOIN public.users au ON au.id = wta.user_id
                    WHERE wta.task_id = wt.id
                ), '[]'::json) AS "reassignmentHistory",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', sub.id,
                            'workspaceId', sub.workspace_id,
                            'taskId', sub.task_id,
                            'submittedBy', sub.submitted_by,
                            'content', sub.content,
                            'attachments', sub.attachments,
                            'status', sub.status,
                            'createdAt', sub.created_at,
                            'updatedAt', sub.updated_at,
                            'submitter', json_build_object(
                                'id', su.id,
                                'username', su.username,
                                'firstName', su.firstname,
                                'lastName', su.lastname,
                                'avatarUrl', su.avatar_url
                            ),
                            'review', (
                                SELECT json_build_object(
                                    'id', rev.id,
                                    'decision', rev.decision,
                                    'comments', rev.comments,
                                    'createdAt', rev.created_at,
                                    'reviewer', json_build_object(
                                        'id', ru.id,
                                        'username', ru.username,
                                        'firstName', ru.firstname,
                                        'lastName', ru.lastname,
                                        'avatarUrl', ru.avatar_url
                                    )
                                )
                                FROM public.workspace_task_reviews rev
                                JOIN public.users ru ON ru.id = rev.reviewer_id
                                WHERE rev.submission_id = sub.id
                                ORDER BY rev.created_at DESC
                                LIMIT 1
                            )
                        ) ORDER BY sub.created_at DESC
                    )
                    FROM public.workspace_task_submissions sub
                    JOIN public.users su ON su.id = sub.submitted_by
                    WHERE sub.task_id = wt.id
                ), '[]'::json) AS "submissions",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', rev.id,
                            'workspaceId', rev.workspace_id,
                            'taskId', rev.task_id,
                            'submissionId', rev.submission_id,
                            'reviewerId', rev.reviewer_id,
                            'decision', rev.decision,
                            'comments', rev.comments,
                            'createdAt', rev.created_at,
                            'reviewer', json_build_object(
                                'id', ru.id,
                                'username', ru.username,
                                'firstName', ru.firstname,
                                'lastName', ru.lastname,
                                'avatarUrl', ru.avatar_url
                            )
                        ) ORDER BY rev.created_at DESC
                    )
                    FROM public.workspace_task_reviews rev
                    JOIN public.users ru ON ru.id = rev.reviewer_id
                    WHERE rev.task_id = wt.id
                ), '[]'::json) AS "reviews",
                (
                    SELECT json_build_object(
                        'id', sub.id,
                        'workspaceId', sub.workspace_id,
                        'taskId', sub.task_id,
                        'submittedBy', sub.submitted_by,
                        'content', sub.content,
                        'attachments', sub.attachments,
                        'status', sub.status,
                        'createdAt', sub.created_at,
                        'updatedAt', sub.updated_at,
                        'submitter', json_build_object(
                            'id', su.id,
                            'username', su.username,
                            'firstName', su.firstname,
                            'lastName', su.lastname,
                            'avatarUrl', su.avatar_url
                        )
                    )
                    FROM public.workspace_task_submissions sub
                    JOIN public.users su ON su.id = sub.submitted_by
                    WHERE sub.task_id = wt.id
                    ORDER BY sub.created_at DESC
                    LIMIT 1
                ) AS "latestSubmission",
                (
                    SELECT json_build_object(
                        'id', rev.id,
                        'workspaceId', rev.workspace_id,
                        'taskId', rev.task_id,
                        'submissionId', rev.submission_id,
                        'reviewerId', rev.reviewer_id,
                        'decision', rev.decision,
                        'comments', rev.comments,
                        'createdAt', rev.created_at,
                        'reviewer', json_build_object(
                            'id', ru.id,
                            'username', ru.username,
                            'firstName', ru.firstname,
                            'lastName', ru.lastname,
                            'avatarUrl', ru.avatar_url
                        )
                    )
                    FROM public.workspace_task_reviews rev
                    JOIN public.users ru ON ru.id = rev.reviewer_id
                    WHERE rev.task_id = wt.id
                    ORDER BY rev.created_at DESC
                    LIMIT 1
                ) AS "latestReview",
                (
                    SELECT COUNT(*)::int 
                    FROM public.workspace_task_comments 
                    WHERE task_id = wt.id AND is_deleted = false
                ) AS "commentsCount",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', wtw.id,
                            'userId', wtw.user_id,
                            'createdAt', wtw.created_at,
                            'user', json_build_object(
                                'id', wu.id,
                                'username', wu.username,
                                'firstName', wu.firstname,
                                'lastName', wu.lastname,
                                'avatarUrl', wu.avatar_url
                            )
                        )
                    )
                    FROM public.workspace_task_watchers wtw
                    JOIN public.users wu ON wu.id = wtw.user_id
                    WHERE wtw.task_id = wt.id
                ), '[]'::json) AS "watchers"
             FROM public.workspace_tasks wt
             JOIN public.users cu ON cu.id = wt.creator_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             LEFT JOIN public.workspace_roles wr ON wr.id = wt.assigned_role_id
             WHERE wt.workspace_id = $1 AND wt.id = $2
             LIMIT 1;`,
            [workspaceId, taskId]
        );

        if (!res.rows[0]) return null;
        const row = res.rows[0];
        row.assignees = row.currentAssignees;
        return row as WorkspaceTask;
    }

    /**
     * Lists workspace tasks with filtering, search, sorting, and department isolation.
     */
    static async listTasks(
        workspaceId: string,
        options: {
            departmentId?: string;
            status?: WorkspaceTaskStatus | WorkspaceTaskStatus[];
            priority?: WorkspaceTaskPriority;
            assigneeUserId?: string;
            creatorId?: string;
            assignedByUserId?: string;
            search?: string;
            isArchived?: boolean;
            allowedDepartmentIds?: string[];
            isRestrictedIsolation?: boolean;
            actorUserId?: string;
            sortBy?: "created_at" | "due_date" | "priority" | "display_order" | "title";
            sortDir?: "asc" | "desc";
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ tasks: WorkspaceTask[]; total: number }> {
        const params: any[] = [workspaceId];
        let idx = 2;
        let where = "WHERE wt.workspace_id = $1";

        // Archive state (default: exclude archived)
        if (options.isArchived !== undefined) {
            where += ` AND wt.is_archived = $${idx++}`;
            params.push(Boolean(options.isArchived));
        } else {
            where += ` AND wt.is_archived = false`;
        }

        // Department filter
        if (options.departmentId) {
            where += ` AND wt.department_id = $${idx++}`;
            params.push(options.departmentId);
        }

        // Status filter
        if (options.status) {
            if (Array.isArray(options.status)) {
                where += ` AND wt.status = ANY($${idx++})`;
                params.push(options.status);
            } else {
                where += ` AND wt.status = $${idx++}`;
                params.push(options.status);
            }
        }

        // Priority filter
        if (options.priority) {
            where += ` AND wt.priority = $${idx++}`;
            params.push(options.priority);
        }

        // Creator filter
        if (options.creatorId) {
            where += ` AND wt.creator_id = $${idx++}`;
            params.push(options.creatorId);
        }

        // Assignee filter
        if (options.assigneeUserId) {
            where += ` AND EXISTS (
                SELECT 1 FROM public.workspace_task_assignments wta
                WHERE wta.task_id = wt.id AND wta.user_id = $${idx++} AND wta.is_active = true
            )`;
            params.push(options.assigneeUserId);
        }

        // Assigned by filter
        if (options.assignedByUserId) {
            where += ` AND EXISTS (
                SELECT 1 FROM public.workspace_task_assignments wta_by
                WHERE wta_by.task_id = wt.id AND wta_by.assigned_by = $${idx++} AND wta_by.is_active = true
            )`;
            params.push(options.assignedByUserId);
        }

        // Search (title or description)
        if (options.search) {
            where += ` AND (wt.title ILIKE $${idx} OR wt.description ILIKE $${idx})`;
            params.push(`%${options.search}%`);
            idx++;
        }

        // Department isolation & restricted task protection
        if (options.isRestrictedIsolation && options.actorUserId) {
            const allowedDepts = options.allowedDepartmentIds || [];
            where += ` AND (
                wt.is_restricted = false 
                OR (wt.department_id IS NOT NULL AND wt.department_id = ANY($${idx++}))
                OR wt.creator_id = $${idx++}
                OR EXISTS (
                    SELECT 1 FROM public.workspace_task_assignments wta_priv
                    WHERE wta_priv.task_id = wt.id AND wta_priv.user_id = $${idx++} AND wta_priv.is_active = true
                )
            )`;
            params.push(allowedDepts, options.actorUserId, options.actorUserId);
        }

        // Count query
        const countRes = await query(
            `SELECT COUNT(*)::int AS total FROM public.workspace_tasks wt ${where};`,
            params
        );
        const total = countRes.rows[0]?.total || 0;

        // Sorting
        const sortField = options.sortBy === "due_date" 
            ? "wt.due_date" 
            : options.sortBy === "priority"
            ? "CASE wt.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END"
            : options.sortBy === "title"
            ? "wt.title"
            : options.sortBy === "display_order"
            ? "wt.display_order"
            : "wt.created_at";
        const sortDir = options.sortDir === "asc" ? "ASC" : "DESC";

        const limit = options.limit || 100;
        const offset = options.offset || 0;

        params.push(limit, offset);
        const dataRes = await query(
            `SELECT
                wt.id,
                wt.workspace_id AS "workspaceId",
                wt.department_id AS "departmentId",
                wt.creator_id AS "creatorId",
                wt.title,
                wt.description,
                wt.status,
                wt.priority,
                wt.start_date AS "startDate",
                wt.due_date AS "dueDate",
                wt.assigned_role_id AS "assignedRoleId",
                COALESCE(wt.checklist, '[]'::jsonb) AS "checklist",
                COALESCE(wt.reference_links, '[]'::jsonb) AS "referenceLinks",
                wt.version,
                wt.is_restricted AS "isRestricted",
                wt.is_archived AS "isArchived",
                wt.archived_at AS "archivedAt",
                wt.archived_by AS "archivedBy",
                wt.display_order AS "displayOrder",
                wt.completed_at AS "completedAt",
                wt.created_at AS "createdAt",
                wt.updated_at AS "updatedAt",
                json_build_object(
                    'id', cu.id,
                    'username', cu.username,
                    'firstName', cu.firstname,
                    'lastName', cu.lastname,
                    'avatarUrl', cu.avatar_url
                ) AS "creator",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'color', wd.color,
                        'icon', wd.icon
                    )
                ELSE NULL END AS "department",
                CASE WHEN wr.id IS NOT NULL THEN
                    json_build_object(
                        'id', wr.id,
                        'name', wr.name,
                        'slug', wr.slug,
                        'color', wr.color,
                        'rank', wr.rank
                    )
                ELSE NULL END AS "assignedRole",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', wta.id,
                            'workspaceId', wta.workspace_id,
                            'taskId', wta.task_id,
                            'memberId', wta.member_id,
                            'userId', wta.user_id,
                            'assignedBy', wta.assigned_by,
                            'assignedAt', wta.assigned_at,
                            'isActive', wta.is_active,
                            'user', json_build_object(
                                'id', au.id,
                                'username', au.username,
                                'firstName', au.firstname,
                                'lastName', au.lastname,
                                'avatarUrl', au.avatar_url
                            )
                        ) ORDER BY wta.assigned_at ASC
                    )
                    FROM public.workspace_task_assignments wta
                    JOIN public.users au ON au.id = wta.user_id
                    WHERE wta.task_id = wt.id AND wta.is_active = true
                ), '[]'::json) AS "currentAssignees",
                (
                    SELECT COUNT(*)::int 
                    FROM public.workspace_task_comments 
                    WHERE task_id = wt.id AND is_deleted = false
                ) AS "commentsCount"
             FROM public.workspace_tasks wt
             JOIN public.users cu ON cu.id = wt.creator_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             LEFT JOIN public.workspace_roles wr ON wr.id = wt.assigned_role_id
             ${where}
             ORDER BY ${sortField} ${sortDir}
             LIMIT $${idx++} OFFSET $${idx++};`,
            params
        );

        const tasks = dataRes.rows.map((row) => {
            row.assignees = row.currentAssignees;
            return row as WorkspaceTask;
        });

        return { tasks, total };
    }

    /**
     * Retrieves categorized tasks for the "My Tasks" view.
     */
    static async getMyTasks(
        workspaceId: string,
        userId: string,
        tab: "assigned_to_me" | "created_by_me" | "assigned_by_me" | "department_tasks" | "due_soon" | "overdue" | "completed" | "awaiting_review" | "archived",
        options: {
            allowedDepartmentIds?: string[];
            isReviewer?: boolean;
        } = {}
    ): Promise<WorkspaceTask[]> {
        let condition = "";
        const params: any[] = [workspaceId];

        if (tab === "assigned_to_me") {
            params.push(userId);
            condition = `
                EXISTS (
                    SELECT 1 FROM public.workspace_task_assignments a 
                    WHERE a.task_id = wt.id AND a.user_id = $2 AND a.is_active = true
                )
                AND wt.is_archived = false 
                AND wt.status NOT IN ('completed', 'cancelled')
            `;
        } else if (tab === "created_by_me") {
            params.push(userId);
            condition = `
                wt.creator_id = $2
                AND wt.is_archived = false
            `;
        } else if (tab === "assigned_by_me") {
            params.push(userId);
            condition = `
                EXISTS (
                    SELECT 1 FROM public.workspace_task_assignments a 
                    WHERE a.task_id = wt.id AND a.assigned_by = $2 AND a.is_active = true
                )
                AND wt.is_archived = false
            `;
        } else if (tab === "department_tasks") {
            const allowedDepts = options.allowedDepartmentIds || [];
            params.push(allowedDepts);
            condition = `
                wt.department_id IS NOT NULL 
                AND wt.department_id = ANY($2)
                AND wt.is_archived = false
            `;
        } else if (tab === "due_soon") {
            params.push(userId);
            condition = `
                wt.due_date IS NOT NULL
                AND wt.due_date >= NOW()
                AND wt.due_date <= NOW() + INTERVAL '7 days'
                AND wt.status NOT IN ('completed', 'cancelled', 'archived')
                AND wt.is_archived = false
                AND (
                    wt.creator_id = $2 
                    OR EXISTS (
                        SELECT 1 FROM public.workspace_task_assignments a 
                        WHERE a.task_id = wt.id AND a.user_id = $2 AND a.is_active = true
                    )
                )
            `;
        } else if (tab === "overdue") {
            params.push(userId);
            condition = `
                wt.due_date IS NOT NULL
                AND wt.due_date < NOW()
                AND wt.status NOT IN ('completed', 'cancelled', 'archived')
                AND wt.is_archived = false
                AND (
                    wt.creator_id = $2 
                    OR EXISTS (
                        SELECT 1 FROM public.workspace_task_assignments a 
                        WHERE a.task_id = wt.id AND a.user_id = $2 AND a.is_active = true
                    )
                )
            `;
        } else if (tab === "completed") {
            params.push(userId);
            condition = `
                wt.status IN ('completed', 'approved')
                AND wt.is_archived = false
                AND (
                    wt.creator_id = $2 
                    OR EXISTS (
                        SELECT 1 FROM public.workspace_task_assignments a 
                        WHERE a.task_id = wt.id AND a.user_id = $2
                    )
                )
            `;
        } else if (tab === "awaiting_review") {
            params.push(userId);
            const allowedDepts = options.allowedDepartmentIds || [];
            params.push(allowedDepts);
            condition = `
                wt.status = 'submitted'
                AND wt.is_archived = false
                AND (
                    wt.creator_id = $2
                    OR (wt.department_id IS NOT NULL AND wt.department_id = ANY($3))
                    ${options.isReviewer ? "OR wt.department_id IS NULL" : ""}
                )
            `;
        } else if (tab === "archived") {
            params.push(userId);
            const allowedDepts = options.allowedDepartmentIds || [];
            params.push(allowedDepts);
            condition = `
                wt.is_archived = true
                AND (
                    wt.creator_id = $2
                    OR EXISTS (
                        SELECT 1 FROM public.workspace_task_assignments a
                        WHERE a.task_id = wt.id AND a.user_id = $2
                    )
                    OR (wt.department_id IS NOT NULL AND wt.department_id = ANY($3))
                    ${options.isReviewer ? "OR wt.department_id IS NULL" : ""}
                )
            `;
        }

        const res = await query(
            `SELECT
                wt.id,
                wt.workspace_id AS "workspaceId",
                wt.department_id AS "departmentId",
                wt.creator_id AS "creatorId",
                wt.title,
                wt.description,
                wt.status,
                wt.priority,
                wt.start_date AS "startDate",
                wt.due_date AS "dueDate",
                wt.assigned_role_id AS "assignedRoleId",
                COALESCE(wt.checklist, '[]'::jsonb) AS "checklist",
                COALESCE(wt.reference_links, '[]'::jsonb) AS "referenceLinks",
                wt.version,
                wt.is_restricted AS "isRestricted",
                wt.is_archived AS "isArchived",
                wt.archived_at AS "archivedAt",
                wt.archived_by AS "archivedBy",
                wt.display_order AS "displayOrder",
                wt.completed_at AS "completedAt",
                wt.created_at AS "createdAt",
                wt.updated_at AS "updatedAt",
                json_build_object(
                    'id', cu.id,
                    'username', cu.username,
                    'firstName', cu.firstname,
                    'lastName', cu.lastname,
                    'avatarUrl', cu.avatar_url
                ) AS "creator",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'color', wd.color,
                        'icon', wd.icon
                    )
                ELSE NULL END AS "department",
                COALESCE((
                    SELECT json_agg(
                        json_build_object(
                            'id', wta.id,
                            'workspaceId', wta.workspace_id,
                            'taskId', wta.task_id,
                            'memberId', wta.member_id,
                            'userId', wta.user_id,
                            'assignedBy', wta.assigned_by,
                            'assignedAt', wta.assigned_at,
                            'isActive', wta.is_active,
                            'user', json_build_object(
                                'id', au.id,
                                'username', au.username,
                                'firstName', au.firstname,
                                'lastName', au.lastname,
                                'avatarUrl', au.avatar_url
                            )
                        ) ORDER BY wta.assigned_at ASC
                    )
                    FROM public.workspace_task_assignments wta
                    JOIN public.users au ON au.id = wta.user_id
                    WHERE wta.task_id = wt.id AND wta.is_active = true
                ), '[]'::json) AS "currentAssignees",
                (
                    SELECT json_build_object(
                        'id', sub.id,
                        'submittedBy', sub.submitted_by,
                        'content', sub.content,
                        'status', sub.status,
                        'createdAt', sub.created_at
                    )
                    FROM public.workspace_task_submissions sub
                    WHERE sub.task_id = wt.id
                    ORDER BY sub.created_at DESC
                    LIMIT 1
                ) AS "latestSubmission",
                (
                    SELECT COUNT(*)::int 
                    FROM public.workspace_task_comments 
                    WHERE task_id = wt.id AND is_deleted = false
                ) AS "commentsCount"
             FROM public.workspace_tasks wt
             JOIN public.users cu ON cu.id = wt.creator_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             WHERE wt.workspace_id = $1 AND (${condition})
             ORDER BY COALESCE(wt.due_date, wt.created_at) ASC;`,
            params
        );

        return res.rows.map((row) => {
            row.assignees = row.currentAssignees;
            return row as WorkspaceTask;
        });
    }

    /**
     * Aggregates task accountability metrics: awaiting review, unassigned, nearing deadline, overdue, blocked,
     * department workloads, and member workload distributions.
     */
    static async getTaskAccountability(
        workspaceId: string,
        allowedDepartmentIds: string[],
        isGlobalManager: boolean
    ): Promise<{
        summary: {
            awaitingReviewCount: number;
            unassignedCount: number;
            nearingDeadlineCount: number;
            overdueCount: number;
            blockedCount: number;
        };
        tasksAwaitingReview: any[];
        tasksUnassigned: any[];
        tasksNearingDeadline: any[];
        tasksOverdue: any[];
        tasksBlocked: any[];
        departmentWorkload: Array<{
            departmentId: string;
            departmentName: string;
            activeTasksCount: number;
            unassignedCount: number;
            blockedCount: number;
            awaitingReviewCount: number;
            overdueCount: number;
            memberCount: number;
        }>;
        memberWorkload: Array<{
            userId: string;
            name: string;
            username: string;
            avatarUrl: string | null;
            activeTasksCount: number;
        }>;
    }> {
        let deptFilter = "";
        const deptParams: any[] = [workspaceId];
        if (!isGlobalManager) {
            if (allowedDepartmentIds.length === 0) {
                deptFilter = "AND wt.department_id IS NULL";
            } else {
                deptFilter = `AND (wt.department_id IS NULL OR wt.department_id = ANY($2::uuid[]))`;
                deptParams.push(allowedDepartmentIds);
            }
        }

        // 1. Tasks awaiting review (status = 'submitted')
        const awaitingRes = await query(
            `SELECT wt.id, wt.title, wt.priority, wt.status, wt.due_date AS "dueDate", wt.department_id AS "departmentId",
                    wd.name AS "departmentName", cu.username AS "creatorUsername",
                    (SELECT sub.created_at FROM public.workspace_task_submissions sub WHERE sub.task_id = wt.id ORDER BY sub.created_at DESC LIMIT 1) AS "submittedAt"
             FROM public.workspace_tasks wt
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             JOIN public.users cu ON cu.id = wt.creator_id
             WHERE wt.workspace_id = $1 AND wt.is_archived = false AND wt.status = 'submitted' ${deptFilter}
             ORDER BY wt.updated_at DESC LIMIT 50;`,
            deptParams
        );

        // 2. Unassigned tasks (status not completed/cancelled/archived, and no active assignees)
        const unassignedRes = await query(
            `SELECT wt.id, wt.title, wt.priority, wt.status, wt.due_date AS "dueDate", wt.department_id AS "departmentId",
                    wd.name AS "departmentName", wt.created_at AS "createdAt"
             FROM public.workspace_tasks wt
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             WHERE wt.workspace_id = $1 AND wt.is_archived = false
               AND wt.status NOT IN ('completed', 'cancelled', 'archived')
               AND NOT EXISTS (
                   SELECT 1 FROM public.workspace_task_assignments wta 
                   WHERE wta.task_id = wt.id AND wta.is_active = true
               ) ${deptFilter}
             ORDER BY wt.created_at DESC LIMIT 50;`,
            deptParams
        );

        // 3. Nearing deadline (due in <= 48h, not completed/cancelled/archived)
        const nearingRes = await query(
            `SELECT wt.id, wt.title, wt.priority, wt.status, wt.due_date AS "dueDate", wt.department_id AS "departmentId",
                    wd.name AS "departmentName"
             FROM public.workspace_tasks wt
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             WHERE wt.workspace_id = $1 AND wt.is_archived = false
               AND wt.status NOT IN ('completed', 'cancelled', 'archived')
               AND wt.due_date IS NOT NULL
               AND wt.due_date >= NOW()
               AND wt.due_date <= NOW() + INTERVAL '48 hours' ${deptFilter}
             ORDER BY wt.due_date ASC LIMIT 50;`,
            deptParams
        );

        // 4. Overdue tasks (due < NOW(), not completed/cancelled/archived)
        const overdueRes = await query(
            `SELECT wt.id, wt.title, wt.priority, wt.status, wt.due_date AS "dueDate", wt.department_id AS "departmentId",
                    wd.name AS "departmentName"
             FROM public.workspace_tasks wt
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             WHERE wt.workspace_id = $1 AND wt.is_archived = false
               AND wt.status NOT IN ('completed', 'cancelled', 'archived')
               AND wt.due_date IS NOT NULL
               AND wt.due_date < NOW() ${deptFilter}
             ORDER BY wt.due_date ASC LIMIT 50;`,
            deptParams
        );

        // 5. Blocked tasks (status = 'blocked')
        const blockedRes = await query(
            `SELECT wt.id, wt.title, wt.priority, wt.status, wt.due_date AS "dueDate", wt.department_id AS "departmentId",
                    wd.name AS "departmentName", wt.updated_at AS "updatedAt"
             FROM public.workspace_tasks wt
             LEFT JOIN public.workspace_departments wd ON wd.id = wt.department_id
             WHERE wt.workspace_id = $1 AND wt.is_archived = false
               AND wt.status = 'blocked' ${deptFilter}
             ORDER BY wt.updated_at DESC LIMIT 50;`,
            deptParams
        );

        // 6. Department workload breakdown
        const deptWorkloadQuery = `
            SELECT 
                wd.id AS "departmentId",
                wd.name AS "departmentName",
                COUNT(wt.id) FILTER (WHERE wt.status NOT IN ('completed', 'cancelled', 'archived'))::int AS "activeTasksCount",
                COUNT(wt.id) FILTER (WHERE wt.status NOT IN ('completed', 'cancelled', 'archived') AND NOT EXISTS (
                    SELECT 1 FROM public.workspace_task_assignments wta WHERE wta.task_id = wt.id AND wta.is_active = true
                ))::int AS "unassignedCount",
                COUNT(wt.id) FILTER (WHERE wt.status = 'blocked')::int AS "blockedCount",
                COUNT(wt.id) FILTER (WHERE wt.status = 'submitted')::int AS "awaitingReviewCount",
                COUNT(wt.id) FILTER (WHERE wt.due_date < NOW() AND wt.status NOT IN ('completed', 'cancelled', 'archived'))::int AS "overdueCount",
                (SELECT COUNT(*)::int FROM public.workspace_department_members wdm WHERE wdm.department_id = wd.id) AS "memberCount"
            FROM public.workspace_departments wd
            LEFT JOIN public.workspace_tasks wt ON wt.department_id = wd.id AND wt.is_archived = false
            WHERE wd.workspace_id = $1 ${!isGlobalManager && allowedDepartmentIds.length > 0 ? "AND wd.id = ANY($2::uuid[])" : ""}
            GROUP BY wd.id, wd.name
            ORDER BY wd.display_order ASC;
        `;
        const deptWorkloadRes = await query(deptWorkloadQuery, deptParams);

        // 7. Member workload distribution (active assigned tasks per member)
        const memberWorkloadRes = await query(
            `SELECT 
                u.id AS "userId",
                COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, 'Member') AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                COUNT(wt.id)::int AS "activeTasksCount"
             FROM public.workspace_task_assignments wta
             JOIN public.users u ON u.id = wta.user_id
             JOIN public.workspace_tasks wt ON wt.id = wta.task_id
             WHERE wt.workspace_id = $1 
               AND wta.is_active = true 
               AND wt.is_archived = false 
               AND wt.status NOT IN ('completed', 'cancelled', 'archived')
               ${deptFilter}
             GROUP BY u.id, u.firstname, u.lastname, u.username, u.avatar_url
             ORDER BY "activeTasksCount" DESC
             LIMIT 20;`,
            deptParams
        );

        return {
            summary: {
                awaitingReviewCount: awaitingRes.rows.length,
                unassignedCount: unassignedRes.rows.length,
                nearingDeadlineCount: nearingRes.rows.length,
                overdueCount: overdueRes.rows.length,
                blockedCount: blockedRes.rows.length,
            },
            tasksAwaitingReview: awaitingRes.rows,
            tasksUnassigned: unassignedRes.rows,
            tasksNearingDeadline: nearingRes.rows,
            tasksOverdue: overdueRes.rows,
            tasksBlocked: blockedRes.rows,
            departmentWorkload: deptWorkloadRes.rows,
            memberWorkload: memberWorkloadRes.rows,
        };
    }

    /**
     * Retrieves chronological reassignment history for a specific task.
     */
    static async getTaskReassignments(
        workspaceId: string,
        taskId: string
    ): Promise<Array<{
        id: string;
        taskId: string;
        userId: string;
        assignedBy: string;
        assignedAt: Date;
        unassignedAt: Date | null;
        isActive: boolean;
        user: {
            id: string;
            name: string;
            username: string;
            avatarUrl: string | null;
        };
        assignedByUser: {
            id: string;
            name: string;
            username: string;
        } | null;
    }>> {
        const res = await query(
            `SELECT 
                wta.id,
                wta.task_id AS "taskId",
                wta.user_id AS "userId",
                wta.assigned_by AS "assignedBy",
                wta.assigned_at AS "assignedAt",
                wta.unassigned_at AS "unassignedAt",
                wta.is_active AS "isActive",
                json_build_object(
                    'id', u.id,
                    'name', COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, 'Member'),
                    'username', u.username,
                    'avatarUrl', u.avatar_url
                ) AS "user",
                CASE WHEN ab.id IS NOT NULL THEN
                    json_build_object(
                        'id', ab.id,
                        'name', COALESCE(NULLIF(TRIM(CONCAT(ab.firstname, ' ', ab.lastname)), ''), ab.username, 'User'),
                        'username', ab.username
                    )
                ELSE NULL END AS "assignedByUser"
             FROM public.workspace_task_assignments wta
             JOIN public.users u ON u.id = wta.user_id
             LEFT JOIN public.users ab ON ab.id = wta.assigned_by
             WHERE wta.workspace_id = $1 AND wta.task_id = $2
             ORDER BY wta.assigned_at ASC;`,
            [workspaceId, taskId]
        );
        return res.rows;
    }

    /**
     * Records a member transfer between departments.
     */
    static async recordDepartmentTransfer(
        clientOrNull: any,
        data: {
            workspaceId: string;
            userId: string;
            fromDepartmentId: string | null;
            toDepartmentId: string;
            transferredBy: string;
            reason?: string | null;
        }
    ) {
        const executor = clientOrNull || pool;
        const res = await executor.query(
            `INSERT INTO public.workspace_department_transfers (
                workspace_id, user_id, from_department_id, to_department_id, transferred_by, reason
             ) VALUES ($1, $2, $3, $4, $5, $6)
             RETURNING id, workspace_id AS "workspaceId", user_id AS "userId",
                       from_department_id AS "fromDepartmentId", to_department_id AS "toDepartmentId",
                       transferred_by AS "transferredBy", reason, created_at AS "createdAt";`,
            [
                data.workspaceId,
                data.userId,
                data.fromDepartmentId || null,
                data.toDepartmentId,
                data.transferredBy,
                data.reason || null,
            ]
        );
        return res.rows[0];
    }

    /**
     * Lists department transfer records for a workspace.
     */
    static async listDepartmentTransfers(
        workspaceId: string,
        options: {
            userId?: string;
            departmentId?: string;
            limit?: number;
            offset?: number;
        } = {}
    ) {
        const params: any[] = [workspaceId];
        let where = "wdt.workspace_id = $1";

        if (options.userId) {
            params.push(options.userId);
            where += ` AND wdt.user_id = $${params.length}`;
        }
        if (options.departmentId) {
            params.push(options.departmentId);
            where += ` AND (wdt.from_department_id = $${params.length} OR wdt.to_department_id = $${params.length})`;
        }

        const limit = Math.min(options.limit || 50, 100);
        const offset = options.offset || 0;
        params.push(limit, offset);

        const res = await query(
            `SELECT 
                wdt.id,
                wdt.workspace_id AS "workspaceId",
                wdt.user_id AS "userId",
                wdt.from_department_id AS "fromDepartmentId",
                wdt.to_department_id AS "toDepartmentId",
                wdt.transferred_by AS "transferredBy",
                wdt.reason,
                wdt.created_at AS "createdAt",
                json_build_object(
                    'id', u.id,
                    'name', COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username, 'Member'),
                    'username', u.username,
                    'avatarUrl', u.avatar_url
                ) AS "user",
                json_build_object(
                    'id', tb.id,
                    'name', COALESCE(NULLIF(TRIM(CONCAT(tb.firstname, ' ', tb.lastname)), ''), tb.username, 'Admin'),
                    'username', tb.username
                ) AS "transferredByUser",
                CASE WHEN fd.id IS NOT NULL THEN
                    json_build_object('id', fd.id, 'name', fd.name, 'slug', fd.slug, 'color', fd.color)
                ELSE NULL END AS "fromDepartment",
                json_build_object('id', td.id, 'name', td.name, 'slug', td.slug, 'color', td.color) AS "toDepartment"
             FROM public.workspace_department_transfers wdt
             JOIN public.users u ON u.id = wdt.user_id
             JOIN public.users tb ON tb.id = wdt.transferred_by
             LEFT JOIN public.workspace_departments fd ON fd.id = wdt.from_department_id
             JOIN public.workspace_departments td ON td.id = wdt.to_department_id
             WHERE ${where}
             ORDER BY wdt.created_at DESC
             LIMIT $${params.length - 1} OFFSET $${params.length};`,
            params
        );
        return res.rows;
    }

    /**
     * Updates a task with optimistic concurrency locking (checks version).
     */
    static async updateTask(
        clientOrNull: any,
        workspaceId: string,
        taskId: string,
        updates: {
            title?: string;
            description?: string | null;
            departmentId?: string | null;
            status?: WorkspaceTaskStatus;
            priority?: WorkspaceTaskPriority;
            startDate?: string | null;
            dueDate?: string | null;
            assignedRoleId?: string | null;
            checklist?: WorkspaceTaskChecklistItem[];
            referenceLinks?: WorkspaceTaskReferenceLink[];
            isRestricted?: boolean;
            completedAt?: string | null;
            displayOrder?: number;
        },
        expectedVersion?: number
    ): Promise<WorkspaceTask> {
        const executor = clientOrNull || { query };

        const setClauses: string[] = ["updated_at = NOW()", "version = version + 1"];
        const params: any[] = [workspaceId, taskId];
        let idx = 3;

        if (updates.title !== undefined) {
            setClauses.push(`title = $${idx++}`);
            params.push(updates.title);
        }
        if (updates.description !== undefined) {
            setClauses.push(`description = $${idx++}`);
            params.push(updates.description);
        }
        if (updates.departmentId !== undefined) {
            setClauses.push(`department_id = $${idx++}`);
            params.push(updates.departmentId);
        }
        if (updates.status !== undefined) {
            setClauses.push(`status = $${idx++}`);
            params.push(updates.status);
            if (updates.status === "completed" || updates.status === "approved") {
                setClauses.push(`completed_at = COALESCE(completed_at, NOW())`);
            }
        }
        if (updates.priority !== undefined) {
            setClauses.push(`priority = $${idx++}`);
            params.push(updates.priority);
        }
        if (updates.startDate !== undefined) {
            setClauses.push(`start_date = $${idx++}`);
            params.push(updates.startDate);
        }
        if (updates.dueDate !== undefined) {
            setClauses.push(`due_date = $${idx++}`);
            params.push(updates.dueDate);
        }
        if (updates.assignedRoleId !== undefined) {
            setClauses.push(`assigned_role_id = $${idx++}`);
            params.push(updates.assignedRoleId);
        }
        if (updates.checklist !== undefined) {
            setClauses.push(`checklist = $${idx++}::jsonb`);
            params.push(JSON.stringify(updates.checklist));
        }
        if (updates.referenceLinks !== undefined) {
            setClauses.push(`reference_links = $${idx++}::jsonb`);
            params.push(JSON.stringify(updates.referenceLinks));
        }
        if (updates.isRestricted !== undefined) {
            setClauses.push(`is_restricted = $${idx++}`);
            params.push(Boolean(updates.isRestricted));
        }
        if (updates.completedAt !== undefined) {
            setClauses.push(`completed_at = $${idx++}`);
            params.push(updates.completedAt);
        }
        if (updates.displayOrder !== undefined) {
            setClauses.push(`display_order = $${idx++}`);
            params.push(updates.displayOrder);
        }

        let versionClause = "";
        if (expectedVersion !== undefined && expectedVersion !== null) {
            versionClause = ` AND version = $${idx++}`;
            params.push(expectedVersion);
        }

        const updateRes = await executor.query(
            `UPDATE public.workspace_tasks
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2 ${versionClause}
             RETURNING id, version;`,
            params
        );

        if (updateRes.rows.length === 0) {
            // Check if task exists to differentiate between 404 Not Found and 409 Conflict
            const existCheck = await executor.query(
                `SELECT version FROM public.workspace_tasks WHERE workspace_id = $1 AND id = $2;`,
                [workspaceId, taskId]
            );
            if (existCheck.rows.length === 0) {
                throw new Error("Task not found.");
            } else {
                throw new Error(
                    `Concurrency conflict: Task has been modified by another action (expected version ${expectedVersion}, current version is ${existCheck.rows[0].version}). Please refresh and try again.`
                );
            }
        }

        const updated = await this.findTaskById(workspaceId, taskId, clientOrNull);
        if (!updated) throw new Error("Task not found after update.");
        return updated;
    }

    /**
     * Reassigns members to a task transactionally with full reassignment history tracking.
     */
    static async setTaskAssignees(
        clientOrNull: any,
        workspaceId: string,
        taskId: string,
        assigneeUserIds: string[],
        actorUserId: string
    ): Promise<WorkspaceTask> {
        const executor = clientOrNull || { query };

        // 1. Get current active assignments
        const activeRes = await executor.query(
            `SELECT user_id FROM public.workspace_task_assignments
             WHERE task_id = $1 AND is_active = true;`,
            [taskId]
        );
        const currentActiveUserIds: string[] = activeRes.rows.map((r: any) => r.user_id);

        const toUnassign = currentActiveUserIds.filter((uid) => !assigneeUserIds.includes(uid));
        const toAdd = assigneeUserIds.filter((uid) => !currentActiveUserIds.includes(uid));

        // 2. Deactivate unassigned members
        if (toUnassign.length > 0) {
            await executor.query(
                `UPDATE public.workspace_task_assignments
                 SET is_active = false, unassigned_at = NOW(), updated_at = NOW()
                 WHERE task_id = $1 AND user_id = ANY($2) AND is_active = true;`,
                [taskId, toUnassign]
            );
        }

        // 3. Insert new assignees
        for (const uid of toAdd) {
            const memRes = await executor.query(
                `SELECT id FROM public.workspace_members 
                 WHERE workspace_id = $1 AND user_id = $2
                 LIMIT 1;`,
                [workspaceId, uid]
            );
            if (!memRes.rows[0]) {
                throw new Error(`User ${uid} is not a valid workspace member.`);
            }

            await executor.query(
                `INSERT INTO public.workspace_task_assignments (
                    workspace_id,
                    task_id,
                    member_id,
                    user_id,
                    assigned_by,
                    is_active
                ) VALUES ($1, $2, $3, $4, $5, true);`,
                [workspaceId, taskId, memRes.rows[0].id, uid, actorUserId]
            );

            // Add assignee as watcher
            await executor.query(
                `INSERT INTO public.workspace_task_watchers (workspace_id, task_id, user_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (task_id, user_id) DO NOTHING;`,
                [workspaceId, taskId, uid]
            );
        }

        // 4. Update task status if it was 'draft' and now has assignees
        if (assigneeUserIds.length > 0) {
            await executor.query(
                `UPDATE public.workspace_tasks
                 SET status = 'assigned', version = version + 1, updated_at = NOW()
                 WHERE id = $1 AND status = 'draft';`,
                [taskId]
            );
        }

        // 5. Log activity
        await executor.query(
            `INSERT INTO public.workspace_task_activity (
                workspace_id,
                task_id,
                actor_id,
                action,
                details
            ) VALUES ($1, $2, $3, 'reassigned', $4::jsonb);`,
            [
                workspaceId,
                taskId,
                actorUserId,
                JSON.stringify({
                    addedUserIds: toAdd,
                    removedUserIds: toUnassign,
                    totalAssignees: assigneeUserIds.length,
                }),
            ]
        );

        const updated = await this.findTaskById(workspaceId, taskId, clientOrNull);
        if (!updated) throw new Error("Task not found after assignment.");
        return updated;
    }

    /**
     * Submits work deliverable for a task.
     */
    static async createTaskSubmission(
        clientOrNull: any,
        data: {
            workspaceId: string;
            taskId: string;
            submittedBy: string;
            content: string;
            attachments?: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }>;
        }
    ): Promise<WorkspaceTaskSubmission> {
        const executor = clientOrNull || { query };

        const res = await executor.query(
            `INSERT INTO public.workspace_task_submissions (
                workspace_id,
                task_id,
                submitted_by,
                content,
                attachments,
                status
            ) VALUES ($1, $2, $3, $4, $5::jsonb, 'pending')
            RETURNING id, workspace_id AS "workspaceId", task_id AS "taskId", submitted_by AS "submittedBy", content, attachments, status, created_at AS "createdAt", updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.taskId,
                data.submittedBy,
                data.content,
                JSON.stringify(data.attachments || []),
            ]
        );

        const sub = res.rows[0];

        // Log task activity
        await executor.query(
            `INSERT INTO public.workspace_task_activity (
                workspace_id,
                task_id,
                actor_id,
                action,
                details
            ) VALUES ($1, $2, $3, 'submitted', $4::jsonb);`,
            [
                data.workspaceId,
                data.taskId,
                data.submittedBy,
                JSON.stringify({
                    submissionId: sub.id,
                    attachmentCount: data.attachments?.length || 0,
                }),
            ]
        );

        return sub as WorkspaceTaskSubmission;
    }

    /**
     * Submits a review decision (approved or changes_requested).
     */
    static async createTaskReview(
        clientOrNull: any,
        data: {
            workspaceId: string;
            taskId: string;
            submissionId: string;
            reviewerId: string;
            decision: "approved" | "changes_requested";
            comments: string;
        }
    ): Promise<WorkspaceTaskReview> {
        const executor = clientOrNull || { query };

        const res = await executor.query(
            `INSERT INTO public.workspace_task_reviews (
                workspace_id,
                task_id,
                submission_id,
                reviewer_id,
                decision,
                comments
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id, workspace_id AS "workspaceId", task_id AS "taskId", submission_id AS "submissionId", reviewer_id AS "reviewerId", decision, comments, created_at AS "createdAt";`,
            [
                data.workspaceId,
                data.taskId,
                data.submissionId,
                data.reviewerId,
                data.decision,
                data.comments,
            ]
        );

        const rev = res.rows[0];

        // Update submission status
        await executor.query(
            `UPDATE public.workspace_task_submissions
             SET status = $1, updated_at = NOW()
             WHERE id = $2;`,
            [data.decision, data.submissionId]
        );

        // Log task activity
        await executor.query(
            `INSERT INTO public.workspace_task_activity (
                workspace_id,
                task_id,
                actor_id,
                action,
                details
            ) VALUES ($1, $2, $3, 'reviewed', $4::jsonb);`,
            [
                data.workspaceId,
                data.taskId,
                data.reviewerId,
                JSON.stringify({
                    reviewId: rev.id,
                    decision: data.decision,
                }),
            ]
        );

        return rev as WorkspaceTaskReview;
    }

    /**
     * Posts a comment or reply to a task discussion.
     */
    static async createTaskComment(
        clientOrNull: any,
        data: {
            workspaceId: string;
            taskId: string;
            authorId: string;
            content: string;
            parentCommentId?: string | null;
            mentions?: string[];
            attachments?: Array<{ name: string; url: string; sizeBytes?: number; mimeType?: string }>;
        }
    ): Promise<WorkspaceTaskComment> {
        const executor = clientOrNull || { query };

        const res = await executor.query(
            `INSERT INTO public.workspace_task_comments (
                workspace_id,
                task_id,
                author_id,
                parent_comment_id,
                content,
                mentions,
                attachments
            ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
            RETURNING id, workspace_id AS "workspaceId", task_id AS "taskId", author_id AS "authorId", parent_comment_id AS "parentCommentId", content, mentions, attachments, is_edited AS "isEdited", is_deleted AS "isDeleted", created_at AS "createdAt", updated_at AS "updatedAt";`,
            [
                data.workspaceId,
                data.taskId,
                data.authorId,
                data.parentCommentId || null,
                data.content,
                JSON.stringify(data.mentions || []),
                JSON.stringify(data.attachments || []),
            ]
        );

        const comment = res.rows[0];

        // Automatically add author as watcher
        await executor.query(
            `INSERT INTO public.workspace_task_watchers (workspace_id, task_id, user_id)
             VALUES ($1, $2, $3)
             ON CONFLICT (task_id, user_id) DO NOTHING;`,
            [data.workspaceId, data.taskId, data.authorId]
        );

        // Fetch author info
        const userRes = await executor.query(
            `SELECT id, username, firstname AS "firstName", lastname AS "lastName", avatar_url AS "avatarUrl"
             FROM public.users WHERE id = $1;`,
            [data.authorId]
        );
        comment.author = userRes.rows[0] || null;

        return comment as WorkspaceTaskComment;
    }

    /**
     * Retrieves threaded comments for a task.
     */
    static async getTaskComments(
        workspaceId: string,
        taskId: string
    ): Promise<WorkspaceTaskComment[]> {
        const res = await query(
            `SELECT
                tc.id,
                tc.workspace_id AS "workspaceId",
                tc.task_id AS "taskId",
                tc.author_id AS "authorId",
                tc.parent_comment_id AS "parentCommentId",
                tc.content,
                COALESCE(tc.mentions, '[]'::jsonb) AS "mentions",
                COALESCE(tc.attachments, '[]'::jsonb) AS "attachments",
                tc.is_edited AS "isEdited",
                tc.is_deleted AS "isDeleted",
                tc.created_at AS "createdAt",
                tc.updated_at AS "updatedAt",
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "author"
             FROM public.workspace_task_comments tc
             JOIN public.users u ON u.id = tc.author_id
             WHERE tc.workspace_id = $1 AND tc.task_id = $2
             ORDER BY tc.created_at ASC;`,
            [workspaceId, taskId]
        );

        // Build hierarchy for threaded replies
        const comments: WorkspaceTaskComment[] = [];
        const map = new Map<string, WorkspaceTaskComment>();

        for (const row of res.rows) {
            row.replies = [];
            map.set(row.id, row);
        }

        for (const row of res.rows) {
            if (row.parentCommentId && map.has(row.parentCommentId)) {
                map.get(row.parentCommentId)!.replies!.push(row);
            } else {
                comments.push(row);
            }
        }

        return comments;
    }

    /**
     * Toggles watcher subscription for a task.
     */
    static async toggleTaskWatcher(
        workspaceId: string,
        taskId: string,
        userId: string
    ): Promise<{ isWatching: boolean }> {
        const check = await query(
            `SELECT id FROM public.workspace_task_watchers 
             WHERE task_id = $1 AND user_id = $2;`,
            [taskId, userId]
        );

        if (check.rows.length > 0) {
            await query(
                `DELETE FROM public.workspace_task_watchers 
                 WHERE task_id = $1 AND user_id = $2;`,
                [taskId, userId]
            );
            return { isWatching: false };
        } else {
            await query(
                `INSERT INTO public.workspace_task_watchers (workspace_id, task_id, user_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT (task_id, user_id) DO NOTHING;`,
                [workspaceId, taskId, userId]
            );
            return { isWatching: true };
        }
    }

    /**
     * Retrieves chronological activity stream for a task.
     */
    static async getTaskActivity(
        workspaceId: string,
        taskId: string,
        limit = 50
    ): Promise<WorkspaceTaskActivity[]> {
        const res = await query(
            `SELECT
                ta.id,
                ta.workspace_id AS "workspaceId",
                ta.task_id AS "taskId",
                ta.actor_id AS "actorId",
                ta.action,
                ta.details,
                ta.created_at AS "createdAt",
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "actor"
             FROM public.workspace_task_activity ta
             JOIN public.users u ON u.id = ta.actor_id
             WHERE ta.workspace_id = $1 AND ta.task_id = $2
             ORDER BY ta.created_at DESC
             LIMIT $3;`,
            [workspaceId, taskId, limit]
        );

        return res.rows as WorkspaceTaskActivity[];
    }

    /**
     * Archives a task (soft-deletion).
     */
    static async archiveTask(
        clientOrNull: any,
        workspaceId: string,
        taskId: string,
        actorUserId: string
    ): Promise<WorkspaceTask> {
        const executor = clientOrNull || { query };

        await executor.query(
            `UPDATE public.workspace_tasks
             SET is_archived = true,
                 status = 'archived',
                 archived_at = NOW(),
                 archived_by = $3,
                 version = version + 1,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, taskId, actorUserId]
        );

        await executor.query(
            `INSERT INTO public.workspace_task_activity (
                workspace_id,
                task_id,
                actor_id,
                action,
                details
            ) VALUES ($1, $2, $3, 'archived', '{}'::jsonb);`,
            [workspaceId, taskId, actorUserId]
        );

        const archived = await this.findTaskById(workspaceId, taskId, clientOrNull);
        if (!archived) throw new Error("Task not found.");
        return archived;
    }

    // =========================================================================
    // 6. MEDIA AND DOCUMENT MANAGEMENT (PHASE 06)
    // =========================================================================

    static mapWorkspaceFileRow(row: any): WorkspaceFile {
        return {
            id: row.id,
            workspaceId: row.workspaceId,
            uploaderId: row.uploaderId,
            channelId: row.channelId,
            messageId: row.messageId,
            taskId: row.taskId,
            departmentId: row.departmentId,
            submissionId: row.submissionId,
            fileName: row.fileName,
            fileSizeBytes: Number(row.fileSizeBytes),
            mimeType: row.mimeType,
            cloudinaryPublicId: row.cloudinaryPublicId,
            cloudinaryAssetId: row.cloudinaryAssetId,
            cloudinaryUrl: row.cloudinaryUrl,
            cloudinarySecureUrl: row.cloudinarySecureUrl,
            resourceType: row.resourceType,
            deliveryType: row.deliveryType || "authenticated",
            format: row.format,
            checksum: row.checksum,
            purpose: row.purpose,
            parentResourceType: row.parentResourceType || "attachment",
            parentResourceId: row.parentResourceId,
            assetStatus: row.assetStatus || "active",
            isArchived: row.isArchived ?? false,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            uploader: row.user_id
                ? {
                      id: row.user_id,
                      username: row.user_username,
                      firstName: row.user_firstname,
                      lastName: row.user_lastname,
                      avatarUrl: row.user_avatar_url,
                  }
                : undefined,
        };
    }

    static async createUploadIntent(
        data: {
            workspaceId: string;
            userId: string;
            departmentId?: string | null;
            parentResourceType: string;
            parentResourceId?: string | null;
            publicId: string;
            folder: string;
            originalFilename: string;
            expectedMimeType: string;
            expectedSizeBytes: number;
            deliveryType: string;
            resourceType: string;
            expiresAt: string;
        },
        clientOrNull?: any
    ): Promise<WorkspaceFileUploadIntent> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_file_upload_intents (
                workspace_id,
                user_id,
                department_id,
                parent_resource_type,
                parent_resource_id,
                public_id,
                folder,
                original_filename,
                expected_mime_type,
                expected_size_bytes,
                delivery_type,
                resource_type,
                status,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'pending', $13)
            RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                department_id AS "departmentId",
                parent_resource_type AS "parentResourceType",
                parent_resource_id AS "parentResourceId",
                public_id AS "publicId",
                folder,
                original_filename AS "originalFilename",
                expected_mime_type AS "expectedMimeType",
                expected_size_bytes AS "expectedSizeBytes",
                delivery_type AS "deliveryType",
                resource_type AS "resourceType",
                status,
                expires_at AS "expiresAt",
                created_at AS "createdAt",
                registered_at AS "registeredAt";`,
            [
                data.workspaceId,
                data.userId,
                data.departmentId || null,
                data.parentResourceType,
                data.parentResourceId || null,
                data.publicId,
                data.folder,
                data.originalFilename,
                data.expectedMimeType,
                data.expectedSizeBytes,
                data.deliveryType || "authenticated",
                data.resourceType || "auto",
                data.expiresAt,
            ]
        );
        return res.rows[0];
    }

    static async findUploadIntentById(
        intentId: string,
        clientOrNull?: any
    ): Promise<WorkspaceFileUploadIntent | null> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                department_id AS "departmentId",
                parent_resource_type AS "parentResourceType",
                parent_resource_id AS "parentResourceId",
                public_id AS "publicId",
                folder,
                original_filename AS "originalFilename",
                expected_mime_type AS "expectedMimeType",
                expected_size_bytes AS "expectedSizeBytes",
                delivery_type AS "deliveryType",
                resource_type AS "resourceType",
                status,
                expires_at AS "expiresAt",
                created_at AS "createdAt",
                registered_at AS "registeredAt"
             FROM public.workspace_file_upload_intents
             WHERE id = $1;`,
            [intentId]
        );
        return res.rows[0] || null;
    }


    static async markUploadIntentRegistered(
        intentId: string,
        clientOrNull?: any
    ): Promise<void> {
        const executor = clientOrNull || { query };
        await executor.query(
            `UPDATE public.workspace_file_upload_intents
             SET status = 'registered',
                 registered_at = NOW()
             WHERE id = $1;`,
            [intentId]
        );
    }

    static async createWorkspaceFile(
        fileData: {
            workspaceId: string;
            uploaderId: string;
            departmentId?: string | null;
            channelId?: string | null;
            messageId?: string | null;
            taskId?: string | null;
            submissionId?: string | null;
            fileName: string;
            fileSizeBytes: number;
            mimeType: string;
            cloudinaryPublicId: string;
            cloudinaryAssetId?: string | null;
            cloudinaryUrl: string;
            cloudinarySecureUrl: string;
            resourceType: string;
            deliveryType?: string;
            format?: string | null;
            checksum?: string | null;
            purpose?: string;
            parentResourceType?: string;
            parentResourceId?: string | null;
        },
        clientOrNull?: any
    ): Promise<WorkspaceFile> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_files (
                workspace_id,
                uploader_id,
                department_id,
                channel_id,
                message_id,
                task_id,
                submission_id,
                file_name,
                file_size_bytes,
                mime_type,
                cloudinary_public_id,
                cloudinary_asset_id,
                cloudinary_url,
                cloudinary_secure_url,
                resource_type,
                delivery_type,
                format,
                checksum,
                purpose,
                parent_resource_type,
                parent_resource_id,
                asset_status,
                created_at,
                updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
                $21, 'active', NOW(), NOW()
            )
            RETURNING
                id,
                workspace_id AS "workspaceId",
                uploader_id AS "uploaderId",
                channel_id AS "channelId",
                message_id AS "messageId",
                task_id AS "taskId",
                department_id AS "departmentId",
                submission_id AS "submissionId",
                file_name AS "fileName",
                file_size_bytes AS "fileSizeBytes",
                mime_type AS "mimeType",
                cloudinary_public_id AS "cloudinaryPublicId",
                cloudinary_asset_id AS "cloudinaryAssetId",
                cloudinary_url AS "cloudinaryUrl",
                cloudinary_secure_url AS "cloudinarySecureUrl",
                resource_type AS "resourceType",
                delivery_type AS "deliveryType",
                format,
                checksum,
                purpose,
                parent_resource_type AS "parentResourceType",
                parent_resource_id AS "parentResourceId",
                asset_status AS "assetStatus",
                is_archived AS "isArchived",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                deleted_at AS "deletedAt";`,
            [
                fileData.workspaceId,
                fileData.uploaderId,
                fileData.departmentId || null,
                fileData.channelId || null,
                fileData.messageId || null,
                fileData.taskId || null,
                fileData.submissionId || null,
                fileData.fileName,
                fileData.fileSizeBytes,
                fileData.mimeType,
                fileData.cloudinaryPublicId,
                fileData.cloudinaryAssetId || null,
                fileData.cloudinaryUrl,
                fileData.cloudinarySecureUrl,
                fileData.resourceType || "auto",
                fileData.deliveryType || "authenticated",
                fileData.format || null,
                fileData.checksum || null,
                fileData.purpose || "attachment",
                fileData.parentResourceType || "attachment",
                fileData.parentResourceId || null,
            ]
        );

        return this.mapWorkspaceFileRow(res.rows[0]);
    }

    static async findFileById(
        workspaceId: string,
        fileId: string,
        clientOrNull?: any
    ): Promise<WorkspaceFile | null> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `SELECT
                wf.id,
                wf.workspace_id AS "workspaceId",
                wf.uploader_id AS "uploaderId",
                wf.channel_id AS "channelId",
                wf.message_id AS "messageId",
                wf.task_id AS "taskId",
                wf.department_id AS "departmentId",
                wf.submission_id AS "submissionId",
                wf.file_name AS "fileName",
                wf.file_size_bytes AS "fileSizeBytes",
                wf.mime_type AS "mimeType",
                wf.cloudinary_public_id AS "cloudinaryPublicId",
                wf.cloudinary_asset_id AS "cloudinaryAssetId",
                wf.cloudinary_url AS "cloudinaryUrl",
                wf.cloudinary_secure_url AS "cloudinarySecureUrl",
                wf.resource_type AS "resourceType",
                wf.delivery_type AS "deliveryType",
                wf.format,
                wf.checksum,
                wf.purpose,
                wf.parent_resource_type AS "parentResourceType",
                wf.parent_resource_id AS "parentResourceId",
                wf.asset_status AS "assetStatus",
                wf.is_archived AS "isArchived",
                wf.created_at AS "createdAt",
                wf.updated_at AS "updatedAt",
                wf.deleted_at AS "deletedAt",
                u.id AS "user_id",
                u.username AS "user_username",
                u.firstname AS "user_firstname",
                u.lastname AS "user_lastname",
                u.avatar_url AS "user_avatar_url"
             FROM public.workspace_files wf
             LEFT JOIN public.users u ON u.id = wf.uploader_id
             WHERE wf.workspace_id = $1 AND wf.id = $2;`,
            [workspaceId, fileId]
        );

        if (!res.rows[0]) return null;
        return this.mapWorkspaceFileRow(res.rows[0]);
    }

    static async findFileByPublicId(
        publicId: string,
        clientOrNull?: any
    ): Promise<WorkspaceFile | null> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `SELECT
                wf.id,
                wf.workspace_id AS "workspaceId",
                wf.uploader_id AS "uploaderId",
                wf.channel_id AS "channelId",
                wf.message_id AS "messageId",
                wf.task_id AS "taskId",
                wf.department_id AS "departmentId",
                wf.submission_id AS "submissionId",
                wf.file_name AS "fileName",
                wf.file_size_bytes AS "fileSizeBytes",
                wf.mime_type AS "mimeType",
                wf.cloudinary_public_id AS "cloudinaryPublicId",
                wf.cloudinary_asset_id AS "cloudinaryAssetId",
                wf.cloudinary_url AS "cloudinaryUrl",
                wf.cloudinary_secure_url AS "cloudinarySecureUrl",
                wf.resource_type AS "resourceType",
                wf.delivery_type AS "deliveryType",
                wf.format,
                wf.checksum,
                wf.purpose,
                wf.parent_resource_type AS "parentResourceType",
                wf.parent_resource_id AS "parentResourceId",
                wf.asset_status AS "assetStatus",
                wf.is_archived AS "isArchived",
                wf.created_at AS "createdAt",
                wf.updated_at AS "updatedAt",
                wf.deleted_at AS "deletedAt"
             FROM public.workspace_files wf
             WHERE wf.cloudinary_public_id = $1;`,
            [publicId]
        );

        if (!res.rows[0]) return null;
        return this.mapWorkspaceFileRow(res.rows[0]);
    }

    static async listWorkspaceFiles(
        workspaceId: string,
        filters: WorkspaceFileListFilters = {},
        clientOrNull?: any
    ): Promise<{ files: WorkspaceFile[]; total: number }> {
        const executor = clientOrNull || { query };
        const conditions: string[] = ["wf.workspace_id = $1", "wf.deleted_at IS NULL"];
        const params: any[] = [workspaceId];
        let pIdx = 2;

        if (filters.status) {
            conditions.push(`wf.asset_status = $${pIdx++}`);
            params.push(filters.status);
        } else {
            conditions.push(`wf.asset_status = 'active'`);
        }

        if (filters.departmentId) {
            conditions.push(`wf.department_id = $${pIdx++}`);
            params.push(filters.departmentId);
        }

        if (filters.channelId) {
            conditions.push(`wf.channel_id = $${pIdx++}`);
            params.push(filters.channelId);
        }

        if (filters.taskId) {
            conditions.push(`wf.task_id = $${pIdx++}`);
            params.push(filters.taskId);
        }

        if (filters.submissionId) {
            conditions.push(`wf.submission_id = $${pIdx++}`);
            params.push(filters.submissionId);
        }

        if (filters.parentResourceType) {
            conditions.push(`wf.parent_resource_type = $${pIdx++}`);
            params.push(filters.parentResourceType);
        }

        if (filters.parentResourceId) {
            conditions.push(`wf.parent_resource_id = $${pIdx++}`);
            params.push(filters.parentResourceId);
        }

        if (filters.uploaderId) {
            conditions.push(`wf.uploader_id = $${pIdx++}`);
            params.push(filters.uploaderId);
        }

        if (filters.mimeTypeCategory) {
            if (filters.mimeTypeCategory === "image") {
                conditions.push(`wf.mime_type LIKE 'image/%'`);
            } else if (filters.mimeTypeCategory === "video") {
                conditions.push(`wf.mime_type LIKE 'video/%'`);
            } else if (filters.mimeTypeCategory === "pdf") {
                conditions.push(`wf.mime_type = 'application/pdf'`);
            } else if (filters.mimeTypeCategory === "document") {
                conditions.push(`wf.mime_type NOT LIKE 'image/%' AND wf.mime_type NOT LIKE 'video/%' AND wf.mime_type != 'application/pdf'`);
            }
        }

        if (filters.search) {
            conditions.push(`wf.file_name ILIKE $${pIdx++}`);
            params.push(`%${filters.search}%`);
        }

        const whereSql = conditions.join(" AND ");

        const countRes = await executor.query(
            `SELECT COUNT(*)::int AS count FROM public.workspace_files wf WHERE ${whereSql};`,
            params
        );
        const total = countRes.rows[0]?.count || 0;

        const limit = Math.min(filters.limit || 50, 100);
        const offset = filters.offset || 0;

        const querySql = `
            SELECT
                wf.id,
                wf.workspace_id AS "workspaceId",
                wf.uploader_id AS "uploaderId",
                wf.channel_id AS "channelId",
                wf.message_id AS "messageId",
                wf.task_id AS "taskId",
                wf.department_id AS "departmentId",
                wf.submission_id AS "submissionId",
                wf.file_name AS "fileName",
                wf.file_size_bytes AS "fileSizeBytes",
                wf.mime_type AS "mimeType",
                wf.cloudinary_public_id AS "cloudinaryPublicId",
                wf.cloudinary_asset_id AS "cloudinaryAssetId",
                wf.cloudinary_url AS "cloudinaryUrl",
                wf.cloudinary_secure_url AS "cloudinarySecureUrl",
                wf.resource_type AS "resourceType",
                wf.delivery_type AS "deliveryType",
                wf.format,
                wf.checksum,
                wf.purpose,
                wf.parent_resource_type AS "parentResourceType",
                wf.parent_resource_id AS "parentResourceId",
                wf.asset_status AS "assetStatus",
                wf.is_archived AS "isArchived",
                wf.created_at AS "createdAt",
                wf.updated_at AS "updatedAt",
                wf.deleted_at AS "deletedAt",
                u.id AS "user_id",
                u.username AS "user_username",
                u.firstname AS "user_firstname",
                u.lastname AS "user_lastname",
                u.avatar_url AS "user_avatar_url"
            FROM public.workspace_files wf
            LEFT JOIN public.users u ON u.id = wf.uploader_id
            WHERE ${whereSql}
            ORDER BY wf.created_at DESC
            LIMIT $${pIdx++} OFFSET $${pIdx++};
        `;
        params.push(limit, offset);

        const dataRes = await executor.query(querySql, params);
        return {
            files: dataRes.rows.map((row: any) => this.mapWorkspaceFileRow(row)),
            total,
        };
    }

    static async listFilesByParent(
        workspaceId: string,
        parentResourceType: string,
        parentResourceId: string,
        clientOrNull?: any
    ): Promise<WorkspaceFile[]> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `SELECT
                wf.id,
                wf.workspace_id AS "workspaceId",
                wf.uploader_id AS "uploaderId",
                wf.channel_id AS "channelId",
                wf.message_id AS "messageId",
                wf.task_id AS "taskId",
                wf.department_id AS "departmentId",
                wf.submission_id AS "submissionId",
                wf.file_name AS "fileName",
                wf.file_size_bytes AS "fileSizeBytes",
                wf.mime_type AS "mimeType",
                wf.cloudinary_public_id AS "cloudinaryPublicId",
                wf.cloudinary_asset_id AS "cloudinaryAssetId",
                wf.cloudinary_url AS "cloudinaryUrl",
                wf.cloudinary_secure_url AS "cloudinarySecureUrl",
                wf.resource_type AS "resourceType",
                wf.delivery_type AS "deliveryType",
                wf.format,
                wf.checksum,
                wf.purpose,
                wf.parent_resource_type AS "parentResourceType",
                wf.parent_resource_id AS "parentResourceId",
                wf.asset_status AS "assetStatus",
                wf.is_archived AS "isArchived",
                wf.created_at AS "createdAt",
                wf.updated_at AS "updatedAt",
                wf.deleted_at AS "deletedAt",
                u.id AS "user_id",
                u.username AS "user_username",
                u.firstname AS "user_firstname",
                u.lastname AS "user_lastname",
                u.avatar_url AS "user_avatar_url"
             FROM public.workspace_files wf
             LEFT JOIN public.users u ON u.id = wf.uploader_id
             WHERE wf.workspace_id = $1
               AND wf.deleted_at IS NULL
               AND (
                    (wf.parent_resource_type = $2 AND wf.parent_resource_id = $3::uuid)
                    OR ($2 = 'task' AND wf.task_id = $3::uuid)
                    OR ($2 = 'channel' AND wf.channel_id = $3::uuid)
                    OR ($2 = 'message' AND wf.message_id = $3::uuid)
                    OR ($2 = 'task_submission' AND wf.submission_id = $3::uuid)
               )
             ORDER BY wf.created_at ASC;`,
            [workspaceId, parentResourceType, parentResourceId]
        );

        return res.rows.map((row: any) => this.mapWorkspaceFileRow(row));
    }

    static async getWorkspaceStorageUsage(
        workspaceId: string,
        quotaBytes: number = 10 * 1024 * 1024 * 1024,
        clientOrNull?: any
    ): Promise<WorkspaceStorageQuotaInfo> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `SELECT
                COALESCE(SUM(file_size_bytes), 0)::bigint AS "usedBytes",
                COUNT(*)::int AS "fileCount"
             FROM public.workspace_files
             WHERE workspace_id = $1 AND deleted_at IS NULL AND asset_status = 'active';`,
            [workspaceId]
        );

        const usedBytes = Number(res.rows[0]?.usedBytes || 0);
        const fileCount = Number(res.rows[0]?.fileCount || 0);
        const usedPercentage = quotaBytes > 0 ? Number(((usedBytes / quotaBytes) * 100).toFixed(2)) : 0;

        return {
            workspaceId,
            usedBytes,
            quotaBytes,
            usedPercentage,
            fileCount,
        };
    }

    static async updateWorkspaceFile(
        workspaceId: string,
        fileId: string,
        updates: {
            fileName?: string;
            fileSizeBytes?: number;
            mimeType?: string;
            cloudinaryPublicId?: string;
            cloudinaryAssetId?: string | null;
            cloudinaryUrl?: string;
            cloudinarySecureUrl?: string;
            resourceType?: string;
            format?: string | null;
            checksum?: string | null;
            purpose?: string;
            departmentId?: string | null;
        },
        clientOrNull?: any
    ): Promise<WorkspaceFile | null> {
        const executor = clientOrNull || { query };
        const setClauses: string[] = ["updated_at = NOW()"];
        const values: any[] = [workspaceId, fileId];
        let idx = 3;

        if (updates.fileName !== undefined) {
            setClauses.push(`file_name = $${idx++}`);
            values.push(updates.fileName);
        }
        if (updates.fileSizeBytes !== undefined) {
            setClauses.push(`file_size_bytes = $${idx++}`);
            values.push(updates.fileSizeBytes);
        }
        if (updates.mimeType !== undefined) {
            setClauses.push(`mime_type = $${idx++}`);
            values.push(updates.mimeType);
        }
        if (updates.cloudinaryPublicId !== undefined) {
            setClauses.push(`cloudinary_public_id = $${idx++}`);
            values.push(updates.cloudinaryPublicId);
        }
        if (updates.cloudinaryAssetId !== undefined) {
            setClauses.push(`cloudinary_asset_id = $${idx++}`);
            values.push(updates.cloudinaryAssetId);
        }
        if (updates.cloudinaryUrl !== undefined) {
            setClauses.push(`cloudinary_url = $${idx++}`);
            values.push(updates.cloudinaryUrl);
        }
        if (updates.cloudinarySecureUrl !== undefined) {
            setClauses.push(`cloudinary_secure_url = $${idx++}`);
            values.push(updates.cloudinarySecureUrl);
        }
        if (updates.resourceType !== undefined) {
            setClauses.push(`resource_type = $${idx++}`);
            values.push(updates.resourceType);
        }
        if (updates.format !== undefined) {
            setClauses.push(`format = $${idx++}`);
            values.push(updates.format);
        }
        if (updates.checksum !== undefined) {
            setClauses.push(`checksum = $${idx++}`);
            values.push(updates.checksum);
        }
        if (updates.purpose !== undefined) {
            setClauses.push(`purpose = $${idx++}`);
            values.push(updates.purpose);
        }
        if (updates.departmentId !== undefined) {
            setClauses.push(`department_id = $${idx++}`);
            values.push(updates.departmentId);
        }

        const res = await executor.query(
            `UPDATE public.workspace_files
             SET ${setClauses.join(", ")}
             WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL
             RETURNING
                id,
                workspace_id AS "workspaceId",
                uploader_id AS "uploaderId",
                channel_id AS "channelId",
                message_id AS "messageId",
                task_id AS "taskId",
                department_id AS "departmentId",
                submission_id AS "submissionId",
                file_name AS "fileName",
                file_size_bytes AS "fileSizeBytes",
                mime_type AS "mimeType",
                cloudinary_public_id AS "cloudinaryPublicId",
                cloudinary_asset_id AS "cloudinaryAssetId",
                cloudinary_url AS "cloudinaryUrl",
                cloudinary_secure_url AS "cloudinarySecureUrl",
                resource_type AS "resourceType",
                delivery_type AS "deliveryType",
                format,
                checksum,
                purpose,
                parent_resource_type AS "parentResourceType",
                parent_resource_id AS "parentResourceId",
                asset_status AS "assetStatus",
                is_archived AS "isArchived",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                deleted_at AS "deletedAt";`,
            values
        );

        if (!res.rows[0]) return null;
        return this.mapWorkspaceFileRow(res.rows[0]);
    }

    static async softDeleteWorkspaceFile(
        workspaceId: string,
        fileId: string,
        actorUserId: string,
        clientOrNull?: any
    ): Promise<boolean> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `UPDATE public.workspace_files
             SET deleted_at = NOW(),
                 asset_status = 'archived',
                 is_archived = true,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND id = $2 AND deleted_at IS NULL;`,
            [workspaceId, fileId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async hardDeleteWorkspaceFile(
        workspaceId: string,
        fileId: string,
        clientOrNull?: any
    ): Promise<boolean> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `DELETE FROM public.workspace_files
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, fileId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    // =========================================================================
    // 10. NOTIFICATIONS, OUTBOX, EMAILS & PREFERENCES (PHASE 07)
    // =========================================================================

    static async createNotification(
        params: {
            workspaceId: string;
            recipientId: string;
            actorId?: string | null;
            eventType: WorkspaceNotificationEventType;
            resourceType: WorkspaceNotificationResourceType;
            resourceId: string;
            title: string;
            message: string;
            destinationUrl: string;
            metadata?: Record<string, any>;
            expiresAt?: Date | string | null;
        },
        clientOrNull?: any
    ): Promise<WorkspaceNotification> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_notifications (
                workspace_id,
                recipient_id,
                actor_id,
                event_type,
                resource_type,
                resource_id,
                title,
                message,
                destination_url,
                metadata,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            RETURNING
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                actor_id AS "actorId",
                event_type AS "eventType",
                resource_type AS "resourceType",
                resource_id AS "resourceId",
                title,
                message,
                destination_url AS "destinationUrl",
                metadata,
                is_read AS "isRead",
                read_at AS "readAt",
                expires_at AS "expiresAt",
                created_at AS "createdAt";`,
            [
                params.workspaceId,
                params.recipientId,
                params.actorId || null,
                params.eventType,
                params.resourceType,
                params.resourceId,
                params.title,
                params.message,
                params.destinationUrl,
                JSON.stringify(params.metadata || {}),
                params.expiresAt ? new Date(params.expiresAt).toISOString() : null,
            ]
        );
        return res.rows[0];
    }

    static async getUserNotifications(
        workspaceId: string,
        recipientId: string,
        options?: { unreadOnly?: boolean; limit?: number; offset?: number }
    ): Promise<{ notifications: WorkspaceNotification[]; total: number; unreadCount: number }> {
        const unreadOnly = options?.unreadOnly ?? false;
        const limit = Math.min(Math.max(options?.limit ?? 20, 1), 100);
        const offset = Math.max(options?.offset ?? 0, 0);

        const unreadRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM public.workspace_notifications
             WHERE workspace_id = $1 AND recipient_id = $2 AND is_read = false
               AND (expires_at IS NULL OR expires_at > NOW());`,
            [workspaceId, recipientId]
        );
        const unreadCount = Number(unreadRes.rows[0]?.count || 0);

        let whereClause = `WHERE n.workspace_id = $1 AND n.recipient_id = $2 AND (n.expires_at IS NULL OR n.expires_at > NOW())`;
        if (unreadOnly) {
            whereClause += ` AND n.is_read = false`;
        }

        const totalRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM public.workspace_notifications n
             ${whereClause};`,
            [workspaceId, recipientId]
        );
        const total = Number(totalRes.rows[0]?.count || 0);

        const listRes = await query(
            `SELECT
                n.id,
                n.workspace_id AS "workspaceId",
                n.recipient_id AS "recipientId",
                n.actor_id AS "actorId",
                n.event_type AS "eventType",
                n.resource_type AS "resourceType",
                n.resource_id AS "resourceId",
                n.title,
                n.message,
                n.destination_url AS "destinationUrl",
                n.metadata,
                n.is_read AS "isRead",
                n.read_at AS "readAt",
                n.expires_at AS "expiresAt",
                n.created_at AS "createdAt",
                CASE WHEN u.id IS NOT NULL THEN
                    json_build_object(
                        'id', u.id,
                        'username', u.username,
                        'firstName', u.firstname,
                        'lastName', u.lastname,
                        'avatarUrl', COALESCE(u.photo_url, u.avatar_url)
                    )
                ELSE NULL END AS actor
             FROM public.workspace_notifications n
             LEFT JOIN public.users u ON u.id = n.actor_id
             ${whereClause}
             ORDER BY n.created_at DESC
             LIMIT $3 OFFSET $4;`,
            [workspaceId, recipientId, limit, offset]
        );

        return {
            notifications: listRes.rows,
            total,
            unreadCount,
        };
    }

    static async markNotificationRead(
        workspaceId: string,
        recipientId: string,
        notificationId: string
    ): Promise<boolean> {
        const res = await query(
            `UPDATE public.workspace_notifications
             SET is_read = true,
                 read_at = NOW()
             WHERE workspace_id = $1 AND recipient_id = $2 AND id = $3 AND is_read = false;`,
            [workspaceId, recipientId, notificationId]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    static async markAllNotificationsRead(
        workspaceId: string,
        recipientId: string
    ): Promise<number> {
        const res = await query(
            `UPDATE public.workspace_notifications
             SET is_read = true,
                 read_at = NOW()
             WHERE workspace_id = $1 AND recipient_id = $2 AND is_read = false;`,
            [workspaceId, recipientId]
        );
        return res.rowCount ?? 0;
    }

    // Outbox Operations
    static async createOutboxEvent(
        params: {
            workspaceId: string;
            eventType: string;
            payload: Record<string, any>;
        },
        clientOrNull?: any
    ): Promise<WorkspaceOutboxEvent> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_outbox_events (
                workspace_id,
                event_type,
                payload,
                status
            ) VALUES ($1, $2, $3, 'pending')
            RETURNING
                id,
                workspace_id AS "workspaceId",
                event_type AS "eventType",
                payload,
                status,
                retry_count AS "retryCount",
                error_message AS "errorMessage",
                published_at AS "publishedAt",
                created_at AS "createdAt";`,
            [params.workspaceId, params.eventType, JSON.stringify(params.payload || {})]
        );
        return res.rows[0];
    }

    static async getPendingOutboxEvents(limit = 50): Promise<WorkspaceOutboxEvent[]> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                event_type AS "eventType",
                payload,
                status,
                retry_count AS "retryCount",
                error_message AS "errorMessage",
                published_at AS "publishedAt",
                created_at AS "createdAt"
             FROM public.workspace_outbox_events
             WHERE status IN ('pending', 'failed') AND retry_count < 5
             ORDER BY created_at ASC
             LIMIT $1;`,
            [limit]
        );
        return res.rows;
    }

    static async markOutboxEventStatus(
        eventId: string,
        status: WorkspaceOutboxStatus,
        errorMessage?: string | null
    ): Promise<boolean> {
        const res = await query(
            `UPDATE public.workspace_outbox_events
             SET status = $2::varchar,
                 published_at = CASE WHEN $2::varchar = 'published' THEN NOW() ELSE published_at END,
                 error_message = $3,
                 retry_count = retry_count + 1
             WHERE id = $1;`,
            [eventId, status, errorMessage || null]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    // Email Delivery Operations & Deduplication
    static async recordEmailDeliveryIntent(
        params: {
            workspaceId: string;
            recipientId: string;
            recipientEmail: string;
            emailType: WorkspaceEmailType;
            idempotencyKey: string;
        },
        clientOrNull?: any
    ): Promise<{ delivery: WorkspaceEmailDelivery; isNew: boolean }> {
        const executor = clientOrNull || { query };
        const insertRes = await executor.query(
            `INSERT INTO public.workspace_email_deliveries (
                workspace_id,
                recipient_id,
                recipient_email,
                email_type,
                idempotency_key,
                status
            ) VALUES ($1, $2, $3, $4, $5, 'queued')
            ON CONFLICT (idempotency_key) DO NOTHING
            RETURNING
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                recipient_email AS "recipientEmail",
                email_type AS "emailType",
                idempotency_key AS "idempotencyKey",
                resend_id AS "resendId",
                status,
                retry_count AS "retryCount",
                error,
                sent_at AS "sentAt",
                delivered_at AS "deliveredAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                params.workspaceId,
                params.recipientId,
                params.recipientEmail,
                params.emailType,
                params.idempotencyKey,
            ]
        );

        if (insertRes.rows.length > 0) {
            return { delivery: insertRes.rows[0], isNew: true };
        }

        // Already exists - fetch existing record
        const existing = await executor.query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                recipient_email AS "recipientEmail",
                email_type AS "emailType",
                idempotency_key AS "idempotencyKey",
                resend_id AS "resendId",
                status,
                retry_count AS "retryCount",
                error,
                sent_at AS "sentAt",
                delivered_at AS "deliveredAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_email_deliveries
             WHERE idempotency_key = $1;`,
            [params.idempotencyKey]
        );
        return { delivery: existing.rows[0], isNew: false };
    }

    static async findEmailDeliveryByIdempotencyKey(
        idempotencyKey: string
    ): Promise<WorkspaceEmailDelivery | null> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                recipient_email AS "recipientEmail",
                email_type AS "emailType",
                idempotency_key AS "idempotencyKey",
                resend_id AS "resendId",
                status,
                retry_count AS "retryCount",
                error,
                sent_at AS "sentAt",
                delivered_at AS "deliveredAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_email_deliveries
             WHERE idempotency_key = $1;`,
            [idempotencyKey]
        );
        return res.rows[0] || null;
    }


    static async findEmailDeliveryByResendId(
        resendId: string
    ): Promise<WorkspaceEmailDelivery | null> {
        const res = await query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                recipient_email AS "recipientEmail",
                email_type AS "emailType",
                idempotency_key AS "idempotencyKey",
                resend_id AS "resendId",
                status,
                retry_count AS "retryCount",
                error,
                sent_at AS "sentAt",
                delivered_at AS "deliveredAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_email_deliveries
             WHERE resend_id = $1;`,
            [resendId]
        );
        return res.rows[0] || null;
    }


    static async updateEmailDelivery(
        id: string,
        updates: {
            status: WorkspaceEmailDeliveryStatus;
            resendId?: string | null;
            error?: string | null;
            sentAt?: Date | string | null;
            deliveredAt?: Date | string | null;
        }
    ): Promise<boolean> {
        const res = await query(
            `UPDATE public.workspace_email_deliveries
             SET status = $2,
                 resend_id = COALESCE($3, resend_id),
                 error = $4,
                 sent_at = COALESCE($5, sent_at),
                 delivered_at = COALESCE($6, delivered_at),
                 retry_count = retry_count + 1,
                 updated_at = NOW()
             WHERE id = $1;`,
            [
                id,
                updates.status,
                updates.resendId !== undefined ? updates.resendId : null,
                updates.error || null,
                updates.sentAt ? new Date(updates.sentAt).toISOString() : null,
                updates.deliveredAt ? new Date(updates.deliveredAt).toISOString() : null,
            ]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================

    // User Notification Preferences
    static async getUserNotificationPreferences(
        workspaceId: string,
        userId: string
    ): Promise<WorkspaceNotificationPreferences> {
        const res = await query(
            `SELECT
                workspace_id AS "workspaceId",
                user_id AS "userId",
                email_task_assigned AS "emailTaskAssigned",
                email_task_reminders AS "emailTaskReminders",
                email_mentions AS "emailMentions",
                email_discussions AS "emailDiscussions",
                email_digest_frequency AS "emailDigestFrequency",
                muted_until AS "mutedUntil",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_notification_preferences
             WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, userId]
        );

        if (res.rows.length > 0) {
            return res.rows[0];
        }

        // Return defaults if not explicitly configured
        return {
            workspaceId,
            userId,
            emailTaskAssigned: true,
            emailTaskReminders: true,
            emailMentions: true,
            emailDiscussions: true,
            emailDigestFrequency: "instant",
            mutedUntil: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }

    static async upsertUserNotificationPreferences(
        workspaceId: string,
        userId: string,
        preferences: Partial<WorkspaceNotificationPreferences>
    ): Promise<WorkspaceNotificationPreferences> {
        const res = await query(
            `INSERT INTO public.workspace_notification_preferences (
                workspace_id,
                user_id,
                email_task_assigned,
                email_task_reminders,
                email_mentions,
                email_discussions,
                email_digest_frequency,
                muted_until,
                updated_at
            ) VALUES (
                $1, $2,
                COALESCE($3, true),
                COALESCE($4, true),
                COALESCE($5, true),
                COALESCE($6, true),
                COALESCE($7, 'instant'),
                $8,
                NOW()
            )
            ON CONFLICT (workspace_id, user_id) DO UPDATE
            SET email_task_assigned = COALESCE($3, workspace_notification_preferences.email_task_assigned),
                email_task_reminders = COALESCE($4, workspace_notification_preferences.email_task_reminders),
                email_mentions = COALESCE($5, workspace_notification_preferences.email_mentions),
                email_discussions = COALESCE($6, workspace_notification_preferences.email_discussions),
                email_digest_frequency = COALESCE($7, workspace_notification_preferences.email_digest_frequency),
                muted_until = $8,
                updated_at = NOW()
            RETURNING
                workspace_id AS "workspaceId",
                user_id AS "userId",
                email_task_assigned AS "emailTaskAssigned",
                email_task_reminders AS "emailTaskReminders",
                email_mentions AS "emailMentions",
                email_discussions AS "emailDiscussions",
                email_digest_frequency AS "emailDigestFrequency",
                muted_until AS "mutedUntil",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [
                workspaceId,
                userId,
                preferences.emailTaskAssigned,
                preferences.emailTaskReminders,
                preferences.emailMentions,
                preferences.emailDiscussions,
                preferences.emailDigestFrequency,
                preferences.mutedUntil ? new Date(preferences.mutedUntil).toISOString() : null,
            ]
        );
        return res.rows[0];
    }

    // Webhook Replay Protection
    static async recordWebhookEvent(
        provider: string,
        providerEventId: string,
        eventType: string,
        payload: Record<string, any>
    ): Promise<boolean> {
        const res = await query(
            `INSERT INTO public.workspace_webhook_events (
                provider,
                provider_event_id,
                event_type,
                payload
            ) VALUES ($1, $2, $3, $4)
            ON CONFLICT (provider_event_id) DO NOTHING
            RETURNING id;`,
            [provider, providerEventId, eventType, JSON.stringify(payload || {})]
        );
        return (res.rowCount ?? 0) > 0;
    }

    // =========================================================================
    // 11. DASHBOARD, ACTIVITY, AUDIT & SEARCH (PHASE 08)
    // =========================================================================

    /**
     * Records a chronological workspace activity event.
     */
    static async recordActivityEvent(
        params: {
            workspaceId: string;
            departmentId?: string | null;
            actorId: string;
            eventType: WorkspaceActivityEventType;
            resourceType: string;
            resourceId: string;
            title: string;
            description?: string | null;
            isRestricted?: boolean;
            metadata?: Record<string, any>;
        },
        clientOrNull?: any
    ): Promise<WorkspaceActivityEvent> {
        const executor = clientOrNull || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_activity_feed (
                workspace_id,
                department_id,
                actor_id,
                event_type,
                resource_type,
                resource_id,
                title,
                description,
                is_restricted,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING
                id,
                workspace_id AS "workspaceId",
                department_id AS "departmentId",
                actor_id AS "actorId",
                event_type AS "eventType",
                resource_type AS "resourceType",
                resource_id AS "resourceId",
                title,
                description,
                is_restricted AS "isRestricted",
                metadata,
                created_at AS "createdAt";`,
            [
                params.workspaceId,
                params.departmentId || null,
                params.actorId,
                params.eventType,
                params.resourceType,
                params.resourceId,
                params.title,
                params.description || null,
                Boolean(params.isRestricted),
                JSON.stringify(params.metadata || {}),
            ]
        );
        return res.rows[0];
    }

    /**
     * Retrieves permission-filtered chronological activity feed.
     */
    static async getActivityFeed(
        workspaceId: string,
        allowedDepartmentIds: string[] | null,
        options?: {
            departmentId?: string;
            actorId?: string;
            eventType?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ events: WorkspaceActivityEvent[]; total: number }> {
        const limit = Math.min(Math.max(options?.limit ?? 25, 1), 100);
        const offset = Math.max(options?.offset ?? 0, 0);

        const conditions: string[] = ["a.workspace_id = $1"];
        const params: any[] = [workspaceId];
        let paramIdx = 2;

        // Permission filtering: if allowedDepartmentIds is null, user is workspace admin / owner
        if (allowedDepartmentIds !== null) {
            if (allowedDepartmentIds.length > 0) {
                conditions.push(`((a.department_id IS NULL AND a.is_restricted = false) OR a.department_id = ANY($${paramIdx}::uuid[]))`);
                params.push(allowedDepartmentIds);
                paramIdx++;
            } else {
                conditions.push("(a.department_id IS NULL AND a.is_restricted = false)");
            }
        }

        if (options?.departmentId) {
            conditions.push(`a.department_id = $${paramIdx}`);
            params.push(options.departmentId);
            paramIdx++;
        }

        if (options?.actorId) {
            conditions.push(`a.actor_id = $${paramIdx}`);
            params.push(options.actorId);
            paramIdx++;
        }

        if (options?.eventType) {
            conditions.push(`a.event_type = $${paramIdx}`);
            params.push(options.eventType);
            paramIdx++;
        }

        const whereClause = conditions.join(" AND ");

        const countRes = await query(
            `SELECT COUNT(*)::int AS count FROM public.workspace_activity_feed a WHERE ${whereClause};`,
            params
        );
        const total = Number(countRes.rows[0]?.count || 0);

        const listRes = await query(
            `SELECT
                a.id,
                a.workspace_id AS "workspaceId",
                a.department_id AS "departmentId",
                a.actor_id AS "actorId",
                a.event_type AS "eventType",
                a.resource_type AS "resourceType",
                a.resource_id AS "resourceId",
                a.title,
                a.description,
                a.is_restricted AS "isRestricted",
                a.metadata,
                a.created_at AS "createdAt",
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', COALESCE(u.photo_url, u.avatar_url)
                ) AS actor,
                CASE WHEN d.id IS NOT NULL THEN
                    json_build_object(
                        'id', d.id,
                        'name', d.name,
                        'icon', d.icon,
                        'color', d.color
                    )
                ELSE NULL END AS department
             FROM public.workspace_activity_feed a
             JOIN public.users u ON u.id = a.actor_id
             LEFT JOIN public.workspace_departments d ON d.id = a.department_id
             WHERE ${whereClause}
             ORDER BY a.created_at DESC
             LIMIT $${paramIdx} OFFSET $${paramIdx + 1};`,
            [...params, limit, offset]
        );

        return {
            events: listRes.rows,
            total,
        };
    }

    /**
     * Calculates permission-scoped workspace overview metrics.
     */
    static async getWorkspaceOverviewMetrics(
        workspaceId: string,
        allowedDepartmentIds: string[] | null
    ): Promise<WorkspaceOverviewMetrics> {
        // 1. Members
        let totalMembers = 0;
        let activeMembers = 0;
        if (allowedDepartmentIds === null) {
            const membersRes = await query(
                `SELECT
                    COUNT(*)::int AS "totalMembers",
                    COUNT(*) FILTER (WHERE membership_status = 'active' AND is_suspended = false)::int AS "activeMembers"
                 FROM public.workspace_members
                 WHERE workspace_id = $1;`,
                [workspaceId]
            );
            totalMembers = Number(membersRes.rows[0]?.totalMembers || 0);
            activeMembers = Number(membersRes.rows[0]?.activeMembers || 0);
        } else if (allowedDepartmentIds.length > 0) {
            const membersRes = await query(
                `SELECT
                    COUNT(DISTINCT wm.id)::int AS "totalMembers",
                    COUNT(DISTINCT wm.id) FILTER (WHERE wm.membership_status = 'active' AND wm.is_suspended = false)::int AS "activeMembers"
                 FROM public.workspace_members wm
                 LEFT JOIN public.workspace_department_members wdm ON wdm.member_id = wm.id
                 WHERE wm.workspace_id = $1
                   AND (wm.department_id = ANY($2::uuid[]) OR wdm.department_id = ANY($2::uuid[]));`,
                [workspaceId, allowedDepartmentIds]
            );
            totalMembers = Number(membersRes.rows[0]?.totalMembers || 0);
            activeMembers = Number(membersRes.rows[0]?.activeMembers || 0);
        } else {
            totalMembers = 1;
            activeMembers = 1;
        }

        // 2. Departments
        let totalDepartments = 0;
        if (allowedDepartmentIds === null) {
            const deptsRes = await query(
                `SELECT COUNT(*)::int AS count
                 FROM public.workspace_departments
                 WHERE workspace_id = $1 AND status = 'active';`,
                [workspaceId]
            );
            totalDepartments = Number(deptsRes.rows[0]?.count || 0);
        } else {
            const deptsRes = await query(
                `SELECT COUNT(*)::int AS count
                 FROM public.workspace_departments
                 WHERE workspace_id = $1 AND status = 'active' AND id = ANY($2::uuid[]);`,
                [workspaceId, allowedDepartmentIds]
            );
            totalDepartments = Number(deptsRes.rows[0]?.count || 0);
        }

        // 3. Tasks scoped by permission
        let taskDeptCondition = "";
        const taskParams: any[] = [workspaceId];
        if (allowedDepartmentIds !== null) {
            if (allowedDepartmentIds.length > 0) {
                taskDeptCondition = " AND (is_restricted = false OR department_id = ANY($2::uuid[]))";
                taskParams.push(allowedDepartmentIds);
            } else {
                taskDeptCondition = " AND is_restricted = false";
            }
        }

        const tasksRes = await query(
            `SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived', 'cancelled'))::int AS "activeTasks",
                COUNT(*) FILTER (WHERE status = 'completed')::int AS "completedTasks",
                COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived', 'cancelled') AND due_date IS NOT NULL AND due_date < NOW())::int AS "overdueTasks",
                COUNT(*) FILTER (WHERE status = 'submitted')::int AS "tasksAwaitingReview"
             FROM public.workspace_tasks
             WHERE workspace_id = $1 AND is_archived = false ${taskDeptCondition};`,
            taskParams
        );

        const activeTasks = Number(tasksRes.rows[0]?.activeTasks || 0);
        const completedTasks = Number(tasksRes.rows[0]?.completedTasks || 0);
        const overdueTasks = Number(tasksRes.rows[0]?.overdueTasks || 0);
        const tasksAwaitingReview = Number(tasksRes.rows[0]?.tasksAwaitingReview || 0);

        // 4. Top recent activities
        const { events } = await this.getActivityFeed(workspaceId, allowedDepartmentIds, { limit: 10 });

        // 5. Recent Announcements
        let announcements: any[] = [];
        try {
            const annRes = await query(
                `SELECT
                    wm.id,
                    wm.content,
                    wm.created_at AS "createdAt",
                    wc.name AS "channelName",
                    json_build_object(
                        'firstName', u.firstname,
                        'lastName', u.lastname,
                        'username', u.username
                    ) AS "sender"
                 FROM public.workspace_messages wm
                 JOIN public.workspace_channels wc ON wc.id = wm.channel_id
                 LEFT JOIN public.users u ON u.id = wm.sender_id
                 WHERE wm.workspace_id = $1
                   AND (wm.message_type = 'announcement' OR wc.channel_type = 'announcement')
                   AND wm.is_deleted = false
                 ORDER BY wm.created_at DESC
                 LIMIT 5;`,
                [workspaceId]
            );
            announcements = annRes.rows;
        } catch {
            // Non-critical fallback if messages table query fails
        }

        return {
            totalMembers,
            activeMembers,
            totalDepartments,
            activeTasks,
            completedTasks,
            overdueTasks,
            tasksAwaitingReview,
            recentActivity: events,
            recentAnnouncements: announcements,
        };
    }

    /**
     * Calculates statistics and submission progress for a specific department.
     */
    static async getDepartmentInsight(
        workspaceId: string,
        departmentId: string
    ): Promise<WorkspaceDepartmentInsight | null> {
        const dept = await this.findDepartmentById(workspaceId, departmentId);
        if (!dept) return null;

        // Member count
        const memberCountRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM public.workspace_department_members
             WHERE workspace_id = $1 AND department_id = $2;`,
            [workspaceId, departmentId]
        );
        const memberCount = Number(memberCountRes.rows[0]?.count || 0);

        // Tasks count
        const taskRes = await query(
            `SELECT
                COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived', 'cancelled'))::int AS "activeTasks",
                COUNT(*) FILTER (WHERE status = 'completed')::int AS "completedTasks",
                COUNT(*) FILTER (WHERE status NOT IN ('completed', 'archived', 'cancelled') AND due_date IS NOT NULL AND due_date < NOW())::int AS "overdueTasks",
                COUNT(*)::int AS "totalTasks",
                COUNT(*) FILTER (WHERE status = 'submitted')::int AS "submittedTasks",
                COUNT(*) FILTER (WHERE status = 'approved')::int AS "approvedTasks",
                COUNT(*) FILTER (WHERE status = 'changes_requested')::int AS "changesRequestedTasks"
             FROM public.workspace_tasks
             WHERE workspace_id = $1 AND department_id = $2 AND is_archived = false;`,
            [workspaceId, departmentId]
        );

        const r = taskRes.rows[0];
        const activeTasks = Number(r?.activeTasks || 0);
        const completedTasks = Number(r?.completedTasks || 0);
        const overdueTasks = Number(r?.overdueTasks || 0);

        const submissionProgress = {
            total: Number(r?.totalTasks || 0),
            submitted: Number(r?.submittedTasks || 0),
            approved: Number(r?.approvedTasks || 0),
            changesRequested: Number(r?.changesRequestedTasks || 0),
        };

        // Department recent activity
        const { events } = await this.getActivityFeed(workspaceId, [departmentId], {
            departmentId,
            limit: 10,
        });

        return {
            departmentId: dept.id,
            departmentName: dept.name,
            slug: dept.slug,
            icon: dept.icon,
            color: dept.color,
            memberCount,
            activeTasks,
            completedTasks,
            overdueTasks,
            submissionProgress,
            recentActivity: events,
        };
    }

    /**
     * Lists administrative audit logs with filtering (append-only).
     */
    static async listAuditLogs(
        workspaceId: string,
        options?: {
            actorId?: string;
            action?: string;
            targetType?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<{ logs: WorkspaceAuditLogEntry[]; total: number }> {
        const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
        const offset = Math.max(options?.offset ?? 0, 0);

        const conditions: string[] = ["l.workspace_id = $1"];
        const params: any[] = [workspaceId];
        let idx = 2;

        if (options?.actorId) {
            conditions.push(`l.actor_id = $${idx}`);
            params.push(options.actorId);
            idx++;
        }

        if (options?.action) {
            conditions.push(`l.action = $${idx}`);
            params.push(options.action);
            idx++;
        }

        if (options?.targetType) {
            conditions.push(`l.target_type = $${idx}`);
            params.push(options.targetType);
            idx++;
        }

        const whereClause = conditions.join(" AND ");

        const countRes = await query(
            `SELECT COUNT(*)::int AS count FROM public.workspace_audit_logs l WHERE ${whereClause};`,
            params
        );
        const total = Number(countRes.rows[0]?.count || 0);

        const listRes = await query(
            `SELECT
                l.id,
                l.workspace_id AS "workspaceId",
                l.actor_id AS "actorId",
                l.action,
                l.target_type AS "targetType",
                l.target_id AS "targetId",
                COALESCE(l.details, '{}'::jsonb) AS details,
                l.ip_address AS "ipAddress",
                l.user_agent AS "userAgent",
                l.created_at AS "createdAt",
                CASE WHEN u.id IS NOT NULL THEN
                    json_build_object(
                        'id', u.id,
                        'username', u.username,
                        'firstName', u.firstname,
                        'lastName', u.lastname,
                        'avatarUrl', COALESCE(u.photo_url, u.avatar_url)
                    )
                ELSE NULL END AS actor
             FROM public.workspace_audit_logs l
             LEFT JOIN public.users u ON u.id = l.actor_id
             WHERE ${whereClause}
             ORDER BY l.created_at DESC
             LIMIT $${idx} OFFSET $${idx + 1};`,
            [...params, limit, offset]
        );

        return {
            logs: listRes.rows,
            total,
        };
    }

    /**
     * Unified, strictly permission-filtered workspace search.
     */
    static async searchWorkspace(
        workspaceId: string,
        queryText: string,
        allowedDepartmentIds: string[] | null,
        allowedPrivateChannelIds: string[],
        options?: {
            type?: WorkspaceSearchResultType | "all";
            departmentId?: string;
            startDate?: string;
            endDate?: string;
            limit?: number;
            offset?: number;
        }
    ): Promise<WorkspaceSearchResponse> {
        const cleaned = queryText.trim();
        if (!cleaned) {
            return { results: [], total: 0, countsByType: {} };
        }

        const searchPattern = `%${cleaned}%`;
        const limit = Math.min(Math.max(options?.limit ?? 30, 1), 100);
        const typeFilter = options?.type || "all";
        const results: WorkspaceSearchResultItem[] = [];
        const countsByType: Record<string, number> = {
            channel: 0,
            message: 0,
            member: 0,
            department: 0,
            task: 0,
            file: 0,
            discussion: 0,
        };

        // 1. Search Channels (Only public channels OR private channels caller is permitted to access)
        if (typeFilter === "all" || typeFilter === "channel") {
            const channelRes = await query(
                `SELECT
                    c.id,
                    'channel'::text AS type,
                    c.name AS title,
                    c.topic AS snippet,
                    '/club/' || w.club_id || '/workspace/channels/' || c.id AS "destinationUrl",
                    c.department_id AS "departmentId",
                    d.name AS "departmentName",
                    c.created_at AS "createdAt"
                 FROM public.workspace_channels c
                 JOIN public.team_workspaces w ON w.id = c.workspace_id
                 LEFT JOIN public.workspace_departments d ON d.id = c.department_id
                 WHERE c.workspace_id = $1 AND c.is_archived = false
                   AND (c.name ILIKE $2 OR COALESCE(c.topic, '') ILIKE $2)
                   AND (c.is_private = false OR c.id = ANY($3::uuid[]))
                 ORDER BY c.created_at DESC
                 LIMIT 20;`,
                [workspaceId, searchPattern, allowedPrivateChannelIds]
            );
            countsByType.channel = channelRes.rows.length;
            results.push(...channelRes.rows);
        }

        // 2. Search Messages (Only in accessible channels)
        if (typeFilter === "all" || typeFilter === "message") {
            const msgRes = await query(
                `SELECT
                    m.id,
                    'message'::text AS type,
                    'Message in #' || c.name AS title,
                    m.content AS snippet,
                    '/club/' || w.club_id || '/workspace/channels/' || c.id || '?msg=' || m.id AS "destinationUrl",
                    c.department_id AS "departmentId",
                    d.name AS "departmentName",
                    m.created_at AS "createdAt"
                 FROM public.workspace_messages m
                 JOIN public.workspace_channels c ON c.id = m.channel_id
                 JOIN public.team_workspaces w ON w.id = m.workspace_id
                 LEFT JOIN public.workspace_departments d ON d.id = c.department_id
                 WHERE m.workspace_id = $1 AND m.is_deleted = false
                   AND m.content ILIKE $2
                   AND (c.is_private = false OR c.id = ANY($3::uuid[]))
                 ORDER BY m.created_at DESC
                 LIMIT 20;`,
                [workspaceId, searchPattern, allowedPrivateChannelIds]
            );
            countsByType.message = msgRes.rows.length;
            results.push(...msgRes.rows);
        }

        // 3. Search Members (Username, First/Last Name)
        if (typeFilter === "all" || typeFilter === "member") {
            const memberRes = await query(
                `SELECT
                    wm.id,
                    'member'::text AS type,
                    COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), ''), u.username) AS title,
                    '@' || u.username || ' • ' || COALESCE(r.name, 'Member') AS snippet,
                    '/club/' || w.club_id || '/workspace/members' AS "destinationUrl",
                    wm.department_id AS "departmentId",
                    d.name AS "departmentName",
                    wm.created_at AS "createdAt"
                 FROM public.workspace_members wm
                 JOIN public.users u ON u.id = wm.user_id
                 JOIN public.team_workspaces w ON w.id = wm.workspace_id
                 LEFT JOIN public.workspace_roles r ON r.id = wm.role_id
                 LEFT JOIN public.workspace_departments d ON d.id = wm.department_id
                 WHERE wm.workspace_id = $1
                   AND (u.username ILIKE $2 OR COALESCE(u.firstname, '') ILIKE $2 OR COALESCE(u.lastname, '') ILIKE $2)
                 ORDER BY wm.created_at DESC
                 LIMIT 20;`,
                [workspaceId, searchPattern]
            );
            countsByType.member = memberRes.rows.length;
            results.push(...memberRes.rows);
        }

        // 4. Search Departments (Only accessible departments)
        if (typeFilter === "all" || typeFilter === "department") {
            let deptCondition = "";
            const deptParams: any[] = [workspaceId, searchPattern];
            if (allowedDepartmentIds !== null) {
                if (allowedDepartmentIds.length > 0) {
                    deptCondition = " AND (d.id = ANY($3::uuid[]))";
                    deptParams.push(allowedDepartmentIds);
                } else {
                    deptCondition = " AND false"; // no department access
                }
            }

            const deptRes = await query(
                `SELECT
                    d.id,
                    'department'::text AS type,
                    d.name AS title,
                    d.description AS snippet,
                    '/club/' || w.club_id || '/workspace/departments/' || d.id AS "destinationUrl",
                    d.id AS "departmentId",
                    d.name AS "departmentName",
                    d.created_at AS "createdAt"
                 FROM public.workspace_departments d
                 JOIN public.team_workspaces w ON w.id = d.workspace_id
                 WHERE d.workspace_id = $1 AND d.status = 'active'
                   AND (d.name ILIKE $2 OR COALESCE(d.description, '') ILIKE $2)
                   ${deptCondition}
                 ORDER BY d.created_at DESC
                 LIMIT 20;`,
                deptParams
            );
            countsByType.department = deptRes.rows.length;
            results.push(...deptRes.rows);
        }

        // 5. Search Tasks (Only non-restricted tasks OR tasks in caller's permitted departments)
        if (typeFilter === "all" || typeFilter === "task") {
            let taskCondition = "";
            const taskParams: any[] = [workspaceId, searchPattern];
            if (allowedDepartmentIds !== null) {
                if (allowedDepartmentIds.length > 0) {
                    taskCondition = " AND ((t.department_id IS NULL AND t.is_restricted = false) OR t.department_id = ANY($3::uuid[]))";
                    taskParams.push(allowedDepartmentIds);
                } else {
                    taskCondition = " AND t.department_id IS NULL AND t.is_restricted = false";
                }
            }

            const taskRes = await query(
                `SELECT
                    t.id,
                    'task'::text AS type,
                    t.title,
                    t.description AS snippet,
                    '/club/' || w.club_id || '/workspace/tasks/' || t.id AS "destinationUrl",
                    t.department_id AS "departmentId",
                    d.name AS "departmentName",
                    t.created_at AS "createdAt"
                 FROM public.workspace_tasks t
                 JOIN public.team_workspaces w ON w.id = t.workspace_id
                 LEFT JOIN public.workspace_departments d ON d.id = t.department_id
                 WHERE t.workspace_id = $1 AND t.is_archived = false
                   AND (t.title ILIKE $2 OR COALESCE(t.description, '') ILIKE $2)
                   ${taskCondition}
                 ORDER BY t.created_at DESC
                 LIMIT 20;`,
                taskParams
            );
            countsByType.task = taskRes.rows.length;
            results.push(...taskRes.rows);
        }

        // 6. Search Files (Only accessible files)
        if (typeFilter === "all" || typeFilter === "file") {
            let fileCondition = "";
            const fileParams: any[] = [workspaceId, searchPattern];
            if (allowedDepartmentIds !== null) {
                if (allowedDepartmentIds.length > 0) {
                    fileCondition = " AND (f.department_id IS NULL OR f.department_id = ANY($3::uuid[]))";
                    fileParams.push(allowedDepartmentIds);
                } else {
                    fileCondition = " AND f.department_id IS NULL";
                }
            }

            const fileRes = await query(
                `SELECT
                    f.id,
                    'file'::text AS type,
                    f.file_name AS title,
                    f.mime_type AS snippet,
                    '/club/' || w.club_id || '/workspace/files' AS "destinationUrl",
                    f.department_id AS "departmentId",
                    d.name AS "departmentName",
                    f.created_at AS "createdAt"
                 FROM public.workspace_files f
                 JOIN public.team_workspaces w ON w.id = f.workspace_id
                 LEFT JOIN public.workspace_departments d ON d.id = f.department_id
                 WHERE f.workspace_id = $1 AND f.deleted_at IS NULL AND f.asset_status = 'active'
                   AND f.file_name ILIKE $2
                   ${fileCondition}
                 ORDER BY f.created_at DESC
                 LIMIT 20;`,
                fileParams
            );
            countsByType.file = fileRes.rows.length;
            results.push(...fileRes.rows);
        }

        // 7. Search Discussions / Threads (Only in accessible channels)
        if (typeFilter === "all" || typeFilter === "discussion") {
            const threadRes = await query(
                `SELECT
                    th.id,
                    'discussion'::text AS type,
                    th.name AS title,
                    'Thread in #' || c.name || ' • ' || th.message_count || ' replies' AS snippet,
                    '/club/' || w.club_id || '/workspace/channels/' || c.id || '?thread=' || th.id AS "destinationUrl",
                    c.department_id AS "departmentId",
                    d.name AS "departmentName",
                    th.created_at AS "createdAt"
                 FROM public.workspace_threads th
                 JOIN public.workspace_channels c ON c.id = th.channel_id
                 JOIN public.team_workspaces w ON w.id = th.workspace_id
                 LEFT JOIN public.workspace_departments d ON d.id = c.department_id
                 WHERE th.workspace_id = $1 AND th.is_archived = false
                   AND th.name ILIKE $2
                   AND (c.is_private = false OR c.id = ANY($3::uuid[]))
                 ORDER BY th.created_at DESC
                 LIMIT 20;`,
                [workspaceId, searchPattern, allowedPrivateChannelIds]
            );
            countsByType.discussion = threadRes.rows.length;
            results.push(...threadRes.rows);
        }

        // Sort combined results by createdAt descending and slice to limit
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paginatedResults = results.slice(0, limit);

        return {
            results: paginatedResults,
            total: results.length,
            countsByType,
        };
    }

    // =========================================================================
    // 12. PHASE 01: MEMBER-SIDE WORKSPACE DISCOVERY & CUSTOM PERMISSIONS
    // =========================================================================

    /**
     * Updates granular member-specific permission overrides in workspace_members
     */
    static async updateMemberCustomPermissions(
        workspaceId: string,
        userId: string,
        customPermissions: Record<string, boolean>
    ): Promise<WorkspaceMember | null> {
        await query(
            `UPDATE public.workspace_members
             SET custom_permissions = $3::jsonb,
                 updated_at = NOW()
             WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, userId, JSON.stringify(customPermissions)]
        );
        return this.findMember(workspaceId, userId);
    }

    /**
     * Finds all active club workspaces where the user is an active member
     */
    static async findUserWorkspaces(userId: string): Promise<any[]> {
        const res = await query(
            `SELECT
                tw.id AS "workspaceId",
                tw.name AS "workspaceName",
                tw.slug AS "workspaceSlug",
                tw.description AS "workspaceDescription",
                tw.icon_url AS "workspaceIconUrl",
                tw.created_at AS "workspaceCreatedAt",
                vc.id AS "clubId",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                vc.logo_url AS "clubLogoUrl",
                vc.college_name AS "collegeName",
                wm.id AS "memberId",
                wm.role_id AS "roleId",
                wm.role_title AS "roleTitle",
                wm.joined_at AS "joinedAt",
                wm.is_suspended AS "isSuspended",
                r.name AS "roleName",
                r.slug AS "roleSlug",
                r.rank AS "roleRank",
                r.color AS "roleColor",
                COALESCE((
                    SELECT json_agg(json_build_object(
                        'id', wd.id,
                        'name', wd.name,
                        'slug', wd.slug,
                        'icon', wd.icon,
                        'color', wd.color,
                        'departmentRole', wdm.department_role,
                        'roleTitle', wdm.role_title
                    ))
                    FROM public.workspace_department_members wdm
                    JOIN public.workspace_departments wd ON wd.id = wdm.department_id
                    WHERE wdm.member_id = wm.id AND wd.status = 'active'
                ), '[]'::json) AS "departments"
             FROM public.workspace_members wm
             JOIN public.team_workspaces tw ON tw.id = wm.workspace_id
             JOIN public.verified_clubs vc ON vc.id = tw.club_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             WHERE wm.user_id = $1
               AND wm.membership_status = 'active'
               AND wm.is_suspended = false
               AND tw.workspace_status = 'active'
               -- Exclude supreme club manager/owner roles (rank 1000, slug 'owner', workspace owner, or club representative)
               AND r.rank < 1000
               AND r.slug != 'owner'
               AND tw.owner_id != $1
               AND vc.auth_user_id != $1
               -- A club manager / representative of an active verified club cannot access or join workspaces via personal account
               AND NOT EXISTS (
                   SELECT 1 FROM public.verified_clubs vc_rep
                   WHERE vc_rep.auth_user_id = $1 AND vc_rep.is_active = true
               )
             ORDER BY tw.created_at ASC;`,
            [userId]
        );
        return res.rows;
    }

    // =========================================================================
    // 15. ORBIX RECOGNITION, IMMUTABLE LEDGER & ORBITS ENGINE
    // =========================================================================

    /**
     * Retrieves or lazily initializes the recognition policy for a workspace.
     */
    static async getRecognitionPolicy(
        workspaceId: string,
        clientOrQuery: any = null
    ): Promise<WorkspaceRecognitionPolicy> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `SELECT
                workspace_id AS "workspaceId",
                is_enabled AS "isEnabled",
                point_unit_name AS "pointUnitName",
                min_points_per_award AS "minPointsPerAward",
                max_points_per_award AS "maxPointsPerAward",
                manager_monthly_budget AS "managerMonthlyBudget",
                recipient_monthly_cap AS "recipientMonthlyCap",
                daily_award_limit_per_issuer AS "dailyAwardLimitPerIssuer",
                require_task_link AS "requireTaskLink",
                require_evidence_link AS "requireEvidenceLink",
                min_reason_length AS "minReasonLength",
                is_workspace_visible AS "isWorkspaceVisible",
                dpi_weight_approved_tasks AS "dpiWeightApprovedTasks",
                dpi_weight_on_time AS "dpiWeightOnTime",
                dpi_weight_participation AS "dpiWeightParticipation",
                dpi_weight_recognition AS "dpiWeightRecognition",
                dpi_recognition_cap_per_member AS "dpiRecognitionCapPerMember",
                dpi_min_tasks_sample AS "dpiMinTasksSample",
                dpi_formula_version AS "dpiFormulaVersion",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                updated_by AS "updatedBy"
             FROM public.workspace_recognition_policies
             WHERE workspace_id = $1
             LIMIT 1;`,
            [workspaceId]
        );

        if (res.rows[0]) {
            return res.rows[0];
        }

        // Lazy auto-provision default policy
        const insertRes = await executor.query(
            `INSERT INTO public.workspace_recognition_policies (
                workspace_id,
                is_enabled,
                point_unit_name,
                min_points_per_award,
                max_points_per_award,
                manager_monthly_budget,
                recipient_monthly_cap,
                daily_award_limit_per_issuer,
                require_task_link,
                require_evidence_link,
                min_reason_length,
                is_workspace_visible
             ) VALUES ($1, true, 'Orbits', 5, 50, 500, 150, 5, false, false, 15, true)
             ON CONFLICT (workspace_id) DO UPDATE SET updated_at = NOW()
             RETURNING
                workspace_id AS "workspaceId",
                is_enabled AS "isEnabled",
                point_unit_name AS "pointUnitName",
                min_points_per_award AS "minPointsPerAward",
                max_points_per_award AS "maxPointsPerAward",
                manager_monthly_budget AS "managerMonthlyBudget",
                recipient_monthly_cap AS "recipientMonthlyCap",
                daily_award_limit_per_issuer AS "dailyAwardLimitPerIssuer",
                require_task_link AS "requireTaskLink",
                require_evidence_link AS "requireEvidenceLink",
                min_reason_length AS "minReasonLength",
                is_workspace_visible AS "isWorkspaceVisible",
                dpi_weight_approved_tasks AS "dpiWeightApprovedTasks",
                dpi_weight_on_time AS "dpiWeightOnTime",
                dpi_weight_participation AS "dpiWeightParticipation",
                dpi_weight_recognition AS "dpiWeightRecognition",
                dpi_recognition_cap_per_member AS "dpiRecognitionCapPerMember",
                dpi_min_tasks_sample AS "dpiMinTasksSample",
                dpi_formula_version AS "dpiFormulaVersion",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                updated_by AS "updatedBy";`,
            [workspaceId]
        );
        return insertRes.rows[0];
    }

    /**
     * Updates recognition policy configurations for a workspace.
     */
    static async updateRecognitionPolicy(
        clientOrQuery: any,
        workspaceId: string,
        updates: Partial<WorkspaceRecognitionPolicy>,
        updatedByUserId: string
    ): Promise<WorkspaceRecognitionPolicy> {
        const executor = clientOrQuery || { query };
        const current = await this.getRecognitionPolicy(workspaceId, executor);

        const isEnabled = updates.isEnabled !== undefined ? updates.isEnabled : current.isEnabled;
        const pointUnitName = updates.pointUnitName || current.pointUnitName || "Orbits";
        const minPoints = updates.minPointsPerAward ?? current.minPointsPerAward;
        const maxPoints = updates.maxPointsPerAward ?? current.maxPointsPerAward;
        const managerBudget = updates.managerMonthlyBudget ?? current.managerMonthlyBudget;
        const recipientCap = updates.recipientMonthlyCap ?? current.recipientMonthlyCap;
        const dailyLimit = updates.dailyAwardLimitPerIssuer ?? current.dailyAwardLimitPerIssuer;
        const reqTask = updates.requireTaskLink !== undefined ? updates.requireTaskLink : current.requireTaskLink;
        const reqEvidence = updates.requireEvidenceLink !== undefined ? updates.requireEvidenceLink : current.requireEvidenceLink;
        const minReasonLen = updates.minReasonLength ?? current.minReasonLength;
        const isVisible = updates.isWorkspaceVisible !== undefined ? updates.isWorkspaceVisible : current.isWorkspaceVisible;
        const dpiApproved = updates.dpiWeightApprovedTasks ?? current.dpiWeightApprovedTasks ?? 35;
        const dpiOnTime = updates.dpiWeightOnTime ?? current.dpiWeightOnTime ?? 35;
        const dpiParticipation = updates.dpiWeightParticipation ?? current.dpiWeightParticipation ?? 20;
        const dpiRecognition = updates.dpiWeightRecognition ?? current.dpiWeightRecognition ?? 10;
        const dpiCap = updates.dpiRecognitionCapPerMember ?? current.dpiRecognitionCapPerMember ?? 50;
        const dpiMinSample = updates.dpiMinTasksSample ?? current.dpiMinTasksSample ?? 1;
        const dpiVersion = updates.dpiFormulaVersion ?? current.dpiFormulaVersion ?? 'v1.0';

        const res = await executor.query(
            `UPDATE public.workspace_recognition_policies
             SET
                is_enabled = $2,
                point_unit_name = $3,
                min_points_per_award = $4,
                max_points_per_award = $5,
                manager_monthly_budget = $6,
                recipient_monthly_cap = $7,
                daily_award_limit_per_issuer = $8,
                require_task_link = $9,
                require_evidence_link = $10,
                min_reason_length = $11,
                is_workspace_visible = $12,
                dpi_weight_approved_tasks = $14,
                dpi_weight_on_time = $15,
                dpi_weight_participation = $16,
                dpi_weight_recognition = $17,
                dpi_recognition_cap_per_member = $18,
                dpi_min_tasks_sample = $19,
                dpi_formula_version = $20,
                updated_by = $13,
                updated_at = NOW()
             WHERE workspace_id = $1
             RETURNING
                workspace_id AS "workspaceId",
                is_enabled AS "isEnabled",
                point_unit_name AS "pointUnitName",
                min_points_per_award AS "minPointsPerAward",
                max_points_per_award AS "maxPointsPerAward",
                manager_monthly_budget AS "managerMonthlyBudget",
                recipient_monthly_cap AS "recipientMonthlyCap",
                daily_award_limit_per_issuer AS "dailyAwardLimitPerIssuer",
                require_task_link AS "requireTaskLink",
                require_evidence_link AS "requireEvidenceLink",
                min_reason_length AS "minReasonLength",
                is_workspace_visible AS "isWorkspaceVisible",
                dpi_weight_approved_tasks AS "dpiWeightApprovedTasks",
                dpi_weight_on_time AS "dpiWeightOnTime",
                dpi_weight_participation AS "dpiWeightParticipation",
                dpi_weight_recognition AS "dpiWeightRecognition",
                dpi_recognition_cap_per_member AS "dpiRecognitionCapPerMember",
                dpi_min_tasks_sample AS "dpiMinTasksSample",
                dpi_formula_version AS "dpiFormulaVersion",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                updated_by AS "updatedBy";`,
            [
                workspaceId,
                isEnabled,
                pointUnitName,
                minPoints,
                maxPoints,
                managerBudget,
                recipientCap,
                dailyLimit,
                reqTask,
                reqEvidence,
                minReasonLen,
                isVisible,
                updatedByUserId,
                dpiApproved,
                dpiOnTime,
                dpiParticipation,
                dpiRecognition,
                dpiCap,
                dpiMinSample,
                dpiVersion,
            ]
        );
        return res.rows[0];
    }

    /**
     * Seeds the standard 9 default categories if none exist in the workspace.
     */
    static async seedDefaultRecognitionCategories(
        clientOrQuery: any,
        workspaceId: string
    ): Promise<WorkspaceRecognitionCategory[]> {
        const executor = clientOrQuery || { query };
        const defaults = [
            { name: "Outstanding Work", slug: "outstanding_work", description: "Exceptional quality and delivery.", icon: "Award", displayOrder: 1 },
            { name: "Teamwork", slug: "teamwork", description: "Collaboration and assisting teammates.", icon: "Users", displayOrder: 2 },
            { name: "Initiative", slug: "initiative", description: "Independently identifying and solving problems.", icon: "Zap", displayOrder: 3 },
            { name: "Reliability", slug: "reliability", description: "Consistency, punctuality, and ownership.", icon: "ClockCheck", displayOrder: 4 },
            { name: "Leadership", slug: "leadership", description: "Coordinating and motivating others.", icon: "Compass", displayOrder: 5 },
            { name: "Creativity", slug: "creativity", description: "Original ideas and innovative approaches.", icon: "Sparkles", displayOrder: 6 },
            { name: "Problem Solving", slug: "problem_solving", description: "Resolving difficult technical or operational challenges.", icon: "Wrench", displayOrder: 7 },
            { name: "Mentorship", slug: "mentorship", description: "Helping others improve their skills and grow.", icon: "GraduationCap", displayOrder: 8 },
            { name: "Impact", slug: "impact", description: "Meaningful contribution to the club and campus.", icon: "Flame", displayOrder: 9 },
        ];

        for (const cat of defaults) {
            await executor.query(
                `INSERT INTO public.workspace_recognition_categories (
                    workspace_id, name, slug, description, icon, is_system, is_active, display_order
                ) VALUES ($1, $2, $3, $4, $5, true, true, $6)
                ON CONFLICT (workspace_id, slug) DO UPDATE SET
                    description = EXCLUDED.description,
                    icon = EXCLUDED.icon;`,
                [workspaceId, cat.name, cat.slug, cat.description, cat.icon, cat.displayOrder]
            );
        }

        return this.listRecognitionCategories(workspaceId, false, executor);
    }

    /**
     * Lists recognition categories in a workspace.
     */
    static async listRecognitionCategories(
        workspaceId: string,
        activeOnly = true,
        clientOrQuery: any = null
    ): Promise<WorkspaceRecognitionCategory[]> {
        const executor = clientOrQuery || { query };
        let sql = `
            SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                icon,
                is_system AS "isSystem",
                is_active AS "isActive",
                display_order AS "displayOrder",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
            FROM public.workspace_recognition_categories
            WHERE workspace_id = $1`;
        
        if (activeOnly) {
            sql += ` AND is_active = true`;
        }
        sql += ` ORDER BY display_order ASC, name ASC;`;

        const res = await executor.query(sql, [workspaceId]);
        if (res.rows.length === 0) {
            return this.seedDefaultRecognitionCategories(executor, workspaceId);
        }
        return res.rows;
    }

    /**
     * Finds a recognition category by slug or UUID.
     */
    static async findRecognitionCategoryBySlugOrId(
        workspaceId: string,
        slugOrId: string,
        clientOrQuery: any = null
    ): Promise<WorkspaceRecognitionCategory | null> {
        const executor = clientOrQuery || { query };
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(slugOrId);
        const res = await executor.query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                icon,
                is_system AS "isSystem",
                is_active AS "isActive",
                display_order AS "displayOrder",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM public.workspace_recognition_categories
             WHERE workspace_id = $1
               AND (${isUuid ? `id = $2::uuid` : `slug = $2`})
             LIMIT 1;`,
            [workspaceId, slugOrId]
        );
        return res.rows[0] || null;
    }

    /**
     * Updates an existing recognition category (toggle active, change description/icon).
     */
    static async updateRecognitionCategory(
        workspaceId: string,
        categoryId: string,
        updates: { isActive?: boolean; name?: string; description?: string; icon?: string }
    ): Promise<WorkspaceRecognitionCategory> {
        const fields: string[] = [];
        const values: any[] = [workspaceId, categoryId];
        let idx = 3;

        if (updates.isActive !== undefined) {
            fields.push(`is_active = $${idx++}`);
            values.push(updates.isActive);
        }
        if (updates.name !== undefined) {
            fields.push(`name = $${idx++}`);
            values.push(updates.name);
        }
        if (updates.description !== undefined) {
            fields.push(`description = $${idx++}`);
            values.push(updates.description);
        }
        if (updates.icon !== undefined) {
            fields.push(`icon = $${idx++}`);
            values.push(updates.icon);
        }
        fields.push("updated_at = NOW()");

        const res = await query(
            `UPDATE public.workspace_recognition_categories
             SET ${fields.join(", ")}
             WHERE workspace_id = $1 AND id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                name,
                slug,
                description,
                icon,
                is_system AS "isSystem",
                is_active AS "isActive",
                display_order AS "displayOrder",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            values
        );
        return res.rows[0];
    }

    /**
     * Lists all manager budgets for a workspace in the specified month.
     */
    static async listRecognitionBudgets(
        workspaceId: string,
        yearMonth: string = new Date().toISOString().slice(0, 7)
    ): Promise<Array<WorkspaceRecognitionBudget & { user: any }>> {
        const ws = await this.findById(workspaceId);
        const managersRes = await query(
            `SELECT DISTINCT wm.user_id, u.username, u.firstname, u.lastname, u.avatar_url, wm.role_title, wr.rank
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles wr ON wr.id = wm.role_id
             WHERE wm.workspace_id = $1
               AND wm.membership_status = 'active'
               AND (wr.rank >= 800 OR wm.user_id = $2)
               AND wr.rank < 1000;`,
            [workspaceId, ws?.managerUserId || null]
        );

        const budgets: any[] = [];
        for (const mgr of managersRes.rows) {
            const b = await this.getOrCreateRecognitionBudget(null, workspaceId, mgr.user_id, yearMonth);
            budgets.push({
                ...b,
                user: {
                    id: mgr.user_id,
                    username: mgr.username,
                    firstName: mgr.firstname,
                    lastName: mgr.lastname,
                    avatarUrl: mgr.avatar_url,
                    roleTitle: mgr.role_title,
                },
            });
        }
        return budgets;
    }

    /**
     * Generates analytical aggregates for workspace recognition.
     */
    static async getRecognitionAnalytics(
        workspaceId: string,
        yearMonth: string = new Date().toISOString().slice(0, 7)
    ): Promise<{
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
    }> {
        // Overall & Monthly Totals
        const totalsRes = await query(
            `SELECT
                COALESCE(SUM(points_delta) FILTER (WHERE points_delta > 0), 0)::integer AS "totalAwarded",
                COUNT(*) FILTER (WHERE transaction_type = 'award')::integer AS "totalCount",
                COALESCE(SUM(points_delta) FILTER (WHERE points_delta > 0 AND TO_CHAR(created_at, 'YYYY-MM') = $2), 0)::integer AS "monthlyAwarded",
                COUNT(*) FILTER (WHERE transaction_type = 'award' AND TO_CHAR(created_at, 'YYYY-MM') = $2)::integer AS "monthlyCount"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND is_reversed = false;`,
            [workspaceId, yearMonth]
        );

        // Categories Count & Breakdown
        const catRes = await query(
            `SELECT
                rc.id AS "categoryId",
                rc.name AS "categoryName",
                rc.slug AS "categorySlug",
                rc.icon AS "icon",
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "totalPoints",
                COUNT(wrl.id)::integer AS "awardCount"
             FROM public.workspace_recognition_categories rc
             LEFT JOIN public.workspace_recognition_ledger wrl 
                ON wrl.category_id = rc.id 
               AND wrl.workspace_id = $1 
               AND wrl.transaction_type = 'award' 
               AND wrl.is_reversed = false
             WHERE rc.workspace_id = $1 AND rc.is_active = true
             GROUP BY rc.id, rc.name, rc.slug, rc.icon, rc.display_order
             ORDER BY "totalPoints" DESC, rc.display_order ASC;`,
            [workspaceId]
        );

        // Top Recipients
        const topRecipRes = await query(
            `SELECT
                u.id AS "userId",
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "totalPoints",
                COUNT(wrl.id)::integer AS "awardCount"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.users u ON u.id = wrl.recipient_id
             WHERE wrl.workspace_id = $1 AND wrl.transaction_type = 'award' AND wrl.is_reversed = false
             GROUP BY u.id, u.firstname, u.lastname, u.username, u.avatar_url
             ORDER BY "totalPoints" DESC
             LIMIT 5;`,
            [workspaceId]
        );

        // Top Issuers
        const topIssuersRes = await query(
            `SELECT
                u.id AS "userId",
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "totalPoints",
                COUNT(wrl.id)::integer AS "awardCount"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.users u ON u.id = wrl.issuer_id
             WHERE wrl.workspace_id = $1 AND wrl.transaction_type = 'award' AND wrl.is_reversed = false
             GROUP BY u.id, u.firstname, u.lastname, u.username, u.avatar_url
             ORDER BY "totalPoints" DESC
             LIMIT 5;`,
            [workspaceId]
        );

        const totals = totalsRes.rows[0] || {};
        return {
            totalOrbitsAwarded: parseInt(totals.totalAwarded, 10) || 0,
            totalAwardsCount: parseInt(totals.totalCount, 10) || 0,
            monthlyOrbitsAwarded: parseInt(totals.monthlyAwarded, 10) || 0,
            monthlyAwardsCount: parseInt(totals.monthlyCount, 10) || 0,
            activeCategoriesCount: catRes.rows.length,
            categoryBreakdown: catRes.rows,
            topRecipients: topRecipRes.rows,
            topIssuers: topIssuersRes.rows,
        };
    }

    /**
     * Retrieves or initializes the monthly budget record for an issuer with row locking.
     */
    static async getOrCreateRecognitionBudget(
        clientOrQuery: any,
        workspaceId: string,
        userId: string,
        yearMonth: string,
        defaultAllocated = 500
    ): Promise<WorkspaceRecognitionBudget> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `INSERT INTO public.workspace_recognition_budgets (
                workspace_id, user_id, year_month, allocated_budget, used_budget
             ) VALUES ($1, $2, $3, $4, 0)
             ON CONFLICT (workspace_id, user_id, year_month) DO UPDATE SET
                updated_at = NOW()
             RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                year_month AS "yearMonth",
                allocated_budget AS "allocatedBudget",
                used_budget AS "usedBudget",
                (allocated_budget - used_budget) AS "remainingBudget",
                allocated_by AS "allocatedBy",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [workspaceId, userId, yearMonth, defaultAllocated]
        );
        return res.rows[0];
    }

    /**
     * Atomically consumes recognition budget with row-level locking.
     */
    static async consumeRecognitionBudget(
        client: any,
        workspaceId: string,
        userId: string,
        yearMonth: string,
        amount: number
    ): Promise<WorkspaceRecognitionBudget> {
        // Lock budget row for update
        const lockRes = await client.query(
            `SELECT id, allocated_budget, used_budget 
             FROM public.workspace_recognition_budgets
             WHERE workspace_id = $1 AND user_id = $2 AND year_month = $3
             FOR UPDATE;`,
            [workspaceId, userId, yearMonth]
        );

        let row = lockRes.rows[0];
        if (!row) {
            // Provision first
            await this.getOrCreateRecognitionBudget(client, workspaceId, userId, yearMonth);
            const refetch = await client.query(
                `SELECT id, allocated_budget, used_budget 
                 FROM public.workspace_recognition_budgets
                 WHERE workspace_id = $1 AND user_id = $2 AND year_month = $3
                 FOR UPDATE;`,
                [workspaceId, userId, yearMonth]
            );
            row = refetch.rows[0];
        }

        if (row.used_budget + amount > row.allocated_budget) {
            throw new Error(`Insufficient recognition award budget. Available: ${row.allocated_budget - row.used_budget} Orbits, Requested: ${amount} Orbits.`);
        }

        const updateRes = await client.query(
            `UPDATE public.workspace_recognition_budgets
             SET used_budget = used_budget + $1, updated_at = NOW()
             WHERE id = $2
             RETURNING
                id,
                workspace_id AS "workspaceId",
                user_id AS "userId",
                year_month AS "yearMonth",
                allocated_budget AS "allocatedBudget",
                used_budget AS "usedBudget",
                (allocated_budget - used_budget) AS "remainingBudget",
                allocated_by AS "allocatedBy",
                created_at AS "createdAt",
                updated_at AS "updatedAt";`,
            [amount, row.id]
        );
        return updateRes.rows[0];
    }

    /**
     * Credits back consumed budget on award reversal.
     */
    static async creditRecognitionBudget(
        client: any,
        workspaceId: string,
        userId: string,
        yearMonth: string,
        amount: number
    ): Promise<void> {
        await client.query(
            `UPDATE public.workspace_recognition_budgets
             SET used_budget = GREATEST(0, used_budget - $1), updated_at = NOW()
             WHERE workspace_id = $2 AND user_id = $3 AND year_month = $4;`,
            [amount, workspaceId, userId, yearMonth]
        );
    }

    /**
     * Computes recipient's total inflow of Orbits within a calendar month.
     */
    static async getRecipientMonthlyInflow(
        clientOrQuery: any,
        workspaceId: string,
        recipientId: string,
        yearMonth: string
    ): Promise<number> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `SELECT COALESCE(SUM(points_delta), 0)::integer AS total
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1
               AND recipient_id = $2
               AND transaction_type = 'award'
               AND is_reversed = false
               AND TO_CHAR(created_at, 'YYYY-MM') = $3;`,
            [workspaceId, recipientId, yearMonth]
        );
        return parseInt(res.rows[0].total, 10) || 0;
    }

    /**
     * Computes issuer's daily award count.
     */
    static async getIssuerDailyAwardCount(
        clientOrQuery: any,
        workspaceId: string,
        issuerId: string,
        dateStr: string
    ): Promise<number> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `SELECT COUNT(*)::integer AS count
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1
               AND issuer_id = $2
               AND transaction_type = 'award'
               AND is_reversed = false
               AND TO_CHAR(created_at, 'YYYY-MM-DD') = $3;`,
            [workspaceId, issuerId, dateStr]
        );
        return parseInt(res.rows[0].count, 10) || 0;
    }

    /**
     * Inserts an immutable award transaction into the ledger.
     */
    static async insertRecognitionLedgerEntry(
        client: any,
        entry: {
            workspaceId: string;
            recipientId: string;
            issuerId: string;
            departmentId?: string | null;
            transactionType: RecognitionTransactionType;
            pointsDelta: number;
            categoryId: string;
            appreciationReason: string;
            linkedTaskId?: string | null;
            linkedMilestoneId?: string | null;
            evidenceUrl?: string | null;
            referenceAwardId?: string | null;
            idempotencyKey?: string | null;
            visibility?: "workspace" | "recipient_only" | "private";
            status?: RecognitionStatus;
            ipAddress?: string | null;
            userAgent?: string | null;
        }
    ): Promise<WorkspaceRecognitionLedgerEntry> {
        const insertRes = await client.query(
            `INSERT INTO public.workspace_recognition_ledger (
                workspace_id,
                recipient_id,
                issuer_id,
                department_id,
                transaction_type,
                points_delta,
                category_id,
                appreciation_reason,
                linked_task_id,
                linked_milestone_id,
                evidence_url,
                reference_award_id,
                idempotency_key,
                visibility,
                status,
                ip_address,
                user_agent,
                created_at
             ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, 'workspace'), COALESCE($15, 'completed'), $16, $17, NOW()
             )
             RETURNING
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                issuer_id AS "issuerId",
                department_id AS "departmentId",
                transaction_type AS "transactionType",
                points_delta AS "pointsDelta",
                category_id AS "categoryId",
                appreciation_reason AS "appreciationReason",
                linked_task_id AS "linkedTaskId",
                linked_milestone_id AS "linkedMilestoneId",
                evidence_url AS "evidenceUrl",
                reference_award_id AS "referenceAwardId",
                idempotency_key AS "idempotencyKey",
                visibility,
                status,
                is_reversed AS "isReversed",
                reversal_reason AS "reversalReason",
                reversed_at AS "reversedAt",
                reversed_by AS "reversedBy",
                ip_address AS "ipAddress",
                user_agent AS "userAgent",
                created_at AS "createdAt";`,
            [
                entry.workspaceId,
                entry.recipientId,
                entry.issuerId,
                entry.departmentId || null,
                entry.transactionType,
                entry.pointsDelta,
                entry.categoryId,
                entry.appreciationReason.trim(),
                entry.linkedTaskId || null,
                entry.linkedMilestoneId || null,
                entry.evidenceUrl || null,
                entry.referenceAwardId || null,
                entry.idempotencyKey || null,
                entry.visibility || "workspace",
                entry.status || "completed",
                entry.ipAddress || null,
                entry.userAgent || null,
            ]
        );
        return insertRes.rows[0];
    }

    /**
     * Finds an entry by idempotency key within workspace.
     */
    static async findRecognitionByIdempotencyKey(
        workspaceId: string,
        idempotencyKey: string,
        clientOrQuery: any = null
    ): Promise<WorkspaceRecognitionLedgerEntry | null> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                issuer_id AS "issuerId",
                department_id AS "departmentId",
                transaction_type AS "transactionType",
                points_delta AS "pointsDelta",
                category_id AS "categoryId",
                appreciation_reason AS "appreciationReason",
                linked_task_id AS "linkedTaskId",
                linked_milestone_id AS "linkedMilestoneId",
                evidence_url AS "evidenceUrl",
                reference_award_id AS "referenceAwardId",
                idempotency_key AS "idempotencyKey",
                status,
                is_reversed AS "isReversed",
                reversal_reason AS "reversalReason",
                reversed_at AS "reversedAt",
                reversed_by AS "reversedBy",
                ip_address AS "ipAddress",
                user_agent AS "userAgent",
                created_at AS "createdAt"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND idempotency_key = $2
             LIMIT 1;`,
            [workspaceId, idempotencyKey]
        );
        return res.rows[0] || null;
    }

    /**
     * Finds a recognition ledger entry by ID with relation joins.
     */
    static async findRecognitionLedgerEntryById(
        workspaceId: string,
        entryId: string,
        clientOrQuery: any = null
    ): Promise<WorkspaceRecognitionLedgerEntry | null> {
        const executor = clientOrQuery || { query };
        const res = await executor.query(
            `SELECT
                wrl.id,
                wrl.workspace_id AS "workspaceId",
                wrl.recipient_id AS "recipientId",
                wrl.issuer_id AS "issuerId",
                wrl.department_id AS "departmentId",
                wrl.transaction_type AS "transactionType",
                wrl.points_delta AS "pointsDelta",
                wrl.category_id AS "categoryId",
                wrl.appreciation_reason AS "appreciationReason",
                wrl.linked_task_id AS "linkedTaskId",
                wrl.linked_milestone_id AS "linkedMilestoneId",
                wrl.evidence_url AS "evidenceUrl",
                wrl.reference_award_id AS "referenceAwardId",
                wrl.idempotency_key AS "idempotencyKey",
                wrl.status,
                wrl.is_reversed AS "isReversed",
                wrl.reversal_reason AS "reversalReason",
                wrl.reversed_at AS "reversedAt",
                wrl.reversed_by AS "reversedBy",
                wrl.ip_address AS "ipAddress",
                wrl.user_agent AS "userAgent",
                wrl.created_at AS "createdAt",
                json_build_object(
                    'id', ru.id,
                    'username', ru.username,
                    'firstName', ru.firstname,
                    'lastName', ru.lastname,
                    'avatarUrl', ru.avatar_url
                ) AS "recipient",
                json_build_object(
                    'id', iu.id,
                    'username', iu.username,
                    'firstName', iu.firstname,
                    'lastName', iu.lastname,
                    'avatarUrl', iu.avatar_url
                ) AS "issuer",
                json_build_object(
                    'id', rc.id,
                    'name', rc.name,
                    'slug', rc.slug,
                    'icon', rc.icon
                ) AS "category",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object('id', wd.id, 'name', wd.name, 'slug', wd.slug, 'color', wd.color)
                ELSE NULL END AS "department",
                CASE WHEN wt.id IS NOT NULL THEN
                    json_build_object('id', wt.id, 'title', wt.title, 'status', wt.status)
                ELSE NULL END AS "linkedTask"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.users ru ON ru.id = wrl.recipient_id
             JOIN public.users iu ON iu.id = wrl.issuer_id
             JOIN public.workspace_recognition_categories rc ON rc.id = wrl.category_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wrl.department_id
             LEFT JOIN public.workspace_tasks wt ON wt.id = wrl.linked_task_id
             WHERE wrl.workspace_id = $1 AND wrl.id = $2
             LIMIT 1;`,
            [workspaceId, entryId]
        );
        return res.rows[0] || null;
    }

    /**
     * Marks an original award reversed and records compensating reversal ledger entry.
     */
    static async reverseRecognitionAward(
        client: any,
        workspaceId: string,
        originalAwardId: string,
        reversedByUserId: string,
        reversalReason: string,
        idempotencyKey?: string | null,
        ipAddress?: string | null,
        userAgent?: string | null
    ): Promise<{ reversalEntry: WorkspaceRecognitionLedgerEntry; originalEntry: WorkspaceRecognitionLedgerEntry }> {
        // Lock original award row for update
        const lockRes = await client.query(
            `SELECT
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                issuer_id AS "issuerId",
                department_id AS "departmentId",
                transaction_type AS "transactionType",
                points_delta AS "pointsDelta",
                category_id AS "categoryId",
                appreciation_reason AS "appreciationReason",
                is_reversed AS "isReversed",
                created_at AS "createdAt"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND id = $2
             FOR UPDATE;`,
            [workspaceId, originalAwardId]
        );

        const original = lockRes.rows[0];
        if (!original) {
            throw new Error("Recognition award not found.");
        }
        if (original.transactionType !== "award") {
            throw new Error("Cannot reverse a reversal transaction.");
        }
        if (original.isReversed) {
            throw new Error("This recognition award has already been reversed.");
        }

        // 1. Insert compensating reversal row in ledger
        const reversalRes = await client.query(
            `INSERT INTO public.workspace_recognition_ledger (
                workspace_id,
                recipient_id,
                issuer_id,
                department_id,
                transaction_type,
                points_delta,
                category_id,
                appreciation_reason,
                reference_award_id,
                idempotency_key,
                status,
                is_reversed,
                ip_address,
                user_agent,
                created_at
             ) VALUES (
                $1, $2, $3, $4, 'reversal', $5, $6, $7, $8, $9, 'completed', false, $10, $11, NOW()
             )
             RETURNING
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                issuer_id AS "issuerId",
                department_id AS "departmentId",
                transaction_type AS "transactionType",
                points_delta AS "pointsDelta",
                category_id AS "categoryId",
                appreciation_reason AS "appreciationReason",
                reference_award_id AS "referenceAwardId",
                idempotency_key AS "idempotencyKey",
                status,
                is_reversed AS "isReversed",
                created_at AS "createdAt";`,
            [
                workspaceId,
                original.recipientId,
                reversedByUserId,
                original.departmentId,
                -original.pointsDelta, // Compensating negative delta
                original.categoryId,
                `Correction Reversal: ${reversalReason.trim()}`,
                original.id,
                idempotencyKey || null,
                ipAddress || null,
                userAgent || null,
            ]
        );
        const reversalEntry = reversalRes.rows[0];

        // 2. Mark original award as reversed
        const updateOrigRes = await client.query(
            `UPDATE public.workspace_recognition_ledger
             SET
                is_reversed = true,
                status = 'reversed',
                reversed_at = NOW(),
                reversed_by = $1,
                reversal_reason = $2
             WHERE id = $3
             RETURNING
                id,
                workspace_id AS "workspaceId",
                recipient_id AS "recipientId",
                issuer_id AS "issuerId",
                points_delta AS "pointsDelta",
                status,
                is_reversed AS "isReversed",
                reversed_at AS "reversedAt",
                reversed_by AS "reversedBy",
                reversal_reason AS "reversalReason";`,
            [reversedByUserId, reversalReason.trim(), original.id]
        );
        const originalEntry = updateOrigRes.rows[0];

        // 3. Update Period Aggregates for recipient
        await this.adjustRecognitionAggregates(
            client,
            workspaceId,
            original.recipientId,
            -original.pointsDelta,
            true // isReversal
        );

        // 4. If award was made in current month, credit issuer budget
        const awardMonth = new Date(original.createdAt).toISOString().slice(0, 7);
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (awardMonth === currentMonth) {
            await this.creditRecognitionBudget(client, workspaceId, original.issuerId, awardMonth, original.pointsDelta);
        }

        // 5. Emit outbox event
        await this.createOutboxEvent(
            {
                workspaceId,
                eventType: "recognition:reversed",
                payload: {
                    originalAwardId: original.id,
                    reversalId: reversalEntry.id,
                    recipientId: original.recipientId,
                    pointsDelta: -original.pointsDelta,
                    reversedBy: reversedByUserId,
                    reversalReason,
                },
            },
            client
        );

        return { reversalEntry, originalEntry };
    }

    /**
     * Adjusts weekly, monthly, and all-time period aggregates.
     */
    static async adjustRecognitionAggregates(
        client: any,
        workspaceId: string,
        userId: string,
        pointsDelta: number,
        isReversal = false
    ): Promise<void> {
        const now = new Date();
        const yearMonth = now.toISOString().slice(0, 7);
        const periods = [
            { type: "all_time", key: "all_time" },
            { type: "monthly", key: yearMonth },
        ];

        for (const p of periods) {
            await client.query(
                `INSERT INTO public.workspace_recognition_period_aggregates (
                    workspace_id, user_id, period_type, period_key,
                    total_orbits_received, awards_count, last_award_at, updated_at
                 ) VALUES (
                    $1, $2, $3, $4, GREATEST(0, $5), $6, NOW(), NOW()
                 )
                 ON CONFLICT (workspace_id, user_id, period_type, period_key) DO UPDATE SET
                    total_orbits_received = GREATEST(0, public.workspace_recognition_period_aggregates.total_orbits_received + $5),
                    awards_count = GREATEST(0, public.workspace_recognition_period_aggregates.awards_count + $7),
                    last_award_at = CASE WHEN $5 > 0 THEN NOW() ELSE public.workspace_recognition_period_aggregates.last_award_at END,
                    updated_at = NOW();`,
                [
                    workspaceId,
                    userId,
                    p.type,
                    p.key,
                    pointsDelta,
                    isReversal ? 0 : 1,
                    isReversal ? -1 : 1,
                ]
            );
        }
    }

    /**
     * Lists recognition ledger history with comprehensive filters, visibility awareness, and pagination.
     */
    static async listRecognitionLedger(
        workspaceId: string,
        options: {
            recipientId?: string;
            issuerId?: string;
            departmentId?: string;
            categoryId?: string;
            activeOnly?: boolean;
            viewerUserId?: string;
            canViewAllPrivate?: boolean;
            isWorkspaceVisible?: boolean;
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<{ entries: WorkspaceRecognitionLedgerEntry[]; total: number }> {
        const limit = Math.min(Math.max(options.limit ?? 20, 1), 100);
        const offset = Math.max(options.offset ?? 0, 0);

        let whereClause = `WHERE wrl.workspace_id = $1`;
        const params: any[] = [workspaceId];
        let idx = 2;

        if (options.recipientId) {
            whereClause += ` AND wrl.recipient_id = $${idx++}`;
            params.push(options.recipientId);
        }
        if (options.issuerId) {
            whereClause += ` AND wrl.issuer_id = $${idx++}`;
            params.push(options.issuerId);
        }
        if (options.departmentId) {
            whereClause += ` AND wrl.department_id = $${idx++}`;
            params.push(options.departmentId);
        }
        if (options.categoryId) {
            whereClause += ` AND wrl.category_id = $${idx++}`;
            params.push(options.categoryId);
        }
        if (options.activeOnly) {
            whereClause += ` AND wrl.is_reversed = false`;
        }

        // Visibility Filtering
        if (options.viewerUserId && !options.canViewAllPrivate) {
            if (options.isWorkspaceVisible === false) {
                // Workspace visibility is turned off in policy: only see awards where actor is recipient or issuer
                whereClause += ` AND (wrl.recipient_id = $${idx} OR wrl.issuer_id = $${idx})`;
                params.push(options.viewerUserId);
                idx++;
            } else {
                // Workspace visibility is on: can see 'workspace' visibility awards OR own awards
                whereClause += ` AND (wrl.visibility = 'workspace' OR wrl.recipient_id = $${idx} OR wrl.issuer_id = $${idx})`;
                params.push(options.viewerUserId);
                idx++;
            }
        }

        const countRes = await query(
            `SELECT COUNT(*)::integer AS total 
             FROM public.workspace_recognition_ledger wrl 
             ${whereClause};`,
            params
        );
        const total = parseInt(countRes.rows[0].total, 10) || 0;

        const dataRes = await query(
            `SELECT
                wrl.id,
                wrl.workspace_id AS "workspaceId",
                wrl.recipient_id AS "recipientId",
                wrl.issuer_id AS "issuerId",
                wrl.department_id AS "departmentId",
                wrl.transaction_type AS "transactionType",
                wrl.points_delta AS "pointsDelta",
                wrl.category_id AS "categoryId",
                wrl.appreciation_reason AS "appreciationReason",
                wrl.linked_task_id AS "linkedTaskId",
                wrl.linked_milestone_id AS "linkedMilestoneId",
                wrl.evidence_url AS "evidenceUrl",
                wrl.reference_award_id AS "referenceAwardId",
                wrl.idempotency_key AS "idempotencyKey",
                wrl.visibility,
                wrl.status,
                wrl.is_reversed AS "isReversed",
                wrl.reversal_reason AS "reversalReason",
                wrl.reversed_at AS "reversedAt",
                wrl.reversed_by AS "reversedBy",
                wrl.created_at AS "createdAt",
                json_build_object(
                    'id', ru.id,
                    'username', ru.username,
                    'firstName', ru.firstname,
                    'lastName', ru.lastname,
                    'avatarUrl', ru.avatar_url
                ) AS "recipient",
                json_build_object(
                    'id', iu.id,
                    'username', iu.username,
                    'firstName', iu.firstname,
                    'lastName', iu.lastname,
                    'avatarUrl', iu.avatar_url
                ) AS "issuer",
                json_build_object(
                    'id', rc.id,
                    'name', rc.name,
                    'slug', rc.slug,
                    'icon', rc.icon
                ) AS "category",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object('id', wd.id, 'name', wd.name, 'slug', wd.slug, 'color', wd.color)
                ELSE NULL END AS "department",
                CASE WHEN wt.id IS NOT NULL THEN
                    json_build_object('id', wt.id, 'title', wt.title, 'status', wt.status)
                ELSE NULL END AS "linkedTask"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.users ru ON ru.id = wrl.recipient_id
             JOIN public.users iu ON iu.id = wrl.issuer_id
             JOIN public.workspace_recognition_categories rc ON rc.id = wrl.category_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wrl.department_id
             LEFT JOIN public.workspace_tasks wt ON wt.id = wrl.linked_task_id
             ${whereClause}
             ORDER BY wrl.created_at DESC
             LIMIT $${idx++} OFFSET $${idx++};`,
            [...params, limit, offset]
        );

        return { entries: dataRes.rows, total };
    }

    /**
     * Finds a single recognition award by ID with complete entity relations.
     */
    static async getRecognitionAwardById(
        workspaceId: string,
        awardId: string
    ): Promise<WorkspaceRecognitionLedgerEntry | null> {
        const res = await query(
            `SELECT
                wrl.id,
                wrl.workspace_id AS "workspaceId",
                wrl.recipient_id AS "recipientId",
                wrl.issuer_id AS "issuerId",
                wrl.department_id AS "departmentId",
                wrl.transaction_type AS "transactionType",
                wrl.points_delta AS "pointsDelta",
                wrl.category_id AS "categoryId",
                wrl.appreciation_reason AS "appreciationReason",
                wrl.linked_task_id AS "linkedTaskId",
                wrl.linked_milestone_id AS "linkedMilestoneId",
                wrl.evidence_url AS "evidenceUrl",
                wrl.reference_award_id AS "referenceAwardId",
                wrl.idempotency_key AS "idempotencyKey",
                wrl.visibility,
                wrl.status,
                wrl.is_reversed AS "isReversed",
                wrl.reversal_reason AS "reversalReason",
                wrl.reversed_at AS "reversedAt",
                wrl.reversed_by AS "reversedBy",
                wrl.created_at AS "createdAt",
                json_build_object(
                    'id', ru.id,
                    'username', ru.username,
                    'firstName', ru.firstname,
                    'lastName', ru.lastname,
                    'avatarUrl', ru.avatar_url
                ) AS "recipient",
                json_build_object(
                    'id', iu.id,
                    'username', iu.username,
                    'firstName', iu.firstname,
                    'lastName', iu.lastname,
                    'avatarUrl', iu.avatar_url
                ) AS "issuer",
                json_build_object(
                    'id', rc.id,
                    'name', rc.name,
                    'slug', rc.slug,
                    'icon', rc.icon
                ) AS "category",
                CASE WHEN wd.id IS NOT NULL THEN
                    json_build_object('id', wd.id, 'name', wd.name, 'slug', wd.slug, 'color', wd.color)
                ELSE NULL END AS "department",
                CASE WHEN wt.id IS NOT NULL THEN
                    json_build_object('id', wt.id, 'title', wt.title, 'status', wt.status)
                ELSE NULL END AS "linkedTask"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.users ru ON ru.id = wrl.recipient_id
             JOIN public.users iu ON iu.id = wrl.issuer_id
             JOIN public.workspace_recognition_categories rc ON rc.id = wrl.category_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wrl.department_id
             LEFT JOIN public.workspace_tasks wt ON wt.id = wrl.linked_task_id
             WHERE wrl.workspace_id = $1 AND wrl.id = $2;`,
            [workspaceId, awardId]
        );
        return res.rows[0] || null;
    }

    /**
     * Appends an appreciation note to a recognition award.
     */
    static async addRecognitionNote(
        workspaceId: string,
        awardId: string,
        authorId: string,
        note: string
    ): Promise<{ id: string; awardId: string; authorId: string; note: string; createdAt: Date }> {
        const res = await query(
            `INSERT INTO public.workspace_recognition_notes (workspace_id, award_id, author_id, note)
             VALUES ($1, $2, $3, $4)
             RETURNING id, workspace_id AS "workspaceId", award_id AS "awardId", author_id AS "authorId", note, created_at AS "createdAt";`,
            [workspaceId, awardId, authorId, note.trim()]
        );
        return res.rows[0];
    }

    /**
     * Retrieves all appreciation notes for a specific award.
     */
    static async listRecognitionNotes(
        workspaceId: string,
        awardId: string
    ): Promise<Array<{ id: string; awardId: string; note: string; createdAt: Date; author: any }>> {
        const res = await query(
            `SELECT
                wn.id,
                wn.award_id AS "awardId",
                wn.note,
                wn.created_at AS "createdAt",
                json_build_object(
                    'id', u.id,
                    'username', u.username,
                    'firstName', u.firstname,
                    'lastName', u.lastname,
                    'avatarUrl', u.avatar_url
                ) AS "author"
             FROM public.workspace_recognition_notes wn
             JOIN public.users u ON u.id = wn.author_id
             WHERE wn.workspace_id = $1 AND wn.award_id = $2
             ORDER BY wn.created_at ASC;`,
            [workspaceId, awardId]
        );
        return res.rows;
    }

    /**
     * Computes recognition balance summary for a member with weekly and rank metrics.
     */
    static async getMemberRecognitionSummary(
        workspaceId: string,
        userId: string,
        yearMonth: string = new Date().toISOString().slice(0, 7)
    ): Promise<MemberRecognitionSummary> {
        // 1. Authoritative all-time balance from ledger
        const allTimeRes = await query(
            `SELECT
                COALESCE(SUM(points_delta), 0)::integer AS "totalOrbits",
                COUNT(*) FILTER (WHERE transaction_type = 'award' AND is_reversed = false)::integer AS "awardsCount"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND recipient_id = $2;`,
            [workspaceId, userId]
        );
        const totalOrbitsEarned = Math.max(0, parseInt(allTimeRes.rows[0].totalOrbits, 10) || 0);
        const totalAwardsReceived = parseInt(allTimeRes.rows[0].awardsCount, 10) || 0;

        // 2. Monthly balance from ledger
        const monthlyRes = await query(
            `SELECT
                COALESCE(SUM(points_delta), 0)::integer AS "monthlyOrbits",
                COUNT(*) FILTER (WHERE transaction_type = 'award' AND is_reversed = false)::integer AS "monthlyAwards"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1
               AND recipient_id = $2
               AND TO_CHAR(created_at, 'YYYY-MM') = $3;`,
            [workspaceId, userId, yearMonth]
        );
        const monthlyOrbitsEarned = Math.max(0, parseInt(monthlyRes.rows[0].monthlyOrbits, 10) || 0);
        const monthlyAwardsReceived = parseInt(monthlyRes.rows[0].monthlyAwards, 10) || 0;

        // 3. Weekly balance from ledger (earned this week)
        const weeklyRes = await query(
            `SELECT
                COALESCE(SUM(points_delta), 0)::integer AS "weeklyOrbits"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1
               AND recipient_id = $2
               AND created_at >= DATE_TRUNC('week', NOW())
               AND points_delta > 0
               AND is_reversed = false;`,
            [workspaceId, userId]
        );
        const weeklyOrbitsEarned = Math.max(0, parseInt(weeklyRes.rows[0].weeklyOrbits, 10) || 0);

        // 4. Current Contributor Rank in Workspace
        const rankRes = await query(
            `WITH user_points AS (
                SELECT recipient_id, SUM(points_delta) as balance,
                       DENSE_RANK() OVER (ORDER BY SUM(points_delta) DESC) as rnk
                FROM public.workspace_recognition_ledger
                WHERE workspace_id = $1 AND is_reversed = false
                GROUP BY recipient_id
                HAVING SUM(points_delta) > 0
            )
            SELECT rnk FROM user_points WHERE recipient_id = $2;`,
            [workspaceId, userId]
        );
        const contributorRank = rankRes.rows.length > 0 ? parseInt(rankRes.rows[0].rnk, 10) : null;

        // 5. Policy & Inflow Allowance
        const policy = await this.getRecognitionPolicy(workspaceId);
        const monthlyRemainingAllowance = Math.max(0, policy.recipientMonthlyCap - monthlyOrbitsEarned);

        // 6. Issuer Budget (if user has budget allocated)
        const budgetRes = await query(
            `SELECT allocated_budget, used_budget 
             FROM public.workspace_recognition_budgets
             WHERE workspace_id = $1 AND user_id = $2 AND year_month = $3;`,
            [workspaceId, userId, yearMonth]
        );
        const budget = budgetRes.rows[0];

        // 7. Recent Awards (last 5)
        const recent = await this.listRecognitionLedger(workspaceId, {
            recipientId: userId,
            activeOnly: true,
            limit: 5,
        });

        return {
            workspaceId,
            userId,
            totalOrbitsEarned,
            currentBalance: totalOrbitsEarned,
            allTimePoints: totalOrbitsEarned,
            totalAwardsReceived,
            awardsReceivedCount: totalAwardsReceived,
            monthlyOrbitsEarned,
            monthlyAwardsReceived,
            weeklyOrbitsEarned,
            contributorRank,
            monthlyRemainingAllowance,
            allocatedBudget: budget?.allocated_budget,
            usedBudget: budget?.used_budget,
            remainingBudget: budget ? Math.max(0, budget.allocated_budget - budget.used_budget) : undefined,
            canAward: false, // Resolved by CapabilityService
            recentAwards: recent.entries,
        };
    }

    /**
     * Computes department recognition analytics, totals, and member rankings.
     */
    static async getDepartmentRecognitionSummary(
        workspaceId: string,
        departmentId: string
    ): Promise<{
        departmentId: string;
        departmentName: string;
        departmentColor?: string;
        totalOrbits: number;
        activeMemberCount: number;
        averageOrbitsPerMember: number;
        memberRankings: Array<{
            userId: string;
            name: string;
            username: string;
            avatarUrl?: string;
            roleName: string;
            isLead: boolean;
            totalOrbits: number;
            awardsCount: number;
            rank: number;
            recentAppreciation?: string;
        }>;
    }> {
        // 1. Department info
        const deptRes = await query(
            `SELECT id, name, color, lead_user_id AS "leadUserId"
             FROM public.workspace_departments
             WHERE workspace_id = $1 AND id = $2;`,
            [workspaceId, departmentId]
        );
        if (deptRes.rows.length === 0) {
            throw new Error("Department not found in workspace.");
        }
        const dept = deptRes.rows[0];

        // 2. Department active members and their Orbits balance
        const membersRes = await query(
            `SELECT
                u.id AS "userId",
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                r.name AS "roleName",
                (u.id = $3) AS "isLead",
                COALESCE(SUM(wrl.points_delta) FILTER (WHERE wrl.is_reversed = false), 0)::integer AS "totalOrbits",
                COUNT(wrl.id) FILTER (WHERE wrl.transaction_type = 'award' AND wrl.is_reversed = false)::integer AS "awardsCount",
                (
                    SELECT wrl2.appreciation_reason 
                    FROM public.workspace_recognition_ledger wrl2 
                    WHERE wrl2.workspace_id = $1 
                      AND wrl2.recipient_id = u.id 
                      AND wrl2.transaction_type = 'award' 
                      AND wrl2.is_reversed = false
                    ORDER BY wrl2.created_at DESC 
                    LIMIT 1
                ) AS "recentAppreciation"
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             LEFT JOIN public.workspace_recognition_ledger wrl 
                ON wrl.recipient_id = u.id 
               AND wrl.workspace_id = $1
             WHERE wm.workspace_id = $1
               AND (wm.department_id = $2 OR EXISTS (
                   SELECT 1 FROM public.workspace_department_members wdm 
                   WHERE wdm.member_id = wm.id AND wdm.department_id = $2
               ))
               AND wm.is_suspended = false
               AND wm.membership_status = 'active'
             GROUP BY u.id, u.firstname, u.lastname, u.username, u.avatar_url, r.name
             ORDER BY "totalOrbits" DESC, "name" ASC;`,
            [workspaceId, departmentId, dept.leadUserId]
        );

        const rows = membersRes.rows;
        let currentRank = 1;
        const memberRankings = rows.map((row: any, idx: number) => {
            if (idx > 0 && row.totalOrbits < rows[idx - 1].totalOrbits) {
                currentRank = idx + 1;
            }
            return {
                userId: row.userId,
                name: row.name || row.username,
                username: row.username,
                avatarUrl: row.avatarUrl || undefined,
                roleName: row.roleName,
                isLead: row.isLead,
                totalOrbits: parseInt(row.totalOrbits, 10) || 0,
                awardsCount: parseInt(row.awardsCount, 10) || 0,
                rank: currentRank,
                recentAppreciation: row.recentAppreciation || undefined,
            };
        });

        const activeMemberCount = memberRankings.length;
        const totalOrbits = memberRankings.reduce((sum, m) => sum + m.totalOrbits, 0);
        const averageOrbitsPerMember = activeMemberCount > 0 ? Math.round((totalOrbits / activeMemberCount) * 10) / 10 : 0;

        return {
            departmentId: dept.id,
            departmentName: dept.name,
            departmentColor: dept.color,
            totalOrbits,
            activeMemberCount,
            averageOrbitsPerMember,
            memberRankings,
        };
    }

    // =========================================================================
    // 16. THREE LEADERBOARDS & DEPARTMENT PERFORMANCE INDEX (DPI)
    // =========================================================================

    /**
     * Calculates the three separate leaderboards:
     * 1. Contributor Leaderboard (eligible non-lead team members)
     * 2. Department Lead Leaderboard (leads ranked by Department Performance Index)
     * 3. Department Leaderboard (departments ranked by DPI v1.0 formula)
     */
    static async getThreeLeaderboards(
        workspaceId: string,
        options: {
            period?: LeaderboardPeriod;
            departmentId?: string;
            currentUserId?: string;
        } = {}
    ): Promise<ThreeLeaderboardsResponse> {
        const period: LeaderboardPeriod = options.period || "this_month";

        // 1. Resolve period boundaries
        const resolvePeriodBoundaries = (p: LeaderboardPeriod) => {
            const now = new Date();
            if (p === "all_time") {
                return { start: null, end: null, prevStart: null, prevEnd: null };
            }
            if (p === "this_week") {
                const d = new Date(now);
                const day = d.getUTCDay();
                const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
                const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
                const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff + 6, 23, 59, 59, 999));
                const prevStart = new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000);
                const prevEnd = new Date(start.getTime() - 1);
                return { start, end, prevStart, prevEnd };
            }
            if (p === "this_month") {
                const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
                const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                const prevStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 0, 0, 0, 0));
                const prevEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0, 23, 59, 59, 999));
                return { start, end, prevStart, prevEnd };
            }
            if (p === "last_30_days") {
                const end = now;
                const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                const prevStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
                const prevEnd = start;
                return { start, end, prevStart, prevEnd };
            }
            if (p === "last_90_days") {
                const end = now;
                const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                const prevStart = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
                const prevEnd = start;
                return { start, end, prevStart, prevEnd };
            }
            return { start: null, end: null, prevStart: null, prevEnd: null };
        };

        const { start, end, prevStart, prevEnd } = resolvePeriodBoundaries(period);

        // 2. Fetch recognition policy with DPI weights
        const policy = await this.getRecognitionPolicy(workspaceId);
        const formulaVersion = policy.dpiFormulaVersion || "v1.0";
        const wApproved = Number(policy.dpiWeightApprovedTasks) || 35;
        const wOnTime = Number(policy.dpiWeightOnTime) || 35;
        const wParticipation = Number(policy.dpiWeightParticipation) || 20;
        const wRecognition = Number(policy.dpiWeightRecognition) || 10;
        const weights = {
            approvedTasks: wApproved,
            onTime: wOnTime,
            participation: wParticipation,
            recognition: wRecognition,
        };
        const capPerMember = policy.dpiRecognitionCapPerMember || 50;
        const minTasksSample = policy.dpiMinTasksSample || 1;

        // 3. Query Club Owner & Workspace Managers (to exclude from contributor leaderboard)
        const wsMetaRes = await query(
            `SELECT tw.id, tw.club_id, tw.manager_user_id AS "managerUserId", vc.auth_user_id AS "ownerId"
             FROM public.team_workspaces tw
             JOIN public.verified_clubs vc ON vc.id = tw.club_id
             WHERE tw.id = $1;`,
            [workspaceId]
        );
        const ownerId = wsMetaRes.rows[0]?.ownerId;
        const wsManagerId = wsMetaRes.rows[0]?.managerUserId;

        const managersRes = await query(
            `SELECT wm.user_id
             FROM public.workspace_members wm
             JOIN public.workspace_roles r ON r.id = wm.role_id
             WHERE wm.workspace_id = $1
               AND (
                   r.name IN ('Club Manager', 'Workspace Manager', 'Administrator', 'Workspace Owner') 
                   OR r.slug IN ('club_manager', 'workspace_manager', 'owner', 'manager', 'admin')
                   OR r.rank >= 800
                   OR wm.role_title IN ('Club Manager', 'Workspace Manager')
               );`,
            [workspaceId]
        );
        const managerUserIds = new Set<string>(managersRes.rows.map((r: any) => r.user_id));
        if (ownerId) managerUserIds.add(ownerId);
        if (wsManagerId) managerUserIds.add(wsManagerId);

        // 4. Query Departments & Structural Department Leads / Co-leads
        const deptsRes = await query(
            `SELECT 
                wd.id, 
                wd.name, 
                wd.color, 
                wd.lead_user_id AS "leadUserId",
                COALESCE(wd.co_lead_user_ids, '[]'::jsonb) AS "coLeadUserIds",
                wd.display_order AS "displayOrder"
             FROM public.workspace_departments wd
             WHERE wd.workspace_id = $1 AND wd.status = 'active'
             ORDER BY wd.display_order ASC, wd.name ASC;`,
            [workspaceId]
        );

        // Also query secondary junction leads
        const junctionLeadsRes = await query(
            `SELECT department_id AS "departmentId", user_id AS "userId", department_role AS "role"
             FROM public.workspace_department_members
             WHERE workspace_id = $1 AND department_role IN ('lead', 'co_lead');`,
            [workspaceId]
        );

        const structuralLeadIds = new Set<string>();
        // Map: deptId -> { leadUserId?: string, coLeadUserIds: Set<string> }
        const deptLeadsMap = new Map<string, { leadUserId?: string; coLeadUserIds: Set<string> }>();

        for (const dept of deptsRes.rows) {
            const coLeadsSet = new Set<string>();
            if (Array.isArray(dept.coLeadUserIds)) {
                dept.coLeadUserIds.forEach((uid: string) => {
                    coLeadsSet.add(uid);
                    structuralLeadIds.add(uid);
                });
            }
            if (dept.leadUserId) {
                structuralLeadIds.add(dept.leadUserId);
            }
            deptLeadsMap.set(dept.id, {
                leadUserId: dept.leadUserId || undefined,
                coLeadUserIds: coLeadsSet,
            });
        }

        for (const row of junctionLeadsRes.rows) {
            structuralLeadIds.add(row.userId);
            let entry = deptLeadsMap.get(row.departmentId);
            if (!entry) {
                entry = { coLeadUserIds: new Set() };
                deptLeadsMap.set(row.departmentId, entry);
            }
            if (row.role === 'lead' && !entry.leadUserId) {
                entry.leadUserId = row.userId;
            } else {
                entry.coLeadUserIds.add(row.userId);
            }
        }

        // Set of all excluded user IDs from the Contributor Leaderboard:
        // Excludes Club Manager, Workspace Manager, and all structural Department Leads/Co-leads!
        const excludedFromContributor = new Set<string>([...managerUserIds, ...structuralLeadIds]);

        // 5. Query Department Memberships (active, not suspended)
        const activeMembersRes = await query(
            `SELECT
                wm.user_id AS "userId",
                u.firstname,
                u.lastname,
                u.username,
                u.avatar_url AS "avatarUrl",
                r.name AS "roleName",
                COALESCE(wdm.department_id, wm.department_id) AS "departmentId",
                wd.name AS "departmentName",
                wd.color AS "departmentColor"
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             LEFT JOIN public.workspace_department_members wdm ON wdm.member_id = wm.id
             LEFT JOIN public.workspace_departments wd ON wd.id = COALESCE(wdm.department_id, wm.department_id)
             WHERE wm.workspace_id = $1
               AND wm.membership_status = 'active'
               AND wm.is_suspended = false;`,
            [workspaceId]
        );

        // Group active members by department: deptId -> array of userIds
        const deptActiveMembersMap = new Map<string, Set<string>>();
        const userMetaMap = new Map<string, any>();

        for (const m of activeMembersRes.rows) {
            userMetaMap.set(m.userId, {
                userId: m.userId,
                name: `${m.firstname || ''} ${m.lastname || ''}`.trim() || m.username,
                username: m.username,
                avatarUrl: m.avatarUrl || undefined,
                roleName: m.roleName,
                departmentId: m.departmentId || undefined,
                departmentName: m.departmentName || undefined,
                departmentColor: m.departmentColor || undefined,
            });

            if (m.departmentId) {
                if (!deptActiveMembersMap.has(m.departmentId)) {
                    deptActiveMembersMap.set(m.departmentId, new Set());
                }
                deptActiveMembersMap.get(m.departmentId)!.add(m.userId);
            }
        }

        // 6. Query Recognition Ledger for Current & Previous Periods
        // Period time filter helpers
        let currentPeriodLedgerFilter = "";
        const currentPeriodLedgerParams: any[] = [workspaceId];
        if (start && end) {
            currentPeriodLedgerParams.push(start.toISOString(), end.toISOString());
            currentPeriodLedgerFilter = ` AND wrl.created_at >= $2 AND wrl.created_at <= $3`;
        }

        const currentLedgerRes = await query(
            `SELECT
                wrl.recipient_id AS "recipientId",
                COALESCE(wrl.department_id, wm.department_id) AS "departmentId",
                wrl.category_id AS "categoryId",
                wrc.slug AS "categorySlug",
                wrc.name AS "categoryName",
                wrc.icon AS "categoryIcon",
                SUM(wrl.points_delta)::integer AS "totalPoints",
                COUNT(wrl.id)::integer AS "awardsCount",
                MAX(wrl.created_at) AS "lastAwardAt"
             FROM public.workspace_recognition_ledger wrl
             JOIN public.workspace_recognition_categories wrc ON wrc.id = wrl.category_id
             LEFT JOIN public.workspace_members wm ON wm.workspace_id = wrl.workspace_id AND wm.user_id = wrl.recipient_id
             WHERE wrl.workspace_id = $1
               AND wrl.is_reversed = false
               AND wrl.transaction_type = 'award'
               ${currentPeriodLedgerFilter}
             GROUP BY wrl.recipient_id, COALESCE(wrl.department_id, wm.department_id), wrl.category_id, wrc.slug, wrc.name, wrc.icon;`,
            currentPeriodLedgerParams
        );

        // Previous period ledger for trend
        let prevPeriodLedgerFilter = "";
        const prevPeriodLedgerParams: any[] = [workspaceId];
        if (prevStart && prevEnd) {
            prevPeriodLedgerParams.push(prevStart.toISOString(), prevEnd.toISOString());
            prevPeriodLedgerFilter = ` AND wrl.created_at >= $2 AND wrl.created_at <= $3`;
        }

        let prevLedgerRows: any[] = [];
        if (prevStart && prevEnd) {
            const prevRes = await query(
                `SELECT
                    wrl.recipient_id AS "recipientId",
                    SUM(wrl.points_delta)::integer AS "totalPoints"
                 FROM public.workspace_recognition_ledger wrl
                 WHERE wrl.workspace_id = $1
                   AND wrl.is_reversed = false
                   AND wrl.transaction_type = 'award'
                   ${prevPeriodLedgerFilter}
                 GROUP BY wrl.recipient_id;`,
                prevPeriodLedgerParams
            );
            prevLedgerRows = prevRes.rows;
        }

        // Map previous period user points and ranks for contributors
        const prevUserPointsMap = new Map<string, number>();
        for (const row of prevLedgerRows) {
            prevUserPointsMap.set(row.recipientId, parseInt(row.totalPoints, 10) || 0);
        }

        // Compute previous ranks for contributors
        const prevEligibleContribs = Array.from(prevUserPointsMap.entries())
            .filter(([uid]) => !excludedFromContributor.has(uid))
            .sort((a, b) => b[1] - a[1]);
        const prevUserRankMap = new Map<string, number>();
        let prevRankCursor = 1;
        for (let i = 0; i < prevEligibleContribs.length; i++) {
            if (i > 0 && prevEligibleContribs[i][1] < prevEligibleContribs[i - 1][1]) {
                prevRankCursor = i + 1;
            }
            prevUserRankMap.set(prevEligibleContribs[i][0], prevRankCursor);
        }

        // 7. BUILD CONTRIBUTOR LEADERBOARD
        // Aggregate ledger data by recipient
        interface ContribAgg {
            userId: string;
            orbitsEarned: number;
            awardsCount: number;
            lastAwardAt: string | null;
            categoryBreakdown: Record<string, { name: string; count: number; points: number; icon: string }>;
        }
        const contribAggMap = new Map<string, ContribAgg>();

        for (const row of currentLedgerRes.rows) {
            const uid = row.recipientId;
            if (excludedFromContributor.has(uid)) continue; // Must be strictly non-lead, non-manager

            if (!contribAggMap.has(uid)) {
                contribAggMap.set(uid, {
                    userId: uid,
                    orbitsEarned: 0,
                    awardsCount: 0,
                    lastAwardAt: null,
                    categoryBreakdown: {},
                });
            }
            const agg = contribAggMap.get(uid)!;
            const pts = parseInt(row.totalPoints, 10) || 0;
            const cnt = parseInt(row.awardsCount, 10) || 0;
            agg.orbitsEarned += pts;
            agg.awardsCount += cnt;
            if (!agg.lastAwardAt || new Date(row.lastAwardAt) > new Date(agg.lastAwardAt)) {
                agg.lastAwardAt = row.lastAwardAt;
            }
            agg.categoryBreakdown[row.categorySlug] = {
                name: row.categoryName,
                count: cnt,
                points: pts,
                icon: row.categoryIcon || "Award",
            };
        }

        // Filter and sort contributors
        let rawContributors: ContributorLeaderboardEntry[] = [];
        for (const [uid, agg] of contribAggMap.entries()) {
            const meta = userMetaMap.get(uid);
            if (!meta) continue;

            // Optional department filter
            if (options.departmentId && meta.departmentId !== options.departmentId) {
                continue;
            }

            // Trend
            const prevPts = prevUserPointsMap.get(uid) ?? null;
            const prevRnk = prevUserRankMap.get(uid) ?? null;
            let rankChange: number | "new" = "new";
            let pointsDelta = 0;
            let direction: "up" | "down" | "same" | "new" = "new";

            if (period === "all_time") {
                rankChange = 0;
                pointsDelta = 0;
                direction = "same";
            } else if (prevPts !== null) {
                pointsDelta = agg.orbitsEarned - prevPts;
                direction = pointsDelta > 0 ? "up" : pointsDelta < 0 ? "down" : "same";
            }

            rawContributors.push({
                rank: 1,
                userId: uid,
                name: meta.name,
                username: meta.username,
                avatarUrl: meta.avatarUrl,
                departmentId: meta.departmentId,
                departmentName: meta.departmentName,
                departmentColor: meta.departmentColor,
                roleName: meta.roleName,
                orbitsEarned: agg.orbitsEarned,
                awardsCount: agg.awardsCount,
                categoryBreakdown: agg.categoryBreakdown,
                trend: {
                    rankChange,
                    pointsDelta,
                    direction,
                },
            });
        }

        // Secondary deterministic sort: orbitsEarned DESC, lastAwardAt ASC, username ASC
        rawContributors.sort((a, b) => {
            if (b.orbitsEarned !== a.orbitsEarned) return b.orbitsEarned - a.orbitsEarned;
            return a.username.localeCompare(b.username);
        });

        // Competition ranking: 1st, 1st, 3rd (shared ranks for ties)
        let cRank = 1;
        for (let i = 0; i < rawContributors.length; i++) {
            if (i > 0 && rawContributors[i].orbitsEarned < rawContributors[i - 1].orbitsEarned) {
                cRank = i + 1;
            }
            rawContributors[i].rank = cRank;
            // Update rankChange now that current rank is assigned
            if (period !== "all_time" && rawContributors[i].trend.rankChange !== "new") {
                const prevRnk = prevUserRankMap.get(rawContributors[i].userId);
                if (prevRnk !== undefined) {
                    rawContributors[i].trend.rankChange = prevRnk - cRank;
                }
            }
        }

        // 8. DEPARTMENT LEADERBOARD & DEPARTMENT PERFORMANCE INDEX (DPI)
        // Query tasks in workspace (excluding cancelled and archived tasks)
        let tasksTimeFilter = "";
        const tasksParams: any[] = [workspaceId];
        if (start && end) {
            tasksParams.push(start.toISOString(), end.toISOString());
            tasksTimeFilter = ` AND (
                (wt.due_date >= $2 AND wt.due_date <= $3) OR
                (wt.completed_at >= $2 AND wt.completed_at <= $3) OR
                (wt.created_at >= $2 AND wt.created_at <= $3)
            )`;
        }

        const deptTasksRes = await query(
            `SELECT
                wt.id,
                wt.department_id AS "departmentId",
                wt.status,
                wt.due_date AS "dueDate",
                wt.completed_at AS "completedAt",
                COALESCE((wt.custom_fields->>'is_blocked')::boolean, false) AS "isBlocked",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_reviews wtr 
                    WHERE wtr.task_id = wt.id AND wtr.decision = 'approved'
                ) AS "hasApprovedReview",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_submissions wts 
                    WHERE wts.task_id = wt.id AND (wt.due_date IS NULL OR wts.created_at <= wt.due_date)
                ) AS "hasOnTimeSubmission"
             FROM public.workspace_tasks wt
             WHERE wt.workspace_id = $1
               AND wt.is_archived = false
               AND wt.status != 'cancelled'
               AND wt.department_id IS NOT NULL
               ${tasksTimeFilter};`,
            tasksParams
        );

        // Group tasks by departmentId
        const deptTasksMap = new Map<string, any[]>();
        for (const t of deptTasksRes.rows) {
            if (!deptTasksMap.has(t.departmentId)) {
                deptTasksMap.set(t.departmentId, []);
            }
            deptTasksMap.get(t.departmentId)!.push(t);
        }

        // Query active participation contributions per department in the period
        // (submissions, reviews, comments, and received awards)
        let subTimeFilter = "";
        let revTimeFilter = "";
        let commTimeFilter = "";
        const participationParams: any[] = [workspaceId];
        if (start && end) {
            participationParams.push(start.toISOString(), end.toISOString());
            subTimeFilter = ` AND wts.created_at >= $2 AND wts.created_at <= $3`;
            revTimeFilter = ` AND wtr.created_at >= $2 AND wtr.created_at <= $3`;
            commTimeFilter = ` AND wtc.created_at >= $2 AND wtc.created_at <= $3`;
        }

        const contribSubmissionsRes = await query(
            `SELECT DISTINCT wt.department_id AS "departmentId", wts.submitted_by AS "userId"
             FROM public.workspace_task_submissions wts
             JOIN public.workspace_tasks wt ON wt.id = wts.task_id
             WHERE wts.workspace_id = $1 ${subTimeFilter};`,
            participationParams
        );

        const contribReviewsRes = await query(
            `SELECT DISTINCT wt.department_id AS "departmentId", wtr.reviewer_id AS "userId"
             FROM public.workspace_task_reviews wtr
             JOIN public.workspace_tasks wt ON wt.id = wtr.task_id
             WHERE wtr.workspace_id = $1 ${revTimeFilter};`,
            participationParams
        );

        const contribCommentsRes = await query(
            `SELECT DISTINCT wt.department_id AS "departmentId", wtc.author_id AS "userId"
             FROM public.workspace_task_comments wtc
             JOIN public.workspace_tasks wt ON wt.id = wtc.task_id
             WHERE wtc.workspace_id = $1 ${commTimeFilter};`,
            participationParams
        );

        // Map departmentId -> Set of participating user IDs
        const deptParticipatingUsersMap = new Map<string, Set<string>>();
        const registerParticipant = (deptId: string, uid: string) => {
            if (!deptId || !uid) return;
            if (!deptParticipatingUsersMap.has(deptId)) {
                deptParticipatingUsersMap.set(deptId, new Set());
            }
            deptParticipatingUsersMap.get(deptId)!.add(uid);
        };

        contribSubmissionsRes.rows.forEach((r: any) => registerParticipant(r.departmentId, r.userId));
        contribReviewsRes.rows.forEach((r: any) => registerParticipant(r.departmentId, r.userId));
        contribCommentsRes.rows.forEach((r: any) => registerParticipant(r.departmentId, r.userId));

        // Also add awards received in this department as verified participation
        for (const row of currentLedgerRes.rows) {
            if (row.departmentId && row.recipientId) {
                registerParticipant(row.departmentId, row.recipientId);
            }
        }

        // Aggregate Department DPIs
        const rawDeptEntries: DepartmentLeaderboardEntry[] = [];
        const deptDpiMap = new Map<string, { dpi: number | null; hasSufficientData: boolean; deliveryStats: any }>();

        for (const dept of deptsRes.rows) {
            const deptId = dept.id;
            const activeMemberIds = deptActiveMembersMap.get(deptId) || new Set<string>();
            const activeMemberCount = activeMemberIds.size;

            const tasks = deptTasksMap.get(deptId) || [];
            const tasksDue = tasks.length;
            const tasksBlocked = tasks.filter((t: any) => t.isBlocked).length;

            const approvedTasks = tasks.filter((t: any) => t.status === 'completed' || t.hasApprovedReview);
            const tasksApproved = approvedTasks.length;

            const onTimeTasks = approvedTasks.filter((t: any) => {
                if (!t.dueDate) return true;
                if (t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)) return true;
                return t.hasOnTimeSubmission;
            });
            const tasksOnTime = onTimeTasks.length;

            // Participating members from active department members
            const allDeptParticipants = deptParticipatingUsersMap.get(deptId) || new Set<string>();
            let participatingCount = 0;
            for (const uid of activeMemberIds) {
                if (allDeptParticipants.has(uid)) {
                    participatingCount++;
                }
            }

            // Department Orbits in period
            let totalDeptOrbits = 0;
            for (const row of currentLedgerRes.rows) {
                if (row.departmentId === deptId || activeMemberIds.has(row.recipientId)) {
                    totalDeptOrbits += parseInt(row.totalPoints, 10) || 0;
                }
            }

            const rawOrbitsPerMember = activeMemberCount > 0
                ? Math.round((totalDeptOrbits / activeMemberCount) * 10) / 10
                : 0;
            const cappedOrbitsPerMember = Math.min(rawOrbitsPerMember, capPerMember);
            const normalizedRecognitionScore = Math.min(
                100,
                Math.round((cappedOrbitsPerMember / capPerMember) * 1000) / 10
            );

            // Sufficient data safeguards
            let hasSufficientData = true;
            let insufficientDataReason: string | undefined = undefined;

            if (tasksDue < minTasksSample && activeMemberCount === 0) {
                hasSufficientData = false;
                insufficientDataReason = "No tasks or active members in selected period";
            } else if (tasksDue < minTasksSample) {
                hasSufficientData = false;
                insufficientDataReason = "Insufficient task activity in selected period";
            }

            let approvedTaskDeliveryRate = 0;
            let onTimeDeliveryRate = 0;
            let activeParticipationRate = 0;
            let dpi: number | null = null;

            if (hasSufficientData) {
                approvedTaskDeliveryRate = Math.min(
                    100,
                    Math.round((tasksApproved / tasksDue) * 1000) / 10
                );
                onTimeDeliveryRate = tasksApproved > 0
                    ? Math.min(100, Math.round((tasksOnTime / tasksApproved) * 1000) / 10)
                    : 100;
                activeParticipationRate = activeMemberCount > 0
                    ? Math.min(100, Math.round((participatingCount / activeMemberCount) * 1000) / 10)
                    : 0;

                const totalWeight = wApproved + wOnTime + wParticipation + wRecognition;
                dpi = Math.round(
                    ((wApproved * approvedTaskDeliveryRate +
                      wOnTime * onTimeDeliveryRate +
                      wParticipation * activeParticipationRate +
                      wRecognition * normalizedRecognitionScore) /
                     totalWeight) * 10
                ) / 10;
            }

            // Save stats for lead board
            deptDpiMap.set(deptId, {
                dpi,
                hasSufficientData,
                deliveryStats: {
                    tasksDue,
                    tasksApproved,
                    approvedTaskDeliveryRate,
                    tasksOnTime,
                    onTimeDeliveryRate,
                    totalActiveMembers: activeMemberCount,
                    participatingMembers: participatingCount,
                    participationRate: activeParticipationRate,
                    rawOrbitsPerMember,
                    normalizedRecognitionScore,
                },
            });

            // Co-lead metadata
            const leadsInfo = deptLeadsMap.get(deptId);
            const leadUser = leadsInfo?.leadUserId ? userMetaMap.get(leadsInfo.leadUserId) : null;
            const coLeadUsers = leadsInfo?.coLeadUserIds
                ? Array.from(leadsInfo.coLeadUserIds).map(uid => userMetaMap.get(uid)).filter(Boolean)
                : [];

            rawDeptEntries.push({
                rank: 1,
                departmentId: dept.id,
                departmentName: dept.name,
                departmentColor: dept.color,
                leadUser: leadUser ? {
                    id: leadUser.userId,
                    name: leadUser.name,
                    username: leadUser.username,
                    avatarUrl: leadUser.avatarUrl,
                } : null,
                coLeadUsers: coLeadUsers.map((cl: any) => ({
                    id: cl.userId,
                    name: cl.name,
                    username: cl.username,
                    avatarUrl: cl.avatarUrl,
                })),
                departmentPerformanceIndex: dpi,
                hasSufficientData,
                insufficientDataReason,
                approvedTaskDeliveryRate,
                onTimeDeliveryRate,
                activeParticipationRate,
                normalizedRecognitionScore,
                metrics: {
                    tasksDue,
                    tasksApproved,
                    tasksOnTime,
                    tasksBlocked,
                    activeMemberCount,
                    participatingMemberCount: participatingCount,
                    totalDepartmentOrbits: totalDeptOrbits,
                    rawOrbitsPerMember,
                    cappedOrbitsPerMember,
                },
                formulaVersion,
                weightsUsed: weights,
                trend: {
                    rankChange: "new",
                    dpiDelta: 0,
                    direction: "same",
                },
            });
        }

        // Sort departments: sufficient data first by DPI DESC, then name ASC; insufficient data placed last
        const sufficientDepts = rawDeptEntries.filter(d => d.hasSufficientData);
        const insufficientDepts = rawDeptEntries.filter(d => !d.hasSufficientData);

        sufficientDepts.sort((a, b) => {
            if ((b.departmentPerformanceIndex ?? 0) !== (a.departmentPerformanceIndex ?? 0)) {
                return (b.departmentPerformanceIndex ?? 0) - (a.departmentPerformanceIndex ?? 0);
            }
            if (b.metrics.tasksApproved !== a.metrics.tasksApproved) {
                return b.metrics.tasksApproved - a.metrics.tasksApproved;
            }
            return a.departmentName.localeCompare(b.departmentName);
        });

        // Competition rank: 1st, 1st, 3rd
        let dRank = 1;
        for (let i = 0; i < sufficientDepts.length; i++) {
            if (i > 0 && (sufficientDepts[i].departmentPerformanceIndex ?? 0) < (sufficientDepts[i - 1].departmentPerformanceIndex ?? 0)) {
                dRank = i + 1;
            }
            sufficientDepts[i].rank = dRank;
        }

        // Insufficient data departments remain unranked (rank: 0) so they aren't humiliated
        insufficientDepts.forEach(d => { d.rank = 0; });
        const finalDepartments = [...sufficientDepts, ...insufficientDepts];

        // 9. DEPARTMENT LEAD LEADERBOARD
        // Rank leads by their department's Department Performance Index (DPI)
        const rawLeads: DepartmentLeadLeaderboardEntry[] = [];

        for (const dept of deptsRes.rows) {
            const deptId = dept.id;
            const dpiInfo = deptDpiMap.get(deptId);
            const leadsInfo = deptLeadsMap.get(deptId);
            if (!leadsInfo) continue;

            const leadIdsInDept: Array<{ userId: string; isCoLead: boolean }> = [];
            if (leadsInfo.leadUserId) {
                leadIdsInDept.push({ userId: leadsInfo.leadUserId, isCoLead: false });
            }
            for (const coLeadId of leadsInfo.coLeadUserIds) {
                if (coLeadId !== leadsInfo.leadUserId) {
                    leadIdsInDept.push({ userId: coLeadId, isCoLead: true });
                }
            }

            for (const { userId: leadUid, isCoLead } of leadIdsInDept) {
                const meta = userMetaMap.get(leadUid);
                if (!meta) continue;

                // Lead's personally earned Orbits in period
                let leadPersonalOrbits = 0;
                for (const row of currentLedgerRes.rows) {
                    if (row.recipientId === leadUid) {
                        leadPersonalOrbits += parseInt(row.totalPoints, 10) || 0;
                    }
                }

                // Identify other co-leads of the shared department
                const otherCoLeads = leadIdsInDept
                    .filter(l => l.userId !== leadUid)
                    .map(l => {
                        const m = userMetaMap.get(l.userId);
                        return m ? { userId: m.userId, name: m.name, username: m.username } : null;
                    })
                    .filter(Boolean) as Array<{ userId: string; name: string; username: string }>;

                rawLeads.push({
                    rank: 1,
                    userId: leadUid,
                    name: meta.name,
                    username: meta.username,
                    avatarUrl: meta.avatarUrl,
                    roleName: isCoLead ? "Co-Lead" : "Lead",
                    isCoLead,
                    coLeads: otherCoLeads.length > 0 ? otherCoLeads : undefined,
                    departmentId: dept.id,
                    departmentName: dept.name,
                    departmentColor: dept.color,
                    leadPersonalOrbits,
                    departmentPerformanceIndex: dpiInfo?.dpi ?? null,
                    hasSufficientData: dpiInfo?.hasSufficientData ?? false,
                    insufficientDataReason: dpiInfo?.hasSufficientData ? undefined : "Insufficient department activity in selected period",
                    deliveryStatistics: dpiInfo?.deliveryStats || {
                        tasksDue: 0,
                        tasksApproved: 0,
                        approvedTaskDeliveryRate: 0,
                        tasksOnTime: 0,
                        onTimeDeliveryRate: 100,
                        totalActiveMembers: 0,
                        participatingMembers: 0,
                        participationRate: 0,
                        rawOrbitsPerMember: 0,
                        normalizedRecognitionScore: 0,
                    },
                    trend: {
                        rankChange: "new",
                        dpiDelta: 0,
                        direction: "same",
                    },
                });
            }
        }

        // Sort leads: sufficient data first by departmentPerformanceIndex DESC, personal Orbits DESC, username ASC
        const sufficientLeads = rawLeads.filter(l => l.hasSufficientData);
        const insufficientLeads = rawLeads.filter(l => !l.hasSufficientData);

        sufficientLeads.sort((a, b) => {
            if ((b.departmentPerformanceIndex ?? 0) !== (a.departmentPerformanceIndex ?? 0)) {
                return (b.departmentPerformanceIndex ?? 0) - (a.departmentPerformanceIndex ?? 0);
            }
            if (b.leadPersonalOrbits !== a.leadPersonalOrbits) {
                return b.leadPersonalOrbits - a.leadPersonalOrbits;
            }
            return a.username.localeCompare(b.username);
        });

        // Competition rank for leads: 1st, 1st, 3rd
        let lRank = 1;
        for (let i = 0; i < sufficientLeads.length; i++) {
            if (i > 0 && (sufficientLeads[i].departmentPerformanceIndex ?? 0) < (sufficientLeads[i - 1].departmentPerformanceIndex ?? 0)) {
                lRank = i + 1;
            }
            sufficientLeads[i].rank = lRank;
        }

        insufficientLeads.forEach(l => { l.rank = 0; });
        const finalLeads = [...sufficientLeads, ...insufficientLeads];

        // 10. CURRENT MEMBER POSITION
        let currentMemberPosition: ThreeLeaderboardsResponse["currentMemberPosition"] = undefined;
        if (options.currentUserId) {
            const currentUid = options.currentUserId;
            if (managerUserIds.has(currentUid)) {
                currentMemberPosition = { type: "excluded_manager" };
            } else if (structuralLeadIds.has(currentUid)) {
                const leadEntry = finalLeads.find(l => l.userId === currentUid);
                if (leadEntry) {
                    currentMemberPosition = {
                        type: "lead",
                        rank: leadEntry.rank,
                        orbits: leadEntry.leadPersonalOrbits,
                        departmentName: leadEntry.departmentName,
                        dpi: leadEntry.departmentPerformanceIndex,
                    };
                }
            } else {
                const contribEntry = rawContributors.find(c => c.userId === currentUid);
                if (contribEntry) {
                    currentMemberPosition = {
                        type: "contributor",
                        rank: contribEntry.rank,
                        orbits: contribEntry.orbitsEarned,
                        departmentName: contribEntry.departmentName,
                    };
                }
            }
        }

        return {
            period,
            periodStart: start ? start.toISOString() : null,
            periodEnd: end ? end.toISOString() : null,
            currentMemberPosition,
            contributors: rawContributors,
            leads: finalLeads,
            departments: finalDepartments,
            formulaVersion,
            weights,
        };
    }

    // =========================================================================
    // 17. PHASE 06: TEAM & INDIVIDUAL ANALYTICS ENGINE
    // =========================================================================

    /**
     * Generates comprehensive workspace-wide and department comparative analytics.
     */
    static async getComprehensiveWorkspaceAnalytics(
        workspaceId: string,
        options: {
            period?: LeaderboardPeriod;
            departmentId?: string;
        } = {}
    ): Promise<WorkspaceAnalyticsSummary> {
        const period: LeaderboardPeriod = options.period || "this_month";

        // 1. Resolve period boundaries
        const resolvePeriodBoundaries = (p: LeaderboardPeriod) => {
            const now = new Date();
            if (p === "all_time") {
                return { start: null, end: null };
            }
            if (p === "this_week") {
                const d = new Date(now);
                const day = d.getUTCDay();
                const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
                const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff, 0, 0, 0, 0));
                const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff + 6, 23, 59, 59, 999));
                return { start, end };
            }
            if (p === "this_month") {
                const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
                const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));
                return { start, end };
            }
            if (p === "last_30_days") {
                const end = now;
                const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                return { start, end };
            }
            if (p === "last_90_days") {
                const end = now;
                const start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                return { start, end };
            }
            return { start: null, end: null };
        };

        const { start, end } = resolvePeriodBoundaries(period);

        // 2. Query Total Orbits Awarded & Received
        let ledgerTimeFilter = "";
        const ledgerParams: any[] = [workspaceId];
        if (start && end) {
            ledgerParams.push(start.toISOString(), end.toISOString());
            ledgerTimeFilter = ` AND created_at >= $2 AND created_at <= $3`;
        }

        const totalsRes = await query(
            `SELECT
                COALESCE(SUM(points_delta) FILTER (WHERE points_delta > 0), 0)::integer AS "totalAwarded",
                COALESCE(SUM(points_delta) FILTER (WHERE points_delta > 0), 0)::integer AS "totalReceived",
                COUNT(DISTINCT recipient_id)::integer AS "activeRecipients",
                COUNT(DISTINCT issuer_id)::integer AS "activeIssuers"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND is_reversed = false AND transaction_type = 'award' ${ledgerTimeFilter};`,
            ledgerParams
        );
        const totalOrbitsAwarded = totalsRes.rows[0]?.totalAwarded || 0;
        const totalOrbitsReceived = totalsRes.rows[0]?.totalReceived || 0;

        // 3. Query Tasks in Workspace (evaluating approved count and on-time rate)
        let tasksTimeFilter = "";
        const tasksParams: any[] = [workspaceId];
        if (start && end) {
            tasksParams.push(start.toISOString(), end.toISOString());
            tasksTimeFilter = ` AND (
                (wt.due_date >= $2 AND wt.due_date <= $3) OR
                (wt.completed_at >= $2 AND wt.completed_at <= $3) OR
                (wt.created_at >= $2 AND wt.created_at <= $3)
            )`;
        }

        const tasksRes = await query(
            `SELECT
                wt.id,
                wt.department_id AS "departmentId",
                wt.status,
                wt.due_date AS "dueDate",
                wt.completed_at AS "completedAt",
                COALESCE((wt.custom_fields->>'is_blocked')::boolean, false) AS "isBlocked",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_reviews wtr 
                    WHERE wtr.task_id = wt.id AND wtr.decision = 'approved'
                ) AS "hasApprovedReview",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_submissions wts 
                    WHERE wts.task_id = wt.id AND (wt.due_date IS NULL OR wts.created_at <= wt.due_date)
                ) AS "hasOnTimeSubmission"
             FROM public.workspace_tasks wt
             WHERE wt.workspace_id = $1
               AND wt.is_archived = false
               AND wt.status != 'cancelled'
               ${tasksTimeFilter};`,
            tasksParams
        );

        const allTasks = tasksRes.rows;
        const approvedTasks = allTasks.filter((t: any) => t.status === "completed" || t.hasApprovedReview);
        const totalApprovedTasks = approvedTasks.length;

        let onTimeCount = 0;
        approvedTasks.forEach((t: any) => {
            if (!t.dueDate) onTimeCount++;
            else if (t.completedAt && new Date(t.completedAt) <= new Date(t.dueDate)) onTimeCount++;
            else if (t.hasOnTimeSubmission) onTimeCount++;
        });
        const onTimeCompletionRate = totalApprovedTasks > 0
            ? Math.round((onTimeCount / totalApprovedTasks) * 1000) / 10
            : 100;

        // 4. Query Active Contributors
        // Members who either received an award OR submitted/completed a task in the period
        const activeSubmissionsRes = await query(
            `SELECT DISTINCT wts.submitted_by AS "userId"
             FROM public.workspace_task_submissions wts
             WHERE wts.workspace_id = $1 ${ledgerTimeFilter};`,
            ledgerParams
        );
        const activeContributorSet = new Set<string>();
        activeSubmissionsRes.rows.forEach((r: any) => activeContributorSet.add(r.userId));

        const activeAwardeesRes = await query(
            `SELECT DISTINCT recipient_id AS "userId"
             FROM public.workspace_recognition_ledger
             WHERE workspace_id = $1 AND is_reversed = false AND transaction_type = 'award' ${ledgerTimeFilter};`,
            ledgerParams
        );
        activeAwardeesRes.rows.forEach((r: any) => activeContributorSet.add(r.userId));
        const activeContributors = activeContributorSet.size;

        // 5. Historical Contribution Trends (4 chronological sub-intervals)
        const contributionTrends: WorkspaceAnalyticsSummary["contributionTrends"] = [];
        const numIntervals = 4;
        const now = new Date();
        const intervalDurationMs = start && end
            ? Math.max(1, (end.getTime() - start.getTime()) / numIntervals)
            : (30 * 24 * 60 * 60 * 1000) / numIntervals;
        const baselineStart = start ? start.getTime() : now.getTime() - 30 * 24 * 60 * 60 * 1000;

        for (let i = 0; i < numIntervals; i++) {
            const intStart = new Date(baselineStart + i * intervalDurationMs);
            const intEnd = new Date(baselineStart + (i + 1) * intervalDurationMs);
            const label = `Period ${i + 1} (${intStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })})`;

            const intLedgerRes = await query(
                `SELECT COALESCE(SUM(points_delta), 0)::integer AS "orbits"
                 FROM public.workspace_recognition_ledger
                 WHERE workspace_id = $1 AND is_reversed = false AND transaction_type = 'award'
                   AND created_at >= $2 AND created_at <= $3;`,
                [workspaceId, intStart.toISOString(), intEnd.toISOString()]
            );

            const intTasksRes = await query(
                `SELECT COUNT(wt.id)::integer AS "tasksApproved"
                 FROM public.workspace_tasks wt
                 WHERE wt.workspace_id = $1 AND wt.is_archived = false AND wt.status != 'cancelled'
                   AND (wt.status = 'completed' OR EXISTS (SELECT 1 FROM public.workspace_task_reviews wtr WHERE wtr.task_id = wt.id AND wtr.decision = 'approved'))
                   AND ((wt.completed_at >= $2 AND wt.completed_at <= $3) OR (wt.created_at >= $2 AND wt.created_at <= $3));`,
                [workspaceId, intStart.toISOString(), intEnd.toISOString()]
            );

            contributionTrends.push({
                periodLabel: label,
                orbits: intLedgerRes.rows[0]?.orbits || 0,
                tasksApproved: intTasksRes.rows[0]?.tasksApproved || 0,
            });
        }

        // 6. Leverage ThreeLeaderboards calculation for Department & Leadership Analytics
        const leaderboardsData = await this.getThreeLeaderboards(workspaceId, { period });

        // Build Department Comparison with Normalized Metrics
        const departmentComparison: WorkspaceAnalyticsSummary["departmentComparison"] = [];
        for (const d of leaderboardsData.departments) {
            const overdueTasks = allTasks.filter(
                (t: any) => t.departmentId === d.departmentId && t.status !== "completed" && t.dueDate && new Date(t.dueDate) < now
            ).length;

            departmentComparison.push({
                departmentId: d.departmentId,
                departmentName: d.departmentName,
                color: d.departmentColor,
                memberCount: d.metrics.activeMemberCount,
                activeContributors: d.metrics.participatingMemberCount,
                dpi: d.departmentPerformanceIndex,
                hasSufficientData: d.hasSufficientData,
                insufficientDataReason: d.insufficientDataReason,
                approvedTaskDeliveryRate: d.approvedTaskDeliveryRate,
                onTimeDeliveryRate: d.onTimeDeliveryRate,
                tasksAssigned: d.metrics.tasksDue,
                tasksCompleted: d.metrics.tasksApproved,
                approvedSubmissions: d.metrics.tasksApproved,
                overdueTasks,
                totalOrbits: d.metrics.totalDepartmentOrbits,
                orbitsPerMember: d.metrics.rawOrbitsPerMember,
            });
        }

        // 7. Recognition Distribution & Bias/Overconcentration Detection
        const catRes = await query(
            `SELECT
                rc.name AS "name",
                rc.slug AS "slug",
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "points",
                COUNT(wrl.id)::integer AS "count"
             FROM public.workspace_recognition_categories rc
             LEFT JOIN public.workspace_recognition_ledger wrl 
                ON wrl.category_id = rc.id AND wrl.workspace_id = $1 AND wrl.transaction_type = 'award' AND wrl.is_reversed = false ${ledgerTimeFilter.replace(/created_at/g, 'wrl.created_at')}
             WHERE rc.workspace_id = $1 AND rc.is_active = true
             GROUP BY rc.id, rc.name, rc.slug
             ORDER BY "points" DESC;`,
            ledgerParams
        );

        const totalCatPoints = catRes.rows.reduce((sum: number, r: any) => sum + r.points, 0) || 1;
        const categoriesDistribution = catRes.rows.map((r: any) => ({
            name: r.name,
            slug: r.slug,
            points: r.points,
            count: r.count,
            percentage: Math.round((r.points / totalCatPoints) * 1000) / 10,
        }));

        const totalDeptPoints = departmentComparison.reduce((sum, d) => sum + d.totalOrbits, 0) || 1;
        const departmentsDistribution = departmentComparison.map((d) => ({
            departmentName: d.departmentName,
            points: d.totalOrbits,
            percentage: Math.round((d.totalOrbits / totalDeptPoints) * 1000) / 10,
        }));

        // Detect potential overconcentration for human review (never punitive)
        let overconcentrationAlert: string | null = null;
        const fairnessAlerts: NonNullable<WorkspaceAnalyticsSummary["fairnessAlerts"]> = [];

        const highestDept = departmentsDistribution.find((d) => d.percentage >= 60 && d.points > 20);
        if (highestDept) {
            overconcentrationAlert = `Notice for human review: Recognition is heavily concentrated in ${highestDept.departmentName} (${highestDept.percentage}% of all awarded points in this period). Review recognition balance across other departments.`;
            fairnessAlerts.push({
                type: "department_concentration",
                title: "Department Concentration Notice",
                detail: `Recognition is heavily concentrated in ${highestDept.departmentName} (${highestDept.percentage}% of points in this period). Review to ensure balanced recognition across departments.`,
                severity: "info",
            });
        }

        // Recipient concentration check
        const topContributor = leaderboardsData.contributors[0];
        if (topContributor && topContributor.orbitsEarned > 50 && totalOrbitsAwarded > 100) {
            const recipientRatio = Math.round((topContributor.orbitsEarned / totalOrbitsAwarded) * 100);
            if (recipientRatio >= 40) {
                fairnessAlerts.push({
                    type: "recipient_concentration",
                    title: "Recipient Concentration Notice",
                    detail: `Top contributor (${topContributor.name}) received ${recipientRatio}% of all awarded points in this period. Review to ensure appreciation is distributed across all contributors.`,
                    severity: "info",
                });
            }
        }

        // 8. Manager Award Activity & Budget Utilization
        const managerActivityRes = await query(
            `SELECT
                u.id AS "managerId",
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                r.name AS "roleTitle",
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "totalOrbitsAwarded",
                COUNT(wrl.id)::integer AS "awardCount",
                COALESCE(wrb.allocated_budget, 500)::integer AS "monthlyBudget",
                COALESCE(wrb.used_budget, 0)::integer AS "budgetUsed"
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             LEFT JOIN public.workspace_recognition_ledger wrl 
                ON wrl.issuer_id = u.id AND wrl.workspace_id = $1 AND wrl.transaction_type = 'award' AND wrl.is_reversed = false ${ledgerTimeFilter.replace(/created_at/g, 'wrl.created_at')}
             LEFT JOIN public.workspace_recognition_budgets wrb 
                ON wrb.user_id = u.id AND wrb.workspace_id = $1 AND wrb.year_month = TO_CHAR(NOW(), 'YYYY-MM')
             WHERE wm.workspace_id = $1
               AND (
                   r.slug IN ('admin', 'manager', 'owner', 'workspace_manager', 'club_manager')
                   OR wm.role_title IN ('Workspace Manager', 'Club Manager')
                   OR wrb.allocated_budget IS NOT NULL
                   OR wrl.id IS NOT NULL
               )
             GROUP BY u.id, u.firstname, u.lastname, u.username, u.avatar_url, r.name, wrb.allocated_budget, wrb.used_budget
             ORDER BY "totalOrbitsAwarded" DESC, "name" ASC;`,
            ledgerParams
        );

        const managerAwardActivity: WorkspaceAnalyticsSummary["managerAwardActivity"] = managerActivityRes.rows.map(
            (r: any) => ({
                managerId: r.managerId,
                name: r.name || r.username,
                username: r.username,
                avatarUrl: r.avatarUrl || undefined,
                roleTitle: r.roleTitle,
                totalOrbitsAwarded: r.totalOrbitsAwarded,
                awardCount: r.awardCount,
                monthlyBudget: r.monthlyBudget,
                budgetUsed: r.budgetUsed,
            })
        );

        // Manager award dominance check
        const totalMgrAwards = managerAwardActivity.reduce((sum, m) => sum + m.awardCount, 0);
        if (totalMgrAwards >= 10) {
            const dominantMgr = managerAwardActivity.find((m) => (m.awardCount / totalMgrAwards) >= 0.85);
            if (dominantMgr) {
                fairnessAlerts.push({
                    type: "manager_dominance",
                    title: "Issuer Concentration Notice",
                    detail: `Manager ${dominantMgr.name} issued over 85% of all recognition awards in this period. Encourage delegation and peer leadership participation.`,
                    severity: "info",
                });
            }
        }

        // 9. Leadership Analytics
        const leadershipAnalytics: WorkspaceAnalyticsSummary["leadershipAnalytics"] = leaderboardsData.leads.map(
            (l: any) => ({
                leadId: l.userId,
                leadName: l.name,
                username: l.username,
                avatarUrl: l.avatarUrl,
                roleName: l.roleName,
                departmentId: l.departmentId,
                departmentName: l.departmentName,
                departmentColor: l.departmentColor,
                dpi: l.departmentPerformanceIndex,
                hasSufficientData: l.hasSufficientData,
                teamParticipationRate: l.deliveryStatistics.participationRate,
                approvedWorkCount: l.deliveryStatistics.tasksApproved,
                deadlineReliabilityRate: l.deliveryStatistics.onTimeDeliveryRate,
                leadPersonalOrbits: l.leadPersonalOrbits,
            })
        );

        return {
            period,
            periodStart: start ? start.toISOString() : null,
            periodEnd: end ? end.toISOString() : null,
            totalOrbitsAwarded,
            totalOrbitsReceived,
            activeContributors,
            totalApprovedTasks,
            onTimeCompletionRate,
            contributionTrends,
            departmentComparison,
            recognitionDistribution: {
                categories: categoriesDistribution,
                departments: departmentsDistribution,
                overconcentrationAlert,
            },
            fairnessAlerts,
            managerAwardActivity,
            leadershipAnalytics,
        };
    }

    /**
     * Generates actionable performance analytics for an individual workspace member.
     * Evaluates task delivery, on-time submissions, revision rates, and recognition trends.
     */
    static async getIndividualMemberAnalytics(
        workspaceId: string,
        targetUserId: string,
        options: {
            period?: LeaderboardPeriod;
        } = {}
    ): Promise<IndividualMemberAnalytics> {
        // 1. Fetch user & member record
        const memberRes = await query(
            `SELECT
                u.id AS "userId",
                TRIM(CONCAT(u.firstname, ' ', u.lastname)) AS "name",
                u.username,
                u.avatar_url AS "avatarUrl",
                wm.role_title AS "roleTitle",
                r.name AS "roleName",
                wd.id AS "departmentId",
                wd.name AS "departmentName",
                wd.color AS "departmentColor"
             FROM public.workspace_members wm
             JOIN public.users u ON u.id = wm.user_id
             JOIN public.workspace_roles r ON r.id = wm.role_id
             LEFT JOIN public.workspace_departments wd ON wd.id = wm.department_id
             WHERE wm.workspace_id = $1 AND wm.user_id = $2;`,
            [workspaceId, targetUserId]
        );

        if (memberRes.rows.length === 0) {
            throw new Error("Member not found in workspace.");
        }
        const member = memberRes.rows[0];

        // 2. Fetch Personal Summary (Total, Monthly, Weekly Orbits)
        const summary = await this.getMemberRecognitionSummary(workspaceId, targetUserId);

        // 3. Category Breakdown for Member
        const catRes = await query(
            `SELECT
                rc.name,
                rc.slug,
                rc.icon,
                COALESCE(SUM(wrl.points_delta), 0)::integer AS "points",
                COUNT(wrl.id)::integer AS "count"
             FROM public.workspace_recognition_categories rc
             JOIN public.workspace_recognition_ledger wrl ON wrl.category_id = rc.id
             WHERE wrl.workspace_id = $1 AND wrl.recipient_id = $2 AND wrl.is_reversed = false AND wrl.transaction_type = 'award'
             GROUP BY rc.id, rc.name, rc.slug, rc.icon
             ORDER BY "points" DESC;`,
            [workspaceId, targetUserId]
        );
        const categoriesBreakdown = catRes.rows.map((r: any) => ({
            name: r.name,
            slug: r.slug,
            points: r.points,
            count: r.count,
            icon: r.icon || "Award",
        }));

        // 4. Tasks Assigned, Completed, Approved
        const tasksRes = await query(
            `SELECT
                wt.id,
                wt.status,
                wt.due_date AS "dueDate",
                wt.completed_at AS "completedAt",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_reviews wtr 
                    WHERE wtr.task_id = wt.id AND wtr.decision = 'approved'
                ) AS "hasApprovedReview"
             FROM public.workspace_task_assignments wta
             JOIN public.workspace_tasks wt ON wt.id = wta.task_id
             WHERE wta.workspace_id = $1 AND wta.user_id = $2
               AND wt.is_archived = false AND wt.status != 'cancelled';`,
            [workspaceId, targetUserId]
        );

        const assignedTasks = tasksRes.rows;
        const tasksAssigned = assignedTasks.length;
        const tasksCompleted = assignedTasks.filter((t: any) => t.status === "completed").length;
        const tasksApproved = assignedTasks.filter((t: any) => t.status === "completed" || t.hasApprovedReview).length;

        // 5. Task Submissions: On-Time Submission Rate & Revision Request Rate
        const subRes = await query(
            `SELECT
                wts.id,
                wts.status,
                wts.created_at AS "submittedAt",
                wt.due_date AS "dueDate",
                EXISTS (
                    SELECT 1 FROM public.workspace_task_reviews wtr 
                    WHERE wtr.submission_id = wts.id AND wtr.decision = 'changes_requested'
                ) AS "hadChangesRequested"
             FROM public.workspace_task_submissions wts
             JOIN public.workspace_tasks wt ON wt.id = wts.task_id
             WHERE wts.workspace_id = $1 AND wts.submitted_by = $2;`,
            [workspaceId, targetUserId]
        );

        const submissions = subRes.rows;
        let onTimeSubmissionRate: number | null = null;
        let submissionRevisionRate: number | null = null;

        if (submissions.length > 0) {
            let onTimeCount = 0;
            let revisedCount = 0;

            submissions.forEach((s: any) => {
                if (!s.dueDate || new Date(s.submittedAt) <= new Date(s.dueDate)) {
                    onTimeCount++;
                }
                if (s.status === "changes_requested" || s.hadChangesRequested) {
                    revisedCount++;
                }
            });

            onTimeSubmissionRate = Math.round((onTimeCount / submissions.length) * 1000) / 10;
            submissionRevisionRate = Math.round((revisedCount / submissions.length) * 1000) / 10;
        }

        // 6. Department Participation Count
        const partRes = await query(
            `SELECT
                (SELECT COUNT(*)::int FROM public.workspace_task_submissions WHERE workspace_id = $1 AND submitted_by = $2) +
                (SELECT COUNT(*)::int FROM public.workspace_task_comments WHERE workspace_id = $1 AND author_id = $2) +
                (SELECT COUNT(*)::int FROM public.workspace_recognition_ledger WHERE workspace_id = $1 AND recipient_id = $2 AND is_reversed = false) AS "participationCount";`,
            [workspaceId, targetUserId]
        );
        const departmentParticipation = parseInt(partRes.rows[0]?.participationCount, 10) || 0;

        // 7. Individual 4-Week Trend
        const trends: IndividualMemberAnalytics["trends"] = [];
        const now = new Date();
        for (let i = 3; i >= 0; i--) {
            const wStart = new Date(now.getTime() - (i + 1) * 7 * 24 * 60 * 60 * 1000);
            const wEnd = new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000);
            const label = i === 0 ? "Current Week" : `${i}w ago`;

            const wOrbitsRes = await query(
                `SELECT COALESCE(SUM(points_delta), 0)::integer AS "orbits"
                 FROM public.workspace_recognition_ledger
                 WHERE workspace_id = $1 AND recipient_id = $2 AND is_reversed = false AND transaction_type = 'award'
                   AND created_at >= $3 AND created_at <= $4;`,
                [workspaceId, targetUserId, wStart.toISOString(), wEnd.toISOString()]
            );

            const wTasksRes = await query(
                `SELECT COUNT(wt.id)::integer AS "tasksCompleted"
                 FROM public.workspace_task_assignments wta
                 JOIN public.workspace_tasks wt ON wt.id = wta.task_id
                 WHERE wta.workspace_id = $1 AND wta.user_id = $2 AND wt.is_archived = false AND wt.status = 'completed'
                   AND wt.completed_at >= $3 AND wt.completed_at <= $4;`,
                [workspaceId, targetUserId, wStart.toISOString(), wEnd.toISOString()]
            );

            trends.push({
                periodLabel: label,
                orbits: wOrbitsRes.rows[0]?.orbits || 0,
                tasksCompleted: wTasksRes.rows[0]?.tasksCompleted || 0,
            });
        }

        // 8. Sufficient Data Safeguard
        const hasSufficientTaskData = tasksAssigned > 0;
        const insufficientDataReason = !hasSufficientTaskData
            ? "No tasks assigned to member in this workspace"
            : undefined;

        return {
            userId: member.userId,
            name: member.name || member.username,
            username: member.username,
            avatarUrl: member.avatarUrl || undefined,
            roleTitle: member.roleTitle || member.roleName,
            department: member.departmentId ? {
                id: member.departmentId,
                name: member.departmentName,
                color: member.departmentColor,
            } : null,
            totalOrbits: summary.totalOrbitsEarned,
            weeklyOrbits: summary.weeklyOrbitsEarned,
            monthlyOrbits: summary.monthlyOrbitsEarned,
            categoriesBreakdown,
            tasksAssigned,
            tasksCompleted,
            tasksApproved,
            onTimeSubmissionRate,
            submissionRevisionRate,
            departmentParticipation,
            trends,
            hasSufficientTaskData,
            insufficientDataReason,
        };
    }
}


