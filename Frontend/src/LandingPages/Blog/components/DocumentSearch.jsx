import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, Hash, CornerDownLeft } from 'lucide-react';

/**
 * Searchable topics across all pages of Chapters 1 and 2.
 */
const SEARCHABLE_TOPICS = [
  // INTRODUCTION - OVERVIEW
  {
    pageId: 'overview',
    pageTitle: 'Introduction: Deploy your first website to AWS',
    heading: 'From Repository to Live Website',
    slug: 'from-repository-to-live-website',
    text: 'Overview pipeline: local computer -> GitHub repository -> Amazon EC2 (Amazon Linux 2023) -> Nginx -> Public IPv4 URL.',
  },
  {
    pageId: 'overview',
    pageTitle: 'Introduction: Deploy your first website to AWS',
    heading: 'Three Steps to Your First Deployment',
    slug: 'three-steps-to-your-first-deployment',
    text: '120-minute launchpad roadmap: Understanding AWS infrastructure, Guided server deployment, and Verification checklist.',
  },

  // CHAPTER 1 - PAGE 1
  {
    pageId: 'intro-deployment',
    pageTitle: '01 • Page 1: What is AWS deployment?',
    heading: 'Local Development vs Cloud Deployment',
    slug: 'local-vs-cloud',
    text: 'Local development on localhost:3000 vs cloud deployment on AWS infrastructure vs live application for internet users.',
  },
  {
    pageId: 'intro-deployment',
    pageTitle: '01 • Page 1: What is AWS deployment?',
    heading: 'Why Do Developers Use AWS?',
    slug: 'why-developers-use-aws',
    text: 'Accessibility, Scalability, Reliability, Service choice, Usage-based pricing, and Security controls.',
  },
  {
    pageId: 'intro-deployment',
    pageTitle: '01 • Page 1: What is AWS deployment?',
    heading: 'Cloud Does Not Automatically Mean Free',
    slug: 'cloud-does-not-mean-free',
    text: 'Important cost warning: Check current account pricing, available credits, storage, data transfer, and public IPv4 charges before launching resources.',
  },
  {
    pageId: 'intro-deployment',
    pageTitle: '01 • Page 1: What is AWS deployment?',
    heading: "Today's Deployment in One Line",
    slug: 'todays-deployment-in-one-line',
    text: 'GitHub repository -> Amazon EC2 -> Nginx -> Browser + public IP. Network path: Visitor -> Security Group (HTTP :80) -> EC2 -> Nginx -> files. Admin path: SSH port 22.',
  },

  // CHAPTER 1 - PAGE 2
  {
    pageId: 'intro-ec2-architecture',
    pageTitle: '01 • Page 2: How the EC2 deployment fits together',
    heading: 'The Network in Plain English',
    slug: 'the-network-in-plain-english',
    text: 'AWS Cloud, VPC logically isolated network, EC2 instance with Amazon Linux 2023 & Nginx port 80, Security Group stateful firewall, and AWS IAM permissions.',
  },
  {
    pageId: 'intro-ec2-architecture',
    pageTitle: '01 • Page 2: How the EC2 deployment fits together',
    heading: 'What Does Each Component Do?',
    slug: 'what-does-each-component-do',
    text: 'Job matrix: GitHub repository, Amazon EC2, Amazon Linux 2023, Nginx, Security group, Public IPv4 address, and IAM.',
  },
  {
    pageId: 'intro-ec2-architecture',
    pageTitle: '01 • Page 2: How the EC2 deployment fits together',
    heading: 'Two Paths, Two Jobs',
    slug: 'two-paths-two-jobs',
    text: 'Administrator path uses SSH on port 22 to control server. Visitor path uses HTTP on port 80 to view files. Never expose SSH to public internet.',
  },

  // CHAPTER 1 - PAGE 3
  {
    pageId: 'intro-aws-services',
    pageTitle: '01 • Page 3: AWS services: learn the job, not just the name',
    heading: 'AWS Services Students Should Recognize',
    slug: 'aws-services-students-should-recognize',
    text: 'Glossary of 14 key AWS services: EC2, Region, Availability Zone, IAM, VPC, Security Group, S3, RDS, ELB, CloudWatch, Lambda, Route 53, CloudFront, Budgets.',
  },
  {
    pageId: 'intro-aws-services',
    pageTitle: '01 • Page 3: AWS services: learn the job, not just the name',
    heading: 'Quick Memory Trick',
    slug: 'quick-memory-trick',
    text: 'EC2 runs a virtual machine. S3 stores objects. RDS manages relational databases. Lambda runs event-driven code. CloudWatch observes systems. Route 53 handles DNS. IAM grants permissions. Security groups filter network traffic.',
  },
  {
    pageId: 'intro-aws-services',
    pageTitle: '01 • Page 3: AWS services: learn the job, not just the name',
    heading: 'Official Documentation',
    slug: 'official-documentation',
    text: 'Authoritative further reading: EC2 Security Groups, Identity and Access Management, Security Group Rules Reference, Amazon Linux 2023 tutorials.',
  },

  // CHAPTER 1 - PAGE 4
  {
    pageId: 'intro-preflight',
    pageTitle: '01 • Page 4: Preflight: tools, repository, account and permissions',
    heading: 'Tools You Need',
    slug: 'tools-you-need',
    text: 'Laptop + internet, Git + SSH client, ZIP / file manager, Node.js / npm, AWS CLI, Approved AWS login.',
  },
  {
    pageId: 'intro-preflight',
    pageTitle: '01 • Page 4: Preflight: tools, repository, account and permissions',
    heading: 'Local Checks',
    slug: 'local-checks',
    text: 'Run on your laptop: git --version checks Git availability. ssh -V checks OpenSSH client installation.',
  },
  {
    pageId: 'intro-preflight',
    pageTitle: '01 • Page 4: Preflight: tools, repository, account and permissions',
    heading: 'GitHub Repository Access',
    slug: 'github-repository-access',
    text: 'Starter template: zirafa/simple-website-template gh-pages branch. Inspect HTML, CSS, JS starter files before deployment.',
  },
  {
    pageId: 'intro-preflight',
    pageTitle: '01 • Page 4: Preflight: tools, repository, account and permissions',
    heading: 'AWS Account and Permissions',
    slug: 'aws-account-and-permissions',
    text: 'Checklist: approved account, EC2 launching permissions, key pair handling (chmod 400), least privilege, resource cleanup, MFA, credential confidentiality.',
  },
  {
    pageId: 'intro-preflight',
    pageTitle: '01 • Page 4: Preflight: tools, repository, account and permissions',
    heading: 'Ready Check',
    slug: 'ready-check',
    text: 'Interactive 6-point checklist confirming laptop, AWS login, GitHub repo, EC2 permissions, SSH connection, and pricing awareness before launching EC2.',
  },

  // CHAPTER 2 - PAGE 1
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'Project 1: Files the Browser Needs',
    slug: 'project-1-files-the-browser-needs',
    text: 'GitHub repository (gh-pages) to /usr/share/nginx/html/: index.html, style.css, script.js, logo.png, background.jpg.',
  },
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'Step 1 — Inspect the repository',
    slug: 'step-1-inspect-the-repository',
    text: 'Step 1: Inspect starter code on GitHub gh-pages branch. Confirm filenames index.html, style.css, script.js, logo.png, background.jpg.',
  },
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'What Is index.html?',
    slug: 'what-is-index-html',
    text: 'The default entry page of a simple website. Web server automatically returns this file upon receiving a root request.',
  },
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'Step 2 — Sign in and launch an EC2 instance',
    slug: 'step-2-sign-in-and-launch-ec2',
    text: 'Step 2: Sign into AWS Console. Name: aws-class-website, AMI: Amazon Linux 2023, Instance: t2.micro / t3.micro, Key pair: aws-class-key (.pem).',
  },
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'Key Pair Safety',
    slug: 'key-pair-safety',
    text: 'Store the private .pem key securely. Never upload to GitHub, share in chat, or include in screenshots.',
  },
  {
    pageId: 'deploy-inspect-and-launch',
    pageTitle: '02 • Page 1: Project 1: inspect the files, then open EC2',
    heading: 'Screenshot Target 1',
    slug: 'screenshot-target-1',
    text: 'Evidence capture: EC2 Launch Instance page showing selected OS, instance type, and key-pair name.',
  },

  // CHAPTER 2 - PAGE 2
  {
    pageId: 'deploy-networking',
    pageTitle: '02 • Page 2: Network rules: let visitors in, keep administration restricted',
    heading: 'Understand the Required Inbound Rules',
    slug: 'understand-the-required-inbound-rules',
    text: 'SSH TCP port 22 restricted to My IP for administration. HTTP TCP port 80 from Anywhere IPv4 (0.0.0.0/0) for public website visitors.',
  },
  {
    pageId: 'deploy-networking',
    pageTitle: '02 • Page 2: Network rules: let visitors in, keep administration restricted',
    heading: 'Do Not Open SSH to Everyone',
    slug: 'do-not-open-ssh-to-everyone',
    text: 'Keep SSH port 22 restricted to My IP. Do not use 0.0.0.0/0 for SSH just because it is easier.',
  },
  {
    pageId: 'deploy-networking',
    pageTitle: '02 • Page 2: Network rules: let visitors in, keep administration restricted',
    heading: 'Step 3 — Configure networking',
    slug: 'step-3-configure-networking',
    text: 'Step 3: Create security group, configure inbound rules for SSH 22 (My IP) and HTTP 80 (0.0.0.0/0), ensure public IPv4 assignment.',
  },
  {
    pageId: 'deploy-networking',
    pageTitle: '02 • Page 2: Network rules: let visitors in, keep administration restricted',
    heading: 'Step 4 — Launch and confirm readiness',
    slug: 'step-4-launch-and-confirm-readiness',
    text: 'Step 4: Launch instance. Wait for state Running, status checks 2/2 passed, and copy Public IPv4 address.',
  },
  {
    pageId: 'deploy-networking',
    pageTitle: '02 • Page 2: Network rules: let visitors in, keep administration restricted',
    heading: 'Screenshot Targets 2 + 3',
    slug: 'screenshot-targets-2-and-3',
    text: 'Evidence capture: Inbound rules table (SSH 22 & HTTP 80) and Instances view showing Running status and Public IPv4.',
  },

  // CHAPTER 2 - PAGE 3
  {
    pageId: 'deploy-connect-and-install',
    pageTitle: '02 • Page 3: Connect to the server and install Nginx',
    heading: 'Step 5 — Connect using SSH',
    slug: 'step-5-connect-using-ssh',
    text: 'Step 5: Run on laptop: chmod 400 ~/Downloads/aws-class-key.pem && ssh -i ~/Downloads/aws-class-key.pem ec2-user@YOUR_PUBLIC_IP.',
  },
  {
    pageId: 'deploy-connect-and-install',
    pageTitle: '02 • Page 3: Connect to the server and install Nginx',
    heading: 'If SSH Fails',
    slug: 'if-ssh-fails',
    text: 'Troubleshooting: verify key path, key pair match, port 22 inbound rule, instance running, public IP, and ec2-user username.',
  },
  {
    pageId: 'deploy-connect-and-install',
    pageTitle: '02 • Page 3: Connect to the server and install Nginx',
    heading: 'Step 6 — Install Git and Nginx on EC2',
    slug: 'step-6-install-git-and-nginx',
    text: 'Step 6: Run inside SSH: sudo dnf update -y && sudo dnf install -y git nginx && sudo systemctl enable --now nginx && sudo systemctl is-active nginx.',
  },
  {
    pageId: 'deploy-connect-and-install',
    pageTitle: '02 • Page 3: Connect to the server and install Nginx',
    heading: 'Test Nginx Locally on EC2',
    slug: 'test-nginx-locally-on-ec2',
    text: 'Verify web server locally on server: curl -I http://localhost. Expected response: HTTP/1.1 200 OK.',
  },
  {
    pageId: 'deploy-connect-and-install',
    pageTitle: '02 • Page 3: Connect to the server and install Nginx',
    heading: 'Screenshot Targets 4 + 5',
    slug: 'screenshot-targets-4-and-5',
    text: 'Evidence capture: Connected Amazon Linux terminal, Nginx active status, and local HTTP 200 curl test.',
  },

  // CHAPTER 2 - PAGE 4
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Step 7 — Clone and deploy website files',
    slug: 'step-7-clone-and-deploy-website-files',
    text: 'Step 7: git clone --branch gh-pages --single-branch https://github.com/zirafa/simple-website-template.git my-first-website.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Copy Only Public Website Files',
    slug: 'copy-only-public-website-files',
    text: 'sudo cp index.html style.css script.js logo.png background.jpg /usr/share/nginx/html/ && sudo nginx -t && sudo systemctl reload nginx.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Public Directory = Public Files',
    slug: 'public-directory-warning',
    text: 'Never place .env files, passwords, private SSH keys, or tokens in /usr/share/nginx/html/. Keep secrets outside the web root.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Step 8 — Open the live website',
    slug: 'step-8-open-the-live-website',
    text: 'Step 8: Open http://YOUR_PUBLIC_IP in web browser. Verify starter website renders live on the public internet.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Screenshot Targets for the Live Workshop',
    slug: 'screenshot-targets-for-the-live-workshop',
    text: '5 evidence targets: SCREEN 01 Launch Page, SCREEN 02 Network Rules, SCREEN 03 Instance Status, SCREEN 04 Terminal, SCREEN 05 Browser.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Screenshot Target 6 — Proof of Deployment',
    slug: 'screenshot-target-6-proof-of-deployment',
    text: 'Evidence capture: Browser address bar showing public IPv4 address and correctly rendered deployed website.',
  },
  {
    pageId: 'deploy-and-verify',
    pageTitle: '02 • Page 4: Deploy the repository and open the live website',
    heading: 'Your Website Is Live',
    slug: 'your-website-is-live',
    text: 'Completion: Live static website running on Nginx, Amazon Linux 2023, and Amazon EC2.',
  },

  // CHAPTER 3 - VERIFICATION CHECKLIST
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'Deployment Verification Checklist',
    slug: 'deployment-verification-checklist',
    text: 'Checklist: EC2 is Running, Public address exists, Security group is correct, Nginx is active, Website files are in place, Local HTTP succeeds, Public URL opens, Public HTTP returns success.',
  },
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'Verification Commands',
    slug: 'verification-commands',
    text: 'sudo systemctl status nginx --no-pager, curl -I http://localhost, ls -la /usr/share/nginx/html on EC2, and curl -I http://YOUR_PUBLIC_IP on laptop.',
  },
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'What Does HTTP 200 OK Mean?',
    slug: 'what-does-http-200-ok-mean',
    text: 'HTTP/1.1 200 OK status code explanation. Differences between 200 OK, 403 Forbidden, 404 Not Found, and connection timeouts or refusal.',
  },
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'What Does a Successful Deployment Look Like?',
    slug: 'what-does-a-successful-deployment-look-like',
    text: 'Sequential pipeline: EC2 Running -> Nginx Active -> Files Present -> Local HTTP Success -> Public HTTP Success -> Browser Displays Website.',
  },
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'If a Check Fails, Start Here',
    slug: 'if-a-check-fails',
    text: 'Troubleshooting table: EC2 not running, status checks not passed, Nginx inactive, local HTTP fails, local HTTP works but public HTTP fails, default Nginx page appears, images or styles missing, public IP changed.',
  },
  {
    pageId: 'verification-checklist',
    pageTitle: '03 • Verification Checklist: Prove the website is really deployed',
    heading: 'Ready for the Next Challenge?',
    slug: 'ready-for-the-next-challenge',
    text: 'Milestone completion: Cloud compute, VPC networking, firewall security, SSH authentication, Nginx web server, and production static site verification.',
  },

  // CHAPTER 4 - PAGE 1: COMMON ERRORS
  {
    pageId: 'troubleshoot-common-errors',
    pageTitle: '04 • Page 1: Common errors, likely causes and fixes',
    heading: 'Common Errors, Likely Causes and Fixes',
    slug: 'common-errors-table',
    text: 'Troubleshooting table: SSH connection times out, Permission denied (publickey), Website times out, Connection refused on port 80, Nginx welcome page appears, 403 Forbidden, 404 Not Found, CSS or images missing, git clone fails, 502 Bad Gateway.',
  },
  {
    pageId: 'troubleshoot-common-errors',
    pageTitle: '04 • Page 1: Common errors, likely causes and fixes',
    heading: 'AWS Troubleshooting Note',
    slug: 'aws-troubleshooting-note',
    text: 'AWS official troubleshooting guide: Investigate specific error instead of opening network ports broadly to 0.0.0.0/0.',
  },
  {
    pageId: 'troubleshoot-common-errors',
    pageTitle: '04 • Page 1: Common errors, likely causes and fixes',
    heading: 'EC2 Connection Troubleshooting',
    slug: 'ec2-connection-troubleshooting',
    text: 'Official AWS documentation for SSH connection failures, instance reachability alarms, and security group rules reference.',
  },

  // CHAPTER 4 - PAGE 2: DEBUGGING TOOLKIT
  {
    pageId: 'troubleshoot-debugging-toolkit',
    pageTitle: '04 • Page 2: Your first debugging toolkit',
    heading: 'Diagnostic Commands',
    slug: 'diagnostic-commands',
    text: 'Run on EC2: systemctl status nginx, systemctl start nginx, curl -I http://localhost, ls -la /usr/share/nginx/html, nginx -t, tail error.log. Run on laptop: curl -I http://YOUR_PUBLIC_IP.',
  },
  {
    pageId: 'troubleshoot-debugging-toolkit',
    pageTitle: '04 • Page 2: Your first debugging toolkit',
    heading: 'Debug in Layers — Change One Thing at a Time',
    slug: 'debug-in-layers',
    text: 'Diagnostic flowchart: If curl -I http://localhost works, focus on networking and security groups. If localhost fails, focus on Nginx, logs, syntax, and files.',
  },
  {
    pageId: 'troubleshoot-debugging-toolkit',
    pageTitle: '04 • Page 2: Your first debugging toolkit',
    heading: 'Instructor Mini-Activity: Find the Fault',
    slug: 'instructor-mini-activity',
    text: 'Controlled fault injection activity: 01 Observe, 02 Collect evidence, 03 Identify the layer, 04 Make one controlled fix, 05 Verify again.',
  },
  {
    pageId: 'troubleshoot-debugging-toolkit',
    pageTitle: '04 • Page 2: Your first debugging toolkit',
    heading: 'Debugging Rule',
    slug: 'debugging-rule',
    text: 'If curl to localhost works but the public URL fails, focus on networking. If localhost fails too, focus on Nginx and server configuration.',
  },
  {
    pageId: 'troubleshoot-debugging-toolkit',
    pageTitle: '04 • Page 2: Your first debugging toolkit',
    heading: 'Before Declaring the Issue Fixed',
    slug: 'before-declaring-fixed',
    text: 'Verification checklist: error understood, diagnostic command succeeds, browser renders site, assets load, security groups restricted, configuration restored.',
  },

  // CHAPTER 5 - PAGE 1: PROJECT 2 MULTI-PAGE
  {
    pageId: 'challenge-project-two',
    pageTitle: '05 • Page 1: Project 2: deploy a multi-page website',
    heading: 'Repository Link',
    slug: 'repository-link',
    text: 'Independent challenge repository: Maryam-Skaik/static-website-demo. Deploy multi-page static site to EC2.',
  },
  {
    pageId: 'challenge-project-two',
    pageTitle: '05 • Page 1: Project 2: deploy a multi-page website',
    heading: 'Expected Source Structure',
    slug: 'expected-source-structure',
    text: 'Repository structure: index.html, about.html, 404.html, css/style.css, js/theme.js, README.md, LICENSE. Custom 404 serving behavior.',
  },
  {
    pageId: 'challenge-project-two',
    pageTitle: '05 • Page 1: Project 2: deploy a multi-page website',
    heading: 'Expected Outcome',
    slug: 'expected-outcome',
    text: 'Four outcomes: Running EC2 (infrastructure), Public live URL (accessible), Multi-page content (functional), Custom 404 behaviour (stretch).',
  },
  {
    pageId: 'challenge-project-two',
    pageTitle: '05 • Page 1: Project 2: deploy a multi-page website',
    heading: 'Challenge Rule',
    slug: 'challenge-rule',
    text: 'Diagnose issues independently before asking for help. Explain attempts, test commands, observed results, and hypotheses.',
  },

  // CHAPTER 5 - PAGE 2: INDEPENDENT CHECKLIST
  {
    pageId: 'challenge-checklist',
    pageTitle: '05 • Page 2: Independent checklist — hints, not the complete solution',
    heading: 'Independent Deployment Checklist',
    slug: 'independent-checklist',
    text: '10-task checklist: inspect repo, confirm AWS settings, connect SSH, install web server, deploy files, check assets, test public URL, test multi-page, capture evidence, clean up resources.',
  },
  {
    pageId: 'challenge-checklist',
    pageTitle: '05 • Page 2: Independent checklist — hints, not the complete solution',
    heading: 'Submission Requirements',
    slug: 'submission-requirements',
    text: 'Submission deliverables: Live public URL, screenshot evidence with credentials obscured, reflection questions on debugging and cleanup.',
  },
  {
    pageId: 'challenge-checklist',
    pageTitle: '05 • Page 2: Independent checklist — hints, not the complete solution',
    heading: 'Mentor Scoring Idea',
    slug: 'mentor-scoring-idea',
    text: '4-point mentor rubric: 1 Point Deploy, 1 Point Navigate, 1 Point Assets, 1 Point Understand.',
  },
  {
    pageId: 'challenge-checklist',
    pageTitle: '05 • Page 2: Independent checklist — hints, not the complete solution',
    heading: 'Stretch Goal',
    slug: 'stretch-goal',
    text: 'Custom 404 error page configuration in Nginx: modify error_page directive, validate with nginx -t, and test missing routes.',
  },

  // CHAPTER 6 - SECURITY AND PERMISSIONS
  {
    pageId: 'security-and-permissions',
    pageTitle: '06 • Security and Permissions: Build safe cloud habits from the beginning',
    heading: 'Six Essential Security Habits',
    slug: 'six-essential-security-habits',
    text: 'Six security principles: Use authorised accounts, Least privilege, Protect credentials, Use MFA, Limit network exposure, Protect project data.',
  },
  {
    pageId: 'security-and-permissions',
    pageTitle: '06 • Security and Permissions: Build safe cloud habits from the beginning',
    heading: 'Permissions Are Not the Same as Network Rules',
    slug: 'permissions-are-not-the-same',
    text: 'Distinguish IAM identity/policy (AWS resource API control), Security group (network interface traffic filtering), and Linux file permissions (local filesystem read/write/execute).',
  },
  {
    pageId: 'security-and-permissions',
    pageTitle: '06 • Security and Permissions: Build safe cloud habits from the beginning',
    heading: 'Shared Responsibility',
    slug: 'shared-responsibility',
    text: 'AWS Shared Responsibility Model: AWS secures the underlying cloud infrastructure; you secure accounts, permissions, deployed data, and exposed services.',
  },
  {
    pageId: 'security-and-permissions',
    pageTitle: '06 • Security and Permissions: Build safe cloud habits from the beginning',
    heading: 'AWS Security Guidance',
    slug: 'aws-security-guidance',
    text: 'Authoritative links: AWS IAM security best practices, and EC2 security group rules reference.',
  },
  {
    pageId: 'security-and-permissions',
    pageTitle: '06 • Security and Permissions: Build safe cloud habits from the beginning',
    heading: 'Before You Finish the Lab',
    slug: 'before-you-finish-the-lab',
    text: 'Lab safety check: correct workshop account used, no secrets committed or uploaded to web root, SSH restricted to My IP, temporary resources reviewed for cleanup.',
  },

  // CHAPTER 7 - COST AWARENESS AND RESOURCE CLEANUP
  {
    pageId: 'cost-and-cleanup',
    pageTitle: '07 • Cost Awareness and Resource Cleanup: Finish the lab without surprise charges',
    heading: 'Before Deployment',
    slug: 'before-deployment',
    text: 'Cost checklist before launching: instance type compute cost, EBS storage and public IPv4 charges, Free Tier eligibility, budget alert setup, shared training account naming rules.',
  },
  {
    pageId: 'cost-and-cleanup',
    pageTitle: '07 • Cost Awareness and Resource Cleanup: Finish the lab without surprise charges',
    heading: 'Cleanup After the Workshop',
    slug: 'cleanup-after-the-workshop',
    text: 'Workshop cleanup steps: preserve URL/screenshot evidence, terminate EC2 instance, review retained EBS volumes, snapshots, Elastic IPs, confirm before deletion, inspect Billing console.',
  },
  {
    pageId: 'cost-and-cleanup',
    pageTitle: '07 • Cost Awareness and Resource Cleanup: Finish the lab without surprise charges',
    heading: 'Stopping Is Not the Same as Cleanup',
    slug: 'stopping-is-not-the-same',
    text: 'STOPPING != CLEANUP: Stopping an instance stops compute charges but retains EBS root volume and Elastic IP charges. Terminating permanently deletes the virtual machine.',
  },
  {
    pageId: 'cost-and-cleanup',
    pageTitle: '07 • Cost Awareness and Resource Cleanup: Finish the lab without surprise charges',
    heading: 'Official AWS Resources',
    slug: 'official-aws-resources',
    text: 'Official AWS Cost Management links: Create an AWS budget to track spending, and Terminate an EC2 instance official cleanup documentation.',
  },
  {
    pageId: 'cost-and-cleanup',
    pageTitle: '07 • Cost Awareness and Resource Cleanup: Finish the lab without surprise charges',
    heading: 'Before You Leave AWS',
    slug: 'before-you-leave-aws',
    text: 'Final departure checklist: required evidence saved, EC2 instance reviewed, cleanup approved and completed, associated resources reviewed, billing checked.',
  },

  // CHAPTER 8 - FURTHER LEARNING RESOURCES
  {
    pageId: 'further-learning',
    pageTitle: '08 • Further Learning Resources: Official AWS documentation to keep learning',
    heading: 'Official AWS Documentation Library',
    slug: 'official-aws-documentation-library',
    text: '13 official documentation guides: EC2 Get Started, SSH connect, Security group rules, Amazon Linux 2023 DNF, VPC, IAM best practices, AWS Budgets, S3 static hosting, RDS, Lambda, CloudWatch, Route 53, CloudFront HTTPS.',
  },
  {
    pageId: 'further-learning',
    pageTitle: '08 • Further Learning Resources: Official AWS documentation to keep learning',
    heading: 'What Should I Learn Next?',
    slug: 'what-should-i-learn-next',
    text: 'Suggested three-stage learning progression: Stage 1 Strengthen the basics, Stage 2 Operate safely, Stage 3 Build beyond static hosting.',
  },
  {
    pageId: 'further-learning',
    pageTitle: '08 • Further Learning Resources: Official AWS documentation to keep learning',
    heading: 'Next Learning Path',
    slug: 'next-learning-path',
    text: 'Next learning steps: HTTPS and custom domains, automated Git deployments, application logs and monitoring, backend hosting and databases.',
  },

  // CHAPTER 9 - INSTRUCTOR AND ORGANISER CHECKLIST
  {
    pageId: 'instructor-checklist',
    pageTitle: '09 • Instructor and Organiser Checklist: Make the workshop reproducible',
    heading: 'Screenshot Targets for the Live Workshop',
    slug: 'screenshot-targets-for-the-live-workshop',
    text: '5 evidence targets: Screen 01 Launch Page, Screen 02 Network Rules, Screen 03 Instance Status, Screen 04 Terminal, Screen 05 Browser.',
  },
  {
    pageId: 'instructor-checklist',
    pageTitle: '09 • Instructor and Organiser Checklist: Make the workshop reproducible',
    heading: 'Capture These Live Screenshots During the Workshop',
    slug: 'capture-these-live-screenshots',
    text: 'Live screenshot collection: EC2 launch instance page, security group inbound rules, instance status running 2/2 checks, terminal SSH/Nginx/HTTP 200, browser rendering public IP.',
  },
  {
    pageId: 'instructor-checklist',
    pageTitle: '09 • Instructor and Organiser Checklist: Make the workshop reproducible',
    heading: 'Pre-Event Review Checklist',
    slug: 'pre-event-review-checklist',
    text: '7 pre-event checks: learner sign-in, workshop role permissions, repository access, practice deployment rehearsal, second challenge repo, organizer responsibilities, costs and cleanup.',
  },
  {
    pageId: 'instructor-checklist',
    pageTitle: '09 • Instructor and Organiser Checklist: Make the workshop reproducible',
    heading: 'End-of-Class Assessment',
    slug: 'end-of-class-assessment',
    text: '6 conceptual questions: EC2 vs GitHub, Why Nginx, IAM vs Security Groups, curl localhost test, Restricting SSH, and Resource cleanup with mentor answer guidance.',
  },
  {
    pageId: 'instructor-checklist',
    pageTitle: '09 • Instructor and Organiser Checklist: Make the workshop reproducible',
    heading: 'Ready for Review',
    slug: 'ready-for-review',
    text: 'Pre-distribution verification: Rehearse full deployment, confirm repo links, replace illustrative screenshots with live captures, remove secrets, confirm cleanup.',
  },
];

export function DocumentSearch({ isOpen, onClose, onSelectResult = () => {} }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsListRef = useRef(null);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return SEARCHABLE_TOPICS.filter((item) => {
      return (
        item.heading.toLowerCase().includes(q) ||
        item.text.toLowerCase().includes(q) ||
        item.pageTitle.toLowerCase().includes(q)
      );
    });
  }, [query]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else onClose(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (results.length > 0 ? (prev - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  const handleSelect = (item) => {
    onSelectResult(item);
    setTimeout(() => {
      if (item.slug) {
        const el = document.getElementById(item.slug);
        if (el) {
          const topOffset = 80;
          const pos = el.getBoundingClientRect().top + window.pageYOffset - topOffset;
          window.scrollTo({ top: pos, behavior: 'smooth' });
          window.history.pushState(null, '', `#${item.slug}`);
        }
      }
    }, 100);
    onClose();
  };

  const highlightMatch = (text, q) => {
    if (!q) return text;
    const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return parts.map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark key={i} className="bg-amber-200 dark:bg-amber-900/60 text-slate-900 dark:text-zinc-100 rounded-xs px-0.5 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Search documentation"
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-zinc-950 border-2 border-black dark:border-white shadow-[6px_6px_0px_#000000] dark:shadow-[6px_6px_0px_#ffffff] overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b-2 border-black dark:border-zinc-800 gap-3 bg-[#fbfbf9] dark:bg-zinc-900">
          <Search className="w-5 h-5 text-black dark:text-white stroke-[2.5] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search chapters, steps, EC2, Nginx, port 80, SSH..."
            className="flex-1 bg-transparent text-sm font-medium text-black dark:text-zinc-100 placeholder-slate-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-black dark:text-zinc-200 hover:bg-slate-200 dark:hover:bg-zinc-800 p-1 border border-black dark:border-zinc-700"
              aria-label="Clear search input"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] uppercase font-mono font-bold px-1.5 py-0.5 border border-black dark:border-zinc-700 bg-white dark:bg-zinc-800 text-black dark:text-white shadow-[1px_1px_0px_#000000]">
            esc
          </span>
        </div>

        {/* Results List */}
        <div ref={resultsListRef} className="flex-1 overflow-y-auto p-3 custom-scrollbar space-y-1.5">
          {!query.trim() ? (
            <div className="py-12 text-center text-slate-500 dark:text-zinc-400 text-xs font-mono">
              Type keywords to search across all lessons in Chapters 1 &amp; 2...
            </div>
          ) : results.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-bold text-black dark:text-white">
                No matching results found
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                No workbook section matches &ldquo;{query}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="px-2 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-black dark:text-white flex items-center justify-between">
                <span>{results.length} {results.length === 1 ? 'match' : 'matches'} found</span>
                <span className="text-[10px] bg-[#a6ff70] text-black px-1.5 py-0.2 border border-black">RESULTS</span>
              </div>
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={`${item.pageId}-${item.slug}-${idx}`}
                    type="button"
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-3 transition-all flex items-start gap-3 border-2 ${
                      isSelected
                        ? 'bg-[#a6ff70] text-black border-black shadow-[2.5px_2.5px_0px_#000000]'
                        : 'bg-white dark:bg-zinc-900 text-slate-800 dark:text-zinc-300 border-black/20 hover:border-black hover:bg-[#f4f3ee] dark:hover:bg-zinc-800'
                    }`}
                  >
                    <div className="p-1 border border-black bg-white dark:bg-zinc-800 text-black dark:text-white shrink-0 mt-0.5">
                      <Hash className="w-3.5 h-3.5 stroke-[2.5]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono font-bold uppercase tracking-wider mb-0.5 text-black dark:text-white/80">
                        {item.pageTitle}
                      </div>
                      <div className="flex items-center justify-between text-xs font-black text-black dark:text-white">
                        <span className="truncate">{highlightMatch(item.heading, query.trim())}</span>
                        {isSelected && (
                          <CornerDownLeft className="w-3.5 h-3.5 text-black shrink-0 ml-2 stroke-[2.5]" />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                        {highlightMatch(item.text, query.trim())}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2 border-t-2 border-black dark:border-zinc-800 bg-[#f4f3ee] dark:bg-zinc-900 text-[11px] font-mono text-black dark:text-zinc-400 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="font-mono font-bold bg-white dark:bg-zinc-800 border border-black px-1 text-[10px]">↑</kbd>{' '}
              <kbd className="font-mono font-bold bg-white dark:bg-zinc-800 border border-black px-1 text-[10px]">↓</kbd> navigate
            </span>
            <span>
              <kbd className="font-mono font-bold bg-white dark:bg-zinc-800 border border-black px-1 text-[10px]">↵</kbd> select
            </span>
          </div>
          <span className="font-bold">AWS Cloud Launchpad</span>
        </div>
      </div>
    </div>
  );
}
