import React from 'react';
import { ArrowDown, CheckCircle2, XCircle, Terminal, Globe } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist responsive layered debugging flowchart:
 * 1. Initial symptom: Website does not load
 * 2. Diagnostic decision: Run `curl -I http://localhost`
 * 3. Two branches:
 *    - Green (YES — local request works): Focus on Public IP, Security Group, Route Table, IGW.
 *    - Red (NO — local request fails): Focus on Nginx status, error logs, config, web root files.
 */
export function DebuggingFlowchart() {
  return (
    <div className="my-8 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5 sm:p-7 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff]">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b-2 border-black dark:border-zinc-800 gap-2">
        <div>
          <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-black bg-[#fde047] px-2 py-0.5 border border-black inline-block mb-1">
            DIAGNOSTIC WORKFLOW
          </span>
          <h3 className="text-base sm:text-xl font-black text-black dark:text-white tracking-tight">
            Two-Branch Diagnostic Flowchart
          </h3>
        </div>
        <span className="text-[10px] font-mono font-bold px-2.5 py-1 bg-black text-white dark:bg-white dark:text-black border border-black uppercase tracking-wider">
          SYSTEMATIC ISOLATION
        </span>
      </div>

      <div className="flex flex-col items-center max-w-2xl mx-auto">
        {/* Step 1: Initial Symptom */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="w-full sm:w-80 p-4 border-2 border-black dark:border-white bg-[#fbfbf9] dark:bg-zinc-800 text-center shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Globe className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-black dark:text-white">
              OBSERVED SYMPTOM
            </span>
          </div>
          <div className="text-base font-black text-black dark:text-white">
            Website does not load
          </div>
          <p className="text-[11px] text-slate-600 dark:text-zinc-400 mt-1 font-mono">
            Browser shows connection timeout, connection refused, or infinite loading.
          </p>
        </motion.div>

        {/* Downward Connector */}
        <div className="flex flex-col items-center my-2 text-black dark:text-white select-none">
          <div className="w-0.5 h-6 bg-black dark:bg-white" />
          <ArrowDown className="w-4 h-4 -mt-1 stroke-[3]" />
        </div>

        {/* Step 2: Diagnostic Isolation Step */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="w-full sm:w-96 p-4 border-2 border-black dark:border-white bg-[#fde047] text-black text-center shadow-[4px_4px_0px_#000000]"
        >
          <div className="flex items-center justify-center gap-2 mb-1">
            <Terminal className="w-4 h-4 stroke-[2.5]" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-black">
              ISOLATION CHECK (RUN ON EC2)
            </span>
          </div>
          <div className="font-mono text-xs sm:text-sm font-bold text-black bg-white py-1.5 px-3 border-2 border-black my-1 inline-block shadow-[1.5px_1.5px_0px_#000000]">
            curl -I http://localhost
          </div>
          <div className="text-xs font-bold italic mt-1 text-black">
            "Does the server answer locally?"
          </div>
        </motion.div>

        {/* Branch Split Connectors */}
        <div className="w-full relative mt-3 mb-2 hidden md:block">
          <div className="h-0.5 bg-black dark:bg-white w-3/4 mx-auto" />
          <div className="flex justify-between w-3/4 mx-auto">
            <div className="w-0.5 h-6 bg-black dark:bg-white -mt-0.5" />
            <div className="w-0.5 h-6 bg-black dark:bg-white -mt-0.5" />
          </div>
        </div>

        {/* Two Branches: Green (YES) and Red (NO) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mt-2">
          {/* Branch A: Green (YES) */}
          <div className="p-4 border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-black dark:text-[#a6ff70] stroke-[2.5] shrink-0" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-black dark:text-white bg-[#a6ff70] px-1.5 py-0.5 border border-black">
                  YES — LOCAL REQUEST WORKS
                </span>
              </div>
              <p className="text-xs font-bold text-black dark:text-white mb-2">
                Nginx is running and serving files internally.
              </p>
              <div className="p-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 text-xs text-slate-800 dark:text-zinc-200 space-y-1.5 shadow-[2px_2px_0px_#000000]">
                <div className="font-bold text-black dark:text-white text-[11px] uppercase tracking-wide font-mono">
                  Next Diagnostic Focus: Public Network
                </div>
                <p className="leading-relaxed text-[11px]">
                  Check the <strong>Public IPv4 address</strong>, verify <strong>Inbound Security Group port 80</strong> allows traffic from <code className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 border border-black">0.0.0.0/0</code>, and confirm subnet <strong>Route Table</strong> routes to an <strong>Internet Gateway</strong>.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-black/30 text-[11px] font-mono text-black dark:text-zinc-300 font-medium">
              Note: Do not modify website HTML; the server already serves it locally.
            </div>
          </div>

          {/* Branch B: Red (NO) */}
          <div className="p-4 border-2 border-black dark:border-white bg-[#fda4af]/20 dark:bg-[#fda4af]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="w-5 h-5 text-black dark:text-[#fda4af] stroke-[2.5] shrink-0" />
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-black dark:text-white bg-[#fda4af] px-1.5 py-0.5 border border-black">
                  NO — LOCAL REQUEST FAILS
                </span>
              </div>
              <p className="text-xs font-bold text-black dark:text-white mb-2">
                Nginx is stopped, crashing, or misconfigured.
              </p>
              <div className="p-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-zinc-700 text-xs text-slate-800 dark:text-zinc-200 space-y-1.5 shadow-[2px_2px_0px_#000000]">
                <div className="font-bold text-black dark:text-white text-[11px] uppercase tracking-wide font-mono">
                  Next Diagnostic Focus: Internal Web Server
                </div>
                <p className="leading-relaxed text-[11px]">
                  Check <code className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 border border-black">systemctl status nginx</code>, examine error logs with <code className="font-mono text-[10px] bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 border border-black">sudo journalctl -u nginx</code>, and verify web root directory permissions.
                </p>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-black/30 text-[11px] font-mono text-black dark:text-zinc-300 font-medium">
              Rule: If curl fails locally, fixing Security Groups will NOT resolve it.
            </div>
          </div>
        </div>

        {/* Closing Rule Banner */}
        <div className="w-full mt-4 p-3 bg-black text-white dark:bg-white dark:text-black border-2 border-black text-center font-mono text-xs font-bold uppercase tracking-wide shadow-[3px_3px_0px_#a6ff70]">
          IF THE LOCAL SERVER RESPONDS BUT THE PUBLIC URL DOES NOT, START WITH NETWORKING — NOT THE HTML.
        </div>
      </div>
    </div>
  );
}
