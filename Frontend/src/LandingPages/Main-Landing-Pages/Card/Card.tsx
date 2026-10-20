import React, { useState, useCallback } from "react";
import { ThumbsUp, RotateCcw, Check } from "lucide-react";
import { InstagramStoryCard } from "../../../app/Profile/CardStudio/InstagramStoryCard";
import type { CardThemeConfig } from "../../../app/Profile/CardStudio/types";
import {
    mockUser,
    mockStats,
    mockCoderType,
    mockTopPlatforms,
    mockAllConnectedPlatforms,
    mockGithubStats,
    mockTheme,
    mockPublicProfileUrl,
    mockConnectedPortals,
    mockTopContests,
} from "./mockData";

export interface ProfileCardSectionProps {
    title?: string;
    subtitle?: string;
    user?: any;
    stats?: any;
    coderType?: any;
    topPlatforms?: any[];
    allConnectedPlatforms?: any[];
    githubStats?: any;
    theme?: CardThemeConfig;
    publicProfileUrl?: string;
    connectedPortals?: Record<string, any>;
    className?: string;
}

interface Testimonial {
    id: string;
    author: string;
    handleTime: string;
    initials: string;
    avatarBg: string;
    platform: "x" | "linkedin" | "whatsapp";
    content: React.ReactNode;
    baseLikes: number;
    repliesCount?: string;
    tiltClass: string;
    positionClass: string;
}

interface FloatingParticle {
    id: number;
    x: number;
    y: number;
    label: string;
    color: string;
}

export const Card: React.FC<ProfileCardSectionProps> = ({
    title = "One card. Every place that matters.",
    subtitle = "Your #CodeEyesCard looks great on LinkedIn, X, WhatsApp and your resume.",
    user = mockUser,
    stats = mockStats,
    coderType = mockCoderType,
    topPlatforms = mockTopPlatforms,
    allConnectedPlatforms = mockAllConnectedPlatforms,
    githubStats = mockGithubStats,
    theme = mockTheme,
    publicProfileUrl = mockPublicProfileUrl,
    connectedPortals = mockConnectedPortals,
    className = "",
}) => {
    // 3D Flip state for both cards (smoothly flips in place without affecting layout height)
    const [isLeftFlipped, setIsLeftFlipped] = useState(false);
    const [isRightFlipped, setIsRightFlipped] = useState(false);

    // Interactive Social Comments State
    const [likedComments, setLikedComments] = useState<Record<string, boolean>>({});
    const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

    // Interactive Reactions State & Floating Particles
    const [reactionCounts, setReactionCounts] = useState({ thumbs: 48, flame: 19, heart: 92 });
    const [reactionBouncing, setReactionBouncing] = useState<string | null>(null);
    const [particles, setParticles] = useState<FloatingParticle[]>([]);

    // Pointer-tracking 3D tilt & dynamic specular sheen for Left Card
    const [leftTilt, setLeftTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50, opacity: 0 });
    const [isLeftHovered, setIsLeftHovered] = useState(false);

    // Pointer-tracking 3D tilt & dynamic specular sheen for Right Card
    const [rightTilt, setRightTilt] = useState({ x: 0, y: 0, sheenX: 50, sheenY: 50, opacity: 0 });
    const [isRightHovered, setIsRightHovered] = useState(false);

    // Mobile Face Toggle
    const [mobileFace, setMobileFace] = useState<"front" | "back">("front");

    // Dimensions: Preserves exact section height
    // Desktop Card Dimensions (Native 1080 x 1920 scaled down to fit standard viewport)
    const desktopCardWidth = 340;
    const desktopCardHeight = Math.round(desktopCardWidth * (1920 / 1080)); // 604px
    const desktopScale = desktopCardWidth / 1080;

    // Pointer Move Handlers for Realistic Specular Lighting
    const handleCardMouseMove = useCallback(
        (e: React.MouseEvent<HTMLDivElement>, card: "left" | "right") => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            // Restrained tilt angle (max ±3.2 degrees)
            const tiltX = ((y - centerY) / centerY) * -3.2;
            const tiltY = ((x - centerX) / centerX) * 3.2;

            const sheenX = (x / rect.width) * 100;
            const sheenY = (y / rect.height) * 100;

            if (card === "left") {
                setLeftTilt({ x: tiltX, y: tiltY, sheenX, sheenY, opacity: 0.16 });
                setIsLeftHovered(true);
            } else {
                setRightTilt({ x: tiltX, y: tiltY, sheenX, sheenY, opacity: 0.16 });
                setIsRightHovered(true);
            }
        },
        []
    );

    const handleCardMouseLeave = useCallback((card: "left" | "right") => {
        if (card === "left") {
            setLeftTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50, opacity: 0 });
            setIsLeftHovered(false);
        } else {
            setRightTilt({ x: 0, y: 0, sheenX: 50, sheenY: 50, opacity: 0 });
            setIsRightHovered(false);
        }
    }, []);

    // Social Like Interaction
    const toggleCommentLike = (id: string) => {
        setLikedComments((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // Social Reply Interaction (Local feedback)
    const handleReplyClick = (id: string) => {
        setActiveReplyId(id);
        setTimeout(() => {
            setActiveReplyId((curr) => (curr === id ? null : curr));
        }, 2200);
    };

    // Trigger Floating Particle Burst on Reaction Click
    const handleReactionClick = (
        type: "thumbs" | "flame" | "heart",
        label: string,
        color: string,
        e: React.MouseEvent<HTMLButtonElement>
    ) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setReactionCounts((prev) => ({ ...prev, [type]: prev[type] + 1 }));
        setReactionBouncing(type);
        setTimeout(() => setReactionBouncing(null), 450);

        const newParticle: FloatingParticle = {
            id: Date.now() + Math.random(),
            x: rect.left + rect.width / 2,
            y: rect.top,
            label,
            color,
        };

        setParticles((prev) => [...prev.slice(-4), newParticle]);
        setTimeout(() => {
            setParticles((prev) => prev.filter((p) => p.id !== newParticle.id));
        }, 900);
    };

    // 5 Social Proof Testimonials matching the exact visual reference
    const testimonials: Testimonial[] = [
        // 1. Top-Left: Arjun Iyer (X / Twitter)
        {
            id: "arjun",
            author: "Arjun Iyer",
            handleTime: "5h",
            initials: "AI",
            avatarBg: "bg-amber-600",
            platform: "x",
            content: "This card says more than my whole resume.",
            baseLikes: 41,
            tiltClass: "-rotate-2 hover:rotate-0",
            positionClass: "xl:top-6 xl:left-2 2xl:left-8",
        },
        // 2. Bottom-Left: Sneha Reddy (LinkedIn)
        {
            id: "sneha",
            author: "Sneha Reddy",
            handleTime: "1d",
            initials: "SR",
            avatarBg: "bg-purple-600",
            platform: "linkedin",
            content: "Scanned the QR on the back and landed right on your profile. So clean.",
            baseLikes: 18,
            repliesCount: "2 replies",
            tiltClass: "rotate-2 hover:rotate-0",
            positionClass: "xl:bottom-12 xl:left-2 2xl:left-8",
        },
        // 3. Top-Right: Riya Sharma (LinkedIn)
        {
            id: "riya",
            author: "Riya Sharma",
            handleTime: "2d",
            initials: "RS",
            avatarBg: "bg-sky-500",
            platform: "linkedin",
            content: (
                <span>
                    <span className="text-indigo-400 font-semibold">@Vineet-Chandel</span> that contest graph is going straight up. Teach me your ways!
                </span>
            ),
            baseLikes: 24,
            repliesCount: "3 replies",
            tiltClass: "rotate-3 hover:rotate-0",
            positionClass: "xl:top-4 xl:right-2 2xl:right-8",
        },
        // 4. Middle-Right: Kabir Malhotra (WhatsApp)
        {
            id: "kabir",
            author: "Kabir Malhotra",
            handleTime: "3h",
            initials: "KM",
            avatarBg: "bg-emerald-600",
            platform: "whatsapp",
            content: "Where did you make this card? Sending it to my whole batch.",
            baseLikes: 9,
            tiltClass: "-rotate-2 hover:rotate-0",
            positionClass: "xl:top-1/2 xl:-translate-y-1/2 xl:right-0 2xl:right-6",
        },
        // 5. Bottom-Right: Vikram Singh (X / Twitter)
        {
            id: "vikram",
            author: "Vikram Singh",
            handleTime: "2d",
            initials: "VS",
            avatarBg: "bg-indigo-600",
            platform: "x",
            content: "Front for LinkedIn and the back for my resume. Smart.",
            baseLikes: 21,
            tiltClass: "rotate-2 hover:rotate-0",
            positionClass: "xl:bottom-10 xl:right-2 2xl:right-8",
        },
    ];

    return (
        <section
            className={`relative w-full min-h-screen bg-[#05070D] text-white flex flex-col justify-center items-center py-10 sm:py-12 lg:py-14 px-4 sm:px-6 lg:px-8 overflow-hidden select-none font-sans ${className}`}
        >
            {/* Embedded Scoped Keyframes for 60fps Micro-Animations */}
            <style>{`
                @keyframes orbixFloat1 {
                    0%, 100% { transform: translate(-50%, 0px); }
                    50% { transform: translate(-50%, -4px); }
                }
                @keyframes orbixFloat2 {
                    0%, 100% { transform: translate(-50%, -50%); }
                    50% { transform: translate(-50%, calc(-50% + 5px)); }
                }
                @keyframes orbixFloat3 {
                    0%, 100% { transform: translate(-50%, 0px); }
                    50% { transform: translate(-50%, -4px); }
                }
                @keyframes orbixParticleRise {
                    0% { transform: translate(-50%, 0) scale(0.85); opacity: 1; }
                    100% { transform: translate(-50%, -36px) scale(1.15); opacity: 0; }
                }
                @media (prefers-reduced-motion: reduce) {
                    .orbix-anim-float-1,
                    .orbix-anim-float-2,
                    .orbix-anim-float-3 {
                        animation: none !important;
                    }
                }
            `}</style>

            {/* Restrained Ambient Midnight Indigo Glows (Contained within height) */}
            <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] sm:w-[1100px] h-[550px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-600/18 via-purple-900/10 to-transparent blur-3xl pointer-events-none -z-10" />
            <div className="absolute bottom-6 left-1/3 w-[500px] h-[300px] bg-purple-700/8 blur-[130px] pointer-events-none -z-10" />

            {/* Floating Click Particles Container */}
            <div className="fixed inset-0 pointer-events-none z-50">
                {particles.map((p) => (
                    <div
                        key={p.id}
                        style={{
                            left: p.x,
                            top: p.y,
                            animation: "orbixParticleRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards",
                            color: p.color,
                        }}
                        className="absolute text-sm font-black drop-shadow-md flex items-center gap-1 select-none"
                    >
                        {p.label}
                    </div>
                ))}
            </div>

            {/* Header: Title and Subtitle with Restrained Glow */}
            <div className="text-center max-w-4xl mx-auto mb-8 sm:mb-10 z-10">
                <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black text-[#F8FAFC] tracking-tight leading-tight sm:leading-none">
                    {title === "One card. Every place that matters." ? (
                        <>
                            One card.{" "}
                            <span className="relative inline-block group cursor-default">
                                <span className="px-3.5 sm:px-4 py-0.5 sm:py-1 rounded-xl sm:rounded-2xl bg-gradient-to-r from-indigo-500/25 via-purple-500/30 to-indigo-500/25 border border-indigo-400/40 text-white shadow-[0_0_22px_rgba(99,102,241,0.32)] transition-all duration-300 group-hover:border-indigo-400/70 group-hover:shadow-[0_0_32px_rgba(99,102,241,0.55)] mx-1 my-1 inline-block">
                                    <span className="bg-gradient-to-r from-white via-indigo-100 to-purple-200 bg-clip-text text-transparent font-black">
                                        Every place
                                    </span>
                                </span>
                            </span>{" "}
                            that matters.
                        </>
                    ) : (
                        title
                    )}
                </h2>
                <p className="text-slate-400 text-sm sm:text-base md:text-lg font-medium mt-3.5 sm:mt-4 max-w-2xl mx-auto leading-relaxed">
                    {subtitle === "Your #CodeEyesCard looks great on LinkedIn, X, WhatsApp and your resume." ? (
                        <>
                            Your{" "}
                            <span className="text-indigo-300 font-semibold transition-colors hover:text-white cursor-pointer">
                                #CodeEyesCard
                            </span>{" "}
                            looks great on LinkedIn, X, WhatsApp and your resume.
                        </>
                    ) : (
                        subtitle
                    )}
                </p>

                {/* Mobile Face Switcher (Only visible on small screens to maintain compact height) */}
                <div className="inline-flex lg:hidden items-center mt-4 p-1 rounded-full bg-[#0C101A] border border-slate-800 shadow-xl">
                    <button
                        type="button"
                        onClick={() => setMobileFace("front")}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            mobileFace === "front"
                                ? "bg-indigo-600 text-white shadow-md"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Front Face
                    </button>
                    <button
                        type="button"
                        onClick={() => setMobileFace("back")}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                            mobileFace === "back"
                                ? "bg-indigo-600 text-white shadow-md"
                                : "text-slate-400 hover:text-white"
                        }`}
                    >
                        Back Face (QR)
                    </button>
                </div>
            </div>

            {/* Main Showcase Stage: Center Cards + Surrounding Social Comments */}
            <div className="relative w-full max-w-[1380px] mx-auto flex items-center justify-center">
                {/* =========================================================================
                    DESKTOP SURROUNDING SOCIAL PROOF COMMENTS
                ========================================================================= */}
                <div className="hidden xl:block pointer-events-auto">
                    {testimonials.map((t) => {
                        const isLiked = likedComments[t.id];
                        const currentLikes = t.baseLikes + (isLiked ? 1 : 0);
                        const isReplying = activeReplyId === t.id;

                        return (
                            <div
                                key={t.id}
                                className={`absolute z-20 w-[275px] 2xl:w-[305px] bg-[#0A0D16]/92 border border-slate-800/85 rounded-2xl p-4 shadow-[0_16px_36px_-10px_rgba(0,0,0,0.85),_inset_0_1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-all duration-300 hover:scale-[1.03] hover:border-indigo-500/40 hover:shadow-[0_20px_45px_-10px_rgba(99,102,241,0.25)] hover:z-30 cursor-pointer ${t.tiltClass} ${t.positionClass}`}
                                onClick={() => toggleCommentLike(t.id)}
                            >
                                {/* Comment Header */}
                                <div className="flex items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div
                                            className={`w-7 h-7 rounded-full ${t.avatarBg} text-white font-black text-xs flex items-center justify-center flex-shrink-0 shadow-sm`}
                                        >
                                            {t.initials}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5 text-xs">
                                                <span className="font-bold text-[#F8FAFC] truncate">{t.author}</span>
                                                <span className="text-slate-600 font-bold">·</span>
                                                <span className="text-slate-400">{t.handleTime}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Social Icon Badge */}
                                    <div className="flex-shrink-0">
                                        {t.platform === "x" && (
                                            <div className="w-5 h-5 rounded-md bg-black/90 border border-slate-700/80 flex items-center justify-center p-1 text-white">
                                                <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 24.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                                </svg>
                                            </div>
                                        )}
                                        {t.platform === "linkedin" && (
                                            <div className="w-5 h-5 rounded-md bg-[#0a66c2] flex items-center justify-center p-1 text-white shadow-xs">
                                                <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                                </svg>
                                            </div>
                                        )}
                                        {t.platform === "whatsapp" && (
                                            <div className="w-5 h-5 rounded-md bg-[#25D366] flex items-center justify-center p-1 text-white shadow-xs">
                                                <svg className="w-full h-full fill-current" viewBox="0 0 24 24">
                                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Body Text */}
                                <div className="text-slate-200 text-xs sm:text-[13px] mt-2.5 font-normal leading-snug">
                                    {t.content}
                                </div>

                                {/* Interactive Footer */}
                                <div className="flex items-center gap-3.5 mt-3 text-[11px] text-slate-400 font-medium">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            toggleCommentLike(t.id);
                                        }}
                                        className={`flex items-center gap-1.5 transition-all ${
                                            isLiked ? "text-sky-400 font-bold scale-105" : "hover:text-white"
                                        }`}
                                        title="Like comment"
                                    >
                                        <ThumbsUp className={`w-3.5 h-3.5 ${isLiked ? "fill-current" : ""}`} />
                                        <span>{currentLikes}</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleReplyClick(t.id);
                                        }}
                                        className="hover:text-white transition-colors relative"
                                    >
                                        {isReplying ? (
                                            <span className="text-emerald-400 font-bold flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Copied
                                            </span>
                                        ) : (
                                            "Reply"
                                        )}
                                    </button>

                                    {t.repliesCount && (
                                        <>
                                            <span className="text-slate-700">·</span>
                                            <span className="hover:text-slate-200 transition-colors">{t.repliesCount}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* =========================================================================
                    CENTRAL PROFILE CARDS WITH 3D FLIP & DYNAMIC LIGHTING
                ========================================================================= */}
                <div className="relative flex flex-col items-center">
                    <div className="relative flex flex-row items-center justify-center gap-5 sm:gap-7 lg:gap-9 [perspective:1400px]">
                        {/* ==================== CARD 1: FRONT FACE (Click to 3D Flip) ==================== */}
                        <div
                            className={`flex flex-col items-center transition-opacity duration-300 ${
                                mobileFace === "back" ? "hidden lg:flex" : "flex"
                            }`}
                        >
                            <div
                                onClick={() => setIsLeftFlipped((prev) => !prev)}
                                onMouseMove={(e) => handleCardMouseMove(e, "left")}
                                onMouseLeave={() => handleCardMouseLeave("left")}
                                className="group relative cursor-pointer select-none"
                                style={{
                                    width: desktopCardWidth,
                                    height: desktopCardHeight,
                                    transform: `rotate(-3deg) rotateX(${leftTilt.x}deg) rotateY(${leftTilt.y}deg)`,
                                    transition: isLeftHovered
                                        ? "transform 0.15s ease-out, box-shadow 0.25s ease-out"
                                        : "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease-out",
                                    transformStyle: "preserve-3d",
                                    boxShadow: isLeftHovered
                                        ? "0 35px 80px -15px rgba(0,0,0,0.95), 0 0 50px -10px rgba(99,102,241,0.45)"
                                        : "0 28px 70px -15px rgba(0,0,0,0.9), 0 0 40px -10px rgba(99,102,241,0.3)",
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label="Flip Front Card"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setIsLeftFlipped((prev) => !prev);
                                    }
                                }}
                            >
                                {/* 3D Flipper Box */}
                                <div
                                    className="relative w-full h-full rounded-[28px] sm:rounded-[34px] overflow-hidden border border-slate-800 transition-transform duration-700 [transform-style:preserve-3d]"
                                    style={{
                                        transform: isLeftFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                                    }}
                                >
                                    {/* Primary Front Side */}
                                    <div className="w-full h-full [backface-visibility:hidden]">
                                        <div
                                            style={{
                                                width: 1080,
                                                height: 1920,
                                                transform: `scale(${desktopScale})`,
                                                transformOrigin: "top left",
                                            }}
                                        >
                                            <InstagramStoryCard
                                                user={user}
                                                stats={stats}
                                                coderType={coderType}
                                                topPlatforms={topPlatforms}
                                                allConnectedPlatforms={allConnectedPlatforms}
                                                githubStats={githubStats}
                                                includeGitHub={true}
                                                theme={theme}
                                                face="front"
                                                publicProfileUrl={publicProfileUrl}
                                                connectedPortals={connectedPortals}
                                                showcaseMode="problems"
                                                slotCategory="both"
                                                topContests={mockTopContests}
                                            />
                                        </div>
                                    </div>

                                    {/* Reverse Back Side (Revealed when Left Card is Flipped) */}
                                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                        <div
                                            style={{
                                                width: 1080,
                                                height: 1920,
                                                transform: `scale(${desktopScale})`,
                                                transformOrigin: "top left",
                                            }}
                                        >
                                            <InstagramStoryCard
                                                user={user}
                                                stats={stats}
                                                coderType={coderType}
                                                topPlatforms={topPlatforms}
                                                allConnectedPlatforms={allConnectedPlatforms}
                                                githubStats={githubStats}
                                                includeGitHub={true}
                                                theme={theme}
                                                face="back"
                                                publicProfileUrl={publicProfileUrl}
                                                connectedPortals={connectedPortals}
                                                showcaseMode="problems"
                                                slotCategory="both"
                                                topContests={mockTopContests}
                                            />
                                        </div>
                                    </div>

                                    {/* Specular Glare Effect on Pointer Move */}
                                    <div
                                        className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-200"
                                        style={{
                                            opacity: leftTilt.opacity,
                                            background: `radial-gradient(circle 380px at ${leftTilt.sheenX}% ${leftTilt.sheenY}%, rgba(255,255,255,0.16), transparent 70%)`,
                                        }}
                                    />
                                </div>

                                {/* Subtle Interactive Flip Hint Pill on Hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-3 right-3 z-40 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-200 border border-white/10 flex items-center gap-1 shadow-lg pointer-events-none">
                                    <RotateCcw className="w-2.5 h-2.5 text-indigo-400" />
                                    <span>Click to flip</span>
                                </div>
                            </div>

                            {/* Front Label Pill (Interactive) */}
                            <button
                                type="button"
                                onClick={() => setIsLeftFlipped((prev) => !prev)}
                                className={`mt-3.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                                    isLeftFlipped
                                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50"
                                        : "bg-[#0E131E] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                                }`}
                                title="Toggle front card flip"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                <span>{isLeftFlipped ? "Back (Flipped)" : "Front"}</span>
                                <RotateCcw className="w-3 h-3 text-slate-400 ml-0.5" />
                            </button>
                        </div>

                        {/* ==================== CARD 2: BACK FACE (Click to 3D Flip) ==================== */}
                        <div
                            className={`flex flex-col items-center transition-opacity duration-300 ${
                                mobileFace === "front" ? "hidden lg:flex" : "flex"
                            }`}
                        >
                            <div
                                onClick={() => setIsRightFlipped((prev) => !prev)}
                                onMouseMove={(e) => handleCardMouseMove(e, "right")}
                                onMouseLeave={() => handleCardMouseLeave("right")}
                                className="group relative cursor-pointer select-none"
                                style={{
                                    width: desktopCardWidth,
                                    height: desktopCardHeight,
                                    transform: `rotate(2.5deg) rotateX(${rightTilt.x}deg) rotateY(${rightTilt.y}deg)`,
                                    transition: isRightHovered
                                        ? "transform 0.15s ease-out, box-shadow 0.25s ease-out"
                                        : "transform 0.6s cubic-bezier(0.23, 1, 0.32, 1), box-shadow 0.3s ease-out",
                                    transformStyle: "preserve-3d",
                                    boxShadow: isRightHovered
                                        ? "0 35px 80px -15px rgba(0,0,0,0.95), 0 0 50px -10px rgba(99,102,241,0.4)"
                                        : "0 28px 70px -15px rgba(0,0,0,0.9), 0 0 40px -10px rgba(99,102,241,0.25)",
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label="Flip Back Card"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setIsRightFlipped((prev) => !prev);
                                    }
                                }}
                            >
                                {/* 3D Flipper Box */}
                                <div
                                    className="relative w-full h-full rounded-[28px] sm:rounded-[34px] overflow-hidden border border-slate-800 transition-transform duration-700 [transform-style:preserve-3d]"
                                    style={{
                                        transform: isRightFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                                    }}
                                >
                                    {/* Primary Back Side (QR Profile) */}
                                    <div className="w-full h-full [backface-visibility:hidden]">
                                        <div
                                            style={{
                                                width: 1080,
                                                height: 1920,
                                                transform: `scale(${desktopScale})`,
                                                transformOrigin: "top left",
                                            }}
                                        >
                                            <InstagramStoryCard
                                                user={user}
                                                stats={stats}
                                                coderType={coderType}
                                                topPlatforms={topPlatforms}
                                                allConnectedPlatforms={allConnectedPlatforms}
                                                githubStats={githubStats}
                                                includeGitHub={true}
                                                theme={theme}
                                                face="back"
                                                publicProfileUrl={publicProfileUrl}
                                                connectedPortals={connectedPortals}
                                                showcaseMode="problems"
                                                slotCategory="both"
                                                topContests={mockTopContests}
                                            />
                                        </div>
                                    </div>

                                    {/* Reverse Front Side (Revealed when Right Card is Flipped) */}
                                    <div className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]">
                                        <div
                                            style={{
                                                width: 1080,
                                                height: 1920,
                                                transform: `scale(${desktopScale})`,
                                                transformOrigin: "top left",
                                            }}
                                        >
                                            <InstagramStoryCard
                                                user={user}
                                                stats={stats}
                                                coderType={coderType}
                                                topPlatforms={topPlatforms}
                                                allConnectedPlatforms={allConnectedPlatforms}
                                                githubStats={githubStats}
                                                includeGitHub={true}
                                                theme={theme}
                                                face="front"
                                                publicProfileUrl={publicProfileUrl}
                                                connectedPortals={connectedPortals}
                                                showcaseMode="problems"
                                                slotCategory="both"
                                                topContests={mockTopContests}
                                            />
                                        </div>
                                    </div>

                                    {/* Specular Glare Effect on Pointer Move */}
                                    <div
                                        className="pointer-events-none absolute inset-0 z-30 transition-opacity duration-200"
                                        style={{
                                            opacity: rightTilt.opacity,
                                            background: `radial-gradient(circle 380px at ${rightTilt.sheenX}% ${rightTilt.sheenY}%, rgba(255,255,255,0.16), transparent 70%)`,
                                        }}
                                    />
                                </div>

                                {/* Subtle Interactive Flip Hint Pill on Hover */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute top-3 right-3 z-40 bg-black/75 backdrop-blur-md px-2.5 py-1 rounded-full text-[10px] font-bold text-slate-200 border border-white/10 flex items-center gap-1 shadow-lg pointer-events-none">
                                    <RotateCcw className="w-2.5 h-2.5 text-indigo-400" />
                                    <span>Click to flip</span>
                                </div>
                            </div>

                            {/* Back Label Pill (Interactive) */}
                            <button
                                type="button"
                                onClick={() => setIsRightFlipped((prev) => !prev)}
                                className={`mt-3.5 px-5 py-1.5 rounded-full text-xs font-bold transition-all flex items-center gap-1.5 shadow-md ${
                                    isRightFlipped
                                        ? "bg-indigo-600/30 text-indigo-300 border border-indigo-500/50"
                                        : "bg-[#0E131E] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700"
                                }`}
                                title="Toggle back card flip"
                            >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                <span>{isRightFlipped ? "Front (Flipped)" : "Back"}</span>
                                <span className="text-slate-600">·</span>
                                <span className="text-slate-400 font-medium">scan to open the profile</span>
                                <RotateCcw className="w-3 h-3 text-slate-400 ml-0.5" />
                            </button>
                        </div>

                        {/* ==================== 3 INTERACTIVE FLOATING REACTION BADGES ==================== */}
                        {/* 1. Top Blue Thumbs Up Reaction */}
                        <button
                            type="button"
                            onClick={(e) => handleReactionClick("thumbs", `+1 👍 (${reactionCounts.thumbs + 1})`, "#38BDF8", e)}
                            style={{ animation: "orbixFloat1 3.4s ease-in-out infinite" }}
                            className={`hidden sm:flex absolute -top-4 left-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#1D9BF0] text-white items-center justify-center shadow-[0_10px_25px_rgba(29,155,240,0.55)] border-2 border-white/20 transition-transform active:scale-90 hover:scale-110 cursor-pointer ${
                                reactionBouncing === "thumbs" ? "scale-125" : ""
                            }`}
                            title={`Like profile (${reactionCounts.thumbs})`}
                            aria-label="React thumbs up"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M2 20h2c.55 0 1-.45 1-1v-9c0-.55-.45-1-1-1H2v11zm19.83-7.12c.11-.25.17-.52.17-.8 0-1.1-.9-2-2-2h-5.5l.92-4.65c.05-.22.02-.46-.08-.66-.23-.45-.52-.86-.88-1.22L14 3.12 7.88 9.24C7.33 9.79 7 10.54 7 11.32V19c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-.02l-.17-.1z" />
                            </svg>
                        </button>

                        {/* 2. Middle Orange Flame / Streak Reaction */}
                        <button
                            type="button"
                            onClick={(e) => handleReactionClick("flame", `+1 🔥 19d Streak`, "#F97316", e)}
                            style={{ animation: "orbixFloat2 3.8s ease-in-out infinite 0.7s" }}
                            className={`hidden sm:flex absolute top-1/2 left-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F97316] text-white items-center justify-center shadow-[0_10px_25px_rgba(249,115,22,0.55)] border-2 border-white/20 transition-transform active:scale-90 hover:scale-110 cursor-pointer ${
                                reactionBouncing === "flame" ? "scale-125" : ""
                            }`}
                            title={`Daily coding streak (${reactionCounts.flame})`}
                            aria-label="React streak flame"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12 23c-4.97 0-9-4.03-9-9 0-4.18 2.76-7.73 6.64-8.73.47-.12.92.17 1.01.65.04.22-.02.45-.16.62-1.07 1.34-1.63 3.01-1.49 4.74.22 2.64 2.29 4.77 4.93 5.06 3.16.35 5.86-1.92 6.06-4.99.1-1.54-.45-3.03-1.49-4.15-.29-.32-.24-.82.1-1.08.2-.15.46-.19.69-.1 3.51 1.47 5.91 4.91 5.91 8.98 0 4.97-4.03 9-9 9z" />
                            </svg>
                        </button>

                        {/* 3. Bottom Pink Heart Reaction */}
                        <button
                            type="button"
                            onClick={(e) => handleReactionClick("heart", `+1 ❤️ Recruiter Love`, "#EC4899", e)}
                            style={{ animation: "orbixFloat3 3.5s ease-in-out infinite 1.4s" }}
                            className={`hidden sm:flex absolute -bottom-1 left-1/2 z-30 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#EC4899] text-white items-center justify-center shadow-[0_10px_25px_rgba(236,72,153,0.55)] border-2 border-white/20 transition-transform active:scale-90 hover:scale-110 cursor-pointer ${
                                reactionBouncing === "heart" ? "scale-125" : ""
                            }`}
                            title={`Love profile card (${reactionCounts.heart})`}
                            aria-label="React heart"
                        >
                            <svg className="w-5 h-5 sm:w-6 sm:h-6 fill-current" viewBox="0 0 24 24">
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>

            {/* Compact Responsive Footer Social Proof (Shown on tablet/mobile without expanding vertical height) */}
            <div className="xl:hidden mt-6 w-full max-w-xl mx-auto flex items-center justify-center gap-3 overflow-x-auto px-2 py-1">
                {testimonials.slice(0, 2).map((t) => (
                    <div
                        key={`mobile-preview-${t.id}`}
                        className="bg-[#0A0D16]/95 border border-slate-800 rounded-xl px-3 py-2 flex items-center gap-2.5 text-xs text-slate-300 flex-1 min-w-[200px]"
                    >
                        <div className={`w-6 h-6 rounded-full ${t.avatarBg} text-white font-black text-[10px] flex items-center justify-center flex-shrink-0`}>
                            {t.initials}
                        </div>
                        <p className="truncate text-[11px] text-slate-300">{t.content}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default Card;
