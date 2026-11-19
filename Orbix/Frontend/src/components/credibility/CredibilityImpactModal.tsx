import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    ShieldAlert,
    ShieldCheck,
    Clock,
    Users,
    ArrowRight,
    X,
    TrendingDown,
    TrendingUp,
    Minus,
    Info,
    Send,
    Activity,
} from "lucide-react";
import {
    previewCredibilityImpact,
    type CredibilityImpactPreview,
} from "../../api/clubCredibilityApi";
import { OrbixLoader } from "../ui/loader";
import { NeoSelect } from "../NeoSelect";

export interface CredibilityImpactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { reasonCategory: string }) => void;
    eventId: string;
    eventTitle: string;
    action: "cancel" | "delete" | "draft" | "complete";
    isSubmitting?: boolean;
}

const REASON_OPTIONS = [
    {
        value: "academic_clash",
        label: "Academic / College Institutional Clash",
        description: "Mandatory campus exam, institutional holiday, or faculty directive.",
    },
    {
        value: "operational_delay",
        label: "Operational / Speaker / Venue Delay",
        description: "Venue unreadiness, speaker unavailability, or technical obstacles.",
    },
    {
        value: "low_turnout",
        label: "Low Registration Turnout",
        description: "Insufficient student turnout to conduct the intended event program.",
    },
    {
        value: "emergency_verified",
        label: "Verified Emergency / Medical Incident",
        description: "Unexpected urgent emergency handled with responsible communication.",
    },
    {
        value: "weather_force_majeure",
        label: "Severe Weather / Force Majeure",
        description: "Unforeseen physical condition or natural hazard preventing safe assembly.",
    },
    {
        value: "short_notice",
        label: "Unexplained / Short-Notice Discretionary",
        description: "Discretionary cancellation without documented external constraints.",
    },
];

export const CredibilityImpactModal: React.FC<CredibilityImpactModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    eventId,
    eventTitle,
    action,
    isSubmitting = false,
}) => {
    const [loading, setLoading] = useState(true);
    const [preview, setPreview] = useState<CredibilityImpactPreview | null>(null);
    const [reasonCategory, setReasonCategory] = useState<string>("operational_delay");
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Fetch dynamic preview calculation whenever inputs change
    useEffect(() => {
        if (!isOpen || !eventId) return;

        let isMounted = true;
        setLoading(true);
        setFetchError(null);

        previewCredibilityImpact({
            eventId,
            action,
            reasonCategory,
            communicatedToAll: true,
            rescheduleOffered: false,
        })
            .then((data) => {
                if (isMounted) {
                    setPreview(data);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (isMounted) {
                    console.error("Failed to load credibility impact preview:", err);
                    setFetchError(err.response?.data?.message || err.message || "Failed to load live preview");
                    setLoading(false);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, eventId, action, reasonCategory]);

    if (!isOpen || typeof document === "undefined") return null;

    const isNegativeAction = action === "cancel" || action === "delete" || action === "draft";

    const getTitle = () => {
        switch (action) {
            case "cancel":
                return `Cancel "${eventTitle}"?`;
            case "delete":
                return `Permanently Delete "${eventTitle}"?`;
            case "draft":
                return `Move "${eventTitle}" to Draft?`;
            case "complete":
                return `Conclude Session for "${eventTitle}"?`;
        }
    };

    const getConfirmButtonText = () => {
        switch (action) {
            case "cancel":
                return "Confirm Cancellation";
            case "delete":
                return "Confirm Permanent Deletion";
            case "draft":
                return "Confirm Move to Draft";
            case "complete":
                return "Confirm Completion & Milestone";
        }
    };

    const getConfirmButtonClass = () => {
        if (action === "delete") {
            return "bg-rose-500 hover:bg-rose-600 text-white";
        }
        if (action === "cancel") {
            return "bg-[#FECDD3] hover:bg-[#fca5a5] text-rose-950";
        }
        if (action === "draft") {
            return "bg-[#FEF3C7] hover:bg-[#fde68a] text-amber-950";
        }
        return "bg-[#a2ff86] hover:bg-[#8cee70] text-black";
    };

    return createPortal(
        <div
            onClick={onClose}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[150] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm select-none animate-in fade-in duration-150"
        >
            <div
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-xl bg-[#FAF6EE] dark:bg-[#141414] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] max-h-[90vh] flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100"
            >
                {/* Header Row — Fixed / Pinned */}
                <div className="shrink-0 p-5 sm:p-6 pb-4 border-b-2 border-black/10 dark:border-white/10 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div
                            className={`w-11 h-11 rounded-2xl border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0 ${
                                isNegativeAction ? "bg-[#FECDD3] text-rose-950" : "bg-[#a2ff86] text-black"
                            }`}
                        >
                            {isNegativeAction ? (
                                <ShieldAlert className="w-6 h-6 stroke-[2.5]" />
                            ) : (
                                <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
                            )}
                        </div>
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black text-[#FFE566] border border-black shadow-[1px_1px_0px_#000] inline-block mb-1">
                                Potential Credibility Impact
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black dark:text-white tracking-tight line-clamp-1">
                                {getTitle()}
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="p-1.5 rounded-xl border-2 border-black bg-white dark:bg-neutral-800 text-black dark:text-white shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-neutral-100 shrink-0 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Modal Body — Independently Scrollable with generous bottom padding */}
                <div className="flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-5 pb-28">
                    {/* Subtitle / Context Note */}
                    <p className="text-xs sm:text-sm font-semibold text-neutral-600 dark:text-neutral-400 leading-relaxed">
                        {action === "cancel" && "Cancelling a published event affects your club's reputation based on advance notice, affected participants, and cancellation validity."}
                        {action === "delete" && "Deleting a published event removes the listing while preserving audit accountability in your credibility ledger."}
                        {action === "draft" && "Unpublishing a live event to draft removes it from campus feeds. Registrations received are retained."}
                        {action === "complete" && "Concluding this live session commits verified attendee records to your club's credibility track record."}
                    </p>

                    {/* Live Scoring Impact Card */}
                    {loading ? (
                        <div className="p-8 rounded-2xl border-2 border-black bg-white dark:bg-[#1c1c1c] shadow-[4px_4px_0px_#000] flex flex-col items-center justify-center gap-3">
                            <OrbixLoader size="sm" variant="centered" color="#000" />
                            <span className="text-xs font-black uppercase tracking-wider text-neutral-500">
                                Calculating dynamic credibility preview...
                            </span>
                        </div>
                    ) : fetchError ? (
                        <div className="p-4 rounded-2xl border-2 border-black bg-rose-50 text-rose-950 shadow-[3px_3px_0px_#000] text-xs font-bold">
                            {fetchError}
                        </div>
                    ) : preview ? (
                        <div className="space-y-4">
                            {/* Standardized 4-Stat Metric Matrix with consistent heights & typography */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                {/* Current Score */}
                                <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex flex-col justify-between min-h-[82px] h-full">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 h-5 flex items-center truncate">
                                        Current
                                    </span>
                                    <div className="text-lg sm:text-xl font-black text-black dark:text-white flex items-center gap-1.5 h-7">
                                        <Activity className="w-4 h-4 text-emerald-600 stroke-[2.5] shrink-0" />
                                        <span>
                                            {Math.round(preview.currentScore)}
                                            <span className="text-xs text-neutral-400 font-bold">/100</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Estimated Impact */}
                                <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex flex-col justify-between min-h-[82px] h-full">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 h-5 flex items-center truncate">
                                        Estimated Impact
                                    </span>
                                    <div className="text-lg sm:text-xl font-black flex items-center gap-1.5 h-7">
                                        {preview.estimatedDelta < 0 ? (
                                            <TrendingDown className="w-4 h-4 text-rose-600 stroke-[3] shrink-0" />
                                        ) : preview.estimatedDelta > 0 ? (
                                            <TrendingUp className="w-4 h-4 text-emerald-600 stroke-[3] shrink-0" />
                                        ) : (
                                            <Minus className="w-4 h-4 text-neutral-400 stroke-[3] shrink-0" />
                                        )}
                                        <span
                                            className={
                                                preview.estimatedDelta < 0
                                                    ? "text-rose-600 dark:text-rose-400"
                                                    : preview.estimatedDelta > 0
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-black dark:text-white"
                                            }
                                        >
                                            {preview.estimatedRange}
                                        </span>
                                    </div>
                                </div>

                                {/* Affected Registrations */}
                                <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex flex-col justify-between min-h-[82px] h-full">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 h-5 flex items-center truncate">
                                        Affected
                                    </span>
                                    <div className="text-lg sm:text-xl font-black text-black dark:text-white flex items-center gap-1.5 h-7">
                                        <Users className="w-4 h-4 text-sky-600 stroke-[2.5] shrink-0" />
                                        <span>{preview.affectedParticipants}</span>
                                    </div>
                                </div>

                                {/* Advance Notice */}
                                <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] flex flex-col justify-between min-h-[82px] h-full">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 h-5 flex items-center truncate">
                                        Advance Notice
                                    </span>
                                    <div className="text-lg sm:text-xl font-black text-black dark:text-white flex items-center gap-1.5 h-7">
                                        <Clock className="w-4 h-4 text-amber-600 stroke-[2.5] shrink-0" />
                                        <span>
                                            {preview.hoursNotice !== undefined
                                                ? preview.hoursNotice >= 24
                                                    ? `${Math.round(preview.hoursNotice / 24)}d`
                                                    : `${Math.round(preview.hoursNotice)}h`
                                                : "N/A"}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Factors Breakdown */}
                            {preview.factors && preview.factors.length > 0 && (
                                <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-2">
                                    <h5 className="text-[11px] font-black uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Factors Influencing Your Standing:</span>
                                    </h5>
                                    <ul className="space-y-1 text-xs font-bold text-neutral-600 dark:text-neutral-400">
                                        {preview.factors.map((f, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-black dark:bg-white mt-1.5 shrink-0" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Reason Category Selector for Cancellations */}
                            {(action === "cancel" || action === "delete") && (
                                <div className="space-y-3 pt-1">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black dark:text-white mb-1.5">
                                            Reason for Cancellation / Removal:
                                        </label>
                                        <NeoSelect
                                            value={reasonCategory}
                                            onChange={(val) => setReasonCategory(val)}
                                            size="sm"
                                            placement="auto"
                                            options={REASON_OPTIONS.map((opt) => ({
                                                value: opt.value,
                                                label: opt.label,
                                                description: opt.description,
                                            }))}
                                        />
                                    </div>

                                    {/* Automatic Dispatch Notification Info Banner */}
                                    <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                        <div className="w-5 h-5 rounded-lg bg-[#FFE566] text-black border border-black flex items-center justify-center shrink-0 mt-0.5 shadow-[1px_1px_0px_#000]">
                                            <Send className="w-3 h-3 stroke-[2.5]" />
                                        </div>
                                        <div className="space-y-0.5">
                                            <p className="text-xs font-black text-black dark:text-white">
                                                Automatic Participant Notification
                                            </p>
                                            <p className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400 leading-snug">
                                                Urgent in-app alerts and official cancellation emails will be automatically dispatched to all registered applicants specifying this cancellation reason.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </div>

                {/* Footer Buttons — Fixed / Pinned at bottom, NEVER gets hidden or covered */}
                <div className="shrink-0 p-4 sm:p-5 border-t-2 border-black/10 dark:border-white/10 bg-[#FAF6EE] dark:bg-[#141414] z-20 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="w-full sm:w-auto px-5 py-2.5 rounded-xl border-2 border-black bg-white dark:bg-neutral-800 hover:bg-neutral-100 text-xs sm:text-sm font-black text-black dark:text-white shadow-[2.5px_2.5px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        Go Back
                    </button>

                    <button
                        type="button"
                        onClick={() =>
                            onConfirm({
                                reasonCategory,
                            })
                        }
                        disabled={loading || isSubmitting}
                        className={`w-full sm:w-auto px-6 py-2.5 rounded-xl border-2 border-black text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2 ${getConfirmButtonClass()}`}
                    >
                        {isSubmitting ? (
                            <>
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-black border-t-transparent animate-spin shrink-0" />
                                <span>Processing...</span>
                            </>
                        ) : (
                            <>
                                <span>{getConfirmButtonText()}</span>
                                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};
