// Backend/src/services/workspace/workspaceService.ts
import { pool, query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import type {
    TeamWorkspace,
    WorkspaceMember,
    WorkspaceRole,
    WorkspaceContext,
} from "../../types/workspaceTypes.js";

// System Permissions Definition
export const DEFAULT_OWNER_PERMISSIONS = ["*"];

export const DEFAULT_ADMIN_PERMISSIONS = [
    "workspace:manage_settings",
    "members:invite",
    "members:remove",
    "members:assign_role",
    "roles:create",
    "roles:manage",
    "departments:create",
    "departments:manage",
    "departments:delete",
    "channels:create",
    "channels:manage",
    "channels:delete",
    "messages:send",
    "messages:attach_files",
    "messages:moderate",
    "messages:pin",
    "tasks:create",
    "tasks:assign",
    "tasks:reassign",
    "tasks:review",
    "tasks:edit_all",
    "tasks:delete",
    "files:upload",
    "files:manage",
    "audit:view",
];

export const DEFAULT_DEPT_LEAD_PERMISSIONS = [
    "members:invite",
    "channels:create",
    "messages:send",
    "messages:attach_files",
    "messages:pin",
    "tasks:create",
    "tasks:assign",
    "tasks:reassign",
    "tasks:review",
    "tasks:edit_department",
    "files:upload",
];

export const DEFAULT_MEMBER_PERMISSIONS = [
    "messages:send",
    "messages:attach_files",
    "tasks:create",
    "files:upload",
];

export const DEFAULT_GUEST_PERMISSIONS = [
    "messages:send",
];

export class WorkspaceService {
    /**
     * Idempotently retrieves or provisions a Team Workspace for the specified club.
     * Guaranteed to never duplicate workspaces or omit root owner membership.
     */
    static async getOrCreateWorkspaceForClub(
        clubId: string,
        actorUserId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<{ workspace: TeamWorkspace; member: WorkspaceMember; isNew: boolean }> {
        // 1. Check Redis Cache first
        let cached = await WorkspaceRedisService.getCachedWorkspace(clubId);
        if (cached) {
            const member = await WorkspaceRepository.findMember(cached.id, actorUserId);
            if (member && !member.isSuspended) {
                return { workspace: cached, member, isNew: false };
            }
        }

        // 2. Query Postgres for existing workspace
        let existing = await WorkspaceRepository.findByClubId(clubId);
        if (existing) {
            let member = await WorkspaceRepository.findMember(existing.id, actorUserId);
            
            // If workspace exists but caller has no membership, check if caller is club owner or staff
            if (!member) {
                member = await this.bootstrapMemberIfAuthorized(existing, actorUserId);
            }

            if (!member) {
                throw new Error("You do not have permission to access this club's workspace.");
            }

            await WorkspaceRedisService.setCachedWorkspace(clubId, existing);
            return { workspace: existing, member, isNew: false };
        }

        // 3. Workspace does not exist: Provision within an ACID transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // Verify club exists and fetch owner
            const clubRes = await client.query(
                `SELECT id, name, slug, auth_user_id, is_active 
                 FROM public.verified_clubs 
                 WHERE id = $1 
                 LIMIT 1 
                 FOR UPDATE;`,
                [clubId]
            );

            const club = clubRes.rows[0];
            if (!club) {
                throw new Error("Specified verified club does not exist.");
            }

            // Verify caller has provisioning authority (is club owner or manager)
            const isClubOwner = club.auth_user_id === actorUserId;
            if (!isClubOwner) {
                const memRes = await client.query(
                    `SELECT id, access_role FROM public.club_memberships 
                     WHERE club_id = $1 AND user_id = $2 AND status = 'active' 
                     LIMIT 1;`,
                    [clubId, actorUserId]
                );
                const callerRole = memRes.rows[0]?.access_role;
                if (!callerRole || !["owner", "admin"].includes(callerRole)) {
                    throw new Error("Only club administrators can initialize the team workspace.");
                }
            }

            // Generate unique slug for workspace
            let wsSlug = `${club.slug}-workspace`;
            const slugCheck = await client.query(
                `SELECT 1 FROM public.team_workspaces WHERE slug = $1;`,
                [wsSlug]
            );
            if (slugCheck.rows.length > 0) {
                wsSlug = `${club.slug}-ws-${Date.now().toString(36)}`;
            }

            // Insert team_workspaces record
            const workspace = await WorkspaceRepository.create(client, {
                clubId: club.id,
                ownerId: club.auth_user_id,
                name: `${club.name} Workspace`,
                slug: wsSlug,
                description: `Official Team Workspace for ${club.name}`,
                settings: {
                    allowMemberInvites: true,
                    theme: "neo",
                    maxMembers: 250,
                },
            });

            // Seed default system roles
            const ownerRole = await WorkspaceRepository.createRole(client, {
                workspaceId: workspace.id,
                name: "Workspace Owner",
                slug: "owner",
                description: "Full control over all workspace configurations, memberships, and channels.",
                rank: 1000,
                isSystem: true,
                color: "#dc2626",
                permissions: DEFAULT_OWNER_PERMISSIONS,
            });

            const adminRole = await WorkspaceRepository.createRole(client, {
                workspaceId: workspace.id,
                name: "Administrator",
                slug: "admin",
                description: "Can manage members, channels, tasks, and audit logs.",
                rank: 800,
                isSystem: true,
                color: "#7c3aed",
                permissions: DEFAULT_ADMIN_PERMISSIONS,
            });

            await WorkspaceRepository.createRole(client, {
                workspaceId: workspace.id,
                name: "Department Lead",
                slug: "dept_lead",
                description: "Manages department-specific channels, members, and task assignments.",
                rank: 500,
                isSystem: true,
                color: "#2563eb",
                permissions: DEFAULT_DEPT_LEAD_PERMISSIONS,
            });

            const memberRole = await WorkspaceRepository.createRole(client, {
                workspaceId: workspace.id,
                name: "Member",
                slug: "member",
                description: "Can participate in conversations, assign tasks, and view shared files.",
                rank: 200,
                isSystem: true,
                color: "#16a34a",
                permissions: DEFAULT_MEMBER_PERMISSIONS,
            });

            await WorkspaceRepository.createRole(client, {
                workspaceId: workspace.id,
                name: "Guest",
                slug: "guest",
                description: "Limited read and response access in selected public channels.",
                rank: 100,
                isSystem: true,
                color: "#52525b",
                permissions: DEFAULT_GUEST_PERMISSIONS,
            });

            // Seed default channel category ("General")
            const catRes = await client.query(
                `INSERT INTO public.workspace_channel_categories (workspace_id, name, display_order)
                 VALUES ($1, 'General', 0)
                 RETURNING id;`,
                [workspace.id]
            );
            const generalCatId = catRes.rows[0].id;

            // Seed default channels (#general, #announcements)
            await client.query(
                `INSERT INTO public.workspace_channels (
                    workspace_id, category_id, name, slug, topic, channel_type, is_private, created_by
                ) VALUES 
                ($1, $2, 'general', 'general', 'General club discussions and collaboration', 'text', false, $3),
                ($1, $2, 'announcements', 'announcements', 'Official club announcements and updates', 'announcement', false, $3);`,
                [workspace.id, generalCatId, actorUserId]
            );

            // Provision membership for root club owner
            const ownerMember = await WorkspaceRepository.createMember(client, {
                workspaceId: workspace.id,
                userId: club.auth_user_id,
                roleId: ownerRole.id,
                roleTitle: "Club President / Owner",
                membershipStatus: "active",
            });

            // If caller is different from owner, provision membership for caller as Admin
            let callerMember = ownerMember;
            if (actorUserId !== club.auth_user_id) {
                callerMember = await WorkspaceRepository.createMember(client, {
                    workspaceId: workspace.id,
                    userId: actorUserId,
                    roleId: adminRole.id,
                    roleTitle: "Club Administrator",
                    membershipStatus: "active",
                });
            }

            // Record audit log
            await WorkspaceRepository.logAudit(client, {
                workspaceId: workspace.id,
                actorId: actorUserId,
                action: "workspace_provisioned",
                targetType: "workspace",
                targetId: workspace.id,
                details: {
                    clubId: club.id,
                    clubName: club.name,
                    slug: workspace.slug,
                },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await client.query("COMMIT;");

            // Prime Redis Cache
            await WorkspaceRedisService.setCachedWorkspace(clubId, workspace);

            return {
                workspace,
                member: callerMember,
                isNew: true,
            };
        } catch (err: any) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Resolves caller's authorized workspace context with permissions
     */
    static async resolveContext(
        workspaceId: string,
        userId: string
    ): Promise<WorkspaceContext | null> {
        const workspace = await WorkspaceRepository.findById(workspaceId);
        if (!workspace || workspace.workspaceStatus === "archived") {
            return null;
        }

        const member = await WorkspaceRepository.findMember(workspaceId, userId);
        if (!member || member.membershipStatus !== "active" || member.isSuspended) {
            return null;
        }

        // Resolve Permissions (check Redis first)
        let permissions = await WorkspaceRedisService.getCachedPermissions(workspaceId, userId);
        if (!permissions) {
            const role = member.role || (await WorkspaceRepository.findRoleById(workspaceId, member.roleId));
            permissions = Array.isArray(role?.permissions) ? role.permissions : [];

            // Merge custom grants
            if (member.customPermissions) {
                for (const [perm, granted] of Object.entries(member.customPermissions)) {
                    if (granted && !permissions.includes(perm)) {
                        permissions.push(perm);
                    } else if (!granted) {
                        permissions = permissions.filter((p) => p !== perm);
                    }
                }
            }

            await WorkspaceRedisService.setCachedPermissions(workspaceId, userId, permissions);
        }

        const isOwner = member.role?.slug === "owner" || member.role?.rank === 1000;
        const isAdmin = isOwner || (member.role?.rank || 0) >= 800;
        const isWorkspaceManager = workspace.managerUserId === userId;

        const leadDeptRes = await query(
            `SELECT department_id as id FROM public.workspace_department_members
             WHERE workspace_id = $1 AND user_id = $2 AND department_role IN ('lead', 'co_lead')
             UNION
             SELECT id FROM public.workspace_departments 
             WHERE workspace_id = $1 AND (lead_user_id = $2 OR co_lead_user_ids @> to_jsonb($2::text));`,
            [workspaceId, userId]
        );
        const leadDepartmentIds = leadDeptRes.rows.map((r: any) => r.id);

        return {
            workspace,
            member,
            permissions,
            isOwner,
            isAdmin,
            isWorkspaceManager,
            leadDepartmentIds,
        };
    }

    /**
     * Updates suspension state of a member without affecting global Orbix account.
     */
    static async setMemberSuspension(
        workspaceId: string,
        targetUserId: string,
        actorUserId: string,
        suspend: boolean,
        reason?: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceMember> {
        const actorCtx = await this.resolveContext(workspaceId, actorUserId);
        if (!actorCtx) {
            throw new Error("Unauthorized to manage workspace members.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) {
            throw new Error("Target user is not a member of this workspace.");
        }

        // Protection: Cannot suspend the workspace owner!
        if (targetMember.role?.slug === "owner" || targetMember.role?.rank === 1000) {
            throw new Error("The workspace owner cannot be suspended.");
        }

        // Rank Check: Actor must outrank target
        const actorRank = actorCtx.member.role?.rank || 0;
        const targetRank = targetMember.role?.rank || 0;
        if (actorRank <= targetRank && !actorCtx.isOwner) {
            throw new Error("Cannot alter suspension state of a member with equal or higher rank.");
        }

        const updated = await WorkspaceRepository.updateMemberSuspension(
            workspaceId,
            targetUserId,
            suspend,
            reason,
            actorUserId
        );

        if (!updated) {
            throw new Error("Failed to update member suspension status.");
        }

        // Invalidate Redis permissions
        await WorkspaceRedisService.invalidateMemberPermissions(workspaceId, targetUserId);

        // Audit Log
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: suspend ? "member_suspended" : "member_unsuspended",
            targetType: "member",
            targetId: targetMember.id,
            details: {
                targetUserId,
                reason: reason || null,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Helper to automatically register existing verified club staff into workspace
     */
    private static async bootstrapMemberIfAuthorized(
        workspace: TeamWorkspace,
        userId: string
    ): Promise<WorkspaceMember | null> {
        // Check if user is the club owner
        if (workspace.ownerId === userId) {
            const ownerRole = await WorkspaceRepository.findRoleBySlug(workspace.id, "owner");
            if (ownerRole) {
                return await WorkspaceRepository.createMember(null, {
                    workspaceId: workspace.id,
                    userId,
                    roleId: ownerRole.id,
                    roleTitle: "Club President / Owner",
                    membershipStatus: "active",
                });
            }
        }

        // Check if user is a member of the club in club_memberships
        const memRes = await query(
            `SELECT id, access_role, club_role, title 
             FROM public.club_memberships 
             WHERE club_id = $1 AND user_id = $2 AND status = 'active' 
             LIMIT 1;`,
            [workspace.clubId, userId]
        );

        const clubMem = memRes.rows[0];
        if (!clubMem) return null;

        const roleSlug = ["owner", "admin"].includes(clubMem.access_role)
            ? "admin"
            : clubMem.access_role === "team_lead"
            ? "dept_lead"
            : "member";

        const role = await WorkspaceRepository.findRoleBySlug(workspace.id, roleSlug);
        if (!role) return null;

        return await WorkspaceRepository.createMember(null, {
            workspaceId: workspace.id,
            userId,
            clubMembershipId: clubMem.id,
            roleId: role.id,
            roleTitle: clubMem.title || "Member",
            membershipStatus: "active",
        });
    }
}
