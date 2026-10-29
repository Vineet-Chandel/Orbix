import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
    Lock,
    Globe,
    Check,
    X,
    Briefcase,
    Share2,
    Sliders,
    CreditCard,
    ArrowRight,
    Mail,
} from "lucide-react";
import { NeoSelect } from "../../../components/NeoSelect";

export const ProfilePrivacyDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Profile Mode Simulator State
    // -------------------------------------------------------------------------
    const [simMode, setSimMode] = useState<"public" | "private">("public");
    const [simViewerRole, setSimViewerRole] = useState<"visitor" | "owner">("visitor");
    const [selectedTab, setSelectedTab] = useState<"all" | "allowed_both" | "public_only">("all");

    // Dynamic state evaluation based on simulated privacy mode
    const isPublic = simMode === "public";
    const isOwner = simViewerRole === "owner";

    // Feature capability matrix
    const matrixCapabilities = [
        {
            feature: "First & Last Name",
            category: "Identity",
            publicAccess: true,
            privateAccess: true,
            description: "Full candidate legal and preferred name displayed in profile showcase and header.",
            securityMechanism: "Public identity anchor across all Orbix views.",
        },
        {
            feature: "Professional Headline",
            category: "Identity",
            publicAccess: true,
            privateAccess: true,
            description: "Explicit developer title, role specialization, and domain emphasis.",
            securityMechanism: "Visible for baseline identity; bounded to 255 characters.",
        },
        {
            feature: "Biography / Summary",
            category: "Identity",
            publicAccess: true,
            privateAccess: true,
            description: "Personal summary, technical background overview, and engineering philosophy.",
            securityMechanism: "Plaintext sanitized excerpt; max 2,000 characters.",
        },
        {
            feature: "Location / Timezone",
            category: "Identity",
            publicAccess: true,
            privateAccess: true,
            description: "City, state, and country coordinates for regional developer categorization.",
            securityMechanism: "Coarse regional representation; no granular address exposed.",
        },
        {
            feature: "Verified College Affiliation",
            category: "Campus Directory",
            publicAccess: true,
            privateAccess: true,
            description: "Official AISHE-verified institutional linkage and campus community indexing.",
            securityMechanism: "Relational database verification against authenticated institutions directory.",
        },
        {
            feature: "External Links (Max 4)",
            category: "Socials & Portfolio",
            publicAccess: true,
            privateAccess: true,
            description: "Up to 4 custom developer links (GitHub, LinkedIn, personal portfolio, LeetCode).",
            securityMechanism: "Sanitized URLs with strict RFC3986 validation; capped at 4 items.",
        },
        {
            feature: "Skills & Technologies Catalog",
            category: "Competencies",
            publicAccess: true,
            privateAccess: true,
            description: "Structured array of programming languages, frameworks, and developer toolchains.",
            securityMechanism: "JSONB array in database; displayed as neo-brutalist badge chips.",
        },
        {
            feature: "Hire Me Recruiter Inquiry Modal",
            category: "Recruitment",
            publicAccess: true,
            privateAccess: false,
            description: "Interactive recruitment form allowing hiring managers to dispatch direct project inquiries.",
            securityMechanism: "Automatically disabled on UI; backend rejects with 403 Forbidden when private.",
        },
        {
            feature: "Resume Viewer & PDF Download",
            category: "Recruitment",
            publicAccess: true,
            privateAccess: false,
            description: "High-resolution PDF resume rendering modal and direct file download.",
            securityMechanism: "Signed CDN URL generation revoked; streaming proxy returns 403 Forbidden.",
        },
        {
            feature: "Open to Work Candidate Status",
            category: "Recruitment",
            publicAccess: true,
            privateAccess: false,
            description: "Prominent green candidate availability badge signalling active job search.",
            securityMechanism: "Dynamically cascaded to false in database and Redux store with zero lag.",
        },
        {
            feature: "Multi-Platform Coding Metrics",
            category: "Analytics & Activity",
            publicAccess: true,
            privateAccess: false,
            description: "Exhaustive problem solve counts across LeetCode, CodeChef, GeeksforGeeks, and HackerRank.",
            securityMechanism: "Backend sanitizes platforms array to empty [] for non-owner public requests.",
        },
        {
            feature: "Contest Ratings & Tier Badges",
            category: "Analytics & Activity",
            publicAccess: true,
            privateAccess: false,
            description: "Competitive programming contest rating history, peak tiers, and percentile ranks.",
            securityMechanism: "Submissions and contest components completely unmounted for visitors.",
        },
        {
            feature: "GitHub Contribution Analytics",
            category: "Analytics & Activity",
            publicAccess: true,
            privateAccess: false,
            description: "Annual contribution graphs, repositories created, stars earned, and language breakdown.",
            securityMechanism: "Development activity panel completely hidden from unauthorized visitors.",
        },
        {
            feature: "Public Card Sharing ('Get The Card')",
            category: "Digital Card",
            publicAccess: true,
            privateAccess: false,
            description: "Public access to LinkedIn Story and Instagram Story shareable digital developer cards.",
            securityMechanism: "Card share buttons hidden for external visitors on private profiles.",
        },
        {
            feature: "Owner Card Studio & Manual Export",
            category: "Digital Card",
            publicAccess: true,
            privateAccess: true,
            description: "Profile owner can preview, flip, download high-res PNG cards, and manually screenshot.",
            securityMechanism: "Authenticated session check; owner always retains personal card generation rights.",
        },
    ];

    const filteredCapabilities = matrixCapabilities.filter((c) => {
        if (selectedTab === "allowed_both") return c.publicAccess && c.privateAccess;
        if (selectedTab === "public_only") return c.publicAccess && !c.privateAccess;
        return true;
    });

    return (
        <article className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-12">
            {/* ========================================================================= */}
            {/* DOCUMENTARY HERO HEADER                                                   */}
            {/* ========================================================================= */}
            <header className="space-y-5 pb-8 border-b-2 border-black/15">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-neutral-500">
                        11 min read
                    </span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-[1.08]">
                    Public vs. Private Profile Architecture: Complete Data Gating & Privacy Specification
                </h1>

                <p className="text-base sm:text-lg font-bold text-neutral-700 leading-relaxed max-w-4xl">
                    An exhaustive architectural analysis of developer profile visibility in Orbix. Explores deterministic data gating, zero-lag cascading deactivations, multi-tier cache invalidation, and digital card ownership isolation.
                </p>

                {/* Hero Banner Visual */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden bg-black shadow-[5px_5px_0px_#000] w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1793004475/Public_vs_Private_Profile_r5iwjl.png"
                        alt="Public vs. Private Profile Architecture"
                        className="w-full h-auto block object-cover"
                    />
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: CORE PHILOSOPHY & PRIVACY DUALITY                              */}
            {/* ========================================================================= */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        01
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Core Philosophy & Privacy Duality
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    Orbix functions as both a <strong>developer tracking workstation</strong> and a <strong>verified public showcase</strong>. A fundamental architectural tenet is that every engineer must have complete sovereignty over their data footprint. Developers often want to track their competitive submissions, practice algorithms, and benchmark their problem-solving metrics across all 16 connected developer portals without exposing their live ratings, recruiter channels, or resume to the broader internet.
                </p>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    To deliver this guarantee without introducing fragmented databases or secondary tables, Orbix implements an <strong>atomic data-gating model</strong>. The profile mode switch operates as a hard gate at the database, cache, and client presentation tiers.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3">
                    <div className="p-5 rounded-2xl bg-[#a2ff86]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="flex items-center gap-2">
                            <Globe className="w-5 h-5 text-black stroke-[2.5]" />
                            <h3 className="text-base font-black text-black">Public Profile Paradigm</h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed">
                            Full-fidelity portfolio mode. Aggregated contest ratings, multi-platform submissions tables, verified college affiliations, interactive 3D digital cards, recruiter messaging, and downloadable resumes are open for global inspection.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FFE566]/20 border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="flex items-center gap-2">
                            <Lock className="w-5 h-5 text-black stroke-[2.5]" />
                            <h3 className="text-base font-black text-black">Private Profile Paradigm</h3>
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-neutral-800 leading-relaxed">
                            Restricted identity showcase. Public visitors see only the candidate's name, headline, bio, location, verified college, up to 4 custom links, and skills. All metrics, recruiter actions, resume access, and card sharing are strictly disabled.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: INTERACTIVE PROFILE MODE SIMULATOR                             */}
            {/* ========================================================================= */}
            <section className="space-y-6 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black p-6 sm:p-8 shadow-[5px_5px_0px_#000]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-black/15">
                    <div className="space-y-1">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-black text-[#a2ff86] font-mono font-black text-xs">
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Live Component Visualizer</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                            Interactive Profile Visibility Simulator
                        </h2>
                    </div>

                    {/* Mode Toggle Bar */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setSimMode("public")}
                                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    isPublic
                                        ? "bg-black text-[#a2ff86]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Public Mode
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimMode("private")}
                                className={`px-3 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    !isPublic
                                        ? "bg-black text-[#FFE566]"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Private Mode
                            </button>
                        </div>

                        {/* Viewer Role Switcher */}
                        <div className="inline-flex items-center p-1 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                            <button
                                type="button"
                                onClick={() => setSimViewerRole("visitor")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    !isOwner
                                        ? "bg-neutral-800 text-white"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Public Visitor
                            </button>
                            <button
                                type="button"
                                onClick={() => setSimViewerRole("owner")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    isOwner
                                        ? "bg-neutral-800 text-white"
                                        : "text-neutral-700 hover:text-black"
                                }`}
                            >
                                Profile Owner
                            </button>
                        </div>
                    </div>
                </div>

                {/* Simulated Profile View Window */}
                <div className="rounded-2xl bg-white border-2 border-black p-5 sm:p-6 shadow-[3px_3px_0px_#000] space-y-5">
                    {/* Simulated Owner Warning Banner */}
                    {!isPublic && isOwner && (
                        <div className="p-3 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-between gap-3 text-xs font-black text-black shadow-[2px_2px_0px_#000]">
                            <div className="flex items-center gap-2">
                                <Lock className="w-4 h-4 shrink-0 stroke-[2.5]" />
                                <span>
                                    Private Profile Mode: Public visitors only see your basic identity, college, and skills. Platform stats and recruiter buttons are disabled.
                                </span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-black text-[#a2ff86] text-[10px] font-mono shrink-0">
                                OWNER BANNER
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                        {/* Simulated Left Panel (Card or Private Notice) */}
                        <div className="lg:col-span-8 rounded-xl bg-[#FAF6EE] border-2 border-black p-5 shadow-[2px_2px_0px_#000] flex flex-col justify-between space-y-4">
                            {!isPublic && !isOwner ? (
                                <div className="py-12 px-4 text-center space-y-3">
                                    <div className="w-12 h-12 mx-auto rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                        <Lock className="w-6 h-6 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="max-w-sm mx-auto space-y-1">
                                        <h4 className="text-lg font-black text-black">
                                            Activity & Submissions are Confidential
                                        </h4>
                                        <p className="text-xs text-neutral-600 font-medium">
                                            This developer has configured their profile to Private mode. Multi-platform activity, submissions, and contest rankings are hidden from public view.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b-2 border-black/15 pb-2">
                                        <span className="text-xs font-mono font-black text-black uppercase">
                                            Digital Developer Card Showcase
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#a2ff86] border border-black">
                                            {isPublic ? "Public 3D Flip Card" : "Owner Private Access"}
                                        </span>
                                    </div>
                                    <div className="p-4 rounded-xl bg-black text-white space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-[#a2ff86]">Platform Matrix Active</span>
                                            <span className="font-mono text-neutral-400">1,680+ Problems Solved</span>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                                            <div className="p-2 rounded bg-neutral-900 border border-neutral-700">LeetCode 912</div>
                                            <div className="p-2 rounded bg-neutral-900 border border-neutral-700">Codeforces 2045</div>
                                            <div className="p-2 rounded bg-neutral-900 border border-neutral-700">GitHub 3.1k</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 border-t-2 border-black/15 flex items-center justify-between text-xs font-bold text-neutral-600">
                                <span>Status: {isPublic ? "Fully Public" : "Confidential"}</span>
                                <span>Viewing as: {isOwner ? "Owner (You)" : "External Visitor"}</span>
                            </div>
                        </div>

                        {/* Simulated Right Panel (Action Buttons & Details) */}
                        <div className="lg:col-span-4 rounded-xl bg-[#FAF6EE] border-2 border-black p-5 shadow-[2px_2px_0px_#000] flex flex-col justify-between space-y-4">
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-sm font-black text-black">Aarav Sharma</h4>
                                    <p className="text-xs text-neutral-600 font-bold">Systems & Full Stack Engineer</p>
                                    <p className="text-[11px] text-neutral-500 font-medium">Bengaluru • Indian Institute of Technology</p>
                                </div>

                                {/* Skills Chips (Always Visible) */}
                                <div className="flex flex-wrap gap-1">
                                    <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-bold">TypeScript</span>
                                    <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-bold">Go</span>
                                    <span className="px-2 py-0.5 rounded bg-white border border-black text-[10px] font-bold">PostgreSQL</span>
                                </div>

                                {/* Dynamic Recruiter Buttons */}
                                {isPublic ? (
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t-2 border-black/15">
                                        <div className="p-2 rounded-lg bg-white border-2 border-black text-center text-xs font-black shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1">
                                            <Briefcase className="w-3 h-3 text-black" />
                                            <span>Open to Work</span>
                                        </div>
                                        <div className="p-2 rounded-lg bg-black text-white text-center text-xs font-black shadow-[1px_1px_0px_#000] flex items-center justify-center gap-1">
                                            <Mail className="w-3 h-3 text-white" />
                                            <span>Hire me</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-2.5 rounded-lg bg-neutral-200 border-2 border-neutral-400 text-center text-xs font-bold text-neutral-600 space-y-0.5">
                                        <p className="font-black text-neutral-700">Recruiter Channels Disabled</p>
                                        <p className="text-[10px]">Hire Me & Open to Work automatically switched off</p>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-2 pt-1">
                                    <button
                                        type="button"
                                        className="w-full py-2 px-3 rounded-lg bg-white border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5"
                                    >
                                        <Share2 className="w-3.5 h-3.5" />
                                        <span>Share Profile URL</span>
                                    </button>

                                    {/* Get The Card Button (Available if public, OR for owner) */}
                                    {isPublic || isOwner ? (
                                        <button
                                            type="button"
                                            className="w-full py-2 px-3 rounded-lg bg-black text-white text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center justify-center gap-1.5"
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-white" />
                                            <span>Get The Card {isOwner && !isPublic && "(Owner Access)"}</span>
                                        </button>
                                    ) : (
                                        <div className="p-2 rounded-lg bg-neutral-100 border border-neutral-300 text-center text-[10px] font-mono text-neutral-500">
                                            🔒 Digital Card Sharing Restricted
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: THE COMPLETE VERSUS MATRIX                                     */}
            {/* ========================================================================= */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        02
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Exhaustive Capability & Visibility Matrix
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    The table below provides the authoritative standard for every single profile attribute and interaction in Orbix. Every field is categorized into either <strong>Omnipresent Permitted Fields</strong> (available across both public and private profiles) or <strong>Protected Confidential Fields</strong> (automatically disabled when private).
                </p>

                {/* Filter Chips */}
                <div className="w-full pt-2">
                    <div className="sm:hidden mb-2">
                        <NeoSelect
                            value={selectedTab}
                            onChange={(val) => setSelectedTab(val as any)}
                            options={[
                                { value: "all", label: `All Capabilities (${matrixCapabilities.length})` },
                                { value: "allowed_both", label: "Allowed in Both (7 Items)" },
                                { value: "public_only", label: "Disabled in Private (8 Items)" },
                            ]}
                            size="sm"
                            className="w-full"
                            triggerClassName="bg-white text-xs font-black"
                        />
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setSelectedTab("all")}
                            className={`px-3 py-1 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedTab === "all"
                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-black hover:bg-neutral-100"
                            }`}
                        >
                            All Capabilities ({matrixCapabilities.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTab("allowed_both")}
                            className={`px-3 py-1 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedTab === "allowed_both"
                                    ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-black hover:bg-neutral-100"
                            }`}
                        >
                            Allowed in Both (7 Items)
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedTab("public_only")}
                            className={`px-3 py-1 rounded-xl text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                selectedTab === "public_only"
                                    ? "bg-black text-[#FFE566] shadow-[2px_2px_0px_#000]"
                                    : "bg-white text-black hover:bg-neutral-100"
                            }`}
                        >
                            Disabled in Private (8 Items)
                        </button>
                    </div>
                </div>

                {/* Matrix Table */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden shadow-[4px_4px_0px_#000] bg-white">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs font-medium border-collapse">
                            <thead>
                                <tr className="bg-black text-white font-mono uppercase text-[11px] tracking-wider border-b-2 border-black">
                                    <th className="py-3 px-4">Feature / Capability</th>
                                    <th className="py-3 px-3">Category</th>
                                    <th className="py-3 px-3 text-center">Public Mode</th>
                                    <th className="py-3 px-3 text-center">Private Mode</th>
                                    <th className="py-3 px-4">Security Enforcement Mechanism</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-black/10">
                                {filteredCapabilities.map((row, idx) => (
                                    <tr
                                        key={idx}
                                        className={idx % 2 === 0 ? "bg-white" : "bg-[#FAF6EE]/60"}
                                    >
                                        <td className="py-3 px-4 font-black text-black text-sm">
                                            {row.feature}
                                        </td>
                                        <td className="py-3 px-3 font-mono text-[11px] text-neutral-600">
                                            {row.category}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {row.publicAccess ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black font-black text-[10px] border border-black shadow-[1px_1px_0px_#000]">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-200 text-neutral-600 font-bold text-[10px]">
                                                    <X className="w-3 h-3 stroke-[3]" />
                                                    No
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 text-center">
                                            {row.privateAccess ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black font-black text-[10px] border border-black shadow-[1px_1px_0px_#000]">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                    Permitted
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-black text-[10px] border border-rose-400 shadow-[1px_1px_0px_#000]">
                                                    <X className="w-3 h-3 stroke-[3]" />
                                                    Disabled
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-4 text-neutral-700 font-medium">
                                            {row.securityMechanism}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: DYNAMIC ZERO-LAG CASCADE PIPELINE                              */}
            {/* ========================================================================= */}
            <section className="space-y-5">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        03
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Dynamic Zero-Lag Cascade Architecture
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    A major architectural vulnerability in traditional privacy toggles is <strong>state lag</strong>—where a user turns off public visibility, but auxiliary flags like "Hire Me", "Open to Work", or cached resume URLs remain active until subsequent manual clicks occur. Orbix solves this through an <strong>authoritative synchronous cascade</strong>.
                </p>

                {/* Architecture Flowchart Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_#000]">
                            1
                        </div>
                        <h4 className="text-sm font-black text-black">Settings Interaction</h4>
                        <p className="text-xs text-neutral-600 font-medium">
                            User clicks the Public Profile toggle switch in Settings. State triggers immediately in UI without awaiting network roundtrip.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_#000]">
                            2
                        </div>
                        <h4 className="text-sm font-black text-black">Redux Synchronous Cascade</h4>
                        <p className="text-xs text-neutral-600 font-medium">
                            Dispatches <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">updateUserProfile</code> setting <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">isPublic: false</code>, <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">isHireable: false</code>, <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">isOpenToWork: false</code>.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-sky-200 border border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_#000]">
                            3
                        </div>
                        <h4 className="text-sm font-black text-black">Database SQL Transaction</h4>
                        <p className="text-xs text-neutral-600 font-medium">
                            Atomic SQL update executes conditional CASE statements: forcing <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">is_open_to_work = false</code> and <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">is_hireable = false</code>.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="w-8 h-8 rounded-lg bg-rose-200 border border-black flex items-center justify-center font-black text-xs shadow-[1px_1px_0px_#000]">
                            4
                        </div>
                        <h4 className="text-sm font-black text-black">Cache Flush & Rejection</h4>
                        <p className="text-xs text-neutral-600 font-medium">
                            Multi-tier Redis caches are immediately invalidated. Subsequent visitor requests to hire endpoints return <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[11px]">403 Forbidden</code>.
                        </p>
                    </div>
                </div>

                {/* Atomic SQL Logic Snip */}
                <div className="rounded-2xl bg-neutral-900 text-neutral-200 p-5 font-mono text-xs border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 overflow-x-auto">
                    <div className="flex items-center justify-between text-[11px] text-neutral-400 border-b border-neutral-700 pb-2">
                        <span>Database Gating Logic — Atomic Cascade</span>
                        <span>PostgreSQL Atomic Update</span>
                    </div>
                    <pre className="text-[#a2ff86]">
{`UPDATE users
SET
   is_public = $13,
   is_open_to_work = (CASE WHEN $13 = false THEN false ELSE is_open_to_work END),
   is_hireable = (CASE WHEN $13 = false THEN false ELSE is_hireable END),
   is_resume_public = (CASE WHEN $13 = false THEN false ELSE is_resume_public END),
   updated_at = CURRENT_TIMESTAMP
WHERE id = $19;`}
                    </pre>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: DIGITAL CARD OWNERSHIP & ISOLATION BOUNDARY                    */}
            {/* ========================================================================= */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        04
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        Digital Card Ownership & Isolation Boundary
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    A unique innovation in the Orbix architecture is the distinction between <strong>Public Card Distribution</strong> and <strong>Owner Asset Rights</strong>.
                </p>

                <div className="rounded-2xl bg-amber-50 border-2 border-black p-5 sm:p-6 shadow-[3px_3px_0px_#000] space-y-3">
                    <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-amber-950 stroke-[2.5]" />
                        <h3 className="text-base font-black text-amber-950">
                            The Card Privacy Invariant
                        </h3>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
                        When a profile is toggled to <strong>Private</strong>, no third-party visitor navigating to the website can view, inspect, or download that candidate's digital cards. The <em>"Get The Card"</em> trigger button and LinkedIn/Instagram Story modals are unmounted.
                    </p>
                    <p className="text-xs sm:text-sm font-bold text-amber-900 leading-relaxed">
                        However, the <strong>profile owner</strong> always retains uninterrupted access to Card Studio while signed into their workspace. The owner can flip front/back, preview high-res renders, download PNGs, and manually share their achievements on social media. The platform respects owner generation while guaranteeing complete visitor lockdown.
                    </p>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 6: API PAYLOAD COMPARISON (PUBLIC VS PRIVATE)                     */}
            {/* ========================================================================= */}
            <section className="space-y-4">
                <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-black text-[#a2ff86] font-mono font-black text-xs">
                        05
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                        API Sanitization Specification
                    </h2>
                </div>

                <p className="text-sm sm:text-base font-medium text-neutral-800 leading-relaxed">
                    The endpoint <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-xs">GET /api/profile/public/:username</code> implements strict server-side serialization filtering. Below is the side-by-side comparison of the JSON payload returned to a public visitor depending on profile visibility:
                </p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-1">
                    {/* Public JSON Payload */}
                    <div className="rounded-2xl bg-neutral-900 text-neutral-200 p-5 font-mono text-xs border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-[#a2ff86] border-b border-neutral-700 pb-2">
                            <span>HTTP 200 OK — Public Mode Response</span>
                            <span>Full Payload</span>
                        </div>
                        <pre className="text-neutral-300 overflow-x-auto">
{`{
  "username": "Vineet-Chandel",
  "displayName": "Vineet Chandel",
  "headline": "Systems & Full Stack Engineer",
  "bio": "Specializing in high-throughput systems...",
  "location": "Bengaluru, India",
  "college": { "officialName": "IIT" },
  "links": [{ "label": "GitHub", "url": "..." }],
  "skills": ["TypeScript", "Go", "PostgreSQL"],
  "isOpenToWork": true,
  "isHireable": true,
  "isPublic": true,
  "resumeUrl": "https://cdn.orbix.dev/...",
  "platforms": [
    { "portal": "leetcode", "stats": [...] },
    { "portal": "github", "stats": [...] }
  ]
}`}
                        </pre>
                    </div>

                    {/* Private JSON Payload */}
                    <div className="rounded-2xl bg-neutral-900 text-neutral-200 p-5 font-mono text-xs border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-[#FFE566] border-b border-neutral-700 pb-2">
                            <span>HTTP 200 OK — Private Mode Response</span>
                            <span>Sanitized 7-Field Payload</span>
                        </div>
                        <pre className="text-neutral-300 overflow-x-auto">
{`{
  "username": "Vineet-Chandel",
  "displayName": "Vineet Chandel",
  "headline": "Systems & Full Stack Engineer",
  "bio": "Specializing in high-throughput systems...",
  "location": "Bengaluru, India",
  "college": { "officialName": "IIT" },
  "links": [{ "label": "GitHub", "url": "..." }],
  "skills": ["TypeScript", "Go", "PostgreSQL"],
  "isOpenToWork": false,
  "isHireable": false,
  "isPublic": false,
  "resumeUrl": null,
  "platforms": []
}`}
                        </pre>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* DOCUMENTARY FOOTER & NAVIGATION                                           */}
            {/* ========================================================================= */}
            <footer className="pt-8 border-t-2 border-black/15 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-mono font-bold text-neutral-500">
                        Orbix Architecture Series • Document Version 2.4.0
                    </p>
                    <p className="text-xs font-bold text-neutral-800">
                        Maintained by the Orbix Security & Platform Intelligence Team.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Link
                        to="/settings"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-[#a2ff86] font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-colors"
                    >
                        <span>Open Settings & Privacy</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                </div>
            </footer>
        </article>
    );
};

export default ProfilePrivacyDocumentary;
