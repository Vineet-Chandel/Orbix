import React from 'react';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { ExternalLink, BookOpen, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

export const PAGE_3_HEADINGS = [
  { id: 'aws-services-students-should-recognize', text: 'AWS Services Students Should Recognize', level: 2 },
  { id: 'quick-memory-trick', text: 'Quick Memory Trick', level: 2 },
  { id: 'official-documentation', text: 'Official Documentation', level: 2 },
];

export function AwsServicesPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'intro-deployment', label: 'Introduction & Prerequisites' },
    { id: 'intro-aws-services', label: 'AWS services: learn the job, not just the name' },
  ];

  const services = [
    {
      num: 1,
      name: 'Amazon EC2',
      category: 'COMPUTE',
      badgeBg: 'bg-[#67e8f9]',
      desc: 'Provides a cloud virtual server. You choose an operating system and configure computing capacity, storage, and networking.',
    },
    {
      num: 2,
      name: 'AWS Region',
      category: 'LOCATION',
      badgeBg: 'bg-[#a6ff70]',
      desc: 'A geographic area in which AWS operates infrastructure and services. (Note: Mumbai is ap-south-1. Always select the Region assigned by your workshop organizers).',
    },
    {
      num: 3,
      name: 'Availability Zone (AZ)',
      category: 'RESILIENCE',
      badgeBg: 'bg-[#a6ff70]',
      desc: 'An isolated physical data center location within a Region. Using multiple Availability Zones can improve resilience when a system is designed to use them.',
    },
    {
      num: 4,
      name: 'AWS IAM',
      category: 'PERMISSIONS',
      badgeBg: 'bg-[#fda4af]',
      desc: 'Identity and Access Management controls which identities can perform which actions on AWS resources. It is your security boundary for administrative access.',
    },
    {
      num: 5,
      name: 'Amazon VPC',
      category: 'NETWORK',
      badgeBg: 'bg-[#67e8f9]',
      desc: 'Provides a logically isolated virtual network for your AWS resources, giving you control over IP ranges, subnets, and routing tables.',
    },
    {
      num: 6,
      name: 'Security group',
      category: 'TRAFFIC',
      badgeBg: 'bg-[#fde047]',
      desc: 'Acts as a stateful virtual firewall, controlling permitted inbound and outbound network traffic for your associated compute instances.',
    },
    {
      num: 7,
      name: 'Amazon S3',
      category: 'STORAGE',
      badgeBg: 'bg-[#a6ff70]',
      desc: 'Provides highly scalable object storage for files, media, backups, data archives, and static web assets.',
    },
    {
      num: 8,
      name: 'Amazon RDS',
      category: 'DATABASE',
      badgeBg: 'bg-[#67e8f9]',
      desc: 'Provides managed relational database services, including engines such as PostgreSQL, MySQL, MariaDB, and Aurora.',
    },
    {
      num: 9,
      name: 'Elastic Load Balancing',
      category: 'TRAFFIC',
      badgeBg: 'bg-[#fde047]',
      desc: 'Automatically distributes incoming application traffic across multiple healthy compute targets, such as EC2 instances.',
    },
    {
      num: 10,
      name: 'Amazon CloudWatch',
      category: 'OBSERVABILITY',
      badgeBg: 'bg-[#a6ff70]',
      desc: 'Collects operational metrics, log files, and customizable alarms that help you monitor, detect, and troubleshoot system health.',
    },
    {
      num: 11,
      name: 'AWS Lambda',
      category: 'SERVERLESS',
      badgeBg: 'bg-[#fda4af]',
      desc: 'Runs backend code directly in response to events or HTTP requests without requiring you to provision or patch a persistent virtual server.',
    },
    {
      num: 12,
      name: 'Amazon Route 53',
      category: 'DNS',
      badgeBg: 'bg-[#67e8f9]',
      desc: 'A scalable cloud Domain Name System (DNS) web service that translates readable names (like example.com) into numeric IP addresses.',
    },
    {
      num: 13,
      name: 'Amazon CloudFront',
      category: 'DELIVERY',
      badgeBg: 'bg-[#fda4af]',
      desc: 'A global Content Delivery Network (CDN) that securely caches and delivers web content to visitors with low latency from edge locations.',
    },
    {
      num: 14,
      name: 'AWS Budgets',
      category: 'COST',
      badgeBg: 'bg-[#fb923c]',
      desc: 'Tracks spending or usage against customized thresholds and dispatches alert notifications. Budget alerts do not automatically stop resources.',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="01"
        chapterTitle="INTRODUCTION &amp; PREREQUISITES"
        pageNumber={3}
        totalPages={4}
        title="AWS services: learn the job, not just the name"
        intro="You do not need to configure every AWS service before your first deployment. Start by understanding EC2, networking, security groups, IAM, and CloudWatch. Learn to recognize other services without feeling that you must use them all today."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: 14 AWS SERVICES GRID */}
      <section id="aws-services-students-should-recognize" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-zinc-100 mb-4 tracking-tight">
          AWS Services Students Should Recognize
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6 font-sans">
          Review these foundational cloud building blocks to build conceptual clarity before launching infrastructure:
        </p>

        {/* 2-Column Responsive Neo-Brutalist Service Glossary Grid */}
        <div className="border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff] overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y-2 md:divide-y-0 divide-black dark:divide-zinc-800 md:[&>*:not(:nth-child(-n+2))]:border-t-2 md:[&>*:not(:nth-child(-n+2))]:border-black dark:md:[&>*:not(:nth-child(-n+2))]:border-zinc-800 md:[&>*:nth-child(2n)]:border-l-2 md:[&>*:nth-child(2n)]:border-black dark:md:[&>*:nth-child(2n)]:border-zinc-800">
            {services.map((svc) => (
              <motion.div
                key={svc.num}
                whileHover={{ backgroundColor: '#f4f3ee' }}
                className="p-5 sm:p-6 flex flex-col justify-between transition-colors bg-white dark:bg-zinc-900"
              >
                <div>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-mono font-black text-black dark:text-white">
                      #{String(svc.num).padStart(2, '0')}
                    </span>
                    <span className={`text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 border border-black text-black ${svc.badgeBg}`}>
                      {svc.category}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-black dark:text-white mb-1.5 tracking-tight">
                    {svc.name}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed font-sans">
                    {svc.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: QUICK MEMORY TRICK */}
      <section id="quick-memory-trick" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-zinc-100 mb-4 tracking-tight">
          Quick Memory Trick
        </h2>

        <div className="border-2 border-black dark:border-white bg-[#fde047]/15 dark:bg-[#fde047]/10 p-5 sm:p-6 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff]">
          <div className="flex items-center gap-2 mb-2 select-none">
            <span className="p-1 bg-[#fde047] text-black border border-black shadow-[1px_1px_0px_#000]">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            <span className="text-[10px] sm:text-[11px] font-bold font-mono tracking-wider uppercase bg-[#fde047] text-black px-2 py-0.5 border border-black">
              QUICK MEMORY TRICK
            </span>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-black dark:text-zinc-100 font-bold mb-3 font-sans">
            EC2 runs a virtual machine. S3 stores objects. RDS manages relational databases. Lambda runs event-driven code. CloudWatch observes systems. Route 53 handles DNS. IAM grants permissions. Security groups filter network traffic.
          </p>

          <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed pt-2 border-t-2 border-black/10 dark:border-zinc-800 font-sans">
            For this workshop, focus first on <strong>EC2</strong>, the <strong>operating system (Amazon Linux 2023)</strong>, <strong>Nginx</strong>, <strong>VPC networking</strong>, <strong>security groups</strong>, and <strong>IAM</strong>.
          </p>
        </div>
      </section>

      {/* SECTION 3: OFFICIAL DOCUMENTATION */}
      <section id="official-documentation" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-2">
          Official Documentation
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Want to explore deeper? Bookmark these authoritative guides from the official AWS documentation library:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="https://docs.aws.amazon.com/us_en/AWSEC2/latest/UserGuide/ec2-security-groups.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-lg border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors group"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-100 group-hover:text-workbook-blue transition-colors">
                EC2 Security Groups User Guide
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Inbound &amp; outbound stateful rules
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-workbook-blue shrink-0 ml-2" />
          </a>

          <a
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-iam.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-lg border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors group"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-100 group-hover:text-workbook-blue transition-colors">
                EC2 Identity &amp; Access Management
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                IAM instance profiles and role policies
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-workbook-blue shrink-0 ml-2" />
          </a>

          <a
            href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-lg border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors group"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-100 group-hover:text-workbook-blue transition-colors">
                Security Group Rules Reference
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                Standard ports for web servers, databases &amp; SSH
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-workbook-blue shrink-0 ml-2" />
          </a>

          <a
            href="https://docs.aws.amazon.com/linux/al2023/ug/tutorials-al2023.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between p-3.5 rounded-lg border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-850 transition-colors group"
          >
            <div>
              <div className="text-xs font-bold text-workbook-navy dark:text-zinc-100 group-hover:text-workbook-blue transition-colors">
                Amazon Linux 2023 Tutorials
              </div>
              <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                dnf package manager &amp; systemd administration
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-workbook-blue shrink-0 ml-2" />
          </a>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'intro-ec2-architecture',
          title: 'How the EC2 deployment fits together',
          pageLabel: 'Page 2 of 4',
        }}
        next={{
          id: 'intro-preflight',
          title: 'Preflight: tools, repository, account and permissions',
          pageLabel: 'Page 4 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
