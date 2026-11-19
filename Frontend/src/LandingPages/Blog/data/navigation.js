/**
 * Navigation structure for the AWS Cloud Launchpad — Deployment Workbook.
 * Only contains fully created and functional sections.
 */

export const WORKBOOK_SECTIONS = [
  {
    title: 'INTRODUCTION',
    items: [
      {
        id: 'overview',
        title: 'Overview',
        status: 'ready',
        chapter: '00',
        pageNumber: 1,
        description: 'Deploy your first website to AWS — 2-hour workshop overview and architecture.',
        icon: 'BookOpen',
      },
    ],
  },
  {
    title: '01 / INTRODUCTION & PREREQUISITES',
    items: [
      {
        id: 'intro-deployment',
        title: 'What is AWS deployment?',
        status: 'ready',
        chapter: '01',
        pageNumber: 1,
        description: 'Understand local vs cloud deployment, why developers choose AWS, and the 4-stage pipeline.',
        icon: 'BookOpen',
      },
      {
        id: 'intro-ec2-architecture',
        title: 'How the EC2 deployment fits together',
        status: 'ready',
        chapter: '01',
        pageNumber: 2,
        description: 'Interactive AWS Cloud, VPC, EC2, Security Group, and IAM architecture diagram.',
        icon: 'Server',
      },
      {
        id: 'intro-aws-services',
        title: 'AWS services: learn the job, not just the name',
        status: 'ready',
        chapter: '01',
        pageNumber: 3,
        description: 'Glossary of 14 key AWS services with roles, categories, and memory tricks.',
        icon: 'Cloud',
      },
      {
        id: 'intro-preflight',
        title: 'Preflight: tools, repository, account and permissions',
        status: 'ready',
        chapter: '01',
        pageNumber: 4,
        description: 'Verify tools, terminal checks, GitHub starter template, and the final readiness check.',
        icon: 'CheckCircle2',
      },
    ],
  },
  {
    title: '02 / STEP-BY-STEP DEPLOYMENT',
    items: [
      {
        id: 'deploy-inspect-and-launch',
        title: 'Project 1: inspect the files, then open EC2',
        status: 'ready',
        chapter: '02',
        pageNumber: 1,
        description: 'Starter file tree mapping to /usr/share/nginx/html/ and EC2 launch settings.',
        icon: 'FolderTree',
      },
      {
        id: 'deploy-networking',
        title: 'Network rules: let visitors in, keep administration restricted',
        status: 'ready',
        chapter: '02',
        pageNumber: 2,
        description: 'Inbound firewall rules for SSH port 22 and HTTP port 80, plus instance status confirmation.',
        icon: 'ShieldCheck',
      },
      {
        id: 'deploy-connect-and-install',
        title: 'Connect to the server and install Nginx',
        status: 'ready',
        chapter: '02',
        pageNumber: 3,
        description: 'SSH terminal connection, dnf package installation, and local curl test on EC2.',
        icon: 'Terminal',
      },
      {
        id: 'deploy-and-verify',
        title: 'Deploy the repository and open the live website',
        status: 'ready',
        chapter: '02',
        pageNumber: 4,
        description: 'Clone repository, copy public files, reload Nginx, and open public IPv4 website.',
        icon: 'Globe',
      },
    ],
  },
  {
    title: '03 / VERIFICATION CHECKLIST',
    items: [
      {
        id: 'verification-checklist',
        title: 'Prove the website is really deployed',
        status: 'ready',
        chapter: '03',
        pageNumber: 1,
        description: 'Verify EC2 status, security groups, Nginx daemon, web files, and test public HTTP delivery.',
        icon: 'CheckCircle2',
      },
    ],
  },
  {
    title: '04 / TROUBLESHOOTING GUIDE',
    items: [
      {
        id: 'troubleshoot-common-errors',
        title: 'Common errors, likely causes and fixes',
        status: 'ready',
        chapter: '04',
        pageNumber: 1,
        description: 'Diagnostic matrix for 10 common SSH, networking, Nginx, and static file errors.',
        icon: 'AlertTriangle',
      },
      {
        id: 'troubleshoot-debugging-toolkit',
        title: 'Your first debugging toolkit',
        status: 'ready',
        chapter: '04',
        pageNumber: 2,
        description: '8 diagnostic inspection commands, 2-branch debugging flowchart, and instructor activity.',
        icon: 'Terminal',
      },
    ],
  },
  {
    title: '05 / INDEPENDENT DEPLOYMENT CHALLENGE',
    items: [
      {
        id: 'challenge-project-two',
        title: 'Project 2: deploy a multi-page website',
        status: 'ready',
        chapter: '05',
        pageNumber: 1,
        description: 'Independent challenge to deploy Maryam-Skaik/static-website-demo to Amazon EC2.',
        icon: 'Flame',
      },
      {
        id: 'challenge-checklist',
        title: 'Independent checklist — hints, not the complete solution',
        status: 'ready',
        chapter: '05',
        pageNumber: 2,
        description: '10-task milestone checklist, submission requirements, and 4-point mentor scoring rubric.',
        icon: 'ListChecks',
      },
    ],
  },
  {
    title: '06 / SECURITY AND PERMISSIONS',
    items: [
      {
        id: 'security-and-permissions',
        title: 'Build safe cloud habits from the beginning',
        status: 'ready',
        chapter: '06',
        pageNumber: 1,
        description: 'Six security principles, IAM vs security groups vs Linux permissions, shared responsibility, and safety checks.',
        icon: 'ShieldCheck',
      },
    ],
  },
  {
    title: '07 / COST AWARENESS AND RESOURCE CLEANUP',
    items: [
      {
        id: 'cost-and-cleanup',
        title: 'Finish the lab without surprise charges',
        status: 'ready',
        chapter: '07',
        pageNumber: 1,
        description: 'Before deployment pricing checklist, workshop cleanup steps, stopping vs terminating, and official budget links.',
        icon: 'DollarSign',
      },
    ],
  },
  {
    title: '08 / FURTHER LEARNING RESOURCES',
    items: [
      {
        id: 'further-learning',
        title: 'Official AWS documentation to keep learning',
        status: 'ready',
        chapter: '08',
        pageNumber: 1,
        description: '13 curated official AWS User Guides, 3-stage learning progression, and next learning path.',
        icon: 'Compass',
      },
    ],
  },
  {
    title: '09 / INSTRUCTOR AND ORGANISER CHECKLIST',
    items: [
      {
        id: 'instructor-checklist',
        title: 'Make the workshop reproducible',
        status: 'ready',
        chapter: '09',
        pageNumber: 1,
        description: 'Screenshot target instructions, 5 live evidence requirements, 7 pre-event checks, and assessment guidance.',
        icon: 'ListChecks',
      },
    ],
  },
];
