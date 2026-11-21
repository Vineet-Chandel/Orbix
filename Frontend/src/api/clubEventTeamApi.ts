import { buildApiUrl, getAuthHeaders } from "./apiClient";

export interface EventTeamMember {
    id: string;
    teamId: string;
    userId: string;
    role: "leader" | "member";
    joinedAt: string;
    name: string;
    username: string;
    email: string;
    avatarUrl: string;
}

export interface EventTeamInvitation {
    id: string;
    teamId: string;
    eventId?: string;
    inviterUserId?: string;
    inviteeUserId?: string;
    status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
    createdAt: string;
    respondedAt?: string | null;
    teamName?: string;
    teamCode?: string;
    eventTitle?: string;
    startsAt?: string;
    inviterName?: string;
    inviterUsername?: string;
    inviterAvatarUrl?: string;
    inviteeUsername?: string;
    inviteeName?: string;
    inviteeEmail?: string;
    inviteeAvatarUrl?: string | null;
}

export interface EventTeamDetails {
    id: string;
    eventId: string;
    clubId: string;
    name: string;
    code: string;
    leaderId: string;
    leaderUsername?: string;
    leaderName?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    membersCount: number;
    minTeamSize: number;
    maxTeamSize: number;
    eventStartsAt: string;
    eventTitle: string;
    isEventStarted: boolean;
    isLeader: boolean;
    isLocked?: boolean;
    lockReason?: string | null;
    registrationDeadline?: string | null;
    members: EventTeamMember[];
    pendingInvitations?: EventTeamInvitation[];
}

export interface SearchUserResult {
    id: string;
    username: string;
    name: string;
    email: string;
    avatarUrl: string;
    isMember: boolean;
    hasPendingInvite: boolean;
    collegeId?: string | null;
    collegeName?: string | null;
    isCollegeMismatch?: boolean;
    isEligible?: boolean;
    mismatchReason?: string | null;
    isAlreadyInTeam?: boolean;
    isAlreadyRegistered?: boolean;
}

export const clubEventTeamApi = {
    /**
     * Create a new team for an event (creator automatically becomes Leader)
     */
    async createTeam(eventId: string, name: string): Promise<{ success: boolean; message: string; team: EventTeamDetails }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams`), {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to create team.");
        }
        return data;
    },

    /**
     * Join an existing team using the 6-character team code
     */
    async joinTeamByCode(eventId: string, teamCode: string): Promise<{ success: boolean; message: string; team: EventTeamDetails }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/join`), {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ teamCode }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to join team.");
        }
        return data;
    },

    /**
     * Fetch user's team & pending invites for an event
     */
    async getMyTeam(eventId: string): Promise<{ success: boolean; team: EventTeamDetails | null; pendingInvites: EventTeamInvitation[] }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/my-team`), {
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to fetch your team.");
        }
        return data;
    },

    /**
     * Fetch full team details & member roster
     */
    async getTeamDetails(eventId: string, teamId: string): Promise<{ success: boolean; team: EventTeamDetails }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}`), {
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to fetch team details.");
        }
        return data;
    },

    /**
     * Search users by username to invite to the team
     */
    async searchUsers(eventId: string, teamId: string = "new", query: string): Promise<{ success: boolean; users: SearchUserResult[] }> {
        const url = teamId && teamId !== "new"
            ? buildApiUrl(`/events/${eventId}/teams/${teamId}/search-users?q=${encodeURIComponent(query)}`)
            : buildApiUrl(`/events/${eventId}/search-users?q=${encodeURIComponent(query)}`);
        const res = await fetch(url, {
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to search users.");
        }
        return data;
    },

    /**
     * Invite user by their @username (Leader only)
     */
    async inviteMember(eventId: string, teamId: string, username: string): Promise<{ success: boolean; message: string; invitation: any }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/invites`), {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ username }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to send invitation.");
        }
        return data;
    },

    /**
     * Revoke / cancel a pending team invitation (Leader only)
     */
    async cancelInvitation(eventId: string, teamId: string, invitationId: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/invites/${invitationId}`), {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to revoke invitation.");
        }
        return data;
    },

    /**
     * Respond to team invitation (Accept or Decline)
     */
    async respondToInvitation(invitationId: string, action: "accept" | "decline"): Promise<{ success: boolean; message: string; team?: EventTeamDetails }> {
        const res = await fetch(buildApiUrl(`/events/invitations/${invitationId}/respond`), {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ action }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to respond to invitation.");
        }
        return data;
    },

    /**
     * Get all pending team invitations for current user across all events
     */
    async getMyPendingInvitations(): Promise<{ success: boolean; invitations: any[] }> {
        const res = await fetch(buildApiUrl(`/events/invitations/my`), {
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to fetch invitations.");
        }
        return data;
    },

    /**
     * Leave team (Warning popup required on frontend)
     */
    async leaveTeam(eventId: string, teamId: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/leave`), {
            method: "POST",
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to leave team.");
        }
        return data;
    },

    /**
     * Remove a member from team (Leader only)
     */
    async removeMember(eventId: string, teamId: string, targetUserId: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/members/${targetUserId}`), {
            method: "DELETE",
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to remove member.");
        }
        return data;
    },

    /**
     * Rename team (Leader only)
     */
    async renameTeam(eventId: string, teamId: string, name: string): Promise<{ success: boolean; message: string; team: { id: string; name: string } }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/rename`), {
            method: "PATCH",
            headers: getAuthHeaders(),
            body: JSON.stringify({ name }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to rename team.");
        }
        return data;
    },

    /**
     * Transfer leadership to another confirmed member (Leader only)
     */
    async transferLeadership(eventId: string, teamId: string, newLeaderUserId: string): Promise<{ success: boolean; message: string; team?: EventTeamDetails }> {
        const res = await fetch(buildApiUrl(`/events/${eventId}/teams/${teamId}/transfer-leader`), {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ newLeaderUserId }),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to transfer leadership.");
        }
        return data;
    },

    /**
     * Organizer endpoint: Get all teams and members for an event
     */
    async getClubEventTeams(eventId: string): Promise<{ success: boolean; teams: EventTeamDetails[] }> {
        const res = await fetch(buildApiUrl(`/club/events/${eventId}/teams`), {
            headers: getAuthHeaders(),
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.message || "Failed to fetch event teams.");
        }
        return data;
    },
};
