import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { ChapterHeader } from '../components/documentation/ChapterHeader';
import { ChapterPagination } from '../components/documentation/ChapterPagination';
import {
  ExternalLink,
  Copy,
  Check,
  Terminal,
  FolderGit2,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

export const PAGE_4_HEADINGS = [
  { id: 'tools-you-need', text: 'Tools You Need', level: 2 },
  { id: 'local-checks', text: 'Local Checks', level: 2 },
  { id: 'github-repository-access', text: 'GitHub Repository Access', level: 2 },
  { id: 'aws-account-and-permissions', text: 'AWS Account and Permissions', level: 2 },
  { id: 'ready-check', text: 'Ready Check', level: 2 },
];

export function PreflightPage({ onNavigate = () => {} }) {
  const [copied, setCopied] = useState(false);
  const [checkedItems, setCheckedItems] = useState({
    laptop: false,
    login: false,
    repo: false,
    permissions: false,
    ssh: false,
    pricing: false,
  });

  const toggleCheck = (key) => {
    setCheckedItems((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const breadcrumbs = [
    { id: 'intro-deployment', label: 'Introduction & Prerequisites' },
    { id: 'intro-preflight', label: 'Preflight: tools, repository, account and permissions' },
  ];

  const tools = [
    {
      title: 'Laptop + internet',
      desc: 'Windows, macOS, or Linux, with a current browser, stable internet, and access to a terminal or command prompt.',
      status: 'REQUIRED',
      statusColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
    {
      title: 'Git + SSH client',
      desc: 'Git is required on the machine performing Git cloning. An SSH client is needed on your laptop if you will connect using SSH, unless the workshop uses an approved browser-based connection.',
      status: 'REQUIRED FOR SELECTED PATH',
      statusColor: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400',
    },
    {
      title: 'ZIP / file manager',
      desc: 'Useful for downloading and examining repository archives. Keep the repository URL available.',
      status: 'USEFUL',
      statusColor: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      title: 'Node.js / npm',
      desc: "Not required to serve this workshop's static HTML, CSS, and JavaScript files. Other projects may need Node.js, depending on how they are built and run.",
      status: 'PROJECT-DEPENDENT',
      statusColor: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400',
    },
    {
      title: 'AWS CLI',
      desc: 'Optional for this guide. The workshop can use the AWS Console and an SSH session rather than requiring AWS CLI commands.',
      status: 'OPTIONAL',
      statusColor: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300',
    },
    {
      title: 'Approved AWS login',
      desc: 'Use your own authorized AWS account, or the learner account or workshop role provided by the organizers.',
      status: 'REQUIRED',
      statusColor: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400',
    },
  ];

  const handleCopyCommands = async () => {
    const text = 'git --version\nssh -V';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const allChecked = Object.values(checkedItems).every(Boolean);

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="01"
        chapterTitle="INTRODUCTION &amp; PREREQUISITES"
        pageNumber={4}
        totalPages={4}
        title="Preflight: tools, repository, account and permissions"
        intro="Before the practical starts, every participant should be able to sign in to the approved AWS environment, open the source code, and perform only the actions needed for the lab."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: TOOLS YOU NEED */}
      <section id="tools-you-need" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Tools You Need
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Check your machine setup before starting. The table below lists prerequisites and their necessity for this workshop:
        </p>

        {/* 2-Column Checklist Grid */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-xs overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 divide-workbook-border dark:divide-zinc-800 md:[&>*:not(:nth-child(-n+2))]:border-t md:[&>*:not(:nth-child(-n+2))]:border-workbook-border dark:md:[&>*:not(:nth-child(-n+2))]:border-zinc-800 md:[&>*:nth-child(2n)]:border-l md:[&>*:nth-child(2n)]:border-workbook-border dark:md:[&>*:nth-child(2n)]:border-zinc-800">
            {tools.map((tool, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 flex flex-col justify-between hover:bg-slate-50/50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-bold text-workbook-navy dark:text-zinc-100">
                      {tool.title}
                    </h3>
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${tool.statusColor} shrink-0`}>
                      {tool.status}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 dark:text-zinc-300 leading-relaxed">
                    {tool.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 2: LOCAL CHECKS */}
      <section id="local-checks" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Local Checks
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Open your terminal or command prompt and run the following checks:
        </p>

        {/* Terminal Panel (Dark Navy with White Monospace Text) */}
        <div className="rounded-xl border border-slate-700 bg-workbook-navy text-slate-100 overflow-hidden shadow-md my-4">
          <div className="flex items-center justify-between px-4 py-2.5 bg-navy-950/80 border-b border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-workbook-orange" />
              <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-workbook-orange">
                RUN ON YOUR LAPTOP
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCommands}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-800 transition-colors focus:outline-none"
              aria-label="Copy terminal commands"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-mono">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-mono">Copy</span>
                </>
              )}
            </button>
          </div>

          <div className="p-4 font-mono text-sm leading-relaxed space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-slate-500 select-none">$</span>
              <span className="text-emerald-400">git --version</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 select-none">$</span>
              <span className="text-emerald-400">ssh -V</span>
            </div>
          </div>
        </div>

        <div className="space-y-1.5 text-xs text-slate-600 dark:text-zinc-400">
          <p>
            • <code className="font-mono text-slate-800 dark:text-zinc-200">git --version</code> checks whether Git is installed and available in your shell path.
          </p>
          <p>
            • <code className="font-mono text-slate-800 dark:text-zinc-200">ssh -V</code> checks whether an OpenSSH client is installed on your local computer.
          </p>
          <p>
            • If your workshop uses an approved browser-based console terminal (such as EC2 Instance Connect), SSH on your laptop is optional.
          </p>
        </div>
      </section>

      {/* SECTION 3: GITHUB REPOSITORY ACCESS */}
      <section id="github-repository-access" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          GitHub Repository Access
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Project 1 uses the public <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">zirafa/simple-website-template</code> repository. The <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-semibold text-slate-800 dark:text-zinc-200">gh-pages</code> branch contains the starter website files.
        </p>

        {/* Real Accessible External Link Card */}
        <div className="my-5 p-5 rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs hover:border-slate-300 dark:hover:border-zinc-700 transition-colors">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-workbook-blue mt-0.5">
                <FolderGit2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500 mb-0.5">
                  Starter Template • GitHub
                </div>
                <h3 className="text-sm sm:text-base font-bold text-workbook-navy dark:text-zinc-100">
                  zirafa / simple-website-template (gh-pages)
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Contains clean starter HTML, CSS, JavaScript, and assets ready for Nginx.
                </p>
              </div>
            </div>

            <a
              href="https://github.com/zirafa/simple-website-template/tree/gh-pages"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-workbook-navy text-white hover:bg-workbook-blue dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white text-xs font-semibold transition-colors focus:outline-none shrink-0"
            >
              <span>Open Project 1 repository branch: gh-pages</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <ul className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
          <li className="flex items-start gap-2">
            <span className="text-workbook-blue font-bold">•</span>
            <span>You can inspect the source code files in your browser before initiating the deployment.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-workbook-blue font-bold">•</span>
            <span>Because this is a public repository, you can clone or download it without requiring personal GitHub access tokens.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-workbook-blue font-bold">•</span>
            <span>Never share personal GitHub personal access tokens or private SSH keys with anyone.</span>
          </li>
        </ul>
      </section>

      {/* SECTION 4: AWS ACCOUNT AND PERMISSIONS */}
      <section id="aws-account-and-permissions" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          AWS Account and Permissions
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-6">
          Follow these essential security and authorization principles before logging into the AWS Management Console:
        </p>

        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs mb-6">
          <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Approved access only:</strong> Use the AWS account or learner role assigned by your workshop organizer. Do not access accounts you are not authorized to use.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Confirm scope of permissions:</strong> Verify that your role can launch and terminate EC2 instances, manage security group rules, and create key pairs.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Key pair preparation:</strong> Be ready to download and store your <code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">.pem</code> private key in a secure folder with restricted permissions (<code className="font-mono text-xs px-1 py-0.5 rounded bg-slate-100 dark:bg-zinc-800">chmod 400</code>).</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Follow least privilege:</strong> Do not request unrestricted administrator permissions merely to bypass a permission error.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Clean up awareness:</strong> Understand how to identify running EC2 instances and terminate them when the workshop concludes to prevent unexpected charges.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Enable MFA:</strong> Protect your root user or IAM administrator user with multi-factor authentication.</span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold text-base leading-none mt-0.5">•</span>
              <span><strong>Credential confidentiality:</strong> Never share passwords, session tokens, or private SSH key files.</span>
            </li>
          </ul>
        </div>

        {/* Subtle Information Callout */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/60 p-4 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-workbook-blue shrink-0 mt-0.5" />
          <div>
            <strong className="text-workbook-navy dark:text-zinc-100">Crucial Distinction:</strong> Permission to log in, permission to manage EC2, and permission to connect to a running server are related but different requirements. A login that succeeds does not guarantee that every EC2 action is authorized.
          </div>
        </div>
      </section>

      {/* SECTION 5: READY CHECK */}
      <section id="ready-check" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-4">
          Ready Check
        </h2>

        {/* Neo Brutalist Callout */}
        <div className="p-5 border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-emerald-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black select-none">
            <CheckCircle2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>READY CHECK • CONFIRM PREFLIGHT STATUS</span>
          </div>

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed font-medium">
            Verify each prerequisite item below. Click each box to confirm your readiness for the hands-on deployment:
          </p>

          {/* Interactive Checklist Items */}
          <div className="space-y-3">
            {[
              { key: 'laptop', text: 'Laptop and internet connection available and operational.' },
              { key: 'login', text: 'Approved AWS login credentials tested and operational.' },
              { key: 'repo', text: 'GitHub repository URL opens and source files can be inspected.' },
              { key: 'permissions', text: 'Appropriate EC2 launching and networking permissions confirmed.' },
              { key: 'ssh', text: 'Required connection method (SSH or console) and secure key handling understood.' },
              { key: 'pricing', text: 'Pricing awareness, Free Tier limits, and resource cleanup procedure understood.' },
            ].map((item) => {
              const isChecked = checkedItems[item.key];
              return (
                <motion.label
                  key={item.key}
                  whileHover={{ x: -1, y: -1 }}
                  className={`flex items-start gap-3.5 p-3.5 border-2 border-black dark:border-white cursor-pointer select-none transition-all ${
                    isChecked
                      ? 'bg-[#a6ff70]/40 dark:bg-[#a6ff70]/10 shadow-[3px_3px_0px_#000000] dark:shadow-[3px_3px_0px_#ffffff]'
                      : 'bg-white dark:bg-zinc-900 shadow-[2px_2px_0px_#000000] dark:shadow-[2px_2px_0px_#ffffff] hover:bg-zinc-50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleCheck(item.key)}
                    className="sr-only"
                  />
                  <div
                    className={`mt-0.5 w-5 h-5 flex items-center justify-center shrink-0 border-2 border-black dark:border-white transition-all ${
                      isChecked
                        ? 'bg-[#a6ff70] text-black shadow-[1.5px_1.5px_0px_#000000]'
                        : 'bg-white dark:bg-zinc-800 text-transparent'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <span className={`text-xs sm:text-sm font-medium leading-relaxed ${isChecked ? 'line-through decoration-black dark:decoration-white decoration-2 text-zinc-500 dark:text-zinc-400' : 'text-black dark:text-white'}`}>
                    {item.text}
                  </span>
                </motion.label>
              );
            })}
          </div>

          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed pt-3 border-t-2 border-black/10 dark:border-white/10">
            {allChecked ? (
              <span className="font-bold text-black dark:text-white">
                ✓ All items verified! You are completely prepared to continue to the hands-on deployment.
              </span>
            ) : (
              <span>
                If every required item is ready, you are prepared to continue to the next stage: launching and configuring your EC2 instance.
              </span>
            )}
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => onNavigate('deploy-inspect-and-launch')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-workbook-green text-white hover:bg-emerald-700 text-xs font-bold uppercase tracking-wider transition-all focus:outline-none shadow-xs"
            >
              <span>Next: Deploy Your First Website (Step 1) →</span>
            </button>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'intro-aws-services',
          title: 'AWS services: learn the job, not just the name',
          pageLabel: 'Page 3 of 4',
        }}
        next={{
          id: 'deploy-inspect-and-launch',
          title: 'Project 1: inspect the files, then open EC2',
          pageLabel: 'Chapter 02 • Page 1',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
