import React, { useState } from 'react';
import { Terminal, Copy, Check } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist terminal command panel supporting environment distinction
 * and tactile Framer Motion clipboard copying.
 */
export function TerminalPanel({
  label = 'TERMINAL',
  commands = '',
  description = null,
  isLaptop = false,
  isSsh = false,
  className = '',
}) {
  const [copied, setCopied] = useState(false);

  const commandText = Array.isArray(commands) ? commands.join('\n') : String(commands).trim();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(commandText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy command:', err);
    }
  };

  let badgeBg = 'bg-[#fde047] text-black';
  if (isLaptop) {
    badgeBg = 'bg-[#67e8f9] text-black';
  } else if (isSsh) {
    badgeBg = 'bg-[#a6ff70] text-black';
  }

  return (
    <div
      className={`border-2 border-black dark:border-white bg-[#0e0f12] text-slate-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] my-6 overflow-hidden ${className}`}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-black border-b-2 border-black dark:border-zinc-800 text-xs">
        <div className="flex items-center gap-2 min-w-0 pr-2">
          <Terminal className="w-3.5 h-3.5 shrink-0 text-[#a6ff70] stroke-[2.5]" />
          <span
            className={`font-mono text-[10px] sm:text-[11px] uppercase font-bold tracking-wider px-2 py-0.5 border border-black truncate ${badgeBg}`}
          >
            {label}
          </span>
        </div>

        <motion.button
          type="button"
          onClick={handleCopy}
          whileHover={{ x: -1, y: -1 }}
          whileTap={{ x: 1, y: 1 }}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-bold border-2 border-black transition-colors focus:outline-none shrink-0 ${
            copied
              ? 'bg-[#a6ff70] text-black shadow-[1.5px_1.5px_0px_#000000]'
              : 'bg-white text-black shadow-[2px_2px_0px_#000000] hover:bg-slate-100'
          }`}
          aria-label={copied ? 'Commands copied to clipboard' : 'Copy terminal commands'}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 stroke-[3]" />
              <span>COPIED!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3 stroke-[2.5]" />
              <span>COPY</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Terminal Command Content */}
      <div className="p-4 font-mono text-xs sm:text-[13px] leading-relaxed overflow-x-auto custom-scrollbar bg-[#090a0d]">
        <pre className="m-0 p-0 bg-transparent text-[#a6ff70] whitespace-pre font-semibold">
          {commandText}
        </pre>
      </div>

      {/* Optional helper note below commands */}
      {description && (
        <div className="px-4 py-2 bg-[#18191f] border-t-2 border-black dark:border-zinc-800 text-[11px] font-mono text-slate-300">
          {description}
        </div>
      )}
    </div>
  );
}
