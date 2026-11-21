import React from 'react';
import { Breadcrumbs } from './Breadcrumbs';

/**
 * Neo-Brutalist standard chapter header.
 * Displays crisp chapter badge, breadcrumbs, bold sans title, and introductory text.
 */
export function ChapterHeader({
  chapterNumber = '01',
  chapterTitle = 'INTRODUCTION & PREREQUISITES',
  pageNumber = 1,
  totalPages = 4,
  title,
  intro,
  breadcrumbItems = [],
  onNavigate = () => {},
}) {
  return (
    <header className="mb-10">
      <Breadcrumbs items={breadcrumbItems} onNavigate={onNavigate} />

      {/* Chapter Indicator Badge */}
      <div className="flex flex-wrap items-center gap-2 mb-3 select-none">
        <span className="text-xs font-mono font-bold tracking-wider uppercase text-black bg-[#fde047] px-2.5 py-1 border-2 border-black shadow-[2px_2px_0px_#000000]">
          {chapterNumber} / {chapterTitle}
        </span>
        {totalPages && totalPages > 1 && (
          <span className="text-xs font-mono font-bold px-2 py-1 border-2 border-black bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[1.5px_1.5px_0px_#000000]">
            PAGE {pageNumber} OF {totalPages}
          </span>
        )}
      </div>

      {/* Main Title - Bold High-Impact Sans */}
      <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-black dark:text-white tracking-tight leading-[1.1] mb-4">
        {title}
      </h1>

      {/* Introductory Lead */}
      {intro && (
        <p className="text-base sm:text-lg text-slate-700 dark:text-zinc-300 font-medium font-sans leading-relaxed mb-6">
          {intro}
        </p>
      )}

      {/* Solid Black Divider */}
      <div className="border-b-2 border-black dark:border-white" />
    </header>
  );
}
