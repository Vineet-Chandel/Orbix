import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    ShieldCheck,
    Building2,
    CheckCircle2,
    Lock,
    ExternalLink,
    Users,
    Sliders,
    ArrowRight,
    FileCheck,
    Mail,
    Phone,
    Globe,
    Check,
} from "lucide-react";
import { OrbixLogo } from "../../../components/OrbixLogo";

interface SampleApplication {
    id: string;
    clubName: string;
    collegeName: string;
    location: string;
    category: string;
    repName: string;
    repRole: string;
    contactEmail: string;
    officialCollegeEmail: string;
    phone: string;
    websiteUrl: string;
    socialUrl: string;
    submittedAt: string;
    defaultStatus: "pending" | "under_review" | "needs_information" | "ready_for_promotion" | "approved" | "rejected";
    checklistDefaults: {
        collegeContactStatus: "not_started" | "contacted" | "confirmed" | "not_found";
        clubExistenceConfirmed: boolean;
        collegeAuthorizationConfirmed: boolean;
        representativeAuthorityConfirmed: boolean;
    };
    riskLevel: "Low Risk — Verified Domain" | "Medium Risk — Awaiting Faculty Sign-off" | "High Risk — Unverified Entity";
    riskColor: string;
    internalNotes: string;
}

const SAMPLE_APPLICATIONS: SampleApplication[] = [
    {
        id: "app-iitd-acm",
        clubName: "ACM Student Chapter",
        collegeName: "Indian Institute of Technology Delhi (IIT Delhi)",
        location: "New Delhi, Delhi, India",
        category: "Competitive Programming & Algorithms",
        repName: "Aarav Sharma",
        repRole: "Lead Student Chair",
        contactEmail: "aarav.sharma@gmail.com",
        officialCollegeEmail: "aarav.sharma@cse.iitd.ac.in",
        phone: "+91 98112 34567",
        websiteUrl: "https://acm.iitd.ac.in",
        socialUrl: "https://linkedin.com/company/acm-iitd",
        submittedAt: "Oct 28, 2026",
        defaultStatus: "ready_for_promotion",
        checklistDefaults: {
            collegeContactStatus: "confirmed",
            clubExistenceConfirmed: true,
            collegeAuthorizationConfirmed: true,
            representativeAuthorityConfirmed: true,
        },
        riskLevel: "Low Risk — Verified Domain",
        riskColor: "bg-emerald-100 text-emerald-900 border-emerald-400",
        internalNotes: "Verified via CSE Department staff directory. Dean of Student Affairs office confirmed Aarav Sharma as the active 2026-27 ACM Student Chapter President. Institutional email validated with DKIM.",
    },
    {
        id: "app-srm-codex",
        clubName: "Codex Developers Society",
        collegeName: "SRM Institute of Science and Technology",
        location: "Chennai, Tamil Nadu, India",
        category: "Open Source & Software Engineering",
        repName: "Rohan Patel",
        repRole: "President",
        contactEmail: "rohan.codex@gmail.com",
        officialCollegeEmail: "rohan_p@srmist.edu.in",
        phone: "+91 94451 22334",
        websiteUrl: "https://srmcodex.dev",
        socialUrl: "https://github.com/codex-srm",
        submittedAt: "Oct 29, 2026",
        defaultStatus: "under_review",
        checklistDefaults: {
            collegeContactStatus: "contacted",
            clubExistenceConfirmed: true,
            collegeAuthorizationConfirmed: true,
            representativeAuthorityConfirmed: false,
        },
        riskLevel: "Medium Risk — Awaiting Faculty Sign-off",
        riskColor: "bg-amber-100 text-amber-900 border-amber-400",
        internalNotes: "Club existence verified via university tech club directory. Faculty advisor contacted via campus email; awaiting confirmation that Rohan Patel holds presidential sign-off.",
    },
    {
        id: "app-rogue-club",
        clubName: "Campus Crypto Trading League",
        collegeName: "National Institute of Technology Karnataka",
        location: "Surathkal, Karnataka, India",
        category: "Web3 & Trading",
        repName: "Anonymous User",
        repRole: "Founder",
        contactEmail: "cryptorush2026@tempmail.com",
        officialCollegeEmail: "none_provided@unknown",
        phone: "+91 99999 00000",
        websiteUrl: "https://telegram.me/nitk_crypto",
        socialUrl: "https://x.com/nitk_crypto",
        submittedAt: "Oct 29, 2026",
        defaultStatus: "rejected",
        checklistDefaults: {
            collegeContactStatus: "not_found",
            clubExistenceConfirmed: false,
            collegeAuthorizationConfirmed: false,
            representativeAuthorityConfirmed: false,
        },
        riskLevel: "High Risk — Unverified Entity",
        riskColor: "bg-rose-100 text-rose-900 border-rose-400",
        internalNotes: "No institutional email provided. Telegram group identified as an unchartered commercial trading community. Disavowed by student welfare board.",
    },
];

export const ClubVerificationDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Reviewer Inspector State
    // -------------------------------------------------------------------------
    const [selectedAppId, setSelectedAppId] = useState<string>("app-iitd-acm");
    const activeApp = SAMPLE_APPLICATIONS.find((a) => a.id === selectedAppId) || SAMPLE_APPLICATIONS[0];

    // Checklist toggles
    const [collegeContactStatus, setCollegeContactStatus] = useState<"not_started" | "contacted" | "confirmed" | "not_found">(
        activeApp.checklistDefaults.collegeContactStatus
    );
    const [clubExistence, setClubExistence] = useState<boolean>(activeApp.checklistDefaults.clubExistenceConfirmed);
    const [collegeAuth, setCollegeAuth] = useState<boolean>(activeApp.checklistDefaults.collegeAuthorizationConfirmed);
    const [repAuthority, setRepAuthority] = useState<boolean>(activeApp.checklistDefaults.representativeAuthorityConfirmed);
    const [simulatedStatus, setSimulatedStatus] = useState<string>(activeApp.defaultStatus);
    const [promotionSuccess, setPromotionSuccess] = useState<boolean>(activeApp.defaultStatus === "approved");

    // Sync state when switching sample application
    const handleSwitchApp = (appId: string) => {
        setSelectedAppId(appId);
        const next = SAMPLE_APPLICATIONS.find((a) => a.id === appId) || SAMPLE_APPLICATIONS[0];
        setCollegeContactStatus(next.checklistDefaults.collegeContactStatus);
        setClubExistence(next.checklistDefaults.clubExistenceConfirmed);
        setCollegeAuth(next.checklistDefaults.collegeAuthorizationConfirmed);
        setRepAuthority(next.checklistDefaults.representativeAuthorityConfirmed);
        setSimulatedStatus(next.defaultStatus);
        setPromotionSuccess(next.defaultStatus === "approved");
    };

    const isAllCriteriaMet =
        collegeContactStatus === "confirmed" && clubExistence && collegeAuth && repAuthority;

    const handlePromoteSimulation = () => {
        if (!isAllCriteriaMet) return;
        setSimulatedStatus("approved");
        setPromotionSuccess(true);
    };

    return (
        <article className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-12">
            {/* ========================================================================= */}
            {/* DOCUMENTARY HERO HEADER                                                   */}
            {/* ========================================================================= */}
            <header className="space-y-5 pb-8 border-b-2 border-black/15">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black font-mono font-black text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                        <OrbixLogo className="w-3.5 h-3.5 text-black" />
                        <span>Campus Trust Protocol</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-neutral-500">
                        10 min read • Published for Public Transparency
                    </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-[1.08]">
                    Institutional Club Verification: Architecture & Reviewer Evaluation Standard
                </h1>

                <p className="text-base sm:text-lg font-bold text-neutral-700 leading-relaxed max-w-4xl">
                    An open architectural specification of how Orbix verifies collegiate developer societies, student chapters, and competitive programming clubs. Details our 5-stage verification timeline, anti-squatting identity gating, direct university administration outreach, and the 4-pillar reviewer evaluation framework.
                </p>

                {/* Hero Banner Visual (User Uploaded) */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden bg-black shadow-[5px_5px_0px_#000] w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1793262961/Neon_Club_Registration_Verification_Dashboard_h0f0og.png"
                        alt="Orbix Club Registration and Verification Architecture"
                        className="w-full h-auto block object-cover"
                    />
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: THE PURPOSE & ISOLATION PARADIGM                                */}
            {/* ========================================================================= */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Why Club Verification Matters
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    College clubs form the nucleus of collegiate software engineering. When an engineering society hosts official algorithmic contests, manages campus rankings, and showcases member accomplishments, **trust is foundational**. Without rigorous verification, unauthorized groups could squat prestigious university brands (e.g. <em>"Stanford ACM"</em> or <em>"IIT Bombay Coding Club"</em>), publish unverified rankings, or mislead recruiters.
                </p>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Orbix institutes an <strong>Institutional Verification Standard</strong> where every approved club is officially verified against university accreditation databases and validated through direct faculty/administrative channels before receiving the <strong>Verified Shield Badge</strong>.
                </p>

                {/* Account Isolation Notice Box */}
                <div className="p-5 rounded-2xl bg-[#FFE566]/25 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                    <div className="flex items-center gap-2">
                        <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                        <h3 className="text-sm sm:text-base font-black text-black">
                            Security Principle: Strict Personal & Club Account Isolation
                        </h3>
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed">
                        Club accounts in Orbix operate in an isolated administrative context. Club officers and leads cannot modify, fabricate, or artificially manipulate any member&apos;s individual competitive programming statistics, contest histories, or platform ratings. Personal developer portfolios, practice modules, and resume tools remain strictly sovereign and independent of club operations.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: THE 5-STAGE VERIFICATION STANDARD                             */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        The 5-Stage Verification Standard
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Every club registration progresses through a 5-stage deterministic pipeline. This pipeline is backed by reactive database state and real-time persisted timeline records. Applicants monitor their progress in real time through the <strong>Club Verification Portal</strong>:
                </p>

                {/* 5-Stage Interactive / Visual Timeline Breakdown */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 pt-2">
                    {/* Stage 1 */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-neutral-500">01</span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 text-[10px] font-black">
                                    Done
                                </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-black text-black leading-snug">
                                Application Submitted
                            </h3>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed mt-1">
                                Application received. Verification record created, metadata ingested, and unique tracking ID generated.
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-neutral-400 pt-2 border-t border-neutral-100">
                            Instant intake
                        </div>
                    </div>

                    {/* Stage 2 */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-neutral-500">02</span>
                                <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-400 text-[10px] font-black">
                                    Intake Check
                                </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-black text-black leading-snug">
                                Initial Review
                            </h3>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed mt-1">
                                Orbix automated triage verifies domain validity, email MX records, and checks against duplicate institutional registrations.
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-neutral-400 pt-2 border-t border-neutral-100">
                            ~24 Hours
                        </div>
                    </div>

                    {/* Stage 3 */}
                    <div className="p-4 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-neutral-500">03</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-[10px] font-black">
                                    Audit Loop
                                </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-black text-black leading-snug">
                                College Verification
                            </h3>
                            <p className="text-[11px] text-neutral-700 font-medium leading-relaxed mt-1">
                                Outreach conducted with college administration, dean of student affairs, or faculty advisor. Official charter validated.
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-neutral-500 pt-2 border-t border-black/10">
                            Direct Outreach
                        </div>
                    </div>

                    {/* Stage 4 */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-neutral-500">04</span>
                                <span className="px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-300 text-[10px] font-black">
                                    Decision
                                </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-black text-black leading-snug">
                                Verification Decision
                            </h3>
                            <p className="text-[11px] text-neutral-600 font-medium leading-relaxed mt-1">
                                Staff sign-off. The request transitions to <em>Approved</em>, requests <em>Additional Info</em>, or is <em>Rejected</em>.
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-neutral-400 pt-2 border-t border-neutral-100">
                            Staff Audit Log
                        </div>
                    </div>

                    {/* Stage 5 */}
                    <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-2">
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="font-mono text-[10px] font-black text-neutral-500">05</span>
                                <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-black border border-black text-[10px] font-black">
                                    Activated
                                </span>
                            </div>
                            <h3 className="text-xs sm:text-sm font-black text-black leading-snug">
                                Club Access Activated
                            </h3>
                            <p className="text-[11px] text-neutral-700 font-medium leading-relaxed mt-1">
                                Promoted to verified clubs. Unique URL allocated (<code className="text-[10px] font-bold">/clubs/:slug</code>) and Club Dashboard unlocked.
                            </p>
                        </div>
                        <div className="text-[10px] font-mono font-bold text-emerald-800 pt-2 border-t border-black/10">
                            Permanent Badge
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: HOW REVIEWERS ANALYZE AN APPLICATION (THE 4 PILLARS)           */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Reviewer Analysis & The 4-Pillar Checklist
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Orbix reviewers operate through an isolated staff queue (<code className="font-mono text-black font-bold">/club/reviewer/queue</code>). Access is restricted to staff allowlists configured in <code className="font-mono text-black font-bold">ORBIX_REVIEWER_EMAILS</code>.
                </p>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    The backend system physically <strong>blocks any reviewer from promoting a club</strong> unless all 4 verification criteria evaluate to <code className="font-mono font-bold text-emerald-700">true</code> and the college contact status is marked <code className="font-mono font-bold text-emerald-700">confirmed</code>.
                </p>

                {/* 4 Pillars Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                    {/* Pillar 1 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm">
                                1
                            </span>
                            <h3 className="text-base font-black text-black">
                                Club Existence Confirmation
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Reviewers audit the digital and physical footprint of the society. We check public GitHub organizations, competitive programming rosters on LeetCode / CodeChef / Codeforces, club websites, and verified student directory records to confirm the community actively conducts workshops and coding competitions.
                        </p>
                        <div className="text-[11px] font-mono font-bold text-neutral-600 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/10">
                            Check: Active roster &gt; 10 members + documented events within the past 12 months.
                        </div>
                    </div>

                    {/* Pillar 2 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm">
                                2
                            </span>
                            <h3 className="text-base font-black text-black">
                                College Association & Recognition
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Cross-referenced against official university listings, annual student union charters, or college website domain directories (<code className="font-mono">.edu</code>, <code className="font-mono">.ac.in</code>, <code className="font-mono">.edu.in</code>). Independent commercial bootcamps or unauthorized external entities cannot register under college identities.
                        </p>
                        <div className="text-[11px] font-mono font-bold text-neutral-600 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/10">
                            Check: Matched with national higher education directories (AISHE / UGC / AICTE / ABET).
                        </div>
                    </div>

                    {/* Pillar 3 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm">
                                3
                            </span>
                            <h3 className="text-base font-black text-black">
                                Representative Authority Confirmation
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            We verify that the individual submitting the application holds legitimate executive status (President, Faculty Coordinator, Vice-President, or Lead). The applicant must provide an authenticated institutional email and telephone contact for direct identity matching.
                        </p>
                        <div className="text-[11px] font-mono font-bold text-neutral-600 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/10">
                            Check: Domain matching on official email + verification token confirmation.
                        </div>
                    </div>

                    {/* Pillar 4 */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-3">
                        <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center font-black text-sm">
                                4
                            </span>
                            <h3 className="text-base font-black text-black">
                                Direct Institution Outreach Status
                            </h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-700 leading-relaxed">
                            Reviewers track progressive outreach states: <code className="font-mono font-bold">not_started</code> &rarr; <code className="font-mono font-bold">contacted</code> &rarr; <code className="font-mono font-bold">confirmed</code>. Reviewers directly email or call the departmental head or faculty advisor to validate that student leadership has been authorized to govern the campus chapter on Orbix.
                        </p>
                        <div className="text-[11px] font-mono font-bold text-neutral-600 bg-[#FAF6EE] p-2.5 rounded-xl border border-black/10">
                            Check: Direct verbal or email confirmation on official university servers.
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: INTERACTIVE REVIEWER INSPECTOR SIMULATOR                      */}
            {/* ========================================================================= */}
            <section className="space-y-6 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_#000]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black text-[#FFE566] font-mono font-black text-xs">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Interactive Reviewer Simulator</span>
                        </div>
                        <h3 className="text-xl sm:text-2xl font-black text-black">
                            Experience the Staff Verification Inspector
                        </h3>
                        <p className="text-xs sm:text-sm font-medium text-neutral-600">
                            Select a sample club application, audit institutional evidence, toggle the 4 mandatory checklist items, and observe the promotion gatekeeper in action.
                        </p>
                    </div>

                    {/* App Picker */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {SAMPLE_APPLICATIONS.map((app) => (
                            <button
                                key={app.id}
                                type="button"
                                onClick={() => handleSwitchApp(app.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                    selectedAppId === app.id
                                        ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-neutral-800 hover:bg-neutral-100"
                                }`}
                            >
                                {app.clubName}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Simulation Inspector Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left Panel: Submitted Application Evidence (7 cols) */}
                    <div className="lg:col-span-7 space-y-4">
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                            <div className="flex items-start justify-between gap-2 border-b border-black/10 pb-3">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Submitted Club Application
                                    </span>
                                    <h4 className="text-lg font-black text-black flex items-center gap-2 flex-wrap">
                                        <span>{activeApp.clubName}</span>
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${activeApp.riskColor} font-bold`}>
                                            {activeApp.riskLevel}
                                        </span>
                                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-black bg-neutral-100 text-neutral-800">
                                            Status: {simulatedStatus}
                                        </span>
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-bold flex items-center gap-1 mt-0.5">
                                        <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                                        <span>{activeApp.collegeName}</span>
                                    </p>
                                </div>
                                <span className="font-mono text-[10px] font-bold text-neutral-400">
                                    ID: {activeApp.id}
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-medium">
                                <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/10 space-y-1">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">Representative</div>
                                    <div className="font-bold text-black">{activeApp.repName}</div>
                                    <div className="text-neutral-600">{activeApp.repRole}</div>
                                    <div className="font-mono text-neutral-700 text-[11px] truncate flex items-center gap-1">
                                        <Mail className="w-3 h-3" />
                                        <span>{activeApp.contactEmail}</span>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/10 space-y-1">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">College Credentials</div>
                                    <div className="font-mono text-[11px] font-bold text-black truncate flex items-center gap-1">
                                        <Globe className="w-3 h-3 text-sky-700" />
                                        <span>{activeApp.officialCollegeEmail}</span>
                                    </div>
                                    <div className="text-[11px] text-neutral-600 flex items-center gap-1">
                                        <Phone className="w-3 h-3" />
                                        <span>{activeApp.phone}</span>
                                    </div>
                                    <div className="text-neutral-500 text-[11px]">{activeApp.location}</div>
                                </div>
                            </div>

                            {/* Reference URLs */}
                            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                                <a
                                    href={activeApp.websiteUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black/20 text-neutral-800 font-bold hover:bg-neutral-50 text-[11px]"
                                >
                                    <span>Club Website</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                                <a
                                    href={activeApp.socialUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-black/20 text-neutral-800 font-bold hover:bg-neutral-50 text-[11px]"
                                >
                                    <span>Social Directory</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            </div>

                            {/* Internal Reviewer Notes */}
                            <div className="p-3.5 rounded-xl bg-amber-50 border border-black/15 text-xs space-y-1">
                                <div className="font-black text-[10px] uppercase tracking-wider text-amber-900 flex items-center gap-1">
                                    <Lock className="w-3 h-3" />
                                    <span>Staff Internal Audit Notes (Confidential)</span>
                                </div>
                                <p className="text-neutral-800 font-medium leading-relaxed">
                                    {activeApp.internalNotes}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Panel: Reviewer Evaluation Gating Checklist (5 cols) */}
                    <div className="lg:col-span-5 space-y-4">
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                            <div className="flex items-center justify-between border-b border-black/10 pb-2.5">
                                <h4 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <span>Verification Checklist</span>
                                </h4>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-black ${
                                    isAllCriteriaMet ? "bg-emerald-300 text-black" : "bg-amber-200 text-black"
                                }`}>
                                    {isAllCriteriaMet ? "All 4 Criteria Met" : "Checks Incomplete"}
                                </span>
                            </div>

                            {/* College Contact Status Dropdown */}
                            <div className="space-y-1">
                                <label className="block text-[10px] font-black uppercase text-neutral-600">
                                    College Contact Outreach Status
                                </label>
                                <select
                                    value={collegeContactStatus}
                                    onChange={(e) => setCollegeContactStatus(e.target.value as any)}
                                    className="w-full h-9 px-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-none focus:bg-white"
                                >
                                    <option value="not_started">Not Started</option>
                                    <option value="contacted">Outreach Contacted (Awaiting Response)</option>
                                    <option value="confirmed">Confirmed with College Administration</option>
                                    <option value="not_found">Institution / Club Not Found</option>
                                </select>
                            </div>

                            {/* 3 Checkboxes */}
                            <div className="space-y-2.5 pt-1 text-xs font-bold select-none">
                                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-50 border border-black/15 cursor-pointer hover:bg-neutral-100">
                                    <input
                                        type="checkbox"
                                        checked={clubExistence}
                                        onChange={(e) => setClubExistence(e.target.checked)}
                                        className="w-4 h-4 rounded border-2 border-black accent-black"
                                    />
                                    <span>1. Club Existence Confirmed</span>
                                </label>

                                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-50 border border-black/15 cursor-pointer hover:bg-neutral-100">
                                    <input
                                        type="checkbox"
                                        checked={collegeAuth}
                                        onChange={(e) => setCollegeAuth(e.target.checked)}
                                        className="w-4 h-4 rounded border-2 border-black accent-black"
                                    />
                                    <span>2. College Association Confirmed</span>
                                </label>

                                <label className="flex items-center gap-2.5 p-2 rounded-xl bg-neutral-50 border border-black/15 cursor-pointer hover:bg-neutral-100">
                                    <input
                                        type="checkbox"
                                        checked={repAuthority}
                                        onChange={(e) => setRepAuthority(e.target.checked)}
                                        className="w-4 h-4 rounded border-2 border-black accent-black"
                                    />
                                    <span>3. Representative Authority Confirmed</span>
                                </label>
                            </div>

                            {/* Promotion Gate Button */}
                            <div className="pt-2 border-t border-black/10 space-y-2">
                                <button
                                    type="button"
                                    onClick={handlePromoteSimulation}
                                    disabled={!isAllCriteriaMet || promotionSuccess}
                                    className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider border-2 border-black transition-all flex items-center justify-center gap-1.5 ${
                                        promotionSuccess
                                            ? "bg-emerald-400 text-black shadow-[2px_2px_0px_#000] cursor-default"
                                            : isAllCriteriaMet
                                            ? "bg-black text-white hover:bg-neutral-800 shadow-[3px_3px_0px_#000] cursor-pointer"
                                            : "bg-neutral-200 text-neutral-400 border-neutral-300 cursor-not-allowed"
                                    }`}
                                >
                                    {promotionSuccess ? (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-black" />
                                            <span>Club Activated & Verified!</span>
                                        </>
                                    ) : isAllCriteriaMet ? (
                                        <>
                                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                                            <span>Promote & Activate Club</span>
                                        </>
                                    ) : (
                                        <>
                                            <Lock className="w-3.5 h-3.5" />
                                            <span>Locked: All 4 Checks Required</span>
                                        </>
                                    )}
                                </button>

                                {promotionSuccess && (
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-400 text-[11px] text-emerald-950 font-bold space-y-1">
                                        <div className="flex items-center gap-1 text-emerald-800">
                                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                                            <span>Public Slug: <code className="font-mono">/clubs/{activeApp.id.replace("app-", "")}</code></span>
                                        </div>
                                        <p className="text-[10px] text-emerald-800 font-medium">
                                            Verified Club shield issued. Administrative credentials generated and intra-college leaderboard active.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: UNVERIFIED VS. VERIFIED CLUB MATRIX                           */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Verified Club Capabilities vs. Unverified State
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Once a club receives verified status, its operational capabilities on the Orbix platform expand across public visibility, leaderboard administration, and recruiting partnerships:
                </p>

                {/* Comparison Table */}
                <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-neutral-100 border-b-2 border-black font-black uppercase tracking-wider text-black">
                                    <th className="p-3.5">Platform Capability</th>
                                    <th className="p-3.5 text-center">Unverified / Pending Club</th>
                                    <th className="p-3.5 text-center bg-[#FFE566]/40">Verified Institutional Club</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/10 font-medium">
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        Public Profile (<code className="font-mono">/clubs/:slug</code>)
                                    </td>
                                    <td className="p-3.5 text-center text-rose-600 font-bold">
                                        Hidden (404 Not Found)
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10">
                                        Publicly Discoverable Worldwide
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        Verified Shield Badge
                                    </td>
                                    <td className="p-3.5 text-center text-neutral-400">
                                        None
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10 flex items-center justify-center gap-1">
                                        <ShieldCheck className="w-4 h-4 text-emerald-600 inline" />
                                        <span>Official Verified Seal</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        Dedicated Club Dashboard (<code className="font-mono">/club/dashboard</code>)
                                    </td>
                                    <td className="p-3.5 text-center text-rose-600 font-bold">
                                        Restricted (Redirects to Status Portal)
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10">
                                        Full Officer Access
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        Intra-College Coding Leaderboard
                                    </td>
                                    <td className="p-3.5 text-center text-neutral-400">
                                        Inactive
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10">
                                        Live Multi-Platform Aggregation
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        College Contest Hosting & Workstations
                                    </td>
                                    <td className="p-3.5 text-center text-neutral-400">
                                        Disabled
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10">
                                        Official Algorithmic Rounds
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 font-bold text-black">
                                        Member Roster Management & Invites
                                    </td>
                                    <td className="p-3.5 text-center text-neutral-400">
                                        Disabled
                                    </td>
                                    <td className="p-3.5 text-center text-emerald-700 font-bold bg-[#FFE566]/10">
                                        Unlimited Student Rosters
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: WHAT CLUBS MUST PREPARE BEFORE APPLYING                        */}
            {/* ========================================================================= */}
            <section className="space-y-6">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#FFE566] font-mono font-black text-xs">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Checklist for Prospective Applicants
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    To ensure expedited verification within 24–48 hours, club officers should ensure their application satisfies the following prerequisite artifacts:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                            <FileCheck className="w-4 h-4 text-[#FFE566]" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-black">Official Institutional Email</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-0.5">
                                Ensure the club contact or faculty advisor provides a valid <code className="font-mono text-black font-bold">.edu</code> or <code className="font-mono text-black font-bold">.ac.in</code> address.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                            <Globe className="w-4 h-4 text-[#FFE566]" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-black">Web or Directory Footprint</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-0.5">
                                Provide an active link to the club&apos;s campus website, student council registry listing, or departmental landing page.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                            <Users className="w-4 h-4 text-[#FFE566]" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-black">Active Technical Community</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-0.5">
                                Submit links to active competitive coding rosters (LeetCode / Codeforces), GitHub student organizations, or workshop schedules.
                            </p>
                        </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shrink-0">
                            <Phone className="w-4 h-4 text-[#FFE566]" />
                        </div>
                        <div>
                            <h4 className="text-xs sm:text-sm font-black text-black">Responsive Phone & OTP Contact</h4>
                            <p className="text-xs text-neutral-600 font-medium leading-relaxed mt-0.5">
                                Keep the registered phone number available for Firebase / SMS two-factor verification and staff outreach confirmation.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Call to action */}
                <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-6 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div className="space-y-1 text-center sm:text-left">
                        <h4 className="text-base sm:text-lg font-black text-black">Ready to verify your university club?</h4>
                        <p className="text-xs sm:text-sm font-medium text-neutral-800">
                            Submit your campus credentials to launch your intra-college coding leaderboard.
                        </p>
                    </div>

                    <Link
                        to="/club/status"
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-black text-white font-black text-xs sm:text-sm border-2 border-black shadow-[3px_3px_0px_#000] hover:bg-neutral-800 transition-all shrink-0 cursor-pointer"
                    >
                        <span>Open Verification Portal</span>
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </section>
        </article>
    );
};

export default ClubVerificationDocumentary;
