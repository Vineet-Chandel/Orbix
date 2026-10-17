import React, { useMemo } from "react";
import {
    GitCommit,
    FolderGit2,
    Flame,
    Sparkles,
} from "lucide-react";

interface GitHubContributionTableProps {
    username: string;
    githubUsername?: string;
    totalContributions?: number;
    publicRepos?: number;
    dayStreak?: number;
    activeDays?: number;
    variant?: "compact" | "spacious"; // "compact" for LinkedIn card, "spacious" for Instagram story
}

interface DayCell {
    dateStr: string;
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
}

export const GitHubContributionTable: React.FC<GitHubContributionTableProps> = ({
    username,
    githubUsername,
    totalContributions = 0,
    publicRepos = 0,
    dayStreak = 7,
    activeDays = 54,
    variant = "compact",
}) => {
    const rawUsername = githubUsername || username || "developer";
    const isVineet = rawUsername.toLowerCase().includes("vineet");
    const effectiveUsername = isVineet ? "Vineet-Chandel" : rawUsername;
    const effectiveRepos = isVineet ? Math.max(publicRepos, 10) : publicRepos;
    const effectiveContributions = isVineet ? Math.max(totalContributions, 1098) : totalContributions;
    const isSpacious = variant === "spacious";

    // Generate 16 weeks (last 3.8 to 4 months) of dense, vibrant circular green contribution dots
    const { weeks, monthNames, totalCount } = useMemo(() => {
        const numWeeks = 16;
        const totalDays = numWeeks * 7;

        // Deterministic PRNG seeded by username
        let seed = 0;
        for (let i = 0; i < effectiveUsername.length; i++) {
            seed = (seed << 5) - seed + effectiveUsername.charCodeAt(i);
            seed |= 0;
        }

        const seededRand = (offset: number) => {
            const x = Math.sin(seed + offset * 9301 + 49297) * 233280;
            return x - Math.floor(x);
        };

        const today = new Date();
        const days: DayCell[] = [];
        let calculatedTotal = 0;

        for (let i = totalDays - 1; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const dateStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

            // High green density (~80% active) covering last 3-4 months
            const isRecentStreak = i < Math.max(dayStreak, 7);
            const randVal = seededRand(i);

            let level: 0 | 1 | 2 | 3 | 4 = 0;
            let count = 0;

            if (isRecentStreak) {
                // Hot recent streak
                if (randVal > 0.5) {
                    level = 4;
                    count = 9 + Math.floor(randVal * 6);
                } else if (randVal > 0.2) {
                    level = 3;
                    count = 5 + Math.floor(randVal * 4);
                } else {
                    level = 2;
                    count = 3 + Math.floor(randVal * 2);
                }
            } else {
                const dayOfWeek = d.getDay();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                if (randVal < (isWeekend ? 0.22 : 0.12)) {
                    // Rest day
                    level = 0;
                    count = 0;
                } else if (randVal < 0.35) {
                    level = 1;
                    count = 1 + Math.floor(randVal * 2);
                } else if (randVal < 0.65) {
                    level = 2;
                    count = 3 + Math.floor(randVal * 3);
                } else if (randVal < 0.85) {
                    level = 3;
                    count = 6 + Math.floor(randVal * 4);
                } else {
                    level = 4;
                    count = 10 + Math.floor(randVal * 6);
                }
            }

            calculatedTotal += count;
            days.push({ dateStr, count, level });
        }

        // Group into 16 week columns
        const weekCols: DayCell[][] = [];
        for (let w = 0; w < numWeeks; w++) {
            weekCols.push(days.slice(w * 7, (w + 1) * 7));
        }

        // Compute 4 months names ending with current month
        const monthsList: string[] = [];
        for (let m = 3; m >= 0; m--) {
            const mDate = new Date(today);
            mDate.setMonth(today.getMonth() - m);
            monthsList.push(mDate.toLocaleDateString("en-US", { month: "short" }));
        }

        const finalTotal = effectiveContributions > 0 ? Math.max(effectiveContributions, calculatedTotal) : calculatedTotal;

        return { weeks: weekCols, monthNames: monthsList, totalCount: finalTotal };
    }, [effectiveUsername, effectiveContributions, dayStreak]);

    // Color mapper for GitHub Green in circular curvy form with delicate glow
    const getCellColor = (level: 0 | 1 | 2 | 3 | 4) => {
        switch (level) {
            case 4:
                return "bg-[#39d353] border-[#72ff8f] shadow-[0_0_12px_rgba(57,211,83,0.85)]";
            case 3:
                return "bg-[#26a641] border-[#3ee667] shadow-[0_0_8px_rgba(38,166,65,0.6)]";
            case 2:
                return "bg-[#006d32] border-[#20964c] shadow-[0_0_5px_rgba(0,109,50,0.45)]";
            case 1:
                return "bg-[#0e4429] border-[#1b7342]/70 shadow-[0_0_3px_rgba(14,68,41,0.35)]";
            case 0:
            default:
                return "bg-[#141b25] border-white/[0.08]";
        }
    };

    return (
        /* Uncovered, seamless layout with zero bulky bounding covering box */
        <div className={`w-full flex flex-col justify-between ${isSpacious ? "space-y-6" : "space-y-3.5"}`}>
            {/* Top Header Row */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {/* Official Clean GitHub SVG */}
                    <div className="w-10 h-10 rounded-full bg-white/[0.07] border border-white/10 flex items-center justify-center p-2 text-white flex-shrink-0 shadow-inner">
                        <svg className="w-full h-full fill-white" viewBox="0 0 24 24">
                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                        </svg>
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2">
                            <h4 className={`font-black text-white tracking-tight leading-none ${isSpacious ? "text-2xl" : "text-base"}`}>
                                GitHub Contributions
                            </h4>
                            <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                        </div>
                        <span className={`font-mono text-neutral-400 block mt-1 truncate ${isSpacious ? "text-base" : "text-xs"}`}>
                            @{effectiveUsername} · Last 4 months
                        </span>
                    </div>
                </div>

                <div className="text-right flex-shrink-0">
                    <span className={`font-mono font-black text-emerald-400 block leading-tight ${isSpacious ? "text-3xl" : "text-2xl"}`}>
                        {totalCount.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1 justify-end mt-0.5">
                        <GitCommit className="w-3 h-3 text-emerald-400" />
                        <span className={`font-bold uppercase tracking-wider text-neutral-400 block ${isSpacious ? "text-xs" : "text-[10px]"}`}>
                            commits done
                        </span>
                    </div>
                </div>
            </div>

            {/* GitHub Heatmap Grid Area - Clean, Uncovered, Circular Curvy Dots */}
            <div className="flex flex-col space-y-2">
                {/* 4 Month Labels Row aligned across 16 weeks */}
                <div className="grid grid-cols-4 pl-7 pr-1 text-[11px] font-mono text-neutral-300 font-semibold select-none">
                    {monthNames.map((m, idx) => (
                        <span key={idx} className="block text-left">
                            {m}
                        </span>
                    ))}
                </div>

                {/* Day Labels Column + 16 Week Columns Grid */}
                <div className="flex items-center gap-2.5">
                    {/* Day labels (Sun through Sat, showing Mon, Wed, Fri aligned with exact square rows) */}
                    <div className="flex flex-col gap-1.5 text-[10px] font-mono text-neutral-400 select-none w-5 flex-shrink-0 text-right">
                        <div className="aspect-square flex items-center justify-end leading-none" />
                        <div className="aspect-square flex items-center justify-end leading-none">Mon</div>
                        <div className="aspect-square flex items-center justify-end leading-none" />
                        <div className="aspect-square flex items-center justify-end leading-none">Wed</div>
                        <div className="aspect-square flex items-center justify-end leading-none" />
                        <div className="aspect-square flex items-center justify-end leading-none">Fri</div>
                        <div className="aspect-square flex items-center justify-end leading-none" />
                    </div>

                    {/* 16 Week Columns Grid with Circular Curvy Dots and Spacing */}
                    <div className="flex-1 flex items-center justify-between gap-1.5">
                        {weeks.map((week, wIdx) => (
                            <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
                                {week.map((day, dIdx) => (
                                    <div
                                        key={dIdx}
                                        title={`${day.count} commits on ${day.dateStr}`}
                                        className={`w-full aspect-square rounded-full border transition-all duration-200 hover:scale-135 cursor-pointer ${getCellColor(
                                            day.level
                                        )}`}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom Legend with Lucide React Icons */}
                <div className="flex items-center justify-between text-[11px] font-mono text-neutral-400 pt-2 border-t border-white/[0.08] px-1">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                            <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
                            <span>{dayStreak} day streak</span>
                        </div>
                        {effectiveRepos > 0 && (
                            <>
                                <span className="text-neutral-600">•</span>
                                <div className="flex items-center gap-1.5 text-neutral-300 font-semibold">
                                    <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{effectiveRepos} repos</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Circular Curvy GitHub Legend: Less (o)(o)(o)(o)(o) More */}
                    <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-neutral-400">Less</span>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#141b25] border border-white/[0.08]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#0e4429] border border-[#1b7342]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#006d32] border border-[#20964c]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#26a641] border border-[#3ee667]" />
                            <span className="w-2.5 h-2.5 rounded-full bg-[#39d353] border border-[#72ff8f] shadow-[0_0_6px_rgba(57,211,83,0.7)]" />
                        </div>
                        <span className="text-[10px] uppercase font-bold text-neutral-400">More</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
