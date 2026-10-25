import React from 'react';
import { ChevronRight, Home } from 'lucide-react';

/**
 * Neo-Brutalist clickable breadcrumb navigation.
 */
export function Breadcrumbs({ items = [], onNavigate = () => {} }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs font-mono mb-4 select-none">
      <button
        type="button"
        onClick={() => onNavigate('overview')}
        className="flex items-center gap-1 px-2 py-0.5 border border-black bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[1px_1px_0px_#000000] hover:bg-[#a6ff70] hover:text-black transition-colors focus:outline-none"
      >
        <Home className="w-3 h-3 stroke-[2.5]" />
        <span className="font-bold">HOME</span>
      </button>

      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <React.Fragment key={item.id || index}>
            <ChevronRight className="w-3 h-3 text-black dark:text-zinc-500 stroke-[3] shrink-0" />
            {isLast ? (
              <span className="px-2 py-0.5 border border-black bg-[#a6ff70] text-black font-bold shadow-[1px_1px_0px_#000000] truncate" aria-current="page">
                {item.label}
              </span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                className="px-2 py-0.5 border border-black bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[1px_1px_0px_#000000] hover:bg-slate-100 transition-colors focus:outline-none truncate font-bold"
              >
                {item.label}
              </button>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
