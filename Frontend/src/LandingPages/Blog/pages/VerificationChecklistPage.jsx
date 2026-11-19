import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import { TerminalPanel } from '../components/documentation/TerminalPanel';
import { DeploymentVerificationFlow } from '../components/documentation/DeploymentVerificationFlow';
import { NeoButton } from '../components/ui/NeoButton';
import {
  CheckCircle2,
  Circle,
  Check,
  Terminal,
  Server,
  ShieldCheck,
  Globe,
  AlertTriangle,
  Info,
  RotateCcw,
  Sparkles,
  ExternalLink,
  Cpu,
  FileCode2,
  Layers,
  ArrowRight,
  HelpCircle,
} from 'lucide-react';

export const VERIFICATION_PAGE_HEADINGS = [
  { id: 'deployment-verification-checklist', text: 'Deployment Verification Checklist', level: 2 },
  { id: 'verification-commands', text: 'Verification Commands', level: 2 },
  { id: 'what-does-http-200-ok-mean', text: 'What Does HTTP 200 OK Mean?', level: 2 },
  { id: 'what-does-a-successful-deployment-look-like', text: 'What Does a Successful Deployment Look Like?', level: 2 },
  { id: 'if-a-check-fails', text: 'If a Check Fails, Start Here', level: 2 },
  { id: 'ready-for-the-next-challenge', text: 'Ready for the Next Challenge?', level: 2 },
];

const INITIAL_CHECKLIST = [
  {
    id: 'ec2-running',
    label: 'EC2 is Running',
    description: 'The instance state is Running, and its status checks have passed.',
    category: 'COMPUTE',
    icon: Server,
    color: 'text-workbook-blue',
  },
  {
    id: 'public-ip',
    label: 'Public address exists',
    description: 'A Public IPv4 address is visible in the instance details.',
    category: 'NETWORKING',
    icon: Globe,
    color: 'text-indigo-600 dark:text-indigo-400',
  },
  {
    id: 'security-group',
    label: 'Security group is correct',
    description: 'Inbound HTTP on port 80 is allowed. SSH on port 22 is restricted to My IP or the approved administration network.',
    category: 'FIREWALL',
    icon: ShieldCheck,
    color: 'text-workbook-teal',
  },
  {
    id: 'nginx-active',
    label: 'Nginx is active',
    description: 'The Nginx service reports that it is active and running.',
    category: 'WEB SERVER',
    icon: Cpu,
    color: 'text-workbook-green',
  },
  {
    id: 'files-in-place',
    label: 'Website files are in place',
    description: 'The expected index.html, CSS, JavaScript, and image files are present in /usr/share/nginx/html/.',
    category: 'STORAGE & ASSETS',
    icon: FileCode2,
    color: 'text-workbook-purple',
  },
  {
    id: 'local-http',
    label: 'Local HTTP succeeds',
    description: 'curl -I http://localhost returns an HTTP response when run inside the EC2 instance.',
    category: 'LOCAL LOOPBACK',
    icon: Terminal,
    color: 'text-workbook-orange',
  },
  {
    id: 'public-url',
    label: 'Public URL opens',
    description: 'The browser displays the expected website using http://YOUR_PUBLIC_IP.',
    category: 'CLIENT ACCESS',
    icon: Globe,
    color: 'text-blue-600 dark:text-blue-400',
  },
  {
    id: 'public-http-success',
    label: 'Public HTTP returns success',
    description: 'A request from your own computer returns an HTTP success status, and the browser displays the intended content.',
    category: 'END-TO-END',
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
  },
];

export function VerificationChecklistPage({ onNavigate = () => {} }) {
  // Interactive checklist state
  const [checkedItems, setCheckedItems] = useState({
    'ec2-running': false,
    'public-ip': false,
    'security-group': false,
    'nginx-active': false,
    'files-in-place': false,
    'local-http': false,
    'public-url': false,
    'public-http-success': false,
  });

  const toggleCheck = (id) => {
    setCheckedItems((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const checkAll = () => {
    const allChecked = {};
    INITIAL_CHECKLIST.forEach((item) => {
      allChecked[item.id] = true;
    });
    setCheckedItems(allChecked);
  };

  const resetAll = () => {
    const allReset = {};
    INITIAL_CHECKLIST.forEach((item) => {
      allReset[item.id] = false;
    });
    setCheckedItems(allReset);
  };

  const completedCount = Object.values(checkedItems).filter(Boolean).length;
  const totalCount = INITIAL_CHECKLIST.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const breadcrumbs = [
    { id: 'intro-deployment', label: 'AWS Cloud Launchpad' },
    { id: 'verification-checklist', label: '03 / Verification Checklist' },
  ];

  const verificationCommandsText = `# Run on your Amazon EC2 instance:
sudo systemctl status nginx --no-pager
curl -I http://localhost
ls -la /usr/share/nginx/html

# Run on your local computer (laptop):
curl -I http://YOUR_PUBLIC_IP`;

  const troubleshootingRows = [
    {
      symptom: 'EC2 is not Running',
      cause: 'Instance was stopped, terminated, or encountered a launch error.',
      resolution: 'Confirm instance state in the EC2 Console. If state is Stopped, select Instance state → Start instance. If launch failed, review AMI availability and instance quota.',
    },
    {
      symptom: 'Status checks have not passed',
      cause: 'AWS hardware virtualization checks (System status check & Instance status check) are still initializing.',
      resolution: 'Wait 1–2 minutes after launch. Status checks typically take up to 3 minutes to reach "2/2 checks passed". If it remains impaired, view the Status Checks tab in EC2.',
    },
    {
      symptom: 'Nginx is inactive',
      cause: 'Service was not started, failed during launch, or crashed.',
      resolution: 'Inspect service logs with "sudo systemctl status nginx". Verify installation with "sudo dnf install -y nginx", then run "sudo systemctl enable --now nginx".',
    },
    {
      symptom: 'Local HTTP fails',
      cause: 'Nginx process is dead, misconfigured, or not listening on port 80.',
      resolution: 'Confirm Nginx is running and listening on port 80 with "sudo ss -tulpn | grep :80". Inspect error logs located at "/var/log/nginx/error.log".',
    },
    {
      symptom: 'Local HTTP works but public HTTP fails',
      cause: 'Inbound network firewall rule is blocking traffic or wrong IP is being queried.',
      resolution: 'Verify your Security Group inbound rules allow HTTP on port 80 from 0.0.0.0/0 (Anywhere IPv4). Ensure you are navigating to the Public IPv4, not Private IPv4.',
    },
    {
      symptom: 'The default Nginx page appears',
      cause: 'Starter website files were not copied to /usr/share/nginx/html/ or index.html was not overwritten.',
      resolution: 'Verify files inside the web root with "ls -la /usr/share/nginx/html". Copy the repository assets with "sudo cp -r * /usr/share/nginx/html/" and reload Nginx.',
    },
    {
      symptom: 'The page loads but images or styles are missing',
      cause: 'Linux path or case mismatch (e.g. style.css vs Style.css), or missing subdirectories.',
      resolution: 'Linux file paths are strictly case-sensitive. Check directory structure with "ls -R /usr/share/nginx/html" and verify relative asset paths inside index.html.',
    },
    {
      symptom: 'The public IP no longer works',
      cause: 'Instance was stopped and restarted, causing AWS to dynamically reassign a new public IPv4.',
      resolution: 'Check the EC2 Console for your instance\'s newly assigned Public IPv4 address. Standard EC2 public IPs change on instance stop/start unless an Elastic IP is associated.',
    },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto w-full px-4 sm:px-8 py-8 md:py-12">
      {/* Chapter Indicator & Editorial Title */}
      <ChapterHeader
        chapterNumber="03"
        chapterTitle="VERIFICATION CHECKLIST"
        pageNumber={1}
        totalPages={1}
        title="Prove the website is really deployed"
        intro="Confirm that every layer of your deployment works as intended — from Amazon EC2 hardware status and network security groups to the Nginx daemon, file placement, and live public HTTP delivery."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: Interactive Verification Checklist */}
      <section id="deployment-verification-checklist" className="scroll-mt-24 mb-14">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight">
              Deployment Verification Checklist
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 mt-1">
              Test each item systematically. Mark them off as you confirm their status in AWS and your terminal.
            </p>
          </div>

          {/* Checklist Controls & Counter */}
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

        {/* Progress Bar Banner */}
        <div className="p-4 mb-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 border-2 border-black flex items-center justify-center font-mono font-bold text-xs ${
              completedCount === totalCount
                ? 'bg-[#a6ff70] text-black shadow-[2px_2px_0px_#000000]'
                : 'bg-black text-white dark:bg-zinc-800 dark:text-zinc-200'
            }`}>
              {completedCount === totalCount ? (
                <Check className="w-5 h-5 stroke-[3]" />
              ) : (
                `${completedCount}/${totalCount}`
              )}
            </div>
            <div>
              <div className="text-xs font-bold text-black dark:text-white uppercase tracking-wider font-mono">
                {completedCount === totalCount
                  ? 'All Verification Checks Passed!'
                  : `${completedCount} of ${totalCount} checks completed`}
              </div>
              <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                {completedCount === totalCount
                  ? 'Your website is fully verified and reachable on the public internet.'
                  : 'Follow the verification steps below to test each component.'}
              </div>
            </div>
          </div>

          <div className="hidden sm:block w-36">
            <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800 border-2 border-black overflow-hidden">
              <div
                className="h-full bg-[#a6ff70] border-r-2 border-black transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="text-[10px] text-right font-mono font-bold text-black dark:text-white mt-1">
              {progressPercent}% VERIFIED
            </div>
          </div>
        </div>

        {/* Checklist Items */}
        <div className="space-y-3">
          {INITIAL_CHECKLIST.map((item) => {
            const isChecked = checkedItems[item.id];
            const Icon = item.icon;

            return (
              <motion.label
                key={item.id}
                htmlFor={`check-${item.id}`}
                whileHover={{ x: -1, y: -1 }}
                className={`flex items-start gap-3.5 p-4 border-2 border-black dark:border-white transition-all cursor-pointer select-none ${
                  isChecked
                    ? 'bg-[#a6ff70]/30 dark:bg-[#a6ff70]/10 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]'
                    : 'bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff] hover:bg-zinc-50'
                }`}
              >
                <input
                  type="checkbox"
                  id={`check-${item.id}`}
                  checked={isChecked}
                  onChange={() => toggleCheck(item.id)}
                  className="sr-only"
                />

                {/* Custom Checkbox Indicator */}
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
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span
                      className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 border border-black ${
                        isChecked
                          ? 'bg-[#a6ff70] text-black'
                          : 'bg-[#67e8f9] text-black'
                      }`}
                    >
                      {item.category}
                    </span>
                    <span
                      className={`text-sm font-bold transition-colors ${
                        isChecked
                          ? 'text-black dark:text-white line-through decoration-black dark:decoration-white decoration-2'
                          : 'text-black dark:text-white'
                      }`}
                    >
                      {item.label}
                    </span>
                  </div>
                  <p
                    className={`text-xs leading-relaxed transition-colors ${
                      isChecked
                        ? 'text-zinc-700 dark:text-zinc-300'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {item.description}
                  </p>
                </div>

                <Icon
                  className={`w-4 h-4 shrink-0 transition-opacity ${
                    isChecked ? 'opacity-40 text-black dark:text-white' : 'text-black dark:text-white'
                  }`}
                />
              </motion.label>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: Verification Commands */}
      <section id="verification-commands" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          Verification Commands
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          Execute these standard diagnostics. The first three commands are run inside your Amazon Linux 2023 terminal over SSH. The last command is run from your personal computer to test external reachability.
        </p>

        {/* Unified Terminal Panel */}
        <TerminalPanel
          label="RUN THE FIRST BLOCK ON EC2; LAST COMMAND ON YOUR LAPTOP"
          commands={verificationCommandsText}
          isSsh={true}
        />

        {/* Detailed Command Breakdown */}
        <div className="mt-6 space-y-3">
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
            What each command confirms:
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  ON EC2
                </span>
                <code className="text-xs font-mono font-bold text-workbook-navy dark:text-zinc-200">
                  sudo systemctl status nginx --no-pager
                </code>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Queries the systemd daemon manager. Confirms Nginx is loaded and <strong className="text-emerald-700 dark:text-emerald-400 font-semibold">Active: active (running)</strong> without blocking your terminal prompt with a pager lock.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  ON EC2
                </span>
                <code className="text-xs font-mono font-bold text-workbook-navy dark:text-zinc-200">
                  curl -I http://localhost
                </code>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Performs a local loopback HTTP head request directly against port 80. Verifies Nginx accepts HTTP connections and serves the default or custom site locally.
              </p>
            </div>

            <div className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  ON EC2
                </span>
                <code className="text-xs font-mono font-bold text-workbook-navy dark:text-zinc-200">
                  ls -la /usr/share/nginx/html
                </code>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Lists all files in the Nginx document web root. Confirms that <code className="text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">index.html</code>, stylesheets, and assets exist with public read permissions (<code className="text-[11px]">-rw-r--r--</code>).
              </p>
            </div>

            <div className="p-4 rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  ON LAPTOP
                </span>
                <code className="text-xs font-mono font-bold text-workbook-navy dark:text-zinc-200">
                  curl -I http://YOUR_PUBLIC_IP
                </code>
              </div>
              <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                Sends an HTTP request across the public internet. Confirms that your AWS VPC Internet Gateway, subnet routing table, and Security Group port 80 rule allow external visitor traffic.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: What Does HTTP 200 OK Mean? */}
      <section id="what-does-http-200-ok-mean" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-black text-black dark:text-zinc-100 tracking-tight mb-2">
          What Does HTTP 200 OK Mean?
        </h2>
        <p className="text-sm text-slate-700 dark:text-zinc-300 mb-4 font-sans">
          When testing with <code className="font-mono text-xs bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white">curl -I</code>, the web server replies with an HTTP status line. Here is how to interpret the response.
        </p>

        {/* Neo-Brutalist Educational Callout */}
        <div className="p-6 border-2 border-black dark:border-white bg-[#fbfbf9] dark:bg-zinc-900 shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] mb-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b-2 border-black/10 dark:border-zinc-800">
              <span className="p-1 bg-[#67e8f9] text-black border border-black shadow-[1px_1px_0px_#000]">
                <Info className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span className="text-xs sm:text-sm font-black text-black dark:text-zinc-100 uppercase tracking-tight font-mono">
                HTTP/1.1 200 OK — The Gold Standard of Deployment
              </span>
            </div>

            <p className="text-xs sm:text-sm leading-relaxed text-slate-800 dark:text-zinc-200 font-sans">
              An HTTP status code of <strong className="font-black bg-[#a6ff70] px-1 text-black border border-black">200 OK</strong> indicates that your request reached the web server, the server located the requested document (<code className="font-mono text-xs bg-white dark:bg-zinc-800 px-1 py-0.5 border border-black">index.html</code>), and it successfully returned the headers and payload.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="p-3.5 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-[3px_3px_0px_#000000]">
                <div className="text-xs font-mono font-black text-black bg-[#a6ff70] px-2 py-0.5 border border-black inline-block mb-1">
                  200 OK
                </div>
                <div className="text-xs text-slate-700 dark:text-zinc-300 mt-1 font-sans">
                  Success. The file exists and was delivered cleanly.
                </div>
              </div>

              <div className="p-3.5 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-[3px_3px_0px_#000000]">
                <div className="text-xs font-mono font-black text-black bg-[#fde047] px-2 py-0.5 border border-black inline-block mb-1">
                  403 Forbidden
                </div>
                <div className="text-xs text-slate-700 dark:text-zinc-300 mt-1 font-sans">
                  Nginx cannot read the file or directory permissions are too restrictive.
                </div>
              </div>

              <div className="p-3.5 border-2 border-black dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-[3px_3px_0px_#000000]">
                <div className="text-xs font-mono font-black text-black bg-[#fda4af] px-2 py-0.5 border border-black inline-block mb-1">
                  404 Not Found
                </div>
                <div className="text-xs text-slate-700 dark:text-zinc-300 mt-1 font-sans">
                  Nginx is active, but cannot find <code className="font-mono text-[11px]">index.html</code> in the web root.
                </div>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed font-mono">
          Using <code className="font-mono text-xs bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white">curl -I</code> (head-only request) isolates network connectivity and web server health from browser quirks such as aggressive local caching or automatic HTTPS redirects.
        </p>
      </section>

      {/* SECTION 4: What Does a Successful Deployment Look Like? */}
      <section id="what-does-a-successful-deployment-look-like" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-serif font-bold text-workbook-navy dark:text-zinc-100 tracking-tight mb-2">
          What Does a Successful Deployment Look Like?
        </h2>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
          A successful deployment is not a single check — it is a verifiable pipeline of healthy infrastructure layers working together in harmony.
        </p>

        {/* Visual Sequential Flow Diagram */}
        <DeploymentVerificationFlow />

        {/* Concrete Success Indicators */}
        <div className="mt-6 p-5 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <h3 className="text-sm font-bold text-black dark:text-white mb-3 flex items-center gap-2">
            <span className="p-1 bg-[#fde047] border border-black text-black">
              <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            </span>
            Key Signs Your Deployment Is 100% Successful
          </h3>

          <ul className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300">
            <li className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black mt-1 shrink-0" />
              <span>
                <strong>Browser Address Bar:</strong> You navigated directly to <code className="font-mono text-xs bg-[#f4f3ee] dark:bg-zinc-800 px-1.5 py-0.5 border border-black text-black dark:text-white">http://YOUR_PUBLIC_IP</code> (plain HTTP, not HTTPS) and the page loaded immediately without connection timeouts or security certificate warnings.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black mt-1 shrink-0" />
              <span>
                <strong>Visual Integrity:</strong> The custom heading, logo, background styling, and interactive buttons appear exactly as designed — not the generic "Welcome to nginx!" placeholder page.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black mt-1 shrink-0" />
              <span>
                <strong>Console & Network Cleanliness:</strong> Opening Developer Tools (F12) reveals zero red 404 network errors for CSS stylesheets, JavaScript files, or images.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="w-2.5 h-2.5 bg-[#a6ff70] border border-black mt-1 shrink-0" />
              <span>
                <strong>Independent Reachability:</strong> Opening the link on a secondary device (such as your smartphone on mobile data) displays the exact same website, proving global internet accessibility.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* SECTION 5: If a Check Fails, Start Here */}
      <section id="if-a-check-fails" className="scroll-mt-24 mb-14">
        <h2 className="text-xl sm:text-2xl font-bold text-black dark:text-white tracking-tight mb-2">
          If a Check Fails, Start Here
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-5">
          Cloud deployments can fail at several distinct boundaries. Use this symptom matrix to identify which layer needs attention before changing random configurations.
        </p>

        {/* Troubleshooting Table */}
        <div className="overflow-x-auto border-2 border-black dark:border-white shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-black text-white dark:bg-zinc-800 border-b-2 border-black dark:border-white">
                <th className="py-3 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-2/5">
                  Symptom
                </th>
                <th className="py-3 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-3/5">
                  Primary Check & Resolution
                </th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-black dark:divide-white bg-white dark:bg-zinc-900">
              {troubleshootingRows.map((row, idx) => (
                <tr
                  key={idx}
                  className={`transition-colors ${
                    idx % 2 === 0
                      ? 'bg-white dark:bg-zinc-900'
                      : 'bg-zinc-50 dark:bg-zinc-800/40'
                  } hover:bg-[#a6ff70]/10 dark:hover:bg-zinc-800`}
                >
                  <td className="py-3.5 px-4 align-top border-r-2 border-black dark:border-white">
                    <div className="font-bold text-black dark:text-white mb-1">
                      {row.symptom}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 italic">
                      {row.cause}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 align-top text-zinc-800 dark:text-zinc-200 leading-relaxed">
                    {row.resolution}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* SECTION 6: Ready for the Next Challenge? */}
      <section id="ready-for-the-next-challenge" className="scroll-mt-24 mb-14">
        <div className="p-6 sm:p-8 border-2 border-black dark:border-white bg-[#fde047]/15 dark:bg-amber-950/20 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff]">
          <div className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider px-2 py-0.5 bg-[#fde047] text-black border border-black mb-3">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>DEPLOYMENT MASTERY CONFIRMED</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-white tracking-tight mb-3 font-sans">
            Ready for the Next Challenge?
          </h2>

          <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed mb-6 font-medium">
            Congratulations! By following this workbook, you have moved from understanding core cloud primitives to launching real compute hardware, provisioning network firewalls, installing a production web server, deploying website files, and verifying internet accessibility.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]">
              <div className="text-xs font-mono font-bold uppercase text-black dark:text-white mb-2">
                CONCEPTS YOU MASTERED
              </div>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                <li>VPC, subnets, and internet gateways</li>
                <li>Stateful security group firewall rules</li>
                <li>SSH cryptographic key authentication</li>
                <li>Linux package management and systemd services</li>
                <li>Nginx web server hosting and web root management</li>
              </ul>
            </div>

            <div className="p-4 border-2 border-black dark:border-white bg-white dark:bg-zinc-900 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]">
              <div className="text-xs font-mono font-bold uppercase text-black dark:text-white mb-2">
                POTENTIAL NEXT UPGRADES
              </div>
              <ul className="text-xs text-zinc-600 dark:text-zinc-400 space-y-1.5 list-disc list-inside">
                <li>Assign an Elastic IP so your address survives stops</li>
                <li>Attach a custom domain name using Amazon Route 53</li>
                <li>Issue a free SSL/TLS certificate with Let's Encrypt / Certbot</li>
                <li>Set up GitHub Actions to auto-deploy on git push</li>
              </ul>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <NeoButton
              variant="black"
              size="md"
              onClick={() => onNavigate('intro-deployment')}
              icon={ArrowRight}
            >
              Return to Overview
            </NeoButton>

            <NeoButton
              variant="white"
              size="md"
              onClick={() => onNavigate('deploy-inspect-and-launch')}
            >
              Review Step-by-Step Deployment
            </NeoButton>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'deploy-and-verify',
          title: 'Deploy the repository and open the live website',
          pageLabel: 'Chapter 02 • Page 4',
        }}
        next={{
          id: 'troubleshoot-common-errors',
          title: 'Common errors, likely causes and fixes',
          pageLabel: 'Chapter 04',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}