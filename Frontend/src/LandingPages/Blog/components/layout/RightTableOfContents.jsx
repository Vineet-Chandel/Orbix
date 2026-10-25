import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';

/**
 * Neo-Brutalist sticky "On this page" Table of Contents.
 * Styled with 2px solid black border, hard offset drop shadow, and lime-green active markers.
 */
export function RightTableOfContents({ headings = [] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    if (!headings || headings.length === 0) return;

    const handleScroll = () => {
      const scrollPos = window.scrollY + 120;
      const elements = headings
        .map((h) => document.getElementById(h.id))
        .filter(Boolean);

      if (elements.length === 0) return;

      let current = elements[0].id;

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.offsetTop <= scrollPos) {
          current = el.id;
        } else {
          break;
        }
      }

      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 50
      ) {
        current = elements[elements.length - 1].id;
      }

      setActiveId(current);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }, [headings]);

  const handleClick = (e, id) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (target) {
      const topOffset = 80;
      const elementPos = target.getBoundingClientRect().top;
      const offsetPos = elementPos + window.pageYOffset - topOffset;

      window.scrollTo({
        top: offsetPos,
        behavior: 'smooth',
      });

      window.history.pushState(null, '', `#${id}`);
    }
  };

  if (!headings || headings.length === 0) return null;

  return (
    <aside
      aria-label="Table of contents for this page"
      className="hidden xl:block w-56 2xl:w-64 shrink-0 sticky top-20 self-start max-h-[calc(100vh-6rem)] overflow-y-auto mr-4 2xl:mr-8 text-xs custom-scrollbar"
    >
      <div className="bg-white dark:bg-zinc-900 border-2 border-black dark:border-white shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] p-4">
        {/* Header Eyebrow */}
        <div className="flex items-center gap-2 pb-2.5 mb-3 border-b-2 border-black dark:border-zinc-800">
          <Bookmark className="w-3.5 h-3.5 stroke-[2.5] text-black dark:text-white" />
          <span className="font-mono font-bold text-black dark:text-white uppercase tracking-wider text-[11px] select-none">
            ON THIS PAGE
          </span>
        </div>

        {/* Headings List */}
        <nav className="space-y-1">
          {headings.map((item) => {
            const isActive = activeId === item.id;
            const isH3 = item.level === 3;

            return (
              <a
                key={item.id}
                href={`#${item.id}`}
                onClick={(e) => handleClick(e, item.id)}
                className={`block transition-all leading-snug py-1 px-2 border ${
                  isH3 ? 'ml-2 text-[11px]' : 'text-xs'
                } ${
                  isActive
                    ? 'bg-[#a6ff70] text-black border-black font-bold shadow-[2px_2px_0px_#000000]'
                    : 'text-slate-700 dark:text-zinc-300 border-transparent hover:border-black dark:hover:border-zinc-400 hover:bg-[#f4f3ee] dark:hover:bg-zinc-800 hover:text-black dark:hover:text-white'
                }`}
              >
                <span className="truncate block">{item.text}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
