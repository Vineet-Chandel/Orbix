import React, { useState, useRef, useEffect, useMemo } from "react";
import { toPng } from "html-to-image";
import { useToast } from "../../../context/ToastContext";
import { CARD_THEMES } from "./types";
import type { CardFormat, CardFace, CardThemeId } from "./types";
import {
    aggregateCodingStats,
    getCoderType,
    getAvailableCardPlatforms,
    resolveShowcasedPlatforms,
    extractGitHubStats,
    getAllConnectedPlatforms,
} from "../../../utils/cardStatsAggregator";
import { LinkedInCard } from "./LinkedInCard";
import { InstagramStoryCard } from "./InstagramStoryCard";
import { CardCustomizerToolbar } from "./CardCustomizerToolbar";

interface ProfileCardStudioProps {
    user: any;
    connectedPortals: Record<string, any>;
}

export const ProfileCardStudio: React.FC<ProfileCardStudioProps> = ({
    user,
    connectedPortals,
}) => {
    const toast = useToast();

    // Studio Customization State
    const [format, setFormat] = useState<CardFormat>("linkedin");
    const [face, setFace] = useState<CardFace>("front");
    const [themeId, setThemeId] = useState<CardThemeId>("indigo");
    const [includeGitHub, setIncludeGitHub] = useState(false);
    const [customSlots, setCustomSlots] = useState<string[]>([]);
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

    // Multi-Platform Coding Analytics
    const userFallback = user?.username || user?.firstName || "developer";
    const stats = useMemo(() => aggregateCodingStats(connectedPortals), [connectedPortals]);
    const coderType = useMemo(() => getCoderType(stats.totalSolved), [stats.totalSolved]);
    const availablePlatforms = useMemo(() => getAvailableCardPlatforms(connectedPortals, userFallback), [connectedPortals, userFallback]);
    const allConnectedPlatforms = useMemo(() => getAllConnectedPlatforms(connectedPortals), [connectedPortals]);
    const githubStats = useMemo(() => extractGitHubStats(connectedPortals, userFallback), [connectedPortals, userFallback]);

    const isGitHubConnected = Boolean(
        connectedPortals.github?.connected || connectedPortals.github?.username || githubStats.connected
    );

    // Dynamic Platform Slot Resolution
    const showcasedPlatforms = useMemo(
        () => resolveShowcasedPlatforms(connectedPortals, customSlots, maxSlots, includeGitHub, userFallback),
        [connectedPortals, customSlots, maxSlots, includeGitHub, userFallback]
    );

    // The current slot IDs matching the showcased platforms
    const currentSlotIds = useMemo(() => {
        const ids: string[] = [];
        for (let i = 0; i < maxSlots; i++) {
            ids.push(showcasedPlatforms[i]?.id || "");
        }
        return ids;
    }, [showcasedPlatforms, maxSlots]);

    const isCustomized = customSlots.length > 0;

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

    const themeConfig = CARD_THEMES[themeId] || CARD_THEMES.indigo;
    const publicProfileUrl = `${window.location.origin}/profile/${encodeURIComponent(user?.username || "")}`;

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
            // Give 150ms for fonts/images/QR codes to settle
            await new Promise((r) => setTimeout(r, 150));

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

    // Calculate scale factor for live preview
    const previewScale = useMemo(() => {
        const availableWidth = Math.max(containerWidth - 32, 280);
        if (format === "linkedin") {
            // LinkedIn native: 1200 x 627
            return availableWidth / 1200;
        } else {
            // Instagram Story native: 1080 x 1920
            // Fit within max height of 560px on desktop/mobile
            const maxHeight = Math.min(560, window.innerHeight * 0.65);
            const scaleByHeight = maxHeight / 1920;
            const scaleByWidth = availableWidth / 1080;
            return Math.min(scaleByHeight, scaleByWidth);
        }
    }, [containerWidth, format]);

    const previewWidth = format === "linkedin" ? 1200 * previewScale : 1080 * previewScale;
    const previewHeight = format === "linkedin" ? 627 * previewScale : 1920 * previewScale;

    return (
        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-xs p-5 sm:p-6 flex flex-col space-y-5">
            {/* Studio Header */}
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-xs">
                        <svg className="w-4 h-4 text-amber-400" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2">
                            <span>Orbix Share Card Studio</span>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-900 text-white">
                                Live
                            </span>
                        </h2>
                        <p className="text-xs text-neutral-500">
                            Customizable social cards with scannable QR & aggregated coding analytics.
                        </p>
                    </div>
                </div>

                <div className="hidden sm:flex items-center gap-1.5 text-xs font-semibold text-neutral-500">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Realtime Sync</span>
                </div>
            </div>

            {/* Live Interactive Card Preview Stage */}
            <div
                ref={containerRef}
                className="w-full min-h-[300px] flex items-center justify-center p-4 sm:p-6 rounded-2xl bg-[#090c10] border border-neutral-800 relative overflow-hidden shadow-inner"
            >
                {/* Background ambient lighting */}
                <div
                    className="absolute inset-0 pointer-events-none opacity-30 transition-all duration-700 blur-3xl"
                    style={{
                        background: `radial-gradient(circle at 50% 50%, ${themeConfig.accentColor} 0%, transparent 65%)`,
                    }}
                />

                {/* Scaled Preview Frame */}
                <div
                    style={{
                        width: previewWidth,
                        height: previewHeight,
                    }}
                    className="relative overflow-hidden rounded-[16px] shadow-2xl transition-all duration-300 flex-shrink-0"
                >
                    <div
                        style={{
                            width: format === "linkedin" ? 1200 : 1080,
                            height: format === "linkedin" ? 627 : 1920,
                            transform: `scale(${previewScale})`,
                            transformOrigin: "top left",
                        }}
                    >
                        {format === "linkedin" ? (
                            <LinkedInCard
                                user={user}
                                stats={stats}
                                coderType={coderType}
                                topPlatforms={showcasedPlatforms}
                                allConnectedPlatforms={allConnectedPlatforms}
                                githubStats={githubStats}
                                includeGitHub={includeGitHub}
                                theme={themeConfig}
                                face={face}
                                publicProfileUrl={publicProfileUrl}
                                connectedPortals={connectedPortals}
                            />
                        ) : (
                            <InstagramStoryCard
                                user={user}
                                stats={stats}
                                coderType={coderType}
                                topPlatforms={showcasedPlatforms}
                                allConnectedPlatforms={allConnectedPlatforms}
                                githubStats={githubStats}
                                includeGitHub={includeGitHub}
                                theme={themeConfig}
                                face={face}
                                publicProfileUrl={publicProfileUrl}
                                connectedPortals={connectedPortals}
                            />
                        )}
                    </div>
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
            />

            {/* Hidden Offscreen Node at Exact Native Dimensions for Clean High-Res Export */}
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
                            topPlatforms={showcasedPlatforms}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={includeGitHub}
                            theme={themeConfig}
                            face={face}
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                        />
                    ) : (
                        <InstagramStoryCard
                            user={user}
                            stats={stats}
                            coderType={coderType}
                            topPlatforms={showcasedPlatforms}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={includeGitHub}
                            theme={themeConfig}
                            face={face}
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
