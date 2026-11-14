import crypto from "crypto";
import { query } from "../../database/client.js";
import {
    sendTeamCreatedEmail,
    sendTeamInvitationEmail,
    sendTeamMemberJoinedEmail,
    sendTeamMemberLeftOrRemovedEmail,
    sendTeamRegistrationConfirmedEmail,
} from "../email/eventRegistrationEmailService.js";

export interface EventTeamMember {
    id: string;
    userId: string;
    username: string;
    firstName: string;
    lastName: string;
    fullName: string;
    email: string;
    avatarUrl: string | null;
    role: "leader" | "member";
    joinedAt: string;
    publicProfileUrl: string;
}

export interface EventTeamInvitation {
    id: string;
    teamId: string;
    inviterUserId: string;
    inviterUsername: string;
    inviteeUserId: string;
    inviteeUsername: string;
    inviteeName: string;
    inviteeAvatarUrl: string | null;
    status: "pending" | "accepted" | "declined" | "cancelled";
    createdAt: string;
}

export interface EventTeamDetails {
    id: string;
    eventId: string;
    clubId: string;
    name: string;
    code: string;
    leaderId: string;
    leaderUsername: string;
    leaderName: string;
    status: string;
    createdAt: string;
    isLocked: boolean; // Event already started
    minTeamSize: number;
    maxTeamSize: number;
    membersCount: number;
    members: EventTeamMember[];
    pendingInvitations?: EventTeamInvitation[];
}

export class ClubEventTeamService {
    /**
     * Generates a unique, collision-resistant team code (e.g. TEAM-4B7C9D)
     */
    private static generateTeamCode(teamName: string): string {
        const cleanPrefix = teamName
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 4)
            .toUpperCase() || "TEAM";
        const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
        return `${cleanPrefix}-${randomHex}`;
    }

    /**
     * Asserts that the event exists and is configured for team registration
     */
    private static async getTeamEvent(eventId: string) {
        const res = await query(
            `SELECT e.id, e.club_id AS "clubId", e.title, e.starts_at AS "startsAt", 
                    e.ends_at AS "endsAt", e.status, e.venue_or_location AS "venueOrLocation",
                    COALESCE(e.is_team_event, false) AS "isTeamEvent",
                    COALESCE(e.min_team_size, 2) AS "minTeamSize",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize",
                    c.name AS "clubName"
             FROM club_events e
             JOIN verified_clubs c ON c.id = e.club_id
             WHERE e.id = $1 LIMIT 1;`,
            [eventId]
        );

        if (!res.rows[0]) {
            const err: any = new Error("Event not found.");
            err.statusCode = 404;
            throw err;
        }

        const event = res.rows[0];
        if (!event.isTeamEvent) {
            const err: any = new Error("This event is configured for individual/sole registration, not team registration.");
            err.statusCode = 400;
            throw err;
        }

        return event;
    }

    /**
     * Checks if team modifications are locked because event has started
     */
    private static assertEventNotStarted(startsAt: string) {
        const startTime = new Date(startsAt).getTime();
        const now = Date.now();
        if (now >= startTime) {
            const err: any = new Error("Team modifications (joining, leaving, roster changes) are locked because the event has already started.");
            err.statusCode = 403;
            throw err;
        }
    }

    /**
     * 1. Create a New Team
     */
    static async createTeam(
        eventId: string,
        leaderUserId: string,
        payload: { name: string }
    ): Promise<EventTeamDetails> {
        const event = await this.getTeamEvent(eventId);
        this.assertEventNotStarted(event.startsAt);

        const teamName = (payload.name || "").trim();
        if (!teamName || teamName.length < 2 || teamName.length > 80) {
            const err: any = new Error("Team name must be between 2 and 80 characters.");
            err.statusCode = 400;
            throw err;
        }

        // Check if user is already in a team for this event
        const existingMember = await query(
            `SELECT m.team_id, t.name AS "teamName"
             FROM club_event_team_members m
             JOIN club_event_teams t ON t.id = m.team_id
             WHERE m.event_id = $1 AND m.user_id = $2 LIMIT 1;`,
            [eventId, leaderUserId]
        );
        if (existingMember.rows[0]) {
            const err: any = new Error(`You are already a member of team "${existingMember.rows[0].teamName}" for this event. Leave your current team before creating a new one.`);
            err.statusCode = 400;
            throw err;
        }

        // Check unique team name within event
        const nameCheck = await query(
            `SELECT id FROM club_event_teams WHERE event_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1;`,
            [eventId, teamName]
        );
        if (nameCheck.rows[0]) {
            const err: any = new Error(`A team named "${teamName}" already exists for this event. Please choose a different name.`);
            err.statusCode = 400;
            throw err;
        }

        // Generate unique team code
        let teamCode = this.generateTeamCode(teamName);
        let attempts = 0;
        while (attempts < 5) {
            const codeCheck = await query(`SELECT id FROM club_event_teams WHERE code = $1 LIMIT 1;`, [teamCode]);
            if (!codeCheck.rows[0]) break;
            teamCode = this.generateTeamCode(teamName);
            attempts++;
        }

        // Insert team record
        const teamRes = await query(
            `INSERT INTO club_event_teams (event_id, club_id, name, code, leader_id, status, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, 'forming', NOW(), NOW())
             RETURNING id, event_id AS "eventId", club_id AS "clubId", name, code, leader_id AS "leaderId", status, created_at AS "createdAt";`,
            [eventId, event.clubId, teamName, teamCode, leaderUserId]
        );
        const team = teamRes.rows[0];

        // Insert leader into members table
        await query(
            `INSERT INTO club_event_team_members (team_id, event_id, user_id, role, joined_at)
             VALUES ($1, $2, $3, 'leader', NOW());`,
            [team.id, eventId, leaderUserId]
        );

        // Fetch leader info for email and registration
        const userRes = await query(
            `SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`,
            [leaderUserId]
        );
        const leaderUser = userRes.rows[0];
        const leaderName = leaderUser?.first_name ? `${leaderUser.first_name} ${leaderUser.last_name || ""}`.trim() : leaderUser?.username || "Developer";

        // Update leader's registration record if it exists, or create a pending registration record
        const regCheck = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [eventId, leaderUserId]
        );
        if (regCheck.rows[0]) {
            await query(
                `UPDATE club_event_registrations 
                 SET team_id = $1, team_role = 'leader', updated_at = NOW()
                 WHERE id = $2;`,
                [team.id, regCheck.rows[0].id]
            );
        } else {
            await query(
                `INSERT INTO club_event_registrations (
                    event_id, club_id, user_id, status, applicant_name, applicant_email, team_id, team_role, registered_at, created_at, updated_at
                 ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, 'leader', NOW(), NOW(), NOW());`,
                [eventId, event.clubId, leaderUserId, leaderName, leaderUser?.email || "developer@orbix.in", team.id]
            );
        }

        // Dispatch background email
        if (leaderUser?.email) {
            sendTeamCreatedEmail({
                to: leaderUser.email,
                leaderName,
                teamName: team.name,
                teamCode: team.code,
                eventTitle: event.title,
                startsAt: event.startsAt,
                minTeamSize: event.minTeamSize,
                maxTeamSize: event.maxTeamSize,
            }).catch((err) => console.error("[sendTeamCreatedEmail] Error:", err));
        }

        return this.getTeamDetails(team.id, leaderUserId);
    }

    /**
     * 2. Join a Team by Team Code
     */
    static async joinTeamByCode(
        eventId: string,
        userId: string,
        teamCode: string
    ): Promise<EventTeamDetails> {
        const event = await this.getTeamEvent(eventId);
        this.assertEventNotStarted(event.startsAt);

        const cleanCode = (teamCode || "").trim().toUpperCase();
        if (!cleanCode) {
            const err: any = new Error("Team code is required.");
            err.statusCode = 400;
            throw err;
        }

        // Find team
        const teamRes = await query(
            `SELECT t.id, t.name, t.code, t.leader_id AS "leaderId", t.status,
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount"
             FROM club_event_teams t
             WHERE t.event_id = $1 AND UPPER(t.code) = $2 LIMIT 1;`,
            [eventId, cleanCode]
        );

        if (!teamRes.rows[0]) {
            const err: any = new Error(`Invalid team code "${cleanCode}". Please verify the code with your team leader.`);
            err.statusCode = 404;
            throw err;
        }

        const team = teamRes.rows[0];

        // Capacity check
        if (team.membersCount >= event.maxTeamSize) {
            const err: any = new Error(`Team "${team.name}" has reached its maximum size of ${event.maxTeamSize} members.`);
            err.statusCode = 400;
            throw err;
        }

        // Check if user is already in a team for this event
        const existingMember = await query(
            `SELECT m.team_id, t.name AS "teamName"
             FROM club_event_team_members m
             JOIN club_event_teams t ON t.id = m.team_id
             WHERE m.event_id = $1 AND m.user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );
        if (existingMember.rows[0]) {
            if (existingMember.rows[0].team_id === team.id) {
                const err: any = new Error(`You are already a member of team "${team.name}".`);
                err.statusCode = 400;
                throw err;
            }
            const err: any = new Error(`You are already in team "${existingMember.rows[0].teamName}" for this event. Leave your current team first.`);
            err.statusCode = 400;
            throw err;
        }

        // Add user as member
        await query(
            `INSERT INTO club_event_team_members (team_id, event_id, user_id, role, joined_at)
             VALUES ($1, $2, $3, 'member', NOW());`,
            [team.id, eventId, userId]
        );

        // Update any pending invitation for this user & team to 'accepted'
        await query(
            `UPDATE club_event_team_invitations 
             SET status = 'accepted', responded_at = NOW()
             WHERE team_id = $1 AND invitee_user_id = $2 AND status = 'pending';`,
            [team.id, userId]
        );

        // Resolve user & leader for notifications and registration record
        const [memberUserRes, leaderUserRes] = await Promise.all([
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [userId]),
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [team.leaderId]),
        ]);

        const memberUser = memberUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];

        const memberName = memberUser?.first_name ? `${memberUser.first_name} ${memberUser.last_name || ""}`.trim() : memberUser?.username || "Developer";
        const leaderName = leaderUser?.first_name ? `${leaderUser.first_name} ${leaderUser.last_name || ""}`.trim() : leaderUser?.username || "Team Leader";

        // Link registration record, or create a pending registration record
        const regCheck = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );
        if (regCheck.rows[0]) {
            await query(
                `UPDATE club_event_registrations 
                 SET team_id = $1, team_role = 'member', updated_at = NOW()
                 WHERE id = $2;`,
                [team.id, regCheck.rows[0].id]
            );
        } else {
            await query(
                `INSERT INTO club_event_registrations (
                    event_id, club_id, user_id, status, applicant_name, applicant_email, team_id, team_role, registered_at, created_at, updated_at
                 ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, 'member', NOW(), NOW(), NOW());`,
                [eventId, event.clubId, userId, memberName, memberUser?.email || "developer@orbix.in", team.id]
            );
        }

        const newCount = team.membersCount + 1;
        if (newCount >= event.minTeamSize && team.status === "forming") {
            await query(`UPDATE club_event_teams SET status = 'registered', updated_at = NOW() WHERE id = $1;`, [team.id]);
        }

        // Dispatch background emails
        if (memberUser?.email) {
            sendTeamMemberJoinedEmail({
                to: memberUser.email,
                recipientName: memberName,
                memberName,
                memberUsername: memberUser.username || "",
                memberEmail: memberUser.email,
                teamName: team.name,
                eventTitle: event.title,
                isLeader: false,
                currentRosterCount: newCount,
                maxTeamSize: event.maxTeamSize,
            }).catch((err) => console.error("[sendTeamMemberJoinedEmail: member] Error:", err));
        }

        if (leaderUser?.email) {
            sendTeamMemberJoinedEmail({
                to: leaderUser.email,
                recipientName: leaderName,
                memberName,
                memberUsername: memberUser?.username || "",
                memberEmail: memberUser?.email || "",
                teamName: team.name,
                eventTitle: event.title,
                isLeader: true,
                currentRosterCount: newCount,
                maxTeamSize: event.maxTeamSize,
            }).catch((err) => console.error("[sendTeamMemberJoinedEmail: leader] Error:", err));
        }

        return this.getTeamDetails(team.id, userId);
    }

    /**
     * 3. Search Users by Username to Invite
     */
    static async searchUsersForTeam(
        eventId: string,
        teamId: string,
        searchQuery: string,
        currentUserId: string
    ) {
        const clean = (searchQuery || "").trim().replace(/^@/, "");
        if (!clean || clean.length < 2) return [];

        const res = await query(
            `SELECT u.id, u.username, u.first_name AS "firstName", u.last_name AS "lastName",
                    COALESCE(u.avatar_url, '') AS "avatarUrl", u.email,
                    EXISTS (
                        SELECT 1 FROM club_event_team_members tm 
                        WHERE tm.event_id = $1 AND tm.user_id = u.id
                    ) AS "isAlreadyInTeam",
                    EXISTS (
                        SELECT 1 FROM club_event_team_invitations ti 
                        WHERE ti.team_id = $2 AND ti.invitee_user_id = u.id AND ti.status = 'pending'
                    ) AS "hasPendingInvite"
             FROM users u
             WHERE u.id != $3 
               AND u.account_type != 'club'
               AND (
                 LOWER(u.username) LIKE LOWER($4) 
                 OR LOWER(u.first_name) LIKE LOWER($4) 
                 OR LOWER(u.last_name) LIKE LOWER($4)
               )
             ORDER BY 
               CASE WHEN LOWER(u.username) = LOWER($5) THEN 0
                    WHEN LOWER(u.username) LIKE LOWER($6) THEN 1
                    ELSE 2 
               END,
               u.username ASC
             LIMIT 10;`,
            [eventId, teamId, currentUserId, `%${clean}%`, clean, `${clean}%`]
        );

        return res.rows.map((row) => ({
            id: row.id,
            username: row.username,
            name: `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.username,
            avatarUrl: row.avatarUrl || null,
            email: row.email,
            isAlreadyInTeam: Boolean(row.isAlreadyInTeam),
            hasPendingInvite: Boolean(row.hasPendingInvite),
            publicProfileUrl: `/profile/${row.username}`,
        }));
    }

    /**
     * 4. Invite a Member by Username (Leader power)
     */
    static async inviteMemberByUsername(
        eventId: string,
        teamId: string,
        leaderUserId: string,
        targetUsername: string
    ) {
        const event = await this.getTeamEvent(eventId);
        this.assertEventNotStarted(event.startsAt);

        // Verify caller is team leader
        const teamCheck = await query(
            `SELECT id, name, code, leader_id AS "leaderId",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = $1) AS "membersCount"
             FROM club_event_teams WHERE id = $1 AND event_id = $2 LIMIT 1;`,
            [teamId, eventId]
        );

        if (!teamCheck.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        const team = teamCheck.rows[0];
        if (team.leaderId !== leaderUserId) {
            const err: any = new Error("Only the team leader can invite new members.");
            err.statusCode = 403;
            throw err;
        }

        if (team.membersCount >= event.maxTeamSize) {
            const err: any = new Error(`Team is already full (${event.maxTeamSize} members).`);
            err.statusCode = 400;
            throw err;
        }

        // Find target user
        const cleanUsername = targetUsername.trim().replace(/^@/, "");
        const targetRes = await query(
            `SELECT id, username, first_name, last_name, email FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
            [cleanUsername]
        );

        if (!targetRes.rows[0]) {
            const err: any = new Error(`User @${cleanUsername} not found.`);
            err.statusCode = 404;
            throw err;
        }

        const targetUser = targetRes.rows[0];

        if (targetUser.id === leaderUserId) {
            const err: any = new Error("You are already the leader of this team.");
            err.statusCode = 400;
            throw err;
        }

        // Check if already in this event's teams
        const inTeamCheck = await query(
            `SELECT m.team_id, t.name AS "teamName"
             FROM club_event_team_members m
             JOIN club_event_teams t ON t.id = m.team_id
             WHERE m.event_id = $1 AND m.user_id = $2 LIMIT 1;`,
            [eventId, targetUser.id]
        );

        if (inTeamCheck.rows[0]) {
            const err: any = new Error(`@${targetUser.username} is already a member of team "${inTeamCheck.rows[0].teamName}".`);
            err.statusCode = 400;
            throw err;
        }

        // Check existing pending invitation
        const inviteCheck = await query(
            `SELECT id FROM club_event_team_invitations 
             WHERE team_id = $1 AND invitee_user_id = $2 AND status = 'pending' LIMIT 1;`,
            [teamId, targetUser.id]
        );

        if (inviteCheck.rows[0]) {
            const err: any = new Error(`An invitation has already been sent to @${targetUser.username}.`);
            err.statusCode = 400;
            throw err;
        }

        // Insert invitation
        const invRes = await query(
            `INSERT INTO club_event_team_invitations (team_id, event_id, inviter_user_id, invitee_user_id, status, created_at)
             VALUES ($1, $2, $3, $4, 'pending', NOW())
             RETURNING id, team_id AS "teamId", invitee_user_id AS "inviteeUserId", status, created_at AS "createdAt";`,
            [teamId, eventId, leaderUserId, targetUser.id]
        );

        // Fetch leader info for email
        const leaderRes = await query(`SELECT username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [leaderUserId]);
        const leader = leaderRes.rows[0];
        const leaderName = leader?.first_name ? `${leader.first_name} ${leader.last_name || ""}`.trim() : leader?.username || "Team Leader";
        const targetName = targetUser?.first_name ? `${targetUser.first_name} ${targetUser.last_name || ""}`.trim() : targetUser?.username || "Developer";

        // Dispatch invitation email
        if (targetUser.email) {
            sendTeamInvitationEmail({
                to: targetUser.email,
                inviteeName: targetName,
                leaderName,
                leaderUsername: leader?.username || "",
                teamName: team.name,
                teamCode: team.code,
                eventTitle: event.title,
                startsAt: event.startsAt,
            }).catch((err) => console.error("[sendTeamInvitationEmail] Error:", err));
        }

        return {
            success: true,
            message: `Invitation sent to @${targetUser.username}!`,
            invitation: invRes.rows[0],
        };
    }

    /**
     * 5. Respond to Team Invitation (Accept or Decline)
     */
    static async respondToInvitation(
        invitationId: string,
        userId: string,
        action: "accept" | "decline"
    ) {
        const invRes = await query(
            `SELECT i.id, i.team_id AS "teamId", i.event_id AS "eventId", i.status,
                    t.name AS "teamName", t.code AS "teamCode", t.leader_id AS "leaderId",
                    e.title AS "eventTitle", e.starts_at AS "startsAt",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize",
                    COALESCE(e.min_team_size, 2) AS "minTeamSize",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount"
             FROM club_event_team_invitations i
             JOIN club_event_teams t ON t.id = i.team_id
             JOIN club_events e ON e.id = i.event_id
             WHERE i.id = $1 AND i.invitee_user_id = $2 LIMIT 1;`,
            [invitationId, userId]
        );

        if (!invRes.rows[0]) {
            const err: any = new Error("Invitation not found or unauthorized.");
            err.statusCode = 404;
            throw err;
        }

        const inv = invRes.rows[0];

        if (inv.status !== "pending") {
            const err: any = new Error(`This invitation has already been ${inv.status}.`);
            err.statusCode = 400;
            throw err;
        }

        this.assertEventNotStarted(inv.startsAt);

        if (action === "decline") {
            await query(
                `UPDATE club_event_team_invitations 
                 SET status = 'declined', responded_at = NOW() 
                 WHERE id = $1;`,
                [invitationId]
            );
            return { success: true, message: "Invitation declined." };
        }

        // Accept Flow
        if (inv.membersCount >= inv.maxTeamSize) {
            const err: any = new Error(`Team "${inv.teamName}" has reached its maximum size of ${inv.maxTeamSize} members.`);
            err.statusCode = 400;
            throw err;
        }

        // Check user not in another team for this event
        const inTeamCheck = await query(
            `SELECT m.team_id, t.name AS "teamName"
             FROM club_event_team_members m
             JOIN club_event_teams t ON t.id = m.team_id
             WHERE m.event_id = $1 AND m.user_id = $2 LIMIT 1;`,
            [inv.eventId, userId]
        );

        if (inTeamCheck.rows[0]) {
            const err: any = new Error(`You are already in team "${inTeamCheck.rows[0].teamName}". Leave it before accepting this invitation.`);
            err.statusCode = 400;
            throw err;
        }

        // Add user to team members
        await query(
            `INSERT INTO club_event_team_members (team_id, event_id, user_id, role, joined_at)
             VALUES ($1, $2, $3, 'member', NOW());`,
            [inv.teamId, inv.eventId, userId]
        );

        // Update invitation
        await query(
            `UPDATE club_event_team_invitations 
             SET status = 'accepted', responded_at = NOW() 
             WHERE id = $1;`,
            [invitationId]
        );

        // Link registration
        await query(
            `UPDATE club_event_registrations 
             SET team_id = $1, team_role = 'member', updated_at = NOW()
             WHERE event_id = $2 AND user_id = $3;`,
            [inv.teamId, inv.eventId, userId]
        );

        const newCount = inv.membersCount + 1;
        if (newCount >= inv.minTeamSize) {
            await query(`UPDATE club_event_teams SET status = 'registered', updated_at = NOW() WHERE id = $1;`, [inv.teamId]);
        }

        // Resolve user & leader for notifications
        const [memberUserRes, leaderUserRes] = await Promise.all([
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [userId]),
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [inv.leaderId]),
        ]);

        const memberUser = memberUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];
        const memberName = memberUser?.first_name ? `${memberUser.first_name} ${memberUser.last_name || ""}`.trim() : memberUser?.username || "Developer";
        const leaderName = leaderUser?.first_name ? `${leaderUser.first_name} ${leaderUser.last_name || ""}`.trim() : leaderUser?.username || "Team Leader";

        // Dispatch background emails
        if (memberUser?.email) {
            sendTeamMemberJoinedEmail({
                to: memberUser.email,
                recipientName: memberName,
                memberName,
                memberUsername: memberUser.username || "",
                memberEmail: memberUser.email,
                teamName: inv.teamName,
                eventTitle: inv.eventTitle,
                isLeader: false,
                currentRosterCount: newCount,
                maxTeamSize: inv.maxTeamSize,
            }).catch((err) => console.error("[sendTeamMemberJoinedEmail: member] Error:", err));
        }

        if (leaderUser?.email) {
            sendTeamMemberJoinedEmail({
                to: leaderUser.email,
                recipientName: leaderName,
                memberName,
                memberUsername: memberUser?.username || "",
                memberEmail: memberUser?.email || "",
                teamName: inv.teamName,
                eventTitle: inv.eventTitle,
                isLeader: true,
                currentRosterCount: newCount,
                maxTeamSize: inv.maxTeamSize,
            }).catch((err) => console.error("[sendTeamMemberJoinedEmail: leader] Error:", err));
        }

        return {
            success: true,
            message: `You have joined team "${inv.teamName}"!`,
            teamId: inv.teamId,
        };
    }

    /**
     * 6. Remove a Team Member (Leader power)
     */
    static async removeMember(
        teamId: string,
        leaderUserId: string,
        targetUserId: string
    ) {
        const teamRes = await query(
            `SELECT t.id, t.name, t.leader_id AS "leaderId", t.event_id AS "eventId",
                    e.title AS "eventTitle", e.starts_at AS "startsAt"
             FROM club_event_teams t
             JOIN club_events e ON e.id = t.event_id
             WHERE t.id = $1 LIMIT 1;`,
            [teamId]
        );

        if (!teamRes.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        const team = teamRes.rows[0];
        if (team.leaderId !== leaderUserId) {
            const err: any = new Error("Only the team leader can remove team members.");
            err.statusCode = 403;
            throw err;
        }

        if (targetUserId === leaderUserId) {
            const err: any = new Error("The team leader cannot be removed. You must disband or transfer leadership.");
            err.statusCode = 400;
            throw err;
        }

        this.assertEventNotStarted(team.startsAt);

        // Remove from members
        const delRes = await query(
            `DELETE FROM club_event_team_members 
             WHERE team_id = $1 AND user_id = $2 RETURNING id;`,
            [teamId, targetUserId]
        );

        if (!delRes.rows[0]) {
            const err: any = new Error("User is not a member of this team.");
            err.statusCode = 404;
            throw err;
        }

        // Unlink registration
        await query(
            `UPDATE club_event_registrations 
             SET team_id = NULL, team_role = NULL, updated_at = NOW()
             WHERE event_id = $1 AND user_id = $2;`,
            [team.eventId, targetUserId]
        );

        // Target user info for email
        const targetRes = await query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [targetUserId]);
        const targetUser = targetRes.rows[0];
        const targetName = targetUser?.first_name ? `${targetUser.first_name} ${targetUser.last_name || ""}`.trim() : targetUser?.username || "Developer";

        if (targetUser?.email) {
            sendTeamMemberLeftOrRemovedEmail({
                to: targetUser.email,
                recipientName: targetName,
                memberName: targetName,
                teamName: team.name,
                eventTitle: team.eventTitle,
                action: "removed",
                isLeaderNotification: false,
            }).catch((err) => console.error("[sendTeamMemberLeftOrRemovedEmail: removed] Error:", err));
        }

        return { success: true, message: `Removed ${targetName} from team.` };
    }

    /**
     * 7. Leave Team (Member or Leader)
     */
    static async leaveTeam(teamId: string, userId: string) {
        const teamRes = await query(
            `SELECT t.id, t.name, t.leader_id AS "leaderId", t.event_id AS "eventId",
                    e.title AS "eventTitle", e.starts_at AS "startsAt",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount"
             FROM club_event_teams t
             JOIN club_events e ON e.id = t.event_id
             WHERE t.id = $1 LIMIT 1;`,
            [teamId]
        );

        if (!teamRes.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        const team = teamRes.rows[0];
        this.assertEventNotStarted(team.startsAt);

        // Check if user is in team
        const memberRes = await query(
            `SELECT role FROM club_event_team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1;`,
            [teamId, userId]
        );

        if (!memberRes.rows[0]) {
            const err: any = new Error("You are not a member of this team.");
            err.statusCode = 400;
            throw err;
        }

        const isLeader = memberRes.rows[0].role === "leader";

        if (isLeader) {
            if (team.membersCount <= 1) {
                // Last member disband
                await query(`DELETE FROM club_event_teams WHERE id = $1;`, [teamId]);
                await query(
                    `UPDATE club_event_registrations SET team_id = NULL, team_role = NULL, updated_at = NOW()
                     WHERE event_id = $1 AND user_id = $2;`,
                    [team.eventId, userId]
                );
                return { success: true, message: `Team "${team.name}" has been disbanded.` };
            } else {
                // Promote the next oldest member to leader
                const nextLeaderRes = await query(
                    `SELECT user_id FROM club_event_team_members 
                     WHERE team_id = $1 AND user_id != $2 
                     ORDER BY joined_at ASC LIMIT 1;`,
                    [teamId, userId]
                );
                const nextLeaderId = nextLeaderRes.rows[0].user_id;

                await query(`UPDATE club_event_teams SET leader_id = $1, updated_at = NOW() WHERE id = $2;`, [nextLeaderId, teamId]);
                await query(`UPDATE club_event_team_members SET role = 'leader' WHERE team_id = $1 AND user_id = $2;`, [teamId, nextLeaderId]);
                await query(`UPDATE club_event_registrations SET team_role = 'leader' WHERE event_id = $1 AND user_id = $2;`, [team.eventId, nextLeaderId]);

                // Remove previous leader
                await query(`DELETE FROM club_event_team_members WHERE team_id = $1 AND user_id = $2;`, [teamId, userId]);
                await query(`UPDATE club_event_registrations SET team_id = NULL, team_role = NULL, updated_at = NOW() WHERE event_id = $1 AND user_id = $2;`, [team.eventId, userId]);

                return { success: true, message: `You left the team. Leadership has been transferred to another member.` };
            }
        }

        // Regular member leave
        await query(`DELETE FROM club_event_team_members WHERE team_id = $1 AND user_id = $2;`, [teamId, userId]);
        await query(`UPDATE club_event_registrations SET team_id = NULL, team_role = NULL, updated_at = NOW() WHERE event_id = $1 AND user_id = $2;`, [team.eventId, userId]);

        // Resolve user & leader for email
        const [leavingUserRes, leaderUserRes] = await Promise.all([
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [userId]),
            query(`SELECT email, username, first_name, last_name FROM users WHERE id = $1 LIMIT 1;`, [team.leaderId]),
        ]);

        const leavingUser = leavingUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];
        const leavingName = leavingUser?.first_name ? `${leavingUser.first_name} ${leavingUser.last_name || ""}`.trim() : leavingUser?.username || "A teammate";
        const leaderName = leaderUser?.first_name ? `${leaderUser.first_name} ${leaderUser.last_name || ""}`.trim() : leaderUser?.username || "Team Leader";

        if (leaderUser?.email) {
            sendTeamMemberLeftOrRemovedEmail({
                to: leaderUser.email,
                recipientName: leaderName,
                memberName: leavingName,
                teamName: team.name,
                eventTitle: team.eventTitle,
                action: "left",
                isLeaderNotification: true,
            }).catch((err) => console.error("[sendTeamMemberLeftOrRemovedEmail: left] Error:", err));
        }

        return { success: true, message: `You have left team "${team.name}".` };
    }

    /**
     * 8. Rename Team (Leader power)
     */
    static async renameTeam(teamId: string, leaderUserId: string, newName: string) {
        const cleanName = (newName || "").trim();
        if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
            const err: any = new Error("Team name must be between 2 and 80 characters.");
            err.statusCode = 400;
            throw err;
        }

        const teamRes = await query(
            `SELECT t.id, t.event_id AS "eventId", t.leader_id AS "leaderId", e.starts_at AS "startsAt"
             FROM club_event_teams t
             JOIN club_events e ON e.id = t.event_id
             WHERE t.id = $1 LIMIT 1;`,
            [teamId]
        );

        if (!teamRes.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        const team = teamRes.rows[0];
        if (team.leaderId !== leaderUserId) {
            const err: any = new Error("Only the team leader can rename the team.");
            err.statusCode = 403;
            throw err;
        }

        this.assertEventNotStarted(team.startsAt);

        // Check uniqueness within event
        const nameCheck = await query(
            `SELECT id FROM club_event_teams WHERE event_id = $1 AND LOWER(name) = LOWER($2) AND id != $3 LIMIT 1;`,
            [team.eventId, cleanName, teamId]
        );
        if (nameCheck.rows[0]) {
            const err: any = new Error(`A team named "${cleanName}" already exists for this event.`);
            err.statusCode = 400;
            throw err;
        }

        await query(`UPDATE club_event_teams SET name = $1, updated_at = NOW() WHERE id = $2;`, [cleanName, teamId]);

        return { success: true, message: `Team renamed to "${cleanName}".`, newName: cleanName };
    }

    /**
     * 9. Get Team Details with Full Roster & Pending Invites
     */
    static async getTeamDetails(teamId: string, viewingUserId?: string): Promise<EventTeamDetails> {
        const teamRes = await query(
            `SELECT t.id, t.event_id AS "eventId", t.club_id AS "clubId", t.name, t.code,
                    t.leader_id AS "leaderId", t.status, t.created_at AS "createdAt",
                    e.starts_at AS "startsAt",
                    COALESCE(e.min_team_size, 2) AS "minTeamSize",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize",
                    u.username AS "leaderUsername",
                    u.first_name AS "leaderFirstName",
                    u.last_name AS "leaderLastName"
             FROM club_event_teams t
             JOIN club_events e ON e.id = t.event_id
             JOIN users u ON u.id = t.leader_id
             WHERE t.id = $1 LIMIT 1;`,
            [teamId]
        );

        if (!teamRes.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        const t = teamRes.rows[0];
        const isLocked = Date.now() >= new Date(t.startsAt).getTime();

        // Fetch all members with user profiles & contact emails
        const membersRes = await query(
            `SELECT m.id, m.user_id AS "userId", m.role, m.joined_at AS "joinedAt",
                    u.username, u.first_name AS "firstName", u.last_name AS "lastName",
                    COALESCE(u.avatar_url, '') AS "avatarUrl", u.email
             FROM club_event_team_members m
             JOIN users u ON u.id = m.user_id
             WHERE m.team_id = $1
             ORDER BY CASE WHEN m.role = 'leader' THEN 0 ELSE 1 END, m.joined_at ASC;`,
            [teamId]
        );

        const members: EventTeamMember[] = membersRes.rows.map((row) => ({
            id: row.id,
            userId: row.userId,
            username: row.username,
            firstName: row.firstName || "",
            lastName: row.lastName || "",
            fullName: `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.username,
            email: row.email,
            avatarUrl: row.avatarUrl || null,
            role: row.role as "leader" | "member",
            joinedAt: row.joinedAt,
            publicProfileUrl: `/profile/${row.username}`,
        }));

        // Fetch pending invitations
        const invitesRes = await query(
            `SELECT i.id, i.team_id AS "teamId", i.inviter_user_id AS "inviterUserId",
                    i.invitee_user_id AS "inviteeUserId", i.status, i.created_at AS "createdAt",
                    inviter.username AS "inviterUsername",
                    invitee.username AS "inviteeUsername",
                    invitee.first_name AS "inviteeFirstName",
                    invitee.last_name AS "inviteeLastName",
                    COALESCE(invitee.avatar_url, '') AS "inviteeAvatarUrl"
             FROM club_event_team_invitations i
             JOIN users inviter ON inviter.id = i.inviter_user_id
             JOIN users invitee ON invitee.id = i.invitee_user_id
             WHERE i.team_id = $1 AND i.status = 'pending'
             ORDER BY i.created_at DESC;`,
            [teamId]
        );

        const pendingInvitations: EventTeamInvitation[] = invitesRes.rows.map((row) => ({
            id: row.id,
            teamId: row.teamId,
            inviterUserId: row.inviterUserId,
            inviterUsername: row.inviterUsername,
            inviteeUserId: row.inviteeUserId,
            inviteeUsername: row.inviteeUsername,
            inviteeName: `${row.inviteeFirstName || ""} ${row.inviteeLastName || ""}`.trim() || row.inviteeUsername,
            inviteeAvatarUrl: row.inviteeAvatarUrl || null,
            status: row.status as any,
            createdAt: row.createdAt,
        }));

        const leaderName = `${t.leaderFirstName || ""} ${t.leaderLastName || ""}`.trim() || t.leaderUsername;

        return {
            id: t.id,
            eventId: t.eventId,
            clubId: t.clubId,
            name: t.name,
            code: t.code,
            leaderId: t.leaderId,
            leaderUsername: t.leaderUsername,
            leaderName,
            status: t.status,
            createdAt: t.createdAt,
            isLocked,
            minTeamSize: t.minTeamSize,
            maxTeamSize: t.maxTeamSize,
            membersCount: members.length,
            members,
            pendingInvitations,
        };
    }

    /**
     * 10. Get User's Team & Invitations for an Event
     */
    static async getUserTeamForEvent(eventId: string, userId: string) {
        // Find if user is in a team
        const memberRes = await query(
            `SELECT m.team_id AS "teamId", m.role
             FROM club_event_team_members m
             WHERE m.event_id = $1 AND m.user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );

        let team: EventTeamDetails | null = null;
        if (memberRes.rows[0]) {
            team = await this.getTeamDetails(memberRes.rows[0].teamId, userId);
        }

        // Find pending invitations received by user for this event
        const invitesRes = await query(
            `SELECT i.id, i.team_id AS "teamId", i.created_at AS "createdAt",
                    t.name AS "teamName", t.code AS "teamCode",
                    u.username AS "leaderUsername",
                    u.first_name AS "leaderFirstName",
                    u.last_name AS "leaderLastName",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize"
             FROM club_event_team_invitations i
             JOIN club_event_teams t ON t.id = i.team_id
             JOIN users u ON u.id = t.leader_id
             JOIN club_events e ON e.id = i.event_id
             WHERE i.event_id = $1 AND i.invitee_user_id = $2 AND i.status = 'pending'
             ORDER BY i.created_at DESC;`,
            [eventId, userId]
        );

        const pendingInvites = invitesRes.rows.map((row) => ({
            id: row.id,
            teamId: row.teamId,
            teamName: row.teamName,
            teamCode: row.teamCode,
            leaderUsername: row.leaderUsername,
            leaderName: `${row.leaderFirstName || ""} ${row.leaderLastName || ""}`.trim() || row.leaderUsername,
            membersCount: row.membersCount,
            maxTeamSize: row.maxTeamSize,
            createdAt: row.createdAt,
        }));

        return {
            team,
            pendingInvites,
        };
    }

    /**
     * 10b. Get All Pending Invitations for a User across all events
     */
    static async getAllUserPendingInvitations(userId: string) {
        const res = await query(
            `SELECT i.id, i.team_id AS "teamId", i.event_id AS "eventId", i.created_at AS "createdAt",
                    t.name AS "teamName", t.code AS "teamCode",
                    e.title AS "eventTitle", e.starts_at AS "startsAt",
                    u.username AS "leaderUsername",
                    u.first_name AS "leaderFirstName",
                    u.last_name AS "leaderLastName",
                    COALESCE(u.avatar_url, '') AS "leaderAvatarUrl",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize"
             FROM club_event_team_invitations i
             JOIN club_event_teams t ON t.id = i.team_id
             JOIN users u ON u.id = t.leader_id
             JOIN club_events e ON e.id = i.event_id
             WHERE i.invitee_user_id = $1 AND i.status = 'pending'
             ORDER BY i.created_at DESC;`,
            [userId]
        );

        return res.rows.map((row) => ({
            id: row.id,
            teamId: row.teamId,
            eventId: row.eventId,
            teamName: row.teamName,
            teamCode: row.teamCode,
            eventTitle: row.eventTitle,
            startsAt: row.startsAt,
            leaderUsername: row.leaderUsername,
            leaderName: `${row.leaderFirstName || ""} ${row.leaderLastName || ""}`.trim() || row.leaderUsername,
            leaderAvatarUrl: row.leaderAvatarUrl,
            membersCount: row.membersCount,
            maxTeamSize: row.maxTeamSize,
            createdAt: row.createdAt,
        }));
    }

    /**
     * 11. Get All Teams for an Event (For Club Organizers in Applications View)
     */
    static async getEventTeamsForClub(eventId: string, clubId: string) {
        const teamsRes = await query(
            `SELECT t.id, t.name, t.code, t.status, t.created_at AS "createdAt",
                    u.id AS "leaderId", u.username AS "leaderUsername",
                    u.first_name AS "leaderFirstName", u.last_name AS "leaderLastName",
                    u.email AS "leaderEmail"
             FROM club_event_teams t
             JOIN users u ON u.id = t.leader_id
             WHERE t.event_id = $1 AND t.club_id = $2
             ORDER BY t.created_at DESC;`,
            [eventId, clubId]
        );

        const teams = await Promise.all(
            teamsRes.rows.map(async (t) => {
                const membersRes = await query(
                    `SELECT m.id, m.user_id AS "userId", m.role, m.joined_at AS "joinedAt",
                            u.username, u.first_name AS "firstName", u.last_name AS "lastName",
                            COALESCE(u.avatar_url, '') AS "avatarUrl", u.email,
                            r.status AS "registrationStatus", r.ticket_code AS "ticketCode"
                     FROM club_event_team_members m
                     JOIN users u ON u.id = m.user_id
                     LEFT JOIN club_event_registrations r ON r.event_id = m.event_id AND r.user_id = m.user_id
                     WHERE m.team_id = $1
                     ORDER BY CASE WHEN m.role = 'leader' THEN 0 ELSE 1 END, m.joined_at ASC;`,
                    [t.id]
                );

                return {
                    id: t.id,
                    name: t.name,
                    code: t.code,
                    status: t.status,
                    createdAt: t.createdAt,
                    leader: {
                        id: t.leaderId,
                        username: t.leaderUsername,
                        name: `${t.leaderFirstName || ""} ${t.leaderLastName || ""}`.trim() || t.leaderUsername,
                        email: t.leaderEmail,
                    },
                    membersCount: membersRes.rows.length,
                    members: membersRes.rows.map((m) => ({
                        id: m.id,
                        userId: m.userId,
                        username: m.username,
                        fullName: `${m.firstName || ""} ${m.lastName || ""}`.trim() || m.username,
                        email: m.email,
                        avatarUrl: m.avatarUrl || null,
                        role: m.role,
                        joinedAt: m.joinedAt,
                        registrationStatus: m.registrationStatus || "pending",
                        ticketCode: m.ticketCode || null,
                        publicProfileUrl: `/profile/${m.username}`,
                    })),
                };
            })
        );

        return teams;
    }
}
