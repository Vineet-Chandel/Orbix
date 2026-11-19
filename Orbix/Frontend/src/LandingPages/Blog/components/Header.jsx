import React from 'react';
import { Menu, X, Sun, Moon, Search, Terminal } from 'lucide-react';

/**
 * Clean, sticky header adhering to Apple-inspired minimal design principles.
 */
export function Header({
  onToggleSidebar,
  isSidebarOpen,
  onOpenSearch,
  theme,
  onToggleTheme,
}) {
  return (
    <header className="sticky top-0 z-30 h-14 w-full border-b border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-full items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left Section: Mobile Menu + Logo & Title */}
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 lg:hidden focus:outline-none"
            aria-label={isSidebarOpen ? 'Close navigation sidebar' : 'Open navigation sidebar'}
            aria-expanded={isSidebarOpen}
          >
            {isSidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Brand Mark & Title */}
          <div className="flex items-center gap-2.5">
            {/* Minimal Geometric Brand Mark */}
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 shadow-sm">
              <Terminal className="w-3.5 h-3.5 stroke-[2.5]" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                AWS Cloud Launchpad
              </span>
              <span className="hidden sm:inline-block rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wide text-zinc-500 dark:text-zinc-400 uppercase">
                Deployment Workbook
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Search & Theme Toggle */}
        <div className="flex items-center gap-2">
          {/* Search Trigger Button */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-2 h-8 px-2.5 sm:px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors focus:outline-none"
            aria-label="Search documentation (Press Cmd+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs hidden md:inline text-zinc-400 dark:text-zinc-500">
              Search document...
            </span>
            <kbd className="hidden sm:inline-flex items-center text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-800 px-1 py-0.5 rounded border border-zinc-200 dark:border-zinc-750">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={onToggleTheme}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors focus:outline-none"
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 transition-transform hover:rotate-45" />
            ) : (
              <Moon className="w-4 h-4 transition-transform hover:-rotate-12" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
