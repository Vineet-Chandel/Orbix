import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/Landing';
import { useAppSelector } from '../../store';

export default function MainLanding() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAppSelector((state) => state.user);

  const handleLaunchWorkspace = () => {
    let storedUser = null;
    try {
      const raw = localStorage.getItem("orbix_user");
      if (raw) storedUser = JSON.parse(raw);
    } catch {}

    const currentUser = user || storedUser;
    if (isAuthenticated || currentUser) {
      navigate("/dashboard");
    } else {
      navigate("/auth/signup");
    }
  };

  return (
    <div className="bg-white text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-hidden font-sans p-1 min-h-screen">
      {/* Ambient background glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[550px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-100/60 via-purple-50/40 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-20 right-1/4 w-[600px] h-[400px] bg-blue-100/40 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Floating Pill NavBar */}
      <NavBar />

      {/* Main Flagship Hero Section */}
      <section className="min-h-[99vh] flex flex-col items-center justify-center text-center px-4 pt-32 pb-20 mx-auto bg-[#07090e] text-white rounded-[40px] sm:rounded-[48px] shadow-2xl relative overflow-hidden ">
        {/* Ambient Dark Glows */}
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-indigo-600/15 blur-[140px] -z-10" />
        <div className="pointer-events-none absolute bottom-0 right-1/4 w-[500px] h-[300px] bg-purple-600/15 blur-[130px] -z-10" />

        <div className="max-w-4xl mx-auto space-y-6 relative z-10">
          <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-white tracking-wide uppercase shadow-sm">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Orbix Autonomous Code Intelligence 2.0</span>
          </div>

          <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-white leading-[1.08]">
            Autonomous Code Reviews & Pull Request Intelligence
          </h1>

          <p className="text-sm sm:text-lg text-neutral-300 max-w-2xl mx-auto leading-relaxed">
            Eliminate review bottlenecks. Detect race conditions, API contract mismatches, and security flaws before your staging pipeline even runs.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3.5 pt-4">
            <button
              onClick={handleLaunchWorkspace}
              className="h-12 px-7 rounded-full bg-white text-neutral-950 font-bold text-sm sm:text-base hover:bg-neutral-100 transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
            >
              <span>Get Started Free</span>
              <span className="text-lg leading-none">→</span>
            </button>
            <Link
              to="/platform"
              className="h-12 px-6 rounded-full bg-white/10 hover:bg-white/15 text-white font-medium text-sm sm:text-base transition-all border border-white/20 flex items-center gap-2"
            >
              <span>Explore Platform</span>
            </Link>
          </div>

          {/* Interactive Live Code Review Preview Window */}
          <div className="mt-14 max-w-3xl mx-auto text-left rounded-2xl border border-white/10 bg-[#0c101a]/90 backdrop-blur-xl shadow-2xl overflow-hidden text-xs sm:text-sm font-mono">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                <span className="ml-2 text-xs text-neutral-400">orbix-agent • PR #142 Analysis</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                AI Checked in 1.4s
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-3 text-neutral-300">
              <div className="text-emerald-400 font-semibold flex items-center gap-2">
                <span>✓</span>
                <span>All 14 integration test suites validated without flakiness</span>
              </div>
              <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs leading-relaxed">
                <span className="font-bold text-indigo-200">Orbix Suggestion:</span> Replaced unbounded query with keyset pagination. Expected database memory allocation reduction: <strong>~42%</strong>.
              </div>
              <div className="text-xs text-neutral-400 flex items-center justify-between pt-1">
                <span>Ready for auto-merge under Team Pro branch policy</span>
                <span className="text-white font-semibold">100% Policy Pass</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights linking to dedicated subpages */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-slate-900">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <Link
            to="/customers"
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full w-fit inline-block">
                Customers
              </span>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                Trusted by 50,000+ engineers worldwide
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                See how teams at fast-growing startups and global enterprises reduce PR cycle times by 68%.
              </p>
            </div>
            <span className="pt-6 text-xs font-bold text-slate-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Read customer stories →
            </span>
          </Link>

          <Link
            to="/pricing"
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full w-fit inline-block">
                Pricing
              </span>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-amber-600 transition-colors">
                Transparent plans with zero lock-in
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Free for individual developers. Predictable per-seat subscription for growing teams and enterprises.
              </p>
            </div>
            <span className="pt-6 text-xs font-bold text-slate-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              View transparent pricing →
            </span>
          </Link>

          <Link
            to="/support"
            className="group rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full w-fit inline-block">
                24/7 Support
              </span>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                Dedicated engineering assistance
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Direct Slack/Discord access, comprehensive SLAs, ticket tracking, and proactive status updates.
              </p>
            </div>
            <span className="pt-6 text-xs font-bold text-slate-900 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
              Contact support hub →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}