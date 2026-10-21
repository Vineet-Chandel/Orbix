import React, { useMemo } from "react";
import { FolderGit2, GitCommit, Trophy, Sparkles, Code2 } from "lucide-react";
import { getPortalIcon } from "../../../utils/portalIcons";
import { OrbixCardQR } from "./OrbixCardQR";
import { CardBannerSVG } from "./CardBannerSVG";
import { GitHubContributionTable } from "./GitHubContributionTable";
import { CodingSubmissionsChart } from "./CodingSubmissionsChart";
import type { CardThemeConfig } from "./types";
import type {
    AggregatedCodingStats,
    CoderTypeBadge,
    GitHubCardStats,
    RankedPlatform,
    ConnectedPlatformBadge,
    RankedContestPlatform,
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
    connectedPortals?: Record<string, any>;
    showcaseMode?: "problems" | "contests";
    slotCategory?: "practice" | "dev" | "both";
    topContests?: RankedContestPlatform[];
}

export const InstagramStoryCard: React.FC<InstagramStoryCardProps> = ({
    user,
    stats,
    coderType,
    topPlatforms,
    allConnectedPlatforms,
    githubStats,
    includeGitHub: _includeGitHub,
    theme,
    face,
    publicProfileUrl,
    cardRef,
    connectedPortals,
    showcaseMode = "problems",
    slotCategory = "both",
    topContests = [],
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

    const backPlatforms = useMemo(() => {
        const fromTop = topPlatforms.filter((p) => !p.isGitHub && p.id !== "github");
        if (fromTop.length > 0) return fromTop.slice(0, 5);
        return connectedList.filter((p) => p.id !== "github").slice(0, 5);
    }, [topPlatforms, connectedList]);

    const remainingCount = useMemo(() => {
        const total = (allConnectedPlatforms && allConnectedPlatforms.length > 0)
            ? allConnectedPlatforms.filter((p) => p.id !== "github").length
            : connectedList.filter((p) => p.id !== "github").length;
        return Math.max(0, total - backPlatforms.length);
    }, [allConnectedPlatforms, connectedList, backPlatforms]);

    const todayDate = new Date().toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });

    const displayUrl = publicProfileUrl.replace(/^https?:\/\//, "");

    const isLightBanner = theme.id === "gold";
    const bannerTextColor = isLightBanner ? "text-black" : "text-black";
    const bannerSubtextColor = isLightBanner ? "text-black/75" : "text-black/80";
    const bannerFill = isLightBanner ? "black" : "black";
    const bannerStroke = isLightBanner ? "black" : "black";

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
                    {/* Top Textured Accent Banner with Safe Margin (Compact, Unstretched Height) */}
                    <div
                        className={`relative h-[260px] w-full px-14 pt-12 flex items-start justify-between overflow-hidden flex-shrink-0 ${theme.id === "gold" ? "bg-[#ffc629]" : `bg-gradient-to-r ${theme.bannerGradient}`
                            }`}
                        style={{
                            backgroundColor: theme.id === "gold" ? "#ffc629" : undefined,
                        }}
                    >
                        {/* Attached Full Width & Height Banner SVG with preserved circular aspect ratio */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ overflowY: "hidden" }}>
                            <CardBannerSVG
                                idPrefix="ig-front"
                                color={theme.id === "gold" ? "#f0b100" : (theme.bannerPatternColor || "rgba(255,255,255,0.22)")}
                                className="w-full h-full relative"
                                preserveAspectRatio="xMidYMid slice"
                                style={{
                                    overflow: "hidden",
                                    overflowY: "hidden",
                                }}
                            />
                        </div>

                        {/* Top Left: Orbix Brand Star + Wordmark */}
                        <div className="relative z-10 flex items-center">
                            <div className="w-[120px] h-[120px] rounded-2xl flex items-center justify-center p-1">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill={bannerFill} />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill={bannerFill} />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill={bannerFill} />
                                    <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill={bannerFill} />
                                    <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill={bannerFill} />
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke={bannerStroke} />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke={bannerStroke} />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke={bannerStroke} />
                                    <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke={bannerStroke} />
                                    <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke={bannerStroke} />
                                </svg>
                            </div>
                            <div>
                                <span className={`text-5xl font-black ${bannerTextColor} tracking-tight leading-none block`}>
                                    Orbix
                                </span>
                                <span className={`text-xl font-black ${bannerSubtextColor} tracking-widest uppercase mt-0.5 block`}>
                                    Profile Card
                                </span>
                            </div>
                        </div>

                        {/* Top Right: Verified Badge */}
                        <div className="relative z-10 flex items-center gap-3.5 mt-5">
                            <div>
                                <svg className="w-[65px] flex-shrink-0" viewBox="0 0 141 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M28.001 9.5L2.50104 54.5C0.998939 58.5834 0.64081 60.8842 0.501038 65C0.938524 68.5876 1.28381 70.4643 2.50104 73L30.001 120.5C35.4895 125.639 38.9529 126.875 45.501 127.5H99.001C105.055 125.113 108.146 123.091 113.001 118L138.001 74.5C137.555 72.8604 137.011 72.6945 136.001 72.5H120.501C115.678 74.645 113.297 76.327 109.501 80C100.469 95.3741 95.8945 104.483 85.001 118C79.395 121.617 75.9883 122.881 69.001 122.5C61.7381 121.647 58.3542 120.112 53.501 115.5L26.501 70C24.9477 65.1254 24.8433 61.7609 27.501 57L52.501 14.5C56.0812 9.93194 58.5322 7.57464 64.001 6H73.501C80.5078 6.26746 82.9476 8.58767 87.501 13C95.4738 21.4342 94.5253 25.7724 102.001 37C105.329 43.6932 111.503 52.4157 121.001 56H137.501C138.562 54.4501 138.56 53.4612 137.501 51.5L110.001 6.5C104.567 2.11059 101.303 0.697955 95.001 0.5H42.001C35.9066 2.76829 32.8347 4.72468 28.001 9.5Z" fill={bannerFill} />
                                    <path d="M73.001 28.5L72.501 12.5C70.7058 11.0543 69.8735 11.3238 68.501 12.5V28.5C66.6181 38.531 63.7181 43.4648 56.501 51.5C48.4748 57.6826 43.6156 60.3666 33.501 62C31.6617 63.574 30.9902 64.4922 33.501 66.5C43.8214 67.5752 48.5852 70.34 56.501 76.5C62.7019 83.5583 65.51 88.1063 68.501 98V115.5C70.2071 116.947 71.1914 116.977 73.001 115.5V98C75.4015 88.542 78.0024 83.8767 84.501 76.5C91.0133 71.4181 95.0765 69.1031 103.501 66.5H139.001C140.933 64.5141 140.478 63.5826 139.001 62L103.501 61.5C95.2528 59.0485 91.2098 56.5163 84.501 51C78.304 44.7688 75.3678 39.8531 73.001 28.5Z" fill={bannerFill} />
                                </svg>
                            </div>
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-[65px] flex-shrink-0" viewBox="0 0 121 89" fill="none">
                                    <path d="M1.70876 4.5C0.12191 2.90864 0.0724409 1.99494 1.70876 0.5H117.709C119.545 1.97671 119.977 2.8261 117.709 4.5C104.181 12.5622 98.954 17.9449 94.2088 29C92.6688 30.6466 91.6861 30.6173 89.7088 29C79.7437 10.5806 72.2203 6.69689 59.7088 6.5C45.4453 8.09559 38.2192 11.668 31.7088 27.5C30.4283 40.9054 30.4372 48.3489 31.7088 61.5C37.9917 76.5533 44.5975 80.7771 60.7088 82.5C77.7677 78.9809 83.6949 73.7856 89.7088 60.5C91.7028 57.2348 93.1523 57.7809 94.7085 60.5C102.674 75.3508 108.536 78.7372 119.209 84C119.834 85.9888 119.8 86.9752 117.709 88H1.70876C0.183632 86.2274 0.0547327 85.3401 1.70876 84C13.7194 76.5162 20.6745 70.4354 22.7088 61.5C24.6139 49.0868 24.218 41.4629 22.7088 27.5C18.6733 17.3207 14.491 12.1814 1.70876 4.5Z" fill={bannerFill} />
                                    <path d="M62.7085 19C61.538 18.0534 60.879 17.5934 59.7088 19C53.2869 30.3265 48.6067 35.5219 37.2085 41.5C34.6732 43.3691 34.2664 44.4424 37.2085 46.5C48.0841 52.2247 52.886 56.9754 58.7085 68.5C60.5486 69.8018 61.5591 70.1832 63.2085 68.5C68.5928 57.3944 73.8336 52.8094 85.7085 46.5C87.027 45.0962 87.7324 44.308 85.7085 42.5C75.5879 36.7207 70.2354 32.5144 62.7085 19Z" fill={bannerFill} />
                                </svg>
                            </div>
                            <div>
                                <svg className="w-[65px] flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 462" fill="none">
                                    <path d="M121.238 43.9466C59.009 80.5035 33.1605 107.594 0.738281 165.947C105.26 197.551 137.021 234.274 172.238 314.947C184.063 377.952 179.633 409.761 153.238 460.447C214.254 425.34 239.644 395.514 273.738 329.447C304.125 246.736 306.738 196.516 281.238 98.9466C199.34 161.027 147.684 179.97 73.2383 165.947C130.596 158.31 160.167 149.436 207.738 124.447C274.352 86.5932 300.141 57.7559 338.738 1.44657C241.336 -2.43033 190.709 4.44276 121.238 43.9466Z" fill={bannerFill} />
                                    <path d="M294.238 94.013C349.223 86.4663 369.977 68.9291 386.724 10.9463C395.658 59.6846 411.018 80.3366 474.238 94.013C426.713 105.579 402.401 115.84 386.724 178.946C371.021 121.546 348.728 105.363 294.238 94.013Z" fill={bannerFill} />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area - Beautifully Proportioned to Fill Story Height */}
                    <div className="px-14 flex-1 flex flex-col justify-around -mt-[150px] relative z-20 pb-6 space-y-5">
                        {/* Avatar & User Details */}
                        <div className="flex flex-col items-center text-center">
                            <div className="relative flex-shrink-0 w-[250px] h-[250px]">
                                {/* Segmented outer ring */}
                                <div
                                    className="absolute inset-0 rounded-full"
                                    style={{
                                        background: `
                conic-gradient(
                    from -75deg,
                    #C084FC 0deg 98deg,
                    #17191f 98deg 103deg,
                    #38BDF8 103deg 190deg,
                    #17191f 190deg 195deg,
                    #ff80d7ff 195deg 355deg,
                    #17191f 355deg 360deg
                )
            `,
                                        padding: "9px",
                                    }}
                                >
                                    {/* Dark separator / inner ring */}
                                    <div className="w-full h-full rounded-full bg-[#17191f] p-[7px]">
                                        {/* Avatar image */}
                                        <div
                                            className="w-full h-full rounded-full overflow-hidden"
                                            style={{
                                                boxShadow: `0 0 30px ${theme.borderGlow}`,
                                            }}
                                        >
                                            {avatarSrc ? (
                                                <img
                                                    src={avatarSrc}
                                                    alt={displayName}
                                                    crossOrigin="anonymous"
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full bg-neutral-900 flex items-center justify-center font-black text-3xl text-white">
                                                    {displayName.slice(0, 2).toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
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


                            {/* Line 3: Classification of Questions (Easy / Medium / Hard) */}
                            <div className="flex items-center gap-4 text-3xl font-semibold mt-5">
                                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] " />
                                    <span className="text-neutral-300 font-bold">Easy</span>
                                    <span className="text-2xl font-black text-white font-mono ml-0.5">
                                        {stats.easy.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600] " />
                                    <span className="text-neutral-300 font-bold">Medium</span>
                                    <span className="text-2xl font-black text-white font-mono ml-0.5">
                                        {stats.medium.toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#FF383C] " />
                                    <span className="text-neutral-300 font-bold">Hard</span>
                                    <span className="text-2xl font-black text-white font-mono ml-0.5">
                                        {stats.hard.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Coding Submissions Chart (4-Month Multi-Platform Submissions, excl. GitHub) */}
                        <CodingSubmissionsChart
                            connectedPortals={connectedPortals || {}}
                            username={username}
                            variant="story"
                        />

                        {/* 4 Core Metrics Grid */}
                        <div className="grid grid-cols-4 gap-2">
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
                        {/* Showcased Platform or Contest Slots */}
                        <div className="space-y-4">
                            {showcaseMode === "contests" ? (
                                <>
                                    <div className="flex items-center justify-between text-base font-black text-neutral-400 px-3">
                                        <div className="flex items-center gap-2">
                                            <Trophy className="w-5 h-5 text-amber-400" />
                                            <span className="uppercase tracking-wider">Contest Standings</span>
                                        </div>
                                        <span className="text-base font-mono">{topContests.length} displayed</span>
                                    </div>

                                    <div className="space-y-3.5">
                                        {topContests.length === 0 ? (
                                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-8 text-center shadow-xl">
                                                <p className="text-lg text-neutral-400 font-medium">No contest standings available.</p>
                                            </div>
                                        ) : (
                                            topContests.slice(0, 5).map((contest: any) => {
                                                const hasRating = contest.rating !== null && contest.rating !== undefined;
                                                return (
                                                    <div
                                                        key={contest.id}
                                                        className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl"
                                                    >
                                                        <div className="flex items-center gap-5 min-w-0">
                                                            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center p-3 flex-shrink-0">
                                                                {getPortalIcon(contest.id, "w-full h-full object-contain")}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-2xl font-black text-white truncate">{contest.name}</h4>
                                                                <span className="text-lg font-mono text-neutral-400 block mt-0.5 truncate">
                                                                    @{contest.username}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                                                                    {hasRating ? contest.rating?.toLocaleString() : "—"}
                                                                </span>
                                                                {contest.tier && (
                                                                    <span
                                                                        style={{
                                                                            backgroundColor: contest.tierColor || "#ea3943",
                                                                        }}
                                                                        className="px-3.5 py-1 rounded-xl text-sm font-black text-white uppercase tracking-wider shadow-md leading-none"
                                                                    >
                                                                        {contest.tier}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {contest.officialRank ? (
                                                                <span className="text-sm font-mono text-neutral-400">
                                                                    Rank #{contest.officialRank.toLocaleString()}{contest.peakRating ? ` • max ${contest.peakRating}` : ""}
                                                                </span>
                                                            ) : contest.tierInfo?.nextTierName && typeof contest.tierInfo.pointsToNextTier === "number" ? (
                                                                <span className="text-sm font-mono text-neutral-400">
                                                                    {contest.tierInfo.pointsToNextTier} to {contest.tierInfo.nextTierName}
                                                                </span>
                                                            ) : contest.ratedContestsCount && contest.ratedContestsCount > 0 ? (
                                                                <span className="text-sm font-mono text-neutral-400">
                                                                    {contest.ratedContestsCount} contests attended
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-base font-black text-neutral-400 px-3">
                                        <div className="flex items-center gap-2">
                                            {slotCategory === "practice" ? (
                                                <>
                                                    <Code2 className="w-5 h-5 text-indigo-400" />
                                                    <span className="uppercase tracking-wider">Practice Slots</span>
                                                </>
                                            ) : slotCategory === "dev" ? (
                                                <>
                                                    <FolderGit2 className="w-5 h-5 text-emerald-400" />
                                                    <span className="uppercase tracking-wider">Dev Slots</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                                    <span className="uppercase tracking-wider">Practice & Dev Slots</span>
                                                </>
                                            )}
                                        </div>
                                        <span className="text-base font-mono">{topPlatforms.length} showcased</span>
                                    </div>

                                    <div className="space-y-3.5">
                                        {topPlatforms.length === 0 ? (
                                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 p-8 text-center flex items-center justify-center">
                                                <p className="text-lg text-neutral-400">No platforms selected.</p>
                                            </div>
                                        ) : slotCategory === "dev" && topPlatforms.length === 1 ? (
                                            (() => {
                                                const plat = topPlatforms[0];
                                                const bestDay = plat.bestWorkingDay || githubStats.bestWorkingDay || "Wednesday";
                                                const repos = (plat.publicRepos ?? githubStats.publicRepos) || 0;
                                                const commits = (plat.contributionsOrCommits ?? githubStats.contributionsOrCommits) || 0;
                                                const heroValue = commits > 0 ? commits.toLocaleString() : repos > 0 ? repos.toLocaleString() : "—";
                                                const heroLabel = commits > 0 ? "COMMITS" : repos > 0 ? "REPOS" : "DEV";

                                                return (
                                                    <div className="space-y-3.5">
                                                        {/* Primary Hero Dev Slot */}
                                                        <div className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl">
                                                            <div className="flex items-center gap-5 min-w-0">
                                                                <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center p-3 text-white flex-shrink-0 shadow-md">
                                                                    {getPortalIcon(plat.id || "github", "w-8 h-8 text-white")}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <h4 className="text-2xl font-black text-white truncate">
                                                                            {plat.name || "GitHub"}
                                                                        </h4>
                                                                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 leading-none">
                                                                            DEV
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-lg font-mono text-neutral-400 block mt-0.5 truncate">
                                                                        @{plat.username || githubStats.username}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                                                                        {heroValue}
                                                                    </span>
                                                                    <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider leading-none bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md flex items-center gap-1.5">
                                                                        <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                                                                        {heroLabel}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2 text-sm font-mono text-neutral-300 bg-white/[0.06] px-3.5 py-1 rounded-xl border border-white/5">
                                                                    <span className="font-bold text-sky-400 flex items-center gap-1.5">
                                                                        <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                                                                        {repos.toLocaleString()} repos
                                                                    </span>
                                                                    {bestDay ? (
                                                                        <>
                                                                            <span className="text-neutral-500">•</span>
                                                                            <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                                                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                                                Peak: {bestDay}
                                                                            </span>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* 3-Column Engineering Metrics Grid */}
                                                        <div className="grid grid-cols-3 gap-3">
                                                            <div className="rounded-2xl bg-[#131924]/80 border border-white/10 p-5 flex flex-col justify-between">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-xs font-mono uppercase text-neutral-400 font-bold">Commits</span>
                                                                    <GitCommit className="w-5 h-5 text-emerald-400" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-2xl font-black text-white font-mono block leading-none">
                                                                        {commits.toLocaleString()}
                                                                    </span>
                                                                    <span className="text-xs text-neutral-400 block mt-1">All-time contributions</span>
                                                                </div>
                                                            </div>

                                                            <div className="rounded-2xl bg-[#131924]/80 border border-white/10 p-5 flex flex-col justify-between">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-xs font-mono uppercase text-neutral-400 font-bold">Repositories</span>
                                                                    <FolderGit2 className="w-5 h-5 text-sky-400" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-2xl font-black text-white font-mono block leading-none">
                                                                        {repos.toLocaleString()}
                                                                    </span>
                                                                    <span className="text-xs text-neutral-400 block mt-1">Public projects</span>
                                                                </div>
                                                            </div>

                                                            <div className="rounded-2xl bg-[#131924]/80 border border-white/10 p-5 flex flex-col justify-between">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <span className="text-xs font-mono uppercase text-neutral-400 font-bold">Best Day</span>
                                                                    <Sparkles className="w-5 h-5 text-amber-400" />
                                                                </div>
                                                                <div>
                                                                    <span className="text-2xl font-black text-amber-300 font-mono block leading-none truncate">
                                                                        {bestDay}
                                                                    </span>
                                                                    <span className="text-xs text-neutral-400 block mt-1">Peak coding velocity</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Developer Flow Insight Banner */}
                                                        <div className="rounded-2xl bg-white/[0.04] border border-white/5 px-6 py-3.5 flex items-center justify-between text-base font-mono">
                                                            <div className="flex items-center gap-2 text-neutral-300">
                                                                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0" />
                                                                <span>Peak engineering velocity on <strong className="text-amber-300">{bestDay}s</strong></span>
                                                            </div>
                                                            <span className="text-emerald-400 font-bold uppercase tracking-wider text-xs">Active Builder</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()
                                        ) : (
                                            topPlatforms.slice(0, 5).map((plat) => {
                                                // DEV SLOT
                                                if (plat.isGitHub || plat.id === "github" || plat.category === "dev") {
                                                    const bestDay = plat.bestWorkingDay || githubStats.bestWorkingDay || "Wednesday";
                                                    const repos = (plat.publicRepos ?? githubStats.publicRepos) || 0;
                                                    const commits = (plat.contributionsOrCommits ?? githubStats.contributionsOrCommits) || 0;
                                                    const heroValue = commits > 0 ? commits.toLocaleString() : repos > 0 ? repos.toLocaleString() : "—";
                                                    const heroLabel = commits > 0 ? "COMMITS" : repos > 0 ? "REPOS" : "DEV";

                                                    return (
                                                        <div
                                                            key={plat.id || "github"}
                                                            className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl"
                                                        >
                                                            <div className="flex items-center gap-5 min-w-0">
                                                                <div className="w-16 h-16 rounded-2xl bg-white/[0.08] border border-white/10 flex items-center justify-center p-3 text-white flex-shrink-0 shadow-md">
                                                                    {getPortalIcon(plat.id || "github", "w-8 h-8 text-white")}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <div className="flex items-center gap-2.5">
                                                                        <h4 className="text-2xl font-black text-white truncate">
                                                                            {plat.name || "GitHub"}
                                                                        </h4>
                                                                        <span className="text-xs font-black uppercase px-2.5 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 leading-none">
                                                                            DEV
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-lg font-mono text-neutral-400 block mt-0.5 truncate">
                                                                        @{plat.username || githubStats.username}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                                                                        {heroValue}
                                                                    </span>
                                                                    <span className="px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider leading-none bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-md flex items-center gap-1.5">
                                                                        <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                                                                        {heroLabel}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2 text-sm font-mono text-neutral-300 bg-white/[0.06] px-3.5 py-1 rounded-xl border border-white/5">
                                                                    <span className="font-bold text-sky-400 flex items-center gap-1.5">
                                                                        <FolderGit2 className="w-3.5 h-3.5 text-sky-400" />
                                                                        {repos.toLocaleString()} repos
                                                                    </span>
                                                                    {bestDay ? (
                                                                        <>
                                                                            <span className="text-neutral-500">•</span>
                                                                            <span className="text-amber-300 font-semibold flex items-center gap-1.5">
                                                                                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                                                                                Peak: {bestDay}
                                                                            </span>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                }

                                                // PRACTICE PLATFORM (Smart Sync)
                                                const showContestRating = Boolean(plat.hasGoodRating && plat.rating && plat.rating > 0);

                                                return (
                                                    <div
                                                        key={plat.id}
                                                        className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 flex items-center justify-between shadow-xl"
                                                    >
                                                        <div className="flex items-center gap-5 min-w-0">
                                                            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center p-3 flex-shrink-0">
                                                                {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <h4 className="text-2xl font-black text-white truncate">{plat.name}</h4>
                                                                <span className="text-lg font-mono text-neutral-400 block mt-0.5 truncate">
                                                                    @{plat.username}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {showContestRating ? (
                                                            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-3xl font-black text-white font-mono tracking-tight leading-none">
                                                                        {plat.rating?.toLocaleString()}
                                                                    </span>
                                                                    {plat.tier && (
                                                                        <span
                                                                            style={{
                                                                                backgroundColor: plat.tierColor || "#f59e0b",
                                                                            }}
                                                                            className="px-3 py-1 rounded-xl text-xs font-black text-white uppercase tracking-wider shadow-md leading-none"
                                                                        >
                                                                            {plat.tier}
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-2 text-sm font-mono text-neutral-300 bg-white/[0.06] px-3 py-1 rounded-xl border border-white/5">
                                                                    <span className="font-bold text-white">
                                                                        {plat.solvedCount.toLocaleString()}
                                                                    </span>
                                                                    <span className="text-neutral-400">solved</span>
                                                                    {plat.contestsCount && plat.contestsCount > 0 ? (
                                                                        <>
                                                                            <span className="text-neutral-500">•</span>
                                                                            <span className="text-neutral-400">
                                                                                {plat.contestsCount} contests
                                                                            </span>
                                                                        </>
                                                                    ) : null}
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xl font-mono font-black text-white bg-white/10 px-6 py-2.5 rounded-2xl border border-white/5 shadow-md flex-shrink-0">
                                                                {plat.solvedCount.toLocaleString()} solved
                                                            </span>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </>
                            )}
                        </div>


                        {/* All Connected Platforms Full Row in Sequence (Directly after Top Accounts) */}
                        <div className="space-y-3.5">
                            <div className="flex items-center justify-between text-base font-black text-neutral-400 px-3">
                                <span className="uppercase tracking-wider">All Connected Platforms</span>
                                <span className="text-base font-mono">{connectedList.length} verified</span>
                            </div>

                            <div className="rounded-3xl bg-[#131924]/90 border border-white/10 px-8 py-5 shadow-xl flex items-center justify-between gap-6">
                                <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-sm font-mono font-bold tracking-wider uppercase text-neutral-400">
                                        Connected:
                                    </span>
                                </div>
                                <div className="flex items-center gap-3.5 flex-wrap flex-1 justify-start">
                                    {connectedList.map((plat) => (
                                        <div
                                            key={plat.id}
                                            className="w-14 h-14 rounded-2xl bg-white shadow-xl flex items-center justify-center p-2.5 transition-transform hover:scale-110 cursor-pointer flex-shrink-0"
                                            title={`${plat.name} (@${plat.username})`}
                                        >
                                            {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Clean Footer */}
                    <div className="h-24 bg-[#070a0e] border-t border-white/10 px-14 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-4 text-base text-neutral-300 font-mono">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                <path d="M0 0h24v24H0z" fill="none" />
                                <g fill="none">
                                    <path fill="currentColor" d="M10.48 4.83a4.95 4.95 0 0 1 4.92 4.4h1.91a4.97 4.97 0 0 1 0 9.94h-3.77a4.97 4.97 0 0 1-4.94-4.44H6.67a4.95 4.95 0 1 1 0-9.9z" opacity=".2" />
                                    <rect width="9.94" height="13.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" rx="4.97" transform="matrix(0 -1 -1 0 22.28 19.17)" />
                                    <rect width="9.9" height="13.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" rx="4.95" transform="matrix(0 -1 -1 0 15.43 14.73)" />
                                </g>
                            </svg>
                            <span>{displayUrl}</span>
                        </div>

                        <div className="flex items-center gap-2.5 text-base text-neutral-400">
                            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse" />
                            <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            ) : (
                /* ==================== INSTAGRAM BACK FACE ==================== */
                <>
                    {/* Top Header */}
                    <div className="h-[160px] w-full px-14 pt-8 flex items-center justify-between border-b border-white/10 bg-[#0e131b]">
                        <div className="flex items-center gap-5">
                            <div className="w-[100px] h-[100px] rounded-2xl flex items-center justify-center">
                                <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="white" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="white" />
                                    <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="white" />
                                    <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="white" />
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="white" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="white" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="white" />
                                    <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="white" />
                                    <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="white" />
                                </svg>
                            </div>
                            <div>
                                <span className="text-5xl font-black text-white tracking-tight leading-none block">Orbix</span>
                                <span className="text-xl font-black text-neutral-400 tracking-widest uppercase mt-1 block">Scan To Explore</span>
                            </div>
                        </div>

                        <div
                            className="px-8 py-3.5 rounded-full font-black text-xl uppercase tracking-wider text-black shadow-xl"
                            style={{ backgroundColor: theme.accentColor }}
                        >
                            SCAN TO EXPLORE
                        </div>
                    </div>

                    {/* Centered QR & Platform Showcase */}
                    <div className="px-12 flex-1 flex flex-col justify-around py-6">
                        {/* Prominent Center QR Code */}
                        <div className="flex flex-col items-center gap-3">
                            <div className=" bg-white rounded-[32px] shadow-2xl">
                                <OrbixCardQR value={publicProfileUrl} size={340} showLogo={true} />
                            </div>
                            <div className="text-center mt-1">
                                <h3 className="text-3xl font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h3>
                                <p className="text-lg text-neutral-300 mt-1 font-medium">
                                    Scan with your camera to open my live coding profile
                                </p>
                            </div>
                        </div>

                        {/* GitHub Contribution Activity Table for last 5 months (Full Width) */}
                        <div className="w-full">
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

                        {/* Top Connected Platforms Showcase (FIND ME ON - Full Width, Below Contribution Table) */}
                        <div className="w-full">
                            <span className="text-xl font-black tracking-[0.2em] uppercase text-neutral-400 block mb-4">
                                FIND ME ON
                            </span>
                            <div className="space-y-3.5">
                                {backPlatforms.map((plat) => {
                                    const handle = plat.username || username;
                                    const displayHandle = handle.startsWith("@") ? handle : `@${handle}`;
                                    return (
                                        <div
                                            key={plat.id}
                                            className="flex items-center justify-between py-0.5"
                                        >
                                            <div className="flex items-center gap-5 min-w-0">
                                                <div className="w-14 h-14 rounded-2xl bg-white shadow-md flex items-center justify-center p-2.5 flex-shrink-0">
                                                    {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                                </div>
                                                <span className="text-3xl font-bold text-white tracking-tight truncate">
                                                    {plat.name}
                                                </span>
                                            </div>
                                            <span className="text-2xl font-mono text-neutral-400 flex-shrink-0 ml-4">
                                                {displayHandle}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                            {remainingCount > 0 && (
                                <div className="mt-4 text-xl font-mono text-neutral-400 font-medium">
                                    +{remainingCount} more on my profile
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Clean Footer on Back Face */}
                    <div className="h-24 bg-[#070a0e] border-t border-white/10 px-14 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-4 text-base text-neutral-300 font-mono">
                            <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                <path d="M0 0h24v24H0z" fill="none" />
                                <g fill="none">
                                    <path fill="currentColor" d="M10.48 4.83a4.95 4.95 0 0 1 4.92 4.4h1.91a4.97 4.97 0 0 1 0 9.94h-3.77a4.97 4.97 0 0 1-4.94-4.44H6.67a4.95 4.95 0 1 1 0-9.9z" opacity=".2" />
                                    <rect width="9.94" height="13.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" rx="4.97" transform="matrix(0 -1 -1 0 22.28 19.17)" />
                                    <rect width="9.9" height="13.71" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" rx="4.95" transform="matrix(0 -1 -1 0 15.43 14.73)" />
                                </g>
                            </svg>
                            <span>{displayUrl}</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-base text-neutral-400">
                            <span className="w-3 h-3 rounded-full bg-amber-400" />
                            <span className="font-bold text-neutral-300">Live • {todayDate}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
