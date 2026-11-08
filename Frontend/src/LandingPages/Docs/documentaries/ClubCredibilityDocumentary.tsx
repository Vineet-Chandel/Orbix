import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Award,
    ShieldCheck,
    ShieldAlert,
    Clock,
    Users,
    Sliders,
    ArrowRight,
    AlertTriangle,
    Calendar,
    Sparkles,
    FileCheck,
} from "lucide-react";
import { NeoSelect } from "../../../components/NeoSelect";

interface CredibilityPreset {
    id: string;
    label: string;
    description: string;
    values: {
        completedEvents: number;
        avgCompletedQuality: number;
        cancellationsCount: number;
        noticeHours: number;
        avgRegistrations: number;
        isPanIndia: boolean;
        streak: number;
        repeatIncidents: number;
        recentRatio: number; // percentage of evidence in last 365 days
    };
}

const BENCHMARK_PRESETS: CredibilityPreset[] = [
    {
        id: "provisional",
        label: "Newly Registered Club (Provisional — 50 pts)",
        description: "Zero verified events; initialized with neutral prior and low confidence",
        values: {
            completedEvents: 0,
            avgCompletedQuality: 50,
            cancellationsCount: 0,
            noticeHours: 168,
            avgRegistrations: 0,
            isPanIndia: false,
            streak: 0,
            repeatIncidents: 0,
            recentRatio: 1.0,
        },
    },
    {
        id: "active-campus",
        label: "Consistent Campus Club (Reliable — ~68 pts)",
        description: "4 verified campus events, solid attendance, 1 rescheduled session",
        values: {
            completedEvents: 4,
            avgCompletedQuality: 82,
            cancellationsCount: 1,
            noticeHours: 168,
            avgRegistrations: 60,
            isPanIndia: false,
            streak: 3,
            repeatIncidents: 0,
            recentRatio: 1.0,
        },
    },
    {
        id: "national-tech",
        label: "Established Tech Society (Trusted — ~82 pts)",
        description: "10 completed events, Pan-India hackathons, unbroken streak, high satisfaction",
        values: {
            completedEvents: 10,
            avgCompletedQuality: 90,
            cancellationsCount: 0,
            noticeHours: 168,
            avgRegistrations: 180,
            isPanIndia: true,
            streak: 8,
            repeatIncidents: 0,
            recentRatio: 0.8,
        },
    },
    {
        id: "elite-hackathon",
        label: "Elite National Organizer (Exceptional — ~94 pts)",
        description: "22 verified events, 400+ attendees per event, zero incidents, stellar certificates",
        values: {
            completedEvents: 22,
            avgCompletedQuality: 96,
            cancellationsCount: 0,
            noticeHours: 168,
            avgRegistrations: 450,
            isPanIndia: true,
            streak: 15,
            repeatIncidents: 0,
            recentRatio: 0.7,
        },
    },
    {
        id: "recovering",
        label: "Reformed Club in Recovery (Developing — ~56 pts)",
        description: "Past last-minute cancellation, followed by 3 recent flawless campus meetups",
        values: {
            completedEvents: 3,
            avgCompletedQuality: 88,
            cancellationsCount: 1,
            noticeHours: 12,
            avgRegistrations: 80,
            isPanIndia: false,
            streak: 3,
            repeatIncidents: 1,
            recentRatio: 0.8,
        },
    },
    {
        id: "danger-zone",
        label: "Severe Negligence (Critical — ~32 pts)",
        description: "Multiple repeat cancellations with <24h notice and 100+ registered students",
        values: {
            completedEvents: 1,
            avgCompletedQuality: 60,
            cancellationsCount: 3,
            noticeHours: 8,
            avgRegistrations: 120,
            isPanIndia: false,
            streak: 0,
            repeatIncidents: 2,
            recentRatio: 1.0,
        },
    },
];

export const ClubCredibilityDocumentary: React.FC = () => {
    // Interactive Simulation States
    const [selectedPreset, setSelectedPreset] = useState<string>("active-campus");
    const [completedEvents, setCompletedEvents] = useState<number>(4);
    const [avgCompletedQuality, setAvgCompletedQuality] = useState<number>(82);
    const [cancellationsCount, setCancellationsCount] = useState<number>(1);
    const [noticeHours, setNoticeHours] = useState<number>(168);
    const [avgRegistrations, setAvgRegistrations] = useState<number>(60);
    const [isPanIndia, setIsPanIndia] = useState<boolean>(false);
    const [streak, setStreak] = useState<number>(3);
    const [repeatIncidents, setRepeatIncidents] = useState<number>(0);
    const [recentRatio, setRecentRatio] = useState<number>(1.0);

    const handleApplyPreset = (presetId: string) => {
        setSelectedPreset(presetId);
        const preset = BENCHMARK_PRESETS.find((p) => p.id === presetId);
        if (!preset) return;
        setCompletedEvents(preset.values.completedEvents);
        setAvgCompletedQuality(preset.values.avgCompletedQuality);
        setCancellationsCount(preset.values.cancellationsCount);
        setNoticeHours(preset.values.noticeHours);
        setAvgRegistrations(preset.values.avgRegistrations);
        setIsPanIndia(preset.values.isPanIndia);
        setStreak(preset.values.streak);
        setRepeatIncidents(preset.values.repeatIncidents);
        setRecentRatio(preset.values.recentRatio);
    };

    // Live Deterministic Mathematical Model
    const simResults = useMemo(() => {
        // Prior configuration
        const PRIOR_SCORE = 50;
        const PRIOR_WEIGHT = 10;
        const POSITIVE_CAP = 4.0;
        const NEGATIVE_CAP = 8.0;

        // Reach factor
        let reachFactor = 1.0;
        if (avgRegistrations === 0) reachFactor = 0.6;
        else if (avgRegistrations <= 25) reachFactor = 0.8;
        else if (avgRegistrations <= 100) reachFactor = 1.0;
        else if (avgRegistrations <= 300) reachFactor = 1.2;
        else reachFactor = 1.5;

        // Scope factor
        const scopeFactor = isPanIndia ? 1.2 : 1.0;

        // Streak factor
        const streakFactor = Math.min(1.2, 1.0 + Math.max(0, streak - 1) * 0.05);

        // Advance notice factor for cancellations
        let noticeFactor = 1.0;
        let cancelQuality = 30;
        if (noticeHours >= 168) {
            noticeFactor = 0.6;
            cancelQuality = 60;
        } else if (noticeHours >= 72) {
            noticeFactor = 0.9;
            cancelQuality = 45;
        } else if (noticeHours >= 24) {
            noticeFactor = 1.2;
            cancelQuality = 30;
        } else {
            noticeFactor = 1.6;
            cancelQuality = 15;
        }

        // Repeat incidents multiplier
        const repeatMultiplier = Math.min(2.0, 1.0 + repeatIncidents * 0.25);

        // Positive event unit weight
        const posRawWeight = 1.0 * scopeFactor * reachFactor * streakFactor;
        const posWeight = Math.min(POSITIVE_CAP, posRawWeight);

        // Cancellation unit weight
        const negRawWeight = 1.5 * scopeFactor * reachFactor * noticeFactor * repeatMultiplier;
        const negWeight = Math.min(NEGATIVE_CAP, negRawWeight);

        // Cumulative evidence
        const totalPosWeight = completedEvents * posWeight;
        const totalPosWeightedQuality = completedEvents * posWeight * avgCompletedQuality;

        const totalNegWeight = cancellationsCount * negWeight;
        const totalNegWeightedQuality = cancellationsCount * negWeight * cancelQuality;

        const totalEvidenceWeight = totalPosWeight + totalNegWeight;
        const totalWeightedQuality = totalPosWeightedQuality + totalNegWeightedQuality;

        // Lifetime calculation
        const lifetimeScore = Math.max(
            0,
            Math.min(100, Math.round(((PRIOR_SCORE * PRIOR_WEIGHT + totalWeightedQuality) / (PRIOR_WEIGHT + totalEvidenceWeight)) * 10) / 10)
        );

        // Recent calculation (subset based on recentRatio)
        const recentWeight = totalEvidenceWeight * recentRatio;
        const recentWeightedQuality = totalWeightedQuality * recentRatio;
        const recentScore = Math.max(
            0,
            Math.min(100, Math.round(((PRIOR_SCORE * PRIOR_WEIGHT + recentWeightedQuality) / (PRIOR_WEIGHT + recentWeight)) * 10) / 10)
        );

        // Final Blended Score: 70% Lifetime + 30% Recent
        const finalScore = Math.max(0, Math.min(100, Math.round(0.70 * lifetimeScore + 0.30 * recentScore)));

        const isProvisional = completedEvents < 3 && cancellationsCount === 0;

        // Level & band
        let scoreLevel = "developing";
        let scoreBandLabel = "Developing";
        let scoreColor = "bg-[#FEF3C7] text-amber-950 border-amber-900";
        let dotColor = "bg-amber-500";
        let barColor = "#FEF3C7";

        if (finalScore < 40) {
            scoreLevel = "critical";
            scoreBandLabel = "Critical (Trust Issues)";
            scoreColor = "bg-[#FECDD3] text-rose-950 border-rose-900";
            dotColor = "bg-rose-500";
            barColor = "#FECDD3";
        } else if (finalScore < 60) {
            scoreLevel = "developing";
            scoreBandLabel = isProvisional ? "Provisional (Baseline)" : "Developing (Improving)";
            scoreColor = "bg-[#FEF3C7] text-amber-950 border-amber-900";
            dotColor = "bg-amber-500";
            barColor = "#FEF3C7";
        } else if (finalScore < 75) {
            scoreLevel = "reliable";
            scoreBandLabel = "Reliable (Consistent)";
            scoreColor = "bg-[#FEF08A] text-amber-950 border-amber-900";
            dotColor = "bg-yellow-500";
            barColor = "#FEF08A";
        } else if (finalScore < 90) {
            scoreLevel = "trusted";
            scoreBandLabel = "Trusted (High Track Record)";
            scoreColor = "bg-[#BBF7D0] text-emerald-950 border-emerald-900";
            dotColor = "bg-emerald-500";
            barColor = "#BBF7D0";
        } else {
            scoreLevel = "exceptional";
            scoreBandLabel = "Exceptional (Proven Authority)";
            scoreColor = "bg-[#a2ff86] text-black border-black";
            dotColor = "bg-black";
            barColor = "#a2ff86";
        }

        return {
            posWeight: Math.round(posWeight * 100) / 100,
            negWeight: Math.round(negWeight * 100) / 100,
            cancelQuality,
            totalEvidenceWeight: Math.round(totalEvidenceWeight * 10) / 10,
            lifetimeScore,
            recentScore,
            finalScore,
            isProvisional,
            scoreLevel,
            scoreBandLabel,
            scoreColor,
            dotColor,
            barColor,
            reachFactor,
            streakFactor,
            noticeFactor,
            repeatMultiplier,
        };
    }, [
        completedEvents,
        avgCompletedQuality,
        cancellationsCount,
        noticeHours,
        avgRegistrations,
        isPanIndia,
        streak,
        repeatIncidents,
        recentRatio,
    ]);

    const dimensions = [
        {
            title: "Event Delivery & Execution",
            weight: "30%",
            color: "bg-[#a2ff86]",
            icon: <Calendar className="w-5 h-5 text-black" />,
            metric: "Attendance Ratio & Execution",
            description: "Measures whether scheduled sessions take place as announced and the percentage of registered students who successfully complete QR attendance.",
            impact: "High attendance conversion (>75%) yields 90-100 quality points. Ghost events with 0 attendance collapse delivery points to 20.",
        },
        {
            title: "Schedule & Timeline Reliability",
            weight: "15%",
            color: "bg-[#ffd5dc]",
            icon: <Clock className="w-5 h-5 text-black" />,
            metric: "Punctuality & Shift Notice",
            description: "Tracks on-time session start, adherence to promised session duration, and freedom from unannounced date or venue shifts.",
            impact: "Shifting venue or schedule within 48 hours without coordinator broadcast deducts 30 quality points.",
        },
        {
            title: "Attendee Communication & Notice",
            weight: "15%",
            color: "bg-[#b6e3f4]",
            icon: <Users className="w-5 h-5 text-black" />,
            metric: "Broadcast Transparency",
            description: "Evaluates the timeliness and clarity of event reminders, prerequisite instructions, agenda dissemination, and change broadcasts.",
            impact: "Dispatching timely updates via Orbix in-app broadcast shields clubs from communication penalties.",
        },
        {
            title: "Participant Experience & Feedback",
            weight: "20%",
            color: "bg-[#ffdfbf]",
            icon: <Sparkles className="w-5 h-5 text-black" />,
            metric: "Sentiment & Value Delivered",
            description: "Measures post-event student ratings, speaker effectiveness, technical workshop utility, and dispute flag frequency.",
            impact: "Consistently positive student feedback elevates overall event quality above 90, accelerating progression toward Trusted status.",
        },
        {
            title: "Complaint Resolution & Accountability",
            weight: "10%",
            color: "bg-[#c0aede]",
            icon: <ShieldAlert className="w-5 h-5 text-black" />,
            metric: "Dispute & Grievance Handling",
            description: "Assesses how responsibly the club handles complaints, refund issues, attendee questions, and administrative queries.",
            impact: "Zero unresolved participant disputes guarantees maximum 100 quality points on this dimension.",
        },
        {
            title: "Certificate & Credential Integrity",
            weight: "10%",
            color: "bg-[#fef08a]",
            icon: <Award className="w-5 h-5 text-black" />,
            metric: "Verification Pre-Flight Checks",
            description: "Audits verifiable credentials issued through Orbix Studio: genuine attendance matching, absence of spam batches, and pre-flight compliance.",
            impact: "Issuing credentials to non-attendees or revoking certificates due to disputes carries immediate regulatory ledger deductions.",
        },
    ];

    const bestPractices = [
        {
            number: "01",
            title: "Keep Unconfirmed Events in Draft",
            tag: "Pre-Event Discipline",
            content: "Never publish an event to campus feeds until the venue, faculty permission, and speakers are 100% confirmed. Moving a published event with registered students back to Draft incurs an evidence penalty.",
        },
        {
            number: "02",
            title: "The 7-Day Golden Window",
            tag: "Cancellation Ethics",
            content: "If an unexpected disruption forces a cancellation, trigger it at least 7 days in advance. The algorithm applies a 0.6x notice cushion factor, drastically minimizing the impact on your score.",
        },
        {
            number: "03",
            title: "Always Offer an Alternate Date",
            tag: "Mitigation Bonus",
            content: "Whenever an event cannot proceed as scheduled, offer a reschedule alternative rather than a hard deletion. Offering an alternate date and notifying registered participants preserves credibility points.",
        },
        {
            number: "04",
            title: "Enforce Door QR Check-Ins",
            tag: "Delivery Proof",
            content: "Always use Orbix's built-in QR scanner at the entrance. Verified attendee check-ins serve as cryptographic proof of delivery, boosting your Event Delivery dimension score to its maximum 25% weight.",
        },
        {
            number: "05",
            title: "Run Pre-Flight Before Certificate Issuance",
            tag: "Credential Integrity",
            content: "Before dispatching certificates, run the pre-flight integrity check. Ensuring every recipient was a verified attendee guarantees flawless credential ratings and builds long-term institutional trust.",
        },
        {
            number: "06",
            title: "Leverage the Formal Appeals Process",
            tag: "Dispute Safeguard",
            content: "If external force majeure (campus closures, extreme weather, academic exam shifts) forces an emergency cancellation, file an appeal via the Credibility Workspace with administrative proof for staff reversal.",
        },
    ];

    return (
        <article className="space-y-16 sm:space-y-24">
            {/* ========================================================================= */}
            {/* HERO HEADER: ORBIX CLUB CREDIBILITY ENGINE                                */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full bg-black text-[#FFE566] border border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                            Orbix Reputation Architecture
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hidden sm:inline-block">
                            Bayesian Evidence Standard v1.0
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-600">
                        <Clock className="w-3.5 h-3.5 text-black" />
                        <span>15 min read</span>
                        <span>•</span>
                        <span>Orbix Research & Campus Governance</span>
                    </div>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-tight sm:leading-none mb-4">
                    Orbix Club Credibility Engine
                </h1>
                <p className="text-base sm:text-xl font-bold text-neutral-700 leading-relaxed max-w-4xl mb-6">
                    0 to 100 Bayesian Evidence Model • 6-Dimensional Quality Rubric • Dynamic Weight Multipliers • 70/30 Lifetime vs Recent Blend
                </p>

                {/* Neo-Brutalist Tags */}
                <div className="flex flex-wrap gap-2 mb-8">
                    {["Bayesian Reputation", "Dynamic Weights", "0-100 Standard", "Accountability Ledger", "Cancellation Protection", "Student Rights"].map((tag, idx) => (
                        <span
                            key={idx}
                            className="px-3 py-1 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Authoritative Banner Image Container */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden bg-black shadow-[4px_4px_0px_#000] w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1794112549/The_Complete_Guide_to_Inventory_and_Warehouse_Management_pznkfb.jpg"
                        alt="Orbix Club Credibility Engine Architectural Guide"
                        className="w-full h-auto block object-cover max-h-[480px]"
                    />
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: THE PHILOSOPHY OF EVIDENCE OVER COUNTERS                       */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Philosophy: Reputation Through Evidence, Not Naive Counters
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    In traditional student platforms, club ratings are computed as simple addition/subtraction counters: <em>+5 for creating an event, −10 for cancelling</em>. This naive approach suffers from two systemic vulnerabilities:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-5 rounded-2xl bg-rose-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-rose-950 font-black text-sm">
                            <AlertTriangle className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                            <span>Vulnerability 1: The Fast-Spam Exploit</span>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            A club can create 20 trivial micro-sessions to artificially inflate its score, and then cancel a major college-wide hackathon with hundreds of registered attendees with minimal net score impact.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-rose-50 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2 text-rose-950 font-black text-sm">
                            <ShieldAlert className="w-4 h-4 text-rose-600 stroke-[2.5]" />
                            <span>Vulnerability 2: Punitive Death Spirals</span>
                        </div>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            A reputable club with two years of exceptional workshops suffers an inevitable campus venue closure and receives an unrecoverable negative penalty that permanently destroys their reputation.
                        </p>
                    </div>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    <strong>The Orbix Solution:</strong> Credibility is modeled as a club&apos;s <em>long-term reputation grounded in verified empirical evidence</em>. A club that organizes 5 meticulously prepared, high-attendance events gradually builds a stronger reputation than a club that publishes 30 events but cancels half of them.
                </p>

                {/* Score Range & Neutral Prior Callout */}
                <div className="p-6 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-base font-black text-black">
                            Score Boundaries & The Neutral Prior
                        </h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                        <div className="p-3 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                            <span className="font-mono text-neutral-500 font-bold uppercase block text-[10px]">Hard Minimum</span>
                            <span className="text-xl font-black text-rose-700">0 Points</span>
                            <p className="text-[11px] text-neutral-600 mt-0.5">Absolute lower bound under severe chronic failure.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                            <span className="font-mono text-neutral-500 font-bold uppercase block text-[10px]">Starting Prior</span>
                            <span className="text-xl font-black text-amber-700">50 Points</span>
                            <p className="text-[11px] text-neutral-600 mt-0.5">Assigned to newly registered clubs with Provisional status.</p>
                        </div>
                        <div className="p-3 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                            <span className="font-mono text-neutral-500 font-bold uppercase block text-[10px]">Hard Maximum</span>
                            <span className="text-xl font-black text-emerald-700">100 Points</span>
                            <p className="text-[11px] text-neutral-600 mt-0.5">Ceiling achieved through verified long-term excellence.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: THE MATHEMATICAL ARCHITECTURE                                  */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        The Mathematical Architecture: Bayesian Evidence Model
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Credibility uses a <strong>Bayesian update mechanism</strong>. The system maintains a neutral prior belief: an unproven club has a score of $50/100$, equivalent to $10$ units of baseline observation. Every real-world action produces an evidence item with an outcome quality ($Q_i$) and an evidence weight ($W_i$).
                </p>

                {/* Mathematical Formulation Display Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {/* Formula 1: Lifetime Score */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black uppercase tracking-wider">
                                Component 1
                            </span>
                            <h3 className="text-base font-black text-black">Lifetime Credibility (L)</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Measures total historical reliability since registration against all accumulated evidence.
                            </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black font-mono text-xs font-black text-black text-center shadow-[2px_2px_0px_#000]">
                            L = (50 × 10 + ∑ Wi Qi) / (10 + ∑ Wi)
                        </div>
                    </div>

                    {/* Formula 2: Recent Score */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black text-[10px] font-black uppercase tracking-wider">
                                Component 2
                            </span>
                            <h3 className="text-base font-black text-black">Recent Credibility (R)</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Filters evidence strictly within the trailing 365 days to capture current organizational health.
                            </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black font-mono text-xs font-black text-black text-center shadow-[2px_2px_0px_#000]">
                            R = (50 × 10 + ∑_365d Wi Qi) / (10 + ∑_365d Wi)
                        </div>
                    </div>

                    {/* Formula 3: 70/30 Blended Score */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3">
                        <div className="space-y-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-[#38BDF8] text-black border border-black text-[10px] font-black uppercase tracking-wider">
                                Composite Formula
                            </span>
                            <h3 className="text-base font-black text-black">Final Blended Score</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Balances long-term institutional track record (70%) with agility for recovery (30%).
                            </p>
                        </div>
                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black font-mono text-xs font-black text-black text-center shadow-[2px_2px_0px_#000]">
                            Score = round(0.70 × L + 0.30 × R)
                        </div>
                    </div>
                </div>

                <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2 text-xs sm:text-sm font-medium text-neutral-800">
                    <p>
                        <strong>Why the 70/30 Blend is Crucial for Student Leaders:</strong> A club that suffered an unavoidable cancellation early in the academic year is never permanently crippled. By delivering 3 or 4 high-quality workshops in subsequent months, the high recent score ($R$) elevates the overall rating, restoring trust and student enthusiasm.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: DYNAMIC EVIDENCE WEIGHTS                                       */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Dynamic Evidence Weights: How Actions Scale
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Not all events carry equal weight. An inter-college national hackathon with 400 developers has vastly higher stakes than an internal 10-person chapter orientation. Evidence weight ($W_i$) is calculated through the master formulation:
                </p>

                <div className="p-4 sm:p-5 rounded-2xl bg-black text-[#a2ff86] font-mono text-sm sm:text-base font-black text-center border-2 border-black shadow-[4px_4px_0px_#000]">
                    Wi = min( C, B × S × A × V × T × P )
                </div>

                {/* Factors Matrix */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Base Weight */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Base Weight (B)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#FFE566] border border-black">1.0 – 2.0</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• Completed Event: <strong>1.0</strong></li>
                            <li>• Cancelled Event: <strong>1.5</strong></li>
                            <li>• Delete with Active RSVPs: <strong>2.0</strong></li>
                            <li>• Unpublish to Draft: <strong>1.2</strong></li>
                            <li>• Certificate Issuance: <strong>0.8</strong></li>
                        </ul>
                    </div>

                    {/* Scope Factor */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Scope Factor (S)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#a2ff86] border border-black">1.0 – 1.2</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• Campus Only: <strong>1.0x</strong></li>
                            <li>• Pan India: <strong>1.2x</strong> (+20% evidentiary weight due to cross-college commitments)</li>
                        </ul>
                    </div>

                    {/* Reach Factor */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Reach Factor (A)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#38BDF8] border border-black">0.6 – 1.5</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• 0 registered students: <strong>0.6x</strong></li>
                            <li>• 1 – 25 students: <strong>0.8x</strong></li>
                            <li>• 26 – 100 students: <strong>1.0x</strong></li>
                            <li>• 101 – 300 students: <strong>1.2x</strong></li>
                            <li>• 301+ students: <strong>1.5x</strong></li>
                        </ul>
                    </div>

                    {/* Notice Factor */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Notice Factor (V)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#FECDD3] border border-black">0.6 – 1.6</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• ≥ 7 days notice: <strong>0.6x</strong> (cushion)</li>
                            <li>• 3 – 6 days notice: <strong>0.9x</strong></li>
                            <li>• 24 – 72 hours: <strong>1.2x</strong></li>
                            <li>• &lt; 24 hours (last minute): <strong>1.6x</strong></li>
                        </ul>
                    </div>

                    {/* Streak Multiplier */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Streak Multiplier (T)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-[#C4B5FD] border border-black">1.0 – 1.20</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• Successive flawless events build a streak.</li>
                            <li>• Each event adds <strong>+0.05x</strong> weight boost up to a <strong>1.20x cap</strong>.</li>
                        </ul>
                    </div>

                    {/* Repeat Incident Multiplier & Caps */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-bold text-neutral-500 uppercase">Incident Multiplier (P)</span>
                            <span className="text-xs font-black px-2 py-0.5 rounded bg-rose-200 border border-black">1.0 – 2.00</span>
                        </div>
                        <ul className="text-xs font-medium text-neutral-700 space-y-1 pt-1">
                            <li>• Recurring cancellations within 180 days compound: <strong>+0.25x</strong> per incident up to <strong>2.00x</strong>.</li>
                            <li>• <strong>Hard Caps (C):</strong> Positive capped at <strong>4.0</strong>; Negative capped at <strong>8.0</strong>.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: THE 6-DIMENSIONAL QUALITY RUBRIC                               */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        The 6-Dimensional Quality Rubric (Qi)
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    When an event concludes or an incident occurs, an outcome quality score ($Q_i \in [0, 100]$) is computed. For completed events, $Q_i$ is a weighted composite of 6 core operational dimensions:
                </p>

                {/* 6 Dimension Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {dimensions.map((dim, idx) => (
                        <div
                            key={idx}
                            className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3"
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <div className={`w-8 h-8 rounded-lg ${dim.color} border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]`}>
                                        {dim.icon}
                                    </div>
                                    <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-black text-white">
                                        {dim.weight}
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-black">{dim.title}</h3>
                                <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                    {dim.description}
                                </p>
                            </div>

                            <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 text-[11px] font-bold text-neutral-800 space-y-0.5">
                                <span className="font-mono text-neutral-500 uppercase text-[9px] block">Operational Impact</span>
                                <p>{dim.impact}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: SCORE BANDS, TRUST LEVELS & PRIVILEGES                         */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Score Bands, Trust Indicators & Privileges
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Credibility scores map directly to visible platform badges and functional permissions across the collegiate ecosystem:
                </p>

                {/* Table of Score Bands */}
                <div className="rounded-2xl border-2 sm:border-3 border-black overflow-hidden shadow-[5px_5px_0px_#000] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-black text-white text-xs font-black uppercase tracking-wider">
                                    <th className="p-3.5 sm:p-4 border-r border-neutral-700">Score Band</th>
                                    <th className="p-3.5 sm:p-4 border-r border-neutral-700">Indicator</th>
                                    <th className="p-3.5 sm:p-4 border-r border-neutral-700">Classification</th>
                                    <th className="p-3.5 sm:p-4 border-r border-neutral-700">Platform Standing</th>
                                    <th className="p-3.5 sm:p-4">Privileges & Safeguards</th>
                                </tr>
                            </thead>
                            <tbody className="text-xs divide-y-2 divide-black">
                                <tr className="hover:bg-[#FAF6EE] transition-colors">
                                    <td className="p-3.5 sm:p-4 font-mono font-black text-rose-700">0 – 39</td>
                                    <td className="p-3.5 sm:p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FECDD3] text-rose-950 border border-black font-black text-[11px]">
                                            <span className="w-2 h-2 rounded-full bg-rose-600" />
                                            Red
                                        </span>
                                    </td>
                                    <td className="p-3.5 sm:p-4 font-black text-rose-900">Critical</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-700 font-medium">Significant trust issues; recurring cancellations or unhandled complaints.</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-800 font-bold">
                                        Pan-India publishing locked; mandatory coordinator re-verification; public warning tag.
                                    </td>
                                </tr>
                                <tr className="hover:bg-[#FAF6EE] transition-colors">
                                    <td className="p-3.5 sm:p-4 font-mono font-black text-amber-700">40 – 59</td>
                                    <td className="p-3.5 sm:p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF3C7] text-amber-950 border border-black font-black text-[11px]">
                                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                                            Yellow
                                        </span>
                                    </td>
                                    <td className="p-3.5 sm:p-4 font-black text-amber-900">Developing</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-700 font-medium">New clubs or clubs establishing consistency. Includes Provisional clubs.</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-800 font-bold">
                                        Standard campus publishing; provisional tag until 3 verified events completed.
                                    </td>
                                </tr>
                                <tr className="hover:bg-[#FAF6EE] transition-colors">
                                    <td className="p-3.5 sm:p-4 font-mono font-black text-yellow-700">60 – 74</td>
                                    <td className="p-3.5 sm:p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#FEF08A] text-amber-950 border border-black font-black text-[11px]">
                                            <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                            Yellow
                                        </span>
                                    </td>
                                    <td className="p-3.5 sm:p-4 font-black text-amber-900">Reliable</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-700 font-medium">Solid track record of executed sessions and healthy attendance.</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-800 font-bold">
                                        Verified Club Shield badge; featured on campus event listings; eligible for Pan-India reach.
                                    </td>
                                </tr>
                                <tr className="hover:bg-[#FAF6EE] transition-colors">
                                    <td className="p-3.5 sm:p-4 font-mono font-black text-emerald-700">75 – 89</td>
                                    <td className="p-3.5 sm:p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#BBF7D0] text-emerald-950 border border-black font-black text-[11px]">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                            Green
                                        </span>
                                    </td>
                                    <td className="p-3.5 sm:p-4 font-black text-emerald-900">Trusted</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-700 font-medium">Consistently delivers high-attendance, on-time events with zero certificate disputes.</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-800 font-bold">
                                        Priority search discovery; Pan-India national spotlight; instant certificate auto-clearance.
                                    </td>
                                </tr>
                                <tr className="hover:bg-[#FAF6EE] transition-colors">
                                    <td className="p-3.5 sm:p-4 font-mono font-black text-black">90 – 100</td>
                                    <td className="p-3.5 sm:p-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#a2ff86] text-black border border-black font-black text-[11px]">
                                            <span className="w-2 h-2 rounded-full bg-black" />
                                            Green
                                        </span>
                                    </td>
                                    <td className="p-3.5 sm:p-4 font-black text-black">Exceptional</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-700 font-medium">Proven elite national reliability across dozens of verified workshops & hackathons.</td>
                                    <td className="p-3.5 sm:p-4 text-neutral-800 font-bold">
                                        Orbix National Leaderboard featured society; highest campus trust tier; verified badge glow.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: INTERACTIVE BAYESIAN CREDIBILITY SIMULATOR                     */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black text-[#FFE566] font-mono font-black text-xs">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Live Mathematical Simulator</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-black">
                            Experience the Credibility Engine in Real Time
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-neutral-600">
                            Experiment with completed events, participant reach, advance notice hours, streaks, and cancellation incidents to observe dynamic Bayesian score evolution.
                        </p>
                    </div>

                    {/* Presets Selector */}
                    <div className="w-full sm:w-auto shrink-0">
                        <div className="sm:hidden w-full">
                            <NeoSelect
                                value={selectedPreset}
                                onChange={(val) => handleApplyPreset(val)}
                                options={BENCHMARK_PRESETS.map((p) => ({
                                    value: p.id,
                                    label: p.label,
                                    description: p.description,
                                }))}
                                size="sm"
                                className="w-full"
                                triggerClassName="bg-white text-xs font-black shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <div className="hidden sm:flex items-center gap-1.5 flex-wrap max-w-md justify-end">
                            {BENCHMARK_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => handleApplyPreset(p.id)}
                                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black border-2 border-black transition-all cursor-pointer ${
                                        selectedPreset === p.id
                                            ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] text-neutral-800 hover:bg-neutral-200"
                                    }`}
                                >
                                    {p.label.split(" (")[0]}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Simulator Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                    {/* Controls (7 cols) */}
                    <div className="lg:col-span-7 space-y-5">
                        {/* Control 1: Completed Events */}
                        <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-black">
                                <span>Verified Completed Events: {completedEvents}</span>
                                <span className="font-mono text-neutral-500">Weight: +{simResults.posWeight}x each</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="30"
                                value={completedEvents}
                                onChange={(e) => {
                                    setSelectedPreset("custom");
                                    setCompletedEvents(Number(e.target.value));
                                }}
                                className="w-full accent-black cursor-pointer"
                            />
                        </div>

                        {/* Control 2: Average Completed Quality */}
                        <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                            <div className="flex items-center justify-between text-xs font-black text-black">
                                <span>Avg Completed Event Quality (Qi): {avgCompletedQuality}/100</span>
                                <span className="font-mono text-neutral-500">6-Dim Rubric</span>
                            </div>
                            <input
                                type="range"
                                min="40"
                                max="100"
                                value={avgCompletedQuality}
                                onChange={(e) => {
                                    setSelectedPreset("custom");
                                    setAvgCompletedQuality(Number(e.target.value));
                                }}
                                className="w-full accent-black cursor-pointer"
                            />
                        </div>

                        {/* Control 3: Scope & Average Registrations */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <span className="text-xs font-black text-black block">Event Reach Scope</span>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedPreset("custom");
                                            setIsPanIndia(false);
                                        }}
                                        className={`flex-1 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer ${
                                            !isPanIndia ? "bg-[#38BDF8] text-black shadow-[2px_2px_0px_#000]" : "bg-white text-neutral-600"
                                        }`}
                                    >
                                        Campus (1.0x)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedPreset("custom");
                                            setIsPanIndia(true);
                                        }}
                                        className={`flex-1 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer ${
                                            isPanIndia ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]" : "bg-white text-neutral-600"
                                        }`}
                                    >
                                        Pan-India (1.2x)
                                    </button>
                                </div>
                            </div>

                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-black">
                                    <span>Avg Participants: {avgRegistrations}</span>
                                    <span className="font-mono text-neutral-500">{simResults.reachFactor}x Reach</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="500"
                                    step="10"
                                    value={avgRegistrations}
                                    onChange={(e) => {
                                        setSelectedPreset("custom");
                                        setAvgRegistrations(Number(e.target.value));
                                    }}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Control 4: Cancellations & Notice Hours */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-rose-950">
                                    <span>Cancellations: {cancellationsCount}</span>
                                    <span className="font-mono text-neutral-500">Weight: -{simResults.negWeight}x</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="5"
                                    value={cancellationsCount}
                                    onChange={(e) => {
                                        setSelectedPreset("custom");
                                        setCancellationsCount(Number(e.target.value));
                                    }}
                                    className="w-full accent-rose-600 cursor-pointer"
                                />
                            </div>

                            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-rose-950">
                                    <span>Notice: {noticeHours}h</span>
                                    <span className="font-mono text-neutral-500">{simResults.noticeFactor}x Notice</span>
                                </div>
                                <input
                                    type="range"
                                    min="4"
                                    max="168"
                                    step="4"
                                    value={noticeHours}
                                    onChange={(e) => {
                                        setSelectedPreset("custom");
                                        setNoticeHours(Number(e.target.value));
                                    }}
                                    className="w-full accent-rose-600 cursor-pointer"
                                />
                            </div>
                        </div>

                        {/* Control 5: Streak & Repeat Multipliers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-black">
                                    <span>Reliability Streak: {streak}</span>
                                    <span className="font-mono text-neutral-500">{simResults.streakFactor.toFixed(2)}x Boost</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="15"
                                    value={streak}
                                    onChange={(e) => {
                                        setSelectedPreset("custom");
                                        setStreak(Number(e.target.value));
                                    }}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>

                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-black">
                                    <span>Repeat Incidents: {repeatIncidents}</span>
                                    <span className="font-mono text-neutral-500">{simResults.repeatMultiplier.toFixed(2)}x Penalty</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="4"
                                    value={repeatIncidents}
                                    onChange={(e) => {
                                        setSelectedPreset("custom");
                                        setRepeatIncidents(Number(e.target.value));
                                    }}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Output Dashboard Gauge (5 cols) */}
                    <div className="lg:col-span-5 p-6 rounded-3xl bg-[#FAF6EE] border-3 border-black shadow-[6px_6px_0px_#000] space-y-6">
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                                    Simulated Final Score
                                </span>
                                {simResults.isProvisional && (
                                    <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                        Provisional
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-2">
                                <span className="text-6xl font-black text-black tracking-tight">
                                    {simResults.finalScore}
                                </span>
                                <span className="text-2xl font-black text-neutral-400">/ 100</span>
                            </div>
                        </div>

                        {/* Score Level Badge */}
                        <div className="p-3.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full border border-black ${simResults.dotColor}`} />
                                <span className="text-xs font-black text-black">{simResults.scoreBandLabel}</span>
                            </div>
                            <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                                0.70L + 0.30R
                            </span>
                        </div>

                        {/* Dual Formula Breakdown */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-3 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase font-bold block">Lifetime (L)</span>
                                <span className="text-xl font-black text-black">{simResults.lifetimeScore}</span>
                                <span className="text-[10px] text-neutral-600 block mt-0.5">70% Weight</span>
                            </div>
                            <div className="p-3 rounded-xl bg-white border border-black shadow-[1px_1px_0px_#000]">
                                <span className="text-[10px] font-mono text-neutral-500 uppercase font-bold block">Recent (R)</span>
                                <span className="text-xl font-black text-black">{simResults.recentScore}</span>
                                <span className="text-[10px] text-neutral-600 block mt-0.5">30% Weight</span>
                            </div>
                        </div>

                        {/* Evidence Factor Summary */}
                        <div className="p-3.5 rounded-2xl bg-white border border-black shadow-[1px_1px_0px_#000] space-y-1.5 text-xs">
                            <div className="flex items-center justify-between font-bold text-neutral-700">
                                <span>Total Evidence Weight:</span>
                                <span className="font-mono text-black font-black">{simResults.totalEvidenceWeight}</span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-neutral-700">
                                <span>Prior Inherent Weight:</span>
                                <span className="font-mono text-black font-black">10.0</span>
                            </div>
                            <div className="flex items-center justify-between font-bold text-neutral-700">
                                <span>Total Prior + Evidence:</span>
                                <span className="font-mono text-black font-black">{(10 + simResults.totalEvidenceWeight).toFixed(1)}</span>
                            </div>
                        </div>

                        {/* Link to Club Credibility Workspace */}
                        <Link
                            to="/club/credibility"
                            className="w-full py-3 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-xs shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <span>Open Your Club Credibility Workspace</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        </Link>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 7: STEP-BY-STEP CLUB MANAGEMENT PLAYBOOK (BEST PRACTICES)         */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        07
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Master Club Management Playbook: Best Practices
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Student leadership teams that consistently follow these 6 operational protocols routinely attain and sustain <strong>Trusted (75–89)</strong> and <strong>Exceptional (90–100)</strong> standing on Orbix:
                </p>

                {/* 6 Best Practice Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {bestPractices.map((bp, idx) => (
                        <div
                            key={idx}
                            className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-3"
                        >
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="font-mono text-sm font-black px-2.5 py-1 rounded-lg bg-black text-[#a2ff86]">
                                        {bp.number}
                                    </span>
                                    <span className="px-2.5 py-0.5 rounded-full bg-[#FAF6EE] text-neutral-800 border border-black text-[10px] font-black uppercase tracking-wider">
                                        {bp.tag}
                                    </span>
                                </div>
                                <h3 className="text-lg font-black text-black">{bp.title}</h3>
                                <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                                    {bp.content}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 8: FULL TRANSPARENCY & THE PRE-ACTION SAFETY SHIELD               */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        08
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        UI Architecture: The Pre-Action Safety Shield & Immutable Ledger
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Orbix strictly guarantees that <strong>no club action ever quietly reduces credibility without prior warning</strong>. The platform implements two architectural safeguards:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* Safeguard 1: Impact Modal */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-amber-600 stroke-[2.5]" />
                            <h3 className="text-base font-black text-black">
                                Predictive Pre-Action Warning Modal
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            Before a club officer can cancel an event, unpublish to draft, or delete a session with registered students, Orbix displays the <strong>Credibility Impact Modal</strong>. It projects the exact expected score delta, countdown of advance notice hours, number of affected students, and safer alternatives (e.g. offering a reschedule date).
                        </p>
                    </div>

                    {/* Safeguard 2: Immutable Ledger */}
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2">
                            <FileCheck className="w-5 h-5 text-emerald-600 stroke-[2.5]" />
                            <h3 className="text-base font-black text-black">
                                Append-Only Cryptographic Audit Trail
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            Every transition is permanently stored in the <code className="bg-[#FAF6EE] px-1 py-0.5 rounded border border-black text-black text-xs font-mono font-bold">club_credibility_ledger</code> table. Club officers see their exact Before Score, Delta, and After Score with the timestamp, actor attribution, and factor breakdown. In case of institutional disputes, entries can be formally reviewed and reversed by campus staff.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* CALL TO ACTION FOOTER BANNER                                              */}
            {/* ========================================================================= */}
            <div className="p-8 sm:p-12 rounded-3xl bg-black text-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="space-y-2 relative z-10 max-w-xl">
                    <span className="px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider">
                        Collegiate Accountability
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                        Build Your Campus Legacy on Verified Evidence
                    </h2>
                    <p className="text-xs sm:text-sm text-neutral-300 font-medium leading-relaxed">
                        Access your club&apos;s real-time credibility dashboard, review the dimensional breakdown of your completed events, inspect audit history, and lead your collegiate organization to national recognition.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 shrink-0 relative z-10">
                    <Link
                        to="/club/credibility"
                        className="px-6 py-3.5 rounded-xl bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <span>Club Credibility Dashboard</span>
                        <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                    </Link>
                    <Link
                        to="/docs"
                        className="px-6 py-3.5 rounded-xl bg-white hover:bg-neutral-100 text-black font-black text-sm border-2 border-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <span>Docs Explorer</span>
                    </Link>
                </div>
            </div>
        </article>
    );
};

export default ClubCredibilityDocumentary;
