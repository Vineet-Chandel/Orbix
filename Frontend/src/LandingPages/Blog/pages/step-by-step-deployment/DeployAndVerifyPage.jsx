import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { TerminalPanel } from '../../components/documentation/TerminalPanel';
import { ScreenshotTargetsGrid } from '../../components/documentation/ScreenshotTargetsGrid';
import { NeoButton } from '../../components/ui/NeoButton';
import {
  Globe,
  Camera,
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  ExternalLink,
  PartyPopper,
  Sparkles,
} from 'lucide-react';

export const DEPLOY_PAGE_4_HEADINGS = [
  { id: 'step-7-clone-and-deploy-website-files', text: 'Step 7 — Clone and Deploy Website Files', level: 2 },
  { id: 'copy-only-public-website-files', text: 'Copy Only Public Website Files', level: 2 },
  { id: 'public-directory-warning', text: 'Public Directory = Public Files', level: 2 },
  { id: 'step-8-open-the-live-website', text: 'Step 8 — Open the Live Website', level: 2 },
  { id: 'screenshot-targets-for-the-live-workshop', text: 'Screenshot Targets for the Live Workshop', level: 2 },
  { id: 'screenshot-target-6-proof-of-deployment', text: 'Screenshot Target 6 — Proof of Deployment', level: 2 },
  { id: 'your-website-is-live', text: 'Your Website Is Live', level: 2 },
];

export function DeployAndVerifyPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'deploy-inspect-and-launch', label: 'Step-by-Step Deployment' },
    { id: 'deploy-and-verify', label: 'Deploy & Open Live Website' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="02"
        chapterTitle="STEP-BY-STEP DEPLOYMENT"
        pageNumber={4}
        totalPages={4}
        title="Deploy the repository and open the live website"
        intro="The next commands clone the public starter repository onto EC2 and copy only the website files into Nginx's public directory."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: STEP 7 — CLONE AND DEPLOY WEBSITE FILES */}
      <section id="step-7-clone-and-deploy-website-files" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 7 — Clone and deploy website files
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Inside your active SSH terminal on EC2, download the starter website repository branch:
        </p>

        {/* Terminal Panel */}
        <TerminalPanel
          label="RUN INSIDE THE SSH SESSION"
          isSsh={true}
          commands={[
            'cd ~',
            'git clone --branch gh-pages --single-branch \\',
            '  https://github.com/zirafa/simple-website-template.git \\',
            '  my-first-website',
            'ls -la ~/my-first-website',
          ]}
        />

        <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mt-4 leading-relaxed">
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">cd ~</code>: Navigates to your remote user&apos;s home directory (<code className="font-mono text-xs">/home/ec2-user</code>).
          </p>
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">git clone --branch gh-pages --single-branch</code>: Downloads only the starter template branch rather than the entire commit history.
          </p>
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">ls -la ~/my-first-website</code>: Inspects the downloaded files. Confirm that <code className="font-mono text-xs">index.html</code>, <code className="font-mono text-xs">style.css</code>, <code className="font-mono text-xs">script.js</code>, <code className="font-mono text-xs">logo.png</code>, and <code className="font-mono text-xs">background.jpg</code> exist before copying.
          </p>
        </div>
      </section>

      {/* SECTION 2: COPY ONLY PUBLIC WEBSITE FILES */}
      <section id="copy-only-public-website-files" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-3">
          Copy Only Public Website Files
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          The Nginx document root for this workshop is <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-bold text-workbook-navy dark:text-zinc-100">/usr/share/nginx/html/</code>. Copy the HTML, CSS, JavaScript, and referenced image assets into that directory:
        </p>

        {/* Terminal Panel */}
        <TerminalPanel
          label="COPY PUBLIC FILES — DO NOT COPY .GIT OR SECRETS"
          isSsh={true}
          commands={[
            'sudo cp ~/my-first-website/index.html \\',
            '  ~/my-first-website/style.css \\',
            '  ~/my-first-website/script.js \\',
            '  ~/my-first-website/logo.png \\',
            '  ~/my-first-website/background.jpg \\',
            '  /usr/share/nginx/html/',
            'sudo nginx -t && sudo systemctl reload nginx',
          ]}
        />

        <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mt-4 leading-relaxed">
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">sudo cp ... /usr/share/nginx/html/</code>: Copies the five designated public assets into Nginx&apos;s default web directory.
          </p>
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">sudo nginx -t</code>: Verifies Nginx configuration syntax for any syntax or permissions errors.
          </p>
          <p>
            • <code className="font-mono text-xs font-bold text-slate-900 dark:text-zinc-100">sudo systemctl reload nginx</code>: Gracefully reloads the web server to immediately serve the new files.
          </p>
        </div>
      </section>

      {/* SECTION 3: PUBLIC DIRECTORY WARNING */}
      <section id="public-directory-warning" className="mb-12 scroll-mt-20">
        <div className="p-5 border-2 border-black dark:border-white bg-[#fda4af]/20 dark:bg-rose-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff]">
          <div className="inline-flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black mb-2 select-none">
            <ShieldAlert className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>PUBLIC DIRECTORY = PUBLIC FILES</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-black dark:text-zinc-100 font-bold mb-2">
            Never place <code className="font-mono text-xs bg-white dark:bg-zinc-900 px-1 py-0.5 border border-black font-bold">.env</code> files, passwords, AWS access keys, private SSH keys, API tokens, or other secrets in <code className="font-mono text-xs bg-white dark:bg-zinc-900 px-1 py-0.5 border border-black font-bold">/usr/share/nginx/html/</code>.
          </p>
          <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
            This directory is for website assets that visitors may freely download over the public internet. Anything served publicly should be treated as information accessible to everyone. Keep private configuration and credentials outside the web root.
          </p>
        </div>
      </section>

      {/* SECTION 4: STEP 8 — OPEN THE LIVE WEBSITE */}
      <section id="step-8-open-the-live-website" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 8 — Open the live website
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Open a new browser tab on your computer and paste your instance&apos;s public IPv4 address with the <code className="font-mono text-xs">http://</code> prefix:
        </p>

        {/* Address Bar Panel */}
        <div className="rounded-xl border border-slate-700 bg-workbook-navy text-slate-100 overflow-hidden shadow-md my-4">
          <div className="px-4 py-2 bg-navy-950/90 border-b border-slate-800 text-[11px] font-mono font-bold tracking-wider uppercase text-workbook-orange flex items-center gap-2">
            <Globe className="w-3.5 h-3.5" />
            <span>PASTE THE REAL PUBLIC IPV4 ADDRESS INTO YOUR BROWSER</span>
          </div>
          <div className="p-4 font-mono text-sm sm:text-base text-emerald-400">
            http://YOUR_PUBLIC_IP
          </div>
        </div>

        <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mt-4 leading-relaxed">
          <p>
            • Replace <code className="font-mono text-xs font-bold text-workbook-navy dark:text-zinc-100">YOUR_PUBLIC_IP</code> with the actual public IPv4 address copied from the EC2 Console.
          </p>
          <p>
            • <strong>HTTP vs HTTPS:</strong> This starter exercise uses plain HTTP on port 80. HTTPS requires a custom domain, DNS validation, and a TLS certificate, which are covered in subsequent advanced workshops.
          </p>
          <p>
            • <strong>IP Persistence:</strong> A standard public IPv4 address will change if the EC2 instance is stopped and restarted. If your URL stops responding after a restart, check the updated public address in the EC2 Console.
          </p>
        </div>
      </section>

      {/* SECTION 5: SCREENSHOT TARGETS FOR THE LIVE WORKSHOP */}
      <section id="screenshot-targets-for-the-live-workshop" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-3">
          Screenshot Targets for the Live Workshop
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Students completing this workshop for credit or certification must capture the five required operational milestones:
        </p>

        {/* 5-Tile Schematic Grid */}
        <ScreenshotTargetsGrid />
      </section>

      {/* SECTION 6: SCREENSHOT TARGET 6 — PROOF OF DEPLOYMENT */}
      <section id="screenshot-target-6-proof-of-deployment" className="mb-12 scroll-mt-20">
        <div className="p-5 border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-emerald-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black select-none">
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>SCREENSHOT TARGET 6 • PROOF OF DEPLOYMENT</span>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-black dark:text-zinc-100 font-bold">
            Capture your browser address bar showing the active public IPv4 address alongside the deployed website rendering correctly. This represents primary tangible proof that your public web server is working.
          </p>

          {/* Success Criteria Checklist */}
          <div className="space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 pt-3 border-t-2 border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>The browser opens the expected public IPv4 URL (<code className="font-mono text-xs bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black">http://YOUR_PUBLIC_IP</code>).</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>The deployed page layout renders correctly with styles and fonts intact.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>CSS, JavaScript, and image assets load as expected without 404 errors.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>The page displays the starter template content, not the default Nginx welcome splash.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>No credentials, passwords, or private key information appear anywhere in the screenshot.</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: YOUR WEBSITE IS LIVE */}
      <section id="your-website-is-live" className="mb-12 scroll-mt-20">
        <div className="border-2 border-black dark:border-white bg-[#fbfbf9] dark:bg-zinc-900 shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff] p-6 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto border-2 border-black bg-[#a6ff70] text-black shadow-[3px_3px_0px_#000000] flex items-center justify-center">
            <PartyPopper className="w-7 h-7 stroke-[2.5]" />
          </div>

          <h2 className="text-2xl sm:text-4xl font-black text-black dark:text-zinc-100 tracking-tight">
            Your Website Is Live
          </h2>

          <p className="max-w-xl mx-auto text-sm sm:text-base text-slate-800 dark:text-zinc-200 leading-relaxed font-sans">
            Congratulations! You have taken a static website from a GitHub repository, prepared an EC2 virtual machine, configured firewall network rules, installed Nginx on Amazon Linux 2023, published the files, and verified the live result through a public browser URL.
          </p>

          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 font-mono italic">
            If your website does not look correct or the public URL does not respond, use the systematic troubleshooting checklist in the next chapter to diagnose the problem.
          </p>

          <div className="pt-3">
            <NeoButton
              variant="black"
              size="md"
              icon={Sparkles}
              onClick={() => onNavigate('intro-deployment')}
            >
              DEPLOYMENT COMPLETE • RETURN TO OVERVIEW
            </NeoButton>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'deploy-connect-and-install',
          title: 'Connect to the server and install Nginx',
          pageLabel: 'Page 3 of 4',
        }}
        next={{
          id: 'verification-checklist',
          title: 'Prove the website is really deployed',
          pageLabel: 'Chapter 03',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
