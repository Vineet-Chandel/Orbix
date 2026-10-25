import React from 'react';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { DeploymentFlow } from '../components/documentation/DeploymentFlow';
import { Laptop, Cloud, Globe, ExternalLink, AlertTriangle, ArrowRight } from 'lucide-react';

export const PAGE_1_HEADINGS = [
  { id: 'local-vs-cloud', text: 'Local Development vs Cloud Deployment', level: 2 },
  { id: 'why-developers-use-aws', text: 'Why Do Developers Use AWS?', level: 2 },
  { id: 'cloud-does-not-mean-free', text: 'Cloud Does Not Automatically Mean Free', level: 2 },
  { id: 'todays-deployment-in-one-line', text: "Today's Deployment in One Line", level: 2 },
];

export function DeploymentOverviewPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'intro-deployment', label: 'Introduction & Prerequisites' },
    { id: 'intro-deployment', label: 'What is AWS deployment?' },
  ];

  const reasons = [
    {
      title: 'Accessibility',
      desc: 'Users can reach a deployed application from different devices over the internet.',
      label: 'REACH USERS',
      color: 'text-workbook-blue',
      badgeBg: 'bg-blue-50 dark:bg-blue-950/40 text-workbook-blue',
    },
    {
      title: 'Scalability',
      desc: 'Computing and hosting resources can be adjusted as demand changes.',
      label: 'GROW AS NEEDED',
      color: 'text-workbook-orange',
      badgeBg: 'bg-amber-50 dark:bg-amber-950/40 text-workbook-orange',
    },
    {
      title: 'Reliability',
      desc: 'AWS services offer building blocks that can be combined to design resilient systems.',
      label: 'DESIGN FOR UPTIME',
      color: 'text-workbook-green',
      badgeBg: 'bg-emerald-50 dark:bg-emerald-950/40 text-workbook-green',
    },
    {
      title: 'Service choice',
      desc: 'Choose services for computing, storage, databases, networking, security, and monitoring.',
      label: 'RIGHT TOOL',
      color: 'text-workbook-purple',
      badgeBg: 'bg-purple-50 dark:bg-purple-950/40 text-workbook-purple',
    },
    {
      title: 'Usage-based pricing',
      desc: 'Charges depend on the services used, their configuration, the region, and usage.',
      label: 'CHECK COST',
      color: 'text-workbook-teal',
      badgeBg: 'bg-teal-50 dark:bg-teal-950/40 text-workbook-teal',
    },
    {
      title: 'Security controls',
      desc: 'Identity permissions and network rules help control who can manage resources and which connections are allowed.',
      label: 'CONTROL ACCESS',
      color: 'text-workbook-red',
      badgeBg: 'bg-rose-50 dark:bg-rose-950/40 text-workbook-red',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="01"
        chapterTitle="INTRODUCTION &amp; PREREQUISITES"
        pageNumber={1}
        totalPages={4}
        title="What is AWS deployment?"
        intro="AWS deployment makes an application available to people over the internet by running or hosting it on infrastructure provided by Amazon Web Services (AWS)."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: LOCAL DEVELOPMENT VS CLOUD DEPLOYMENT */}
      <section id="local-vs-cloud" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Local Development vs Cloud Deployment
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Before taking an application to production, understand where your code lives and who can see it at each stage:
        </p>

        {/* 3-Column Comparison Table matching Reference Image 1 */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-workbook-border dark:divide-zinc-800">
            {/* Column 1: Local Development */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold tracking-wider text-workbook-blue uppercase">
                    YOUR COMPUTER
                  </span>
                  <Laptop className="w-3.5 h-3.5 text-workbook-blue" />
                </div>
                <h3 className="text-sm font-bold text-workbook-navy dark:text-zinc-100 mb-2">
                  LOCAL DEVELOPMENT
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  The code runs on your laptop, often at an address such as <code className="px-1 py-0.5 rounded text-xs font-mono bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200">localhost:3000</code>. It is normally accessible only from your own device or an appropriately configured local network.
                </p>
              </div>
            </div>

            {/* Column 2: Cloud Deployment */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold tracking-wider text-workbook-orange uppercase">
                    AWS INFRASTRUCTURE
                  </span>
                  <Cloud className="w-3.5 h-3.5 text-workbook-orange" />
                </div>
                <h3 className="text-sm font-bold text-workbook-navy dark:text-zinc-100 mb-2">
                  CLOUD DEPLOYMENT
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  The website files are placed on a computer or hosting service in the cloud. You configure the operating system, web server, and network access needed to serve those files.
                </p>
              </div>
            </div>

            {/* Column 3: Live Application */}
            <div className="p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold tracking-wider text-workbook-green uppercase">
                    INTERNET USERS
                  </span>
                  <Globe className="w-3.5 h-3.5 text-workbook-green" />
                </div>
                <h3 className="text-sm font-bold text-workbook-navy dark:text-zinc-100 mb-2">
                  LIVE APPLICATION
                </h3>
                <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                  Visitors open a public URL or IP address. The web server responds to their browser requests and sends back the website content.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: WHY DO DEVELOPERS USE AWS? */}
      <section id="why-developers-use-aws" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Why Do Developers Use AWS?
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Organizations choose Amazon Web Services for flexible primitives that turn raw infrastructure into resilient web workloads:
        </p>

        {/* 3x2 Grid */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-workbook-border dark:divide-zinc-800 sm:[&>*:not(:nth-child(-n+3))]:border-t sm:[&>*:not(:nth-child(-n+3))]:border-workbook-border dark:sm:[&>*:not(:nth-child(-n+3))]:border-zinc-800 lg:[&>*:not(:nth-child(3n+1))]:border-l lg:[&>*:not(:nth-child(3n+1))]:border-workbook-border dark:lg:[&>*:not(:nth-child(3n+1))]:border-zinc-800">
            {reasons.map((item, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 rounded ${item.badgeBg}`}>
                      {item.label}
                    </span>
                  </div>
                  <h3 className={`text-sm font-bold ${item.color} mb-1.5`}>
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-snug">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400 italic">
          Note: AWS provides the building blocks, but reliability, security, and costs depend on how you configure and monitor your resources.
        </p>
      </section>

      {/* SECTION 3: CLOUD DOES NOT AUTOMATICALLY MEAN FREE */}
      <section id="cloud-does-not-mean-free" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-orange bg-amber-50/70 dark:bg-amber-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase text-amber-700 dark:text-amber-400 mb-2 select-none">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Important: Cloud Does Not Automatically Mean Free</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-100 mb-3">
            Check current account pricing, available credits, storage, data transfer, and public IPv4 charges before launching resources. Do not assume that a small test instance will be free for every account.
          </p>
          <div className="text-xs">
            <a
              href="https://aws.amazon.com/free/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-semibold text-amber-800 dark:text-amber-300 underline underline-offset-4 hover:text-amber-950 transition-colors"
            >
              <span>Explore official AWS Free Tier &amp; Pricing guides</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </section>

      {/* SECTION 4: TODAY'S DEPLOYMENT IN ONE LINE */}
      <section id="todays-deployment-in-one-line" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Today&apos;s Deployment in One Line
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          The diagram below highlights the four essential stages connecting your starter source files to a live visitor:
        </p>

        <DeploymentFlow />
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        next={{
          id: 'intro-ec2-architecture',
          title: 'How the EC2 deployment fits together',
          pageLabel: 'Page 2 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
