import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { NeoButton } from '../components/ui/NeoButton';
import {
  DollarSign,
  AlertTriangle,
  ExternalLink,
  Check,
  RotateCcw,
  Sparkles,
  Server,
  HardDrive,
  Globe,
  Bell,
  Trash2,
  Layers,
  ArrowRight,
  ShieldCheck,
  Info,
} from 'lucide-react';

export const COST_AND_CLEANUP_HEADINGS = [
  { id: 'before-deployment', text: 'Before Deployment', level: 2 },
  { id: 'cleanup-after-the-workshop', text: 'Cleanup After the Workshop', level: 2 },
  { id: 'stopping-is-not-the-same', text: 'Stopping Is Not the Same as Cleanup', level: 2 },
  { id: 'official-aws-resources', text: 'Official AWS Resources', level: 2 },
  { id: 'before-you-leave-aws', text: 'Before You Leave AWS', level: 2 },
];

const BEFORE_DEPLOYMENT_ITEMS = [
  {
    title: 'Check the EC2 instance type and applicable compute cost.',
    desc: "Compute charges depend on the selected instance type (such as t2.micro or t3.micro), total active hours, the chosen AWS Region, and your account's applicable pricing tier.",
    icon: Server,
  },
  {
    title: 'Check EBS storage volumes/snapshots and public IPv4/networking costs.',
    desc: 'Attached Amazon EBS storage volumes, stored snapshots, and assigned in-use or idle public IPv4 addresses incur separate hourly or gigabyte charges.',
    icon: HardDrive,
  },
  {
    title: 'Review any credits, usage allowance and account-specific Free Tier eligibility.',
    desc: 'Promotional credits and AWS Free Tier allowances depend on your account age and enrollment. Never assume any virtual machine or cloud deployment is unconditionally free.',
    icon: DollarSign,
  },
  {
    title: 'Create or check a budget alert when permitted. A budget alert monitors usage; it does not guarantee an automatic shutdown or zero bill.',
    desc: 'AWS Budgets and Cost Anomaly Detection track estimated spending and send alert notifications, but they do not automatically power down running instances. If using an instructor-managed sandbox without billing permissions, follow the organizer\'s guidance.',
    icon: Bell,
  },
  {
    title: 'Ask whether this is a shared training account and follow the organiser\'s resource naming rules.',
    desc: 'In multi-user training environments, always prefix resources with your assigned name or student ID. Never modify, stop, or delete resources belonging to instructors or other students.',
    icon: ShieldCheck,
  },
];

const CLEANUP_ITEMS = [
  {
    title: 'Keep the URL/screenshot evidence required for the assignment.',
    desc: 'Preserve all required URLs, terminal output, and browser screenshots before modifying cloud resources. Ensure no private SSH keys, access tokens, passwords, or account numbers are visible in saved images.',
    icon: Sparkles,
  },
  {
    title: 'Open EC2 → Instances, select only your workshop instance, and terminate it when the instructor confirms it is no longer needed.',
    desc: 'Stopping an instance shuts down the OS to pause compute charges, but retains the root EBS volume and any associated Elastic IP. Terminating permanently deletes the virtual machine. Always verify instructor approval before termination.',
    icon: Trash2,
  },
  {
    title: 'Review retained EBS volumes, snapshots, Elastic IPs, load balancers or other resources created during the lab.',
    desc: 'Inspect the EC2 and VPC dashboards for unattached EBS storage volumes, unassociated Elastic IP addresses (which incur charges when allocated but unused), and custom security groups created for the exercise.',
    icon: Layers,
  },
  {
    title: 'Verify resources are no longer needed before deleting them. Termination is irreversible.',
    desc: 'Double-check the instance ID, tags, and state before clicking Terminate. Terminating cannot be undone. Never delete shared VPC gateways, route tables, or instructor infrastructure.',
    icon: AlertTriangle,
  },
  {
    title: 'Check Billing and Cost Management for remaining usage/charges.',
    desc: 'Visit the AWS Billing and Cost Management console to review month-to-date charges and active usage. Note that AWS billing telemetry typically takes 8 to 24 hours to reflect recent resource activity.',
    icon: Globe,
  },
];

const FINAL_CHECK_ITEMS = [
  'Required submission evidence saved.',
  'Workshop EC2 instance reviewed.',
  'Cleanup approved and completed where required.',
  'Associated resources reviewed.',
  'Billing information checked.',
];

export function CostAwarenessAndCleanupPage({ onNavigate = () => {} }) {
  // Section 1 Checklist State
  const [beforeState, setBeforeState] = useState({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  });

  // Section 2 Checklist State
  const [cleanupState, setCleanupState] = useState({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  });

  // Section 5 Checklist State
  const [finalState, setFinalState] = useState({
    0: false,
    1: false,
    2: false,
    3: false,
    4: false,
  });

  const toggleBefore = (idx) => setBeforeState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const toggleCleanup = (idx) => setCleanupState((prev) => ({ ...prev, [idx]: !prev[idx] }));
  const toggleFinal = (idx) => setFinalState((prev) => ({ ...prev, [idx]: !prev[idx] }));

  const checkAllBefore = () => setBeforeState({ 0: true, 1: true, 2: true, 3: true, 4: true });
  const resetBefore = () => setBeforeState({ 0: false, 1: false, 2: false, 3: false, 4: false });

  const checkAllCleanup = () => setCleanupState({ 0: true, 1: true, 2: true, 3: true, 4: true });
  const resetCleanup = () => setCleanupState({ 0: false, 1: false, 2: false, 3: false, 4: false });

  const checkAllFinal = () => setFinalState({ 0: true, 1: true, 2: true, 3: true, 4: true });
  const resetFinal = () => setFinalState({ 0: false, 1: false, 2: false, 3: false, 4: false });

  const breadcrumbs = [
    { id: 'overview', label: 'AWS Cloud Launchpad' },
    { id: 'cost-and-cleanup', label: '07 / Cost & Cleanup' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="07"
        chapterTitle="COST AWARENESS AND RESOURCE CLEANUP"
        pageNumber={1}
        totalPages={1}
        title="Finish the lab without surprise charges"
        intro="Pricing varies by Region, instance type, account plan, free-use eligibility, credits and usage. Never assume an instance is free because it is small."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Before Deployment */}
      <section id="before-deployment" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
              Before deployment
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Review these cost-awareness checkpoints before launching infrastructure in AWS.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <NeoButton
              variant="white"
              size="sm"
              onClick={checkAllBefore}
            >
              Check All
            </NeoButton>
            <NeoButton
              variant="white"
              size="sm"
              onClick={resetBefore}
              icon={RotateCcw}
            >
              Reset
            </NeoButton>
          </div>
        </div>

        <div className="space-y-3">
          {BEFORE_DEPLOYMENT_ITEMS.map((item, idx) => {
            const isChecked = beforeState[idx];
            const Icon = item.icon;
            return (
              <motion.label
                key={idx}
                htmlFor={`before-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]'
                    : 'bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50'
                }`}
              >
                <input
                  type="checkbox"
                  id={`before-${idx}`}
                  checked={isChecked}
                  onChange={() => toggleBefore(idx)}
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
                    <Icon className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
                    <span
                      className={`text-xs sm:text-sm font-bold transition-colors ${
                        isChecked
                          ? 'text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.label>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Cleanup After the Workshop */}
      <section id="cleanup-after-the-workshop" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight">
              Cleanup after the workshop
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1">
              Follow these steps to safely dismantle resources and prevent unexpected ongoing charges.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <NeoButton
              variant="white"
              size="sm"
              onClick={checkAllCleanup}
            >
              Check All
            </NeoButton>
            <NeoButton
              variant="white"
              size="sm"
              onClick={resetCleanup}
              icon={RotateCcw}
            >
              Reset
            </NeoButton>
          </div>
        </div>

        <div className="space-y-3">
          {CLEANUP_ITEMS.map((item, idx) => {
            const isChecked = cleanupState[idx];
            const Icon = item.icon;
            return (
              <motion.label
                key={idx}
                htmlFor={`cleanup-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]'
                    : 'bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50'
                }`}
              >
                <input
                  type="checkbox"
                  id={`cleanup-${idx}`}
                  checked={isChecked}
                  onChange={() => toggleCleanup(idx)}
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
                    <Icon className="w-3.5 h-3.5 text-black dark:text-white shrink-0" />
                    <span
                      className={`text-xs sm:text-sm font-bold transition-colors ${
                        isChecked
                          ? 'text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {item.title}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </motion.label>
            );
          })}
        </div>
      </section>

      {/* SECTION 3: Stopping Is Not the Same as Cleanup */}
      <section id="stopping-is-not-the-same" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-4">
          Stopping Is Not the Same as Cleanup
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#fde047]/20 dark:bg-amber-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="flex items-start gap-3">
            <div className="p-2 border-2 border-black bg-[#fde047] text-black shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div className="space-y-2">
              <div className="inline-block text-[10px] font-mono font-bold tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black">
                STOPPING ≠ CLEANUP
              </div>
              <p className="text-xs sm:text-sm leading-relaxed text-black dark:text-zinc-100 font-bold">
                Stopping an EC2 instance may stop compute charges but does not necessarily remove storage or every other charge. Terminating the instance may also leave separately retained resources. Follow the workshop cleanup instructions and review the account.
              </p>
              <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed pt-1">
                Before stopping or terminating anything, confirm that you have saved your required evidence and that the resource belongs to your workshop.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 4: Official AWS Resources */}
      <section id="official-aws-resources" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-3">
          Official AWS Resources
        </h2>
        <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mb-5 leading-relaxed">
          Official AWS documentation for budget management and safe resource termination:
        </p>

        <div className="space-y-4">
          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <a
                  href="https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-create.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-black dark:text-white hover:underline inline-flex items-center gap-1.5 mb-1.5 group"
                >
                  <span>Create an AWS budget</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Track costs and configure notifications. Budgets help monitor account spending, but alerts do not automatically guarantee that resources stop or that the final bill remains below a chosen amount.
                </p>
              </div>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ x: -2, y: -2, boxShadow: '6px 6px 0px #000000' }}
            className="p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <a
                  href="https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/terminating-instances.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-black dark:text-white hover:underline inline-flex items-center gap-1.5 mb-1.5 group"
                >
                  <span>Terminate an EC2 instance</span>
                  <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </a>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                  Official cleanup steps. Step-by-step guidance for safely terminating Amazon EC2 instances and reviewing delete-on-termination settings for attached volumes.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* SECTION 5: Before You Leave AWS */}
      <section id="before-you-leave-aws" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
              Before you leave AWS
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Your lab is finished only after you have preserved required evidence, checked the resources you created, followed the approved cleanup process, and reviewed the account for remaining usage.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <NeoButton
              variant="white"
              size="sm"
              onClick={checkAllFinal}
            >
              Check All
            </NeoButton>
            <NeoButton
              variant="white"
              size="sm"
              onClick={resetFinal}
              icon={RotateCcw}
            >
              Reset
            </NeoButton>
          </div>
        </div>

        <div className="space-y-3">
          {FINAL_CHECK_ITEMS.map((text, idx) => {
            const isChecked = finalState[idx];
            return (
              <motion.label
                key={idx}
                htmlFor={`final-${idx}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? "bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]"
                    : "bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50"
                }`}
              >
                <input
                  type="checkbox"
                  id={`final-${idx}`}
                  checked={isChecked}
                  onChange={() => toggleFinal(idx)}
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
                  className={`text-xs sm:text-sm font-medium leading-relaxed transition-colors ${
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
          id: 'security-and-permissions',
          title: 'Build safe cloud habits from the beginning',
          pageLabel: 'Chapter 06',
        }}
        next={{
          id: 'further-learning',
          title: 'Official AWS documentation to keep learning',
          pageLabel: 'Chapter 08',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}