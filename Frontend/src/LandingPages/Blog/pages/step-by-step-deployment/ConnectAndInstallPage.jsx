import React from 'react';
import { ChapterHeader } from '../../components/documentation/ChapterHeader';
import { ChapterPagination } from '../../components/documentation/ChapterPagination';
import { TerminalPanel } from '../../components/documentation/TerminalPanel';
import { Camera, AlertTriangle, CheckCircle2, Terminal, ShieldAlert, Cpu } from 'lucide-react';

export const DEPLOY_PAGE_3_HEADINGS = [
  { id: 'step-5-connect-using-ssh', text: 'Step 5 — Connect Using SSH', level: 2 },
  { id: 'if-ssh-fails', text: 'If SSH Fails', level: 2 },
  { id: 'step-6-install-git-and-nginx', text: 'Step 6 — Install Git and Nginx', level: 2 },
  { id: 'test-nginx-locally-on-ec2', text: 'Test Nginx Locally on EC2', level: 2 },
  { id: 'screenshot-targets-4-and-5', text: 'Screenshot Targets 4 + 5', level: 2 },
];

export function ConnectAndInstallPage({ onNavigate = () => {} }) {
  const breadcrumbs = [
    { id: 'deploy-inspect-and-launch', label: 'Step-by-Step Deployment' },
    { id: 'deploy-connect-and-install', label: 'Connect SSH & Install Nginx' },
  ];

  return (
    <article className="max-w-4xl xl:max-w-5xl 2xl:max-w-6xl mx-auto px-4 sm:px-8 py-8 lg:py-10">
      {/* Chapter Header */}
      <ChapterHeader
        chapterNumber="02"
        chapterTitle="STEP-BY-STEP DEPLOYMENT"
        pageNumber={3}
        totalPages={4}
        title="Connect to the server and install Nginx"
        intro="We are now working on the remote Linux computer in AWS, not on your laptop. Commands typed in the SSH session run on EC2."
        breadcrumbItems={breadcrumbs}
        onNavigate={onNavigate}
      />

      {/* SECTION 1: STEP 5 — CONNECT USING SSH */}
      <section id="step-5-connect-using-ssh" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 5 — Connect using SSH
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          On macOS or Linux, open <strong>Terminal</strong>. On Windows, use <strong>OpenSSH in PowerShell</strong> or <strong>Windows Terminal</strong> (or use the approved browser-based EC2 Instance Connect method if supported by your workshop).
        </p>

        {/* Terminal Panel - Local Laptop Commands */}
        <TerminalPanel
          label="RUN ON YOUR LAPTOP — REPLACE PATH + IP"
          isLaptop={true}
          commands={[
            'chmod 400 ~/Downloads/aws-class-key.pem',
            'ssh -i ~/Downloads/aws-class-key.pem ec2-user@YOUR_PUBLIC_IP',
          ]}
        />

        <div className="space-y-2 text-xs sm:text-sm text-slate-700 dark:text-zinc-300 mt-4 leading-relaxed">
          <p>
            • Replace <code className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 font-bold text-workbook-navy dark:text-zinc-100">YOUR_PUBLIC_IP</code> with the actual public IPv4 address displayed in your EC2 instance details.
          </p>
          <p>
            • Ensure the key path matches where your <code className="font-mono text-xs">.pem</code> file was saved (e.g. <code className="font-mono text-xs">~/Downloads/aws-class-key.pem</code>).
          </p>
          <p>
            • The default SSH username for the Amazon Linux 2023 AMI is <code className="font-mono text-xs font-bold text-workbook-navy dark:text-zinc-100">ec2-user</code>.
          </p>
          <p>
            • <code className="font-mono text-xs">chmod 400</code> sets the required read-only permissions on macOS and Linux. Windows PowerShell handles key ACL permissions through file properties.
          </p>
        </div>
      </section>

      {/* SECTION 2: IF SSH FAILS */}
      <section id="if-ssh-fails" className="mb-12 scroll-mt-20">
        <div className="rounded-r-xl border-l-4 border-workbook-orange bg-amber-50/70 dark:bg-amber-950/30 p-5 text-slate-800 dark:text-zinc-200 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase text-workbook-orange mb-2 select-none">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>IF SSH FAILS • 6-POINT CHECKLIST</span>
          </div>
          <p className="text-sm sm:text-base leading-relaxed text-slate-800 dark:text-zinc-100 mb-3">
            If your connection times out or rejects your key, verify each item below before asking a mentor:
          </p>
          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li>1. Check that the file path to <code className="font-mono text-xs">aws-class-key.pem</code> is exact and accessible.</li>
            <li>2. Confirm the key pair matches the one selected during instance launch.</li>
            <li>3. Verify the security group inbound rule permits port 22 from your current IP address.</li>
            <li>4. Confirm the instance state is <em>Running</em> and status checks report <em>2/2 passed</em>.</li>
            <li>5. Verify you copied the <em>Public IPv4 address</em>, not the Private IPv4 address.</li>
            <li>6. Confirm the username is <code className="font-mono text-xs">ec2-user</code>.</li>
          </ul>
          <div className="mt-4 pt-3 border-t border-amber-200 dark:border-amber-900/40 text-xs font-semibold text-amber-900 dark:text-amber-300">
            Never send your private key to a mentor or peer. Share only the terminal error message and non-sensitive details.
          </div>
        </div>
      </section>

      {/* SECTION 3: STEP 6 — INSTALL GIT AND NGINX */}
      <section id="step-6-install-git-and-nginx" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-blue mb-4">
          Step 6 — Install Git and Nginx on EC2
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Now that you are connected to the Amazon Linux terminal, install the package dependencies and activate the Nginx web server daemon:
        </p>

        {/* Terminal Panel - Run inside SSH */}
        <TerminalPanel
          label="RUN INSIDE THE SSH SESSION"
          isSsh={true}
          commands={[
            'sudo dnf update -y',
            'sudo dnf install -y git nginx',
            'sudo systemctl enable --now nginx',
            'sudo systemctl is-active nginx',
          ]}
        />

        {/* Command Explanations */}
        <div className="rounded-xl border border-workbook-border dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs my-4">
          <ul className="space-y-3 text-xs sm:text-sm text-slate-700 dark:text-zinc-300">
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold font-mono text-xs mt-0.5">•</span>
              <div>
                <code className="font-mono font-bold text-slate-900 dark:text-zinc-100">sudo dnf update -y</code>: Updates available installed packages according to Amazon Linux 2023 repositories.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold font-mono text-xs mt-0.5">•</span>
              <div>
                <code className="font-mono font-bold text-slate-900 dark:text-zinc-100">sudo dnf install -y git nginx</code>: Installs Git (for cloning the starter code) and Nginx (the web server daemon).
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold font-mono text-xs mt-0.5">•</span>
              <div>
                <code className="font-mono font-bold text-slate-900 dark:text-zinc-100">sudo systemctl enable --now nginx</code>: Configures Nginx to start automatically at system boot and launches it immediately.
              </div>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="text-workbook-blue font-bold font-mono text-xs mt-0.5">•</span>
              <div>
                <code className="font-mono font-bold text-slate-900 dark:text-zinc-100">sudo systemctl is-active nginx</code>: Verifies whether the service is running. The expected terminal output is <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">active</span>.
              </div>
            </li>
          </ul>
        </div>

        <p className="text-xs text-slate-500 dark:text-zinc-400 italic">
          Note: These commands are specifically tailored for Amazon Linux 2023 using the <code className="font-mono text-xs">dnf</code> package manager. Do not substitute Ubuntu&apos;s <code className="font-mono text-xs">apt</code> commands.
        </p>
      </section>

      {/* SECTION 4: TEST NGINX LOCALLY ON EC2 */}
      <section id="test-nginx-locally-on-ec2" className="mb-12 scroll-mt-20">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-workbook-navy dark:text-zinc-100 mb-3">
          Test Nginx Locally on EC2
        </h2>
        <p className="text-sm sm:text-base text-slate-700 dark:text-zinc-300 leading-relaxed mb-4">
          Before copying your website files, check that Nginx responds to HTTP requests on the EC2 instance itself:
        </p>

        {/* Terminal Panel */}
        <TerminalPanel
          label="TEST NGINX LOCALLY ON EC2"
          isSsh={true}
          commands="curl -I http://localhost"
        />

        <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 leading-relaxed mt-3">
          This request tests Nginx from inside the server. A successful response includes an HTTP status header such as <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">HTTP/1.1 200 OK</span>.
        </p>
        <p className="text-xs text-slate-500 dark:text-zinc-400 italic mt-1">
          A successful local curl test proves the Nginx daemon is running, but does not prove public internet reachability. Public browser access will be verified in Step 8.
        </p>
      </section>

      {/* SECTION 5: SCREENSHOT TARGETS 4 + 5 */}
      <section id="screenshot-targets-4-and-5" className="mb-12 scroll-mt-20">
        <div className="p-5 border-2 border-black dark:border-white bg-[#a6ff70]/20 dark:bg-emerald-950/30 text-black dark:text-zinc-100 shadow-[4px_4px_0px_#000000] dark:shadow-[4px_4px_0px_#ffffff] space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-bold font-mono tracking-wider uppercase px-2 py-0.5 bg-black text-white dark:bg-white dark:text-black select-none">
            <Camera className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>SCREENSHOT TARGETS 4 + 5 • WORKSHOP EVIDENCE</span>
          </div>

          <p className="text-sm sm:text-base leading-relaxed text-black dark:text-zinc-100 font-bold">
            Capture the connected Amazon Linux terminal and a terminal showing the Nginx service as active together with the local HTTP test. Never include passwords, private keys, authentication tokens, or other secrets.
          </p>

          {/* Evidence Checklist */}
          <div className="space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 pt-3 border-t-2 border-black/10 dark:border-white/10">
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>SSH session connected to the expected Amazon Linux instance.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>Nginx service reports status <strong>active</strong>.</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="w-2 h-2 bg-[#a6ff70] border border-black shrink-0" />
              <span>Local HTTP request (<code className="font-mono text-xs bg-[#f4f3ee] dark:bg-zinc-800 px-1 py-0.5 border border-black">curl -I http://localhost</code>) returns an HTTP 200 OK header.</span>
            </div>
          </div>
        </div>
      </section>

      {/* Pagination Navigation */}
      <ChapterPagination
        prev={{
          id: 'deploy-networking',
          title: 'Network rules: let visitors in, keep administration restricted',
          pageLabel: 'Page 2 of 4',
        }}
        next={{
          id: 'deploy-and-verify',
          title: 'Deploy the repository and open the live website',
          pageLabel: 'Page 4 of 4',
        }}
        onNavigate={onNavigate}
      />
    </article>
  );
}
