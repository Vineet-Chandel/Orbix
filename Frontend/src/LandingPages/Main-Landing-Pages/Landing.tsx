import { Link } from 'react-router-dom';
import NavBar from '../NavBar/Landing';
import { Card } from './Card';
import { Platform } from './Platform';
import { Events } from './Events';
import Hero from './Hero/Landing';

export default function MainLanding() {
  return (
    <div className="bg-white text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans p-1 min-h-screen">

      <NavBar />



      <Hero />


      <Platform />

      {/* Flagship Profile Card Showcase: One Card Every Place That Matters (Full Screen) */}
      <section className="w-full my-6 rounded-[40px] sm:rounded-[48px] overflow-hidden shadow-2xl">
        <Card />
      </section>

      {/* Flagship Event Tracker Showcase: Every Contest, One Calendar (Midnight Indigo Theme) */}
      <section className="w-full my-6 rounded-[40px] sm:rounded-[48px] overflow-hidden shadow-2xl">
        <Events />
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