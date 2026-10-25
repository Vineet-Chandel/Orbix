import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist bottom pagination for navigating between sequential workbook pages.
 * Powered by Framer Motion for tactile button pressing.
 */
export function ChapterPagination({
  prev = null,
  next = null,
  onNavigate = () => {},
}) {
  return (
    <div className="mt-12 pt-8 border-t-2 border-black dark:border-white flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
      {/* Previous Page Link */}
      {prev ? (
        <motion.button
          type="button"
          onClick={() => onNavigate(prev.id)}
          whileHover={{ x: -1, y: -1, boxShadow: '5px 5px 0px #000000' }}
          whileTap={{ x: 2, y: 2, boxShadow: '0px 0px 0px #000000' }}
          className="flex-1 flex items-start gap-3 p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-left transition-colors group focus:outline-none shadow-[3.5px_3.5px_0px_#000000] dark:shadow-[3.5px_3.5px_0px_#ffffff]"
        >
          <div className="p-2 border-2 border-black bg-[#f4f3ee] dark:bg-zinc-800 text-black dark:text-white mt-0.5 shrink-0">
            <ArrowLeft className="w-4 h-4 stroke-[3]" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400 block mb-0.5">
              PREVIOUS {prev.pageLabel ? `• ${prev.pageLabel}` : ''}
            </span>
            <span className="text-sm font-black text-black dark:text-white line-clamp-1">
              {prev.title}
            </span>
          </div>
        </motion.button>
      ) : (
        <div className="flex-1 hidden sm:block" />
      )}

      {/* Next Page Link - Vibrant Lime Green CTA */}
      {next && (
        <motion.button
          type="button"
          onClick={() => onNavigate(next.id)}
          whileHover={{ x: -1, y: -1, boxShadow: '5px 5px 0px #000000' }}
          whileTap={{ x: 2, y: 2, boxShadow: '0px 0px 0px #000000' }}
          className="flex-1 flex items-start justify-between gap-3 p-4 border-2 border-black dark:border-white bg-[#a6ff70] text-black text-right transition-colors group focus:outline-none shadow-[3.5px_3.5px_0px_#000000] dark:shadow-[3.5px_3.5px_0px_#ffffff]"
        >
          <div className="min-w-0 flex-1">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-black/80 block mb-0.5">
              NEXT LESSON {next.pageLabel ? `• ${next.pageLabel}` : ''}
            </span>
            <span className="text-sm font-black text-black line-clamp-1">
              {next.title}
            </span>
          </div>
          <div className="p-2 border-2 border-black bg-black text-white mt-0.5 shrink-0 shadow-[1px_1px_0px_#ffffff]">
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </div>
        </motion.button>
      )}
    </div>
  );
}
