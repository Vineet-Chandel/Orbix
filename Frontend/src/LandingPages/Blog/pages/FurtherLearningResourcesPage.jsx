import React from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import {
  ExternalLink,
  BookOpen,
  Sparkles,
  Compass,
  ArrowRight,
  ShieldCheck,
  Server,
  Cloud,
  Layers,
  Database,
  Cpu,
  Activity,
  Globe,
  Lock,
} from 'lucide-react';

export const FURTHER_LEARNING_HEADINGS = [
  { id: 'official-aws-documentation-library', text: 'Official AWS Documentation Library', level: 2 },
  { id: 'what-should-i-learn-next', text: 'What Should I Learn Next?', level: 2 },
  { id: 'next-learning-path', text: 'Next Learning Path', level: 2 },
];

const AWS_DOCUMENTATION_RESOURCES = [
  {
    name: 'Launch an EC2 instance',
    url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/EC2_GetStarted.html',
    description: 'Learn how to launch and configure a virtual server. Consult this guide when you need a deeper understanding of AMI choices, instance types, and launch templates.',
  },
  {
    name: 'Connect to a Linux instance with SSH',
    url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/connect-linux-inst-ssh.html',
    description: 'Understand connection prerequisites, private keys, usernames, and security-group rules. Essential troubleshooting reference when SSH authentications fail.',
  },
  {
    name: 'Security-group rules',
    url: 'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html',
    description: 'Reference for SSH, HTTP, HTTPS, and other inbound or outbound ports. Authoritative specifications for configuring stateful firewall boundaries.',
  },
  {
    name: 'Amazon Linux 2023 package management',
    url: 'https://docs.aws.amazon.com/linux/al2023/ug/package-management.html',
    description: 'Learn DNF, the default package manager. Useful for installing, upgrading, and maintaining software packages and system dependencies on AL2023.',
  },
  {
    name: 'Amazon VPC user guide',
    url: 'https://docs.aws.amazon.com/vpc/latest/userguide/',
    description: 'Learn about subnets, routes, internet gateways, and cloud networking. Visit this guide to diagnose why a running instance cannot route traffic to the internet.',
  },
  {
    name: 'IAM security best practices',
    url: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html',
    description: 'Learn about MFA, temporary credentials, and least-privilege access. Recommended practices for protecting administrator and programmatic access.',
  },
  {
    name: 'AWS Budgets',
    url: 'https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html',
    description: 'Learn how to create cost or usage budgets and configure notifications. Helps monitor account spending and triggers alerts before unexpected costs accumulate.',
  },
  {
    name: 'Amazon S3 static website hosting',
    url: 'https://docs.aws.amazon.com/AmazonS3/latest/userguide/WebsiteHosting.html',
    description: 'Compare static hosting options and learn the relevant service limitations. An alternative, serverless object-storage path for static HTML/CSS/JS delivery.',
  },
  {
    name: 'Amazon RDS',
    url: 'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/',
    description: 'Learn about managed relational databases. Highly relevant when your web applications evolve beyond static files to require PostgreSQL or MySQL.',
  },
  {
    name: 'AWS Lambda getting started',
    url: 'https://docs.aws.amazon.com/lambda/latest/dg/getting-started.html',
    description: 'Explore event-driven compute without managing a traditional server for each function. The entry point to serverless microservices and automated tasks.',
  },
  {
    name: 'Amazon CloudWatch',
    url: 'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/',
    description: 'Explore metrics, logs, alarms, and monitoring. Gain observable operational evidence into instance health, CPU utilization, and system events.',
  },
  {
    name: 'Amazon Route 53',
    url: 'https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/',
    description: 'Understand DNS, domain names, and routing traffic to destinations. Natural next step for binding custom domain names to public EC2 IP addresses.',
  },
  {
    name: 'CloudFront HTTPS',
    url: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-https.html',
    description: 'Learn how HTTPS and TLS can protect connections when delivering content. Global content delivery network integration with free SSL/TLS certificates via ACM.',
  },
];

const LEARNING_STAGES = [
  {
    stage: 'STAGE 1',
    title: 'Strengthen the basics',
    badgeBg: 'bg-[#67e8f9] text-black border border-black',
    items: [
      'EC2 and SSH authentication',
      'Security group rules & ports',
      'Amazon Linux 2023 DNF management',
      'VPC subnets & Internet Gateways',
      'IAM security & least privilege',
    ],
  },
  {
    stage: 'STAGE 2',
    title: 'Operate safely',
    badgeBg: 'bg-[#fde047] text-black border border-black',
    items: [
      'AWS Budgets & usage alerts',
      'CloudWatch metrics & log inspection',
      'S3 static website hosting comparison',
    ],
  },
  {
    stage: 'STAGE 3',
    title: 'Build beyond static hosting',
    badgeBg: 'bg-[#a6ff70] text-black border border-black',
    items: [
      'Route 53 & custom DNS domains',
      'CloudFront CDN & HTTPS/TLS',
      'AWS Lambda serverless compute',
      'Amazon RDS managed databases',
    ],
  },
];

export function FurtherLearningResourcesPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'overview', label: 'AWS Cloud Launchpad' },
    { id: 'further-learning', label: '08 / Further Learning Resources' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="08"
        chapterTitle="FURTHER LEARNING RESOURCES"
        pageNumber={1}
        totalPages={1}
        title="Official AWS documentation to keep learning"
        intro="Use these trusted references after the workshop. Console labels and pricing can change; open the live documentation before repeating a deployment."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Official AWS Documentation Library */}
      <section id="official-aws-documentation-library" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight">
            Official AWS Documentation Library
          </h2>
          <span className="text-[11px] font-mono font-bold bg-[#fde047] text-black border border-black px-2 py-0.5 uppercase">
            13 CURATED RUNBOOKS
          </span>
        </div>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          Every link below connects directly to authoritative AWS User Guides for core infrastructure primitives.
        </p>

        {/* Clean, Scannable Reference List */}
        <div className="space-y-3">
          {AWS_DOCUMENTATION_RESOURCES.map((item, idx) => (
            <motion.div
              key={idx}
              whileHover={{ x: -2, y: -2, boxShadow: '4px 4px 0px #000000' }}
              className="p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] transition-colors"
            >
              <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 sm:gap-4 mb-1.5">
                <span className="font-sans font-bold text-sm sm:text-base text-black dark:text-white">
                  {item.name}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono font-bold text-black dark:text-white hover:underline break-all inline-flex items-center gap-1.5 shrink-0 group"
                >
                  <span className="truncate max-w-[280px] sm:max-w-[320px]">{item.url}</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SECTION 2: What Should I Learn Next? */}
      <section id="what-should-i-learn-next" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-2">
          What should I learn next?
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-6">
          A progressive sequence to guide your self-directed cloud learning journey after today's workshop:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {LEARNING_STAGES.map((stage, idx) => (
            <motion.div
              key={idx}
              whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
              className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 ${stage.badgeBg}`}>
                    {stage.stage}
                  </span>
                </div>
                <h3 className="text-base font-bold text-black dark:text-white mb-3 font-sans">
                  {stage.title}
                </h3>
                <ul className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
                  {stage.items.map((bullet, bIdx) => (
                    <li key={bIdx} className="flex items-start gap-2">
                      <span className="w-2 h-2 bg-black dark:bg-white mt-1 shrink-0" />
                      <span>{bullet}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>

        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-4 italic text-center font-mono">
          Note: This is a suggested educational progression, not a formal AWS certification roadmap.
        </p>
      </section>

      {/* SECTION 3: Next Learning Path Callout */}
      <section id="next-learning-path" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Next Learning Path
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 sm:p-6 border-2 border-black dark:border-white bg-[#67e8f9]/20 dark:bg-cyan-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#67e8f9] text-black shrink-0">
              <Compass className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                NEXT LEARNING PATH
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                After basic static hosting, learn HTTPS and custom domains, automated Git deployments, application logs and monitoring, then backend hosting and databases. Try one new AWS service at a time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'cost-and-cleanup',
          title: 'Finish the lab without surprise charges',
          pageLabel: 'Chapter 07',
        }}
        next={{
          id: 'instructor-checklist',
          title: 'Make the workshop reproducible',
          pageLabel: 'Chapter 09',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}