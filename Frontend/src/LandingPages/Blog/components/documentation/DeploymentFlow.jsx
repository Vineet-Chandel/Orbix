import React from 'react';
import { ArrowRight, ArrowDown, GitBranch, Server, Cpu, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * 4-stage deployment pipeline transformed into Neo-Brutalist cards.
 */
export function DeploymentFlow() {
  const stages = [
    {
      num: '01',
      tag: 'SOURCE',
      title: 'GitHub repository',
      subtitle: 'index.html + assets',
      icon: GitBranch,
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      num: '02',
      tag: 'COMPUTE',
      title: 'Amazon EC2',
      subtitle: 'Amazon Linux 2023',
      icon: Server,
      badgeBg: 'bg-[#fde047]',
    },
    {
      num: '03',
      tag: 'WEB SERVER',
      title: 'Nginx',
      subtitle: 'Serves files on port 80',
      icon: Cpu,
      badgeBg: 'bg-[#fb923c]',
    },
    {
      num: '04',
      tag: 'VISITOR',
      title: 'Browser + public IP',
      subtitle: 'http://YOUR_PUBLIC_IP',
      icon: Globe,
      badgeBg: 'bg-[#a6ff70]',
    },
  ];

  return (
    <div className="my-8">
      {/* Desktop Horizontal Pipeline / Mobile Vertical Stack */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <motion.div
              key={stage.num}
              whileHover={{ x: -2, y: -2 }}
              className="relative p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-black/20">
                  <span className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 border border-black text-black ${stage.badgeBg}`}>
                    {stage.num} • {stage.tag}
                  </span>
                  <div className="p-1 border border-black bg-[#fbfbf9] text-black">
                    <Icon className="w-4 h-4 stroke-[2.5]" />
                  </div>
                </div>

                <h4 className="text-sm font-black text-black dark:text-white mb-1">
                  {stage.title}
                </h4>
                <p className="text-xs font-mono text-slate-600 dark:text-zinc-400">
                  {stage.subtitle}
                </p>
              </div>

              {/* Connecting indicator badge */}
              <div className="mt-4 pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-mono font-bold text-slate-500">
                <span>STAGE 0{stage.num}</span>
                {index < stages.length - 1 && (
                  <span className="hidden md:inline text-black font-bold">→</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
