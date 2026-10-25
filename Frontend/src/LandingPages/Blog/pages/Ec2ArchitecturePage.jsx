import React from 'react';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { AwsNetworkDiagram } from '../components/documentation/AwsNetworkDiagram';
import { Shield, Key, Globe, Terminal } from 'lucide-react';

export const PAGE_2_HEADINGS = [
  { id: 'the-network-in-plain-english', text: 'The Network in Plain English', level: 2 },
  { id: 'what-does-each-component-do', text: 'What Does Each Component Do?', level: 2 },
  { id: 'two-paths-two-jobs', text: 'Two Paths, Two Jobs', level: 2 },
];

export function Ec2ArchitecturePage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'intro-deployment', label: 'Introduction & Prerequisites' },
    { id: 'intro-ec2-architecture', label: 'How the EC2 deployment fits together' },
  ];

  const componentsList = [
    {
      name: 'GitHub repository',
      role: 'Stores version-controlled code and website files.',
      badge: 'SOURCE',
      color: 'text-workbook-blue',
    },
    {
      name: 'Amazon EC2',
      role: 'Provides the virtual machine running in AWS.',
      badge: 'COMPUTE',
      color: 'text-workbook-orange',
    },
    {
      name: 'Amazon Linux 2023',
      role: 'The operating system installed on the virtual machine.',
      badge: 'OPERATING SYSTEM',
      color: 'text-slate-700 dark:text-zinc-300',
    },
    {
      name: 'Nginx',
      role: 'The web server that returns HTML, CSS, JavaScript, and image files to visitors.',
      badge: 'WEB SERVER DAEMON',
      color: 'text-workbook-purple',
    },
    {
      name: 'Security group',
      role: 'A virtual firewall that allows or denies network traffic according to its rules.',
      badge: 'STATEFUL FIREWALL',
      color: 'text-rose-600 dark:text-rose-400',
    },
    {
      name: 'Public IPv4 address',
      role: 'An address visitors may use to reach the website when the network configuration permits it.',
      badge: 'NETWORK INGRESS',
      color: 'text-workbook-green',
    },
    {
      name: 'IAM',
      role: 'Controls which users and roles can manage AWS resources. It is not the same as a network firewall.',
      badge: 'IDENTITY & PERMISSIONS',
      color: 'text-workbook-purple',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="01"
        chapterTitle="INTRODUCTION &amp; PREREQUISITES"
        pageNumber={2}
        totalPages={4}
        title="How the EC2 deployment fits together"
        intro="The hands-on project uses a virtual server and a web server. GitHub stores the website source, EC2 runs the machine, and Nginx delivers the files to visitors."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: THE NETWORK IN PLAIN ENGLISH */}
      <section id="the-network-in-plain-english" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          The Network in Plain English
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Review how your virtual private network, firewall boundaries, compute instance, and identity policies work together in the cloud:
        </p>

        {/* Real Responsive SVG / React Diagram */}
        <AwsNetworkDiagram />
      </section>

      {/* SECTION 2: WHAT DOES EACH COMPONENT DO? */}
      <section id="what-does-each-component-do" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          What Does Each Component Do?
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Every tool in our architecture has a focused, specific responsibility:
        </p>

        {/* 2-Column Table matching Reference Screenshots */}
        <div className="overflow-x-auto rounded-xl border border-workbook-border dark:border-zinc-800 shadow-xs">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-workbook-navy text-white text-xs font-mono uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold w-1/3">Component</th>
                <th className="py-3 px-4 font-semibold w-2/3">Job</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workbook-border dark:divide-zinc-800">
              {componentsList.map((item, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 1 ? 'bg-workbook-altRow dark:bg-zinc-900/50' : 'bg-white dark:bg-zinc-950'}
                >
                  <td className="py-3.5 px-4 align-top">
                    <div className="font-bold text-workbook-navy dark:text-zinc-100">
                      {item.name}
                    </div>
                    <span className="inline-block mt-1 text-[10px] font-mono tracking-wider px-1.5 py-0.5 rounded bg-slate-200/60 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400">
                      {item.badge}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-700 dark:text-zinc-300 leading-relaxed align-top">
                    {item.role}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: TWO PATHS, TWO JOBS */}
      <section id="two-paths-two-jobs" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Two Paths, Two Jobs
        </h2>

        <div className="rounded-r-xl border-l-4 border-workbook-blue bg-blue-50/70 dark:bg-blue-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="text-xs font-bold font-mono tracking-wider uppercase text-workbook-blue mb-2 select-none">
            TWO PATHS, TWO JOBS
          </div>

          <div className="space-y-2 text-sm sm:text-base leading-relaxed text-workbook-navy dark:text-zinc-100 mb-4">
            <p>
              <strong>Administrator path:</strong> your computer → SSH (port 22, restricted to your IP).
            </p>
            <p>
              <strong>Visitor path:</strong> browser → HTTP (port 80, public for this exercise) → Nginx → website files.
            </p>
          </div>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed pt-2 border-t border-blue-200/60 dark:border-blue-900/40">
            SSH helps the administrator control the server. HTTP lets visitors open the website. Keep administrative access restricted and never expose port 22 unnecessarily to the public internet.
          </p>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'intro-deployment',
          title: 'What is AWS deployment?',
          pageLabel: 'Page 1 of 4',
        }}
        next={{
          id: 'intro-aws-services',
          title: 'AWS services: learn the job, not just the name',
          pageLabel: 'Page 3 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
