// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryTimelineItem.tsx
import React from "react";
import { ArrowUpRight, Clock, Eye, Lock } from "lucide-react";
import type { WorkspaceHistoryItem } from "../../../../../types/workspace";
import {
    formatHistoryRelativeTime,
    getHistoryVisualMeta,
    resolveSectionFromTarget,
} from "../utils/historyEventRegistry";

interface HistoryTimelineItemProps {
    item: WorkspaceHistoryItem;
    isClubContext?: boolean;
    onInspect: (item: WorkspaceHistoryItem) => void;
    onNavigateTarget?: (item: WorkspaceHistoryItem) => void;
}

export const HistoryTimelineItem: React.FC<HistoryTimelineItemProps> = ({
    item,
    isClubContext,
    onInspect,
    onNavigateTarget,
}) => {
    const visual = getHistoryVisualMeta(item);
    const navSection = resolveSectionFromTarget(item.target, isClubContext);
    const showNavigate = Boolean(item.permissions.canNavigate && navSection && onNavigateTarget);
    const exactTime = new Date(item.createdAt).toLocaleString();

    return (
        <div className="p-3.5 sm:px-5 hover:bg-[#FAF6EE]/70 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0 flex-1">
                <div
                    className={`w-9 h-9 rounded-xl border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0 mt-0.5 ${visual.iconBgClass}`}
                >
                    {visual.icon}
                </div>

                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                        <span
                            className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide border rounded ${visual.badgeClass}`}
                        >
                            {visual.badgeLabel}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-neutral-100 text-neutral-800 border border-black/30 rounded">
                            {item.eventType}
                        </span>
                        {item.isRestricted && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-black uppercase bg-rose-200 text-black border border-black rounded">
                                <Lock className="w-2.5 h-2.5" />
                                Restricted
                            </span>
                        )}
                        {item.department?.name && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-[#FAF6EE] text-neutral-700 border border-black/25 rounded">
                                {item.department.name}
                            </span>
                        )}
                    </div>

                    <p className="text-xs sm:text-[13px] font-bold text-black leading-snug break-words">
                        {item.summary}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-semibold text-neutral-600">
                        <span>
                            Actor: <span className="font-black text-black">{item.actor.name}</span>
                            {item.actor.username ? ` (@${item.actor.username})` : ""}
                        </span>
                        {item.target?.type && (
                            <span>
                                Target:{" "}
                                <span className="font-bold text-neutral-800 capitalize">
                                    {item.target.type.replace(/_/g, " ")}
                                </span>
                                {item.target.label && (
                                    <span className="ml-1 font-semibold text-black">
                                        &middot; {item.target.label}
                                    </span>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 pl-12 sm:pl-0">
                <span
                    title={exactTime}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 whitespace-nowrap"
                >
                    <Clock className="w-3 h-3" />
                    {formatHistoryRelativeTime(item.createdAt)}
                </span>

                {showNavigate && (
                    <button
                        type="button"
                        onClick={() => onNavigateTarget?.(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-white hover:bg-[#A6FF70] text-black border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] transition"
                    >
                        <span>Open</span>
                        <ArrowUpRight className="w-3 h-3" />
                    </button>
                )}

                {item.permissions.canInspect && (
                    <button
                        type="button"
                        onClick={() => onInspect(item)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-black bg-[#FFE566] hover:bg-[#fbd83a] text-black border-2 border-black rounded-lg shadow-[1.5px_1.5px_0px_#000] transition"
                    >
                        <Eye className="w-3 h-3" />
                        <span>Inspect</span>
                    </button>
                )}
            </div>
        </div>
    );
};
