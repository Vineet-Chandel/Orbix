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

export interface TeamStats {
    totalMembers: number;
    activeTeams: number;
    pendingInvitations: number;
    teamLeads: number;
    permissions: ClubUserPermissions;
}

export interface ClubTeam {
    id: string;
    clubId: string;
    name: string;
    slug: string;
    description: string | null;
    responsibilities: string | null;
    status: string;
    isArchived: boolean;
    displayOrder: number;
    memberCount: number;
    leadId?: string | null;
    lead?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    } | null;
    coLeadId?: string | null;
    coLead?: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    } | null;
    memberPreviews: Array<{
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    }>;
    createdAt: string;
}

export interface ClubMember {
    membershipId: string;
    clubId: string;
    userId: string;
    clubRole: "owner" | "admin" | "team_lead" | "member" | "advisor";
    title: string;
    status: string;
    joinedAt: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    avatarUrl: string | null;
    headline: string | null;
    college: string | null;
    location: string | null;
    isVerifiedCoder: boolean;
    teams: Array<{
        teamId: string;
        teamName: string;
        teamRole: string;
        positionTitle: string;
    }>;
}

export interface ClubInvitation {
    id: string;
    clubId: string;
    teamId: string | null;
    teamName: string;
    invitedUser: {
        id: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
    };
    inviterUser?: {
        id: string;
        username: string;
        displayName: string;
    } | null;
    clubRole: string;
    teamRole: string;
    positionTitle: string;
    status: "pending" | "accepted" | "declined" | "expired" | "cancelled";
    invitationMessage?: string | null;
    expiresAt: string;
    respondedAt?: string | null;
    createdAt: string;
}

export interface UserSearchItem {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    headline: string | null;
    college: string | null;
    isVerifiedCoder: boolean;
    isClubMember: boolean;
    clubRole: string | null;
    clubTitle: string | null;
    hasPendingInvitation: boolean;
}
