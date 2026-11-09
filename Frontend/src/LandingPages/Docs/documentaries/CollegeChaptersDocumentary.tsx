import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    Building2,
    Award,
    ShieldCheck,
    CheckCircle2,
    Lock,
    Users,
    ArrowRight,
    Globe,
    Cpu,
    AlertCircle,
    Clock,
    HelpCircle,
    Zap,
    Ticket,
    FileSpreadsheet,
    QrCode,
} from "lucide-react";
import { OrbixLogo } from "../../../components/OrbixLogo";
import { NeoSelect } from "../../../components/NeoSelect";

// -----------------------------------------------------------------------------
// Interactive Simulator Interfaces & Presets
// -----------------------------------------------------------------------------
interface CollegeHubPreset {
    id: string;
    officialName: string;
    city: string;
    state: string;
    aisheCode: string;
    currentRank: number;
    activeChapters: number;
    studentBase: number;
}

const COLLEGE_PRESETS: CollegeHubPreset[] = [
    {
        id: "psit-kanpur",
        officialName: "Pranveer Singh Institute of Technology, Kanpur",
        city: "Kanpur",
        state: "Uttar Pradesh",
        aisheCode: "C-46844",
        currentRank: 14,
        activeChapters: 4,
        studentBase: 4200,
    },
    {
        id: "iit-delhi",
        officialName: "Indian Institute of Technology Delhi (IIT Delhi)",
        city: "New Delhi",
        state: "Delhi",
        aisheCode: "C-6395",
        currentRank: 1,
        activeChapters: 8,
        studentBase: 8500,
    },
    {
        id: "bits-pilani",
        officialName: "BITS Pilani, Pilani Campus",
        city: "Pilani",
        state: "Rajasthan",
        aisheCode: "U-0391",
        currentRank: 3,
        activeChapters: 6,
        studentBase: 5100,
    },
    {
        id: "iiit-hyderabad",
        officialName: "IIIT Hyderabad",
        city: "Hyderabad",
        state: "Telangana",
        aisheCode: "U-0013",
        currentRank: 2,
        activeChapters: 5,
        studentBase: 2400,
    },
    {
        id: "nsut-delhi",
        officialName: "Netaji Subhas University of Technology (NSUT)",
        city: "New Delhi",
        state: "Delhi",
        aisheCode: "U-0118",
        currentRank: 9,
        activeChapters: 5,
        studentBase: 6200,
    },
];

const SPECIALIZATION_CATEGORIES = [
    { value: "cp", label: "Competitive Programming & Algorithms (ACM Chapter)", basePoints: 450 },
    { value: "cloud", label: "Cloud Systems & Distributed DevOps (AWS SBG / Cloud Club)", basePoints: 400 },
    { value: "ai", label: "AI, Machine Learning & Data Systems", basePoints: 420 },
    { value: "oss", label: "Open Source & Systems Engineering (FOSS Society)", basePoints: 380 },
    { value: "security", label: "Cybersecurity & Cryptographic Protocols", basePoints: 410 },
];

export const CollegeChaptersDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Simulator State
    // -------------------------------------------------------------------------
    const [selectedCollegeId, setSelectedCollegeId] = useState<string>("psit-kanpur");
    const [categoryKey, setCategoryKey] = useState<string>("cp");
    const [eventScope, setEventScope] = useState<"campus" | "pan_india">("pan_india");
    const [attendeeCount, setAttendeeCount] = useState<number>(180);
    const [issueCertificates, setIssueCertificates] = useState<boolean>(true);
    const [hasFacultyAdvisor, setHasFacultyAdvisor] = useState<boolean>(true);
    const isRecruiting = true;

    const activeCollege = useMemo(() => {
        return COLLEGE_PRESETS.find((c) => c.id === selectedCollegeId) || COLLEGE_PRESETS[0];
    }, [selectedCollegeId]);

    const activeCategory = useMemo(() => {
        return SPECIALIZATION_CATEGORIES.find((c) => c.value === categoryKey) || SPECIALIZATION_CATEGORIES[0];
    }, [categoryKey]);

    // Computed Simulator Metrics
    const simulationResults = useMemo(() => {
        const scopeMultiplier = eventScope === "pan_india" ? 1.65 : 1.0;
        const certBonus = issueCertificates ? 120 : 0;
        const advisorBonus = hasFacultyAdvisor ? 80 : 0;
        const scalePoints = Math.round(attendeeCount * 2.8 * scopeMultiplier);
        const totalEstimatedScoreBoost = activeCategory.basePoints + scalePoints + certBonus + advisorBonus;

        // Estimated Credibility Evidence
        const credibilityGain = Math.min(
            22,
            Math.round((eventScope === "pan_india" ? 14 : 9) + (attendeeCount > 100 ? 5 : 2) + (hasFacultyAdvisor ? 3 : 0))
        );

        // Verification Readiness Score (0-100)
        let readinessScore = 55;
        if (hasFacultyAdvisor) readinessScore += 25;
        if (issueCertificates) readinessScore += 10;
        if (isRecruiting) readinessScore += 10;
        readinessScore = Math.min(100, readinessScore);

        return {
            totalEstimatedScoreBoost,
            credibilityGain,
            readinessScore,
            qrPassLatencyMs: Math.round(18 + attendeeCount * 0.05),
            leadTeamRecommendation:
                attendeeCount > 250
                    ? "6 Officers (Lead Chair, 2 Co-Leads, Tech Head, Logistics Lead, PR Lead)"
                    : "4 Officers (Lead Chair, Co-Lead, Tech Head, PR/Outreach Lead)",
        };
    }, [activeCategory, eventScope, attendeeCount, issueCertificates, hasFacultyAdvisor, isRecruiting]);

    return (
        <article className="space-y-16 sm:space-y-24">
            {/* ========================================================================= */}
            {/* DOCUMENTARY HERO HEADER                                                   */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6 relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black text-[#FFE566] text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000]">
                            <OrbixLogo className="w-4 h-4 text-[#FFE566]" />
                            <span>Campus Architecture Blueprint</span>
                        </span>
                        <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-950 border border-black text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_#000] hidden sm:inline-block">
                            AISHE Institutional Protocol v2.4
                        </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-600">
                        <Clock className="w-3.5 h-3.5 text-black" />
                        <span>14 min read</span>
                        <span>•</span>
                        <span>Orbix Campus Ecosystem</span>
                    </div>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-[1.08]">
                        Orbix College Chapters: Campus Hub Architecture &amp; Operations Standard
                    </h1>
                    <p className="text-base sm:text-xl font-bold text-neutral-700 leading-relaxed max-w-4xl">
                        Authoritative specification for collegiate developer chapters, student tech societies, and campus hackathon hosts. Details our canonical AISHE institutional directory, dual-scope event arenas, sovereign coordinator keys, turnkey Certificate Studio issuance, and Inter-College Leaderboard mechanics.
                    </p>
                </div>

                {/* Neo-Brutalist Tags */}
                <div className="flex flex-wrap gap-2 pt-2">
                    {[
                        "College Chapters",
                        "AISHE Directory",
                        "Campus Hubs",
                        "Pan-India Arenas",
                        "Certificate Studio",
                        "Sovereign Lead Keys",
                        "Inter-College Score",
                        "Anti-Squatting",
                    ].map((tag, idx) => (
                        <span
                            key={idx}
                            className="px-3 py-1 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000]"
                        >
                            #{tag}
                        </span>
                    ))}
                </div>

                {/* Authoritative Banner Image Container */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden bg-[#FAF6EE] shadow-[5px_5px_0px_#000] w-full mt-4">
                    <img
                        src="/assets/college-chapters-banner.svg"
                        alt="Orbix College Chapters Architecture & Playbook Standard"
                        className="w-full h-auto block object-cover max-h-[520px]"
                    />
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: THE HUB-AND-SPOKE PARADIGM & AISHE DIRECTORY                   */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        The Hub-and-Spoke Paradigm &amp; The AISHE National Directory
                    </h2>
                </div>

                <div className="prose prose-neutral max-w-none space-y-4 text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    <p>
                        In traditional campus ecosystems, developer groups operate in isolated, ephemeral silos. A student group registers a WhatsApp community, launches a hackathon on an external form, prints unverified paper certificates, and vanishes when the final-year leads graduate. This fragmentation leaves incoming students without continuity and deprives the college of institutional credit.
                    </p>
                    <p>
                        Orbix solves this through an <strong>authoritative Hub-and-Spoke architecture</strong> anchored to India&apos;s <strong>AISHE (All India Survey on Higher Education)</strong> national database. Every university or engineering institution has exactly <strong>one canonical Campus Hub</strong>, under which diverse, verified student chapters operate with sovereign autonomy.
                    </p>
                </div>

                {/* Architecture Visual Diagram Grid */}
                <div className="p-6 sm:p-8 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-6">
                    <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
                        <div className="flex items-center gap-2">
                            <Building2 className="w-5 h-5 text-black" />
                            <h3 className="font-black text-lg text-black">Canonical Campus Topology</h3>
                        </div>
                        <span className="text-xs font-mono font-bold bg-[#FFE566] px-2.5 py-1 rounded-lg border border-black shadow-[1px_1px_0px_#000]">
                            1 Hub : N Federated Chapters
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        {/* Hub Node */}
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black">
                                <Building2 className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <h4 className="font-black text-base text-black">Institutional Campus Hub</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Single authoritative entity mapped to Ministry of Education AISHE code (e.g. <code>C-46844</code> for PSIT Kanpur, <code>C-6395</code> for IIT Delhi).
                            </p>
                            <div className="pt-2 border-t border-black/10 text-[11px] font-mono font-bold text-neutral-700">
                                Aggregates campus rank, total coders &amp; credibility
                            </div>
                        </div>

                        {/* Chapter Node */}
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black">
                                <Zap className="w-5 h-5 text-black fill-black" />
                            </div>
                            <h4 className="font-black text-base text-black">Federated Chapters</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Specialized student bodies: ACM Chapter, AWS Student Builders, GDG on Campus, FOSS Club. Each manages its own events and lead roster.
                            </p>
                            <div className="pt-2 border-t border-black/10 text-[11px] font-mono font-bold text-neutral-700">
                                Independent agendas, sovereign officer permissions
                            </div>
                        </div>

                        {/* Student / Pass Node */}
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <div className="w-10 h-10 rounded-xl bg-[#FF9933] border-2 border-black flex items-center justify-center font-black">
                                <Ticket className="w-5 h-5 text-black stroke-[2.5]" />
                            </div>
                            <h4 className="font-black text-base text-black">Student Verification Pass</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                Enrolled students verify college affiliation once. Unlocks instant RSVP passes for campus workshops and pan-India hackathons.
                            </p>
                            <div className="pt-2 border-t border-black/10 text-[11px] font-mono font-bold text-neutral-700">
                                Zero-leakage verification, anti-spoof pass keys
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: CHAPTER GENESIS & 4-TIER ONBOARDING LIFECYCLE                  */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Chapter Genesis &amp; The 4-Tier Onboarding Lifecycle
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    To maintain strict institutional integrity and prevent brand squatting, every college chapter is onboarded through a standardized 4-tier lifecycle before being granted publishing privileges:
                </p>

                {/* 4-Tier Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {/* Tier 1 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-black text-neutral-500">TIER 01</span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-400 text-[10px] font-black">
                                    Identity Intake
                                </span>
                            </div>
                            <h3 className="font-black text-base text-black mt-2">Lead Identification</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-1">
                                Student chair provides their verified university email (e.g. <code>@psit.ac.in</code>), student registration number, department, and projected year of graduation.
                            </p>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-neutral-500 pt-2 border-t border-neutral-100">
                            Instant automated triage
                        </div>
                    </div>

                    {/* Tier 2 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-black text-neutral-500">TIER 02</span>
                                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-950 border border-sky-400 text-[10px] font-black">
                                    Charter Audit
                                </span>
                            </div>
                            <h3 className="font-black text-base text-black mt-2">Constitution &amp; Focus</h3>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-1">
                                Submission of chapter charter, specialization category (Algorithms, Cloud, AI), social handles, repository org, and non-commercial pledge.
                            </p>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-neutral-500 pt-2 border-t border-neutral-100">
                            Domain anti-squatting check
                        </div>
                    </div>

                    {/* Tier 3 */}
                    <div className="p-5 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-black text-neutral-500">TIER 03</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black">
                                    Campus Endorsement
                                </span>
                            </div>
                            <h3 className="font-black text-base text-black mt-2">Faculty Handshake</h3>
                            <p className="text-xs text-neutral-700 font-medium leading-relaxed mt-1">
                                Verification email dispatched to designated faculty advisor, department HOD, or dean of student affairs. Validates student chair’s mandate.
                            </p>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-neutral-600 pt-2 border-t border-black/10">
                            Institutional DKIM verification
                        </div>
                    </div>

                    {/* Tier 4 */}
                    <div className="p-5 rounded-2xl bg-[#a2ff86]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between">
                        <div>
                            <div className="flex items-center justify-between">
                                <span className="font-mono text-xs font-black text-neutral-500">TIER 04</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black text-[10px] font-black">
                                    Activated
                                </span>
                            </div>
                            <h3 className="font-black text-base text-black mt-2">Workspace Provisioning</h3>
                            <p className="text-xs text-neutral-800 font-medium leading-relaxed mt-1">
                                Official chapter dashboard activated with <strong>Verified Chapter Badge</strong>, event publishing keys, Certificate Studio console, and recruitment toggle.
                            </p>
                        </div>
                        <div className="text-[11px] font-mono font-bold text-emerald-900 pt-2 border-t border-black/10">
                            Indexed on national campus map
                        </div>
                    </div>
                </div>

                {/* Callout: Strict Account Isolation Guarantee */}
                <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0">
                        <Lock className="w-5 h-5 text-black" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-black text-sm sm:text-base text-black">
                            Security Principle: Sovereign Lead Isolation
                        </h4>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            Club leadership access is strictly partitioned from individual user accounts. Chapter coordinators can publish events, manage RSVPs, issue event credentials, and update chapter social feeds, but they have <strong>zero write access</strong> to any student&apos;s personal LeetCode/Codeforces stats, Orbix Score, resume analytics, or portfolio projects.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: DUAL-SCOPE EVENT ARENAS (CAMPUS VS PAN-INDIA)                  */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Dual-Scope Event Arenas: Campus Workshops vs. Pan-India Hackathons
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    College chapters organize two distinct classes of events. Orbix enforces programmatic registration gates for both:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Scope A: Campus-Restricted Workshops */}
                    <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="px-3 py-1 rounded-full bg-[#FFE566] text-black border border-black text-xs font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                SCOPE: CAMPUS-RESTRICTED
                            </span>
                            <span className="text-xs font-mono font-bold text-neutral-500">Internal Sessions</span>
                        </div>

                        <h3 className="text-xl font-black text-black">Host Campus Exclusive Sessions</h3>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                            Designed for hands-on computer lab sessions, internal competitive programming rounds, ICPC mock contests, and hardware workshops with physical seat constraints.
                        </p>

                        <div className="space-y-2 pt-2 border-t-2 border-black/10">
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Gated strictly by host institution AISHE code</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Automatic student ID validation prevents external signups</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Ideal for lab capacity limits (e.g. 60–120 workstations)</span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-mono text-neutral-700">
                            <code>Gate rule: student.college_id === event.college_id</code>
                        </div>
                    </div>

                    {/* Scope B: Pan-India Hackathons */}
                    <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[5px_5px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="px-3 py-1 rounded-full bg-[#FF9933] text-black border border-black text-xs font-black uppercase tracking-wider shadow-[1px_1px_0px_#000]">
                                SCOPE: PAN-INDIA ARENA
                            </span>
                            <span className="text-xs font-mono font-bold text-neutral-500">Nationwide Arena</span>
                        </div>

                        <h3 className="text-xl font-black text-black">National Hackathons &amp; Sprints</h3>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                            Allows campus chapters to put their college on the national tech map. Open to verified college developers from across India, bringing thousands of coders to your campus arena.
                        </p>

                        <div className="space-y-2 pt-2 border-t-2 border-black/10">
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-[#FF9933] shrink-0" />
                                <span>Prominently broadcast in national explore spotlights</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-[#FF9933] shrink-0" />
                                <span>Inter-college team formation &amp; cross-campus collaboration</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                                <CheckCircle2 className="w-4 h-4 text-[#FF9933] shrink-0" />
                                <span>1.65x multiplier applied toward Inter-College Leaderboard</span>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-mono text-neutral-700">
                            <code>Gate rule: student.is_verified_college_student === true</code>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: INTERACTIVE CHAPTER STRATEGY & CAMPUS SIMULATOR                */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Interactive Chapter Strategy &amp; Campus Simulator
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Test your chapter operations model before publishing. Simulate attendance volume, event scope, credential issuance, and observe the estimated boost to your institution&apos;s National Leaderboard standing:
                </p>

                {/* Simulator Card Container */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] space-y-8">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-5">
                        <div className="space-y-1">
                            <span className="px-2.5 py-0.5 rounded-md bg-[#a2ff86] text-black font-mono font-black text-xs uppercase tracking-wider">
                                Live Engine Simulation
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-black">
                                Chapter Operation &amp; Leaderboard Impact Calculator
                            </h3>
                        </div>
                        <div className="text-xs font-mono font-bold text-neutral-600 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/20">
                            Algorithm Model: ChapterBoost_v2.4
                        </div>
                    </div>

                    {/* Controls Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {/* Control 1: Select College */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 className="w-3.5 h-3.5 text-black" />
                                <span>Select Campus Hub</span>
                            </label>
                            <NeoSelect
                                value={selectedCollegeId}
                                onChange={(val) => setSelectedCollegeId(val)}
                                options={COLLEGE_PRESETS.map((c) => ({
                                    value: c.id,
                                    label: c.officialName,
                                    description: `AISHE: ${c.aisheCode} • Rank #${c.currentRank}`,
                                }))}
                                size="md"
                                className="w-full"
                                triggerClassName="bg-[#FAF6EE] font-black text-xs"
                            />
                        </div>

                        {/* Control 2: Chapter Specialization */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Cpu className="w-3.5 h-3.5 text-black" />
                                <span>Chapter Specialization</span>
                            </label>
                            <NeoSelect
                                value={categoryKey}
                                onChange={(val) => setCategoryKey(val)}
                                options={SPECIALIZATION_CATEGORIES.map((c) => ({
                                    value: c.value,
                                    label: c.label,
                                    description: `Base Weight: +${c.basePoints} pts`,
                                }))}
                                size="md"
                                className="w-full"
                                triggerClassName="bg-[#FAF6EE] font-black text-xs"
                            />
                        </div>

                        {/* Control 3: Event Scope */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Globe className="w-3.5 h-3.5 text-black" />
                                <span>Event Scope Tier</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEventScope("campus")}
                                    className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer ${
                                        eventScope === "campus"
                                            ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100"
                                    }`}
                                >
                                    Campus-Only
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventScope("pan_india")}
                                    className={`py-2 px-3 rounded-xl border-2 border-black text-xs font-black transition-all cursor-pointer ${
                                        eventScope === "pan_india"
                                            ? "bg-[#FF9933] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100"
                                    }`}
                                >
                                    Pan-India (1.65x)
                                </button>
                            </div>
                        </div>

                        {/* Control 4: Attendee Slider */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5 text-black" />
                                    <span>Expected RSVP Volume</span>
                                </label>
                                <span className="font-mono font-black text-xs px-2 py-0.5 rounded bg-black text-[#a2ff86]">
                                    {attendeeCount} Coders
                                </span>
                            </div>
                            <input
                                type="range"
                                min={20}
                                max={1000}
                                step={10}
                                value={attendeeCount}
                                onChange={(e) => setAttendeeCount(parseInt(e.target.value, 10))}
                                className="w-full accent-black cursor-pointer"
                            />
                            <div className="flex justify-between text-[10px] font-mono text-neutral-500">
                                <span>20 (Lab)</span>
                                <span>500 (Auditorium)</span>
                                <span>1000+ (National Arena)</span>
                            </div>
                        </div>

                        {/* Control 5: Certificate Studio Toggle */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                <Award className="w-3.5 h-3.5 text-black" />
                                <span>Certificate Studio</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setIssueCertificates(!issueCertificates)}
                                className={`w-full py-2.5 px-3 rounded-xl border-2 border-black text-xs font-black flex items-center justify-between cursor-pointer transition-all ${
                                    issueCertificates
                                        ? "bg-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-600"
                                }`}
                            >
                                <span>SHA-256 Batch Issuance</span>
                                <span>{issueCertificates ? "ACTIVE (+120 pts)" : "OFF"}</span>
                            </button>
                        </div>

                        {/* Control 6: Faculty Advisor Toggle */}
                        <div className="space-y-2">
                            <label className="text-xs font-black text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-black" />
                                <span>Faculty Endorsement</span>
                            </label>
                            <button
                                type="button"
                                onClick={() => setHasFacultyAdvisor(!hasFacultyAdvisor)}
                                className={`w-full py-2.5 px-3 rounded-xl border-2 border-black text-xs font-black flex items-center justify-between cursor-pointer transition-all ${
                                    hasFacultyAdvisor
                                        ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                        : "bg-[#FAF6EE] text-neutral-600"
                                }`}
                            >
                                <span>Verified Advisor Sign-off</span>
                                <span>{hasFacultyAdvisor ? "VERIFIED" : "PENDING"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Simulation Output Dashboard */}
                    <div className="p-6 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xs font-black text-neutral-500 uppercase">
                                Projected Simulation Output
                            </span>
                            <span className="text-xs font-mono font-bold text-neutral-700">
                                Campus: {activeCollege.officialName} ({activeCollege.aisheCode})
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {/* Metric 1 */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider block">
                                    Campus Score Boost
                                </span>
                                <span className="text-2xl sm:text-3xl font-black text-black">
                                    +{simulationResults.totalEstimatedScoreBoost.toLocaleString()}
                                </span>
                                <span className="text-[10px] font-mono font-bold text-emerald-700 block mt-1">
                                    ↑ Contributes to National Rank #{activeCollege.currentRank}
                                </span>
                            </div>

                            {/* Metric 2 */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider block">
                                    Credibility Score Gain
                                </span>
                                <span className="text-2xl sm:text-3xl font-black text-[#0277BD]">
                                    +{simulationResults.credibilityGain} pts
                                </span>
                                <span className="text-[10px] font-mono font-bold text-neutral-600 block mt-1">
                                    Bayesian Evidence Unit
                                </span>
                            </div>

                            {/* Metric 3 */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider block">
                                    Readiness Scorecard
                                </span>
                                <span className="text-2xl sm:text-3xl font-black text-[#E65100]">
                                    {simulationResults.readinessScore}%
                                </span>
                                <span className="text-[10px] font-mono font-bold text-neutral-600 block mt-1">
                                    Tier: {simulationResults.readinessScore >= 80 ? "Excellence" : "Standard"}
                                </span>
                            </div>

                            {/* Metric 4 */}
                            <div className="p-4 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider block">
                                    Venue Check-in Latency
                                </span>
                                <span className="text-2xl sm:text-3xl font-black text-neutral-900">
                                    ~{simulationResults.qrPassLatencyMs}ms
                                </span>
                                <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 mt-1">
                                    <Zap className="w-3 h-3 fill-emerald-600 text-emerald-600 shrink-0" />
                                    <span>Real-time QR Verification</span>
                                </span>
                            </div>
                        </div>

                        {/* Recommended Team Blueprint */}
                        <div className="p-4 rounded-xl bg-white border border-black/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-bold text-neutral-800">
                            <div>
                                <span className="text-neutral-500 uppercase font-mono block text-[10px]">
                                    Recommended Chapter Lead Roster:
                                </span>
                                <span>{simulationResults.leadTeamRecommendation}</span>
                            </div>
                            <Link
                                to="/docs/club-verification-protocol"
                                className="px-3 py-1.5 rounded-lg bg-black text-[#FFE566] text-xs font-black inline-flex items-center gap-1.5 shrink-0 self-start sm:self-center"
                            >
                                <span>View Verification Checklist</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: CERTIFICATE STUDIO & CREDENTIAL ECOSYSTEM                      */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Certificate Studio Ecosystem &amp; Cryptographic SHA-256 Ledger
                    </h2>
                </div>

                <div className="prose prose-neutral max-w-none space-y-4 text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    <p>
                        A major administrative burden for student clubs is credential creation and verification. Unverified certificates created on generic design apps invite forgery and carry zero weight with recruiters.
                    </p>
                    <p>
                        Orbix equips every verified chapter with <strong>Certificate Studio</strong> — an automated, high-throughput digital credential generator. Every certificate issued through a chapter event includes:
                    </p>
                </div>

                {/* 3 Pillars of Certificate Studio */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black">
                            <FileSpreadsheet className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <h4 className="font-black text-base text-black">CSV Bulk Ingestion</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            Upload your event attendee roster via CSV. Automatically resolves recipient names, college names, roles (Winner, Runner Up, Participant), and emits preview proofs in seconds.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black">
                            <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <h4 className="font-black text-base text-black">Cryptographic SHA-256 Hash</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            Every credential is assigned an immutable 64-character verification hash computed from recipient identity, host chapter ID, and event timestamp.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-10 h-10 rounded-xl bg-[#FF9933] border-2 border-black flex items-center justify-center font-black">
                            <QrCode className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <h4 className="font-black text-base text-black">Public Verification URL &amp; QR</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            Includes a tamper-proof QR code linking to <code>/verify/cert/:hash</code>. Recruiters and admissions committees can verify authenticity with a single scan.
                        </p>
                    </div>
                </div>

                {/* Technical Sample Card */}
                <div className="p-5 sm:p-6 rounded-2xl bg-[#0D0D0D] border-2 border-black text-[#a2ff86] font-mono text-xs shadow-[4px_4px_0px_#000] space-y-2 overflow-x-auto">
                    <div className="flex items-center justify-between text-neutral-400 border-b border-neutral-800 pb-2">
                        <span>ORBIX CERTIFICATE LEDGER RECORD FORMAT</span>
                        <span>SHA-256 VERIFIED</span>
                    </div>
                    <pre className="text-[11px] leading-relaxed">
{`{
  "certificate_id": "cert_psit_acm_hack_2026_042",
  "recipient_name": "Aarav Sharma",
  "recipient_college": "Pranveer Singh Institute of Technology, Kanpur",
  "issuing_chapter": "ACM Student Chapter (psit-kanpur)",
  "aishe_code": "C-46844",
  "event_title": "AlgoSprint 2026: Pan-India ICPC Arena",
  "event_date": "2026-11-15T09:00:00Z",
  "credential_type": "FIRST_PLACE_WINNER",
  "verification_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "public_verify_url": "https://orbix.dev/verify/cert/e3b0c44298fc1c14..."
}`}
                    </pre>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: FUELING THE NATIONAL INTER-COLLEGE LEADERBOARD                 */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        06
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Fueling the National Inter-College Leaderboard
                    </h2>
                </div>

                <div className="prose prose-neutral max-w-none space-y-4 text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    <p>
                        A central feature of Orbix is the <strong>Inter-College Leaderboard</strong>, which benchmarks engineering institutions across India based on actual technical output. Active college chapters are the primary growth engine for a college&apos;s standing.
                    </p>
                    <p>
                        Institutional points are accumulated through three balanced channels:
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <span className="text-xs font-mono font-bold text-neutral-500">CHANNEL 01 (50%)</span>
                        <h4 className="font-black text-base text-black">Member Platform Ratings</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            Aggregated competitive programming performance (LeetCode contest ratings, Codeforces ranks) and GitHub contributions of enrolled students.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <span className="text-xs font-mono font-bold text-neutral-500">CHANNEL 02 (30%)</span>
                        <h4 className="font-black text-base text-black">Verified Event Footprint</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            Completed campus workshops and Pan-India arenas organized by verified chapters. Scored via Bayesian evidence and attendance volume.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <span className="text-xs font-mono font-bold text-neutral-500">CHANNEL 03 (20%)</span>
                        <h4 className="font-black text-base text-black">Inter-Campus Victories</h4>
                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                            When your college students win podium finishes at hackathons hosted by other institutions, bonus multiplier points are awarded back to your Campus Hub.
                        </p>
                    </div>
                </div>

                {/* Anti-Cheat Callout */}
                <div className="p-5 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] flex items-start gap-4">
                    <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0">
                        <AlertCircle className="w-5 h-5 text-black" />
                    </div>
                    <div className="space-y-1">
                        <h4 className="font-black text-sm text-black">
                            Anti-Gaming &amp; Anti-Sybil Resistance
                        </h4>
                        <p className="text-xs text-neutral-700 font-medium leading-relaxed">
                            To prevent point farming, phantom events (events with no verified check-in QR scans) award 0 leaderboard points. Diminishing returns curves prevent any single hyper-active chapter from monopolizing the leaderboard, ensuring balanced growth across the institution.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 7: GOVERNANCE, COMPLIANCE & RECRUITMENT STATUS                     */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        07
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Governance, Anti-Squatting &amp; Leadership Handover
                    </h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Annual Leadership Handover */}
                    <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <h3 className="font-black text-lg text-black flex items-center gap-2">
                            <Users className="w-5 h-5 text-black" />
                            <span>Annual Leadership Handover Protocol</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            College chapters change student coordinators annually. Orbix provides a cryptographic <strong>Handover Key</strong> workflow:
                        </p>
                        <ol className="list-decimal list-inside space-y-1.5 text-xs font-bold text-neutral-800 pt-1">
                            <li>Outgoing Student Chair initiates &quot;Transfer Leadership&quot; from Chapter Settings.</li>
                            <li>Incoming Lead accepts invitation using their verified institutional college email.</li>
                            <li>Faculty Advisor confirms the transition with a 1-click tokenized email validation.</li>
                            <li>Chapter historical records, events, credibility points, and certificates remain seamlessly preserved.</li>
                        </ol>
                    </div>

                    {/* Anti-Squatting Rules */}
                    <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <h3 className="font-black text-lg text-black flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-black" />
                            <span>Anti-Squatting &amp; Dormant Club Reclaiming</span>
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            To ensure university brand names are actively utilized by genuine student leaders:
                        </p>
                        <ul className="list-disc list-inside space-y-1.5 text-xs font-bold text-neutral-800 pt-1">
                            <li>Chapters inactive for 180 consecutive days enter <em>Provisional Suspension</em>.</li>
                            <li>Legitimate student successor groups can submit a reclamation ticket supported by faculty endorsement.</li>
                            <li>Commercial entities or unchartered clubs attempting to impersonate student bodies are permanently de-indexed.</li>
                        </ul>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 8: FREQUENTLY ASKED QUESTIONS & NEXT STEPS                         */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        08
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Frequently Asked Questions &amp; Chapter Playbook
                    </h2>
                </div>

                <div className="space-y-4">
                    {/* FAQ 1 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-sm sm:text-base text-black flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-neutral-500" />
                            <span>Can our college have multiple developer chapters?</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            <strong>Yes, absolutely.</strong> An institutional Campus Hub can host multiple specialized chapters (e.g. an ACM Chapter for competitive programming, an AWS Student Builders Group for cloud computing, a Google Developer Group, and a Women in Tech society). Each chapter operates with its own distinct coordinators while contributing to the same parent university.
                        </p>
                    </div>

                    {/* FAQ 2 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-sm sm:text-base text-black flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-neutral-500" />
                            <span>What happens if our college does not provide students with official .edu emails?</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            If your institution does not issue student emails, you can register using your personal email and provide institutional proof (such as a valid physical student ID card, fee receipt, and faculty advisor contact). Our verification team will contact the campus registrar directly to validate your charter.
                        </p>
                    </div>

                    {/* FAQ 3 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <h4 className="font-black text-sm sm:text-base text-black flex items-center gap-2">
                            <HelpCircle className="w-4 h-4 text-neutral-500" />
                            <span>Is there any platform fee for hosting events or issuing certificates on Orbix?</span>
                        </h4>
                        <p className="text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed">
                            <strong>No.</strong> Orbix is dedicated to advancing student engineering across India. Turnkey event hosting, QR pass synchronization, live RSVP tracking, and Certificate Studio generation are 100% free for all verified collegiate student organizations.
                        </p>
                    </div>
                </div>

                {/* BOTTOM CTA: JUMP INTO ACTION */}
                <div className="p-6 sm:p-10 rounded-3xl bg-black text-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#a2ff86] space-y-6 mt-8">
                    <div className="space-y-2 max-w-2xl">
                        <span className="px-3 py-1 rounded-full bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider">
                            Ready to Lead Your Campus?
                        </span>
                        <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                            Put Your College on the National Tech Map!
                        </h3>
                        <p className="text-xs sm:text-sm text-neutral-300 font-medium leading-relaxed">
                            Join verified student chairs from IIT Delhi, BITS Pilani, PSIT Kanpur, IIIT Hyderabad, and hundreds of institutions nationwide. Publish challenges, organize hackathons, and build a lasting engineering legacy.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <Link
                            to="/auth/signup?tab=club&ref=college-chapters-docs"
                            className="px-5 py-3 rounded-xl bg-[#FFE566] hover:bg-yellow-300 text-black border-2 border-black text-xs font-black shadow-[3px_3px_0px_#a2ff86] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <span>Host as Club Chapter</span>
                            <ArrowRight className="w-4 h-4 stroke-[2.5]" />
                        </Link>
                        <Link
                            to="/docs/club-verification-protocol"
                            className="px-5 py-3 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black shadow-[3px_3px_0px_#FFE566] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                            <span>Read Verification Standard</span>
                        </Link>
                        <Link
                            to="/docs/club-credibility-algorithm"
                            className="px-5 py-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-[#a2ff86] border-2 border-neutral-700 text-xs font-black flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <Award className="w-4 h-4 stroke-[2.5]" />
                            <span>View Credibility Engine</span>
                        </Link>
                    </div>
                </div>
            </section>
        </article>
    );
};

export default CollegeChaptersDocumentary;
