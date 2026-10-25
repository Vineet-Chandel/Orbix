import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Sparkles } from "lucide-react";
import { LinkedInCard } from "../../../app/Profile/CardStudio/LinkedInCard";
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

export const Card: React.FC<ProfileCardSectionProps> = ({
    title = "One card. Every place that matters.",
    subtitle = "Your #OrbixCard looks great on LinkedIn, X, WhatsApp and your resume.",
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
    // 3D Flip States using motion library
    const [isStoryFlipped, setIsStoryFlipped] = useState(false);
    const [isLinkedInFlipped, setIsLinkedInFlipped] = useState(false);

    // Viewport-aware responsive sizing for 1.5x enlargement
    const [viewportWidth, setViewportWidth] = useState(
        typeof window !== "undefined" ? window.innerWidth : 1536
    );

    useEffect(() => {
        const handleResize = () => setViewportWidth(window.innerWidth);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // Responsive 1.5x sizing calculation
    // Base 1.5x targets:
    // Instagram Story: 486px × 864px (native 1080 × 1920, scale: 0.45)
    // LinkedIn: 936px × 489px (native 1200 × 627, scale: 0.78)
    let sizeFactor = 1;
    if (viewportWidth >= 1536) {
        sizeFactor = 1;
    } else if (viewportWidth >= 1280) {
        sizeFactor = 0.88;
    } else if (viewportWidth >= 1024) {
        sizeFactor = 0.74;
    }

    // 1. Instagram Story Card (LEFT)
    const storyWidth =
        viewportWidth < 640
            ? Math.min(viewportWidth - 32, 340)
            : viewportWidth < 1024
                ? 380
                : Math.round(486 * sizeFactor);
    const storyScale = storyWidth / 1080;
    const storyHeight = Math.round(storyWidth * (1920 / 1080));

    // 2. LinkedIn Card (RIGHT)
    const linkedInWidth =
        viewportWidth < 640
            ? Math.min(viewportWidth - 32, 380)
            : viewportWidth < 1024
                ? Math.min(viewportWidth - 48, 640)
                : Math.round(936 * sizeFactor);
    const linkedInScale = linkedInWidth / 1200;
    const linkedInHeight = Math.round(linkedInWidth * (627 / 1200));

    return (
        <section
            className={`relative w-full bg-[#FAF6EE] text-neutral-900 py-14 sm:py-20 px-4 sm:px-6 lg:px-8 overflow-hidden font-sans select-none ${className}`}
        >
            {/* Warm, eye-friendly dot grid matching Orbix platform canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Side-by-Side Parallel Cards: Instagram Story on LEFT, LinkedIn on RIGHT */}
            <div className="relative w-full max-w-[1540px] mx-auto flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-10 xl:gap-12">
                {/* =========================================================================
                    CARD 1 (LEFT): INSTAGRAM STORY CARD (Portrait 1080 x 1920) 1.5x
                ========================================================================= */}
                <div className="flex flex-col items-center">
                    {/* 3D Motion Card Container (Scale effect on hover strictly turned OFF) */}
                    <div style={{ perspective: 1800 }}>
                        <motion.div
                            className="relative cursor-pointer select-none"
                            style={{
                                width: storyWidth,
                                height: storyHeight,
                                transformStyle: "preserve-3d",
                            }}
                            animate={{ rotateY: isStoryFlipped ? 180 : 0 }}
                            transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
                            onClick={() => setIsStoryFlipped((prev) => !prev)}
                            role="button"
                            tabIndex={0}
                            aria-label="Flip Instagram Story Card in 3D"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setIsStoryFlipped((prev) => !prev);
                                }
                            }}
                        >
                            {/* Front Face (Default View) */}
                            <div
                                className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden border-2 border-black shadow-[8px_8px_0px_#000]"
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: 1080,
                                        height: 1920,
                                        transform: `scale(${storyScale})`,
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

                            {/* Back Face (Revealed on 3D Flip) */}
                            <div
                                className="absolute inset-0 w-full h-full rounded-[28px] sm:rounded-[36px] overflow-hidden border-2 border-black shadow-[8px_8px_0px_#000]"
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                }}
                            >
                                <div
                                    style={{
                                        width: 1080,
                                        height: 1920,
                                        transform: `scale(${storyScale})`,
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
                        </motion.div>
                    </div>

                    {/* Dedicated 3D Flip Button for Story Card */}
                    <button
                        type="button"
                        onClick={() => setIsStoryFlipped((prev) => !prev)}
                        className="mt-4 px-5 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 border-2 border-black bg-white text-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                        title="Rotate Instagram story card in 3D"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 text-black stroke-[2.5] transition-transform duration-500 ${isStoryFlipped ? "rotate-180" : ""}`} />
                        <span>
                            {isStoryFlipped ? "Showing Back (QR & Activity) · Flip to Front" : "Showing Front Face · Flip to Back"}
                        </span>
                    </button>
                </div>

                {/* =========================================================================
                    CARD 2 (RIGHT): LINKEDIN CARD (Landscape 1200 x 627) 1.5x
                ========================================================================= */}
                <div className="flex flex-col items-center">
                    {/* Format Header Pill */}


                    {/* 3D Motion Card Container (Scale effect on hover strictly turned OFF) */}
                    <div style={{ perspective: 1800 }}>
                        <motion.div
                            className="relative cursor-pointer select-none"
                            style={{
                                width: linkedInWidth,
                                height: linkedInHeight,
                                transformStyle: "preserve-3d",
                            }}
                            animate={{ rotateY: isLinkedInFlipped ? 180 : 0 }}
                            transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
                            onClick={() => setIsLinkedInFlipped((prev) => !prev)}
                            role="button"
                            tabIndex={0}
                            aria-label="Flip LinkedIn Card in 3D"
                            onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setIsLinkedInFlipped((prev) => !prev);
                                }
                            }}
                        >
                            {/* Front Face (Default View) */}
                            <div
                                className="absolute inset-0 w-full h-full rounded-[26px] sm:rounded-[32px] overflow-hidden border-2 border-black shadow-[8px_8px_0px_#000]"
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        width: 1200,
                                        height: 627,
                                        transform: `scale(${linkedInScale})`,
                                        transformOrigin: "top left",
                                    }}
                                >
                                    <LinkedInCard
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

                            {/* Back Face (Revealed on 3D Flip) */}
                            <div
                                className="absolute inset-0 w-full h-full rounded-[26px] sm:rounded-[32px] overflow-hidden border-2 border-black shadow-[8px_8px_0px_#000]"
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                }}
                            >
                                <div
                                    style={{
                                        width: 1200,
                                        height: 627,
                                        transform: `scale(${linkedInScale})`,
                                        transformOrigin: "top left",
                                    }}
                                >
                                    <LinkedInCard
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
                        </motion.div>
                    </div>

                    {/* Dedicated 3D Flip Button for LinkedIn Card */}
                    <button
                        type="button"
                        onClick={() => setIsLinkedInFlipped((prev) => !prev)}
                        className="mt-4 px-5 py-2.5 rounded-full text-xs font-black transition-all flex items-center gap-2 border-2 border-black bg-white text-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                        title="Rotate LinkedIn card in 3D"
                    >
                        <RotateCcw className={`w-3.5 h-3.5 text-black stroke-[2.5] transition-transform duration-500 ${isLinkedInFlipped ? "rotate-180" : ""}`} />
                        <span>
                            {isLinkedInFlipped ? "Showing Back (QR & Links) · Flip to Front" : "Showing Front Face · Flip to Back"}
                        </span>
                    </button>
                </div>
            </div>


        </section>
    );
};

export default Card;
