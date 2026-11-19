import React, { useState, useMemo } from "react";
import {
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Filter,
    Check,
    CheckCircle2,
    XCircle,
    Eye,
    ExternalLink,
    Paperclip,
    Users,
    X,
    AlertCircle,
} from "lucide-react";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import { batchUpdateApplicantStatus } from "../../../api/collegeEventsApi";
import type {
    TableColumnDefinition,
    ColumnFilterRule,
    SortState,
    DynamicQuestionMeta,
} from "./types";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { ApplicationDetailModal } from "./ApplicationDetailModal";
import { BatchActionModal } from "./BatchActionModal";
import { useToast } from "../../../context/ToastContext";

interface ApplicationsRosterTableProps {
    applications: ClubEventApplicantRow[];
    dynamicQuestions: DynamicQuestionMeta[];
    sort: SortState | null;
    onToggleSort: (columnId: string) => void;
    columnFilters: Record<string, ColumnFilterRule>;
    onSetColumnFilter: (columnId: string, rule: ColumnFilterRule | null) => void;
    onStatusChange: (
        applicant: ClubEventApplicantRow,
        status: "pending" | "registered" | "attended" | "waitlisted" | "rejected" | "cancelled"
    ) => Promise<void>;
    updatingApplicantId: string | null;
    eventId?: string;
    isTeamEvent?: boolean;
    minTeamSize?: number;
    maxTeamSize?: number;
    onBatchStatusChange?: (
        applicants: ClubEventApplicantRow[],
        status: "registered" | "rejected",
        reviewNotes?: string
    ) => Promise<void>;
}

export const ApplicationsRosterTable: React.FC<ApplicationsRosterTableProps> = ({
    applications: rawApplications,
    dynamicQuestions,
    sort,
    onToggleSort,
    columnFilters,
    onSetColumnFilter,
    onStatusChange,
    updatingApplicantId,
    eventId,
    isTeamEvent,
    minTeamSize,
    maxTeamSize,
    onBatchStatusChange,
}) => {
    const toast = useToast();

    // Defense-in-depth: Deduplicate applications by teamId so each squad only has one canonical row
    const applications = useMemo(() => {
        const seenTeams = new Set<string>();
        return rawApplications.filter((app) => {
            if (!app.teamId) return true;
            if (seenTeams.has(app.teamId)) return false;
            seenTeams.add(app.teamId);
            return true;
        });
    }, [rawApplications]);

    // Detail Inspection Modal State
    const [selectedApplicant, setSelectedApplicant] = useState<ClubEventApplicantRow | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Active column filter popover state
    const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null);

    // Multi-Selection State for Bulk Actions
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [batchModalAction, setBatchModalAction] = useState<"registered" | "rejected" | null>(null);
    const [isBatchModalOpen, setIsBatchModalOpen] = useState(false);
    const [isBatchUpdating, setIsBatchUpdating] = useState(false);

    const handleOpenDetail = (app: ClubEventApplicantRow) => {
        setSelectedApplicant(app);
        setIsDetailModalOpen(true);
    };

    // Keep selected applicant up-to-date with roster changes
    const activeSelectedApplicant = useMemo(() => {
        if (!selectedApplicant) return null;
        return applications.find((a) => a.id === selectedApplicant.id) || selectedApplicant;
    }, [applications, selectedApplicant]);

    // Selected applicants & counts by status
    const selectedApplicants = useMemo(() => {
        return applications.filter((a) => selectedIds.has(a.id));
    }, [applications, selectedIds]);

    const selectedCounts = useMemo(() => {
        let pending = 0;
        let accepted = 0;
        let rejected = 0;
        let other = 0;
        for (const a of selectedApplicants) {
            if (a.status === "pending") pending++;
            else if (a.status === "registered" || a.status === "attended") accepted++;
            else if (a.status === "rejected") rejected++;
            else other++;
        }
        return {
            total: selectedApplicants.length,
            pending,
            accepted,
            rejected,
            other,
        };
    }, [selectedApplicants]);

    // Quick select lists from current visible applications
    const pendingApps = useMemo(() => applications.filter((a) => a.status === "pending"), [applications]);
    const acceptedApps = useMemo(
        () => applications.filter((a) => a.status === "registered" || a.status === "attended"),
        [applications]
    );
    const rejectedApps = useMemo(() => applications.filter((a) => a.status === "rejected"), [applications]);

    // Core validation rule requested:
    // "option of accept and reject both arises for the set of rows only when it is valid for all
    //  if the no. of rows are already accepted all make it reject all
    //  and if all rejected make all accepted"
    const canAcceptAll = selectedCounts.total > 0 && selectedCounts.accepted === 0;
    const canRejectAll = selectedCounts.total > 0 && selectedCounts.rejected === 0;

    const handleToggleSelectRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedIds.size === applications.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(applications.map((a) => a.id)));
        }
    };

    const handleSelectAll = () => {
        setSelectedIds(new Set(applications.map((a) => a.id)));
    };

    const handleSelectByStatus = (status: "pending" | "registered" | "rejected") => {
        const matches = applications.filter((a) =>
            status === "registered" ? a.status === "registered" || a.status === "attended" : a.status === status
        );
        setSelectedIds(new Set(matches.map((a) => a.id)));
    };

    const handleClearSelection = () => {
        setSelectedIds(new Set());
    };

    const handleOpenBatchModal = (action: "registered" | "rejected") => {
        setBatchModalAction(action);
        setIsBatchModalOpen(true);
    };

    const handleConfirmBatchAction = async (reviewNotes?: string) => {
        if (!batchModalAction || selectedApplicants.length === 0) return;
        try {
            setIsBatchUpdating(true);
            if (onBatchStatusChange) {
                await onBatchStatusChange(selectedApplicants, batchModalAction, reviewNotes);
            } else if (eventId) {
                await batchUpdateApplicantStatus(
                    eventId,
                    selectedApplicants.map((a) => a.id),
                    batchModalAction,
                    reviewNotes
                );
                // Also trigger individual state sync
                for (const app of selectedApplicants) {
                    await onStatusChange(app, batchModalAction);
                }
            } else {
                for (const app of selectedApplicants) {
                    await onStatusChange(app, batchModalAction);
                }
            }
            setSelectedIds(new Set());
            setIsBatchModalOpen(false);
            setBatchModalAction(null);
        } catch (err: any) {
            console.error("Batch update failed:", err);
            toast.error(err?.message || "Failed to batch update applicants.");
        } finally {
            setIsBatchUpdating(false);
        }
    };

    // Build the ordered table column definitions
    const columns: TableColumnDefinition[] = useMemo(() => {
        // Group 0: Row Selection Checkbox (Sticky Left 0)
        const colSelect: TableColumnDefinition = {
            id: "select",
            label: "",
            group: "select",
            type: "select",
            width: "w-[48px]",
            minWidth: "min-w-[48px]",
            sortable: false,
            filterable: false,
            sticky: "left",
            stickyOffset: 0,
        };

        // Group A: Review & Action (Sticky Column 1, Left 48)
        const colAction: TableColumnDefinition = {
            id: "action",
            label: "REVIEW & ACTION",
            group: "action",
            type: "action",
            width: "w-[190px]",
            minWidth: "min-w-[190px]",
            sortable: false,
            filterable: false,
            sticky: "left",
            stickyOffset: 48,
        };

        // Group B: Status (Sticky Column 2, Left 238)
        const colStatus: TableColumnDefinition = {
            id: "status",
            label: "STATUS",
            group: "status",
            type: "status",
            width: "w-[150px]",
            minWidth: "min-w-[150px]",
            sortable: true,
            filterable: true,
            options: ["Pending", "Accepted", "Checked-In", "Rejected", "Waitlisted"],
            sticky: "left",
            stickyOffset: 238,
        };

        // Determine if this is a team event or if any registration has team metadata
        const hasTeamData = Boolean(
            isTeamEvent ||
            applications.some((a) => a.teamId || a.teamName || (a.answers && (a.answers.__teamName || a.answers.__stagedTeammates)))
        );

        // Group B2: Team Readiness / Status (only for team events / registrations)
        const colTeamReadiness: TableColumnDefinition[] = hasTeamData
            ? [
                  {
                      id: "teamReadiness",
                      label: "TEAM READINESS",
                      group: "status",
                      type: "status",
                      options: ["Ready", "Incomplete"],
                      minWidth: "min-w-[170px]",
                      sortable: true,
                      filterable: true,
                  },
              ]
            : [];

        // Group C: Student Personal Information (Exact sequence)
        const groupCColumns: TableColumnDefinition[] = [
            {
                id: "applicantName",
                label: "STUDENT NAME",
                group: "personal",
                type: "text",
                minWidth: "min-w-[200px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "username",
                label: "USERNAME",
                group: "personal",
                type: "text",
                minWidth: "min-w-[130px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "applicantEmail",
                label: "EMAIL ADDRESS",
                group: "personal",
                type: "text",
                minWidth: "min-w-[190px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "phoneNumber",
                label: "PHONE NUMBER",
                group: "personal",
                type: "text",
                minWidth: "min-w-[130px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "institutionName",
                label: "INSTITUTION / COLLEGE",
                group: "personal",
                type: "text",
                minWidth: "min-w-[210px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "institutionCity",
                label: "CITY",
                group: "personal",
                type: "text",
                minWidth: "min-w-[120px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "institutionState",
                label: "STATE",
                group: "personal",
                type: "text",
                minWidth: "min-w-[120px]",
                sortable: true,
                filterable: true,
            },
            {
                id: "rollNumber",
                label: "ROLL / ID & DEPT",
                group: "personal",
                type: "text",
                minWidth: "min-w-[160px]",
                sortable: true,
                filterable: true,
            },
        ];

        // Group D: Complete Registration Form Responses
        const groupDColumns: TableColumnDefinition[] = dynamicQuestions.map((q) => {
            const isFile = q.type === "file_upload" || q.type === "file";
            const isChoice =
                q.type === "dropdown" ||
                q.type === "single_choice" ||
                q.type === "multiple_choice" ||
                q.type === "checkbox" ||
                q.type === "select";

            return {
                id: q.id,
                label: q.label,
                group: "response",
                type: isFile ? "file" : isChoice ? "select" : "text",
                minWidth: "min-w-[160px]",
                options: q.options,
                sortable: true,
                filterable: true,
                questionMeta: q,
            };
        });

        // Group E: Registration Timestamp (MUST ALWAYS BE THE FINAL COLUMN)
        const colTimestamp: TableColumnDefinition = {
            id: "registeredAt",
            label: "REGISTERED AT",
            group: "timestamp",
            type: "date",
            minWidth: "min-w-[150px]",
            sortable: true,
            filterable: false,
        };

        return [colSelect, colAction, colStatus, ...colTeamReadiness, ...groupCColumns, ...groupDColumns, colTimestamp];
    }, [dynamicQuestions, isTeamEvent, applications]);

    const renderCellContent = (app: ClubEventApplicantRow, col: TableColumnDefinition) => {
        // GROUP 0: SELECTION CHECKBOX (Sticky Left 0)
        if (col.id === "select") {
            const isSelected = selectedIds.has(app.id);
            return (
                <div
                    className="flex items-center justify-center py-1"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectRow(app.id)}
                        className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer shadow-[1px_1px_0px_#000]"
                        aria-label={`Select ${app.applicantName}`}
                    />
                </div>
            );
        }

        // GROUP A: REVIEW & ACTION (Sticky Left 48)
        if (col.id === "action") {
            const isRowUpdating = updatingApplicantId === app.id;
            return (
                <div className="flex items-center gap-1.5 justify-start">
                    {/* Inspect View Details Button */}
                    <button
                        type="button"
                        onClick={() => handleOpenDetail(app)}
                        className="p-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 hover:text-black border border-black/40 shadow-[1px_1px_0px_#000] cursor-pointer"
                        title="View Full Application & Responses"
                    >
                        <Eye className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Pending Actions */}
                    {app.status === "pending" && (
                        <>
                            <button
                                type="button"
                                disabled={isRowUpdating}
                                onClick={() => onStatusChange(app, "registered")}
                                className="px-2 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                title="Accept application"
                            >
                                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                <span>Accept</span>
                            </button>
                            <button
                                type="button"
                                disabled={isRowUpdating}
                                onClick={() => onStatusChange(app, "rejected")}
                                className="px-1.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-black text-[11px] border border-rose-800 shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-0.5 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                title="Reject application"
                            >
                                <XCircle className="w-3 h-3 stroke-[2.5]" />
                                <span>Reject</span>
                            </button>
                        </>
                    )}

                    {/* Accepted Actions */}
                    {app.status === "registered" && (
                        <>
                            <button
                                type="button"
                                disabled={isRowUpdating}
                                onClick={() => onStatusChange(app, "attended")}
                                className="px-2 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-[11px] border border-black shadow-[1px_1px_0px_#000] cursor-pointer inline-flex items-center gap-1 active:translate-x-[0.5px] active:translate-y-[0.5px]"
                                title="Check in attendee at session entrance"
                            >
                                <CheckCircle2 className="w-3 h-3 stroke-[2.5]" />
                                <span>Arrived</span>
                            </button>
                            <button
                                type="button"
                                disabled={isRowUpdating}
                                onClick={() => onStatusChange(app, "rejected")}
                                className="px-1.5 py-1 rounded-lg bg-neutral-100 hover:bg-rose-50 text-neutral-600 hover:text-rose-700 font-bold text-[10px] border border-black/40 cursor-pointer inline-flex items-center gap-0.5"
                                title="Revoke and reject application"
                            >
                                <XCircle className="w-3 h-3" />
                                <span>Revoke</span>
                            </button>
                        </>
                    )}

                    {/* Attended Actions */}
                    {app.status === "attended" && (
                        <button
                            type="button"
                            disabled={isRowUpdating}
                            onClick={() => onStatusChange(app, "registered")}
                            className="px-2 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-[11px] border border-black cursor-pointer inline-flex items-center gap-1"
                            title="Undo Arrived status"
                        >
                            <span>Undo</span>
                        </button>
                    )}

                    {/* Rejected Actions */}
                    {app.status === "rejected" && (
                        <button
                            type="button"
                            disabled={isRowUpdating}
                            onClick={() => onStatusChange(app, "registered")}
                            className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-[11px] border border-emerald-800 cursor-pointer inline-flex items-center gap-1"
                            title="Re-accept application"
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Re-Accept</span>
                        </button>
                    )}
                </div>
            );
        }

        // GROUP B: STATUS (Sticky Left 190)
        if (col.id === "status") {
            const badgeClasses =
                app.status === "attended"
                    ? "bg-sky-100 text-sky-950 border-sky-800"
                    : app.status === "registered"
                        ? "bg-emerald-100 text-emerald-950 border-emerald-800"
                        : app.status === "pending"
                            ? "bg-amber-100 text-amber-950 border-amber-800"
                            : app.status === "waitlisted"
                                ? "bg-amber-100 text-amber-950 border-amber-800"
                                : "bg-rose-100 text-rose-950 border-rose-800";

            const label =
                app.status === "registered"
                    ? "Accepted "
                    : app.status === "pending"
                        ? "Pending "
                        : app.status === "attended"
                            ? "Checked-In"
                            : app.status === "rejected"
                                ? "Rejected"
                                : app.status;

            return (
                <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-[1px_1px_0px_#000] inline-block ${badgeClasses}`}
                >
                    {label}
                </span>
            );
        }

        // GROUP B2: TEAM READINESS
        if (col.id === "teamReadiness") {
            const teamName = app.teamName || (app.answers && app.answers.__teamName) || (app.formResponse && app.formResponse.__teamName) || "";
            const isTeam = Boolean(app.teamId || teamName);
            if (!isTeam) {
                return <span className="text-neutral-400 font-normal">—</span>;
            }

            const minSize = minTeamSize || (app as any).minTeamSize || 2;
            const maxSize = maxTeamSize || (app as any).maxTeamSize || minSize;
            const confirmedCount = app.teamMembersCount ?? (app.teamMembers ? app.teamMembers.length : 1);
            const pendingCount = app.teamPendingCount ?? (app.teamPendingInvites ? app.teamPendingInvites.length : (Array.isArray(app.answers?.__stagedTeammates) ? app.answers.__stagedTeammates.length : 0));
            const isReady = confirmedCount >= minSize;

            return (
                <div className="flex flex-col gap-0.5 text-left">
                    <div className="flex items-center gap-1.5">
                        <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-[1px_1px_0px_#000] ${
                                isReady
                                    ? "bg-[#a2ff86] text-black border-black"
                                    : "bg-amber-100 text-amber-950 border-amber-600"
                            }`}
                        >
                            {isReady ? (
                                <CheckCircle2 className="w-2.5 h-2.5" />
                            ) : (
                                <AlertCircle className="w-2.5 h-2.5 text-amber-700" />
                            )}
                            <span>{isReady ? `Ready (${confirmedCount}/${maxSize})` : `Incomplete (${confirmedCount}/${minSize})`}</span>
                        </span>
                    </div>
                    {pendingCount > 0 ? (
                        <span className="text-[9px] font-bold text-amber-700 pl-1">
                            +{pendingCount} invite{pendingCount === 1 ? "" : "s"} pending
                        </span>
                    ) : (
                        <span className="text-[9px] font-medium text-neutral-500 pl-1 truncate max-w-[150px]">
                            {teamName ? `Team: ${teamName}` : "Squad confirmed"}
                        </span>
                    )}
                </div>
            );
        }

        // GROUP C: 1. Student Name (Avatar + Name)
        if (col.id === "applicantName") {
            return (
                <div
                    onClick={() => handleOpenDetail(app)}
                    className="flex items-center gap-2 cursor-pointer group/name"
                    title="Click to view full application details"
                >
                    {app.avatarUrl ? (
                        <img
                            src={app.avatarUrl}
                            alt={app.applicantName}
                            className="w-7 h-7 rounded-full border border-black object-cover shrink-0 shadow-[1px_1px_0px_#000]"
                            onError={(e) => {
                                e.currentTarget.style.display = "none";
                                const fallback = e.currentTarget.nextElementSibling;
                                if (fallback) (fallback as HTMLElement).style.display = "flex";
                            }}
                        />
                    ) : null}
                    <div
                        className={`w-7 h-7 rounded-full bg-black text-[#a2ff86] items-center justify-center font-black text-[10px] shrink-0 border border-black shadow-[1px_1px_0px_#000] ${app.avatarUrl ? "hidden" : "flex"
                            }`}
                    >
                        {(app.applicantName || "S").slice(0, 2).toUpperCase()}
                    </div>
                    <span className="font-black text-black group-hover/name:text-indigo-700 group-hover/name:underline truncate">
                        {app.applicantName}
                    </span>
                </div>
            );
        }

        // GROUP C: 2. Username
        if (col.id === "username") {
            if (!app.username) return <span className="text-neutral-400 font-normal">—</span>;
            return (
                <a
                    href={`/profile/${app.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline text-indigo-700 font-bold inline-flex items-center gap-0.5"
                    title={`View @${app.username}'s public profile`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span>@{app.username}</span>
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>
            );
        }

        // GROUP C: 3. Email Address
        if (col.id === "applicantEmail") {
            if (!app.applicantEmail) return <span className="text-neutral-400 font-normal">—</span>;
            return (
                <a
                    href={`mailto:${app.applicantEmail}`}
                    className="text-neutral-800 hover:text-black hover:underline font-medium block truncate max-w-[200px]"
                    title={app.applicantEmail}
                    onClick={(e) => e.stopPropagation()}
                >
                    {app.applicantEmail}
                </a>
            );
        }

        // GROUP C: 4. Phone Number
        if (col.id === "phoneNumber") {
            if (!app.phoneNumber) return <span className="text-neutral-400 font-normal">—</span>;
            return (
                <span className="font-mono text-xs text-neutral-800 font-bold whitespace-nowrap">
                    {app.phoneNumber}
                </span>
            );
        }

        // GROUP C: 5. Institution / College
        if (col.id === "institutionName") {
            const inst = app.institutionName || app.campusName || "Host Campus";
            return (
                <div className="font-bold text-black flex items-center gap-1 max-w-[220px]">
                    <span className="truncate" title={inst}>
                        {inst}
                    </span>
                    {app.institutionVerificationStatus === "verified" && (
                        <span
                            className="inline-flex items-center text-[9px] text-emerald-800 bg-emerald-100 p-0.5 rounded border border-emerald-700 font-black shrink-0"
                            title="AISHE Verified Institution"
                        >
                            <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </span>
                    )}
                </div>
            );
        }

        // GROUP C: 6. City
        if (col.id === "institutionCity") {
            return (
                <span className="text-neutral-700 font-medium truncate block max-w-[120px]" title={app.institutionCity || ""}>
                    {app.institutionCity || <span className="text-neutral-400 font-normal">—</span>}
                </span>
            );
        }

        // GROUP C: 7. State
        if (col.id === "institutionState") {
            return (
                <span className="text-neutral-700 font-medium truncate block max-w-[120px]" title={app.institutionState || ""}>
                    {app.institutionState || <span className="text-neutral-400 font-normal">—</span>}
                </span>
            );
        }

        // GROUP C: 8. Roll / Student ID & Department
        if (col.id === "rollNumber") {
            const ans = { ...(app.answers || {}), ...(app.formResponse || {}) };
            const roll = app.rollNumber || ans["q_roll_number"] || ans["roll_number"];
            const dept = app.department || ans["q_department"] || ans["department"];
            const combined = [roll, dept].filter(Boolean).join(" · ");
            if (!combined) return <span className="text-neutral-400 font-normal">—</span>;
            return (
                <span className="font-medium text-neutral-800 block truncate max-w-[180px]" title={combined}>
                    {combined}
                </span>
            );
        }

        // GROUP E: Registered At (FINAL COLUMN)
        if (col.id === "registeredAt") {
            if (!app.registeredAt) return <span className="text-neutral-400 font-normal">—</span>;
            const d = new Date(app.registeredAt);
            return (
                <span className="text-neutral-600 font-medium whitespace-nowrap text-[11px]">
                    {d.toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                    })}
                </span>
            );
        }

        // GROUP D: Dynamic Registration Form Questions
        // 1. Check file attachments
        if (app.fileAttachments && app.fileAttachments.length > 0) {
            const matched = app.fileAttachments.filter((f) => f.questionId === col.id);
            if (matched.length > 0) {
                return (
                    <div className="flex flex-col gap-1 max-w-[220px]">
                        {matched.map((f, idx) => (
                            <a
                                key={idx}
                                href={f.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700 hover:underline truncate"
                                title={f.fileName || "View Attachment"}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <Paperclip className="w-3 h-3 shrink-0" />
                                <span className="truncate">{f.fileName || "Attachment"}</span>
                            </a>
                        ))}
                    </div>
                );
            }
        }

        // Special live renderer for Teammates & Invites column
        if (col.id === "__stagedTeammates" || col.id === "teamMembers") {
            const liveMembers = app.teamMembers || [];
            const livePending = app.teamPendingInvites || [];
            if (liveMembers.length > 0 || livePending.length > 0) {
                return (
                    <div className="flex flex-col gap-1.5 min-w-[210px] max-w-[320px] py-1 text-left">
                        {liveMembers.map((m, idx) => (
                            <div
                                key={m.userId || idx}
                                className="p-1.5 rounded-xl bg-white border border-black/30 shadow-[1px_1px_0px_#000] space-y-0.5"
                            >
                                <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <span className="font-black text-black text-[11px] truncate">
                                            {m.name || m.username}
                                        </span>
                                        <a
                                            href={`/profile/${m.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[10px] font-mono text-neutral-500 hover:text-black hover:underline truncate"
                                        >
                                            @{m.username}
                                        </a>
                                    </div>
                                    <span className="px-1.5 py-0.2 rounded-md font-black text-[8px] uppercase tracking-wider shrink-0 bg-[#a2ff86] text-black border border-black/40">
                                        {m.role === "leader" ? "Leader" : "Accepted"}
                                    </span>
                                </div>
                                {m.email && (
                                    <div className="text-[10px] font-mono text-neutral-500 truncate" title={m.email}>
                                        {m.email}
                                    </div>
                                )}
                            </div>
                        ))}
                        {livePending.map((inv, idx) => (
                            <div
                                key={inv.invitationId || idx}
                                className="p-1.5 rounded-xl bg-amber-50/70 border border-dashed border-amber-500 shadow-[1px_1px_0px_#000] space-y-0.5"
                            >
                                <div className="flex items-center justify-between gap-1.5">
                                    <div className="flex items-center gap-1 min-w-0">
                                        <span className="font-black text-black text-[11px] truncate">
                                            {inv.name || inv.username}
                                        </span>
                                        <a
                                            href={`/profile/${inv.username}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="text-[10px] font-mono text-neutral-500 hover:text-black hover:underline truncate"
                                        >
                                            @{inv.username}
                                        </a>
                                    </div>
                                    <span className="px-1.5 py-0.2 rounded-md font-black text-[8px] uppercase tracking-wider shrink-0 bg-[#FFE566] text-amber-950 border border-amber-500">
                                        Pending Invite
                                    </span>
                                </div>
                                {inv.email && (
                                    <div className="text-[10px] font-mono text-neutral-500 truncate" title={inv.email}>
                                        {inv.email}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                );
            }
        }

        // 2. Answer values
        const ansObj = { ...(app.answers || {}), ...(app.formResponse || {}) };
        let val = ansObj[col.id];
        if (val === undefined && col.id.startsWith("q_")) {
            val = ansObj[col.id.replace(/^q_/, "")];
        } else if (val === undefined) {
            val = ansObj[`q_${col.id}`];
        }

        if (val === null || val === undefined || val === "") {
            return <span className="text-neutral-400 font-normal">—</span>;
        }

        if (Array.isArray(val)) {
            if (val.length === 0) return <span className="text-neutral-400 font-normal">—</span>;

            const hasObjects = val.some((item) => item && typeof item === "object");
            if (hasObjects) {
                return (
                    <div className="flex flex-col gap-1.5 min-w-[210px] max-w-[320px] py-1 text-left">
                        {val.map((item: any, idx: number) => {
                            if (!item || typeof item !== "object") {
                                return (
                                    <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-black/30 text-[10px] font-bold text-black"
                                    >
                                        {String(item)}
                                    </span>
                                );
                            }

                            const displayName = item.name || item.fullName || item.applicantName || item.username || `Teammate ${idx + 1}`;
                            const userTag = item.username ? `@${String(item.username).replace(/^@/, "")}` : "";
                            const email = item.email || item.applicantEmail || "";
                            const status = String(item.status || "pending").toLowerCase();
                            const isAccepted = status === "accepted" || status === "registered" || status === "leader";
                            const isDeclined = status === "declined" || status === "rejected";

                            return (
                                <div
                                    key={item.id || idx}
                                    className="p-1.5 rounded-xl bg-white border border-black/30 shadow-[1px_1px_0px_#000] space-y-0.5"
                                >
                                    <div className="flex items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-1 min-w-0">
                                            <span className="font-black text-black text-[11px] truncate">{displayName}</span>
                                            {userTag && (
                                                <a
                                                    href={`/profile/${userTag.replace(/^@/, "")}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-[10px] font-mono text-neutral-500 hover:text-black hover:underline truncate"
                                                >
                                                    {userTag}
                                                </a>
                                            )}
                                        </div>
                                        <span
                                            className={`px-1.5 py-0.2 rounded-md font-black text-[8px] uppercase tracking-wider shrink-0 border ${
                                                isAccepted
                                                    ? "bg-[#a2ff86] text-black border-black/40"
                                                    : isDeclined
                                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                                    : "bg-[#FFE566] text-amber-950 border-amber-500"
                                            }`}
                                        >
                                            {isAccepted ? "Accepted" : isDeclined ? "Declined" : "Pending Invite"}
                                        </span>
                                    </div>
                                    {email && (
                                        <div className="text-[10px] font-mono text-neutral-500 truncate" title={email}>
                                            {email}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                );
            }

            return (
                <div className="flex flex-wrap gap-1 max-w-[220px]">
                    {val.map((item, idx) => (
                        <span
                            key={idx}
                            className="px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-black/30 text-[10px] font-bold text-black shadow-[0.5px_0.5px_0px_#000]"
                        >
                            {String(item)}
                        </span>
                    ))}
                </div>
            );
        }

        const strVal = String(val).trim();
        if (!strVal) return <span className="text-neutral-400 font-normal">—</span>;

        if (strVal.startsWith("http://") || strVal.startsWith("https://")) {
            return (
                <a
                    href={strVal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-700 font-bold hover:underline truncate inline-flex items-center gap-1 max-w-[220px]"
                    title={strVal}
                    onClick={(e) => e.stopPropagation()}
                >
                    <span className="truncate">{strVal.replace(/^https?:\/\/(www\.)?/, "")}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                </a>
            );
        }

        return (
            <span
                onClick={() => handleOpenDetail(app)}
                className="font-medium text-neutral-800 block truncate max-w-[220px] cursor-pointer hover:text-indigo-700"
                title={`${strVal} (Click to inspect full response)`}
            >
                {strVal}
            </span>
        );
    };

    return (
        <>
            {/* TOP BULK SELECTION & ACTION TOOLBAR */}
            <div className="p-3 bg-[#FAF6EE] border-b-2 border-black flex flex-wrap items-center justify-between gap-3 select-none">
                {/* Left: Selection Counter & Status Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-black text-[#FFE566] font-black text-xs flex items-center justify-center shadow-[1px_1px_0px_#000]">
                            {selectedCounts.total}
                        </span>
                        <span className="text-xs font-black text-black">
                            {selectedCounts.total === 0
                                ? "No applicants selected"
                                : `${selectedCounts.total} of ${applications.length} selected`}
                        </span>
                    </div>

                    {selectedCounts.total > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap pl-2 border-l-2 border-black/20 text-[10px] font-black uppercase">
                            {selectedCounts.pending > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-800 shadow-[0.5px_0.5px_0px_#000]">
                                    {selectedCounts.pending} Pending
                                </span>
                            )}
                            {selectedCounts.accepted > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-950 border border-emerald-800 shadow-[0.5px_0.5px_0px_#000]">
                                    {selectedCounts.accepted} Accepted
                                </span>
                            )}
                            {selectedCounts.rejected > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-950 border border-rose-800 shadow-[0.5px_0.5px_0px_#000]">
                                    {selectedCounts.rejected} Rejected
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Contextual Bulk Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                    {selectedCounts.total === 0 ? (
                        /* Quick select shortcuts when 0 selected */
                        <div className="flex items-center gap-1.5 text-xs flex-wrap">
                            <span className="text-[11px] font-bold text-neutral-500 mr-1 hidden sm:inline">
                                Quick select:
                            </span>
                            <button
                                type="button"
                                onClick={handleSelectAll}
                                className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-neutral-100 font-bold text-[11px] shadow-[1px_1px_0px_#000] cursor-pointer"
                            >
                                All ({applications.length})
                            </button>
                            {pendingApps.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectByStatus("pending")}
                                    className="px-2.5 py-1 rounded-lg border border-amber-800 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] shadow-[1px_1px_0px_#000] cursor-pointer"
                                >
                                    Pending ({pendingApps.length})
                                </button>
                            )}
                            {acceptedApps.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectByStatus("registered")}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-800 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold text-[11px] shadow-[1px_1px_0px_#000] cursor-pointer"
                                >
                                    Accepted ({acceptedApps.length})
                                </button>
                            )}
                            {rejectedApps.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => handleSelectByStatus("rejected")}
                                    className="px-2.5 py-1 rounded-lg border border-rose-800 bg-rose-100 hover:bg-rose-200 text-rose-950 font-bold text-[11px] shadow-[1px_1px_0px_#000] cursor-pointer"
                                >
                                    Rejected ({rejectedApps.length})
                                </button>
                            )}
                        </div>
                    ) : (
                        /* Active Batch Actions */
                        <div className="flex items-center gap-2 flex-wrap">
                            {/* Accept All: Arises when valid for all selected (e.g. all pending or all rejected) */}
                            {canAcceptAll && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenBatchModal("registered")}
                                    disabled={isBatchUpdating}
                                    className="px-3 py-1.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all"
                                    title={`Accept all ${selectedCounts.total} selected applicants`}
                                >
                                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Accept All ({selectedCounts.total})</span>
                                </button>
                            )}

                            {/* Reject All: Arises when valid for all selected (e.g. all pending or all accepted) */}
                            {canRejectAll && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenBatchModal("rejected")}
                                    disabled={isBatchUpdating}
                                    className="px-3 py-1.5 rounded-xl bg-[#ffb4b4] hover:bg-rose-200 text-rose-950 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-all"
                                    title={`Reject all ${selectedCounts.total} selected applicants`}
                                >
                                    <XCircle className="w-4 h-4 stroke-[2.5]" />
                                    <span>Reject All ({selectedCounts.total})</span>
                                </button>
                            )}

                            {/* Incompatible mixed selection message */}
                            {!canAcceptAll && !canRejectAll && (
                                <span className="text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-lg border border-rose-400">
                                    Selection has both Accepted and Rejected applicants. Choose a uniform group to proceed.
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-neutral-700 hover:text-black font-bold text-xs border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                            >
                                Deselect All
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-[#FAF6EE] border-b-2 border-black text-[11px] font-black uppercase text-neutral-700 tracking-wider">
                            {columns.map((col) => {
                                const isSelect = col.id === "select";
                                const isAction = col.id === "action";
                                const isStatus = col.id === "status";
                                const isSorted = sort?.columnId === col.id;
                                const hasRule = !!columnFilters[col.id];

                                const stickyStyle: React.CSSProperties = isSelect
                                    ? { position: "sticky", left: 0, zIndex: 30 }
                                    : isAction
                                        ? { position: "sticky", left: 48, zIndex: 30 }
                                        : isStatus
                                            ? { position: "sticky", left: 238, zIndex: 30 }
                                            : {};

                                if (isSelect) {
                                    const isAllSelected = applications.length > 0 && selectedIds.size === applications.length;
                                    const isSomeSelected = selectedIds.size > 0 && selectedIds.size < applications.length;

                                    return (
                                        <th
                                            key={col.id}
                                            style={stickyStyle}
                                            className="py-3 px-2 bg-[#FAF6EE] select-none text-center w-[48px] min-w-[48px]"
                                        >
                                            <div className="flex items-center justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={isAllSelected}
                                                    ref={(el) => {
                                                        if (el) el.indeterminate = isSomeSelected;
                                                    }}
                                                    onChange={handleToggleSelectAll}
                                                    className="w-4 h-4 rounded border-2 border-black accent-black cursor-pointer shadow-[1px_1px_0px_#000]"
                                                    title={isAllSelected ? "Deselect all" : "Select all"}
                                                    aria-label="Select all applicants"
                                                />
                                            </div>
                                        </th>
                                    );
                                }

                                return (
                                    <th
                                        key={col.id}
                                        style={stickyStyle}
                                        className={`py-3 px-3.5 bg-[#FAF6EE] select-none relative ${col.minWidth || "min-w-[140px]"
                                            } ${col.width || ""} ${isStatus ? "border-r-2 border-black shadow-[3px_0px_0px_rgba(0,0,0,0.06)]" : ""
                                            }`}
                                    >
                                        <div className="flex items-center justify-between gap-1">
                                            {/* Column Header Label & Sort Toggle */}
                                            {col.sortable ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onToggleSort(col.id)}
                                                    className="flex items-center gap-1 text-black hover:text-indigo-700 font-black cursor-pointer truncate"
                                                    title={`Sort by ${col.label}`}
                                                >
                                                    <span className="truncate">{col.label}</span>
                                                    {isSorted ? (
                                                        sort.direction === "asc" ? (
                                                            <ArrowUp className="w-3.5 h-3.5 text-black stroke-[3] shrink-0" />
                                                        ) : (
                                                            <ArrowDown className="w-3.5 h-3.5 text-black stroke-[3] shrink-0" />
                                                        )
                                                    ) : (
                                                        <ArrowUpDown className="w-3.5 h-3.5 text-black stroke-[2.5] opacity-90 hover:opacity-100 shrink-0 transition-opacity" />
                                                    )}
                                                </button>
                                            ) : (
                                                <span className="font-black text-black truncate">{col.label}</span>
                                            )}

                                            {/* Column Filter Popover Trigger */}
                                            {col.filterable && (
                                                <div className="relative shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenFilterColumnId(
                                                                openFilterColumnId === col.id ? null : col.id
                                                            );
                                                        }}
                                                        className={`p-1 rounded-md border transition-all cursor-pointer ${hasRule
                                                            ? "bg-[#FFE566] text-black border-black shadow-[1px_1px_0px_#000]"
                                                            : "border-black/30 text-black bg-black/[0.04] hover:bg-black/10 hover:border-black"
                                                            }`}
                                                        title={`Filter by ${col.label}`}
                                                    >
                                                        <Filter className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                    </button>

                                                    {openFilterColumnId === col.id && (
                                                        <ColumnFilterPopover
                                                            column={col}
                                                            activeRule={columnFilters[col.id]}
                                                            onApply={(rule) => onSetColumnFilter(col.id, rule)}
                                                            onClear={() => onSetColumnFilter(col.id, null)}
                                                            onClose={() => setOpenFilterColumnId(null)}
                                                        />
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-black/10">
                        {applications.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="py-12 text-center">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <Users className="w-8 h-8 text-neutral-400" />
                                        <span className="text-sm font-black text-black">
                                            No matching applicants found
                                        </span>
                                        <span className="text-xs text-neutral-500">
                                            Try adjusting your search terms or active column filters.
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            applications.map((app) => {
                                const isRowSelected = selectedIds.has(app.id);

                                return (
                                    <tr
                                        key={app.id}
                                        className={`group transition-colors ${
                                            isRowSelected
                                                ? "bg-[#FFF9E6] hover:bg-[#FFF3CC]"
                                                : "hover:bg-neutral-50/90"
                                        }`}
                                    >
                                        {columns.map((col) => {
                                            const isSelect = col.id === "select";
                                            const isAction = col.id === "action";
                                            const isStatus = col.id === "status";
                                            const stickyStyle: React.CSSProperties = isSelect
                                                ? { position: "sticky", left: 0, zIndex: 10 }
                                                : isAction
                                                    ? { position: "sticky", left: 48, zIndex: 10 }
                                                    : isStatus
                                                        ? { position: "sticky", left: 238, zIndex: 10 }
                                                        : {};

                                            return (
                                                <td
                                                    key={col.id}
                                                    style={stickyStyle}
                                                    className={`py-3 px-3.5 transition-colors ${
                                                        isRowSelected
                                                            ? "bg-[#FFF9E6] group-hover:bg-[#FFF3CC]"
                                                            : "bg-white group-hover:bg-neutral-50"
                                                    } ${col.minWidth || "min-w-[140px]"} ${col.width || ""} ${
                                                        isStatus
                                                            ? "border-r-2 border-black shadow-[3px_0px_0px_rgba(0,0,0,0.06)]"
                                                            : ""
                                                    }`}
                                                >
                                                    {renderCellContent(app, col)}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* FLOATING BOTTOM ACTION DOCK (Visible on Scroll when Items are Selected) */}
            {selectedCounts.total > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw] sm:max-w-xl w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="p-3 sm:p-3.5 bg-[#FAF6EE] border-3 border-black shadow-[6px_6px_0px_#000] rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-xl bg-black text-[#FFE566] font-black text-xs flex items-center justify-center shadow-[1px_1px_0px_#000] shrink-0">
                                {selectedCounts.total}
                            </span>
                            <div className="min-w-0">
                                <span className="font-black text-xs text-black block truncate">
                                    {selectedCounts.total} Applicant{selectedCounts.total > 1 ? "s" : ""} Selected
                                </span>
                                <span className="text-[10px] text-neutral-600 font-bold truncate block">
                                    {selectedCounts.pending > 0 && `${selectedCounts.pending} Pending `}
                                    {selectedCounts.accepted > 0 && `${selectedCounts.accepted} Accepted `}
                                    {selectedCounts.rejected > 0 && `${selectedCounts.rejected} Rejected`}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {canAcceptAll && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenBatchModal("registered")}
                                    disabled={isBatchUpdating}
                                    className="px-3 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                                    <span>Accept All ({selectedCounts.total})</span>
                                </button>
                            )}

                            {canRejectAll && (
                                <button
                                    type="button"
                                    onClick={() => handleOpenBatchModal("rejected")}
                                    disabled={isBatchUpdating}
                                    className="px-3 py-2 rounded-xl bg-[#ffb4b4] hover:bg-rose-200 text-rose-950 font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <XCircle className="w-4 h-4 stroke-[2.5]" />
                                    <span>Reject All ({selectedCounts.total})</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleClearSelection}
                                className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border border-black shadow-[1px_1px_0px_#000] cursor-pointer"
                                title="Clear selection"
                                aria-label="Clear selection"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Application Detail / Inspection Modal */}
            <ApplicationDetailModal
                applicant={activeSelectedApplicant}
                dynamicQuestions={dynamicQuestions}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                onStatusChange={onStatusChange}
                isUpdating={updatingApplicantId === activeSelectedApplicant?.id}
            />

            {/* Batch Action Confirmation Modal */}
            <BatchActionModal
                isOpen={isBatchModalOpen}
                onClose={() => {
                    setIsBatchModalOpen(false);
                    setBatchModalAction(null);
                }}
                actionType={batchModalAction}
                selectedApplicants={selectedApplicants}
                onConfirm={handleConfirmBatchAction}
                isUpdating={isBatchUpdating}
            />
        </>
    );
};
