import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
    CheckCircle2,
    RotateCcw,
    FileText,
    Sliders,
    X,
    BookOpen,
    Globe2,
    GraduationCap,
} from "lucide-react";
import {
    fetchClubCredibility,
    fetchClubCredibilityHistory,
    submitCredibilityAppeal,
    recalculateClubCredibility,
    type ClubCredibilitySnapshot,
    type CredibilityLedgerEntry,
} from "../../../api/clubCredibilityApi";
import { getScoreBadge } from "./ClubCredibilityOverviewCard";
import { OrbixLoader } from "../../../components/ui/loader";
import { useToast } from "../../../context/ToastContext";

export const ClubCredibilityWorkspace: React.FC = () => {
    const toast = useToast();
    const [snapshot, setSnapshot] = useState<ClubCredibilitySnapshot | null>(null);
    const [history, setHistory] = useState<CredibilityLedgerEntry[]>([]);
    const [totalHistoryCount, setTotalHistoryCount] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [recalculating, setRecalculating] = useState(false);

    // Appeal Modal State
    const [appealTarget, setAppealTarget] = useState<CredibilityLedgerEntry | null>(null);
    const [appealReason, setAppealReason] = useState("");
    const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

    const loadData = async (targetPage = 1) => {
        try {
            setLoading(true);
            const [overview, historyData] = await Promise.all([
                fetchClubCredibility(),
                fetchClubCredibilityHistory(targetPage, 15),
            ]);
            setSnapshot(overview.snapshot);
            setHistory(historyData.history);
            setTotalHistoryCount(historyData.total);
            setPage(targetPage);
        } catch (err: any) {
            console.error("Failed to load credibility workspace:", err);
            toast.error(err.response?.data?.message || "Failed to load club credibility.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData(1);
    }, []);

    const handleRecalculate = async () => {
        try {
            setRecalculating(true);
            const res = await recalculateClubCredibility();
            setSnapshot(res.snapshot);
            toast.success("Credibility standing recalculated successfully from verified ledger.");
            await loadData(page);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to recalculate credibility.");
        } finally {
            setRecalculating(false);
        }
    };

    const handleOpenAppeal = (entry: CredibilityLedgerEntry) => {
        setAppealTarget(entry);
        setAppealReason("");
    };

    const handleSubmitAppeal = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!appealTarget) return;

        if (appealReason.trim().length < 10) {
            toast.error("Please provide a detailed explanation (minimum 10 characters).");
            return;
        }

        try {
            setIsSubmittingAppeal(true);
            await submitCredibilityAppeal({
                ledgerId: appealTarget.id,
                reason: appealReason.trim(),
            });
            toast.success("Credibility appeal submitted to platform moderators for review.");
            setAppealTarget(null);
            await loadData(page);
        } catch (err: any) {
            toast.error(err.response?.data?.message || "Failed to submit appeal.");
        } finally {
            setIsSubmittingAppeal(false);
        }
    };

    if (loading && !snapshot) {
        return (
            <div className="p-16 flex flex-col items-center justify-center gap-3">
                <OrbixLoader size="md" variant="centered" color="#000" />
                <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                    Loading Club Credibility Standing & History...
                </span>
            </div>
        );
    }

    if (!snapshot) return null;

    const badge = getScoreBadge(snapshot.currentScore, snapshot.scoreLevel, snapshot.isProvisional);

    return (
        <div className="space-y-6 text-neutral-900 dark:text-neutral-100 max-w-7xl mx-auto">
            {/* Header: Title, Score Badge, and Recalculate CTA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-black/10 dark:border-white/10 pb-5">
                <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-black text-[#FFE566] border border-black shadow-[1.5px_1.5px_0px_#000]">
                            Orbix Reputation Engine
                        </span>
                        {snapshot.isProvisional && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                Provisional (Under 3 Verified Events)
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-black dark:text-white tracking-tight mt-1.5">
                        Club Credibility & Accountability Standing
                    </h2>
                    <p className="text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-400 mt-1 max-w-3xl">
                        Credibility is your club's long-term reputation on Orbix, measured through fulfilled commitments, advance cancellation notice, attendee feedback, and credential integrity.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                    <Link
                        to="/docs/club-credibility-algorithm"
                        className="px-4 py-2 rounded-xl bg-[#FFE566] hover:bg-[#ebce48] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        title="Read official Credibility Engine Algorithm documentation"
                    >
                        <BookOpen className="w-3.5 h-3.5 stroke-[2.5]" />
                        <span>Algorithm Docs</span>
                    </Link>

                    <button
                        type="button"
                        onClick={handleRecalculate}
                        disabled={recalculating}
                        className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-black dark:text-white border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50"
                        title="Recompute cached snapshot from append-only ledger"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 stroke-[2.5] ${recalculating ? "animate-spin" : ""}`} />
                        <span>{recalculating ? "Recalculating..." : "Sync Ledger"}</span>
                    </button>
                </div>
            </div>

            {/* Top Tier Summary Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Score Hero Card (4 cols) */}
                <div className="lg:col-span-4 p-6 rounded-3xl bg-[#FAF6EE] dark:bg-[#141414] border-3 border-black shadow-[5px_5px_0px_#000] flex flex-col justify-between space-y-4">
                    <div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                            Current Standing
                        </span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-5xl sm:text-6xl font-black text-black dark:text-white tracking-tight">
                                {Math.round(snapshot.currentScore)}
                            </span>
                            <span className="text-xl font-black text-neutral-400">/100</span>
                        </div>

                        <div className="mt-3">
                            <span
                                className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black inline-flex items-center gap-2 shadow-[2px_2px_0px_#000] ${badge.color}`}
                            >
                                <span className={`w-2 h-2 rounded-full border border-black shrink-0 ${badge.dotColor}`} />
                                <span>{badge.label}</span>
                            </span>
                        </div>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1c1c1c] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1 text-xs">
                        <div className="flex items-center justify-between font-bold text-neutral-600 dark:text-neutral-400">
                            <span>Lifetime Credibility (70%):</span>
                            <span className="font-black text-black dark:text-white">{Math.round(snapshot.lifetimeScore)}/100</span>
                        </div>
                        <div className="flex items-center justify-between font-bold text-neutral-600 dark:text-neutral-400">
                            <span>Recent 365 Days (30%):</span>
                            <span className="font-black text-black dark:text-white">{Math.round(snapshot.recentScore)}/100</span>
                        </div>
                        <p className="text-[10px] text-neutral-500 pt-1 border-t border-black/10 dark:border-white/10 font-bold">
                            High-quality recent performance helps clubs recover standing without wiping history.
                        </p>
                    </div>
                </div>

                {/* 6 Dimensional Performance Meters (8 cols) */}
                <div className="lg:col-span-8 p-6 rounded-3xl bg-white dark:bg-[#141414] border-3 border-black shadow-[5px_5px_0px_#000] space-y-4">
                    <div className="flex items-center justify-between border-b-2 border-black/10 dark:border-white/10 pb-3">
                        <h4 className="text-sm font-black uppercase tracking-wider text-black dark:text-white flex items-center gap-2">
                            <Sliders className="w-4 h-4 stroke-[2.5]" />
                            <span>Dimensional Reliability Rubric</span>
                        </h4>
                        <span className="text-xs font-bold text-neutral-500">
                            Scale: 0 to 100
                        </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Event Delivery */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Event Delivery Against Promises (30%)</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.eventDelivery || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-[#a2ff86] border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.eventDelivery || 50}%` }}
                                />
                            </div>
                        </div>

                        {/* Schedule Reliability */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Schedule & Execution Reliability (15%)</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.scheduleReliability || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-[#38BDF8] border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.scheduleReliability || 50}%` }}
                                />
                            </div>
                        </div>

                        {/* Participant Communication */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Participant Communication (15%)</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.communication || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-[#C084FC] border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.communication || 50}%` }}
                                />
                            </div>
                        </div>

                        {/* Attendee Experience */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Verified Participant Feedback (20%)</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.participantExperience || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-[#FFE566] border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.participantExperience || 50}%` }}
                                />
                            </div>
                        </div>

                        {/* Cancellation Reliability */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Cancellation & Notice Discipline</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.cancellationReliability || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-[#FB7185] border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.cancellationReliability || 50}%` }}
                                />
                            </div>
                        </div>

                        {/* Certificate Integrity */}
                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-bold">
                                <span>Certificate Accuracy & Integrity</span>
                                <span className="font-black text-black dark:text-white">
                                    {snapshot.dimensionalScores.certificateIntegrity || 50}/100
                                </span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-neutral-100 dark:bg-neutral-800 border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]">
                                <div
                                    className="h-full bg-emerald-400 border-r-2 border-black"
                                    style={{ width: `${snapshot.dimensionalScores.certificateIntegrity || 50}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Bands Guide Pill Box */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#121212] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3 text-xs font-bold">
                <span className="font-black uppercase tracking-wider text-neutral-500">Credibility Tiers:</span>
                <span className="px-2.5 py-1 rounded-xl bg-[#FECDD3] text-rose-950 border border-black shadow-[1px_1px_0px_#000]">
                    0–39 Critical
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-[#FEF3C7] text-amber-950 border border-black shadow-[1px_1px_0px_#000]">
                    40–59 Developing
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-[#FEF08A] text-amber-950 border border-black shadow-[1px_1px_0px_#000]">
                    60–74 Reliable
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-[#BBF7D0] text-emerald-950 border border-black shadow-[1px_1px_0px_#000]">
                    75–89 Trusted
                </span>
                <span className="px-2.5 py-1 rounded-xl bg-[#a2ff86] text-black border border-black shadow-[1px_1px_0px_#000]">
                    90–100 Exceptional
                </span>
            </div>

            {/* Section 2: Credibility Ledger (Immutable Audit History) */}
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#141414] border-3 border-black shadow-[6px_6px_0px_#000] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black/10 dark:border-white/10 pb-4">
                    <div>
                        <h3 className="text-lg font-black text-black dark:text-white tracking-tight flex items-center gap-2">
                            <FileText className="w-5 h-5 stroke-[2.5]" />
                            <span>Credibility History Ledger</span>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#FAF6EE] dark:bg-neutral-800 text-black dark:text-white border border-black">
                                {totalHistoryCount} entries
                            </span>
                        </h3>
                        <p className="text-xs font-bold text-neutral-500 mt-0.5">
                            Every verified event completion, cancellation, and credential issuance recorded with evidence weights.
                        </p>
                    </div>
                </div>

                {history.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl border-2 border-dashed border-black/20 space-y-2">
                        <CheckCircle2 className="w-10 h-10 text-neutral-400 mx-auto" />
                        <h4 className="text-sm font-black text-black dark:text-white">No Ledger Entries Yet</h4>
                        <p className="text-xs font-bold text-neutral-500 max-w-sm mx-auto">
                            Publish and complete your club's upcoming events to start recording verified credibility evidence.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {history.map((entry) => (
                            <div
                                key={entry.id}
                                className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] dark:bg-[#1a1a1a] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4"
                            >
                                <div className="space-y-1.5 max-w-2xl">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-white">
                                            {entry.sourceAction.replace(/_/g, " ")}
                                        </span>
                                        {entry.eventScope && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border border-black bg-white text-black inline-flex items-center gap-1">
                                                {entry.eventScope === "PAN_INDIA" ? (
                                                    <>
                                                        <Globe2 className="w-2.5 h-2.5" />
                                                        <span>Pan-India</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <GraduationCap className="w-2.5 h-2.5" />
                                                        <span>Campus</span>
                                                    </>
                                                )}
                                            </span>
                                        )}
                                        {entry.status === "reversed" && (
                                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 border border-purple-300">
                                                Reversed via Appeal
                                            </span>
                                        )}
                                        <span className="text-[11px] font-bold text-neutral-500">
                                            {new Date(entry.createdAt).toLocaleDateString("en-IN", {
                                                day: "numeric",
                                                month: "short",
                                                year: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>

                                    <h4 className="text-sm sm:text-base font-black text-black dark:text-white">
                                        {entry.eventTitle ? `Event: ${entry.eventTitle}` : entry.reasonCode}
                                    </h4>

                                    <p className="text-xs font-bold text-neutral-600 dark:text-neutral-400 leading-relaxed">
                                        {entry.explanation}
                                    </p>
                                </div>

                                {/* Score Transition Box & Action */}
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="p-3 rounded-xl bg-white dark:bg-[#121212] border-2 border-black shadow-[2px_2px_0px_#000] text-right space-y-0.5">
                                        <div className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                            Score Impact
                                        </div>
                                        <div className="flex items-center justify-end gap-1.5 font-black text-sm">
                                            <span className="text-neutral-500">{Math.round(entry.scoreBefore)}</span>
                                            <span
                                                className={`px-1.5 py-0.5 rounded text-xs font-black ${
                                                    entry.scoreDelta > 0
                                                        ? "bg-emerald-100 text-emerald-800"
                                                        : entry.scoreDelta < 0
                                                        ? "bg-rose-100 text-rose-800"
                                                        : "bg-neutral-100 text-neutral-600"
                                                }`}
                                            >
                                                {entry.scoreDelta > 0 ? `+${entry.scoreDelta}` : entry.scoreDelta}
                                            </span>
                                            <span className="text-black dark:text-white font-black">
                                                {Math.round(entry.scoreAfter)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Appeal Button for negative deductions */}
                                    {entry.scoreDelta < 0 && entry.status === "confirmed" && !entry.hasAppeal && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenAppeal(entry)}
                                            className="px-3 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            Appeal
                                        </button>
                                    )}

                                    {entry.hasAppeal && (
                                        <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black">
                                            Appeal {entry.latestAppealStatus?.replace(/_/g, " ")}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Appeal Modal */}
            {appealTarget && (
                <div
                    onClick={() => setAppealTarget(null)}
                    className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm select-none"
                >
                    <div
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-lg bg-[#FAF6EE] dark:bg-[#141414] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 space-y-4"
                    >
                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10 dark:border-white/10">
                            <h3 className="text-base font-black text-black dark:text-white">
                                Submit Credibility Appeal
                            </h3>
                            <button
                                type="button"
                                onClick={() => setAppealTarget(null)}
                                className="p-1 rounded-lg border-2 border-black bg-white text-black"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">
                            Disputed incident: <strong>{appealTarget.eventTitle || appealTarget.reasonCode}</strong>. Provide context, emergency documentation, or verifiable proof.
                        </p>

                        <form onSubmit={handleSubmitAppeal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider mb-1">
                                    Reason & Evidence Statement
                                </label>
                                <textarea
                                    value={appealReason}
                                    onChange={(e) => setAppealReason(e.target.value)}
                                    placeholder="Explain the unexpected circumstances, institutional notice, or evidence supporting reconsideration..."
                                    rows={4}
                                    className="w-full p-3 rounded-xl border-2 border-black bg-white dark:bg-[#1a1a1a] text-xs font-bold text-black dark:text-white focus:outline-none"
                                    required
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2 border-t-2 border-black/10 dark:border-white/10">
                                <button
                                    type="button"
                                    onClick={() => setAppealTarget(null)}
                                    className="px-4 py-2 rounded-xl border-2 border-black bg-white text-xs font-black"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmittingAppeal}
                                    className="px-5 py-2 rounded-xl border-2 border-black bg-[#FFE566] text-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    {isSubmittingAppeal ? "Submitting..." : "Submit Appeal"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
