// Frontend/src/app/Club/TeamWorkspace/WorkspaceHistory/components/HistoryInspectModal.tsx
import React from "react";
import { Shield, Activity, X, Globe, Monitor, RefreshCw } from "lucide-react";
import type { WorkspaceHistoryItem } from "../../../../../types/workspace";

interface HistoryInspectModalProps {
    item: WorkspaceHistoryItem | null;
    loading: boolean;
    onClose: () => void;
}

export const HistoryInspectModal: React.FC<HistoryInspectModalProps> = ({
    item,
    loading,
    onClose,
}) => {
    if (!item) return null;

    const isAudit = item.source === "audit";

    return (
        <div
            className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[1px] flex items-center justify-center p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-2xl bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-5 py-3.5 bg-white border-b-2 border-black flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={`w-7 h-7 rounded-lg border-2 border-black flex items-center justify-center shrink-0 ${
                                isAudit ? "bg-[#FFE566]" : "bg-[#A6FF70]"
                            }`}
                        >
                            {isAudit ? (
                                <Shield className="w-4 h-4 text-black" />
                            ) : (
                                <Activity className="w-4 h-4 text-black" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-sm font-black text-black truncate">
                                Inspect History Event
                            </h3>
                            <p className="text-[11px] font-mono text-neutral-600 truncate">
                                {item.source.toUpperCase()} &middot; {item.eventType}
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black transition"
                        aria-label="Close inspect modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                    {loading && (
                        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 bg-white border-2 border-black rounded-xl px-3 py-2">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Loading full sanitized metadata...</span>
                        </div>
                    )}

                    <div className="bg-white border-2 border-black rounded-xl p-3.5 space-y-2">
                        <div className="text-[10px] font-black uppercase text-neutral-500">
                            Summary
                        </div>
                        <p className="text-xs sm:text-sm font-bold text-black">{item.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="bg-white border-2 border-black rounded-xl p-3">
                            <div className="text-[10px] font-black uppercase text-neutral-500">
                                Actor
                            </div>
                            <div className="font-black text-black mt-0.5">{item.actor.name}</div>
                            {item.actor.username && (
                                <div className="text-[11px] text-neutral-600">
                                    @{item.actor.username}
                                </div>
                            )}
                            <div className="text-[10px] font-mono text-neutral-500 mt-1 break-all">
                                ID: {item.actor.id}
                            </div>
                        </div>

                        <div className="bg-white border-2 border-black rounded-xl p-3">
                            <div className="text-[10px] font-black uppercase text-neutral-500">
                                Timestamp &amp; Scope
                            </div>
                            <div className="font-black text-black mt-0.5">
                                {new Date(item.createdAt).toLocaleString()}
                            </div>
                            <div className="text-[10px] font-mono text-neutral-500 mt-0.5">
                                {item.createdAt}
                            </div>
                            <div className="text-[11px] font-bold text-neutral-700 mt-1">
                                Category: <span className="uppercase">{item.category}</span>
                                {item.department?.name ? ` • Dept: ${item.department.name}` : ""}
                            </div>
                        </div>

                        <div className="bg-white border-2 border-black rounded-xl p-3">
                            <div className="text-[10px] font-black uppercase text-neutral-500">
                                Target Resource
                            </div>
                            {item.target ? (
                                <>
                                    <div className="font-black text-black mt-0.5 capitalize">
                                        {item.target.type.replace(/_/g, " ")}
                                        {item.target.label ? ` — ${item.target.label}` : ""}
                                    </div>
                                    <div className="text-[10px] font-mono text-neutral-500 mt-1 break-all">
                                        ID: {item.target.id}
                                    </div>
                                </>
                            ) : (
                                <div className="text-neutral-500 font-semibold mt-0.5">
                                    No specific target
                                </div>
                            )}
                        </div>

                        <div className="bg-white border-2 border-black rounded-xl p-3">
                            <div className="text-[10px] font-black uppercase text-neutral-500">
                                Record Identifier
                            </div>
                            <div className="text-[11px] font-mono text-black mt-1 break-all">
                                {item.id}
                            </div>
                            {item.correlationId && (
                                <div className="text-[10px] font-mono text-neutral-500 mt-1 break-all">
                                    Correlation: {item.correlationId}
                                </div>
                            )}
                        </div>
                    </div>

                    {item.auditDetails && (
                        <div className="space-y-3 pt-1">
                            {(item.auditDetails.ipAddress || item.auditDetails.userAgent) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <div className="bg-white border-2 border-black rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-neutral-500">
                                            <Globe className="w-3 h-3" />
                                            <span>Network IP</span>
                                        </div>
                                        <div className="font-mono font-bold text-black mt-1 break-all">
                                            {item.auditDetails.ipAddress || "Not recorded"}
                                        </div>
                                    </div>

                                    <div className="bg-white border-2 border-black rounded-xl p-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-neutral-500">
                                            <Monitor className="w-3 h-3" />
                                            <span>User Agent</span>
                                        </div>
                                        <div className="font-mono text-[11px] text-neutral-800 mt-1 break-all line-clamp-3">
                                            {item.auditDetails.userAgent || "Internal / Server"}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">
                                    Sanitized Event Payload
                                </div>
                                <pre className="p-3 bg-neutral-900 text-[#A6FF70] rounded-xl text-[11px] font-mono overflow-x-auto border-2 border-black max-h-60">
                                    {JSON.stringify(item.auditDetails.details || {}, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {item.activityDetails && !item.auditDetails && (
                        <div>
                            <div className="text-[10px] font-black uppercase text-neutral-500 mb-1.5">
                                Activity Metadata
                            </div>
                            <pre className="p-3 bg-neutral-900 text-[#A6FF70] rounded-xl text-[11px] font-mono overflow-x-auto border-2 border-black max-h-60">
                                {JSON.stringify(item.activityDetails.metadata || {}, null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
