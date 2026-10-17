import React from "react";
import { FolderGit2, GitCommit } from "lucide-react";
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
} from "../../../utils/cardStatsAggregator";

interface LinkedInCardProps {
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
}

export const LinkedInCard: React.FC<LinkedInCardProps> = ({
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
    connectedPortals,
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

    const isLightBanner = theme.id === "gold";
    const bannerTextColor = isLightBanner ? "black" : "black";
    const bannerSubtextColor = isLightBanner ? "black" : "black";
    const bannerFill = isLightBanner ? "black" : "black";
    const bannerStroke = isLightBanner ? "black" : "black";

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

                    <div
                        className={`relative h-[165px] w-full px-9 pt-5 flex items-start justify-between overflow-hidden flex-shrink-0 ${theme.id === "gold" ? "bg-[#ffc629]" : `bg-gradient-to-r ${theme.bannerGradient}`
                            }`}
                        style={{
                            backgroundColor: theme.id === "gold" ? "#ffc629" : undefined,
                        }}
                    >
                        {/* Attached Full Width & Height Banner SVG with overflow-y hidden and relaxed height */}
                        <div className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none" style={{ overflowY: "hidden" }}>
                            <CardBannerSVG
                                idPrefix="li-front"
                                color={theme.id === "gold" ? "#f0b100" : (theme.bannerPatternColor || "rgba(255,255,255,0.22)")}
                                className="w-full h-[125%] -top-[12%] relative"
                                preserveAspectRatio="none"
                                style={{
                                    overflow: "hidden",
                                    overflowY: "hidden",
                                }}
                            />
                        </div>





                        {/* Top Left: Orbix Brand Star + Wordmark */}
                        <div className="relative z-10 flex items-center">
                            <div className="w-[80px] h-[80px] rounded-2xl flex items-center justify-center p-1">
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
                                <span className={`text-4xl font-black text-black ${bannerTextColor} tracking-tight leading-none block`}>
                                    Orbix
                                </span>
                                <span className={`text-sm font-black text-black ${bannerSubtextColor} tracking-widest uppercase mt-0.5 block`}>
                                    Profile Card
                                </span>
                            </div>
                        </div>

                        {/* Top Right: Verified Badge */}
                        <div className="relative z-10 flex items-center gap-3.5 ">
                            <div>
                                <svg className="w-11 h-11 flex-shrink-0" viewBox="0 0 141 128" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M28.001 9.5L2.50104 54.5C0.998939 58.5834 0.64081 60.8842 0.501038 65C0.938524 68.5876 1.28381 70.4643 2.50104 73L30.001 120.5C35.4895 125.639 38.9529 126.875 45.501 127.5H99.001C105.055 125.113 108.146 123.091 113.001 118L138.001 74.5C137.555 72.8604 137.011 72.6945 136.001 72.5H120.501C115.678 74.645 113.297 76.327 109.501 80C100.469 95.3741 95.8945 104.483 85.001 118C79.395 121.617 75.9883 122.881 69.001 122.5C61.7381 121.647 58.3542 120.112 53.501 115.5L26.501 70C24.9477 65.1254 24.8433 61.7609 27.501 57L52.501 14.5C56.0812 9.93194 58.5322 7.57464 64.001 6H73.501C80.5078 6.26746 82.9476 8.58767 87.501 13C95.4738 21.4342 94.5253 25.7724 102.001 37C105.329 43.6932 111.503 52.4157 121.001 56H137.501C138.562 54.4501 138.56 53.4612 137.501 51.5L110.001 6.5C104.567 2.11059 101.303 0.697955 95.001 0.5H42.001C35.9066 2.76829 32.8347 4.72468 28.001 9.5Z" fill={bannerFill} />
                                    <path d="M73.001 28.5L72.501 12.5C70.7058 11.0543 69.8735 11.3238 68.501 12.5V28.5C66.6181 38.531 63.7181 43.4648 56.501 51.5C48.4748 57.6826 43.6156 60.3666 33.501 62C31.6617 63.574 30.9902 64.4922 33.501 66.5C43.8214 67.5752 48.5852 70.34 56.501 76.5C62.7019 83.5583 65.51 88.1063 68.501 98V115.5C70.2071 116.947 71.1914 116.977 73.001 115.5V98C75.4015 88.542 78.0024 83.8767 84.501 76.5C91.0133 71.4181 95.0765 69.1031 103.501 66.5H139.001C140.933 64.5141 140.478 63.5826 139.001 62L103.501 61.5C95.2528 59.0485 91.2098 56.5163 84.501 51C78.304 44.7688 75.3678 39.8531 73.001 28.5Z" fill={bannerFill} />
                                </svg>
                            </div>
                            <div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="w-11 h-11 flex-shrink-0" viewBox="0 0 121 89" fill="none">
                                    <path d="M1.70876 4.5C0.12191 2.90864 0.0724409 1.99494 1.70876 0.5H117.709C119.545 1.97671 119.977 2.8261 117.709 4.5C104.181 12.5622 98.954 17.9449 94.2088 29C92.6688 30.6466 91.6861 30.6173 89.7088 29C79.7437 10.5806 72.2203 6.69689 59.7088 6.5C45.4453 8.09559 38.2192 11.668 31.7088 27.5C30.4283 40.9054 30.4372 48.3489 31.7088 61.5C37.9917 76.5533 44.5975 80.7771 60.7088 82.5C77.7677 78.9809 83.6949 73.7856 89.7088 60.5C91.7028 57.2348 93.1523 57.7809 94.7085 60.5C102.674 75.3508 108.536 78.7372 119.209 84C119.834 85.9888 119.8 86.9752 117.709 88H1.70876C0.183632 86.2274 0.0547327 85.3401 1.70876 84C13.7194 76.5162 20.6745 70.4354 22.7088 61.5C24.6139 49.0868 24.218 41.4629 22.7088 27.5C18.6733 17.3207 14.491 12.1814 1.70876 4.5Z" fill={bannerFill} />
                                    <path d="M62.7085 19C61.538 18.0534 60.879 17.5934 59.7088 19C53.2869 30.3265 48.6067 35.5219 37.2085 41.5C34.6732 43.3691 34.2664 44.4424 37.2085 46.5C48.0841 52.2247 52.886 56.9754 58.7085 68.5C60.5486 69.8018 61.5591 70.1832 63.2085 68.5C68.5928 57.3944 73.8336 52.8094 85.7085 46.5C87.027 45.0962 87.7324 44.308 85.7085 42.5C75.5879 36.7207 70.2354 32.5144 62.7085 19Z" fill={bannerFill} />
                                </svg>
                            </div>
                            <div>
                                <svg className="w-11 h-11 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 475 462" fill="none">
                                    <path d="M121.238 43.9466C59.009 80.5035 33.1605 107.594 0.738281 165.947C105.26 197.551 137.021 234.274 172.238 314.947C184.063 377.952 179.633 409.761 153.238 460.447C214.254 425.34 239.644 395.514 273.738 329.447C304.125 246.736 306.738 196.516 281.238 98.9466C199.34 161.027 147.684 179.97 73.2383 165.947C130.596 158.31 160.167 149.436 207.738 124.447C274.352 86.5932 300.141 57.7559 338.738 1.44657C241.336 -2.43033 190.709 4.44276 121.238 43.9466Z" fill={bannerFill} />
                                    <path d="M294.238 94.013C349.223 86.4663 369.977 68.9291 386.724 10.9463C395.658 59.6846 411.018 80.3366 474.238 94.013C426.713 105.579 402.401 115.84 386.724 178.946C371.021 121.546 348.728 105.363 294.238 94.013Z" fill={bannerFill} />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Middle Content Section - Naturally Fills Height */}
                    <div className="px-9 flex-1 flex flex-col justify-between -mt-14 relative z-20 pb-3 pt-1">
                        {/* Avatar & Identity Header Row (Image 1 Structure) */}
                        <div className="flex items-end justify-between gap-6">
                            <div className="flex items-center gap-5">
                                {/* Profile Avatar */}

                                <div className="relative flex-shrink-0 w-36 h-36">
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


                                {/* Identity & Classification Settlement */}
                                <div className="flex flex-col gap-1.5 justify-center">
                                    {/* Line 1: Name + Verified Badge */}
                                    <div className="flex items-center gap-2.5">
                                        <h1 className="text-5xl font-black text-white tracking-tight leading-none">
                                            {displayName}
                                        </h1>
                                        {/* Verified Badge Icon (Matching Image 1) */}
                                        <div className="w-8 h-8 flex items-center justify-center text-[#1D9BF0] flex-shrink-0" title="Verified Developer">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-full w-full" viewBox="0 0 16 16">
                                                <path fill="#00c4ff" d="m11.335 2.065l.076.153l.577 1.533c.045.12.14.216.261.261l1.48.555c.65.244.999.938.826 1.595l-.042.13l-.688 1.523a.45.45 0 0 0 0 .37l.653 1.439a1.34 1.34 0 0 1-.543 1.711l-.153.076l-1.533.577a.45.45 0 0 0-.261.261l-.555 1.48a1.34 1.34 0 0 1-1.595.826l-.13-.042l-1.523-.688a.45.45 0 0 0-.37 0l-1.439.654a1.34 1.34 0 0 1-1.711-.544l-.076-.153l-.577-1.533a.45.45 0 0 0-.261-.261l-1.48-.555a1.34 1.34 0 0 1-.826-1.595l.042-.13l.689-1.523a.45.45 0 0 0 0-.37l-.654-1.439a1.34 1.34 0 0 1 .543-1.711l.153-.076l1.533-.577a.45.45 0 0 0 .261-.261l.555-1.48a1.34 1.34 0 0 1 1.595-.826l.13.042l1.523.689a.45.45 0 0 0 .37 0l1.439-.654a1.34 1.34 0 0 1 1.711.543m-1.171 3.64L6.978 9.348L5.816 8.184a.447.447 0 1 0-.632.632l1.5 1.5a.447.447 0 0 0 .652-.022l3.5-4a.447.447 0 0 0-.672-.588"></path>
                                            </svg>
                                        </div>
                                    </div>

                                    {/* Line 2: Tagline · @username */}
                                    <div className="flex items-center gap-2 text-md text-neutral-300 font-medium leading-none">
                                        <span className="text-neutral-200 font-medium truncate max-w-[480px]">
                                            {tagline}
                                        </span>
                                        <span className="text-neutral-500 font-bold">·</span>
                                        <span className="font-mono text-neutral-400">
                                            @{username}
                                        </span>
                                    </div>

                                    {/* Line 3: Classification of Questions (Easy / Medium / Hard) */}
                                    <div className="flex items-center gap-4 text-md font-semibold pt-0.5">
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#00E5FF] shadow-[0_0_8px_#00E5FF]" />
                                            <span className="text-neutral-300 font-medium">Easy</span>
                                            <span className="text-sm font-black text-white font-mono ml-0.5">
                                                {stats.easy.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#FFD600] shadow-[0_0_8px_#FFD600]" />
                                            <span className="text-neutral-300 font-medium">Medium</span>
                                            <span className="text-sm font-black text-white font-mono ml-0.5">
                                                {stats.medium.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-white/[0.05]">
                                            <span className="w-2.5 h-2.5 rounded-full bg-[#FF383C] shadow-[0_0_8px_#FF383C]" />
                                            <span className="text-neutral-300 font-medium">Hard</span>
                                            <span className="text-sm font-black text-white font-mono ml-0.5">
                                                {stats.hard.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>

                        {/* Two Columns Dashboard Content - Full Height Rich Blocks */}
                        <div className="grid grid-cols-12 gap-5 mt-3 flex-1 items-stretch">
                            {/* Left Column (7 cols): Coding Submissions Heatmap + 4 Stats Tiles */}
                            <div className="col-span-7 flex flex-col justify-between space-y-3">
                                {/* Coding Submissions Chart (4-Month Multi-Platform Submissions, excl. GitHub) */}
                                <CodingSubmissionsChart
                                    connectedPortals={connectedPortals || {}}
                                    username={username}
                                    variant="linkedin"
                                />

                                {/* 4 Key Stats Row */}
                                <div className="grid grid-cols-4 gap-3">
                                    {/* Total Solved */}
                                    <div className="rounded-2xl bg-[#121824]/90 border border-white/10 p-3.5 flex flex-col items-center justify-center text-center shadow-md">
                                        <span className="text-2xl font-black text-white tracking-tight font-mono">
                                            {stats.totalSolved.toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-neutral-400 mt-1 uppercase">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24">
                                                <g fill="none" stroke="#00adff" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                                                    <rect width={18} height={18} x={3} y={3} rx={4}></rect>
                                                    <path d="m9 12l2.25 2L15 10"></path>
                                                </g>
                                            </svg>
                                            <span>Solved</span>
                                        </div>
                                    </div>

                                    {/* Active Days */}
                                    <div className="rounded-2xl bg-[#121824]/90 border border-white/10 p-3.5 flex flex-col items-center justify-center text-center shadow-md">
                                        <span className="text-2xl font-black text-white tracking-tight font-mono">
                                            {stats.activeDays.toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-neutral-400 mt-1 uppercase">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 24 24">
                                                <g fill="none">
                                                    <rect width={17.98} height={5.25} x={3.01} y={3.46} fill="#39ff00" opacity={0.2} rx={1}></rect>
                                                    <rect width={17.98} height={17.98} x={3.01} y={3.46} stroke="#39ff00" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} rx={3}></rect>
                                                    <path stroke="#39ff00" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.69 1.76v3.4m8.68-3.4v3.4m4.2 3.54H3.83"></path>
                                                    <path fill="#39ff00" stroke="#39ff00" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7.63 12.76a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m0 4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m4.87-4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m0 4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0m4.88-4.24a.5.5 0 1 1-1 0a.5.5 0 0 1 1 0"></path>
                                                </g>
                                            </svg>
                                            <span>Active days</span>
                                        </div>
                                    </div>

                                    {/* Contests */}
                                    <div className="rounded-2xl bg-[#121824]/90 border border-white/10 p-3.5 flex flex-col items-center justify-center text-center shadow-md">
                                        <span className="text-2xl font-black text-white tracking-tight font-mono">
                                            {stats.contests.toLocaleString()}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-neutral-400 mt-1 uppercase">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 1024 1024">
                                                <path fill="#ffa300" d="M868 160h-92v-40c0-4.4-3.6-8-8-8H256c-4.4 0-8 3.6-8 8v40h-92a44 44 0 0 0-44 44v148c0 81.7 60 149.6 138.2 162C265.7 630.2 359 721.7 476 734.5v105.2H280c-17.7 0-32 14.3-32 32V904c0 4.4 3.6 8 8 8h512c4.4 0 8-3.6 8-8v-32.3c0-17.7-14.3-32-32-32H548V734.5C665 721.7 758.3 630.2 773.8 514C852 501.6 912 433.7 912 352V204a44 44 0 0 0-44-44M184 352V232h64v207.6a91.99 91.99 0 0 1-64-87.6m520 128c0 49.1-19.1 95.4-53.9 130.1c-34.8 34.8-81 53.9-130.1 53.9h-16c-49.1 0-95.4-19.1-130.1-53.9c-34.8-34.8-53.9-81-53.9-130.1V184h384zm136-128c0 41-26.9 75.8-64 87.6V232h64z"></path>
                                            </svg>
                                            <span>Contests</span>
                                        </div>
                                    </div>

                                    {/* Day Streak */}
                                    <div className="rounded-2xl bg-[#121824]/90 border border-white/10 p-3.5 flex flex-col items-center justify-center text-center shadow-md">
                                        <span className="text-2xl font-black text-white tracking-tight font-mono">
                                            {stats.dayStreak}
                                        </span>
                                        <div className="flex items-center gap-1 text-xs font-bold text-neutral-400 mt-1 uppercase">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="1.5em" height="1.5em" viewBox="0 0 1024 1024">
                                                <path fill="#ff5200" d="M834.1 469.2A347.5 347.5 0 0 0 751.2 354l-29.1-26.7a8.09 8.09 0 0 0-13 3.3l-13 37.3c-8.1 23.4-23 47.3-44.1 70.8c-1.4 1.5-3 1.9-4.1 2s-2.8-.1-4.3-1.5c-1.4-1.2-2.1-3-2-4.8c3.7-60.2-14.3-128.1-53.7-202C555.3 171 510 123.1 453.4 89.7l-41.3-24.3c-5.4-3.2-12.3 1-12 7.3l2.2 48c1.5 32.8-2.3 61.8-11.3 85.9c-11 29.5-26.8 56.9-47 81.5a295.6 295.6 0 0 1-47.5 46.1a352.6 352.6 0 0 0-100.3 121.5A347.75 347.75 0 0 0 160 610c0 47.2 9.3 92.9 27.7 136a349.4 349.4 0 0 0 75.5 110.9c32.4 32 70 57.2 111.9 74.7C418.5 949.8 464.5 959 512 959s93.5-9.2 136.9-27.3A348.6 348.6 0 0 0 760.8 857c32.4-32 57.8-69.4 75.5-110.9a344.2 344.2 0 0 0 27.7-136c0-48.8-10-96.2-29.9-140.9M713 808.5c-53.7 53.2-125 82.4-201 82.4s-147.3-29.2-201-82.4c-53.5-53.1-83-123.5-83-198.4c0-43.5 9.8-85.2 29.1-124c18.8-37.9 46.8-71.8 80.8-97.9a349.6 349.6 0 0 0 58.6-56.8c25-30.5 44.6-64.5 58.2-101a240 240 0 0 0 12.1-46.5c24.1 22.2 44.3 49 61.2 80.4c33.4 62.6 48.8 118.3 45.8 165.7a74.01 74.01 0 0 0 24.4 59.8a73.36 73.36 0 0 0 53.4 18.8c19.7-1 37.8-9.7 51-24.4c13.3-14.9 24.8-30.1 34.4-45.6c14 17.9 25.7 37.4 35 58.4c15.9 35.8 24 73.9 24 113.1c0 74.9-29.5 145.4-83 198.4"></path>
                                            </svg>
                                            <span>Day streak</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Column (5 cols): Top Coding Accounts */}
                            <div className="col-span-5 flex flex-col justify-between space-y-2.5">
                                <div className="space-y-2 flex-1 flex flex-col justify-between">
                                    <div className="flex items-center justify-between text-xs font-black text-neutral-400 px-1">
                                        <span className="uppercase tracking-wider text-[11px]">Top Coding Accounts</span>
                                        <span className="text-[11px] text-neutral-400 font-mono">
                                            {topPlatforms.length} displayed
                                        </span>
                                    </div>

                                    {topPlatforms.length === 0 ? (
                                        <div className="rounded-2xl bg-[#121824]/90 border border-white/10 p-4 text-center flex-1 flex items-center justify-center">
                                            <p className="text-xs text-neutral-400">No platforms selected.</p>
                                        </div>
                                    ) : (
                                        topPlatforms.slice(0, 3).map((plat) => {
                                            if (plat.isGitHub || plat.id === "github") {
                                                return (
                                                    <div
                                                        key="github"
                                                        className="rounded-2xl bg-[#121824]/90 border border-white/10 px-4 py-3 flex items-center justify-between gap-3 shadow-md flex-1"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 text-white p-1.5">
                                                                {getPortalIcon("github", "w-5 h-5")}
                                                            </div>
                                                            <div>
                                                                <span className="text-sm font-black text-white block leading-none">GitHub</span>
                                                                <span className="text-xs font-mono text-neutral-400 block mt-1">@{plat.username || githubStats.username}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-right">
                                                            <div className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-xl border border-white/5">
                                                                <FolderGit2 className="w-3.5 h-3.5 text-emerald-400" />
                                                                <div className="text-left">
                                                                    <span className="text-xs font-black text-white block leading-tight font-mono">
                                                                        {(plat.publicRepos ?? githubStats.publicRepos).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-[9px] text-neutral-400 uppercase font-bold">Repos</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-xl border border-white/5">
                                                                <GitCommit className="w-3.5 h-3.5 text-emerald-400" />
                                                                <div className="text-left">
                                                                    <span className="text-xs font-black text-white block leading-tight font-mono">
                                                                        {(plat.contributionsOrCommits ?? githubStats.contributionsOrCommits).toLocaleString()}
                                                                    </span>
                                                                    <span className="text-[9px] text-neutral-400 uppercase font-bold">Commits</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            return (
                                                <div
                                                    key={plat.id}
                                                    className="rounded-2xl bg-[#121824]/90 border border-white/10 px-4 py-3 flex items-center justify-between gap-3 shadow-md flex-1"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 p-1.5">
                                                            {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-black text-white leading-none truncate">
                                                                {plat.name}
                                                            </h4>
                                                            <span className="text-xs font-mono text-neutral-400 truncate block mt-1">
                                                                @{plat.username}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <span className="text-xs font-mono font-black text-white bg-white/10 px-3.5 py-1.5 rounded-xl">
                                                        {plat.solvedCount.toLocaleString()} solved
                                                    </span>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Connected Platforms Dock (Image 2) & Footer */}
                    <div className="h-14 bg-[#070a0e] border-t border-white/10 px-9 flex items-center justify-between flex-shrink-0">
                        {/* Connected platform logos row matching Image 2 */}
                        <div className="flex items-center gap-3 min-w-0">
                            <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-neutral-400 mr-1 hidden sm:inline-block">
                                Connected:
                            </span>
                            <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none">
                                {connectedList.length > 0 ? (
                                    connectedList.map((plat) => (
                                        <div
                                            key={plat.id}
                                            className="w-9 h-9 rounded-xl bg-white shadow-md flex items-center justify-center p-1.5 transition-transform hover:scale-105 cursor-pointer flex-shrink-0"
                                            title={`${plat.name} (@${plat.username})`}
                                        >
                                            {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                        </div>
                                    ))
                                ) : (
                                    <span className="text-xs text-neutral-500 font-mono">No platforms linked</span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3.5 text-xs text-neutral-400 flex-shrink-0">
                            <span className="font-mono text-neutral-300 truncate max-w-sm flex items-center gap-1">
                                <svg xmlns="http://www.w3.org/2000/svg" width="1.3em" height="1.3em" viewBox="0 0 24 24">
                                    <path d="M0 0h24v24H0z" fill="none" />
                                    <g fill="none">
                                        <path fill="currentColor" d="M10.48 4.83a4.95 4.95 0 0 1 4.92 4.4h1.91a4.97 4.97 0 0 1 0 9.94h-3.77a4.97 4.97 0 0 1-4.94-4.44H6.67a4.95 4.95 0 1 1 0-9.9z" opacity=".2" />
                                        <rect width="9.94" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.97" transform="matrix(0 -1 -1 0 22.28 19.17)" />
                                        <rect width="9.9" height="13.71" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" rx="4.95" transform="matrix(0 -1 -1 0 15.43 14.73)" />
                                    </g>
                                </svg>
                                {displayUrl}
                            </span>
                            <span className="text-neutral-700">•</span>
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="font-semibold text-neutral-300">Live • {todayDate}</span>
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                /* ==================== BACK FACE ==================== */
                <>
                    {/* Top Header */}
                    <div className="h-[110px] w-full px-9 pt-6 flex items-center justify-between border-b border-white/10 bg-[#0e131b]">
                        <div className="flex items-center gap-3.5">
                            <div className="w-11 h-11 rounded-2xl  flex items-center justify-center ">


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
                                <span className="text-2xl font-black text-white tracking-tight leading-none block">Orbix</span>
                                <span className="text-xs font-black text-white tracking-widest uppercase mt-0.5 block">Scan To Explore</span>
                            </div>
                        </div>

                        {/* Top Right: Gold SCAN ME Capsule Badge */}
                        <div
                            className="px-6 py-2 rounded-full font-black text-xs uppercase tracking-wider text-black shadow-lg flex items-center gap-1.5"
                            style={{ backgroundColor: theme.accentColor }}
                        >
                            <span>SCAN ME</span>
                        </div>
                    </div>

                    {/* Middle Section: QR Code Left + Find Me On Right */}
                    <div className="px-12 py-7 flex-1 flex items-center justify-between gap-12">
                        {/* Left: Scannable QR Code */}
                        <div className="flex flex-col items-center gap-3.5">
                            <div className="p-3 bg-white rounded-3xl shadow-2xl">
                                <OrbixCardQR value={publicProfileUrl} size={240} showLogo={true} />
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-black text-white tracking-tight uppercase">
                                    {displayName}
                                </h3>
                                <p className="text-xs text-neutral-400 font-medium">
                                    Scan with camera to open live coding portfolio
                                </p>
                            </div>
                        </div>

                        {/* Right: GitHub Contribution Activity Table for last 3-4 months */}
                        <div className="flex-1 max-w-[660px]">
                            <GitHubContributionTable
                                username={username}
                                githubUsername={githubStats.username}
                                totalContributions={githubStats.contributionsOrCommits}
                                publicRepos={githubStats.publicRepos}
                                dayStreak={stats.dayStreak}
                                activeDays={stats.activeDays}
                                variant="compact"
                            />
                        </div>
                    </div>

                    {/* Bottom Connected Platforms Dock on Back Face */}
                    <div className="h-14 bg-[#070a0e] border-t border-white/10 px-9 flex items-center justify-between flex-shrink-0">
                        <div className="flex items-center gap-2.5 overflow-x-auto py-1 scrollbar-none">
                            {connectedList.map((plat) => (
                                <div
                                    key={plat.id}
                                    className="w-9 h-9 rounded-xl bg-white shadow-md flex items-center justify-center p-1.5 transition-transform hover:scale-105 cursor-pointer flex-shrink-0"
                                    title={`${plat.name} (@${plat.username})`}
                                >
                                    {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                </div>
                            ))}
                        </div>
                        <div className="flex items-center gap-3.5 text-xs text-neutral-400 flex-shrink-0">
                            <span className="font-mono text-neutral-300 truncate max-w-sm flex items-center">
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
                            <div className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-amber-400" />
                                <span className="font-semibold text-neutral-300">Live • {todayDate}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

