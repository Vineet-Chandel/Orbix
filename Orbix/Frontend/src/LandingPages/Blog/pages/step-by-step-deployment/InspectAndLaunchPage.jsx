import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { DeploymentFilesDiagram } from '../../components/documentation/DeploymentFilesDiagram';
import { ExternalLink, ShieldAlert, Camera, Info, Server, Key, AlertTriangle } from 'lucide-react';

export const DEPLOY_PAGE_1_HEADINGS = [
  { id: 'project-1-files-the-browser-needs', text: 'Project 1: Files the Browser Needs', level: 2 },
  { id: 'step-1-inspect-the-repository', text: 'Step 1 — Inspect the Repository', level: 2 },
  { id: 'what-is-index-html', text: 'What Is index.html?', level: 2 },
  { id: 'step-2-sign-in-and-launch-ec2', text: 'Step 2 — Sign In and Launch EC2', level: 2 },
  { id: 'key-pair-safety', text: 'Key Pair Safety', level: 2 },
  { id: 'screenshot-target-1', text: 'Screenshot Target 1', level: 2 },
];

export function InspectAndLaunchPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'deploy-inspect-and-launch', label: 'Step-by-Step Deployment' },
    { id: 'deploy-inspect-and-launch', label: 'Inspect Files & Launch EC2' },
  ];

  const ec2Settings = [
    { setting: 'Name', value: 'aws-class-website' },
    { setting: 'Application image', value: 'Amazon Linux 2023 (AMI)' },
    { setting: 'Instance type', value: 'A small type approved by the organiser and appropriate to the workshop budget (e.g. t2.micro or t3.micro).' },
    { setting: 'Key pair', value: 'Create a key pair named aws-class-key, unless one has already been provisioned for the lab. Download and securely store the .pem private key.' },
    { setting: 'Network', value: 'Use a suitable subnet with public IPv4 connectivity for this public website exercise.' },
    { setting: 'Storage', value: 'Keep the instructor-approved test configuration (default 8 GiB gp3). Do not unnecessarily increase storage.' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="02"
        chapterTitle="STEP-BY-STEP DEPLOYMENT"
        pageNumber={1}
        totalPages={4}
        title="Project 1: inspect the files, then open EC2"
        intro="Mentor-led build • Estimated 35–45 minutes. We will serve a static website using Amazon EC2, Amazon Linux 2023, and Nginx."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: PROJECT 1 FILES THE BROWSER NEEDS */}
      <section id="project-1-files-the-browser-needs" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Project 1: Files the Browser Needs
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          A static website consists of client-side assets served directly to the visitor&apos;s browser. The diagram below shows how source files stored in GitHub will map to Nginx&apos;s default web directory on the EC2 server:
        </p>

        {/* 2-Container Diagram */}
        <DeploymentFilesDiagram />
      </section>

      {/* SECTION 2: STEP 1 — INSPECT THE REPOSITORY */}
      <section id="step-1-inspect-the-repository" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 1 — Inspect the repository
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Before provisioning cloud infrastructure, inspect the source files you are preparing to deploy:
        </p>

        {/* Numbered Instruction List */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs mb-6">
          <ol className="space-y-3.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                1
              </span>
              <span>Open the Project 1 repository using the supplied GitHub link below.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                2
              </span>
              <span>Select the <code className="font-mono px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">gh-pages</code> branch in the GitHub branch switcher.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                3
              </span>
              <span>Confirm that the starter website files include <code className="font-mono text-xs">index.html</code>, <code className="font-mono text-xs">style.css</code>, <code className="font-mono text-xs">script.js</code>, <code className="font-mono text-xs">logo.png</code>, and <code className="font-mono text-xs">background.jpg</code>.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                4
              </span>
              <span>Read <code className="font-mono text-xs">index.html</code> and identify which CSS, JavaScript, and image files it references.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                5
              </span>
              <span>Understand that the public repository provides the source files that will be cloned and copied to the server in Step 7.</span>
            </li>
          </ol>
        </div>

        {/* External Link */}
        <div className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <strong>Starter Code:</strong> <span className="font-mono text-xs">zirafa/simple-website-template</span> on GitHub
          </div>
          <a
            href="https://github.com/zirafa/simple-website-template/tree/gh-pages"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-workbook-navy text-white hover:bg-workbook-blue dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold transition-colors focus:outline-none shrink-0"
          >
            <span>Open Project 1: simple-website-template — gh-pages</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
          Important: Always verify filenames and paths before copying. If the repository structure ever changes, your deployment commands must match the actual file paths.
        </p>
      </section>

      {/* SECTION 3: WHAT IS index.html? */}
      <section id="what-is-index-html" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-blue bg-blue-50/70 dark:bg-blue-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="text-xs font-bold font-mono tracking-wider uppercase text-workbook-blue mb-2 select-none flex items-center gap-2">
            <Info className="w-3.5 h-3.5" />
            <span>WHAT IS index.html?</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-200">
            <code className="font-mono font-bold text-workbook-blue dark:text-blue-400">index.html</code> is the default entry page of a website. When a visitor opens your domain or IP address, the Nginx web server automatically returns this file. If this file or its linked stylesheet, script, or image assets are missing, the website will appear broken or incomplete.
          </p>
        </div>
      </section>

      {/* SECTION 4: STEP 2 — SIGN IN AND LAUNCH EC2 */}
      <section id="step-2-sign-in-and-launch-ec2" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 2 — Sign in and launch an EC2 instance
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Open the EC2 Console in the AWS account approved for the workshop. Select the workshop Region, for example <strong>Mumbai (ap-south-1)</strong> if that is the Region chosen by the organiser. Keep the same Region throughout the exercise.
        </p>

        {/* 2-Column Table for Setting & What to Select */}
        <div className="overflow-x-auto rounded-xl border border-workbook-border dark:border-zinc-800 shadow-xs mb-6">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-workbook-navy text-white text-xs font-mono uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold w-1/3">Setting</th>
                <th className="py-3 px-4 font-semibold w-2/3">What to Select</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workbook-border dark:divide-zinc-800">
              {ec2Settings.map((row, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 1 ? 'bg-workbook-altRow dark:bg-zinc-900/50' : 'bg-white dark:bg-zinc-950'}
                >
                  <td className="py-3.5 px-4 font-bold text-workbook-navy dark:text-zinc-100 align-top">
                    {row.setting}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 leading-relaxed align-top">
                    {row.value}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 5: KEY PAIR SAFETY */}
      <section id="key-pair-safety" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-red bg-rose-50/70 dark:bg-rose-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase text-workbook-red mb-2 select-none">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>KEY PAIR SAFETY</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-100 mb-2">
            Store the private <code className="font-mono text-xs px-1 py-0.5 rounded bg-white dark:bg-zinc-900 font-bold">.pem</code> file securely. Do not email it, upload it to GitHub, share it in a chat, or include it in a screenshot.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            A downloaded private key should be treated as an absolute secret. If you lose access to it, follow the approved recovery or reconnection process rather than searching for a way to re-download the same private key.
          </p>
        </div>
      </section>

      {/* SECTION 6: SCREENSHOT TARGET 1 */}
      <section id="screenshot-target-1" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-orange bg-amber-50/70 dark:bg-amber-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase text-workbook-orange mb-2 select-none">
            <Camera className="w-4 h-4 shrink-0" />
            <span>SCREENSHOT TARGET 1 • WORKSHOP EVIDENCE</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-100 mb-2">
            Capture the EC2 Launch Instance page showing the selected operating system (Amazon Linux 2023), instance type, and key-pair name. Do not capture private keys, credentials, account secrets, or other sensitive information.
          </p>
          <div className="text-xs font-mono text-amber-800 dark:text-amber-400 font-medium">
            Evidence: instance configuration before launch.
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'intro-preflight',
          title: 'Preflight: tools, repository, account and permissions',
          pageLabel: 'Chapter 01 • Page 4',
        }}
        next={{
          id: 'deploy-networking',
          title: 'Network rules: let visitors in, keep administration restricted',
          pageLabel: 'Page 2 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
