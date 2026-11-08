import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    AlertTriangle,
    Lock,
    Eye,
    EyeOff,
    Check,
    X,
    ShieldAlert,
    Bell,
} from "lucide-react";
import type { ClubEvent } from "../../store/clubEventsSlice";
import { OrbixLoader } from "../../components/ui/loader";

export interface EventSecurityConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: ClubEvent | null;
    action: "draft" | "cancelled" | "delete" | null;
    onConfirm: (password: string, confirmationText: string, emergencyBypass?: boolean) => Promise<void>;
}

export const EventSecurityConfirmModal: React.FC<EventSecurityConfirmModalProps> = ({
    isOpen,
    onClose,
    event,
    action,
    onConfirm,
}) => {
    const [confirmationInput, setConfirmationInput] = useState("");
    const [passwordInput, setPasswordInput] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [emergencyBypass, setEmergencyBypass] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const eventTitle = (event?.title || "").trim();
    const expectedPhrase = `delete ${eventTitle}`;
    const isPhraseMatched =
        confirmationInput.trim().toLowerCase() === expectedPhrase.toLowerCase();

    // 4-Hour cancellation policy check
    const startsAtMs = event?.startsAt ? new Date(event.startsAt).getTime() : 0;
    const nowMs = Date.now();
    const hoursRemaining = (startsAtMs - nowMs) / (1000 * 60 * 60);
    const isCancellingLiveEvent = action === "cancelled" && event?.status === "published";
    const isWithinFourHours = isCancellingLiveEvent && hoursRemaining > 0 && hoursRemaining < 4;

    const canSubmit =
        isPhraseMatched &&
        passwordInput.length > 0 &&
        (!isWithinFourHours || emergencyBypass) &&
        !submitting;

    useEffect(() => {
        if (isOpen) {
            setConfirmationInput("");
            setPasswordInput("");
            setShowPassword(false);
            setEmergencyBypass(false);
            setSubmitting(false);
            setErrorMessage(null);
        }
    }, [isOpen]);

    if (!isOpen || !event || !action) return null;

    const actionMeta = {
        draft: {
            title: "Security Confirmation: Move Event to Draft",
            badge: "Unpublish Event",
            badgeColor: "bg-amber-100 text-amber-950 border-amber-900",
            warning:
                "Moving this event to Draft will immediately unpublish it from the campus directory, stop public registrations, and hide the live event page from students.",
            buttonText: "Confirm & Move to Draft",
            buttonColor: "bg-amber-300 hover:bg-amber-400 text-black",
        },
        cancelled: {
            title: "Security Confirmation: Cancel Event",
            badge: "Mark as Cancelled",
            badgeColor: "bg-rose-100 text-rose-950 border-rose-900",
            warning:
                "Cancelling this event will display it as CANCELLED across the campus directory and notify registered students that the event is called off.",
            buttonText: "Confirm & Cancel Event",
            buttonColor: "bg-rose-300 hover:bg-rose-400 text-black",
        },
        delete: {
            title: "Security Confirmation: Permanently Delete Event",
            badge: "Destructive Action",
            badgeColor: "bg-red-100 text-red-950 border-red-900",
            warning:
                "Permanently deleting this event will erase the event record, RSVP link, applications, and QR code pass permanently. This action cannot be undone.",
            buttonText: "Confirm & Permanently Delete",
            buttonColor: "bg-red-500 hover:bg-red-600 text-white",
        },
    }[action];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!canSubmit) return;

        setSubmitting(true);
        setErrorMessage(null);

        try {
            await onConfirm(passwordInput, confirmationInput.trim(), emergencyBypass);
            onClose();
        } catch (err: any) {
            setErrorMessage(
                err?.message ||
                    "Authentication failed. Please verify your club account password and try again."
            );
        } finally {
            setSubmitting(false);
        }
    };

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm select-none">
            <div
                className="w-full max-w-lg bg-[#FAF6EE] border-3 border-black rounded-3xl shadow-[8px_8px_0px_#000] p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200 text-black max-h-[90vh] overflow-y-auto"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[#FFE566] border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                            <ShieldAlert className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div>
                            <span
                                className={`text-[10px] font-black uppercase px-2 py-0.5 rounded border ${actionMeta.badgeColor}`}
                            >
                                {actionMeta.badge}
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black leading-tight mt-1">
                                {actionMeta.title}
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        disabled={submitting}
                        className="p-1.5 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[1px_1px_0px_#000] cursor-pointer"
                        title="Close"
                    >
                        <X className="w-4 h-4 stroke-[2.5]" />
                    </button>
                </div>

                {/* Warning Card */}
                <div className="p-3.5 rounded-2xl bg-amber-50 border-2 border-amber-900/60 flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-xs font-bold text-amber-950 leading-relaxed">
                        {actionMeta.warning}
                    </p>
                </div>

                {/* Live Cancellation Warnings: Campus Broadcast & 4-Hour Policy Notice */}
                {isCancellingLiveEvent && (
                    <div className="space-y-3">
                        <div className="p-3.5 rounded-2xl bg-sky-50 border-2 border-black/30 flex items-start gap-3 shadow-[1.5px_1.5px_0px_#000]">
                            <Bell className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                            <p className="text-xs font-bold text-sky-950 leading-relaxed">
                                <strong>Campus Notification Broadcast:</strong> Cancelling this published event will immediately dispatch cancellation notifications to the club and all registered students & campus members of your college.
                            </p>
                        </div>

                        {isWithinFourHours && (
                            <div className="p-3.5 rounded-2xl bg-rose-100 border-2 border-rose-900 shadow-[2px_2px_0px_#000] space-y-2.5">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-rose-700 stroke-[2.5]" />
                                    <span className="text-xs font-black uppercase tracking-wider text-rose-950">
                                        Minimum 4-Hour Cancellation Policy Limit
                                    </span>
                                </div>
                                <p className="text-xs font-bold text-rose-950 leading-relaxed">
                                    This event starts in{" "}
                                    <span className="underline font-black text-black">
                                        {Math.max(1, Math.ceil(hoursRemaining * 60))} minutes
                                    </span>
                                    . Orbix requires a minimum 4-hour advance cancellation limit to prevent disruption to registered students.
                                </p>
                                <label className="flex items-start gap-2 pt-1 text-xs font-black text-rose-950 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={emergencyBypass}
                                        onChange={(e) => setEmergencyBypass(e.target.checked)}
                                        className="mt-0.5 w-4 h-4 rounded border-2 border-black accent-black cursor-pointer"
                                    />
                                    <span>I confirm this is an urgent emergency cancellation. Please alert all registered students immediately.</span>
                                </label>
                            </div>
                        )}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Error message alert */}
                    {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-100 border-2 border-rose-900 text-xs font-black text-rose-950 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-700 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Step 1: Confirmation phrase */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            1. Type Confirmation Phrase
                        </label>
                        <p className="text-xs text-neutral-600 font-medium">
                            To authorize this action, type{" "}
                            <span className="font-mono font-black bg-black text-[#FFE566] px-2 py-0.5 rounded text-xs select-all">
                                {expectedPhrase}
                            </span>{" "}
                            below:
                        </p>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                value={confirmationInput}
                                onChange={(e) => setConfirmationInput(e.target.value)}
                                placeholder={`Type "${expectedPhrase}"`}
                                disabled={submitting}
                                className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-black text-black focus:outline-hidden transition-all shadow-[2px_2px_0px_#000] ${
                                    confirmationInput.length === 0
                                        ? "border-black"
                                        : isPhraseMatched
                                        ? "border-emerald-600 bg-emerald-50/50"
                                        : "border-rose-500 bg-rose-50/40"
                                }`}
                            />
                            {isPhraseMatched && (
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-600">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                    Matched
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Step 2: Club Account Password */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            2. Enter Club Account Password
                        </label>
                        <p className="text-xs text-neutral-600 font-medium">
                            Verify your club coordinator password to execute this change.
                        </p>
                        <div className="relative">
                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                                <Lock className="w-4 h-4 stroke-[2.2]" />
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                required
                                value={passwordInput}
                                onChange={(e) => setPasswordInput(e.target.value)}
                                placeholder="Enter your club password"
                                disabled={submitting}
                                className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[2px_2px_0px_#000]"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black p-1"
                                title={showPassword ? "Hide password" : "Show password"}
                            >
                                {showPassword ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                    <Eye className="w-3.5 h-3.5" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-2 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={submitting}
                            className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={!canSubmit}
                            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer flex items-center gap-2 ${
                                actionMeta.buttonColor
                            } ${
                                !canSubmit
                                    ? "opacity-50 cursor-not-allowed shadow-[1px_1px_0px_#000]"
                                    : "active:translate-x-[1px] active:translate-y-[1px]"
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <OrbixLoader size="xs" variant="inline" color="currentColor" />
                                    <span>Verifying...</span>
                                </>
                            ) : (
                                <span>{actionMeta.buttonText}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};
