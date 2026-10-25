import React from 'react';
import { Menu, X, Sun, Moon, Search, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';

/**
 * Neo-Brutalist Application Header following the reference UI style.
 * Features 2px solid black border, hard offset drop-shadow, and tactile Framer Motion buttons.
 */
export function AppHeader({
  onToggleSidebar = () => {},
  isSidebarOpen = false,
  onOpenSearch = () => {},
  theme = 'light',
  onToggleTheme = () => {},
  onNavigateHome = () => {},
  hoster = 'AWS SBG PSIT',
  blogName = 'AWS LAUNCHPAD 2026',
}) {
  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b-2 border-black dark:border-white bg-[#fbfbf9]/95 dark:bg-zinc-950/95 backdrop-blur-md shadow-[0_2px_0px_#000000] dark:shadow-[0_2px_0px_#ffffff]">
      <div className="flex h-full items-center justify-between px-3 sm:px-6 lg:px-8 w-full">
        {/* Left Section: Mobile Menu + Neo-Brutalist Brand Logo */}
        <div className="flex items-center gap-2 sm:gap-3">
          <motion.button
            type="button"
            onClick={onToggleSidebar}
            whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0px #000000' }}
            whileTap={{ x: 1, y: 1, boxShadow: '0px 0px 0px #000000' }}
            className="p-1.5 rounded-none border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] lg:hidden focus:outline-none"
            aria-label={isSidebarOpen ? 'Close navigation drawer' : 'Open navigation drawer'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <X className="w-5 h-5 stroke-[2.5]" /> : <Menu className="w-5 h-5 stroke-[2.5]" />}
          </motion.button>

          <motion.button
            type="button"
            onClick={onNavigateHome}
            whileHover={{ x: -1, y: -1 }}
            whileTap={{ x: 1, y: 1 }}
            className="flex items-center gap-2.5 text-left focus:outline-none group select-none"
          >
            <div className="flex h-8 w-8 items-center justify-center border-2 border-black dark:border-white bg-[#a6ff70] text-black shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff]">
              <Terminal className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-sm sm:text-base font-black tracking-tight text-black dark:text-white uppercase font-sans">
                {blogName}
              </span>
              <span className="hidden sm:inline-block border border-black dark:border-white bg-black dark:bg-white px-1.5 py-0.5 text-[10px] font-mono font-bold tracking-wider text-white dark:text-black uppercase shadow-[1.5px_1.5px_0px_#a6ff70]">
                {hoster}
              </span>
            </div>
          </motion.button>
        </div>

        {/* Center: Neo-Brutalist Search Trigger */}
        <div className="flex-1 max-w-md mx-4 hidden md:block">
          <motion.button
            type="button"
            onClick={onOpenSearch}
            whileHover={{ x: -1, y: -1, boxShadow: '3.5px 3.5px 0px #000000' }}
            whileTap={{ x: 2, y: 2, boxShadow: '0px 0px 0px #000000' }}
            className="w-full flex items-center justify-between h-9 px-3 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] text-xs focus:outline-none select-none"
            aria-label="Search documentation"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-black dark:text-white stroke-[2.5]" />
              <span className="font-medium text-slate-700 dark:text-zinc-300">Search workbook topics...</span>
            </div>
            <kbd className="text-[10px] font-mono font-bold bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black dark:border-zinc-700 text-black dark:text-white">
              ⌘K
            </kbd>
          </motion.button>
        </div>

        {/* Right Section: Mobile Search & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Mobile Search Icon */}
          <motion.button
            type="button"
            onClick={onOpenSearch}
            whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0px #000000' }}
            whileTap={{ x: 1, y: 1, boxShadow: '0px 0px 0px #000000' }}
            className="p-1.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white shadow-[2px_2px_0px_#000000] md:hidden focus:outline-none"
            aria-label="Search"
          >
            <Search className="w-4 h-4 stroke-[2.5]" />
          </motion.button>

          {/* Theme Toggle Button */}
          <motion.button
            type="button"
            onClick={onToggleTheme}
            whileHover={{ x: -1, y: -1, boxShadow: '3px 3px 0px #000000' }}
            whileTap={{ x: 1, y: 1, boxShadow: '0px 0px 0px #000000' }}
            className="p-1.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 text-black dark:text-white shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] transition-colors focus:outline-none"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-[#fde047] stroke-[2.5]" />
            ) : (
              <Moon className="w-4 h-4 text-black stroke-[2.5]" />
            )}
          </motion.button>
        </div>
      </div>
    </header>
  );
}
