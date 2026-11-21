import React from 'react';
import { Camera, AlertCircle, ShieldAlert } from 'lucide-react';

/**
 * Responsive 5-tile schematic capture target checklist for live workshop evidence.
 */
export function ScreenshotTargetsGrid() {
  const targets = [
    {
      num: 'SCREEN 01',
      title: 'Launch Page',
      caption: 'OS + instance type',
    },
    {
      num: 'SCREEN 02',
      title: 'Network Rules',
      caption: 'SSH 22: My IP; HTTP 80: public',
    },
    {
      num: 'SCREEN 03',
      title: 'Instance Status',
      caption: 'Running + status checks',
    },
    {
      num: 'SCREEN 04',
      title: 'Terminal',
      caption: 'Nginx active + HTTP 200 test',
    },
    {
      num: 'SCREEN 05',
      title: 'Browser',
      caption: 'Website + public URL',
    },
  ];

  return (
    <div className="my-6">
      {/* 5-Item Responsive Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {targets.map((item, index) => (
          <div
            key={index}
            className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-2xs flex flex-col justify-between"
          >
            {/* Header Navy Strip */}
            <div className="px-3 py-1.5 bg-workbook-navy text-white flex items-center justify-between text-[10px] font-mono font-bold tracking-wider uppercase">
              <span>{item.num}</span>
              <Camera className="w-3 h-3 text-workbook-orange opacity-90" />
            </div>

            {/* Body */}
            <div className="p-3 bg-slate-50/50 dark:bg-zinc-900/60 flex-1 flex flex-col justify-center text-center">
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-100 mb-1">
                {item.title}
              </div>
              <div className="text-[11px] font-mono text-workbook-blue dark:text-blue-400 font-medium leading-tight">
                {item.caption}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Warning Sentence Below Grid */}
      <div className="mt-3 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-400 font-medium">
        <ShieldAlert className="w-4 h-4 shrink-0" />
        <span>
          These are capture instructions, not screenshots from a live AWS account. Never capture a private key, password, or secret.
        </span>
      </div>
    </div>
  );
}
