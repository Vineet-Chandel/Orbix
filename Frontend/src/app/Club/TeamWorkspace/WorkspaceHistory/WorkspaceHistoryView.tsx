// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/WorkspaceHistoryView.tsx
import React from "react";
import { AlertTriangle, History, RefreshCw } from "lucide-react";
import type {
    MemberCapabilityResolution,
    WorkspaceDepartment,
    WorkspaceHistoryItem,
    WorkspaceHistoryRecordType,
    WorkspaceMember,
} from "../../../../types/workspace";
import { useWorkspaceHistory } from "./hooks/useWorkspaceHistory";
import { HistoryHeader } from "./components/HistoryHeader";
import { HistoryFilterToolbar } from "./components/HistoryFilterToolbar";
import { HistoryTimelineItem } from "./components/HistoryTimelineItem";
import { HistoryInspectModal } from "./components/HistoryInspectModal";
import { HistoryPagination } from "./components/HistoryPagination";
import {
    resolveSectionFromTarget,
    type WorkspaceNavigationSection,
} from "./utils/historyEventRegistry";

interface WorkspaceHistoryViewProps {
    clubId: string;
    departments: WorkspaceDepartment[];
    members: WorkspaceMember[];
    currentMember: WorkspaceMember | null;
    capabilities?: MemberCapabilityResolution | null;
    isAdmin: boolean;
    isClubContext?: boolean;
    initialRecordType?: WorkspaceHistoryRecordType;
    onNavigateSection?: (section: WorkspaceNavigationSection, item: WorkspaceHistoryItem) => void;
}

export const WorkspaceHistoryView: React.FC<WorkspaceHistoryViewProps> = ({
    clubId,
    departments,
    members,
    currentMember,
    capabilities,
    isAdmin,
    isClubContext,
    initialRecordType = "all",
    onNavigateSection,
}) => {
    const canViewAudit = capabilities
        ? Boolean(capabilities.navigation.canViewAuditLogs)
        : isAdmin;

    const history = useWorkspaceHistory({
        clubId,
        canViewAudit,
        initialRecordType,
    });

    const effectiveCanViewAudit = history.permissions.canViewAudit;
    const effectiveCanExport = history.permissions.canExport;
    const effectiveIsClubAccount = Boolean(capabilities?.isClubAccount || isClubContext);
    const hasPersonalScope = Boolean(currentMember?.userId) && !effectiveIsClubAccount;

    const handleNavigateTarget = (item: WorkspaceHistoryItem) => {
        const targetSection = resolveSectionFromTarget(item.target, effectiveIsClubAccount);
        if (targetSection && onNavigateSection) {
            onNavigateSection(targetSection, item);
        }
    };

    return (
        <div className="space-y-4">
            <HistoryHeader
                scope={history.scope}
                canViewAudit={effectiveCanViewAudit}
                canExport={effectiveCanExport}
                isClubAccount={effectiveIsClubAccount}
                hasPersonalScope={hasPersonalScope}
                totalCount={history.totalCount}
                refreshing={history.refreshing}
                exporting={history.exporting}
                onScopeChange={history.handleScopeChange}
                onRefresh={history.handleRefresh}
                onExport={history.handleExport}
            />

            <HistoryFilterToolbar
                scope={history.scope}
                recordType={history.recordType}
                category={history.category}
                departmentId={history.departmentId}
                actorId={history.actorId}
                targetType={history.targetType}
                searchInput={history.searchInput}
                startDate={history.startDate}
                endDate={history.endDate}
                canViewAudit={effectiveCanViewAudit}
                hasActiveFilters={history.hasActiveFilters}
                departments={departments}
                members={members}
                onRecordTypeChange={history.setRecordType}
                onCategoryChange={history.setCategory}
                onDepartmentChange={history.setDepartmentId}
                onActorChange={history.setActorId}
                onTargetTypeChange={history.setTargetType}
                onSearchChange={history.setSearchInput}
                onStartDateChange={history.setStartDate}
                onEndDateChange={history.setEndDate}
                onReset={history.handleResetFilters}
            />

            {/* Timeline Surface */}
            <div className="bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] overflow-hidden">
                {history.loading ? (
                    <div className="p-10 flex flex-col items-center justify-center gap-3 text-neutral-600">
                        <RefreshCw className="w-6 h-6 animate-spin text-black" />
                        <span className="text-xs font-black">Loading workspace history...</span>
                    </div>
                ) : history.error && history.items.length === 0 ? (
                    <div className="p-10 flex flex-col items-center justify-center text-center gap-2">
                        <AlertTriangle className="w-7 h-7 text-rose-600" />
                        <p className="text-sm font-black text-black">Unable to load history</p>
                        <p className="text-xs font-semibold text-neutral-600">{history.error}</p>
                        <button
                            type="button"
                            onClick={history.handleRefresh}
                            className="mt-2 px-4 py-1.5 bg-[#FFE566] border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000]"
                        >
                            Retry
                        </button>
                    </div>
                ) : history.items.length === 0 ? (
                    <div className="p-12 flex flex-col items-center justify-center text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center mb-3">
                            <History className="w-6 h-6 text-black" />
                        </div>
                        <h3 className="text-sm font-black text-black">No history events matched</h3>
                        <p className="text-xs font-semibold text-neutral-500 mt-1 max-w-md">
                            Try adjusting your stream, category, date range, or search filters to view earlier workspace activity.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y-2 divide-black/10">
                            {history.items.map((item) => (
                                <HistoryTimelineItem
                                    key={`${item.source}:${item.id}`}
                                    item={item}
                                    isClubContext={effectiveIsClubAccount}
                                    onInspect={history.openInspect}
                                    onNavigateTarget={handleNavigateTarget}
                                />
                            ))}
                        </div>

                        <HistoryPagination
                            loadedCount={history.items.length}
                            totalCount={history.totalCount}
                            hasMore={history.hasMore}
                            loadingMore={history.loadingMore}
                            onLoadMore={history.handleLoadMore}
                        />
                    </>
                )}
            </div>

            <HistoryInspectModal
                item={history.inspectItem}
                loading={history.inspectLoading}
                onClose={history.closeInspect}
            />
        </div>
    );
};
