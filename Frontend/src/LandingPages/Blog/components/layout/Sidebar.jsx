import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  CheckCircle2,
  FolderTree,
  ShieldCheck,
  Cloud,
  Server,
  Terminal,
  Globe,
  ShieldAlert,
  Cpu,
  Key,
  Settings,
  UploadCloud,
  ExternalLink,
  AlertTriangle,
  ListChecks,
  Flame,
  Lock,
  DollarSign,
  Compass,
  X,
  FileText,
  ChevronDown,
} from 'lucide-react';
import { WORKBOOK_SECTIONS } from '../../data/navigation';

const ICON_MAP = {
  BookOpen,
  CheckCircle2,
  FolderTree,
  ShieldCheck,
  Cloud,
  Server,
  Terminal,
  Globe,
  ShieldAlert,
  Cpu,
  Key,
  Settings,
  UploadCloud,
  ExternalLink,
  AlertTriangle,
  ListChecks,
  Flame,
  Lock,
  DollarSign,
  Compass,
};

export function Sidebar({
  activePage = 'intro-deployment',
  onSelectPage = () => {},
  isOpen = false,
  onClose = () => {},
}) {
  // Only display sections and items that are fully created
  const activeSections = WORKBOOK_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.status === 'ready'),
  })).filter((section) => section.items.length > 0);

  const totalLessons = activeSections.reduce((acc, sec) => acc + sec.items.length, 0);

  const findSectionTitleForPage = (pageId, sections) => {
    const found = sections.find((sec) => sec.items.some((item) => item.id === pageId));
    return found ? found.title : null;
  };

  // State tracking open section - defaults to the active page's section
  const [expandedSections, setExpandedSections] = useState(() => {
    const initialSec = findSectionTitleForPage(activePage, activeSections);
    return initialSec ? [initialSec] : [];
  });

  // Auto-expand section if activePage changes from external sources (search, hash, next/prev)
  useEffect(() => {
    const currentSec = findSectionTitleForPage(activePage, activeSections);
    if (currentSec) {
      setExpandedSections((prev) => {
        if (prev.includes(currentSec)) return prev;
        return [currentSec];
      });
    }
  }, [activePage]);

  // Close drawer on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent background scroll on mobile drawer
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSectionClick = (section) => {
    const isExpanded = expandedSections.includes(section.title);
    if (isExpanded) {
      setExpandedSections((prev) => prev.filter((t) => t !== section.title));
    } else {
      setExpandedSections([section.title]);
      if (section.items && section.items.length > 0) {
        onSelectPage(section.items[0].id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  const handleItemClick = (id) => {
    onSelectPage(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onClose();
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Neo-Brutalist Sidebar Panel */}
      <aside
        id="global-sidebar"
        aria-label="Global Documentation Navigation"
        className={`fixed top-0 bottom-0 lg:top-14 ${
          isOpen ? 'z-45 translate-x-0 left-0 shadow-[4px_0px_0px_#000000] lg:shadow-none' : 'z-20 -translate-x-full lg:translate-x-0 left-0'
        } w-72 sm:w-80 max-w-[85vw] lg:w-64 xl:w-72 flex flex-col bg-[#fbfbf9] dark:bg-zinc-950 border-r-2 border-black dark:border-white transition-transform duration-200 ease-in-out`}
      >
        {/* Mobile Header in Drawer */}
        <div className="flex items-center justify-between p-3.5 border-b-2 border-black dark:border-zinc-800 bg-[#f4f3ee] dark:bg-zinc-900 lg:hidden">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black inline-block" />
            <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">
              DOCUMENTATION MENU
            </span>
          </div>
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ x: -1, y: -1 }}
            whileTap={{ x: 1, y: 1 }}
            className="p-1.5 border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[2px_2px_0px_#000000] focus:outline-none"
            aria-label="Close navigation menu"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </motion.button>
        </div>

        {/* Scrollable Navigation Groups */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-2.5 custom-scrollbar text-xs">
          {activeSections.map((section, idx) => {
            const isExpanded = expandedSections.includes(section.title);
            const hasActiveItem = section.items.some((item) => item.id === activePage);

            return (
              <div key={idx} className="space-y-1.5">
                {/* Main Section Header Trigger Button */}
                <motion.button
                  type="button"
                  onClick={() => handleSectionClick(section)}
                  whileHover={{ x: -1, y: -1 }}
                  whileTap={{ x: 1.5, y: 1.5 }}
                  aria-expanded={isExpanded}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left transition-all duration-100 select-none group focus:outline-none border-2 border-black dark:border-zinc-700 ${
                    hasActiveItem
                      ? 'bg-black text-white dark:bg-white dark:text-black shadow-[2.5px_2.5px_0px_#a6ff70] font-bold'
                      : isExpanded
                      ? 'bg-white dark:bg-zinc-900 text-black dark:text-white shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] font-bold'
                      : 'bg-white/80 dark:bg-zinc-900/60 text-slate-800 dark:text-zinc-300 hover:bg-[#f4f3ee] dark:hover:bg-zinc-900 hover:text-black dark:hover:text-white shadow-[1.5px_1.5px_0px_#000000]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-1">
                    <span className="text-[11px] font-bold tracking-wider uppercase truncate">
                      {section.title}
                    </span>
                    {section.items.length > 1 && (
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 border border-black font-bold shrink-0 ${
                        hasActiveItem ? 'bg-[#a6ff70] text-black' : 'bg-slate-100 text-black'
                      }`}>
                        {section.items.length}
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    className={`w-3.5 h-3.5 shrink-0 stroke-[2.5] transition-transform duration-200 ${
                      isExpanded ? 'rotate-0' : '-rotate-90'
                    }`}
                  />
                </motion.button>

                {/* Dropdown Sub-sections: visible ONLY when main section is expanded */}
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.15 }}
                      className="pl-2 ml-3 border-l-2 border-black dark:border-zinc-700 space-y-1 my-1 overflow-hidden"
                    >
                      {section.items.map((item) => {
                        const isActive = activePage === item.id;
                        const Icon = ICON_MAP[item.icon] || FileText;

                        return (
                          <motion.button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemClick(item.id)}
                            whileHover={{ x: -1, y: -1 }}
                            whileTap={{ x: 1.5, y: 1.5 }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 text-left transition-colors group relative border-2 ${
                              isActive
                                ? 'bg-[#a6ff70] text-black border-black shadow-[2px_2px_0px_#000000] font-bold'
                                : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-transparent hover:border-black dark:hover:border-white hover:text-black dark:hover:text-white shadow-none hover:shadow-[1.5px_1.5px_0px_#000000]'
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0 pr-1">
                              <Icon
                                className={`w-3.5 h-3.5 shrink-0 stroke-[2.2] ${
                                  isActive
                                    ? 'text-black'
                                    : 'text-slate-500 group-hover:text-black dark:text-zinc-400 dark:group-hover:text-white'
                                }`}
                              />
                              <span className="truncate leading-snug">{item.title}</span>
                            </div>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Neo-Brutalist Sidebar Footer */}
        <div className="p-3 border-t-2 border-black dark:border-white bg-[#f4f3ee] dark:bg-zinc-900 text-[11px] text-black dark:text-zinc-300 flex items-center justify-between font-mono">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="w-2 h-2 bg-[#a6ff70] border border-black inline-block" />
            <span>{totalLessons} LESSONS</span>
          </div>
          <a
            href="https://awswebsite-iota.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            title="AWS Cloud Launchpad live site"
            className="flex items-center gap-1.5 px-2 py-1 border-2 border-black dark:border-white bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] hover:bg-[#a6ff70] hover:text-black dark:hover:bg-[#a6ff70] dark:hover:text-black hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_#000000] transition-all group"
          >
            <img
              src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792898268/android-chrome-512x512_fwlsse.png"
              alt="AWS SBG PSIT"
              className="w-4 h-4 object-contain shrink-0"
            />
            <span className="text-[10px] font-bold tracking-tight">AWS SBG PSIT</span>
          </a>
        </div>
      </aside>
    </>
  );
}
