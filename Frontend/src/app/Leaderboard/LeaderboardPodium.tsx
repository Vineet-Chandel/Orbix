import React from "react";
import { Link } from "react-router-dom";
import { Crown, Flame, CheckCircle2, Building2 } from "lucide-react";
import type { LeaderboardEntry } from "./types";

interface LeaderboardPodiumProps {
    podium: LeaderboardEntry[];
    scope?: "global" | "college";
}

export const LeaderboardPodium: React.FC<LeaderboardPodiumProps> = ({ podium, scope = "global" }) => {
    if (!podium || podium.length === 0) {
        return null;
    }

    // Identify first, second, and third place from the podium array
    const first = podium.find((p) => (scope === "college" ? p.collegeRank === 1 || p.rank === 1 : p.rank === 1)) || podium[0];
    const second = podium.find((p) => (scope === "college" ? p.collegeRank === 2 || p.rank === 2 : p.rank === 2)) || (podium.length > 1 ? podium[1] : null);
    const third = podium.find((p) => (scope === "college" ? p.collegeRank === 3 || p.rank === 3 : p.rank === 3)) || (podium.length > 2 ? podium[2] : null);

    return (
        <div className="w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 items-end">
                {/* 2nd Place (Left on Desktop) */}
                {second && (
                    <PodiumCard
                        entry={second}
                        position={2}
                        label="2nd"
                        accentBg="bg-white"
                        shadowClass="shadow-[4px_4px_0px_#000]"
                        heightClass="md:h-[390px]"
                        scope={scope}
                    />
                )}

                {/* 1st Place (Center, Elevated) */}
                {first && (
                    <PodiumCard
                        entry={first}
                        position={1}
                        label="1st"
                        accentBg="bg-[#FFE566]"
                        shadowClass="shadow-[6px_6px_0px_#000]"
                        heightClass="md:h-[430px]"
                        isFirst
                        scope={scope}
                    />
                )}

                {/* 3rd Place (Right on Desktop) */}
                {third && (
                    <PodiumCard
                        entry={third}
                        position={3}
                        label="3rd"
                        accentBg="bg-white"
                        shadowClass="shadow-[4px_4px_0px_#000]"
                        heightClass="md:h-[370px]"
                        scope={scope}
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
    accentBg: string;
    shadowClass: string;
    heightClass: string;
    isFirst?: boolean;
    scope?: "global" | "college";
}

const PodiumCard: React.FC<PodiumCardProps> = ({
    entry,
    position: _position,
    label,
    accentBg: _accentBg,
    shadowClass,
    heightClass,
    isFirst = false,
    scope = "global",
}) => {
    const initials = (entry.displayName || entry.username)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const ratings = entry.platformRatings || {};
    const college = entry.college || "—";
    const displayRank = scope === "college" && entry.collegeRank ? entry.collegeRank : entry.rank;

    return (
        <div
            className={`w-full rounded-2xl border-2 border-black ${shadowClass} p-5 sm:p-6 flex flex-col justify-between relative transition-all duration-200 hover:-translate-y-1 ${
                isFirst ? "bg-[#FFE566]" : "bg-white"
            } ${heightClass}`}
        >
            {/* Top Badge Strip: Position Badge & Streak */}
            <div className="flex items-center justify-between gap-2">
                <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border-2 border-black text-xs font-black uppercase shadow-[1px_1px_0px_#000] ${
                        isFirst ? "bg-black text-[#FFE566]" : "bg-[#FAF6EE] text-black"
                    }`}
                >
                    {isFirst && <Crown className="w-3.5 h-3.5 fill-[#FFE566]" />}
                    <span>#{displayRank} · {label} Place</span>
                </span>

                {entry.streak > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-white border-2 border-black text-black text-[11px] font-mono font-black shadow-[1px_1px_0px_#000]">
                        <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        <span>{entry.streak}d</span>
                    </span>
                )}
            </div>

            {/* Middle Section: Avatar, Name, Handle & College */}
            <div className="flex flex-col items-center text-center space-y-3 py-2">
                <div className="relative">
                    {entry.avatarUrl ? (
                        <img
                            src={entry.avatarUrl}
                            alt={entry.displayName}
                            className={`w-20 h-20 rounded-2xl object-cover border-2 border-black shadow-[3px_3px_0px_#000] ${
                                isFirst ? "ring-2 ring-black" : ""
                            }`}
                        />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center font-black text-xl text-black shadow-[3px_3px_0px_#000]">
                            {initials}
                        </div>
                    )}
                    {entry.isVerified && (
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-black border-2 border-white flex items-center justify-center text-white shadow-xs">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#a2ff86]" />
                        </div>
                    )}
                </div>

                <div className="space-y-0.5 max-w-full">
                    <Link
                        to={`/profile/u/${encodeURIComponent(entry.username)}`}
                        className="text-base sm:text-lg font-black text-black hover:underline tracking-tight block truncate"
                        title={entry.displayName}
                    >
                        {entry.displayName}
                    </Link>
                    <p className="text-xs font-mono font-bold text-neutral-600 truncate">
                        @{entry.username}
                    </p>
                    {college && college !== "—" && (
                        <p className="text-[11px] font-bold text-neutral-700 truncate max-w-[220px] flex items-center justify-center gap-1 mt-0.5" title={college}>
                            <Building2 className="w-3 h-3 stroke-[2.5] flex-shrink-0" />
                            <span className="truncate">{college}</span>
                        </p>
                    )}
                </div>
            </div>

            {/* Bottom Metrics: Big Orbix Score + Solved & Rating Chips */}
            <div className="space-y-3 pt-2 border-t-2 border-black/15">
                <div className="text-center">
                    <span className="text-2xl sm:text-3xl font-mono font-black text-black block tracking-tight">
                        {entry.score.toLocaleString()}
                    </span>
                    <span className="text-[10px] font-black uppercase text-neutral-600 tracking-wider">
                        Orbix Score
                    </span>
                </div>

                {/* Sub-metrics: Solved & Contests */}
                <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="p-1.5 rounded-lg bg-white/80 border border-black/20">
                        <span className="text-xs font-mono font-black text-black block">
                            {entry.totalSolved.toLocaleString()}
                        </span>
                        <span className="text-[9px] font-bold uppercase text-neutral-600 block">
                            Solved
                        </span>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white/80 border border-black/20">
                        <span className="text-xs font-mono font-black text-black block">
                            {entry.totalContests}
                        </span>
                        <span className="text-[9px] font-bold uppercase text-neutral-600 block">
                            Contests
                        </span>
                    </div>
                </div>

                {/* Platform Rating Chips */}
                {Object.keys(ratings).length > 0 && (
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {ratings.codeforces && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                <span className="text-neutral-500">CF</span>
                                <span style={{ color: ratings.codeforces.color || "#000" }}>{ratings.codeforces.rating}</span>
                            </span>
                        )}
                        {ratings.leetcode && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                <span className="text-neutral-500">LC</span>
                                <span className="text-amber-600">{ratings.leetcode.rating}</span>
                            </span>
                        )}
                        {ratings.codechef && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-black text-[10px] font-mono font-black shadow-[1px_1px_0px_#000]">
                                <span className="text-neutral-500">CC</span>
                                <span>{ratings.codechef.rating}</span>
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
