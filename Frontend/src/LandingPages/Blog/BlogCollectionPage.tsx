import { Link } from 'react-router-dom';
import NavBar from '../NavBar/Landing';
import { Terminal, ArrowRight, Layers, ShieldCheck, Flame } from 'lucide-react';
import { OrbixLogo } from '../../components/OrbixLogo';

const CHAPTERS = [
    {
        num: '01',
        title: 'Architecture & EC2 Fundamentals',
        desc: 'Understand how traffic flows from the browser to Amazon EC2 and Nginx.',
        path: '/blog/aws-sbg-psit/aws-launchpad-2026/intro-ec2-architecture',
        badge: 'Core Concept',
    },
    {
        num: '02',
        title: 'Step-by-Step Deployment',
        desc: 'Launch an EC2 instance, connect via SSH, install Nginx, and deploy web assets.',
        path: '/blog/aws-sbg-psit/aws-launchpad-2026/deploy-inspect-and-launch',
        badge: 'Hands-on Lab',
    },
    {
        num: '03',
        title: 'Verification Checklist',
        desc: 'Interactive 8-step verification to ensure your live URL and ports work properly.',
        path: '/blog/aws-sbg-psit/aws-launchpad-2026/verification-checklist',
        badge: 'Validation',
    },
    {
        num: '04',
        title: 'Troubleshooting Toolkit',
        desc: 'Diagnose connection timeouts, permission errors, and 404/502 Nginx statuses.',
        path: '/blog/aws-sbg-psit/aws-launchpad-2026/troubleshoot-common-errors',
        badge: 'Debugging',
    },
    {
        num: '05',
        title: 'Independent Challenge',
        desc: 'Deploy a second custom project from scratch without step-by-step hand-holding.',
        path: '/blog/aws-sbg-psit/aws-launchpad-2026/challenge-project-two',
        badge: 'Capstone',
    },
];

export default function BlogCollectionPage() {
    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black font-sans selection:bg-black selection:text-[#a2ff86] relative overflow-x-hidden">
            {/* Global Navbar */}
            <NavBar activeTab="blogs" />

            {/* Main Container */}
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32">
                {/* Header Badge & Title */}
                <div className="text-center max-w-3xl mx-auto space-y-4 mb-12">
                    <div className="inline-flex items-center justify-center gap-2.5 text-black font-black text-lg sm:text-xl tracking-tight select-none">
                        <OrbixLogo className="w-6 h-6 sm:w-7 sm:h-7 text-black flex-shrink-0" />
                        <span>Orbix Publications & Workshop Guides</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-black tracking-tight text-black leading-[1.08]">
                        Featured Cloud Publication
                    </h1>

                    <p className="text-base sm:text-lg text-neutral-700 font-bold max-w-2xl mx-auto leading-relaxed pt-1">
                        Explore our hands-on engineering workbook for deploying production web applications to Amazon Web Services.
                    </p>
                </div>

                {/* ========================================================================= */}
                {/* MAIN NEO-BRUTALIST BLOG CARD: AWS Launchpad 2026 */}
                {/* ========================================================================= */}
                <article className="rounded-3xl bg-white border-2 sm:border-[3px] border-black p-5 sm:p-8 lg:p-10 shadow-[6px_6px_0px_#000] sm:shadow-[8px_8px_0px_#000] mb-12">
                    {/* Cloudinary Banner Image */}
                    <div className="rounded-2xl border-2 border-black overflow-hidden shadow-[4px_4px_0px_#000] bg-black mb-8 relative group">
                        <img
                            src="https://res.cloudinary.com/dj0ivep44/image/upload/v1792919453/AWS_EC2_Deployment_Banner_samf2y.png"
                            alt="AWS EC2 Deployment Guide Banner"
                            className="w-full h-auto object-cover max-h-[460px] block transition-transform duration-500 group-hover:scale-[1.01]"
                        />
                        <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-2">
                            <span className="px-3 py-1 rounded-full bg-black text-[#a2ff86] border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                                AWS LAUNCHPAD 2026
                            </span>
                            <span className="px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                                AWS SBG PSIT
                            </span>
                        </div>
                    </div>

                    {/* Meta Badges */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 select-none">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#a2ff86] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <Flame className="w-3.5 h-3.5 stroke-[2.5]" />
                            Beginner-friendly
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            ~120 minutes run plan
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <Layers className="w-3.5 h-3.5 stroke-[2.5]" />
                            Static Website & Nginx
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black font-black text-xs shadow-[2px_2px_0px_#000]">
                            <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
                            AWS Free Tier
                        </span>
                    </div>

                    {/* Title & Description */}
                    <h2 className="text-3xl sm:text-5xl font-black text-black tracking-tight leading-tight mb-4">
                        Deploy your first website to AWS
                    </h2>

                    <p className="text-base sm:text-lg text-neutral-800 font-medium leading-relaxed mb-8 max-w-4xl">
                        A visual, step-by-step workbook for the 2-hour AWS Cloud Launchpad workshop. Learn how to launch an Amazon Linux 2023 EC2 instance, configure Security Groups, connect via SSH, install and configure Nginx, transfer web assets, verify live HTTP connectivity, and troubleshoot common issues.
                    </p>

                    {/* Primary Action Button */}
                    <div className="flex flex-wrap items-center gap-4 mb-10 pb-8 border-b-2 border-black/15">
                        <Link
                            to="/blog/aws-sbg-psit/aws-launchpad-2026"
                            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black font-black text-base shadow-[4px_4px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all cursor-pointer"
                        >
                            <span>Open Live Workshop Guide</span>
                            <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                        </Link>
                        <Link
                            to="/blog/aws-sbg-psit/aws-launchpad-2026/verification-checklist"
                            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black font-black text-sm shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 transition-all cursor-pointer"
                        >
                            <span>View Verification Checklist</span>
                        </Link>
                    </div>

                    {/* Chapter Directory Grid (Neo-Brutalist Cards) */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                                <Terminal className="w-4 h-4 stroke-[2.5]" />
                                <span>Workbook Chapters & Modules (5)</span>
                            </h3>
                            <span className="text-xs font-mono font-bold text-neutral-600">
                                Click to jump to chapter
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {CHAPTERS.map((ch) => (
                                <Link
                                    key={ch.num}
                                    to={ch.path}
                                    className="group flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-[#FAF6EE] hover:bg-[#FFE566] border-2 border-black shadow-[3px_3px_0px_#000] hover:translate-x-0.5 hover:translate-y-0.5 transition-all text-left"
                                >
                                    <div>
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="px-2 py-0.5 rounded-md bg-black text-[#a2ff86] border border-black font-mono font-black text-[11px]">
                                                CH {ch.num}
                                            </span>
                                            <span className="px-2 py-0.5 rounded-full bg-white text-black border border-black font-mono font-bold text-[10px]">
                                                {ch.badge}
                                            </span>
                                        </div>
                                        <h4 className="text-base font-black text-black group-hover:text-black leading-snug mb-1.5">
                                            {ch.title}
                                        </h4>
                                        <p className="text-xs text-neutral-700 font-medium leading-relaxed line-clamp-2">
                                            {ch.desc}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-2.5 border-t border-black/15 flex items-center justify-between text-xs font-black text-black">
                                        <span>Start chapter</span>
                                        <span className="transition-transform group-hover:translate-x-1">→</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                </article>
            </main>
        </div>
    );
}
