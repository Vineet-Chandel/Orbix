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
    inviteeEmail?: string;
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
    isLeader: boolean;
    isLocked: boolean; // Event already started or registration deadline passed
    lockReason?: string | null;
    registrationDeadline?: string | null;
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
                    COALESCE(e.scope, 'CAMPUS') AS "scope",
                    COALESCE(e.eligibility, 'college_only') AS "eligibility",
                    c.name AS "clubName",
                    c.college_id AS "clubCollegeId",
                    COALESCE(inst.official_name, c.college_name, 'Host Campus') AS "collegeName"
             FROM club_events e
             JOIN verified_clubs c ON c.id = e.club_id
             LEFT JOIN institutions inst ON inst.id = c.college_id
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
     * Evaluates whether an event is restricted to students of the organizing college
     */
    private static isCampusRestricted(event: any): boolean {
        return event.scope !== "PAN_INDIA" && (event.scope === "CAMPUS" || event.eligibility === "college_only");
    }

    /**
     * Asserts that registration round is actively open and event has not concluded.
     * Enforces timeline and round pipeline locking on both backend and frontend.
     */
    private static async assertRegistrationOpen(eventId: string, startsAt?: string | null, endsAt?: string | null) {
        const now = Date.now();

        // 1. Check event record if startsAt, endsAt or status are missing
        let evStartsAt = startsAt;
        let evEndsAt = endsAt;
        let evStatus: string | null = null;

        if (!evStartsAt || !evEndsAt) {
            const evRes = await query(
                `SELECT starts_at AS "startsAt", ends_at AS "endsAt", status FROM club_events WHERE id = $1 LIMIT 1;`,
                [eventId]
            );
            if (evRes.rows[0]) {
                evStartsAt = evStartsAt || evRes.rows[0].startsAt;
                evEndsAt = evEndsAt || evRes.rows[0].endsAt;
                evStatus = evRes.rows[0].status;
            }
        }

        if (evStatus === "completed" || evStatus === "cancelled") {
            const err: any = new Error(`This event has ${evStatus}. Team rosters are permanently locked.`);
            err.statusCode = 403;
            throw err;
        }

        // 2. Check registration stage deadline / status first (authoritative round pipeline)
        const stageRes = await query(
            `SELECT id, name, type, action_type, status, starts_at AS "startsAt", ends_at AS "endsAt", stage_order AS "stageOrder"
             FROM club_event_stages
             WHERE event_id = $1
             ORDER BY 
                 CASE WHEN type = 'registration' OR action_type = 'registration' THEN 0 ELSE 1 END,
                 stage_order ASC
             LIMIT 1;`,
            [eventId]
        );

        if (stageRes.rows[0]) {
            const stage = stageRes.rows[0];
            if (stage.status === "completed" || stage.status === "cancelled") {
                const err: any = new Error("The registration round has concluded. Team modifications and roster edits are permanently locked.");
                err.statusCode = 403;
                throw err;
            }
            if (stage.endsAt && now >= new Date(stage.endsAt).getTime()) {
                const err: any = new Error("The registration round deadline has passed. Team rosters are permanently locked and cannot be modified.");
                err.statusCode = 403;
                throw err;
            }
            if (stage.startsAt && now < new Date(stage.startsAt).getTime()) {
                const err: any = new Error("Registration has not yet started for this event.");
                err.statusCode = 403;
                throw err;
            }

            // Check if any stage AFTER registration has already become active or completed
            const advancedStageRes = await query(
                `SELECT id, name FROM club_event_stages 
                 WHERE event_id = $1 AND stage_order > $2 AND status IN ('active', 'completed')
                 LIMIT 1;`,
                [eventId, stage.stageOrder]
            );
            if (advancedStageRes.rows[0]) {
                const err: any = new Error(`Stage "${advancedStageRes.rows[0].name}" has already begun. Team rosters are permanently locked.`);
                err.statusCode = 403;
                throw err;
            }

            // Registration stage is active!
            return;
        }

        // 3. If no specific registration stage is configured, check if event has started or concluded
        if (evStartsAt && now >= new Date(evStartsAt).getTime()) {
            const err: any = new Error("This event has already started. Team modifications and roster edits are permanently locked.");
            err.statusCode = 403;
            throw err;
        }
        if (evEndsAt && now >= new Date(evEndsAt).getTime()) {
            const err: any = new Error("This event has concluded. Team modifications and roster edits are permanently locked.");
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
        await this.assertRegistrationOpen(eventId, event.startsAt);

        const teamName = (payload.name || "").trim();
        if (!teamName || teamName.length < 2 || teamName.length > 80) {
            const err: any = new Error("Team name must be between 2 and 80 characters.");
            err.statusCode = 400;
            throw err;
        }

        // Campus Eligibility Check (Exclusively enforced for CAMPUS-scoped events)
        const isCampusRestricted = this.isCampusRestricted(event);
        if (isCampusRestricted && event.clubCollegeId) {
            const leaderUserRes = await query(`SELECT college_id FROM users WHERE id = $1 LIMIT 1;`, [leaderUserId]);
            const leaderCollegeId = leaderUserRes.rows[0]?.college_id;
            if (!leaderCollegeId || leaderCollegeId !== event.clubCollegeId) {
                const err: any = new Error(
                    `Campus Restricted: You cannot create a squad for this event because it is exclusively open to students enrolled at ${event.collegeName}.`
                );
                err.statusCode = 403;
                err.code = "CAMPUS_COLLEGE_MISMATCH";
                throw err;
            }
        }

        // Check if user has previously withdrawn from this event
        const withdrawnCheckLeader = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 AND status = 'cancelled' LIMIT 1;`,
            [eventId, leaderUserId]
        );
        if (withdrawnCheckLeader.rows[0]) {
            const err: any = new Error("You have previously withdrawn your application for this event. Re-registering or creating a squad is restricted.");
            err.statusCode = 403;
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

        // Ensure one team only: Check if already registered in another team or active registration
        const existingActiveReg = await query(
            `SELECT r.id, r.team_id, t.name AS "teamName"
             FROM club_event_registrations r
             LEFT JOIN club_event_teams t ON t.id = r.team_id
             WHERE r.event_id = $1 AND r.user_id = $2 AND r.status NOT IN ('cancelled', 'rejected') LIMIT 1;`,
            [eventId, leaderUserId]
        );
        if (existingActiveReg.rows[0] && existingActiveReg.rows[0].team_id) {
            const err: any = new Error(`You are already participating in this event in team "${existingActiveReg.rows[0].teamName}". An Orbix member can only register with one team.`);
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
            `SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`,
            [leaderUserId]
        );
        const leaderUser = userRes.rows[0];
        const leaderName = leaderUser?.firstname ? `${leaderUser.firstname} ${leaderUser.lastname || ""}`.trim() : leaderUser?.username || "Developer";

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
        await this.assertRegistrationOpen(eventId, event.startsAt, event.endsAt);

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

        // Campus Eligibility Check (Exclusively enforced for CAMPUS-scoped events)
        const isCampusRestricted = this.isCampusRestricted(event);
        if (isCampusRestricted && event.clubCollegeId) {
            const userCollegeRes = await query(`SELECT college_id FROM users WHERE id = $1 LIMIT 1;`, [userId]);
            const userCollegeId = userCollegeRes.rows[0]?.college_id;
            if (!userCollegeId || userCollegeId !== event.clubCollegeId) {
                const err: any = new Error(
                    `Campus Restricted: You cannot join team "${team.name}" because this event is exclusively open to students enrolled at ${event.collegeName}.`
                );
                err.statusCode = 403;
                err.code = "CAMPUS_COLLEGE_MISMATCH";
                throw err;
            }
        }

        // Capacity check
        if (team.membersCount >= event.maxTeamSize) {
            const err: any = new Error(`Team "${team.name}" has reached its maximum size of ${event.maxTeamSize} members.`);
            err.statusCode = 400;
            throw err;
        }

        // Check if user has previously withdrawn from this event
        const withdrawnCheckMember = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 AND status = 'cancelled' LIMIT 1;`,
            [eventId, userId]
        );
        if (withdrawnCheckMember.rows[0]) {
            const err: any = new Error("You have previously withdrawn your application for this event. Re-joining a squad is restricted.");
            err.statusCode = 403;
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

        // Ensure one team only: Check if already registered in another team or active registration
        const existingActiveReg = await query(
            `SELECT r.id, r.team_id, t.name AS "teamName"
             FROM club_event_registrations r
             LEFT JOIN club_event_teams t ON t.id = r.team_id
             WHERE r.event_id = $1 AND r.user_id = $2 AND r.status NOT IN ('cancelled', 'rejected') LIMIT 1;`,
            [eventId, userId]
        );
        if (existingActiveReg.rows[0] && existingActiveReg.rows[0].team_id && existingActiveReg.rows[0].team_id !== team.id) {
            const err: any = new Error(
                `You are already registered for this event in team "${existingActiveReg.rows[0].teamName}". An Orbix developer can only register for an event with one team.`
            );
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
        const [memberUserRes, leaderUserRes, leaderRegRes] = await Promise.all([
            query(
                `SELECT u.email, u.username, u.firstname, u.lastname, u.roll_number, u.department, u.year_of_study, u.phone,
                        u.college_id AS "collegeId", inst.official_name AS "institutionName", inst.city AS "institutionCity",
                        inst.state AS "institutionState", COALESCE(inst.verification_status, 'verified') AS "institutionVerificationStatus"
                 FROM users u
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE u.id = $1 LIMIT 1;`,
                [userId]
            ),
            query(`SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [team.leaderId]),
            query(`SELECT status, club_id, ticket_code FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`, [eventId, team.leaderId]),
        ]);

        const memberUser = memberUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];
        const leaderReg = leaderRegRes.rows[0];

        const targetStatus = leaderReg?.status || "registered";
        const targetClubId = leaderReg?.club_id || event.clubId;
        const memberName = memberUser?.firstname ? `${memberUser.firstname} ${memberUser.lastname || ""}`.trim() : memberUser?.username || "Developer";
        const leaderName = leaderUser?.firstname ? `${leaderUser.firstname} ${leaderUser.lastname || ""}`.trim() : leaderUser?.username || "Team Leader";
        const memberTicketCode = `TKT-${(team.code || "ORB").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}-${userId.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}`;

        // Link registration record, or create a full registration record matching team status
        const regCheck = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );
        if (regCheck.rows[0]) {
            await query(
                `UPDATE club_event_registrations 
                 SET team_id = $1, team_role = 'member', status = $2, ticket_code = COALESCE(ticket_code, $3),
                     institution_id = COALESCE(institution_id, $5),
                     institution_name = COALESCE(institution_name, $6),
                     institution_city = COALESCE(institution_city, $7),
                     institution_state = COALESCE(institution_state, $8),
                     department = COALESCE(department, $9),
                     year_of_study = COALESCE(year_of_study, $10),
                     roll_number = COALESCE(roll_number, $11),
                     phone_number = COALESCE(phone_number, $12),
                     updated_at = NOW()
                 WHERE id = $4;`,
                [
                    team.id,
                    targetStatus,
                    memberTicketCode,
                    regCheck.rows[0].id,
                    memberUser?.collegeId || null,
                    memberUser?.institutionName || null,
                    memberUser?.institutionCity || null,
                    memberUser?.institutionState || null,
                    memberUser?.department || null,
                    memberUser?.year_of_study || null,
                    memberUser?.roll_number || null,
                    memberUser?.phone || null,
                ]
            );
        } else {
            await query(
                `INSERT INTO club_event_registrations (
                    event_id, club_id, user_id, status, applicant_name, applicant_email, team_id, team_role, ticket_code,
                    institution_id, institution_name, institution_city, institution_state, institution_verification_status,
                    department, year_of_study, roll_number, phone_number,
                    registered_at, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'member', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW());`,
                [
                    eventId,
                    targetClubId,
                    userId,
                    targetStatus,
                    memberName,
                    memberUser?.email || "developer@orbix.in",
                    team.id,
                    memberTicketCode,
                    memberUser?.collegeId || null,
                    memberUser?.institutionName || null,
                    memberUser?.institutionCity || null,
                    memberUser?.institutionState || null,
                    memberUser?.institutionVerificationStatus || "unverified",
                    memberUser?.department || null,
                    memberUser?.year_of_study || null,
                    memberUser?.roll_number || null,
                    memberUser?.phone || null,
                ]
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

        const event = await this.getTeamEvent(eventId);
        const isCampusRestricted = this.isCampusRestricted(event);

        const safeTeamId = (teamId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(teamId))
            ? teamId
            : '00000000-0000-0000-0000-000000000000';

        const res = await query(
            `SELECT u.id, u.username, u.firstname AS "firstName", u.lastname AS "lastName",
                    COALESCE(u.avatar_url, '') AS "avatarUrl", u.email,
                    u.college_id AS "collegeId",
                    COALESCE(inst.official_name, '') AS "collegeName",
                    EXISTS (
                        SELECT 1 FROM club_event_team_members tm 
                        WHERE tm.event_id = $1 AND tm.user_id = u.id
                    ) AS "isAlreadyInTeam",
                    EXISTS (
                        SELECT 1 FROM club_event_registrations r
                        WHERE r.event_id = $1 AND r.user_id = u.id AND r.status NOT IN ('cancelled', 'rejected')
                          AND ($2 = '00000000-0000-0000-0000-000000000000' OR r.team_id IS DISTINCT FROM $2::uuid)
                    ) AS "isAlreadyRegistered",
                    EXISTS (
                        SELECT 1 FROM club_event_team_invitations ti 
                        WHERE ti.team_id = $2::uuid AND ti.invitee_user_id = u.id AND ti.status = 'pending'
                    ) AS "hasPendingInvite"
             FROM users u
             LEFT JOIN institutions inst ON inst.id = u.college_id
             WHERE u.id != $3 
               AND u.account_type != 'club'
               AND (
                 LOWER(u.username) LIKE LOWER($4) 
                 OR LOWER(u.firstname) LIKE LOWER($4) 
                 OR LOWER(u.lastname) LIKE LOWER($4)
               )
             ORDER BY 
               CASE WHEN $7::boolean = true AND u.college_id = $8::uuid THEN 0
                    WHEN $7::boolean = true THEN 1
                    ELSE 0
               END,
               CASE WHEN LOWER(u.username) = LOWER($5) THEN 0
                    WHEN LOWER(u.username) LIKE LOWER($6) THEN 1
                    ELSE 2 
               END,
               u.username ASC
             LIMIT 15;`,
            [
                eventId,
                safeTeamId,
                currentUserId,
                `%${clean}%`,
                clean,
                `${clean}%`,
                isCampusRestricted,
                event.clubCollegeId || '00000000-0000-0000-0000-000000000000'
            ]
        );

        return res.rows.map((row) => {
            const isCollegeMismatch = isCampusRestricted && Boolean(event.clubCollegeId && row.collegeId !== event.clubCollegeId);
            const isAlreadyTaken = Boolean(row.isAlreadyInTeam || row.isAlreadyRegistered);
            const isEligible = !isCollegeMismatch && !isAlreadyTaken;

            let mismatchReason: string | null = null;
            if (isCollegeMismatch) {
                mismatchReason = `Campus Restricted: Only students from ${event.collegeName} can be invited.`;
            } else if (row.isAlreadyInTeam) {
                mismatchReason = `@${row.username} is already participating in another team for this event.`;
            } else if (row.isAlreadyRegistered) {
                mismatchReason = `@${row.username} is already registered for this event. One member can only register with one team.`;
            }

            return {
                id: row.id,
                username: row.username,
                name: `${row.firstName || ""} ${row.lastName || ""}`.trim() || row.username,
                avatarUrl: row.avatarUrl || null,
                email: row.email,
                collegeId: row.collegeId || null,
                collegeName: row.collegeName || null,
                isMember: Boolean(row.isAlreadyInTeam),
                isAlreadyInTeam: isAlreadyTaken,
                isAlreadyRegistered: Boolean(row.isAlreadyRegistered),
                hasPendingInvite: Boolean(row.hasPendingInvite),
                isCollegeMismatch,
                isEligible,
                mismatchReason,
                publicProfileUrl: `/profile/${row.username}`,
            };
        });
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
        const isCampusRestricted = this.isCampusRestricted(event);
        await this.assertRegistrationOpen(eventId, event.startsAt);

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

        // Check capacity limit: confirmed members + pending invitations cannot exceed maxTeamSize
        const pendingCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_team_invitations 
             WHERE team_id = $1 AND status = 'pending';`,
            [teamId]
        );
        const pendingCount = pendingCountRes.rows[0]?.count || 0;
        const totalAllocated = team.membersCount + pendingCount;

        if (totalAllocated >= event.maxTeamSize) {
            const err: any = new Error(
                `Your team has reached its maximum capacity of ${event.maxTeamSize} members (currently ${team.membersCount} confirmed, ${pendingCount} pending invite${pendingCount === 1 ? "" : "s"}). Revoke a pending invitation or remove a member to invite someone else.`
            );
            err.statusCode = 400;
            throw err;
        }

        // Find target user
        const cleanUsername = targetUsername.trim().replace(/^@/, "");
        const targetRes = await query(
            `SELECT u.id, u.username, u.firstname, u.lastname, u.email, u.college_id AS "collegeId",
                    COALESCE(inst.official_name, '') AS "collegeName"
             FROM users u
             LEFT JOIN institutions inst ON inst.id = u.college_id
             WHERE LOWER(u.username) = LOWER($1) LIMIT 1;`,
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

        // Campus Restriction Check: For CAMPUS events, invitee MUST be from organizing college
        if (isCampusRestricted && event.clubCollegeId) {
            if (!targetUser.collegeId || targetUser.collegeId !== event.clubCollegeId) {
                const err: any = new Error(
                    `Campus Restricted: @${cleanUsername} is enrolled at ${targetUser.collegeName || "another institution"}. For campus-only events organized by ${event.clubName}, you can only invite students enrolled at ${event.collegeName}.`
                );
                err.statusCode = 403;
                err.code = "CAMPUS_COLLEGE_MISMATCH";
                throw err;
            }
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
            const err: any = new Error(`@${targetUser.username} is already participating in team "${inTeamCheck.rows[0].teamName}". An Orbix developer can only register for an event with one team.`);
            err.statusCode = 400;
            throw err;
        }

        // Ensure one team only: Check if already registered in another team or active registration
        const targetRegCheck = await query(
            `SELECT r.id, r.team_id, t.name AS "teamName"
             FROM club_event_registrations r
             LEFT JOIN club_event_teams t ON t.id = r.team_id
             WHERE r.event_id = $1 AND r.user_id = $2 AND r.status NOT IN ('cancelled', 'rejected') LIMIT 1;`,
            [eventId, targetUser.id]
        );
        if (targetRegCheck.rows[0] && targetRegCheck.rows[0].team_id && targetRegCheck.rows[0].team_id !== teamId) {
            const err: any = new Error(
                `@${targetUser.username} is already registered for this event in team "${targetRegCheck.rows[0].teamName}". An Orbix member can only register with one team.`
            );
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

        // Check if target user has previously withdrawn from this event
        const withdrawnCheckInvitee = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 AND status = 'cancelled' LIMIT 1;`,
            [eventId, targetUser.id]
        );
        if (withdrawnCheckInvitee.rows[0]) {
            const err: any = new Error(`@${targetUser.username} previously withdrew their application for this event and cannot be invited.`);
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
        const leaderRes = await query(`SELECT username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [leaderUserId]);
        const leader = leaderRes.rows[0];
        const leaderName = leader?.firstname ? `${leader.firstname} ${leader.lastname || ""}`.trim() : leader?.username || "Team Leader";
        const targetName = targetUser?.firstname ? `${targetUser.firstname} ${targetUser.lastname || ""}`.trim() : targetUser?.username || "Developer";

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
     * 4b. Revoke / Cancel a Pending Team Invitation (Leader power)
     */
    static async cancelInvitation(
        eventId: string,
        teamId: string,
        leaderUserId: string,
        invitationId: string
    ) {
        const event = await this.getTeamEvent(eventId);
        await this.assertRegistrationOpen(eventId, event.startsAt, event.endsAt);

        // Verify caller is team leader
        const teamCheck = await query(
            `SELECT id, name, leader_id AS "leaderId"
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
            const err: any = new Error("Only the team leader can revoke invitations.");
            err.statusCode = 403;
            throw err;
        }

        // Verify invitation exists and is pending
        const invCheck = await query(
            `SELECT i.id, i.status, u.username
             FROM club_event_team_invitations i
             JOIN users u ON u.id = i.invitee_user_id
             WHERE i.id = $1 AND i.team_id = $2 LIMIT 1;`,
            [invitationId, teamId]
        );

        if (!invCheck.rows[0]) {
            const err: any = new Error("Invitation not found.");
            err.statusCode = 404;
            throw err;
        }

        const inv = invCheck.rows[0];
        if (inv.status !== "pending") {
            const err: any = new Error(`Cannot revoke this invitation because it is already ${inv.status}.`);
            err.statusCode = 400;
            throw err;
        }

        // Update invitation status to cancelled
        await query(
            `UPDATE club_event_team_invitations 
             SET status = 'cancelled', responded_at = NOW() 
             WHERE id = $1;`,
            [invitationId]
        );

        return {
            success: true,
            message: `Invitation to @${inv.username} has been revoked.`,
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
                    COALESCE(e.scope, 'CAMPUS') AS "scope",
                    COALESCE(e.eligibility, 'college_only') AS "eligibility",
                    c.name AS "clubName",
                    c.college_id AS "clubCollegeId",
                    COALESCE(inst.official_name, c.college_name, 'Host Campus') AS "collegeName",
                    (SELECT COUNT(*)::int FROM club_event_team_members WHERE team_id = t.id) AS "membersCount"
             FROM club_event_team_invitations i
             JOIN club_event_teams t ON t.id = i.team_id
             JOIN club_events e ON e.id = i.event_id
             JOIN verified_clubs c ON c.id = e.club_id
             LEFT JOIN institutions inst ON inst.id = c.college_id
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
            if (inv.status === "cancelled") {
                const err: any = new Error("This invitation was revoked by the team leader and has concluded. You can no longer join this team.");
                err.statusCode = 410;
                err.code = "INVITATION_CONCLUDED";
                throw err;
            }
            const err: any = new Error(`This invitation has already been ${inv.status} and is concluded.`);
            err.statusCode = 400;
            err.code = "INVITATION_CONCLUDED";
            throw err;
        }

        await this.assertRegistrationOpen(inv.eventId, inv.startsAt);

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
        // Campus Restriction Check:
        const isCampusRestricted = this.isCampusRestricted(inv);
        if (isCampusRestricted && inv.clubCollegeId) {
            const userCollegeRes = await query(`SELECT college_id FROM users WHERE id = $1 LIMIT 1;`, [userId]);
            const userCollegeId = userCollegeRes.rows[0]?.college_id;
            if (!userCollegeId || userCollegeId !== inv.clubCollegeId) {
                const err: any = new Error(
                    `Campus Restricted: You cannot join team "${inv.teamName}" because this event is exclusively open to students enrolled at ${inv.collegeName}.`
                );
                err.statusCode = 403;
                err.code = "CAMPUS_COLLEGE_MISMATCH";
                throw err;
            }
        }

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

        // Ensure one team only: Check if already registered in another team or active registration
        const existingActiveReg = await query(
            `SELECT r.id, r.team_id, t.name AS "teamName"
             FROM club_event_registrations r
             LEFT JOIN club_event_teams t ON t.id = r.team_id
             WHERE r.event_id = $1 AND r.user_id = $2 AND r.status NOT IN ('cancelled', 'rejected') LIMIT 1;`,
            [inv.eventId, userId]
        );
        if (existingActiveReg.rows[0] && existingActiveReg.rows[0].team_id && existingActiveReg.rows[0].team_id !== inv.teamId) {
            const err: any = new Error(
                `You are already registered for this event in team "${existingActiveReg.rows[0].teamName}". An Orbix developer can only register for an event with one team.`
            );
            err.statusCode = 400;
            throw err;
        }

        // Check if user has previously withdrawn from this event
        const withdrawnCheckAccept = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 AND status = 'cancelled' LIMIT 1;`,
            [inv.eventId, userId]
        );
        if (withdrawnCheckAccept.rows[0]) {
            const err: any = new Error("You have previously withdrawn your application for this event. Re-joining a squad is restricted.");
            err.statusCode = 403;
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

        // Resolve user & leader for notifications and registration record
        const [memberUserRes, leaderUserRes, leaderRegRes] = await Promise.all([
            query(
                `SELECT u.email, u.username, u.firstname, u.lastname, u.roll_number, u.department, u.year_of_study, u.phone,
                        u.college_id AS "collegeId", inst.official_name AS "institutionName", inst.city AS "institutionCity",
                        inst.state AS "institutionState", COALESCE(inst.verification_status, 'verified') AS "institutionVerificationStatus"
                 FROM users u
                 LEFT JOIN institutions inst ON inst.id = u.college_id
                 WHERE u.id = $1 LIMIT 1;`,
                [userId]
            ),
            query(`SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [inv.leaderId]),
            query(`SELECT status, club_id, ticket_code FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`, [inv.eventId, inv.leaderId]),
        ]);

        const memberUser = memberUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];
        const leaderReg = leaderRegRes.rows[0];

        const targetStatus = leaderReg?.status || "registered";
        const targetClubId = leaderReg?.club_id || inv.clubId;
        const memberName = memberUser?.firstname ? `${memberUser.firstname} ${memberUser.lastname || ""}`.trim() : memberUser?.username || "Developer";
        const leaderName = leaderUser?.firstname ? `${leaderUser.firstname} ${leaderUser.lastname || ""}`.trim() : leaderUser?.username || "Team Leader";
        const memberTicketCode = `TKT-${(inv.teamCode || "ORB").replace(/[^A-Z0-9]/gi, "").slice(0, 6).toUpperCase()}-${userId.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase()}`;

        // Link registration record, or create a full registration record matching team status
        const regCheck = await query(
            `SELECT id FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [inv.eventId, userId]
        );
        if (regCheck.rows[0]) {
            await query(
                `UPDATE club_event_registrations 
                 SET team_id = $1, team_role = 'member', status = $2, ticket_code = COALESCE(ticket_code, $3),
                     institution_id = COALESCE(institution_id, $5),
                     institution_name = COALESCE(institution_name, $6),
                     institution_city = COALESCE(institution_city, $7),
                     institution_state = COALESCE(institution_state, $8),
                     department = COALESCE(department, $9),
                     year_of_study = COALESCE(year_of_study, $10),
                     roll_number = COALESCE(roll_number, $11),
                     phone_number = COALESCE(phone_number, $12),
                     updated_at = NOW()
                 WHERE id = $4;`,
                [
                    inv.teamId,
                    targetStatus,
                    memberTicketCode,
                    regCheck.rows[0].id,
                    memberUser?.collegeId || null,
                    memberUser?.institutionName || null,
                    memberUser?.institutionCity || null,
                    memberUser?.institutionState || null,
                    memberUser?.department || null,
                    memberUser?.year_of_study || null,
                    memberUser?.roll_number || null,
                    memberUser?.phone || null,
                ]
            );
        } else {
            await query(
                `INSERT INTO club_event_registrations (
                    event_id, club_id, user_id, status, applicant_name, applicant_email, team_id, team_role, ticket_code,
                    institution_id, institution_name, institution_city, institution_state, institution_verification_status,
                    department, year_of_study, roll_number, phone_number,
                    registered_at, created_at, updated_at
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'member', $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, NOW(), NOW(), NOW());`,
                [
                    inv.eventId,
                    targetClubId,
                    userId,
                    targetStatus,
                    memberName,
                    memberUser?.email || "developer@orbix.in",
                    inv.teamId,
                    memberTicketCode,
                    memberUser?.collegeId || null,
                    memberUser?.institutionName || null,
                    memberUser?.institutionCity || null,
                    memberUser?.institutionState || null,
                    memberUser?.institutionVerificationStatus || "unverified",
                    memberUser?.department || null,
                    memberUser?.year_of_study || null,
                    memberUser?.roll_number || null,
                    memberUser?.phone || null,
                ]
            );
        }

        const newCount = inv.membersCount + 1;
        if (newCount >= inv.minTeamSize) {
            await query(`UPDATE club_event_teams SET status = 'registered', updated_at = NOW() WHERE id = $1;`, [inv.teamId]);
        }

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

        await this.assertRegistrationOpen(team.eventId, team.startsAt);

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

        // Cleanly delete registration for removed member so they can re-register or join another squad
        await query(
            `DELETE FROM club_event_registrations 
             WHERE event_id = $1 AND user_id = $2;`,
            [team.eventId, targetUserId]
        );

        // If team members drop below minTeamSize, revert team status to 'forming'
        const remCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_team_members WHERE team_id = $1;`,
            [teamId]
        );
        const remCount = remCountRes.rows[0]?.count || 0;
        const evRes = await query(
            `SELECT COALESCE(min_team_size, 2) AS "minTeamSize" FROM club_events WHERE id = $1;`,
            [team.eventId]
        );
        const minTeamSize = evRes.rows[0]?.minTeamSize || 2;
        if (remCount < minTeamSize) {
            await query(`UPDATE club_event_teams SET status = 'forming', updated_at = NOW() WHERE id = $1;`, [teamId]);
        }

        // Target user info for email
        const targetRes = await query(`SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [targetUserId]);
        const targetUser = targetRes.rows[0];
        const targetName = targetUser?.firstname ? `${targetUser.firstname} ${targetUser.lastname || ""}`.trim() : targetUser?.username || "Developer";

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
     * 6b. Transfer Leadership to another confirmed team member (Leader power)
     */
    static async transferLeadership(
        teamId: string,
        currentLeaderUserId: string,
        newLeaderUserId: string
    ) {
        const teamRes = await query(
            `SELECT t.id, t.event_id AS "eventId", t.name, t.leader_id AS "leaderId", e.starts_at AS "startsAt", e.ends_at AS "endsAt"
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
        if (team.leaderId !== currentLeaderUserId) {
            const err: any = new Error("Only the current team leader can transfer leadership.");
            err.statusCode = 403;
            throw err;
        }

        if (newLeaderUserId === currentLeaderUserId) {
            const err: any = new Error("You are already the leader of this team.");
            err.statusCode = 400;
            throw err;
        }

        await this.assertRegistrationOpen(team.eventId, team.startsAt, team.endsAt);

        // Verify target user is an active member of this team
        const targetMemberRes = await query(
            `SELECT tm.user_id, u.username, u.firstname, u.lastname
             FROM club_event_team_members tm
             JOIN users u ON u.id = tm.user_id
             WHERE tm.team_id = $1 AND tm.user_id = $2 LIMIT 1;`,
            [teamId, newLeaderUserId]
        );

        if (!targetMemberRes.rows[0]) {
            const err: any = new Error("Selected user is not a confirmed member of this team.");
            err.statusCode = 400;
            throw err;
        }

        const targetUser = targetMemberRes.rows[0];
        const newLeaderName = `${targetUser.firstname || ""} ${targetUser.lastname || ""}`.trim() || targetUser.username;

        // 1. Update team leader
        await query(`UPDATE club_event_teams SET leader_id = $1, updated_at = NOW() WHERE id = $2;`, [newLeaderUserId, teamId]);

        // 2. Update roles in team members
        await query(`UPDATE club_event_team_members SET role = 'member' WHERE team_id = $1 AND user_id = $2;`, [teamId, currentLeaderUserId]);
        await query(`UPDATE club_event_team_members SET role = 'leader' WHERE team_id = $1 AND user_id = $2;`, [teamId, newLeaderUserId]);

        // 3. Update team_role in registrations
        await query(`UPDATE club_event_registrations SET team_role = 'member', updated_at = NOW() WHERE event_id = $1 AND user_id = $2;`, [team.eventId, currentLeaderUserId]);
        await query(`UPDATE club_event_registrations SET team_role = 'leader', updated_at = NOW() WHERE event_id = $1 AND user_id = $2;`, [team.eventId, newLeaderUserId]);

        return {
            success: true,
            message: `Leadership successfully transferred to @${targetUser.username}.`,
            newLeaderId: newLeaderUserId,
            newLeaderUsername: targetUser.username,
            newLeaderName,
        };
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
        await this.assertRegistrationOpen(team.eventId, team.startsAt);

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
                    `DELETE FROM club_event_registrations WHERE event_id = $1 AND user_id = $2;`,
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
                await query(`DELETE FROM club_event_registrations WHERE event_id = $1 AND user_id = $2;`, [team.eventId, userId]);

                // Check remaining members and update status if below minTeamSize
                const remCountRes = await query(
                    `SELECT COUNT(*)::int AS count FROM club_event_team_members WHERE team_id = $1;`,
                    [teamId]
                );
                const remCount = remCountRes.rows[0]?.count || 0;
                const evRes = await query(
                    `SELECT COALESCE(min_team_size, 2) AS "minTeamSize" FROM club_events WHERE id = $1;`,
                    [team.eventId]
                );
                const minTeamSize = evRes.rows[0]?.minTeamSize || 2;
                if (remCount < minTeamSize) {
                    await query(`UPDATE club_event_teams SET status = 'forming', updated_at = NOW() WHERE id = $1;`, [teamId]);
                }

                return { success: true, message: `You left the team. Leadership has been transferred to another member.` };
            }
        }

        // Regular member leave
        await query(`DELETE FROM club_event_team_members WHERE team_id = $1 AND user_id = $2;`, [teamId, userId]);
        await query(`DELETE FROM club_event_registrations WHERE event_id = $1 AND user_id = $2;`, [team.eventId, userId]);

        // Check remaining members and update status if below minTeamSize
        const remCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_team_members WHERE team_id = $1;`,
            [teamId]
        );
        const remCount = remCountRes.rows[0]?.count || 0;
        const evRes = await query(
            `SELECT COALESCE(min_team_size, 2) AS "minTeamSize" FROM club_events WHERE id = $1;`,
            [team.eventId]
        );
        const minTeamSize = evRes.rows[0]?.minTeamSize || 2;
        if (remCount < minTeamSize) {
            await query(`UPDATE club_event_teams SET status = 'forming', updated_at = NOW() WHERE id = $1;`, [teamId]);
        }

        // Resolve user & leader for email
        const [leavingUserRes, leaderUserRes] = await Promise.all([
            query(`SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [userId]),
            query(`SELECT email, username, firstname, lastname FROM users WHERE id = $1 LIMIT 1;`, [team.leaderId]),
        ]);

        const leavingUser = leavingUserRes.rows[0];
        const leaderUser = leaderUserRes.rows[0];
        const leavingName = leavingUser?.firstname ? `${leavingUser.firstname} ${leavingUser.lastname || ""}`.trim() : leavingUser?.username || "A teammate";
        const leaderName = leaderUser?.firstname ? `${leaderUser.firstname} ${leaderUser.lastname || ""}`.trim() : leaderUser?.username || "Team Leader";

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

        await this.assertRegistrationOpen(team.eventId, team.startsAt);

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
                    e.starts_at AS "startsAt", e.ends_at AS "endsAt", e.status AS "eventStatus",
                    COALESCE(e.min_team_size, 2) AS "minTeamSize",
                    COALESCE(e.max_team_size, 4) AS "maxTeamSize",
                    u.username AS "leaderUsername",
                    u.firstname AS "leaderFirstName",
                    u.lastname AS "leaderLastName"
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

        // Check stage deadline / timeline locking
        const stageRes = await query(
            `SELECT id, name, type, action_type, status, starts_at AS "startsAt", ends_at AS "endsAt", stage_order AS "stageOrder"
             FROM club_event_stages
             WHERE event_id = $1
             ORDER BY 
                 CASE WHEN type = 'registration' OR action_type = 'registration' THEN 0 ELSE 1 END,
                 stage_order ASC
             LIMIT 1;`,
            [t.eventId]
        );

        let isLocked = false;
        let lockReason: string | null = null;
        let registrationDeadline: string | null = null;

        if (t.eventStatus === "completed" || t.eventStatus === "cancelled") {
            isLocked = true;
            lockReason = `This event has ${t.eventStatus}. Team rosters are locked.`;
        } else if (stageRes.rows[0]) {
            const s = stageRes.rows[0];
            registrationDeadline = s.endsAt;
            if (s.status === "completed" || s.status === "cancelled") {
                isLocked = true;
                lockReason = "The registration round has concluded.";
            } else if (s.endsAt && Date.now() >= new Date(s.endsAt).getTime()) {
                isLocked = true;
                lockReason = "The registration round deadline has passed.";
            } else {
                // Check if later stage is active or completed
                const advancedStageRes = await query(
                    `SELECT id, name FROM club_event_stages 
                     WHERE event_id = $1 AND stage_order > $2 AND status IN ('active', 'completed')
                     LIMIT 1;`,
                    [t.eventId, s.stageOrder]
                );
                if (advancedStageRes.rows[0]) {
                    isLocked = true;
                    lockReason = `Competition round "${advancedStageRes.rows[0].name}" has begun.`;
                }
            }
        } else if (t.startsAt && Date.now() >= new Date(t.startsAt).getTime()) {
            isLocked = true;
            lockReason = "This event has started. Team roster is locked.";
        } else if (t.endsAt && Date.now() >= new Date(t.endsAt).getTime()) {
            isLocked = true;
            lockReason = "This event has concluded.";
        }

        // Fetch all members with user profiles & contact emails
        const membersRes = await query(
            `SELECT m.id, m.user_id AS "userId", m.role, m.joined_at AS "joinedAt",
                    u.username, u.firstname AS "firstName", u.lastname AS "lastName",
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
                    invitee.firstname AS "inviteeFirstName",
                    invitee.lastname AS "inviteeLastName",
                    invitee.email AS "inviteeEmail",
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
            inviteeEmail: row.inviteeEmail || "",
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
            isLeader: Boolean(viewingUserId && t.leaderId === viewingUserId),
            isLocked,
            lockReason,
            registrationDeadline,
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
                    u.firstname AS "leaderFirstName",
                    u.lastname AS "leaderLastName",
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
                    u.firstname AS "leaderFirstName",
                    u.lastname AS "leaderLastName",
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
                    u.firstname AS "leaderFirstName", u.lastname AS "leaderLastName",
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
                            u.username, u.firstname AS "firstName", u.lastname AS "lastName",
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
