import React, { useState, useEffect, useRef } from "react";
import {
    Users,
    Search,
    UserPlus,
    X,
    Crown,
    Check,
    AlertTriangle,
    Clock,
    Sparkles,
    Building2,
    Lock,
} from "lucide-react";
import {
    clubEventTeamApi,
    type SearchUserResult,
} from "../../api/clubEventTeamApi";
import { useToast } from "../../context/ToastContext";

export interface StagedTeammate {
    id: string;
    username: string;
    name: string;
    email?: string;
    avatarUrl?: string | null;
    collegeName?: string | null;
}

export interface TeamRosterConfiguratorProps {
    eventId: string;
    teamId?: string | null;
    minTeamSize?: number;
    maxTeamSize?: number;
    currentUser: {
        id: string;
        username: string;
        fullName?: string;
        avatarUrl?: string | null;
        collegeName?: string | null;
    };
    stagedMembers: StagedTeammate[];
    onStagedMembersChange: (members: StagedTeammate[]) => void;
    existingMembers?: Array<{
        id: string;
        userId: string;
        username: string;
        name: string;
        role: "leader" | "member";
        avatarUrl?: string | null;
    }>;
    existingPendingInvites?: Array<{
        id: string;
        inviteeUsername: string;
        inviteeName?: string;
        inviteeAvatarUrl?: string | null;
        status: string;
    }>;
    onMemberInvited?: (username: string) => Promise<void>;
    onMemberRemoved?: (userId: string) => Promise<void>;
    isLocked?: boolean;
    lockReason?: string | null;
    scope?: string;
    hostCollegeName?: string | null;
}

export const TeamRosterConfigurator: React.FC<TeamRosterConfiguratorProps> = ({
    eventId,
    teamId,
    minTeamSize = 2,
    maxTeamSize = 5,
    currentUser,
    stagedMembers,
    onStagedMembersChange,
    existingMembers = [],
    existingPendingInvites = [],
    onMemberInvited,
    onMemberRemoved,
    isLocked = false,
    lockReason,
    scope = "CAMPUS",
    hostCollegeName,
}) => {
    const toast = useToast();
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [isActionPending, setIsActionPending] = useState(false);
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Calculate total squad count including leader, existing members, pending invites, and staged members
    const isLiveTeam = Boolean(teamId && teamId !== "new");
    const activeExistingCount = existingMembers.length > 0 ? existingMembers.length : 1;
    const totalSquadCount = isLiveTeam
        ? activeExistingCount + existingPendingInvites.length
        : 1 + stagedMembers.length;

    const hasReachedMax = totalSquadCount >= maxTeamSize;
    const isBelowMin = totalSquadCount < minTeamSize;

    // Search users by username with debounce
    useEffect(() => {
        const clean = searchQuery.trim().replace(/^@/, "");
        if (clean.length < 2) {
            setSearchResults([]);
            return;
        }

        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await clubEventTeamApi.searchUsers(eventId, teamId || "new", clean);
                setSearchResults(res.users || []);
            } catch (err: any) {
                console.error("User search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 280);

        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, [searchQuery, eventId, teamId]);

    // Handle adding a teammate
    const handleAddUser = async (u: SearchUserResult) => {
        if (hasReachedMax) {
            toast.error(`Team is full! Maximum allowed team size is ${maxTeamSize} members.`);
            return;
        }

        // Campus Restriction Check: If student is from a different college, block immediately
        if (u.isCollegeMismatch) {
            toast.error(u.mismatchReason || `Campus Exclusive: You can only invite developers enrolled at ${hostCollegeName || "your college"}.`);
            return;
        }

        // Check if user is already added in staged members or existing members
        if (stagedMembers.some((m) => m.id === u.id || m.username.toLowerCase() === u.username.toLowerCase())) {
            toast.error(`@${u.username} is already added to this squad.`);
            return;
        }

        if (existingMembers.some((m) => m.userId === u.id || m.username.toLowerCase() === u.username.toLowerCase())) {
            toast.error(`@${u.username} is already an active member of this team.`);
            return;
        }

        if (u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase()) {
            toast.error("You are already the squad leader!");
            return;
        }

        // If team already exists on backend, send invitation immediately
        if (isLiveTeam && onMemberInvited) {
            try {
                setIsActionPending(true);
                await onMemberInvited(u.username);
                setSearchQuery("");
                setSearchResults([]);
                toast.success(`Invitation sent to @${u.username}!`, { title: "Invitation Dispatched" });
            } catch (err: any) {
                toast.error(err.message || "Failed to invite teammate.");
            } finally {
                setIsActionPending(false);
            }
            return;
        }

        // Staging flow (during registration before team submission)
        const newMember: StagedTeammate = {
            id: u.id,
            username: u.username,
            name: u.name,
            email: u.email,
            avatarUrl: u.avatarUrl,
            collegeName: (u as any).collegeName || null,
        };

        onStagedMembersChange([...stagedMembers, newMember]);
        setSearchQuery("");
        setSearchResults([]);
        toast.success(`@${u.username} added! Invitation will be delivered upon registration.`);
    };

    // Handle removing a staged or existing member
    const handleRemoveMember = async (member: StagedTeammate) => {
        onStagedMembersChange(stagedMembers.filter((m) => m.id !== member.id && m.username !== member.username));
        toast.info(`Removed @${member.username} from squad draft.`);
    };

    return (
        <div className="space-y-3.5 pt-1">
            {/* Squad Metrics & Progress Banner */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#FAF6EE] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                        <Users className="w-4 h-4 text-black" />
                    </div>
                    <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                            Squad Roster Size
                        </div>
                        <div className="text-xs sm:text-sm font-black text-black">
                            {totalSquadCount} of {minTeamSize}–{maxTeamSize} Members
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isBelowMin ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-950 border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-800" />
                            <span>Needs min {minTeamSize} members</span>
                        </span>
                    ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                            <Check className="w-3 h-3 text-black stroke-[3]" />
                            <span>Requirement Met</span>
                        </span>
                    )}

                    {isLocked && (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-neutral-200 text-neutral-800 border border-black inline-flex items-center gap-1">
                            <Lock className="w-3 h-3 text-neutral-700" />
                            <span>Locked</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Locked Warning Notice */}
            {isLocked && (
                <div className="p-3 rounded-xl bg-neutral-100 border-2 border-black text-xs font-bold text-neutral-800 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-black shrink-0" />
                    <span>{lockReason || "Team roster modifications are permanently locked for this event round."}</span>
                </div>
            )}

            {/* Campus Exclusive Event Banner */}
            {scope && scope !== "PAN_INDIA" && (
                <div className="p-3 rounded-xl bg-amber-50 border-2 border-black text-xs font-bold text-black flex items-center gap-2 shadow-[2px_2px_0px_#000]">
                    <Building2 className="w-4 h-4 text-amber-700 shrink-0" />
                    <div className="min-w-0">
                        <span className="font-black uppercase tracking-wider text-[10px] text-amber-800 block">
                            Campus-Exclusive Event
                        </span>
                        <span className="text-[11px] text-neutral-800">
                            Invitations are strictly restricted to developers enrolled at{" "}
                            <strong className="font-black">{hostCollegeName || currentUser.collegeName || "the host institution"}</strong>.
                        </span>
                    </div>
                </div>
            )}

            {/* Member Search & Invitation Input (Active when not locked and not at max capacity) */}
            {!isLocked && (
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-black text-black block">
                            Add Teammates by Orbix @username
                        </label>
                        <span className="text-[11px] font-bold text-neutral-500">
                            {maxTeamSize - totalSquadCount} slots available
                        </span>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="w-4 h-4 text-neutral-400" />
                        </div>
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            disabled={hasReachedMax || isActionPending}
                            placeholder={
                                hasReachedMax
                                    ? `Squad has reached the maximum size of ${maxTeamSize} members.`
                                    : "Type @username (e.g. vineet, rahul, alex)..."
                            }
                            className="w-full pl-9 pr-24 py-2.5 text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-hidden disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                        {isSearching && (
                            <div className="absolute inset-y-0 right-3 flex items-center">
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            </div>
                        )}
                    </div>

                    {/* Search Results Dropdown Cards */}
                    {searchResults.length > 0 && (
                        <div className="p-2 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5 max-h-56 overflow-y-auto">
                            <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500 px-2 pt-1">
                                Matching Developers on Orbix
                            </div>
                            {searchResults.map((u) => {
                                const isSelf = u.id === currentUser.id || u.username.toLowerCase() === currentUser.username.toLowerCase();
                                const isAlreadyStaged = stagedMembers.some((m) => m.id === u.id || m.username.toLowerCase() === u.username.toLowerCase());
                                const isAlreadyMember = existingMembers.some((m) => m.userId === u.id || m.username.toLowerCase() === u.username.toLowerCase());
                                const isCollegeMismatch = Boolean(u.isCollegeMismatch);
                                const isAlreadyRegistered = Boolean(u.isAlreadyInTeam || u.isMember);
                                const isDisabled = isSelf || isAlreadyStaged || isAlreadyMember || isAlreadyRegistered || u.hasPendingInvite || isCollegeMismatch;

                                return (
                                    <div
                                        key={u.id}
                                        className="p-2 rounded-lg bg-[#FAF6EE] border border-black/30 flex items-center justify-between gap-2.5 hover:bg-neutral-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            {u.avatarUrl ? (
                                                <img
                                                    src={u.avatarUrl}
                                                    alt={u.name}
                                                    className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                                                />
                                            ) : (
                                                <div className="w-8 h-8 rounded-full border border-black bg-[#FFE566] text-black font-black text-xs flex items-center justify-center shrink-0">
                                                    {u.name.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <div className="text-xs font-black text-black truncate">
                                                    {u.name}
                                                </div>
                                                <div className="text-[11px] font-mono text-neutral-600 truncate flex items-center gap-1.5">
                                                    <span>@{u.username}</span>
                                                    {u.collegeName && (
                                                        <span className="text-[10px] font-sans text-neutral-500 truncate flex items-center gap-0.5">
                                                            • <Building2 className="w-2.5 h-2.5 inline shrink-0" />
                                                            <span className="truncate">{u.collegeName}</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {isCollegeMismatch && (
                                                    <div className="text-[9px] font-black uppercase tracking-wider text-red-600 flex items-center gap-1 mt-0.5">
                                                        <span>⚠️ Ineligible (Different College)</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled={isDisabled || isActionPending || hasReachedMax}
                                            onClick={() => handleAddUser(u)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-black border border-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer inline-flex items-center gap-1 transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0 ${
                                                isDisabled
                                                    ? "bg-neutral-200 text-neutral-500 border-neutral-400 shadow-none cursor-not-allowed"
                                                    : "bg-[#a2ff86] hover:bg-[#8def6e] text-black"
                                            }`}
                                        >
                                            <UserPlus className="w-3.5 h-3.5" />
                                            <span>
                                                {isSelf
                                                    ? "You (Leader)"
                                                    : isCollegeMismatch
                                                    ? "Different College"
                                                    : isAlreadyStaged || isAlreadyMember
                                                    ? "Added"
                                                    : isAlreadyRegistered
                                                    ? "Already in Team"
                                                    : u.hasPendingInvite
                                                    ? "Invited"
                                                    : "Add to Team"}
                                            </span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Current Squad Roster Cards */}
            <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-neutral-600 flex items-center justify-between">
                    <span>Squad Roster ({totalSquadCount} Members)</span>
                    <span className="text-[10px] font-bold text-neutral-500">
                        {isBelowMin ? `⚠️ Needs at least ${minTeamSize} members to submit` : "Ready"}
                    </span>
                </div>

                {/* 1. Team Leader Card */}
                <div className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        {currentUser.avatarUrl ? (
                            <img
                                src={currentUser.avatarUrl}
                                alt={currentUser.fullName || currentUser.username}
                                className="w-9 h-9 rounded-full border-2 border-black object-cover shrink-0"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-full border-2 border-black bg-[#FFE566] text-black font-black text-xs flex items-center justify-center shrink-0">
                                {(currentUser.fullName || currentUser.username).slice(0, 2).toUpperCase()}
                            </div>
                        )}
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-black text-black truncate">
                                    {currentUser.fullName || currentUser.username}
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-300 text-black border border-black inline-flex items-center gap-1 shadow-[1px_1px_0px_#000]">
                                    <Crown className="w-2.5 h-2.5 text-black" />
                                    Squad Leader
                                </span>
                            </div>
                            <div className="text-[11px] font-mono text-neutral-600 truncate">
                                @{currentUser.username} {currentUser.collegeName ? `• ${currentUser.collegeName}` : ""}
                            </div>
                        </div>
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-black/20 shrink-0">
                        Creator / Confirmed
                    </span>
                </div>

                {/* 2. Existing Team Members (from server) */}
                {existingMembers
                    .filter((m) => m.userId !== currentUser.id && m.role !== "leader")
                    .map((m) => (
                        <div
                            key={m.id || m.userId}
                            className="p-2.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3"
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                {m.avatarUrl ? (
                                    <img
                                        src={m.avatarUrl}
                                        alt={m.name}
                                        className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                                    />
                                ) : (
                                    <div className="w-8 h-8 rounded-full border border-black bg-neutral-200 text-black font-black text-xs flex items-center justify-center shrink-0">
                                        {m.name.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <div className="text-xs font-black text-black truncate">
                                        {m.name}
                                    </div>
                                    <div className="text-[11px] font-mono text-neutral-600 truncate">
                                        @{m.username}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black">
                                    Active Teammate
                                </span>
                                {!isLocked && onMemberRemoved && (
                                    <button
                                        type="button"
                                        onClick={() => onMemberRemoved(m.userId)}
                                        className="p-1.5 rounded-lg border border-red-500 bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer"
                                        title="Remove member"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                {/* 3. Existing Pending Invites (from server) */}
                {existingPendingInvites.map((inv) => (
                    <div
                        key={inv.id}
                        className="p-2.5 rounded-xl bg-amber-50/60 border-2 border-dashed border-amber-500 flex items-center justify-between gap-3"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            {inv.inviteeAvatarUrl ? (
                                <img
                                    src={inv.inviteeAvatarUrl}
                                    alt={inv.inviteeName || inv.inviteeUsername}
                                    className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-black bg-amber-200 text-black font-black text-xs flex items-center justify-center shrink-0">
                                    {(inv.inviteeName || inv.inviteeUsername).slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-xs font-black text-black truncate">
                                    {inv.inviteeName || `@${inv.inviteeUsername}`}
                                </div>
                                <div className="text-[11px] font-mono text-neutral-600 truncate">
                                    @{inv.inviteeUsername}
                                </div>
                            </div>
                        </div>

                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-200 text-amber-950 border border-black inline-flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-amber-800" />
                            Invite Pending
                        </span>
                    </div>
                ))}

                {/* 4. Staged Members (added during registration flow before form submit) */}
                {stagedMembers.map((m) => (
                    <div
                        key={m.id || m.username}
                        className="p-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3 animate-in fade-in duration-150"
                    >
                        <div className="flex items-center gap-2.5 min-w-0">
                            {m.avatarUrl ? (
                                <img
                                    src={m.avatarUrl}
                                    alt={m.name}
                                    className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                                />
                            ) : (
                                <div className="w-8 h-8 rounded-full border border-black bg-[#FFE566] text-black font-black text-xs flex items-center justify-center shrink-0">
                                    {m.name.slice(0, 2).toUpperCase()}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="text-xs font-black text-black truncate">
                                    {m.name}
                                </div>
                                <div className="text-[11px] font-mono text-neutral-600 truncate flex items-center gap-1.5">
                                    <span>@{m.username}</span>
                                    {m.collegeName && (
                                        <span className="text-[10px] font-sans text-neutral-500 truncate">
                                            • {m.collegeName}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-black inline-flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5 text-amber-700" />
                                Will Receive Invite
                            </span>
                            <button
                                type="button"
                                onClick={() => handleRemoveMember(m)}
                                className="p-1.5 rounded-lg border border-red-500 bg-red-50 hover:bg-red-100 text-red-600 cursor-pointer transition-colors"
                                title="Remove teammate"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Requirement Helper Text */}
            <p className="text-[11px] font-bold text-neutral-500 leading-relaxed">
                As Team Leader, you can invite peers by typing their @username. Official team invitations will be delivered directly to their Activity panel. Once confirmed, your complete squad will be registered.
            </p>
        </div>
    );
};
