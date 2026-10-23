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
            {/* Total counts text matching neo-brutalist reference */}
            <div className="text-black font-extrabold tracking-tight">
                Showing{" "}
                <span className="font-mono px-1.5 py-0.5 rounded bg-white border border-black shadow-[1px_1px_0px_#000] font-black">
                    {startRow}–{endRow}
                </span>{" "}
                of{" "}
                <span className="font-mono px-1.5 py-0.5 rounded bg-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] font-black">
                    {totalCoders.toLocaleString()}
                </span>{" "}
                coders
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center gap-2 self-center sm:self-auto">
                {/* Previous Button */}
                <button
                    type="button"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage <= 1 || isLoading}
                    className="p-1.5 rounded-lg bg-white border-2 border-black text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    aria-label="Previous Page"
                >
                    <ChevronLeft className="w-4 h-4 stroke-[3]" />
                </button>

                {/* Numbered Page Buttons */}
                <div className="flex items-center gap-1.5">
                    {getPageNumbers().map((p, idx) => {
                        if (p === "...") {
                            return (
                                <span key={`ellipsis-${idx}`} className="px-1 text-black font-black select-none">
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
                                className={`w-8 h-8 rounded-lg font-mono text-xs font-black border-2 border-black transition-all cursor-pointer flex items-center justify-center ${
                                    isCurrent
                                        ? "bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000] -translate-y-[1px]"
                                        : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
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
                    className="p-1.5 rounded-lg bg-white border-2 border-black text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
                    aria-label="Next Page"
                >
                    <ChevronRight className="w-4 h-4 stroke-[3]" />
                </button>
            </div>
        </div>
    );
};
