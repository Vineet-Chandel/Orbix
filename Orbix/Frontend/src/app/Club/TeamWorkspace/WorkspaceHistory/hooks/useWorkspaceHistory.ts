// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/hooks/useWorkspaceHistory.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { workspaceApi } from "../../../../../api/workspaceApi";
import { useToast } from "../../../../../context/ToastContext";
import type {
    WorkspaceHistoryItem,
    WorkspaceHistoryRecordType,
    WorkspaceHistoryResponse,
    WorkspaceHistoryScope,
} from "../../../../../types/workspace";

interface UseWorkspaceHistoryParams {
    clubId: string;
    canViewAudit: boolean;
    initialRecordType?: WorkspaceHistoryRecordType;
}

const DEFAULT_LIMIT = 35;

export function useWorkspaceHistory({
    clubId,
    canViewAudit,
    initialRecordType = "all",
}: UseWorkspaceHistoryParams) {
    const toast = useToast();

    const [scope, setScope] = useState<WorkspaceHistoryScope>("workspace");
    const [rawRecordType, setRecordType] = useState<WorkspaceHistoryRecordType>(() =>
        initialRecordType === "audit" && !canViewAudit ? "all" : initialRecordType
    );
    const recordType: WorkspaceHistoryRecordType =
        !canViewAudit && rawRecordType === "audit" ? "all" : rawRecordType;

    const [prevInitialRecordType, setPrevInitialRecordType] = useState(initialRecordType);
    if (initialRecordType !== prevInitialRecordType) {
        setPrevInitialRecordType(initialRecordType);
        setRecordType(initialRecordType === "audit" && !canViewAudit ? "all" : initialRecordType);
    }
    const [category, setCategory] = useState<string>("");
    const [departmentId, setDepartmentId] = useState<string>("");
    const [actorId, setActorId] = useState<string>("");
    const [targetType, setTargetType] = useState<string>("");
    const [searchInput, setSearchInput] = useState<string>("");
    const [debouncedSearch, setDebouncedSearch] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");

    const [items, setItems] = useState<WorkspaceHistoryItem[]>([]);
    const [nextCursor, setNextCursor] = useState<string | null>(null);
    const [hasMore, setHasMore] = useState<boolean>(false);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [permissions, setPermissions] = useState<WorkspaceHistoryResponse["permissions"]>({
        canViewAudit,
        canExport: canViewAudit,
        scope: canViewAudit ? "global" : "department",
    });

    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [exporting, setExporting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const [inspectItem, setInspectItem] = useState<WorkspaceHistoryItem | null>(null);
    const [inspectLoading, setInspectLoading] = useState<boolean>(false);

    const requestSeqRef = useRef<number>(0);

    // Debounce text search
    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebouncedSearch(searchInput.trim());
        }, 250);
        return () => window.clearTimeout(timer);
    }, [searchInput]);

    const buildQueryParams = useCallback(
        (cursorOverride?: string | null) => {
            const isoStart = startDate ? new Date(`${startDate}T00:00:00.000Z`).toISOString() : undefined;
            const isoEnd = endDate ? new Date(`${endDate}T23:59:59.999Z`).toISOString() : undefined;
            return {
                clubId,
                scope,
                recordType: canViewAudit ? recordType : ("activity" as WorkspaceHistoryRecordType),
                category: category || undefined,
                departmentId: departmentId || undefined,
                actorId: scope === "personal" ? undefined : actorId || undefined,
                targetType: targetType || undefined,
                search: debouncedSearch || undefined,
                startDate: isoStart,
                endDate: isoEnd,
                cursor: cursorOverride || undefined,
                limit: DEFAULT_LIMIT,
            };
        },
        [
            clubId,
            scope,
            recordType,
            canViewAudit,
            category,
            departmentId,
            actorId,
            targetType,
            debouncedSearch,
            startDate,
            endDate,
        ]
    );

    const fetchHistory = useCallback(
        async (isLoadMore = false, isManualRefresh = false, cursorToUse?: string | null) => {
            const seq = ++requestSeqRef.current;
            try {
                if (isLoadMore) setLoadingMore(true);
                else if (isManualRefresh) setRefreshing(true);
                else setLoading(true);
                setError(null);

                const res = await workspaceApi.getHistory(buildQueryParams(cursorToUse));
                if (seq !== requestSeqRef.current) return;

                if (res.success && res.data) {
                    if (isLoadMore) {
                        setItems((prev) => {
                            const seen = new Set(prev.map((i) => `${i.source}:${i.id}`));
                            const nextRows = res.data.items.filter((i) => !seen.has(`${i.source}:${i.id}`));
                            return [...prev, ...nextRows];
                        });
                    } else {
                        setItems(res.data.items);
                    }
                    setNextCursor(res.data.nextCursor);
                    setHasMore(res.data.hasMore);
                    setTotalCount(
                        typeof res.data.totalCount === "number"
                            ? res.data.totalCount
                            : res.data.items.length
                    );
                    if (res.data.permissions) {
                        setPermissions(res.data.permissions);
                    }
                }
            } catch (err: unknown) {
                if (seq !== requestSeqRef.current) return;
                const message = err instanceof Error ? err.message : "Failed to load workspace history";
                setError(message);
                toast.error(message);
            } finally {
                if (seq === requestSeqRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                    setLoadingMore(false);
                }
            }
        },
        [buildQueryParams, toast]
    );

    useEffect(() => {
        const timer = window.setTimeout(() => {
            void fetchHistory(false, false, null);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [fetchHistory]);

    const handleRefresh = useCallback(() => {
        void fetchHistory(false, true, null);
    }, [fetchHistory]);

    const handleLoadMore = useCallback(() => {
        if (!hasMore || !nextCursor || loadingMore) return;
        void fetchHistory(true, false, nextCursor);
    }, [hasMore, nextCursor, loadingMore, fetchHistory]);

    const handleScopeChange = useCallback((nextScope: WorkspaceHistoryScope) => {
        setScope(nextScope);
        if (nextScope === "personal") {
            setActorId("");
        }
    }, []);

    const handleResetFilters = useCallback(() => {
        setScope("workspace");
        setRecordType("all");
        setCategory("");
        setDepartmentId("");
        setActorId("");
        setTargetType("");
        setSearchInput("");
        setDebouncedSearch("");
        setStartDate("");
        setEndDate("");
    }, []);

    const openInspect = useCallback(
        async (item: WorkspaceHistoryItem) => {
            setInspectItem(item);
            if (!item.permissions.canInspect) return;
            try {
                setInspectLoading(true);
                const res = await workspaceApi.inspectHistoryItem(item.id, item.source, clubId);
                if (res.success && res.data) {
                    setInspectItem(res.data);
                }
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to load inspection details";
                toast.error(message);
            } finally {
                setInspectLoading(false);
            }
        },
        [clubId, toast]
    );

    const closeInspect = useCallback(() => {
        setInspectItem(null);
        setInspectLoading(false);
    }, []);

    const handleExport = useCallback(
        async (format: "csv" | "json") => {
            if (!permissions.canExport) {
                toast.error("You do not have permission to export workspace history");
                return;
            }
            try {
                setExporting(true);
                const params = buildQueryParams(null);
                await workspaceApi.exportHistory(format, params);
                toast.success(`Exported workspace history (${format.toUpperCase()})`);
            } catch (err: unknown) {
                const message = err instanceof Error ? err.message : "Failed to export workspace history";
                toast.error(message);
            } finally {
                setExporting(false);
            }
        },
        [permissions.canExport, buildQueryParams, toast]
    );

    const hasActiveFilters = Boolean(
        category ||
            departmentId ||
            actorId ||
            targetType ||
            searchInput ||
            startDate ||
            endDate ||
            (canViewAudit && recordType !== "all") ||
            scope !== "workspace"
    );

    return {
        // Filter state
        scope,
        recordType,
        category,
        departmentId,
        actorId,
        targetType,
        searchInput,
        startDate,
        endDate,
        hasActiveFilters,
        setRecordType,
        setCategory,
        setDepartmentId,
        setActorId,
        setTargetType,
        setSearchInput,
        setStartDate,
        setEndDate,
        handleScopeChange,
        handleResetFilters,
        // Data & permissions
        items,
        hasMore,
        totalCount,
        permissions,
        // Status
        loading,
        refreshing,
        loadingMore,
        exporting,
        error,
        // Inspect
        inspectItem,
        inspectLoading,
        openInspect,
        closeInspect,
        // Actions
        handleRefresh,
        handleLoadMore,
        handleExport,
    };
}
