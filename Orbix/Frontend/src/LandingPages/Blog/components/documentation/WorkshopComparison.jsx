import React from 'react';
import { Check, X, Info } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist two-column comparison clarifying what the workshop uses and doesn't.
 */
export function WorkshopComparison() {
  const whatWeUse = [
    'GitHub repository containing static website files',
    'Amazon EC2 for the virtual server',
    'Amazon Linux 2023 as the operating system',
    'Nginx as the web server daemon',
    'A public IPv4 address for browser access',
  ];

  const whatWeDontNeed = [
    'A database (RDS, DynamoDB, or MySQL)',
    'A Node.js server runtime process on EC2',
    'A backend API or Python/Ruby/Java application server',
    'A server-side frontend framework running on the host',
  ];

  return (
    <div className="my-8">
      <h3 id="what-this-workshop-uses" className="text-xl sm:text-2xl font-black text-black dark:text-white mb-3 scroll-mt-20">
        What This Workshop Uses — and What It Doesn&apos;t
      </h3>
      <p className="text-sm sm:text-base text-slate-800 dark:text-zinc-300 leading-relaxed mb-6 font-sans">
        Keeping your mental model clean is critical when learning the cloud. Because we are deploying a static website, our server requirements are intentionally lean:
      </p>

      {/* 2-Column Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* What We Use */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-[#a6ff70]/10 p-5 sm:p-6 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]"
        >
          <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black">
            <span className="p-1 bg-[#a6ff70] border border-black text-black">
              <Check className="w-4 h-4 stroke-[3]" />
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white font-mono bg-[#a6ff70] px-2 py-0.5 border border-black">
              WHAT WE USE
            </h4>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-black dark:text-zinc-200 font-medium">
            {whatWeUse.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-black dark:bg-[#a6ff70] border border-black rounded-full shrink-0 mt-1.5" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* What We Don't Need */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="border-2 border-black dark:border-white bg-[#fbfbf9] dark:bg-zinc-900 p-5 sm:p-6 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]"
        >
          <div className="flex items-center gap-2 mb-4 pb-2 border-b-2 border-black">
            <span className="p-1 bg-[#fda4af] border border-black text-black">
              <X className="w-4 h-4 stroke-[3]" />
            </span>
            <h4 className="text-xs font-bold uppercase tracking-wider text-black dark:text-white font-mono bg-[#fda4af] px-2 py-0.5 border border-black">
              WHAT WE DON&apos;T NEED
            </h4>
          </div>
          <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 font-medium">
            {whatWeDontNeed.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-1.5 h-1.5 bg-[#fda4af] border border-black rounded-full shrink-0 mt-1.5" />
                <span className="leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Static Note */}
      <div className="p-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white text-xs text-slate-800 dark:text-zinc-200 shadow-[3px_3px_0px_#000000] flex items-center gap-2.5">
        <span className="px-1.5 py-0.5 bg-[#fde047] text-black border border-black font-mono font-bold text-[10px]">
          TIP
        </span>
        <p className="leading-relaxed">
          Static files (HTML, CSS, JS, images) are served directly off the EC2 disk by Nginx — no running backend framework required.
        </p>
      </div>
    </div>
  );
}
