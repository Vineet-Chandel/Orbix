import React, { useState } from "react";
import { Monitor, Smartphone } from "lucide-react";
import type { MediaPlacementConfig } from "./imagePlacementConfigs";
import type { EditorTransformState } from "./imageCanvasUtils";
import { getTransformFilterCss, getTemperatureOverlayColor } from "./imageCanvasUtils";

interface AdaptiveImagePreviewProps {
    image: HTMLImageElement;
    config: MediaPlacementConfig;
    transform: EditorTransformState;
    previewDataUrl?: string | null;
}

export const AdaptiveImagePreview: React.FC<AdaptiveImagePreviewProps> = ({
    image,
    config,
    transform,
    previewDataUrl,
}) => {
    const contexts = config.previewContexts;
    const [viewMode, setViewMode] = useState<"desktop" | "mobile">("desktop");

    if (!contexts || contexts.length === 0) return null;

    const filterStyle = getTransformFilterCss(transform);
    const temperatureTint = getTemperatureOverlayColor(transform.temperature);
    const fitClass =
        (transform.fitMode || config.fit) === "contain"
            ? "object-contain"
            : (transform.fitMode || config.fit) === "original"
            ? "object-none"
            : "object-cover";

    return (
        <div className="space-y-4 text-white">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="text-[11px] font-black uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse" />
                    <span>Real Platform Contexts</span>
                </span>

                {/* Device Viewport Preview Toggle */}
                <div className="flex items-center bg-black p-0.5 rounded-lg border border-neutral-800">
                    <button
                        type="button"
                        onClick={() => setViewMode("desktop")}
                        className={`p-1 rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors ${
                            viewMode === "desktop"
                                ? "bg-neutral-800 text-white"
                                : "text-neutral-500 hover:text-neutral-300"
                        }`}
                        title="Desktop Preview"
                    >
                        <Monitor className="w-3 h-3" />
                        <span className="hidden sm:inline">Desktop</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setViewMode("mobile")}
                        className={`p-1 rounded flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors ${
                            viewMode === "mobile"
                                ? "bg-neutral-800 text-white"
                                : "text-neutral-500 hover:text-neutral-300"
                        }`}
                        title="Mobile Preview"
                    >
                        <Smartphone className="w-3 h-3" />
                        <span className="hidden sm:inline">Mobile</span>
                    </button>
                </div>
            </div>

            <div className="space-y-3">
                {contexts.map((ctx) => {
                    const isBanner = ctx.shape === "banner";
                    return (
                        <div
                            key={ctx.id}
                            className="p-3 rounded-2xl bg-[#141414] border border-neutral-800 space-y-2"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black text-white">{ctx.label}</span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300">
                                    {ctx.shape}
                                </span>
                            </div>

                            {/* Responsive Simulation Container */}
                            <div
                                className={`flex items-center justify-center py-2 transition-all ${
                                    viewMode === "mobile" && isBanner ? "max-w-[280px] mx-auto" : "w-full"
                                }`}
                            >
                                <div
                                    className={`${ctx.containerClassName} relative overflow-hidden`}
                                    style={{
                                        backgroundColor: transform.backgroundColor || "#000000",
                                    }}
                                >
                                    <img
                                        src={previewDataUrl || image.src}
                                        alt={ctx.label}
                                        className={`w-full h-full ${fitClass}`}
                                        style={{
                                            filter: previewDataUrl ? undefined : filterStyle,
                                            objectPosition: `${transform.focalPoint.x}% ${transform.focalPoint.y}%`,
                                            transform: previewDataUrl
                                                ? undefined
                                                : `rotate(${transform.rotation}deg) scale(${
                                                      transform.flipHorizontal ? -1 : 1
                                                  }, ${transform.flipVertical ? -1 : 1})`,
                                        }}
                                    />

                                    {/* Warmth Tint Overlay */}
                                    {!previewDataUrl && temperatureTint && (
                                        <div
                                            className="absolute inset-0 pointer-events-none"
                                            style={{
                                                backgroundColor: temperatureTint,
                                                mixBlendMode: "color",
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            <p className="text-[10px] font-medium text-neutral-400 leading-tight">
                                {ctx.description}
                            </p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
