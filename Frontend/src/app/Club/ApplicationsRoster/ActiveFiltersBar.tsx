import React from "react";
import { X, FilterX } from "lucide-react";
import type { ColumnFilterRule, TableColumnDefinition } from "./types";

interface ActiveFiltersBarProps {
    totalCount: number;
    filteredCount: number;
    searchQuery: string;
    onClearSearch: () => void;
    statusFilter: string;
    onClearStatus: () => void;
    institutionFilter: string;
    onClearInstitution: () => void;
    stateFilter: string;
    onClearState: () => void;
    columnFilters: Record<string, ColumnFilterRule>;
    onRemoveColumnFilter: (columnId: string) => void;
    onClearAll: () => void;
    hasActiveFilters: boolean;
    columns: TableColumnDefinition[];
}

export const ActiveFiltersBar: React.FC<ActiveFiltersBarProps> = ({
    totalCount,
    filteredCount,
    searchQuery,
    onClearSearch,
    statusFilter,
    onClearStatus,
    institutionFilter,
    onClearInstitution,
    stateFilter,
    onClearState,
    columnFilters,
    onRemoveColumnFilter,
    onClearAll,
    hasActiveFilters,
    columns,
}) => {
    if (!hasActiveFilters) {
        return (
            <div className="flex items-center justify-between text-xs font-bold text-neutral-600 px-1">
                <span>
                    Showing all <strong className="text-black font-black">{totalCount}</strong>{" "}
                    {totalCount === 1 ? "applicant" : "applicants"}
                </span>
            </div>
        );
    }

    const getColumnLabel = (colId: string) => {
        const found = columns.find((c) => c.id === colId);
        return found ? found.label : colId;
    };

    return (
        <div className="p-3 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-black text-neutral-700 mr-1 flex items-center gap-1">
                    <span>
                        Showing {filteredCount} of {totalCount}:
                    </span>
                </span>

                {/* Search Query Chip */}
                {searchQuery.trim() && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black font-bold text-black text-[11px] shadow-[1px_1px_0px_#000]">
                        <span>Search: "{searchQuery}"</span>
                        <button
                            type="button"
                            onClick={onClearSearch}
                            className="p-0.5 hover:bg-neutral-200 rounded text-neutral-500 hover:text-black"
                            title="Remove search filter"
                        >
                            <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                    </span>
                )}

                {/* Status Tab Chip */}
                {statusFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black font-bold text-black text-[11px] shadow-[1px_1px_0px_#000]">
                        <span className="capitalize">Status: {statusFilter}</span>
                        <button
                            type="button"
                            onClick={onClearStatus}
                            className="p-0.5 hover:bg-neutral-200 rounded text-neutral-500 hover:text-black"
                            title="Clear status filter"
                        >
                            <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                    </span>
                )}

                {/* Institution Chip */}
                {institutionFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black font-bold text-black text-[11px] shadow-[1px_1px_0px_#000]">
                        <span className="truncate max-w-[150px]">College: {institutionFilter}</span>
                        <button
                            type="button"
                            onClick={onClearInstitution}
                            className="p-0.5 hover:bg-neutral-200 rounded text-neutral-500 hover:text-black"
                            title="Clear college filter"
                        >
                            <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                    </span>
                )}

                {/* State Chip */}
                {stateFilter !== "all" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black font-bold text-black text-[11px] shadow-[1px_1px_0px_#000]">
                        <span>State: {stateFilter}</span>
                        <button
                            type="button"
                            onClick={onClearState}
                            className="p-0.5 hover:bg-neutral-200 rounded text-neutral-500 hover:text-black"
                            title="Clear state filter"
                        >
                            <X className="w-3 h-3 stroke-[2.5]" />
                        </button>
                    </span>
                )}

                {/* Column Filters Chips */}
                {Object.entries(columnFilters).map(([colId, rule]) => {
                    const colLabel = getColumnLabel(colId);
                    let ruleDesc = "";

                    if (rule.selectedOptions && rule.selectedOptions.length > 0) {
                        ruleDesc =
                            rule.selectedOptions.length === 1
                                ? rule.selectedOptions[0]
                                : `${rule.selectedOptions.length} selected`;
                    } else if (rule.operator === "is_empty") {
                        ruleDesc = "is blank";
                    } else if (rule.operator === "is_not_empty") {
                        ruleDesc = "is not blank";
                    } else if (rule.operator === "has_file") {
                        ruleDesc = "has file";
                    } else if (rule.operator === "no_file") {
                        ruleDesc = "no file";
                    } else {
                        ruleDesc = `"${rule.value}"`;
                    }

                    return (
                        <span
                            key={colId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FFE566] border border-black font-black text-black text-[11px] shadow-[1px_1px_0px_#000]"
                        >
                            <span className="truncate max-w-[160px]">
                                {colLabel}: {ruleDesc}
                            </span>
                            <button
                                type="button"
                                onClick={() => onRemoveColumnFilter(colId)}
                                className="p-0.5 hover:bg-black/10 rounded text-black"
                                title={`Clear ${colLabel} filter`}
                            >
                                <X className="w-3 h-3 stroke-[2.5]" />
                            </button>
                        </span>
                    );
                })}
            </div>

            <button
                type="button"
                onClick={onClearAll}
                className="px-2.5 py-1 rounded-lg bg-white hover:bg-rose-50 text-rose-700 hover:text-rose-900 border border-black text-xs font-black shadow-[1px_1px_0px_#000] flex items-center gap-1 transition-transform active:translate-x-[0.5px] active:translate-y-[0.5px]"
            >
                <FilterX className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Clear All Filters</span>
            </button>
        </div>
    );
};
