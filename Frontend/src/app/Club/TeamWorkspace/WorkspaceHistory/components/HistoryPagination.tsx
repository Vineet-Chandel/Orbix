// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryPagination.tsx
import React from "react";
import { RefreshCw, ChevronDown } from "lucide-react";

interface HistoryPaginationProps {
    loadedCount: number;
    totalCount: number;
    hasMore: boolean;
    loadingMore: boolean;
    onLoadMore: () => void;
}

export const HistoryPagination: React.FC<HistoryPaginationProps> = ({
    loadedCount,
    totalCount,
    hasMore,
    loadingMore,
    onLoadMore,
}) => {
    if (loadedCount === 0) return null;

    return (
        <div className="px-4 py-3 bg-[#FAF6EE] border-t-2 border-black flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-bold text-neutral-600">
                Showing <span className="font-black text-black">{loadedCount}</span> of{" "}
                <span className="font-black text-black">{totalCount}</span> records
            </span>

            {hasMore ? (
                <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={loadingMore}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white hover:bg-[#FFE566] text-black text-xs font-black border-2 border-black rounded-lg shadow-[2px_2px_0px_#000] transition disabled:opacity-50"
                >
                    {loadingMore ? (
                        <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading older events...</span>
                        </>
                    ) : (
                        <>
                            <span>Load More History</span>
                            <ChevronDown className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            ) : (
                <span className="text-[11px] font-bold text-neutral-500">
                    End of matching history
                </span>
            )}
        </div>
    );
};
