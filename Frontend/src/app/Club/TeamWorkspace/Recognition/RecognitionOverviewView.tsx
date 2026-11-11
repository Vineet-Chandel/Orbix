// Frontend/src/app/Club/TeamWorkspace/Recognition/RecognitionOverviewView.tsx
import React, { useState, useEffect } from "react";
import {
    Sparkles,
    Coins,
    Sliders,
    History,
    TrendingUp,
    Shield,
    RefreshCw,
    Building2,
    Trophy,
    Award,
    Quote,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import type {
    WorkspaceMember,
    WorkspaceDepartment,
    WorkspaceRecognitionPolicy,
    WorkspaceRecognitionCategory,
    WorkspaceRecognitionBudget,
    WorkspaceRecognitionLedgerEntry,
    MemberRecognitionSummary,
    WorkspaceTask,
} from "../../../../types/workspace";
import { AwardOrbitsModal } from "./AwardOrbitsModal";
import { AwardHistoryView } from "./AwardHistoryView";
import { AwardBudgetsView } from "./AwardBudgetsView";
import { RecognitionPolicyView } from "./RecognitionPolicyView";
import { AwardAnalyticsView } from "./AwardAnalyticsView";
import { DepartmentRecognitionView } from "./DepartmentRecognitionView";

interface RecognitionOverviewViewProps {
    clubId: string;
    workspaceId?: string;
    currentMember: WorkspaceMember | null;
    members: WorkspaceMember[];
    departments: WorkspaceDepartment[];
    tasks?: WorkspaceTask[];
    isOwner: boolean;
    isAdmin?: boolean;
    isWorkspaceManager: boolean;
}

export const RecognitionOverviewView: React.FC<RecognitionOverviewViewProps> = ({
    clubId,
    workspaceId: _workspaceId,
    currentMember,
    members,
    departments,
    tasks = [],
    isOwner,
    isAdmin: _isAdmin,
    isWorkspaceManager,
}) => {
    // Navigation Subtab: Overview | History | Department | Budgets | Policy | Analytics
    const [subTab, setSubTab] = useState<
        "overview" | "history" | "department" | "budgets" | "policy" | "analytics"
    >("overview");

    // Data States
    const [summary, setSummary] = useState<MemberRecognitionSummary | null>(null);
    const [policy, setPolicy] = useState<WorkspaceRecognitionPolicy | null>(null);
    const [categories, setCategories] = useState<WorkspaceRecognitionCategory[]>([]);
    const [budgets, setBudgets] = useState<Array<WorkspaceRecognitionBudget & { user?: any }>>([]);
    const [historyEntries, setHistoryEntries] = useState<WorkspaceRecognitionLedgerEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Modal state
    const [isAwardModalOpen, setIsAwardModalOpen] = useState(false);

    const loadAllRecognitionData = async (isManualRefresh = false) => {
        try {
            if (isManualRefresh) setRefreshing(true);
            else setLoading(true);

            const [summaryRes, policyRes, catRes, historyRes] = await Promise.all([
                workspaceApi.getRecognitionSummary(undefined, clubId),
                workspaceApi.getRecognitionPolicy(clubId),
                workspaceApi.getRecognitionCategories(clubId),
                workspaceApi.getRecognitionHistory({ limit: 50 }, clubId),
            ]);

            if (summaryRes.success) setSummary(summaryRes.summary);
            if (policyRes.success) setPolicy(policyRes.policy);
            if (catRes.success) setCategories(catRes.categories);
            if (historyRes.success) setHistoryEntries(historyRes.entries);

            // If Owner or Manager, also load budgets
            if (isOwner || isWorkspaceManager) {
                const budgetRes = await workspaceApi.getRecognitionBudgets(undefined, clubId);
                if (budgetRes.success) setBudgets(budgetRes.budgets);
            }
        } catch (err) {
            console.error("[RecognitionOverviewView] Failed to load data:", err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadAllRecognitionData();
    }, [clubId]);

    // Check if current user has authority to give Orbits
    const canAward = isOwner || isWorkspaceManager || summary?.canAward;

    if (loading) {
        return (
            <div className="p-12 text-center text-xs font-bold text-neutral-500">
                Loading Orbix Recognition system...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Top Navigation & Subtabs */}
            <div className="flex items-center justify-between border-b-2 border-black pb-4 flex-wrap gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setSubTab("overview")}
                        className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                            subTab === "overview"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                        }`}
                    >
                        <Sparkles className="w-3.5 h-3.5 fill-black" />
                        Overview
                    </button>

                    <button
                        onClick={() => setSubTab("history")}
                        className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                            subTab === "history"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                        }`}
                    >
                        <History className="w-3.5 h-3.5 text-neutral-700" />
                        Award History
                    </button>

                    <button
                        onClick={() => setSubTab("department")}
                        className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                            subTab === "department"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                        }`}
                    >
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        Department
                    </button>

                    {(isOwner || isWorkspaceManager) && (
                        <button
                            onClick={() => setSubTab("budgets")}
                            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                                subTab === "budgets"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                            }`}
                        >
                            <Coins className="w-3.5 h-3.5 text-amber-600" />
                            Award Budgets
                        </button>
                    )}

                    {/* Policy tab: Club Manager ONLY */}
                    {isOwner && (
                        <button
                            onClick={() => setSubTab("policy")}
                            className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                                subTab === "policy"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                            }`}
                        >
                            <Sliders className="w-3.5 h-3.5 text-blue-600" />
                            Recognition Policy
                        </button>
                    )}

                    <button
                        onClick={() => setSubTab("analytics")}
                        className={`px-3.5 py-1.5 text-xs font-black rounded-xl border-2 border-black transition shadow-[2px_2px_0px_#000] flex items-center gap-1.5 active:translate-x-[1px] active:translate-y-[1px] ${
                            subTab === "analytics"
                                ? "bg-[#FFE566] text-black"
                                : "bg-white hover:bg-neutral-50 text-neutral-800"
                        }`}
                    >
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                        Analytics
                    </button>
                </div>

                {/* Right Action: Primary "Award Orbits" Button */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => loadAllRecognitionData(true)}
                        disabled={refreshing}
                        className="p-2 bg-white hover:bg-neutral-100 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition"
                        title="Refresh Recognition Data"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
                    </button>

                    {canAward && (
                        <button
                            onClick={() => setIsAwardModalOpen(true)}
                            className="px-4 py-2 bg-[#FFE566] hover:bg-[#fedb33] text-black border-2 border-black rounded-xl text-xs font-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition flex items-center gap-1.5"
                        >
                            <Sparkles className="w-4 h-4 fill-black" />
                            <span>Award Orbits</span>
                        </button>
                    )}
                </div>
            </div>

            {/* TAB 1: OVERVIEW */}
            {subTab === "overview" && (
                <div className="space-y-6">
                    {/* Hero Card */}
                    <div className="p-6 bg-gradient-to-r from-[#FAF6EE] to-amber-50 border-2 border-black rounded-3xl shadow-[6px_6px_0px_#000] flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 max-w-xl">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFE566] border-2 border-black rounded-full text-xs font-black shadow-[2px_2px_0px_#000]">
                                <Sparkles className="w-3.5 h-3.5 fill-black" />
                                <span>ORBIX RECOGNITION</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-black">
                                Peer Appreciation & Permanent Contribution Ledger
                            </h2>
                            <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                Earn non-monetary Orbits points through verified teamwork, technical breakthroughs,
                                reliability, and campus leadership. Built on an immutable append-only ledger.
                            </p>
                        </div>

                        {/* Balance Card */}
                        <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] min-w-[200px] text-center shrink-0">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Your Total Orbits
                            </span>
                            <div className="text-3xl font-black text-black my-1 flex items-center justify-center gap-1">
                                <Sparkles className="w-5 h-5 text-amber-500 fill-amber-400" />
                                <span>{summary?.currentBalance ?? 0}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-600 block">
                                {summary?.awardsReceivedCount ?? 0} awards received
                            </span>
                        </div>
                    </div>

                    {/* Personal Recognition Summary: 5 Core Metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        {/* 1. Total Orbits Earned */}
                        <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Total Orbits
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1">
                                <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
                                <span>{summary?.currentBalance ?? 0}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 block">All-time balance</span>
                        </div>

                        {/* 2. Earned This Month */}
                        <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                This Month
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1">
                                <span>+{summary?.monthlyOrbitsEarned ?? 0}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 block">
                                {summary?.monthlyAwardsReceived ?? 0} awards
                            </span>
                        </div>

                        {/* 3. Earned This Week */}
                        <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                This Week
                            </span>
                            <div className="text-2xl font-black text-emerald-700 flex items-center gap-1">
                                <span>+{summary?.weeklyOrbitsEarned ?? 0}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 block">Past 7 days</span>
                        </div>

                        {/* 4. Contributor Rank */}
                        <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Contributor Rank
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1">
                                <Trophy className="w-4 h-4 text-amber-500" />
                                <span>{summary?.contributorRank ? `#${summary.contributorRank}` : "—"}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 block">Workspace rank</span>
                        </div>

                        {/* 5. Recognitions Received */}
                        <div className="p-3.5 bg-white border-2 border-black rounded-2xl shadow-[3px_3px_0px_#000] space-y-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Recognitions
                            </span>
                            <div className="text-2xl font-black text-black flex items-center gap-1">
                                <Award className="w-4 h-4 text-blue-600" />
                                <span>{summary?.awardsReceivedCount ?? 0}</span>
                            </div>
                            <span className="text-[10px] font-bold text-neutral-400 block">Honors received</span>
                        </div>
                    </div>

                    {/* Recent Appreciation Spotlight Card */}
                    {summary?.recentAwards && summary.recentAwards.length > 0 && (
                        <div className="p-4 bg-gradient-to-r from-amber-50 to-[#FFE566]/20 border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] flex items-start gap-3">
                            <div className="w-8 h-8 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-neo-xs mt-0.5">
                                <Quote className="w-4 h-4 text-black fill-black" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600">
                                        Latest Appreciation Spotlight
                                    </span>
                                    <span className="px-2 py-0.2 text-[10px] font-black bg-[#FFE566] border border-black rounded-md">
                                        +{summary.recentAwards[0].pointsDelta} Orbits
                                    </span>
                                    <span className="text-[10px] font-bold text-neutral-500">
                                        • {summary.recentAwards[0].category?.name || "Appreciation"}
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-black italic">
                                    "{summary.recentAwards[0].appreciationReason}"
                                </p>
                                <div className="text-[10px] font-bold text-neutral-600">
                                    Given by{" "}
                                    <span className="text-black font-black">
                                        {summary.recentAwards[0].issuer?.name ||
                                         `${summary.recentAwards[0].issuer?.firstName || ""} ${summary.recentAwards[0].issuer?.lastName || ""}`.trim() ||
                                         summary.recentAwards[0].issuer?.username ||
                                         "Workspace Leader"}
                                    </span>{" "}
                                    on {new Date(summary.recentAwards[0].createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Grid: Monthly allowance & Manager Budget */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Remaining Inflow Allowance */}
                        <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                            <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                Inflow Capacity Left
                            </span>
                            <div className="text-xl font-black text-emerald-700">
                                {summary?.monthlyRemainingAllowance ?? policy?.recipientMonthlyCap ?? 150} Orbits
                            </div>
                            <p className="text-[10px] font-bold text-neutral-500">
                                Monthly receiving limit: {policy?.recipientMonthlyCap ?? 150} Orbits / month
                            </p>
                        </div>

                        {/* Issuer Award Budget (if manager) or Owner Authority */}
                        {!isOwner && isWorkspaceManager && (
                            <div className="p-4 bg-[#FFE566]/20 border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                                    <Coins className="w-3.5 h-3.5 text-amber-600" />
                                    Your Award Budget
                                </span>
                                <div className="text-xl font-black text-black">
                                    {summary?.remainingBudget ?? 0} Orbits Left
                                </div>
                                <p className="text-[10px] font-bold text-neutral-600">
                                    Used: {summary?.usedBudget ?? 0} / {summary?.allocatedBudget ?? 0} Orbits this month
                                </p>
                            </div>
                        )}

                        {isOwner && (
                            <div className="p-4 bg-[#A6FF70]/30 border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-700 flex items-center gap-1">
                                    <Shield className="w-3.5 h-3.5 text-blue-700" />
                                    Club Manager Authority
                                </span>
                                <div className="text-xl font-black text-black">Unrestricted</div>
                                <p className="text-[10px] font-bold text-neutral-600">
                                    Can award all roles without monthly budget cap
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Recent Awards Section */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-black text-black uppercase tracking-wider">
                                Recent Workspace Recognition
                            </h3>
                            <button
                                onClick={() => setSubTab("history")}
                                className="text-xs font-black text-neutral-700 hover:text-black hover:underline"
                            >
                                View All ({historyEntries.length}) →
                            </button>
                        </div>

                        <AwardHistoryView
                            clubId={clubId}
                            entries={historyEntries.slice(0, 5)}
                            categories={categories}
                            members={members}
                            currentMember={currentMember}
                            isOwner={isOwner}
                            onReversalSuccess={() => loadAllRecognitionData(true)}
                        />
                    </div>
                </div>
            )}

            {/* TAB 2: AWARD HISTORY */}
            {subTab === "history" && (
                <AwardHistoryView
                    clubId={clubId}
                    entries={historyEntries}
                    categories={categories}
                    members={members}
                    currentMember={currentMember}
                    isOwner={isOwner}
                    onReversalSuccess={() => loadAllRecognitionData(true)}
                />
            )}

            {/* TAB 3: DEPARTMENT RECOGNITION */}
            {subTab === "department" && (
                <DepartmentRecognitionView
                    clubId={clubId}
                    departments={departments}
                    currentMember={currentMember}
                    isOwner={isOwner}
                    isWorkspaceManager={isWorkspaceManager}
                />
            )}

            {/* TAB 3: AWARD BUDGETS */}
            {subTab === "budgets" && (
                <AwardBudgetsView
                    clubId={clubId}
                    budgets={budgets}
                    isOwner={isOwner}
                    isWorkspaceManager={isWorkspaceManager}
                    currentMember={currentMember}
                    onBudgetUpdated={() => loadAllRecognitionData(true)}
                />
            )}

            {/* TAB 4: RECOGNITION POLICY (OWNER ONLY) */}
            {subTab === "policy" && policy && (
                <RecognitionPolicyView
                    clubId={clubId}
                    policy={policy}
                    categories={categories}
                    onPolicyUpdated={() => loadAllRecognitionData(true)}
                    onCategoriesUpdated={() => loadAllRecognitionData(true)}
                />
            )}

            {/* TAB 5: ANALYTICS */}
            {subTab === "analytics" && <AwardAnalyticsView clubId={clubId} />}

            {/* Award Orbits Modal */}
            <AwardOrbitsModal
                isOpen={isAwardModalOpen}
                onClose={() => setIsAwardModalOpen(false)}
                clubId={clubId}
                members={members}
                departments={departments}
                categories={categories}
                policy={policy}
                currentMember={currentMember}
                isOwner={isOwner}
                isWorkspaceManager={isWorkspaceManager}
                remainingBudget={summary?.remainingBudget}
                tasks={tasks}
                onAwardSuccess={() => {
                    loadAllRecognitionData(true);
                }}
            />
        </div>
    );
};
