import express from "express";
import type { Request, Response } from "express";
import { authenticate, requireClubAccount } from "../../middlewares/auth.middleware.js";
import { ClubEventTeamService } from "../../services/club/clubEventTeamService";

export const eventTeamRouter = express.Router();

/**
 * POST /api/events/:eventId/teams
 * Create a new team for an event (creator becomes leader)
 */
eventTeamRouter.post("/events/:eventId/teams", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const userId = req.user!.id;
        const { name } = req.body;

        const team = await ClubEventTeamService.createTeam(eventId, userId, { name });
        return res.status(201).json({
            success: true,
            message: `Team "${name}" created successfully! You are the Team Leader.`,
            team,
        });
    } catch (err: any) {
        console.error("Create team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to create team.",
        });
    }
});

/**
 * POST /api/events/:eventId/teams/join
 * Join an existing team by team code
 */
eventTeamRouter.post("/events/:eventId/teams/join", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const userId = req.user!.id;
        const { teamCode } = req.body;

        const team = await ClubEventTeamService.joinTeamByCode(eventId, userId, teamCode);
        return res.status(200).json({
            success: true,
            message: `Joined team "${team.name}" successfully!`,
            team,
        });
    } catch (err: any) {
        console.error("Join team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to join team.",
        });
    }
});

/**
 * GET /api/events/:eventId/my-team
 * Retrieve the current user's team & pending invitations for this event
 */
eventTeamRouter.get("/events/:eventId/my-team", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const userId = req.user!.id;

        const data = await ClubEventTeamService.getUserTeamForEvent(eventId, userId);
        return res.json({
            success: true,
            team: data.team,
            pendingInvites: data.pendingInvites,
        });
    } catch (err: any) {
        console.error("Get my team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to fetch team data.",
        });
    }
});

/**
 * GET /api/events/:eventId/teams/:teamId
 * Retrieve full details & roster of a specific team
 */
eventTeamRouter.get("/events/:eventId/teams/:teamId", authenticate, async (req: Request, res: Response) => {
    try {
        const { teamId } = req.params;
        const userId = req.user!.id;

        const team = await ClubEventTeamService.getTeamDetails(teamId, userId);
        return res.json({
            success: true,
            team,
        });
    } catch (err: any) {
        console.error("Get team details error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to fetch team details.",
        });
    }
});

/**
 * GET /api/events/:eventId/teams/:teamId/search-users
 * Search users by username to invite to this team
 */
eventTeamRouter.get("/events/:eventId/teams/:teamId/search-users", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId, teamId } = req.params;
        const q = String(req.query.q || "");
        const currentUserId = req.user!.id;

        const users = await ClubEventTeamService.searchUsersForTeam(eventId, teamId, q, currentUserId);
        return res.json({
            success: true,
            users,
        });
    } catch (err: any) {
        console.error("Search users for team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to search users.",
        });
    }
});

/**
 * POST /api/events/:eventId/teams/:teamId/invites
 * Leader invites a teammate by username
 */
eventTeamRouter.post("/events/:eventId/teams/:teamId/invites", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId, teamId } = req.params;
        const leaderUserId = req.user!.id;
        const { username } = req.body;

        if (!username || typeof username !== "string") {
            return res.status(400).json({ success: false, message: "Username is required." });
        }

        const result = await ClubEventTeamService.inviteMemberByUsername(eventId, teamId, leaderUserId, username);
        return res.json(result);
    } catch (err: any) {
        console.error("Invite member error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to send invitation.",
        });
    }
});

/**
 * GET /api/events/invitations/my
 * Returns all active pending invitations received by the logged in user
 */
eventTeamRouter.get("/events/invitations/my", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const invitations = await ClubEventTeamService.getAllUserPendingInvitations(userId);
        return res.json({
            success: true,
            invitations,
        });
    } catch (err: any) {
        console.error("Get my invitations error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to fetch invitations.",
        });
    }
});

/**
 * POST /api/events/invitations/:invitationId/respond
 * Invitee responds to team invitation (accept or decline)
 */
eventTeamRouter.post("/events/invitations/:invitationId/respond", authenticate, async (req: Request, res: Response) => {
    try {
        const { invitationId } = req.params;
        const userId = req.user!.id;
        const { action } = req.body; // 'accept' | 'decline'

        if (action !== "accept" && action !== "decline") {
            return res.status(400).json({ success: false, message: "Action must be 'accept' or 'decline'." });
        }

        const result = await ClubEventTeamService.respondToInvitation(invitationId, userId, action);
        return res.json(result);
    } catch (err: any) {
        console.error("Respond invitation error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to respond to invitation.",
        });
    }
});

/**
 * POST /api/events/:eventId/teams/:teamId/leave
 * Member or leader leaves the team
 */
eventTeamRouter.post("/events/:eventId/teams/:teamId/leave", authenticate, async (req: Request, res: Response) => {
    try {
        const { teamId } = req.params;
        const userId = req.user!.id;

        const result = await ClubEventTeamService.leaveTeam(teamId, userId);
        return res.json(result);
    } catch (err: any) {
        console.error("Leave team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to leave team.",
        });
    }
});

/**
 * DELETE /api/events/:eventId/teams/:teamId/members/:targetUserId
 * Leader removes a member from the team
 */
eventTeamRouter.delete("/events/:eventId/teams/:teamId/members/:targetUserId", authenticate, async (req: Request, res: Response) => {
    try {
        const { teamId, targetUserId } = req.params;
        const leaderUserId = req.user!.id;

        const result = await ClubEventTeamService.removeMember(teamId, leaderUserId, targetUserId);
        return res.json(result);
    } catch (err: any) {
        console.error("Remove member error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to remove member.",
        });
    }
});

/**
 * PATCH /api/events/:eventId/teams/:teamId/rename
 * Leader renames the team
 */
eventTeamRouter.patch("/events/:eventId/teams/:teamId/rename", authenticate, async (req: Request, res: Response) => {
    try {
        const { teamId } = req.params;
        const leaderUserId = req.user!.id;
        const { name } = req.body;

        const result = await ClubEventTeamService.renameTeam(teamId, leaderUserId, name);
        return res.json(result);
    } catch (err: any) {
        console.error("Rename team error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to rename team.",
        });
    }
});

/**
 * GET /api/club/events/:eventId/teams
 * Organizers view all teams and rosters for an event
 */
eventTeamRouter.get("/club/events/:eventId/teams", authenticate, requireClubAccount, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const clubId = (req as any).club?.id;

        if (!clubId) {
            return res.status(403).json({ success: false, message: "Club authentication required." });
        }

        const teams = await ClubEventTeamService.getEventTeamsForClub(eventId, clubId);
        return res.json({
            success: true,
            teams,
        });
    } catch (err: any) {
        console.error("Get club event teams error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to fetch event teams.",
        });
    }
});
