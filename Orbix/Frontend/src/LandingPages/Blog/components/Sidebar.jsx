import React, { useEffect } from 'react';
import { X, BookOpen, ChevronRight, Hash } from 'lucide-react';

/**
 * Sidebar component supporting nested table of contents,
 * active heading highlighting, smooth jump scrolling, and mobile drawer mode.
 */
export function Sidebar({
  headings = [],
  activeId = '',
  isOpen = false,
  onClose = () => {},
  documentTitle = 'AWS Cloud Launchpad',
  documentSubtitle = 'Deployment Workbook',
}) {
  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when mobile drawer is open
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

  const handleLinkClick = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const topOffset = 80; // Offset for sticky header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // Update URL hash without jumping
      window.history.pushState(null, '', `#${id}`);
    }
    onClose();
  };

  const scrollToTop = (e) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    window.history.pushState(null, '', ' ');
    onClose();
  };

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/50 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="document-sidebar"
        aria-label="Document Navigation"
        className={`fixed top-14 bottom-0 z-40 w-72 sm:w-80 flex flex-col bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0 left-0 shadow-2xl lg:shadow-none' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Document Header / Overview Link */}
        <div className="p-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <button
            type="button"
            onClick={scrollToTop}
            className="flex items-start gap-2.5 text-left group focus:outline-none"
          >
            <div className="p-1.5 rounded-md bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-800 transition-colors">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                {documentSubtitle}
              </div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 group-hover:text-zinc-600 dark:group-hover:text-zinc-300 transition-colors">
                {documentTitle}
              </div>
            </div>
          </button>

          {/* Close button on mobile */}
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 lg:hidden focus:outline-none"
            aria-label="Close navigation sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Table of Contents Header */}
        <div className="px-4 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
          Table of Contents
        </div>

        {/* Scrollable Navigation List */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 text-sm custom-scrollbar">
          {headings.length === 0 ? (
            <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-600 italic">
              No headings found in document.
            </div>
          ) : (
            headings.map((heading) => {
              const isActive = activeId === heading.id;
              const isH1 = heading.level === 1;
              const isH2 = heading.level === 2;
              const isH3 = heading.level === 3;
              const isH4 = heading.level === 4;

              // Compute padding and styles by hierarchy level
              const paddingLeft = isH1
                ? 'pl-3'
                : isH2
                ? 'pl-5'
                : isH3
                ? 'pl-8 text-xs'
                : 'pl-10 text-xs';

              return (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  onClick={(e) => handleLinkClick(e, heading.id)}
                  className={`group relative flex items-center justify-between py-1.5 pr-3 rounded-md transition-all duration-150 ${paddingLeft} ${
                    isActive
                      ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-950 dark:text-zinc-50 font-medium'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
                  }`}
                  aria-current={isActive ? 'location' : undefined}
                >
                  {/* Active Indicator Bar */}
                  {isActive && (
                    <span
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-zinc-900 dark:bg-zinc-100 rounded-r"
                      aria-hidden="true"
                    />
                  )}

                  <span className="truncate pr-2 leading-snug">
                    {heading.text}
                  </span>

                  {isH1 && (
                    <ChevronRight className={`w-3 h-3 text-zinc-400 transition-transform ${isActive ? 'rotate-90 text-zinc-900 dark:text-zinc-100' : 'opacity-0 group-hover:opacity-100'}`} />
                  )}
                </a>
              );
            })
          )}
        </nav>

        {/* Footer info */}
        <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center justify-between">
          <span>{headings.length} sections</span>
          <a
            href="https://awswebsite-iota.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            title="AWS Cloud Launchpad live site"
            className="flex items-center gap-1 font-mono text-[10px] bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 px-1.5 py-0.5 rounded transition-colors text-black dark:text-white"
          >
            <img
              src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792898268/android-chrome-512x512_fwlsse.png"
              alt="AWS SBG PSIT"
              className="w-3.5 h-3.5 object-contain"
            />
            <span>AWS SBG PSIT</span>
          </a>
        </div>
      </aside>
    </>
  );
}
