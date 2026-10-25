import React, { useState } from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { NeoButton } from '../../components/ui/NeoButton';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  ShieldCheck,
  Camera,
  Globe,
  FileQuestion,
  HelpCircle,
  ArrowRight,
} from 'lucide-react';

export const INDEPENDENT_CHECKLIST_HEADINGS = [
  { id: 'independent-checklist', text: 'Independent Deployment Checklist', level: 2 },
  { id: 'submission-requirements', text: 'Submission Requirements', level: 2 },
  { id: 'mentor-scoring-idea', text: 'Mentor Scoring Idea', level: 2 },
  { id: 'stretch-goal', text: 'Stretch Goal', level: 2 },
];

const CHECKLIST_TASKS = [
  'Inspect the repository and identify the homepage, stylesheet, scripts, and other pages.',
  'Confirm the AWS account, Region, instance, and network settings are ready.',
  'Connect to the instance using an authorised method.',
  'Ensure the required web server is installed and running.',
  'Deploy only the public website files into the correct web directory.',
  'Check that CSS, JavaScript, images, and links load correctly.',
  'Open the public URL in a separate browser or device.',
  'Test the homepage and About page; investigate custom 404 behaviour.',
  'Capture evidence showing the running instance and deployed website.',
  'Identify the resources created and prepare to clean them up safely.',
];

export function IndependentChecklistPage({ onNavigate = () => {} }) {
  const [checkedItems, setCheckedItems] = useState(
    CHECKLIST_TASKS.reduce((acc, _, idx) => ({ ...acc, [idx]: false }), {})
  );

  const toggleCheck = (idx) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checkAll = () => {
    const all = {};
    CHECKLIST_TASKS.forEach((_, idx) => {
      all[idx] = true;
    });
    setCheckedItems(all);
  };

  const resetAll = () => {
    const all = {};
    CHECKLIST_TASKS.forEach((_, idx) => {
      all[idx] = false;
    });
    setCheckedItems(all);
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = CHECKLIST_TASKS.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const breadcrumbs = [
    { id: 'intro-deployment', label: 'AWS Cloud Launchpad' },
    { id: 'challenge-project-two', label: '05 / Independent Challenge' },
    { id: 'challenge-checklist', label: 'Independent Checklist' },
  ];

  const scoringCriteria = [
    {
      title: '1 POINT',
      category: 'DEPLOY',
      desc: 'Site deploys and the public URL works.',
      badgeBg: 'bg-[#a6ff70]',
    },
    {
      title: '1 POINT',
      category: 'NAVIGATE',
      desc: 'Home/About navigation behaves as expected.',
      badgeBg: 'bg-[#67e8f9]',
    },
    {
      title: '1 POINT',
      category: 'ASSETS',
      desc: 'Styles and assets render correctly.',
      badgeBg: 'bg-[#fde047]',
    },
    {
      title: '1 POINT',
      category: 'UNDERSTAND',
      desc: 'Student explains one debugging step and one cleanup item.',
      badgeBg: 'bg-[#fda4af]',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="05"
        chapterTitle="INDEPENDENT DEPLOYMENT CHALLENGE"
        pageNumber={2}
        totalPages={2}
        title="Independent checklist — hints, not the complete solution"
        intro="Tick each item as you finish it. Ask the mentor for a hint only after you can explain what you tried and what the output showed."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Independent Deployment Checklist */}
      <section id="independent-checklist" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
              Independent Deployment Checklist
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Work through each task independently. Track your progress with these milestones.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={checkAll}
              className="px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Check All
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          </div>
        </div>

        {/* Progress Banner */}
        <div className="p-4 mb-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 border-2 border-black flex items-center justify-center font-mono font-bold text-xs ${
              completedCount === totalCount
                ? 'bg-[#a6ff70] text-black shadow-[2px_2px_0px_#000000]'
                : 'bg-black text-white dark:bg-zinc-800 dark:text-zinc-200'
            }`}>
              {completedCount === totalCount ? (
                <Check className="w-5 h-5 stroke-[3]" />
              ) : (
                `${completedCount}/${totalCount}`
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-black dark:text-white uppercase tracking-wider font-mono">
                {completedCount === totalCount
                  ? 'All 10 Tasks Completed!'
                  : `${completedCount} of ${totalCount} tasks completed`}
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                {completedCount === totalCount
                  ? 'Ready for submission and mentor assessment.'
                  : 'Follow the checklist sequence to verify each layer.'}
              </div>
            </div>
          </div>

          <div className="hidden sm:block w-36">
            <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 border-2 border-black overflow-hidden">
              <div
                className="h-full bg-[#a6ff70] border-r-2 border-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-right font-mono font-bold text-black dark:text-white mt-1">
              {progressPercent}% COMPLETED
            </div>
          </div>
        </div>

        {/* 10 Vertical Checklist Items */}
        <div className="space-y-3">
          {CHECKLIST_TASKS.map((task, idx) => {
            const isChecked = checkedItems[idx];
            return (
              <motion.label
                key={idx}
                htmlFor={`task-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]'
                    : 'bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50'
                }`}
              >
                <input
                  type="checkbox"
                  id={`task-${idx}`}
                  checked={isChecked}
                  onChange={() => toggleCheck(idx)}
                  className="sr-only"
                />

                <div
                  className={`mt-0.5 w-5 h-5 flex items-center justify-center shrink-0 border-2 border-black dark:border-white transition-all ${
                    isChecked
                      ? 'bg-[#a6ff70] text-black shadow-[1.5px_1.5px_0px_#000000]'
                      : 'bg-white dark:bg-zinc-800 text-transparent'
                  }`}
                  aria-hidden="true"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono font-bold bg-[#67e8f9] text-black border border-black px-1.5 py-0.5 uppercase">
                      STEP {String(idx + 1).padStart(2, '0')}
                    </span>
                  </div>
                  <span
                    className={`text-xs sm:text-sm font-medium leading-relaxed transition-colors ${
                      isChecked
                        ? 'text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2'
                        : 'text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {task}
                  </span>
                </div>
              </motion.label>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Submission Requirements */}
      <section id="submission-requirements" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          Submission requirements
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-5">
          Submit the following deliverables to demonstrate complete independent deployment:
        </p>

        <div className="space-y-4">
          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#67e8f9] border border-black text-black shrink-0">
                <Globe className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-1">
                  Live URL
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  The public address of your deployed website (in the format <code className="font-mono bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white font-bold">http://YOUR_PUBLIC_IP</code>). Submit the actual reachable URL of your EC2-hosted project.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#a6ff70] border border-black text-black shrink-0">
                <Camera className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-black dark:text-white mb-1">
                  Evidence
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2.5">
                  A screenshot showing the website in the browser and its URL. Capture your real deployed site with the public IPv4 address clearly visible in the browser address bar.
                </p>
                <div className="text-xs text-black dark:text-zinc-100 bg-[#fde047]/30 dark:bg-amber-950/40 p-2.5 border-2 border-black dark:border-white">
                  <strong>Important:</strong> Remove or obscure sensitive account information before sharing screenshots. Private keys, passwords, AWS access keys, and session tokens must never be included.
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
          >
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-[#c084fc] border border-black text-black shrink-0">
                <FileQuestion className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div className="w-full">
                <h3 className="text-sm font-bold text-black dark:text-white mb-1">
                  Reflection Questions
                </h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                  Be prepared to discuss your answers with the mentor:
                </p>
                <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300 list-disc list-inside">
                  <li><strong>Which issue took the longest to fix?</strong></li>
                  <li><strong>How did you verify that your website was working?</strong></li>
                  <li><strong>Which AWS resources did you create, and which of them need cleanup?</strong></li>
                </ul>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 3: Mentor Scoring Idea */}
      <section id="mentor-scoring-idea" className="scroll-mt-24 mb-14">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl sm:text-2xl font-black text-black dark:text-zinc-100 tracking-tight">
            Mentor scoring idea
          </h2>
          <span className="text-xs font-mono font-black text-black dark:text-white bg-[#fde047] px-2 py-0.5 border border-black shadow-[1.5px_1.5px_0px_#000] uppercase">
            MAX 4 POINTS
          </span>
        </div>
        <p className="text-sm text-slate-700 dark:text-zinc-300 mb-5 font-sans">
          An illustrative assessment rubric mentors can use to review your completed deployment challenge:
        </p>

        {/* 2x2 Grid of Neo-Brutalist Rubric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {scoringCriteria.map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
              className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3 pb-2 border-b-2 border-black/10 dark:border-zinc-800">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-black text-black ${item.badgeBg}`}>
                    {item.category}
                  </span>
                  <span className="font-mono text-xs font-black text-black dark:text-white bg-[#f4f3ee] dark:bg-zinc-800 px-2 py-0.5 border border-black shadow-[1.5px_1.5px_0px_#000]">
                    {item.title}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-zinc-200 leading-relaxed font-sans">
                  {item.desc}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 4: Stretch Goal */}
      <section id="stretch-goal" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Stretch Goal
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#67e8f9]/20 dark:bg-cyan-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#67e8f9] text-black shrink-0">
              <Sparkles className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2.5">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                STRETCH GOAL
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                Configure the server to serve the included custom 404 page for missing paths. The repository contains the file, but default Nginx configuration does not necessarily use it automatically.
              </p>
              <div className="pt-2.5 border-t-2 border-black/10 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300 space-y-1.5">
                <div className="font-bold text-black dark:text-white uppercase font-mono tracking-wider">
                  Discussion Question:
                </div>
                <p className="italic">
                  "What change did you make to the Nginx configuration, and how did you verify that a missing URL returns the intended error page?"
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400 pt-1">
                  Always validate configuration syntax with <code className="font-mono bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black text-black dark:text-white font-bold">sudo nginx -t</code> before reloading Nginx, and test both valid routes and nonexistent paths.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'challenge-project-two',
          title: 'Project 2: deploy a multi-page website',
          pageLabel: 'Page 1 of 2',
        }}
        next={{
          id: 'security-and-permissions',
          title: 'Build safe cloud habits from the beginning',
          pageLabel: 'Chapter 06',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}