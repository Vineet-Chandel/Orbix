import React from "react";
import { X, Cpu, ShieldCheck, Award, Zap, Code2, BookOpen, GitPullRequest, Flame, CheckCircle2 } from "lucide-react";

interface AlgorithmModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AlgorithmModal: React.FC<AlgorithmModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const pillars = [
        {
            title: "Problem Solving",
            weight: "35%",
            maxPts: "3,500 pts",
            icon: <Code2 className="w-5 h-5 text-black" />,
            color: "bg-[#a2ff86]",
            description: "Multi-platform problem solving across Easy, Medium, Hard, and Unknown difficulties with logarithmic diminishing returns.",
            details: [
                "Difficulty Multipliers: Easy (1x), Medium (3x), Hard (6x), General/Unknown (2x)",
                "Smooth concave saturation curve (scale = 1,400 raw pts) prevents runaway score inflation from simple problem spam",
                "Supported across all 12 CP & coding practice platforms",
            ],
        },
        {
            title: "Contest Performance",
            weight: "20%",
            maxPts: "2,000 pts",
            icon: <Award className="w-5 h-5 text-black" />,
            color: "bg-[#ffd5dc]",
            description: "Competitive contest rating percentiles against official platform tiers and rated contest participation experience.",
            details: [
                "Rating Baselines: Codeforces (1,000-2,400), LeetCode (1,500-2,600), CodeChef (1,400-2,300), AtCoder (400-2,000), TopCoder (1,200-2,200)",
                "Multi-platform composite: Best normalized rating carries 75%, secondary rating carries 25%",
                "Experience bonus: Rated contest attendance grants cumulative participation points",
            ],
        },
        {
            title: "Open-Source Contributions",
            weight: "20%",
            maxPts: "2,000 pts",
            icon: <GitPullRequest className="w-5 h-5 text-black" />,
            color: "bg-[#b6e3f4]",
            description: "Merged pull requests, public code reviews, external repository contributions, and substantive issues resolved.",
            details: [
                "Quality Weights: Merged PRs (10 pts), External Repos (12 pts), Code Reviews (6 pts), Opened PRs (3 pts)",
                "First Verified Milestone Bonus: +5 subscore points awarded for initial verified external contribution",
                "Diminishing returns curve values substance, peer review, and cross-organization impact",
            ],
        },
        {
            title: "Repository & Project Quality",
            weight: "10%",
            maxPts: "1,000 pts",
            icon: <Zap className="w-5 h-5 text-black" />,
            color: "bg-[#ffdfbf]",
            description: "Public non-fork repositories, verified community stars, forks, and polyglot language diversity.",
            details: [
                "Anti-Spam Bounding: Repositories strictly capped at 15 to prevent empty repository creation",
                "Logarithmic Star Multiplier: Rewards genuine community traction without letting viral repos distort rankings",
                "Polyglot Bonus: Verified projects across 3+ programming languages",
            ],
        },
        {
            title: "Consistency & Streaks",
            weight: "10%",
            maxPts: "1,000 pts",
            icon: <Flame className="w-5 h-5 text-black" />,
            color: "bg-[#c0aede]",
            description: "All-time active coding days, trailing 30-day practice density, and daily streak consistency.",
            details: [
                "All-Time Active Days: Bounded curve up to 50 subscore points for long-term dedication",
                "Trailing 30-Day Density: Up to 25 subscore points for active daily practice in the last month",
                "Habit Streak: Up to 25 subscore points for unbroken daily consistency",
            ],
        },
        {
            title: "Technical Writing & Community",
            weight: "5%",
            maxPts: "500 pts",
            icon: <BookOpen className="w-5 h-5 text-black" />,
            color: "bg-[#fef08a]",
            description: "Published technical articles, developer guides, and newsletter publications on Medium, Substack, and AlgorithmXlr8.",
            details: [
                "Article Publications: Up to 50 subscore points for quality developer tutorials and solutions",
                "Verified Readership & Followers: Logarithmic scaling for readers and newsletter subscribers",
                "Cross-Platform Publishing: Bonus points for publishing across multiple platforms",
            ],
        },
    ];

    const platforms = [
        { name: "LeetCode", category: "Competitive Programming", metrics: "Total solved, E/M/H breakdown, Contest rating, Streak", pillars: "P1 (35%), P2 (20%), P5 (10%)" },
        { name: "Codeforces", category: "Competitive Programming", metrics: "Solves, Rating, Max rating, Tier, Contests", pillars: "P1 (35%), P2 (20%)" },
        { name: "CodeChef", category: "Competitive Programming", metrics: "Solves, Star rating (1★-7★), Global rating, Division", pillars: "P1 (35%), P2 (20%)" },
        { name: "GeeksforGeeks", category: "Coding Practice", metrics: "Score, Solved count, School/Basic/Easy/Medium/Hard", pillars: "P1 (35%)" },
        { name: "HackerRank", category: "Coding Practice", metrics: "Badges, Problem solving stars, Challenges solved", pillars: "P1 (35%)" },
        { name: "AtCoder", category: "Competitive Programming", metrics: "Rating, Max rating, Tier color, Contests", pillars: "P1 (35%), P2 (20%)" },
        { name: "Code360", category: "Coding Practice", metrics: "Problems solved, Experience points, Streaks", pillars: "P1 (35%), P5 (10%)" },
        { name: "InterviewBit", category: "Interview Prep", metrics: "Score, Problems solved, Streak", pillars: "P1 (35%), P5 (10%)" },
        { name: "TopCoder", category: "Competitive Programming", metrics: "SRM rating, Rated contests count", pillars: "P2 (20%)" },
        { name: "HackerEarth", category: "Coding Practice", metrics: "Problems solved, Contest participations", pillars: "P1 (35%), P2 (20%)" },
        { name: "CSES", category: "Algorithm Practice", metrics: "Problem set tasks solved", pillars: "P1 (35%)" },
        { name: "SPOJ", category: "Competitive Programming", metrics: "Classical problems solved, World rank", pillars: "P1 (35%)" },
        { name: "GitHub", category: "Code Hosting & OS", metrics: "Repos, Stars, Commits, PRs merged, Issues, Reviews", pillars: "P3 (20%), P4 (10%)" },
        { name: "AlgorithmXlr8", category: "Developer Community", metrics: "Community problems solved, Solutions published", pillars: "P1 (35%), P6 (5%)" },
        { name: "Medium", category: "Technical Writing", metrics: "Published technical stories, Followers, Claps", pillars: "P6 (5%)" },
        { name: "Substack", category: "Technical Writing", metrics: "Newsletter posts, Subscribers, Publications", pillars: "P6 (5%)" },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div
                className="relative w-full max-w-4xl max-h-[90vh] bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden text-black"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b-2 border-black bg-white">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-black text-[#a2ff86] rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
                            <Cpu className="w-6 h-6 stroke-[2.5]" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xl sm:text-2xl font-black tracking-tight">Orbix Score Engine</h2>
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-[#a2ff86] border-2 border-black shadow-[1px_1px_0px_#000]">
                                    v2.0.0 Authoritative
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                Standard 0 to 10,000 Points • 6 Canonical Pillars • Diminishing Returns Architecture
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5 stroke-[2.5]" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Mission Summary */}
                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-emerald-700" />
                            <h3 className="text-base font-black uppercase tracking-wider">Universal Developer Identity</h3>
                        </div>
                        <p className="text-sm font-medium text-neutral-700 leading-relaxed">
                            The Orbix Score solves the fragmentation of developer achievements. Instead of relying purely on one platform,
                            it combines competitive programming problem solving, live contest ratings, genuine open-source pull requests,
                            repository quality, daily consistency, and technical writing into one authoritative rank.
                        </p>
                    </div>

                    {/* 6 Canonical Pillars */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black tracking-tight">The 6 Canonical Scoring Pillars</h3>
                            <span className="text-xs font-bold text-neutral-600">Total Weight: 100% (10,000 Points)</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {pillars.map((pillar, idx) => (
                                <div
                                    key={idx}
                                    className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3 flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex items-center justify-between gap-2 mb-2">
                                            <div className="flex items-center gap-2">
                                                <div className={`p-1.5 rounded-lg border-2 border-black ${pillar.color}`}>
                                                    {pillar.icon}
                                                </div>
                                                <h4 className="font-black text-sm sm:text-base">{pillar.title}</h4>
                                            </div>
                                            <div className="text-right">
                                                <span className="px-2 py-0.5 rounded-md border-2 border-black font-black text-xs bg-black text-white">
                                                    {pillar.weight}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-medium mb-3">{pillar.description}</p>
                                        <ul className="space-y-1.5 text-xs text-neutral-800 font-medium">
                                            {pillar.details.map((item, dIdx) => (
                                                <li key={dIdx} className="flex items-start gap-1.5">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                                    <span>{item}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                    <div className="pt-2 border-t border-neutral-200 flex justify-between items-center text-xs font-bold text-neutral-500">
                                        <span>Max Allocation:</span>
                                        <span className="text-black font-black">{pillar.maxPts}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Platform Capability Matrix Table */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-black tracking-tight">Supported Platform Registry (16 Genuine Platforms)</h3>
                        </div>
                        <div className="overflow-x-auto rounded-2xl border-2 border-black bg-white shadow-[4px_4px_0px_#000]">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-neutral-100 border-b-2 border-black">
                                        <th className="p-3 font-black uppercase">Platform</th>
                                        <th className="p-3 font-black uppercase">Category</th>
                                        <th className="p-3 font-black uppercase">Available Metrics</th>
                                        <th className="p-3 font-black uppercase">Scoring Integration</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200 font-medium">
                                    {platforms.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-neutral-50 transition-colors">
                                            <td className="p-3 font-black text-black">{p.name}</td>
                                            <td className="p-3 text-neutral-700">{p.category}</td>
                                            <td className="p-3 text-neutral-600">{p.metrics}</td>
                                            <td className="p-3 font-bold text-black">{p.pillars}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Deterministic Ranking & Anti-Gaming */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>⚖️</span> Deterministic Tie-Breaking
                            </h4>
                            <ol className="list-decimal list-inside text-xs font-medium text-neutral-700 space-y-1">
                                <li><strong>Authoritative Orbix Score</strong> (DESC)</li>
                                <li><strong>Total Verified Solved Problems</strong> across all platforms (DESC)</li>
                                <li><strong>Username</strong> (ASC, strict alphabetical order)</li>
                            </ol>
                        </div>
                        <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <h4 className="font-black text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>🛡️</span> Anti-Gaming & Fairness Guarantees
                            </h4>
                            <ul className="list-disc list-inside text-xs font-medium text-neutral-700 space-y-1">
                                <li>Diminishing returns curves prevent infinite spam</li>
                                <li>Duplicate contest and submission dates deduplicated</li>
                                <li>Empty or fork-only GitHub repositories strictly bounded</li>
                                <li>Live server-authoritative resync validation</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t-2 border-black bg-white flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl bg-black text-white border-2 border-black font-black text-xs uppercase shadow-[2px_2px_0px_#000] hover:bg-neutral-800 transition-all cursor-pointer"
                    >
                        Got It
                    </button>
                </div>
            </div>
        </div>
    );
};
