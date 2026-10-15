import React from "react";
import { getPortalIcon } from "../../../utils/portalIcons";
import { OrbixCardQR } from "./OrbixCardQR";
import type { CardThemeConfig } from "./types";
import type { AggregatedCodingStats, CoderTypeBadge, GitHubCardStats, RankedPlatform } from "../../../utils/cardStatsAggregator";

interface InstagramStoryCardProps {
    user: any;
    stats: AggregatedCodingStats;
    coderType: CoderTypeBadge;
    topPlatforms: RankedPlatform[];
    githubStats: GitHubCardStats;
    includeGitHub: boolean;
    theme: CardThemeConfig;
    face: "front" | "back";
    publicProfileUrl: string;
    onFlip?: () => void;
    showFlipButton?: boolean;
    cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const InstagramStoryCard: React.FC<InstagramStoryCardProps> = ({
    user,
    stats,
    coderType,
    topPlatforms,
    githubStats,
    includeGitHub,
    theme,
    face,
    publicProfileUrl,
    onFlip,
    showFlipButton = true,
    cardRef,
}) => {
    const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "Developer";
    const username = user?.username || "developer";
    const avatarSrc = user?.photoUrl || user?.avatarUrl;

    const todayDate = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    const displayUrl = publicProfileUrl.replace(/^https?:\/\//, "");

    return (
        <div
            ref={cardRef}
            className="relative w-[1080px] h-[1920px] bg-[#0c1017] text-white overflow-hidden rounded-[40px] border border-neutral-800/90 shadow-2xl flex flex-col justify-between font-sans select-none flex-shrink-0"
            style={{
                boxShadow: `0 35px 80px -20px rgba(0, 0, 0, 0.8), 0 0 50px -15px ${theme.borderGlow}`,
            }}
        >
            {face === "front" ? (
                /* ==================== INSTAGRAM FRONT FACE ==================== */
                <>
                    {/* Top Textured Accent Banner with Safe Margin */}
                    <div className={`relative h-[340px] w-full bg-gradient-to-r ${theme.bannerGradient} px-14 pt-16 flex items-start justify-between overflow-hidden flex-shrink-0`}>
                        {/* Dot Pattern Watermark */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: `radial-gradient(${theme.bannerPatternColor} 2px, transparent 2px)`,
                                backgroundSize: "20px 20px",
                            }}
                        />

                        {/* Top Left: Orbix Brand Star + Wordmark */}
                        <div className="relative z-10 flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-black/90 border border-white/20 flex items-center justify-center p-3 shadow-xl backdrop-blur-md">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-3xl font-black text-black tracking-tight leading-none block">
                                    Orbix
                                </span>
                                <span className="text-sm font-bold text-black/70 tracking-widest uppercase">
                                    Developer Story Card
                                </span>
                            </div>
                        </div>

                        {/* Top Right: Verified Badge */}
                        <div className="relative z-10 flex items-center gap-2.5 px-5 py-2.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-md">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-sm font-bold tracking-wider uppercase">Verified</span>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="px-14 flex-1 flex flex-col justify-between -mt-24 relative z-20 pb-16 space-y-8">
                        {/* Avatar & User Details */}
                        <div className="flex flex-col items-center text-center space-y-4">
                            <div
                                className="w-40 h-40 rounded-full p-1.5 bg-gradient-to-br from-white/30 to-black/80 shadow-2xl"
                                style={{ boxShadow: `0 0 35px ${theme.borderGlow}` }}
                            >
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt={displayName}
                                        className="w-full h-full rounded-full object-cover border-4 border-[#0c1017] bg-[#161b22]"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-neutral-900 border-4 border-[#0c1017] flex items-center justify-center font-black text-5xl text-white">
                                        {displayName.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div>
                                <h1 className="text-4xl font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h1>
                                <p className="text-xl font-mono text-neutral-400 mt-1">
                                    @{username}
                                </p>
                            </div>

                            {/* Difficulty Badges */}
                            <div className="flex items-center gap-4 bg-[#161b22] border border-neutral-800 px-6 py-3 rounded-2xl shadow-inner">
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-[#00E5FF] shadow-[0_0_10px_#00E5FF]" />
                                    <span className="text-base font-bold text-neutral-300">Easy</span>
                                    <span className="text-xl font-black text-white ml-1">{stats.easy}</span>
                                </div>
                                <span className="text-neutral-700">|</span>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-[#FFD600] shadow-[0_0_10px_#FFD600]" />
                                    <span className="text-base font-bold text-neutral-300">Med</span>
                                    <span className="text-xl font-black text-white ml-1">{stats.medium}</span>
                                </div>
                                <span className="text-neutral-700">|</span>
                                <div className="flex items-center gap-2">
                                    <span className="w-3 h-3 rounded-full bg-[#FF383C] shadow-[0_0_10px_#FF383C]" />
                                    <span className="text-base font-bold text-neutral-300">Hard</span>
                                    <span className="text-xl font-black text-white ml-1">{stats.hard}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coder Type Card */}
                        <div className="rounded-3xl bg-[#161d26] border border-neutral-800 p-6 flex items-center gap-6 shadow-md">
                            <div
                                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-black font-black"
                                style={{ backgroundColor: coderType.badgeColor }}
                            >
                                <svg className="w-8 h-8 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-xs font-black tracking-widest uppercase text-amber-400 block mb-1">
                                    CODER TYPE
                                </span>
                                <h3 className="text-2xl font-black text-white tracking-tight leading-tight">
                                    {coderType.title}
                                </h3>
                                <p className="text-base text-neutral-400 mt-0.5">
                                    {user?.headline || coderType.tagline}
                                </p>
                            </div>
                        </div>

                        {/* 4 Stats Grid */}
                        <div className="grid grid-cols-4 gap-4">
                            <div className="rounded-3xl bg-[#161b22] border border-neutral-800 p-5 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black text-white">{stats.totalSolved}</span>
                                <span className="text-xs font-bold text-neutral-400 mt-1 uppercase">Solved</span>
                            </div>
                            <div className="rounded-3xl bg-[#161b22] border border-neutral-800 p-5 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black text-white">{stats.activeDays}</span>
                                <span className="text-xs font-bold text-neutral-400 mt-1 uppercase">Active Days</span>
                            </div>
                            <div className="rounded-3xl bg-[#161b22] border border-neutral-800 p-5 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black text-white">{stats.contests}</span>
                                <span className="text-xs font-bold text-neutral-400 mt-1 uppercase">Contests</span>
                            </div>
                            <div className="rounded-3xl bg-[#161b22] border border-neutral-800 p-5 flex flex-col items-center justify-center text-center">
                                <span className="text-3xl font-black text-white">{stats.dayStreak}d</span>
                                <span className="text-xs font-bold text-neutral-400 mt-1 uppercase">Streak</span>
                            </div>
                        </div>

                        {/* Top 5 Connected Platforms List */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm font-bold text-neutral-400 px-2">
                                <span className="uppercase tracking-wider text-xs">Top Coding Accounts</span>
                                <span className="text-xs font-mono">{topPlatforms.length} connected</span>
                            </div>

                            <div className="space-y-3">
                                {topPlatforms.slice(0, 5).map((plat) => (
                                    <div
                                        key={plat.id}
                                        className="rounded-2xl bg-[#161b22] border border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2 flex-shrink-0">
                                                {getPortalIcon(plat.id, "w-6 h-6")}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-white">{plat.name}</h4>
                                                <span className="text-sm font-mono text-neutral-400">@{plat.username}</span>
                                            </div>
                                        </div>
                                        <span className="text-base font-mono font-black text-white bg-neutral-900 border border-neutral-700 px-3.5 py-1.5 rounded-xl">
                                            {plat.solvedCount} solved
                                        </span>
                                    </div>
                                ))}

                                {includeGitHub && githubStats.connected && (
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800 px-6 py-4 flex items-center justify-between shadow-sm">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-black border border-neutral-700 flex items-center justify-center p-2 text-white">
                                                {getPortalIcon("github", "w-6 h-6")}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-black text-white">GitHub</h4>
                                                <span className="text-sm font-mono text-neutral-400">@{githubStats.username}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-right">
                                            <div>
                                                <span className="text-lg font-black text-white block">{githubStats.publicRepos}</span>
                                                <span className="text-xs text-neutral-400 uppercase font-bold">Repos</span>
                                            </div>
                                            <div>
                                                <span className="text-lg font-black text-white block">{githubStats.contributionsOrCommits}</span>
                                                <span className="text-xs text-neutral-400 uppercase font-bold">Commits</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Status Bar with Safe Margin */}
                    <div className="h-16 bg-[#070a0e] border-t border-neutral-800/80 px-14 flex items-center justify-between text-sm text-neutral-400 flex-shrink-0">
                        <span className="font-mono text-neutral-300">
                            🔗 {displayUrl}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            ) : (
                /* ==================== INSTAGRAM BACK FACE ==================== */
                <>
                    {/* Top Header */}
                    <div className="h-[200px] w-full px-14 pt-16 flex items-center justify-between border-b border-neutral-800/80 bg-[#0e131b]">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-2xl bg-black border border-white/20 flex items-center justify-center p-3 shadow-md">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-3xl font-black text-white tracking-tight leading-none block">Orbix</span>
                                <span className="text-xs font-bold text-neutral-400 tracking-widest uppercase">Scan To Explore</span>
                            </div>
                        </div>

                        <div
                            className="px-6 py-2.5 rounded-full font-black text-sm uppercase tracking-wider text-black shadow-md"
                            style={{ backgroundColor: theme.accentColor }}
                        >
                            SCAN TO EXPLORE
                        </div>
                    </div>

                    {/* Centered QR & Platform Showcase */}
                    <div className="px-16 flex-1 flex flex-col items-center justify-center space-y-10 py-12">
                        {/* Prominent Center QR Code */}
                        <div className="flex flex-col items-center gap-6">
                            <OrbixCardQR value={publicProfileUrl} size={380} showLogo={true} />
                            <div className="text-center">
                                <h3 className="text-3xl font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h3>
                                <p className="text-base text-neutral-400 mt-1">
                                    Scan with your camera to open my live coding profile
                                </p>
                            </div>
                        </div>

                        {/* Top 5 Connected Platforms */}
                        <div className="w-full space-y-4">
                            <span className="text-xs font-black tracking-widest uppercase text-neutral-400 block text-center">
                                FIND ME ON THESE PLATFORMS
                            </span>
                            <div className="space-y-3 max-w-xl mx-auto">
                                {topPlatforms.slice(0, 5).map((plat) => (
                                    <div
                                        key={plat.id}
                                        className="rounded-2xl bg-[#161b22] border border-neutral-800 p-4 flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2.5">
                                                {getPortalIcon(plat.id, "w-6 h-6")}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-extrabold text-white">{plat.name}</h4>
                                                <span className="text-sm font-mono text-neutral-400">@{plat.username}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-mono font-bold text-neutral-300 bg-neutral-800 px-3 py-1 rounded-lg">
                                            {plat.solvedCount} solved
                                        </span>
                                    </div>
                                ))}

                                {includeGitHub && githubStats.connected && (
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800 p-4 flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2.5 text-white">
                                                {getPortalIcon("github", "w-6 h-6")}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-extrabold text-white">GitHub</h4>
                                                <span className="text-sm font-mono text-neutral-400">@{githubStats.username}</span>
                                            </div>
                                        </div>
                                        <span className="text-sm font-mono font-bold text-neutral-300 bg-neutral-800 px-3 py-1 rounded-lg">
                                            {githubStats.publicRepos} repos
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="h-16 bg-[#070a0e] border-t border-neutral-800/80 px-14 flex items-center justify-between text-sm text-neutral-400 flex-shrink-0">
                        <span className="font-mono text-neutral-300">
                            🔗 {displayUrl}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                            <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            )}

            {/* Interactive Flip Action Button */}
            {showFlipButton && onFlip && (
                <button
                    type="button"
                    onClick={onFlip}
                    className="absolute bottom-24 right-14 z-30 inline-flex items-center gap-2.5 px-7 py-3.5 rounded-full font-black text-sm uppercase tracking-wider text-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-black/40"
                    style={{ backgroundColor: theme.accentColor }}
                    title={`Flip to ${face === "front" ? "Back" : "Front"}`}
                >
                    <svg className="w-5 h-5 text-black animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{face === "front" ? "Flip" : "Front"}</span>
                </button>
            )}
        </div>
    );
};
