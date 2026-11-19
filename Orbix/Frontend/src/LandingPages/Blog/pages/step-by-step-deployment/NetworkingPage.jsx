import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { ShieldCheck, ShieldAlert, CheckCircle2, Camera, Info, Server, Globe } from 'lucide-react';

export const DEPLOY_PAGE_2_HEADINGS = [
  { id: 'understand-the-required-inbound-rules', text: 'Understand the Required Inbound Rules', level: 2 },
  { id: 'do-not-open-ssh-to-everyone', text: 'Do Not Open SSH to Everyone', level: 2 },
  { id: 'step-3-configure-networking', text: 'Step 3 — Configure Networking', level: 2 },
  { id: 'step-4-launch-and-confirm-readiness', text: 'Step 4 — Launch and Confirm Readiness', level: 2 },
  { id: 'screenshot-targets-2-and-3', text: 'Screenshot Targets 2 + 3', level: 2 },
];

export function NetworkingPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'deploy-inspect-and-launch', label: 'Step-by-Step Deployment' },
    { id: 'deploy-networking', label: 'Network Rules & Security' },
  ];

  const rules = [
    {
      type: 'SSH',
      port: '22',
      source: 'My IP / approved administration network',
      purpose: 'Lets the administrator connect to the Linux server securely via terminal.',
      badge: 'ADMIN ACCESS',
      color: 'text-workbook-orange',
    },
    {
      type: 'HTTP',
      port: '80',
      source: 'Anywhere IPv4 (0.0.0.0/0)',
      purpose: 'Lets public visitors open the workshop website in their web browser.',
      badge: 'PUBLIC INGRESS',
      color: 'text-workbook-green',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="02"
        chapterTitle="STEP-BY-STEP DEPLOYMENT"
        pageNumber={2}
        totalPages={4}
        title="Network rules: let visitors in, keep administration restricted"
        intro="A security group behaves like a virtual firewall. It controls which network traffic is allowed to reach the instance."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: UNDERSTAND THE REQUIRED INBOUND RULES */}
      <section id="understand-the-required-inbound-rules" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Understand the Required Inbound Rules
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Security groups default to blocking all inbound traffic. We must explicitly define which ports to open, who may connect, and why:
        </p>

        {/* 4-Column Table */}
        <div className="overflow-x-auto rounded-xl border border-workbook-border dark:border-zinc-800 shadow-xs mb-4">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="bg-workbook-navy text-white text-xs font-mono uppercase tracking-wider">
                <th className="py-3 px-4 font-semibold">Rule</th>
                <th className="py-3 px-4 font-semibold">Port</th>
                <th className="py-3 px-4 font-semibold">Source</th>
                <th className="py-3 px-4 font-semibold">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-workbook-border dark:divide-zinc-800">
              {rules.map((rule, idx) => (
                <tr
                  key={idx}
                  className={idx % 2 === 1 ? 'bg-workbook-altRow dark:bg-zinc-900/50' : 'bg-white dark:bg-zinc-950'}
                >
                  <td className="py-3.5 px-4 font-bold text-workbook-navy dark:text-zinc-100">
                    <span className={rule.color}>{rule.type}</span>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs font-bold text-slate-800 dark:text-zinc-200">
                    TCP {rule.port}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-600 dark:text-zinc-400">
                    {rule.source}
                  </td>
                  <td className="py-3.5 px-4 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                    {rule.purpose}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
          Opening HTTP access to the internet is intentional for this basic public website exercise. Administrative access is completely different and should remain restricted. Where the assigned environment uses IPv6, the instructor will determine whether an additional HTTP IPv6 rule (<code className="font-mono text-xs">::/0</code>) is required.
        </p>
      </section>

      {/* SECTION 2: DO NOT OPEN SSH TO EVERYONE */}
      <section id="do-not-open-ssh-to-everyone" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-red bg-rose-50/70 dark:bg-rose-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase text-workbook-red mb-2 select-none">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>DO NOT OPEN SSH TO EVERYONE</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-100 mb-2">
            Keep SSH port 22 restricted to <strong>My IP</strong> or the approved administration network. Do not use <code className="font-mono text-xs bg-white dark:bg-zinc-900 px-1 rounded font-bold">0.0.0.0/0</code> for SSH just because it is easier.
          </p>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">
            If your local network changes and SSH stops working, verify your current IP and update the security group rule rather than making SSH accessible to the entire internet.
          </p>
        </div>
      </section>

      {/* SECTION 3: STEP 3 — CONFIGURE NETWORKING */}
      <section id="step-3-configure-networking" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 3 — Configure networking
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Follow these sequential actions in the EC2 Console Network Settings panel:
        </p>

        {/* Ordered Checklist */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs mb-4">
          <ol className="space-y-3.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                1
              </span>
              <span>In the EC2 launch page, choose <strong>Create security group</strong> (or select the workshop-designated group).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                2
              </span>
              <span>Configure an inbound rule for <strong>SSH</strong> on TCP port 22, restricted to your IP address (select <em>My IP</em>) or the organiser-approved administration network.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                3
              </span>
              <span>Configure an inbound rule for <strong>HTTP</strong> on TCP port 80, with source <code className="font-mono text-xs">0.0.0.0/0</code> (Anywhere IPv4) for this public website exercise.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                4
              </span>
              <span>Ensure the selected subnet and route configuration support public IPv4 assignment (<code className="font-mono text-xs">Auto-assign public IP: Enable</code>).</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                5
              </span>
              <span>Follow the organiser&apos;s specific instructions if using a preconfigured VPC, subnet, or shared security group. Do not modify unrelated networking resources in a shared training account without permission.</span>
            </li>
          </ol>
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-4 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 flex items-start gap-3">
          <Info className="w-4 h-4 text-workbook-blue shrink-0 mt-0.5" />
          <div>
            <strong className="text-workbook-navy dark:text-zinc-100">Crucial Diagnostic Fact:</strong> A security group rule permits traffic; it does not by itself guarantee that an instance is reachable. The subnet route table, internet gateway, public IP assignment, instance status, and running web server daemon must also be operational.
          </div>
        </div>
      </section>

      {/* SECTION 4: STEP 4 — LAUNCH AND CONFIRM READINESS */}
      <section id="step-4-launch-and-confirm-readiness" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 4 — Launch and confirm instance readiness
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Once your instance launches, confirm that it passes AWS baseline hardware and software health checks before attempting an SSH connection:
        </p>

        {/* Ordered Steps with Status Badges */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs mb-4">
          <ol className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                1
              </span>
              <div className="flex-1">
                <span>Review all instance settings, key pair, and firewall rules in the summary panel, then click <strong>Launch instance</strong>.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                2
              </span>
              <div className="flex-1">
                <span>Open the <strong>EC2 Instances</strong> console page and select your newly launched server.</span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                3
              </span>
              <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                <span>Wait for the Instance state to transition from <em>Pending</em> to <em>Running</em>.</span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  RUNNING
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                4
              </span>
              <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                <span>Wait 1–2 minutes until Status check reports <em>2/2 checks passed</em>.</span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                  STATUS CHECKS PASSED
                </span>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-workbook-blue font-bold text-xs shrink-0 mt-0.5">
                5
              </span>
              <div className="flex-1 flex flex-wrap items-center justify-between gap-2">
                <span>Locate and copy the <strong>Public IPv4 address</strong> in the instance details tab. Keep this address available for SSH and the website verification.</span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
                  PUBLIC IPV4 AVAILABLE
                </span>
              </div>
            </li>
          </ol>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
          If the Public IPv4 address is blank, your instance was launched into a subnet without public auto-assignment enabled. Ask your workshop mentor for the designated subnet.
        </p>
      </section>

      {/* SECTION 5: SCREENSHOT TARGETS 2 + 3 */}
      <section id="screenshot-targets-2-and-3" className="mb-12 scroll-mt-20">
        <div className="p-5 border-2 border-black dark:border-white bg-[#67e8f9]/20 dark:bg-cyan-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black select-none">
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>SCREENSHOT TARGETS 2 + 3 • WORKSHOP EVIDENCE</span>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-black dark:text-zinc-100 font-bold">
            Capture the inbound rules table showing SSH 22 restricted to My IP and HTTP 80 open to public IPv4 traffic. Then capture the Instances view showing the instance as Running, passed status checks, and its public IPv4 address. Blur account IDs and remove any sensitive information before sharing.
          </p>

          {/* Illustrative Evidence Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase bg-[#67e8f9] text-black border border-black px-1.5 py-0.5">
                  SCREEN 02
                </span>
                <span className="text-xs font-mono font-bold text-black dark:text-white">Network Rules</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                SSH 22: restricted • HTTP 80: public
              </p>
            </div>

            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase bg-[#a6ff70] text-black border border-black px-1.5 py-0.5">
                  SCREEN 03
                </span>
                <span className="text-xs font-mono font-bold text-black dark:text-white">Instance Status</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono">
                Running • Status checks passed • Public IPv4
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'deploy-inspect-and-launch',
          title: 'Project 1: inspect the files, then open EC2',
          pageLabel: 'Page 1 of 4',
        }}
        next={{
          id: 'deploy-connect-and-install',
          title: 'Connect to the server and install Nginx',
          pageLabel: 'Page 3 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
