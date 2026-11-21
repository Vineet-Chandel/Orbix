import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/Landing';

export default function PlatformPage() {
    const navigate = useNavigate();

    const handleGetStarted = () => {
        const user = localStorage.getItem("orbix_user");
        if (user) {
            navigate("/dashboard");
        } else {
            navigate("/auth/signup");
        }
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-indigo-50/70 via-slate-50/40 to-transparent blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-32 right-10 w-[550px] h-[450px] bg-sky-50/60 rounded-full blur-[140px] pointer-events-none -z-10" />

            {/* Global Floating Pill Navigation */}
            <NavBar />

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 tracking-wide uppercase shadow-sm">
                        <span>The Modern Software Factory</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
                        Complete intelligence across the entire delivery lifecycle
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed pt-2">
                        Unify automated AI code reviews, Model Context Protocol server intelligence, and developer experience metrics into one unified, real-time command plane.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
                        <button
                            onClick={handleGetStarted}
                            className="h-11 px-6 rounded-full bg-slate-950 text-white font-semibold text-sm hover:bg-slate-800 transition-all shadow-md active:scale-95"
                        >
                            Explore in workspace
                        </button>
                        <Link
                            to="/pricing"
                            className="h-11 px-6 rounded-full bg-white border border-slate-200 text-slate-800 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            Compare editions
                        </Link>
                    </div>
                </div>

                {/* 4 Core Pillars of Orbix */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-16 sm:mt-24">
                    {[
                        {
                            title: 'Autonomous AI Code Reviews',
                            tag: 'Precision & Speed',
                            desc: 'Orbix inspects every pull request across multi-layer static analysis and fine-tuned AST models, detecting deep architectural flaws, race conditions, and compliance risks within seconds.',
                            highlights: ['Zero false-positive policy filters', 'Deterministic spec contract checking', 'GitHub & GitLab native line comments'],
                        },
                        {
                            title: 'Model Context Protocol (MCP) Server',
                            tag: 'Telemetry & Insights',
                            desc: 'Query your codebase, build artifacts, test runs, and performance traces directly via standard MCP clients like Claude, Cursor, and IDE extensions.',
                            highlights: ['Real-time context streaming', 'Custom security permission scopes', 'Audit-ready telemetry history'],
                        },
                        {
                            title: 'Automated PR Routing & Branch Policies',
                            tag: 'DevOps Automation',
                            desc: 'Route pull requests intelligently to domain specialists based on code modifications, test delta risks, and velocity targets without manual bottlenecking.',
                            highlights: ['Dynamic code owner assignments', 'Automatic safe branch merges', 'CI flakiness mitigation'],
                        },
                        {
                            title: 'Engineering Velocity & Investment Metrics',
                            tag: 'Predictable Delivery',
                            desc: 'Understand where your team invests time and resources. Capitalize engineering costs with audit-ready documentation and track cycle-time bottlenecks objectively.',
                            highlights: ['Cycle time & throughput analytics', 'Automated cost capitalization', 'Team sentiment & friction signals'],
                        },
                    ].map((pillar, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-200 bg-white p-8 sm:p-9 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                        >
                            <div className="space-y-4">
                                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded-full w-fit inline-block">
                                    {pillar.tag}
                                </span>
                                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                                    {pillar.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    {pillar.desc}
                                </p>
                                <ul className="space-y-2 pt-2 text-xs text-slate-700">
                                    {pillar.highlights.map((h, hi) => (
                                        <li key={hi} className="flex items-center gap-2">
                                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                                            <span>{h}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
}
