import express, { type Request, type Response } from "express";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { ClubTeamService } from "../../services/club/clubTeamService.js";

const clubTeamRouter = express.Router();

/**
 * Middleware helper to extract clubId from query, body, or default to caller's verified club.
 */
async function resolveClubContext(req: Request, res: Response): Promise<{ clubId: string; userId: string } | null> {
    const authUser = (req as any).user;
    if (!authUser || !authUser.id) {
        res.status(401).json({ success: false, message: "Authentication required." });
        return null;
    }

    const requestedClubId = (req.query.clubId as string) || req.body?.clubId || req.params?.clubId;
    const perms = await ClubTeamService.resolveUserClubPermissions(authUser.id, requestedClubId);

    if (!perms) {
        res.status(404).json({ success: false, message: "No club workspace found for your account." });
        return null;
    }

    return { clubId: perms.clubId, userId: authUser.id };
}

/**
 * GET /api/club/team/stats
 * Overview statistics (Total Members, Active Teams, Pending Invitations, Team Leads)
 */
clubTeamRouter.get("/stats", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const stats = await ClubTeamService.getTeamStats(ctx.clubId, ctx.userId);
        return res.json({ success: true, ...stats });
    } catch (err: any) {
        console.error("GET /api/club/team/stats error:", err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to load team stats." });
    }
});

/**
 * GET /api/club/team/teams
 * List all teams/departments
 */
clubTeamRouter.get("/teams", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const includeArchived = req.query.includeArchived === "true" || req.query.includeArchived === "1";
        const teams = await ClubTeamService.listTeams(ctx.clubId, { includeArchived });
        return res.json({ success: true, teams });
    } catch (err: any) {
        console.error("GET /api/club/team/teams error:", err);
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to list teams." });
    }
});

/**
 * POST /api/club/team/teams
 * Create a new team
 */
clubTeamRouter.post("/teams", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const { name, description, responsibilities, leadUserId, coLeadUserId, initialMemberIds } = req.body;
        if (!name || typeof name !== "string") {
            return res.status(400).json({ success: false, message: "Team name is required." });
        }

        const newTeam = await ClubTeamService.createTeam({
            clubId: ctx.clubId,
            userId: ctx.userId,
            name,
            description,
            responsibilities,
            leadUserId,
            coLeadUserId,
            initialMemberIds,
        });

        return res.status(201).json({ success: true, team: newTeam, message: `Team "${newTeam.name}" created successfully.` });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to create team." });
    }
});

/**
 * PATCH /api/club/team/teams/:teamId
 * Edit team details
 */
clubTeamRouter.patch("/teams/:teamId", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const teamId = req.params.teamId as string;
        const { name, description, responsibilities, leadUserId, coLeadUserId } = req.body;

        const updated = await ClubTeamService.updateTeam({
            clubId: ctx.clubId,
            teamId,
            userId: ctx.userId,
            name,
            description,
            responsibilities,
            leadUserId,
            coLeadUserId,
        });

        return res.json({ success: true, team: updated, message: "Team updated successfully." });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to update team." });
    }
});

/**
 * POST /api/club/team/teams/:teamId/archive
 * Toggle archive state of a team
 */
clubTeamRouter.post("/teams/:teamId/archive", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const teamId = req.params.teamId as string;
        const isArchived = req.body.isArchived !== false;

        const result = await ClubTeamService.archiveTeam(ctx.clubId, teamId, isArchived, ctx.userId);
        return res.json({
            success: true,
            team: result,
            message: `Team ${isArchived ? "archived" : "unarchived"} successfully.`,
        });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to archive team." });
    }
});

/**
 * DELETE /api/club/team/teams/:teamId
 * Delete a team
 */
clubTeamRouter.delete("/teams/:teamId", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const teamId = req.params.teamId as string;
        const result = await ClubTeamService.deleteTeam(ctx.clubId, teamId, ctx.userId);
        return res.json({ success: true, message: `Team "${result.name}" deleted successfully.` });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to delete team." });
    }
});

/**
 * GET /api/club/team/search-users
 * Search registered Orbix users by username
 */
clubTeamRouter.get("/search-users", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const q = String(req.query.q || req.query.query || "").trim();
        const users = await ClubTeamService.searchUsers(q, ctx.clubId);
        return res.json({ success: true, users });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Search failed." });
    }
});

/**
 * GET /api/club/team/members
 * Full roster of club members
 */
clubTeamRouter.get("/members", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const teamId = req.query.teamId as string | undefined;
        const role = req.query.role as string | undefined;
        const search = req.query.search as string | undefined;

        const filterParams: { teamId?: string; role?: string; search?: string } = {};
        if (teamId) filterParams.teamId = teamId;
        if (role) filterParams.role = role;
        if (search) filterParams.search = search;

        const members = await ClubTeamService.listMembers(ctx.clubId, filterParams);
        return res.json({ success: true, members });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to list members." });
    }
});

/**
 * PATCH /api/club/team/members/:membershipId
 * Update a member's club role, title, or status
 */
clubTeamRouter.patch("/members/:membershipId", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const membershipId = req.params.membershipId as string;
        const { clubRole, title, status } = req.body;

        const updated = await ClubTeamService.updateMember({
            clubId: ctx.clubId,
            membershipId,
            updates: { clubRole, title, status },
            actorUserId: ctx.userId,
        });

        return res.json({ success: true, member: updated, message: "Member updated successfully." });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to update member." });
    }
});

/**
 * DELETE /api/club/team/members/:membershipId
 * Remove a member from the club
 */
clubTeamRouter.delete("/members/:membershipId", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const membershipId = req.params.membershipId as string;
        await ClubTeamService.removeMember(ctx.clubId, membershipId, ctx.userId);
        return res.json({ success: true, message: "Member removed from club successfully." });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to remove member." });
    }
});

/**
 * POST /api/club/team/members/:membershipId/assign-team
 * Assign existing member to a team
 */
clubTeamRouter.post("/members/:membershipId/assign-team", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const { teamId, userId: targetUserId, teamRole, positionTitle } = req.body;
        if (!teamId || !targetUserId) {
            return res.status(400).json({ success: false, message: "Team ID and User ID are required." });
        }

        const assignment = await ClubTeamService.assignMemberToTeam(
            ctx.clubId,
            teamId,
            targetUserId,
            teamRole || "member",
            positionTitle || "Member",
            ctx.userId
        );

        return res.json({ success: true, assignment, message: "Member assigned to team successfully." });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to assign team." });
    }
});

/**
 * DELETE /api/club/team/teams/:teamId/members/:targetUserId
 * Remove a member from a specific team
 */
clubTeamRouter.delete("/teams/:teamId/members/:targetUserId", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const teamId = req.params.teamId as string;
        const targetUserId = req.params.targetUserId as string;
        await ClubTeamService.removeMemberFromTeam(ctx.clubId, teamId, targetUserId, ctx.userId);
        return res.json({ success: true, message: "Member removed from team." });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to remove member from team." });
    }
});

/**
 * GET /api/club/team/invitations
 * List invitations
 */
clubTeamRouter.get("/invitations", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const status = req.query.status as string | undefined;
        const invitations = await ClubTeamService.listInvitations(ctx.clubId, status);
        return res.json({ success: true, invitations });
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to list invitations." });
    }
});

/**
 * POST /api/club/team/invitations
 * Create and send invitation
 */
clubTeamRouter.post("/invitations", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const { username, userId: targetUserId, teamId, clubRole, teamRole, title, invitationMessage } = req.body;
        const target = username || targetUserId;
        if (!target) {
            return res.status(400).json({ success: false, message: "Username or user ID is required." });
        }

        const result = await ClubTeamService.createInvitation({
            clubId: ctx.clubId,
            inviterUserId: ctx.userId,
            targetUsernameOrId: target,
            teamId,
            clubRole,
            teamRole,
            title,
            invitationMessage,
        });

        return res.status(201).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to create invitation." });
    }
});

/**
 * POST /api/club/team/invitations/:invitationId/cancel
 * Cancel a pending invitation
 */
clubTeamRouter.post("/invitations/:invitationId/cancel", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const invitationId = req.params.invitationId as string;
        const result = await ClubTeamService.cancelInvitation(ctx.clubId, invitationId, ctx.userId);
        return res.json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to cancel invitation." });
    }
});

/**
 * POST /api/club/team/invitations/:invitationId/resend
 * Resend an invitation with fresh 7-day expiration
 */
clubTeamRouter.post("/invitations/:invitationId/resend", authenticate, async (req: Request, res: Response) => {
    try {
        const ctx = await resolveClubContext(req, res);
        if (!ctx) return;

        const invitationId = req.params.invitationId as string;
        const result = await ClubTeamService.resendInvitation(ctx.clubId, invitationId, ctx.userId);
        return res.json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({ success: false, message: err.message || "Failed to resend invitation." });
    }
});

/**
 * POST /api/club/team/invitations/:invitationId/accept
 * Executed by the invited recipient
 */
clubTeamRouter.post("/invitations/:invitationId/accept", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const invitationId = req.params.invitationId as string;
        const result = await ClubTeamService.acceptInvitation(invitationId, authUser.id);
        return res.json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message || "Failed to accept invitation." });
    }
});

/**
 * POST /api/club/team/invitations/:invitationId/decline
 * Executed by the invited recipient
 */
clubTeamRouter.post("/invitations/:invitationId/decline", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser || !authUser.id) {
            return res.status(401).json({ success: false, message: "Authentication required." });
        }

        const invitationId = req.params.invitationId as string;
        const result = await ClubTeamService.declineInvitation(invitationId, authUser.id);
        return res.json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({ success: false, message: err.message || "Failed to decline invitation." });
    }
});

export default clubTeamRouter;
