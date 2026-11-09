import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
    FolderKanban,
    Zap,
    BookOpen,
    Rocket,
    ArrowRight,
    Star,
    GitFork,
    CheckCircle2,
    Sparkles,
    Search,
    X,
    Play,
    Pause,
    Info,
    Terminal,
    Globe,
    Plus,
} from "lucide-react";
import { ProjectCard } from "../../../components/projects/ProjectCard";
import { ProjectDetailModal } from "../../../components/projects/ProjectDetailModal";
import {
    MOCK_PROJECTS_DATA,
    EXTRACTION_SIMULATION_STAGES,
    PROJECT_CATEGORIES,
} from "./mockProjects";
import type { ProjectItem } from "../../../types/project";

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        />
    </svg>
);

export const ProjectsShowcase: React.FC = () => {
    // Selected Category Filter
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState<string>("");

    // Modal state for project deep-dive architecture inspection
    const [viewingProject, setViewingProject] = useState<ProjectItem | null>(null);

    // =========================================================================
    // FLASH / STEPPER SIMULATION STUDIO
    // Cycles every 3.5 seconds across the 4 extraction & curation stages
    // =========================================================================
    const [activeStageIndex, setActiveStageIndex] = useState<number>(0);
    const [isAutoPlaying, setIsAutoPlaying] = useState<boolean>(true);
    const [progressPercent, setProgressPercent] = useState<number>(0);

    const STAGE_DURATION_MS = 3600;
    const TICK_INTERVAL_MS = 50;

    useEffect(() => {
        if (!isAutoPlaying) return;

        const interval = setInterval(() => {
            setProgressPercent((prev) => {
                const next = prev + (TICK_INTERVAL_MS / STAGE_DURATION_MS) * 100;
                if (next >= 100) {
                    setActiveStageIndex((curr) => (curr + 1) % EXTRACTION_SIMULATION_STAGES.length);
                    return 0;
                }
                return next;
            });
        }, TICK_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [isAutoPlaying, activeStageIndex]);

    const handleSelectStage = useCallback((index: number) => {
        setActiveStageIndex(index);
        setProgressPercent(0);
        setIsAutoPlaying(false);
    }, []);

    // Filtered Projects
    const filteredProjects = useMemo(() => {
        return MOCK_PROJECTS_DATA.filter((proj) => {
            if (selectedCategory !== "all" && proj.category !== selectedCategory) {
                return false;
            }
            if (searchQuery.trim()) {
                const q = searchQuery.toLowerCase().trim();
                const matchTitle = proj.title.toLowerCase().includes(q);
                const matchTagline = proj.tagline?.toLowerCase().includes(q);
                const matchTech = proj.technologies?.some((t) => t.toLowerCase().includes(q));
                const matchCategory = proj.category?.toLowerCase().includes(q);
                if (!matchTitle && !matchTagline && !matchTech && !matchCategory) {
                    return false;
                }
            }
            return true;
        });
    }, [selectedCategory, searchQuery]);

    return (
        <section className="relative w-full bg-[#FAF6EE] text-neutral-900 py-16 sm:py-24 px-0 overflow-hidden font-sans select-none">
            {/* Warm, eye-friendly dot grid matching Orbix platform canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* =========================================================================
                SECTION HEADER: Exact Neo-Brutalist Layout matching Clubs, Platform & Events
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto mb-12 sm:mb-16 px-4 sm:px-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                    {/* Left Column: Bold Headline & Redirections */}
                    <div className="lg:col-span-6 space-y-6">
                        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black text-black tracking-tight leading-[1.08]">
                            Project showcase &
                            <br />
                            <span className="inline-block mt-3 bg-[#FFE566] text-black px-5 sm:px-8 py-1.5 sm:py-2.5 rounded-2xl font-black -rotate-1 border-2 border-black shadow-[4px_4px_0px_#000]">
                                flagship repos
                            </span>
                        </h2>

                        <p className="text-neutral-700 font-medium text-base sm:text-lg md:text-xl max-w-xl leading-relaxed">
                            Curate your top 4 flagship engineering architectures. Showcase verifiable GitHub intelligence, AST dependency scores, deep architecture writeups, and live production deployments.
                        </p>

                        {/* Dual Redirections */}
                        <div className="flex flex-wrap items-center gap-4 pt-2">
                            <Link
                                to="/projects"
                                className="inline-flex items-center gap-2 text-base sm:text-lg font-black text-black hover:text-neutral-800 transition-colors group cursor-pointer"
                                title="Curate your personal project showcase"
                            >
                                <span className="underline decoration-4 underline-offset-4 decoration-[#FFE566] group-hover:decoration-black">
                                    Curate your projects
                                </span>
                                <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1.5 transition-transform stroke-[2.5]" />
                            </Link>

                            <span className="text-black/30 hidden sm:inline">•</span>

                            <Link
                                to="/docs/profile-architecture"
                                className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-neutral-600 hover:text-black transition-colors"
                                title="Project Intelligence & Showcase Documentation"
                            >
                                <BookOpen className="w-3.5 h-3.5" />
                                <span>Project Showcase Docs →</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right Column: 3 Feature Cards matching Neo-Brutalist Leaderboard / Clubs style */}
                    <div className="lg:col-span-6 space-y-4">
                        {/* Feature 1: Automated AST Analysis */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <Zap className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Automated AST Intelligence
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Our syntax parser inspects package manifests, commits, and README trees into an automated 0–100% Quality Completeness Score with actionable tips.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Feature 2: 4 Curated Flagship Slots */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <FolderKanban className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        4 Curated Flagship Slots
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Recruiters evaluate signal, not volume. Curating 4 high-impact engineering architectures yields 3.8x higher interview response rates.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Feature 3: Deep Systems Storytelling */}
                        <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[6px_6px_0px_#000] transition-all">
                            <div className="flex items-start gap-4">
                                <div className="w-12 h-12 rounded-xl bg-[#61DDE1] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <BookOpen className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div className="space-y-1 min-w-0">
                                    <h3 className="text-base sm:text-lg font-black text-black tracking-tight">
                                        Deep Systems Architecture
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                                        Enrich code with real problem statements, target audiences, architecture diagrams, technical trade-offs, and live production endpoints.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                MAIN SHOWCASE WORKSPACE FRAME
                Matches exact styling of user screenshot (white card, 3px border, 6px shadow)
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto space-y-8 px-4 sm:px-0">
                {/* -----------------------------------------------------------------
                    FLASH STUDIO: Live Animated Extraction & Curation Pipeline
                    Changes every 3.5 seconds across 4 authentic phases from the app
                ----------------------------------------------------------------- */}
                <div className="rounded-3xl bg-white border-[3px] border-black p-5 sm:p-8 shadow-[6px_6px_0px_#000] space-y-6">
                    {/* Stepper Header with Stage Selector & Auto-Play Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b-2 border-black/10">
                        <div className="flex items-center gap-3">
                            <span className="p-2 rounded-xl bg-black text-[#a2ff86] border border-black shadow-[2px_2px_0px_#000]">
                                <Sparkles className="w-5 h-5" />
                            </span>
                            <div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-lg sm:text-xl font-black text-black tracking-tight">
                                        Orbix Project Studio Pipeline
                                    </h3>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                                        Live Interactive Walkthrough
                                    </span>
                                </div>
                                <p className="text-xs text-neutral-500 font-bold">
                                    Simulating how any repository link transforms into a verified architecture showcase
                                </p>
                            </div>
                        </div>

                        {/* Play/Pause Control */}
                        <div className="flex items-center gap-2 self-start md:self-auto">
                            <button
                                type="button"
                                onClick={() => setIsAutoPlaying((prev) => !prev)}
                                className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black flex items-center gap-1.5 active:translate-y-0.5 transition-all cursor-pointer"
                                title={isAutoPlaying ? "Pause Auto-cycle" : "Play Auto-cycle"}
                            >
                                {isAutoPlaying ? (
                                    <>
                                        <Pause className="w-3.5 h-3.5 fill-black" />
                                        <span>Pause Flow</span>
                                    </>
                                ) : (
                                    <>
                                        <Play className="w-3.5 h-3.5 fill-black" />
                                        <span>Auto Cycle</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* 4 Interactive Progress Tabs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {EXTRACTION_SIMULATION_STAGES.map((stage, idx) => {
                            const isActive = activeStageIndex === idx;
                            return (
                                <button
                                    key={stage.id}
                                    type="button"
                                    onClick={() => handleSelectStage(idx)}
                                    className={`relative text-left p-3.5 rounded-2xl border-2 border-black transition-all overflow-hidden cursor-pointer ${
                                        isActive
                                            ? "bg-[#FAF6EE] shadow-[3px_3px_0px_#000] -translate-y-0.5"
                                            : "bg-white hover:bg-neutral-50 shadow-[1px_1px_0px_#000] opacity-80 hover:opacity-100"
                                    }`}
                                >
                                    {/* Progress fill bar on active stage */}
                                    {isActive && isAutoPlaying && (
                                        <div
                                            className="absolute top-0 left-0 bottom-0 bg-[#FFE566]/25 -z-10 transition-all duration-75"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    )}

                                    <div className="flex items-center justify-between mb-1.5">
                                        <span className={`w-6 h-6 rounded-lg border border-black flex items-center justify-center font-mono font-black text-xs ${
                                            isActive ? "bg-black text-[#a2ff86]" : "bg-neutral-100 text-neutral-500"
                                        }`}>
                                            {stage.stepNumber}
                                        </span>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border border-black/30 ${stage.badgeColor} text-black`}>
                                            Step {idx + 1}
                                        </span>
                                    </div>
                                    <h4 className="text-xs sm:text-sm font-black text-black tracking-tight truncate">
                                        {stage.shortLabel}
                                    </h4>
                                </button>
                            );
                        })}
                    </div>

                    {/* Live Stage Display Screen (The Actual Studio Modals From User's Screenshots) */}
                    <div className="rounded-2xl border-2 border-black bg-[#FAF6EE] p-4 sm:p-6 shadow-[3px_3px_0px_#000] min-h-[340px] flex flex-col justify-between transition-all">
                        {/* -------------------------------------------------------------
                            STAGE 01: INTELLIGENT GITHUB EXTRACTION (User Image 2)
                        ------------------------------------------------------------- */}
                        {activeStageIndex === 0 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black">
                                            PROJECT SHOWCASE STUDIO
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-black border border-black">
                                            Input Repo URL
                                        </span>
                                    </div>
                                    <div className="w-6 h-6 rounded-lg border border-black bg-white flex items-center justify-center text-xs font-black">
                                        ✕
                                    </div>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <Sparkles className="w-4 h-4 text-black" />
                                            <h4 className="text-sm sm:text-base font-black text-black">
                                                INTELLIGENT GITHUB EXTRACTION
                                            </h4>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-medium leading-relaxed">
                                            Provide a GitHub repository link to automatically discover repository metadata, language distributions, dependency frameworks from manifests, and architecture details from README.
                                        </p>
                                    </div>

                                    {/* Simulated GitHub URL Input Field with Live Typing Aesthetic */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-black uppercase tracking-wider text-black">
                                            GITHUB REPOSITORY URL
                                        </label>
                                        <div className="relative flex items-center">
                                            <input
                                                type="text"
                                                readOnly
                                                value="https://github.com/vineet-chandel/hyperion-telemetry-mesh"
                                                className="w-full px-3.5 py-3 rounded-xl border-2 border-black bg-[#FAF6EE] text-black font-mono text-xs sm:text-sm font-bold shadow-[inset_2px_2px_0px_rgba(0,0,0,0.06)] pr-10"
                                            />
                                            <Globe className="w-4 h-4 text-neutral-500 absolute right-3 pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Action Buttons from Screenshot */}
                                    <div className="flex items-center gap-3 pt-1 flex-wrap">
                                        <button
                                            type="button"
                                            className="px-5 py-2.5 rounded-xl bg-[#a2ff86] text-black border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black flex items-center gap-2 animate-pulse"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            <span>EXTRACT REPOSITORY INTELLIGENCE</span>
                                        </button>
                                        <button
                                            type="button"
                                            className="px-4 py-2.5 rounded-xl bg-white text-black border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black"
                                        >
                                            CREATE PROJECT MANUALLY
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -------------------------------------------------------------
                            STAGE 02: AST PARSER & COMPLETENESS SCORECARD (User Image 1 & 2)
                        ------------------------------------------------------------- */}
                        {activeStageIndex === 1 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-[#a2ff86] text-black border border-black">
                                            AST ANALYSIS ENGINE
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-white text-black border border-black">
                                            Extraction Verified
                                        </span>
                                    </div>
                                    <span className="text-xs font-mono font-bold text-neutral-600">
                                        hyperion-telemetry-mesh
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                    {/* Left: 4 Extraction Verification Steps */}
                                    <div className="md:col-span-8 p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2.5">
                                        <div className="flex items-center gap-2 pb-1 border-b border-neutral-200">
                                            <Terminal className="w-4 h-4 text-black" />
                                            <span className="text-xs font-black text-black uppercase tracking-wider">
                                                Multi-Stage Extraction Audit
                                            </span>
                                        </div>

                                        <div className="space-y-2 text-xs font-mono">
                                            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] border border-black/20">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-bold">Provider Connectivity: Public GitHub Repo</span>
                                                </div>
                                                <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">200 OK</span>
                                            </div>

                                            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] border border-black/20">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-bold">Repository Metrics: 840 ★ Stars • 142 Forks</span>
                                                </div>
                                                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">Apache-2.0</span>
                                            </div>

                                            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] border border-black/20">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-bold">Manifests: Go (88.4%), eBPF, OpenTelemetry, ClickHouse</span>
                                                </div>
                                                <span className="text-[11px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">7 Extracted</span>
                                            </div>

                                            <div className="flex items-center justify-between p-2 rounded-xl bg-[#FAF6EE] border border-black/20">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                    <span className="font-bold">README Parser: Systems architecture & microbenchmarks found</span>
                                                </div>
                                                <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">AST Synthesized</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Quality Completeness Scorecard */}
                                    <div className="md:col-span-4 p-4 rounded-2xl bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col justify-between space-y-3">
                                        <div className="space-y-1">
                                            <span className="text-[11px] font-black uppercase tracking-wider text-black">
                                                Completeness Score
                                            </span>
                                            <div className="flex items-baseline gap-2">
                                                <span className="text-4xl sm:text-5xl font-black text-black font-mono">
                                                    98%
                                                </span>
                                                <span className="text-xs font-bold text-black/70">
                                                    Tier-1 Signal
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-[11px] font-bold text-black/80">
                                            <p>✓ Production README with benchmarks</p>
                                            <p>✓ High-velocity commit history</p>
                                            <p>✓ Valid open-source license</p>
                                        </div>
                                        <div className="px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] text-[11px] font-black text-center border border-black">
                                            Ready for Systems Curation
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -------------------------------------------------------------
                            STAGE 03: DEEP ARCHITECTURE CURATION STUDIO (User Images 3, 4, 5)
                        ------------------------------------------------------------- */}
                        {activeStageIndex === 2 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-black text-white border border-black">
                                            PROJECT SHOWCASE STUDIO
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#a2ff86] text-black border border-black">
                                            Curating Identity & Architecture
                                        </span>
                                    </div>
                                    <div className="w-6 h-6 rounded-lg border border-black bg-white flex items-center justify-center text-xs font-black">
                                        ✕
                                    </div>
                                </div>

                                {/* Studio Tab Bar from User Screenshot 3 */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <span className="px-3 py-1.5 rounded-lg bg-black text-[#a2ff86] font-black text-xs border border-black shadow-[1px_1px_0px_#000] shrink-0">
                                        A. IDENTITY
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs border border-black shrink-0">
                                        B. STORY
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs border border-black shrink-0">
                                        C. FEATURES (3)
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs border border-black shrink-0">
                                        D. TECH STACK (7)
                                    </span>
                                    <span className="px-3 py-1.5 rounded-lg bg-white text-black font-bold text-xs border border-black shrink-0">
                                        E. LINKS (2)
                                    </span>
                                </div>

                                {/* Form Body from User Screenshot 3 & 4 */}
                                <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                                PROJECT TITLE
                                            </span>
                                            <div className="p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE] text-xs font-black text-black">
                                                Hyperion Telemetry Mesh
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                                CATEGORY & STATUS
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <span className="px-2.5 py-1.5 rounded-xl border border-black bg-[#FFE566] text-black text-xs font-black">
                                                    Distributed Systems
                                                </span>
                                                <span className="px-2.5 py-1.5 rounded-xl border border-black bg-emerald-100 text-emerald-800 text-xs font-black">
                                                    Completed
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Problem Statement & Solution */}
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-black">
                                            SYSTEMS PROBLEM STATEMENT & SOLUTION
                                        </span>
                                        <div className="p-2.5 rounded-xl border border-black bg-[#FAF6EE] text-xs text-neutral-800 font-medium leading-relaxed">
                                            "Cloud-native observability daemon capturing Linux kernel socket events via eBPF probes with sub-15 microsecond overhead. Employs SIMD-accelerated serialization to ClickHouse."
                                        </div>
                                    </div>

                                    {/* Autosave and Publish buttons from Screenshot 3 */}
                                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200">
                                        <span className="text-[11px] text-neutral-500 font-medium">
                                            All changes autosaved to draft
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1.5 rounded-xl border border-black bg-white text-black text-xs font-black shadow-[1px_1px_0px_#000]">
                                                Save Draft
                                            </span>
                                            <span className="px-4 py-1.5 rounded-xl border-2 border-black bg-[#a2ff86] text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5">
                                                <Rocket className="w-3.5 h-3.5" />
                                                Publish Showcase
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* -------------------------------------------------------------
                            STAGE 04: VERIFIED PUBLIC PORTFOLIO SYNC (User Image 1)
                        ------------------------------------------------------------- */}
                        {activeStageIndex === 3 && (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black">
                                            PUBLIC PROFILE SHOWCASE
                                        </span>
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE566] text-black border border-black">
                                            Slot 1 of 4 Occupied
                                        </span>
                                    </div>
                                    <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Live on /profile/u/Vineet-Chandel
                                    </span>
                                </div>

                                <div className="p-4 sm:p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-black text-[#a2ff86] border border-black">
                                                    Distributed Systems
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    Published
                                                </span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#FFE566] text-black border border-black">
                                                    ★ Pinned Top
                                                </span>
                                            </div>
                                            <h4 className="text-base sm:text-lg font-black text-black">
                                                Hyperion Telemetry Mesh
                                            </h4>
                                            <p className="text-xs text-neutral-600 font-medium">
                                                High-performance distributed eBPF tracing agent & kernel event streamer.
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <span className="px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black border border-black shadow-[2px_2px_0px_#000] flex items-center gap-1">
                                                <Globe className="w-3.5 h-3.5" />
                                                Live Demo
                                            </span>
                                        </div>
                                    </div>

                                    {/* Tech tags & metrics */}
                                    <div className="flex items-center justify-between pt-2 border-t border-neutral-200 flex-wrap gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {["Go", "eBPF", "OpenTelemetry", "ClickHouse"].map((t) => (
                                                <span key={t} className="px-2 py-0.5 rounded bg-[#FAF6EE] text-[10px] font-mono font-bold text-black border border-black/30">
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                        <div className="flex items-center gap-3 text-xs font-mono font-bold text-neutral-700">
                                            <span className="flex items-center gap-1">
                                                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                                                840
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <GitFork className="w-3.5 h-3.5 text-neutral-600" />
                                                142
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Flash Component Bottom Navigation Hint */}
                        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10 text-xs font-bold text-neutral-600">
                            <span>
                                {EXTRACTION_SIMULATION_STAGES[activeStageIndex].description}
                            </span>
                            <div className="flex items-center gap-1">
                                {EXTRACTION_SIMULATION_STAGES.map((_, i) => (
                                    <span
                                        key={i}
                                        className={`w-2 h-2 rounded-full border border-black transition-all ${
                                            activeStageIndex === i ? "bg-black scale-125" : "bg-neutral-300"
                                        }`}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* -----------------------------------------------------------------
                    CAPACITY INDICATOR & CATEGORY FILTER TOOLBAR
                    Matches user screenshot 1: Showcase Capacity 4 / 4 Projects Added
                ----------------------------------------------------------------- */}
                <div className="rounded-3xl bg-white border-[3px] border-black p-5 sm:p-7 shadow-[6px_6px_0px_#000] space-y-5">
                    {/* Capacity Indicator Bar from User Image 1 */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black uppercase tracking-wider text-black">
                                    SHOWCASE CAPACITY:
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black font-mono bg-white text-black border-2 border-black shadow-[1px_1px_0px_#000]">
                                    4 / 4 Projects Added
                                </span>
                            </div>
                            <p className="text-[11px] font-medium text-neutral-600">
                                4 of 4 curated slots occupied. High portfolio quality with verified AST intelligence.
                            </p>
                        </div>

                        {/* Visual 4-slot progress indicators from User Image 1 */}
                        <div className="flex items-center gap-2">
                            {MOCK_PROJECTS_DATA.map((proj, slotIdx) => (
                                <button
                                    key={proj.id}
                                    type="button"
                                    onClick={() => setViewingProject(proj)}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl border-2 border-black flex items-center justify-center font-mono font-black text-xs shadow-[2px_2px_0px_#000] bg-black text-[#a2ff86] hover:scale-105 active:scale-95 transition-all cursor-pointer"
                                    title={`Slot ${slotIdx + 1}: ${proj.title} (Click to inspect architecture)`}
                                >
                                    {slotIdx + 1}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
                        {/* Category Pills */}
                        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                            {PROJECT_CATEGORIES.map((cat) => {
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setSelectedCategory(cat.id)}
                                        className={`px-3.5 py-1.5 rounded-xl border-2 border-black text-xs font-black transition-all whitespace-nowrap cursor-pointer ${
                                            isSelected
                                                ? "bg-black text-[#a2ff86] shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] text-neutral-800 hover:bg-neutral-100"
                                        }`}
                                    >
                                        {cat.label} ({cat.count})
                                    </button>
                                );
                            })}
                        </div>

                        {/* Search Input */}
                        <div className="relative min-w-[240px]">
                            <Search className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search projects or stack..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 rounded-xl border-2 border-black bg-[#FAF6EE] text-xs font-bold text-black placeholder:text-neutral-500 focus:outline-none focus:bg-white transition-all shadow-[2px_2px_0px_#000]"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery("")}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black cursor-pointer"
                                    aria-label="Clear search"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* -------------------------------------------------------------
                        THE 4 FLAGSHIP PROJECT CARDS (Using real ProjectCard component)
                    ------------------------------------------------------------- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 pt-2">
                        {filteredProjects.map((project) => (
                            <div key={project.id} className="relative">
                                <ProjectCard
                                    project={project}
                                    isManageMode={false}
                                    onViewDetails={(p) => setViewingProject(p)}
                                />
                            </div>
                        ))}
                    </div>
                </div>

                {/* -----------------------------------------------------------------
                    HOW TO ADD YOUR FLAGSHIP PROJECTS (Exact Onboarding Guide Card from Image 1)
                ----------------------------------------------------------------- */}
                <div className="rounded-3xl bg-white border-[3px] border-black p-6 sm:p-10 shadow-[6px_6px_0px_#000] space-y-8">
                    {/* Guide Header */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-2 border-black">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black uppercase tracking-wider text-black">
                                <Sparkles className="w-3.5 h-3.5 text-black" />
                                <span>Showcase Onboarding Guide</span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                How to Add Your Flagship Projects
                            </h3>
                            <p className="text-xs sm:text-sm text-neutral-600 font-bold max-w-2xl leading-relaxed">
                                Orbix provides 4 dedicated flagship slots on your public profile to showcase your best engineering architectures, open-source repositories, and production systems to recruiters and peer engineers.
                            </p>
                        </div>
                        <Link
                            to="/projects"
                            className="px-6 py-3.5 rounded-2xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[4px_4px_0px_#000] text-xs font-black flex items-center gap-2 cursor-pointer active:translate-y-0.5 transition-all self-start md:self-auto"
                        >
                            <Plus className="w-4 h-4" />
                            <span>New Project</span>
                        </Link>
                    </div>

                    {/* 4 Process Step Cards from Image 1 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                        {/* Step 1 */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="w-9 h-9 rounded-xl bg-black text-[#a2ff86] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-black">
                                        01
                                    </span>
                                    <span className="p-2 rounded-xl bg-white border border-black shadow-[2px_2px_0px_#000]">
                                        <GithubIcon className="w-4 h-4 text-black" />
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-black">
                                    Connect or Create
                                </h4>
                                <p className="text-xs text-neutral-600 font-bold leading-relaxed">
                                    Paste any public GitHub repository URL or link private repos via secure GitHub OAuth. You can also build an entry manually without a repository.
                                </p>
                            </div>
                            <div className="pt-2 border-t border-neutral-300">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Public & Private Repos
                                </span>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="w-9 h-9 rounded-xl bg-black text-[#a2ff86] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-black">
                                        02
                                    </span>
                                    <span className="p-2 rounded-xl bg-[#FFE566] border border-black shadow-[2px_2px_0px_#000]">
                                        <Zap className="w-4 h-4 text-black" />
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-black">
                                    Automated Scorecard
                                </h4>
                                <p className="text-xs text-neutral-600 font-bold leading-relaxed">
                                    Our AST intelligence parses READMEs, dependencies, and file structures into a 0–100% Quality Completeness Score with actionable tips.
                                </p>
                            </div>
                            <div className="pt-2 border-t border-neutral-300">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    AST & Quality Analysis
                                </span>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="w-9 h-9 rounded-xl bg-black text-[#a2ff86] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-black">
                                        03
                                    </span>
                                    <span className="p-2 rounded-xl bg-white border border-black shadow-[2px_2px_0px_#000]">
                                        <BookOpen className="w-4 h-4 text-black" />
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-black">
                                    Curate Architecture
                                </h4>
                                <p className="text-xs text-neutral-600 font-bold leading-relaxed">
                                    Enrich your entry with real problem statements, target audience, technical challenges solved, architecture diagrams, and live demo links.
                                </p>
                            </div>
                            <div className="pt-2 border-t border-neutral-300">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Deep Systems Story
                                </span>
                            </div>
                        </div>

                        {/* Step 4 */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col justify-between space-y-4 hover:-translate-y-1 transition-transform">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="w-9 h-9 rounded-xl bg-black text-[#a2ff86] flex items-center justify-center border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-black">
                                        04
                                    </span>
                                    <span className="p-2 rounded-xl bg-[#a2ff86] border border-black shadow-[2px_2px_0px_#000]">
                                        <Rocket className="w-4 h-4 text-black" />
                                    </span>
                                </div>
                                <h4 className="text-sm font-black text-black">
                                    Publish to Profile
                                </h4>
                                <p className="text-xs text-neutral-600 font-bold leading-relaxed">
                                    Toggle to published to pin your top 4 projects to your public profile (/profile/u/:username). Visitors can inspect architecture modal deep-dives.
                                </p>
                            </div>
                            <div className="pt-2 border-t border-neutral-300">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Public Profile Sync
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Informational Guidance Footer from Image 1 */}
                    <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                            <Info className="w-5 h-5 text-black flex-shrink-0 mt-0.5" />
                            <div className="space-y-0.5">
                                <p className="text-xs font-black text-black">
                                    Why 4 Curated Showcase Slots?
                                </p>
                                <p className="text-[11px] text-neutral-600 font-bold leading-relaxed">
                                    Recruiters evaluate signal, not volume. Curating 4 high-impact architectures yields 3.8x higher response rates than endless lists of fork repositories.
                                </p>
                            </div>
                        </div>
                        <Link
                            to="/projects"
                            className="px-5 py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black shadow-[3px_3px_0px_#000] text-xs font-black flex items-center gap-2 cursor-pointer active:translate-y-0.5 transition-all whitespace-nowrap self-stretch sm:self-auto justify-center"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Add Your First Project</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Architecture Details Modal for visitors to inspect live system architecture */}
            <ProjectDetailModal
                isOpen={Boolean(viewingProject)}
                onClose={() => setViewingProject(null)}
                project={viewingProject}
            />
        </section>
    );
};

export default ProjectsShowcase;
