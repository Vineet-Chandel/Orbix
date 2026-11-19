import React from 'react';
import { Server, Cpu, FileCode2, Terminal, Globe, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist responsive visual verification sequence:
 * EC2 Running → Nginx Active → Files Present → Local HTTP Success → Public HTTP Success → Browser Displays Website
 */
export function DeploymentVerificationFlow() {
  const steps = [
    { title: 'EC2 Running', icon: Server, badge: 'COMPUTE', badgeBg: 'bg-[#67e8f9]' },
    { title: 'Nginx Active', icon: Cpu, badge: 'DAEMON', badgeBg: 'bg-[#a6ff70]' },
    { title: 'Files Present', icon: FileCode2, badge: 'ASSETS', badgeBg: 'bg-[#fde047]' },
    { title: 'Local HTTP Success', icon: Terminal, badge: 'LOCAL :80', badgeBg: 'bg-[#fb923c]' },
    { title: 'Public HTTP Success', icon: Globe, badge: 'NETWORK :80', badgeBg: 'bg-[#67e8f9]' },
    { title: 'Browser Displays Website', icon: CheckCircle2, badge: 'LIVE VISITOR', badgeBg: 'bg-[#a6ff70]' },
  ];

  return (
    <div className="my-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-stretch relative">
        {steps.map((step, idx) => {
          const Icon = step.icon;

          return (
            <motion.div
              key={idx}
              whileHover={{ x: -2, y: -2, boxShadow: '5px 5px 0px #000000' }}
              className="p-3.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3.5px_3.5px_0px_#000000] dark:shadow-[3.5px_3.5px_0px_#ffffff] flex flex-col justify-between text-center min-h-[95px]"
            >
              <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-black/10 dark:border-zinc-800">
                <span className={`text-[9px] font-mono font-bold tracking-wider uppercase px-1.5 py-0.2 border border-black text-black ${step.badgeBg}`}>
                  {step.badge}
                </span>
                <Icon className="w-3.5 h-3.5 stroke-[2.5] text-black dark:text-white" />
              </div>
              <div className="text-xs font-black text-black dark:text-zinc-100 leading-tight">
                {step.title}
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] font-mono text-slate-600 dark:text-zinc-400 text-center">
        Sequential verification pipeline. Each milestone builds confidence before testing the next layer.
      </p>
    </div>
  );
}
