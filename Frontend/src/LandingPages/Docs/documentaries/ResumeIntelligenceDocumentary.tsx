import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import {
    ShieldCheck,
    Calculator,
    BookOpen,
    CheckCircle2,
    ArrowRight,
    Sliders,
    AlertCircle,
    FileCheck2,
    Lock,
    Sparkles,
    TrendingUp,
    Check
} from "lucide-react";

export const ResumeIntelligenceDocumentary: React.FC = () => {
    // -------------------------------------------------------------------------
    // Interactive Simulator State (7 Dimensions)
    // -------------------------------------------------------------------------
    const [quantifiedMetricsCount, setQuantifiedMetricsCount] = useState<number>(5);
    const [metricDistributionRatio, setMetricDistributionRatio] = useState<number>(75); // %
    const [technicalStackDepth, setTechnicalStackDepth] = useState<number>(85); // 0-100
    const [architecturalSignalsCount, setArchitecturalSignalsCount] = useState<number>(4);
    const [headlinePresent, setHeadlinePresent] = useState<boolean>(true);
    const [modernToolingCurrency, setModernToolingCurrency] = useState<number>(80);
    const [atsCoreSectionsDetected, setAtsCoreSectionsDetected] = useState<number>(4); // out of 4
    const [selectableTextValid, setSelectableTextValid] = useState<boolean>(true);
    const [actionVerbRatio, setActionVerbRatio] = useState<number>(80); // %
    const [hasGithubVerified, setHasGithubVerified] = useState<boolean>(true);
    const [hasLinkedinOrPortfolio, setHasLinkedinOrPortfolio] = useState<boolean>(true);
    const [contactComplete, setContactComplete] = useState<boolean>(true);
    const [selectedFactIdx, setSelectedFactIdx] = useState<number>(1);
    const [selectedRewriteDomain, setSelectedRewriteDomain] = useState<string>("backend");

    const provenanceFacts = [
        {
            label: "Candidate Identity & Headline",
            value: "Aarav Sharma — Full Stack Software Engineer",
            section: "header",
            type: "explicitly_stated",
            confidence: 96,
            status: "claimed_only",
            excerpt: "Aarav Sharma | Full Stack Software Engineer | Bengaluru, India",
            notes: "Direct extraction from the resume header metadata anchor.",
        },
        {
            label: "Quantified Latency Reduction Metric",
            value: "42% latency reduction under 3,000 QPS",
            section: "projects",
            type: "explicitly_stated",
            confidence: 98,
            status: "claimed_only",
            excerpt: "Optimized database indexing and query caching in Redis, decreasing query execution latency by 42% under 3,000 QPS.",
            notes: "Measurable numerical impact tied to Redis caching architecture.",
        },
        {
            label: "Evaluated Seniority Level",
            value: "Mid-Level Software Engineer (2-3 years equivalent)",
            section: "experience",
            type: "inferred",
            confidence: 91,
            status: "inferred_by_system",
            excerpt: "Engineered scalable RESTful microservices handling 1M+ daily API requests...",
            notes: "Algorithmic synthesis derived from architectural ownership and chronological duration.",
        },
        {
            label: "GitHub Code Verification",
            value: "github.com/aaravsharma (48 Public Repos)",
            section: "header",
            type: "externally_verified",
            confidence: 100,
            status: "verified",
            excerpt: "github.com/aaravsharma | linkedin.com/in/aaravsharma",
            notes: "Cryptographically cross-verified against authenticated Orbix OAuth connection.",
        },
    ];

    const rewriteExamples = [
        {
            domain: "backend",
            title: "Backend & Systems Scale",
            before: "Worked on REST APIs and backend servers using Node.js.",
            after: "Architected distributed Node.js/TypeScript microservices handling 1.2M+ daily requests, decreasing p99 latency by 38% under 3,500 QPS.",
            formula: "Accomplished [1.2M daily throughput & 38% p99 latency drop] by doing [distributed microservices architecture in Node/TS].",
        },
        {
            domain: "cloud",
            title: "Cloud Infrastructure & CI/CD",
            before: "Responsible for Docker containers and cloud deployment.",
            after: "Engineered automated multi-stage Docker builds and GitHub Actions CI/CD pipelines, reducing production build times from 18m to 4.2m.",
            formula: "Accomplished [76% build time speedup] by doing [multi-stage Docker containerization and automated CI/CD].",
        },
        {
            domain: "frontend",
            title: "Frontend Architecture & Web Vitals",
            before: "Helped develop the web application with React and Tailwind.",
            after: "Spearheaded Next.js migration with server-side rendering and asset preloading, elevating Google Core Web Vitals (LCP) from 4.1s to 1.1s.",
            formula: "Accomplished [73% faster Largest Contentful Paint (LCP)] by doing [Next.js SSR migration and asset preloading].",
        },
    ];

    // -------------------------------------------------------------------------
    // Live Deterministic Mathematical Model (Mirrors Orbix Scoring Engine v3.0.0)
    // -------------------------------------------------------------------------
    const simResults = useMemo(() => {
        // Dimension 1: Impact & Quantified Achievements (Weight: 25%)
        let d1MetricsScore = 10;
        if (quantifiedMetricsCount >= 6) d1MetricsScore = 100;
        else if (quantifiedMetricsCount >= 4) d1MetricsScore = 85;
        else if (quantifiedMetricsCount >= 2) d1MetricsScore = 65;
        else if (quantifiedMetricsCount === 1) d1MetricsScore = 40;

        const d1Score = Math.min(100, Math.round(d1MetricsScore * 0.5 + metricDistributionRatio * 0.5));
        const d1Contribution = (d1Score * 0.25);

        // Dimension 2: Technical Depth & Evidence (Weight: 20%)
        let d2ArchScore = 25;
        if (architecturalSignalsCount >= 5) d2ArchScore = 100;
        else if (architecturalSignalsCount >= 3) d2ArchScore = 80;
        else if (architecturalSignalsCount >= 1) d2ArchScore = 60;

        const d2Score = Math.min(100, Math.round(technicalStackDepth * 0.55 + d2ArchScore * 0.45));
        const d2Contribution = (d2Score * 0.20);

        // Dimension 3: Target Role Alignment (Weight: 20%)
        const headlineScore = headlinePresent ? 100 : 35;
        const d3Score = Math.min(100, Math.round(headlineScore * 0.4 + modernToolingCurrency * 0.6));
        const d3Contribution = (d3Score * 0.20);

        // Dimension 4: ATS Structure & Parseability (Weight: 10%)
        const sectionScore = Math.round((atsCoreSectionsDetected / 4) * 100);
        const textScore = selectableTextValid ? 100 : 20;
        const d4Score = Math.min(100, Math.round(sectionScore * 0.6 + textScore * 0.4));
        const d4Contribution = (d4Score * 0.10);

        // Dimension 5: Clarity & Action Writing (Weight: 10%)
        const d5Score = Math.min(100, actionVerbRatio);
        const d5Contribution = (d5Score * 0.10);

        // Dimension 6: Verified Profiles & Evidence (Weight: 10%)
        let d6Score = 20;
        if (hasGithubVerified && hasLinkedinOrPortfolio) d6Score = 100;
        else if (hasGithubVerified) d6Score = 80;
        else if (hasLinkedinOrPortfolio) d6Score = 60;
        const d6Contribution = (d6Score * 0.10);

        // Dimension 7: Contact & Completeness (Weight: 5%)
        const d7Score = contactComplete ? 100 : 40;
        const d7Contribution = (d7Score * 0.05);

        const totalScore = Math.round(
            d1Contribution + d2Contribution + d3Contribution + d4Contribution + d5Contribution + d6Contribution + d7Contribution
        );

        let grade: "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement" = "Needs Improvement";
        if (totalScore >= 88) grade = "Top Tier";
        else if (totalScore >= 75) grade = "Competitive";
        else if (totalScore >= 60) grade = "Strong Foundation";

        // Extraction Confidence (0-100)
        const extractionConf = Math.min(98, Math.round(
            (selectableTextValid ? 50 : 15) + (atsCoreSectionsDetected * 10) + (contactComplete ? 10 : 0)
        ));

        // Analysis Confidence (0-100)
        const analysisConf = Math.min(96, Math.round(
            70 + (quantifiedMetricsCount > 2 ? 15 : 0) + (architecturalSignalsCount > 2 ? 10 : 0)
        ));

        return {
            d1: { score: d1Score, weight: 0.25, contr: d1Contribution },
            d2: { score: d2Score, weight: 0.20, contr: d2Contribution },
            d3: { score: d3Score, weight: 0.20, contr: d3Contribution },
            d4: { score: d4Score, weight: 0.10, contr: d4Contribution },
            d5: { score: d5Score, weight: 0.10, contr: d5Contribution },
            d6: { score: d6Score, weight: 0.10, contr: d6Contribution },
            d7: { score: d7Score, weight: 0.05, contr: d7Contribution },
            total: totalScore,
            grade,
            extractionConf,
            analysisConf,
        };
    }, [
        quantifiedMetricsCount,
        metricDistributionRatio,
        technicalStackDepth,
        architecturalSignalsCount,
        headlinePresent,
        modernToolingCurrency,
        atsCoreSectionsDetected,
        selectableTextValid,
        actionVerbRatio,
        hasGithubVerified,
        hasLinkedinOrPortfolio,
        contactComplete
    ]);

    return (
        <article className="space-y-12">
            {/* ========================================================================= */}
            {/* HEADER HERO BANNER                                                        */}
            {/* ========================================================================= */}
            <header className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-6">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                        v3.0.0 Full Specification
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-black uppercase bg-[#a2ff86] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                        Deterministic Math Model
                    </span>
                    <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-neutral-100 text-neutral-700 border border-neutral-300">
                        14 min read
                    </span>
                </div>

                <div className="space-y-3">
                    <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-black leading-[1.08]">
                        Orbix Resume Intelligence Engine
                    </h1>
                    <p className="text-base sm:text-xl font-bold text-neutral-700 max-w-3xl leading-snug">
                        Multi-Stage AST Parsing • 7-Dimension Weighted Scoring Algorithm • Structured Fact Provenance • Grounded Improvements • Privacy-First Profile Sync
                    </p>
                </div>

                {/* Hero Showcase Graphic */}
                <div className="rounded-2xl border-2 sm:border-[3px] border-black overflow-hidden bg-black shadow-[6px_6px_0px_#000] w-full">
                    <img
                        src="https://res.cloudinary.com/dj0ivep44/image/upload/v1793003144/Neon_Resume_PDF_Thumbnail_lucuju.png"
                        alt="Orbix Resume Intelligence Engine Architecture"
                        className="w-full h-auto block object-cover max-h-[520px]"
                    />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">7 Dimensions</span>
                        <span className="text-lg sm:text-xl font-black text-black">100% Normalized</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">Provenance</span>
                        <span className="text-lg sm:text-xl font-black text-black">Explicit vs Inferred</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">Scoring Mode</span>
                        <span className="text-lg sm:text-xl font-black text-black">100% Deterministic</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]">
                        <span className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider block">Profile Sync</span>
                        <span className="text-lg sm:text-xl font-black text-black">Missing Fields Only</span>
                    </div>
                </div>
            </header>

            {/* ========================================================================= */}
            {/* SECTION 1: PROCEDURAL ARCHITECTURE OVERVIEW                                */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="space-y-2 border-b-2 border-black/10 pb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-black" />
                        <span>Section 1 • Architectural Blueprint</span>
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black text-black">
                        The 6-Stage End-to-End Procedural Pipeline
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-700 font-medium">
                        How Orbix ingests raw candidate resumes, validates machine readability, extracts factual provenance, applies strict deterministic math, and synchronizes profile data.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            01
                        </div>
                        <h3 className="text-base font-black text-black">Stage A: Document Ingestion</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Validates file magic signatures (<code className="bg-neutral-200 px-1 rounded">%PDF-</code>, <code className="bg-neutral-200 px-1 rounded">PK\x03\x04</code>), enforces 5 MB limits, unpacks AST text layers, and performs non-destructive text normalization.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            02
                        </div>
                        <h3 className="text-base font-black text-black">Stage B: Structured Fact Extraction</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Extracts personal identities, degree timelines, employment history, project architectures, and metrics into a strictly versioned JSON schema backed by source excerpts and provenance flags.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            03
                        </div>
                        <h3 className="text-base font-black text-black">Stage C: Normalization & Aliasing</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Reconciles 100+ technical skill aliases (e.g. <code className="bg-neutral-200 px-1 rounded">ts</code> → <code className="bg-neutral-200 px-1 rounded">TypeScript</code>), canonicalizes 5 skill categories, eliminates redundant bullets, and resolves date gaps.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            04
                        </div>
                        <h3 className="text-base font-black text-black">Stage D: 7-Dimension Scoring</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Calculates the authoritative Resume Readiness Score using exact deterministic subcriteria weights. Zero arbitrary LLM numbers; 100% reproducible mathematical formula.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            05
                        </div>
                        <h3 className="text-base font-black text-black">Stage E: Grounded Improvements</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Synthesizes action-verb rewrites using Google XYZ & CAR models (Accomplished [X] measured by [Y] doing [Z]) strictly anchored in the applicant's existing context without hallucination.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                        <div className="w-9 h-9 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black text-sm shadow-[1.5px_1.5px_0px_#000]">
                            06
                        </div>
                        <h3 className="text-base font-black text-black">Stage F: Consent-Driven Profile Sync</h3>
                        <p className="text-xs text-neutral-700 leading-relaxed">
                            Compares extracted data against PostgreSQL profile columns. Generates proposals solely for missing fields. Updates only with explicit user inspection and approval.
                        </p>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 2: THE 7-DIMENSION SCORING FORMULA                                 */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="space-y-2 border-b-2 border-black/10 pb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <Calculator className="w-4 h-4 text-black" />
                        <span>Section 2 • Mathematical Scoring Engine</span>
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black text-black">
                        7-Dimension Configurable Weighting Model
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-700 font-medium">
                        The final score is evaluated strictly according to the formula:
                    </p>
                </div>

                {/* Mathematical Equation Block */}
                <div className="p-6 rounded-2xl bg-neutral-900 text-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                    <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-[#FFE566]">
                        <span>Authoritative Mathematical Formula</span>
                        <span>Version 3.0.0</span>
                    </div>
                    <div className="p-4 rounded-xl bg-black/60 border border-neutral-700 font-mono text-sm sm:text-lg text-emerald-400 overflow-x-auto text-center">
                        {"Resume Readiness Score = \\frac{\\sum_{i=1}^{7} (\\text{Dimension Score}_i \\times \\text{Dimension Weight}_i)}{\\sum_{i=1}^{7} \\text{Assessed Dimension Weights}}"}
                    </div>
                    <p className="text-xs text-neutral-300 leading-relaxed">
                        If a dimension cannot be assessed (e.g. candidate document lacks contact information), the denominator dynamically normalizes across assessed dimensions, guaranteeing non-distorted evaluations.
                    </p>
                </div>

                {/* Dimensions Table */}
                <div className="border-2 border-black rounded-2xl overflow-hidden shadow-[4px_4px_0px_#000]">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs sm:text-sm">
                            <thead>
                                <tr className="bg-[#FFE566] border-b-2 border-black text-black font-black uppercase tracking-wider">
                                    <th className="p-3.5 sm:p-4">Dimension</th>
                                    <th className="p-3.5 sm:p-4 text-center">Weight</th>
                                    <th className="p-3.5 sm:p-4">Key Evaluated Subcriteria</th>
                                    <th className="p-3.5 sm:p-4">Required Grounded Evidence</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-black/10 font-medium text-neutral-800">
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Impact & Quantified Achievements
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-amber-50">
                                        25%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Metric volume, distribution across projects/roles, metric diversity (% latency, QPS, scale, cost).
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Concrete numerical claims with context (e.g. "42% latency reduction under 3,000 QPS").
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Technical Depth & Evidence
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-emerald-50">
                                        20%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Core stack breadth across 4 categories, systems scale signals (caching, concurrency, microservices), tech stack per project.
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Languages + frameworks + DBs + cloud tooling explicitly listed and tied to project architecture.
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Target Role Alignment
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-emerald-50">
                                        20%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Headline clarity, domain-relevant project depth, modern industry stack currency (TypeScript, Next.js, Docker, PostgreSQL).
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Headline matching target role and modern in-demand toolstack.
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        ATS Structure & Parseability
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-blue-50">
                                        10%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Standard ATS headings (Experience, Education, Projects, Skills), clean text layer encoding, optimal word density (350–850 words).
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        AST text selectable stream without OCR corruption or multi-column table collisions.
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Clarity & Action-Oriented Writing
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-purple-50">
                                        10%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Decisive action verb initiations (Engineered, Architected, Optimized), zero passive duty phrases, 10–35 word bullet conciseness.
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Bullets starting with active technical verbs without "responsible for" passive filler.
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Verified Profiles & Work Evidence
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-indigo-50">
                                        10%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Public inspectable code repositories (GitHub/GitLab), LinkedIn social proof, live demo deployments, cross-verified Orbix handles.
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Live functional hyperlinks matching authenticated candidate profiles.
                                    </td>
                                </tr>
                                <tr>
                                    <td className="p-3.5 sm:p-4 font-black text-black">
                                        Contact & Resume Completeness
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono font-black text-base bg-amber-50">
                                        5%
                                    </td>
                                    <td className="p-3.5 sm:p-4">
                                        Candidate reachability (email, phone, location) and academic credentials with graduation timeline.
                                    </td>
                                    <td className="p-3.5 sm:p-4 text-neutral-600">
                                        Valid email syntax, candidate name in header, degree + graduation year.
                                    </td>
                                </tr>
                                <tr className="bg-neutral-100 font-black text-black">
                                    <td className="p-3.5 sm:p-4 uppercase">Total Normalized Weight</td>
                                    <td className="p-3.5 sm:p-4 text-center font-mono text-base">100%</td>
                                    <td colSpan={2} className="p-3.5 sm:p-4 text-neutral-600 font-bold">
                                        Strict mathematical normalization prevents artificial score inflation.
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 3: INTERACTIVE 7-DIMENSION SCORING SIMULATOR                       */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-4">
                    <div>
                        <span className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-black" />
                            <span>Section 3 • Interactive Engine Simulator</span>
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-black text-black">
                            Live 7-Dimension Algorithm Simulator
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-full text-xs font-black bg-[#a2ff86] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                            Real-Time Engine Feedback
                        </span>
                    </div>
                </div>

                {/* Score Output Banner */}
                <div className="p-6 rounded-2xl bg-[#FFE566] border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-5">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-black flex flex-col items-center justify-center shadow-[4px_4px_0px_#000]">
                            <span className="text-3xl sm:text-4xl font-black text-black">{simResults.total}</span>
                            <span className="text-[10px] font-black uppercase text-neutral-600">out of 100</span>
                        </div>
                        <div>
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-black uppercase bg-black text-white border border-black">
                                {simResults.grade}
                            </span>
                            <h3 className="text-xl sm:text-2xl font-black text-black mt-1">
                                Composite Readiness Score
                            </h3>
                            <p className="text-xs text-neutral-800 font-bold">
                                Calculated across all 7 weighted dimensions via strict deterministic math.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto">
                        <div className="p-3 rounded-xl bg-white border-2 border-black text-center shadow-[2px_2px_0px_#000]">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase block">Extraction Conf.</span>
                            <span className="text-lg font-black text-black">{simResults.extractionConf}%</span>
                        </div>
                        <div className="p-3 rounded-xl bg-white border-2 border-black text-center shadow-[2px_2px_0px_#000]">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase block">Analysis Conf.</span>
                            <span className="text-lg font-black text-black">{simResults.analysisConf}%</span>
                        </div>
                    </div>
                </div>

                {/* Simulator Controls */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Control 1: Impact & Metrics */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                1. Impact & Quantified Metrics (25%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                {simResults.d1.score}/100 • Contr: {simResults.d1.contr.toFixed(1)} pts
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Quantified Metrics Count: {quantifiedMetricsCount}</span>
                                    <span className="text-neutral-500">(Target: 5+ metrics)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="10"
                                    value={quantifiedMetricsCount}
                                    onChange={(e) => setQuantifiedMetricsCount(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Impact Distribution: {metricDistributionRatio}%</span>
                                    <span className="text-neutral-500">(Entries with metrics)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={metricDistributionRatio}
                                    onChange={(e) => setMetricDistributionRatio(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Control 2: Technical Depth */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                2. Technical Depth & Evidence (20%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                {simResults.d2.score}/100 • Contr: {simResults.d2.contr.toFixed(1)} pts
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Full-Stack Breadth: {technicalStackDepth}%</span>
                                    <span className="text-neutral-500">(Languages, Frameworks, DBs)</span>
                                </div>
                                <input
                                    type="range"
                                    min="20"
                                    max="100"
                                    value={technicalStackDepth}
                                    onChange={(e) => setTechnicalStackDepth(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>

                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Architectural Signals: {architecturalSignalsCount}</span>
                                    <span className="text-neutral-500">(Caching, Microservices, Scale)</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="8"
                                    value={architecturalSignalsCount}
                                    onChange={(e) => setArchitecturalSignalsCount(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Control 3: Target Role Alignment */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                3. Target Role Alignment (20%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                {simResults.d3.score}/100 • Contr: {simResults.d3.contr.toFixed(1)} pts
                            </span>
                        </div>

                        <div className="space-y-3">
                            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                                <span>Professional Headline Stated</span>
                                <input
                                    type="checkbox"
                                    checked={headlinePresent}
                                    onChange={(e) => setHeadlinePresent(e.target.checked)}
                                    className="w-4 h-4 accent-black rounded cursor-pointer"
                                />
                            </label>

                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Modern Stack Currency: {modernToolingCurrency}%</span>
                                    <span className="text-neutral-500">(TypeScript, Docker, Next.js)</span>
                                </div>
                                <input
                                    type="range"
                                    min="10"
                                    max="100"
                                    value={modernToolingCurrency}
                                    onChange={(e) => setModernToolingCurrency(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Control 4: ATS Structure & Parseability */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                4. ATS Structure & Parseability (10%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                {simResults.d4.score}/100 • Contr: {simResults.d4.contr.toFixed(1)} pts
                            </span>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <div className="flex justify-between text-xs font-bold mb-1">
                                    <span>Standard Sections: {atsCoreSectionsDetected} of 4</span>
                                    <span className="text-neutral-500">(Exp, Edu, Proj, Skills)</span>
                                </div>
                                <input
                                    type="range"
                                    min="1"
                                    max="4"
                                    value={atsCoreSectionsDetected}
                                    onChange={(e) => setAtsCoreSectionsDetected(Number(e.target.value))}
                                    className="w-full accent-black cursor-pointer"
                                />
                            </div>

                            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                                <span>Selectable Text & OCR Clean</span>
                                <input
                                    type="checkbox"
                                    checked={selectableTextValid}
                                    onChange={(e) => setSelectableTextValid(e.target.checked)}
                                    className="w-4 h-4 accent-black rounded cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>

                    {/* Control 5: Clarity & Action Verbs */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                5. Clarity & Action Writing (10%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                {simResults.d5.score}/100 • Contr: {simResults.d5.contr.toFixed(1)} pts
                            </span>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs font-bold mb-1">
                                <span>Action-Verb Bullets Ratio: {actionVerbRatio}%</span>
                                <span className="text-neutral-500">(Engineered, Optimized vs Worked on)</span>
                            </div>
                            <input
                                type="range"
                                min="20"
                                max="100"
                                value={actionVerbRatio}
                                onChange={(e) => setActionVerbRatio(Number(e.target.value))}
                                className="w-full accent-black cursor-pointer"
                            />
                        </div>
                    </div>

                    {/* Control 6 & 7: Verified Profiles & Contact */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                                6 & 7. Profiles (10%) & Contact (5%)
                            </span>
                            <span className="font-mono text-xs font-bold text-neutral-700">
                                Contr: {(simResults.d6.contr + simResults.d7.contr).toFixed(1)} pts
                            </span>
                        </div>

                        <div className="space-y-2.5">
                            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                                <span>Public GitHub / Code Repository Verified</span>
                                <input
                                    type="checkbox"
                                    checked={hasGithubVerified}
                                    onChange={(e) => setHasGithubVerified(e.target.checked)}
                                    className="w-4 h-4 accent-black rounded cursor-pointer"
                                />
                            </label>

                            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                                <span>LinkedIn or Personal Portfolio Present</span>
                                <input
                                    type="checkbox"
                                    checked={hasLinkedinOrPortfolio}
                                    onChange={(e) => setHasLinkedinOrPortfolio(e.target.checked)}
                                    className="w-4 h-4 accent-black rounded cursor-pointer"
                                />
                            </label>

                            <label className="flex items-center justify-between text-xs font-bold cursor-pointer">
                                <span>Complete Contact Info (Email, Phone, Edu Year)</span>
                                <input
                                    type="checkbox"
                                    checked={contactComplete}
                                    onChange={(e) => setContactComplete(e.target.checked)}
                                    className="w-4 h-4 accent-black rounded cursor-pointer"
                                />
                            </label>
                        </div>
                    </div>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 4: STRUCTURED FACT PROVENANCE ARCHITECTURE                        */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="space-y-2 border-b-2 border-black/10 pb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-black" />
                        <span>Section 4 • Truth & Provenance Protocol</span>
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black text-black">
                        Fact Provenance: Explicitly Stated vs Inferred
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-700 font-medium">
                        Orbix distinguishes between self-claimed facts, inferred seniority conclusions, and externally verified profiles.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-600 space-y-2">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                            <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wide">
                                Explicitly Stated
                            </h3>
                        </div>
                        <p className="text-xs text-emerald-900 leading-relaxed">
                            Facts directly extracted verbatim from text blocks (e.g. graduation year 2026, employer name, explicitly listed technologies). Each fact retains its exact <code className="bg-emerald-100 px-1 rounded">sourceSection</code> and <code className="bg-emerald-100 px-1 rounded">sourceText</code> excerpt.
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-amber-50/70 border-2 border-amber-600 space-y-2">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-amber-700" />
                            <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                                Inferred Conclusions
                            </h3>
                        </div>
                        <p className="text-xs text-amber-900 leading-relaxed">
                            Algorithmic deductions synthesized from multi-entry context (e.g. calculating 1.5 years experience from overlapping internship dates, or classifying seniority as Mid-Level based on system architecture ownership).
                        </p>
                    </div>

                    <div className="p-5 rounded-2xl bg-blue-50/70 border-2 border-blue-600 space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-blue-700" />
                            <h3 className="text-sm font-black text-blue-950 uppercase tracking-wide">
                                Externally Verified
                            </h3>
                        </div>
                        <p className="text-xs text-blue-900 leading-relaxed">
                            Profiles where applicant ownership is proven through authenticated OAuth connections (GitHub commits, LeetCode contest rating, Codeforces rank). Claimed URLs without OAuth are marked <code className="bg-blue-100 px-1 rounded">claimed_only</code>.
                        </p>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* INTERACTIVE PROVENANCE INSPECTOR WORKBENCH                                */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-4 border-t-2 border-black/15">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-black" />
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Interactive Fact Provenance Inspector
                            </h3>
                        </div>
                        <span className="text-xs font-mono text-neutral-500">
                            Select any extracted entity to audit its source citation:
                        </span>
                    </div>

                    {/* Interactive Selection Tabs */}
                    <div className="flex flex-wrap gap-2">
                        {provenanceFacts.map((fact, idx) => (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => setSelectedFactIdx(idx)}
                                className={`px-3 py-1.5 rounded-xl border-2 border-black font-bold text-xs transition cursor-pointer ${
                                    selectedFactIdx === idx
                                        ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-neutral-700 hover:bg-neutral-100"
                                }`}
                            >
                                {fact.label}
                            </button>
                        ))}
                    </div>

                    {/* Dual-Pane Provenance Viewer */}
                    {(() => {
                        const fact = provenanceFacts[selectedFactIdx];
                        return (
                            <div className="p-6 rounded-3xl bg-[#FAF6EE] border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b-2 border-black/10">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-mono font-bold uppercase text-neutral-500">Selected Entity</div>
                                        <div className="text-base sm:text-lg font-black text-black">{fact.value}</div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border border-black shadow-[1px_1px_0px_#000] ${
                                            fact.type === "explicitly_stated"
                                                ? "bg-[#a2ff86] text-black"
                                                : fact.type === "inferred"
                                                ? "bg-[#FFE566] text-black"
                                                : "bg-blue-300 text-black"
                                        }`}>
                                            {fact.type.replace("_", " ")}
                                        </span>
                                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-white text-black border border-black">
                                            {fact.confidence}% Confidence
                                        </span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5">
                                        <span className="font-bold text-neutral-500 uppercase text-[10px] block">Extracted Source Excerpt</span>
                                        <p className="font-mono text-neutral-800 bg-neutral-50 p-2 rounded border border-neutral-300">
                                            &ldquo;{fact.excerpt}&rdquo;
                                        </p>
                                        <div className="text-[10px] text-neutral-500 font-mono">
                                            Section: <strong className="text-black uppercase">{fact.section}</strong> • Audit Status: <strong className="text-emerald-700">{fact.status}</strong>
                                        </div>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-white border-2 border-black space-y-1.5">
                                        <span className="font-bold text-neutral-500 uppercase text-[10px] block">Provenance Integrity Analysis</span>
                                        <p className="text-neutral-700 font-medium leading-relaxed">
                                            {fact.notes}
                                        </p>
                                        <div className="pt-2 border-t border-black/10 flex items-center gap-2 text-emerald-800 font-bold">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                            <span>Zero Hallucination Verified</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* ========================================================================= */}
                {/* INTERACTIVE GOOGLE XYZ BULLET REWRITE SIMULATOR                            */}
                {/* ========================================================================= */}
                <div className="space-y-4 pt-4 border-t-2 border-black/15">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-black" />
                            <h3 className="text-base sm:text-lg font-black text-black">
                                Grounded Bullet Transformation Engine (Google XYZ Model)
                            </h3>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase bg-[#FFE566] text-black border border-black">
                            Accomplished [X] measured by [Y] doing [Z]
                        </span>
                    </div>

                    {/* Domain Buttons */}
                    <div className="flex flex-wrap gap-2">
                        {rewriteExamples.map((item) => (
                            <button
                                key={item.domain}
                                type="button"
                                onClick={() => setSelectedRewriteDomain(item.domain)}
                                className={`px-3.5 py-1.5 rounded-xl border-2 border-black font-bold text-xs transition cursor-pointer ${
                                    selectedRewriteDomain === item.domain
                                        ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                        : "bg-white text-neutral-800 hover:bg-neutral-100"
                                }`}
                            >
                                {item.title}
                            </button>
                        ))}
                    </div>

                    {(() => {
                        const activeEx = rewriteExamples.find((ex) => ex.domain === selectedRewriteDomain) || rewriteExamples[0];
                        return (
                            <div className="p-6 rounded-3xl bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] space-y-4">
                                <div className="space-y-3 font-mono text-xs">
                                    {/* Before */}
                                    <div className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-300 text-rose-950 space-y-1">
                                        <div className="flex items-center justify-between font-bold text-[10px] uppercase text-rose-700">
                                            <span>Original Candidate Bullet (Weak / Passive Duties)</span>
                                            <span>Score: 35/100</span>
                                        </div>
                                        <p className="text-sm font-medium">&ldquo;{activeEx.before}&rdquo;</p>
                                    </div>

                                    {/* After */}
                                    <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-400 text-emerald-950 space-y-1">
                                        <div className="flex items-center justify-between font-bold text-[10px] uppercase text-emerald-700">
                                            <span>Grounded Rewrite (Active Technical Impact & Metrics)</span>
                                            <span className="text-emerald-900 font-black">Score: 98/100</span>
                                        </div>
                                        <p className="text-sm font-bold">&ldquo;{activeEx.after}&rdquo;</p>
                                    </div>
                                </div>

                                <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 text-xs text-neutral-800">
                                    <strong className="text-black">Grounded XYZ Breakdown:</strong> {activeEx.formula}
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* Example JSON Provenance Snippet */}
                <div className="p-5 rounded-2xl bg-neutral-900 text-neutral-100 border-2 border-black space-y-2">
                    <span className="text-[11px] font-mono font-bold uppercase text-[#FFE566]">
                        Fact Provenance Schema Representation (TypeScript JSON)
                    </span>
                    <pre className="font-mono text-xs text-neutral-300 overflow-x-auto p-3 rounded-lg bg-black/50 border border-neutral-700">
{`{
  "value": "PostgreSQL",
  "sourceSection": "skills",
  "sourceText": "Databases & Tools: PostgreSQL, Redis, Docker, Git, Linux",
  "extractionConfidence": 0.95,
  "evidenceType": "explicitly_stated",
  "verificationStatus": "claimed_only"
}`}
                    </pre>
                </div>
            </section>

            {/* ========================================================================= */}
            {/* SECTION 5: PRIVACY-FIRST PROFILE SYNCHRONIZATION                          */}
            {/* ========================================================================= */}
            <section className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                <div className="space-y-2 border-b-2 border-black/10 pb-4">
                    <span className="text-xs font-black uppercase tracking-wider text-neutral-500 flex items-center gap-1.5">
                        <FileCheck2 className="w-4 h-4 text-black" />
                        <span>Section 5 • Consent-Driven Profile Sync</span>
                    </span>
                    <h2 className="text-2xl sm:text-4xl font-black text-black">
                        Missing-Field Isolation & Consent Protocol
                    </h2>
                    <p className="text-sm sm:text-base text-neutral-700 font-medium">
                        Orbix protects candidate identity and existing profile state through strict non-destructive isolation rules.
                    </p>
                </div>

                <div className="space-y-4 text-xs sm:text-sm text-neutral-800 leading-relaxed">
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black space-y-2">
                        <h3 className="font-black text-black flex items-center gap-2">
                            <Lock className="w-4 h-4 text-black" />
                            <span>Three Golden Isolation Rules:</span>
                        </h3>
                        <ul className="list-disc pl-5 space-y-1.5 font-medium">
                            <li>
                                <strong>Rule 1 (Zero Overwrites):</strong> If a user already has an existing bio, headline, GitHub link, or college in their profile, Orbix will NEVER propose overwriting it with resume data.
                            </li>
                            <li>
                                <strong>Rule 2 (Missing Fields Only):</strong> Only profile columns that are currently <code className="bg-neutral-200 px-1 rounded">NULL</code>, empty string <code className="bg-neutral-200 px-1 rounded">""</code>, or empty array <code className="bg-neutral-200 px-1 rounded">[]</code> are eligible for sync proposals.
                            </li>
                            <li>
                                <strong>Rule 3 (Explicit User Review):</strong> No automated database updates occur silently in background jobs. The candidate reviews each proposed field within the interactive Orbix Profile Review interface, evaluating confidence ratings and source excerpts before approving the sync.
                            </li>
                        </ul>
                    </div>

                    {/* Real Section Snapshot: Profile Sync Review Component Preview */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-mono font-black uppercase text-neutral-500 flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                <span>Real Section Snapshot: Profile Review & Sync Interface</span>
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-[#a2ff86] border border-black">
                                4 Eligible Fields
                            </span>
                        </div>

                        <div className="p-5 rounded-2xl bg-white border-2 sm:border-[3px] border-black shadow-[6px_6px_0px_#000] space-y-3">
                            <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                <div>
                                    <h4 className="text-sm sm:text-base font-black text-black">Proposed Profile Enrichments</h4>
                                    <p className="text-xs text-neutral-600">Reviewing extracted facts for missing profile attributes</p>
                                </div>
                                <span className="px-3 py-1 rounded-xl bg-[#FFE566] text-black font-black text-xs border-2 border-black shadow-[1.5px_1.5px_0px_#000]">
                                    Review & Approve
                                </span>
                            </div>

                            <div className="space-y-2">
                                <div className="p-3 rounded-xl border-2 border-black bg-amber-50/50 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded bg-[#FFE566] border-2 border-black flex items-center justify-center">
                                            <Check className="w-3.5 h-3.5 stroke-[3] text-black" />
                                        </div>
                                        <div>
                                            <span className="font-black text-xs text-black block">Professional Headline</span>
                                            <span className="text-xs text-neutral-700">&ldquo;Full Stack Software Engineer | Distributed Systems&rdquo;</span>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        Missing in Profile • 96% Conf
                                    </span>
                                </div>

                                <div className="p-3 rounded-xl border-2 border-black bg-amber-50/50 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded bg-[#FFE566] border-2 border-black flex items-center justify-center">
                                            <Check className="w-3.5 h-3.5 stroke-[3] text-black" />
                                        </div>
                                        <div>
                                            <span className="font-black text-xs text-black block">University / Institution</span>
                                            <span className="text-xs text-neutral-700">&ldquo;Indian Institute of Information Technology, Bengaluru&rdquo;</span>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        Missing in Profile • 95% Conf
                                    </span>
                                </div>

                                <div className="p-3 rounded-xl border-2 border-black bg-amber-50/50 flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-5 h-5 rounded bg-[#FFE566] border-2 border-black flex items-center justify-center">
                                            <Check className="w-3.5 h-3.5 stroke-[3] text-black" />
                                        </div>
                                        <div>
                                            <span className="font-black text-xs text-black block">GitHub Link</span>
                                            <span className="text-xs text-neutral-700 font-mono">https://github.com/aaravsharma</span>
                                        </div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                                        Verified OAuth • 100% Conf
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div>
                        <h4 className="text-base font-black text-black">Experience the Live Resume Intelligence Engine</h4>
                        <p className="text-xs text-neutral-800 font-medium mt-0.5">
                            Upload your resume to receive 7-dimension scoring, ATS compliance audits, and profile synchronization.
                        </p>
                    </div>
                    <Link
                        to="/resume"
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-black text-white hover:bg-neutral-800 font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] shrink-0"
                    >
                        <span>Open Resume Manager</span>
                        <ArrowRight className="w-4 h-4 text-[#FFE566]" />
                    </Link>
                </div>
            </section>
        </article>
    );
};

export default ResumeIntelligenceDocumentary;
