// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryHeader.tsx
import React from "react";
import { History, Globe, Users, User, Shield, RefreshCw } from "lucide-react";
import type { WorkspaceHistoryScope } from "../../../../../types/workspace";
import { HistoryExportMenu } from "./HistoryExportMenu";

interface HistoryHeaderProps {
    scope: WorkspaceHistoryScope;
    canViewAudit: boolean;
    canExport: boolean;
    isClubAccount: boolean;
    hasPersonalScope: boolean;
    totalCount: number;
    refreshing: boolean;
    exporting: boolean;
    onScopeChange: (scope: WorkspaceHistoryScope) => void;
    onRefresh: () => void;
    onExport: (format: "csv" | "json") => void;
}

export const HistoryHeader: React.FC<HistoryHeaderProps> = ({
    scope,
    canViewAudit,
    canExport,
    isClubAccount,
    hasPersonalScope,
    totalCount,
    refreshing,
    exporting,
    onScopeChange,
    onRefresh,
    onExport,
}) => {
    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-[#A6FF70] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center">
                            <History className="w-4 h-4 text-black" />
                        </div>
                        <h2 className="text-lg font-black text-black tracking-tight">
                            Workspace History
                        </h2>
                        {canViewAudit ? (
                            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase bg-emerald-200 text-black border-2 border-black rounded-md">
                                {isClubAccount ? "OWNER AUDIT + ACTIVITY" : "AUDIT + ACTIVITY"}
                            </span>
                        ) : (
                            <span className="px-2.5 py-0.5 text-[10px] font-black uppercase bg-[#FAF6EE] text-neutral-700 border-2 border-black rounded-md">
                                SCOPED ACTIVITY
                            </span>
                        )}
                        <span className="px-2 py-0.5 text-[11px] font-black bg-white text-neutral-700 border border-black rounded-md">
                            {totalCount} {totalCount === 1 ? "event" : "events"}
                        </span>
                    </div>
                    <p className="text-xs font-semibold text-neutral-600 mt-1">
                        {canViewAudit
                            ? "Unified chronological ledger of operational collaboration and append-only administrative security events."
                            : "Permission-scoped chronological history of workspace collaboration in your accessible departments."}
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    {canExport && (
                        <HistoryExportMenu
                            exporting={exporting}
                            disabled={totalCount === 0}
                            onExport={onExport}
                        />
                    )}
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={refreshing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-neutral-50 text-black text-xs font-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Scope Selector */}
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => onScopeChange("workspace")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition ${
                        scope === "workspace"
                            ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                            : "bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                >
                    <Globe className="w-3.5 h-3.5" />
                    <span>All Workspace History</span>
                </button>

                <button
                    type="button"
                    onClick={() => onScopeChange("department")}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition ${
                        scope === "department"
                            ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                            : "bg-white text-neutral-700 hover:bg-neutral-50"
                    }`}
                >
                    <Users className="w-3.5 h-3.5" />
                    <span>Department Activity</span>
                </button>

                {hasPersonalScope && (
                    <button
                        type="button"
                        onClick={() => onScopeChange("personal")}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition ${
                            scope === "personal"
                                ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                : "bg-white text-neutral-700 hover:bg-neutral-50"
                        }`}
                    >
                        <User className="w-3.5 h-3.5" />
                        <span>My Activity</span>
                    </button>
                )}

                {canViewAudit && (
                    <div className="ml-auto hidden md:flex items-center gap-1.5 text-[11px] font-bold text-neutral-600 bg-white px-2.5 py-1 rounded-lg border border-black/30">
                        <Shield className="w-3.5 h-3.5 text-black" />
                        <span>Audit records are append-only</span>
                    </div>
                )}
            </div>
        </div>
    );
};
