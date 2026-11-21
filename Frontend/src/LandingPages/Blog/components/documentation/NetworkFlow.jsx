import React from 'react';
import { ArrowRight, ShieldCheck, Laptop, Globe, Server, Cpu, FileCode2, Terminal, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist visual networking flows for visitor HTTP access and administrator SSH access.
 */
export function NetworkFlow() {
  const visitorSteps = [
    {
      title: "Visitor's Browser",
      detail: "The person enters your website's public URL in their browser address bar.",
      icon: Globe,
      badge: 'REQUEST',
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      title: 'Security Group',
      detail: 'AWS acts as a virtual firewall, checking whether inbound TCP port 80 traffic is permitted.',
      icon: ShieldCheck,
      badge: 'FIREWALL :80',
      badgeBg: 'bg-[#fde047]',
    },
    {
      title: 'EC2 Public IP',
      detail: 'Traffic routes through the public IPv4 address directly into your virtual server.',
      icon: Server,
      badge: 'AWS CLOUD',
      badgeBg: 'bg-[#fda4af]',
    },
    {
      title: 'Nginx',
      detail: 'The web server receives the HTTP request and handles routing.',
      icon: Cpu,
      badge: 'DAEMON',
      badgeBg: 'bg-[#fb923c]',
    },
    {
      title: 'Website Files',
      detail: 'Nginx serves the matching HTML, CSS, and asset files back to the visitor.',
      icon: FileCode2,
      badge: 'RESPONSE',
      badgeBg: 'bg-[#a6ff70]',
    },
  ];

  const adminSteps = [
    {
      title: 'Your Computer',
      detail: 'Local terminal executing the secure shell client (ssh -i key.pem ...).',
      icon: Laptop,
      badge: 'ADMIN CLIENT',
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      title: 'SSH Protocol',
      detail: 'Encrypted tunnel connecting over TCP port 22 using your private key pair.',
      icon: Terminal,
      badge: 'TCP :22 ENCRYPTED',
      badgeBg: 'bg-[#fde047]',
    },
    {
      title: 'EC2 Terminal',
      detail: 'Interactive remote command prompt inside Amazon Linux 2023 with root privileges.',
      icon: Server,
      badge: 'SERVER PROMPT',
      badgeBg: 'bg-[#a6ff70]',
    },
  ];

  return (
    <div className="my-8 space-y-8">
      {/* 1. How Visitors Reach Your Website */}
      <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b-2 border-black gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#a6ff70] px-2 py-0.5 border border-black inline-block mb-1">
              PORT 80 • PUBLIC WEB TRAFFIC
            </span>
            <h3 id="how-visitors-reach-your-website" className="text-lg sm:text-xl font-black text-black dark:text-white scroll-mt-20">
              How Visitors Reach Your Website
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-black dark:text-white">5-STAGE PATH</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mb-6 font-sans">
          When anyone navigates to your EC2 public IPv4 address, the request follows this path:
        </p>

        {/* Visitor 5-Step Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {visitorSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ x: -1, y: -1 }}
                className="p-3.5 border-2 border-black dark:border-zinc-700 bg-[#fbfbf9] dark:bg-zinc-800 shadow-[3px_3px_0px_#000000] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
                    <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 border border-black text-black ${step.badgeBg}`}>
                      {step.badge}
                    </span>
                  </div>
                  <h4 className="text-xs font-bold text-black dark:text-white mb-1">
                    {step.title}
                  </h4>
                  <p className="text-[11px] text-slate-600 dark:text-zinc-400 leading-snug">
                    {step.detail}
                  </p>
                </div>
                <div className="mt-3 pt-1.5 border-t border-black/20 text-[10px] font-mono font-bold text-slate-400">
                  STEP 0{idx + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 2. How You Connect to the Server */}
      <div className="border-2 border-black dark:border-white bg-[#f4f3ee] dark:bg-zinc-900 p-5 sm:p-7 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b-2 border-black gap-2">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#fb923c] px-2 py-0.5 border border-black inline-block mb-1">
              PORT 22 • ADMINISTRATIVE ACCESS
            </span>
            <h3 id="how-you-connect-to-the-server" className="text-lg sm:text-xl font-black text-black dark:text-white scroll-mt-20">
              How You Connect to the Server (SSH)
            </h3>
          </div>
          <span className="text-xs font-mono font-bold text-black dark:text-white">ENCRYPTED TUNNEL</span>
        </div>

        <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mb-6 font-sans">
          You don&apos;t use HTTP to manage the server. Instead, you connect directly to the Linux terminal using SSH:
        </p>

        {/* Admin 3-Step Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {adminSteps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ x: -1, y: -1 }}
                className="p-4 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-[3px_3px_0px_#000000] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Icon className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 border border-black text-black ${step.badgeBg}`}>
                      {step.badge}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-black dark:text-white mb-1">
                    {step.title}
                  </h4>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-snug">
                    {step.detail}
                  </p>
                </div>
                <div className="mt-3 pt-1.5 border-t border-black/20 text-[10px] font-mono font-bold text-slate-400">
                  STAGE 0{idx + 1}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
