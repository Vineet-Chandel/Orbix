import React from 'react';
import {
  Globe,
  ShieldAlert,
  Server,
  Lock,
  ArrowRight,
  ArrowDown,
  Layers,
  KeyRound,
  Info,
} from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist technical diagram of AWS Cloud, VPC, EC2,
 * Security Group, Internet, and IAM.
 */
export function AwsNetworkDiagram() {
  return (
    <div className="my-8 space-y-4">
      {/* Outer AWS Cloud Container */}
      <div className="border-2 border-black dark:border-white bg-[#fbfbf9] dark:bg-zinc-950 p-4 sm:p-6 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff]">
        {/* Cloud Header Badge */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-5 pb-3 border-b-2 border-black dark:border-zinc-800 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#a6ff70] border border-black inline-block shadow-[1px_1px_0px_#000]" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-black dark:text-white">
              AWS CLOUD INFRASTRUCTURE
            </span>
          </div>
          <span className="text-[11px] font-mono font-bold bg-[#f4f3ee] dark:bg-zinc-800 px-2 py-0.5 border border-black dark:border-zinc-700 text-black dark:text-white">
            Region: ap-south-1 (or assigned)
          </span>
        </div>

        {/* Main Grid: Internet, VPC (Security Group + EC2), and IAM */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          
          {/* 1. Outside VPC: Public Internet (3 Cols on Desktop) */}
          <motion.div
            whileHover={{ x: -1, y: -1 }}
            className="lg:col-span-3 flex flex-col justify-between p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold tracking-wider text-black bg-[#a6ff70] px-2 py-0.5 border border-black uppercase">
                  PUBLIC INTERNET
                </span>
                <Globe className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-black text-black dark:text-white mb-1">
                Website Visitors
              </h4>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-snug">
                Requests sent to your server via its public IPv4 address.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-black/20">
              <div className="text-[11px] font-mono font-bold text-black bg-[#f4f3ee] dark:bg-zinc-800 p-2 border border-black break-all text-center shadow-[1.5px_1.5px_0px_#000000]">
                http://YOUR_PUBLIC_IP
              </div>
            </div>
          </motion.div>

          {/* 2. Inside VPC: Logically Isolated Network (6 Cols on Desktop) */}
          <div className="lg:col-span-6 border-2 border-black dark:border-white bg-[#f4f3ee] dark:bg-zinc-900 p-4 sm:p-5 flex flex-col justify-between space-y-4 shadow-[4px_4px_0px_#000000]">
            <div className="flex items-center justify-between pb-2 border-b-2 border-black dark:border-zinc-800">
              <span className="text-xs font-mono font-bold tracking-wider text-black dark:text-white uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
                VPC • ISOLATED NETWORK
              </span>
              <span className="text-[10px] font-mono font-bold bg-[#67e8f9] text-black px-2 py-0.5 border border-black uppercase">
                SUBNET
              </span>
            </div>

            {/* Inner Subnet Layer: Security Group guarding EC2 */}
            <div className="space-y-3">
              {/* Security Group Firewall Bar */}
              <div className="p-3 border-2 border-black dark:border-white bg-[#fde047] text-black shadow-[3px_3px_0px_#000000]">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 stroke-[2.5]" />
                    <span className="font-mono text-xs font-black uppercase tracking-wider">
                      SECURITY GROUP (STATEFUL FIREWALL)
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono font-bold mt-2">
                  <div className="p-1.5 bg-white border border-black flex items-center justify-between">
                    <span>PORT 80 (HTTP)</span>
                    <span className="bg-[#a6ff70] px-1 py-0.2 border border-black text-[10px]">ANYONE (0.0.0.0/0)</span>
                  </div>
                  <div className="p-1.5 bg-white border border-black flex items-center justify-between">
                    <span>PORT 22 (SSH)</span>
                    <span className="bg-[#fb923c] px-1 py-0.2 border border-black text-[10px]">MY IP ONLY</span>
                  </div>
                </div>
              </div>

              {/* EC2 Instance Inner Box */}
              <div className="p-3.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-950 shadow-[3px_3px_0px_#000000]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
                    <span className="text-xs font-bold text-black dark:text-white uppercase tracking-wider">
                      AMAZON EC2 INSTANCE
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-[#a6ff70] text-black px-1.5 py-0.5 border border-black">
                    t2.micro / t3.micro
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 border border-black bg-[#fbfbf9] dark:bg-zinc-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Operating System</div>
                    <div className="font-bold text-black dark:text-white">Amazon Linux 2023</div>
                  </div>
                  <div className="p-2 border border-black bg-[#fbfbf9] dark:bg-zinc-800">
                    <div className="text-[10px] text-slate-500 font-bold uppercase">Web Server</div>
                    <div className="font-bold text-black dark:text-white">Nginx 1.24+ (:80)</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-600 dark:text-zinc-400 font-mono">
              The Security Group filters incoming traffic before packets reach EC2.
            </div>
          </div>

          {/* 3. Security & Governance: IAM (3 Cols on Desktop) */}
          <motion.div
            whileHover={{ x: -1, y: -1 }}
            className="lg:col-span-3 flex flex-col justify-between p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000]"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono font-bold tracking-wider text-black bg-[#fda4af] px-2 py-0.5 border border-black uppercase">
                  IAM IDENTITY
                </span>
                <KeyRound className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
              </div>
              <h4 className="text-sm font-black text-black dark:text-white mb-1">
                Access &amp; Permissions
              </h4>
              <p className="text-xs text-slate-700 dark:text-zinc-300 leading-snug">
                Defines who can launch instances, configure security rules, and view workshop resources.
              </p>
            </div>

            <div className="mt-4 pt-3 border-t-2 border-black/20 space-y-2 font-mono text-[11px]">
              <div className="p-2 border border-black bg-[#fbfbf9] dark:bg-zinc-800">
                <div className="font-bold text-black dark:text-white">Least Privilege</div>
                <div className="text-[10px] text-slate-500">Only needed permissions</div>
              </div>
              <div className="p-2 border border-black bg-[#fbfbf9] dark:bg-zinc-800">
                <div className="font-bold text-black dark:text-white">Key Pairs (.pem)</div>
                <div className="text-[10px] text-slate-500">Private SSH credentials</div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
