import React from 'react';
import { ArrowUp, Terminal, CheckCircle2, Globe, Sparkles } from 'lucide-react';
import { NeoButton } from '../ui/NeoButton';

// Direct asset import for Vite bundling, with public URL fallback
import bannerImg from '../../public/assets/image.png';

export function FullWidthBottomBanner({ onNavigate = () => {} }) {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <section
      aria-label="AWS Deployment Architecture Overview Banner"
      className="w-full mt-16 mb-8 border-y-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[0_4px_0px_#000000] dark:shadow-[0_4px_0px_#ffffff]"
    >
      {/* Top Banner Control Bar */}
      <div className="w-full px-4 sm:px-8 py-3.5 bg-[#f4f3ee] dark:bg-zinc-950 border-b-2 border-black dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-1.5 bg-[#a6ff70] text-black border-2 border-black shadow-[2px_2px_0px_#000000] text-xs font-mono font-bold uppercase">
            <Sparkles className="w-4 h-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                Full-Scale AWS Deployment Blueprint
              </span>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 bg-[#a6ff70] text-black border border-black uppercase">
                Architecture Map
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
              Interactive end-to-end cloud pipeline: from Git starter repository to live Nginx server.
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <NeoButton
            variant="white"
            size="sm"
            icon={ArrowUp}
            onClick={scrollToTop}
            aria-label="Scroll to top of document"
          >
            Back to Top
          </NeoButton>
        </div>
      </div>

      {/* Full Width Image Container */}
      <div className="w-full overflow-hidden bg-black flex items-center justify-center">
        <img
          src={bannerImg || '/assets/image.png'}
          alt="AWS Cloud Launchpad Architecture and Deployment Blueprint"
          className="w-full h-auto max-h-[700px] object-cover object-center block"
          loading="lazy"
        />
      </div>

      {/* Bottom Info Strip */}
      <div className="w-full px-4 sm:px-8 py-3 bg-white dark:bg-zinc-900 border-t-2 border-black dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-700 dark:text-zinc-300">
        <div className="flex items-center gap-2 font-mono text-[11px]">
          <span className="w-2 h-2 rounded-full bg-[#a6ff70] border border-black inline-block animate-pulse" />
          <span className="font-bold text-black dark:text-white">EC2 • VPC • NGINX • GIT • SECURITY GROUPS</span>
        </div>
        <span className="text-[11px] text-slate-500 dark:text-zinc-400">
          Source: <code className="font-mono bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black dark:border-zinc-700 text-black dark:text-zinc-200">src/public/assets/image.png</code>
        </span>
      </div>
    </section>
  );
}
