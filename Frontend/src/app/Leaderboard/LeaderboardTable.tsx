import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Flame, Award, Building2 } from "lucide-react";
import type { LeaderboardEntry } from "./types";

interface LeaderboardTableProps {
    entries: LeaderboardEntry[];
    currentUsername?: string | null;
    isLoading?: boolean;
    scope?: "global" | "college";
    selectedCollegeName?: string | null;
    onOpenAlgorithm?: () => void;
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({
    entries,
    currentUsername,
    isLoading = false,
    scope = "global",
    selectedCollegeName,
    onOpenAlgorithm,
}) => {
    if (isLoading) {
        return (
            <div className="w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-12 text-center space-y-3">
                <div className="w-8 h-8 border-4 border-black border-t-[#a2ff86] rounded-full animate-spin mx-auto shadow-[1px_1px_0px_#000]" />
                <p className="text-xs font-black uppercase tracking-wider text-black">
                    Loading {scope === "college" ? "College League" : "Global"} Standings...
                </p>
            </div>
        );
    }

    if (!entries || entries.length === 0) {
        return (
            <div className="w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center text-black mx-auto shadow-[2px_2px_0px_#000]">
                    <Award className="w-6 h-6 stroke-[2.5]" />
                </div>
                <h3 className="text-base font-black text-black uppercase tracking-wide">
                    {scope === "college"
                        ? `No Coders from ${selectedCollegeName || "this College"} Yet`
                        : "No Coders Found"}
                </h3>
                <p className="text-xs font-medium text-neutral-600 max-w-sm mx-auto leading-relaxed">
                    {scope === "college"
                        ? "Be the first student to link your coding handles and represent this campus on the leaderboard!"
                        : "No coders match the active filter or search criteria."}
                </p>
            </div>
        );
    }

    return (
        <div className="w-full overflow-hidden rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b-2 border-black bg-[#FAF6EE] text-[11px] font-black text-black uppercase tracking-wider">
                            <th className="py-3.5 px-4 sm:px-6 w-16 text-center">Rank</th>
                            <th className="py-3.5 px-4 min-w-[220px]">Coder</th>
                            <th className="py-3.5 px-4 min-w-[200px] hidden md:table-cell">
                                {scope === "college" ? "Campus Location" : "College / University"}
                            </th>
                            <th className="py-3.5 px-4 text-right">Score</th>
                            <th className="py-3.5 px-4 text-center hidden sm:table-cell">Solved</th>
                            <th className="py-3.5 px-4 text-center hidden sm:table-cell">Contests</th>
                            <th className="py-3.5 px-4 min-w-[170px] hidden lg:table-cell">Ratings</th>
                            <th className="py-3.5 px-4 text-center hidden xl:table-cell">Streak</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black/10 text-xs">
                        {entries.map((entry) => {
                            const isCurrentUser = Boolean(
                                currentUsername && entry.username.toLowerCase() === currentUsername.toLowerCase()
                            );
                            const ratings = entry.platformRatings || {};
                            const college = entry.college || "—";
                            const displayRank = scope === "college" && entry.collegeRank ? entry.collegeRank : entry.rank;

                            const initials = (entry.displayName || entry.username)
                                .split(" ")
                                .map((n) => n[0])
                                .slice(0, 2)
                                .join("")
                                .toUpperCase();

                            // Distinct rank badge styling
                            let rankBadge = (
                                <span className="font-mono font-black text-neutral-800 text-sm">
                                    #{displayRank}
                                </span>
                            );
                            if (displayRank === 1) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-lg bg-[#FFE566] text-black border-2 border-black flex items-center justify-center font-mono font-black text-xs mx-auto shadow-[1px_1px_0px_#000]">
                                        1
                                    </span>
                                );
                            } else if (displayRank === 2) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-lg bg-white text-black border-2 border-black flex items-center justify-center font-mono font-black text-xs mx-auto shadow-[1px_1px_0px_#000]">
                                        2
                                    </span>
                                );
                            } else if (displayRank === 3) {
                                rankBadge = (
                                    <span className="w-7 h-7 rounded-lg bg-[#FAF6EE] text-black border-2 border-black flex items-center justify-center font-mono font-black text-xs mx-auto shadow-[1px_1px_0px_#000]">
                                        3
                                    </span>
                                );
                            }

                            return (
                                <tr
                                    key={entry.userId || entry.username}
                                    className={`transition-colors group hover:bg-[#FAF6EE]/90 ${
                                        isCurrentUser ? "bg-[#a2ff86]/30 font-bold" : "bg-white"
                                    }`}
                                >
                                    {/* Rank */}
                                    <td className="py-3 px-4 sm:px-6 text-center font-mono">
                                        {rankBadge}
                                    </td>

                                    {/* Coder Avatar & Names */}
                                    <td className="py-3 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative flex-shrink-0">
                                                {entry.avatarUrl ? (
                                                    <img
                                                        src={entry.avatarUrl}
                                                        alt={entry.displayName}
                                                        className="w-10 h-10 rounded-xl object-cover border-2 border-black shadow-[1px_1px_0px_#000]"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center font-black text-xs text-black shadow-[1px_1px_0px_#000]">
                                                        {initials}
                                                    </div>
                                                )}
                                                {entry.isVerified && (
                                                    <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-black border border-white flex items-center justify-center text-[#a2ff86]">
                                                        <CheckCircle2 className="w-3 h-3" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Link
                                                        to={`/profile/u/${encodeURIComponent(entry.username)}`}
                                                        className="text-xs sm:text-sm font-black text-black hover:underline truncate max-w-[160px] sm:max-w-[220px]"
                                                        title={entry.displayName}
                                                    >
                                                        {entry.displayName}
                                                    </Link>
                                                    {isCurrentUser && (
                                                        <span className="px-1.5 py-0.2 rounded bg-black text-[#a2ff86] text-[9px] font-black uppercase">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] font-mono text-neutral-600 truncate">
                                                    @{entry.username}
                                                </p>
                                            </div>
                                        </div>
                                    </td>

                                    {/* College / University or Campus Location */}
                                    <td className="py-3 px-4 hidden md:table-cell">
                                        {scope === "college" ? (
                                            <div className="flex items-center gap-1.5 text-neutral-700">
                                                <Building2 className="w-3.5 h-3.5 stroke-[2.5] flex-shrink-0" />
                                                <span className="truncate text-xs font-bold">
                                                    {[entry.collegeCity, entry.collegeState].filter(Boolean).join(", ") || college}
                                                </span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 text-neutral-800" title={college}>
                                                {college !== "—" && (
                                                    <Building2 className="w-3.5 h-3.5 stroke-[2.5] text-neutral-500 flex-shrink-0" />
                                                )}
                                                <span className="truncate text-xs font-black max-w-[220px]">
                                                    {college}
                                                </span>
                                            </div>
                                        )}
                                    </td>

                                    {/* Score */}
                                    <td className="py-3 px-4 text-right">
                                        <button
                                            type="button"
                                            onClick={onOpenAlgorithm}
                                            className="inline-flex flex-col items-end group cursor-pointer text-right hover:opacity-85 transition-opacity"
                                            title="Orbix Score v2.0.0 — Click to view algorithm breakdown"
                                        >
                                            <span className="text-sm sm:text-base font-mono font-black text-black group-hover:underline">
                                                {entry.score.toLocaleString()}
                                            </span>
                                            <span className="text-[9px] font-black uppercase text-neutral-500 group-hover:text-black">
                                                PTS
                                            </span>
                                        </button>
                                    </td>

                                    {/* Solved Problems */}
                                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800 hidden sm:table-cell">
                                        {entry.totalSolved.toLocaleString()}
                                    </td>

                                    {/* Contests */}
                                    <td className="py-3 px-4 text-center font-mono font-bold text-neutral-800 hidden sm:table-cell">
                                        {entry.totalContests}
                                    </td>

                                    {/* Platform Ratings Chips */}
                                    <td className="py-3 px-4 hidden lg:table-cell">
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {ratings.codeforces && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                                    <span className="text-neutral-500">CF</span>
                                                    <span style={{ color: ratings.codeforces.color || "#000" }}>{ratings.codeforces.rating}</span>
                                                </span>
                                            )}
                                            {ratings.leetcode && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                                    <span className="text-neutral-500">LC</span>
                                                    <span className="text-amber-600">{ratings.leetcode.rating}</span>
                                                </span>
                                            )}
                                            {ratings.codechef && (
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#FAF6EE] border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                                    <span className="text-neutral-500">CC</span>
                                                    <span>{ratings.codechef.rating}</span>
                                                </span>
                                            )}
                                            {Object.keys(ratings).length === 0 && (
                                                <span className="text-neutral-400 font-mono text-xs">—</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* Streak */}
                                    <td className="py-3 px-4 text-center hidden xl:table-cell">
                                        {entry.streak > 0 ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#FAF6EE] border border-black text-black font-mono font-black text-[11px] shadow-[1px_1px_0px_#000]">
                                                <Flame className="w-3 h-3 text-amber-500 fill-amber-500" />
                                                <span>{entry.streak}d</span>
                                            </span>
                                        ) : (
                                            <span className="text-neutral-400 font-mono text-xs">—</span>
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
