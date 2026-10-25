import React from 'react';
import { ArrowRight } from 'lucide-react';
import { NeoButton } from '../ui/NeoButton';

/**
 * Neo-Brutalist Route Recap & Next Lesson Navigation
 */
export function NextLessonNav({ onNavigate = () => {} }) {
  return (
    <div className="my-10 space-y-8">
      {/* Section 9: Your Deployment Journey */}
      <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-6 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#fde047] px-2 py-0.5 border border-black inline-block mb-2">
          DEPLOYMENT PIPELINE
        </span>
        <h3 id="your-deployment-journey" className="text-lg font-black text-black dark:text-white mb-2 scroll-mt-20">
          Your Deployment Journey
        </h3>
        {/* Compact final route */}
        <div className="flex flex-wrap items-center gap-2 p-3 my-3 bg-[#fbfbf9] dark:bg-zinc-950 border-2 border-black dark:border-zinc-700 text-xs sm:text-sm font-mono text-black dark:text-zinc-200 font-bold shadow-[2px_2px_0px_#000000]">
          <span className="bg-[#67e8f9] text-black px-1.5 py-0.5 border border-black">GitHub</span>
          <span>→</span>
          <span className="bg-[#fde047] text-black px-1.5 py-0.5 border border-black">Amazon EC2</span>
          <span>→</span>
          <span className="bg-[#fda4af] text-black px-1.5 py-0.5 border border-black">Nginx</span>
          <span>→</span>
          <span className="bg-[#a6ff70] text-black px-1.5 py-0.5 border border-black">Public IPv4 URL</span>
        </div>
        <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-sans">
          This workshop teaches you to serve a static website using Nginx on an EC2 instance. You will publish the files, verify public access, investigate a problem, and practice the process independently.
        </p>
      </div>

      {/* Section 10: Before You Continue / Ready to Begin */}
      <div className="border-t-2 border-black dark:border-zinc-800 pt-8">
        <h3 id="ready-to-begin" className="text-xl sm:text-2xl font-black text-black dark:text-white mb-2 scroll-mt-20">
          Ready to Begin?
        </h3>
        <p className="text-sm sm:text-base text-slate-800 dark:text-zinc-300 leading-relaxed mb-6 font-sans">
          Before launching your virtual server in AWS, verify you have the required local assets ready, understand your account access tier, and ensure your terminal SSH tools are functioning properly.
        </p>

        {/* Next Chapter Navigation Card */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-5 sm:p-6 border-2 border-black dark:border-white bg-[#f4f3ee] dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]">
          <div>
            <div className="text-xs font-mono font-bold uppercase tracking-wider text-black bg-[#a6ff70] px-2 py-0.5 border border-black inline-block mb-1">
              NEXT LESSON • CHAPTER 01
            </div>
            <div className="text-base sm:text-lg font-black text-black dark:text-white">
              Introduction &amp; Prerequisites
            </div>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 font-sans">
              Learn what AWS deployment means, inspect the EC2 architecture, and verify preflight tools.
            </p>
          </div>

          <div className="shrink-0">
            <NeoButton
              variant="primary"
              size="md"
              iconRight={ArrowRight}
              onClick={() => onNavigate('intro-deployment')}
            >
              Start Chapter 01
            </NeoButton>
          </div>
        </div>
      </div>
    </div>
  );
}
