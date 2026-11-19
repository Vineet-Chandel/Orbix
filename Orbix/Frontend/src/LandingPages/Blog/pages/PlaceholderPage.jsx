import React from 'react';
import { Breadcrumbs } from '../components/documentation/Breadcrumbs';
import { Clock, ArrowLeft, BookOpen, AlertCircle } from 'lucide-react';
import { WORKBOOK_SECTIONS } from '../data/navigation';

export function PlaceholderPage({ pageId, onNavigate = () => {} }) {
  // Find item in navigation data
  let currentItem = null;
  let currentSection = null;

  for (const sec of WORKBOOK_SECTIONS) {
    const found = sec.items.find((item) => item.id === pageId);
    if (found) {
      currentItem = found;
      currentSection = sec;
      break;
    }
  }

  const breadcrumbs = [
    { id: 'overview', label: currentSection?.title || 'Documentation' },
    { id: pageId, label: currentItem?.title || 'Upcoming Lesson' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      <Breadcrumbs items={breadcrumbs} onNavigate={onNavigate} />

      {/* Eyebrow */}
      <div className="text-xs font-bold font-mono tracking-wider uppercase text-amber-600 dark:text-amber-500 mb-2 select-none">
        CHAPTER UNDER DEVELOPMENT
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-serif font-bold text-navy-900 dark:text-zinc-50 tracking-tight mb-3">
        {currentItem?.title || 'Upcoming Lesson'}
      </h1>

      {/* Subtitle */}
      <p className="text-base sm:text-lg text-slate-600 dark:text-zinc-400 font-serif italic mb-8">
        {currentItem?.description || 'This chapter will be added in the next release.'}
      </p>

      {/* Development Status Notice */}
      <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-6 sm:p-8 text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-500 dark:text-zinc-400">
          <Clock className="w-6 h-6 stroke-[1.8]" />
        </div>
        <div className="max-w-md mx-auto space-y-2">
          <h2 className="text-base font-bold text-navy-950 dark:text-zinc-100">
            Content Scheduled for Next Phase
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            This module is part of the planned AWS Cloud Launchpad curriculum. The documentation platform is currently configured to showcase the completed <strong>Introduction &amp; Overview</strong> workbook.
          </p>
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={() => onNavigate('overview')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-navy-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-navy-800 dark:hover:bg-white text-xs font-semibold transition-all focus:outline-none shadow-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Introduction / Overview</span>
          </button>
        </div>
      </div>
    </article>
  );
}
