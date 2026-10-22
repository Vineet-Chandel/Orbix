import React, { useState, useRef, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { X, Download, Repeat, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "../../context/ToastContext";
import { LinkedInCard } from "./CardStudio/LinkedInCard";
import { InstagramStoryCard } from "./CardStudio/InstagramStoryCard";
import { CARD_THEMES, type CardFormat, type CardFace } from "./CardStudio/types";
import type {
    AggregatedCodingStats,
    CoderTypeBadge,
    GitHubCardStats,
    RankedPlatform,
    ConnectedPlatformBadge,
    RankedContestPlatform,
} from "../../utils/cardStatsAggregator";

interface GetTheCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any;
    stats: AggregatedCodingStats;
    coderType: CoderTypeBadge;
    showcasedPlatformsLinkedIn: RankedPlatform[];
    showcasedPlatformsStory: RankedPlatform[];
    allConnectedPlatforms: ConnectedPlatformBadge[];
    githubStats: GitHubCardStats;
    connectedPortals: Record<string, any>;
    showcasedContests: RankedContestPlatform[];
    publicProfileUrl: string;
}

export const GetTheCardModal: React.FC<GetTheCardModalProps> = ({
    isOpen,
    onClose,
    user,
    stats,
    coderType,
    showcasedPlatformsLinkedIn,
    showcasedPlatformsStory,
    allConnectedPlatforms,
    githubStats,
    connectedPortals,
    showcasedContests,
    publicProfileUrl,
}) => {
    const toast = useToast();

    const [format, setFormat] = useState<CardFormat>("linkedin");
    const [face, setFace] = useState<CardFace>("front");
    const [downloadingSide, setDownloadingSide] = useState<"front" | "back" | null>(null);

    // Responsive preview container sizing
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(800);

    // Off-screen export node refs for 100% pixel-perfect unscaled PNG rendering
    const exportFrontRef = useRef<HTMLDivElement>(null);
    const exportBackRef = useRef<HTMLDivElement>(null);

    // Measure preview viewport width responsively
    useEffect(() => {
        if (!isOpen) return;

        const updateWidth = () => {
            if (previewContainerRef.current) {
                const rect = previewContainerRef.current.getBoundingClientRect();
                if (rect.width > 0) {
                    setContainerWidth(rect.width);
                }
            }
        };

        // Small delay to ensure modal DOM is mounted
        const timer = setTimeout(updateWidth, 50);
        window.addEventListener("resize", updateWidth);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", updateWidth);
        };
    }, [isOpen]);

    // Handle ESC key to close modal
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const theme = CARD_THEMES.indigo;

    // Calculate scale factor for live modal preview
    const previewScale = useMemo(() => {
        const availableWidth = Math.max(containerWidth - 32, 280);
        if (format === "linkedin") {
            // LinkedIn native: 1200 x 627
            return Math.min(availableWidth / 1200, 0.72);
        } else {
            // Instagram Story native: 1080 x 1920
            // Fit within max height of 480px in modal
            const maxHeight = Math.min(480, window.innerHeight * 0.55);
            const scaleByHeight = maxHeight / 1920;
            const scaleByWidth = availableWidth / 1080;
            return Math.min(scaleByHeight, scaleByWidth);
        }
    }, [containerWidth, format]);

    const previewWidth = format === "linkedin" ? 1200 * previewScale : 1080 * previewScale;
    const previewHeight = format === "linkedin" ? 627 * previewScale : 1920 * previewScale;

    // Flip handler
    const handleFlip = () => {
        setFace((prev) => (prev === "front" ? "back" : "front"));
    };

    // Download handler for specific side
    const handleDownloadSide = async (side: "front" | "back") => {
        if (downloadingSide) return;
        setDownloadingSide(side);

        try {
            // Give 150ms for fonts/images/QR codes to settle
            await new Promise((r) => setTimeout(r, 150));

            const targetRef = side === "front" ? exportFrontRef.current : exportBackRef.current;
            if (!targetRef) {
                throw new Error("Export canvas element not found");
            }

            const dataUrl = await toPng(targetRef, {
                quality: 0.98,
                pixelRatio: 2, // Crisp 2x retina export
                cacheBust: true,
                backgroundColor: "#0c1017",
            });

            const link = document.createElement("a");
            const sanitizedUser = (user?.username || "developer").replace(/[^a-z0-9_-]/gi, "");
            link.download = `orbix-${sanitizedUser}-${format}-${side}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(
                `Downloaded ${format === "linkedin" ? "LinkedIn Card" : "Instagram Story"} (${side.toUpperCase()})!`,
                { title: "Export Complete" }
            );
        } catch (err: any) {
            console.error("Export error:", err);
            toast.error(err?.message || "Failed to download card image. Please try again.", {
                title: "Download Failed",
            });
        } finally {
            setDownloadingSide(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto">
            <div
                className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-neutral-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex-shrink-0">
                    <div>
                        <h3 className="text-base sm:text-lg font-black text-neutral-900 tracking-tight flex items-center gap-2">
                            <span>Get Developer Card</span>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-900 text-white">
                                {format === "linkedin" ? "LinkedIn" : "Story"}
                            </span>
                        </h3>
                        <p className="text-xs text-neutral-500 mt-0.5">
                            Interactive preview with flip view & high-resolution PNG export for both sides.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-neutral-200/80 hover:bg-neutral-300/80 text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                        title="Close modal"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Controls Bar: Format Tabs & Flip Action */}
                <div className="px-5 sm:px-6 py-3 border-b border-neutral-100 bg-white flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
                    {/* Format Switcher */}
                    <div className="inline-flex items-center p-1 bg-neutral-100 rounded-xl">
                        <button
                            type="button"
                            onClick={() => setFormat("linkedin")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${format === "linkedin"
                                ? "bg-white text-neutral-900 shadow-xs"
                                : "text-neutral-500 hover:text-neutral-900"
                                }`}
                        >
                            LinkedIn Card (Landscape)
                        </button>
                        <button
                            type="button"
                            onClick={() => setFormat("instagram")}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${format === "instagram"
                                ? "bg-white text-neutral-900 shadow-xs"
                                : "text-neutral-500 hover:text-neutral-900"
                                }`}
                        >
                            Instagram Story (Portrait)
                        </button>
                    </div>

                    {/* Flip Controls: Front / Back */}
                    <div className="flex items-center gap-2">
                        <div className="inline-flex items-center p-1 bg-neutral-100 rounded-xl">
                            <button
                                type="button"
                                onClick={() => setFace("front")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${face === "front"
                                    ? "bg-white text-neutral-900 shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                                    }`}
                            >
                                Front Side
                            </button>
                            <button
                                type="button"
                                onClick={() => setFace("back")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${face === "back"
                                    ? "bg-white text-neutral-900 shadow-xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                                    }`}
                            >
                                Back Side (QR)
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={handleFlip}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                            title="Flip card"
                        >
                            <Repeat className="w-3.5 h-3.5" />
                            <span>Flip</span>
                        </button>
                    </div>
                </div>

                {/* Card Preview Stage */}
                <div
                    ref={previewContainerRef}
                    className="flex-1 min-h-[320px] p-4 sm:p-6 bg-[#090c10] flex items-center justify-center relative overflow-hidden"
                >
                    {/* Ambient Glow */}
                    <div
                        className="absolute inset-0 pointer-events-none opacity-30 blur-3xl transition-all duration-700"
                        style={{
                            background: `radial-gradient(circle at 50% 50%, ${theme.accentColor} 0%, transparent 65%)`,
                        }}
                    />

                    {/* 3D Perspective Card Stage */}
                    <div style={{ perspective: 1800 }} className="relative flex items-center justify-center flex-shrink-0">
                        <motion.div
                            className="relative cursor-pointer select-none flex-shrink-0"
                            style={{
                                width: previewWidth,
                                height: previewHeight,
                                transformStyle: "preserve-3d",
                                WebkitTransformStyle: "preserve-3d",
                            }}
                            animate={{ rotateY: face === "back" ? 180 : 0 }}
                            transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
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
                            {/* Front Face */}
                            <div
                                className={`absolute inset-0 w-full h-full overflow-hidden ${
                                    format === "linkedin" ? "rounded-[20px]" : "rounded-[26px]"
                                } shadow-2xl bg-[#0c1017]`}
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(0deg)",
                                }}
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
                                            topPlatforms={showcasedPlatformsLinkedIn}
                                            allConnectedPlatforms={allConnectedPlatforms}
                                            githubStats={githubStats}
                                            includeGitHub={false}
                                            theme={theme}
                                            face="front"
                                            publicProfileUrl={publicProfileUrl}
                                            connectedPortals={connectedPortals}
                                            topContests={showcasedContests}
                                            showSocialLinks={false}
                                            animate={false}
                                        />
                                    ) : (
                                        <InstagramStoryCard
                                            user={user}
                                            stats={stats}
                                            coderType={coderType}
                                            topPlatforms={showcasedPlatformsStory}
                                            allConnectedPlatforms={allConnectedPlatforms}
                                            githubStats={githubStats}
                                            includeGitHub={false}
                                            theme={theme}
                                            face="front"
                                            publicProfileUrl={publicProfileUrl}
                                            connectedPortals={connectedPortals}
                                            topContests={showcasedContests}
                                            animate={false}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Back Face */}
                            <div
                                className={`absolute inset-0 w-full h-full overflow-hidden ${
                                    format === "linkedin" ? "rounded-[20px]" : "rounded-[26px]"
                                } shadow-2xl bg-[#0c1017]`}
                                style={{
                                    backfaceVisibility: "hidden",
                                    WebkitBackfaceVisibility: "hidden",
                                    transform: "rotateY(180deg)",
                                }}
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
                                            topPlatforms={showcasedPlatformsLinkedIn}
                                            allConnectedPlatforms={allConnectedPlatforms}
                                            githubStats={githubStats}
                                            includeGitHub={false}
                                            theme={theme}
                                            face="back"
                                            publicProfileUrl={publicProfileUrl}
                                            connectedPortals={connectedPortals}
                                            topContests={showcasedContests}
                                            showSocialLinks={false}
                                            animate={false}
                                        />
                                    ) : (
                                        <InstagramStoryCard
                                            user={user}
                                            stats={stats}
                                            coderType={coderType}
                                            topPlatforms={showcasedPlatformsStory}
                                            allConnectedPlatforms={allConnectedPlatforms}
                                            githubStats={githubStats}
                                            includeGitHub={false}
                                            theme={theme}
                                            face="back"
                                            publicProfileUrl={publicProfileUrl}
                                            connectedPortals={connectedPortals}
                                            topContests={showcasedContests}
                                            animate={false}
                                        />
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Footer: Dedicated Download Buttons for Both Sides */}
                <div className="px-5 sm:px-6 py-4 border-t border-neutral-100 bg-white flex flex-col sm:flex-row items-center justify-between gap-3 flex-shrink-0">
                    <span className="text-xs text-neutral-500 font-medium text-center sm:text-left">
                        Downloaded files are rendered in 2x crystal-clear retina resolution (PNG).
                    </span>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => handleDownloadSide("front")}
                            disabled={Boolean(downloadingSide)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 text-neutral-900 text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-2xs"
                        >
                            {downloadingSide === "front" ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Exporting Front...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5 text-neutral-600" />
                                    <span>Download Front Side</span>
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={() => handleDownloadSide("back")}
                            disabled={Boolean(downloadingSide)}
                            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 shadow-md hover:shadow-lg"
                        >
                            {downloadingSide === "back" ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Exporting Back...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-3.5 h-3.5 text-white" />
                                    <span>Download Back Side</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Hidden Off-Screen Unscaled Nodes for Exact Native Pixel-Perfect 2x Export */}
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0 select-none">
                {/* Front Side Unscaled Node */}
                <div
                    ref={exportFrontRef}
                    style={{
                        width: format === "linkedin" ? 1200 : 1080,
                        height: format === "linkedin" ? 627 : 1920,
                    }}
                >
                    {format === "linkedin" ? (
                        <LinkedInCard
                            user={user}
                            stats={stats}
                            coderType={coderType}
                            topPlatforms={showcasedPlatformsLinkedIn}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={false}
                            theme={theme}
                            face="front"
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                            topContests={showcasedContests}
                            showSocialLinks={false}
                        />
                    ) : (
                        <InstagramStoryCard
                            user={user}
                            stats={stats}
                            coderType={coderType}
                            topPlatforms={showcasedPlatformsStory}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={false}
                            theme={theme}
                            face="front"
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                            topContests={showcasedContests}
                        />
                    )}
                </div>

                {/* Back Side Unscaled Node */}
                <div
                    ref={exportBackRef}
                    style={{
                        width: format === "linkedin" ? 1200 : 1080,
                        height: format === "linkedin" ? 627 : 1920,
                    }}
                >
                    {format === "linkedin" ? (
                        <LinkedInCard
                            user={user}
                            stats={stats}
                            coderType={coderType}
                            topPlatforms={showcasedPlatformsLinkedIn}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={false}
                            theme={theme}
                            face="back"
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                            topContests={showcasedContests}
                            showSocialLinks={false}
                        />
                    ) : (
                        <InstagramStoryCard
                            user={user}
                            stats={stats}
                            coderType={coderType}
                            topPlatforms={showcasedPlatformsStory}
                            allConnectedPlatforms={allConnectedPlatforms}
                            githubStats={githubStats}
                            includeGitHub={false}
                            theme={theme}
                            face="back"
                            publicProfileUrl={publicProfileUrl}
                            connectedPortals={connectedPortals}
                            topContests={showcasedContests}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
