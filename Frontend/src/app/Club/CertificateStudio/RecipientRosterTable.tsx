import React, { useState, useMemo } from "react";
import {
    Search,
    Check,
    Users,
    AlertTriangle,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ShieldCheck,
    X,
    ChevronDown,
    CheckSquare,
    Square,
    MinusSquare,
    RotateCcw,
} from "lucide-react";

export interface RosterRecipientItem {
    id: string; // unique key (registrationId, userId, or csv index)
    userId?: string | undefined;
    name: string;
    username?: string | undefined;
    email?: string | undefined;
    collegeName?: string | undefined;
    department?: string | undefined;
    teamName?: string | undefined;
    teamId?: string | undefined;
    status?: "attended" | "registered" | "pending" | "declined" | string | undefined;
    checkedInAt?: string | null | undefined;
    alreadyHasCert?: boolean | undefined;
    isEligible?: boolean | undefined;
    exclusionReason?: string | undefined;
    role?: string | undefined;
    customPosition?: string | undefined;
    customName?: string | undefined;
}

interface RecipientRosterTableProps {
    recipients: RosterRecipientItem[];
    selectedIds: Set<string>;
    onToggleSelect: (id: string) => void;
    onSelectMultiple: (ids: string[]) => void;
    onDeselectMultiple: (ids: string[]) => void;
    onDeselectAll: () => void;
    certType?: string | undefined;
    requireAttendance?: boolean | undefined;
    onUpdateCustomPosition?: ((id: string, position: string) => void) | undefined;
    title?: string | undefined;
}

export const RecipientRosterTable: React.FC<RecipientRosterTableProps> = ({
    recipients,
    selectedIds,
    onToggleSelect,
    onSelectMultiple,
    onDeselectMultiple,
    onDeselectAll,
    certType: _certType = "participation",
    requireAttendance = false,
    onUpdateCustomPosition,
    title = "Recipient Roster",
}) => {
    // Search & Filter States
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<
        "all" | "attended" | "registered" | "eligible" | "missing_info" | "duplicates" | "already_issued"
    >("all");
    const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all");
    const [showTeamDropdown, setShowTeamDropdown] = useState(false);

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState<number>(25);

    // 1. Detect Duplicates across email and userId
    const duplicateIdSet = useMemo(() => {
        const emailCounts = new Map<string, number>();
        const userCounts = new Map<string, number>();

        recipients.forEach((r) => {
            if (r.email) {
                const em = r.email.toLowerCase().trim();
                emailCounts.set(em, (emailCounts.get(em) || 0) + 1);
            }
            if (r.userId) {
                userCounts.set(r.userId, (userCounts.get(r.userId) || 0) + 1);
            }
        });

        const dups = new Set<string>();
        recipients.forEach((r) => {
            const hasDuplicateEmail = r.email && (emailCounts.get(r.email.toLowerCase().trim()) || 0) > 1;
            const hasDuplicateUser = r.userId && (userCounts.get(r.userId) || 0) > 1;
            if (hasDuplicateEmail || hasDuplicateUser) {
                dups.add(r.id);
            }
        });
        return dups;
    }, [recipients]);

    // 2. Detect Missing Info items
    const missingInfoSet = useMemo(() => {
        const missing = new Set<string>();
        recipients.forEach((r) => {
            const noName = !r.name || r.name.trim().length === 0;
            const noEmail = !r.email || r.email.trim().length === 0;
            const noUser = !r.userId && !r.username;
            if (noName || noEmail || noUser) {
                missing.add(r.id);
            }
        });
        return missing;
    }, [recipients]);

    // 3. Extract unique teams present in roster
    const uniqueTeams = useMemo(() => {
        const teamMap = new Map<string, { name: string; count: number; ids: string[] }>();
        recipients.forEach((r) => {
            if (r.teamName && r.teamName.trim().length > 0) {
                const tName = r.teamName.trim();
                if (!teamMap.has(tName)) {
                    teamMap.set(tName, { name: tName, count: 0, ids: [] });
                }
                const entry = teamMap.get(tName)!;
                entry.count++;
                entry.ids.push(r.id);
            }
        });
        return Array.from(teamMap.values());
    }, [recipients]);

    // 4. Determine eligibility for each item
    const isItemEligible = (r: RosterRecipientItem): boolean => {
        if (r.isEligible === false) return false;
        if (requireAttendance && r.status !== "attended" && !r.checkedInAt) {
            return false;
        }
        return true;
    };

    // 5. Filter Recipients
    const filteredRecipients = useMemo(() => {
        return recipients.filter((r) => {
            // Search
            if (searchQuery.trim().length > 0) {
                const q = searchQuery.toLowerCase().trim();
                const nameMatch = r.name.toLowerCase().includes(q);
                const userMatch = r.username?.toLowerCase().includes(q);
                const emailMatch = r.email?.toLowerCase().includes(q);
                const teamMatch = r.teamName?.toLowerCase().includes(q);
                const roleMatch = r.role?.toLowerCase().includes(q);
                if (!nameMatch && !userMatch && !emailMatch && !teamMatch && !roleMatch) {
                    return false;
                }
            }

            // Team filter
            if (selectedTeamFilter !== "all" && r.teamName !== selectedTeamFilter) {
                return false;
            }

            // Status filter
            if (statusFilter === "attended") {
                return r.status === "attended" || Boolean(r.checkedInAt);
            }
            if (statusFilter === "registered") {
                return r.status === "registered";
            }
            if (statusFilter === "eligible") {
                return isItemEligible(r);
            }
            if (statusFilter === "missing_info") {
                return missingInfoSet.has(r.id);
            }
            if (statusFilter === "duplicates") {
                return duplicateIdSet.has(r.id);
            }
            if (statusFilter === "already_issued") {
                return Boolean(r.alreadyHasCert);
            }

            return true;
        });
    }, [recipients, searchQuery, statusFilter, selectedTeamFilter, duplicateIdSet, missingInfoSet, requireAttendance]);

    // 6. Pagination calculations
    const totalPages = Math.max(1, Math.ceil(filteredRecipients.length / pageSize));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * pageSize;
    const paginatedRecipients = filteredRecipients.slice(startIndex, startIndex + pageSize);

    // 7. Header selection status on current view
    const currentPageIds = paginatedRecipients.map((r) => r.id);
    const allCurrentPageSelected = currentPageIds.length > 0 && currentPageIds.every((id) => selectedIds.has(id));
    const someCurrentPageSelected = currentPageIds.some((id) => selectedIds.has(id));

    // Handlers
    const handleToggleCurrentPage = () => {
        if (allCurrentPageSelected) {
            onDeselectMultiple(currentPageIds);
        } else {
            onSelectMultiple(currentPageIds);
        }
    };

    const handleSelectAllEligible = () => {
        const eligibleIds = recipients.filter(isItemEligible).map((r) => r.id);
        onSelectMultiple(eligibleIds);
    };

    const handleSelectTeam = (teamIds: string[]) => {
        onSelectMultiple(teamIds);
        setShowTeamDropdown(false);
    };

    const handleDeselectTeam = (teamIds: string[]) => {
        onDeselectMultiple(teamIds);
        setShowTeamDropdown(false);
    };

    const handleDeselectFiltered = () => {
        const filteredIds = filteredRecipients.map((r) => r.id);
        onDeselectMultiple(filteredIds);
    };

    return (
        <div className="space-y-4">
            {/* Header & Metric Bar */}
            <div className="p-4 bg-[#FAF6EE] rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black shadow-[2px_2px_0px_#000]">
                        <Users className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h4 className="text-sm sm:text-base font-black text-black tracking-tight">{title}</h4>
                        <div className="text-[11px] font-bold text-neutral-600 flex items-center gap-2">
                            <span>Total Roster: {recipients.length}</span>
                            <span>•</span>
                            <span className="text-emerald-700">Eligible: {recipients.filter(isItemEligible).length}</span>
                            {uniqueTeams.length > 0 && (
                                <>
                                    <span>•</span>
                                    <span>Teams: {uniqueTeams.length}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Live Selected Badge */}
                <div className="flex items-center gap-2">
                    <div className="px-3.5 py-1.5 rounded-xl bg-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>
                            {selectedIds.size} of {recipients.length} Selected
                        </span>
                    </div>

                    {selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={onDeselectAll}
                            className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black font-black text-xs shadow-[1.5px_1.5px_0px_#000] cursor-pointer"
                        >
                            Deselect All
                        </button>
                    )}
                </div>
            </div>

            {/* Quick Actions & Selection Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        onClick={handleSelectAllEligible}
                        className="px-3 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ebd04e] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    >
                        <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Select All Eligible ({recipients.filter(isItemEligible).length})</span>
                    </button>

                    {/* Select by Team Dropdown */}
                    {uniqueTeams.length > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setShowTeamDropdown(!showTeamDropdown)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                            >
                                <Users className="w-3.5 h-3.5" />
                                <span>Select by Team</span>
                                <ChevronDown className="w-3.5 h-3.5" />
                            </button>

                            {showTeamDropdown && (
                                <div className="absolute left-0 mt-2 w-64 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] p-2 z-30 space-y-1">
                                    <div className="text-[10px] font-black uppercase text-neutral-500 px-2 py-1">
                                        Teams in Roster
                                    </div>
                                    <div className="max-h-48 overflow-y-auto space-y-1">
                                        {uniqueTeams.map((tm) => {
                                            const allSelected = tm.ids.every((id) => selectedIds.has(id));
                                            return (
                                                <div
                                                    key={tm.name}
                                                    className="p-2 rounded-xl border border-black/20 hover:border-black hover:bg-[#FAF6EE] flex items-center justify-between gap-2 text-xs font-bold"
                                                >
                                                    <span className="truncate max-w-[130px] font-black">{tm.name}</span>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-[10px] text-neutral-500 font-mono">({tm.count})</span>
                                                        {allSelected ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeselectTeam(tm.ids)}
                                                                className="px-1.5 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200"
                                                            >
                                                                Deselect
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectTeam(tm.ids)}
                                                                className="px-1.5 py-0.5 rounded text-[10px] font-black bg-[#a2ff86] text-black border border-black hover:bg-[#8fe676]"
                                                            >
                                                                Select
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {filteredRecipients.length < recipients.length && selectedIds.size > 0 && (
                        <button
                            type="button"
                            onClick={handleDeselectFiltered}
                            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 border-2 border-black font-black text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Deselect Filtered ({filteredRecipients.filter((r) => selectedIds.has(r.id)).length})</span>
                        </button>
                    )}
                </div>

                {/* Duplicate & Missing Data Alerts */}
                <div className="flex items-center gap-2">
                    {duplicateIdSet.size > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 border-2 border-black text-amber-900 text-[11px] font-black flex items-center gap-1 shadow-[1.5px_1.5px_0px_#000]">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                            <span>{duplicateIdSet.size} Duplicate Recipient(s)</span>
                        </span>
                    )}
                    {missingInfoSet.size > 0 && (
                        <span className="px-2.5 py-1 rounded-xl bg-rose-100 border-2 border-black text-rose-900 text-[11px] font-black flex items-center gap-1 shadow-[1.5px_1.5px_0px_#000]">
                            <AlertCircle className="w-3.5 h-3.5 text-rose-700" />
                            <span>{missingInfoSet.size} Missing Data</span>
                        </span>
                    )}
                </div>
            </div>

            {/* Search Bar & Filter Pills */}
            <div className="p-3.5 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <div className="relative flex-1 w-full">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setCurrentPage(1);
                            }}
                            placeholder="Search by student name, @username, email, team or department..."
                            className="w-full pl-9 pr-8 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold focus:outline-none"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Team Filter Dropdown */}
                    {uniqueTeams.length > 0 && (
                        <select
                            value={selectedTeamFilter}
                            onChange={(e) => {
                                setSelectedTeamFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="p-2 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] max-w-[200px]"
                        >
                            <option value="all">All Teams ({uniqueTeams.length})</option>
                            {uniqueTeams.map((tm) => (
                                <option key={tm.name} value={tm.name}>
                                    {tm.name} ({tm.count})
                                </option>
                            ))}
                        </select>
                    )}
                </div>

                {/* Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {[
                        { id: "all", label: `All (${recipients.length})` },
                        {
                            id: "attended",
                            label: `✓ Attended Only (${recipients.filter((r) => r.status === "attended" || r.checkedInAt).length})`,
                        },
                        {
                            id: "registered",
                            label: `Registered (${recipients.filter((r) => r.status === "registered").length})`,
                        },
                        {
                            id: "eligible",
                            label: `Eligible Only (${recipients.filter(isItemEligible).length})`,
                        },
                        {
                            id: "missing_info",
                            label: `⚠️ Missing Info (${missingInfoSet.size})`,
                        },
                        {
                            id: "duplicates",
                            label: `🔁 Duplicates (${duplicateIdSet.size})`,
                        },
                        {
                            id: "already_issued",
                            label: `🏆 Already Issued (${recipients.filter((r) => r.alreadyHasCert).length})`,
                        },
                    ].map((pill) => (
                        <button
                            key={pill.id}
                            type="button"
                            onClick={() => {
                                setStatusFilter(pill.id as any);
                                setCurrentPage(1);
                            }}
                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-black transition-all cursor-pointer ${
                                statusFilter === pill.id
                                    ? "bg-black text-[#FFE566] border-black shadow-[1px_1px_0px_#000]"
                                    : "bg-neutral-100 text-neutral-700 border-neutral-300 hover:bg-neutral-200"
                            }`}
                        >
                            {pill.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Multi-Select Table */}
            <div className="overflow-hidden rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] bg-white">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-[#FAF6EE] border-b-3 border-black text-[11px] font-black text-black uppercase tracking-wider">
                                <th className="p-3 w-10 text-center">
                                    <button
                                        type="button"
                                        onClick={handleToggleCurrentPage}
                                        className="w-5 h-5 rounded border-2 border-black flex items-center justify-center bg-white cursor-pointer hover:bg-neutral-100 mx-auto"
                                    >
                                        {allCurrentPageSelected ? (
                                            <CheckSquare className="w-4 h-4 text-black" />
                                        ) : someCurrentPageSelected ? (
                                            <MinusSquare className="w-4 h-4 text-black" />
                                        ) : (
                                            <Square className="w-4 h-4 text-neutral-300" />
                                        )}
                                    </button>
                                </th>
                                <th className="p-3">Recipient & Username</th>
                                <th className="p-3">Team / Affiliation</th>
                                <th className="p-3">Attendance & Eligibility</th>
                                <th className="p-3">Award Position / Custom Role</th>
                                <th className="p-3 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y-2 divide-neutral-200 text-xs">
                            {paginatedRecipients.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-neutral-500 font-bold">
                                        No recipients match the active search or filters.
                                    </td>
                                </tr>
                            ) : (
                                paginatedRecipients.map((rec) => {
                                    const isSelected = selectedIds.has(rec.id);
                                    const isAttended = rec.status === "attended" || Boolean(rec.checkedInAt);
                                    const isEligible = isItemEligible(rec);
                                    const isDuplicate = duplicateIdSet.has(rec.id);
                                    const isMissingInfo = missingInfoSet.has(rec.id);

                                    return (
                                        <tr
                                            key={rec.id}
                                            onClick={() => onToggleSelect(rec.id)}
                                            className={`transition-colors cursor-pointer select-none ${
                                                isSelected
                                                    ? "bg-[#FFE566]/25 hover:bg-[#FFE566]/35"
                                                    : "hover:bg-neutral-50"
                                            }`}
                                        >
                                            {/* Checkbox Cell */}
                                            <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => onToggleSelect(rec.id)}
                                                    className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer"
                                                />
                                            </td>

                                            {/* Recipient Details */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-black">{rec.name || "Unnamed"}</span>
                                                    {rec.username && (
                                                        <span className="text-[10px] font-mono text-neutral-500">
                                                            @{rec.username}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[11px] text-neutral-600 font-medium">
                                                    {rec.email || <span className="text-rose-600 font-bold">Missing Email</span>}
                                                </div>
                                            </td>

                                            {/* Team & Affiliation */}
                                            <td className="p-3">
                                                {rec.teamName ? (
                                                    <span className="px-2 py-0.5 rounded-md bg-purple-100 border border-purple-300 font-bold text-purple-900 text-[10px] inline-flex items-center gap-1">
                                                        <Users className="w-2.5 h-2.5" />
                                                        <span>{rec.teamName}</span>
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-neutral-500">
                                                        {rec.collegeName || "Individual Participant"}
                                                    </span>
                                                )}
                                                {rec.department && (
                                                    <div className="text-[10px] text-neutral-400 truncate max-w-[150px]">
                                                        {rec.department}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Attendance & Eligibility */}
                                            <td className="p-3">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    {isAttended ? (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-[#a2ff86] border border-black text-black">
                                                            ✓ Verified Check-In
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                                                            Registered
                                                        </span>
                                                    )}

                                                    {!isEligible && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                                                            {rec.exclusionReason || "Disqualified"}
                                                        </span>
                                                    )}
                                                </div>
                                                {rec.checkedInAt && (
                                                    <div className="text-[10px] text-neutral-400 mt-0.5 font-mono">
                                                        {new Date(rec.checkedInAt).toLocaleTimeString([], {
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </div>
                                                )}
                                            </td>

                                            {/* Award Position / Custom Role */}
                                            <td className="p-3" onClick={(e) => e.stopPropagation()}>
                                                {onUpdateCustomPosition ? (
                                                    <input
                                                        type="text"
                                                        defaultValue={rec.customPosition || rec.role || ""}
                                                        onBlur={(e) => onUpdateCustomPosition(rec.id, e.target.value)}
                                                        placeholder="Custom position..."
                                                        className="px-2 py-1 rounded-lg border-2 border-black/20 focus:border-black text-xs font-bold bg-white w-full max-w-[140px]"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-bold text-neutral-700">
                                                        {rec.customPosition || rec.role || "—"}
                                                    </span>
                                                )}
                                            </td>

                                            {/* Status Badges */}
                                            <td className="p-3 text-right">
                                                <div className="flex flex-col items-end gap-1">
                                                    {rec.alreadyHasCert ? (
                                                        <span className="text-[9px] font-black bg-amber-200 border border-black/30 px-2 py-0.5 rounded">
                                                            Already Issued
                                                        </span>
                                                    ) : isEligible ? (
                                                        <span className="text-[9px] font-black bg-emerald-100 text-emerald-900 border border-emerald-300 px-2 py-0.5 rounded">
                                                            Eligible
                                                        </span>
                                                    ) : (
                                                        <span className="text-[9px] font-black bg-neutral-200 text-neutral-700 border border-neutral-300 px-2 py-0.5 rounded">
                                                            Ineligible
                                                        </span>
                                                    )}

                                                    {isDuplicate && (
                                                        <span className="text-[9px] font-black bg-amber-100 text-amber-900 border border-amber-300 px-1.5 py-0.2 rounded">
                                                            Duplicate
                                                        </span>
                                                    )}

                                                    {isMissingInfo && (
                                                        <span className="text-[9px] font-black bg-rose-100 text-rose-900 border border-rose-300 px-1.5 py-0.2 rounded flex items-center gap-1">
                                                            <AlertCircle className="w-2.5 h-2.5" /> Missing Info
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Footer */}
                <div className="p-3.5 bg-[#FAF6EE] border-t-3 border-black flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold">
                    <div className="flex items-center gap-2">
                        <span className="text-neutral-600">
                            Showing {filteredRecipients.length > 0 ? startIndex + 1 : 0} to{" "}
                            {Math.min(startIndex + pageSize, filteredRecipients.length)} of {filteredRecipients.length} recipients
                        </span>
                        {selectedIds.size > 0 && (
                            <span className="px-2 py-0.5 rounded bg-[#a2ff86] border border-black font-black text-[10px]">
                                {selectedIds.size} Selected Total
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-neutral-500">Per page:</span>
                            {[10, 25, 50, 100].map((sz) => (
                                <button
                                    key={sz}
                                    type="button"
                                    onClick={() => {
                                        setPageSize(sz);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-2 py-0.5 rounded border text-[11px] font-black cursor-pointer ${
                                        pageSize === sz
                                            ? "bg-black text-[#FFE566] border-black"
                                            : "bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-100"
                                    }`}
                                >
                                    {sz}
                                </button>
                            ))}
                        </div>

                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                disabled={safeCurrentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                className="p-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <span className="px-2 font-black text-xs">
                                Page {safeCurrentPage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                disabled={safeCurrentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                                className="p-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
