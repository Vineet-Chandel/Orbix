import React from 'react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist 120-minute run plan timeline grid.
 */
export function WorkshopTimeline() {
  const items = [
    {
      time: '00–15 MIN',
      tag: 'KICKOFF',
      desc: 'Explain deployment, tools, IAM, networking, and cost awareness.',
      stage: 'START',
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      time: '15–30 MIN',
      tag: 'FILE TOUR',
      desc: 'Open the GitHub repository and identify the website entry files.',
      stage: 'UNDERSTAND',
      badgeBg: 'bg-[#a6ff70]',
    },
    {
      time: '30–65 MIN',
      tag: 'BUILD',
      desc: 'Launch EC2, connect to it, install Nginx, and publish the website files.',
      stage: 'DEPLOY',
      badgeBg: 'bg-[#fde047]',
    },
    {
      time: '65–75 MIN',
      tag: 'VERIFY',
      desc: 'Check Nginx, HTTP status, and the public website URL.',
      stage: 'PROVE IT',
      badgeBg: 'bg-[#a6ff70]',
    },
    {
      time: '75–105 MIN',
      tag: 'CHALLENGE',
      desc: 'Deploy a second project independently, using hints rather than a command-by-command walkthrough.',
      stage: 'PRACTICE',
      badgeBg: 'bg-[#fb923c]',
    },
    {
      time: '105–120 MIN',
      tag: 'WRAP',
      desc: 'Discuss troubleshooting, safe resource cleanup, and further learning.',
      stage: 'FINISH',
      badgeBg: 'bg-[#fda4af]',
    },
  ];

  return (
    <div className="my-8">
      {/* Timeline Grid Container */}
      <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y-2 sm:divide-y-0 divide-black dark:divide-zinc-800 sm:[&>*:not(:nth-child(-n+3))]:border-t-2 sm:[&>*:not(:nth-child(-n+3))]:border-black dark:sm:[&>*:not(:nth-child(-n+3))]:border-zinc-800 lg:[&>*:not(:nth-child(3n+1))]:border-l-2 lg:[&>*:not(:nth-child(3n+1))]:border-black dark:lg:[&>*:not(:nth-child(3n+1))]:border-zinc-800">
          {items.map((item, index) => (
            <motion.div
              key={index}
              whileHover={{ backgroundColor: '#f4f3ee' }}
              className="p-4 sm:p-5 flex flex-col justify-between transition-colors bg-white dark:bg-zinc-900"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-[10px] font-bold tracking-wider font-mono uppercase px-2 py-0.5 border border-black text-black ${item.badgeBg}`}>
                    {item.time} • {item.tag}
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-400">0{index + 1}</span>
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-zinc-200 leading-relaxed mt-2">
                  {item.desc}
                </p>
              </div>

              <div className="mt-4 pt-2 border-t border-black/10 text-[10px] font-mono font-bold uppercase tracking-wider text-black dark:text-zinc-400 flex items-center justify-between">
                <span>{item.stage}</span>
                <span>→</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
