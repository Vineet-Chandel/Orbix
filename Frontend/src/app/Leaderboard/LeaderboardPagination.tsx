import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface LeaderboardPaginationProps {
    currentPage: number;
    totalPages: number;
    totalCoders: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    isLoading?: boolean;
}

export const LeaderboardPagination: React.FC<LeaderboardPaginationProps> = ({
    currentPage,
    totalPages,
    totalCoders,
    pageSize,
    onPageChange,
    isLoading = false,
}) => {
    if (totalCoders === 0) return null;

    const startRow = (currentPage - 1) * pageSize + 1;
    const endRow = Math.min(currentPage * pageSize, totalCoders);

    // Compute visible page numbers with ellipsis
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push("...");
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (currentPage < totalPages - 2) pages.push("...");
            pages.push(totalPages);
        }
        return pages;
    };

    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-4 px-2 text-xs">
            {/* Total counts text matching reference */}
            <div className="text-neutral-400 font-medium">
                Showing <strong className="text-white font-mono">{startRow}–{endRow}</strong> of{" "}
                <strong className="text-white font-mono">{totalCoders.toLocaleString()}</strong> coders
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-1.5 self-center sm:self-auto">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || isLoading}
                    className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    aria-label="Previous Page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Numbered Page Buttons */}
                <div className="flex items-center gap-1">
                    {getPageNumbers().map((p, idx) => {
                        if (p === "...") {
                            return (
                                <span key={`ellipsis-${idx}`} className="px-2 text-neutral-600 select-none">
                                    ...
                                </span>
                            );
                        }
                        const isCurrent = p === currentPage;
                        return (
                            <button
                                key={`page-${p}`}
                                type="button"
                                onClick={() => onPageChange(Number(p))}
                                disabled={isLoading}
                                className={`w-8 h-8 rounded-xl font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center ${
                                    isCurrent
                                        ? "bg-white text-black shadow-xs"
                                        : "bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800"
                                }`}
                            >
                                {p}
                            </button>
                        );
                    })}
                </div>

                {/* Next Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages || isLoading}
                    className="p-2 rounded-xl bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:bg-neutral-800 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    aria-label="Next Page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};
