import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Flame, Award } from "lucide-react";
import type { LeaderboardEntry } from "./types";

interface LeaderboardTableProps {
    entries: LeaderboardEntry[];
    currentUsername?: string | null;
    isLoading?: boolean;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
    entries,
    currentUsername,
    isLoading = false,
}) => {
    if (isLoading) {
        return (
            <div className="w-full rounded-2xl bg-neutral-900/60 border border-neutral-800 p-8 text-center space-y-3">
                <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-xs text-neutral-400 font-medium">Loading leaderboard rankings...</p>
            </div>
        );
    }

    if (!entries || entries.length === 0) {
        return (
            <div className="w-full rounded-2xl bg-neutral-900/60 border border-neutral-800 p-12 text-center space-y-3">
                <Award className="w-10 h-10 text-neutral-600 mx-auto" />
                <h3 className="text-base font-bold text-white">No Coders Found</h3>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                    No coders match the active filter or search criteria.
                </p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-2xl bg-neutral-900/60 border border-neutral-800/80 shadow-sm backdrop-blur-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-neutral-800 bg-neutral-950/80 text-[11px] font-bold text-neutral-400 uppercase tracking-wider">
                            <th className="py-3.5 px-4 sm:px-6 w-16 text-center">Rank</th>
                            <th className="py-3.5 px-4 min-w-[220px]">Coder</th>
                            <th className="py-3.5 px-4 min-w-[180px] hidden md:table-cell">College / University</th>
                            <th className="py-3.5 px-4 text-right">Score</th>
                            <th className="py-3.5 px-4 text-center hidden sm:table-cell">Solved</th>
                            <th className="py-3.5 px-4 text-center hidden sm:table-cell">Contests</th>
                            <th className="py-3.5 px-4 min-w-[160px] hidden lg:table-cell">Ratings</th>
                            <th className="py-3.5 px-4 text-center hidden xl:table-cell">Streak</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-850 text-xs">
                        {entries.map((entry) => {
                            const isCurrentUser = currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase();
                            const ratings = entry.platformRatings || {};
                            const college = entry.college || "—";

                            const initials = (entry.displayName || entry.username)
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase();

                            // Distinct rank badge styling for podium positions
                            let rankBadge = (
                                <span className="font-mono font-bold text-neutral-400 text-sm">
                                    #{entry.rank}
                                </span>
                            );
                            if (entry.rank === 1) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center justify-center font-mono font-black text-xs mx-auto shadow-xs">
                                        1
                                    </span>
                                );
                            } else if (entry.rank === 2) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-full bg-slate-400/20 text-slate-300 border border-slate-400/40 flex items-center justify-center font-mono font-black text-xs mx-auto shadow-xs">
                                        2
                                    </span>
                                );
                            } else if (entry.rank === 3) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-full bg-amber-700/20 text-amber-600 border border-amber-700/40 flex items-center justify-center font-mono font-black text-xs mx-auto shadow-xs">
                                        3
                                    </span>
                                );
                            }

                            return (
                                <tr
                                    key={entry.userId || entry.username}
                                    className={`transition-colors group hover:bg-neutral-800/50 ${
                                        isCurrentUser ? "bg-amber-500/5 border-l-2 border-l-amber-400" : ""
                                    }`}
                                >
                                    {/* Rank */}
                                    <td className="py-3.5 px-4 sm:px-6 text-center">
                                        {rankBadge}
                                    </td>

                                    {/* Coder Column */}
                                    <td className="py-3.5 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative shrink-0">
                                                {entry.avatarUrl ? (
                                                    <img
                                                        src={entry.avatarUrl}
                                                        alt={entry.displayName}
                                                        className="w-9 h-9 rounded-full object-cover border border-neutral-700"
                                                    />
                                                ) : (
                                                    <div className="w-9 h-9 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center text-xs font-bold text-neutral-300">
                                                        {initials}
                                                    </div>
                                                )}
                                                {entry.isVerified && (
                                                    <div
                                                        className="absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full bg-neutral-950 text-blue-400"
                                                        title="Verified Coder"
                                                    >
                                                        <CheckCircle2 className="w-3 h-3 fill-blue-500 text-neutral-950" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <Link
                                                        to={`/u/${encodeURIComponent(entry.username)}`}
                                                        className="font-bold text-white hover:text-amber-400 transition-colors truncate max-w-[160px] sm:max-w-[200px]"
                                                    >
                                                        {entry.displayName}
                                                    </Link>
                                                    {!entry.isVerified && (
                                                        <span
                                                            className="text-[9px] font-bold px-1 py-0.2 rounded bg-neutral-800 text-neutral-400 border border-neutral-700"
                                                            title="Platform account linked, pending ownership verification"
                                                        >
                                                            Unverified
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-neutral-400 font-mono block">
                                                    @{entry.username}
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    {/* College / University */}
                                    <td className="py-3.5 px-4 hidden md:table-cell text-neutral-400 truncate max-w-[200px]" title={college}>
                                        {college}
                                    </td>

                                    {/* Score */}
                                    <td className="py-3.5 px-4 text-right">
                                        <div className="font-mono font-black text-white text-sm sm:text-base">
                                            {entry.score.toLocaleString()}
                                        </div>
                                        <span className="text-[10px] text-neutral-400 font-bold block uppercase tracking-wider">
                                            Pts
                                        </span>
                                    </td>

                                    {/* Solved */}
                                    <td className="py-3.5 px-4 text-center hidden sm:table-cell font-mono text-neutral-300 font-bold">
                                        {entry.totalSolved.toLocaleString()}
                                    </td>

                                    {/* Contests */}
                                    <td className="py-3.5 px-4 text-center hidden sm:table-cell font-mono text-neutral-300 font-bold">
                                        {entry.totalContests}
                                    </td>

                                    {/* Ratings Chips */}
                                    <td className="py-3.5 px-4 hidden lg:table-cell">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {ratings.codeforces && (
                                                <span
                                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border"
                                                    style={{
                                                        color: ratings.codeforces.color || "#03a89e",
                                                        backgroundColor: `${ratings.codeforces.color || "#03a89e"}15`,
                                                        borderColor: `${ratings.codeforces.color || "#03a89e"}35`,
                                                    }}
                                                    title={`Codeforces: ${ratings.codeforces.rating} (${ratings.codeforces.tier || "Rated"})`}
                                                >
                                                    CF {ratings.codeforces.rating}
                                                </span>
                                            )}
                                            {ratings.leetcode && (
                                                <span
                                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400"
                                                    title={`LeetCode: ${ratings.leetcode.rating} (${ratings.leetcode.badge || "Rated"})`}
                                                >
                                                    LC {ratings.leetcode.rating}
                                                </span>
                                            )}
                                            {ratings.codechef && (
                                                <span
                                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-amber-600/30 bg-amber-600/10 text-amber-500"
                                                    title={`CodeChef: ${ratings.codechef.rating}`}
                                                >
                                                    CC {ratings.codechef.rating}
                                                </span>
                                            )}
                                            {ratings.atcoder && (
                                                <span
                                                    className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400"
                                                    title={`AtCoder: ${ratings.atcoder.rating}`}
                                                >
                                                    AC {ratings.atcoder.rating}
                                                </span>
                                            )}
                                            {Object.keys(ratings).length === 0 && (
                                                <span className="text-[11px] text-neutral-400 font-mono">—</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Streak */}
                                    <td className="py-3.5 px-4 text-center hidden xl:table-cell">
                                        {entry.streak > 0 ? (
                                            <span className="inline-flex items-center gap-1 font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 text-xs">
                                                <Flame className="w-3 h-3 fill-amber-400" />
                                                <span>{entry.streak}d</span>
                                            </span>
                                        ) : (
                                            <span className="text-neutral-400 font-mono">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
