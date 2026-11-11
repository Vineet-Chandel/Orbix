// Backend/src/services/workspace/workspaceMemberService.ts
import crypto from "crypto";
import { pool, query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { workspaceEventBus } from "./workspaceChannelService.js";
import type {
    WorkspaceMember,
    WorkspaceInvitation,
    TeamWorkspace,
    WorkspaceRole,
} from "../../types/workspaceTypes.js";

export class WorkspaceMemberService {
    private static broadcastEvent(workspaceId: string, event: string, payload: any) {
        workspaceEventBus.emit(`workspace:${workspaceId}`, {
            event,
            payload,
            timestamp: new Date().toISOString(),
        });
    }
    // =========================================================================
    // 1. WORKSPACE MANAGER APPOINTMENT (CLUB MANAGER / OWNER EXCLUSIVE)
    // =========================================================================

    /**
     * Appoints or replaces the designated Workspace Manager
     * Only the Club Owner has authority to invoke this.
     */
    static async appointWorkspaceManager(
        workspaceId: string,
        actorUserId: string,
        managerUserId: string,
        permissions: string[] = [],
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<TeamWorkspace> {
        const workspace = await WorkspaceRepository.findById(workspaceId);
        if (!workspace) throw new Error("Workspace not found.");

        if (workspace.ownerId !== actorUserId) {
            throw new Error("Only the Club Owner has authority to appoint or change the Workspace Manager.");
        }

        // Verify target user is an active member of this workspace
        const member = await WorkspaceRepository.findMember(workspaceId, managerUserId);
        if (!member || member.isSuspended) {
            throw new Error("Target user must be an active workspace member to become Workspace Manager.");
        }

        const updated = await WorkspaceRepository.setWorkspaceManager(
            workspaceId,
            managerUserId,
            permissions
        );

        if (!updated) throw new Error("Failed to appoint Workspace Manager.");

        // Invalidate permissions and security caches
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId, managerUserId);
        await WorkspaceRedisService.invalidateWorkspace(workspace.clubId);

        this.broadcastEvent(workspaceId, "member:manager_appointed", { managerUserId, permissions });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "workspace_manager_appointed",
            targetType: "workspace_manager",
            targetId: managerUserId,
            details: { managerUserId, permissions },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Revokes the Workspace Manager designation
     */
    static async revokeWorkspaceManager(
        workspaceId: string,
        actorUserId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<TeamWorkspace> {
        const workspace = await WorkspaceRepository.findById(workspaceId);
        if (!workspace) throw new Error("Workspace not found.");

        if (workspace.ownerId !== actorUserId) {
            throw new Error("Only the Club Owner has authority to revoke the Workspace Manager.");
        }

        const previousManagerId = workspace.managerUserId;
        const updated = await WorkspaceRepository.setWorkspaceManager(workspaceId, null, []);
        if (!updated) throw new Error("Failed to revoke Workspace Manager.");

        if (previousManagerId) {
            await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId, previousManagerId);
        }
        await WorkspaceRedisService.invalidateWorkspace(workspace.clubId);

        this.broadcastEvent(workspaceId, "member:manager_revoked", { previousManagerId });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "workspace_manager_revoked",
            targetType: "workspace_manager",
            targetId: previousManagerId,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    // =========================================================================
    // 2. MEMBER OPERATIONS: ROLE ASSIGNMENT, PROMOTE & DEMOTE
    // =========================================================================

    /**
     * Changes a member's role (promote or demote)
     * Enforces strict hierarchy rank boundaries.
     */
    static async assignMemberRole(
        workspaceId: string,
        actorUserId: string,
        targetUserId: string,
        newRoleId: string,
        roleTitle?: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceMember> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        const rawMgrPerms = ctx.workspace.managerPermissions || {};
        const mgrPerms: Record<string, any> = Array.isArray(rawMgrPerms)
            ? rawMgrPerms.reduce((acc, p) => ({ ...acc, [p]: true }), {} as Record<string, boolean>)
            : (rawMgrPerms as Record<string, any>);
        const isAuthorizedManager = ctx.isWorkspaceManager && !!mgrPerms.can_manage_members;

        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("members:assign_role") && !isAuthorizedManager && !ctx.isOwner)) {
            throw new Error("Unauthorized to assign member roles.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) throw new Error("Target user is not a member of this workspace.");

        const targetNewRole = await WorkspaceRepository.findRoleById(workspaceId, newRoleId);
        if (!targetNewRole) throw new Error("Target role does not exist in this workspace.");

        // Hierarchy Protection 1: Cannot alter role of the Owner
        if (targetMember.role?.slug === "owner" || targetMember.role?.rank === 1000) {
            throw new Error("The workspace owner role is permanent and cannot be modified.");
        }

        // Hierarchy Protection 2: Cannot grant the Owner role to anyone else
        if (targetNewRole.slug === "owner" || targetNewRole.rank === 1000) {
            throw new Error("The workspace owner role cannot be granted through regular role assignment.");
        }

        // Hierarchy Protection 3: Actor must outrank target user
        const actorRank = ctx.member.role?.rank || 0;
        const currentTargetRank = targetMember.role?.rank || 0;
        if (actorRank <= currentTargetRank && !ctx.isOwner) {
            throw new Error("Cannot modify roles of a member with equal or higher rank.");
        }

        // Hierarchy Protection 4: Actor cannot assign a role with rank >= actor's rank
        if (targetNewRole.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot assign a role with equal or higher rank than your own.");
        }

        const updated = await WorkspaceRepository.updateMemberRole(
            workspaceId,
            targetUserId,
            newRoleId,
            roleTitle || targetNewRole.name
        );

        if (!updated) throw new Error("Failed to update member role.");

        // Invalidate permissions, capabilities, and directory caches for target user
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId, targetUserId);

        this.broadcastEvent(workspaceId, "member:role_changed", {
            memberId: targetMember.id,
            userId: targetUserId,
            newRoleId,
            newRole: targetNewRole.name,
            rank: targetNewRole.rank,
        });

        const isPromotion = targetNewRole.rank > currentTargetRank;
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: isPromotion ? "member_promoted" : "member_demoted",
            targetType: "member",
            targetId: targetMember.id,
            details: {
                targetUserId,
                previousRoleId: targetMember.roleId,
                previousRole: targetMember.role?.name,
                newRoleId,
                newRole: targetNewRole.name,
                rankDelta: targetNewRole.rank - currentTargetRank,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    /**
     * Removes a member from workspace and all assigned departments, respecting role hierarchy.
     */
    static async removeMember(
        workspaceId: string,
        actorUserId: string,
        targetUserId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const actorCtx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!actorCtx) {
            throw new Error("Unauthorized: Workspace access denied.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) {
            throw new Error("Target user is not a member of this workspace.");
        }

        // Protection: Cannot remove workspace owner
        if (targetMember.role?.slug === "owner" || targetMember.role?.rank === 1000) {
            throw new Error("The workspace owner cannot be removed.");
        }

        // Hierarchy rule: Actor must outrank target (unless owner)
        const actorRank = actorCtx.isOwner ? 1000 : (actorCtx.member.role?.rank || 0);
        const targetRank = targetMember.role?.rank || 0;
        if (actorRank <= targetRank && !actorCtx.isOwner) {
            throw new Error("Cannot remove a member with equal or higher hierarchy rank.");
        }

        // Permission check
        const isMgr = actorCtx.isWorkspaceManager;
        const mgrPerms = (actorCtx.workspace.managerPermissions || {}) as Record<string, any>;
        const canRemove =
            actorCtx.isOwner ||
            actorCtx.isAdmin ||
            (isMgr && !!mgrPerms.can_manage_members) ||
            actorCtx.permissions.includes("members:remove");

        if (!canRemove) {
            throw new Error("Forbidden: You do not possess permission to remove workspace members.");
        }

        // 1. Remove from all department member associations
        await query(
            `DELETE FROM public.workspace_department_members WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, targetUserId]
        );

        // 2. Remove workspace membership row
        const delRes = await query(
            `DELETE FROM public.workspace_members WHERE workspace_id = $1 AND user_id = $2;`,
            [workspaceId, targetUserId]
        );

        // 3. Invalidate Redis capabilities, permissions, unread, and directory caches
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId, targetUserId);

        this.broadcastEvent(workspaceId, "member:removed", {
            memberId: targetMember.id,
            userId: targetUserId,
        });

        // 4. Audit log
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "member_removed",
            targetType: "member",
            targetId: targetMember.id,
            details: {
                targetUserId,
                targetRole: targetMember.role?.name,
                targetRank,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return (delRes.rowCount || 0) > 0;
    }

    // =========================================================================
    // 3. SECURE CRYPTOGRAPHIC INVITATION WORKFLOW
    // =========================================================================

    /**
     * Generates a secure single-use invitation token and stores its SHA-256 hash
     */
    static async createInvitation(
        workspaceId: string,
        actorUserId: string,
        data: {
            email: string;
            roleId: string;
            departmentId?: string | null;
            invitationMessage?: string | null;
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<{ invitation: WorkspaceInvitation; rawToken: string }> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("members:invite"))) {
            throw new Error("Unauthorized to invite members into this workspace.");
        }

        // Rate limiting: max 20 invites per 60 seconds per actor
        const rate = await WorkspaceRedisService.checkRateLimit(`inv:${workspaceId}:${actorUserId}`, 20, 60);
        if (!rate.allowed) {
            throw new Error("Invitation rate limit exceeded. Please wait a moment before sending more invitations.");
        }

        const email = data.email.trim().toLowerCase();
        if (!email || !email.includes("@")) {
            throw new Error("Valid email address is required.");
        }

        // Validate role exists and actor has rank to assign it
        const role = await WorkspaceRepository.findRoleById(workspaceId, data.roleId);
        if (!role) throw new Error("Selected role does not exist.");

        const actorRank = ctx.member.role?.rank || 0;
        if (role.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot invite a member with a role equal to or higher than your own.");
        }

        // Validate optional department
        if (data.departmentId) {
            const dept = await WorkspaceRepository.findDepartmentById(workspaceId, data.departmentId);
            if (!dept) throw new Error("Selected department does not exist.");
        }

        // Check if user already exists in workspace
        const existingUserRes = await query(
            `SELECT id FROM public.users WHERE LOWER(email) = $1 LIMIT 1;`,
            [email]
        );
        const existingUserId = existingUserRes.rows[0]?.id || null;

        if (existingUserId) {
            const alreadyMember = await WorkspaceRepository.findMember(workspaceId, existingUserId);
            if (alreadyMember && alreadyMember.membershipStatus === "active") {
                throw new Error("This user is already an active member of this workspace.");
            }
        }

        // Generate 64-character cryptographically secure token
        const rawToken = crypto.randomBytes(32).toString("hex");
        // Compute SHA-256 hash for database persistence
        const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

        const invitation = await WorkspaceRepository.createInvitation(null, {
            workspaceId,
            inviterId: actorUserId,
            email,
            roleId: data.roleId,
            departmentId: data.departmentId || null,
            invitedUserId: existingUserId,
            tokenHash,
            invitationMessage: data.invitationMessage || null,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "invitation_created",
            targetType: "invitation",
            targetId: invitation.id,
            details: { email, roleId: data.roleId, departmentId: data.departmentId },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return { invitation, rawToken };
    }

    /**
     * Revokes a pending invitation
     */
    static async revokeInvitation(
        workspaceId: string,
        actorUserId: string,
        invitationId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("members:remove"))) {
            throw new Error("Unauthorized to revoke invitations.");
        }

        const invitation = await WorkspaceRepository.findInvitationById(workspaceId, invitationId);
        if (!invitation || invitation.status !== "pending") {
            throw new Error("Invitation not found or is no longer pending.");
        }

        const revoked = await WorkspaceRepository.updateInvitationStatus(invitationId, "revoked", {
            revokedAt: new Date(),
            revokedBy: actorUserId,
        });

        if (revoked) {
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "invitation_revoked",
                targetType: "invitation",
                targetId: invitationId,
                details: { email: invitation.email },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });
        }

        return revoked;
    }

    /**
     * Accepts an invitation using the raw token
     * Enforces single-use, non-expired, and tenant isolation.
     */
    static async acceptInvitation(
        rawToken: string,
        acceptingUserId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<{ workspace: TeamWorkspace; member: WorkspaceMember }> {
        const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
        const invitation = await WorkspaceRepository.findInvitationByTokenHash(tokenHash);

        if (!invitation) {
            throw new Error("Invalid or unrecognized invitation token.");
        }

        if (invitation.status !== "pending") {
            throw new Error(`This invitation has already been ${invitation.status}.`);
        }

        if (new Date(invitation.expiresAt) < new Date()) {
            await WorkspaceRepository.updateInvitationStatus(invitation.id, "expired");
            throw new Error("This invitation has expired.");
        }

        // Verify accepting user
        const userRes = await query(
            `SELECT id, email, username FROM public.users WHERE id = $1 LIMIT 1;`,
            [acceptingUserId]
        );
        const user = userRes.rows[0];
        if (!user) throw new Error("Authenticated user not found.");

        const workspace = await WorkspaceRepository.findById(invitation.workspaceId);
        if (!workspace || workspace.workspaceStatus === "archived") {
            throw new Error("The associated workspace is no longer active.");
        }

        // Revalidate inviter's status and invitation permissions at acceptance time
        const inviterCtx = await WorkspaceService.resolveContext(invitation.workspaceId, invitation.inviterId);
        if (!inviterCtx || inviterCtx.member.isSuspended || (!inviterCtx.isAdmin && !inviterCtx.permissions.includes("members:invite"))) {
            await WorkspaceRepository.updateInvitationStatus(invitation.id, "revoked", {
                revokedAt: new Date(),
                revokedBy: invitation.inviterId,
            });
            throw new Error("This invitation is no longer valid because the inviting member's permissions have changed.");
        }

        // Multi-record operation inside transaction
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // 1. Create or restore workspace membership
            const member = await WorkspaceRepository.createMember(client, {
                workspaceId: workspace.id,
                userId: acceptingUserId,
                roleId: invitation.roleId,
                departmentId: invitation.departmentId || null,
                roleTitle: invitation.role?.name || "Member",
                membershipStatus: "active",
                invitedBy: invitation.inviterId,
            });

            // 2. If invitation was department-scoped, auto-assign into department
            if (invitation.departmentId) {
                await WorkspaceRepository.addDepartmentMember(client, {
                    workspaceId: workspace.id,
                    departmentId: invitation.departmentId,
                    memberId: member.id,
                    userId: acceptingUserId,
                    departmentRole: "member",
                    roleTitle: "Department Member",
                    assignedBy: invitation.inviterId,
                });
            }

            // 3. Mark invitation as accepted (single-use enforcement)
            await client.query(
                `UPDATE public.workspace_invitations
                 SET status = 'accepted',
                     accepted_at = NOW(),
                     invited_user_id = $2,
                     updated_at = NOW()
                 WHERE id = $1;`,
                [invitation.id, acceptingUserId]
            );

            // 4. Log audit record
            await WorkspaceRepository.logAudit(client, {
                workspaceId: workspace.id,
                actorId: acceptingUserId,
                action: "invitation_accepted",
                targetType: "member",
                targetId: member.id,
                details: {
                    invitationId: invitation.id,
                    email: invitation.email,
                    roleId: invitation.roleId,
                    departmentId: invitation.departmentId,
                },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await client.query("COMMIT;");

            // Invalidate permissions cache
            await WorkspaceRedisService.invalidateMemberPermissions(workspace.id, acceptingUserId);

            const fullMember = await WorkspaceRepository.findMember(workspace.id, acceptingUserId);
            return { workspace, member: fullMember || member };
        } catch (err: any) {
            await client.query("ROLLBACK;");
            throw err;
        } finally {
            client.release();
        }
    }

    /**
     * Inspects and verifies an invitation token without consuming it.
     * Exposes target workspace, club, and intended role for preview cards.
     */
    static async verifyInvitation(rawToken: string): Promise<{
        isValid: boolean;
        reason?: string;
        invitation?: {
            id: string;
            email: string;
            workspaceId: string;
            workspaceName: string;
            workspaceSlug: string;
            clubName: string | null;
            roleName: string;
            roleRank: number;
            departmentName: string | null;
            inviterName: string;
            invitationMessage: string | null;
            expiresAt: Date;
        };
    }> {
        if (!rawToken || !rawToken.trim()) {
            return { isValid: false, reason: "Token is required." };
        }

        const tokenHash = crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
        const invitation = await WorkspaceRepository.findInvitationByTokenHash(tokenHash);

        if (!invitation) {
            return { isValid: false, reason: "Invalid or unrecognized invitation token." };
        }

        if (invitation.status !== "pending") {
            return { isValid: false, reason: `This invitation has already been ${invitation.status}.` };
        }

        if (new Date(invitation.expiresAt) < new Date()) {
            return { isValid: false, reason: "This invitation has expired." };
        }

        const workspace = await WorkspaceRepository.findById(invitation.workspaceId);
        if (!workspace || workspace.workspaceStatus === "archived") {
            return { isValid: false, reason: "The associated workspace is no longer active." };
        }

        // Revalidate inviter status
        const inviterCtx = await WorkspaceService.resolveContext(invitation.workspaceId, invitation.inviterId);
        if (!inviterCtx || inviterCtx.member.isSuspended || (!inviterCtx.isAdmin && !inviterCtx.permissions.includes("members:invite"))) {
            return { isValid: false, reason: "The inviting member is no longer authorized to issue invitations." };
        }

        // Fetch club and inviter names
        const clubRes = await query(`SELECT name FROM public.verified_clubs WHERE id = $1 LIMIT 1;`, [workspace.clubId]);
        const inviterRes = await query(`SELECT firstname, lastname, username FROM public.users WHERE id = $1 LIMIT 1;`, [invitation.inviterId]);
        const inviter = inviterRes.rows[0];
        const inviterName = inviter
            ? (inviter.firstname ? `${inviter.firstname} ${inviter.lastname || ""}`.trim() : inviter.username)
            : "Workspace Member";

        return {
            isValid: true,
            invitation: {
                id: invitation.id,
                email: invitation.email,
                workspaceId: workspace.id,
                workspaceName: workspace.name,
                workspaceSlug: workspace.slug,
                clubName: clubRes.rows[0]?.name || null,
                roleName: invitation.role?.name || "Member",
                roleRank: invitation.role?.rank || 100,
                departmentName: invitation.department?.name || null,
                inviterName,
                invitationMessage: invitation.invitationMessage,
                expiresAt: new Date(invitation.expiresAt),
            },
        };
    }

    // =========================================================================
    // 5. CUSTOM ROLE MANAGEMENT & ESCALATION DEFENSES
    // =========================================================================

    static async createCustomRole(
        workspaceId: string,
        actorUserId: string,
        data: {
            name: string;
            description?: string;
            rank: number;
            color?: string;
            permissions: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceRole> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("roles:create"))) {
            throw new Error("Unauthorized to create roles in this workspace.");
        }

        const actorRank = ctx.member.role?.rank || 0;

        // Escalation Protection 1: Non-owners cannot create roles with rank >= their own rank
        if (data.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot create a role with rank equal to or greater than your own.");
        }

        // Escalation Protection 2: Max rank for custom roles is 799 (cannot match or exceed Admin rank 800)
        if (data.rank >= 800 && !ctx.isOwner) {
            throw new Error("Custom roles cannot exceed rank 799.");
        }

        // Escalation Protection 3: Cannot grant permissions that actor does not possess (unless Owner)
        if (!ctx.isOwner && !ctx.permissions.includes("*")) {
            const forbiddenPerms = data.permissions.filter((p) => !ctx.permissions.includes(p));
            if (forbiddenPerms.length > 0) {
                throw new Error(`Cannot grant permissions you do not possess: ${forbiddenPerms.join(", ")}`);
            }
        }

        // Generate slug
        const baseSlug = data.name.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-");
        const existingRole = await WorkspaceRepository.findRoleBySlug(workspaceId, baseSlug);
        const slug = existingRole ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

        const rolePayload: any = {
            workspaceId,
            name: data.name.trim(),
            slug,
            rank: data.rank,
            isSystem: false,
            color: data.color || "#475569",
            permissions: data.permissions || [],
        };
        if (data.description !== undefined) {
            rolePayload.description = data.description;
        }

        const role = await WorkspaceRepository.createRole(null, rolePayload);

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "role_created",
            targetType: "role",
            targetId: role.id,
            details: { name: role.name, rank: role.rank, permissions: role.permissions },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return role;
    }

    static async updateCustomRole(
        workspaceId: string,
        actorUserId: string,
        roleId: string,
        data: {
            name?: string;
            description?: string;
            rank?: number;
            color?: string;
            permissions?: string[];
        },
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceRole> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("roles:manage"))) {
            throw new Error("Unauthorized to manage roles in this workspace.");
        }

        const existingRole = await WorkspaceRepository.findRoleById(workspaceId, roleId);
        if (!existingRole) throw new Error("Role not found.");

        if (existingRole.isSystem) {
            throw new Error("System roles cannot be modified.");
        }

        const actorRank = ctx.member.role?.rank || 0;

        // Actor must outrank existing role
        if (existingRole.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot modify a role with equal or higher rank than your own.");
        }

        // New rank cannot be >= actor's rank
        if (data.rank !== undefined && data.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot set role rank equal to or greater than your own.");
        }

        // Validate permissions: cannot grant permissions actor does not possess
        if (data.permissions && !ctx.isOwner && !ctx.permissions.includes("*")) {
            const forbiddenPerms = data.permissions.filter((p) => !ctx.permissions.includes(p));
            if (forbiddenPerms.length > 0) {
                throw new Error(`Cannot grant permissions you do not possess: ${forbiddenPerms.join(", ")}`);
            }
        }

        const updated = await WorkspaceRepository.updateRole(workspaceId, roleId, data);
        if (!updated) throw new Error("Failed to update role.");

        // Invalidate all permissions, capabilities, and directory caches in this workspace
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId);
        this.broadcastEvent(workspaceId, "role:updated", { roleId, data });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "role_updated",
            targetType: "role",
            targetId: roleId,
            details: data,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }

    static async deleteCustomRole(
        workspaceId: string,
        actorUserId: string,
        roleId: string,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<boolean> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("roles:manage"))) {
            throw new Error("Unauthorized to delete roles in this workspace.");
        }

        const role = await WorkspaceRepository.findRoleById(workspaceId, roleId);
        if (!role) throw new Error("Role not found.");

        if (role.isSystem) {
            throw new Error("System roles cannot be deleted.");
        }

        const actorRank = ctx.member.role?.rank || 0;
        if (role.rank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot delete a role with equal or higher rank than your own.");
        }

        // Find fallback role (default member role)
        const defaultMemberRole = await WorkspaceRepository.findRoleBySlug(workspaceId, "member");
        if (!defaultMemberRole) throw new Error("Default member role not found.");

        const deleted = await WorkspaceRepository.deleteRole(workspaceId, roleId, defaultMemberRole.id);

        if (deleted) {
            // Invalidate all permissions, capabilities, and directory caches
            await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId);
            this.broadcastEvent(workspaceId, "role:deleted", { roleId });

            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "role_deleted",
                targetType: "role",
                targetId: roleId,
                details: { name: role.name, fallbackRoleId: defaultMemberRole.id },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });
        }

        return deleted;
    }

    /**
     * Reorders role hierarchy ranks safely with escalation defenses.
     */
    static async reorderRoles(
        workspaceId: string,
        actorUserId: string,
        updates: Array<{ id: string; rank?: number }> | string[],
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceRole[]> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("roles:manage") && !ctx.isOwner)) {
            throw new Error("Unauthorized to manage roles in this workspace.");
        }

        const actorRank = ctx.member.role?.rank || 0;
        const allRoles = await WorkspaceRepository.listRoles(workspaceId);
        const roleMap = new Map(allRoles.map((r) => [r.id, r]));

        // Normalize updates into { id, rank }[]
        let normalizedUpdates: Array<{ id: string; rank: number }> = [];

        if (updates.length > 0 && typeof updates[0] === "string") {
            // updates is array of role IDs in descending rank order
            const roleIds = updates as string[];
            let currentRank = 750;
            for (const rId of roleIds) {
                normalizedUpdates.push({ id: rId, rank: currentRank });
                currentRank = Math.max(210, currentRank - 10);
            }
        } else {
            normalizedUpdates = (updates as Array<{ id: string; rank: number }>).map((u) => ({
                id: u.id,
                rank: Number(u.rank),
            }));
        }

        const validUpdates: Array<{ id: string; rank: number }> = [];

        for (const item of normalizedUpdates) {
            const role = roleMap.get(item.id);
            if (!role) {
                throw new Error(`Role ${item.id} not found in this workspace.`);
            }

            // System roles cannot have their ranks altered
            if (role.isSystem) {
                continue;
            }

            // Escalation Protection: non-owners cannot touch roles equal or above their rank
            if (role.rank >= actorRank && !ctx.isOwner) {
                throw new Error(`Cannot reorder role "${role.name}" with equal or higher rank than your own.`);
            }

            // Escalation Protection: non-owners cannot set rank >= actorRank or >= 800
            if (item.rank >= actorRank && !ctx.isOwner) {
                throw new Error(`Cannot assign rank ${item.rank} equal to or greater than your own rank (${actorRank}).`);
            }
            if (item.rank >= 800 && !ctx.isOwner) {
                throw new Error("Custom roles cannot exceed rank 799.");
            }

            validUpdates.push(item);
        }

        if (validUpdates.length === 0) {
            return allRoles;
        }

        const updatedRoles = await WorkspaceRepository.reorderRoles(workspaceId, validUpdates);

        // Invalidate all permissions, capabilities, and directory caches
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId);
        this.broadcastEvent(workspaceId, "roles:reordered", { updates: validUpdates });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "roles_reordered",
            targetType: "role",
            targetId: workspaceId,
            details: { updates: validUpdates },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updatedRoles;
    }

    // =========================================================================
    // 6. PHASE 01: MEMBER-SPECIFIC CUSTOM PERMISSION OVERRIDES
    // =========================================================================

    /**
     * Updates member-specific custom permissions (grants or revocations)
     */
    static async updateMemberCustomPermissions(
        workspaceId: string,
        targetUserId: string,
        actorUserId: string,
        customPermissions: Record<string, boolean>,
        reqMeta: { ipAddress?: string; userAgent?: string } = {}
    ): Promise<WorkspaceMember> {
        const ctx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (!ctx || (!ctx.isAdmin && !ctx.permissions.includes("roles:manage") && !ctx.isOwner)) {
            throw new Error("Unauthorized to modify member permissions.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) throw new Error("Target user is not a member of this workspace.");

        const actorRank = ctx.member.role?.rank || 0;
        const targetRank = targetMember.role?.rank || 0;
        if (targetRank >= actorRank && !ctx.isOwner) {
            throw new Error("Cannot modify permissions of a member with equal or higher rank.");
        }

        // Validate that actor cannot grant permissions they do not possess (unless Owner)
        if (!ctx.isOwner && !ctx.permissions.includes("*")) {
            for (const [perm, granted] of Object.entries(customPermissions)) {
                if (granted && !ctx.permissions.includes(perm)) {
                    throw new Error(`Cannot grant permission you do not possess: ${perm}`);
                }
            }
        }

        const updated = await WorkspaceRepository.updateMemberCustomPermissions(
            workspaceId,
            targetUserId,
            customPermissions
        );

        if (!updated) throw new Error("Failed to update custom permissions.");

        // Invalidate member permissions, capabilities, and directory in Redis
        await WorkspaceRedisService.invalidateOnSecurityChange(workspaceId, targetUserId);

        this.broadcastEvent(workspaceId, "member:permissions_updated", {
            memberId: targetMember.id,
            userId: targetUserId,
            customPermissions,
        });

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "member_custom_permissions_updated",
            targetType: "member",
            targetId: targetMember.id,
            details: {
                targetUserId,
                customPermissions,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        return updated;
    }
}
