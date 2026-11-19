import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { NeoButton } from '../components/ui/NeoButton';
import {
  ShieldCheck,
  ShieldAlert,
  Key,
  Lock,
  Globe,
  FolderLock,
  AlertTriangle,
  ExternalLink,
  Check,
  RotateCcw,
  Sparkles,
  Server,
  FileCode2,
  Terminal,
} from 'lucide-react';

export const SECURITY_PAGE_HEADINGS = [
  { id: 'six-essential-security-habits', text: 'Six Essential Security Habits', level: 2 },
  { id: 'permissions-are-not-the-same', text: 'Permissions Are Not the Same as Network Rules', level: 2 },
  { id: 'shared-responsibility', text: 'Shared Responsibility', level: 2 },
  { id: 'aws-security-guidance', text: 'AWS Security Guidance', level: 2 },
  { id: 'before-you-finish-the-lab', text: 'Before You Finish the Lab', level: 2 },
];

const SAFETY_CHECKS = [
  'The correct workshop account and approved permissions were used.',
  'No secrets or private keys were uploaded to GitHub or the web directory.',
  'SSH access remains restricted to the approved administration network.',
  'Any temporary AWS resources have been reviewed for safe cleanup.',
];

export function SecurityAndPermissionsPage({ onNavigate = () => {} }) {
  const [checkedItems, setCheckedItems] = useState({
    0: false,
    1: false,
    2: false,
    3: false,
  });

  const toggleCheck = (idx) => {
    setCheckedItems((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checkAll = () => {
    setCheckedItems({ 0: true, 1: true, 2: true, 3: true });
  };

  const resetAll = () => {
    setCheckedItems({ 0: false, 1: false, 2: false, 3: false });
  };

  const breadcrumbs = [
    { id: 'overview', label: 'AWS Cloud Launchpad' },
    { id: 'security-and-permissions', label: '06 / Security and Permissions' },
  ];

  const securityPrinciples = [
    {
      title: 'Use authorised accounts',
      category: 'ACCOUNT',
      badgeBg: 'bg-[#67e8f9] text-black border border-black',
      desc: 'Use the learner role or sandbox assigned by the organiser. Do not use or share an AWS account without permission.',
      detail: 'Working strictly within approved workshop boundaries prevents accidental billing surprises or unauthorized administrative changes.',
      icon: ShieldCheck,
    },
    {
      title: 'Least privilege',
      category: 'IAM',
      badgeBg: 'bg-[#fda4af] text-black border border-black',
      desc: 'Grant only the permissions required for the exercise. Avoid using the AWS account root user for routine tasks, and do not request broad administrator access just to bypass a permissions error.',
      detail: 'Note: The AWS account root user controls cloud billing and account lifecycles; it is completely separate from the Linux root/sudo user on an EC2 instance.',
      icon: ShieldAlert,
    },
    {
      title: 'Protect credentials',
      category: 'SECRETS',
      badgeBg: 'bg-[#fde047] text-black border border-black',
      desc: 'Never share the .pem private key, passwords, access keys, or session credentials. Never commit them to GitHub or place them in public website files.',
      detail: 'Private SSH keys must stay secure on your local computer (e.g. chmod 400). Never paste keys into public repos, code comments, or screenshots.',
      icon: Key,
    },
    {
      title: 'Use MFA',
      category: 'SIGN-IN',
      badgeBg: 'bg-[#c084fc] text-black border border-black',
      desc: 'Enable multi-factor authentication wherever available, especially for privileged accounts. Follow the authentication requirements of the approved workshop environment.',
      detail: 'MFA provides a second layer of defense, ensuring compromised passwords alone cannot be used to compromise your cloud environment.',
      icon: Lock,
    },
    {
      title: 'Limit network exposure',
      category: 'NETWORK',
      badgeBg: 'bg-[#fdba74] text-black border border-black',
      desc: 'Restrict SSH on port 22 to My IP or the approved administration network. Open only the application ports needed for the exercise.',
      detail: 'For this static website exercise, public HTTP traffic uses TCP port 80. Do not expose SSH to everyone (0.0.0.0/0) merely to make connection problems easier to bypass.',
      icon: Globe,
    },
    {
      title: 'Protect project data',
      category: 'FILES',
      badgeBg: 'bg-[#a6ff70] text-black border border-black',
      desc: 'Only public website assets belong under /usr/share/nginx/html/. Keep secrets, private configuration, credentials, and unrelated files outside the public document root.',
      detail: 'Files placed in Nginx document root can be fetched directly by anyone on the internet. Obscure filenames do not provide security.',
      icon: FolderLock,
    },
  ];

  const permissionsComparison = [
    {
      control: 'IAM identity/policy',
      question: 'Who can create, modify, or inspect AWS resources?',
      example: 'Can this role launch or terminate EC2 instances?',
      notes: 'Evaluates AWS API requests at the management plane. Controls access to cloud services, not incoming network packets.',
    },
    {
      control: 'Security group',
      question: 'Which network traffic can reach the instance?',
      example: 'Allow HTTP port 80 publicly; restrict SSH port 22 to the approved administration network.',
      notes: 'Acts as a stateful virtual firewall at the virtual network interface level. Does not determine whether an identity can modify AWS resources.',
    },
    {
      control: 'Linux file permissions',
      question: 'Who can read or change files on the server?',
      example: 'Website assets must be readable by Nginx. Private files must not become publicly downloadable.',
      notes: 'Local operating system user, group, and other permissions (chmod/chown) controlling which local processes can access disk files.',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="06"
        chapterTitle="SECURITY AND PERMISSIONS"
        pageNumber={1}
        totalPages={1}
        title="Build safe cloud habits from the beginning"
        intro="Security is not a separate task at the end. The way you sign in, configure permissions, and expose files matters from the first command."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Six Essential Security Habits */}
      <section id="six-essential-security-habits" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
            Six essential security habits
          </h2>
          <span className="text-[11px] font-mono text-slate-500 dark:text-zinc-400">
            CORE PRINCIPLES
          </span>
        </div>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mb-6">
          Build these foundational operational disciplines into your workflow from your very first cloud deployment.
        </p>

        {/* 2-Column by 3-Row Grid of Security Principles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {securityPrinciples.map((item, idx) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={idx}
                whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
                className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 ${item.badgeBg}`}>
                      {item.category}
                    </span>
                    <Icon className="w-4 h-4 text-black dark:text-white" />
                  </div>
                  <h3 className="text-base font-bold text-black dark:text-white mb-1.5 font-sans">
                    {item.title}
                  </h3>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed mb-3">
                    {item.desc}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed italic border-t-2 border-black/10 dark:border-white/10 pt-2.5">
                    {item.detail}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Permissions Are Not the Same as Network Rules */}
      <section id="permissions-are-not-the-same" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-2">
          Permissions are not the same as network rules
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed">
          Beginners often confuse who can modify cloud infrastructure with what packets can reach an instance and which local accounts can read files on disk. These three distinct security boundaries protect different layers:
        </p>

        {/* 3-Column Table */}
        <div className="overflow-x-auto border-2 border-black dark:border-white shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <table className="w-full text-left text-xs border-collapse min-w-[620px]">
            <thead>
              <tr className="bg-black text-white dark:bg-zinc-800 border-b-2 border-black dark:border-white select-none">
                <th className="py-3 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[28%]">
                  CONTROL
                </th>
                <th className="py-3 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[34%]">
                  QUESTION IT ANSWERS
                </th>
                <th className="py-3 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[38%]">
                  EXAMPLE
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black dark:divide-white bg-white dark:bg-zinc-900">
              {permissionsComparison.map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    idx % 2 === 0
                      ? 'bg-white dark:bg-zinc-900'
                      : 'bg-zinc-50 dark:bg-zinc-800/40'
                  } hover:bg-[#a6ff70]/10 dark:hover:bg-zinc-800`}
                >
                  <td className="py-3.5 px-4 align-top border-r-2 border-black dark:border-white">
                    <div className="font-bold text-black dark:text-white">
                      {row.control}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                      {row.notes}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top text-zinc-800 dark:text-zinc-200 font-medium leading-relaxed italic border-r-2 border-black dark:border-white">
                    "{row.question}"
                  </td>
                  <td className="py-3.5 px-4 align-top text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    {row.example}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 3: Shared Responsibility */}
      <section id="shared-responsibility" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Shared Responsibility
        </h2>

        {/* Neo-brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] bg-[#fda4af]/20 dark:bg-rose-950/30 text-black dark:text-zinc-100">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#fda4af] text-black shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                SHARED RESPONSIBILITY MODEL
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                AWS secures the underlying cloud infrastructure. You are still responsible for account access, permissions, deployed data, application configuration, and how you expose services.
              </p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed pt-1">
                Using AWS does not automatically make your application secure. You must configure the resources and protect the content you deploy.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Official AWS Security Guidance */}
      <section id="aws-security-guidance" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-3">
          AWS Security Guidance
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed">
          Consult these authoritative AWS guides to deepen your understanding of cloud security architectures:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
          >
            <div>
              <div className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-[#67e8f9] text-black border border-black mb-2">
                IDENTITY & ACCESS
              </div>
              <a
                href="https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-black dark:text-white hover:underline flex items-center gap-1.5 mb-2 group"
              >
                <span>AWS IAM security best practices</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                MFA, temporary credentials, protection of privileged accounts, and least-privilege access.
              </p>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex flex-col justify-between"
          >
            <div>
              <div className="inline-block text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-[#fde047] text-black border border-black mb-2">
                FIREWALL & TRAFFIC
              </div>
              <a
                href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/security-group-rules-reference.html"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold text-black dark:text-white hover:underline flex items-center gap-1.5 mb-2 group"
              >
                <span>EC2 security group rules</span>
                <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </a>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Official rule specifications for Web servers, SSH, CIDR blocks, and stateful tracking.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5: Before You Finish the Lab */}
      <section id="before-you-finish-the-lab" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight">
              Before you finish the lab
            </h2>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
              Verify these safety checks to confirm that your workshop session follows security best practices and leaves no exposed credentials.
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
          {SAFETY_CHECKS.map((text, idx) => {
            const isChecked = checkedItems[idx];
            return (
              <motion.label
                key={idx}
                htmlFor={`safety-check-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]'
                    : 'bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50'
                }`}
              >
                <input
                  type="checkbox"
                  id={`safety-check-${idx}`}
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

                <span
                  className={`text-xs sm:text-sm font-medium leading-relaxed transition-colors ${
                    isChecked
                      ? 'text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2'
                      : 'text-zinc-800 dark:text-zinc-200'
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
          id: 'challenge-checklist',
          title: 'Independent checklist — hints, not the complete solution',
          pageLabel: 'Chapter 05 • Page 2',
        }}
        next={{
          id: 'cost-and-cleanup',
          title: 'Finish the lab without surprise charges',
          pageLabel: 'Chapter 07',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}