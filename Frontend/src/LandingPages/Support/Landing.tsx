import { useState, useEffect } from 'react';
import NavBar from '../NavBar/Landing';
import { useToast } from '../../context/ToastContext';
import { useAppSelector } from '../../store';
import { NeoSelect } from '../../components/NeoSelect';

export default function SupportPage() {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const dynamicName = user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || '' : '';
    const dynamicEmail = user?.gmail || (user as any)?.email || '';

    const [submitting, setSubmitting] = useState(false);
    const [ticket, setTicket] = useState({
        name: dynamicName,
        email: dynamicEmail,
        category: 'technical',
        priority: 'normal',
        message: '',
    });

    useEffect(() => {
        if (dynamicName || dynamicEmail) {
            setTicket((prev) => ({
                ...prev,
                name: prev.name || dynamicName,
                email: prev.email || dynamicEmail,
            }));
        }
    }, [dynamicName, dynamicEmail]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!ticket.email || !ticket.message) {
            toast.error("Please fill in your email and support details.", { title: "Incomplete Request" });
            return;
        }

        setSubmitting(true);
        setTimeout(() => {
            setSubmitting(false);
            toast.success("Support ticket created! Our team will reply within 30 minutes.", { title: "Ticket Submitted" });
            setTicket({
                name: dynamicName,
                email: dynamicEmail,
                category: 'technical',
                priority: 'normal',
                message: '',
            });
        }, 800);
    };

    return (
        <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-slate-900 selection:text-white relative overflow-hidden">
            {/* Ambient Background Glows */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[550px] bg-gradient-to-b from-sky-50/70 via-slate-50/40 to-transparent blur-3xl pointer-events-none -z-10" />
            <div className="absolute top-40 left-10 w-[450px] h-[350px] bg-indigo-50/50 rounded-full blur-[130px] pointer-events-none -z-10" />

            {/* Global Floating Pill Navigation */}
            <NavBar />

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-32 pb-24 sm:pt-36 sm:pb-32">
                {/* Header */}
                <div className="text-center max-w-3xl mx-auto space-y-4">
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-800 tracking-wide uppercase shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Systems Operational • 24/7 Global Support</span>
                    </div>

                    <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.12]">
                        How can we assist your engineering team?
                    </h1>

                    <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed pt-2">
                        Get direct guidance from our core platform engineers. Search documentation, check real-time system status, or submit an inquiry below.
                    </p>
                </div>

                {/* Support Channels Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 mt-14 sm:mt-18">
                    {[
                        {
                            title: 'Documentation & Guides',
                            desc: 'Explore API references, webhook schemas, MCP server configs, and deployment guides.',
                            action: 'Browse Docs →',
                            icon: (
                                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            ),
                        },
                        {
                            title: 'Community Discord & Slack',
                            desc: 'Connect with over 12,000+ engineers, discuss custom prompts, and share review workflows.',
                            action: 'Join Community →',
                            icon: (
                                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                                </svg>
                            ),
                        },
                        {
                            title: 'Dedicated Enterprise SLA',
                            desc: '24/7 emergency pager access, dedicated Slack channels, and a 15-minute response guarantee.',
                            action: 'View SLA Coverage →',
                            icon: (
                                <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                            ),
                        },
                    ].map((card, i) => (
                        <div
                            key={i}
                            className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
                        >
                            <div className="space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                                    {card.icon}
                                </div>
                                <h3 className="text-lg font-bold text-slate-900 tracking-tight">
                                    {card.title}
                                </h3>
                                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                                    {card.desc}
                                </p>
                            </div>
                            <div className="pt-6 mt-6 border-t border-slate-100">
                                <span className="text-xs font-bold text-slate-900 hover:text-indigo-600 cursor-pointer transition-colors">
                                    {card.action}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Direct Ticket Form */}
                <div className="mt-16 sm:mt-24 max-w-3xl mx-auto rounded-3xl border border-slate-200 bg-white p-8 sm:p-10 shadow-xl">
                    <div className="text-left space-y-1 mb-8">
                        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
                            Open an engineering support ticket
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-500">
                            Our team responds directly via email within 30 minutes during standard operating windows.
                        </p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 text-left">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Your Name
                                </label>
                                <input
                                    type="text"
                                    placeholder={dynamicName || "Your full name"}
                                    value={ticket.name}
                                    onChange={(e) => setTicket({ ...ticket, name: e.target.value })}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Work Email <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    required
                                    placeholder={dynamicEmail || "alex@company.com"}
                                    value={ticket.email}
                                    onChange={(e) => setTicket({ ...ticket, email: e.target.value })}
                                    className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Inquiry Category
                                </label>
                                <NeoSelect
                                    value={ticket.category}
                                    onChange={(val) => setTicket({ ...ticket, category: val })}
                                    options={[
                                        { value: "technical", label: "Technical / PR Webhook Issue" },
                                        { value: "billing", label: "Billing & Subscription" },
                                        { value: "mcp", label: "MCP Server Integration" },
                                        { value: "security", label: "Security & Compliance" },
                                        { value: "other", label: "General Inquiry" },
                                    ]}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Priority Level
                                </label>
                                <NeoSelect
                                    value={ticket.priority}
                                    onChange={(val) => setTicket({ ...ticket, priority: val })}
                                    options={[
                                        { value: "normal", label: "Normal • General question" },
                                        { value: "high", label: "High • Blocking pull requests" },
                                        { value: "urgent", label: "Urgent • Outage or build failure" },
                                    ]}
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                Issue Description <span className="text-rose-500">*</span>
                            </label>
                            <textarea
                                required
                                rows={4}
                                placeholder="Describe the error code, repository context, or question you have..."
                                value={ticket.message}
                                onChange={(e) => setTicket({ ...ticket, message: e.target.value })}
                                className="w-full p-4 rounded-xl border border-slate-200 bg-slate-50/50 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-slate-900 focus:bg-white transition-all resize-y"
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="h-11 px-7 rounded-full bg-slate-950 text-white font-semibold text-xs sm:text-sm hover:bg-slate-800 transition-all shadow-md active:scale-95 disabled:opacity-50"
                            >
                                {submitting ? 'Submitting ticket...' : 'Submit Support Ticket'}
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
}
