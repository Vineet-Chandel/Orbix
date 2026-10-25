import { Suspense, lazy } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../NavBar/Landing';
import Hero from './Hero/Landing';

// Defer heavy below-the-fold showcases for fast initial page load and silky-smooth scrolling
const Card = lazy(() => import('./Card').then((m) => ({ default: m.Card })));
const Platform = lazy(() => import('./Platform').then((m) => ({ default: m.Platform })));
const Events = lazy(() => import('./Events').then((m) => ({ default: m.Events })));
const Leaderboard = lazy(() => import('./Leaderboard').then((m) => ({ default: m.LeaderboardShowcase })));

export default function MainLanding() {
  return (
    <div className="bg-[#FAF6EE] text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans min-h-screen">
      {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
      <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

      <NavBar />

      <Hero />

      <Suspense fallback={<div className="min-h-[480px] flex items-center justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" /></div>}>
        <section className="w-full">
          <Card />
        </section>
      </Suspense>

      <Suspense fallback={<div className="min-h-[500px] flex items-center justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" /></div>}>
        <section className="w-full">
          <Platform />
        </section>
      </Suspense>

      {/* Flagship Event Tracker Showcase: Every Contest, One Calendar */}
      <Suspense fallback={<div className="min-h-[500px] flex items-center justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" /></div>}>
        <section className="w-full">
          <Events />
        </section>
      </Suspense>

      {/* Flagship Leaderboard Showcase: See Where You Really Stand */}
      <Suspense fallback={<div className="min-h-[500px] flex items-center justify-center py-16"><div className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" /></div>}>
        <section className="w-full">
          <Leaderboard />
        </section>
      </Suspense>

      {/* Highlights linking to dedicated subpages */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20 text-slate-900 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          <Link
            to="/customers"
            className="group rounded-3xl border-2 border-black bg-white p-7 shadow-[5px_5px_0px_#000] hover:shadow-[8px_8px_0px_#000] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-black bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-1 rounded-full w-fit inline-block">
                Customers
              </span>
              <h3 className="text-xl font-black text-slate-950 group-hover:text-indigo-600 transition-colors">
                Trusted by 50,000+ engineers worldwide
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                See how teams at fast-growing startups and global enterprises reduce PR cycle times by 68%.
              </p>
            </div>
            <span className="pt-6 text-xs font-black text-slate-950 group-hover:translate-x-1.5 transition-transform inline-flex items-center gap-1.5">
              Read customer stories →
            </span>
          </Link>

          <Link
            to="/pricing"
            className="group rounded-3xl border-2 border-black bg-white p-7 shadow-[5px_5px_0px_#000] hover:shadow-[8px_8px_0px_#000] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-black bg-[#a2ff86] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-1 rounded-full w-fit inline-block">
                Pricing
              </span>
              <h3 className="text-xl font-black text-slate-950 group-hover:text-amber-600 transition-colors">
                Transparent plans with zero lock-in
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                Free for individual developers. Predictable per-seat subscription for growing teams and enterprises.
              </p>
            </div>
            <span className="pt-6 text-xs font-black text-slate-950 group-hover:translate-x-1.5 transition-transform inline-flex items-center gap-1.5">
              View transparent pricing →
            </span>
          </Link>

          <Link
            to="/support"
            className="group rounded-3xl border-2 border-black bg-white p-7 shadow-[5px_5px_0px_#000] hover:shadow-[8px_8px_0px_#000] hover:-translate-y-1 transition-all duration-200 flex flex-col justify-between"
          >
            <div className="space-y-3">
              <span className="text-xs font-black uppercase tracking-wider text-black bg-[#c4b5fd] border-2 border-black shadow-[2px_2px_0px_#000] px-3 py-1 rounded-full w-fit inline-block">
                24/7 Support
              </span>
              <h3 className="text-xl font-black text-slate-950 group-hover:text-emerald-600 transition-colors">
                Dedicated engineering assistance
              </h3>
              <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
                Direct Slack/Discord access, comprehensive SLAs, ticket tracking, and proactive status updates.
              </p>
            </div>
            <span className="pt-6 text-xs font-black text-slate-950 group-hover:translate-x-1.5 transition-transform inline-flex items-center gap-1.5">
              Contact support hub →
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}