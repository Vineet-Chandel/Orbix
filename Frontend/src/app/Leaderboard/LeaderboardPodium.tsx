import React from "react";
import { Link } from "react-router-dom";
import { Crown, Flame, CheckCircle2 } from "lucide-react";
import type { LeaderboardEntry } from "./types";

interface LeaderboardPodiumProps {
    podium: LeaderboardEntry[];
}

export const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({ podium }) => {
    if (!podium || podium.length === 0) {
        return null;
    }

    // Identify first, second, and third place from the podium array
    const first = podium.find((p) => p.rank === 1) || podium[0];
    const second = podium.find((p) => p.rank === 2) || (podium.length > 1 ? podium[1] : null);
    const third = podium.find((p) => p.rank === 3) || (podium.length > 2 ? podium[2] : null);

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-end">
                {/* 2nd Place (Left on Desktop) */}
                {second && (
                    <PodiumCard
                        entry={second}
                        position={2}
                        label="2nd"
                        accentColor="#94A3B8"
                        accentBg="bg-slate-500/10"
                        accentBorder="border-slate-400/30"
                        heightClass="md:h-[390px]"
                    />
                )}

                {/* 1st Place (Center, Elevated) */}
                {first && (
                    <PodiumCard
                        entry={first}
                        position={1}
                        label="1st"
                        accentColor="#F59E0B"
                        accentBg="bg-amber-500/10"
                        accentBorder="border-amber-500/40"
                        heightClass="md:h-[430px]"
                        isFirst
                    />
                )}

                {/* 3rd Place (Right on Desktop) */}
                {third && (
                    <PodiumCard
                        entry={third}
                        position={3}
                        label="3rd"
                        accentColor="#D97706"
                        accentBg="bg-orange-500/10"
                        accentBorder="border-orange-500/30"
                        heightClass="md:h-[370px]"
                    />
                )}
            </div>
        </div>
    );
};

interface PodiumCardProps {
    entry: LeaderboardEntry;
    position: number;
    label: string;
    accentColor: string;
    accentBg: string;
    accentBorder: string;
    heightClass: string;
    isFirst?: boolean;
}

const PodiumCard: React.FC<PodiumCardProps> = ({
    entry,
    position,
    label,
    accentColor,
    accentBg,
    accentBorder,
    heightClass,
    isFirst = false,
}) => {
    const initials = (entry.displayName || entry.username)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const ratings = entry.platformRatings || {};
    const college = entry.college || "—";

    return (
        <div
            className={`relative rounded-2xl bg-neutral-900/80 border ${accentBorder} p-6 flex flex-col justify-between transition-all hover:bg-neutral-900 shadow-lg ${heightClass} ${
                isFirst ? "order-first md:order-none ring-1 ring-amber-500/20" : ""
            }`}
        >
            {/* Top Badge: Rank Position */}
            <div className="flex items-center justify-between">
                <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black tracking-wider uppercase ${accentBg} border ${accentBorder}`}
                    style={{ color: accentColor }}
                >
                    {isFirst && <Crown className="w-3.5 h-3.5 fill-current" />}
                    <span>#{position} · {label} Place</span>
                </span>

                {entry.streak > 0 && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                        <Flame className="w-3 h-3 fill-amber-400" />
                        <span>{entry.streak}d streak</span>
                    </span>
                )}
            </div>

            {/* Middle Section: Avatar & Coder Info */}
            <div className="text-center my-4 space-y-2">
                <div className="relative inline-block">
                    {entry.avatarUrl ? (
                        <img
                            src={entry.avatarUrl}
                            alt={entry.displayName}
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 shadow-md mx-auto"
                            style={{ borderColor: accentColor }}
                        />
                    ) : (
                        <div
                            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl text-white border-2 mx-auto shadow-md"
                            style={{
                                borderColor: accentColor,
                                backgroundColor: `${accentColor}25`,
                            }}
                        >
                            {initials}
                        </div>
                    )}
                    {entry.isVerified && (
                        <div
                            className="absolute bottom-0 right-0 p-1 rounded-full bg-neutral-950 border border-neutral-800 text-blue-400 shadow-xs"
                            title="Ownership Verified"
                        >
                            <CheckCircle2 className="w-4 h-4 fill-blue-500 text-neutral-950" />
                        </div>
                    )}
                </div>

                <div>
                    <div className="flex items-center justify-center gap-1.5">
                        <Link
                            to={`/u/${encodeURIComponent(entry.username)}`}
                            className="text-base sm:text-lg font-black text-white hover:text-amber-400 transition-colors tracking-tight truncate max-w-[200px]"
                        >
                            {entry.displayName}
                        </Link>
                    </div>
                    <p className="text-xs text-neutral-400 font-mono">@{entry.username}</p>
                    <p className="text-xs text-neutral-500 truncate max-w-[220px] mx-auto mt-0.5" title={college}>
                        {college}
                    </p>
                </div>
            </div>

            {/* Score & Key Metrics */}
            <div className="space-y-3 pt-3 border-t border-neutral-800/80">
                <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-black text-white font-mono tracking-tight">
                        {entry.score.toLocaleString()}
                    </div>
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">
                        Orbix Score
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-2 rounded-xl bg-neutral-950/70 border border-neutral-800">
                        <span className="text-neutral-400 text-[10px] uppercase font-bold block">Solved</span>
                        <span className="text-white font-mono font-bold">{entry.totalSolved.toLocaleString()}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-neutral-950/70 border border-neutral-800">
                        <span className="text-neutral-400 text-[10px] uppercase font-bold block">Contests</span>
                        <span className="text-white font-mono font-bold">{entry.totalContests}</span>
                    </div>
                </div>

                {/* Rating Chips */}
                {Object.keys(ratings).length > 0 && (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap pt-1">
                        {ratings.codeforces && (
                            <span
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border"
                                style={{
                                    color: ratings.codeforces.color || "#03a89e",
                                    backgroundColor: `${ratings.codeforces.color || "#03a89e"}15`,
                                    borderColor: `${ratings.codeforces.color || "#03a89e"}40`,
                                }}
                                title={`Codeforces: ${ratings.codeforces.rating} (${ratings.codeforces.tier || "Rated"})`}
                            >
                                CF {ratings.codeforces.rating}
                            </span>
                        )}
                        {ratings.leetcode && (
                            <span
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400"
                                title={`LeetCode: ${ratings.leetcode.rating}`}
                            >
                                LC {ratings.leetcode.rating}
                            </span>
                        )}
                        {ratings.codechef && (
                            <span
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-amber-600/30 bg-amber-600/10 text-amber-500"
                                title={`CodeChef: ${ratings.codechef.rating}`}
                            >
                                CC {ratings.codechef.rating}
                            </span>
                        )}
                        {ratings.atcoder && (
                            <span
                                className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400"
                                title={`AtCoder: ${ratings.atcoder.rating}`}
                            >
                                AC {ratings.atcoder.rating}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
