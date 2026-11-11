// Frontend/src/app/Club/TeamWorkspace/Recognition/AwardBudgetsView.tsx
import React, { useState } from "react";
import {
    Coins,
    Calendar,
    AlertCircle,
    CheckCircle2,
    Sliders,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type { WorkspaceRecognitionBudget, WorkspaceMember } from "../../../../types/workspace";

interface AwardBudgetsViewProps {
    clubId: string;
    budgets: Array<WorkspaceRecognitionBudget & { user?: any }>;
    isOwner: boolean;
    isWorkspaceManager: boolean;
    currentMember: WorkspaceMember | null;
    onBudgetUpdated: () => void;
}

export const AwardBudgetsView: React.FC<AwardBudgetsViewProps> = ({
    clubId,
    budgets,
    isOwner,
    isWorkspaceManager,
    currentMember,
    onBudgetUpdated,
}) => {
    const [selectedManagerId, setSelectedManagerId] = useState<string>("");
    const [newBudgetAmount, setNewBudgetAmount] = useState<number>(500);
    const [saving, setSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    // Calculate next month reset date
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const resetDateStr = nextMonth.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });

    const handleAllocate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedManagerId) {
            setFeedbackMsg({ type: "error", text: "Please select a Workspace Manager." });
            return;
        }

        setSaving(true);
        setFeedbackMsg(null);
        try {
            const res = await workspaceApi.allocateRecognitionBudget(
                {
                    managerUserId: selectedManagerId,
                    allocatedBudget: newBudgetAmount,
                },
                clubId
            );

            if (res.success) {
                setFeedbackMsg({
                    type: "success",
                    text: `Budget of ${newBudgetAmount} Orbits successfully allocated!`,
                });
                onBudgetUpdated();
            } else {
                setFeedbackMsg({ type: "error", text: res.message || "Failed to allocate budget." });
            }
        } catch (err: any) {
            setFeedbackMsg({
                type: "error",
                text: err.response?.data?.message || err.message || "Error allocating budget.",
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-amber-500" />
                        <h3 className="text-base font-black text-black">Award Budgets & Allocations</h3>
                    </div>
                    <p className="text-xs font-bold text-neutral-600">
                        Monthly limits allocated to Workspace Managers to prevent point inflation
                    </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs font-bold shadow-[2px_2px_0px_#000]">
                    <Calendar className="w-4 h-4 text-neutral-600" />
                    <span>Resets: {resetDateStr}</span>
                </div>
            </div>

            {/* Club Manager: Allocation Form */}
            {isOwner && (
                <div className="p-5 bg-[#FAF6EE] border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2">
                        <Sliders className="w-4 h-4 text-black" />
                        <h4 className="text-sm font-black text-black">Allocate Manager Monthly Budget</h4>
                    </div>

                    {feedbackMsg && (
                        <div
                            className={`p-3 border-2 border-black rounded-xl text-xs font-bold flex items-center gap-2 shadow-[2px_2px_0px_#000] ${
                                feedbackMsg.type === "success"
                                    ? "bg-[#A6FF70] text-black"
                                    : "bg-red-100 text-red-900"
                            }`}
                        >
                            {feedbackMsg.type === "success" ? (
                                <CheckCircle2 className="w-4 h-4" />
                            ) : (
                                <AlertCircle className="w-4 h-4" />
                            )}
                            <span>{feedbackMsg.text}</span>
                        </div>
                    )}

                    <form onSubmit={handleAllocate} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                Workspace Manager
                            </label>
                            <select
                                value={selectedManagerId}
                                onChange={(e) => setSelectedManagerId(e.target.value)}
                                className="w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-bold focus:outline-none shadow-[2px_2px_0px_#000]"
                            >
                                <option value="">Select Manager...</option>
                                {budgets.map((b) => (
                                    <option key={b.userId} value={b.userId}>
                                        {b.user?.firstName || ""} {b.user?.lastName || ""} (@{b.user?.username})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                Monthly Budget (Orbits)
                            </label>
                            <input
                                type="number"
                                min={0}
                                step={10}
                                value={newBudgetAmount}
                                onChange={(e) => setNewBudgetAmount(parseInt(e.target.value, 10) || 0)}
                                className="w-full px-3 py-2 bg-white border-2 border-black rounded-xl text-xs font-black focus:outline-none shadow-[2px_2px_0px_#000]"
                            />
                        </div>

                        <div className="flex items-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full px-4 py-2 bg-[#FFE566] hover:bg-[#fedb33] text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                            >
                                {saving ? "Updating..." : "Save Budget Allocation"}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Budgets Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {budgets.length === 0 ? (
                    <div className="p-8 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] text-center col-span-2">
                        <p className="text-xs font-bold text-neutral-500">
                            No Workspace Managers currently appointed.
                        </p>
                    </div>
                ) : (
                    budgets.map((b) => {
                        const allocated = b.allocatedBudget || 0;
                        const used = b.usedBudget || 0;
                        const remaining = Math.max(0, allocated - used);
                        const pct = allocated > 0 ? Math.min(100, Math.round((used / allocated) * 100)) : 0;

                        return (
                            <div
                                key={b.id || b.userId}
                                className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-xs shadow-[2px_2px_0px_#000]">
                                            {(b.user?.firstName || "M")[0]}
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">
                                                {b.user?.firstName} {b.user?.lastName}
                                            </div>
                                            <div className="text-[10px] text-neutral-500 font-mono">
                                                @{b.user?.username} • {b.user?.roleTitle || "Manager"}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-2.5 py-1 bg-[#FAF6EE] border border-black rounded-lg text-xs font-black shadow-neo-xxs">
                                        {remaining} Orbits Left
                                    </div>
                                </div>

                                {/* Progress Bar */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-600">
                                        <span>Budget Used: {used} Orbits</span>
                                        <span>{pct}% Consumed</span>
                                    </div>
                                    <div className="w-full h-3 bg-neutral-100 border border-black rounded-full overflow-hidden p-0.5">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                pct > 80 ? "bg-amber-400" : "bg-[#A6FF70]"
                                            }`}
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-neutral-200 grid grid-cols-3 gap-2 text-center text-xs">
                                    <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                                        <div className="text-[10px] font-bold text-neutral-500">Allocated</div>
                                        <div className="font-black text-black">{allocated}</div>
                                    </div>
                                    <div className="p-2 bg-neutral-50 rounded-xl border border-neutral-200">
                                        <div className="text-[10px] font-bold text-neutral-500">Awarded</div>
                                        <div className="font-black text-black">{used}</div>
                                    </div>
                                    <div className="p-2 bg-[#FAF6EE] rounded-xl border border-black">
                                        <div className="text-[10px] font-bold text-neutral-600">Remaining</div>
                                        <div className="font-black text-black">{remaining}</div>
                                    </div>
                                </div>

                                {!isOwner && isWorkspaceManager && b.userId === currentMember?.userId && (
                                    <p className="text-[10px] text-neutral-500 italic text-center">
                                        Your monthly budget is managed by the Club Manager. It resets automatically on the 1st of each month.
                                    </p>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
