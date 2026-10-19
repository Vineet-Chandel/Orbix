import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { Repeat, Code2, GitBranch } from "lucide-react";
import { fetchPublicProfile, type PublicProfileData } from "../../utils/profileApi";
import { LinkedInCard } from "./CardStudio/LinkedInCard";
import { CARD_THEMES } from "./CardStudio/types";
import {
    aggregateCodingStats,
    getCoderType,
    resolveShowcasedPlatforms,
    resolveShowcasedContests,
    getAllConnectedPlatforms,
    extractGitHubStats,
} from "../../utils/cardStatsAggregator";
import { CodingSubmissionsTable } from "../Dashboard/CodingSubmissionsTable";
import { PracticeMonthlyStatsCards } from "../Dashboard/PracticeMonthlyStatsCards";
import { PracticeAnalyticsSection } from "../Dashboard/PracticeAnalytics/PracticeAnalyticsSection";
import { ContestPerformanceSection } from "../Dashboard/ContestPerformanceSection";
import { DevelopmentContributionsTable } from "../Dashboard/DevelopmentContributionsTable";
import { DevelopmentAnalyticsSection } from "../Dashboard/DevelopmentAnalytics/DevelopmentAnalyticsSection";

export default function PublicProfilePage() {
    const { username } = useParams<{ username: string }>();

    const [profile, setProfile] = useState<PublicProfileData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [cardFace, setCardFace] = useState<"front" | "back">("front");
    const [activeField, setActiveField] = useState<"practice" | "development">("practice");

    // Dynamic scale measurement for responsive LinkedInCard rendering
    const cardContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(1200);

    useEffect(() => {
        const updateWidth = () => {
            if (cardContainerRef.current) {
                const w = cardContainerRef.current.getBoundingClientRect().width;
                if (w > 0) setContainerWidth(w);
            }
        };

        updateWidth();
        window.addEventListener("resize", updateWidth);
        const ro = new ResizeObserver(updateWidth);
        if (cardContainerRef.current) ro.observe(cardContainerRef.current);

        return () => {
            window.removeEventListener("resize", updateWidth);
            ro.disconnect();
        };
    }, [profile]);

    const cardScale = Math.min(containerWidth / 1200, 1);

    useEffect(() => {
        if (!username) {
            setError("No username specified");
            setLoading(false);
            return;
        }

        let isMounted = true;
        setLoading(true);
        setError(null);

        fetchPublicProfile(username)
            .then((data) => {
                if (isMounted) {
                    setProfile(data);
                    setLoading(false);
                    // Update document title for SEO
                    document.title = `${data.displayName} (@${data.username}) — Orbix Profile`;
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    setError(err.message || "Failed to load profile");
                    setLoading(false);
                    document.title = "Profile Not Found — Orbix";
                }
            });

        return () => {
            isMounted = false;
        };
    }, [username]);

    // Build connectedPortals dictionary from profile platforms
    const connectedPortals: Record<string, any> = useMemo(() => {
        const map: Record<string, any> = {};
        if (profile?.platforms) {
            for (const p of profile.platforms) {
                const key = (p.portal || "").toLowerCase().trim();
                if (!key) continue;
                map[key] = {
                    portal: key,
                    username: p.portalUsername,
                    link: p.link,
                    verified: p.verified,
                    displayName: p.displayName,
                    avatar: p.avatarUrl,
                    avatarUrl: p.avatarUrl,
                    stats: p.stats,
                    isPublic: p.isPublic,
                    lastSyncStatus: p.lastSyncStatus,
                    lastSyncAt: p.lastSyncAt,
                };
            }
        }
        return map;
    }, [profile?.platforms]);

    const userFallback = profile?.username || "developer";
    const stats = useMemo(() => aggregateCodingStats(connectedPortals), [connectedPortals]);
    const coderType = useMemo(() => getCoderType(stats.totalSolved), [stats.totalSolved]);
    const showcasedPlatforms = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, [], 3, false, userFallback),
        [connectedPortals, userFallback]
    );
    const showcasedContests = useMemo(
        () => resolveShowcasedContests([], connectedPortals, [], 3, userFallback),
        [connectedPortals, userFallback]
    );
    const allConnectedPlatforms = useMemo(() => getAllConnectedPlatforms(connectedPortals), [connectedPortals]);
    const githubStats = useMemo(() => extractGitHubStats(connectedPortals, userFallback), [connectedPortals, userFallback]);

    // Loading Skeleton
    if (loading) {
        return (
            <div className="min-h-screen bg-[#F0F2F6] flex flex-col items-center justify-center p-4">
                <div className="w-full max-w-4xl rounded-3xl bg-white border border-neutral-200/80 p-8 shadow-xs animate-pulse">
                    <div className="h-64 bg-neutral-200 rounded-3xl mb-6" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="h-28 bg-neutral-100 rounded-2xl" />
                        <div className="h-28 bg-neutral-100 rounded-2xl" />
                    </div>
                </div>
            </div>
        );
    }

    // Error / Private Profile State
    if (error || !profile) {
        return (
            <div className="min-h-screen bg-[#F0F2F6] flex flex-col items-center justify-center p-4 text-center">
                <div className="w-full max-w-md rounded-3xl bg-white border border-neutral-200 p-8 shadow-sm">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 text-neutral-400 mx-auto flex items-center justify-center mb-4">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.75">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-black text-neutral-900 tracking-tight mb-2">
                        Profile Not Found
                    </h2>
                    <p className="text-xs text-neutral-500 mb-6 leading-relaxed">
                        The developer profile '@{username}' could not be found or does not exist.
                    </p>
                    <div className="flex items-center justify-center gap-3">
                        <Link
                            to="/"
                            className="px-5 py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                        >
                            Return to Orbix
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const avatarSrc =
        profile.photoUrl ||
        profile.avatarUrl ||
        `https://ui-avatars.com/api/?name=${encodeURIComponent(
            profile.displayName
        )}&background=0c1017&color=fff&size=256&bold=true`;

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white pb-16">
            {/* Minimal Orbix Button Only — Navigates to "/" */}
            <div className="w-full px-4 sm:px-8 pt-4 pb-2 flex items-center">
                <Link
                    to="/"
                    className="inline-flex items-center gap-2 group cursor-pointer select-none"
                    title="Orbix — Home"
                >
                    <div className="w-7 h-7 rounded-xl bg-black flex items-center justify-center text-white font-black text-sm shadow-xs transition-transform group-hover:scale-105">
                        O
                    </div>
                    <span className="font-extrabold text-neutral-900 text-base tracking-tight group-hover:text-black transition-colors">
                        Orbix
                    </span>
                </Link>
            </div>

            {/* Profile Showcase Container - Full Width */}
            <main className="w-full px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-16 min-w-0">
                {/* Official LinkedIn Developer Card (Replaces old Profile Owner View card) */}
                <div className="w-full max-w-[1200px] mx-auto flex flex-col items-center mb-8">
                    {/* Header Strip with Flip Toggle */}
                    <div className="w-full flex items-center justify-between mb-3 px-1">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                                Developer Profile Card
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] font-bold border border-emerald-500/20">
                                Verified
                            </span>
                            {profile.isOwner && (
                                <span className="px-2 py-0.5 rounded-full bg-neutral-900 text-white text-[10px] font-bold">
                                    You
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => setCardFace((f) => (f === "front" ? "back" : "front"))}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                            title="Flip to view card back with QR code"
                        >
                            <Repeat className="w-3.5 h-3.5" />
                            <span>{cardFace === "front" ? "Flip To Back" : "Flip To Front"}</span>
                        </button>
                    </div>

                    {/* Scaled LinkedIn Card Container */}
                    <div
                        ref={cardContainerRef}
                        className="w-full flex justify-center overflow-hidden rounded-[28px] shadow-2xl"
                        style={{ height: 627 * cardScale }}
                    >
                        <div
                            style={{
                                width: 1200,
                                height: 627,
                                transform: `scale(${cardScale})`,
                                transformOrigin: "top center",
                            }}
                        >
                            <LinkedInCard
                                user={{
                                    ...profile,
                                    photoUrl: avatarSrc,
                                }}
                                stats={stats}
                                coderType={coderType}
                                topPlatforms={showcasedPlatforms}
                                allConnectedPlatforms={allConnectedPlatforms}
                                githubStats={githubStats}
                                includeGitHub={false}
                                theme={CARD_THEMES.indigo}
                                face={cardFace}
                                publicProfileUrl={window.location.href}
                                connectedPortals={connectedPortals}
                                topContests={showcasedContests}
                            />
                        </div>
                    </div>
                </div>

                {/* Optional Bio & Extra Details Strip if bio/location/website provided */}
                {(profile.bio || profile.location || profile.website) && (
                    <div className="w-full max-w-[1200px] mx-auto rounded-2xl bg-white border border-neutral-200/90 p-5 mb-8 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        {profile.bio && (
                            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed max-w-2xl whitespace-pre-line">
                                {profile.bio}
                            </p>
                        )}
                        <div className="flex items-center gap-4 text-xs font-medium text-neutral-500 flex-wrap flex-shrink-0">
                            {profile.location && (
                                <span className="flex items-center gap-1.5">
                                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span>{profile.location}</span>
                                </span>
                            )}
                            {profile.website && (
                                <a
                                    href={profile.website}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-neutral-800 hover:text-indigo-600 font-semibold underline underline-offset-2 transition-colors"
                                >
                                    <svg className="w-4 h-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                                    </svg>
                                    <span>{profile.website.replace(/^https?:\/\//, "")}</span>
                                </a>
                            )}
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* PRACTICE & DEVELOPMENT ACTIVITY & PERFORMANCE SECTION */}
                {/* ========================================================================= */}
                <section className="w-full space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1">
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                                <span>Activity & Performance</span>
                            </h2>
                            <p className="text-xs text-neutral-500 font-medium">
                                Multi-platform coding submissions, contest performance, and developer contributions.
                            </p>
                        </div>

                        {/* Two Dashboard Fields Switcher: Practice & Development */}
                        <div className="inline-flex items-center p-1 rounded-2xl bg-white border border-neutral-200/90 shadow-xs self-start sm:self-auto">
                            <button
                                type="button"
                                onClick={() => setActiveField("practice")}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeField === "practice"
                                        ? "bg-black text-white shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100/80"
                                }`}
                            >
                                <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Practice</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveField("development")}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    activeField === "development"
                                        ? "bg-black text-white shadow-sm"
                                        : "text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100/80"
                                }`}
                            >
                                <GitBranch className="w-3.5 h-3.5 text-indigo-400" />
                                <span>Development</span>
                            </button>
                        </div>
                    </div>

                    {/* Practice Field: Multi-Platform Coding Submissions (Excluding GitHub), Monthly Stats, DSA & Topic Analytics, and Contest Performance */}
                    {activeField === "practice" && (
                        <div className="w-full animate-fadeIn space-y-6">
                            <CodingSubmissionsTable
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                            <PracticeMonthlyStatsCards
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                            <PracticeAnalyticsSection
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                            <ContestPerformanceSection
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                        </div>
                    )}

                    {/* Development Field: Development Metrics, Languages & Contributions (GitHub) */}
                    {activeField === "development" && (
                        <div className="w-full animate-fadeIn space-y-6">
                            <DevelopmentContributionsTable
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                            <DevelopmentAnalyticsSection
                                connectedPortals={connectedPortals}
                                username={profile.username}
                            />
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}
