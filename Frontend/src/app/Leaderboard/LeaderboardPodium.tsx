import React from "react";
import { Link } from "react-router-dom";
import { Crown, Flame, CheckCircle2, Building2 } from "lucide-react";
import { EnlargeableAvatar } from "../../components/media/EnlargeableAvatar";
import { type LeaderboardEntry } from "./types";

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-end max-w-6xl mx-auto pt-7">
                {/* 2nd Place (Left on Desktop, 2nd on Mobile) */}
                {second && (
                    <PodiumCard
                        entry={second}
                        position={2}
                        accentBg="bg-[#E2E8F0]"
                        shadowClass="shadow-[5px_5px_0px_#000]"
                        heightClass="md:min-h-[460px]"
                        scope={scope}
                    />
                )}

                {/* 1st Place (Center, Elevated on Desktop, 1st on Mobile) */}
                {first && (
                    <PodiumCard
                        entry={first}
                        position={1}
                        accentBg="bg-[#FFE566]"
                        shadowClass="shadow-[7px_7px_0px_#000]"
                        heightClass="md:min-h-[515px]"
                        isFirst
                        scope={scope}
                    />
                )}

                {/* 3rd Place (Right on Desktop, 3rd on Mobile) */}
                {third && (
                    <PodiumCard
                        entry={third}
                        position={3}
                        accentBg="bg-[#E5B88C]"
                        shadowClass="shadow-[5px_5px_0px_#000]"
                        heightClass="md:min-h-[460px]"
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
    accentBg: string;
    shadowClass: string;
    heightClass: string;
    isFirst?: boolean;
    scope?: "global" | "college";
}

const PodiumCard: React.FC<PodiumCardProps> = ({
    entry,
    position,
    accentBg,
    shadowClass,
    heightClass,
    isFirst = false,
    scope: _scope = "global",
}) => {
    const initials = (entry.displayName || entry.username)
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();

    const college = entry.college || "—";

    return (
        <div
            className={`w-full rounded-2xl border-2 border-black bg-white ${shadowClass} flex flex-col justify-between relative transition-all duration-200 hover:-translate-y-1 ${heightClass} ${
                isFirst ? "order-1 md:order-2" : position === 2 ? "order-2 md:order-1" : "order-3 md:order-3"
            }`}
        >
            {/* 1st Place: Prominent Centered Crown perched on the top edge */}
            {isFirst && (
                <div className="absolute -top-5 sm:-top-5.5 left-1/2 -translate-x-1/2 z-20">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#FFE566] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                        <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-black stroke-[2.4]" />
                    </div>
                </div>
            )}

            {/* Main Card Content */}
            <div className={`p-5 sm:p-6 flex flex-col justify-between flex-1 ${isFirst ? "pt-7 sm:pt-8" : "pt-6 sm:pt-7"}`}>
                {/* Avatar Section with Double Ring */}
                <div className="flex flex-col items-center text-center space-y-3">
                    <div className="relative">
                        <div
                            className={`p-1 rounded-full border-2 border-black shadow-[3px_3px_0px_#000] ${
                                isFirst
                                    ? "bg-[#FFE566]"
                                    : position === 2
                                    ? "bg-[#E2E8F0]"
                                    : "bg-[#E5B88C]"
                            }`}
                        >
                            {entry.avatarUrl ? (
                                <EnlargeableAvatar
                                    src={entry.avatarUrl}
                                    alt={entry.displayName}
                                    displayName={entry.displayName}
                                    username={entry.username}
                                    className={`block rounded-full object-cover object-center overflow-hidden shrink-0 border-2 border-black ${
                                        isFirst
                                            ? "w-20 h-20"
                                            : "w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20"
                                    }`}
                                />
                            ) : (
                                <div
                                    className={`rounded-full bg-[#a2ff86] border-2 border-black flex items-center justify-center shrink-0 font-black text-xl text-black ${
                                        isFirst
                                            ? "w-20 h-20"
                                            : "w-[4.5rem] h-[4.5rem] sm:w-20 sm:h-20"
                                    }`}
                                >
                                    {initials}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* User Identity: Name, Verified Badge, Handle & College */}
                    <div className="space-y-1 w-full px-1">
                        <div className="flex items-center justify-center gap-1.5 min-w-0">
                            <Link
                                to={`/profile/u/${encodeURIComponent(entry.username)}`}
                                className="text-base sm:text-lg font-black text-black hover:underline tracking-tight truncate max-w-[190px] sm:max-w-[220px]"
                                title={entry.displayName}
                            >
                                {entry.displayName}
                            </Link>
                            {entry.scoreBreakdown?.demoFixture === true && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-black text-black">Demo</span>
                            )}
                            {entry.isVerified && entry.scoreBreakdown?.demoFixture !== true && (
                                <span title="Verified Coder" className="inline-flex items-center">
                                    <CheckCircle2
                                        className="w-4 h-4 text-sky-500 fill-sky-500/20 shrink-0"
                                        strokeWidth={2.5}
                                    />
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-mono font-bold text-neutral-500 truncate">
                            @{entry.username}
                        </p>
                        {college && college !== "—" && (
                            <div className="pt-0.5 flex justify-center">
                                <span
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF6EE] border border-black/15 text-[11px] font-semibold text-neutral-700 max-w-full"
                                    title={college}
                                >
                                    <Building2 className="w-3 h-3 text-neutral-500 shrink-0" />
                                    <span className="truncate max-w-[180px] sm:max-w-[210px]">{college}</span>
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Score Section */}
                <div className="text-center my-3 sm:my-4">
                    <div className="flex items-baseline justify-center gap-1.5">
                        <span className="text-3xl sm:text-4xl font-mono font-black text-black tracking-tight leading-none">
                            {entry.score.toLocaleString()}
                        </span>
                        <span className="text-xs font-black uppercase text-neutral-500 tracking-wider">
                            points
                        </span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-neutral-400 tracking-wider block mt-1">
                        Orbix Score
                    </span>
                </div>

                {/* 3-Column Stats: Solved | Contests | Streak */}
                <div className="w-full bg-[#FAF6EE] rounded-xl border-2 border-black/15 shadow-[1px_1px_0px_#000] grid grid-cols-3 divide-x-2 divide-black/10 text-center py-2.5 px-1 mt-auto">
                    {/* Solved */}
                    <div className="flex flex-col items-center justify-center px-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase text-neutral-500 block tracking-wider mb-0.5">
                            Solved
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-black text-black">
                            {entry.totalSolved.toLocaleString()}
                        </span>
                    </div>

                    {/* Contests */}
                    <div className="flex flex-col items-center justify-center px-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase text-neutral-500 block tracking-wider mb-0.5">
                            Contests
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-black text-black">
                            {entry.totalContests}
                        </span>
                    </div>

                    {/* Streak (Matching below rating chart) */}
                    <div className="flex flex-col items-center justify-center px-1">
                        <span className="text-[9px] sm:text-[10px] font-black uppercase text-neutral-500 block tracking-wider mb-0.5">
                            Streak
                        </span>
                        <span className="text-xs sm:text-sm font-mono font-black text-black inline-flex items-center justify-center gap-1">
                            {entry.streak > 0 ? (
                                <>
                                    <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                                    <span>{entry.streak}d</span>
                                </>
                            ) : (
                                <span className="text-neutral-400 font-mono">—</span>
                            )}
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Pedestal Banner: 1st / 2nd / 3rd */}
            <div
                className={`w-full text-center border-t-2 border-black ${accentBg} rounded-b-[14px] ${
                    isFirst ? "py-3.5 sm:py-4" : position === 2 ? "py-3 sm:py-3.5" : "py-2.5 sm:py-3"
                }`}
            >
                <span
                    className={`font-black text-black font-mono tracking-tight ${
                        isFirst ? "text-xl sm:text-2xl" : "text-lg sm:text-xl"
                    }`}
                >
                    {position === 1 ? (
                        <>
                            1<sup className="text-xs sm:text-sm font-black">st</sup>
                        </>
                    ) : position === 2 ? (
                        <>
                            2<sup className="text-xs sm:text-sm font-black">nd</sup>
                        </>
                    ) : (
                        <>
                            3<sup className="text-xs sm:text-sm font-black">rd</sup>
                        </>
                    )}
                </span>
            </div>
        </div>
    );
};
