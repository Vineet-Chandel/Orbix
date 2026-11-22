import NavBar from '../../NavBar/Landing';
import Hero from '../Hero/Landing';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';
import { DeferredSection as ShowcaseSection } from '../DeferredSection';

const Card = lazyWithRetry(() => import('./Card').then(m => ({ default: m.Card })));
const Platform = lazyWithRetry(() => import('./Platform').then(m => ({ default: m.Platform })));
const Events = lazyWithRetry(() => import('./Events').then(m => ({ default: m.Events })));
const Leaderboard = lazyWithRetry(() => import('./Leaderboard').then(m => ({ default: m.LeaderboardShowcase })));
const Clubs = lazyWithRetry(() => import('./clubs').then(m => ({ default: m.ClubsShowcase })));
const Footer = lazyWithRetry(() => import('../Footer').then(m => ({ default: m.Footer })));

export default function MainLanding() {
  return (
    <div className="bg-[#FAF6EE] text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans min-h-screen">
      {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
      <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

      <NavBar />

      <Hero mode="developer" />

      <ShowcaseSection height={520}>
        <section className="w-full">
          <Card />
        </section>
      </ShowcaseSection>

      <ShowcaseSection height={580}>
        <section className="w-full">
          <Platform />
        </section>
      </ShowcaseSection>

      {/* Flagship Event Tracker Showcase: Every Contest, One Calendar */}
      <ShowcaseSection height={620}>
        <section className="w-full">
          <Events />
        </section>
      </ShowcaseSection>

      {/* Flagship Leaderboard Showcase: See Where You Really Stand */}
      <ShowcaseSection height={640}>
        <section className="w-full">
          <Leaderboard />
        </section>
      </ShowcaseSection>

      {/* Flagship Campus Clubs & National Events Hub Showcase */}
      <ShowcaseSection height={640}>
        <section className="w-full">
          <Clubs />
        </section>
      </ShowcaseSection>

      {/* Flagship Footer with CTA Banner and Full Width Desk Image */}
      <ShowcaseSection height={340}>
        <Footer />
      </ShowcaseSection>
    </div>
  );
}
