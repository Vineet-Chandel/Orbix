import React, { useState, useRef, useEffect, useMemo } from "react";
import {
    Image as ImageIcon,
    QrCode,
    Download,
    Share2,
    Smartphone,
    Monitor,
    RectangleVertical,
} from "lucide-react";
import { toPng } from "html-to-image";
import { useToast } from "../../context/ToastContext";
import type { EventInvitationData, InvitationFormat, InvitationFace } from "./types";
import { EventPosterFront } from "./EventPosterFront";
import { EventRegistrationBack } from "./EventRegistrationBack";
import { buildEventRegistrationUrl } from "./eventScheduleHelper";

export interface EventInvitationStudioProps extends EventInvitationData {
    className?: string;
    defaultFormat?: InvitationFormat;
    defaultFace?: InvitationFace;
}

export const EventInvitationStudio: React.FC<EventInvitationStudioProps> = (props) => {
    const {
        defaultFormat = "portrait",
        defaultFace = "front",
        className = "",
    } = props;

    const toast = useToast();
    const [format, setFormat] = useState<InvitationFormat>(defaultFormat);
    const [face, setFace] = useState<InvitationFace>(defaultFace);
    const [isExporting, setIsExporting] = useState(false);
    const [exportingSide, setExportingSide] = useState<InvitationFace | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    // Responsive scaling measurement
    const stageContainerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(540);

    // Dedicated offscreen unscaled export refs for pixel-perfect 2x PNG rendering
    const frontExportRef = useRef<HTMLDivElement>(null);
    const backExportRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const updateWidth = () => {
            if (stageContainerRef.current) {
                const rect = stageContainerRef.current.getBoundingClientRect();
                if (rect.width > 0) {
                    setContainerWidth(rect.width);
                }
            }
        };

        updateWidth();
        window.addEventListener("resize", updateWidth);
        const observer = new ResizeObserver(updateWidth);
        if (stageContainerRef.current) {
            observer.observe(stageContainerRef.current);
        }

        return () => {
            window.removeEventListener("resize", updateWidth);
            observer.disconnect();
        };
    }, []);

    // Registration URL
    const canonicalRegistrationUrl = useMemo(() => {
        return buildEventRegistrationUrl(
            props.eventId,
            props.slug,
            props.collegeName,
            props.registrationUrl
        );
    }, [props.eventId, props.slug, props.collegeName, props.registrationUrl]);

    // Flip toggle
    const handleFlip = () => {
        setFace((prev) => (prev === "front" ? "back" : "front"));
    };

    // Calculate dimensions for preview based on container width and format
    const previewDimensions = useMemo(() => {
        const maxStageWidth = Math.max(Math.min(containerWidth - 32, 540), 280);

        if (format === "landscape") {
            // Stacked layout: Full-width banner stacked on top of editorial details (~1.14:1 ratio)
            const width = Math.min(maxStageWidth, 500);
            const height = Math.round(width * 0.88);
            return { width, height, exportWidth: 600, exportHeight: 528 };
        } else if (format === "story") {
            // 9:16 ratio
            const height = Math.min(620, Math.max(window.innerHeight * 0.65, 480));
            const width = Math.min(maxStageWidth, Math.round(height * (9 / 16)));
            return { width, height, exportWidth: 540, exportHeight: 960 };
        } else {
            // Portrait (4:5 ratio)
            const width = Math.min(maxStageWidth, 440);
            const height = Math.round(width * (5 / 4));
            return { width, height, exportWidth: 540, exportHeight: 675 };
        }
    }, [containerWidth, format]);

    // Render export image via html-to-image
    const renderCardPng = async (side: InvitationFace): Promise<string> => {
        if (document.fonts) {
            await document.fonts.ready;
        }

        // Brief delay for SVG & QR modules settling
        await new Promise((r) => setTimeout(r, 160));

        const targetNode = side === "front" ? frontExportRef.current : backExportRef.current;
        if (!targetNode) {
            throw new Error("Export card element not ready");
        }

        return await toPng(targetNode, {
            quality: 0.98,
            pixelRatio: 2, // Crisp 2x retina export (1080px width)
            cacheBust: true,
            backgroundColor: "#FAF6EE",
        });
    };

    // Download handler
    const handleDownload = async (side: InvitationFace) => {
        if (isExporting) return;
        setIsExporting(true);
        setExportingSide(side);

        try {
            const dataUrl = await renderCardPng(side);

            const link = document.createElement("a");
            const sanitizedTitle = (props.title || "orbix-event")
                .toLowerCase()
                .replace(/[^a-z0-9_-]/gi, "-")
                .replace(/-+/g, "-")
                .slice(0, 35);

            link.download = `orbix-${sanitizedTitle}-${format}-${side}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            toast.success(
                `Exported ${side === "front" ? "Front Poster" : "Back QR Pass"} (${format.toUpperCase()})!`,
                { title: "Download Complete" }
            );
        } catch (err: unknown) {
            console.error("Export error:", err);
            const msg = err instanceof Error ? err.message : "Failed to download card. Please try again.";
            toast.error(msg, {
                title: "Download Failed",
            });
        } finally {
            setIsExporting(false);
            setExportingSide(null);
        }
    };

    // Copy link handler (fallback for share)
    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(canonicalRegistrationUrl);
            toast.success("Event registration link copied to clipboard!", {
                title: "Link Copied",
            });
        } catch {
            toast.error("Could not copy link to clipboard.");
        }
    };

    // Web Share API handler
    const handleShare = async () => {
        if (isSharing) return;
        setIsSharing(true);

        const shareData: ShareData = {
            title: props.title || "Orbix Event Invitation",
            text: `${props.title} by ${props.clubName || "Student Club"} at ${props.collegeName || "Campus"}. Register now on Orbix!`,
            url: canonicalRegistrationUrl,
        };

        try {
            // Check if native file sharing is supported
            if (navigator.canShare && navigator.share) {
                try {
                    const dataUrl = await renderCardPng(face);
                    const blob = await (await fetch(dataUrl)).blob();
                    const file = new File([blob], `orbix-invite-${face}.png`, { type: "image/png" });

                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            ...shareData,
                            files: [file],
                        });
                        toast.success("Shared successfully!");
                        return;
                    }
                } catch {
                    // Fall back to link/text share
                }

                await navigator.share(shareData);
                toast.success("Shared successfully!");
            } else {
                // Fallback: Copy link
                await handleCopyLink();
            }
        } catch (err: unknown) {
            if ((err as { name?: string })?.name !== "AbortError") {
                await handleCopyLink();
            }
        } finally {
            setIsSharing(false);
        }
    };

    return (
        <div className={`w-full space-y-4 ${className}`}>
            {/* Top Toolbar: Format & Face Selectors */}
            <div className="flex items-center justify-between gap-3 flex-wrap bg-[#FAF6EE] p-2.5 rounded-2xl border-2 border-black shadow-[2px_2px_0px_#000]">
                {/* Face Toggle */}
                <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setFace("front")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            face === "front"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        title="View Front Marketing Poster"
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Front (Poster)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFace("back")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            face === "back"
                                ? "bg-black text-white shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        title="View Back Registration Pass with QR Code"
                    >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Back (QR Pass)</span>
                    </button>
                </div>

                {/* Social Format Presets */}
                <div className="inline-flex p-1 bg-white border-2 border-black rounded-xl shadow-[1.5px_1.5px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setFormat("portrait")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            format === "portrait"
                                ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        title="Portrait Format (1080 × 1350) - Best for Instagram Feed, WhatsApp & LinkedIn"
                    >
                        <RectangleVertical className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Portrait (4:5)</span>
                        <span className="sm:hidden">4:5</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormat("story")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            format === "story"
                                ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        title="Story Format (1080 × 1920) - Best for Stories & Status updates"
                    >
                        <Smartphone className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Story (9:16)</span>
                        <span className="sm:hidden">9:16</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFormat("landscape")}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                            format === "landscape"
                                ? "bg-[#FFE566] text-black shadow-[1px_1px_0px_#000]"
                                : "bg-transparent text-neutral-600 hover:text-black"
                        }`}
                        title="Landscape Banner (1200 × 628) - Best for link previews & social headers"
                    >
                        <Monitor className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Banner</span>
                        <span className="sm:hidden">16:9</span>
                    </button>
                </div>
            </div>

            {/* 3D Interactive Stage Preview */}
            <div
                ref={stageContainerRef}
                className="w-full min-h-[380px] p-4 sm:p-8 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:16px_16px] rounded-3xl border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col items-center justify-center [perspective:1600px] overflow-hidden"
            >
                <div
                    onClick={handleFlip}
                    role="button"
                    tabIndex={0}
                    aria-label={`Interactive 3D Event Card (${face === "front" ? "Front Poster" : "Back QR Pass"}). Click or press Enter to flip.`}
                    title="Click card to flip between Front and Back"
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleFlip();
                        }
                    }}
                    className="relative transition-transform duration-600 [transform-style:preserve-3d] cursor-pointer group"
                    style={{
                        width: previewDimensions.width,
                        height: previewDimensions.height,
                        transform: face === "back" ? "rotateY(180deg)" : "rotateY(0deg)",
                    }}
                >
                    {/* Front Face Node */}
                    <div
                        className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(0deg)]"
                    >
                        <EventPosterFront
                            event={props}
                            format={format}
                            showFlipHint={true}
                        />
                    </div>

                    {/* Back Face Node */}
                    <div
                        className="absolute inset-0 w-full h-full [backface-visibility:hidden] [transform:rotateY(180deg)]"
                    >
                        <EventRegistrationBack
                            event={props}
                            format={format}
                        />
                    </div>
                </div>

                <div className="mt-4 flex items-center gap-2 text-xs font-bold text-neutral-500 select-none">
                    <span className="inline-block w-2 h-2 rounded-full bg-black/30" />
                    <span>Click anywhere on the card to flip between Poster & QR Pass</span>
                </div>
            </div>

            {/* Action Bar: Front/Back Toggle, Download Button with Logo, Native Share */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                {/* 1. Front / Back (QR) Switcher Toggle */}
                <div className="h-11 flex items-center p-1 bg-white rounded-xl border-2 border-black shadow-[3px_3px_0px_#000]">
                    <button
                        type="button"
                        onClick={() => setFace("front")}
                        className={`flex-1 h-full px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            face === "front"
                                ? "bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]"
                                : "text-neutral-600 hover:text-black"
                        }`}
                        title="Show Front Poster"
                    >
                        <span>Front</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setFace("back")}
                        className={`flex-1 h-full px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            face === "back"
                                ? "bg-[#A2FF86] text-black border border-black shadow-[1px_1px_0px_#000]"
                                : "text-neutral-600 hover:text-black"
                        }`}
                        title="Show Back QR Pass"
                    >
                        <span>Back (QR)</span>
                    </button>
                </div>

                {/* 2. Download Button with Logo */}
                <button
                    type="button"
                    onClick={() => handleDownload(face)}
                    disabled={isExporting}
                    className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-black uppercase tracking-wider transition-all border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer disabled:opacity-50"
                    title={`Download ${face === "front" ? "Front Poster" : "Back QR Pass"}`}
                >
                    {isExporting ? (
                        <>
                            <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Rendering {exportingSide || face}...</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-4 h-4 stroke-[2.5]" />
                            <span>Download {face === "front" ? "Front" : "Back"}</span>
                        </>
                    )}
                </button>

                {/* 3. Native Share */}
                <button
                    type="button"
                    onClick={handleShare}
                    disabled={isSharing}
                    className="h-11 flex items-center justify-center gap-2 px-3 rounded-xl bg-[#FFE566] hover:bg-[#FDD835] text-black text-xs font-black uppercase tracking-wider transition-all border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer disabled:opacity-50"
                >
                    <Share2 className="w-4 h-4 stroke-[2.5]" />
                    <span>Share Invitation</span>
                </button>
            </div>

            {/* Hidden Off-Screen Unscaled Nodes for Exact Native Pixel-Perfect High-Res Retina Export */}
            <div className="fixed -left-[9999px] -top-[9999px] pointer-events-none opacity-0 select-none">
                {/* Offscreen Front Node */}
                <div
                    ref={frontExportRef}
                    style={{
                        width: previewDimensions.exportWidth,
                        height: previewDimensions.exportHeight,
                    }}
                    className="overflow-hidden"
                >
                    <EventPosterFront
                        event={props}
                        format={format}
                        showFlipHint={false}
                    />
                </div>

                {/* Offscreen Back Node */}
                <div
                    ref={backExportRef}
                    style={{
                        width: previewDimensions.exportWidth,
                        height: previewDimensions.exportHeight,
                    }}
                    className="overflow-hidden"
                >
                    <EventRegistrationBack
                        event={props}
                        format={format}
                        qrSize={format === "story" ? 220 : format === "landscape" ? 175 : 190}
                    />
                </div>
            </div>
        </div>
    );
};
