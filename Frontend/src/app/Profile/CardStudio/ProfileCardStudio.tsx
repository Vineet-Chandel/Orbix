import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { toPng } from "html-to-image";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, useAppSelector, fetchContestPerformance } from "../../../store";
import { CARD_THEMES } from "./types";
import type { CardFormat, CardFace, CardThemeId, SlotShowcaseCategory } from "./types";
import {
    aggregateCodingStats,
    getCoderType,
    getAvailableCardPlatforms,
    resolveShowcasedPlatforms,
    extractGitHubStats,
    getAllConnectedPlatforms,
    getAvailableContestPlatforms,
    resolveShowcasedContests,
} from "../../../utils/cardStatsAggregator";
import { LinkedInCard } from "./LinkedInCard";
import { InstagramStoryCard } from "./InstagramStoryCard";
import { CardCustomizerToolbar } from "./CardCustomizerToolbar";
import { OrbixLogo } from "../../../components/OrbixLogo";

interface ProfileCardStudioProps {
    user: any;
    connectedPortals: Record<string, any>;
}

export const ProfileCardStudio: React.FC<ProfileCardStudioProps> = ({
    user,
    connectedPortals,
}) => {
    const toast = useToast();
    const dispatch = useAppDispatch();

    // Studio Customization State
    const [format, setFormat] = useState<CardFormat>("linkedin");
    const [face, setFace] = useState<CardFace>("front");
    const [themeId, setThemeId] = useState<CardThemeId>("indigo");
    const [includeGitHub, setIncludeGitHub] = useState(true);
    const [customSlots, setCustomSlots] = useState<string[]>([]);
    const [slotCategory, setSlotCategory] = useState<SlotShowcaseCategory>("both");
    const [showcaseMode, setShowcaseMode] = useState<"problems" | "contests">("problems");
    const [customContestSlots, setCustomContestSlots] = useState<string[]>([]);
    const [isExporting, setIsExporting] = useState(false);

    // Dynamic scale measurement for preview
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(560);

    // Off-screen export node ref for 100% pixel-perfect unscaled PNG rendering
    const exportNodeRef = useRef<HTMLDivElement>(null);

    // Measure preview viewport width responsively
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                if (rect.width > 0) {
                    setContainerWidth(rect.width);
                }
            }
        };

        updateWidth();
        window.addEventListener("resize", updateWidth);
        const observer = new ResizeObserver(updateWidth);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateWidth);
            observer.disconnect();
        };
    }, []);

    const maxSlots = format === "linkedin" ? 3 : 5;

    // Unified Redux Contests Performance Fetching
    const effectiveUser = (user?.username || user?.firstName || "").trim();
    const contestData = useAppSelector((state) => state.contests.dataByUser[effectiveUser]);

    useEffect(() => {
        if (effectiveUser) {
            dispatch(fetchContestPerformance({ username: effectiveUser, portals: connectedPortals }));
        }
    }, [dispatch, effectiveUser, connectedPortals]);

    // Multi-Platform Coding Analytics
    const userFallback = user?.username || user?.firstName || "developer";
    const stats = useMemo(() => aggregateCodingStats(connectedPortals), [connectedPortals]);
    const coderType = useMemo(() => getCoderType(stats.totalSolved, stats.contests), [stats.totalSolved, stats.contests]);
    const availablePlatforms = useMemo(
        () => getAvailableCardPlatforms(connectedPortals, userFallback, contestData?.platforms),
        [connectedPortals, userFallback, contestData?.platforms]
    );
    const allConnectedPlatforms = useMemo(() => getAllConnectedPlatforms(connectedPortals), [connectedPortals]);
    const githubStats = useMemo(() => extractGitHubStats(connectedPortals, userFallback), [connectedPortals, userFallback]);

    const isGitHubConnected = Boolean(
        connectedPortals.github?.connected || connectedPortals.github?.username || githubStats.connected
    );

    // Dynamic Platform Slot Resolution for both formats
    const linkedinPlatforms = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, customSlots, 3, slotCategory, userFallback, contestData?.platforms),
        [connectedPortals, customSlots, slotCategory, userFallback, contestData?.platforms]
    );

    const storyPlatforms = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, customSlots, 5, slotCategory, userFallback, contestData?.platforms),
        [connectedPortals, customSlots, slotCategory, userFallback, contestData?.platforms]
    );

    const showcasedPlatforms = format === "linkedin" ? linkedinPlatforms : storyPlatforms;

    // The current slot IDs matching the showcased platforms
    const currentSlotIds = useMemo(() => {
        const ids: string[] = [];
        for (let i = 0; i < maxSlots; i++) {
            ids.push(showcasedPlatforms[i]?.id || "");
        }
        return ids;
    }, [showcasedPlatforms, maxSlots]);

    const isCustomized = customSlots.length > 0;

    const handleCategoryChange = (newCat: SlotShowcaseCategory) => {
        setSlotCategory(newCat);
        setCustomSlots([]);
        if (newCat === "practice") {
            setIncludeGitHub(false);
        } else {
            setIncludeGitHub(true);
        }
    };

    // Slot Management Handlers
    const handleSlotChange = (slotIndex: number, newPlatformId: string) => {
        const next = [...currentSlotIds];
        if (newPlatformId) {
            const existingIdx = next.indexOf(newPlatformId);
            if (existingIdx !== -1 && existingIdx !== slotIndex) {
                next[existingIdx] = next[slotIndex];
            }
            next[slotIndex] = newPlatformId;
        } else {
            next[slotIndex] = "";
        }
        const filtered = next.filter(Boolean);
        setCustomSlots(filtered);

        if (newPlatformId === "github") {
            setIncludeGitHub(true);
        } else if (currentSlotIds[slotIndex] === "github" && !filtered.includes("github")) {
            setIncludeGitHub(false);
        }
    };

    const handleSwapSlots = (indexA: number, indexB: number) => {
        if (indexA < 0 || indexA >= maxSlots || indexB < 0 || indexB >= maxSlots) return;
        const next = [...currentSlotIds];
        const temp = next[indexA];
        next[indexA] = next[indexB];
        next[indexB] = temp;
        setCustomSlots(next.filter(Boolean));
    };

    const handleRemoveSlot = (slotIndex: number) => {
        const removedId = currentSlotIds[slotIndex];
        const next = currentSlotIds.filter((_, idx) => idx !== slotIndex);
        setCustomSlots(next.filter(Boolean));
        if (removedId === "github") {
            setIncludeGitHub(false);
        }
    };

    const handleTogglePlatform = (platformId: string) => {
        if (currentSlotIds.includes(platformId)) {
            // Remove
            const next = currentSlotIds.filter((id) => id !== platformId);
            setCustomSlots(next);
            if (platformId === "github") {
                setIncludeGitHub(false);
            }
        } else {
            // Add
            const next = [...currentSlotIds.filter(Boolean)];
            if (next.length < maxSlots) {
                next.push(platformId);
            } else {
                next[maxSlots - 1] = platformId;
            }
            setCustomSlots(next);
            if (platformId === "github") {
                setIncludeGitHub(true);
            }
        }
    };

    const handleResetSlots = () => {
        setCustomSlots([]);
    };

    const handleToggleGitHub = (checked: boolean) => {
        setIncludeGitHub(checked);
        if (customSlots.length > 0) {
            if (checked && !customSlots.includes("github")) {
                const next = [...customSlots];
                if (next.length >= maxSlots) {
                    next[maxSlots - 1] = "github";
                } else {
                    next.push("github");
                }
                setCustomSlots(next);
            } else if (!checked && customSlots.includes("github")) {
                setCustomSlots(customSlots.filter((id) => id !== "github"));
            }
        }
    };

    // Contest Platforms & Dynamic Slot Resolution
    const availableContests = useMemo(
        () => getAvailableContestPlatforms(contestData?.platforms, connectedPortals, userFallback),
        [contestData?.platforms, connectedPortals, userFallback]
    );

    const linkedinContests = useMemo(
        () => resolveShowcasedContests(contestData?.platforms, connectedPortals, customContestSlots, 3, userFallback),
        [contestData?.platforms, connectedPortals, customContestSlots, userFallback]
    );

    const storyContests = useMemo(
        () => resolveShowcasedContests(contestData?.platforms, connectedPortals, customContestSlots, 5, userFallback),
        [contestData?.platforms, connectedPortals, customContestSlots, userFallback]
    );

    const showcasedContests = format === "linkedin" ? linkedinContests : storyContests;

    const currentContestSlotIds = useMemo(() => {
        const ids: string[] = [];
        for (let i = 0; i < maxSlots; i++) {
            ids.push(showcasedContests[i]?.id || "");
        }
        return ids;
    }, [showcasedContests, maxSlots]);

    const isContestCustomized = customContestSlots.length > 0;

    // Contest Slot Handlers
    const handleContestSlotChange = (slotIndex: number, newPlatformId: string) => {
        const next = [...currentContestSlotIds];
        if (newPlatformId) {
            const existingIdx = next.indexOf(newPlatformId);
            if (existingIdx !== -1 && existingIdx !== slotIndex) {
                next[existingIdx] = next[slotIndex];
            }
            next[slotIndex] = newPlatformId;
        } else {
            next[slotIndex] = "";
        }
        setCustomContestSlots(next.filter(Boolean));
    };

    const handleSwapContestSlots = (indexA: number, indexB: number) => {
        if (indexA < 0 || indexA >= maxSlots || indexB < 0 || indexB >= maxSlots) return;
        const next = [...currentContestSlotIds];
        const temp = next[indexA];
        next[indexA] = next[indexB];
        next[indexB] = temp;
        setCustomContestSlots(next.filter(Boolean));
    };

    const handleRemoveContestSlot = (slotIndex: number) => {
        const next = currentContestSlotIds.filter((_, idx) => idx !== slotIndex);
        setCustomContestSlots(next.filter(Boolean));
    };

    const handleToggleContestPlatform = (platformId: string) => {
        if (currentContestSlotIds.includes(platformId)) {
            setCustomContestSlots(currentContestSlotIds.filter((id) => id !== platformId));
        } else {
            const next = [...currentContestSlotIds.filter(Boolean)];
            if (next.length < maxSlots) {
                next.push(platformId);
            } else {
                next[maxSlots - 1] = platformId;
            }
            setCustomContestSlots(next);
        }
    };

    const handleResetContestSlots = () => {
        setCustomContestSlots([]);
    };

    const themeConfig = CARD_THEMES[themeId] || CARD_THEMES.indigo;
    const publicProfileUrl = `${window.location.origin}/profile/u/${encodeURIComponent(user?.username || "")}`;

    // Flip handler
    const handleFlip = () => {
        setFace((prev) => (prev === "front" ? "back" : "front"));
    };

    // Copy public link
    const handleCopyLink = () => {
        navigator.clipboard.writeText(publicProfileUrl).then(
            () => toast.success("Public profile showcase link copied!", { title: "Copied" }),
            () => toast.error("Failed to copy link", { title: "Error" })
        );
    };

    // High-Resolution PNG Export
    const handleDownload = async () => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            // Give 200ms for fonts/images/QR codes to settle in the export canvas
            await new Promise((r) => setTimeout(r, 200));

            if (!exportNodeRef.current) {
                throw new Error("Export canvas element not found");
            }

            const dataUrl = await toPng(exportNodeRef.current, {
                quality: 0.98,
                pixelRatio: 2, // Crisp 2x retina export (LinkedIn: 2400x1254, Story: 2160x3840)
                cacheBust: true,
                backgroundColor: "#0c1017",
            });

            const link = document.createElement("a");
            const sanitizedUser = (user?.username || "developer").replace(/[^a-z0-9_-]/gi, "");
            link.download = `orbix-${sanitizedUser}-${format}-${face}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(
                `Exported ${format === "linkedin" ? "LinkedIn Card" : "Instagram Story"} (${face.toUpperCase()})!`,
                { title: "Export Complete" }
            );
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err?.message || "Failed to export card image. Please try again.", {
                title: "Export Failed",
            });
        } finally {
            setIsExporting(false);
        }
    };

    // Calculate scale factors for live preview for both formats
    const availableWidth = Math.max(containerWidth - 32, 280);

    const linkedinScale = useMemo(() => {
        return availableWidth / 1200;
    }, [availableWidth]);

    const storyScale = useMemo(() => {
        const maxHeight = Math.min(560, window.innerHeight * 0.65);
        const scaleByHeight = maxHeight / 1920;
        const scaleByWidth = availableWidth / 1080;
        return Math.min(scaleByHeight, scaleByWidth);
    }, [availableWidth]);

    const linkedinWidth = 1200 * linkedinScale;
    const linkedinHeight = 627 * linkedinScale;

    const storyWidth = 1080 * storyScale;
    const storyHeight = 1920 * storyScale;

    const activeWidth = format === "linkedin" ? linkedinWidth : storyWidth;
    const activeHeight = format === "linkedin" ? linkedinHeight : storyHeight;

    return (
        <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-5 sm:p-6 flex flex-col space-y-5">
            {/* Studio Header */}
            <div className="flex items-center justify-between pb-4 border-b-2 border-black/10">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-[#FFE566] text-black border-2 border-black flex items-center justify-center p-1.5 shadow-[2px_2px_0px_#000] flex-shrink-0">
                        <OrbixLogo className="w-full h-full text-black" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2">
                            <span>Orbix Share Card Studio</span>
                        </h2>
                        <p className="text-xs text-neutral-600 font-medium">
                            Customizable social cards with scannable QR & aggregated coding analytics.
                        </p>
                    </div>
                </div>
            </div>

            {/* Live Interactive Card Preview Stage */}
            <div
                ref={containerRef}
                className="min-h-[340px] flex items-center justify-center p-3 sm:p-6 py-6 sm:py-8 rounded-2xl relative bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000]"
            >
                {/* 3D Perspective Stage Container */}
                <div
                    style={{ perspective: 1800 }}
                    className="relative flex items-center justify-center flex-shrink-0"
                >
                    <motion.div
                        className="relative cursor-pointer select-none flex-shrink-0"
                        style={{
                            width: activeWidth,
                            height: activeHeight,
                            transformStyle: "preserve-3d",
                            WebkitTransformStyle: "preserve-3d",
                        }}
                        animate={{
                            rotateY: face === "back" ? 180 : 0,
                            width: activeWidth,
                            height: activeHeight,
                        }}
                        transition={{
                            rotateY: { duration: 0.75, ease: [0.23, 1, 0.32, 1] },
                            width: { type: "spring", stiffness: 280, damping: 28, mass: 0.8 },
                            height: { type: "spring", stiffness: 280, damping: 28, mass: 0.8 },
                        }}
                        onClick={handleFlip}
                        role="button"
                        tabIndex={0}
                        aria-label={`Flip ${format === "linkedin" ? "LinkedIn Card" : "Instagram Story Card"} in 3D`}
                        title="Click card to flip"
                        onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleFlip();
                            }
                        }}
                    >
                        {/* =========================================================================
                            FRONT FACE (Default View)
                        ========================================================================= */}
                        <div
                            className={`absolute inset-0 w-full h-full overflow-hidden ${
                                format === "linkedin"
                                    ? "rounded-[22px] sm:rounded-[26px]"
                                    : "rounded-[26px] sm:rounded-[34px]"
                            } border border-neutral-800/90 shadow-2xl bg-[#0c1017]`}
                            style={{
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                                transform: "rotateY(0deg)",
                                boxShadow: `0 30px 70px -15px rgba(0, 0, 0, 0.85), 0 0 45px -10px ${themeConfig.borderGlow}`,
                            }}
                        >
                            {/* LinkedIn Card Layer (Front Face) */}
                            <motion.div
                                key="preview-linkedin-front"
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    width: 1200,
                                    height: 627,
                                    marginLeft: -600,
                                    marginTop: -313.5,
                                    transformOrigin: "center center",
                                    willChange: "transform, opacity, filter",
                                }}
                                initial={false}
                                animate={{
                                    scale: format === "linkedin" ? linkedinScale : linkedinScale * 0.92,
                                    opacity: format === "linkedin" ? 1 : 0,
                                    filter: format === "linkedin" ? "blur(0px)" : "blur(6px)",
                                    pointerEvents: format === "linkedin" ? "auto" : "none",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 28,
                                    mass: 0.8,
                                }}
                            >
                                <LinkedInCard
                                    user={user}
                                    stats={stats}
                                    coderType={coderType}
                                    topPlatforms={linkedinPlatforms}
                                    allConnectedPlatforms={allConnectedPlatforms}
                                    githubStats={githubStats}
                                    includeGitHub={includeGitHub}
                                    theme={themeConfig}
                                    face="front"
                                    publicProfileUrl={publicProfileUrl}
                                    connectedPortals={connectedPortals}
                                    showcaseMode={showcaseMode}
                                    slotCategory={slotCategory}
                                    topContests={linkedinContests}
                                    animate={false}
                                />
                            </motion.div>

                            {/* Instagram Story Card Layer (Front Face) */}
                            <motion.div
                                key="preview-story-front"
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    width: 1080,
                                    height: 1920,
                                    marginLeft: -540,
                                    marginTop: -960,
                                    transformOrigin: "center center",
                                    willChange: "transform, opacity, filter",
                                }}
                                initial={false}
                                animate={{
                                    scale: format === "instagram" ? storyScale : storyScale * 0.92,
                                    opacity: format === "instagram" ? 1 : 0,
                                    filter: format === "instagram" ? "blur(0px)" : "blur(6px)",
                                    pointerEvents: format === "instagram" ? "auto" : "none",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 28,
                                    mass: 0.8,
                                }}
                            >
                                <InstagramStoryCard
                                    user={user}
                                    stats={stats}
                                    coderType={coderType}
                                    topPlatforms={storyPlatforms}
                                    allConnectedPlatforms={allConnectedPlatforms}
                                    githubStats={githubStats}
                                    includeGitHub={includeGitHub}
                                    theme={themeConfig}
                                    face="front"
                                    publicProfileUrl={publicProfileUrl}
                                    connectedPortals={connectedPortals}
                                    showcaseMode={showcaseMode}
                                    slotCategory={slotCategory}
                                    topContests={storyContests}
                                    animate={false}
                                />
                            </motion.div>
                        </div>

                        {/* =========================================================================
                            BACK FACE (Revealed on 3D Flip)
                        ========================================================================= */}
                        <div
                            className={`absolute inset-0 w-full h-full overflow-hidden ${
                                format === "linkedin"
                                    ? "rounded-[22px] sm:rounded-[26px]"
                                    : "rounded-[26px] sm:rounded-[34px]"
                            } border border-neutral-800/90 shadow-2xl bg-[#0c1017]`}
                            style={{
                                backfaceVisibility: "hidden",
                                WebkitBackfaceVisibility: "hidden",
                                transform: "rotateY(180deg)",
                                boxShadow: `0 30px 70px -15px rgba(0, 0, 0, 0.85), 0 0 45px -10px ${themeConfig.borderGlow}`,
                            }}
                        >
                            {/* LinkedIn Card Layer (Back Face) */}
                            <motion.div
                                key="preview-linkedin-back"
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    width: 1200,
                                    height: 627,
                                    marginLeft: -600,
                                    marginTop: -313.5,
                                    transformOrigin: "center center",
                                    willChange: "transform, opacity, filter",
                                }}
                                initial={false}
                                animate={{
                                    scale: format === "linkedin" ? linkedinScale : linkedinScale * 0.92,
                                    opacity: format === "linkedin" ? 1 : 0,
                                    filter: format === "linkedin" ? "blur(0px)" : "blur(6px)",
                                    pointerEvents: format === "linkedin" ? "auto" : "none",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 28,
                                    mass: 0.8,
                                }}
                            >
                                <LinkedInCard
                                    user={user}
                                    stats={stats}
                                    coderType={coderType}
                                    topPlatforms={linkedinPlatforms}
                                    allConnectedPlatforms={allConnectedPlatforms}
                                    githubStats={githubStats}
                                    includeGitHub={includeGitHub}
                                    theme={themeConfig}
                                    face="back"
                                    publicProfileUrl={publicProfileUrl}
                                    connectedPortals={connectedPortals}
                                    showcaseMode={showcaseMode}
                                    slotCategory={slotCategory}
                                    topContests={linkedinContests}
                                    animate={false}
                                />
                            </motion.div>

                            {/* Instagram Story Card Layer (Back Face) */}
                            <motion.div
                                key="preview-story-back"
                                style={{
                                    position: "absolute",
                                    left: "50%",
                                    top: "50%",
                                    width: 1080,
                                    height: 1920,
                                    marginLeft: -540,
                                    marginTop: -960,
                                    transformOrigin: "center center",
                                    willChange: "transform, opacity, filter",
                                }}
                                initial={false}
                                animate={{
                                    scale: format === "instagram" ? storyScale : storyScale * 0.92,
                                    opacity: format === "instagram" ? 1 : 0,
                                    filter: format === "instagram" ? "blur(0px)" : "blur(6px)",
                                    pointerEvents: format === "instagram" ? "auto" : "none",
                                }}
                                transition={{
                                    type: "spring",
                                    stiffness: 280,
                                    damping: 28,
                                    mass: 0.8,
                                }}
                            >
                                <InstagramStoryCard
                                    user={user}
                                    stats={stats}
                                    coderType={coderType}
                                    topPlatforms={storyPlatforms}
                                    allConnectedPlatforms={allConnectedPlatforms}
                                    githubStats={githubStats}
                                    includeGitHub={includeGitHub}
                                    theme={themeConfig}
                                    face="back"
                                    publicProfileUrl={publicProfileUrl}
                                    connectedPortals={connectedPortals}
                                    showcaseMode={showcaseMode}
                                    slotCategory={slotCategory}
                                    topContests={storyContests}
                                    animate={false}
                                />
                            </motion.div>
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Studio Customizer Toolbar */}
            <CardCustomizerToolbar
                format={format}
                onFormatChange={setFormat}
                face={face}
                onFaceChange={setFace}
                onFlip={handleFlip}
                themeId={themeId}
                onThemeChange={setThemeId}
                includeGitHub={includeGitHub}
                onToggleGitHub={handleToggleGitHub}
                isGitHubConnected={isGitHubConnected}
                onDownload={handleDownload}
                isExporting={isExporting}
                onCopyLink={handleCopyLink}
                connectedPlatformCount={availablePlatforms.length}
                maxSlots={maxSlots}
                availablePlatforms={availablePlatforms}
                currentSlotIds={currentSlotIds}
                onSlotChange={handleSlotChange}
                onSwapSlots={handleSwapSlots}
                onRemoveSlot={handleRemoveSlot}
                onTogglePlatform={handleTogglePlatform}
                onResetSlots={handleResetSlots}
                isCustomized={isCustomized}
                slotCategory={slotCategory}
                onSlotCategoryChange={handleCategoryChange}
                showcaseMode={showcaseMode}
                onShowcaseModeChange={setShowcaseMode}
                availableContests={availableContests}
                currentContestSlotIds={currentContestSlotIds}
                onContestSlotChange={handleContestSlotChange}
                onSwapContestSlots={handleSwapContestSlots}
                onRemoveContestSlot={handleRemoveContestSlot}
                onToggleContestPlatform={handleToggleContestPlatform}
                onResetContestSlots={handleResetContestSlots}
                isContestCustomized={isContestCustomized}
            />

            {/* Hidden Offscreen Node at Exact Native Dimensions for Clean High-Res Export (Only mounted during export) */}
            {isExporting && (
                <div
                    aria-hidden="true"
                    style={{
                        position: "fixed",
                        left: "-9999px",
                        top: 0,
                        opacity: 0,
                        pointerEvents: "none",
                        zIndex: -999,
                    }}
                >
                    <div ref={exportNodeRef}>
                        {format === "linkedin" ? (
                            <LinkedInCard
                                user={user}
                                stats={stats}
                                coderType={coderType}
                                topPlatforms={linkedinPlatforms}
                                allConnectedPlatforms={allConnectedPlatforms}
                                githubStats={githubStats}
                                includeGitHub={includeGitHub}
                                theme={themeConfig}
                                face={face}
                                publicProfileUrl={publicProfileUrl}
                                connectedPortals={connectedPortals}
                                showcaseMode={showcaseMode}
                                slotCategory={slotCategory}
                                topContests={linkedinContests}
                                animate={false}
                            />
                        ) : (
                            <InstagramStoryCard
                                user={user}
                                stats={stats}
                                coderType={coderType}
                                topPlatforms={storyPlatforms}
                                allConnectedPlatforms={allConnectedPlatforms}
                                githubStats={githubStats}
                                includeGitHub={includeGitHub}
                                theme={themeConfig}
                                face={face}
                                publicProfileUrl={publicProfileUrl}
                                connectedPortals={connectedPortals}
                                showcaseMode={showcaseMode}
                                slotCategory={slotCategory}
                                topContests={storyContests}
                                animate={false}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
