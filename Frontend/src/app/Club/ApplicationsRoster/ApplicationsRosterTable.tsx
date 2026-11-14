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
} from "lucide-react";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import type {
    TableColumnDefinition,
    ColumnFilterRule,
    SortState,
    DynamicQuestionMeta,
} from "./types";
import { ColumnFilterPopover } from "./ColumnFilterPopover";
import { ApplicationDetailModal } from "./ApplicationDetailModal";

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
}

export const ApplicationsRosterTable: React.FC<ApplicationsRosterTableProps> = ({
    applications,
    dynamicQuestions,
    sort,
    onToggleSort,
    columnFilters,
    onSetColumnFilter,
    onStatusChange,
    updatingApplicantId,
}) => {
    // Detail Inspection Modal State
    const [selectedApplicant, setSelectedApplicant] = useState<ClubEventApplicantRow | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Active column filter popover state
    const [openFilterColumnId, setOpenFilterColumnId] = useState<string | null>(null);

    const handleOpenDetail = (app: ClubEventApplicantRow) => {
        setSelectedApplicant(app);
        setIsDetailModalOpen(true);
    };

    // Keep selected applicant up-to-date with roster changes
    const activeSelectedApplicant = useMemo(() => {
        if (!selectedApplicant) return null;
        return applications.find((a) => a.id === selectedApplicant.id) || selectedApplicant;
    }, [applications, selectedApplicant]);

    // Build the ordered table column definitions
    const columns: TableColumnDefinition[] = useMemo(() => {
        // Group A: Review & Action (Sticky Column 1)
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
            stickyOffset: 0,
        };

        // Group B: Status (Sticky Column 2)
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
            stickyOffset: 190,
        };

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

        return [colAction, colStatus, ...groupCColumns, ...groupDColumns, colTimestamp];
    }, [dynamicQuestions]);

    const renderCellContent = (app: ClubEventApplicantRow, col: TableColumnDefinition) => {
        // GROUP A: REVIEW & ACTION (Sticky Left 0)
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
            <div className="overflow-x-auto relative">
                <table className="w-full text-left text-xs border-collapse">
                    <thead>
                        <tr className="bg-[#FAF6EE] border-b-2 border-black text-[11px] font-black uppercase text-neutral-700 tracking-wider">
                            {columns.map((col) => {
                                const isAction = col.id === "action";
                                const isStatus = col.id === "status";
                                const isSorted = sort?.columnId === col.id;
                                const hasRule = !!columnFilters[col.id];

                                const stickyStyle: React.CSSProperties = isAction
                                    ? { position: "sticky", left: 0, zIndex: 30 }
                                    : isStatus
                                        ? { position: "sticky", left: 190, zIndex: 30 }
                                        : {};

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
                            applications.map((app) => (
                                <tr
                                    key={app.id}
                                    className="group hover:bg-neutral-50/90 transition-colors"
                                >
                                    {columns.map((col) => {
                                        const isAction = col.id === "action";
                                        const isStatus = col.id === "status";
                                        const stickyStyle: React.CSSProperties = isAction
                                            ? { position: "sticky", left: 0, zIndex: 10 }
                                            : isStatus
                                                ? { position: "sticky", left: 190, zIndex: 10 }
                                                : {};

                                        return (
                                            <td
                                                key={col.id}
                                                style={stickyStyle}
                                                className={`py-3 px-3.5 bg-white group-hover:bg-neutral-50 transition-colors ${col.minWidth || "min-w-[140px]"
                                                    } ${col.width || ""} ${isStatus
                                                        ? "border-r-2 border-black shadow-[3px_0px_0px_rgba(0,0,0,0.06)]"
                                                        : ""
                                                    }`}
                                            >
                                                {renderCellContent(app, col)}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Application Detail / Inspection Modal */}
            <ApplicationDetailModal
                applicant={activeSelectedApplicant}
                dynamicQuestions={dynamicQuestions}
                isOpen={isDetailModalOpen}
                onClose={() => setIsDetailModalOpen(false)}
                onStatusChange={onStatusChange}
                isUpdating={updatingApplicantId === activeSelectedApplicant?.id}
            />
        </>
    );
};
