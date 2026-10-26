import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
    Repeat,
    Code2,
    GitBranch,
    Briefcase,
    Mail,
    MapPin,
    ExternalLink,
    Share2,
    CreditCard,
    Check,
    ArrowRight,
    FileText,
    Download,
    Eye,
    X,
    GraduationCap,
    ShieldCheck,
    WifiOff,
    ServerCrash,
    AlertTriangle,
    UserX,
    Lock,
    RefreshCw,
    Trophy,
    Sparkles,
    Terminal,
    ChevronDown,
    ChevronUp,
    Copy,
    Home,
    Clock,
} from "lucide-react";
import {
    fetchPublicProfile,
    type PublicProfileData,
    ProfileApiError,
    type ProfileErrorKind,
    invalidatePublicProfileClientCache,
} from "../../utils/profileApi";
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

export interface ProfileDiagnosis {
    kind: ProfileErrorKind;
    title: string;
    subtitle: string;
    badgeText: string;
    badgeStyle: {
        bg: string;
        border: string;
        text: string;
        dot: string;
    };
    iconStyle: {
        bg: string;
        text: string;
    };
    statusCode?: number;
    details?: string;
    suggestedHandle?: string;
}

export function diagnoseProfileError(err: any, rawUsername?: string): ProfileDiagnosis {
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    const cleanUser = (rawUsername || "").trim();
    const stripped = cleanUser.toLowerCase().replace(/[-_.\s]/g, "");

    let suggestedHandle: string | undefined;
    if (stripped === "vineetchandel" && cleanUser.toLowerCase() !== "vineet-chandel") {
        suggestedHandle = "Vineet-Chandel";
    }

    if (isOffline) {
        return {
            kind: "NETWORK_ERROR",
            title: "You Are Currently Offline",
            subtitle: "Your device is not connected to the internet. Reconnect to load this developer portfolio showcase.",
            badgeText: "NO INTERNET CONNECTION",
            badgeStyle: {
                bg: "bg-amber-50",
                border: "border-amber-300",
                text: "text-amber-900",
                dot: "bg-amber-500 animate-pulse",
            },
            iconStyle: {
                bg: "bg-amber-100",
                text: "text-amber-900",
            },
            statusCode: 0,
            details: "Client browser reports navigator.onLine = false",
            suggestedHandle,
        };
    }

    if (err instanceof ProfileApiError) {
        switch (err.kind) {
            case "NOT_FOUND":
                return {
                    kind: "NOT_FOUND",
                    title: "Developer Profile Not Found",
                    subtitle: `The developer handle '@${cleanUser}' is not registered on Orbix or does not exist.`,
                    badgeText: "404 · HANDLE NOT REGISTERED",
                    badgeStyle: {
                        bg: "bg-neutral-100",
                        border: "border-neutral-300",
                        text: "text-neutral-800",
                        dot: "bg-neutral-500",
                    },
                    iconStyle: {
                        bg: "bg-[#FAF6EE]",
                        text: "text-neutral-900",
                    },
                    statusCode: 404,
                    details: err.details || "The requested profile could not be located in database.",
                    suggestedHandle,
                };
            case "PRIVATE":
                return {
                    kind: "PRIVATE",
                    title: "This Profile is Private",
                    subtitle: `Developer '@${cleanUser}' has configured their profile visibility to private. Only the profile owner can view their showcase and connected platforms.`,
                    badgeText: "403 · PROFILE VISIBILITY: PRIVATE",
                    badgeStyle: {
                        bg: "bg-indigo-50",
                        border: "border-indigo-300",
                        text: "text-indigo-900",
                        dot: "bg-indigo-500",
                    },
                    iconStyle: {
                        bg: "bg-indigo-100",
                        text: "text-indigo-900",
                    },
                    statusCode: 403,
                    details: err.details || "Access restricted by profile privacy settings.",
                    suggestedHandle,
                };
            case "RATE_LIMITED":
                return {
                    kind: "RATE_LIMITED",
                    title: "Rate Limit Exceeded",
                    subtitle: "Too many profile lookup requests were made in a short time. Please wait a few moments and try again.",
                    badgeText: "429 · TOO MANY REQUESTS",
                    badgeStyle: {
                        bg: "bg-orange-50",
                        border: "border-orange-300",
                        text: "text-orange-900",
                        dot: "bg-orange-500",
                    },
                    iconStyle: {
                        bg: "bg-orange-100",
                        text: "text-orange-900",
                    },
                    statusCode: 429,
                    details: err.details || "Rate limit threshold reached for this IP/session.",
                    suggestedHandle,
                };
            case "SERVER_ERROR":
                return {
                    kind: "SERVER_ERROR",
                    title: "Server Temporarily Unavailable",
                    subtitle: `Orbix servers encountered an issue while retrieving stats for '@${cleanUser}'. This is usually temporary.`,
                    badgeText: `${err.status || 500} · SERVER ERROR`,
                    badgeStyle: {
                        bg: "bg-rose-50",
                        border: "border-rose-300",
                        text: "text-rose-900",
                        dot: "bg-rose-500 animate-pulse",
                    },
                    iconStyle: {
                        bg: "bg-rose-100",
                        text: "text-rose-900",
                    },
                    statusCode: err.status || 500,
                    details: err.details || err.message,
                    suggestedHandle,
                };
            case "INVALID_USERNAME":
                return {
                    kind: "INVALID_USERNAME",
                    title: "Invalid Developer Handle",
                    subtitle: `The handle '@${cleanUser}' contains unsupported characters. Usernames should be 3-20 characters using letters, numbers, dots, underscores, or hyphens.`,
                    badgeText: "400 · INVALID HANDLE FORMAT",
                    badgeStyle: {
                        bg: "bg-neutral-100",
                        border: "border-neutral-300",
                        text: "text-neutral-800",
                        dot: "bg-neutral-500",
                    },
                    iconStyle: {
                        bg: "bg-amber-100",
                        text: "text-amber-900",
                    },
                    statusCode: 400,
                    details: err.details || "Handle failed format validation.",
                    suggestedHandle,
                };
            case "NETWORK_ERROR":
            default:
                return {
                    kind: "NETWORK_ERROR",
                    title: "Unable to Connect to Server",
                    subtitle: `Could not establish a connection to the Orbix backend server for '@${cleanUser}'. Please check your network connection or verify that the backend server is running.`,
                    badgeText: "NETWORK / SERVER UNREACHABLE",
                    badgeStyle: {
                        bg: "bg-amber-50",
                        border: "border-amber-300",
                        text: "text-amber-900",
                        dot: "bg-amber-500 animate-pulse",
                    },
                    iconStyle: {
                        bg: "bg-amber-100",
                        text: "text-amber-900",
                    },
                    statusCode: 0,
                    details: err.details || err.message || "Failed to fetch from /api/profile/public and localhost:3000",
                    suggestedHandle,
                };
        }
    }

    const msg = String(err?.message || err || "").toLowerCase();
    const status = typeof err?.status === "number" ? err.status : undefined;

    if (
        msg.includes("failed to fetch") ||
        msg.includes("network") ||
        msg.includes("econnrefused") ||
        msg.includes("connection refused") ||
        msg.includes("load failed") ||
        msg.includes("unreachable")
    ) {
        return {
            kind: "NETWORK_ERROR",
            title: "Unable to Connect to Server",
            subtitle: `Could not establish a connection to the Orbix backend server for '@${cleanUser}'. Please check your internet connection or verify the backend server is running.`,
            badgeText: "NETWORK / SERVER UNREACHABLE",
            badgeStyle: {
                bg: "bg-amber-50",
                border: "border-amber-300",
                text: "text-amber-900",
                dot: "bg-amber-500 animate-pulse",
            },
            iconStyle: {
                bg: "bg-amber-100",
                text: "text-amber-900",
            },
            statusCode: 0,
            details: msg,
            suggestedHandle,
        };
    }

    if (status === 404 || msg.includes("not found") || msg.includes("does not exist")) {
        return {
            kind: "NOT_FOUND",
            title: "Developer Profile Not Found",
            subtitle: `The developer handle '@${cleanUser}' could not be found or does not exist.`,
            badgeText: "404 · PROFILE NOT FOUND",
            badgeStyle: {
                bg: "bg-neutral-100",
                border: "border-neutral-300",
                text: "text-neutral-800",
                dot: "bg-neutral-500",
            },
            iconStyle: {
                bg: "bg-[#FAF6EE]",
                text: "text-neutral-900",
            },
            statusCode: 404,
            details: msg,
            suggestedHandle,
        };
    }

    if (status === 403 || msg.includes("private") || msg.includes("forbidden")) {
        return {
            kind: "PRIVATE",
            title: "This Profile is Private",
            subtitle: `Developer '@${cleanUser}' has marked their profile as private.`,
            badgeText: "403 · PRIVATE PROFILE",
            badgeStyle: {
                bg: "bg-indigo-50",
                border: "border-indigo-300",
                text: "text-indigo-900",
                dot: "bg-indigo-500",
            },
            iconStyle: {
                bg: "bg-indigo-100",
                text: "text-indigo-900",
            },
            statusCode: 403,
            details: msg,
            suggestedHandle,
        };
    }

    if (status === 429 || msg.includes("rate") || msg.includes("too many")) {
        return {
            kind: "RATE_LIMITED",
            title: "Rate Limit Exceeded",
            subtitle: "Too many profile lookup requests were made in a short time. Please wait a moment and try again.",
            badgeText: "429 · TOO MANY REQUESTS",
            badgeStyle: {
                bg: "bg-orange-50",
                border: "border-orange-300",
                text: "text-orange-900",
                dot: "bg-orange-500",
            },
            iconStyle: {
                bg: "bg-orange-100",
                text: "text-orange-900",
            },
            statusCode: 429,
            details: msg,
            suggestedHandle,
        };
    }

    if ((status && status >= 500) || msg.includes("server error") || msg.includes("500") || msg.includes("502")) {
        return {
            kind: "SERVER_ERROR",
            title: "Server Temporarily Unavailable",
            subtitle: `Orbix servers encountered an issue while retrieving stats for '@${cleanUser}'. This is usually temporary.`,
            badgeText: `${status || 500} · SERVER ERROR`,
            badgeStyle: {
                bg: "bg-rose-50",
                border: "border-rose-300",
                text: "text-rose-900",
                dot: "bg-rose-500 animate-pulse",
            },
            iconStyle: {
                bg: "bg-rose-100",
                text: "text-rose-900",
            },
            statusCode: status || 500,
            details: msg,
            suggestedHandle,
        };
    }

    return {
        kind: "UNKNOWN",
        title: "Unable to Load Profile",
        subtitle: `An unexpected issue occurred while retrieving profile '@${cleanUser}'.`,
        badgeText: "ERROR ENCOUNTERED",
        badgeStyle: {
            bg: "bg-neutral-100",
            border: "border-neutral-300",
            text: "text-neutral-800",
            dot: "bg-neutral-500",
        },
        iconStyle: {
            bg: "bg-neutral-100",
            text: "text-neutral-900",
        },
        statusCode: status,
        details: msg,
        suggestedHandle,
    };
}

export const renderDiagnosisIcon = (kind: ProfileErrorKind) => {
    switch (kind) {
        case "NETWORK_ERROR":
            return <WifiOff className="w-8 h-8 sm:w-10 sm:h-10 text-amber-700 animate-pulse" />;
        case "PRIVATE":
            return <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-indigo-700" />;
        case "SERVER_ERROR":
            return <ServerCrash className="w-8 h-8 sm:w-10 sm:h-10 text-rose-700" />;
        case "RATE_LIMITED":
            return <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-orange-700" />;
        case "INVALID_USERNAME":
            return <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-amber-700" />;
        case "NOT_FOUND":
        default:
            return <UserX className="w-8 h-8 sm:w-10 sm:h-10 text-neutral-800" />;
    }
};

export const OrbixLogoMark = ({ className = "w-full h-full text-black" }: { className?: string }) => (
    <svg className={className} viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="currentColor" />
        <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="currentColor" />
        <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="currentColor" />
        <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="currentColor" />
        <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="currentColor" />
        <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="currentColor" />
        <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="currentColor" />
        <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="currentColor" />
        <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="currentColor" />
        <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="currentColor" />
    </svg>
);

export const ProfileHeader = ({ isEmbedded, isDemo }: { isEmbedded?: boolean; isDemo?: boolean }) => {
    if (isEmbedded) return null;
    return (
        <header className="w-full px-4 sm:px-8 pt-4 pb-2 flex items-center justify-between select-none">
            <Link
                to="/"
                className="inline-flex items-center gap-2 group cursor-pointer"
                title="Orbix — Home"
            >
                <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center text-black font-black text-sm transition-transform duration-200 group-hover:scale-105">
                    <OrbixLogoMark className="w-full h-full text-black" />
                </div>
                <span className="font-extrabold text-neutral-950 text-2xl sm:text-3xl tracking-tight group-hover:text-black transition-colors">
                    Orbix
                </span>
            </Link>

            <div className="flex items-center gap-2 sm:gap-3">
                <Link
                    to="/leaderboard"
                    className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 sm:py-2.5 rounded-full bg-white hover:bg-[#FAF6EE] text-black text-xs sm:text-sm font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                    title="View Developer Leaderboard"
                >
                    <Trophy className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                    <span>Leaderboard</span>
                </Link>

                {isDemo ? (
                    <Link
                        to="/auth/signup"
                        className="inline-flex items-center gap-2 sm:gap-2.5 px-4 sm:px-6 py-2 sm:py-2.5 rounded-full bg-black hover:bg-neutral-900 text-white text-xs sm:text-sm font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer group select-none"
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
                        className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-black hover:bg-neutral-900 text-white text-xs sm:text-sm font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer select-none"
                    >
                        <span>Create your profile</span>
                        <ArrowRight className="w-3.5 h-3.5 text-white" />
                    </Link>
                )}
            </div>
        </header>
    );
};

export const ProfileFooter = () => (
    <footer className="w-full py-6 text-center text-xs text-neutral-500 font-mono border-t border-black/10 mt-auto select-none">
        <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 mb-2">
            <Link to="/" className="hover:text-black transition-colors font-medium">Home</Link>
            <span>·</span>
            <Link to="/leaderboard" className="hover:text-black transition-colors font-medium">Leaderboard</Link>
            <span>·</span>
            <Link to="/docs" className="hover:text-black transition-colors font-medium">Docs</Link>
            <span>·</span>
            <Link to="/events" className="hover:text-black transition-colors font-medium">Events</Link>
            <span>·</span>
            <Link to="/support" className="hover:text-black transition-colors font-medium">Support</Link>
            <span>·</span>
            <Link to="/profile/u/Vineet-Chandel" className="hover:text-black transition-colors font-medium">Demo Profile</Link>
        </div>
        <p>© {new Date().getFullYear()} Orbix Inc. · Universal Developer Portfolio & Card Studio</p>
    </footer>
);

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
    const [rawError, setRawError] = useState<any>(null);
    const [isRetrying, setIsRetrying] = useState<boolean>(false);
    const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
    const [isClientOnline, setIsClientOnline] = useState<boolean>(() => {
        return typeof navigator !== "undefined" ? navigator.onLine : true;
    });
    const [cardFace, setCardFace] = useState<"front" | "back">("front");
    const [activeField, setActiveField] = useState<"practice" | "development">("practice");
    const [isHireModalOpen, setIsHireModalOpen] = useState(false);
    const [isCardModalOpen, setIsCardModalOpen] = useState(false);
    const [isResumePreviewOpen, setIsResumePreviewOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);

    // Dynamic scale measurement for responsive LinkedInCard rendering
    const cardContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(1200);

    // Online/Offline status listeners
    useEffect(() => {
        const handleOnline = () => setIsClientOnline(true);
        const handleOffline = () => setIsClientOnline(false);
        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    const handleCopyDiagnostics = () => {
        const diag = diagnoseProfileError(rawError, username);
        const payload = JSON.stringify(
            {
                app: "Orbix",
                route: `/profile/u/${username}`,
                targetUsername: username,
                kind: diag.kind,
                httpStatus: diag.statusCode || 0,
                technicalDetails: diag.details,
                browserOnline: isClientOnline,
                timestamp: new Date().toISOString(),
            },
            null,
            2
        );

        navigator.clipboard.writeText(payload).then(
            () => {
                toast.success("Diagnostic technical details copied to clipboard!", { title: "Copied" });
            },
            () => {
                toast.error("Failed to copy diagnostics", { title: "Error" });
            }
        );
    };

    const handleRetry = () => {
        if (!username) return;
        setIsRetrying(true);
        invalidatePublicProfileClientCache(username);
        fetchPublicProfile(username, true)
            .then((data) => {
                setProfile(data);
                setRawError(null);
                setLoading(false);
                toast.success("Profile reconnected successfully!", { title: "Connected" });
                if (!isEmbedded) {
                    document.title = `${data.displayName} (@${data.username}) — Orbix Profile`;
                }
            })
            .catch((err: any) => {
                setRawError(err);
                setLoading(false);
                const diag = diagnoseProfileError(err, username);
                toast.error(diag.title, { title: "Connection Failed" });
            })
            .finally(() => {
                setTimeout(() => setIsRetrying(false), 500);
            });
    };

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
            setRawError(new ProfileApiError("INVALID_USERNAME", "No username specified", 400));
            setLoading(false);
            return;
        }

        if (isDemoProfileUsername(username)) {
            setProfile(demoPublicProfile);
            setLoading(false);
            setRawError(null);
            if (!isEmbedded) {
                document.title = `${demoPublicProfile.displayName} (@${demoPublicProfile.username}) — Orbix Demo Profile`;
            }
            return;
        }

        let isMounted = true;
        setLoading(true);
        setRawError(null);

        fetchPublicProfile(username)
            .then((data) => {
                if (isMounted) {
                    setProfile(data);
                    setLoading(false);
                    setRawError(null);
                    // Update document title for SEO
                    if (!isEmbedded) {
                        document.title = `${data.displayName} (@${data.username}) — Orbix Profile`;
                    }
                }
            })
            .catch((err: any) => {
                if (isMounted) {
                    setRawError(err);
                    setLoading(false);
                    if (!isEmbedded) {
                        const diag = diagnoseProfileError(err, username);
                        document.title = `${diag.title} — Orbix`;
                    }
                }
            });

        return () => {
            isMounted = false;
        };
    }, [username, isEmbedded]);

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
    const coderType = useMemo(() => getCoderType(stats.totalSolved, stats.contests), [stats.totalSolved, stats.contests]);
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
        if (isEmbedded) {
            return (
                <div className="w-full p-8 rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] animate-pulse">
                    <div className="h-48 bg-neutral-200 rounded-2xl mb-4" />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="h-20 bg-neutral-100 rounded-xl" />
                        <div className="h-20 bg-neutral-100 rounded-xl" />
                    </div>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white relative overflow-x-hidden flex flex-col justify-between">
                {/* Subtle canvas dot grid across the entire page */}
                <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

                {/* Orbix Brand Header */}
                <ProfileHeader isEmbedded={isEmbedded} isDemo={isDemo} />

                {/* Loading Center Card */}
                <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
                    <div className="w-full max-w-xl mx-auto rounded-3xl bg-white border-2 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-9 text-center animate-pulse">
                        <div className="w-20 h-20 rounded-2xl bg-neutral-200 border-2 border-black/20 mx-auto mb-5" />
                        <div className="h-7 w-52 bg-neutral-200 rounded-lg mx-auto mb-3" />
                        <div className="h-4 w-72 bg-neutral-100 rounded mx-auto mb-6" />
                        <div className="h-16 w-full bg-[#FAF6EE] rounded-2xl border-2 border-black/10 mb-6" />
                        <div className="flex justify-center gap-3">
                            <div className="h-11 w-32 bg-neutral-200 rounded-full" />
                            <div className="h-11 w-32 bg-neutral-200 rounded-full" />
                        </div>
                    </div>
                </main>

                <ProfileFooter />
            </div>
        );
    }

    // Error / Private / Unreachable Profile State
    if (rawError || !profile) {
        const diag = diagnoseProfileError(rawError, username);

        // If this component is embedded in a showcase (e.g. Hero on landing page)
        if (isEmbedded) {
            return (
                <div className="w-full p-6 text-center rounded-3xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                    <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-black/20 flex items-center justify-center mx-auto mb-3">
                        {renderDiagnosisIcon(diag.kind)}
                    </div>
                    <h3 className="text-base font-black text-neutral-950 mb-1">{diag.title}</h3>
                    <p className="text-xs text-neutral-600 mb-4">{diag.subtitle}</p>
                    <button
                        type="button"
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className="px-4 py-2 rounded-full bg-black text-white text-xs font-bold border-2 border-black shadow-[2px_2px_0px_#000] active:scale-95 transition-all cursor-pointer"
                    >
                        {isRetrying ? "Retrying..." : "Retry"}
                    </button>
                </div>
            );
        }

        return (
            <div className="min-h-screen bg-[#FAF6EE] text-neutral-900 font-sans selection:bg-black selection:text-white relative overflow-x-hidden flex flex-col justify-between">
                {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
                <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

                {/* Orbix Brand Header */}
                <ProfileHeader isEmbedded={isEmbedded} isDemo={isDemo} />

                {/* Main Error Diagnosis Card */}
                <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12">
                    <div className="w-full max-w-xl mx-auto rounded-3xl bg-white border-2 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-9 text-center relative overflow-hidden transition-all">
                        {/* Status Badge */}
                        <div className="mb-5 flex items-center justify-center">
                            <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border ${diag.badgeStyle.bg} ${diag.badgeStyle.border} ${diag.badgeStyle.text} text-xs font-mono font-bold uppercase tracking-wider shadow-xs`}>
                                <span className={`w-2 h-2 rounded-full ${diag.badgeStyle.dot}`} />
                                <span>{diag.badgeText}</span>
                            </div>
                        </div>

                        {/* Icon Box */}
                        <div className={`w-20 h-20 rounded-2xl ${diag.iconStyle.bg} border-2 border-black shadow-[4px_4px_0px_#000] mx-auto flex items-center justify-center mb-5`}>
                            {renderDiagnosisIcon(diag.kind)}
                        </div>

                        {/* Title & Target Handle */}
                        <h1 className="text-2xl sm:text-3xl font-black text-neutral-950 tracking-tight mb-2">
                            {diag.title}
                        </h1>

                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-neutral-100 border border-neutral-300 font-mono text-xs font-bold text-neutral-800 mb-4 select-all">
                            <span>Handle:</span>
                            <span className="text-neutral-950 font-black">@{username}</span>
                        </div>

                        <p className="text-sm text-neutral-600 mb-6 max-w-md mx-auto leading-relaxed">
                            {diag.subtitle}
                        </p>

                        {/* Smart Suggestion (e.g. if close to Vineet-Chandel) */}
                        {diag.suggestedHandle && (
                            <div className="mb-6 p-4 rounded-2xl bg-amber-50/80 border-2 border-amber-300 text-left flex items-center justify-between gap-3 shadow-xs">
                                <div className="min-w-0">
                                    <span className="text-[11px] font-mono font-bold text-amber-800 uppercase tracking-wider block">
                                        Suggested Profile Match
                                    </span>
                                    <p className="text-sm font-bold text-neutral-900 truncate">
                                        Looking for <span className="font-mono text-amber-950">@{diag.suggestedHandle}</span>?
                                    </p>
                                    <p className="text-xs text-neutral-600">The verified showcase profile is ready to view.</p>
                                </div>
                                <Link
                                    to={`/profile/u/${diag.suggestedHandle}`}
                                    className="flex-shrink-0 px-3.5 py-1.5 rounded-full bg-amber-500 hover:bg-amber-600 text-black text-xs font-bold shadow-[2px_2px_0px_#000] border border-black active:scale-95 transition-all flex items-center gap-1 cursor-pointer select-none"
                                >
                                    <span>View Profile</span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                </Link>
                            </div>
                        )}

                        {/* Network Diagnostic Box */}
                        {diag.kind === "NETWORK_ERROR" && (
                            <div className="mb-6 p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black/15 text-left text-xs space-y-2">
                                <span className="text-[11px] font-mono font-bold text-neutral-700 uppercase tracking-wider block">
                                    Connection Health Check
                                </span>
                                <div className="flex items-center justify-between text-neutral-700">
                                    <span>Browser Internet Status:</span>
                                    <span className={`font-mono font-bold px-2 py-0.5 rounded-full text-[10px] ${isClientOnline ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"}`}>
                                        {isClientOnline ? "● ONLINE" : "○ OFFLINE"}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-neutral-700">
                                    <span>Backend Endpoint:</span>
                                    <span className="font-mono text-[11px] text-neutral-900 truncate max-w-[220px]">
                                        /api/profile/public/{username}
                                    </span>
                                </div>
                                <div className="pt-2 border-t border-black/10 text-neutral-500 text-[11px] leading-relaxed">
                                    💡 <strong>Developer Tip:</strong> If running in development, ensure the backend server is active on <code className="bg-neutral-200/80 px-1 py-0.5 rounded font-mono text-neutral-900">localhost:3000</code>.
                                </div>
                            </div>
                        )}

                        {/* Not Found Callout */}
                        {diag.kind === "NOT_FOUND" && (
                            <div className="mb-6 p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-300 text-left text-xs flex items-center gap-3">
                                <span className="text-emerald-600 text-lg flex-shrink-0">✨</span>
                                <p className="text-emerald-950 leading-relaxed">
                                    <strong>This handle is unclaimed!</strong> You can register <span className="font-mono font-bold">@{username}</span> and showcase your competitive programming & dev stats.
                                </p>
                            </div>
                        )}

                        {/* Primary & Secondary Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
                            {(diag.kind === "NETWORK_ERROR" || diag.kind === "SERVER_ERROR") && (
                                <button
                                    type="button"
                                    onClick={handleRetry}
                                    disabled={isRetrying}
                                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-black hover:bg-neutral-800 text-white text-sm font-bold border-2 border-black shadow-[4px_4px_0px_#000] transition-all duration-200 transform active:scale-95 active:shadow-none flex items-center justify-center gap-2 cursor-pointer select-none"
                                >
                                    <RefreshCw className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`} />
                                    <span>{isRetrying ? "Retrying Connection..." : "Retry Connection"}</span>
                                </button>
                            )}

                            {diag.kind === "NOT_FOUND" && (
                                <Link
                                    to={`/auth/signup?username=${encodeURIComponent(username || "")}`}
                                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-black hover:bg-neutral-800 text-white text-sm font-bold border-2 border-black shadow-[4px_4px_0px_#000] transition-all duration-200 transform active:scale-95 active:shadow-none flex items-center justify-center gap-2 cursor-pointer select-none"
                                >
                                    <span>Claim @{username} & Sign Up</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}

                            {diag.kind === "PRIVATE" && (
                                <Link
                                    to="/auth/signin"
                                    className="w-full sm:w-auto px-6 py-3 rounded-full bg-black hover:bg-neutral-800 text-white text-sm font-bold border-2 border-black shadow-[4px_4px_0px_#000] transition-all duration-200 transform active:scale-95 active:shadow-none flex items-center justify-center gap-2 cursor-pointer select-none"
                                >
                                    <span>Sign In as Profile Owner</span>
                                    <ArrowRight className="w-4 h-4" />
                                </Link>
                            )}

                            <Link
                                to="/profile/u/Vineet-Chandel"
                                className="w-full sm:w-auto px-5 py-3 rounded-full bg-[#FAF6EE] hover:bg-[#f3ede1] text-black text-sm font-bold border-2 border-black shadow-[3px_3px_0px_#000] transition-all duration-200 transform active:scale-95 active:shadow-none flex items-center justify-center gap-2 cursor-pointer select-none"
                            >
                                <Sparkles className="w-4 h-4 text-amber-500" />
                                <span>View Demo Showcase</span>
                            </Link>

                            <Link
                                to="/"
                                className="w-full sm:w-auto px-5 py-3 rounded-full bg-white hover:bg-neutral-100 text-neutral-800 text-sm font-bold border-2 border-black/30 hover:border-black shadow-[2px_2px_0px_#000] transition-all duration-200 transform active:scale-95 active:shadow-none flex items-center justify-center gap-1.5 cursor-pointer select-none"
                            >
                                <Home className="w-4 h-4" />
                                <span>Home</span>
                            </Link>
                        </div>

                        {/* Collapsible Technical Diagnostics */}
                        <div className="pt-4 border-t border-neutral-200 text-left">
                            <button
                                type="button"
                                onClick={() => setShowDiagnostics((prev) => !prev)}
                                className="w-full flex items-center justify-between text-xs font-mono font-bold text-neutral-500 hover:text-black py-1 cursor-pointer transition-colors"
                            >
                                <span className="flex items-center gap-1.5">
                                    <Terminal className="w-3.5 h-3.5" />
                                    <span>Technical Diagnostic Info</span>
                                </span>
                                {showDiagnostics ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>

                            {showDiagnostics && (
                                <div className="mt-3 p-3 rounded-xl bg-neutral-900 text-neutral-200 font-mono text-[11px] space-y-1.5 overflow-x-auto shadow-inner">
                                    <div className="flex items-center justify-between pb-1 mb-1 border-b border-neutral-800">
                                        <span className="text-neutral-400">Diagnostic Snapshot:</span>
                                        <button
                                            type="button"
                                            onClick={handleCopyDiagnostics}
                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-[10px] cursor-pointer transition-colors"
                                        >
                                            <Copy className="w-3 h-3" />
                                            <span>Copy</span>
                                        </button>
                                    </div>
                                    <div><span className="text-neutral-500">Error Kind:</span> <span className="text-amber-400">{diag.kind}</span></div>
                                    <div><span className="text-neutral-500">HTTP Status:</span> <span className="text-sky-400">{diag.statusCode || "0 (No Response / Network Error)"}</span></div>
                                    <div><span className="text-neutral-500">Target Handle:</span> <span className="text-white">@{username}</span></div>
                                    <div><span className="text-neutral-500">Browser Online:</span> <span className={isClientOnline ? "text-emerald-400" : "text-rose-400"}>{isClientOnline ? "true" : "false"}</span></div>
                                    <div><span className="text-neutral-500">Details:</span> <span className="text-neutral-300 break-all">{diag.details || "None"}</span></div>
                                    <div><span className="text-neutral-500">Timestamp:</span> <span className="text-neutral-400">{new Date().toISOString()}</span></div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>

                {/* Orbix Footer */}
                <ProfileFooter />
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
        <div className={`${isEmbedded ? "pb-4 embedded-showcase-container bg-[#FAF6EE]" : "min-h-screen pb-16 bg-[#FAF6EE] relative"} text-neutral-900 font-sans antialiased selection:bg-black selection:text-white`}>
            {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
            {!isEmbedded && (
                <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />
            )}

            {/* Minimal Orbix Header — Navigates to "/" (Hidden when embedded in hero showcase) */}
            <ProfileHeader isEmbedded={isEmbedded} isDemo={isDemo} />

            {/* Profile Showcase Container - Full Width */}
            <main className={`w-full px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 ${isEmbedded ? "pb-4" : "pb-16"} min-w-0`}>
                {/* 3/4 Main Card + 1/4 Sidebar Card Section */}
                <div className="w-full max-w-[1600px] mx-auto mb-10">
                    {/* Header Strip with Controls */}
                    <div className="w-full flex items-center justify-between mb-3 px-1 flex-wrap gap-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-mono font-black uppercase tracking-wider text-black">
                                <span className="w-2 h-2 rounded-full bg-[#FFE566] border border-black" />
                                <span>Developer Profile Card</span>
                            </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={() => setCardFace((f) => (f === "front" ? "back" : "front"))}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-black hover:bg-neutral-900 text-white text-xs sm:text-sm font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
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
                                                    className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer group min-w-0"
                                                    title={formattedUrl}
                                                >
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <div className="w-10 h-10 rounded-xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center flex-shrink-0 shadow-[1.5px_1.5px_0px_#000] group-hover:scale-105 group-hover:bg-[#FFE566] transition-all">
                                                            {getPlatformIcon(
                                                                item.platform || item.label || formattedUrl,
                                                                "w-5 h-5 flex-shrink-0"
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 text-left">
                                                            <span className="text-xs sm:text-sm font-black text-black block truncate tracking-tight">
                                                                {item.label || item.platform || "Link"}
                                                            </span>
                                                            <span className="text-[11px] sm:text-xs font-mono text-neutral-600 font-bold block truncate">
                                                                {cleanHandle}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-4 h-4 text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all stroke-[2.5] flex-shrink-0" />
                                                </a>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* RIGHT (1/4 Screen Width on Large Screens): Bio, Location & Connected Links Card */}
                        <div className="lg:col-span-3 flex flex-col min-w-0">
                            <div className={`w-full rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-5 sm:p-6 flex flex-col select-none ${shouldMoveLinksToLeft ? "justify-start space-y-4" : "h-full justify-between space-y-5"}`}>
                                <div ref={rightDetailsRef} className="space-y-4">
                                    {/* Card Subheader */}
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/15">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-full bg-black border border-black" />
                                            <h3 className="text-xs font-black tracking-wider uppercase text-black">
                                                Developer Info
                                            </h3>
                                        </div>
                                        <span className="text-xs font-mono font-bold text-neutral-600 bg-[#FAF6EE] px-2 py-0.5 rounded-md border border-black/30">
                                            @{profile.username}
                                        </span>
                                    </div>

                                    {/* Bio */}
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider text-black block mb-1">
                                            Bio
                                        </span>
                                        {profile.bio ? (
                                            <p className="text-xs font-bold text-neutral-800 leading-relaxed whitespace-pre-line">
                                                {profile.bio}
                                            </p>
                                        ) : profile.headline ? (
                                            <p className="text-xs font-bold text-neutral-700 leading-relaxed">
                                                {profile.headline}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-neutral-400 italic font-medium">
                                                No biography provided.
                                            </p>
                                        )}
                                    </div>

                                    {/* Location */}
                                    {profile.location && (
                                        <div className="flex items-center gap-2 pt-1 text-xs font-bold text-black">
                                            <MapPin className="w-3.5 h-3.5 text-black stroke-[2.5] flex-shrink-0" />
                                            <span className="truncate">{profile.location}</span>
                                        </div>
                                    )}

                                    {/* Verified College / Institution */}
                                    {profile.college && (
                                        <div className="flex items-start gap-2.5 pt-1 text-xs font-bold text-black">
                                            <GraduationCap className="w-4 h-4 text-black stroke-[2.5] flex-shrink-0 mt-0.5" />
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="truncate font-black tracking-tight text-black">
                                                        {profile.college.officialName}
                                                    </span>
                                                    {profile.college.verificationStatus === "verified" && (
                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black uppercase shadow-[1px_1px_0px_#000]">
                                                            <ShieldCheck className="w-2.5 h-2.5 text-black stroke-[2.5]" />
                                                            Verified
                                                        </span>
                                                    )}
                                                </div>
                                                {(profile.college.city || profile.college.state) && (
                                                    <span className="text-[10px] text-neutral-600 font-semibold block truncate mt-0.5">
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
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black block mb-1.5">
                                                Skills & Stack
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {profile.skills.map((skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[1.5px_1.5px_0px_#000]"
                                                    >
                                                        {skill}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Status & Actions: Open to work & Hire me matching bottom button layout */}
                                    {(profile.isOpenToWork || profile.isHireable) && (
                                        <div className="grid grid-cols-2 gap-2.5 pt-2 pb-0.5 border-t-2 border-black/15">
                                            {profile.isOpenToWork && (
                                                <div
                                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] select-none ${!profile.isHireable ? "col-span-2" : ""}`}
                                                    title="Open to Work"
                                                >
                                                    <Briefcase className="w-3.5 h-3.5 text-black stroke-[2.5] flex-shrink-0" />
                                                    <span className="truncate">Open to work</span>
                                                </div>
                                            )}

                                            {profile.isHireable && (
                                                <button
                                                    type="button"
                                                    onClick={() => setIsHireModalOpen(true)}
                                                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-black hover:bg-neutral-900 text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer ${!profile.isOpenToWork ? "col-span-2" : ""}`}
                                                    title={`Message ${profile.firstName || profile.displayName}`}
                                                >
                                                    <Mail className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                                    <span className="truncate">Hire me</span>
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Two Dynamic Action Buttons: Share Profile & Get the card */}
                                    <div className="grid grid-cols-2 gap-2.5 pt-1 pb-1">
                                        <button
                                            type="button"
                                            onClick={handleShareProfile}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            title="Copy public profile link to clipboard"
                                        >
                                            {isCopied ? (
                                                <>
                                                    <Check className="w-3.5 h-3.5 text-black stroke-[3] flex-shrink-0" />
                                                    <span className="text-black font-black">Copied!</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Share2 className="w-3.5 h-3.5 text-black stroke-[2.5] flex-shrink-0" />
                                                    <span className="truncate">Share Profile</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setIsCardModalOpen(true)}
                                            className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-black hover:bg-neutral-900 text-white text-xs font-black border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                            title="View and download LinkedIn and Instagram Story cards"
                                        >
                                            <CreditCard className="w-3.5 h-3.5 text-white flex-shrink-0" />
                                            <span className="truncate">Get the card</span>
                                        </button>
                                    </div>

                                    {/* Resume Button if public */}
                                    {profile.resumeUrl && profile.isResumePublic !== false && (
                                        <div className="p-2.5 rounded-xl bg-[#FAF6EE] text-black flex items-center justify-between gap-2.5 border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-7 h-7 rounded-lg bg-white border border-black text-black flex items-center justify-center flex-shrink-0 shadow-[1px_1px_0px_#000]">
                                                    <FileText className="w-3.5 h-3.5 stroke-[2.5]" />
                                                </div>
                                                <span className="text-xs font-black text-black tracking-tight">
                                                    Resume
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsResumePreviewOpen(true)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-neutral-100 text-black text-[11px] font-black border border-black shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
                                                    title="Preview Resume"
                                                >
                                                    <Eye className="w-3 h-3 stroke-[2.5]" />
                                                    <span>View</span>
                                                </button>
                                                <a
                                                    href={profile.resumeUrl}
                                                    download={profile.resumeFilename || "resume.pdf"}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black text-[11px] border border-black shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
                                                    title="Download PDF"
                                                >
                                                    <Download className="w-3 h-3 stroke-[2.5]" />
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Fallback Links when NOT moved to left */}
                                {!shouldMoveLinksToLeft && displayLinks.length > 0 && (
                                    <div className="space-y-3 pt-3 border-t-2 border-black/15">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-wider text-black">
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
                                                        className="flex items-center justify-between gap-2.5 p-2.5 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all group"
                                                        title={formattedUrl}
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-8 h-8 rounded-lg bg-[#FAF6EE] border-2 border-black flex items-center justify-center flex-shrink-0 shadow-[1px_1px_0px_#000] group-hover:scale-105 group-hover:bg-[#FFE566] transition-transform">
                                                                {getPlatformIcon(
                                                                    item.platform || item.label || formattedUrl,
                                                                    "w-4 h-4 flex-shrink-0"
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="text-xs font-black text-black block truncate group-hover:text-black">
                                                                    {item.label || item.platform || "Link"}
                                                                </span>
                                                                <span className="text-[10px] font-mono text-neutral-600 font-bold block truncate">
                                                                    {cleanHandle}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <ExternalLink className="w-3.5 h-3.5 text-black stroke-[2.5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform flex-shrink-0" />
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
                        <div className="inline-flex items-center p-1.5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] self-start sm:self-auto gap-1">
                            <button
                                type="button"
                                onClick={() => setActiveField("practice")}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeField === "practice"
                                    ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                    }`}
                            >
                                <Code2 className="w-3.5 h-3.5 text-[#a2ff86] stroke-[2.5]" />
                                <span>Practice</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setActiveField("development")}
                                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeField === "development"
                                    ? "bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000]"
                                    : "text-neutral-700 hover:text-black hover:bg-[#FAF6EE] border-2 border-transparent"
                                    }`}
                            >
                                <GitBranch className="w-3.5 h-3.5 text-[#FFE566] stroke-[2.5]" />
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
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
                    <div className="w-full max-w-5xl h-[88vh] bg-[#FAF6EE] border-2 border-black rounded-3xl overflow-hidden shadow-[8px_8px_0px_#000] flex flex-col">
                        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-black bg-white">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black text-black flex items-center justify-center flex-shrink-0 shadow-[1.5px_1.5px_0px_#000]">
                                    <FileText className="w-4 h-4 stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm font-black text-black truncate max-w-sm">
                                        {profile.resumeFilename || `${profile.displayName} - Resume.pdf`}
                                    </h3>
                                    <p className="text-[11px] text-neutral-600 font-mono font-bold">
                                        Cloudinary Verified PDF
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <a
                                    href={profile.resumeUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="p-2 rounded-xl bg-white hover:bg-[#FAF6EE] border-2 border-black text-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                    title="Open PDF in new tab"
                                >
                                    <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                                </a>
                                <a
                                    href={profile.resumeUrl}
                                    download={profile.resumeFilename || "resume.pdf"}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                    title="Download resume"
                                >
                                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                                    <span>Download</span>
                                </a>
                                <button
                                    type="button"
                                    onClick={() => setIsResumePreviewOpen(false)}
                                    className="p-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                    title="Close preview"
                                >
                                    <X className="w-4 h-4 stroke-[2.5]" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 w-full bg-white relative overflow-hidden flex items-center justify-center">
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
