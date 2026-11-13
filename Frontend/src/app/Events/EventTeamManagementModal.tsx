import React, { useState, useEffect, useRef } from "react";
import {
    X,
    Users,
    Crown,
    UserMinus,
    LogOut,
    Copy,
    Check,
    Search,
    UserPlus,
    AlertTriangle,
    ExternalLink,
    Mail,
    Edit2,
    Lock,
    Clock,
    RefreshCw,
} from "lucide-react";
import {
    clubEventTeamApi,
    type EventTeamDetails,
    type SearchUserResult,
    type EventTeamMember,
} from "../../api/clubEventTeamApi";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader } from "../../components/ui/loader";

export interface EventTeamManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    eventId: string;
    teamId: string;
    eventTitle?: string;
    eventStartsAt?: string;
    onTeamUpdated?: () => void;
    onTeamLeft?: () => void;
}

export const EventTeamManagementModal: React.FC<EventTeamManagementModalProps> = ({
    isOpen,
    onClose,
    eventId,
    teamId,
    eventTitle,
    eventStartsAt,
    onTeamUpdated,
    onTeamLeft,
}) => {
    const toast = useToast();
    const [team, setTeam] = useState<EventTeamDetails | null>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [copiedCode, setCopiedCode] = useState<boolean>(false);

    // Renaming state
    const [isEditingName, setIsEditingName] = useState<boolean>(false);
    const [teamNameInput, setTeamNameInput] = useState<string>("");
    const [isSavingName, setIsSavingName] = useState<boolean>(false);

    // Search & invite state
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SearchUserResult[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [invitingUsername, setInvitingUsername] = useState<string | null>(null);
    const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

    // Remove member modal
    const [memberToRemove, setMemberToRemove] = useState<EventTeamMember | null>(null);
    const [isRemovingMember, setIsRemovingMember] = useState<boolean>(false);

    // Leave team warning modal
    const [showLeaveWarning, setShowLeaveWarning] = useState<boolean>(false);
    const [isLeavingTeam, setIsLeavingTeam] = useState<boolean>(false);

    const loadTeamDetails = async () => {
        try {
            setLoading(true);
            const res = await clubEventTeamApi.getTeamDetails(eventId, teamId);
            setTeam(res.team);
            setTeamNameInput(res.team.name);
        } catch (err: any) {
            console.error("Failed to load team details:", err);
            toast.error(err.message || "Failed to load team details.", { title: "Error" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen && eventId && teamId) {
            loadTeamDetails();
        }
    }, [isOpen, eventId, teamId]);

    // Handle search debounce
    useEffect(() => {
        if (!team?.isLeader || !searchQuery.trim() || searchQuery.trim().length < 2) {
            setSearchResults([]);
            return;
        }

        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        searchDebounceRef.current = setTimeout(async () => {
            try {
                setIsSearching(true);
                const res = await clubEventTeamApi.searchUsers(eventId, teamId, searchQuery.trim());
                setSearchResults(res.users);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchQuery, eventId, teamId, team?.isLeader]);

    const handleCopyCode = async () => {
        if (!team?.code) return;
        try {
            await navigator.clipboard.writeText(team.code);
            setCopiedCode(true);
            toast.success(`Team code ${team.code} copied! Share it with your teammates.`, {
                title: "Code Copied",
            });
            setTimeout(() => setCopiedCode(false), 2500);
        } catch {
            toast.error("Failed to copy code to clipboard.", { title: "Error" });
        }
    };

    const handleRenameTeam = async () => {
        if (!teamNameInput.trim() || teamNameInput.trim() === team?.name) {
            setIsEditingName(false);
            return;
        }

        try {
            setIsSavingName(true);
            await clubEventTeamApi.renameTeam(eventId, teamId, teamNameInput.trim());
            toast.success("Team name updated successfully!", { title: "Renamed" });
            setIsEditingName(false);
            loadTeamDetails();
            onTeamUpdated?.();
        } catch (err: any) {
            toast.error(err.message || "Failed to rename team.", { title: "Error" });
        } finally {
            setIsSavingName(false);
        }
    };

    const handleInviteUser = async (username: string) => {
        try {
            setInvitingUsername(username);
            const res = await clubEventTeamApi.inviteMember(eventId, teamId, username);
            toast.success(res.message || `Invitation sent to @${username}!`, { title: "Invite Sent" });
            // Update search result status
            setSearchResults((prev) =>
                prev.map((u) => (u.username === username ? { ...u, hasPendingInvite: true } : u))
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to send invitation.", { title: "Invite Failed" });
        } finally {
            setInvitingUsername(null);
        }
    };

    const handleConfirmRemoveMember = async () => {
        if (!memberToRemove) return;
        try {
            setIsRemovingMember(true);
            await clubEventTeamApi.removeMember(eventId, teamId, memberToRemove.userId);
            toast.success(`${memberToRemove.name} has been removed from the team.`, {
                title: "Member Removed",
            });
            setMemberToRemove(null);
            loadTeamDetails();
            onTeamUpdated?.();
        } catch (err: any) {
            toast.error(err.message || "Failed to remove member.", { title: "Error" });
        } finally {
            setIsRemovingMember(false);
        }
    };

    const handleConfirmLeaveTeam = async () => {
        try {
            setIsLeavingTeam(true);
            await clubEventTeamApi.leaveTeam(eventId, teamId);
            toast.success("You have left the team.", { title: "Left Team" });
            setShowLeaveWarning(false);
            onClose();
            onTeamLeft?.();
        } catch (err: any) {
            toast.error(err.message || "Failed to leave team.", { title: "Error" });
        } finally {
            setIsLeavingTeam(false);
        }
    };

    if (!isOpen) return null;

    const startsAtDate = team?.eventStartsAt || eventStartsAt;
    const isLocked = Boolean(team?.isEventStarted || (startsAtDate && Date.now() >= new Date(startsAtDate).getTime()));
    const capacityRatio = team ? Math.min(100, Math.round((team.membersCount / team.maxTeamSize) * 100)) : 0;
    const isFull = team ? team.membersCount >= team.maxTeamSize : false;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
            <div className="relative w-full max-w-2xl bg-[#FAF6EE] border-3 border-black shadow-[8px_8px_0px_#000] rounded-3xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
                {/* Modal Header */}
                <div className="p-4 sm:p-6 bg-white border-b-3 border-black flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-12 h-12 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                            <Users className="w-6 h-6 text-black" />
                        </div>
                        <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block truncate">
                                {eventTitle || team?.eventTitle || "Event Team Management"}
                            </span>
                            <div className="flex items-center gap-2">
                                {isEditingName && team?.isLeader && !isLocked ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={teamNameInput}
                                            onChange={(e) => setTeamNameInput(e.target.value)}
                                            maxLength={60}
                                            autoFocus
                                            className="px-2.5 py-1 text-sm sm:text-base font-black bg-[#FAF6EE] border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] focus:outline-hidden"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleRenameTeam}
                                            disabled={isSavingName}
                                            className="px-2.5 py-1 text-xs font-black bg-[#a2ff86] border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] hover:bg-[#86ef6c] cursor-pointer"
                                        >
                                            {isSavingName ? "Saving..." : "Save"}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsEditingName(false);
                                                setTeamNameInput(team?.name || "");
                                            }}
                                            className="px-2 py-1 text-xs font-bold bg-white border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-base sm:text-lg font-black text-black truncate">
                                            {team?.name || "Loading Team..."}
                                        </h3>
                                        {team?.isLeader && !isLocked && (
                                            <button
                                                type="button"
                                                onClick={() => setIsEditingName(true)}
                                                className="p-1 hover:bg-neutral-100 rounded-md border border-black/30 hover:border-black cursor-pointer text-neutral-600 hover:text-black transition-colors"
                                                title="Rename team"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={loadTeamDetails}
                            disabled={loading}
                            className="p-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] cursor-pointer transition-all text-neutral-700 hover:text-black"
                            title="Refresh roster"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 bg-white hover:bg-rose-50 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] cursor-pointer transition-all text-neutral-700 hover:text-rose-600"
                        >
                            <X className="w-5 h-5 stroke-[2.5]" />
                        </button>
                    </div>
                </div>

                {/* Lock Alert Banner if event started */}
                {isLocked && (
                    <div className="bg-amber-100 border-b-2 border-black px-4 py-3 flex items-center gap-2.5 text-xs font-black text-amber-950">
                        <Lock className="w-4 h-4 text-amber-800 shrink-0" />
                        <span>
                            Event has started. Team roster is permanently locked. No modifications, member additions, or departures are permitted.
                        </span>
                    </div>
                )}

                {/* Modal Body */}
                <div className="p-4 sm:p-6 space-y-6 max-h-[72vh] overflow-y-auto">
                    {loading && !team ? (
                        <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                            <OrbixLoader size="md" />
                            <p className="text-xs font-bold text-neutral-500">Fetching team membership & permissions...</p>
                        </div>
                    ) : team ? (
                        <>
                            {/* Team Code & Capacity Bar Card */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                            Unique Team Join Code
                                        </span>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="font-mono text-xl sm:text-2xl font-black tracking-widest text-black bg-[#FAF6EE] px-3 py-1 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                                {team.code}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleCopyCode}
                                                className={`px-3 py-2 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-all ${
                                                    copiedCode
                                                        ? "bg-[#a2ff86] text-black"
                                                        : "bg-white hover:bg-neutral-100 text-black"
                                                }`}
                                            >
                                                {copiedCode ? (
                                                    <>
                                                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                                                        <span>Copied!</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="w-3.5 h-3.5" />
                                                        <span>Copy Code</span>
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="text-left sm:text-right">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                            Roster Capacity
                                        </span>
                                        <span className="text-sm sm:text-base font-black text-black">
                                            {team.membersCount} / {team.maxTeamSize} Members
                                        </span>
                                        <span className="text-[11px] font-bold text-neutral-500 block">
                                            (Min {team.minTeamSize} required)
                                        </span>
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1">
                                    <div className="w-full h-3 rounded-full bg-neutral-200 border-2 border-black overflow-hidden p-0.5">
                                        <div
                                            className={`h-full rounded-full transition-all duration-300 ${
                                                team.membersCount >= team.minTeamSize ? "bg-[#a2ff86]" : "bg-amber-400"
                                            }`}
                                            style={{ width: `${capacityRatio}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center justify-between text-[10px] font-bold text-neutral-500">
                                        <span>
                                            {team.membersCount < team.minTeamSize
                                                ? `Need at least ${team.minTeamSize - team.membersCount} more member(s)`
                                                : "Eligible for competition"}
                                        </span>
                                        <span>{isFull ? "Team Full" : `${team.maxTeamSize - team.membersCount} spot(s) open`}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Leader Action: Invite Teammates by @username */}
                            {team.isLeader && !isLocked && !isFull && (
                                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="flex items-center gap-2">
                                        <UserPlus className="w-4 h-4 text-black" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Invite Teammate by Username
                                        </h4>
                                    </div>

                                    <div className="relative">
                                        <div className="relative flex items-center">
                                            <Search className="absolute left-3 w-4 h-4 text-neutral-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                placeholder="Search student by username (e.g. vineet, rahul)..."
                                                className="w-full pl-9 pr-4 py-2.5 text-xs font-bold bg-[#FAF6EE] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] focus:bg-white focus:outline-hidden"
                                            />
                                            {isSearching && (
                                                <div className="absolute right-3">
                                                    <RefreshCw className="w-4 h-4 animate-spin text-neutral-500" />
                                                </div>
                                            )}
                                        </div>

                                        {/* Dropdown Results */}
                                        {searchResults.length > 0 && (
                                            <div className="mt-2 p-2 bg-white border-2 border-black rounded-xl shadow-[4px_4px_0px_#000] max-h-56 overflow-y-auto divide-y divide-black/10">
                                                {searchResults.map((user) => (
                                                    <div
                                                        key={user.id}
                                                        className="py-2 px-2 flex items-center justify-between gap-3 hover:bg-[#FAF6EE] rounded-lg transition-colors"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <img
                                                                src={user.avatarUrl || "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png"}
                                                                alt={user.name}
                                                                className="w-8 h-8 rounded-full border border-black object-cover shrink-0"
                                                            />
                                                            <div className="min-w-0">
                                                                <p className="text-xs font-black text-black truncate">{user.name}</p>
                                                                <a
                                                                    href={`/profile/${user.username}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] font-mono text-neutral-600 hover:text-black flex items-center gap-1"
                                                                >
                                                                    <span>@{user.username}</span>
                                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                                </a>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            {user.isMember ? (
                                                                <span className="text-[10px] font-black uppercase text-neutral-500 px-2 py-1 bg-neutral-100 rounded-md border border-neutral-300">
                                                                    In Team
                                                                </span>
                                                            ) : user.hasPendingInvite ? (
                                                                <span className="text-[10px] font-black uppercase text-amber-700 px-2 py-1 bg-amber-50 rounded-md border border-amber-300">
                                                                    Invite Sent
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleInviteUser(user.username)}
                                                                    disabled={invitingUsername === user.username}
                                                                    className="px-2.5 py-1 text-xs font-black bg-[#a2ff86] hover:bg-[#86ef6c] border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                                                >
                                                                    <UserPlus className="w-3 h-3" />
                                                                    <span>{invitingUsername === user.username ? "Inviting..." : "Invite"}</span>
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Member Roster List */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                        <span>Current Roster</span>
                                        <span className="px-2 py-0.5 rounded-full bg-white border border-black text-[10px] font-black shadow-[1px_1px_0px_#000]">
                                            {team.members.length}
                                        </span>
                                    </h4>
                                </div>

                                <div className="space-y-2">
                                    {team.members.map((member) => {
                                        const isThisMemberLeader = member.role === "leader";
                                        return (
                                            <div
                                                key={member.id}
                                                className="p-3.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                            >
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <img
                                                        src={member.avatarUrl || "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png"}
                                                        alt={member.name}
                                                        className="w-10 h-10 rounded-full border-2 border-black object-cover shrink-0"
                                                    />
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <p className="text-xs sm:text-sm font-black text-black truncate">
                                                                {member.name}
                                                            </p>
                                                            {isThisMemberLeader ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-300 text-black border border-black shadow-[1px_1px_0px_#000] inline-flex items-center gap-1">
                                                                    <Crown className="w-2.5 h-2.5" />
                                                                    <span>Leader</span>
                                                                </span>
                                                            ) : (
                                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-sky-100 text-sky-950 border border-black/30">
                                                                    Member
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5 text-[11px] text-neutral-600">
                                                            <a
                                                                href={`/profile/${member.username}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="font-mono hover:text-black hover:underline flex items-center gap-1"
                                                            >
                                                                <span>@{member.username}</span>
                                                                <ExternalLink className="w-2.5 h-2.5 text-neutral-400" />
                                                            </a>
                                                            <span className="text-neutral-400">•</span>
                                                            <span className="flex items-center gap-1 font-mono text-[10px] text-neutral-500">
                                                                <Mail className="w-3 h-3 text-neutral-400" />
                                                                <span>{member.email}</span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    {team.isLeader && !isThisMemberLeader && !isLocked && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setMemberToRemove(member)}
                                                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 border-2 border-rose-600 text-[11px] font-black text-rose-700 shadow-[1.5px_1.5px_0px_#e11d48] cursor-pointer flex items-center gap-1 transition-all"
                                                        >
                                                            <UserMinus className="w-3.5 h-3.5" />
                                                            <span>Remove</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </>
                    ) : null}
                </div>

                {/* Footer with Leave Button & Close */}
                <div className="p-4 sm:p-5 bg-white border-t-3 border-black flex items-center justify-between gap-3">
                    <div>
                        {!isLocked && (
                            <button
                                type="button"
                                onClick={() => setShowLeaveWarning(true)}
                                className="px-3 py-2 rounded-xl bg-white hover:bg-rose-50 border-2 border-black text-xs font-black text-rose-700 shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-all"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Leave Team</span>
                            </button>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl bg-black text-white hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* Remove Member Confirmation Modal */}
            {memberToRemove && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white border-3 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-rose-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-rose-600">
                                <UserMinus className="w-5 h-5 stroke-[2.5]" />
                            </div>
                            <div>
                                <h4 className="text-sm sm:text-base font-black text-black">Remove Team Member?</h4>
                                <p className="text-xs text-neutral-600 font-bold">This action cannot be undone.</p>
                            </div>
                        </div>

                        <p className="text-xs text-neutral-700 font-medium bg-[#FAF6EE] p-3 rounded-xl border border-black/20">
                            Are you sure you want to remove <span className="font-bold text-black">{memberToRemove.name}</span> (@{memberToRemove.username}) from <span className="font-bold text-black">{team?.name}</span>? An email notification will be sent to inform them.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setMemberToRemove(null)}
                                disabled={isRemovingMember}
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmRemoveMember}
                                disabled={isRemovingMember}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                            >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>{isRemovingMember ? "Removing..." : "Remove Member"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANDATORY LEAVE TEAM WARNING MODAL (All leaving and joining must be done before event starts) */}
            {showLeaveWarning && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
                    <div className="w-full max-w-md bg-white border-3 border-black shadow-[6px_6px_0px_#000] rounded-3xl p-6 space-y-4 animate-in fade-in zoom-in-95">
                        <div className="flex items-center gap-3">
                            <div className="w-11 h-11 rounded-2xl bg-amber-300 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black">
                                <AlertTriangle className="w-6 h-6 stroke-[2.5]" />
                            </div>
                            <div>
                                <h4 className="text-sm sm:text-base font-black text-black">Leave Team Confirmation</h4>
                                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                                    Important Participation Notice
                                </span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-amber-50 border-2 border-amber-600 text-xs text-amber-950 font-medium space-y-2">
                            <p className="font-bold flex items-center gap-1.5 text-amber-900">
                                <Clock className="w-4 h-4 text-amber-800 shrink-0" />
                                <span>All leaving and joining must be done before the event starts.</span>
                            </p>
                            <p>
                                Are you sure you want to leave <span className="font-bold text-black">{team?.name}</span>?
                            </p>
                            <p className="text-[11px] text-neutral-700">
                                By leaving, you will forfeit your registered position on this team. Once the event begins, team rosters freeze permanently and no re-joining or new invites will be permitted.
                            </p>
                            {team?.isLeader && team.members.length > 1 && (
                                <p className="text-[11px] font-bold text-rose-700">
                                    Notice: You are currently the Team Leader. Leaving will promote the next teammate to Team Leader.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setShowLeaveWarning(false)}
                                disabled={isLeavingTeam}
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Keep My Spot
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmLeaveTeam}
                                disabled={isLeavingTeam}
                                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>{isLeavingTeam ? "Leaving..." : "Yes, Leave Team"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
