import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Repeat, Code2, GitBranch, Briefcase, Mail, MapPin, ExternalLink, Share2, CreditCard, Check, ArrowRight, FileText, Download, Eye, X, GraduationCap, ShieldCheck } from "lucide-react";
import { fetchPublicProfile, type PublicProfileData } from "../../utils/profileApi";
import { isDemoProfileUsername, demoPublicProfile, demoConnectedPortals } from "../../data/demoProfileData";
import { LinkedInCard } from "./CardStudio/LinkedInCard";
import { HireMeModal } from "./HireMeModal";
import { GetTheCardModal } from "./GetTheCardModal";
import { CARD_THEMES } from "./CardStudio/types";
import { useToast } from "../../context/ToastContext";
import { getPlatformIcon, sanitizePlatformUrl } from "../../utils/platformLinks";
import {
    aggregateCodingStats,
    getCoderType,
    resolveShowcasedPlatforms,
    resolveShowcasedContests,
    getAllConnectedPlatforms,
    extractGitHubStats,
} from "../../utils/cardStatsAggregator";
import { CodingSubmissionsTable } from "../Dashboard/CodingSubmissionsTable";
import { PracticeAnalyticsSection } from "../Dashboard/PracticeAnalytics/PracticeAnalyticsSection";
import { ContestPerformanceSection } from "../Dashboard/ContestPerformanceSection";
import { DevelopmentContributionsTable } from "../Dashboard/DevelopmentContributionsTable";
import { DevelopmentAnalyticsSection } from "../Dashboard/DevelopmentAnalytics/DevelopmentAnalyticsSection";

export const getCleanDisplayHandle = (url: string, label?: string, platform?: string): string => {
    try {
        const clean = url.replace(/^https?:\/\//, "").replace(/\/$/, "");
        const lower = (platform || label || "").toLowerCase();

        // GitHub: github.com/username -> @username
        if (lower.includes("github") || clean.includes("github.com/")) {
            const parts = clean.split("/");
            if (parts.length >= 2 && parts[1]) return `@${parts[1]}`;
        }
        // LeetCode: leetcode.com/u/username or leetcode.com/username -> @username
        if (lower.includes("leetcode") || clean.includes("leetcode.com/")) {
            const match = clean.match(/leetcode\.com\/(?:u\/)?([^\/?#]+)/);
            if (match && match[1]) return `@${match[1]}`;
        }
        // LinkedIn: linkedin.com/in/username -> in/username
        if (lower.includes("linkedin") || clean.includes("linkedin.com/")) {
            const match = clean.match(/linkedin\.com\/in\/([^\/?#]+)/);
            if (match && match[1]) return `in/${match[1]}`;
        }
        // Codeforces: codeforces.com/profile/username -> @username
        if (lower.includes("codeforces") || clean.includes("codeforces.com/")) {
            const match = clean.match(/codeforces\.com\/profile\/([^\/?#]+)/);
            if (match && match[1]) return `@${match[1]}`;
        }
        // Twitter / X: x.com/username or twitter.com/username -> @username
        if (lower.includes("twitter") || lower.includes("x.com") || clean.includes("twitter.com/") || clean.includes("x.com/")) {
            const parts = clean.split("/");
            if (parts.length >= 2 && parts[1]) return `@${parts[1]}`;
        }
        // General website/portfolio: display host only (e.g. orbix.dev or myportfolio.io)
        const host = clean.split("/")[0] || clean;
        return host.replace(/^www\./, "");
    } catch {
        return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
};

export interface PublicProfilePageProps {
    overrideUsername?: string;
    isEmbedded?: boolean;
}

export default function PublicProfilePage({ overrideUsername, isEmbedded = false }: PublicProfilePageProps = {}) {
    const params = useParams<{ username: string }>();
    const username = overrideUsername || params.username;
    const toast = useToast();
    const isDemo = isDemoProfileUsername(username);

    const [profile, setProfile] = useState<PublicProfileData | null>(() => {
        if (isDemoProfileUsername(username)) {
            return demoPublicProfile;
        }
        return null;
    });
    const [loading, setLoading] = useState(() => !isDemoProfileUsername(username));
    const [error, setError] = useState<string | null>(null);
    const [cardFace, setCardFace] = useState<"front" | "back">("front");
    const [activeField, setActiveField] = useState<"practice" | "development">("practice");
    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isResumePreviewOpen, setIsResumePreviewOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

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

        if (isDemoProfileUsername(username)) {
            setProfile(demoPublicProfile);
            setLoading(false);
            setError(null);
            if (!isEmbedded) {
                document.title = `${demoPublicProfile.displayName} (@${demoPublicProfile.username}) — Orbix Demo Profile`;
            }
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
                    if (!isEmbedded) {
                        document.title = `${data.displayName} (@${data.username}) — Orbix Profile`;
                    }
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    setError(err.message || "Failed to load profile");
                    setLoading(false);
                    if (!isEmbedded) {
                        document.title = "Profile Not Found — Orbix";
                    }
                }
            });

        return () => {
            isMounted = false;
        };
    }, [username]);

    // Build connectedPortals dictionary from profile platforms (or enhanced demo portals)
    const connectedPortals: Record<string, any> = useMemo(() => {
        if (isDemo) {
            return demoConnectedPortals;
        }

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
    }, [profile?.platforms, isDemo]);

    const userFallback = profile?.username || "developer";
    const profilePageUrl = typeof window !== "undefined" ? `${window.location.origin}/profile/u/${username || userFallback}` : "";
    const stats = useMemo(() => aggregateCodingStats(connectedPortals), [connectedPortals]);
    const coderType = useMemo(() => getCoderType(stats.totalSolved), [stats.totalSolved]);
    const showcasedPlatforms = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, [], 3, false, userFallback),
        [connectedPortals, userFallback]
    );
    const showcasedPlatformsStory = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, [], 5, false, userFallback),
        [connectedPortals, userFallback]
    );
    const showcasedContests = useMemo(
        () => resolveShowcasedContests([], connectedPortals, [], 3, userFallback),
        [connectedPortals, userFallback]
    );
    const allConnectedPlatforms = useMemo(() => getAllConnectedPlatforms(connectedPortals), [connectedPortals]);
    const githubStats = useMemo(() => extractGitHubStats(connectedPortals, userFallback), [connectedPortals, userFallback]);

    const handleShareProfile = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(
            () => {
                setIsCopied(true);
                toast.success("Profile link copied to clipboard!", { title: "Copied" });
                setTimeout(() => setIsCopied(false), 2000);
            },
            () => {
                try {
                    const input = document.createElement("input");
                    input.value = url;
                    document.body.appendChild(input);
                    input.select();
                    document.execCommand("copy");
                    document.body.removeChild(input);
                    setIsCopied(true);
                    toast.success("Profile link copied to clipboard!", { title: "Copied" });
                    setTimeout(() => setIsCopied(false), 2000);
                } catch {
                    toast.error("Failed to copy link", { title: "Error" });
                }
            }
        );
    };

    const displayLinks = useMemo(() => {
        let raw = profile?.links;
        if (typeof raw === "string") {
            try {
                raw = JSON.parse(raw);
            } catch {
                raw = [];
            }
        }
        if (Array.isArray(raw)) {
            return raw.filter((l) => l && l.url && l.url.trim()).slice(0, 4);
        }
        const legacy: Array<{ label: string; url: string; platform?: string }> = [];
        if (profile?.linkedin) legacy.push({ label: "LinkedIn", url: profile.linkedin, platform: "linkedin" });
        if (profile?.github) legacy.push({ label: "GitHub", url: profile.github, platform: "github" });
        if (profile?.website) legacy.push({ label: "Portfolio", url: profile.website });
        if (profile?.customLink) legacy.push({ label: "Link", url: profile.customLink });
        return legacy.slice(0, 4);
    }, [profile]);

    // Smart Layout Measurement:
    // Determine whether the right details card exceeds the LinkedIn 3D card height.
    const rightDetailsRef = useRef<HTMLDivElement>(null);
    const [rightDetailsHeight, setRightDetailsHeight] = useState<number>(0);
    const [isDesktop, setIsDesktop] = useState<boolean>(() => {
        if (typeof window !== "undefined") {
            return window.innerWidth >= 1024;
        }
        return true;
    });

    useEffect(() => {
        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 1024);
        };
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        const updateDetailsHeight = () => {
            if (rightDetailsRef.current) {
                const h = rightDetailsRef.current.offsetHeight;
                if (h > 0) setRightDetailsHeight(h);
            }
        };

        updateDetailsHeight();
        window.addEventListener("resize", updateDetailsHeight);
        const ro = new ResizeObserver(updateDetailsHeight);
        if (rightDetailsRef.current) ro.observe(rightDetailsRef.current);

        return () => {
            window.removeEventListener("resize", updateDetailsHeight);
            ro.disconnect();
        };
    }, [profile, displayLinks.length]);

    const linkedInCardHeight = 627 * cardScale;
    const estimatedLinksInRightHeight = displayLinks.length > 0 ? 45 + displayLinks.length * 62 : 0;
    const effectiveDetailsHeight = rightDetailsHeight > 0 ? rightDetailsHeight : (
        120 +
        (profile?.bio ? Math.min(profile.bio.length * 0.45, 160) : 30) +
        (profile?.location ? 28 : 0) +
        (profile?.skills && profile.skills.length > 0 ? 70 : 0) +
        (profile?.isOpenToWork || profile?.isHireable ? 45 : 0) +
        45 +
        (profile?.resumeUrl && profile?.isResumePublic !== false ? 55 : 0)
    );
    const projectedRightHeight = effectiveDetailsHeight + estimatedLinksInRightHeight;

    // When the right card height exceeds the LinkedIn card height, switch links to sit cleanly below the LinkedIn card.
    const shouldMoveLinksToLeft =
        isDesktop && displayLinks.length > 0 && projectedRightHeight > linkedInCardHeight;

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
        <div className={`${isEmbedded ? "pb-4 embedded-showcase-container bg-[#FAF6EE]" : "min-h-screen pb-16 bg-[#F0F2F6]"} text-neutral-900 font-sans antialiased selection:bg-neutral-900 selection:text-white`}>
            {/* Minimal Orbix Button Only — Navigates to "/" (Hidden when embedded in hero showcase) */}
            {!isEmbedded && (
                <div className="w-full px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between">
                    <Link
                        to="/"
                        className="inline-flex items-center gap-2 group cursor-pointer select-none"
                        title="Orbix — Home"
                    >
                        <div className="w-14 h-14 flex items-center justify-center text-white font-black text-sm shadow-xs transition-transform group-hover:scale-105">
                            <svg className="w-full h-full text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="black" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="black" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="black" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="black" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="black" />
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="black" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="black" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="black" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="black" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="black" />
                            </svg>
                        </div>
                        <span className="font-extrabold text-neutral-900 text-3xl tracking-tight group-hover:text-black transition-colors">
                            Orbix
                        </span>
                    </Link>
                    {/* Navbar Action Button: Black button with white text displaying "Demo Profile" with redirection to Create Profile */}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        {isDemo ? (
                            <Link
                                to="/auth/signup"
                                className="inline-flex items-center gap-2 sm:gap-2.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-xl transition-all duration-200 transform active:scale-95 cursor-pointer group select-none"
                                title="Demo Profile — Click to create your own Orbix profile"
                            >
                                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                                <span className="tracking-tight">Demo Profile</span>
                                <span className="hidden sm:inline w-px h-3.5 bg-neutral-700 mx-0.5" />
                                <span className="hidden sm:inline font-medium text-neutral-300 group-hover:text-white transition-colors">
                                    Create your profile
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-neutral-400 group-hover:text-white group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                            </Link>
                        ) : (
                            <Link
                                to="/auth/signup"
                                className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer select-none"
                            >
                                <span>Create your profile</span>
                                <ArrowRight className="w-3.5 h-3.5 text-neutral-300" />
                            </Link>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Showcase Container - Full Width */}
            <main className={`w-full px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 ${isEmbedded ? "pb-4" : "pb-16"} min-w-0`}>
                {/* 3/4 Main Card + 1/4 Sidebar Card Section */}
                <div className="w-full max-w-[1600px] mx-auto mb-10">
                    {/* Header Strip with Controls */}
                    <div className="w-full flex items-center justify-between mb-3 px-1 flex-wrap gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-mono font-bold uppercase tracking-wider text-neutral-500">
                                Developer Profile Card
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => setCardFace((f) => (f === "front" ? "back" : "front"))}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs active:scale-95"
                                title="Flip to view card back with QR code"
                            >
                                <Repeat className={`w-3.5 h-3.5 transition-transform duration-500 ${cardFace === "back" ? "rotate-180" : ""}`} />
                                <span>{cardFace === "front" ? "Flip To Back" : "Flip To Front"}</span>
                            </button>
                        </div>
                    </div>

                    {/* Split Layout: 3/4 Main Card + 1/4 Details, Bio & Links Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        {/* LEFT (3/4 Screen Width on Large Screens): Main Developer Card with 3D Flip Animation */}
                        <div ref={cardContainerRef} className="lg:col-span-9 flex flex-col justify-start items-center min-w-0">
                            {/* 3D Motion Card Container (Matches Card.tsx from Main Landing Page) */}
                            <div style={{ perspective: 1800 }} className="w-full flex justify-center">
                                <motion.div
                                    className="relative cursor-pointer select-none"
                                    style={{
                                        width: 1200 * cardScale,
                                        height: 627 * cardScale,
                                        transformStyle: "preserve-3d",
                                    }}
                                    animate={{ rotateY: cardFace === "back" ? 180 : 0 }}
                                    transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
                                    onClick={() => setCardFace((f) => (f === "front" ? "back" : "front"))}
                                    role="button"
                                    tabIndex={0}
                                    aria-label="Flip Developer Profile Card in 3D"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            setCardFace((f) => (f === "front" ? "back" : "front"));
                                        }
                                    }}
                                >
                                    {/* Front Face */}
                                    <div
                                        className="absolute inset-0 w-full h-full rounded-[26px] sm:rounded-[32px] overflow-hidden border border-neutral-800 shadow-2xl"
                                        style={{
                                            backfaceVisibility: "hidden",
                                            WebkitBackfaceVisibility: "hidden",
                                            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.9), 0 0 50px -10px rgba(99, 102, 241, 0.35)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 1200,
                                                height: 627,
                                                transform: `scale(${cardScale})`,
                                                transformOrigin: "top left",
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
                                                face="front"
                                                publicProfileUrl={profilePageUrl}
                                                connectedPortals={connectedPortals}
                                                topContests={showcasedContests}
                                                showSocialLinks={false}
                                                onHireMeClick={() => setIsHireModalOpen(true)}
                                            />
                                        </div>
                                    </div>

                                    {/* Back Face (Rotated 180 deg) */}
                                    <div
                                        className="absolute inset-0 w-full h-full rounded-[26px] sm:rounded-[32px] overflow-hidden border border-neutral-800 shadow-2xl"
                                        style={{
                                            backfaceVisibility: "hidden",
                                            WebkitBackfaceVisibility: "hidden",
                                            transform: "rotateY(180deg)",
                                            boxShadow: "0 30px 70px -15px rgba(0, 0, 0, 0.9), 0 0 50px -10px rgba(99, 102, 241, 0.35)",
                                        }}
                                    >
                                        <div
                                            style={{
                                                width: 1200,
                                                height: 627,
                                                transform: `scale(${cardScale})`,
                                                transformOrigin: "top left",
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
                                                face="back"
                                                publicProfileUrl={profilePageUrl}
                                                connectedPortals={connectedPortals}
                                                topContests={showcasedContests}
                                                showSocialLinks={false}
                                                onHireMeClick={() => setIsHireModalOpen(true)}
                                            />
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Smart Connected Links Strip (Rendered below LinkedIn Card when right card is taller) */}
                            {shouldMoveLinksToLeft && displayLinks.length > 0 && (
                                <div
                                    style={{ width: 1200 * cardScale, maxWidth: "100%" }}
                                    className="mt-8 sm:mt-10 w-full relative z-10"
                                >
                                    <div className={`grid ${displayLinks.length === 1 ? "grid-cols-1" : displayLinks.length === 2 ? "grid-cols-1 sm:grid-cols-2" : displayLinks.length === 3 ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"} gap-3.5 sm:gap-4`}>
                                        {displayLinks.map((item, idx) => {
                                            const formattedUrl = sanitizePlatformUrl(item.url);
                                            const cleanHandle = getCleanDisplayHandle(item.url, item.label, item.platform);
                                            return (
                                                <a
                                                    key={idx}
                                                    href={formattedUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-white hover:bg-neutral-50 border border-neutral-200/90 hover:border-neutral-300 text-neutral-900 transition-all duration-200 group shadow-sm hover:shadow-md cursor-pointer min-w-0"
                                                    title={formattedUrl}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-xl bg-neutral-100 border border-neutral-200/90 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 group-hover:bg-neutral-200/60 transition-all">
                                                            {getPlatformIcon(
                                                                item.platform || item.label || formattedUrl,
                                                                "w-5 h-5 flex-shrink-0"
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 text-left">
                                                            <span className="text-xs sm:text-sm font-extrabold text-neutral-900 block truncate group-hover:text-black tracking-tight">
                                                                {item.label || item.platform || "Link"}
                                                            </span>
                                                            <span className="text-[11px] sm:text-xs font-mono text-neutral-600 font-semibold block truncate group-hover:text-neutral-900">
                                                                {cleanHandle}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-neutral-400 group-hover:text-neutral-900 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all flex-shrink-0" />
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT (1/4 Screen Width on Large Screens): Bio, Location & Connected Links Card */}
                        <div className="lg:col-span-3 flex flex-col min-w-0">
                            <div className={`w-full rounded-[28px] bg-white border border-neutral-200/90 shadow-sm p-5 sm:p-6 flex flex-col ${shouldMoveLinksToLeft ? "justify-start space-y-4" : "h-full justify-between space-y-5"}`}>
                                <div ref={rightDetailsRef} className="space-y-4">
                                    {/* Card Subheader */}
                                    <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded-full bg-neutral-900" />
                                            <h3 className="text-xs font-black tracking-wider uppercase text-neutral-800">
                                                Developer Info
                                            </h3>
                                        </div>
                                        <span className="text-[11px] font-mono text-neutral-400">
                                            @{profile.username}
                                        </span>
                                    </div>

                                    {/* Bio */}
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1">
                                            Bio
                                        </span>
                                        {profile.bio ? (
                                            <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-line">
                                                {profile.bio}
                                            </p>
                                        ) : profile.headline ? (
                                            <p className="text-xs text-neutral-600 leading-relaxed">
                                                {profile.headline}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-neutral-400 italic">
                                                No biography provided.
                                            </p>
                                        )}
                                    </div>

                                    {/* Location */}
                                    {profile.location && (
                                        <div className="flex items-center gap-2 pt-1 text-xs font-semibold text-neutral-700">
                                            <MapPin className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                                            <span className="truncate">{profile.location}</span>
                                        </div>
                                    )}

                                    {/* Verified College / Institution */}
                                    {profile.college && (
                                        <div className="flex items-start gap-2 pt-1 text-xs font-semibold text-neutral-800">
                                            <GraduationCap className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="truncate font-bold tracking-tight">
                                                        {profile.college.officialName}
                                                    </span>
                                                    {profile.college.verificationStatus === "verified" && (
                                                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-bold text-emerald-700">
                                                            <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                                                            Verified
                                                        </span>
                                                    )}
                                                </div>
                                                {(profile.college.city || profile.college.state) && (
                                                    <span className="text-[10px] text-neutral-500 font-normal block truncate mt-0.5">
                                                        {[profile.college.city, profile.college.state].filter(Boolean).join(", ")}
                                                        {profile.college.aisheCode && ` • AISHE: ${profile.college.aisheCode}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Skills if present */}
                                    {profile.skills && profile.skills.length > 0 && (
                                        <div className="pt-1">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400 block mb-1.5">
                                                Skills & Stack
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {profile.skills.map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-2.5 py-0.5 rounded-full bg-neutral-100 border border-neutral-200/70 text-[11px] font-medium text-neutral-700"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Status & Actions: Open to work & Hire me matching bottom button layout */}
                                    {(profile.isOpenToWork || profile.isHireable) && (
                                        <div className="grid grid-cols-2 gap-2 pt-1 pb-0.5 border-t border-neutral-100">
                                            {profile.isOpenToWork && (
                                                <div
                                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200/90 border border-neutral-200 text-neutral-800 text-xs font-bold transition-all shadow-2xs select-none ${!profile.isHireable ? "col-span-2" : ""}`}
                                                    title="Open to Work"
                                                >
                                                    <Briefcase className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                                                    <span className="truncate">Open to work</span>
                                                </div>
                                            )}

                                            {profile.isHireable && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsHireModalOpen(true)}
                                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md active:scale-95 cursor-pointer ${!profile.isOpenToWork ? "col-span-2" : ""}`}
                                                    title={`Message ${profile.firstName || profile.displayName}`}
                                                >
                                                    <Mail className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                                    <span className="truncate">Hire me</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Two Dynamic Action Buttons: Share Profile & Get the card */}
                                    <div className="grid grid-cols-2 gap-2 pt-1 pb-1">
                                        <button
                                            type="button"
                                            onClick={handleShareProfile}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-100 hover:bg-neutral-200/90 border border-neutral-200 text-neutral-800 text-xs font-bold transition-all shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                                            title="Copy public profile link to clipboard"
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                    <span className="text-emerald-700">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                                                    <span className="truncate">Share Profile</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setIsCardModalOpen(true)}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
                                            title="View and download LinkedIn and Instagram Story cards"
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                            <span className="truncate">Get the card</span>
                                        </button>
                                    </div>

                                    {/* Resume Button if public */}
                                    {profile.resumeUrl && profile.isResumePublic !== false && (
                                        <div className="p-2.5 rounded-xl bg-[#0d111c] text-white flex items-center justify-between gap-2.5 shadow-xs border border-neutral-800">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/20 text-white flex items-center justify-center flex-shrink-0">
                                                    <FileText className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <span className="text-xs font-bold text-white tracking-tight">
                                                    Resume
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsResumePreviewOpen(true)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-bold transition-all cursor-pointer"
                                                    title="Preview Resume"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                    <span>View</span>
                                                </button>
                                                <a
                                                    href={profile.resumeUrl}
                                                    download={profile.resumeFilename || "resume.pdf"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] transition-all cursor-pointer"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-3 h-3" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fallback Links when NOT moved to left */}
                                {!shouldMoveLinksToLeft && displayLinks.length > 0 && (
                                    <div className="space-y-3 pt-3 border-t border-neutral-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                                                Links ({displayLinks.length})
                                            </span>
                                        </div>

                                        <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1 scrollbar-thin">
                                            {displayLinks.map((item, idx) => {
                                                const formattedUrl = sanitizePlatformUrl(item.url);
                                                const cleanHandle = getCleanDisplayHandle(item.url, item.label, item.platform);
                                                return (
                                                    <a
                                                        key={idx}
                                                        href={formattedUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-neutral-50 hover:bg-neutral-100/90 border border-neutral-200/80 hover:border-neutral-300 text-neutral-800 transition-all group shadow-2xs"
                                                        title={formattedUrl}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-white border border-neutral-200/80 flex items-center justify-center flex-shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                                                                {getPlatformIcon(
                                                                    item.platform || item.label || formattedUrl,
                                                                    "w-4 h-4 flex-shrink-0"
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-bold text-neutral-900 block truncate group-hover:text-black">
                                                                    {item.label || item.platform || "Link"}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-neutral-500 font-semibold block truncate">
                                                                    {cleanHandle}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ExternalLink className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-900 transition-colors flex-shrink-0" />
                                                    </a>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ========================================================================= */}
                {/* PRACTICE & DEVELOPMENT ACTIVITY & PERFORMANCE SECTION */}
                {/* ========================================================================= */}
                <section className="w-full max-w-[1600px] mx-auto space-y-6">
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
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeField === "practice"
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
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeField === "development"
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

            {/* Hire Me Recruiter Modal (Exact Match to User Reference Screenshot) */}
            <HireMeModal
                isOpen={isHireModalOpen}
                onClose={() => setIsHireModalOpen(false)}
                username={profile.username}
                firstName={profile.firstName}
                displayName={profile.displayName}
            />

            {/* Get The Card Modal: LinkedIn Card & Instagram Story with Flip and Both-Sides Download */}
            <GetTheCardModal
                isOpen={isCardModalOpen}
                onClose={() => setIsCardModalOpen(false)}
                user={{
                    ...profile,
                    photoUrl: avatarSrc,
                }}
                stats={stats}
                coderType={coderType}
                showcasedPlatformsLinkedIn={showcasedPlatforms}
                showcasedPlatformsStory={showcasedPlatformsStory}
                allConnectedPlatforms={allConnectedPlatforms}
                githubStats={githubStats}
                connectedPortals={connectedPortals}
                showcasedContests={showcasedContests}
                publicProfileUrl={profilePageUrl}
            />

            {/* Interactive PDF Resume Modal */}
            {isResumePreviewOpen && profile.resumeUrl && (
                <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
                    <div className="w-full max-w-5xl h-[88vh] bg-[#0d111c] border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800 bg-[#080B13]">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center flex-shrink-0">
                                    <FileText className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-bold text-white truncate max-w-sm">
                                        {profile.resumeFilename || `${profile.displayName} - Resume.pdf`}
                                    </h3>
                                    <p className="text-[11px] text-neutral-400 font-mono">
                                        Cloudinary Verified PDF
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={profile.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4" />
                                </a>
                                <a
                                    href={profile.resumeUrl}
                                    download={profile.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-neutral-950 text-xs font-bold transition-all shadow-sm"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsResumePreviewOpen(false)}
                                    className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
                                    title="Close preview"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 w-full bg-[#1A1F2C] relative overflow-hidden flex items-center justify-center">
                            <iframe
                                src={`${profile.resumeUrl}#toolbar=1&navpanes=0`}
                                title="Resume PDF Preview"
                                className="w-full h-full border-0"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
