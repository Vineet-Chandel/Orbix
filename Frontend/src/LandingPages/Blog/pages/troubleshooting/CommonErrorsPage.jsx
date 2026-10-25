import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { TroubleshootingTable } from '../../components/documentation/TroubleshootingTable';
import {
  AlertTriangle,
  ExternalLink,
  BookOpen,
  ShieldCheck,
  Server,
  ArrowRight,
  Info,
  LifeBuoy,
} from 'lucide-react';

export const COMMON_ERRORS_PAGE_HEADINGS = [
  { id: 'common-errors-table', text: 'Common Errors, Likely Causes and Fixes', level: 2 },
  { id: 'aws-troubleshooting-note', text: 'AWS Troubleshooting Note', level: 2 },
  { id: 'ec2-connection-troubleshooting', text: 'EC2 Connection Troubleshooting', level: 2 },
];

export function CommonErrorsPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'intro-deployment', label: 'AWS Cloud Launchpad' },
    { id: 'troubleshoot-common-errors', label: '04 / Troubleshooting Guide' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="04"
        chapterTitle="TROUBLESHOOTING GUIDE"
        pageNumber={1}
        totalPages={2}
        title="Common errors, likely causes and fixes"
        intro="Debug in layers instead of changing random settings. Check the error first, then change one thing at a time."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Troubleshooting Reference Table */}
      <section id="common-errors-table" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
            Common Errors, Likely Causes and Fixes
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            10 DIAGNOSTIC SCENARIOS
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-4">
          When a command or connection fails, find the observed symptom below to identify the most probable layer of failure and test the recommended corrective action.
        </p>

        {/* 3-Column Diagnostic Table Component */}
        <TroubleshootingTable />
      </section>

      {/* SECTION 2: AWS Troubleshooting Note */}
      <section id="aws-troubleshooting-note" className="scroll-mt-24 mb-10">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          AWS Troubleshooting Note
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#fde047]/20 dark:bg-amber-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#fde047] text-black shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                AWS NOTE
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                AWS has an official troubleshooting guide for SSH and connectivity failures. Use it to investigate the specific error instead of repeatedly opening network ports broadly.
              </p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 italic pt-1">
                Rule of thumb: Opening ports to 0.0.0.0/0 when debugging rarely fixes an underlying configuration or authentication problem, but it introduces immediate security risk.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: EC2 Connection Troubleshooting Reference */}
      <section id="ec2-connection-troubleshooting" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-4">
          EC2 Connection Troubleshooting
        </h2>

        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-5 leading-relaxed">
          The AWS Documentation provides comprehensive runbooks for instance reachability, VPC internet routing, and key-pair troubleshooting. Consult these official references when isolating complex connection failures:
        </p>

        {/* Primary Official Reference Card */}
        <div className="p-5 rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs mb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Official AWS reference
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400 font-mono">
                  docs.aws.amazon.com
                </span>
              </div>
              <h3 className="text-base font-bold text-workbook-navy dark:text-zinc-100">
                Troubleshooting Connecting to Your EC2 Instance
              </h3>
              <p className="text-xs text-slate-600 dark:text-zinc-400">
                Step-by-step diagnostic workflows for connection refused, connection timed out, Host key verification failed, and Permission denied (publickey).
              </p>
            </div>

            <a
              href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/TroubleshootingInstancesConnecting.html"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-workbook-navy text-white hover:bg-workbook-blue dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-bold uppercase tracking-wider transition-colors shrink-0 shadow-2xs"
            >
              <span>Open Guide</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Additional Reference Links */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-troubleshoot.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors group flex items-start justify-between gap-2"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-200 group-hover:text-workbook-blue transition-colors">
                General EC2 Troubleshooting Guide
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Investigate instance stop errors, hardware status checks, and volume issues.
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-workbook-blue shrink-0 mt-0.5 transition-colors" />
          </a>

          <a
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 hover:border-slate-300 dark:hover:border-zinc-700 transition-colors group flex items-start justify-between gap-2"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-200 group-hover:text-workbook-blue transition-colors">
                Security Group Rules Reference
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
                Official rule specifications for Web servers, SSH, CIDR blocks, and stateful tracking.
              </p>
            </div>
            <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-workbook-blue shrink-0 mt-0.5 transition-colors" />
          </a>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'verification-checklist',
          title: 'Prove the website is really deployed',
          pageLabel: 'Chapter 03',
        }}
        next={{
          id: 'troubleshoot-debugging-toolkit',
          title: 'Your first debugging toolkit',
          pageLabel: 'Page 2 of 2',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}