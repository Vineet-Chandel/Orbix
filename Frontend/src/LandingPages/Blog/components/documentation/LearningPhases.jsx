import React from 'react';
import { motion } from 'framer-motion';

/**
 * Three connected learning phases transformed into Neo-Brutalist cards.
 */
export function LearningPhases() {
  const phases = [
    {
      num: '01',
      title: 'UNDERSTAND',
      desc: 'Learn the AWS vocabulary, architecture, and prepare your account credentials.',
      tag: 'INTRO + PREREQUISITES',
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      num: '02',
      title: 'DEPLOY',
      desc: 'Launch Amazon EC2, install Nginx via SSH, and copy live website files.',
      tag: 'MENTOR-LED BUILD',
      badgeBg: 'bg-[#fde047]',
    },
    {
      num: '03',
      title: 'PROVE IT',
      desc: 'Verify public IPv4 access, run health checks, and debug network issues.',
      tag: 'CHECK + DEBUG',
      badgeBg: 'bg-[#a6ff70]',
    },
  ];

  return (
    <div className="my-8 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 divide-y-2 md:divide-y-0 md:divide-x-2 divide-black dark:divide-zinc-800">
        {phases.map((phase) => (
          <motion.div
            key={phase.num}
            whileHover={{ backgroundColor: '#f4f3ee' }}
            className="p-5 sm:p-6 flex flex-col justify-between transition-colors bg-white dark:bg-zinc-900"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-bold tracking-wider uppercase font-mono px-2 py-0.5 border border-black text-black ${phase.badgeBg}`}>
                  PHASE {phase.num}
                </span>
                <span className="font-mono text-xs font-bold text-slate-400">0{phase.num}/03</span>
              </div>
              <h4 className="text-base font-black text-black dark:text-white uppercase tracking-tight mb-2">
                {phase.title}
              </h4>
              <p className="text-xs sm:text-sm font-medium text-slate-700 dark:text-zinc-300 leading-relaxed">
                {phase.desc}
              </p>
            </div>
            <div className="mt-5 pt-3 border-t-2 border-black/10 dark:border-zinc-800 text-[10px] font-mono font-bold uppercase tracking-wider text-black dark:text-white flex items-center justify-between">
              <span>{phase.tag}</span>
              <span>→</span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
