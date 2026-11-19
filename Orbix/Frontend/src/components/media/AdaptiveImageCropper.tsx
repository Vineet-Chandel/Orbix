import React, { useRef, useState, useEffect, useCallback } from "react";
import {
    Crosshair,
    Maximize2,
    ArrowUp,
    ArrowDown,
    ArrowLeft,
    ArrowRight,
} from "lucide-react";
import type { MediaPlacementConfig } from "./imagePlacementConfigs";
import type { EditorTransformState } from "./imageCanvasUtils";
import { getTransformFilterCss, getTemperatureOverlayColor } from "./imageCanvasUtils";

interface AdaptiveImageCropperProps {
    image: HTMLImageElement;
    config: MediaPlacementConfig;
    activeAspectRatio: number; // 0 = Freeform, > 0 = Fixed ratio
    transform: EditorTransformState;
    onTransformChange: (updater: (prev: EditorTransformState) => EditorTransformState) => void;
    isFocalMode?: boolean;
    onToggleFocalMode?: () => void;
}

export const AdaptiveImageCropper: React.FC<AdaptiveImageCropperProps> = ({
    image,
    config,
    activeAspectRatio,
    transform,
    onTransformChange,
    isFocalMode = false,
    onToggleFocalMode,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerSize, setContainerSize] = useState({ width: 640, height: 440 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragMode, setDragMode] = useState<"pan" | "focal" | "crop-handle">("pan");
    const [activeHandle, setActiveHandle] = useState<string | null>(null);

    // Custom freeform crop box state in container coordinates
    const [freeformBox, setFreeformBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

    const dragStartRef = useRef<{
        x: number;
        y: number;
        initialPan: { x: number; y: number };
        initialBox?: { x: number; y: number; width: number; height: number };
    }>({
        x: 0,
        y: 0,
        initialPan: { x: 0, y: 0 },
    });

    const touchDistRef = useRef<number | null>(null);

    // Measure viewport container size responsively
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({
                    width: Math.max(300, rect.width),
                    height: Math.max(260, rect.height),
                });
            }
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // Calculate crop boundary box dimensions centered in viewport
    const PADDING = 28;
    const availW = containerSize.width - PADDING * 2;
    const availH = containerSize.height - PADDING * 2;

    const isFreeform = activeAspectRatio === 0;

    let computedCropW = availW;
    let computedCropH = availH;

    if (!isFreeform && activeAspectRatio > 0) {
        computedCropH = computedCropW / activeAspectRatio;
        if (computedCropH > availH) {
            computedCropH = availH;
            computedCropW = computedCropH * activeAspectRatio;
        }
    } else {
        // Freeform default initial box: 85% of available space
        computedCropW = availW * 0.9;
        computedCropH = availH * 0.85;
    }

    const defaultCropBoxX = (containerSize.width - computedCropW) / 2;
    const defaultCropBoxY = (containerSize.height - computedCropH) / 2;

    // Active crop box
    const cropBoxX = isFreeform && freeformBox ? freeformBox.x : defaultCropBoxX;
    const cropBoxY = isFreeform && freeformBox ? freeformBox.y : defaultCropBoxY;
    const cropW = isFreeform && freeformBox ? freeformBox.width : computedCropW;
    const cropH = isFreeform && freeformBox ? freeformBox.height : computedCropH;

    // Reset freeform box if ratio changes away from freeform
    useEffect(() => {
        if (!isFreeform) {
            setFreeformBox(null);
        }
    }, [isFreeform]);

    // Handle Pan or Focal Point Mouse Down
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();

        if (isFocalMode) {
            // Set focal point on click
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const clickX = e.clientX - rect.left - cropBoxX;
            const clickY = e.clientY - rect.top - cropBoxY;
            const pctX = Math.round(Math.min(100, Math.max(0, (clickX / cropW) * 100)));
            const pctY = Math.round(Math.min(100, Math.max(0, (clickY / cropH) * 100)));
            onTransformChange((prev) => ({ ...prev, focalPoint: { x: pctX, y: pctY } }));
            return;
        }

        setIsDragging(true);
        setDragMode("pan");
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initialPan: { ...transform.pan },
        };
    };

    // Freeform crop handle drag
    const handleCropHandleDown = (handle: string, e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        setIsDragging(true);
        setDragMode("crop-handle");
        setActiveHandle(handle);
        dragStartRef.current = {
            x: e.clientX,
            y: e.clientY,
            initialPan: { ...transform.pan },
            initialBox: { x: cropBoxX, y: cropBoxY, width: cropW, height: cropH },
        };
    };

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            if (!isDragging) return;

            const dx = e.clientX - dragStartRef.current.x;
            const dy = e.clientY - dragStartRef.current.y;

            if (dragMode === "pan") {
                onTransformChange((prev) => ({
                    ...prev,
                    pan: {
                        x: dragStartRef.current.initialPan.x + dx,
                        y: dragStartRef.current.initialPan.y + dy,
                    },
                }));
            } else if (dragMode === "crop-handle" && activeHandle && dragStartRef.current.initialBox) {
                const init = dragStartRef.current.initialBox;
                let newX = init.x;
                let newY = init.y;
                let newW = init.width;
                let newH = init.height;

                if (activeHandle.includes("e")) newW = Math.max(80, init.width + dx);
                if (activeHandle.includes("s")) newH = Math.max(80, init.height + dy);
                if (activeHandle.includes("w")) {
                    const boundedDx = Math.min(dx, init.width - 80);
                    newX = init.x + boundedDx;
                    newW = init.width - boundedDx;
                }
                if (activeHandle.includes("n")) {
                    const boundedDy = Math.min(dy, init.height - 80);
                    newY = init.y + boundedDy;
                    newH = init.height - boundedDy;
                }

                setFreeformBox({ x: newX, y: newY, width: newW, height: newH });
            }
        },
        [isDragging, dragMode, activeHandle, onTransformChange]
    );

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setActiveHandle(null);
    }, []);

    useEffect(() => {
        if (isDragging) {
            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", handleMouseUp);
            return () => {
                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    // Touch Drag & Pinch-to-Zoom
    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length === 1) {
            setIsDragging(true);
            setDragMode("pan");
            dragStartRef.current = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
                initialPan: { ...transform.pan },
            };
        } else if (e.touches.length === 2) {
            setIsDragging(false);
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            touchDistRef.current = dist;
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches.length === 1 && isDragging && dragMode === "pan") {
            const dx = e.touches[0].clientX - dragStartRef.current.x;
            const dy = e.touches[0].clientY - dragStartRef.current.y;

            onTransformChange((prev) => ({
                ...prev,
                pan: {
                    x: dragStartRef.current.initialPan.x + dx,
                    y: dragStartRef.current.initialPan.y + dy,
                },
            }));
        } else if (e.touches.length === 2 && touchDistRef.current !== null) {
            const newDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            const ratio = newDist / touchDistRef.current;
            touchDistRef.current = newDist;

            onTransformChange((prev) => {
                const nextZoom = Math.min(4.0, Math.max(0.5, prev.zoom * ratio));
                return { ...prev, zoom: nextZoom };
            });
        }
    };

    const handleTouchEnd = () => {
        setIsDragging(false);
        touchDistRef.current = null;
    };

    // Wheel to Zoom
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = -e.deltaY * 0.0015;
        onTransformChange((prev) => {
            const nextZoom = Math.min(4.0, Math.max(0.5, prev.zoom + delta));
            return { ...prev, zoom: nextZoom };
        });
    };

    // Fine Nudge Pan Handlers
    const handleNudge = (dx: number, dy: number) => {
        onTransformChange((prev) => ({
            ...prev,
            pan: {
                x: prev.pan.x + dx,
                y: prev.pan.y + dy,
            },
        }));
    };

    const handleCenterImage = () => {
        onTransformChange((prev) => ({
            ...prev,
            pan: { x: 0, y: 0 },
        }));
    };

    // Compute Base Display Dimensions according to Fit Mode
    const natW = image.naturalWidth || 600;
    const natH = image.naturalHeight || 600;
    const imgAspect = natW / natH;
    const effectiveFitMode = transform.fitMode || config.fit || "cover";

    let baseDisplayW = cropW;
    let baseDisplayH = baseDisplayW / imgAspect;

    if (effectiveFitMode === "cover") {
        if (baseDisplayH < cropH) {
            baseDisplayH = cropH;
            baseDisplayW = baseDisplayH * imgAspect;
        }
    } else if (effectiveFitMode === "contain") {
        if (baseDisplayH > cropH) {
            baseDisplayH = cropH;
            baseDisplayW = baseDisplayH * imgAspect;
        }
    } else {
        // "original"
        baseDisplayW = Math.min(cropW, natW);
        baseDisplayH = baseDisplayW / imgAspect;
    }

    const currentW = baseDisplayW * transform.zoom;
    const currentH = baseDisplayH * transform.zoom;

    const filterStyle = getTransformFilterCss(transform);
    const temperatureTint = getTemperatureOverlayColor(transform.temperature);

    const isCircle = config.shape === "circle";
    const isRounded = config.shape === "square" || config.shape === "circle";

    return (
        <div
            ref={containerRef}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className={`relative w-full h-full min-h-[380px] bg-[#050505] overflow-hidden select-none flex items-center justify-center ${
                isFocalMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
            }`}
            style={{ touchAction: "none" }}
        >
            {/* Background letterbox fill color preview */}
            {transform.backgroundColor && (
                <div
                    className="absolute inset-0 pointer-events-none transition-colors"
                    style={{ backgroundColor: transform.backgroundColor }}
                />
            )}

            {/* Transformed Image Element Container */}
            <div
                className="absolute transition-transform duration-75 pointer-events-none"
                style={{
                    left: `${cropBoxX + cropW / 2 + transform.pan.x}px`,
                    top: `${cropBoxY + cropH / 2 + transform.pan.y}px`,
                    width: `${currentW}px`,
                    height: `${currentH}px`,
                    transform: `translate(-50%, -50%) rotate(${transform.rotation}deg) scale(${
                        transform.flipHorizontal ? -1 : 1
                    }, ${transform.flipVertical ? -1 : 1})`,
                    filter: filterStyle,
                }}
            >
                <img
                    src={image.src}
                    alt=""
                    className="w-full h-full object-contain pointer-events-none select-none"
                    draggable={false}
                />

                {/* Warmth / Temperature Overlay Layer */}
                {temperatureTint && (
                    <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundColor: temperatureTint,
                            mixBlendMode: "color",
                        }}
                    />
                )}
            </div>

            {/* Dark Mask Overlay (Outside cropBox) */}
            <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                width={containerSize.width}
                height={containerSize.height}
            >
                <defs>
                    <mask id="crop-mask">
                        <rect x="0" y="0" width={containerSize.width} height={containerSize.height} fill="white" />
                        {isCircle ? (
                            <circle
                                cx={cropBoxX + cropW / 2}
                                cy={cropBoxY + cropH / 2}
                                r={Math.min(cropW, cropH) / 2}
                                fill="black"
                            />
                        ) : (
                            <rect
                                x={cropBoxX}
                                y={cropBoxY}
                                width={cropW}
                                height={cropH}
                                rx={isRounded ? 16 : 0}
                                ry={isRounded ? 16 : 0}
                                fill="black"
                            />
                        )}
                    </mask>
                </defs>

                <rect
                    x="0"
                    y="0"
                    width={containerSize.width}
                    height={containerSize.height}
                    fill="rgba(0, 0, 0, 0.78)"
                    mask="url(#crop-mask)"
                />
            </svg>

            {/* Crop Boundary Frame & Guides */}
            <div
                className={`absolute pointer-events-none border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.9)] ${
                    isCircle ? "rounded-full" : isRounded ? "rounded-2xl" : "rounded-none"
                }`}
                style={{
                    left: `${cropBoxX}px`,
                    top: `${cropBoxY}px`,
                    width: `${cropW}px`,
                    height: `${cropH}px`,
                }}
            >
                {/* Rule of Thirds Grid */}
                <div
                    className={`absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 transition-opacity duration-150 ${
                        isDragging ? "opacity-75" : "opacity-25"
                    }`}
                >
                    <div className="border-r border-b border-white/50" />
                    <div className="border-r border-b border-white/50" />
                    <div className="border-b border-white/50" />
                    <div className="border-r border-b border-white/50" />
                    <div className="border-r border-b border-white/50" />
                    <div className="border-b border-white/50" />
                    <div className="border-r border-b border-white/50" />
                    <div className="border-r border-b border-white/50" />
                    <div />
                </div>

                {/* Safe Area Guide Overlay */}
                {config.features.safeAreaOverlay && config.safeArea && (
                    <div
                        className="absolute border border-dashed border-emerald-400/90 pointer-events-none flex flex-col justify-between p-2"
                        style={{
                            top: `${config.safeArea.top}%`,
                            right: `${config.safeArea.right}%`,
                            bottom: `${config.safeArea.bottom}%`,
                            left: `${config.safeArea.left}%`,
                        }}
                    >
                        {config.safeArea.label && (
                            <span className="self-start px-2 py-0.5 rounded-md bg-emerald-950/90 text-emerald-300 border border-emerald-500/50 text-[9px] font-black uppercase tracking-wider backdrop-blur-xs">
                                {config.safeArea.label}
                            </span>
                        )}

                        {/* Overlap Zone (e.g. Club Logo on bottom-left) */}
                        {config.safeArea.overlapZone && (
                            <div
                                className="absolute bottom-1.5 left-1.5 border-2 border-dashed border-amber-400/90 bg-amber-500/25 rounded-xl flex items-center justify-center p-2"
                                style={{
                                    width: `${config.safeArea.overlapZone.widthPercent}%`,
                                    height: `${config.safeArea.overlapZone.heightPercent}%`,
                                }}
                            >
                                <span className="text-[9px] font-black uppercase text-amber-200 text-center leading-tight">
                                    {config.safeArea.overlapZone.label}
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Focal Point Indicator Crosshair */}
                {config.features.focalPoint && (
                    <div
                        className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
                        style={{
                            left: `${transform.focalPoint.x}%`,
                            top: `${transform.focalPoint.y}%`,
                        }}
                    >
                        <div className="relative w-8 h-8 rounded-full border-2 border-[#a2ff86] bg-black/40 flex items-center justify-center shadow-[0_0_8px_rgba(162,255,134,0.6)]">
                            <Crosshair className="w-4 h-4 text-[#a2ff86]" />
                            <span className="absolute -bottom-4 px-1.5 py-0.2 rounded bg-black/90 text-[8px] font-mono font-bold text-[#a2ff86] border border-[#a2ff86]/40 whitespace-nowrap">
                                {transform.focalPoint.x}% · {transform.focalPoint.y}%
                            </span>
                        </div>
                    </div>
                )}

                {/* Corner Accent Grips / Interactive Handles */}
                {!isFreeform ? (
                    <>
                        <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-black shadow-[1px_1px_0px_#000]" />
                        <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-black shadow-[1px_1px_0px_#000]" />
                        <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-black shadow-[1px_1px_0px_#000]" />
                        <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-black shadow-[1px_1px_0px_#000]" />
                    </>
                ) : (
                    // 8-Point Freeform Resize Handles
                    <>
                        <div
                            onMouseDown={(e) => handleCropHandleDown("nw", e)}
                            className="absolute -top-2 -left-2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-nwse-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("n", e)}
                            className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-ns-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("ne", e)}
                            className="absolute -top-2 -right-2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-nesw-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("e", e)}
                            className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-ew-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("se", e)}
                            className="absolute -bottom-2 -right-2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-nwse-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("s", e)}
                            className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-ns-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("sw", e)}
                            className="absolute -bottom-2 -left-2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-nesw-resize pointer-events-auto"
                        />
                        <div
                            onMouseDown={(e) => handleCropHandleDown("w", e)}
                            className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 bg-[#FFE566] border-2 border-black rounded-xs shadow-[1px_1px_0px_#000] cursor-ew-resize pointer-events-auto"
                        />
                    </>
                )}
            </div>

            {/* On-Canvas Floating Action HUD */}
            <div className="absolute top-3 left-3 pointer-events-auto flex items-center gap-1.5 bg-black/85 backdrop-blur-md p-1 rounded-xl border border-neutral-800 shadow-xl">
                {/* Center Button */}
                <button
                    type="button"
                    onClick={handleCenterImage}
                    className="p-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[11px] font-bold border border-neutral-700 flex items-center gap-1 cursor-pointer transition-colors"
                    title="Center Image (Reset Pan)"
                >
                    <Maximize2 className="w-3.5 h-3.5 text-[#FFE566]" />
                    <span className="hidden sm:inline">Center</span>
                </button>

                {/* Nudge Directional Pad */}
                <div className="flex items-center gap-0.5 border-l border-neutral-700 pl-1.5">
                    <button
                        type="button"
                        onClick={() => handleNudge(-15, 0)}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                        title="Nudge Left"
                    >
                        <ArrowLeft className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNudge(0, -15)}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                        title="Nudge Up"
                    >
                        <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNudge(0, 15)}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                        title="Nudge Down"
                    >
                        <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                        type="button"
                        onClick={() => handleNudge(15, 0)}
                        className="p-1 rounded bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white cursor-pointer"
                        title="Nudge Right"
                    >
                        <ArrowRight className="w-3 h-3" />
                    </button>
                </div>

                {/* Focal Mode Toggle */}
                {config.features.focalPoint && onToggleFocalMode && (
                    <button
                        type="button"
                        onClick={onToggleFocalMode}
                        className={`p-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                            isFocalMode
                                ? "bg-[#a2ff86] text-black border-black shadow-[1px_1px_0px_#000]"
                                : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-700"
                        }`}
                        title="Set Focal Point Target"
                    >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Focal Pin</span>
                    </button>
                )}
            </div>

            {/* Interaction Floating Hint Badge */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-2 px-3 py-1 rounded-full bg-black/90 backdrop-blur-md border border-neutral-700 text-white text-[11px] font-bold shadow-xl">
                <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse" />
                <span>
                    {isFocalMode
                        ? "Click anywhere inside frame to position focal point"
                        : `Drag to pan • Pinch / scroll to zoom (${Math.round(transform.zoom * 100)}%)`}
                </span>
            </div>
        </div>
    );
};
