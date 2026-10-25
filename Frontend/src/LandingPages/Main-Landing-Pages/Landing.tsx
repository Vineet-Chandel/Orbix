import { Suspense, lazy } from 'react';
import NavBar from '../NavBar/Landing';
import Hero from './Hero/Landing';

// Defer heavy below-the-fold showcases for fast initial page load and silky-smooth scrolling
const Card = lazy(() => import('./Card').then((m) => ({ default: m.Card })));
const Platform = lazy(() => import('./Platform').then((m) => ({ default: m.Platform })));
const Events = lazy(() => import('./Events').then((m) => ({ default: m.Events })));
const Leaderboard = lazy(() => import('./Leaderboard').then((m) => ({ default: m.LeaderboardShowcase })));
const Footer = lazy(() => import('./Footer').then((m) => ({ default: m.Footer })));

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

      {/* Flagship Footer with CTA Banner and Full Width Desk Image */}
      <Suspense fallback={<div className="min-h-[200px]" />}>
        <Footer />
      </Suspense>
    </div>
  );
}