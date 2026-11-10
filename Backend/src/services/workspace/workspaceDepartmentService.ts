// Backend/src/services/workspace/workspaceDepartmentService.ts
import { query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceNotificationService } from "./workspaceNotificationService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import type {
    WorkspaceDepartment,
    WorkspaceDepartmentMember,
} from "../../types/workspaceTypes.js";

export interface DepartmentTemplate {
    name: string;
    slug: string;
    icon: string;
    color: string;
    description: string;
}

export const SUGGESTED_DEPARTMENTS: DepartmentTemplate[] = [
    {
        name: "Technical & Development",
        slug: "technical-development",
        icon: "Code",
        color: "#2563eb",
        description: "Core software engineering, architecture, technical workshops, and platform infrastructure.",
    },
    {
        name: "Design & Branding",
        slug: "design-branding",
        icon: "Palette",
        color: "#ec4899",
        description: "UI/UX design, visual identity, event posters, marketing creatives, and brand guidelines.",
    },
    {
        name: "Content & Communications",
        slug: "content-communications",
        icon: "MessageSquare",
        color: "#8b5cf6",
        description: "Social media campaigns, community broadcasts, editorial articles, and event writeups.",
    },
    {
        name: "Operations & Coordination",
        slug: "operations-coordination",
        icon: "CheckSquare",
        color: "#10b981",
        description: "Event logistics, campus scheduling, venue management, and volunteer operations.",
    },
    {
        name: "Media & Photography",
        slug: "media-photography",
        icon: "Camera",
        color: "#f59e0b",
        description: "Event photography, stage videography, promotional reels, and chapter media archives.",
    },
];

export class WorkspaceDepartmentService {
    /**
     * Lists all departments for a workspace
     */
    static async listDepartments(
        workspaceId: string,
        includeArchived = false
    ): Promise<WorkspaceDepartment[]> {
        return await WorkspaceRepository.listDepartments(workspaceId, includeArchived);
    }

    /**
     * Seeds the standard suggested department templates if none exist
     */
    static async seedSuggestedDepartments(
        workspaceId: string,
        actorUserId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartment[]> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.isWorkspaceManager && !ctx.permissions.includes("departments:create"))) {
            throw new Error("Unauthorized to seed default departments.");
        }

        const existing = await WorkspaceRepository.listDepartments(workspaceId, true);
        if (existing.length > 0) {
            return existing;
        }

        const seeded: WorkspaceDepartment[] = [];
        for (let i = 0; i < SUGGESTED_DEPARTMENTS.length; i++) {
            const t = SUGGESTED_DEPARTMENTS[i]!;
            const created = await WorkspaceRepository.createDepartment(null, {
                workspaceId,
                name: t.name,
                slug: t.slug,
                description: t.description,
                icon: t.icon,
                color: t.color,
                displayOrder: i,
            });
            seeded.push(created);
        }

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "departments_seeded",
            targetType: "department",
            details: { count: seeded.length },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return seeded;
    }

    /**
     * Creates a custom department
     */
    static async createDepartment(
        workspaceId: string,
        actorUserId: string,
        data: {
            name: string;
            slug?: string;
            description?: string | null;
            icon?: string;
            color?: string;
            leadUserId?: string | null;
            coLeadUserIds?: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartment> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("departments:create"))) {
            throw new Error("Unauthorized to create departments in this workspace.");
        }

        const trimmedName = data.name.trim();
        if (!trimmedName || trimmedName.length < 2) {
            throw new Error("Department name must be at least 2 characters.");
        }

        let slug = data.slug?.trim().toLowerCase();
        if (!slug) {
            slug = trimmedName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        }

        // Check unique slug within workspace
        const existingSlug = await WorkspaceRepository.findDepartmentBySlug(workspaceId, slug);
        if (existingSlug) {
            slug = `${slug}-${Date.now().toString(36)}`;
        }

        const created = await WorkspaceRepository.createDepartment(null, {
            workspaceId,
            name: trimmedName,
            slug,
            description: data.description || null,
            icon: data.icon || "Folder",
            color: data.color || "#2563eb",
            leadUserId: data.leadUserId || null,
            coLeadUserIds: data.coLeadUserIds || [],
        });

        // If leadUserId is provided, auto-assign lead into workspace_department_members
        if (data.leadUserId) {
            const member = await WorkspaceRepository.findMember(workspaceId, data.leadUserId);
            if (member) {
                await WorkspaceRepository.addDepartmentMember(null, {
                    workspaceId,
                    departmentId: created.id,
                    memberId: member.id,
                    userId: data.leadUserId,
                    departmentRole: "lead",
                    roleTitle: "Department Lead",
                    assignedBy: actorUserId,
                });
            }
        }

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "department_created",
            targetType: "department",
            targetId: created.id,
            details: { name: created.name, slug: created.slug },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return created;
    }

    /**
     * Updates an existing department
     */
    static async updateDepartment(
        workspaceId: string,
        actorUserId: string,
        departmentId: string,
        updates: {
            name?: string;
            description?: string | null;
            icon?: string;
            color?: string;
            leadUserId?: string | null;
            coLeadUserIds?: string[];
            displayOrder?: number;
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartment> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        const dept = await WorkspaceRepository.findDepartmentById(workspaceId, departmentId);
        if (!dept) {
            throw new Error("Department not found.");
        }

        // Check authorization: Admin or explicit department lead
        const isDeptLead = dept.leadUserId === actorUserId;
        if (!ctx || (!ctx.isAdmin && !isDeptLead && !ctx.permissions.includes("departments:manage"))) {
            throw new Error("Unauthorized to edit this department.");
        }

        const updated = await WorkspaceRepository.updateDepartment(workspaceId, departmentId, updates);
        if (!updated) {
            throw new Error("Failed to update department.");
        }

        // If lead changed, update department member role
        if (updates.leadUserId !== undefined && updates.leadUserId !== dept.leadUserId) {
            if (updates.leadUserId) {
                const newLeadMember = await WorkspaceRepository.findMember(workspaceId, updates.leadUserId);
                if (newLeadMember) {
                    await WorkspaceRepository.addDepartmentMember(null, {
                        workspaceId,
                        departmentId,
                        memberId: newLeadMember.id,
                        userId: updates.leadUserId,
                        departmentRole: "lead",
                        roleTitle: "Department Lead",
                        assignedBy: actorUserId,
                    });
                }
            }
        }

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "department_updated",
            targetType: "department",
            targetId: departmentId,
            details: updates,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Archives a department
     */
    static async archiveDepartment(
        workspaceId: string,
        actorUserId: string,
        departmentId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartment> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("departments:delete"))) {
            throw new Error("Unauthorized to archive departments.");
        }

        const updated = await WorkspaceRepository.setDepartmentStatus(workspaceId, departmentId, "archived");
        if (!updated) throw new Error("Department not found or already archived.");

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "department_archived",
            targetType: "department",
            targetId: departmentId,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Restores an archived department
     */
    static async restoreDepartment(
        workspaceId: string,
        actorUserId: string,
        departmentId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartment> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("departments:manage"))) {
            throw new Error("Unauthorized to restore departments.");
        }

        const updated = await WorkspaceRepository.setDepartmentStatus(workspaceId, departmentId, "active");
        if (!updated) throw new Error("Department not found.");

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "department_restored",
            targetType: "department",
            targetId: departmentId,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Adds a workspace member to a department
     * Satisfies: A member can belong to multiple departments without creating duplicate workspace memberships.
     */
    static async addMemberToDepartment(
        workspaceId: string,
        actorUserId: string,
        departmentId: string,
        memberId: string,
        role: "lead" | "co_lead" | "member" = "member",
        roleTitle?: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceDepartmentMember> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        const dept = await WorkspaceRepository.findDepartmentById(workspaceId, departmentId);
        if (!dept) throw new Error("Department not found.");

        const isLead =
            dept.leadUserId === actorUserId ||
            dept.coLeadUserIds?.includes(actorUserId) ||
            ctx?.leadDepartmentIds?.includes(departmentId);
        if (!ctx || (!ctx.isAdmin && !isLead && !ctx.permissions.includes("departments:manage"))) {
            throw new Error("Unauthorized to manage members of this department.");
        }

        // Verify member exists in this workspace
        const memberQuery = await WorkspaceRepository.findById(workspaceId);
        if (!memberQuery) throw new Error("Workspace not found.");

        // Find member row
        const targetMemberRes = await query(
            `SELECT id, user_id FROM public.workspace_members WHERE workspace_id = $1 AND id = $2 LIMIT 1;`,
            [workspaceId, memberId]
        );
        const targetMember = targetMemberRes.rows[0];
        if (!targetMember) throw new Error("Target member does not exist in this workspace.");

        const assigned = await WorkspaceRepository.addDepartmentMember(null, {
            workspaceId,
            departmentId,
            memberId,
            userId: targetMember.user_id,
            departmentRole: role,
            roleTitle: roleTitle || "Department Member",
            assignedBy: actorUserId,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "department_member_added",
            targetType: "department_member",
            targetId: assigned.id,
            details: { departmentId, memberId, role },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        // Notify member of department assignment
        const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
        const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "Workspace Lead";
        WorkspaceNotificationService.notifyDepartmentAdded({
            workspaceId,
            clubId: memberQuery.clubId,
            workspaceName: memberQuery.name,
            recipientId: targetMember.user_id,
            actorId: actorUserId,
            actorName,
            departmentId: dept.id,
            departmentName: dept.name,
        }).catch((err) => console.warn("[DeptService] Notify add failed:", err.message));

        return assigned;
    }

    /**
     * Removes a member from a department
     */
    static async removeMemberFromDepartment(
        workspaceId: string,
        actorUserId: string,
        departmentId: string,
        memberId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        const dept = await WorkspaceRepository.findDepartmentById(workspaceId, departmentId);
        if (!dept) throw new Error("Department not found.");

        const isLead =
            dept.leadUserId === actorUserId ||
            dept.coLeadUserIds?.includes(actorUserId) ||
            ctx?.leadDepartmentIds?.includes(departmentId);
        if (!ctx || (!ctx.isAdmin && !isLead && !ctx.permissions.includes("departments:manage"))) {
            throw new Error("Unauthorized to manage members of this department.");
        }

        const removed = await WorkspaceRepository.removeDepartmentMember(workspaceId, departmentId, memberId);
        if (removed) {
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "department_member_removed",
                targetType: "department_member",
                details: { departmentId, memberId },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            // Target member user id lookup
            const targetMemberRes = await query(
                `SELECT user_id FROM public.workspace_members WHERE workspace_id = $1 AND id = $2 LIMIT 1;`,
                [workspaceId, memberId]
            );
            const targetUserId = targetMemberRes.rows[0]?.user_id;
            if (targetUserId) {
                const actor = await WorkspaceRepository.findMemberByUserId(workspaceId, actorUserId);
                const actorName = actor?.user ? `${actor.user.firstName || ""} ${actor.user.lastName || actor.user.username}`.trim() : "Workspace Lead";
                const ws = await WorkspaceRepository.findById(workspaceId);
                WorkspaceNotificationService.notifyDepartmentRemoved({
                    workspaceId,
                    clubId: ws?.clubId || "",
                    workspaceName: ws?.name || "Workspace",
                    recipientId: targetUserId,
                    actorId: actorUserId,
                    actorName,
                    departmentId: dept.id,
                    departmentName: dept.name,
                }).catch((err) => console.warn("[DeptService] Notify remove failed:", err.message));
            }
        }
        return removed;
    }

    /**
     * Transfers a member from one department to another.
     * Preserves former task history and records immutable transfer ledger.
     */
    static async transferMember(
        workspaceId: string,
        actorUserId: string,
        memberId: string,
        fromDeptId: string,
        toDeptId: string,
        reason?: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("departments:manage"))) {
            throw new Error("Unauthorized to transfer members across departments.");
        }

        const fromDept = await WorkspaceRepository.findDepartmentById(workspaceId, fromDeptId);
        const toDept = await WorkspaceRepository.findDepartmentById(workspaceId, toDeptId);
        if (!fromDept || !toDept) {
            throw new Error("Source or destination department does not exist.");
        }

        const memberRes = await query(
            `SELECT user_id FROM public.workspace_members WHERE workspace_id = $1 AND id = $2 LIMIT 1;`,
            [workspaceId, memberId]
        );
        const member = memberRes.rows[0];
        if (!member) throw new Error("Member not found.");

        const success = await WorkspaceRepository.transferDepartmentMember(
            workspaceId,
            memberId,
            member.user_id,
            fromDeptId,
            toDeptId,
            actorUserId
        );

        if (success) {
            // 1. Record transfer in durable ledger
            await WorkspaceRepository.recordDepartmentTransfer(null, {
                workspaceId,
                userId: member.user_id,
                fromDepartmentId: fromDeptId,
                toDepartmentId: toDeptId,
                transferredBy: actorUserId,
                reason: reason || null,
            });

            // 2. Audit log
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "department_member_transferred",
                targetType: "department_member",
                details: { memberId, fromDeptId, toDeptId, reason: reason || null },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            // 3. Dynamic cache invalidation
            await WorkspaceRedisService.invalidateMemberPermissions(workspaceId, member.user_id);
            await WorkspaceRedisService.invalidateDashboardMetrics(workspaceId);
        }

        return success;
    }

    /**
     * Lists transfer history across departments in this workspace
     */
    static async getDepartmentTransfers(
        workspaceId: string,
        actorUserId: string,
        options: { userId?: string; departmentId?: string; limit?: number; offset?: number } = {}
    ) {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx) throw new Error("Unauthorized to view workspace department transfers.");
        return WorkspaceRepository.listDepartmentTransfers(workspaceId, options);
    }

    /**
     * Gets department details and member roster
     */
    static async getDepartmentDetails(
        workspaceId: string,
        departmentId: string
    ): Promise<{ department: WorkspaceDepartment; members: WorkspaceDepartmentMember[] }> {
        const dept = await WorkspaceRepository.findDepartmentById(workspaceId, departmentId);
        if (!dept) throw new Error("Department not found.");

        const members = await WorkspaceRepository.listDepartmentMembers(workspaceId, departmentId);
        return { department: dept, members };
    }
}
