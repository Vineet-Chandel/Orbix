import React from "react";
import { getPortalIcon } from "../../../utils/portalIcons";
import { OrbixCardQR } from "./OrbixCardQR";
import type { CardThemeConfig } from "./types";
import type { AggregatedCodingStats, CoderTypeBadge, GitHubCardStats, RankedPlatform } from "../../../utils/cardStatsAggregator";

interface LinkedInCardProps {
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

export const LinkedInCard: React.FC<LinkedInCardProps> = ({
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
            className="relative w-[1200px] h-[627px] bg-[#0c1017] text-white overflow-hidden rounded-[28px] border border-neutral-800/90 shadow-2xl flex flex-col justify-between font-sans select-none flex-shrink-0"
            style={{
                boxShadow: `0 25px 60px -15px rgba(0, 0, 0, 0.7), 0 0 40px -10px ${theme.borderGlow}`,
            }}
        >
            {face === "front" ? (
                /* ==================== FRONT FACE ==================== */
                <>
                    {/* Top Accent Textured Banner */}
                    <div className={`relative h-[130px] w-full bg-gradient-to-r ${theme.bannerGradient} px-8 pt-5 flex items-start justify-between overflow-hidden flex-shrink-0`}>
                        {/* Dot Pattern Watermark */}
                        <div
                            className="absolute inset-0 opacity-20 pointer-events-none"
                            style={{
                                backgroundImage: `radial-gradient(${theme.bannerPatternColor} 1.5px, transparent 1.5px)`,
                                backgroundSize: "14px 14px",
                            }}
                        />

                        {/* Top Left: Orbix Brand Star + Wordmark */}
                        <div className="relative z-10 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black/90 border border-white/20 flex items-center justify-center p-2 shadow-lg backdrop-blur-md">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-xl font-black text-black tracking-tight leading-none block">
                                    Orbix
                                </span>
                                <span className="text-[11px] font-bold text-black/70 tracking-wider uppercase">
                                    Profile Card
                                </span>
                            </div>
                        </div>

                        {/* Top Right: Verified Badge */}
                        <div className="relative z-10 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-md">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-bold tracking-wider uppercase">Verified Developer</span>
                        </div>
                    </div>

                    {/* Middle Content Section */}
                    <div className="px-9 flex-1 flex flex-col justify-between -mt-12 relative z-20 pb-4">
                        {/* Avatar & Identity Header Row */}
                        <div className="flex items-end justify-between gap-6">
                            <div className="flex items-end gap-5">
                                {/* Profile Avatar */}
                                <div className="relative flex-shrink-0">
                                    <div
                                        className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-white/30 to-black/80 shadow-2xl"
                                        style={{ boxShadow: `0 0 25px ${theme.borderGlow}` }}
                                    >
                                        {avatarSrc ? (
                                            <img
                                                src={avatarSrc}
                                                alt={displayName}
                                                className="w-full h-full rounded-full object-cover border-2 border-[#0c1017] bg-[#161b22]"
                                                crossOrigin="anonymous"
                                            />
                                        ) : (
                                            <div className="w-full h-full rounded-full bg-neutral-900 border-2 border-[#0c1017] flex items-center justify-center font-black text-2xl text-white">
                                                {displayName.slice(0, 2).toUpperCase()}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Names */}
                                <div className="mb-1">
                                    <h1 className="text-2xl font-black text-white tracking-tight uppercase leading-tight">
                                        {displayName}
                                    </h1>
                                    <p className="text-sm font-mono font-medium text-neutral-400">
                                        @{username}
                                    </p>
                                </div>
                            </div>

                            {/* Difficulty Breakdown Pill Row (Cyan, Yellow, Red) */}
                            <div className="flex items-center gap-3 bg-[#161b22]/90 border border-neutral-800/80 px-4 py-2 rounded-2xl shadow-inner mb-1">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                                    <span className="text-xs font-bold text-neutral-300">Easy</span>
                                    <span className="text-sm font-black text-white ml-0.5">{stats.easy}</span>
                                </div>
                                <span className="text-neutral-700">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600] shadow-[0_0_8px_#FFD600]" />
                                    <span className="text-xs font-bold text-neutral-300">Medium</span>
                                    <span className="text-sm font-black text-white ml-0.5">{stats.medium}</span>
                                </div>
                                <span className="text-neutral-700">|</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF383C] shadow-[0_0_8px_#FF383C]" />
                                    <span className="text-xs font-bold text-neutral-300">Hard</span>
                                    <span className="text-sm font-black text-white ml-0.5">{stats.hard}</span>
                                </div>
                            </div>
                        </div>

                        {/* Two Columns Dashboard Content */}
                        <div className="grid grid-cols-12 gap-5 mt-4">
                            {/* Left Column (7 cols): Coder Type + 4 Stats Tiles */}
                            <div className="col-span-7 flex flex-col justify-between space-y-3.5">
                                {/* Coder Type Card (Inspiration: Reference 2) */}
                                <div className="rounded-2xl bg-[#161d26] border border-neutral-800/90 p-4 flex items-center gap-4 shadow-sm">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-black"
                                        style={{ backgroundColor: coderType.badgeColor }}
                                    >
                                        <svg className="w-6 h-6 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black tracking-widest uppercase text-amber-400 block">
                                            CODER TYPE
                                        </span>
                                        <h3 className="text-lg font-black text-white tracking-tight leading-snug truncate">
                                            {coderType.title}
                                        </h3>
                                        <p className="text-xs text-neutral-400 truncate">
                                            {user?.headline || coderType.tagline}
                                        </p>
                                    </div>
                                </div>

                                {/* 4 Key Stats Row */}
                                <div className="grid grid-cols-4 gap-2.5">
                                    {/* Total Solved */}
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800/80 p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-xl font-black text-white tracking-tight">
                                            {stats.totalSolved}
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 mt-0.5">
                                            <svg className="w-3 h-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                            <span>Solved</span>
                                        </div>
                                    </div>

                                    {/* Active Days */}
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800/80 p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-xl font-black text-white tracking-tight">
                                            {stats.activeDays}
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 mt-0.5">
                                            <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                <line x1="16" y1="2" x2="16" y2="6" />
                                                <line x1="8" y1="2" x2="8" y2="6" />
                                                <line x1="3" y1="10" x2="21" y2="10" />
                                            </svg>
                                            <span>Active days</span>
                                        </div>
                                    </div>

                                    {/* Contests */}
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800/80 p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-xl font-black text-white tracking-tight">
                                            {stats.contests}
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 mt-0.5">
                                            <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h2m12 7h2a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2h-2M9 22h6m-3-4v4" />
                                            </svg>
                                            <span>Contests</span>
                                        </div>
                                    </div>

                                    {/* Day Streak */}
                                    <div className="rounded-2xl bg-[#161b22] border border-neutral-800/80 p-3 flex flex-col items-center justify-center text-center">
                                        <span className="text-xl font-black text-white tracking-tight">
                                            {stats.dayStreak}
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400 mt-0.5">
                                            <svg className="w-3 h-3 text-rose-500" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.527.82-1.11 2.05-1.11 3.942 0 .546-.07 1.055-.2 1.543a6.002 6.002 0 01-1.39-1.077 1 1 0 00-1.636.852 6.002 6.002 0 003.58 5.617c.2.09.41.168.63.232a5.998 5.998 0 006.386-2.58 6 6 0 00.32-3.805 1 1 0 00-1.288-.636 4.978 4.978 0 01-1.62.268c-.73 0-1.417-.184-2.02-.51a1 1 0 01-.48-.795c-.066-.694.062-1.393.28-2.055.22-.667.57-1.306.87-1.922a1 1 0 00-.17-1.166zM7.36 12.025a4.004 4.004 0 003.64 2.97 4 4 0 003.95-3.376 4.003 4.003 0 00-.73-2.619 4.004 4.004 0 00-2.31 1.765 1 1 0 01-1.55.15 4.002 4.002 0 00-3 1.11z" clipRule="evenodd" />
                                            </svg>
                                            <span>Day streak</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (5 cols): Top 3 Platforms + Optional GitHub Stats */}
                            <div className="col-span-5 flex flex-col justify-between space-y-2">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between text-xs font-bold text-neutral-400 px-1">
                                        <span className="uppercase tracking-wider text-[10px]">Top Coding Accounts</span>
                                        <span className="text-[10px] text-neutral-500 font-mono">
                                            {topPlatforms.length} connected
                                        </span>
                                    </div>

                                    {topPlatforms.length === 0 ? (
                                        <div className="rounded-2xl bg-[#161b22] border border-neutral-800/80 p-4 text-center">
                                            <p className="text-xs text-neutral-400">No coding platforms connected.</p>
                                        </div>
                                    ) : (
                                        topPlatforms.slice(0, 3).map((plat) => (
                                            <div
                                                key={plat.id}
                                                className="rounded-xl bg-[#161b22] border border-neutral-800/90 px-3.5 py-2 flex items-center justify-between gap-3 shadow-2xs"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div className="w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 flex items-center justify-center flex-shrink-0 p-1">
                                                        {getPortalIcon(plat.id, "w-4 h-4")}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <h4 className="text-xs font-bold text-white leading-none truncate">
                                                            {plat.name}
                                                        </h4>
                                                        <span className="text-[10px] font-mono text-neutral-400 truncate block mt-0.5">
                                                            @{plat.username}
                                                        </span>
                                                    </div>
                                                </div>

                                                <span className="text-[11px] font-mono font-bold text-white bg-neutral-900/90 border border-neutral-700/80 px-2 py-0.5 rounded-md">
                                                    {plat.solvedCount} solved
                                                </span>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* GitHub Stats Block if toggled on */}
                                {includeGitHub && githubStats.connected && (
                                    <div className="rounded-xl bg-[#161b22] border border-neutral-800 p-2.5 flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-7 h-7 rounded-lg bg-black border border-neutral-700 flex items-center justify-center flex-shrink-0 text-white">
                                                {getPortalIcon("github", "w-4 h-4")}
                                            </div>
                                            <div>
                                                <span className="text-xs font-bold text-white block leading-none">GitHub</span>
                                                <span className="text-[10px] font-mono text-neutral-400">@{githubStats.username}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 text-right">
                                            <div>
                                                <span className="text-xs font-black text-white block leading-tight">{githubStats.publicRepos}</span>
                                                <span className="text-[9px] text-neutral-400 uppercase font-bold">Repos</span>
                                            </div>
                                            <div>
                                                <span className="text-xs font-black text-white block leading-tight">{githubStats.contributionsOrCommits}</span>
                                                <span className="text-[9px] text-neutral-400 uppercase font-bold">Commits</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Status Bar */}
                    <div className="h-10 bg-[#070a0e] border-t border-neutral-800/80 px-9 flex items-center justify-between text-xs text-neutral-400 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-neutral-300 truncate max-w-md">
                                🔗 {displayUrl}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="font-semibold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            ) : (
                /* ==================== BACK FACE ==================== */
                <>
                    {/* Top Header */}
                    <div className="h-[100px] w-full px-9 pt-6 flex items-center justify-between border-b border-neutral-800/80 bg-[#0e131b]">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center p-2 shadow-md">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-xl font-black text-white tracking-tight leading-none block">Orbix</span>
                                <span className="text-[11px] font-bold text-neutral-400 tracking-wider uppercase">Scan To Explore</span>
                            </div>
                        </div>

                        {/* Top Right: Gold SCAN ME Capsule Badge */}
                        <div
                            className="px-5 py-2 rounded-full font-black text-xs uppercase tracking-wider text-black shadow-md flex items-center gap-1.5"
                            style={{ backgroundColor: theme.accentColor }}
                        >
                            <span>SCAN ME</span>
                        </div>
                    </div>

                    {/* Middle Section: QR Code Left + Find Me On Right */}
                    <div className="px-12 py-6 flex-1 flex items-center justify-between gap-12">
                        {/* Left: Scannable QR Code */}
                        <div className="flex flex-col items-center gap-3">
                            <OrbixCardQR value={publicProfileUrl} size={250} showLogo={true} />
                            <div className="text-center">
                                <h3 className="text-base font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h3>
                                <p className="text-xs text-neutral-400">
                                    Scan to open my live coding profile
                                </p>
                            </div>
                        </div>

                        {/* Right: Find Me On Platform List */}
                        <div className="flex-1 space-y-4 max-w-md">
                            <div>
                                <span className="text-xs font-black tracking-widest uppercase text-neutral-400 block mb-3">
                                    FIND ME ON
                                </span>
                                <div className="space-y-3">
                                    {topPlatforms.slice(0, 3).map((plat) => (
                                        <div
                                            key={plat.id}
                                            className="rounded-2xl bg-[#161b22] border border-neutral-800 p-3.5 flex items-center justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2">
                                                    {getPortalIcon(plat.id, "w-5 h-5")}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-white">
                                                        {plat.name}
                                                    </h4>
                                                    <span className="text-xs font-mono text-neutral-400">
                                                        @{plat.username}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-neutral-300 bg-neutral-800/80 px-2.5 py-1 rounded-lg">
                                                {plat.solvedCount} solved
                                            </span>
                                        </div>
                                    ))}

                                    {includeGitHub && githubStats.connected && (
                                        <div className="rounded-2xl bg-[#161b22] border border-neutral-800 p-3.5 flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-center p-2 text-white">
                                                    {getPortalIcon("github", "w-5 h-5")}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-white">GitHub</h4>
                                                    <span className="text-xs font-mono text-neutral-400">@{githubStats.username}</span>
                                                </div>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-neutral-300 bg-neutral-800/80 px-2.5 py-1 rounded-lg">
                                                {githubStats.publicRepos} repos
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="h-10 bg-[#070a0e] border-t border-neutral-800/80 px-9 flex items-center justify-between text-xs text-neutral-400 flex-shrink-0">
                        <span className="font-mono text-neutral-300 truncate max-w-md">
                            🔗 {displayUrl}
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                            <span className="font-semibold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            )}

            {/* Interactive Flip Action Button (Supplied Reference Floating Button) */}
            {showFlipButton && onFlip && (
                <button
                    type="button"
                    onClick={onFlip}
                    className="absolute bottom-14 right-8 z-30 inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-wider text-black shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer border-2 border-black/40"
                    style={{ backgroundColor: theme.accentColor }}
                    title={`Flip to ${face === "front" ? "Back" : "Front"}`}
                >
                    <svg className="w-4 h-4 text-black animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>{face === "front" ? "Flip" : "Front"}</span>
                </button>
            )}
        </div>
    );
};
