import { PublicClubDirectory } from "../../../seo/PublicClubDirectory";
import type { PageData } from "../../../../../shared/seo/metadata";
import NavBar from '../../NavBar/Landing';
import Hero from '../Hero/Landing';
import { lazyWithRetry } from '../../../utils/lazyWithRetry';
import { DeferredSection as ShowcaseSection } from '../DeferredSection';
const ClubEcosystemShowcase = lazyWithRetry(() => import('./ClubEcosystem').then(m => ({ default: m.ClubEcosystemShowcase })));
const Footer = lazyWithRetry(() => import('../Footer').then(m => ({ default: m.Footer })));

export default function ClubLanding({ initialData }: { initialData?: PageData }) {
  return (
    <div className="bg-[#FAF6EE] text-slate-900 selection:bg-slate-900 selection:text-white relative overflow-x-clip font-sans min-h-screen">
      {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
      <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

      {/* Main Navigation Bar */}
      <NavBar />

      {/* Hero Section */}
      <Hero mode="club" />

      {/* Flagship Club Operating System Showcase */}
      <ShowcaseSection height={580}>
        <section className="w-full">
          <ClubEcosystemShowcase />
        </section>
      </ShowcaseSection>

      <PublicClubDirectory initialData={initialData} />

      {/* Flagship Footer with CTA Banner and Desk Image */}
      <ShowcaseSection height={340}>
        <Footer />
      </ShowcaseSection>
    </div>
  );
}
