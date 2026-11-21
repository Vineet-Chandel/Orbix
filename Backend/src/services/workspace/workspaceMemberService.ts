// Backend/src/services/workspace/workspaceMemberService.ts
import crypto from "crypto";
import { pool, query } from "../../database/client.js";
import { WorkspaceRepository } from "../../repositories/workspaceRepository.js";
import { WorkspaceService } from "./workspaceService.js";
import { WorkspaceRedisService } from "../../redis/workspaceRedis.js";
import { workspaceEventBus } from "./workspaceChannelService.js";
import { ClubTeamService } from "../club/clubTeamService.js";
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

        const actorCtx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (workspace.ownerId !== actorUserId && !actorCtx?.isClubAccount && !actorCtx?.isOwner) {
            throw new Error("Only the Club Owner has authority to appoint or change the Workspace Manager.");
        }

        // Verify target user is an active personal member of this workspace
        const member = await WorkspaceRepository.findMember(workspaceId, managerUserId);
        if (!member || member.isSuspended || member.user?.accountType === "club") {
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

        const correlationId = crypto.randomUUID();
        const managerName = member.user
            ? `${member.user.firstName || ""} ${member.user.lastName || ""}`.trim() || member.user.username
            : "Workspace Member";

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "workspace_manager_appointed",
            targetType: "workspace_manager",
            targetId: managerUserId,
            correlationId,
            details: { managerUserId, targetName: managerName, permissions },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: member.departmentId || null,
            actorId: actorUserId,
            eventType: "member:manager_updated",
            resourceType: "member",
            resourceId: member.id,
            title: `Appointed ${managerName} as Workspace Manager`,
            isRestricted: false,
            correlationId,
            metadata: { targetUserId: managerUserId, targetName: managerName },
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

        const actorCtx = await WorkspaceService.resolveContext(workspaceId, actorUserId);
        if (workspace.ownerId !== actorUserId && !actorCtx?.isClubAccount && !actorCtx?.isOwner) {
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

        const correlationId = crypto.randomUUID();
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "workspace_manager_revoked",
            targetType: "workspace_manager",
            targetId: previousManagerId,
            correlationId,
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: null,
            actorId: actorUserId,
            eventType: "member:manager_updated",
            resourceType: "workspace",
            resourceId: workspaceId,
            title: "Revoked Workspace Manager designation",
            isRestricted: false,
            correlationId,
            metadata: { previousManagerId },
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
        if (!ctx) {
            throw new Error("Unauthorized to assign member roles.");
        }

        const rawMgrPerms = ctx.workspace.managerPermissions || {};
        const mgrPerms: Record<string, any> = Array.isArray(rawMgrPerms)
            ? rawMgrPerms.reduce((acc, p) => ({ ...acc, [p]: true }), {} as Record<string, boolean>)
            : (rawMgrPerms as Record<string, any>);
        const isAuthorizedManager = ctx.isWorkspaceManager && !!mgrPerms.can_manage_members;

        if (!ctx.isClubAccount && !ctx.isAdmin && !ctx.permissions.includes("members:assign_role") && !isAuthorizedManager && !ctx.isOwner) {
            throw new Error("Unauthorized to assign member roles.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) throw new Error("Target user is not a member of this workspace.");

        if (targetMember.user?.accountType === "club") {
            throw new Error("The club account role cannot be modified.");
        }

        const targetNewRole = await WorkspaceRepository.findRoleById(workspaceId, newRoleId);
        if (!targetNewRole) throw new Error("Target role does not exist in this workspace.");

        const actorIsClubAccount = Boolean(ctx.isClubAccount);

        // Hierarchy Protection 1: Personal actors cannot alter a Workspace Owner
        if ((targetMember.role?.slug === "owner" || (targetMember.role?.rank || 0) >= 1000) && !actorIsClubAccount) {
            throw new Error("The workspace owner role cannot be modified by personal members.");
        }

        // Hierarchy Protection 2: Personal actors cannot grant the Workspace Owner role
        if ((targetNewRole.slug === "owner" || targetNewRole.rank >= 1000) && !actorIsClubAccount) {
            throw new Error("The workspace owner role cannot be granted through personal role assignment.");
        }

        // Hierarchy Protection 3: Personal actors must strictly outrank target user
        const actorRank = ctx.member.role?.rank || 0;
        const currentTargetRank = targetMember.role?.rank || 0;
        if (!actorIsClubAccount && actorRank <= currentTargetRank) {
            throw new Error("Cannot modify roles of a member with equal or higher rank.");
        }

        // Hierarchy Protection 4: Personal actors cannot assign a role with rank >= actor's rank
        if (!actorIsClubAccount && targetNewRole.rank >= actorRank) {
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
        const correlationId = crypto.randomUUID();
        const targetName = targetMember.user
            ? `${targetMember.user.firstName || ""} ${targetMember.user.lastName || ""}`.trim() || targetMember.user.username
            : "Workspace Member";

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: isPromotion ? "member_promoted" : "member_demoted",
            targetType: "member",
            targetId: targetMember.id,
            correlationId,
            details: {
                targetUserId,
                targetName,
                previousRoleId: targetMember.roleId,
                previousRole: targetMember.role?.name,
                newRoleId,
                newRole: targetNewRole.name,
                rankDelta: targetNewRole.rank - currentTargetRank,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: targetMember.departmentId || null,
            actorId: actorUserId,
            eventType: "member:role_updated",
            resourceType: "member",
            resourceId: targetMember.id,
            title: `${targetName} -> ${targetNewRole.name}`,
            isRestricted: false,
            correlationId,
            metadata: {
                targetUserId,
                targetName,
                newRoleName: targetNewRole.name,
                newRole: targetNewRole.name,
            },
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

        if (targetUserId === actorUserId) {
            throw new Error("You cannot remove your own workspace membership.");
        }

        if (targetMember.user?.accountType === "club") {
            throw new Error("The club account cannot be removed from its workspace.");
        }

        const actorIsClubAccount = Boolean(actorCtx.isClubAccount);

        // Protection: Personal actors cannot remove a Workspace Owner; Club account has supreme removal right
        const isTargetOwner = targetMember.role?.slug === "owner" || (targetMember.role?.rank || 0) >= 1000;
        if (isTargetOwner && !actorIsClubAccount) {
            throw new Error("The workspace owner cannot be removed.");
        }

        // Hierarchy rule: Personal actors must strictly outrank target
        const actorRank = actorCtx.member.role?.rank || 0;
        const targetRank = targetMember.role?.rank || 0;
        if (!actorIsClubAccount && actorRank <= targetRank) {
            throw new Error("Cannot remove a member with equal or higher hierarchy rank.");
        }

        // Permission check
        const isMgr = actorCtx.isWorkspaceManager;
        const mgrPerms = (actorCtx.workspace.managerPermissions || {}) as Record<string, any>;
        const canRemove =
            actorIsClubAccount ||
            actorCtx.isOwner ||
            actorCtx.isAdmin ||
            (isMgr && !!mgrPerms.can_manage_members) ||
            actorCtx.permissions.includes("members:remove");

        if (!canRemove) {
            throw new Error("Forbidden: You do not possess permission to remove workspace members.");
        }

        // 0. Clear Workspace Manager designation if target held it
        if (actorCtx.workspace.managerUserId === targetUserId) {
            await WorkspaceRepository.setWorkspaceManager(workspaceId, null, []);
            await WorkspaceRedisService.invalidateWorkspace(actorCtx.workspace.clubId);
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

        // 4. Audit log + correlated activity
        const correlationId = crypto.randomUUID();
        const removedName = targetMember.user
            ? `${targetMember.user.firstName || ""} ${targetMember.user.lastName || ""}`.trim() || targetMember.user.username
            : "Workspace Member";

        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "member_removed",
            targetType: "member",
            targetId: targetMember.id,
            correlationId,
            details: {
                targetUserId,
                targetName: removedName,
                targetRole: targetMember.role?.name,
                targetRank,
            },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: targetMember.departmentId || null,
            actorId: actorUserId,
            eventType: "member:removed",
            resourceType: "member",
            resourceId: targetMember.id,
            title: removedName,
            isRestricted: false,
            correlationId,
            metadata: { targetUserId, targetName: removedName },
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
        const rawMgrPerms = ctx?.workspace.managerPermissions || {};
        const mgrPerms: Record<string, any> = Array.isArray(rawMgrPerms)
            ? rawMgrPerms.reduce((acc, p) => ({ ...acc, [p]: true }), {} as Record<string, boolean>)
            : (rawMgrPerms as Record<string, any>);
        const isAuthorizedManager = Boolean(
            ctx?.isWorkspaceManager && (mgrPerms.can_invite_members || mgrPerms.can_manage_members)
        );
        if (
            !ctx ||
            (!ctx.isClubAccount &&
                !ctx.isOwner &&
                !ctx.isAdmin &&
                !ctx.permissions.includes("members:invite") &&
                !isAuthorizedManager)
        ) {
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

        const actorIsClubAccount = Boolean(ctx.isClubAccount);
        if ((role.slug === "owner" || role.rank >= 1000) && !actorIsClubAccount) {
            throw new Error("Only the club account can invite users with the Workspace Owner role.");
        }

        const actorRank = ctx.member.role?.rank || 0;
        if (!actorIsClubAccount && role.rank >= actorRank) {
            throw new Error("Cannot invite a member with a role equal to or higher than your own.");
        }

        // Validate optional department
        if (data.departmentId) {
            const dept = await WorkspaceRepository.findDepartmentById(workspaceId, data.departmentId);
            if (!dept) throw new Error("Selected department does not exist.");
        }

        // Check if target email belongs to an existing Orbix user (personal accounts only; club accounts cannot be invited)
        const existingUserRes = await query(
            `SELECT id, account_type FROM public.users WHERE LOWER(email) = $1 LIMIT 1;`,
            [email]
        );
        const existingUser = existingUserRes.rows[0] || null;
        if (existingUser?.account_type === "club") {
            throw new Error("Club portal accounts cannot be invited as personal workspace members.");
        }
        const existingUserId = existingUser?.id || null;

        if (existingUserId) {
            const managerUserRes = await query(
                `SELECT vc.id, vc.name FROM public.verified_clubs vc
                 JOIN public.team_workspaces tw ON tw.club_id = vc.id
                 WHERE vc.auth_user_id = $1 AND vc.is_active = true AND tw.id != $2 LIMIT 1;`,
                [existingUserId, workspaceId]
            );
            if (managerUserRes.rows.length > 0) {
                throw new Error("Club portal accounts are not permitted to join other club workspaces.");
            }

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

        const correlationId = crypto.randomUUID();
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "invitation_created",
            targetType: "invitation",
            targetId: invitation.id,
            correlationId,
            details: { email, roleId: data.roleId, departmentId: data.departmentId },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: data.departmentId || null,
            actorId: actorUserId,
            eventType: "member:invited",
            resourceType: "invitation",
            resourceId: invitation.id,
            title: email,
            isRestricted: false,
            correlationId,
            metadata: { email, roleId: data.roleId, departmentId: data.departmentId || null },
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
            const correlationId = crypto.randomUUID();
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "invitation_revoked",
                targetType: "invitation",
                targetId: invitationId,
                correlationId,
                details: { email: invitation.email },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await WorkspaceRepository.recordActivityEvent({
                workspaceId,
                departmentId: invitation.departmentId || null,
                actorId: actorUserId,
                eventType: "member:invitation_revoked",
                resourceType: "invitation",
                resourceId: invitationId,
                title: invitation.email,
                isRestricted: false,
                correlationId,
                metadata: { email: invitation.email },
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
        const cleanToken = rawToken.trim();
        const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");
        let invitation = await WorkspaceRepository.findInvitationByTokenHash(tokenHash);

        if (!invitation) {
            // Check if this token belongs to club_team_invitations
            const clubInvRes = await query(
                `SELECT id, club_id FROM public.club_team_invitations WHERE token = $1 LIMIT 1;`,
                [cleanToken]
            );
            const clubInv = clubInvRes.rows[0];
            if (clubInv) {
                await ClubTeamService.acceptInvitation(clubInv.id, acceptingUserId);
                let ws = await WorkspaceRepository.findByClubId(clubInv.club_id);
                if (!ws) {
                    ws = await WorkspaceService.initializeForClub(clubInv.club_id, acceptingUserId);
                }
                const mem = ws ? await WorkspaceRepository.findMember(ws.id, acceptingUserId) : null;
                return {
                    workspace: ws || ({ id: "", name: "Club Workspace" } as any),
                    member: mem || ({ id: "", roleTitle: "Member" } as any),
                };
            }
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
            `SELECT id, email, username, account_type FROM public.users WHERE id = $1 LIMIT 1;`,
            [acceptingUserId]
        );
        const user = userRes.rows[0];
        if (!user) throw new Error("Authenticated user not found.");
        if (user.account_type === "club") {
            throw new Error("Club accounts cannot accept personal workspace member invitations.");
        }

        // Rule: Club managers are not permitted to join other club workspaces with any role
        const managerCheck = await query(
            `SELECT vc.id, vc.name FROM public.verified_clubs vc
             JOIN public.team_workspaces tw ON tw.club_id = vc.id
             WHERE vc.auth_user_id = $1 AND vc.is_active = true AND tw.id != $2 LIMIT 1;`,
            [acceptingUserId, invitation.workspaceId]
        );
        if (managerCheck.rows.length > 0) {
            throw new Error("Club managers are not permitted to join other club workspaces with any role.");
        }

        const workspace = await WorkspaceRepository.findById(invitation.workspaceId);
        if (!workspace || workspace.workspaceStatus === "archived") {
            throw new Error("The associated workspace is no longer active.");
        }

        // Revalidate inviter's status and invitation permissions at acceptance time
        const inviterCtx = await WorkspaceService.resolveContext(invitation.workspaceId, invitation.inviterId);
        if (
            !inviterCtx ||
            inviterCtx.member.isSuspended ||
            (!inviterCtx.isClubAccount &&
                !inviterCtx.isOwner &&
                !inviterCtx.isAdmin &&
                !inviterCtx.permissions.includes("members:invite"))
        ) {
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

            // 3b. Sync into public.club_memberships so both systems are fully unified
            if (workspace.clubId) {
                await client.query(
                    `INSERT INTO public.club_memberships
                        (club_id, user_id, club_role, access_role, title, status, invited_by, joined_at)
                     VALUES ($1, $2, 'member', 'member', $3, 'active', $4, NOW())
                     ON CONFLICT (club_id, user_id) DO UPDATE
                     SET status = 'active', updated_at = NOW();`,
                    [workspace.clubId, acceptingUserId, invitation.role?.name || "Member", invitation.inviterId]
                );
            }

            // 4. Log correlated audit + operational activity records inside transaction
            const correlationId = crypto.randomUUID();
            await WorkspaceRepository.logAudit(client, {
                workspaceId: workspace.id,
                actorId: acceptingUserId,
                action: "invitation_accepted",
                targetType: "member",
                targetId: member.id,
                correlationId,
                details: {
                    invitationId: invitation.id,
                    email: invitation.email,
                    roleId: invitation.roleId,
                    departmentId: invitation.departmentId,
                },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await WorkspaceRepository.recordActivityEvent(
                {
                    workspaceId: workspace.id,
                    departmentId: invitation.departmentId || null,
                    actorId: acceptingUserId,
                    eventType: "member:joined",
                    resourceType: "member",
                    resourceId: member.id,
                    title: invitation.role?.name || "Joined workspace",
                    isRestricted: false,
                    correlationId,
                    metadata: {
                        roleName: invitation.role?.name || "Member",
                        departmentId: invitation.departmentId || null,
                    },
                },
                client
            );

            await client.query("COMMIT;");

            // Invalidate permissions, capabilities, and directory caches
            await WorkspaceRedisService.invalidateOnSecurityChange(workspace.id, acceptingUserId);

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
            clubId?: string;
            clubName: string | null;
            clubSlug?: string | null;
            clubLogoUrl?: string | null;
            collegeName?: string | null;
            roleName: string;
            roleRank: number;
            departmentName: string | null;
            inviterName: string;
            invitationMessage: string | null;
            expiresAt: Date;
            invitationType?: "workspace" | "club_team";
        };
    }> {
        if (!rawToken || !rawToken.trim()) {
            return { isValid: false, reason: "Token is required." };
        }

        const cleanToken = rawToken.trim();
        const tokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");
        const invitation = await WorkspaceRepository.findInvitationByTokenHash(tokenHash);

        if (!invitation) {
            // Check if this token belongs to club_team_invitations
            const clubInvRes = await query(
                `SELECT inv.*, c.id AS "clubId", c.name AS "clubName", c.slug AS "clubSlug", c.logo_url AS "clubLogoUrl", c.college_name AS "collegeName",
                        t.name AS "teamName",
                        u_by.username AS "inviterUsername", u_by.firstname AS "inviterFirstName", u_by.lastname AS "inviterLastName"
                 FROM public.club_team_invitations inv
                 JOIN public.verified_clubs c ON c.id = inv.club_id
                 LEFT JOIN public.club_teams t ON t.id = inv.team_id
                 LEFT JOIN public.users u_by ON u_by.id = inv.inviter_user_id
                 WHERE inv.token = $1 LIMIT 1;`,
                [cleanToken]
            );
            const clubInv = clubInvRes.rows[0];
            if (clubInv) {
                if (clubInv.status !== "pending") {
                    return { isValid: false, reason: `This invitation has already been ${clubInv.status}.` };
                }
                if (new Date(clubInv.expires_at) < new Date()) {
                    return { isValid: false, reason: "This invitation has expired." };
                }
                const inviterName = clubInv.inviterFirstName
                    ? `${clubInv.inviterFirstName} ${clubInv.inviterLastName || ""}`.trim()
                    : (clubInv.inviterUsername || "Club Manager");

                return {
                    isValid: true,
                    invitation: {
                        id: clubInv.id,
                        email: "",
                        workspaceId: "",
                        workspaceName: clubInv.clubName,
                        workspaceSlug: clubInv.clubSlug,
                        clubId: clubInv.clubId,
                        clubName: clubInv.clubName,
                        clubSlug: clubInv.clubSlug,
                        clubLogoUrl: clubInv.clubLogoUrl,
                        collegeName: clubInv.collegeName,
                        roleName: clubInv.position_title || clubInv.team_title || clubInv.title || "Member",
                        roleRank: 100,
                        departmentName: clubInv.teamName || null,
                        inviterName,
                        invitationMessage: clubInv.invitation_message,
                        expiresAt: new Date(clubInv.expires_at),
                        invitationType: "club_team",
                    },
                };
            }

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
        const clubRes = await query(`SELECT id, name, slug, logo_url, college_name FROM public.verified_clubs WHERE id = $1 LIMIT 1;`, [workspace.clubId]);
        const club = clubRes.rows[0];
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
                clubId: club?.id || workspace.clubId,
                clubName: club?.name || null,
                clubSlug: club?.slug || null,
                clubLogoUrl: club?.logo_url || null,
                collegeName: club?.college_name || null,
                roleName: invitation.role?.name || "Member",
                roleRank: invitation.role?.rank || 100,
                departmentName: invitation.department?.name || null,
                inviterName,
                invitationMessage: invitation.invitationMessage,
                expiresAt: new Date(invitation.expiresAt),
                invitationType: "workspace",
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

        const correlationId = crypto.randomUUID();
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "role_created",
            targetType: "role",
            targetId: role.id,
            correlationId,
            details: { name: role.name, rank: role.rank, permissions: role.permissions },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: null,
            actorId: actorUserId,
            eventType: "role:created",
            resourceType: "role",
            resourceId: role.id,
            title: role.name,
            isRestricted: false,
            correlationId,
            metadata: { name: role.name, rank: role.rank },
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

        const correlationId = crypto.randomUUID();
        await WorkspaceRepository.logAudit(null, {
            workspaceId,
            actorId: actorUserId,
            action: "role_updated",
            targetType: "role",
            targetId: roleId,
            correlationId,
            details: { name: updated.name, ...data },
            ipAddress: reqMeta.ipAddress || null,
            userAgent: reqMeta.userAgent || null,
        });

        await WorkspaceRepository.recordActivityEvent({
            workspaceId,
            departmentId: null,
            actorId: actorUserId,
            eventType: "role:updated",
            resourceType: "role",
            resourceId: roleId,
            title: updated.name,
            isRestricted: false,
            correlationId,
            metadata: { name: updated.name },
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

            const correlationId = crypto.randomUUID();
            await WorkspaceRepository.logAudit(null, {
                workspaceId,
                actorId: actorUserId,
                action: "role_deleted",
                targetType: "role",
                targetId: roleId,
                correlationId,
                details: { name: role.name, fallbackRoleId: defaultMemberRole.id },
                ipAddress: reqMeta.ipAddress || null,
                userAgent: reqMeta.userAgent || null,
            });

            await WorkspaceRepository.recordActivityEvent({
                workspaceId,
                departmentId: null,
                actorId: actorUserId,
                eventType: "role:deleted",
                resourceType: "role",
                resourceId: roleId,
                title: role.name,
                isRestricted: false,
                correlationId,
                metadata: { name: role.name },
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
        if (!ctx || (!ctx.isClubAccount && !ctx.isAdmin && !ctx.permissions.includes("roles:manage") && !ctx.isOwner)) {
            throw new Error("Unauthorized to modify member permissions.");
        }

        const targetMember = await WorkspaceRepository.findMember(workspaceId, targetUserId);
        if (!targetMember) throw new Error("Target user is not a member of this workspace.");
        if (targetMember.user?.accountType === "club") {
            throw new Error("Club account permissions cannot be modified.");
        }

        const actorIsClubAccount = Boolean(ctx.isClubAccount);
        const actorRank = ctx.member.role?.rank || 0;
        const targetRank = targetMember.role?.rank || 0;
        if (!actorIsClubAccount && targetRank >= actorRank) {
            throw new Error("Cannot modify permissions of a member with equal or higher rank.");
        }

        // Validate that actor cannot grant permissions they do not possess (unless Club Account or Owner)
        if (!actorIsClubAccount && !ctx.isOwner && !ctx.permissions.includes("*")) {
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
