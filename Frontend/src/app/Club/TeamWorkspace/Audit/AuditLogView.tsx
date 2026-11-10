// Frontend/src/app/Club/TeamWorkspace/Audit/AuditLogView.tsx
import React, { useState, useEffect, useCallback } from "react";
import {
    Shield,
    Filter,
    RefreshCw,
    Lock,
    X,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import type { WorkspaceAuditLogEntry } from "../../../../types/workspace";

interface AuditLogViewProps {
    clubId: string;
    isAdmin: boolean;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ clubId, isAdmin }) => {
    const toast = useToast();
    const [logs, setLogs] = useState<WorkspaceAuditLogEntry[]>([]);
    const [total, setTotal] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);

    // Filters
    const [actionFilter, setActionFilter] = useState<string>("");
    const [targetTypeFilter, setTargetTypeFilter] = useState<string>("");

    // Details Modal
    const [inspectLog, setInspectLog] = useState<WorkspaceAuditLogEntry | null>(null);

    // Pagination
    const [offset, setOffset] = useState<number>(0);
    const limit = 30;

    const loadLogs = useCallback(
        async (isRefresh = false, newOffset = 0) => {
            if (!isAdmin) return;
            try {
                if (isRefresh) setRefreshing(true);
                else setLoading(true);

                const res = await workspaceApi.getAuditLogs({
                    clubId,
                    action: actionFilter || undefined,
                    targetType: targetTypeFilter || undefined,
                    limit,
                    offset: newOffset,
                });

                if (res?.data) {
                    if (newOffset === 0) {
                        setLogs(res.data.logs || []);
                    } else {
                        setLogs((prev) => [...prev, ...(res.data.logs || [])]);
                    }
                    setTotal(res.data.total || 0);
                    setOffset(newOffset);
                }
            } catch (err: any) {
                console.error("Failed to load audit logs:", err);
                toast.error(err.message || "Failed to load audit logs.");
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [clubId, isAdmin, actionFilter, targetTypeFilter, toast]
    );

    useEffect(() => {
        loadLogs(false, 0);
    }, [loadLogs]);

    if (!isAdmin) {
        return (
            <div className="bg-white border-2 border-black rounded-xl p-8 text-center max-w-lg mx-auto my-12 shadow-neo">
                <Lock className="w-12 h-12 text-red-500 mx-auto mb-3" />
                <h3 className="text-lg font-black text-black">Administrative Access Required</h3>
                <p className="text-xs text-neutral-600 mt-1 leading-relaxed">
                    Audit logs are restricted to workspace administrators and compliance officers. You do not have permission to view historical audit entries.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b-2 border-black">
                <div>
                    <h2 className="text-xl font-black text-black tracking-tight flex items-center gap-2">
                        <Shield className="w-5 h-5 text-indigo-600" />
                        Administrative Audit Trail
                    </h2>
                    <p className="text-xs text-neutral-600 mt-0.5">
                        Immutable, append-only chronological record of all administrative, access, and task actions
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase px-2 py-1 bg-emerald-100 text-emerald-800 border border-black rounded-md">
                        Append-Only Storage
                    </span>
                    <button
                        onClick={() => loadLogs(true, 0)}
                        disabled={refreshing}
                        className="px-3 py-1.5 text-xs font-black bg-white hover:bg-neutral-100 border-2 border-black rounded-lg shadow-neo-xs flex items-center gap-1.5 transition disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white border-2 border-black rounded-xl p-4 shadow-neo flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5 text-xs font-black text-neutral-700 mr-2">
                    <Filter className="w-3.5 h-3.5" />
                    <span>Filter Logs:</span>
                </div>

                <div className="min-w-[180px]">
                    <input
                        type="text"
                        value={actionFilter}
                        onChange={(e) => setActionFilter(e.target.value)}
                        placeholder="Action (e.g. member.invited)..."
                        className="w-full text-xs font-bold bg-neutral-50 border-2 border-black rounded-lg px-2.5 py-1.5 focus:outline-none"
                    />
                </div>

                <div className="min-w-[160px]">
                    <select
                        value={targetTypeFilter}
                        onChange={(e) => setTargetTypeFilter(e.target.value)}
                        className="w-full text-xs font-bold bg-neutral-50 border-2 border-black rounded-lg px-2.5 py-1.5 focus:outline-none"
                    >
                        <option value="">All Target Types</option>
                        <option value="workspace_member">Member</option>
                        <option value="workspace_role">Role</option>
                        <option value="workspace_department">Department</option>
                        <option value="workspace_channel">Channel</option>
                        <option value="workspace_task">Task</option>
                        <option value="workspace_file">File</option>
                    </select>
                </div>

                {(actionFilter || targetTypeFilter) && (
                    <button
                        onClick={() => {
                            setActionFilter("");
                            setTargetTypeFilter("");
                        }}
                        className="text-xs font-black text-neutral-600 hover:text-black underline ml-auto"
                    >
                        Reset Filters
                    </button>
                )}
            </div>

            {/* Audit Log Table */}
            <div className="bg-white border-2 border-black rounded-xl overflow-hidden shadow-neo">
                {loading && logs.length === 0 ? (
                    <div className="py-12 text-center text-xs text-neutral-500 animate-pulse">
                        Querying audit log entries...
                    </div>
                ) : logs.length === 0 ? (
                    <div className="py-12 text-center">
                        <Shield className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
                        <p className="text-sm font-bold text-neutral-700">No audit log records found.</p>
                        <p className="text-xs text-neutral-500 mt-1">
                            {actionFilter || targetTypeFilter
                                ? "No entries match your search criteria."
                                : "Administrative operations will be recorded here automatically."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b-2 border-black bg-neutral-50 text-[11px] font-black uppercase text-neutral-700">
                                    <th className="py-3 px-4">Timestamp</th>
                                    <th className="py-3 px-4">Actor</th>
                                    <th className="py-3 px-4">Action</th>
                                    <th className="py-3 px-4">Target</th>
                                    <th className="py-3 px-4">Network</th>
                                    <th className="py-3 px-4 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-200 text-xs font-medium text-neutral-800">
                                {logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-neutral-50/80 transition">
                                        {/* Timestamp */}
                                        <td className="py-3 px-4 font-mono text-[11px] text-neutral-500 whitespace-nowrap">
                                            {new Date(log.createdAt).toLocaleString([], {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                                second: "2-digit",
                                            })}
                                        </td>

                                        {/* Actor */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            {log.actor ? (
                                                <div className="font-bold text-black">
                                                    {log.actor.firstName} {log.actor.lastName}{" "}
                                                    <span className="text-[11px] font-normal text-neutral-500">
                                                        (@{log.actor.username})
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="italic text-neutral-500">System</span>
                                            )}
                                        </td>

                                        {/* Action */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-neutral-100 border border-neutral-300 text-neutral-900">
                                                {log.action}
                                            </span>
                                        </td>

                                        {/* Target */}
                                        <td className="py-3 px-4 whitespace-nowrap">
                                            <span className="font-bold text-neutral-900 capitalize">
                                                {log.targetType.replace("workspace_", "")}
                                            </span>
                                            {log.targetId && (
                                                <span className="ml-1.5 font-mono text-[10px] text-neutral-400 truncate max-w-[100px] inline-block align-bottom">
                                                    {log.targetId.slice(0, 8)}...
                                                </span>
                                            )}
                                        </td>

                                        {/* Network (IP) */}
                                        <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-neutral-500">
                                            {log.ipAddress || "Internal"}
                                        </td>

                                        {/* Inspect Action */}
                                        <td className="py-3 px-4 text-right whitespace-nowrap">
                                            <button
                                                onClick={() => setInspectLog(log)}
                                                className="px-2.5 py-1 text-[11px] font-black bg-white hover:bg-neutral-100 border border-black rounded shadow-neo-xs transition"
                                            >
                                                Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination Footer */}
                        {logs.length < total && (
                            <div className="p-4 border-t border-neutral-200 text-center">
                                <button
                                    onClick={() => loadLogs(false, offset + limit)}
                                    disabled={loading}
                                    className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-lg shadow-neo-xs transition disabled:opacity-50"
                                >
                                    {loading ? "Loading..." : `Load More Logs (${total - logs.length} remaining)`}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Inspect Details Modal */}
            {inspectLog && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-white border-2 border-black rounded-2xl max-w-2xl w-full p-6 shadow-neo animate-in fade-in zoom-in-95 space-y-4">
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black">
                            <div className="flex items-center gap-2">
                                <Shield className="w-5 h-5 text-indigo-600" />
                                <h4 className="text-base font-black text-black">
                                    Audit Entry Inspection: {inspectLog.action}
                                </h4>
                            </div>
                            <button
                                onClick={() => setInspectLog(null)}
                                className="p-1 hover:bg-neutral-100 rounded-lg text-neutral-500 hover:text-black transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 bg-neutral-50 border border-black rounded-lg">
                                <span className="font-bold text-neutral-500 uppercase text-[10px] block">Actor</span>
                                <span className="font-black text-neutral-900">
                                    {inspectLog.actor ? `${inspectLog.actor.firstName} ${inspectLog.actor.lastName} (@${inspectLog.actor.username})` : "System"}
                                </span>
                            </div>
                            <div className="p-2.5 bg-neutral-50 border border-black rounded-lg">
                                <span className="font-bold text-neutral-500 uppercase text-[10px] block">Target</span>
                                <span className="font-black text-neutral-900">
                                    {inspectLog.targetType} ({inspectLog.targetId || "N/A"})
                                </span>
                            </div>
                            <div className="p-2.5 bg-neutral-50 border border-black rounded-lg">
                                <span className="font-bold text-neutral-500 uppercase text-[10px] block">IP Address</span>
                                <span className="font-mono text-neutral-900">{inspectLog.ipAddress || "Internal / Local"}</span>
                            </div>
                            <div className="p-2.5 bg-neutral-50 border border-black rounded-lg">
                                <span className="font-bold text-neutral-500 uppercase text-[10px] block">User Agent</span>
                                <span className="font-mono text-neutral-900 truncate block" title={inspectLog.userAgent || ""}>
                                    {inspectLog.userAgent || "N/A"}
                                </span>
                            </div>
                        </div>

                        <div>
                            <span className="font-bold text-neutral-500 uppercase text-[10px] block mb-1">
                                Event Payload (JSON)
                            </span>
                            <pre className="p-3 bg-neutral-900 text-emerald-400 font-mono text-[11px] rounded-xl overflow-x-auto max-h-60 border-2 border-black">
                                {JSON.stringify(inspectLog.details, null, 2)}
                            </pre>
                        </div>

                        <div className="flex justify-end pt-2">
                            <button
                                onClick={() => setInspectLog(null)}
                                className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-lg transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
