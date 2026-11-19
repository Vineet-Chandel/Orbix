import React from "react";
import {
    ShieldAlert,
    CheckCircle2,
    Flame,
    ArrowRight,
    Award,
    Activity,
    Lightbulb,
} from "lucide-react";
import type { ClubCredibilitySnapshot, ScoreLevel } from "../../../api/clubCredibilityApi";

export interface ClubCredibilityOverviewCardProps {
    snapshot: ClubCredibilitySnapshot | null;
    loading?: boolean;
    onViewDetails?: () => void;
}

export const getScoreBadge = (score: number, _level?: ScoreLevel, isProvisional?: boolean) => {
    if (score < 40) {
        return {
            color: "bg-[#FECDD3] text-rose-950 border-rose-900",
            dotColor: "bg-rose-500",
            label: "Critical",
            description: "Significant trust issues. Urgent recovery required.",
        };
    }
    if (score < 60) {
        return {
            color: "bg-[#FEF3C7] text-amber-950 border-amber-900",
            dotColor: "bg-amber-500",
            label: isProvisional ? "Provisional (Developing)" : "Developing",
            description: "Building initial campus track record and consistency.",
        };
    }
    if (score < 75) {
        return {
            color: "bg-[#FEF08A] text-amber-950 border-amber-900",
            dotColor: "bg-yellow-500",
            label: "Reliable",
            description: "Consistent event delivery and healthy reliability.",
        };
    }
    if (score < 90) {
        return {
            color: "bg-[#BBF7D0] text-emerald-950 border-emerald-900",
            dotColor: "bg-emerald-500",
            label: "Trusted",
            description: "Highly rated by campus and verified participants.",
        };
    }
    return {
        color: "bg-[#a2ff86] text-black border-black",
        dotColor: "bg-black",
        label: "Exceptional",
        description: "Exemplary standing across campus and national arenas.",
    };
};

export const ClubCredibilityOverviewCard: React.FC<ClubCredibilityOverviewCardProps> = ({
    snapshot,
    loading = false,
    onViewDetails,
}) => {
    if (loading || !snapshot) {
        return (
            <div className="p-6 rounded-3xl bg-white dark:bg-[#121212] border-3 border-black shadow-[5px_5px_0px_#000] animate-pulse h-48 flex items-center justify-center">
                <span className="text-xs font-black uppercase tracking-wider text-neutral-400">
                    Loading Club Credibility Standing...
                </span>
            </div>
        );
    }

    const badge = getScoreBadge(snapshot.currentScore, snapshot.scoreLevel, snapshot.isProvisional);

    return (
        <div className="p-6 sm:p-7 rounded-3xl bg-[#FAF6EE] dark:bg-[#141414] border-3 border-black shadow-[6px_6px_0px_#000] space-y-5 text-neutral-900 dark:text-neutral-100">
            {/* Top Bar: Title & Score Level Badge */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 dark:border-white/10 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-black text-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                        <Award className="w-6 h-6 stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-base sm:text-lg font-black text-black dark:text-white tracking-tight">
                                Club Credibility Engine
                            </h3>
                            {snapshot.isProvisional && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                    Provisional
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 mt-0.5">
                            Evidence-based reputation from verified events, attendee satisfaction & integrity.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <span
                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black inline-flex items-center gap-2 shadow-[2px_2px_0px_#000] ${badge.color}`}
                    >
                        <span className={`w-2 h-2 rounded-full border border-black shrink-0 ${badge.dotColor}`} />
                        <span>{badge.label}</span>
                    </span>
                </div>
            </div>

            {/* Main Score Hero & Metric Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                {/* Score Number Callout (Left 4 cols) */}
                <div className="lg:col-span-4 p-5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between sm:justify-start gap-5">
                    <div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-4xl sm:text-5xl font-black text-black dark:text-white tracking-tight">
                                {Math.round(snapshot.currentScore)}
                            </span>
                            <span className="text-base sm:text-lg font-black text-neutral-400">/100</span>
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block mt-1">
                            Credibility Score
                        </span>
                    </div>

                    <div className="border-l-2 border-black/10 dark:border-white/10 pl-4 space-y-1 text-left">
                        <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                            Lifetime: <span className="font-black text-black dark:text-white">{Math.round(snapshot.lifetimeScore)}</span>
                        </div>
                        <div className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                            Recent 365d: <span className="font-black text-black dark:text-white">{Math.round(snapshot.recentScore)}</span>
                        </div>
                        <div className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">
                            Formula: 70% L + 30% R
                        </div>
                    </div>
                </div>

                {/* 4 Pillars Matrix (Right 8 cols) */}
                <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {/* Successful Events */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-black uppercase tracking-wider">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                            <span>Verified Events</span>
                        </div>
                        <div className="text-xl font-black text-black dark:text-white">
                            {snapshot.totalVerifiedEvents}
                        </div>
                    </div>

                    {/* Incidents */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-black uppercase tracking-wider">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
                            <span>Incidents</span>
                        </div>
                        <div className="text-xl font-black text-black dark:text-white">
                            {snapshot.totalVerifiedIncidents}
                        </div>
                    </div>

                    {/* Streak */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-black uppercase tracking-wider">
                            <Flame className="w-3.5 h-3.5 text-orange-500 stroke-[2.5]" />
                            <span>Streak</span>
                        </div>
                        <div className="text-xl font-black text-black dark:text-white">
                            {snapshot.successfulEventStreak} <span className="text-xs text-neutral-400 font-bold">events</span>
                        </div>
                    </div>

                    {/* Confidence */}
                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                        <div className="flex items-center gap-1.5 text-neutral-500 text-[10px] font-black uppercase tracking-wider">
                            <Activity className="w-3.5 h-3.5 text-sky-600 stroke-[2.5]" />
                            <span>Confidence</span>
                        </div>
                        <div className="text-sm sm:text-base font-black text-black dark:text-white uppercase">
                            {snapshot.confidenceLevel}
                        </div>
                    </div>
                </div>
            </div>

            {/* Bottom Bar: Quick Explanation & View Report CTA */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t-2 border-black/10 dark:border-white/10">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    <span><strong className="text-black dark:text-white">Tip:</strong> Completing events with accurate certificates and verified attendee check-ins builds your streak and elevates discovery reach across Orbix.</span>
                </span>

                {onViewDetails && (
                    <button
                        type="button"
                        onClick={onViewDetails}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-black dark:text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer shrink-0 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <span>Full Credibility Ledger & History</span>
                        <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                )}
            </div>
        </div>
    );
};
