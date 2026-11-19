import React, { useState, useEffect } from "react";
import {
    X,
    Clock,
    AlertTriangle,
    ShieldAlert,
    CheckCircle2,
    Calendar,
    Award,
    Globe2,
    GraduationCap,
    Lock,
    Sparkles,
} from "lucide-react";
import type { ClubEventCreationEligibility } from "../../api/clubCredibilityApi";

export interface EventCooldownWarningModalProps {
    isOpen: boolean;
    onClose: () => void;
    scope: "PAN_INDIA" | "CAMPUS";
    eligibility: ClubEventCreationEligibility | null;
    collegeName?: string | null;
}

interface TimeParts {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

function breakDownRemaining(ms: number): TimeParts {
    if (ms <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return { days, hours, minutes, seconds };
}

function padTwo(n: number): string {
    return n.toString().padStart(2, "0");
}

export const EventCooldownWarningModal: React.FC<EventCooldownWarningModalProps> = ({
    isOpen,
    onClose,
    scope,
    eligibility,
    collegeName,
}) => {
    const [now, setNow] = useState<number>(Date.now());

    // Ticking real-time clock
    useEffect(() => {
        if (!isOpen) return;
        const interval = setInterval(() => {
            setNow(Date.now());
        }, 1000);
        return () => clearInterval(interval);
    }, [isOpen]);

    if (!isOpen) return null;

    const isPanIndia = scope === "PAN_INDIA";
    const scopeData = isPanIndia ? eligibility?.panIndia : eligibility?.campus;

    const cooldownExpiresAtMs = scopeData?.cooldownExpiresAt
        ? new Date(scopeData.cooldownExpiresAt).getTime()
        : null;

    const remainingMs = cooldownExpiresAtMs ? Math.max(0, cooldownExpiresAtMs - now) : 0;
    const inCooldown = remainingMs > 0;
    const timeParts = breakDownRemaining(remainingMs);

    const unlockFormattedDate = cooldownExpiresAtMs
        ? new Date(cooldownExpiresAtMs).toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : "Available immediately";

    const minRequiredScore = isPanIndia ? 50 : 20;
    const currentScore = eligibility?.currentScore ?? 50;
    const scorePassed = scopeData ? scopeData.scorePassed : true;
    const scoreDeficit = scopeData ? scopeData.scoreDeficit : 0;

    const cooldownRuleLabel = isPanIndia
        ? "3 Days (72 Hours) National Cooldown"
        : "12 Hours Campus Cooldown";

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/65 backdrop-blur-md animate-fade-in"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="relative w-full max-w-2xl bg-[#FAF6EE] rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] overflow-hidden my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header Strip with Accent Ribbon */}
                <div
                    className={`px-6 py-4 border-b-3 border-black flex items-center justify-between ${
                        isPanIndia ? "bg-[#FF9933]" : "bg-[#38BDF8]"
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black">
                            {isPanIndia ? (
                                <Globe2 className="w-5 h-5 stroke-[2.5]" />
                            ) : (
                                <GraduationCap className="w-5 h-5 stroke-[2.5]" />
                            )}
                        </div>
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest text-black/80 block">
                                {isPanIndia ? "National Reach Architecture" : "Campus Exclusive Architecture"}
                            </span>
                            <h3 className="text-base sm:text-lg font-black text-black leading-tight">
                                {isPanIndia ? "Pan-India Event Notice" : "Campus Event Notice"}
                            </h3>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black transition-all active:translate-x-[1px] active:translate-y-[1px]"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>

                <div className="p-5 sm:p-7 space-y-6">
                    {/* Primary Highlight: Live Countdown Clock or Status Warning */}
                    {inCooldown ? (
                        <div className="p-5 rounded-2xl bg-amber-50 border-3 border-black shadow-[4px_4px_0px_#000] text-center">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-xs font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000] mb-3">
                                <Clock className="w-4 h-4 text-black animate-spin" style={{ animationDuration: "8s" }} />
                                Creation Cooldown Active
                            </div>

                            <p className="text-xs sm:text-sm font-bold text-neutral-700 max-w-lg mx-auto">
                                You recently published an event. To safeguard event quality, reduce feed clutter, and uphold community credibility, a waiting duration is enforced.
                            </p>

                            {/* Prominent Digital Countdown Box */}
                            <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3 max-w-md mx-auto">
                                <div className="p-2 sm:p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <div className="text-2xl sm:text-3xl font-black text-black tabular-nums">
                                        {padTwo(timeParts.days)}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                                        Days
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <div className="text-2xl sm:text-3xl font-black text-black tabular-nums">
                                        {padTwo(timeParts.hours)}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                                        Hours
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <div className="text-2xl sm:text-3xl font-black text-black tabular-nums">
                                        {padTwo(timeParts.minutes)}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                                        Mins
                                    </div>
                                </div>
                                <div className="p-2 sm:p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                                    <div className="text-2xl sm:text-3xl font-black text-amber-600 tabular-nums">
                                        {padTwo(timeParts.seconds)}
                                    </div>
                                    <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                                        Secs
                                    </div>
                                </div>
                            </div>

                            {/* Unlock Date & Time Marker */}
                            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border-2 border-black text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]">
                                <Calendar className="w-4 h-4 text-neutral-700" />
                                <span>Unlocks on: {unlockFormattedDate}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 rounded-2xl bg-emerald-50 border-3 border-black shadow-[3px_3px_0px_#000] flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-400 border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center shrink-0">
                                <CheckCircle2 className="w-6 h-6 text-black stroke-[2.5]" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-black">
                                    No Cooldown Active
                                </h4>
                                <p className="text-xs font-bold text-neutral-600 mt-0.5">
                                    Your club is clear of the {cooldownRuleLabel.toLowerCase()}.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Credibility Score Guard Status */}
                    {!scorePassed ? (
                        <div className="p-4 sm:p-5 rounded-2xl bg-rose-50 border-3 border-black shadow-[4px_4px_0px_#000]">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-300 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                                    <ShieldAlert className="w-5 h-5 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1">
                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-200 border border-black text-[10px] font-black uppercase tracking-wider text-rose-950">
                                        <Lock className="w-3 h-3 text-rose-800" />
                                        Credibility Requirement Not Met
                                    </div>
                                    <h4 className="text-base font-black text-black">
                                        Requires Credibility Score of {minRequiredScore}.0 or Higher
                                    </h4>
                                    <p className="text-xs font-medium text-neutral-700 leading-relaxed">
                                        Your club currently holds a credibility score of{" "}
                                        <span className="font-black text-black">{currentScore.toFixed(1)} / 100</span>.
                                        You require{" "}
                                        <span className="font-black text-rose-700">+{scoreDeficit.toFixed(1)} additional points</span>{" "}
                                        to unlock {isPanIndia ? "Pan-India national competitions" : "Campus event hosting"}.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between text-xs font-bold">
                            <span className="text-neutral-600">Club Credibility Score:</span>
                            <span className="inline-flex items-center gap-1 font-black text-emerald-700">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                {currentScore.toFixed(1)} / 100 (Passes {minRequiredScore}.0 threshold)
                            </span>
                        </div>
                    )}

                    {/* Operational Rules Card */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <h4 className="text-xs sm:text-sm font-black text-black flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 text-amber-600" />
                            <span>Orbix Integrity Rule & Duration Policy</span>
                        </h4>
                        <div className="space-y-2 text-xs font-medium text-neutral-700">
                            {isPanIndia ? (
                                <>
                                    <p className="leading-relaxed">
                                        • <strong>3-Day (72-Hour) Cooldown:</strong> Pan-India events connect students across all verified Indian colleges. To guarantee organizers have time to market, coordinate registrations, and prepare venue logistics, a mandatory 3-day buffer is placed between consecutive Pan-India events.
                                    </p>
                                    <p className="leading-relaxed">
                                        • <strong>Score 50.0 Barrier:</strong> All registered clubs start with 50.0 points. Maintaining this score requires delivering on scheduled events without late cancellations or negative attendee incident reports.
                                    </p>
                                </>
                            ) : (
                                <>
                                    <p className="leading-relaxed">
                                        • <strong>12-Hour Cooldown:</strong> Campus events hosted within {collegeName || "your college"} have a 12-hour duration requirement between event creations. This prevents duplicate event listings and protects student attention.
                                    </p>
                                    <p className="leading-relaxed">
                                        • <strong>Score 20.0 Barrier:</strong> Clubs falling below 20.0 points are restricted from creating campus events until past complaints and administrative audits are resolved.
                                    </p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Actionable Productivity Tips While Waiting */}
                    <div className="space-y-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500 block">
                            Recommended Actions While In Waiting Window:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-xs font-black text-black">Draft Event Poster & Brief</h5>
                                    <p className="text-[11px] text-neutral-600 font-medium mt-0.5">
                                        Finalize speaker bios, problem statements, and banner artwork.
                                    </p>
                                </div>
                            </div>
                            <div className="p-3 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                <Award className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <h5 className="text-xs font-black text-black">Issue Student Certificates</h5>
                                    <p className="text-[11px] text-neutral-600 font-medium mt-0.5">
                                        Certify past attendees to boost your credibility score streak.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Action */}
                <div className="px-6 py-4 bg-white border-t-2 border-black/10 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold text-neutral-500">
                        {inCooldown
                            ? `Remaining: ${timeParts.days}d ${timeParts.hours}h ${timeParts.minutes}m ${timeParts.seconds}s`
                            : "Creation allowed"}
                    </span>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    );
};
