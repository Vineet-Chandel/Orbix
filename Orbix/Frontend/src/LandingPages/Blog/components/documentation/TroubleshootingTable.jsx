import React from 'react';

export const TROUBLESHOOTING_ENTRIES = [
  {
    symptom: 'SSH connection times out',
    cause: "Port 22 is blocked, the administrator's source IP has changed, or the instance is not reachable through its public address or network route.",
    solution: (
      <>
        Check the security group's SSH source rule, verify the current public IP address, confirm subnet route table points to an Internet Gateway, and verify you are connecting from the approved administration network. Confirm that the instance state is <strong>Running</strong> and its status checks have passed.
      </>
    ),
  },
  {
    symptom: 'Permission denied (publickey)',
    cause: 'The wrong private key is being used, the SSH username is incorrect, or private-key file permissions are too permissive.',
    solution: (
      <>
        Verify the key-pair name associated with the EC2 instance in the AWS Console. Use the correct <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">.pem</code> file and username (for Amazon Linux 2023, the default username is <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">ec2-user</code>). On macOS and Linux, set read-only permissions with <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">chmod 400 ~/Downloads/aws-class-key.pem</code>. Ensure the file path matches your local filesystem. Windows users using PowerShell or OpenSSH must also ensure only their current user account has read access.
      </>
    ),
  },
  {
    symptom: 'Website times out',
    cause: 'HTTP is blocked, the instance does not have the expected public IPv4 connectivity, or subnet routing is not configured for internet access.',
    solution: (
      <>
        Check that your Security Group has an inbound rule for TCP port 80 from <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">0.0.0.0/0</code> (Anywhere IPv4). Verify the instance's active Public IPv4 address in the EC2 Console, and verify the subnet route table directs <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">0.0.0.0/0</code> to an Internet Gateway (<code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">igw-...</code>). <em>Do not open every port or disable firewalls.</em>
      </>
    ),
  },
  {
    symptom: 'Connection refused on port 80',
    cause: 'Nginx is stopped, has failed to start, or is not listening on the expected interface and port.',
    solution: (
      <>
        Check the Nginx service status with <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">sudo systemctl status nginx</code>, inspect recent error logs, and check listening ports with <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">sudo ss -tulpn | grep :80</code>. Start or restart Nginx only after inspecting the reported condition.
      </>
    ),
  },
  {
    symptom: 'Nginx welcome page appears',
    cause: 'The starter website files have not been copied to the configured document root, or the expected index.html was not replaced.',
    solution: (
      <>
        Confirm that <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">/usr/share/nginx/html/index.html</code> contains your intended website files rather than the default package page. Verify the document root files with <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">ls -la /usr/share/nginx/html</code>, re-copy the deployed repository files, and run <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">sudo systemctl reload nginx</code>.
      </>
    ),
  },
  {
    symptom: '403 Forbidden',
    cause: 'The requested content is unavailable because of file permissions, directory permissions, missing index configuration, or a server access rule.',
    solution: (
      <>
        Check the requested file path and document root. Ensure files have readable permissions (<code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">chmod 644</code>) and directories have traversal/executable permissions (<code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">chmod 755</code>). Inspect <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">/var/log/nginx/error.log</code> for the exact denial reason. <em>Do not solve permission problems by recursively granting unrestricted write access (e.g. avoid chmod 777).</em>
      </>
    ),
  },
  {
    symptom: '404 Not Found',
    cause: 'The requested path or filename is incorrect, or the file is missing from the deployed directory.',
    solution: (
      <>
        Check the exact URL in your browser, filename capitalization (Linux filesystems are strictly case-sensitive), deployment directory location, and relative paths referenced in the HTML. Confirm the requested file actually exists in <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">/usr/share/nginx/html/</code>.
      </>
    ),
  },
  {
    symptom: 'CSS or images are missing',
    cause: 'Asset paths are incorrect, filename capitalization does not match, or the required files were not copied.',
    solution: (
      <>
        Open browser Developer Tools (F12) to inspect the <strong>Network</strong> tab for red 404 responses. Compare requested asset paths against the actual directory structure and exact filenames in <code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">/usr/share/nginx/html/</code>.
      </>
    ),
  },
  {
    symptom: 'git clone fails',
    cause: 'The repository URL is incorrect, the repository is unavailable, GitHub access is blocked, or a private repository requires authorization.',
    solution: (
      <>
        Check the repository URL and branch name. Verify network connectivity from EC2 to GitHub. If using a private repository, use an approved personal access token or SSH deploy key. <em>Never put access tokens or private credentials into public files, GitHub commits, or screenshots.</em>
      </>
    ),
  },
  {
    symptom: '502 Bad Gateway',
    cause: 'A reverse proxy cannot reach its upstream application or backend.',
    solution: (
      <>
        Check the upstream application process, reverse proxy configuration (<code className="font-mono text-[11px] bg-slate-200 dark:bg-zinc-800 px-1 py-0.5 rounded">proxy_pass</code>), and service logs. Note that this error is not part of a standard static Nginx deployment because our workshop serves static files directly from disk without an application backend. A 502 can have different causes depending on architecture; investigate upstream communication rather than assuming a single cause.
      </>
    ),
  },
];

export function TroubleshootingTable() {
  return (
    <div className="overflow-x-auto border-2 border-black dark:border-white shadow-[5px_5px_0px_#000000] dark:shadow-[5px_5px_0px_#ffffff] bg-white dark:bg-zinc-900 my-8">
      <table className="w-full text-left text-xs border-collapse min-w-[640px]">
        <thead>
          <tr className="bg-black text-white dark:bg-white dark:text-black border-b-2 border-black dark:border-zinc-800 select-none">
            <th className="py-3.5 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[26%]">
              SYMPTOM
            </th>
            <th className="py-3.5 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[34%]">
              POSSIBLE CAUSE
            </th>
            <th className="py-3.5 px-4 font-mono font-bold uppercase tracking-wider text-[11px] w-[40%]">
              WHAT TO TRY
            </th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-black/10 dark:divide-zinc-800">
          {TROUBLESHOOTING_ENTRIES.map((entry, idx) => (
            <tr
              key={idx}
              className={`transition-colors ${
                idx % 2 === 0
                  ? 'bg-white dark:bg-zinc-950/40'
                  : 'bg-[#fbfbf9] dark:bg-zinc-900/30'
              } hover:bg-[#a6ff70]/10`}
            >
              <td className="py-3.5 px-4 align-top font-black text-black dark:text-zinc-100 font-mono text-[11px]">
                {entry.symptom}
              </td>
              <td className="py-3.5 px-4 align-top text-slate-800 dark:text-zinc-300 leading-relaxed font-sans">
                {entry.cause}
              </td>
              <td className="py-3.5 px-4 align-top text-slate-800 dark:text-zinc-300 leading-relaxed font-sans">
                {entry.solution}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}