import React, { Suspense, lazy, useState, useEffect, useRef } from 'react';
import NavBar from '../NavBar/Landing';
import Hero from './Hero/Landing';

// Defer heavy below-the-fold showcases for fast initial page load and silky-smooth scrolling
const Card = lazy(() => import('./Card').then((m) => ({ default: m.Card })));
const Platform = lazy(() => import('./Platform').then((m) => ({ default: m.Platform })));
const Events = lazy(() => import('./Events').then((m) => ({ default: m.Events })));
const Leaderboard = lazy(() => import('./Leaderboard').then((m) => ({ default: m.LeaderboardShowcase })));
const Footer = lazy(() => import('./Footer').then((m) => ({ default: m.Footer })));

/**
 * DeferredSection:
 * Conforms to modern-web-guidance defer-rendering-heavy-content.
 * Delays mounting and downloading heavy below-the-fold component chunks
 * until the user scrolls within 600px of them, and leverages
 * CSS content-visibility: auto with contain-intrinsic-size for 60fps scrolling.
 */
function DeferredSection({
  children,
  fallbackHeight = 600,
}: {
  children: React.ReactNode;
  fallbackHeight?: number;
}) {
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '600px 0px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      style={{
        contentVisibility: 'auto',
        containIntrinsicSize: `auto none auto ${fallbackHeight}px`,
      }}
      className="w-full"
    >
      {isVisible ? (
        <Suspense
          fallback={
            <div
              style={{ minHeight: `${fallbackHeight}px` }}
              className="flex items-center justify-center py-16"
            >
              <div className="w-7 h-7 rounded-full border-2 border-black/20 border-t-black animate-spin" />
            </div>
          }
        >
          {children}
        </Suspense>
      ) : (
        <div style={{ height: `${fallbackHeight}px` }} className="w-full" />
      )}
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

      <DeferredSection fallbackHeight={520}>
        <section className="w-full">
          <Card />
        </section>
      </DeferredSection>

      <DeferredSection fallbackHeight={580}>
        <section className="w-full">
          <Platform />
        </section>
      </DeferredSection>

      {/* Flagship Event Tracker Showcase: Every Contest, One Calendar */}
      <DeferredSection fallbackHeight={620}>
        <section className="w-full">
          <Events />
        </section>
      </DeferredSection>

      {/* Flagship Leaderboard Showcase: See Where You Really Stand */}
      <DeferredSection fallbackHeight={640}>
        <section className="w-full">
          <Leaderboard />
        </section>
      </DeferredSection>

      {/* Flagship Footer with CTA Banner and Full Width Desk Image */}
      <DeferredSection fallbackHeight={340}>
        <Footer />
      </DeferredSection>
    </div>
  );
}
