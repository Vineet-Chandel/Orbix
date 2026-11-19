import React, { useState, useEffect } from "react";
import {
    X,
    Globe2,
    GraduationCap,
    CheckCircle2,
    Sparkles,
    ShieldCheck,
    Building2,
    ArrowRight,
    Clock,
    Lock,
    ShieldAlert,
    Calendar,
} from "lucide-react";
import {
    fetchEventCreationEligibility,
    fetchAudiencePoolSizes,
    type ClubEventCreationEligibility,
    type AudiencePoolSizes,
} from "../../api/clubCredibilityApi";
import { IndiaMapBackdrop, CampusPillarsBackdrop } from "../../components/ScopeBackdrops";
import { EventCooldownWarningModal } from "./EventCooldownWarningModal";

export interface EventScopeSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectScope: (scope: "PAN_INDIA" | "CAMPUS") => void;
    collegeName?: string | null;
    collegeId?: string | null;
    initialEligibility?: ClubEventCreationEligibility | null;
}

/**
 * Format numeric counts matching YouTube subscriber conventions:
 * - < 1,000: exact count (e.g. 3, 394, 850)
 * - 1,000 - 999,999: compact K (e.g. 1.2K, 1.4K, 1.6K, 14.2K, 100K)
 * - 1,000,000+: compact M (e.g. 1.2M, 1.4M, 25M)
 * Truncation aligns with standard subscriber milestone counters.
 */
export function formatYouTubeSubscriberCount(count: number | null | undefined): string {
    if (count == null || isNaN(count) || count < 0) return "0";
    if (count < 1000) return count.toLocaleString();
    if (count < 1_000_000) {
        const k = Math.floor(count / 100) / 10;
        return k >= 100 ? `${Math.floor(count / 1000)}K` : `${k.toFixed(1).replace(/\.0$/, "")}K`;
    }
    if (count < 1_000_000_000) {
        const m = Math.floor(count / 100_000) / 10;
        return m >= 100 ? `${Math.floor(count / 1_000_000)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
    }
    const b = Math.floor(count / 100_000_000) / 10;
    return `${b.toFixed(1).replace(/\.0$/, "")}B`;
}

interface AudiencePoolBadgeProps {
    count: number | null | undefined;
    label?: string;
    scope: "PAN_INDIA" | "CAMPUS";
    collegeName?: string | null;
    isLoading?: boolean;
}

const AudiencePoolBadge: React.FC<AudiencePoolBadgeProps> = ({
    count,
    label = "Pool Size",
    scope,
    collegeName,
    isLoading = false,
}) => {
    const isPanIndia = scope === "PAN_INDIA";
    const formatted = formatYouTubeSubscriberCount(count ?? 0);
    const tooltip = isPanIndia
        ? `${(count ?? 0).toLocaleString()} total registered students across all colleges in India`
        : `${(count ?? 0).toLocaleString()} registered students from ${collegeName || "your college"}`;

    return (
        <div
            className={`shrink-0 flex flex-col items-center justify-center px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] transition-all hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 min-w-[68px] sm:min-w-[80px] select-none ${
                isPanIndia
                    ? "bg-amber-50/90 hover:bg-amber-100/90 text-amber-950"
                    : "bg-sky-50/90 hover:bg-sky-100/90 text-sky-950"
            }`}
            title={tooltip}
            aria-label={`${label}: ${formatted}`}
        >
            {isLoading && (count === undefined || count === null) ? (
                <div className="h-4 sm:h-5 w-8 bg-black/10 rounded animate-pulse my-0.5" />
            ) : (
                <span className="text-base sm:text-lg font-black tracking-tight leading-none text-black tabular-nums">
                    {formatted}
                </span>
            )}
            <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-600 mt-1 leading-none">
                {label}
            </span>
        </div>
    );
};

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

interface CreationCooldownCardProps {
    timeParts: TimeParts;
    unlockFormattedDate: string;
    onViewWarningModal: () => void;
}

const CreationCooldownCard: React.FC<CreationCooldownCardProps> = ({
    timeParts,
    unlockFormattedDate,
    onViewWarningModal,
}) => {
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onViewWarningModal();
            }}
            className="mt-3 p-4 sm:p-5 rounded-2xl bg-amber-50 border-3 border-black shadow-[4px_4px_0px_#000] text-center transition-all hover:bg-amber-100/70 cursor-pointer"
        >
            {/* Header: Badge & View Warning Modal URL */}
            <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                    <Clock
                        className="w-3.5 h-3.5 text-black animate-spin"
                        style={{ animationDuration: "8s" }}
                    />
                    <span>Creation Cooldown Active</span>
                </div>

                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onViewWarningModal();
                    }}
                    className="text-[10px] sm:text-[11px] uppercase underline text-amber-900 hover:text-black font-black transition-colors cursor-pointer"
                >
                    View Warning Modal →
                </button>
            </div>

            {/* Narrative Context */}
            <p className="text-[11px] sm:text-xs font-bold text-neutral-700 leading-relaxed max-w-md mx-auto">
                You recently published an event. To safeguard event quality, reduce feed clutter, and uphold community credibility, a waiting duration is enforced.
            </p>

            {/* Prominent Digital Countdown Box */}
            <div className="mt-3.5 grid grid-cols-4 gap-2 max-w-sm mx-auto">
                <div className="p-2 sm:p-2.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                    <div className="text-xl sm:text-2xl font-black text-black tabular-nums">
                        {padTwo(timeParts.days)}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                        Days
                    </div>
                </div>
                <div className="p-2 sm:p-2.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                    <div className="text-xl sm:text-2xl font-black text-black tabular-nums">
                        {padTwo(timeParts.hours)}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                        Hours
                    </div>
                </div>
                <div className="p-2 sm:p-2.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                    <div className="text-xl sm:text-2xl font-black text-black tabular-nums">
                        {padTwo(timeParts.minutes)}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                        Mins
                    </div>
                </div>
                <div className="p-2 sm:p-2.5 bg-white rounded-xl border-2 border-black shadow-[2px_2px_0px_#000]">
                    <div className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums">
                        {padTwo(timeParts.seconds)}
                    </div>
                    <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-wider text-neutral-500 mt-0.5">
                        Secs
                    </div>
                </div>
            </div>

            {/* Unlock Date & Time Marker */}
            <div className="mt-3.5 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border-2 border-black text-[10px] sm:text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]">
                <Calendar className="w-3.5 h-3.5 text-neutral-700 shrink-0" />
                <span>Unlocks on: {unlockFormattedDate}</span>
            </div>
        </div>
    );
};

export const EventScopeSelectionModal: React.FC<EventScopeSelectionModalProps> = ({
    isOpen,
    onClose,
    onSelectScope,
    collegeName,
    initialEligibility,
}) => {
    const [now, setNow] = useState<number>(Date.now());
    const [eligibility, setEligibility] = useState<ClubEventCreationEligibility | null>(
        initialEligibility || null
    );
    const [poolSizes, setPoolSizes] = useState<AudiencePoolSizes | null>(
        initialEligibility?.audiencePool || null
    );
    const [isPoolLoading, setIsPoolLoading] = useState<boolean>(!initialEligibility?.audiencePool);
    const [warningScope, setWarningScope] = useState<"PAN_INDIA" | "CAMPUS" | null>(null);

    // Fetch fresh centralized eligibility & real-time audience pool sizes on modal open
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        setIsPoolLoading(true);

        fetchEventCreationEligibility()
            .then((res) => {
                if (isMounted && res?.eligibility) {
                    setEligibility(res.eligibility);
                    if (res.eligibility.audiencePool) {
                        setPoolSizes(res.eligibility.audiencePool);
                        setIsPoolLoading(false);
                    }
                }
            })
            .catch((err) => {
                console.error("Failed to load event creation eligibility:", err);
            });

        // Dedicated fallback query to ensure audience pools always hydrate
        fetchAudiencePoolSizes()
            .then((res) => {
                if (isMounted && res?.audiencePool) {
                    setPoolSizes(res.audiencePool);
                    setIsPoolLoading(false);
                }
            })
            .catch((err) => {
                console.warn("Fallback audience pool fetch note:", err);
                if (isMounted) setIsPoolLoading(false);
            });

        const timer = setInterval(() => {
            setNow(Date.now());
        }, 1000);

        return () => {
            isMounted = false;
            clearInterval(timer);
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // Pan India live calculations (3 days / 72 hours cooldown)
    const panIndiaExpiresAtMs = eligibility?.panIndia?.cooldownExpiresAt
        ? new Date(eligibility.panIndia.cooldownExpiresAt).getTime()
        : null;
    const panIndiaRemainingMs = panIndiaExpiresAtMs ? Math.max(0, panIndiaExpiresAtMs - now) : 0;
    const panIndiaInCooldown = panIndiaRemainingMs > 0;
    const panIndiaScorePassed = eligibility ? eligibility.panIndia.scorePassed : true;
    const panIndiaEligible = eligibility ? (panIndiaScorePassed && !panIndiaInCooldown) : true;
    const panIndiaTimeParts = breakDownRemaining(panIndiaRemainingMs);
    const panIndiaUnlockFormattedDate = panIndiaExpiresAtMs
        ? new Date(panIndiaExpiresAtMs).toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : "Available immediately";

    // Campus live calculations (12 hours cooldown)
    const campusExpiresAtMs = eligibility?.campus?.cooldownExpiresAt
        ? new Date(eligibility.campus.cooldownExpiresAt).getTime()
        : null;
    const campusRemainingMs = campusExpiresAtMs ? Math.max(0, campusExpiresAtMs - now) : 0;
    const campusInCooldown = campusRemainingMs > 0;
    const campusScorePassed = eligibility ? eligibility.campus.scorePassed : true;
    const campusEligible = eligibility ? (campusScorePassed && !campusInCooldown) : true;
    const campusTimeParts = breakDownRemaining(campusRemainingMs);
    const campusUnlockFormattedDate = campusExpiresAtMs
        ? new Date(campusExpiresAtMs).toLocaleString(undefined, {
              weekday: "long",
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
          })
        : "Available immediately";

    const panIndiaPoolCount = poolSizes?.panIndia ?? eligibility?.audiencePool?.panIndia ?? null;
    const campusPoolCount = poolSizes?.campus ?? eligibility?.audiencePool?.campus ?? null;

    const handleCardClick = (scope: "PAN_INDIA" | "CAMPUS") => {
        if (scope === "PAN_INDIA") {
            if (!panIndiaEligible) {
                // Open comprehensive Warning / Cooldown modal
                setWarningScope("PAN_INDIA");
                return;
            }
            onSelectScope("PAN_INDIA");
        } else {
            if (!campusEligible) {
                // Open comprehensive Warning / Cooldown modal
                setWarningScope("CAMPUS");
                return;
            }
            onSelectScope("CAMPUS");
        }
    };

    return (
        <>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-fade-in"
                onClick={onClose}
                aria-modal="true"
                role="dialog"
            >
                <div
                    className="relative w-[90vw] max-w-[90vw] bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] overflow-hidden my-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header Section */}
                    <div className="relative px-6 pt-6 pb-4 sm:px-8 sm:pt-8 border-b-2 border-black/10 bg-white flex items-start justify-between">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] border border-black text-[11px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000] mb-2">
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                Event Reach Architecture
                            </div>
                            <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                Choose Your Event Reach
                            </h2>
                            <p className="text-xs sm:text-sm font-bold text-neutral-600 mt-1">
                                Select the audience scope for this event. You can tailor discovery, eligibility, and participant roster intelligence.
                            </p>
                        </div>

                        <button
                            type="button"
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black transition-all active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                            title="Close modal"
                            aria-label="Close"
                        >
                            <X className="w-5 h-5 stroke-[2.5]" />
                        </button>
                    </div>

                    {/* Scope Selection Cards Grid */}
                    <div className="p-5 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 bg-[#FAF6EE]">
                        {/* CARD 1: PAN INDIA */}
                        <div
                            onClick={() => handleCardClick("PAN_INDIA")}
                            className={`group relative flex flex-col justify-between p-6 rounded-2xl bg-white border-3 border-black transition-all duration-200 overflow-hidden cursor-pointer ${
                                panIndiaEligible
                                    ? "shadow-[5px_5px_0px_#000] hover:shadow-[8px_8px_0px_#000] hover:-translate-x-1 hover:-translate-y-1"
                                    : "shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] bg-neutral-50/90"
                            }`}
                        >
                            {/* Visual Backdrop: High-fidelity India Map SVG */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.06] group-hover:opacity-[0.14] transition-opacity duration-300 overflow-hidden text-neutral-900">
                                <IndiaMapBackdrop className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                            </div>

                            <div className="relative z-10">
                                {/* Top Badge Ribbon */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FF9933]/20 border-2 border-black text-[10px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                                        <Globe2 className="w-3.5 h-3.5 text-amber-700" />
                                        National Reach
                                    </div>

                                    {eligibility && (
                                        panIndiaScorePassed ? (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[10px] font-black text-emerald-950 shadow-[1px_1px_0px_#000]">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                                Score: {eligibility.currentScore}/100 (Passes 50+)
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 border border-black text-[10px] font-black text-rose-950 shadow-[1px_1px_0px_#000]">
                                                <ShieldAlert className="w-3 h-3 text-rose-700" />
                                                Score: {eligibility.currentScore}/100 (Requires 50+)
                                            </div>
                                        )
                                    )}

                                    <span className="text-[11px] font-black text-neutral-400 uppercase tracking-widest ml-auto">
                                        Option A
                                    </span>
                                </div>

                                {/* Scope Icon, Title & Responsive Pool Size Box */}
                                <div className="flex items-center justify-between gap-2.5 sm:gap-3 mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={`w-12 h-12 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black shrink-0 transition-transform ${
                                                panIndiaEligible
                                                    ? "bg-[#FF9933] group-hover:rotate-[6deg]"
                                                    : "bg-[#FF9933]/60"
                                            }`}
                                        >
                                            <Globe2 className="w-6 h-6 stroke-[2.2]" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight truncate">
                                                PAN INDIA
                                            </h3>
                                            <span className="text-xs font-bold text-neutral-600 block truncate">
                                                Across colleges throughout India
                                            </span>
                                        </div>
                                    </div>

                                    {/* Responsive Audience Pool Size Badge */}
                                    <AudiencePoolBadge
                                        count={panIndiaPoolCount}
                                        scope="PAN_INDIA"
                                        isLoading={isPoolLoading}
                                    />
                                </div>

                                {/* Creation Cooldown Active Card */}
                                {panIndiaInCooldown && (
                                    <CreationCooldownCard
                                        timeParts={panIndiaTimeParts}
                                        unlockFormattedDate={panIndiaUnlockFormattedDate}
                                        onViewWarningModal={() => setWarningScope("PAN_INDIA")}
                                    />
                                )}

                                {/* Cooldown Notice when Limit is Not Reached */}
                                {!panIndiaInCooldown && (
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-amber-50 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-bold text-neutral-800">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                                            <span>3-day cooldown applies after event is created</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-black shrink-0">
                                            3-Day Cooldown
                                        </span>
                                    </div>
                                )}

                                {/* Score Restricted Alert Banner */}
                                {!panIndiaScorePassed && eligibility && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setWarningScope("PAN_INDIA");
                                        }}
                                        className="mt-3 p-3 rounded-xl bg-rose-100 hover:bg-rose-200 border-2 border-black shadow-[2px_2px_0px_#000] text-rose-950 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 text-xs font-black">
                                            <div className="flex items-center gap-1.5">
                                                <Lock className="w-4 h-4 text-rose-800" />
                                                <span>Pan-India Locked (Score &lt; 50)</span>
                                            </div>
                                            <span className="text-[10px] uppercase underline text-rose-900 font-black">
                                                View Details →
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-bold mt-1 text-rose-900 leading-tight">
                                            Current score is {eligibility.currentScore}. Need +{eligibility.panIndia.scoreDeficit} pts from successful campus events.
                                        </p>
                                    </div>
                                )}

                                {/* Pitch & Description */}
                                <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed mt-3">
                                    Connect with students, developers, and tech communities from colleges across the nation. Ideal for hackathons, national summits, workshops, and inter-college festivals.
                                </p>

                                {/* Badges Matrix */}
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-black text-[10px] font-black text-amber-950 shadow-[1px_1px_0px_#000]">
                                        All India Reach
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-100 border border-black text-[10px] font-black text-emerald-950 shadow-[1px_1px_0px_#000]">
                                        Inter-College Participation
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-100 border border-black text-[10px] font-black text-sky-950 shadow-[1px_1px_0px_#000]">
                                        National Discovery
                                    </span>
                                </div>

                                {/* Highlights List */}
                                <div className="mt-4 pt-4 border-t border-black/10 space-y-2 text-xs font-bold text-neutral-700">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>Open to students from any Indian college or university</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>Verified AISHE campus directory matching &amp; state filters</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <span>Institution-wise participant analytics &amp; secure CSV export</span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Button: Shown only when not on cooldown */}
                            {!panIndiaInCooldown && (
                                <div className="mt-6 pt-4 relative z-10">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!panIndiaEligible) {
                                                setWarningScope("PAN_INDIA");
                                                return;
                                            }
                                            onSelectScope("PAN_INDIA");
                                        }}
                                        className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm border-2 border-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            panIndiaEligible
                                                ? "bg-[#FF9933] hover:bg-[#ff881a] text-black shadow-[3px_3px_0px_#000] group-hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                                : "bg-[#FFE566] hover:bg-[#ffd833] text-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                        }`}
                                    >
                                        {!panIndiaScorePassed ? (
                                            <>
                                                <Lock className="w-4 h-4" />
                                                <span>Locked: Score &lt; 50 — View Eligibility Notice</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Pan India Event</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* CARD 2: CAMPUS ONLY */}
                        <div
                            onClick={() => handleCardClick("CAMPUS")}
                            className={`group relative flex flex-col justify-between p-6 rounded-2xl bg-white border-3 border-black transition-all duration-200 overflow-hidden cursor-pointer ${
                                campusEligible
                                    ? "shadow-[5px_5px_0px_#000] hover:shadow-[8px_8px_0px_#000] hover:-translate-x-1 hover:-translate-y-1"
                                    : "shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] bg-neutral-50/90"
                            }`}
                        >
                            {/* Visual Backdrop: High-fidelity Architectural Pillars SVG */}
                            <div className="absolute inset-0 pointer-events-none opacity-[0.08] group-hover:opacity-[0.16] transition-opacity duration-300 overflow-hidden text-neutral-800">
                                <CampusPillarsBackdrop className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                            </div>

                            <div className="relative z-10">
                                {/* Top Badge Ribbon */}
                                <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#38BDF8]/20 border-2 border-black text-[10px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                                        <ShieldCheck className="w-3.5 h-3.5 text-sky-700" />
                                        Campus Exclusive
                                    </div>

                                    {eligibility && (
                                        campusScorePassed ? (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 border border-black text-[10px] font-black text-emerald-950 shadow-[1px_1px_0px_#000]">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                                Score: {eligibility.currentScore}/100 (Passes 20+)
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 border border-black text-[10px] font-black text-rose-950 shadow-[1px_1px_0px_#000]">
                                                <ShieldAlert className="w-3 h-3 text-rose-700" />
                                                Score: {eligibility.currentScore}/100 (Restricted &lt; 20)
                                            </div>
                                        )
                                    )}

                                    <span className="text-[11px] font-black text-neutral-400 uppercase tracking-widest ml-auto">
                                        Option B
                                    </span>
                                </div>

                                {/* Scope Icon, Title & Responsive Pool Size Box */}
                                <div className="flex items-center justify-between gap-2.5 sm:gap-3 mb-2">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className={`w-12 h-12 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center text-black shrink-0 transition-transform ${
                                                campusEligible
                                                    ? "bg-[#38BDF8] group-hover:rotate-[6deg]"
                                                    : "bg-[#38BDF8]/60"
                                            }`}
                                        >
                                            <GraduationCap className="w-6 h-6 stroke-[2.2]" />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-xl sm:text-2xl font-black text-black tracking-tight leading-tight truncate">
                                                CAMPUS ONLY
                                            </h3>
                                            <span className="text-xs font-bold text-neutral-600 block truncate">
                                                Within your institution
                                            </span>
                                        </div>
                                    </div>

                                    {/* Responsive Audience Pool Size Badge */}
                                    <AudiencePoolBadge
                                        count={campusPoolCount}
                                        scope="CAMPUS"
                                        collegeName={collegeName}
                                        isLoading={isPoolLoading}
                                    />
                                </div>

                                {/* Creation Cooldown Active Card */}
                                {campusInCooldown && (
                                    <CreationCooldownCard
                                        timeParts={campusTimeParts}
                                        unlockFormattedDate={campusUnlockFormattedDate}
                                        onViewWarningModal={() => setWarningScope("CAMPUS")}
                                    />
                                )}

                                {/* Cooldown Notice when Limit is Not Reached */}
                                {!campusInCooldown && (
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 rounded-xl bg-sky-50 border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-bold text-neutral-800">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <Clock className="w-4 h-4 text-sky-600 shrink-0" />
                                            <span>12-hour cooldown applies after event is created</span>
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#38BDF8]/30 border border-black text-black shrink-0">
                                            12-Hour Cooldown
                                        </span>
                                    </div>
                                )}

                                {/* Score Restricted Alert Banner */}
                                {!campusScorePassed && eligibility && (
                                    <div
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setWarningScope("CAMPUS");
                                        }}
                                        className="mt-3 p-3 rounded-xl bg-rose-100 hover:bg-rose-200 border-2 border-black shadow-[2px_2px_0px_#000] text-rose-950 transition-colors"
                                    >
                                        <div className="flex items-center justify-between gap-2 text-xs font-black">
                                            <div className="flex items-center gap-1.5">
                                                <Lock className="w-4 h-4 text-rose-800" />
                                                <span>Campus Hosting Restricted (Score &lt; 20)</span>
                                            </div>
                                            <span className="text-[10px] uppercase underline text-rose-900 font-black">
                                                View Details →
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-bold mt-1 text-rose-900 leading-tight">
                                            Current credibility score is {eligibility.currentScore}. Event creation is locked until critical trust incidents are resolved.
                                        </p>
                                    </div>
                                )}

                                {/* Pitch & Description */}
                                <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed mt-3">
                                    Your campus. Your community. Your event. Create experiences exclusively for students within{" "}
                                    <span className="font-bold text-black">{collegeName || "your institution"}</span>.
                                    Preserves institution integrity and privacy.
                                </p>

                                {/* Badges Matrix */}
                                <div className="mt-4 flex flex-wrap gap-1.5">
                                    <span className="px-2.5 py-0.5 rounded-lg bg-sky-100 border border-black text-[10px] font-black text-sky-950 shadow-[1px_1px_0px_#000]">
                                        Institution Restricted
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 border border-black text-[10px] font-black text-amber-950 shadow-[1px_1px_0px_#000]">
                                        Campus Community
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-lg bg-purple-100 border border-black text-[10px] font-black text-purple-950 shadow-[1px_1px_0px_#000]">
                                        Exclusive Participation
                                    </span>
                                </div>

                                {/* Highlights List */}
                                <div className="mt-4 pt-4 border-t border-black/10 space-y-2 text-xs font-bold text-neutral-700">
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                                        <span>Restricted strictly to students of your campus institution</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                                        <span>Campus verified roll number, year &amp; department auto-bind</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <CheckCircle2 className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
                                        <span>Best for internal club recruitments, orientations &amp; workshops</span>
                                    </div>
                                </div>
                            </div>

                            {/* CTA Button: Shown only when not on cooldown */}
                            {!campusInCooldown && (
                                <div className="mt-6 pt-4 relative z-10">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!campusEligible) {
                                                setWarningScope("CAMPUS");
                                                return;
                                            }
                                            onSelectScope("CAMPUS");
                                        }}
                                        className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm border-2 border-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
                                            campusEligible
                                                ? "bg-[#38BDF8] hover:bg-[#2cb0eb] text-black shadow-[3px_3px_0px_#000] group-hover:shadow-[4px_4px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                                : "bg-[#FFE566] hover:bg-[#ffd833] text-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px]"
                                        }`}
                                    >
                                        {!campusScorePassed ? (
                                            <>
                                                <Lock className="w-4 h-4" />
                                                <span>Locked: Score &lt; 20 — View Eligibility Notice</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Create Campus Event</span>
                                                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Assurance Banner */}
                    <div className="px-6 py-4 bg-white border-t-2 border-black/10 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-neutral-600">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-neutral-500" />
                            <span>Both scopes use Orbix's dynamic question builder and verified QR pass system.</span>
                        </div>
                        <span className="text-[11px] text-neutral-400">
                            Scope is locked once participant registrations are received.
                        </span>
                    </div>
                </div>
            </div>

            {/* Dedicated Event Creation Warning / Cooldown Modal */}
            <EventCooldownWarningModal
                isOpen={warningScope !== null}
                onClose={() => setWarningScope(null)}
                scope={warningScope || "PAN_INDIA"}
                eligibility={eligibility}
                collegeName={collegeName}
            />
        </>
    );
};
