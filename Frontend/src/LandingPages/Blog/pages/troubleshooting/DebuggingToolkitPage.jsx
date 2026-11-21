import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { TerminalPanel } from '../../components/documentation/TerminalPanel';
import { DebuggingFlowchart } from '../../components/documentation/DebuggingFlowchart';
import { NeoButton } from '../../components/ui/NeoButton';
import {
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Check,
  AlertTriangle,
  Info,
  RotateCcw,
  Sparkles,
  ArrowRight,
  HelpCircle,
  Eye,
  FileSearch,
  Layers,
  Wrench,
  CheckSquare,
} from 'lucide-react';

export const DEBUGGING_TOOLKIT_HEADINGS = [
  { id: 'diagnostic-commands', text: 'Diagnostic Commands', level: 2 },
  { id: 'debug-in-layers', text: 'Debug in Layers', level: 2 },
  { id: 'instructor-mini-activity', text: 'Instructor Mini-Activity', level: 2 },
  { id: 'debugging-rule', text: 'Debugging Rule', level: 2 },
  { id: 'before-declaring-fixed', text: 'Before Declaring the Issue Fixed', level: 2 },
];

const CHECKLIST_ITEMS = [
  'The original error is understood or no longer occurs.',
  'The relevant diagnostic command produces the expected result.',
  'The correct website is shown in the browser.',
  'CSS and image assets load correctly.',
  'Network rules remain appropriately restricted.',
  'The final configuration is restored to the intended state.',
];

export function DebuggingToolkitPage({ onNavigate = () => {} }) {
  const [checkedItems, setCheckedItems] = useState(
    CHECKLIST_ITEMS.reduce((acc, _, idx) => ({ ...acc, [idx]: false }), {})
  );

  const toggleCheck = (idx) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checkAll = () => {
    const all = {};
    CHECKLIST_ITEMS.forEach((_, idx) => {
      all[idx] = true;
    });
    setCheckedItems(all);
  };

  const resetAll = () => {
    const all = {};
    CHECKLIST_ITEMS.forEach((_, idx) => {
      all[idx] = false;
    });
    setCheckedItems(all);
  };

  const breadcrumbs = [
    { id: 'intro-deployment', label: 'AWS Cloud Launchpad' },
    { id: 'troubleshoot-common-errors', label: '04 / Troubleshooting Guide' },
    { id: 'troubleshoot-debugging-toolkit', label: 'Debugging Toolkit' },
  ];

  const diagnosticCommandsText = `# 1. Check the web server
sudo systemctl status nginx --no-pager

# 2. Start it if the service is stopped
sudo systemctl start nginx

# 3. Test HTTP locally
curl -I http://localhost

# 4. Check the deployed files
ls -la /usr/share/nginx/html

# 5. Validate Nginx configuration syntax
sudo nginx -t

# 6. Read recent error logs
sudo tail -n 50 /var/log/nginx/error.log

# 7. Read recent access logs
sudo tail -n 50 /var/log/nginx/access.log

# 8. Test the public endpoint from your laptop
curl -I http://YOUR_PUBLIC_IP`;

  const activitySteps = [
    {
      num: '01',
      title: 'Observe',
      icon: Eye,
      description: 'Ask the student to reproduce or describe the symptom accurately (e.g. browser timeout vs HTTP 403 Forbidden vs Nginx welcome page).',
    },
    {
      num: '02',
      title: 'Collect evidence',
      icon: FileSearch,
      description: 'Ask which command or browser Developer Tools observation narrows down the root cause before touching any settings.',
    },
    {
      num: '03',
      title: 'Identify the layer',
      icon: Layers,
      description: 'Determine whether the failure is in the Nginx service daemon, web root file permissions, or AWS VPC public network ingress.',
    },
    {
      num: '04',
      title: 'Make one controlled fix',
      icon: Wrench,
      description: 'Change only the single setting or file supported by diagnostic evidence. Never change multiple variables simultaneously.',
    },
    {
      num: '05',
      title: 'Verify again',
      icon: CheckSquare,
      description: 'Repeat the relevant diagnostic command, confirm HTTP 200, and verify the website renders cleanly in the browser.',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="04"
        chapterTitle="TROUBLESHOOTING GUIDE"
        pageNumber={2}
        totalPages={2}
        title="Your first debugging toolkit"
        intro="Use these commands as evidence. A command output tells you something specific; it does not prove every other layer is correct."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Diagnostic Commands */}
      <section id="diagnostic-commands" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          Diagnostic Commands
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          Terminal inspection commands isolate each layer of your infrastructure. Run them systematically to gather proof of where a breakdown occurs.
        </p>

        {/* Unified Terminal Command Panel */}
        <TerminalPanel
          label="DIAGNOSTIC COMMANDS — RUN IN THE CONTEXT SHOWN"
          commands={diagnosticCommandsText}
          isSsh={true}
        />

        {/* Execution Context Explanation Banner */}
        <div className="p-4 border-2 border-black dark:border-white bg-[#fde047]/20 dark:bg-amber-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] my-5">
          <div className="flex items-start gap-3">
            <div className="p-1.5 bg-[#fde047] border border-black text-black shrink-0">
              <AlertTriangle className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div className="text-xs sm:text-sm text-black dark:text-zinc-100 font-medium">
              Run commands 1–7 on EC2. Run command 8 on your laptop. Replace <code className="font-mono bg-white dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white font-bold">YOUR_PUBLIC_IP</code> with the actual public IPv4 address of your instance.
            </div>
          </div>
        </div>

        {/* Important Correction regarding systemctl start nginx */}
        <div className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] space-y-3 mt-5">
          <div className="font-bold text-black dark:text-white flex items-center gap-2 text-xs uppercase tracking-wider font-mono">
            <span className="p-1 bg-[#67e8f9] border border-black text-black">
              <Info className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            Important: State-Changing vs Diagnostic Commands
          </div>
          <p className="text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
            <code className="font-mono bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white font-bold">sudo systemctl start nginx</code> should only be run if the service is stopped or inactive and the available diagnostic evidence indicates that starting it is appropriate.
          </p>
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
            Starting a service is an action that changes system state; it is not merely an inspection command. For an inexperienced student:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-1 text-xs text-zinc-700 dark:text-zinc-300">
            <li>Inspect the service status first with <code className="font-mono font-bold">sudo systemctl status nginx</code>.</li>
            <li>Review error logs if it failed (<code className="font-mono font-bold">sudo tail -n 50 /var/log/nginx/error.log</code>).</li>
            <li>Check the Nginx configuration syntax using <code className="font-mono font-bold">sudo nginx -t</code> before starting or reloading.</li>
            <li>Start the service only when appropriate, then immediately re-test locally with <code className="font-mono font-bold">curl -I http://localhost</code>.</li>
          </ul>
        </div>
      </section>

      {/* SECTION 2: Debug in Layers */}
      <section id="debug-in-layers" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          Debug in layers — change one thing at a time
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          Use the diagnostic flowchart below to determine whether your deployment issue is located inside the operating system or out on the AWS VPC network perimeter.
        </p>

        {/* Responsive Debugging Flowchart Component */}
        <DebuggingFlowchart />
      </section>

      {/* SECTION 3: Instructor Mini-Activity */}
      <section id="instructor-mini-activity" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          Instructor mini-activity: find the fault
        </h2>
        <p className="text-sm text-slate-700 dark:text-zinc-300 mb-5 leading-relaxed">
          Choose one controlled fault: stop Nginx, temporarily remove the HTTP inbound rule, or move index.html out of the document root. Do not tell students which one you changed. Ask them to describe the symptom, collect evidence, identify the layer, and fix the cause.
        </p>

        {/* 5-Step Compact Sequence */}
        <div className="space-y-3 mb-6">
          {activitySteps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="flex items-start gap-3.5 p-3.5 rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900/50 shadow-2xs"
              >
                <div className="w-8 h-8 rounded-lg bg-navy-950 text-white dark:bg-zinc-800 flex items-center justify-center shrink-0 font-mono text-xs font-bold">
                  {step.num}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Icon className="w-3.5 h-3.5 text-workbook-blue" />
                    <span className="text-xs font-bold text-workbook-navy dark:text-zinc-100">
                      {step.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Instructor Safety Requirements */}
        <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 text-xs text-slate-600 dark:text-zinc-400 space-y-2">
          <div className="font-bold text-workbook-navy dark:text-zinc-200 uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Instructor Safety Requirements
          </div>
          <p className="leading-relaxed">
            This activity is performed only in a controlled workshop instance with instructor approval. Do not make changes to shared production resources. Avoid exposing SSH to the internet. If the security group is changed, do not remove essential administrative access. Restore the original intended configuration before the activity ends. Confirm that the website works after the fault is corrected. Do not hide changes from participants in a way that risks affecting their real AWS resources. The purpose is a safe, reversible learning exercise.
          </p>
        </div>
      </section>

      {/* SECTION 4: Debugging Rule */}
      <section id="debugging-rule" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Debugging Rule
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-emerald-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#a6ff70] text-black shrink-0">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                DEBUGGING RULE
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                "If curl to localhost works but the public URL fails, focus on networking: the public address, route, security group, and public connectivity. If localhost fails too, focus on Nginx, configuration, service logs, and deployed files."
              </p>
              <div className="pt-2 border-t-2 border-black/10 dark:border-white/10 text-xs text-zinc-700 dark:text-zinc-300">
                <strong>Key Takeaway:</strong> Use the results of one check to decide the next check. Do not change several settings at once, because you may hide the original cause.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: Evidence-Based Debugging Checklist */}
      <section id="before-declaring-fixed" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
              Before declaring the issue fixed
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-1">
              Verify all criteria before concluding your debugging session.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <NeoButton
              variant="white"
              size="sm"
              onClick={checkAll}
            >
              Check All
            </NeoButton>
            <NeoButton
              variant="white"
              size="sm"
              onClick={resetAll}
              icon={RotateCcw}
            >
              Reset
            </NeoButton>
          </div>
        </div>

        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((text, idx) => {
            const isChecked = checkedItems[idx];
            return (
              <motion.label
                key={idx}
                htmlFor={`check-fix-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? "bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
                    : "bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  id={`check-fix-${idx}`}
                  checked={isChecked}
                  onChange={() => toggleCheck(idx)}
                  className="sr-only"
                />

                <div
                  className={`mt-0.5 w-5 h-5 flex items-center justify-center shrink-0 border-2 border-black dark:border-white transition-all ${
                    isChecked
                      ? "bg-[#a6ff70] text-black shadow-[1.5px_1.5px_0px_#000000]"
                      : "bg-white dark:bg-zinc-800 text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>

                <span
                  className={`text-xs sm:text-sm font-medium transition-colors ${
                    isChecked
                      ? "text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2"
                      : "text-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {text}
                </span>
              </motion.label>
            );
          })}
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'troubleshoot-common-errors',
          title: 'Common errors, likely causes and fixes',
          pageLabel: 'Chapter 04 • Page 1',
        }}
        next={{
          id: 'challenge-project-two',
          title: 'Project 2: deploy a multi-page website',
          pageLabel: 'Chapter 05',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}