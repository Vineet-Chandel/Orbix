import React from 'react';
import { Flag, CheckCircle2 } from 'lucide-react';

/**
 * The Finish Line callout transformed into Neo-Brutalist card.
 */
export function FinishLineCallout() {
  return (
    <div className="my-8 border-2 border-black dark:border-white bg-[#a6ff70]/15 dark:bg-[#a6ff70]/10 p-5 sm:p-6 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]">
      <div className="flex items-center gap-2 mb-2">
        <span className="p-1 bg-[#a6ff70] text-black border border-black shadow-[1px_1px_0px_#000]">
          <Flag className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
        <span className="text-[10px] sm:text-[11px] font-bold tracking-wider uppercase font-mono bg-[#a6ff70] text-black px-2 py-0.5 border border-black">
          THE FINISH LINE • LEARNING GOAL
        </span>
      </div>
      <p className="text-sm sm:text-base leading-relaxed font-bold text-black dark:text-zinc-100 font-sans mt-2">
        By the end of this workshop, you should be able to publish a static website using{' '}
        <span className="bg-white dark:bg-zinc-800 px-1 border border-black">Amazon EC2</span>,{' '}
        <span className="bg-white dark:bg-zinc-800 px-1 border border-black">Amazon Linux 2023</span>, and{' '}
        <span className="bg-white dark:bg-zinc-800 px-1 border border-black">Nginx</span>;{' '}
        open it through its public URL; diagnose at least one problem; and attempt a second deployment independently.
      </p>
    </div>
  );
}
