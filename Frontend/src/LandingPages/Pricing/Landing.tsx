import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import NavBar from '../NavBar/Landing';

export default function PricingPage() {
    const navigate = useNavigate();
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');

    const handleSelectPlan = (_plan?: string) => {
        const user = localStorage.getItem("orbix_user");
        if (user) {
            navigate("/dashboard");
        } else {
            navigate("/auth/signup");
        }
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-amber-50/70 via-slate-50/40 to-transparent blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-40 right-10 w-[500px] h-[400px] bg-indigo-50/50 rounded-full blur-[140px] pointer-events-none -z-10" />

            {/* Global Floating Pill Navigation */}
            <NavBar activeTab="pricing" />

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 tracking-wide uppercase shadow-sm">
                        <span>Transparent & Predictable Pricing</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
                        Plans designed to scale with your team's velocity
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed pt-2">
                        Get started free with individual projects. Upgrade seamlessly when your engineering org demands automated PR policy enforcement, MCP server telemetry, and enterprise SLAs.
                    </p>

                    {/* Monthly / Yearly Toggle */}
                    <div className="flex items-center justify-center gap-3 pt-6">
                        <div className="p-1 rounded-full bg-slate-100 border border-slate-200/90 flex items-center shadow-inner">
                            <button
                                type="button"
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${billingCycle === 'monthly'
                                    ? 'bg-white text-slate-950 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                Monthly billing
                            </button>
                            <button
                                type="button"
                                onClick={() => setBillingCycle('yearly')}
                                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all ${billingCycle === 'yearly'
                                    ? 'bg-white text-slate-950 shadow-sm'
                                    : 'text-slate-600 hover:text-slate-900'
                                    }`}
                            >
                                <span>Yearly billing</span>
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Save 20%
                                </span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-14 sm:mt-18 items-stretch">
                    {/* Hobby / Starter Card */}
                    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 sm:p-8 shadow-sm hover:shadow-lg transition-all">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900">Developer Starter</h3>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                                    Free
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                Ideal for indie hackers, open-source maintainers, and individual projects.
                            </p>
                            <div className="pt-2">
                                <span className="text-4xl font-extrabold text-slate-950">$0</span>
                                <span className="text-xs text-slate-500 ml-1">/ forever</span>
                            </div>

                            <ul className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700">
                                {[
                                    '100 automated AI reviews / mo',
                                    'GitHub & GitLab PR webhooks',
                                    'Catch syntax, spec & type regressions',
                                    'Community support & Discord access',
                                    '1 active repository integration',
                                ].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-2.5">
                                        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-8">
                            <button
                                onClick={() => handleSelectPlan('starter')}
                                className="w-full h-11 rounded-full border border-slate-300 font-semibold text-slate-800 text-xs sm:text-sm hover:bg-slate-50 transition-all active:scale-98 shadow-sm"
                            >
                                Get Started Free
                            </button>
                        </div>
                    </div>

                    {/* Pro Card (Highlighted) */}
                    <div className="flex flex-col justify-between rounded-3xl border-2 border-slate-900 bg-slate-950 text-white p-7 sm:p-8 shadow-2xl relative transition-all md:-translate-y-2">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-bold text-[11px] tracking-wide uppercase shadow-md">
                            Most Popular
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-white">Team Pro</h3>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white border border-white/20">
                                    Recommended
                                </span>
                            </div>
                            <p className="text-xs text-slate-300 leading-relaxed">
                                For high-velocity engineering teams requiring autonomous review workflows and policy enforcement.
                            </p>
                            <div className="pt-2">
                                <span className="text-4xl font-extrabold text-white">
                                    {billingCycle === 'yearly' ? '$24' : '$29'}
                                </span>
                                <span className="text-xs text-slate-400 ml-1">/ engineer / month</span>
                            </div>

                            <ul className="space-y-3 pt-4 border-t border-white/10 text-xs text-slate-200">
                                {[
                                    'Unlimited AI Code Reviews',
                                    'Full MCP Server & telemetry chat',
                                    'Policy-based PR routing & auto-merge',
                                    'Developer experience & cycle-time metrics',
                                    'Unlimited repositories & team members',
                                    'Priority email & Slack SLA support',
                                ].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-2.5">
                                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-8">
                            <button
                                onClick={() => handleSelectPlan('pro')}
                                className="w-full h-11 rounded-full bg-white text-slate-950 font-bold text-xs sm:text-sm hover:bg-slate-100 transition-all active:scale-98 shadow-md"
                            >
                                Start 14-Day Free Pro Trial
                            </button>
                        </div>
                    </div>

                    {/* Enterprise Card */}
                    <div className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-7 sm:p-8 shadow-sm hover:shadow-lg transition-all">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900">Enterprise</h3>
                                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    Custom
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 leading-relaxed">
                                For organizations requiring custom security models, compliance standards, and dedicated infrastructure.
                            </p>
                            <div className="pt-2">
                                <span className="text-4xl font-extrabold text-slate-950">Custom</span>
                                <span className="text-xs text-slate-500 ml-1">/ bespoke contract</span>
                            </div>

                            <ul className="space-y-3 pt-4 border-t border-slate-100 text-xs text-slate-700">
                                {[
                                    'Everything in Team Pro',
                                    'Self-hosted VPC or dedicated cloud tenant',
                                    'Custom LLM fine-tuning on internal specs',
                                    'SOC2 Type II, HIPAA & GDPR compliance',
                                    'SSO (Okta, Azure AD, SAML 2.0)',
                                    'Dedicated CSM & 99.99% uptime SLA',
                                ].map((feat, i) => (
                                    <li key={i} className="flex items-center gap-2.5">
                                        <svg className="w-4 h-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        <span>{feat}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="pt-8">
                            <Link
                                to="/support"
                                className="w-full h-11 flex items-center justify-center rounded-full border border-slate-300 font-semibold text-slate-800 text-xs sm:text-sm hover:bg-slate-50 transition-all active:scale-98 shadow-sm"
                            >
                                Talk to Enterprise Sales
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Frequently Asked Questions */}
                <div className="mt-24 sm:mt-32 max-w-3xl mx-auto space-y-8">
                    <div className="text-center">
                        <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight">
                            Frequently Asked Questions
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1">
                            Everything you need to know about Orbix billing and subscriptions.
                        </p>
                    </div>

                    <div className="divide-y divide-slate-200 text-left">
                        {[
                            {
                                q: 'Can I start using Orbix for free?',
                                a: 'Yes! The Developer Starter plan is 100% free forever with no credit card required. You get 100 automated AI reviews every month for your repositories.',
                            },
                            {
                                q: 'How does team billing work?',
                                a: 'You only pay for engineers who submit pull requests reviewed by Orbix. Viewers, project managers, and auditors have unlimited free access.',
                            },
                            {
                                q: 'Is my source code stored or used to train public models?',
                                a: 'Never. Orbix processes your code strictly in isolated runtime memory. Your proprietary source code is never used to train public or shared models.',
                            },
                            {
                                q: 'Can I cancel or switch plans at any time?',
                                a: 'Yes, you can upgrade, downgrade, or cancel your subscription at any time directly from the dashboard settings without penalties.',
                            },
                        ].map((faq, i) => (
                            <div key={i} className="py-5">
                                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                                    {faq.q}
                                </h3>
                                <p className="mt-1.5 text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    {faq.a}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
