// Frontend/src/app/Club/TeamWorkspace/Recognition/RecognitionPolicyView.tsx
import React, { useState } from "react";
import {
    Shield,
    CheckCircle2,
    AlertCircle,
    Save,
    ToggleLeft,
    ToggleRight,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceRecognitionPolicy,
    WorkspaceRecognitionCategory,
} from "../../../../types/workspace";

interface RecognitionPolicyViewProps {
    clubId: string;
    policy: WorkspaceRecognitionPolicy;
    categories: WorkspaceRecognitionCategory[];
    onPolicyUpdated: () => void;
    onCategoriesUpdated: () => void;
}

export const RecognitionPolicyView: React.FC<RecognitionPolicyViewProps> = ({
    clubId,
    policy,
    categories,
    onPolicyUpdated,
    onCategoriesUpdated,
}) => {
    // Policy form state
    const [isEnabled, setIsEnabled] = useState<boolean>(policy.isEnabled ?? true);
    const [minPoints, setMinPoints] = useState<number>(policy.minPointsPerAward);
    const [maxPoints, setMaxPoints] = useState<number>(policy.maxPointsPerAward);
    const [recipientMonthlyCap, setRecipientMonthlyCap] = useState<number>(policy.recipientMonthlyCap);
    const [dailyVelocity, setDailyVelocity] = useState<number>(policy.dailyAwardLimitPerIssuer);
    const [minReasonLength, setMinReasonLength] = useState<number>(policy.minReasonLength);
    const [requireTaskLink, setRequireTaskLink] = useState<boolean>(policy.requireTaskLink);
    const [isWorkspaceVisible, setIsWorkspaceVisible] = useState<boolean>(policy.isWorkspaceVisible);
    const [dpiApproved, setDpiApproved] = useState<number>(policy.dpiWeightApprovedTasks ?? 35);
    const [dpiOnTime, setDpiOnTime] = useState<number>(policy.dpiWeightOnTime ?? 35);
    const [dpiParticipation, setDpiParticipation] = useState<number>(policy.dpiWeightParticipation ?? 20);
    const [dpiRecognition, setDpiRecognition] = useState<number>(policy.dpiWeightRecognition ?? 10);
    const [dpiCap, setDpiCap] = useState<number>(policy.dpiRecognitionCapPerMember ?? 50);

    const [saving, setSaving] = useState(false);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

    const handleSavePolicy = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setFeedbackMsg(null);

        try {
            const res = await workspaceApi.updateRecognitionPolicy(
                {
                    isEnabled,
                    minPointsPerAward: minPoints,
                    maxPointsPerAward: maxPoints,
                    recipientMonthlyCap,
                    dailyAwardLimitPerIssuer: dailyVelocity,
                    minReasonLength,
                    requireTaskLink,
                    isWorkspaceVisible,
                    dpiWeightApprovedTasks: dpiApproved,
                    dpiWeightOnTime: dpiOnTime,
                    dpiWeightParticipation: dpiParticipation,
                    dpiWeightRecognition: dpiRecognition,
                    dpiRecognitionCapPerMember: dpiCap,
                },
                clubId
            );

            if (res.success) {
                setFeedbackMsg({ type: "success", text: "Recognition policy updated successfully!" });
                onPolicyUpdated();
            } else {
                setFeedbackMsg({ type: "error", text: res.message || "Failed to update policy." });
            }
        } catch (err: any) {
            setFeedbackMsg({
                type: "error",
                text: err.response?.data?.message || err.message || "Error updating policy.",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleCategory = async (cat: WorkspaceRecognitionCategory) => {
        try {
            const res = await workspaceApi.updateRecognitionCategory(
                cat.id,
                { isActive: !cat.isActive },
                clubId
            );
            if (res.success) {
                onCategoriesUpdated();
            }
        } catch (err: any) {
            console.error("Failed to toggle category:", err);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header info */}
            <div className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex items-center justify-between flex-wrap gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        <h3 className="text-base font-black text-black">Recognition Policy & Category Controls</h3>
                    </div>
                    <p className="text-xs font-bold text-neutral-600">
                        Protected administration: Controls scoring rules, thresholds, and category toggles
                    </p>
                </div>
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

            {/* Policy Parameters Form */}
            <form onSubmit={handleSavePolicy} className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-5">
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <h4 className="text-sm font-black text-black">Award Limits & Verification Rules</h4>
                    <button
                        type="submit"
                        disabled={saving}
                        className="px-4 py-2 bg-[#FFE566] hover:bg-[#fedb33] text-black border-2 border-black rounded-xl text-xs font-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1.5"
                    >
                        <Save className="w-4 h-4" />
                        <span>{saving ? "Saving..." : "Save Policy Changes"}</span>
                    </button>
                </div>

                {/* Rollout Feature Flag Card */}
                <div className={`p-4 border-2 border-black rounded-xl flex items-center justify-between transition ${
                    isEnabled ? "bg-[#A6FF70]/30 shadow-[2px_2px_0px_#000]" : "bg-neutral-100 shadow-[2px_2px_0px_#000]"
                }`}>
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <h5 className="text-xs font-black text-black">Orbix Recognition System Status</h5>
                            <span className={`px-2 py-0.5 text-[10px] font-black rounded-full border border-black ${
                                isEnabled ? "bg-[#A6FF70] text-black" : "bg-neutral-300 text-neutral-700"
                            }`}>
                                {isEnabled ? "ACTIVE" : "PAUSED"}
                            </span>
                        </div>
                        <p className="text-[11px] font-bold text-neutral-600">
                            {isEnabled 
                                ? "Recognition is active. Eligible members can receive Orbits and view live leaderboards."
                                : "Recognition is paused. Point awarding and leaderboards are disabled for this workspace."}
                        </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => setIsEnabled(e.target.checked)}
                            className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-neutral-300 border-2 border-black peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-black after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-2 after:border-black after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#FFE566]"></div>
                    </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Min points */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Minimum Points per Award
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={maxPoints}
                            value={minPoints}
                            onChange={(e) => setMinPoints(parseInt(e.target.value, 10) || 1)}
                            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">Default: 5 Orbits</p>
                    </div>

                    {/* Max points */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Maximum Points per Award
                        </label>
                        <input
                            type="number"
                            min={minPoints}
                            max={500}
                            value={maxPoints}
                            onChange={(e) => setMaxPoints(parseInt(e.target.value, 10) || minPoints)}
                            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">Default: 50 Orbits</p>
                    </div>

                    {/* Recipient Monthly Cap */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Recipient Monthly Inflow Cap
                        </label>
                        <input
                            type="number"
                            min={maxPoints}
                            value={recipientMonthlyCap}
                            onChange={(e) => setRecipientMonthlyCap(parseInt(e.target.value, 10) || maxPoints)}
                            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">
                            Max points a single member may earn across all awards per calendar month
                        </p>
                    </div>

                    {/* Daily Velocity */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Daily Award Velocity Limit per Issuer
                        </label>
                        <input
                            type="number"
                            min={1}
                            max={50}
                            value={dailyVelocity}
                            onChange={(e) => setDailyVelocity(parseInt(e.target.value, 10) || 1)}
                            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">Max awards an issuer can give per day</p>
                    </div>

                    {/* Min Reason Length */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black text-black uppercase tracking-wider">
                            Minimum Appreciation Reason Length
                        </label>
                        <input
                            type="number"
                            min={5}
                            max={100}
                            value={minReasonLength}
                            onChange={(e) => setMinReasonLength(parseInt(e.target.value, 10) || 5)}
                            className="w-full px-3 py-2 bg-neutral-50 border-2 border-black rounded-xl text-xs font-black focus:outline-none focus:bg-white shadow-[1.5px_1.5px_0px_#000]"
                        />
                        <p className="text-[10px] text-neutral-500 font-medium">Ensures descriptive appreciation</p>
                    </div>

                    {/* Require Task Link Toggle */}
                    <div className="space-y-1.5 flex flex-col justify-between p-3 bg-[#FAF6EE] border-2 border-black rounded-xl">
                        <div>
                            <div className="text-xs font-black text-black">Require Linked Task</div>
                            <div className="text-[11px] text-neutral-600 font-medium">
                                Enforces linking an existing workspace task for every award
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRequireTaskLink(!requireTaskLink)}
                            className={`mt-2 px-3 py-1.5 rounded-lg border border-black text-xs font-black flex items-center justify-between shadow-neo-xxs ${
                                requireTaskLink ? "bg-[#A6FF70]" : "bg-neutral-200"
                            }`}
                        >
                            <span>{requireTaskLink ? "Enabled" : "Optional"}</span>
                            {requireTaskLink ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Workspace Visibility Toggle */}
                    <div className="space-y-1.5 flex flex-col justify-between p-3 bg-[#FAF6EE] border-2 border-black rounded-xl">
                        <div>
                            <div className="text-xs font-black text-black">Public Workspace Visibility</div>
                            <div className="text-[11px] text-neutral-600 font-medium">
                                Broadcasts awards to workspace feeds and general activity
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsWorkspaceVisible(!isWorkspaceVisible)}
                            className={`mt-2 px-3 py-1.5 rounded-lg border border-black text-xs font-black flex items-center justify-between shadow-neo-xxs ${
                                isWorkspaceVisible ? "bg-[#A6FF70]" : "bg-neutral-200"
                            }`}
                        >
                            <span>{isWorkspaceVisible ? "Public" : "Restricted"}</span>
                            {isWorkspaceVisible ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Department Performance Index (DPI) Formula Weights */}
                <div className="mt-6 pt-5 border-t-2 border-black space-y-3">
                    <div>
                        <h4 className="text-xs font-black text-black uppercase tracking-wider">
                            Department Performance Index (DPI) Formula Weights
                        </h4>
                        <p className="text-[11px] text-neutral-600 font-medium">
                            Configure percentage weights for the transparent 0–100 DPI formula (Formula Version: {policy.dpiFormulaVersion || "v1.0"}).
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-black">Approved Tasks (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={dpiApproved}
                                onChange={(e) => setDpiApproved(parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-black focus:outline-none focus:bg-white shadow-[1px_1px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500">Default: 35%</p>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-black">On-Time Rate (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={dpiOnTime}
                                onChange={(e) => setDpiOnTime(parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-black focus:outline-none focus:bg-white shadow-[1px_1px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500">Default: 35%</p>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-black">Participation (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={dpiParticipation}
                                onChange={(e) => setDpiParticipation(parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-black focus:outline-none focus:bg-white shadow-[1px_1px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500">Default: 20%</p>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-black">Recognition (%)</label>
                            <input
                                type="number"
                                min={0}
                                max={100}
                                value={dpiRecognition}
                                onChange={(e) => setDpiRecognition(parseFloat(e.target.value) || 0)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-black focus:outline-none focus:bg-white shadow-[1px_1px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500">Default: 10%</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        <div className="space-y-1">
                            <label className="block text-[11px] font-black text-black">
                                Recognition Cap per Member (Orbits)
                            </label>
                            <input
                                type="number"
                                min={10}
                                max={500}
                                value={dpiCap}
                                onChange={(e) => setDpiCap(parseInt(e.target.value, 10) || 50)}
                                className="w-full px-2.5 py-1.5 bg-neutral-50 border-2 border-black rounded-lg text-xs font-black focus:outline-none focus:bg-white shadow-[1px_1px_0px_#000]"
                            />
                            <p className="text-[10px] text-neutral-500">Prevents unlimited recognition awards from inflating department performance</p>
                        </div>
                    </div>
                </div>
            </form>

            {/* Recognition Categories Configuration */}
            <div className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-black pb-3">
                    <div>
                        <h4 className="text-sm font-black text-black">Active Appreciation Categories</h4>
                        <p className="text-xs font-bold text-neutral-600">
                            Enable or disable specific categories for your workspace
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {categories.map((cat) => (
                        <div
                            key={cat.id}
                            className={`p-3.5 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] flex items-start justify-between gap-3 transition ${
                                cat.isActive ? "bg-white" : "bg-neutral-100 opacity-60"
                            }`}
                        >
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-black text-black">{cat.name}</span>
                                    {cat.isSystem && (
                                        <span className="px-1.5 py-0.2 bg-neutral-100 border border-neutral-300 text-[9px] font-bold rounded">
                                            System
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-neutral-600 font-medium leading-snug">
                                    {cat.description}
                                </p>
                            </div>

                            <button
                                type="button"
                                onClick={() => handleToggleCategory(cat)}
                                title={cat.isActive ? "Deactivate Category" : "Activate Category"}
                                className={`p-1 rounded-lg border border-black shadow-neo-xxs transition shrink-0 ${
                                    cat.isActive ? "bg-[#A6FF70]" : "bg-neutral-200"
                                }`}
                            >
                                {cat.isActive ? (
                                    <ToggleRight className="w-5 h-5 text-black" />
                                ) : (
                                    <ToggleLeft className="w-5 h-5 text-neutral-500" />
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
