import React from 'react';
import NavBar from '../NavBar/Landing';
import Hero from './Hero/Landing';
import { Card } from './Card';
import { Platform } from './Platform';
import { Events } from './Events';
import { LeaderboardShowcase as Leaderboard } from './Leaderboard';
import { ProjectsShowcase as Projects } from './Projects';
import { ClubsShowcase as Clubs } from './clubs';
import { Footer } from './Footer';

/**
 * Optimized Showcase Section:
 * Renders immediately with dummy data for instantaneous UX with zero spinner delays.
 * Uses CSS content-visibility: auto with contain-intrinsic-size for smooth 60fps scrolling.
 */
function ShowcaseSection({
  children,
  fallbackHeight = 600,
}: {
  children: React.ReactNode;
  fallbackHeight?: number;
}) {
  return (
    <div
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `auto none auto ${fallbackHeight}px`,
      }}
      className="w-full"
    >
      {children}
    </div>
  );
}

export default function MainLanding() {
  return (
    <div className="bg-[#FAF6EE] text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans min-h-screen">
      {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
      <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

      <NavBar />

      <Hero />

      <ShowcaseSection fallbackHeight={520}>
        <section className="w-full">
          <Card />
        </section>
      </ShowcaseSection>

      <ShowcaseSection fallbackHeight={580}>
        <section className="w-full">
          <Platform />
        </section>
      </ShowcaseSection>

      {/* Flagship Event Tracker Showcase: Every Contest, One Calendar */}
      <ShowcaseSection fallbackHeight={620}>
        <section className="w-full">
          <Events />
        </section>
      </ShowcaseSection>

      {/* Flagship Leaderboard Showcase: See Where You Really Stand */}
      <ShowcaseSection fallbackHeight={640}>
        <section className="w-full">
          <Leaderboard />
        </section>
      </ShowcaseSection>

      {/* Flagship Projects Showcase: Curate Your Top 4 Engineering Architectures */}
      <ShowcaseSection fallbackHeight={680}>
        <section className="w-full">
          <Projects />
        </section>
      </ShowcaseSection>

      {/* Flagship Campus Clubs & National Events Hub Showcase */}
      <ShowcaseSection fallbackHeight={640}>
        <section className="w-full">
          <Clubs />
        </section>
      </ShowcaseSection>

      {/* Flagship Footer with CTA Banner and Full Width Desk Image */}
      <ShowcaseSection fallbackHeight={340}>
        <Footer />
      </ShowcaseSection>
    </div>
  );
}
