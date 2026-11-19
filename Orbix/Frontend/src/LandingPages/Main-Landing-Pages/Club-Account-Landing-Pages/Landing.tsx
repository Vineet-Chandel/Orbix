import React from 'react';
import NavBar from '../../NavBar/Landing';
import Hero from '../Hero/Landing';
import { Footer } from '../Footer';

/**
 * Optimized Showcase Section Wrapper
 */
function ShowcaseSection({
  children,
}: {
  children: React.ReactNode;
  fallbackHeight?: number;
}) {
  return (
    <div className="w-full">
      {children}
    </div>
  );
}

/**
 * Club Account Landing Page (/clubs)
 * Authoritative public landing page from the university & campus clubs' perspective.
 */
export default function ClubLanding() {
  return (
    <div className="bg-[#FAF6EE] text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans min-h-screen">
      {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
      <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

      {/* Main Navigation Bar */}
      <NavBar />

      {/* Hero Section */}
      <Hero mode="club" />

      {/* Future Club Perspective Showcases will be plugged in here */}

      {/* Flagship Footer with CTA Banner and Desk Image */}
      <ShowcaseSection fallbackHeight={340}>
        <Footer />
      </ShowcaseSection>
    </div>
  );
}
