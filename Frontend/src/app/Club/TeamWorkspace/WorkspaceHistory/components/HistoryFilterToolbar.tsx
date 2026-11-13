// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryFilterToolbar.tsx
import React from "react";
import { Filter, Search, X, Shield, Activity } from "lucide-react";
import { NeoSelect, type NeoSelectOption } from "../../../../../components/NeoSelect";
import type {
    WorkspaceDepartment,
    WorkspaceHistoryRecordType,
    WorkspaceHistoryScope,
    WorkspaceMember,
} from "../../../../../types/workspace";
import {
    HISTORY_CATEGORY_OPTIONS,
    HISTORY_TARGET_OPTIONS,
} from "../utils/historyEventRegistry";

interface HistoryFilterToolbarProps {
    scope: WorkspaceHistoryScope;
    recordType: WorkspaceHistoryRecordType;
    category: string;
    departmentId: string;
    actorId: string;
    targetType: string;
    searchInput: string;
    startDate: string;
    endDate: string;
    canViewAudit: boolean;
    hasActiveFilters: boolean;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    onRecordTypeChange: (value: WorkspaceHistoryRecordType) => void;
    onCategoryChange: (value: string) => void;
    onDepartmentChange: (value: string) => void;
    onActorChange: (value: string) => void;
    onTargetTypeChange: (value: string) => void;
    onSearchChange: (value: string) => void;
    onStartDateChange: (value: string) => void;
    onEndDateChange: (value: string) => void;
    onReset: () => void;
}

export const HistoryFilterToolbar: React.FC<HistoryFilterToolbarProps> = ({
    scope,
    recordType,
    category,
    departmentId,
    actorId,
    targetType,
    searchInput,
    startDate,
    endDate,
    canViewAudit,
    hasActiveFilters,
    departments,
    members,
    onRecordTypeChange,
    onCategoryChange,
    onDepartmentChange,
    onActorChange,
    onTargetTypeChange,
    onSearchChange,
    onStartDateChange,
    onEndDateChange,
    onReset,
}) => {
    const departmentOptions: NeoSelectOption[] = [
        { value: "", label: "All Departments" },
        ...departments.map((d) => ({ value: d.id, label: d.name })),
    ];

    const actorOptions: NeoSelectOption[] = [
        { value: "", label: "All Actors" },
        ...members.map((m) => ({
            value: m.userId,
            label:
                `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() ||
                m.user?.username ||
                "Unknown Member",
        })),
    ];

    return (
        <div className="bg-white border-2 border-black rounded-2xl p-3.5 shadow-[2px_2px_0px_#000] space-y-3">
            {/* Top row: Record Type pills + Search + Reset */}
            <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 mr-1">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Stream:</span>
                </div>

                <div className="inline-flex rounded-lg border-2 border-black overflow-hidden bg-[#FAF6EE]">
                    <button
                        type="button"
                        onClick={() => onRecordTypeChange("all")}
                        className={`px-3 py-1 text-[11px] font-black transition ${
                            recordType === "all"
                                ? "bg-black text-white"
                                : "text-black hover:bg-neutral-200/70"
                        }`}
                    >
                        All Events
                    </button>
                    <button
                        type="button"
                        onClick={() => onRecordTypeChange("activity")}
                        className={`px-3 py-1 text-[11px] font-black border-l-2 border-black flex items-center gap-1 transition ${
                            recordType === "activity"
                                ? "bg-[#A6FF70] text-black"
                                : "text-black hover:bg-neutral-200/70"
                        }`}
                    >
                        <Activity className="w-3 h-3" />
                        <span>Operational</span>
                    </button>
                    {canViewAudit && (
                        <button
                            type="button"
                            onClick={() => onRecordTypeChange("audit")}
                            className={`px-3 py-1 text-[11px] font-black border-l-2 border-black flex items-center gap-1 transition ${
                                recordType === "audit"
                                    ? "bg-[#FFE566] text-black"
                                    : "text-black hover:bg-neutral-200/70"
                            }`}
                        >
                            <Shield className="w-3 h-3" />
                            <span>Security &amp; Audit</span>
                        </button>
                    )}
                </div>

                {/* Search Input */}
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        type="text"
                        value={searchInput}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder="Search action, actor, or target (e.g. role_created, task)..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[#FAF6EE] border-2 border-black rounded-lg text-xs font-bold text-black placeholder:text-neutral-400 focus:outline-none focus:bg-white"
                    />
                </div>

                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-black bg-rose-100 hover:bg-rose-200 text-black border-2 border-black rounded-lg transition"
                    >
                        <X className="w-3 h-3" />
                        <span>Clear</span>
                    </button>
                )}
            </div>

            {/* Bottom row: Selectors + Date Range */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-black/10">
                <NeoSelect
                    size="sm"
                    value={category}
                    onChange={onCategoryChange}
                    options={HISTORY_CATEGORY_OPTIONS}
                    triggerClassName="min-w-[155px]"
                />

                <NeoSelect
                    size="sm"
                    value={departmentId}
                    onChange={onDepartmentChange}
                    options={departmentOptions}
                    triggerClassName="min-w-[165px]"
                />

                {scope !== "personal" && (
                    <NeoSelect
                        size="sm"
                        value={actorId}
                        onChange={onActorChange}
                        options={actorOptions}
                        triggerClassName="min-w-[160px]"
                    />
                )}

                <NeoSelect
                    size="sm"
                    value={targetType}
                    onChange={onTargetTypeChange}
                    options={HISTORY_TARGET_OPTIONS}
                    triggerClassName="min-w-[145px]"
                />

                <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-[11px] font-black text-neutral-500 uppercase">Date:</span>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        aria-label="Start date"
                        className="px-2 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg text-[11px] font-bold text-black focus:outline-none focus:bg-white"
                    />
                    <span className="text-[11px] font-black text-neutral-400">to</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        aria-label="End date"
                        className="px-2 py-1 bg-[#FAF6EE] border-2 border-black rounded-lg text-[11px] font-bold text-black focus:outline-none focus:bg-white"
                    />
                </div>
            </div>
        </div>
    );
};
