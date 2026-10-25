import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/Landing';

export default function CustomersPage() {
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
            {/* Ambient Background Grid & Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-gradient-to-b from-indigo-50/70 via-slate-50/40 to-transparent blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-20 right-10 w-[500px] h-[400px] bg-purple-50/60 rounded-full blur-[140px] pointer-events-none -z-10" />

            {/* Global Floating Pill Navigation */}
            <NavBar />

            {/* Main Content Container with top padding for floating navbar */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32">
                {/* Hero Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 tracking-wide uppercase shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Customer Stories & Case Studies</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
                        Loved by developers. <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                            Trusted by engineering leaders.
                        </span>
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed pt-2">
                        Discover how high-velocity software engineering organizations use Orbix to automate code reviews, accelerate PR cycle times, and eliminate delivery friction.
                    </p>

                    <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
                        <button
                            onClick={handleGetStarted}
                            className="h-11 px-6 rounded-full bg-slate-950 text-white font-semibold text-sm hover:bg-slate-800 transition-all shadow-md hover:shadow-lg active:scale-95"
                        >
                            Start free today
                        </button>
                        <Link
                            to="/pricing"
                            className="h-11 px-6 rounded-full bg-white border border-slate-200 text-slate-800 font-semibold text-sm hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
                        >
                            View enterprise pricing
                        </Link>
                    </div>
                </div>

                {/* Key Impact Metrics */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mt-16 sm:mt-20">
                    {[
                        { value: '68%', label: 'Faster PR review cycle times', sub: 'Median drop from 34h to 11h' },
                        { value: '4.2x', label: 'More code shipped per engineer', sub: 'Measured over 180 days' },
                        { value: '99.4%', label: 'Spec and security catch rate', sub: 'Zero compliance escapes' },
                        { value: '500k+', label: 'Daily automated reviews', sub: 'Across 35+ global edge hubs' },
                    ].map((metric, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-200/80 bg-slate-50/50 p-6 sm:p-7 text-center transition-all hover:bg-white hover:shadow-[0_12px_30px_rgba(0,0,0,0.06)]"
                        >
                            <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-950">
                                {metric.value}
                            </div>
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 mt-2">
                                {metric.label}
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-500 mt-1">
                                {metric.sub}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Featured Customer Case Studies */}
                <div className="mt-20 sm:mt-28 space-y-8">
                    <div className="text-left max-w-xl">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                            Real teams. Measurable outcomes.
                        </h2>
                        <p className="text-sm text-slate-600 mt-1">
                            Explore how engineering teams transformed code quality and delivery predictability.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
                        {[
                            {
                                company: 'FinCorp Global',
                                role: 'Series B FinTech • 180 Engineers',
                                quote: 'Orbix cut our PR review backlog by 72% in our very first sprint. Security vulnerabilities are surfaced before staging deployment.',
                                author: 'Sarah Lin',
                                title: 'VP of Platform Engineering',
                                tag: 'Security & Compliance',
                            },
                            {
                                company: 'CloudNexus Infrastructure',
                                role: 'Enterprise Cloud Provider • 450+ Engineers',
                                quote: 'The MCP Server intelligence enables our developers to converse directly with our monorepo telemetry. Cycle time plummeted to sub-2 hours.',
                                author: 'David Martinez',
                                title: 'Chief Architect',
                                tag: 'MCP Intelligence',
                            },
                            {
                                company: 'Veloce AI',
                                role: 'Autonomous Agents Startup • 45 Engineers',
                                quote: 'As an AI startup shipping 40+ production releases daily, Orbix ensures spec mismatches and flaky patterns never reach customers.',
                                author: 'Alex Chen',
                                title: 'Co-founder & CTO',
                                tag: 'High Velocity',
                            },
                        ].map((card, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                            >
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                                            {card.tag}
                                        </span>
                                        <div className="flex text-amber-400 text-xs">
                                            {'★'.repeat(5)}
                                        </div>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                        {card.company}
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        {card.role}
                                    </p>
                                    <p className="text-sm text-slate-700 leading-relaxed italic">
                                        "{card.quote}"
                                    </p>
                                </div>

                                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-900 to-indigo-700 text-white font-bold text-sm flex items-center justify-center shadow-sm">
                                        {card.author.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-xs font-bold text-slate-900">
                                            {card.author}
                                        </div>
                                        <div className="text-[11px] text-slate-500">
                                            {card.title}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom CTA Banner */}
                <div className="mt-20 sm:mt-28 rounded-3xl bg-slate-950 text-white p-8 sm:p-12 text-center relative overflow-hidden shadow-2xl">
                    <div className="max-w-2xl mx-auto space-y-4 relative z-10">
                        <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
                            Elevate your team's code review standard
                        </h2>
                        <p className="text-slate-300 text-xs sm:text-sm max-w-xl mx-auto leading-relaxed">
                            Join thousands of software engineers who ship code faster and with complete confidence using Orbix.
                        </p>
                        <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
                            <button
                                onClick={handleGetStarted}
                                className="h-11 px-7 rounded-full bg-white text-slate-950 font-bold text-sm hover:bg-slate-100 transition-all hover:scale-105 active:scale-95 shadow-lg"
                            >
                                Get Started Free
                            </button>
                            <Link
                                to="/support"
                                className="h-11 px-6 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-sm transition-all border border-white/20"
                            >
                                Contact Sales & Support
                            </Link>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
