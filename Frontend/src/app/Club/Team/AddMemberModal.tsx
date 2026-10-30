import React, { useState, useEffect, useRef } from "react";
import {
    X,
    Search,
    UserPlus,
    Shield,
    Loader2,
    Users,
    Briefcase,
    Info,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { NeoSelect } from "../../../components/NeoSelect";
import type { ClubTeam, UserSearchItem } from "./types";
import { DEFAULT_AVATAR_URL } from "../../../utils/avatarConstants";

interface AddMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    teams: ClubTeam[];
    onInvitationSent: () => void;
}

const COMMON_TITLES = [
    "Core Member",
    "Technical Head",
    "Full-Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "UI/UX Designer",
    "Design Head",
    "Events & Operations Lead",
    "Event Coordinator",
    "PR & Marketing Lead",
    "Sponsorship Coordinator",
    "Content Creator / Media Lead",
    "Vice President",
    "General Secretary",
    "Advisor / Mentor",
];

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
    isOpen,
    onClose,
    teams,
    onInvitationSent,
}) => {
    const toast = useToast();

    // Search state
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<UserSearchItem[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserSearchItem | null>(null);

    // Invitation parameters
    const [selectedTeamId, setSelectedTeamId] = useState<string>("");
    const [title, setTitle] = useState("Core Member");
    const [customTitle, setCustomTitle] = useState("");
    const [isCustomTitle, setIsCustomTitle] = useState(false);
    const [clubRole, setClubRole] = useState<"member" | "team_lead" | "admin" | "advisor">("member");
    const [teamRole, setTeamRole] = useState<"member" | "co_lead" | "lead">("member");
    const [message, setMessage] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const searchDebounceRef = useRef<any>(null);

    // Debounced search when user types username
    useEffect(() => {
        if (searchDebounceRef.current) {
            clearTimeout(searchDebounceRef.current);
        }

        const trimmed = searchQuery.trim();
        if (trimmed.length < 2) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        searchDebounceRef.current = setTimeout(async () => {
            try {
                const res = await fetch(`/api/club/team/search-users?q=${encodeURIComponent(trimmed)}`, {
                    credentials: "include",
                });
                const data = await res.json();
                if (data.success && Array.isArray(data.users)) {
                    setSearchResults(data.users);
                } else {
                    setSearchResults([]);
                }
            } catch (err) {
                console.error("Search error:", err);
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => {
            if (searchDebounceRef.current) {
                clearTimeout(searchDebounceRef.current);
            }
        };
    }, [searchQuery]);

    // Reset state on open/close
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery("");
            setSearchResults([]);
            setSelectedUser(null);
            setSelectedTeamId("");
            setTitle("Core Member");
            setCustomTitle("");
            setIsCustomTitle(false);
            setClubRole("member");
            setTeamRole("member");
            setMessage("");
            setIsSubmitting(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUser) {
            toast.error("Please search and select an Orbix user to invite.", { title: "Select User" });
            return;
        }

        const effectiveTitle = isCustomTitle ? customTitle.trim() : title.trim();
        if (!effectiveTitle) {
            toast.error("Please provide an organisational title or responsibility.", { title: "Title Required" });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/club/team/invitations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    username: selectedUser.username,
                    userId: selectedUser.id,
                    teamId: selectedTeamId || undefined,
                    clubRole,
                    teamRole,
                    title: effectiveTitle,
                    invitationMessage: message.trim() || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to dispatch invitation.", { title: "Invitation Error" });
                return;
            }

            toast.success(
                `Invitation dispatched to @${selectedUser.username}! A notification has been placed in their inbox.`,
                { title: "Invitation Sent" }
            );
            onInvitationSent();
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Unable to send invitation. Please try again.", { title: "Network Error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-2xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <UserPlus className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">
                                Invite Member to Club
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Discover registered Orbix users by username and onboard them via consent.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <X className="w-4 h-4 text-black stroke-[2.5]" />
                    </button>
                </div>

                <form onSubmit={handleSendInvitation} className="space-y-4">
                    {/* Step 1: User Search */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            1. Find Orbix User <span className="text-rose-500">*</span>
                        </label>

                        {!selectedUser ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Type username (e.g. vineet_chandel, rahul_tripathi)..."
                                        className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                                        autoFocus
                                    />
                                    {isSearching && (
                                        <Loader2 className="w-4 h-4 text-neutral-500 absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin" />
                                    )}
                                </div>

                                {/* Results Dropdown / List */}
                                {searchQuery.trim().length >= 2 && (
                                    <div className="p-2 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5 max-h-56 overflow-y-auto">
                                        {isSearching && searchResults.length === 0 ? (
                                            <p className="text-xs text-neutral-500 p-3 text-center font-bold">
                                                Searching Orbix users...
                                            </p>
                                        ) : searchResults.length === 0 ? (
                                            <div className="p-3 text-center space-y-1">
                                                <p className="text-xs font-black text-black">
                                                    No registered user found matching "{searchQuery}"
                                                </p>
                                                <p className="text-[11px] text-neutral-600 font-medium">
                                                    Only existing Orbix accounts can be invited. Ask them to sign up at orbix.dev first.
                                                </p>
                                            </div>
                                        ) : (
                                            searchResults.map((user) => (
                                                <div
                                                    key={user.id}
                                                    onClick={() => {
                                                        if (user.hasPendingInvitation) {
                                                            toast.info(`@${user.username} already has a pending invitation.`, { title: "Pending" });
                                                        }
                                                        setSelectedUser(user);
                                                    }}
                                                    className="p-2.5 rounded-lg bg-white border border-black hover:border-2 hover:bg-[#FFE566]/20 transition-all cursor-pointer flex items-center justify-between gap-3"
                                                >
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <img
                                                            src={user.avatarUrl || DEFAULT_AVATAR_URL}
                                                            alt={user.username}
                                                            className="w-9 h-9 rounded-full border-2 border-black object-cover shrink-0"
                                                            onError={(e) => {
                                                                (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                                            }}
                                                        />
                                                        <div className="min-w-0">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-black text-black truncate">
                                                                    {user.displayName}
                                                                </span>
                                                                {user.isVerifiedCoder && (
                                                                    <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-1.5 py-0.2 rounded border border-emerald-600">
                                                                        Verified
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] font-mono font-bold text-neutral-600 block truncate">
                                                                @{user.username} {user.college ? `• ${user.college}` : ""}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="shrink-0 flex items-center gap-2">
                                                        {user.isClubMember && (
                                                            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-600 text-[10px] font-black">
                                                                {user.clubRole ? `Club ${user.clubRole}` : "In Club"}
                                                            </span>
                                                        )}
                                                        {user.hasPendingInvitation && (
                                                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-600 text-[10px] font-black">
                                                                Invite Pending
                                                            </span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-black text-[11px] border border-black"
                                                        >
                                                            Select
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* Selected User Badge */
                            <div className="p-3 rounded-xl bg-[#a2ff86]/30 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <img
                                        src={selectedUser.avatarUrl || DEFAULT_AVATAR_URL}
                                        alt={selectedUser.username}
                                        className="w-10 h-10 rounded-full border-2 border-black object-cover shrink-0"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = DEFAULT_AVATAR_URL;
                                        }}
                                    />
                                    <div className="min-w-0">
                                        <p className="text-xs font-black text-black flex items-center gap-1.5">
                                            <span>{selectedUser.displayName}</span>
                                            <span className="font-mono font-bold text-neutral-700">(@{selectedUser.username})</span>
                                        </p>
                                        <p className="text-[11px] text-neutral-600 font-medium truncate">
                                            {selectedUser.headline || selectedUser.college || "Orbix Developer"}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 border border-black text-xs font-black text-black shadow-[1px_1px_0px_#000] cursor-pointer shrink-0"
                                >
                                    Change
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Target Team / Department */}
                    <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            2. Department / Team
                        </label>
                        <NeoSelect
                            value={selectedTeamId}
                            onChange={(val) => setSelectedTeamId(val)}
                            options={[
                                { value: "", label: "Club-Wide / Core Executive Board" },
                                ...teams.filter((t) => !t.isArchived).map((t) => ({
                                    value: t.id,
                                    label: `${t.name} (${t.memberCount} members)`,
                                })),
                            ]}
                            size="sm"
                        />
                        <p className="text-[11px] text-neutral-600 font-medium">
                            Choose whether the member is invited to a specific department or club-wide.
                        </p>
                    </div>

                    {/* Step 3: Organisational Title / Position */}
                    <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                3. Organisational Title / Position <span className="text-rose-500">*</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsCustomTitle((prev) => !prev)}
                                className="text-[11px] font-black text-black underline hover:text-neutral-700 cursor-pointer"
                            >
                                {isCustomTitle ? "Choose from presets" : "+ Custom Title"}
                            </button>
                        </div>

                        {isCustomTitle ? (
                            <input
                                type="text"
                                value={customTitle}
                                onChange={(e) => setCustomTitle(e.target.value)}
                                placeholder="e.g. Lead Roboticist, Open-Source Maintainer, Treasurer..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                                required
                            />
                        ) : (
                            <NeoSelect
                                value={title}
                                onChange={(val) => setTitle(val)}
                                options={COMMON_TITLES.map((t) => ({ value: t, label: t }))}
                                size="sm"
                            />
                        )}
                        <p className="text-[11px] text-neutral-600 font-medium">
                            Human-readable role title for showcase profiles and club roster.
                        </p>
                    </div>

                    {/* Step 4: Access Permissions Hierarchy */}
                    <div className="space-y-2 pt-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            4. Club-Wide Access Permissions
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            {/* Member */}
                            <label
                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    clubRole === "member"
                                        ? "bg-black text-white border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black border-black/40 hover:border-black"
                                }`}
                            >
                                <div>
                                    <input
                                        type="radio"
                                        name="clubRole"
                                        value="member"
                                        checked={clubRole === "member"}
                                        onChange={() => setClubRole("member")}
                                        className="sr-only"
                                    />
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black uppercase">Club Member</span>
                                        <Users className={`w-3.5 h-3.5 ${clubRole === "member" ? "text-[#a2ff86]" : "text-neutral-500"}`} />
                                    </div>
                                    <p className={`text-[10px] leading-tight ${clubRole === "member" ? "text-neutral-300" : "text-neutral-600"}`}>
                                        View club structure and access member areas. Standard access.
                                    </p>
                                </div>
                            </label>

                            {/* Team Lead */}
                            <label
                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    clubRole === "team_lead"
                                        ? "bg-black text-white border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black border-black/40 hover:border-black"
                                }`}
                            >
                                <div>
                                    <input
                                        type="radio"
                                        name="clubRole"
                                        value="team_lead"
                                        checked={clubRole === "team_lead"}
                                        onChange={() => setClubRole("team_lead")}
                                        className="sr-only"
                                    />
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black uppercase">Team Lead</span>
                                        <Briefcase className={`w-3.5 h-3.5 ${clubRole === "team_lead" ? "text-[#a2ff86]" : "text-neutral-500"}`} />
                                    </div>
                                    <p className={`text-[10px] leading-tight ${clubRole === "team_lead" ? "text-neutral-300" : "text-neutral-600"}`}>
                                        Manage their assigned department roster and invite team members.
                                    </p>
                                </div>
                            </label>

                            {/* Admin */}
                            <label
                                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                                    clubRole === "admin"
                                        ? "bg-black text-white border-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-black border-black/40 hover:border-black"
                                }`}
                            >
                                <div>
                                    <input
                                        type="radio"
                                        name="clubRole"
                                        value="admin"
                                        checked={clubRole === "admin"}
                                        onChange={() => setClubRole("admin")}
                                        className="sr-only"
                                    />
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-black uppercase">Club Admin</span>
                                        <Shield className={`w-3.5 h-3.5 ${clubRole === "admin" ? "text-[#a2ff86]" : "text-neutral-500"}`} />
                                    </div>
                                    <p className={`text-[10px] leading-tight ${clubRole === "admin" ? "text-neutral-300" : "text-neutral-600"}`}>
                                        Full management: create teams, invite/remove members across club.
                                    </p>
                                </div>
                            </label>
                        </div>
                    </div>

                    {/* Step 5: Optional Invitation Note */}
                    <div className="space-y-1.5 pt-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            5. Invitation Note <span className="text-neutral-500 font-normal lowercase">(optional)</span>
                        </label>
                        <textarea
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            placeholder="Add a personalized message or instructions for the invitee..."
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                        />
                    </div>

                    {/* Consent Warning Box */}
                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-1 flex items-start gap-2.5">
                        <Info className="w-4 h-4 text-black shrink-0 mt-0.5" />
                        <div className="text-[11px] text-neutral-700 leading-relaxed font-medium">
                            <span className="font-bold text-black">Mandatory Consent Workflow: </span>
                            No member is added silently. An invitation card will be delivered to their personal Orbix Notification Inbox. Their membership and permissions activate only when they click Accept.
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-white border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!selectedUser || isSubmitting}
                            className="px-5 py-2.5 rounded-xl bg-[#a2ff86] border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:bg-[#8ee673] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Dispatching Invitation...</span>
                                </>
                            ) : (
                                <>
                                    <span>Send Invitation</span>
                                    <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
