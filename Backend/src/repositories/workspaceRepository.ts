// Backend/src/repositories/workspaceRepository.ts
import { query } from "../database/client.js";
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
            search?: string;
            isArchived?: boolean;
            allowedDepartmentIds?: string[];
            isRestrictedIsolation?: boolean;
            actorUserId?: string;
            sortBy?: "created_at" | "due_date" | "priority" | "display_order";
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
        tab: "assigned_to_me" | "created_by_me" | "due_soon" | "overdue" | "completed" | "awaiting_review",
        options: {
            allowedDepartmentIds?: string[];
            isReviewer?: boolean;
        } = {}
    ): Promise<WorkspaceTask[]> {
        let condition = "";
        const params: any[] = [workspaceId, userId];

        if (tab === "assigned_to_me") {
            condition = `
                EXISTS (
                    SELECT 1 FROM public.workspace_task_assignments a 
                    WHERE a.task_id = wt.id AND a.user_id = $2 AND a.is_active = true
                )
                AND wt.is_archived = false 
                AND wt.status NOT IN ('completed', 'cancelled')
            `;
        } else if (tab === "created_by_me") {
            condition = `
                wt.creator_id = $2
                AND wt.is_archived = false
            `;
        } else if (tab === "due_soon") {
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
            const allowedDepts = options.allowedDepartmentIds || [];
            condition = `
                wt.status = 'submitted'
                AND wt.is_archived = false
                AND (
                    wt.creator_id = $2
                    OR (wt.department_id IS NOT NULL AND wt.department_id = ANY($3))
                    ${options.isReviewer ? "OR wt.department_id IS NULL" : ""}
                )
            `;
            params.push(allowedDepts);
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
        const membersRes = await query(
            `SELECT
                COUNT(*)::int AS "totalMembers",
                COUNT(*) FILTER (WHERE membership_status = 'active' AND is_suspended = false)::int AS "activeMembers"
             FROM public.workspace_members
             WHERE workspace_id = $1;`,
            [workspaceId]
        );
        const totalMembers = Number(membersRes.rows[0]?.totalMembers || 0);
        const activeMembers = Number(membersRes.rows[0]?.activeMembers || 0);

        // 2. Departments
        const deptsRes = await query(
            `SELECT COUNT(*)::int AS count
             FROM public.workspace_departments
             WHERE workspace_id = $1 AND status = 'active';`,
            [workspaceId]
        );
        const totalDepartments = Number(deptsRes.rows[0]?.count || 0);

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

        return {
            totalMembers,
            activeMembers,
            totalDepartments,
            activeTasks,
            completedTasks,
            overdueTasks,
            tasksAwaitingReview,
            recentActivity: events,
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

        // Sort combined results by createdAt descending and slice to limit
        results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const paginatedResults = results.slice(0, limit);

        return {
            results: paginatedResults,
            total: results.length,
            countsByType,
        };
    }
}

