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
    Info,
} from "lucide-react";
import {
    previewCredibilityImpact,
    type CredibilityImpactPreview,
} from "../../api/clubCredibilityApi";
import { OrbixLoader } from "../ui/loader";

export interface CredibilityImpactModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: { reasonCategory: string; communicatedToAll: boolean; rescheduleOffered: boolean }) => void;
    eventId: string;
    eventTitle: string;
    action: "cancel" | "delete" | "draft" | "complete";
    isSubmitting?: boolean;
}

const REASON_OPTIONS = [
    { value: "emergency_verified", label: "Verified Emergency / Medical Incident", description: "Unexpected urgent emergency handled with responsible communication." },
    { value: "weather_force_majeure", label: "Severe Weather / Force Majeure", description: "Unforeseen physical condition or natural hazard preventing safe assembly." },
    { value: "academic_institutional", label: "Academic / College Institutional Clash", description: "Mandatory campus exam, institutional holiday, or faculty directive." },
    { value: "operational_delay", label: "Operational / Speaker / Venue Delay", description: "Venue unreadiness, speaker unavailability, or technical obstacles." },
    { value: "low_registration", label: "Low Registration Turnout", description: "Insufficient student turnout to conduct the intended event program." },
    { value: "unexplained", label: "Unexplained / Short-Notice Discretionary", description: "Discretionary cancellation without documented external constraints." },
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
    const [communicatedToAll, setCommunicatedToAll] = useState(true);
    const [rescheduleOffered, setRescheduleOffered] = useState(false);
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
            communicatedToAll,
            rescheduleOffered,
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
    }, [isOpen, eventId, action, reasonCategory, communicatedToAll, rescheduleOffered]);

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
                className="w-full max-w-xl bg-[#FAF6EE] dark:bg-[#141414] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-7 space-y-5 max-h-[90vh] overflow-y-auto text-neutral-900 dark:text-neutral-100"
            >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10 dark:border-white/10">
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
                        {/* 4-Stat Metric Matrix */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {/* Current Score */}
                            <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Current</span>
                                <div className="text-lg sm:text-xl font-black text-black dark:text-white">
                                    {Math.round(preview.currentScore)}
                                    <span className="text-xs text-neutral-400 font-bold">/100</span>
                                </div>
                            </div>

                            {/* Estimated Impact */}
                            <div
                                className={`p-3 rounded-2xl border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1 ${
                                    preview.estimatedDelta < 0
                                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-950 dark:text-rose-200"
                                        : preview.estimatedDelta > 0
                                        ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-950 dark:text-emerald-200"
                                        : "bg-neutral-50 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider opacity-75">Estimated Impact</span>
                                <div className="text-lg sm:text-xl font-black flex items-center gap-1">
                                    {preview.estimatedDelta < 0 ? (
                                        <TrendingDown className="w-4 h-4 text-rose-600 stroke-[3]" />
                                    ) : preview.estimatedDelta > 0 ? (
                                        <TrendingUp className="w-4 h-4 text-emerald-600 stroke-[3]" />
                                    ) : null}
                                    <span>{preview.estimatedRange}</span>
                                </div>
                            </div>

                            {/* Affected Registrations */}
                            <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Affected</span>
                                <div className="text-lg sm:text-xl font-black text-black dark:text-white flex items-center gap-1.5">
                                    <Users className="w-4 h-4 text-sky-600 stroke-[2.5]" />
                                    <span>{preview.affectedParticipants}</span>
                                </div>
                            </div>

                            {/* Notice Window */}
                            <div className="p-3 rounded-2xl bg-white dark:bg-[#1a1a1a] border-2 border-black shadow-[2.5px_2.5px_0px_#000] space-y-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Advance Notice</span>
                                <div className="text-sm sm:text-base font-black text-black dark:text-white flex items-center gap-1 mt-0.5">
                                    <Clock className="w-3.5 h-3.5 text-amber-600 stroke-[2.5]" />
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
                            <div className="space-y-2 pt-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black dark:text-white">
                                    Reason for Cancellation / Removal:
                                </label>
                                <select
                                    value={reasonCategory}
                                    onChange={(e) => setReasonCategory(e.target.value)}
                                    className="w-full px-3.5 py-2.5 rounded-xl border-2 border-black bg-white dark:bg-[#1a1a1a] text-xs font-bold text-black dark:text-white shadow-[2px_2px_0px_#000] focus:outline-none cursor-pointer"
                                >
                                    {REASON_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </option>
                                    ))}
                                </select>

                                {/* Additional Remedies Checkboxes */}
                                <div className="space-y-2 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-neutral-800 dark:text-neutral-200">
                                        <input
                                            type="checkbox"
                                            checked={communicatedToAll}
                                            onChange={(e) => setCommunicatedToAll(e.target.checked)}
                                            className="w-4 h-4 rounded border-2 border-black text-black focus:ring-0 cursor-pointer"
                                        />
                                        <span>Dispatch urgent notification email to all {preview.affectedParticipants} registered students</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer text-xs font-black text-neutral-800 dark:text-neutral-200">
                                        <input
                                            type="checkbox"
                                            checked={rescheduleOffered}
                                            onChange={(e) => setRescheduleOffered(e.target.checked)}
                                            className="w-4 h-4 rounded border-2 border-black text-black focus:ring-0 cursor-pointer"
                                        />
                                        <span>Offer automatic priority pass rollover when session is rescheduled (+10% remedy credit)</span>
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                ) : null}

                {/* Footer Buttons */}
                <div className="pt-2 border-t-2 border-black/10 dark:border-white/10 flex flex-col-reverse sm:flex-row items-center justify-between gap-3">
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
                                communicatedToAll,
                                rescheduleOffered,
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
