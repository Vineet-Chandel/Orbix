import React from "react";
import { FolderGit2, GitCommit } from "lucide-react";
import { getPortalIcon } from "../../../utils/portalIcons";
import { OrbixCardQR } from "./OrbixCardQR";
import { CardBannerSVG } from "./CardBannerSVG";
import { GitHubContributionTable } from "./GitHubContributionTable";
import type { CardThemeConfig } from "./types";
import type {
    AggregatedCodingStats,
    CoderTypeBadge,
    GitHubCardStats,
    RankedPlatform,
    ConnectedPlatformBadge,
} from "../../../utils/cardStatsAggregator";

interface InstagramStoryCardProps {
    user: any;
    stats: AggregatedCodingStats;
    coderType: CoderTypeBadge;
    topPlatforms: RankedPlatform[];
    allConnectedPlatforms?: ConnectedPlatformBadge[];
    githubStats: GitHubCardStats;
    includeGitHub: boolean;
    theme: CardThemeConfig;
    face: "front" | "back";
    publicProfileUrl: string;
    cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const InstagramStoryCard: React.FC<InstagramStoryCardProps> = ({
    user,
    stats,
    coderType,
    topPlatforms,
    allConnectedPlatforms,
    githubStats,
    includeGitHub,
    theme,
    face,
    publicProfileUrl,
    cardRef,
}) => {
    const displayName = `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || user?.username || "Developer";
    const username = user?.username || "developer";
    const avatarSrc = user?.photoUrl || user?.avatarUrl;
    const tagline = user?.headline || coderType.tagline || "Software Engineer & Builder";

    const connectedList: ConnectedPlatformBadge[] = (allConnectedPlatforms && allConnectedPlatforms.length > 0)
        ? allConnectedPlatforms
        : topPlatforms.map((p) => ({
            id: p.id,
            name: p.name,
            username: p.username,
            profileUrl: p.profileUrl,
            brandColor: p.brandColor,
            solvedCount: p.solvedCount,
            isVerified: p.isVerified,
        }));

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
                    <div
                        className={`relative h-[400px] w-full px-14 pt-16 flex items-start justify-between overflow-hidden flex-shrink-0 ${theme.id === "gold" ? "bg-[#ffc629]" : `bg-gradient-to-r ${theme.bannerGradient}`
                            }`}
                        style={{
                            backgroundColor: theme.id === "gold" ? "#ffc629" : undefined,
                        }}
                    >
                        {/* Attached Full Width & Height Banner SVG with overflow-y hidden and relaxed height */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ overflowY: "hidden" }}>
                            <CardBannerSVG
                                idPrefix="ig-front"
                                color={theme.id === "gold" ? "#f0b100" : (theme.bannerPatternColor || "rgba(255,255,255,0.22)")}
                                className="w-full h-[120%] -top-[10%] relative"
                                preserveAspectRatio="none"
                                style={{
                                    overflow: "hidden",
                                    overflowY: "hidden",
                                }}
                            />
                        </div>

                        {/* Top Left: Orbix Brand Star + Wordmark */}
                        <div className="relative z-10 flex items-center gap-5">
                            <div className="w-18 h-18 rounded-3xl bg-black/90 border border-white/20 flex items-center justify-center p-3.5 shadow-2xl backdrop-blur-md">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-4xl font-black text-black tracking-tight leading-none block">
                                    Orbix
                                </span>
                                <span className="text-base font-extrabold text-black/75 tracking-widest uppercase mt-1 block">
                                    Developer Story Card
                                </span>
                            </div>
                        </div>

                        {/* Top Right: Verified Badge */}
                        <div className="relative z-10 flex items-center gap-3 px-6 py-3 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-xl">
                            <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-base font-black tracking-wider uppercase">Verified</span>
                        </div>
                    </div>

                    {/* Main Content Area - Beautifully Proportioned to Fill Story Height */}
                    <div className="px-14 flex-1 flex flex-col justify-around -mt-24 relative z-20 pb-8 space-y-6">
                        {/* Avatar & User Details */}
                        <div className="flex flex-col items-center text-center">
                            <div
                                className="w-44 h-44 rounded-full p-2 bg-gradient-to-br from-white/40 via-white/10 to-black/90 shadow-2xl ring-8 ring-[#0c1017]"
                                style={{ boxShadow: `0 0 45px ${theme.borderGlow}` }}
                            >
                                {avatarSrc ? (
                                    <img
                                        src={avatarSrc}
                                        alt={displayName}
                                        className="w-full h-full rounded-full object-cover border-4 border-[#0c1017] bg-[#161b22]"
                                        crossOrigin="anonymous"
                                    />
                                ) : (
                                    <div className="w-full h-full rounded-full bg-neutral-900 border-4 border-[#0c1017] flex items-center justify-center font-black text-6xl text-white">
                                        {displayName.slice(0, 2).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div className="mt-4">
                                <h1 className="text-5xl font-black text-white tracking-tight flex items-center justify-center gap-3.5">
                                    <span>{displayName}</span>
                                    {/* Verified Badge Icon (Matching Image 1) */}
                                    <div className="w-9 h-9 flex items-center justify-center text-[#1D9BF0] flex-shrink-0" title="Verified Developer">
                                        <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                                            <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.67-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.33 2.33 4.99-4.99 1.42 1.42-6.41 6.4z" />
                                        </svg>
                                    </div>
                                </h1>
                                <div className="flex items-center justify-center gap-3 text-2xl font-medium text-neutral-300 mt-2">
                                    <span className="text-neutral-200 font-medium truncate max-w-[650px]">
                                        {tagline}
                                    </span>
                                    <span className="text-neutral-500 font-bold">·</span>
                                    <span className="font-mono text-neutral-400">
                                        @{username}
                                    </span>
                                </div>
                            </div>

                            {/* Difficulty Badges (Easy / Medium / Hard) - Wide Glassmorphic Banner */}
                            <div className="flex items-center gap-10 bg-[#131924]/90 border border-white/10 px-10 py-5 rounded-3xl shadow-xl mt-5">
                                <div className="flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full bg-[#00E5FF] shadow-[0_0_12px_#00E5FF]" />
                                    <span className="text-lg font-bold text-neutral-300">Easy</span>
                                    <span className="text-3xl font-black text-white font-mono ml-1">{stats.easy.toLocaleString()}</span>
                                </div>
                                <span className="text-neutral-600 font-light text-xl">|</span>
                                <div className="flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full bg-[#FFD600] shadow-[0_0_12px_#FFD600]" />
                                    <span className="text-lg font-bold text-neutral-300">Medium</span>
                                    <span className="text-3xl font-black text-white font-mono ml-1">{stats.medium.toLocaleString()}</span>
                                </div>
                                <span className="text-neutral-600 font-light text-xl">|</span>
                                <div className="flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full bg-[#FF383C] shadow-[0_0_12px_#FF383C]" />
                                    <span className="text-lg font-bold text-neutral-300">Hard</span>
                                    <span className="text-3xl font-black text-white font-mono ml-1">{stats.hard.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Coder Type Featured Banner */}
                        <div className="rounded-3xl p-8 bg-gradient-to-r from-[#17202d] via-[#121822] to-[#17202d] border border-white/10 shadow-2xl flex items-center gap-7 relative overflow-hidden">
                            <div
                                className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 text-black font-black shadow-xl"
                                style={{ backgroundColor: coderType.badgeColor }}
                            >
                                <svg className="w-10 h-10 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                                </svg>
                            </div>
                            <div className="min-w-0">
                                <span className="text-sm font-black tracking-widest uppercase text-amber-400 block mb-0.5">
                                    CODER ARCHETYPE
                                </span>
                                <h3 className="text-3xl font-black text-white tracking-tight leading-tight">
                                    {coderType.title}
                                </h3>
                                <p className="text-xl text-neutral-300 mt-1 leading-relaxed">
                                    {user?.bio || coderType.tagline}
                                </p>
                            </div>
                        </div>

                        {/* 4 Core Metrics Grid */}
                        <div className="grid grid-cols-4 gap-4.5">
                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-5xl font-black text-white font-mono tracking-tight">{stats.totalSolved.toLocaleString()}</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 mt-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span>Solved</span>
                                </div>
                            </div>
                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-5xl font-black text-white font-mono tracking-tight">{stats.activeDays.toLocaleString()}</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 mt-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-sky-400" />
                                    <span>Active Days</span>
                                </div>
                            </div>
                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-5xl font-black text-white font-mono tracking-tight">{stats.contests.toLocaleString()}</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 mt-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                                    <span>Contests</span>
                                </div>
                            </div>
                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-6 flex flex-col items-center justify-center text-center shadow-xl">
                                <span className="text-5xl font-black text-white font-mono tracking-tight">{stats.dayStreak}d</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-neutral-400 mt-2 uppercase tracking-wider">
                                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                                    <span>Streak</span>
                                </div>
                            </div>
                        </div>

                        {/* Top Connected Platforms List */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-base font-black text-neutral-400 px-3">
                                <span className="uppercase tracking-wider">Top Coding Accounts</span>
                                <span className="text-base font-mono">{topPlatforms.length} connected</span>
                            </div>

                            <div className="space-y-3.5">
                                {topPlatforms.slice(0, 5).map((plat) => {
                                    if (plat.isGitHub || plat.id === "github") {
                                        return (
                                            <div
                                                key="github"
                                                className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl"
                                            >
                                                <div className="flex items-center gap-5">
                                                    <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center p-3 text-white">
                                                        {getPortalIcon("github", "w-8 h-8")}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-2xl font-black text-white">GitHub</h4>
                                                        <span className="text-lg font-mono text-neutral-400 block mt-0.5">@{plat.username || githubStats.username}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-6 text-right">
                                                    <div className="flex items-center gap-3 bg-white/[0.04] px-4 py-2 rounded-2xl border border-white/5">
                                                        <FolderGit2 className="w-6 h-6 text-emerald-400" />
                                                        <div className="text-left">
                                                            <span className="text-2xl font-black text-white block font-mono leading-tight">
                                                                {(plat.publicRepos ?? githubStats.publicRepos).toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-neutral-400 uppercase font-bold">Repos</span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 bg-white/[0.04] px-4 py-2 rounded-2xl border border-white/5">
                                                        <GitCommit className="w-6 h-6 text-emerald-400" />
                                                        <div className="text-left">
                                                            <span className="text-2xl font-black text-white block font-mono leading-tight">
                                                                {(plat.contributionsOrCommits ?? githubStats.contributionsOrCommits).toLocaleString()}
                                                            </span>
                                                            <span className="text-xs text-neutral-400 uppercase font-bold">Commits</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={plat.id}
                                            className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center p-3 flex-shrink-0">
                                                    {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                                </div>
                                                <div>
                                                    <h4 className="text-2xl font-black text-white">{plat.name}</h4>
                                                    <span className="text-lg font-mono text-neutral-400 block mt-0.5">@{plat.username}</span>
                                                </div>
                                            </div>
                                            <span className="text-xl font-mono font-black text-white bg-white/10 px-6 py-2.5 rounded-2xl">
                                                {plat.solvedCount.toLocaleString()} solved
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Bottom Connected Platforms Dock (Image 2) & Footer */}
                    <div className="h-28 bg-[#070a0e] border-t border-white/10 px-14 flex items-center justify-between flex-shrink-0">
                        {/* Connected platform logos row matching Image 2 */}
                        <div className="flex items-center gap-4 min-w-0">
                            <span className="text-sm font-mono font-bold tracking-wider uppercase text-neutral-400 mr-1 hidden sm:inline-block">
                                Connected:
                            </span>
                            <div className="flex items-center gap-3.5 overflow-x-auto py-1">
                                {connectedList.length > 0 ? (
                                    connectedList.map((plat) => (
                                        <div
                                            key={plat.id}
                                            className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center p-3 transition-transform hover:scale-105 cursor-pointer flex-shrink-0"
                                            title={`${plat.name} (@${plat.username})`}
                                        >
                                            {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-base text-neutral-500 font-mono">No platforms linked</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-5 text-base text-neutral-400 flex-shrink-0">
                            <span className="font-mono text-neutral-300 truncate max-w-sm flex items-center">
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <g fill="none">
                                        <path fill="currentColor" d="M10.48 4.83a4.95 4.95 0 0 1 4.92 4.4h1.91a4.97 4.97 0 0 1 0 9.94h-3.77a4.97 4.97 0 0 1-4.94-4.44H6.67a4.95 4.95 0 1 1 0-9.9z" opacity=".2" />
                                        <rect width="9.94" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.97" transform="matrix(0 -1 -1 0 22.28 19.17)" />
                                        <rect width="9.9" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.95" transform="matrix(0 -1 -1 0 15.43 14.73)" />
                                    </g>
                                </svg>{displayUrl}
                            </span>
                            <span className="text-neutral-700">•</span>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-400" />
                                <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* ==================== INSTAGRAM BACK FACE ==================== */
                <>
                    {/* Top Header */}
                    <div className="h-[220px] w-full px-14 pt-16 flex items-center justify-between border-b border-white/10 bg-[#0e131b]">
                        <div className="flex items-center gap-5">
                            <div className="w-18 h-18 rounded-3xl bg-black border border-white/20 flex items-center justify-center p-3.5 shadow-2xl">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="#F59E0B" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="#F59E0B" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-4xl font-black text-white tracking-tight leading-none block">Orbix</span>
                                <span className="text-sm font-black text-neutral-400 tracking-widest uppercase mt-1 block">Scan To Explore</span>
                            </div>
                        </div>

                        <div
                            className="px-8 py-3.5 rounded-full font-black text-base uppercase tracking-wider text-black shadow-xl"
                            style={{ backgroundColor: theme.accentColor }}
                        >
                            SCAN TO EXPLORE
                        </div>
                    </div>

                    {/* Centered QR & Platform Showcase */}
                    <div className="px-16 flex-1 flex flex-col items-center justify-around py-10 space-y-8">
                        {/* Prominent Center QR Code */}
                        <div className="flex flex-col items-center gap-6">
                            <div className="p-5 bg-white rounded-[36px] shadow-2xl">
                                <OrbixCardQR value={publicProfileUrl} size={440} showLogo={true} />
                            </div>
                            <div className="text-center mt-2">
                                <h3 className="text-4xl font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h3>
                                <p className="text-xl text-neutral-300 mt-2 font-medium">
                                    Scan with your camera to open my live coding profile
                                </p>
                            </div>
                        </div>

                        {/* GitHub Contribution Activity Table for last 3-4 months */}
                        <div className="w-full max-w-2xl mx-auto">
                            <GitHubContributionTable
                                username={username}
                                githubUsername={githubStats.username}
                                totalContributions={githubStats.contributionsOrCommits}
                                publicRepos={githubStats.publicRepos}
                                dayStreak={stats.dayStreak}
                                activeDays={stats.activeDays}
                                variant="spacious"
                            />
                        </div>
                    </div>

                    {/* Bottom Connected Platforms Dock on Back Face */}
                    <div className="h-28 bg-[#070a0e] border-t border-white/10 px-14 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-3.5 overflow-x-auto py-1">
                            {connectedList.map((plat) => (
                                <div
                                    key={plat.id}
                                    className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center p-3 transition-transform hover:scale-105 cursor-pointer flex-shrink-0"
                                    title={`${plat.name} (@${plat.username})`}
                                >
                                    {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-5 text-base text-neutral-400 flex-shrink-0">
                            <span className="font-mono text-neutral-300 truncate max-w-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <g fill="none">
                                        <path fill="currentColor" d="M10.48 4.83a4.95 4.95 0 0 1 4.92 4.4h1.91a4.97 4.97 0 0 1 0 9.94h-3.77a4.97 4.97 0 0 1-4.94-4.44H6.67a4.95 4.95 0 1 1 0-9.9z" opacity=".2" />
                                        <rect width="9.94" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.97" transform="matrix(0 -1 -1 0 22.28 19.17)" />
                                        <rect width="9.9" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.95" transform="matrix(0 -1 -1 0 15.43 14.73)" />
                                    </g>
                                </svg> {displayUrl}
                            </span>
                            <span className="text-neutral-700">•</span>
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-amber-400" />
                                <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
