import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Users,
    UserPlus,
    Plus,
    Briefcase,
    Clock,
    Search,
    Edit3,
    Mail,
    Check,
    ExternalLink,
    Building2,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { DEFAULT_AVATAR_URL } from "../../../utils/avatarConstants";
import type { ClubMember, ClubTeam, ClubInvitation, TeamStats } from "./types";
import { AddMemberModal } from "./AddMemberModal";
import { CreateTeamModal } from "./CreateTeamModal";
import { EditTeamModal } from "./EditTeamModal";
import { EditMemberModal } from "./EditMemberModal";

interface ClubTeamWorkspaceProps {
    club: {
        id: string;
        name: string;
        slug: string;
        clubUsername?: string;
        college_name: string;
        logo_url: string | null;
    };
    onOpenInbox?: () => void;
    onOpenMobileSidebar?: () => void;
}

export const ClubTeamWorkspace: React.FC<ClubTeamWorkspaceProps> = ({ club, onOpenMobileSidebar }) => {
    const toast = useToast();

    // Internal navigation tabs
    const [activeTab, setActiveTab] = useState<"overview" | "departments" | "members" | "invitations">("overview");

    // Data states
    const [stats, setStats] = useState<TeamStats | null>(null);
    const [teams, setTeams] = useState<ClubTeam[]>([]);
    const [members, setMembers] = useState<ClubMember[]>([]);
    const [invitations, setInvitations] = useState<ClubInvitation[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [memberSearchQuery, setMemberSearchQuery] = useState("");
    const [memberTeamFilter, setMemberTeamFilter] = useState("all");
    const [memberRoleFilter, setMemberRoleFilter] = useState("all");
    const [invitationStatusFilter, setInvitationStatusFilter] = useState("all");
    const [showArchivedTeams, setShowArchivedTeams] = useState(false);

    // Modals
    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [isCreateTeamOpen, setIsCreateTeamOpen] = useState(false);
    const [editingTeam, setEditingTeam] = useState<ClubTeam | null>(null);
    const [editingMember, setEditingMember] = useState<ClubMember | null>(null);

    // Fetch All Data
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            const [statsRes, teamsRes, membersRes, invitationsRes] = await Promise.all([
                fetch(`/api/club/team/stats?clubId=${club.id}`, { credentials: "include" }),
                fetch(`/api/club/team/teams?clubId=${club.id}&includeArchived=true`, { credentials: "include" }),
                fetch(`/api/club/team/members?clubId=${club.id}`, { credentials: "include" }),
                fetch(`/api/club/team/invitations?clubId=${club.id}`, { credentials: "include" }),
            ]);

            const statsData = await statsRes.json().catch(() => ({}));
            const teamsData = await teamsRes.json().catch(() => ({}));
            const membersData = await membersRes.json().catch(() => ({}));
            const invitationsData = await invitationsRes.json().catch(() => ({}));

            if (statsData.success) setStats(statsData);
            if (teamsData.success && Array.isArray(teamsData.teams)) setTeams(teamsData.teams);
            if (membersData.success && Array.isArray(membersData.members)) setMembers(membersData.members);
            if (invitationsData.success && Array.isArray(invitationsData.invitations)) setInvitations(invitationsData.invitations);
        } catch (err) {
            console.error("Failed to load club team workspace:", err);
            toast.error("Could not load team workspace. Please refresh.", { title: "Network Error" });
        } finally {
            setLoading(false);
        }
    }, [club.id]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const perms = stats?.permissions;
    const canManageTeams = perms?.canManageTeams ?? false;
    const canInvite = perms?.canInviteMembers ?? false;
    const isOwner = perms?.isOwner ?? false;

    // Filtered members list
    const filteredMembers = useMemo(() => {
        return members.filter((m) => {
            if (memberTeamFilter !== "all") {
                const inTeam = m.teams.some((t) => t.teamId === memberTeamFilter);
                if (!inTeam) return false;
            }
            if (memberRoleFilter !== "all" && m.clubRole !== memberRoleFilter) {
                return false;
            }
            if (memberSearchQuery.trim()) {
                const q = memberSearchQuery.toLowerCase().trim();
                const matchName = m.displayName.toLowerCase().includes(q);
                const matchUsername = m.username.toLowerCase().includes(q);
                const matchTitle = m.title.toLowerCase().includes(q);
                if (!matchName && !matchUsername && !matchTitle) return false;
            }
            return true;
        });
    }, [members, memberTeamFilter, memberRoleFilter, memberSearchQuery]);

    // Filtered invitations list
    const filteredInvitations = useMemo(() => {
        return invitations.filter((inv) => {
            if (invitationStatusFilter === "all") return true;
            return inv.status === invitationStatusFilter;
        });
    }, [invitations, invitationStatusFilter]);

    // Filtered teams list
    const visibleTeams = useMemo(() => {
        return teams.filter((t) => (showArchivedTeams ? true : !t.isArchived));
    }, [teams, showArchivedTeams]);

    // Invitation actions
    const handleCancelInvitation = async (invitationId: string) => {
        try {
            const res = await fetch(`/api/club/team/invitations/${invitationId}/cancel`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to cancel invitation.", { title: "Error" });
                return;
            }
            toast.info("Invitation cancelled.", { title: "Cancelled" });
            loadData();
        } catch {
            toast.error("Network error.", { title: "Error" });
        }
    };

    const handleResendInvitation = async (invitationId: string) => {
        try {
            const res = await fetch(`/api/club/team/invitations/${invitationId}/resend`, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to resend invitation.", { title: "Error" });
                return;
            }
            toast.success("Invitation renewed and resent!", { title: "Resent" });
            loadData();
        } catch {
            toast.error("Network error.", { title: "Error" });
        }
    };

    return (
        <div className="space-y-6">
            {/* Top Header matching Orbix Design Language */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        {onOpenMobileSidebar && (
                            <button
                                type="button"
                                onClick={onOpenMobileSidebar}
                                className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                aria-label="Open sidebar"
                            >
                                <svg className="w-4 h-4 stroke-[2.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <line x1="3" y1="12" x2="21" y2="12" />
                                    <line x1="3" y1="6" x2="21" y2="6" />
                                    <line x1="3" y1="18" x2="21" y2="18" />
                                </svg>
                            </button>
                        )}
                        <div className="w-8 h-8 rounded-lg bg-black text-[#a2ff86] flex items-center justify-center border border-black shadow-[2px_2px_0px_#000]">
                            <Users className="w-4 h-4 stroke-[2.5]" />
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                            Team
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black text-[11px] font-black border border-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                            {perms?.userRole ? `Role: ${perms.userRole.replace("_", " ")}` : "Verified Club"}
                        </span>
                    </div>
                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                        Build your club's organisation, manage its people, and bring every department together.
                    </p>
                </div>

                {/* Primary Actions (Permission Guarded) */}
                <div className="flex items-center gap-2.5 flex-wrap">
                    {canManageTeams && (
                        <button
                            type="button"
                            onClick={() => setIsCreateTeamOpen(true)}
                            className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <Plus className="w-4 h-4 stroke-[3]" />
                            <span>Create Team</span>
                        </button>
                    )}

                    {canInvite && (
                        <button
                            type="button"
                            onClick={() => setIsAddMemberOpen(true)}
                            className="px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-900 text-[#a2ff86] border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                        >
                            <UserPlus className="w-4 h-4 stroke-[2.5]" />
                            <span>Add Member</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Overview Statistics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Total Members */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                            Total Members
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <Users className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-black">
                        {loading ? "..." : stats?.totalMembers ?? 0}
                    </p>
                    <span className="text-[11px] text-neutral-600 font-medium block">
                        Active roster across club
                    </span>
                </div>

                {/* Active Teams */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                            Active Teams
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#38BDF8] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <Building2 className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-black">
                        {loading ? "..." : stats?.activeTeams ?? 0}
                    </p>
                    <span className="text-[11px] text-neutral-600 font-medium block">
                        Departments & divisions
                    </span>
                </div>

                {/* Pending Invitations */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                            Pending Invitations
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <Clock className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-black">
                        {loading ? "..." : stats?.pendingInvitations ?? 0}
                    </p>
                    <span className="text-[11px] text-neutral-600 font-medium block">
                        Awaiting recipient consent
                    </span>
                </div>

                {/* Team Leads */}
                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                            Team Leads
                        </span>
                        <div className="w-8 h-8 rounded-lg bg-[#FF80D7] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            <Briefcase className="w-4 h-4 text-black stroke-[2.5]" />
                        </div>
                    </div>
                    <p className="text-2xl sm:text-3xl font-black text-black">
                        {loading ? "..." : stats?.teamLeads ?? 0}
                    </p>
                    <span className="text-[11px] text-neutral-600 font-medium block">
                        Leads & coordinators
                    </span>
                </div>
            </div>

            {/* Internal Navigation: Segmented Tabs Control */}
            <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex-wrap max-w-full">
                <button
                    type="button"
                    onClick={() => setActiveTab("overview")}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeTab === "overview"
                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                            : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                    }`}
                >
                    Overview
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("departments")}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === "departments"
                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                            : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                    }`}
                >
                    <span>Teams & Departments</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black border border-black bg-neutral-100 text-black">
                        {teams.filter((t) => !t.isArchived).length}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("members")}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === "members"
                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                            : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                    }`}
                >
                    <span>Members</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black border border-black bg-neutral-100 text-black">
                        {members.length}
                    </span>
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("invitations")}
                    className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
                        activeTab === "invitations"
                            ? "bg-black text-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000]"
                            : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                    }`}
                >
                    <span>Invitations</span>
                    {stats && stats.pendingInvitations > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black border border-black bg-[#FFE566] text-black">
                            {stats.pendingInvitations}
                        </span>
                    )}
                </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeTab === "overview" && (
                <div className="space-y-6">
                    {/* Structure Highlights */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Departments Breakdown Card */}
                        <div className="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Departments Structure
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Distribution of members across club departments.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("departments")}
                                    className="text-xs font-black text-black underline hover:text-neutral-700"
                                >
                                    View All &rarr;
                                </button>
                            </div>

                            {visibleTeams.length === 0 ? (
                                <div className="p-8 text-center bg-[#FAF6EE] border-2 border-black rounded-xl space-y-3">
                                    <Building2 className="w-8 h-8 text-neutral-400 mx-auto" />
                                    <div>
                                        <h4 className="text-sm font-black text-black">
                                            No Departments Created Yet
                                        </h4>
                                        <p className="text-xs text-neutral-600 max-w-md mx-auto mt-1">
                                            Start structuring your club by setting up teams such as Technical, Design, and Events.
                                        </p>
                                    </div>
                                    {canManageTeams && (
                                        <button
                                            type="button"
                                            onClick={() => setIsCreateTeamOpen(true)}
                                            className="px-4 py-2 bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-900 cursor-pointer"
                                        >
                                            + Create First Team
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {visibleTeams.map((team) => (
                                        <div
                                            key={team.id}
                                            className="p-3.5 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] space-y-2 hover:-translate-y-0.5 transition-transform"
                                        >
                                            <div className="flex items-center justify-between">
                                                <h4 className="text-sm font-black text-black truncate">
                                                    {team.name}
                                                </h4>
                                                <span className="text-[11px] font-black px-2 py-0.5 rounded-full bg-white border border-black text-black shadow-[1px_1px_0px_#000]">
                                                    {team.memberCount} {team.memberCount === 1 ? "member" : "members"}
                                                </span>
                                            </div>
                                            <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                                                {team.description || "No description provided."}
                                            </p>
                                            <div className="pt-1 flex items-center justify-between text-[11px]">
                                                <span className="font-bold text-neutral-700">
                                                    Lead: {team.lead ? team.lead.displayName : "Unassigned"}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTeam(team)}
                                                    className="font-black text-black hover:underline cursor-pointer"
                                                >
                                                    Manage
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Recent Activity / Pending Invites Summary */}
                        <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Pending Invitations
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Waiting for invited users to accept.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("invitations")}
                                    className="text-xs font-black text-black underline hover:text-neutral-700"
                                >
                                    Manage &rarr;
                                </button>
                            </div>

                            {invitations.filter((i) => i.status === "pending").length === 0 ? (
                                <div className="p-6 text-center bg-[#FAF6EE] border-2 border-black rounded-xl space-y-2">
                                    <Check className="w-6 h-6 text-emerald-600 mx-auto" />
                                    <p className="text-xs font-black text-black">
                                        No Pending Invitations
                                    </p>
                                    <p className="text-[11px] text-neutral-600">
                                        All invited members have responded or no invites are active.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {invitations
                                        .filter((i) => i.status === "pending")
                                        .slice(0, 4)
                                        .map((inv) => (
                                            <div
                                                key={inv.id}
                                                className="p-3 bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000] flex items-center justify-between gap-3"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-xs font-black text-black truncate">
                                                        @{inv.invitedUser.username}
                                                    </p>
                                                    <p className="text-[11px] text-neutral-600 font-medium truncate">
                                                        {inv.positionTitle} • {inv.teamName}
                                                    </p>
                                                </div>
                                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-500 font-black text-[10px] shrink-0">
                                                    Pending
                                                </span>
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* Recent Members */}
                            <div className="pt-2">
                                <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">
                                    Recent Team Members
                                </h4>
                                <div className="space-y-2">
                                    {members.slice(0, 4).map((m) => (
                                        <div
                                            key={m.membershipId}
                                            className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-50 border border-black/20"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <img
                                                    src={m.avatarUrl || DEFAULT_AVATAR_URL}
                                                    alt={m.username}
                                                    className="w-7 h-7 rounded-full border border-black object-cover shrink-0"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-black truncate">
                                                    {m.displayName}
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-black px-2 py-0.5 rounded bg-white border border-black uppercase text-neutral-700 shrink-0">
                                                {m.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB 2: TEAMS & DEPARTMENTS */}
            {activeTab === "departments" && (
                <div className="space-y-6">
                    {/* Control Bar: Filters & Actions */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Departments ({visibleTeams.length})
                            </span>
                            <label className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-700 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showArchivedTeams}
                                    onChange={(e) => setShowArchivedTeams(e.target.checked)}
                                    className="rounded border-black cursor-pointer"
                                />
                                <span>Show Archived</span>
                            </label>
                        </div>

                        {canManageTeams && (
                            <button
                                type="button"
                                onClick={() => setIsCreateTeamOpen(true)}
                                className="px-3.5 py-2 bg-black text-[#a2ff86] rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-900 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                            >
                                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                <span>New Department</span>
                            </button>
                        )}
                    </div>

                    {/* Department Cards Grid */}
                    {visibleTeams.length === 0 ? (
                        <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
                            <Building2 className="w-12 h-12 text-neutral-400 mx-auto" />
                            <div className="space-y-1">
                                <h3 className="text-lg font-black text-black">
                                    No Teams Found
                                </h3>
                                <p className="text-xs text-neutral-600 max-w-md mx-auto">
                                    Create department divisions to organize club operations, codebases, and event responsibilities.
                                </p>
                            </div>
                            {canManageTeams && (
                                <button
                                    type="button"
                                    onClick={() => setIsCreateTeamOpen(true)}
                                    className="px-5 py-2.5 bg-black text-[#a2ff86] font-black text-xs uppercase tracking-wider rounded-xl border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-900 cursor-pointer"
                                >
                                    + Create Department
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {visibleTeams.map((team) => (
                                <div
                                    key={team.id}
                                    className={`p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 ${
                                        team.isArchived ? "opacity-75 bg-neutral-50" : ""
                                    }`}
                                >
                                    <div className="space-y-2.5">
                                        {/* Team Title & Status Badge */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <h3 className="text-base font-black text-black truncate">
                                                    {team.name}
                                                </h3>
                                                <span className="text-[11px] font-mono font-bold text-neutral-500">
                                                    {team.memberCount} {team.memberCount === 1 ? "Member" : "Members"}
                                                </span>
                                            </div>
                                            {team.isArchived ? (
                                                <span className="px-2 py-0.5 rounded-md bg-neutral-200 text-neutral-700 text-[10px] font-black uppercase border border-black shrink-0">
                                                    Archived
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-md bg-[#a2ff86] text-black text-[10px] font-black uppercase border border-black shrink-0">
                                                    Active
                                                </span>
                                            )}
                                        </div>

                                        {/* Description */}
                                        <p className="text-xs text-neutral-700 font-medium leading-relaxed line-clamp-2 min-h-[36px]">
                                            {team.description || "No description provided."}
                                        </p>

                                        {/* Responsibilities snippet */}
                                        {team.responsibilities && (
                                            <div className="p-2.5 rounded-xl bg-[#FAF6EE] border border-black/40 text-[11px] text-neutral-700 space-y-0.5">
                                                <span className="font-bold text-black uppercase text-[10px] block">
                                                    Scope / Responsibilities:
                                                </span>
                                                <p className="line-clamp-2 italic">
                                                    {team.responsibilities}
                                                </p>
                                            </div>
                                        )}

                                        {/* Lead & Co-Lead */}
                                        <div className="pt-1 space-y-1.5 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase w-12">
                                                    Lead:
                                                </span>
                                                {team.lead ? (
                                                    <span className="font-bold text-black truncate">
                                                        {team.lead.displayName} (@{team.lead.username})
                                                    </span>
                                                ) : (
                                                    <span className="text-neutral-400 italic">Unassigned</span>
                                                )}
                                            </div>
                                            {team.coLead && (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase w-12">
                                                        Co-Lead:
                                                    </span>
                                                    <span className="font-bold text-black truncate">
                                                        {team.coLead.displayName} (@{team.coLead.username})
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Member Avatars Preview & Management Action */}
                                    <div className="pt-3 border-t-2 border-black/10 flex items-center justify-between gap-3">
                                        <div className="flex -space-x-2 overflow-hidden">
                                            {team.memberPreviews.length > 0 ? (
                                                team.memberPreviews.map((m) => (
                                                    <img
                                                        key={m.id}
                                                        src={m.avatarUrl || DEFAULT_AVATAR_URL}
                                                        alt={m.username}
                                                        title={m.displayName}
                                                        className="w-7 h-7 rounded-full border-2 border-black object-cover"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <span className="text-[11px] text-neutral-500 italic">
                                                    No members yet
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {canManageTeams && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingTeam(team)}
                                                    className="px-3 py-1.5 rounded-lg bg-white hover:bg-neutral-100 border border-black font-black text-xs text-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    <span>Manage</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* TAB 3: MEMBERS DIRECTORY */}
            {activeTab === "members" && (
                <div className="space-y-4">
                    {/* Search & Filter Toolbar */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Search Input */}
                        <div className="relative flex-1 max-w-md">
                            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={memberSearchQuery}
                                onChange={(e) => setMemberSearchQuery(e.target.value)}
                                placeholder="Search by name, handle, or title..."
                                className="w-full pl-10 pr-4 py-2 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs font-bold text-black focus:outline-none"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                            {/* Team Filter */}
                            <select
                                value={memberTeamFilter}
                                onChange={(e) => setMemberTeamFilter(e.target.value)}
                                className="px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                            >
                                <option value="all">All Departments</option>
                                {teams.map((t) => (
                                    <option key={t.id} value={t.id}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>

                            {/* Role Filter */}
                            <select
                                value={memberRoleFilter}
                                onChange={(e) => setMemberRoleFilter(e.target.value)}
                                className="px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                            >
                                <option value="all">All Roles</option>
                                <option value="owner">Club Owner</option>
                                <option value="admin">Club Admin</option>
                                <option value="team_lead">Team Lead</option>
                                <option value="member">Club Member</option>
                                <option value="advisor">Advisor</option>
                            </select>
                        </div>
                    </div>

                    {/* Members Roster List */}
                    {filteredMembers.length === 0 ? (
                        <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-3">
                            <Users className="w-10 h-10 text-neutral-400 mx-auto" />
                            <h3 className="text-base font-black text-black">
                                No Members Found
                            </h3>
                            <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                                No club members match the current search or department filter.
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b-2 border-black pb-2 text-neutral-600 font-mono font-bold uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Member</th>
                                        <th className="py-2.5 px-3">Access Role</th>
                                        <th className="py-2.5 px-3">Title / Position</th>
                                        <th className="py-2.5 px-3">Departments</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {filteredMembers.map((m) => (
                                        <tr key={m.membershipId} className="hover:bg-[#FAF6EE] transition-colors">
                                            {/* Member Name & Avatar */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-3">
                                                    <img
                                                        src={m.avatarUrl || DEFAULT_AVATAR_URL}
                                                        alt={m.username}
                                                        className="w-9 h-9 rounded-full border-2 border-black object-cover shrink-0"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                        }}
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-black text-black truncate">
                                                                {m.displayName}
                                                            </span>
                                                            {m.isVerifiedCoder && (
                                                                <span className="text-[9px] font-black bg-emerald-100 text-emerald-800 px-1 rounded border border-emerald-500">
                                                                    Verified
                                                                </span>
                                                            )}
                                                        </div>
                                                        <Link
                                                            to={`/profile/u/${m.username}`}
                                                            target="_blank"
                                                            className="text-[11px] font-mono font-bold text-neutral-600 hover:text-black flex items-center gap-1"
                                                        >
                                                            <span>@{m.username}</span>
                                                            <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                                                        </Link>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Access Role Badge */}
                                            <td className="py-3 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase border border-black inline-block ${
                                                        m.clubRole === "owner"
                                                            ? "bg-[#FFE566] text-black"
                                                            : m.clubRole === "admin"
                                                            ? "bg-[#38BDF8] text-black"
                                                            : m.clubRole === "team_lead"
                                                            ? "bg-[#a2ff86] text-black"
                                                            : "bg-white text-neutral-700"
                                                    }`}
                                                >
                                                    {m.clubRole.replace("_", " ")}
                                                </span>
                                            </td>

                                            {/* Organisational Title */}
                                            <td className="py-3 px-3 font-bold text-black">
                                                {m.title}
                                            </td>

                                            {/* Assigned Departments */}
                                            <td className="py-3 px-3">
                                                {m.teams.length === 0 ? (
                                                    <span className="text-neutral-400 italic text-[11px]">
                                                        Club-Wide
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {m.teams.map((t) => (
                                                            <span
                                                                key={t.teamId}
                                                                className="px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black font-bold text-[10px] text-black"
                                                            >
                                                                {t.teamName}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-3 text-right">
                                                {canManageTeams && (
                                                    <button
                                                        type="button"
                                                        onClick={() => setEditingMember(m)}
                                                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-black font-black text-[11px] text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                                    >
                                                        Edit
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* TAB 4: INVITATIONS */}
            {activeTab === "invitations" && (
                <div className="space-y-4">
                    {/* Filter Bar */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                Filter Status:
                            </span>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {["all", "pending", "accepted", "declined", "expired", "cancelled"].map((st) => (
                                    <button
                                        key={st}
                                        type="button"
                                        onClick={() => setInvitationStatusFilter(st)}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black uppercase transition-all cursor-pointer ${
                                            invitationStatusFilter === st
                                                ? "bg-black text-[#a2ff86] border border-black"
                                                : "bg-[#FAF6EE] text-neutral-700 hover:text-black border border-black/40"
                                        }`}
                                    >
                                        {st}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {canInvite && (
                            <button
                                type="button"
                                onClick={() => setIsAddMemberOpen(true)}
                                className="px-3.5 py-2 bg-black text-[#a2ff86] rounded-xl border-2 border-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-900 cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
                            >
                                <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                                <span>Send Invitation</span>
                            </button>
                        )}
                    </div>

                    {/* Invitations Table / List */}
                    {filteredInvitations.length === 0 ? (
                        <div className="p-12 text-center bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-3">
                            <Mail className="w-10 h-10 text-neutral-400 mx-auto" />
                            <h3 className="text-base font-black text-black">
                                No Invitations Found
                            </h3>
                            <p className="text-xs text-neutral-600 max-w-sm mx-auto">
                                No invitation records match the selected filter.
                            </p>
                        </div>
                    ) : (
                        <div className="p-2 sm:p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="border-b-2 border-black pb-2 text-neutral-600 font-mono font-bold uppercase text-[10px]">
                                        <th className="py-2.5 px-3">Invited User</th>
                                        <th className="py-2.5 px-3">Department</th>
                                        <th className="py-2.5 px-3">Position</th>
                                        <th className="py-2.5 px-3">Role</th>
                                        <th className="py-2.5 px-3">Status</th>
                                        <th className="py-2.5 px-3">Sent / Expiry</th>
                                        <th className="py-2.5 px-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {filteredInvitations.map((inv) => (
                                        <tr key={inv.id} className="hover:bg-[#FAF6EE] transition-colors">
                                            {/* User */}
                                            <td className="py-3 px-3">
                                                <div className="flex items-center gap-2.5">
                                                    <img
                                                        src={inv.invitedUser.avatarUrl || DEFAULT_AVATAR_URL}
                                                        alt={inv.invitedUser.username}
                                                        className="w-8 h-8 rounded-full border-2 border-black object-cover shrink-0"
                                                        onError={(e) => {
                                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                        }}
                                                    />
                                                    <div>
                                                        <span className="font-black text-black block truncate">
                                                            {inv.invitedUser.displayName}
                                                        </span>
                                                        <span className="text-[11px] font-mono text-neutral-600">
                                                            @{inv.invitedUser.username}
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Team */}
                                            <td className="py-3 px-3 font-bold text-black">
                                                {inv.teamName}
                                            </td>

                                            {/* Position */}
                                            <td className="py-3 px-3 font-bold text-neutral-700">
                                                {inv.positionTitle}
                                            </td>

                                            {/* Role */}
                                            <td className="py-3 px-3">
                                                <span className="px-2 py-0.5 rounded bg-neutral-100 border border-black uppercase text-[10px] font-black">
                                                    {inv.clubRole}
                                                </span>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-3 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full font-black text-[10px] uppercase border border-black inline-block ${
                                                        inv.status === "accepted"
                                                            ? "bg-[#a2ff86] text-black"
                                                            : inv.status === "pending"
                                                            ? "bg-[#FFE566] text-black"
                                                            : inv.status === "declined"
                                                            ? "bg-rose-100 text-rose-800"
                                                            : "bg-neutral-200 text-neutral-700"
                                                    }`}
                                                >
                                                    {inv.status}
                                                </span>
                                            </td>

                                            {/* Dates */}
                                            <td className="py-3 px-3 text-[11px] font-mono text-neutral-600">
                                                <span>Expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                                            </td>

                                            {/* Actions */}
                                            <td className="py-3 px-3 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {inv.status === "pending" && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancelInvitation(inv.id)}
                                                            className="px-2.5 py-1 rounded bg-white hover:bg-neutral-100 border border-black text-rose-600 font-bold text-[10px] cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                    {(inv.status === "expired" || inv.status === "cancelled") && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleResendInvitation(inv.id)}
                                                            className="px-2.5 py-1 rounded bg-black text-[#a2ff86] border border-black font-black text-[10px] cursor-pointer"
                                                        >
                                                            Resend
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            <AddMemberModal
                isOpen={isAddMemberOpen}
                onClose={() => setIsAddMemberOpen(false)}
                teams={teams}
                onInvitationSent={loadData}
            />

            <CreateTeamModal
                isOpen={isCreateTeamOpen}
                onClose={() => setIsCreateTeamOpen(false)}
                members={members}
                onTeamCreated={loadData}
            />

            <EditTeamModal
                isOpen={Boolean(editingTeam)}
                onClose={() => setEditingTeam(null)}
                team={editingTeam}
                members={members}
                onTeamUpdated={loadData}
                onTeamArchived={loadData}
                onTeamDeleted={loadData}
            />

            <EditMemberModal
                isOpen={Boolean(editingMember)}
                onClose={() => setEditingMember(null)}
                member={editingMember}
                teams={teams}
                onMemberUpdated={loadData}
                onMemberRemoved={loadData}
                isCurrentUserOwner={isOwner}
            />
        </div>
    );
};
