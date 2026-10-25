import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { motion } from 'framer-motion';
import {
  ExternalLink,
  FolderGit2,
  Server,
  Globe,
  FileCode2,
  Sparkles,
  AlertTriangle,
  ArrowRight,
  Compass,
} from 'lucide-react';

export const PROJECT_TWO_PAGE_HEADINGS = [
  { id: 'repository-link', text: 'Repository Link', level: 2 },
  { id: 'expected-source-structure', text: 'Expected Source Structure', level: 2 },
  { id: 'expected-outcome', text: 'Expected Outcome', level: 2 },
  { id: 'challenge-rule', text: 'Challenge Rule', level: 2 },
];

export function ProjectTwoPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'intro-deployment', label: 'AWS Cloud Launchpad' },
    { id: 'challenge-project-two', label: '05 / Independent Challenge' },
    { id: 'challenge-project-two', label: 'Project 2: Deploy a Multi-Page Website' },
  ];

  const outcomes = [
    {
      title: 'Running EC2',
      badge: 'INFRASTRUCTURE',
      desc: 'A workshop EC2 instance serves the second project.',
      badgeBg: 'bg-[#67e8f9]',
      icon: Server,
    },
    {
      title: 'Public live URL',
      badge: 'ACCESSIBLE',
      desc: 'A URL in the form http://YOUR_PUBLIC_IP opens from a separate browser or device.',
      badgeBg: 'bg-[#a6ff70]',
      icon: Globe,
    },
    {
      title: 'Multi-page content',
      badge: 'FUNCTIONAL',
      desc: 'The homepage and About page work, while styling and linked assets load correctly.',
      badgeBg: 'bg-[#fde047]',
      icon: FileCode2,
    },
    {
      title: 'Custom 404 behaviour',
      badge: 'STRETCH',
      desc: '404.html is present. Serving it automatically for missing routes may require Nginx configuration.',
      badgeBg: 'bg-[#fda4af]',
      icon: Sparkles,
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="05"
        chapterTitle="INDEPENDENT DEPLOYMENT CHALLENGE"
        pageNumber={1}
        totalPages={2}
        title="Project 2: deploy a multi-page website"
        intro="Mission: use the EC2 + Amazon Linux 2023 + Nginx approach from the guided build, but make the decisions yourself. Use hints, your notes and official documentation instead of a click-by-click recipe."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Repository Link */}
      <section id="repository-link" className="scroll-mt-24 mb-12">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-3">
          Repository link
        </h2>

        <div className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-black bg-[#a6ff70] text-black">
                  Public GitHub repository
                </span>
                <FolderGit2 className="w-4 h-4 text-black dark:text-white stroke-[2.5]" />
              </div>
              <div className="text-base sm:text-lg font-black font-mono text-black dark:text-zinc-100">
                Maryam-Skaik/static-website-demo
              </div>
            </div>

            <a
              href="https://github.com/Maryam-Skaik/static-website-demo"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-black bg-[#a6ff70] text-black hover:bg-[#b8ff8a] text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all shrink-0 select-none"
            >
              <span>Open Project 2 repository</span>
              <ArrowRight className="w-3.5 h-3.5 stroke-[3]" />
            </a>
          </div>
        </div>

        <p className="text-sm text-slate-700 dark:text-zinc-300 leading-relaxed mb-3">
          The repository contains a small static website designed for deployment practice. It includes a homepage, an About page, a custom 404 page, and supporting assets. For this challenge, deploy the public website files to your EC2 server rather than relying on the existing GitHub Pages URL.
        </p>
      </section>

      {/* SECTION 2: Expected Source Structure */}
      <section id="expected-source-structure" className="scroll-mt-24 mb-12">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-3">
          Expected source structure
        </h2>

        {/* Conceptual File Tree Panel */}
        <div className="rounded-xl border border-slate-700 bg-workbook-navy text-slate-100 overflow-hidden shadow-md my-4">
          <div className="flex items-center justify-between px-4 py-2.5 bg-navy-950/90 border-b border-slate-800 text-xs">
            <span className="font-mono text-[11px] uppercase font-bold tracking-wider text-workbook-orange">
              EXPECTED SOURCE STRUCTURE
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              VERIFIED REPOSITORY ASSETS
            </span>
          </div>

          <div className="p-4 sm:p-5 font-mono text-xs sm:text-sm leading-relaxed overflow-x-auto text-slate-200">
            <pre>{`static-website-demo/
├── index.html
├── about.html
├── 404.html
├── css/
│   └── style.css
├── js/
│   └── theme.js
├── README.md
└── LICENSE`}</pre>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-2 leading-relaxed">
          <strong>Note:</strong> <code className="font-mono text-[11px] bg-slate-100 dark:bg-zinc-800 px-1 py-0.5 rounded">404.html</code> is an available error-page file, but Nginx does not automatically use it for every missing URL without suitable server configuration.
        </p>
      </section>

      {/* SECTION 3: Expected Outcome */}
      <section id="expected-outcome" className="scroll-mt-24 mb-12">
        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-zinc-100 tracking-tight mb-2">
          Expected outcome
        </h2>
        <p className="text-sm text-slate-700 dark:text-zinc-300 mb-5 font-sans">
          These four core targets define a successful independent deployment:
        </p>

        {/* 2x2 Grid of Neo-Brutalist Outcome Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {outcomes.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
                className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black/10 dark:border-zinc-800">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-black text-black ${item.badgeBg}`}>
                      {item.badge}
                    </span>
                    <div className="p-1 border border-black bg-[#fbfbf9] dark:bg-zinc-800 text-black dark:text-white">
                      <Icon className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                  </div>
                  <h3 className="text-base font-black text-black dark:text-zinc-100 mb-1.5 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-sans">
                    {item.desc}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-400 mt-3 font-mono">
          Remember: Replace <code className="font-mono bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black text-black dark:text-white">YOUR_PUBLIC_IP</code> with the actual public IPv4 address assigned to your Amazon EC2 instance.
        </p>
      </section>

      {/* SECTION 4: Challenge Rule */}
      <section id="challenge-rule" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Challenge Rule
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#fde047]/20 dark:bg-amber-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#fde047] text-black shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                CHALLENGE RULE
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                You may use this workbook and official AWS documentation. Try to diagnose the issue independently before asking for help. Do not copy the mentor's private key or ask for unrestricted permissions.
              </p>
              <p className="text-xs sm:text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                When requesting help, explain what you attempted, which command or browser test you used, what happened, and what you think might be causing the issue.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'troubleshoot-debugging-toolkit',
          title: 'Your first debugging toolkit',
          pageLabel: 'Chapter 04 • Page 2',
        }}
        next={{
          id: 'challenge-checklist',
          title: 'Independent checklist — hints, not the complete solution',
          pageLabel: 'Page 2 of 2',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}