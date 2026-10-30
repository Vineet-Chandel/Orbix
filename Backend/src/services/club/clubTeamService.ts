import { query } from "../../database/client.js";

export interface ClubUserPermissions {
    clubId: string;
    clubName: string;
    clubSlug: string;
    userRole: "owner" | "admin" | "team_lead" | "member" | "advisor" | "none";
    isOwner: boolean;
    isAdmin: boolean;
    isTeamLead: boolean;
    canManageTeams: boolean;
    canInviteMembers: boolean;
    canManageMembers: boolean;
    canTransferOwnership: boolean;
    assignedTeamIds: string[];
}

export class ClubTeamService {
    /**
     * Resolves the verified club and the caller's authoritative permissions within that club.
     */
    static async resolveUserClubPermissions(userId: string, requestedClubId?: string): Promise<ClubUserPermissions | null> {
        // 1. Find the club: either requested by ID or default to the user's verified club
        let clubRes;
        if (requestedClubId) {
            clubRes = await query(
                `SELECT id, name, slug, auth_user_id, is_active FROM public.verified_clubs WHERE id = $1 LIMIT 1;`,
                [requestedClubId]
            );
        } else {
            clubRes = await query(
                `SELECT vc.id, vc.name, vc.slug, vc.auth_user_id, vc.is_active
                 FROM public.verified_clubs vc
                 WHERE vc.auth_user_id = $1
                    OR vc.id IN (SELECT club_id FROM public.club_memberships WHERE user_id = $1 AND status = 'active')
                 LIMIT 1;`,
                [userId]
            );
        }

        const club = clubRes.rows[0];
        if (!club) {
            return null;
        }

        const clubId = club.id;
        const isAuthOwner = club.auth_user_id === userId;

        // 2. Fetch membership record
        const memRes = await query(
            `SELECT id, club_role, access_role, title, status FROM public.club_memberships WHERE club_id = $1 AND user_id = $2 LIMIT 1;`,
            [clubId, userId]
        );
        const membership = memRes.rows[0];

        // 3. Find if user is a lead in any team of this club
        const leadTeamsRes = await query(
            `SELECT id FROM public.club_teams WHERE club_id = $1 AND (lead_user_id = $2 OR co_lead_user_id = $2);`,
            [clubId, userId]
        );
        const assignedTeamIds = leadTeamsRes.rows.map((r: any) => r.id);

        let userRole: "owner" | "admin" | "team_lead" | "member" | "advisor" | "none" = "none";

        if (isAuthOwner) {
            userRole = "owner";
        } else if (membership) {
            const rawRole = (membership.club_role || membership.access_role || "member").toLowerCase();
            if (rawRole === "owner") userRole = "owner";
            else if (rawRole === "admin") userRole = "admin";
            else if (rawRole === "team_lead" || assignedTeamIds.length > 0) userRole = "team_lead";
            else if (rawRole === "advisor") userRole = "advisor";
            else userRole = "member";
        }

        const isOwner = userRole === "owner";
        const isAdmin = userRole === "admin" || isOwner;
        const isTeamLead = userRole === "team_lead" || isAdmin;

        return {
            clubId,
            clubName: club.name,
            clubSlug: club.slug,
            userRole,
            isOwner,
            isAdmin,
            isTeamLead,
            canManageTeams: isAdmin,
            canInviteMembers: isTeamLead,
            canManageMembers: isAdmin,
            canTransferOwnership: isOwner,
            assignedTeamIds,
        };
    }

    /**
     * Retrieves overall club team statistics.
     */
    static async getTeamStats(clubId: string, userId: string) {
        const perms = await this.resolveUserClubPermissions(userId, clubId);
        if (!perms) {
            const err: any = new Error("Club not found or you lack permission.");
            err.statusCode = 404;
            throw err;
        }

        // Count members
        const membersCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM public.club_memberships WHERE club_id = $1 AND status = 'active';`,
            [clubId]
        );

        // Count active teams
        const teamsCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM public.club_teams WHERE club_id = $1 AND is_archived = false;`,
            [clubId]
        );

        // Count pending invitations
        const invitationsCountRes = await query(
            `SELECT COUNT(*)::int AS count FROM public.club_team_invitations 
             WHERE club_id = $1 AND status = 'pending' AND expires_at > NOW();`,
            [clubId]
        );

        // Count team leads (unique users with team lead or admin/owner role)
        const teamLeadsCountRes = await query(
            `SELECT COUNT(DISTINCT user_id)::int AS count FROM (
                SELECT lead_user_id AS user_id FROM public.club_teams WHERE club_id = $1 AND lead_user_id IS NOT NULL AND is_archived = false
                UNION
                SELECT co_lead_user_id AS user_id FROM public.club_teams WHERE club_id = $1 AND co_lead_user_id IS NOT NULL AND is_archived = false
                UNION
                SELECT user_id FROM public.club_memberships WHERE club_id = $1 AND (club_role IN ('owner', 'admin', 'team_lead') OR access_role IN ('owner', 'admin', 'team_lead')) AND status = 'active'
             ) AS leads;`,
            [clubId]
        );

        return {
            totalMembers: membersCountRes.rows[0]?.count ?? 0,
            activeTeams: teamsCountRes.rows[0]?.count ?? 0,
            pendingInvitations: invitationsCountRes.rows[0]?.count ?? 0,
            teamLeads: teamLeadsCountRes.rows[0]?.count ?? 0,
            permissions: perms,
        };
    }

    /**
     * Lists teams/departments for a club.
     */
    static async listTeams(clubId: string, options: { includeArchived?: boolean } = {}) {
        const archivedClause = options.includeArchived ? "" : "AND t.is_archived = false";

        const teamsRes = await query(
            `SELECT
                t.id,
                t.club_id AS "clubId",
                t.name,
                t.slug,
                t.description,
                t.responsibilities,
                t.status,
                t.is_archived AS "isArchived",
                t.display_order AS "displayOrder",
                t.created_at AS "createdAt",
                t.updated_at AS "updatedAt",
                -- Lead details
                u_lead.id AS "leadId",
                u_lead.username AS "leadUsername",
                u_lead.firstname AS "leadFirstName",
                u_lead.lastname AS "leadLastName",
                COALESCE(u_lead.photo_url, u_lead.avatar_url) AS "leadAvatarUrl",
                -- Co-lead details
                u_colead.id AS "coLeadId",
                u_colead.username AS "coLeadUsername",
                u_colead.firstname AS "coLeadFirstName",
                u_colead.lastname AS "coLeadLastName",
                COALESCE(u_colead.photo_url, u_colead.avatar_url) AS "coLeadAvatarUrl",
                -- Member count
                COALESCE(mc.member_count, 0)::int AS "memberCount"
             FROM public.club_teams t
             LEFT JOIN public.users u_lead ON u_lead.id = t.lead_user_id
             LEFT JOIN public.users u_colead ON u_colead.id = t.co_lead_user_id
             LEFT JOIN (
                 SELECT team_id, COUNT(*)::int AS member_count
                 FROM public.club_team_members
                 WHERE status = 'active'
                 GROUP BY team_id
             ) mc ON mc.team_id = t.id
             WHERE t.club_id = $1 ${archivedClause}
             ORDER BY t.display_order ASC, t.created_at ASC;`,
            [clubId]
        );

        // Fetch up to 5 preview avatars per team
        const teams = teamsRes.rows;
        if (teams.length > 0) {
            const teamIds = teams.map((t: any) => t.id);
            const previewsRes = await query(
                `SELECT tm.team_id AS "teamId", u.id, u.username, u.firstname, u.lastname, COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl"
                 FROM public.club_team_members tm
                 JOIN public.users u ON u.id = tm.user_id
                 WHERE tm.team_id = ANY($1::uuid[]) AND tm.status = 'active'
                 ORDER BY tm.created_at ASC;`,
                [teamIds]
            );

            const previewsMap = new Map<string, any[]>();
            for (const row of previewsRes.rows) {
                if (!previewsMap.has(row.teamId)) {
                    previewsMap.set(row.teamId, []);
                }
                const arr = previewsMap.get(row.teamId)!;
                if (arr.length < 5) {
                    arr.push({
                        id: row.id,
                        username: row.username,
                        displayName: `${row.firstname || ""} ${row.lastname || ""}`.trim() || row.username,
                        avatarUrl: row.avatarUrl,
                    });
                }
            }

            for (const t of teams) {
                t.memberPreviews = previewsMap.get(t.id) || [];
                t.lead = t.leadId ? {
                    id: t.leadId,
                    username: t.leadUsername,
                    displayName: `${t.leadFirstName || ""} ${t.leadLastName || ""}`.trim() || t.leadUsername,
                    avatarUrl: t.leadAvatarUrl,
                } : null;
                t.coLead = t.coLeadId ? {
                    id: t.coLeadId,
                    username: t.coLeadUsername,
                    displayName: `${t.coLeadFirstName || ""} ${t.coLeadLastName || ""}`.trim() || t.coLeadUsername,
                    avatarUrl: t.coLeadAvatarUrl,
                } : null;
            }
        }

        return teams;
    }

    /**
     * Creates a new team or department inside a club.
     */
    static async createTeam(params: {
        clubId: string;
        userId: string;
        name: string;
        description?: string;
        responsibilities?: string;
        leadUserId?: string;
        coLeadUserId?: string;
        initialMemberIds?: string[];
    }) {
        const { clubId, userId, name, description, responsibilities, leadUserId, coLeadUserId, initialMemberIds } = params;

        const perms = await this.resolveUserClubPermissions(userId, clubId);
        if (!perms || !perms.canManageTeams) {
            const err: any = new Error("You do not have permission to create teams in this club.");
            err.statusCode = 403;
            throw err;
        }

        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            const err: any = new Error("Team name must be at least 2 characters.");
            err.statusCode = 400;
            throw err;
        }

        // Duplicate check
        const existingRes = await query(
            `SELECT id FROM public.club_teams WHERE club_id = $1 AND LOWER(btrim(name)) = LOWER($2) LIMIT 1;`,
            [clubId, trimmedName]
        );
        if (existingRes.rows[0]) {
            const err: any = new Error(`A team named "${trimmedName}" already exists in this club.`);
            err.statusCode = 409;
            throw err;
        }

        const slug = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

        const insertRes = await query(
            `INSERT INTO public.club_teams
                (club_id, name, slug, description, responsibilities, lead_user_id, co_lead_user_id, status, is_archived, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', false, $8)
             RETURNING id, club_id AS "clubId", name, slug, description, responsibilities, is_archived AS "isArchived", created_at AS "createdAt";`,
            [clubId, trimmedName, slug, description || null, responsibilities || null, leadUserId || null, coLeadUserId || null, userId]
        );
        const newTeam = insertRes.rows[0];

        // If lead assigned, record in club_team_members
        if (leadUserId) {
            await this.ensureTeamMembership(clubId, newTeam.id, leadUserId, "lead", "Team Lead", userId);
        }
        if (coLeadUserId && coLeadUserId !== leadUserId) {
            await this.ensureTeamMembership(clubId, newTeam.id, coLeadUserId, "co_lead", "Team Co-Lead", userId);
        }

        // If initial members provided, add them if they are existing club members
        if (Array.isArray(initialMemberIds)) {
            for (const memberUserId of initialMemberIds) {
                if (memberUserId && memberUserId !== leadUserId && memberUserId !== coLeadUserId) {
                    await this.ensureTeamMembership(clubId, newTeam.id, memberUserId, "member", "Member", userId).catch(() => {});
                }
            }
        }

        return newTeam;
    }

    /**
     * Updates team details.
     */
    static async updateTeam(params: {
        clubId: string;
        teamId: string;
        userId: string;
        name?: string;
        description?: string;
        responsibilities?: string;
        leadUserId?: string | null;
        coLeadUserId?: string | null;
    }) {
        const { clubId, teamId, userId, name, description, responsibilities, leadUserId, coLeadUserId } = params;

        const perms = await this.resolveUserClubPermissions(userId, clubId);
        if (!perms || !perms.canManageTeams) {
            const err: any = new Error("You do not have permission to edit this team.");
            err.statusCode = 403;
            throw err;
        }

        const existingRes = await query(
            `SELECT id, name FROM public.club_teams WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [teamId, clubId]
        );
        if (!existingRes.rows[0]) {
            const err: any = new Error("Team not found in this club.");
            err.statusCode = 404;
            throw err;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        if (typeof name === "string") {
            const trimmedName = name.trim();
            if (trimmedName.length < 2) {
                const err: any = new Error("Team name must be at least 2 characters.");
                err.statusCode = 400;
                throw err;
            }
            // Check uniqueness if name changed
            const dupRes = await query(
                `SELECT id FROM public.club_teams WHERE club_id = $1 AND LOWER(btrim(name)) = LOWER($2) AND id != $3 LIMIT 1;`,
                [clubId, trimmedName, teamId]
            );
            if (dupRes.rows[0]) {
                const err: any = new Error(`A team named "${trimmedName}" already exists in this club.`);
                err.statusCode = 409;
                throw err;
            }
            updates.push(`name = $${pIndex++}`);
            values.push(trimmedName);
            updates.push(`slug = $${pIndex++}`);
            values.push(trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
        }

        if (description !== undefined) {
            updates.push(`description = $${pIndex++}`);
            values.push(description);
        }

        if (responsibilities !== undefined) {
            updates.push(`responsibilities = $${pIndex++}`);
            values.push(responsibilities);
        }

        if (leadUserId !== undefined) {
            updates.push(`lead_user_id = $${pIndex++}`);
            values.push(leadUserId || null);
            if (leadUserId) {
                await this.ensureTeamMembership(clubId, teamId, leadUserId, "lead", "Team Lead", userId);
            }
        }

        if (coLeadUserId !== undefined) {
            updates.push(`co_lead_user_id = $${pIndex++}`);
            values.push(coLeadUserId || null);
            if (coLeadUserId) {
                await this.ensureTeamMembership(clubId, teamId, coLeadUserId, "co_lead", "Team Co-Lead", userId);
            }
        }

        updates.push(`updated_at = NOW()`);

        values.push(teamId, clubId);
        const updateSql = `
            UPDATE public.club_teams
            SET ${updates.join(", ")}
            WHERE id = $${pIndex++} AND club_id = $${pIndex++}
            RETURNING id, name, slug, description, responsibilities, lead_user_id AS "leadUserId", co_lead_user_id AS "coLeadUserId", is_archived AS "isArchived", updated_at AS "updatedAt";
        `;

        const res = await query(updateSql, values);
        return res.rows[0];
    }

    /**
     * Archives or unarchives a team.
     */
    static async archiveTeam(clubId: string, teamId: string, isArchived: boolean, userId: string) {
        const perms = await this.resolveUserClubPermissions(userId, clubId);
        if (!perms || !perms.canManageTeams) {
            const err: any = new Error("You do not have permission to archive teams.");
            err.statusCode = 403;
            throw err;
        }

        const res = await query(
            `UPDATE public.club_teams
             SET is_archived = $1, status = $2, updated_at = NOW()
             WHERE id = $3 AND club_id = $4
             RETURNING id, name, is_archived AS "isArchived", status;`,
            [isArchived, isArchived ? "archived" : "active", teamId, clubId]
        );

        if (!res.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        return res.rows[0];
    }

    /**
     * Safely deletes a team with confirmation.
     */
    static async deleteTeam(clubId: string, teamId: string, userId: string) {
        const perms = await this.resolveUserClubPermissions(userId, clubId);
        if (!perms || !perms.canManageTeams) {
            const err: any = new Error("You do not have permission to delete teams.");
            err.statusCode = 403;
            throw err;
        }

        // Delete team assignments first (handled by CASCADE or explicit cleanup)
        await query(`DELETE FROM public.club_team_members WHERE team_id = $1 AND club_id = $2;`, [teamId, clubId]);
        await query(`DELETE FROM public.club_team_invitations WHERE team_id = $1 AND club_id = $2;`, [teamId, clubId]);

        const res = await query(
            `DELETE FROM public.club_teams WHERE id = $1 AND club_id = $2 RETURNING id, name;`,
            [teamId, clubId]
        );

        if (!res.rows[0]) {
            const err: any = new Error("Team not found.");
            err.statusCode = 404;
            throw err;
        }

        return res.rows[0];
    }

    /**
     * Searches for existing Orbix users by username with safe public details.
     */
    static async searchUsers(queryStr: string, clubId: string) {
        const clean = queryStr.trim().toLowerCase();
        if (clean.length < 2) {
            return [];
        }

        const usersRes = await query(
            `SELECT
                u.id,
                u.username,
                u.firstname AS "firstName",
                u.lastname AS "lastName",
                NULLIF(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), '') AS "displayName",
                COALESCE(u.photo_url, u.avatar_url, 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png') AS "avatarUrl",
                u.headline,
                u.college,
                COALESCE(u.is_email_verified, false) AS "isVerifiedCoder",
                -- Membership state
                (cm.id IS NOT NULL) AS "isClubMember",
                cm.club_role AS "clubRole",
                cm.title AS "clubTitle",
                -- Pending invitation check
                (inv.id IS NOT NULL) AS "hasPendingInvitation"
             FROM public.users u
             LEFT JOIN public.club_memberships cm ON cm.club_id = $2 AND cm.user_id = u.id AND cm.status = 'active'
             LEFT JOIN public.club_team_invitations inv ON inv.club_id = $2 AND inv.invited_user_id = u.id AND inv.status = 'pending' AND inv.expires_at > NOW()
             WHERE (LOWER(u.username) LIKE $1 OR LOWER(u.firstname) LIKE $1 OR LOWER(u.lastname) LIKE $1)
               AND (u.account_type IS NULL OR u.account_type = 'personal')
             ORDER BY 
                CASE WHEN LOWER(u.username) = $3 THEN 0
                     WHEN LOWER(u.username) LIKE $4 THEN 1
                     ELSE 2
                END,
                u.orbix_score DESC,
                u.created_at DESC
             LIMIT 10;`,
            [`%${clean}%`, clubId, clean, `${clean}%`]
        );

        return usersRes.rows.map((row) => ({
            id: row.id,
            username: row.username,
            displayName: row.displayName || row.username,
            avatarUrl: row.avatarUrl,
            headline: row.headline,
            college: row.college,
            isVerifiedCoder: Boolean(row.isVerifiedCoder),
            isClubMember: Boolean(row.isClubMember),
            clubRole: row.clubRole || null,
            clubTitle: row.clubTitle || null,
            hasPendingInvitation: Boolean(row.hasPendingInvitation),
        }));
    }

    /**
     * Lists the full roster of club members with their assigned teams and positions.
     */
    static async listMembers(clubId: string, filters: { teamId?: string; role?: string; search?: string } = {}) {
        let whereExtra = "";
        const values: any[] = [clubId];
        let pIdx = 2;

        if (filters.role) {
            whereExtra += ` AND (LOWER(cm.club_role) = $${pIdx} OR LOWER(cm.access_role) = $${pIdx})`;
            values.push(filters.role.toLowerCase());
            pIdx++;
        }

        if (filters.search) {
            const s = `%${filters.search.trim().toLowerCase()}%`;
            whereExtra += ` AND (LOWER(u.username) LIKE $${pIdx} OR LOWER(u.firstname) LIKE $${pIdx} OR LOWER(u.lastname) LIKE $${pIdx} OR LOWER(cm.title) LIKE $${pIdx})`;
            values.push(s);
            pIdx++;
        }

        const membersRes = await query(
            `SELECT
                cm.id AS "membershipId",
                cm.club_id AS "clubId",
                cm.user_id AS "userId",
                COALESCE(cm.club_role, cm.access_role, 'member') AS "clubRole",
                cm.title,
                cm.status,
                cm.joined_at AS "joinedAt",
                cm.created_at AS "createdAt",
                -- User Details
                u.username,
                u.firstname AS "firstName",
                u.lastname AS "lastName",
                NULLIF(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), '') AS "displayName",
                COALESCE(u.photo_url, u.avatar_url, 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png') AS "avatarUrl",
                u.headline,
                u.college,
                u.location,
                COALESCE(u.is_email_verified, false) AS "isVerifiedCoder"
             FROM public.club_memberships cm
             JOIN public.users u ON u.id = cm.user_id
             WHERE cm.club_id = $1 AND cm.status = 'active' ${whereExtra}
             ORDER BY
                CASE COALESCE(cm.club_role, cm.access_role, 'member')
                    WHEN 'owner' THEN 1
                    WHEN 'admin' THEN 2
                    WHEN 'team_lead' THEN 3
                    WHEN 'advisor' THEN 4
                    ELSE 5
                END ASC,
                cm.joined_at ASC;`,
            values
        );

        const members = membersRes.rows;
        if (members.length === 0) return [];

        const userIds = members.map((m: any) => m.userId);

        // Fetch team assignments for all members
        const teamMembersRes = await query(
            `SELECT
                tm.user_id AS "userId",
                tm.team_id AS "teamId",
                t.name AS "teamName",
                tm.team_role AS "teamRole",
                COALESCE(tm.team_title, tm.position_title, 'Member') AS "positionTitle"
             FROM public.club_team_members tm
             JOIN public.club_teams t ON t.id = tm.team_id
             WHERE tm.club_id = $1 AND tm.user_id = ANY($2::uuid[]) AND tm.status = 'active'
             ORDER BY tm.created_at ASC;`,
            [clubId, userIds]
        );

        const userTeamsMap = new Map<string, any[]>();
        for (const row of teamMembersRes.rows) {
            if (!userTeamsMap.has(row.userId)) {
                userTeamsMap.set(row.userId, []);
            }
            userTeamsMap.get(row.userId)!.push({
                teamId: row.teamId,
                teamName: row.teamName,
                teamRole: row.teamRole,
                positionTitle: row.positionTitle,
            });
        }

        let filteredMembers = members.map((m: any) => ({
            ...m,
            displayName: m.displayName || m.username,
            teams: userTeamsMap.get(m.userId) || [],
        }));

        if (filters.teamId) {
            filteredMembers = filteredMembers.filter((m: any) =>
                m.teams.some((t: any) => t.teamId === filters.teamId)
            );
        }

        return filteredMembers;
    }

    /**
     * Updates a member's club access role or organizational title.
     */
    static async updateMember(params: {
        clubId: string;
        membershipId: string;
        updates: { clubRole?: string; title?: string; status?: string };
        actorUserId: string;
    }) {
        const { clubId, membershipId, updates, actorUserId } = params;

        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || !perms.canManageMembers) {
            const err: any = new Error("You do not have permission to manage members.");
            err.statusCode = 403;
            throw err;
        }

        const memRes = await query(
            `SELECT id, user_id, club_role, access_role FROM public.club_memberships WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [membershipId, clubId]
        );
        const member = memRes.rows[0];
        if (!member) {
            const err: any = new Error("Membership record not found.");
            err.statusCode = 404;
            throw err;
        }

        const currentRole = member.club_role || member.access_role || "member";

        // Non-owners cannot modify an owner
        if (currentRole === "owner" && !perms.isOwner) {
            const err: any = new Error("Only the Club Owner can manage the owner's role.");
            err.statusCode = 403;
            throw err;
        }

        // Only owner can promote someone to owner or admin
        if (updates.clubRole) {
            const newRole = updates.clubRole.toLowerCase();
            if (newRole === "owner" && !perms.isOwner) {
                const err: any = new Error("Only the Club Owner can transfer or grant owner role.");
                err.statusCode = 403;
                throw err;
            }
            if (newRole === "admin" && !perms.isOwner) {
                const err: any = new Error("Only the Club Owner can appoint club administrators.");
                err.statusCode = 403;
                throw err;
            }
        }

        const fields: string[] = [];
        const vals: any[] = [];
        let idx = 1;

        if (updates.clubRole) {
            fields.push(`club_role = $${idx++}`);
            vals.push(updates.clubRole.toLowerCase());
            fields.push(`access_role = $${idx++}`);
            vals.push(updates.clubRole.toLowerCase());
        }

        if (updates.title) {
            fields.push(`title = $${idx++}`);
            vals.push(updates.title.trim());
        }

        if (updates.status) {
            fields.push(`status = $${idx++}`);
            vals.push(updates.status);
        }

        fields.push(`updated_at = NOW()`);
        vals.push(membershipId, clubId);

        const res = await query(
            `UPDATE public.club_memberships
             SET ${fields.join(", ")}
             WHERE id = $${idx++} AND club_id = $${idx++}
             RETURNING id, user_id AS "userId", club_role AS "clubRole", title, status, updated_at AS "updatedAt";`,
            vals
        );

        return res.rows[0];
    }

    /**
     * Removes a member from the club and all its teams.
     */
    static async removeMember(clubId: string, membershipId: string, actorUserId: string) {
        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || !perms.canManageMembers) {
            const err: any = new Error("You do not have permission to remove members.");
            err.statusCode = 403;
            throw err;
        }

        const memRes = await query(
            `SELECT id, user_id, club_role, access_role FROM public.club_memberships WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [membershipId, clubId]
        );
        const member = memRes.rows[0];
        if (!member) {
            const err: any = new Error("Member not found in this club.");
            err.statusCode = 404;
            throw err;
        }

        const targetRole = member.club_role || member.access_role || "member";

        // Prevent removing owner
        if (targetRole === "owner") {
            const err: any = new Error("Cannot remove the Club Owner. Transfer ownership first.");
            err.statusCode = 400;
            throw err;
        }

        // Admins cannot remove other admins unless owner
        if (targetRole === "admin" && !perms.isOwner) {
            const err: any = new Error("Only the Club Owner can remove club administrators.");
            err.statusCode = 403;
            throw err;
        }

        // Delete from all team assignments first
        await query(`DELETE FROM public.club_team_members WHERE club_id = $1 AND user_id = $2;`, [clubId, member.user_id]);

        // Clear from lead positions in club_teams
        await query(`UPDATE public.club_teams SET lead_user_id = NULL WHERE club_id = $1 AND lead_user_id = $2;`, [clubId, member.user_id]);
        await query(`UPDATE public.club_teams SET co_lead_user_id = NULL WHERE club_id = $1 AND co_lead_user_id = $2;`, [clubId, member.user_id]);

        // Delete membership record
        await query(`DELETE FROM public.club_memberships WHERE id = $1 AND club_id = $2;`, [membershipId, clubId]);

        return { success: true, removedUserId: member.user_id };
    }

    /**
     * Assigns an existing club member to a team.
     */
    static async assignMemberToTeam(clubId: string, teamId: string, targetUserId: string, teamRole: string = "member", positionTitle: string = "Member", actorUserId: string) {
        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || (!perms.canManageTeams && !perms.assignedTeamIds.includes(teamId))) {
            const err: any = new Error("You do not have permission to assign members to this team.");
            err.statusCode = 403;
            throw err;
        }

        return await this.ensureTeamMembership(clubId, teamId, targetUserId, teamRole, positionTitle, actorUserId);
    }

    /**
     * Removes a member from a specific team.
     */
    static async removeMemberFromTeam(clubId: string, teamId: string, targetUserId: string, actorUserId: string) {
        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || (!perms.canManageTeams && !perms.assignedTeamIds.includes(teamId))) {
            const err: any = new Error("You do not have permission to remove members from this team.");
            err.statusCode = 403;
            throw err;
        }

        // Clear team lead if assigned
        await query(
            `UPDATE public.club_teams 
             SET lead_user_id = CASE WHEN lead_user_id = $1 THEN NULL ELSE lead_user_id END,
                 co_lead_user_id = CASE WHEN co_lead_user_id = $1 THEN NULL ELSE co_lead_user_id END
             WHERE id = $2 AND club_id = $3;`,
            [targetUserId, teamId, clubId]
        );

        // Delete from club_team_members
        const res = await query(
            `DELETE FROM public.club_team_members WHERE team_id = $1 AND club_id = $2 AND user_id = $3 RETURNING id;`,
            [teamId, clubId, targetUserId]
        );

        return { success: true, removed: res.rows.length > 0 };
    }

    /**
     * Creates and dispatches a team invitation with inbox notification.
     */
    static async createInvitation(params: {
        clubId: string;
        inviterUserId: string;
        targetUsernameOrId: string;
        teamId?: string;
        clubRole?: string;
        teamRole?: string;
        title?: string;
        invitationMessage?: string;
    }) {
        const { clubId, inviterUserId, targetUsernameOrId, teamId, clubRole = "member", teamRole = "member", title = "Member", invitationMessage } = params;

        const perms = await this.resolveUserClubPermissions(inviterUserId, clubId);
        if (!perms || (!perms.canInviteMembers && (!teamId || !perms.assignedTeamIds.includes(teamId)))) {
            const err: any = new Error("You do not have permission to invite members.");
            err.statusCode = 403;
            throw err;
        }

        // Team leads can only assign member or co-lead roles in their own team
        if (!perms.isAdmin && (clubRole === "admin" || clubRole === "owner")) {
            const err: any = new Error("Team leads cannot grant administrator permissions.");
            err.statusCode = 403;
            throw err;
        }

        // 1. Resolve invited user
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUsernameOrId);
        const userRes = isUuid
            ? await query(
                  `SELECT id, username, firstname, lastname, email FROM public.users
                   WHERE id = $1 OR LOWER(username) = LOWER($2) LIMIT 1;`,
                  [targetUsernameOrId, targetUsernameOrId]
              )
            : await query(
                  `SELECT id, username, firstname, lastname, email FROM public.users
                   WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                  [targetUsernameOrId]
              );

        const targetUser = userRes.rows[0];
        if (!targetUser) {
            const err: any = new Error("User not found on Orbix. They must create an account first.");
            err.statusCode = 404;
            throw err;
        }

        const targetUserId = targetUser.id;

        // 2. Fetch team details if teamId provided
        let teamName = "Club Wide";
        if (teamId) {
            const teamRes = await query(`SELECT id, name FROM public.club_teams WHERE id = $1 AND club_id = $2 LIMIT 1;`, [teamId, clubId]);
            if (!teamRes.rows[0]) {
                const err: any = new Error("Selected team does not exist in this club.");
                err.statusCode = 404;
                throw err;
            }
            teamName = teamRes.rows[0].name;

            // Check if already in this team
            const existingTeamMem = await query(
                `SELECT id FROM public.club_team_members WHERE team_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1;`,
                [teamId, targetUserId]
            );
            if (existingTeamMem.rows[0]) {
                const err: any = new Error(`@${targetUser.username} is already an active member of "${teamName}".`);
                err.statusCode = 409;
                throw err;
            }
        } else {
            // Check if already in club
            const existingClubMem = await query(
                `SELECT id FROM public.club_memberships WHERE club_id = $1 AND user_id = $2 AND status = 'active' LIMIT 1;`,
                [clubId, targetUserId]
            );
            if (existingClubMem.rows[0]) {
                const err: any = new Error(`@${targetUser.username} is already a member of this club.`);
                err.statusCode = 409;
                throw err;
            }
        }

        // 3. Check for existing pending invitation
        const pendingRes = await query(
            `SELECT id FROM public.club_team_invitations
             WHERE club_id = $1 AND invited_user_id = $2 
               AND (team_id = $3 OR (team_id IS NULL AND $3 IS NULL))
               AND status = 'pending' AND expires_at > NOW()
             LIMIT 1;`,
            [clubId, targetUserId, teamId || null]
        );
        if (pendingRes.rows[0]) {
            const err: any = new Error(`A pending invitation for @${targetUser.username} already exists.`);
            err.statusCode = 409;
            throw err;
        }

        // 4. Fetch Inviter and Club info for the notification
        const inviterRes = await query(`SELECT id, username, firstname, lastname, photo_url, avatar_url FROM public.users WHERE id = $1;`, [inviterUserId]);
        const inviter = inviterRes.rows[0];
        const inviterName = `${inviter?.firstname || ""} ${inviter?.lastname || ""}`.trim() || inviter?.username || "A club manager";

        const clubRes = await query(`SELECT id, name, slug, logo_url, college_name FROM public.verified_clubs WHERE id = $1;`, [clubId]);
        const club = clubRes.rows[0];

        // 5. Insert Invitation Record
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry
        const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        const invInsert = await query(
            `INSERT INTO public.club_team_invitations
                (club_id, team_id, invited_user_id, invited_by_user_id, inviter_user_id, access_role, club_role, team_role, title, team_title, position_title, status, token, invitation_message, expires_at)
             VALUES ($1, $2, $3, $4, $4, $5, $5, $6, $7, $7, $7, 'pending', $8, $9, $10)
             RETURNING id, club_id AS "clubId", team_id AS "teamId", invited_user_id AS "invitedUserId", status, expires_at AS "expiresAt", created_at AS "createdAt";`,
            [clubId, teamId || null, targetUserId, inviterUserId, clubRole, teamRole, title, token, invitationMessage || null, expiresAt]
        );
        const invitation = invInsert.rows[0];

        // 6. Create Notification in user_notifications table
        const notifBody = `You have been invited to join ${club.name} as ${title || "Member"}${teamId ? ` in the ${teamName} department` : ""}.`;

        const notifMeta = {
            notification_type: "club_team_invitation",
            invitationId: invitation.id,
            clubId: club.id,
            clubName: club.name,
            clubSlug: club.slug,
            clubLogoUrl: club.logo_url,
            collegeName: club.college_name,
            teamId: teamId || null,
            teamName: teamId ? teamName : null,
            clubRole,
            teamRole,
            positionTitle: title,
            inviterId: inviter.id,
            inviterUsername: inviter.username,
            inviterName,
            inviterAvatarUrl: inviter.photo_url || inviter.avatar_url,
            expiresAt: expiresAt.toISOString(),
            invitationStatus: "pending",
            message: invitationMessage || null,
        };

        const notifRes = await query(
            `INSERT INTO public.user_notifications
                (user_id, username, actor_id, notification_type, type, title, body, metadata, is_read)
             VALUES ($1, $2, $3, 'club_team_invitation', 'club_team_invitation', 'Club Team Invitation', $4, $5, false)
             RETURNING id;`,
            [targetUserId, targetUser.username, inviterUserId, notifBody, JSON.stringify(notifMeta)]
        );

        if (notifRes.rows[0]) {
            await query(`UPDATE public.club_team_invitations SET notification_id = $1 WHERE id = $2;`, [notifRes.rows[0].id, invitation.id]);
        }

        return {
            success: true,
            invitationId: invitation.id,
            invitedUsername: targetUser.username,
            teamName,
            expiresAt,
            message: `Invitation successfully sent to @${targetUser.username}. A notification has been placed in their Orbix inbox.`,
        };
    }

    /**
     * Lists invitations for a club.
     */
    static async listInvitations(clubId: string, status?: string) {
        let whereStatus = "";
        const vals: any[] = [clubId];
        if (status) {
            whereStatus = `AND inv.status = $2`;
            vals.push(status);
        }

        const res = await query(
            `SELECT
                inv.id,
                inv.club_id AS "clubId",
                inv.team_id AS "teamId",
                t.name AS "teamName",
                inv.invited_user_id AS "invitedUserId",
                u_inv.username AS "invitedUsername",
                u_inv.firstname AS "invitedFirstName",
                u_inv.lastname AS "invitedLastName",
                COALESCE(u_inv.photo_url, u_inv.avatar_url) AS "invitedAvatarUrl",
                inv.inviter_user_id AS "inviterUserId",
                u_by.username AS "inviterUsername",
                u_by.firstname AS "inviterFirstName",
                u_by.lastname AS "inviterLastName",
                COALESCE(inv.club_role, inv.access_role, 'member') AS "clubRole",
                inv.team_role AS "teamRole",
                COALESCE(inv.position_title, inv.team_title, inv.title, 'Member') AS "positionTitle",
                inv.status,
                inv.invitation_message AS "invitationMessage",
                inv.expires_at AS "expiresAt",
                inv.responded_at AS "respondedAt",
                inv.created_at AS "createdAt",
                (inv.expires_at <= NOW() AND inv.status = 'pending') AS "isExpired"
             FROM public.club_team_invitations inv
             JOIN public.users u_inv ON u_inv.id = inv.invited_user_id
             LEFT JOIN public.users u_by ON u_by.id = inv.inviter_user_id
             LEFT JOIN public.club_teams t ON t.id = inv.team_id
             WHERE inv.club_id = $1 ${whereStatus}
             ORDER BY inv.created_at DESC;`,
            vals
        );

        return res.rows.map((row) => ({
            id: row.id,
            clubId: row.clubId,
            teamId: row.teamId,
            teamName: row.teamName || "Club-Wide",
            invitedUser: {
                id: row.invitedUserId,
                username: row.invitedUsername,
                displayName: `${row.invitedFirstName || ""} ${row.invitedLastName || ""}`.trim() || row.invitedUsername,
                avatarUrl: row.invitedAvatarUrl,
            },
            inviterUser: row.inviterUserId ? {
                id: row.inviterUserId,
                username: row.inviterUsername,
                displayName: `${row.inviterFirstName || ""} ${row.inviterLastName || ""}`.trim() || row.inviterUsername,
            } : null,
            clubRole: row.clubRole,
            teamRole: row.teamRole,
            positionTitle: row.positionTitle,
            status: row.isExpired ? "expired" : row.status,
            invitationMessage: row.invitationMessage,
            expiresAt: row.expiresAt,
            respondedAt: row.respondedAt,
            createdAt: row.createdAt,
        }));
    }

    /**
     * Cancels a pending invitation.
     */
    static async cancelInvitation(clubId: string, invitationId: string, actorUserId: string) {
        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || !perms.canInviteMembers) {
            const err: any = new Error("You do not have permission to cancel invitations.");
            err.statusCode = 403;
            throw err;
        }

        const res = await query(
            `UPDATE public.club_team_invitations
             SET status = 'cancelled', updated_at = NOW()
             WHERE id = $1 AND club_id = $2 AND status = 'pending'
             RETURNING id, notification_id AS "notificationId", invited_user_id AS "invitedUserId";`,
            [invitationId, clubId]
        );

        if (!res.rows[0]) {
            const err: any = new Error("Invitation not found or is no longer pending.");
            err.statusCode = 404;
            throw err;
        }

        // Update notification in inbox if exists
        if (res.rows[0].notificationId) {
            await query(
                `UPDATE public.user_notifications
                 SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{invitationStatus}', '"cancelled"'),
                     is_read = true
                 WHERE id = $1;`,
                [res.rows[0].notificationId]
            ).catch(() => {});
        }

        return { success: true, message: "Invitation cancelled." };
    }

    /**
     * Resends an invitation with a fresh 7-day expiration.
     */
    static async resendInvitation(clubId: string, invitationId: string, actorUserId: string) {
        const perms = await this.resolveUserClubPermissions(actorUserId, clubId);
        if (!perms || !perms.canInviteMembers) {
            const err: any = new Error("You do not have permission to resend invitations.");
            err.statusCode = 403;
            throw err;
        }

        const invRes = await query(
            `SELECT * FROM public.club_team_invitations WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [invitationId, clubId]
        );
        const inv = invRes.rows[0];
        if (!inv) {
            const err: any = new Error("Invitation not found.");
            err.statusCode = 404;
            throw err;
        }

        if (inv.status === "accepted") {
            const err: any = new Error("This user is already an accepted member of the club.");
            err.statusCode = 400;
            throw err;
        }

        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await query(
            `UPDATE public.club_team_invitations
             SET status = 'pending', expires_at = $1, updated_at = NOW()
             WHERE id = $2;`,
            [expiresAt, invitationId]
        );

        // Update notification
        if (inv.notification_id) {
            await query(
                `UPDATE public.user_notifications
                 SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{invitationStatus}', '"pending"'),
                     is_read = false,
                     created_at = NOW()
                 WHERE id = $1;`,
                [inv.notification_id]
            ).catch(() => {});
        }

        return { success: true, expiresAt, message: "Invitation renewed and resent." };
    }

    /**
     * Accepts an invitation (Executed by the invited user).
     */
    static async acceptInvitation(invitationId: string, recipientUserId: string) {
        // 1. Fetch and validate invitation
        const invRes = await query(
            `SELECT inv.*, c.name AS "clubName", c.slug AS "clubSlug", t.name AS "teamName"
             FROM public.club_team_invitations inv
             JOIN public.verified_clubs c ON c.id = inv.club_id
             LEFT JOIN public.club_teams t ON t.id = inv.team_id
             WHERE inv.id = $1 LIMIT 1;`,
            [invitationId]
        );
        const inv = invRes.rows[0];
        if (!inv) {
            const err: any = new Error("Invitation not found.");
            err.statusCode = 404;
            throw err;
        }

        if (inv.invited_user_id !== recipientUserId) {
            const err: any = new Error("This invitation was not addressed to your account.");
            err.statusCode = 403;
            throw err;
        }

        if (inv.status === "accepted") {
            return {
                success: true,
                alreadyAccepted: true,
                clubId: inv.club_id,
                clubName: inv.clubName,
                message: `You are already a member of ${inv.clubName}.`,
            };
        }

        if (inv.status !== "pending") {
            const err: any = new Error(`This invitation is ${inv.status} and can no longer be accepted.`);
            err.statusCode = 400;
            throw err;
        }

        if (new Date(inv.expires_at).getTime() <= Date.now()) {
            await query(`UPDATE public.club_team_invitations SET status = 'expired' WHERE id = $1;`, [invitationId]);
            const err: any = new Error("This invitation has expired. Please ask the club manager to resend it.");
            err.statusCode = 400;
            throw err;
        }

        const clubId = inv.club_id;
        const clubRole = inv.club_role || inv.access_role || "member";
        const title = inv.position_title || inv.team_title || inv.title || "Member";
        const teamId = inv.team_id;
        const teamRole = inv.team_role || "member";

        // 2. Atomic Membership Creation / Activation
        // Ensure club_memberships row exists
        const memRes = await query(
            `INSERT INTO public.club_memberships
                (club_id, user_id, club_role, access_role, title, status, invited_by, joined_at)
             VALUES ($1, $2, $3, $3, $4, 'active', $5, NOW())
             ON CONFLICT (club_id, user_id) DO UPDATE
             SET status = 'active',
                 title = CASE WHEN public.club_memberships.title = 'Member' AND EXCLUDED.title != 'Member' THEN EXCLUDED.title ELSE public.club_memberships.title END,
                 updated_at = NOW()
             RETURNING id;`,
            [clubId, recipientUserId, clubRole, title, inv.inviter_user_id]
        );
        const membershipId = memRes.rows[0].id;

        // If teamId provided, add to club_team_members
        if (teamId) {
            await query(
                `INSERT INTO public.club_team_members
                    (team_id, club_id, user_id, club_membership_id, team_role, team_title, position_title, status, assigned_by)
                 VALUES ($1, $2, $3, $4, $5, $6, $6, 'active', $7)
                 ON CONFLICT (team_id, user_id) DO UPDATE
                 SET status = 'active', team_role = EXCLUDED.team_role, team_title = EXCLUDED.team_title, position_title = EXCLUDED.position_title, updated_at = NOW();`,
                [teamId, clubId, recipientUserId, membershipId, teamRole, title, inv.inviter_user_id]
            );

            // If invited as lead, update team lead pointer
            if (teamRole === "lead") {
                await query(`UPDATE public.club_teams SET lead_user_id = $1 WHERE id = $2 AND club_id = $3;`, [recipientUserId, teamId, clubId]);
            } else if (teamRole === "co_lead") {
                await query(`UPDATE public.club_teams SET co_lead_user_id = $1 WHERE id = $2 AND club_id = $3;`, [recipientUserId, teamId, clubId]);
            }
        }

        // 3. Mark Invitation Accepted
        await query(
            `UPDATE public.club_team_invitations
             SET status = 'accepted', responded_at = NOW(), updated_at = NOW()
             WHERE id = $1;`,
            [invitationId]
        );

        // 4. Update the recipient's notification
        if (inv.notification_id) {
            await query(
                `UPDATE public.user_notifications
                 SET metadata = jsonb_set(
                     jsonb_set(COALESCE(metadata, '{}'::jsonb), '{invitationStatus}', '"accepted"'),
                     '{acceptedAt}', to_jsonb(NOW()::text)
                 ),
                 is_read = true
                 WHERE id = $1;`,
                [inv.notification_id]
            ).catch(() => {});
        }

        // 5. Notify the inviter of acceptance
        if (inv.inviter_user_id) {
            const recipientUserRes = await query(`SELECT username, firstname, lastname FROM public.users WHERE id = $1;`, [recipientUserId]);
            const rUser = recipientUserRes.rows[0];
            const rName = `${rUser?.firstname || ""} ${rUser?.lastname || ""}`.trim() || rUser?.username || "A developer";

            await query(
                `INSERT INTO public.user_notifications
                    (user_id, username, actor_id, notification_type, type, title, body, metadata, is_read)
                 VALUES (
                    $1,
                    (SELECT username FROM public.users WHERE id = $1),
                    $2,
                    'club_team_invitation_accepted',
                    'club_team_invitation_accepted',
                    'Invitation Accepted',
                    $3,
                    $4,
                    false
                 );`,
                [
                    inv.inviter_user_id,
                    recipientUserId,
                    `@${rUser?.username} accepted your invitation to join ${inv.clubName}!`,
                    JSON.stringify({
                        clubId,
                        clubName: inv.clubName,
                        teamId,
                        teamName: inv.teamName,
                        acceptedUserId: recipientUserId,
                        acceptedUsername: rUser?.username,
                        acceptedName: rName,
                    })
                ]
            ).catch(() => {});
        }

        return {
            success: true,
            clubId,
            clubName: inv.clubName,
            clubSlug: inv.clubSlug,
            teamName: inv.teamName || "Club-Wide",
            message: `Congratulations! You have joined ${inv.clubName} as ${title}.`,
        };
    }

    /**
     * Declines an invitation (Executed by the invited user).
     */
    static async declineInvitation(invitationId: string, recipientUserId: string) {
        const invRes = await query(
            `SELECT inv.*, c.name AS "clubName"
             FROM public.club_team_invitations inv
             JOIN public.verified_clubs c ON c.id = inv.club_id
             WHERE inv.id = $1 LIMIT 1;`,
            [invitationId]
        );
        const inv = invRes.rows[0];
        if (!inv) {
            const err: any = new Error("Invitation not found.");
            err.statusCode = 404;
            throw err;
        }

        if (inv.invited_user_id !== recipientUserId) {
            const err: any = new Error("This invitation was not addressed to your account.");
            err.statusCode = 403;
            throw err;
        }

        if (inv.status !== "pending") {
            const err: any = new Error(`Invitation is already ${inv.status}.`);
            err.statusCode = 400;
            throw err;
        }

        await query(
            `UPDATE public.club_team_invitations
             SET status = 'declined', responded_at = NOW(), updated_at = NOW()
             WHERE id = $1;`,
            [invitationId]
        );

        if (inv.notification_id) {
            await query(
                `UPDATE public.user_notifications
                 SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{invitationStatus}', '"declined"'),
                     is_read = true
                 WHERE id = $1;`,
                [inv.notification_id]
            ).catch(() => {});
        }

        return { success: true, message: `You declined the invitation to join ${inv.clubName}.` };
    }

    /**
     * Helper to ensure a membership row exists in club_team_members.
     */
    private static async ensureTeamMembership(clubId: string, teamId: string, userId: string, teamRole: string, title: string, actorUserId: string) {
        // Ensure club_memberships exists
        const memRes = await query(
            `INSERT INTO public.club_memberships (club_id, user_id, club_role, access_role, title, status, invited_by, joined_at)
             VALUES ($1, $2, 'member', 'member', $3, 'active', $4, NOW())
             ON CONFLICT (club_id, user_id) DO NOTHING
             RETURNING id;`,
            [clubId, userId, title, actorUserId]
        );

        const membershipId = memRes.rows[0]?.id || (
            await query(`SELECT id FROM public.club_memberships WHERE club_id = $1 AND user_id = $2;`, [clubId, userId])
        ).rows[0]?.id;

        // Insert into club_team_members
        const res = await query(
            `INSERT INTO public.club_team_members
                (team_id, club_id, user_id, club_membership_id, team_role, team_title, position_title, status, assigned_by)
             VALUES ($1, $2, $3, $4, $5, $6, $6, 'active', $7)
             ON CONFLICT (team_id, user_id) DO UPDATE
             SET team_role = EXCLUDED.team_role, team_title = EXCLUDED.team_title, position_title = EXCLUDED.position_title, status = 'active', updated_at = NOW()
             RETURNING id;`,
            [teamId, clubId, userId, membershipId, teamRole, title, actorUserId]
        );

        return res.rows[0];
    }
}
