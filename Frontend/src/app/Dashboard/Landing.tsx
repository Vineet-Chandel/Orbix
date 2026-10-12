import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

interface UserProfile {
    username?: string;
    firstName?: string;
    lastName?: string;
    gmail?: string;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const [user, setUser] = useState<UserProfile | null>(null);

    useEffect(() => {
        try {
            const stored = localStorage.getItem("orbix_user");
            if (stored) {
                setUser(JSON.parse(stored));
            }
        } catch (e) {
            console.error("Failed to read user from storage", e);
        }

        // Auto verify and refresh session token in background
        const verifySession = async () => {
            const endpoints = ["/api/refresh", "http://localhost:3000/api/refresh"];
            for (const url of endpoints) {
                try {
                    const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data?.user) {
                            setUser(data.user);
                            try {
                                localStorage.setItem("orbix_user", JSON.stringify(data.user));
                            } catch {}
                        }
                        return;
                    }
                } catch {
                    continue;
                }
            }
        };

        verifySession();
    }, []);

    const handleSignOut = async () => {
        try {
            const endpoints = ["http://localhost:3000/api/signout", "/api/signout"];
            await Promise.allSettled(
                endpoints.map((url) =>
                    fetch(url, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                        },
                        credentials: "include",
                        body: JSON.stringify({ gmail: user?.gmail || "" }),
                    })
                )
            );
        } catch {
            // ignore network failure on signout
        }

        try {
            localStorage.removeItem("orbix_user");
        } catch {
            // ignore
        }

        navigate("/auth/signin");
    };

    const displayName = user?.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user?.username || "Developer";

    return (
        <div className="min-h-screen bg-[#07090e] text-white font-sans selection:bg-indigo-500/30 selection:text-white">
            {/* Ambient Background Glows */}
            <div className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[900px] h-[450px] bg-indigo-600/10 blur-[140px] -z-10" />
            <div className="pointer-events-none fixed bottom-0 right-1/4 w-[600px] h-[350px] bg-purple-600/10 blur-[130px] -z-10" />

            {/* Dashboard Navigation Bar */}
            <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090c14]/80 backdrop-blur-xl">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    {/* Logo & Workspace Breadcrumb */}
                    <div className="flex items-center gap-3">
                        <Link to="/" className="flex items-center gap-2.5 group">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 border border-white/10 group-hover:scale-105 transition-transform">
                                <svg className="h-5 w-5 text-white" viewBox="0 0 271 270" fill="currentColor">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" />
                                </svg>
                            </div>
                            <span className="font-bold text-white tracking-tight">Orbix</span>
                        </Link>
                        <span className="text-neutral-600">/</span>
                        <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                            Workspace
                        </span>
                    </div>

                    {/* Right User Actions */}
                    <div className="flex items-center gap-3 sm:gap-4">
                        <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 text-xs font-bold text-white shadow-sm">
                                {displayName.charAt(0).toUpperCase()}
                            </div>
                            <div className="hidden sm:block text-left text-xs">
                                <p className="font-medium text-white">{displayName}</p>
                                <p className="text-[11px] text-neutral-400">{user?.gmail || "Logged in"}</p>
                            </div>
                        </div>

                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all focus:outline-none"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign out</span>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Dashboard Content */}
            <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-8">
                {/* Greeting Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-[#101424] via-[#0d111c] to-[#121626] p-6 sm:p-8 shadow-xl">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-medium text-emerald-400 mb-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>System Operational • Active Session</span>
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                            Welcome back, {displayName}
                        </h1>
                        <p className="mt-1 text-xs sm:text-sm text-neutral-400">
                            Here is an overview of your automated code reviews, PR cycle times, and AI insights.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                        <button
                            onClick={() => alert("Creating new repository integration...")}
                            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-neutral-950 shadow-md hover:bg-neutral-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            <span>New Project</span>
                        </button>
                    </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                        {
                            label: "AI Code Reviews",
                            value: "148",
                            change: "+28% this month",
                            isPositive: true,
                            icon: (
                                <svg className="h-5 w-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            ),
                        },
                        {
                            label: "Cycle Time (Median)",
                            value: "2.4 hrs",
                            change: "-42% delivery speed",
                            isPositive: true,
                            icon: (
                                <svg className="h-5 w-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <polyline points="12 6 12 12 16 14" />
                                </svg>
                            ),
                        },
                        {
                            label: "Policy Automation",
                            value: "96.4%",
                            change: "Zero spec mismatches",
                            isPositive: true,
                            icon: (
                                <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                            ),
                        },
                        {
                            label: "MCP Intelligence",
                            value: "Active",
                            change: "Synced with GitHub",
                            isPositive: true,
                            icon: (
                                <svg className="h-5 w-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <rect width="20" height="8" x="2" y="3" rx="2" />
                                    <rect width="20" height="8" x="2" y="13" rx="2" />
                                </svg>
                            ),
                        },
                    ].map((metric, i) => (
                        <div
                            key={i}
                            className="rounded-xl border border-white/[0.08] bg-[#0c101b]/80 p-5 backdrop-blur-md hover:border-white/15 transition-all"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-neutral-400">{metric.label}</span>
                                <div className="rounded-lg bg-white/[0.04] p-2 border border-white/[0.06]">
                                    {metric.icon}
                                </div>
                            </div>
                            <div className="mt-4 flex items-baseline justify-between">
                                <span className="text-2xl font-bold tracking-tight text-white">{metric.value}</span>
                                <span className="text-[11px] font-medium text-emerald-400">{metric.change}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recent Pipeline Executions Table */}
                <div className="rounded-2xl border border-white/[0.08] bg-[#0c101b]/80 overflow-hidden shadow-xl backdrop-blur-md">
                    <div className="border-b border-white/[0.08] px-6 py-4 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-bold text-white">Recent PR Reviews & Automation</h2>
                            <p className="text-xs text-neutral-400">Automated pull requests and security policy evaluations</p>
                        </div>
                        <span className="text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer">
                            View all →
                        </span>
                    </div>

                    <div className="divide-y divide-white/[0.06] text-xs">
                        {[
                            {
                                repo: "orbix-core / auth-service",
                                pr: "PR #124 • Add Supabase connection pooling & rate limiters",
                                author: "vineet_test01",
                                status: "Passed AI Review",
                                statusColor: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
                                time: "10 mins ago",
                            },
                            {
                                repo: "orbix-core / frontend-web",
                                pr: "PR #89 • Responsive Auth Pages & Password Strength Gauge",
                                author: "vineet_test01",
                                status: "Merged",
                                statusColor: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
                                time: "42 mins ago",
                            },
                            {
                                repo: "orbix-infra / mcp-agent",
                                pr: "PR #42 • Model Context Protocol server tooling schema",
                                author: "system-bot",
                                status: "In Automated Testing",
                                statusColor: "text-amber-400 bg-amber-500/10 border-amber-500/20",
                                time: "2 hours ago",
                            },
                        ].map((row, idx) => (
                            <div
                                key={idx}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-4 hover:bg-white/[0.02] transition-colors"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono text-[11px] text-neutral-400">{row.repo}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${row.statusColor}`}>
                                            {row.status}
                                        </span>
                                    </div>
                                    <p className="font-medium text-white">{row.pr}</p>
                                </div>

                                <div className="flex items-center gap-4 text-neutral-400 text-[11px] flex-shrink-0">
                                    <span>by {row.author}</span>
                                    <span>•</span>
                                    <span>{row.time}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </main>
        </div>
    );
}
