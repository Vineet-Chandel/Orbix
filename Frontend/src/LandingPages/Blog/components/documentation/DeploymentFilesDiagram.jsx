import React from 'react';
import { ArrowRight, ArrowDown, FolderGit2, Server, FileCode2 } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist technical diagram showing the file transfer relationship
 * from the GitHub repository to the EC2 Nginx web directory.
 */
export function DeploymentFilesDiagram() {
  const files = [
    { name: 'index.html', desc: 'page entry point' },
    { name: 'style.css', desc: 'styles' },
    { name: 'script.js', desc: 'page behaviour' },
    { name: 'logo.png', desc: 'image asset' },
    { name: 'background.jpg', desc: 'image asset' },
  ];

  return (
    <div className="my-8">
      {/* 2-Container Diagram with Arrow */}
      <div className="flex flex-col md:flex-row items-center gap-4 relative">
        {/* Container 1: GitHub Repository */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="flex-1 w-full border-2 border-black dark:border-white bg-white dark:bg-zinc-900 p-5 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
              <span className="text-xs font-mono font-bold tracking-wider text-black dark:text-white uppercase">
                GitHub Repository
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#a6ff70] text-black border border-black font-bold uppercase">
              gh-pages branch
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-[#fbfbf9] dark:bg-zinc-800 border border-black shadow-[1.5px_1.5px_0px_#000000]"
              >
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-3.5 h-3.5 text-black dark:text-white shrink-0 stroke-[2.2]" />
                  <span className="font-bold text-black dark:text-white">{file.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-zinc-400">
                  {file.desc}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Directional Arrow: Right on desktop, Down on mobile */}
        <div className="flex flex-col items-center justify-center p-2 shrink-0">
          <div className="hidden md:flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#fde047] px-2 py-0.5 border border-black">
              DEPLOY
            </span>
            <div className="p-2 border-2 border-black bg-white dark:bg-zinc-800 shadow-[2px_2px_0px_#000000]">
              <ArrowRight className="w-5 h-5 stroke-[3] text-black dark:text-white" />
            </div>
          </div>
          <div className="md:hidden flex flex-col items-center gap-1 my-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-black bg-[#fde047] px-2 py-0.5 border border-black">
              DEPLOY
            </span>
            <div className="p-2 border-2 border-black bg-white dark:bg-zinc-800 shadow-[2px_2px_0px_#000000]">
              <ArrowDown className="w-5 h-5 stroke-[3] text-black dark:text-white" />
            </div>
          </div>
        </div>

        {/* Container 2: Amazon EC2 Linux Instance */}
        <motion.div
          whileHover={{ x: -1, y: -1 }}
          className="flex-1 w-full border-2 border-black dark:border-white bg-[#f4f3ee] dark:bg-zinc-900 p-5 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]"
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b-2 border-black dark:border-zinc-800">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
              <span className="text-xs font-mono font-bold tracking-wider text-black dark:text-white uppercase">
                EC2 Web Root
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 bg-[#67e8f9] text-black border border-black font-bold uppercase">
              /usr/share/nginx/html/
            </span>
          </div>

          <div className="space-y-2 font-mono text-xs">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 bg-white dark:bg-zinc-800 border border-black shadow-[1.5px_1.5px_0px_#000000]"
              >
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[#a6ff70] border border-black rounded-full inline-block" />
                  <span className="font-bold text-black dark:text-white">{file.name}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-black dark:text-zinc-300">
                  served on :80
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Helper Note Strip */}
      <div className="mt-4 p-3 bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[3px_3px_0px_#000000] text-xs text-slate-800 dark:text-zinc-200 flex items-start gap-2.5">
        <span className="p-1 bg-[#fde047] border border-black text-black shrink-0 font-bold font-mono text-[10px]">
          RULE
        </span>
        <p className="leading-relaxed">
          Nginx looks for <code className="font-mono font-bold bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black text-black dark:text-white">index.html</code> in <code className="font-mono font-bold bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black text-black dark:text-white">/usr/share/nginx/html/</code> by default. Copying files directly to this folder makes the site immediately available to HTTP visitors.
        </p>
      </div>
    </div>
  );
}
