import React, { useState } from "react";
import {
    ZoomIn,
    ZoomOut,
    RotateCw,
    RotateCcw,
    FlipHorizontal,
    FlipVertical,
    SlidersHorizontal,
    RefreshCw,
    Sun,
    Contrast,
    Sparkles,
    Crosshair,
    Palette,
    Eye,
    ChevronDown,
    ChevronUp,
    Gauge,
    Flame,
    Droplet,
} from "lucide-react";
import type { MediaPlacementConfig } from "./imagePlacementConfigs";
import type { EditorTransformState } from "./imageCanvasUtils";
import { INITIAL_TRANSFORM_STATE, FILTER_PRESETS } from "./imageCanvasUtils";

interface AdaptiveImageAdjustmentPanelProps {
    config: MediaPlacementConfig;
    activeAspectRatio: number;
    onAspectRatioChange: (newRatio: number) => void;
    transform: EditorTransformState;
    onTransformChange: (updater: (prev: EditorTransformState) => EditorTransformState) => void;
    isFocalMode?: boolean;
    onToggleFocalMode?: () => void;
}

export const AdaptiveImageAdjustmentPanel: React.FC<AdaptiveImageAdjustmentPanelProps> = ({
    config,
    activeAspectRatio,
    onAspectRatioChange,
    transform,
    onTransformChange,
    isFocalMode = false,
    onToggleFocalMode,
}) => {
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Zoom handlers
    const handleZoomStep = (direction: "in" | "out") => {
        const delta = direction === "in" ? 0.2 : -0.2;
        onTransformChange((prev) => ({
            ...prev,
            zoom: Math.min(4.0, Math.max(0.5, +(prev.zoom + delta).toFixed(2))),
        }));
    };

    // Rotate 90 deg handlers
    const handleRotate90 = (direction: "cw" | "ccw") => {
        const delta = direction === "cw" ? 90 : -90;
        onTransformChange((prev) => {
            let next = (prev.rotation + delta) % 360;
            if (next > 180) next -= 360;
            if (next < -180) next += 360;
            return { ...prev, rotation: next };
        });
    };

    // Flip handlers
    const handleFlipH = () => {
        onTransformChange((prev) => ({ ...prev, flipHorizontal: !prev.flipHorizontal }));
    };

    const handleFlipV = () => {
        onTransformChange((prev) => ({ ...prev, flipVertical: !prev.flipVertical }));
    };

    // Apply Filter Preset
    const handleApplyPreset = (presetId: EditorTransformState["filterPreset"]) => {
        const found = FILTER_PRESETS.find((p) => p.id === presetId);
        if (!found) return;

        onTransformChange((prev) => ({
            ...prev,
            filterPreset: presetId,
            ...found.values,
        }));
    };

    // Set 9-Point Focal Point Grid
    const handleFocalGridSelect = (x: number, y: number) => {
        onTransformChange((prev) => ({
            ...prev,
            focalPoint: { x, y },
        }));
    };

    // Reset all adjustments
    const handleResetAll = () => {
        onTransformChange((prev) => ({
            ...INITIAL_TRANSFORM_STATE,
            fitMode: config.fit || "cover",
            backgroundColor: prev.backgroundColor,
        }));
    };

    const hasAdjustments =
        transform.zoom !== 1.0 ||
        transform.pan.x !== 0 ||
        transform.pan.y !== 0 ||
        transform.rotation !== 0 ||
        transform.flipHorizontal ||
        transform.flipVertical ||
        transform.brightness !== 0 ||
        transform.contrast !== 0 ||
        transform.saturation !== 0 ||
        transform.exposure !== 0 ||
        transform.temperature !== 0 ||
        transform.sharpness !== 0 ||
        transform.blur !== 0 ||
        transform.grayscale !== 0 ||
        transform.filterPreset !== "none";

    return (
        <div className="space-y-4 text-white">
            {/* 1. Multi-Aspect Ratio Presets (e.g. Event Banners, Posters) */}
            {config.features.aspectRatioSwitch && config.aspectRatioPresets && config.aspectRatioPresets.length > 1 && (
                <div className="space-y-1.5">
                    <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
                        Frame Aspect Ratio
                    </label>
                    <div className="grid grid-cols-2 gap-1.5">
                        {config.aspectRatioPresets.map((preset) => {
                            const isSelected =
                                preset.ratio === 0
                                    ? activeAspectRatio === 0
                                    : Math.abs(activeAspectRatio - preset.ratio) < 0.05;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => onAspectRatioChange(preset.ratio)}
                                    className={`p-2 rounded-xl text-left border text-xs font-bold transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-[#FFE566] text-black border-[#FFE566] shadow-[2px_2px_0px_#000]"
                                            : "bg-[#141414] hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                                    }`}
                                >
                                    <div className="truncate font-black">{preset.label}</div>
                                    {preset.description && (
                                        <div
                                            className={`text-[10px] truncate ${
                                                isSelected ? "text-neutral-800 font-semibold" : "text-neutral-500"
                                            }`}
                                        >
                                            {preset.description}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 2. Image Fit Modes: Cover, Contain, Original */}
            {config.features.fitModes && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
                        Display Fit Mode
                    </span>
                    <div className="grid grid-cols-3 gap-1.5 pt-1">
                        {[
                            { id: "cover", label: "Cover", desc: "Fill frame" },
                            { id: "contain", label: "Contain", desc: "Keep all artwork" },
                            { id: "original", label: "Original", desc: "1:1 Native" },
                        ].map((mode) => {
                            const isSelected = (transform.fitMode || config.fit) === mode.id;
                            return (
                                <button
                                    key={mode.id}
                                    type="button"
                                    onClick={() =>
                                        onTransformChange((prev) => ({
                                            ...prev,
                                            fitMode: mode.id as any,
                                        }))
                                    }
                                    className={`p-2 rounded-xl text-center border text-xs font-black transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-[#a2ff86] text-black border-[#a2ff86] shadow-[1px_1px_0px_#000]"
                                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                                    }`}
                                >
                                    <div>{mode.label}</div>
                                    <div
                                        className={`text-[9px] ${
                                            isSelected ? "text-neutral-800 font-bold" : "text-neutral-500"
                                        }`}
                                    >
                                        {mode.desc}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 3. Primary Zoom Control */}
            {config.features.zoom && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white flex items-center gap-1.5">
                            <ZoomIn className="w-3.5 h-3.5 text-[#FFE566]" />
                            <span>Zoom & Crop Scale</span>
                        </span>
                        <span className="text-xs font-black font-mono text-[#FFE566]">
                            {Math.round(transform.zoom * 100)}%
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => handleZoomStep("out")}
                            disabled={transform.zoom <= 0.5}
                            className="p-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-3.5 h-3.5 text-white" />
                        </button>

                        <input
                            type="range"
                            min="0.5"
                            max="3.5"
                            step="0.05"
                            value={transform.zoom}
                            onChange={(e) => {
                                const val = parseFloat(e.target.value);
                                onTransformChange((prev) => ({ ...prev, zoom: val }));
                            }}
                            className="flex-1 accent-[#FFE566] cursor-pointer"
                        />

                        <button
                            type="button"
                            onClick={() => handleZoomStep("in")}
                            disabled={transform.zoom >= 3.5}
                            className="p-1.5 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 cursor-pointer"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-3.5 h-3.5 text-white" />
                        </button>
                    </div>
                </div>
            )}

            {/* 4. Orientation & Alignment (Rotate & Flip) */}
            {(config.features.rotate || config.features.flip) && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white flex items-center gap-1.5">
                            <RotateCw className="w-3.5 h-3.5 text-[#a2ff86]" />
                            <span>Orientation & Alignment</span>
                        </span>
                        {transform.rotation !== 0 && (
                            <span className="text-xs font-black font-mono text-[#a2ff86]">
                                {transform.rotation}°
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                        {config.features.rotate && (
                            <button
                                type="button"
                                onClick={() => handleRotate90("ccw")}
                                className="px-2 py-1.5 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                title="Rotate -90°"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>-90°</span>
                            </button>
                        )}

                        {config.features.rotate && (
                            <button
                                type="button"
                                onClick={() => handleRotate90("cw")}
                                className="px-2 py-1.5 rounded-xl border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                                title="Rotate +90°"
                            >
                                <RotateCw className="w-3.5 h-3.5" />
                                <span>+90°</span>
                            </button>
                        )}

                        {config.features.flip && (
                            <button
                                type="button"
                                onClick={handleFlipH}
                                className={`px-2 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                                    transform.flipHorizontal
                                        ? "bg-[#FFE566] text-black border-[#FFE566]"
                                        : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white"
                                }`}
                                title="Flip Horizontally"
                            >
                                <FlipHorizontal className="w-3.5 h-3.5" />
                                <span>Flip H</span>
                            </button>
                        )}

                        {config.features.flip && (
                            <button
                                type="button"
                                onClick={handleFlipV}
                                className={`px-2 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 cursor-pointer ${
                                    transform.flipVertical
                                        ? "bg-[#FFE566] text-black border-[#FFE566]"
                                        : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white"
                                }`}
                                title="Flip Vertically"
                            >
                                <FlipVertical className="w-3.5 h-3.5" />
                                <span>Flip V</span>
                            </button>
                        )}
                    </div>

                    {/* Fine Rotation Slider */}
                    {config.features.rotate && (
                        <div className="pt-2">
                            <div className="flex items-center justify-between text-[10px] font-bold text-neutral-400 mb-1">
                                <span>Fine Angle Alignment</span>
                                <button
                                    type="button"
                                    onClick={() => onTransformChange((prev) => ({ ...prev, rotation: 0 }))}
                                    className="hover:text-white underline cursor-pointer"
                                >
                                    Reset 0°
                                </button>
                            </div>
                            <input
                                type="range"
                                min="-45"
                                max="45"
                                step="1"
                                value={transform.rotation}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value, 10);
                                    onTransformChange((prev) => ({ ...prev, rotation: val }));
                                }}
                                className="w-full accent-[#a2ff86] cursor-pointer"
                            />
                        </div>
                    )}
                </div>
            )}

            {/* 5. Focal Point Positioning Grid */}
            {config.features.focalPoint && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-white flex items-center gap-1.5">
                            <Crosshair className="w-3.5 h-3.5 text-[#a2ff86]" />
                            <span>Focal Subject Anchor</span>
                        </span>
                        {onToggleFocalMode && (
                            <button
                                type="button"
                                onClick={onToggleFocalMode}
                                className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                                    isFocalMode
                                        ? "bg-[#a2ff86] text-black border-transparent"
                                        : "bg-neutral-900 text-neutral-300 border-neutral-700 hover:bg-neutral-800"
                                }`}
                            >
                                {isFocalMode ? "Pinning Active" : "Interactive Pin"}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-3 pt-1">
                        {/* 9-Point Focal Selector */}
                        <div className="grid grid-cols-3 gap-1 p-1 bg-black rounded-lg border border-neutral-800 w-24 h-24 shrink-0">
                            {[
                                { x: 20, y: 20 },
                                { x: 50, y: 20 },
                                { x: 80, y: 20 },
                                { x: 20, y: 50 },
                                { x: 50, y: 50 },
                                { x: 80, y: 50 },
                                { x: 20, y: 80 },
                                { x: 50, y: 80 },
                                { x: 80, y: 80 },
                            ].map((pt, idx) => {
                                const isSelected =
                                    Math.abs(transform.focalPoint.x - pt.x) <= 15 &&
                                    Math.abs(transform.focalPoint.y - pt.y) <= 15;
                                return (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => handleFocalGridSelect(pt.x, pt.y)}
                                        className={`rounded-sm transition-colors cursor-pointer flex items-center justify-center ${
                                            isSelected
                                                ? "bg-[#a2ff86] shadow-[0_0_6px_#a2ff86]"
                                                : "bg-neutral-800 hover:bg-neutral-700"
                                        }`}
                                    />
                                );
                            })}
                        </div>

                        <div className="flex-1 text-[11px] text-neutral-400 space-y-1">
                            <p>
                                Anchors the primary subject when displayed across mobile vs desktop.
                            </p>
                            <div className="text-[10px] font-mono text-[#a2ff86]">
                                Anchor: ({transform.focalPoint.x}%, {transform.focalPoint.y}%)
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 6. Curated Filter Presets Strip */}
            {config.features.filterPresets && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400 flex items-center gap-1.5">
                        <Palette className="w-3.5 h-3.5 text-[#38BDF8]" />
                        <span>Filter Presets</span>
                    </span>
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                        {FILTER_PRESETS.map((preset) => {
                            const isSelected = transform.filterPreset === preset.id;
                            return (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleApplyPreset(preset.id)}
                                    className={`px-3 py-1.5 rounded-xl border text-xs font-black whitespace-nowrap transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-white text-black border-white shadow-[1px_1px_0px_#000]"
                                            : "bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border-neutral-800"
                                    }`}
                                >
                                    <span
                                        className="inline-block w-2 h-2 rounded-full mr-1.5"
                                        style={{ backgroundColor: preset.accentColor }}
                                    />
                                    {preset.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* 7. Background Letterbox Fill Color */}
            {config.features.backgroundFill && (
                <div className="space-y-1.5 bg-[#141414] p-3 rounded-2xl border border-neutral-800">
                    <span className="block text-[11px] font-black uppercase tracking-wider text-neutral-400">
                        Backdrop Fill Color
                    </span>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {[
                            { label: "Transparent", color: "transparent" },
                            { label: "Pitch Black", color: "#000000" },
                            { label: "Dark Gray", color: "#18181B" },
                            { label: "Off White", color: "#FAF6EE" },
                            { label: "Crisp White", color: "#FFFFFF" },
                            { label: "Orbix Yellow", color: "#FFE566" },
                            { label: "Neon Lime", color: "#A2FF86" },
                            { label: "Sky Ice", color: "#38BDF8" },
                        ].map((swatch) => (
                            <button
                                key={swatch.color}
                                type="button"
                                onClick={() =>
                                    onTransformChange((prev) => ({ ...prev, backgroundColor: swatch.color }))
                                }
                                className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer flex items-center justify-center ${
                                    transform.backgroundColor === swatch.color
                                        ? "scale-110 ring-2 ring-[#a2ff86] border-white"
                                        : "border-neutral-700"
                                } ${swatch.color === "transparent" ? "bg-[linear-gradient(45deg,#333_25%,transparent_25%),linear-gradient(-45deg,#333_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#333_75%),linear-gradient(-45deg,transparent_75%,#333_75%)] bg-[size:8px_8px]" : ""}`}
                                style={swatch.color !== "transparent" ? { backgroundColor: swatch.color } : {}}
                                title={swatch.label}
                            />
                        ))}

                        {/* Custom Color Input */}
                        <label className="relative w-7 h-7 rounded-lg border border-neutral-700 overflow-hidden cursor-pointer bg-neutral-900 flex items-center justify-center" title="Custom Hex Color">
                            <span className="text-[10px] font-mono text-neutral-400">#</span>
                            <input
                                type="color"
                                value={transform.backgroundColor || "#000000"}
                                onChange={(e) =>
                                    onTransformChange((prev) => ({ ...prev, backgroundColor: e.target.value }))
                                }
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            />
                        </label>
                    </div>
                </div>
            )}

            {/* 8. Fine Tuning & Visual Adjustments */}
            {(config.features.brightness || config.features.contrast || config.features.saturation) && (
                <div className="bg-[#141414] rounded-2xl border border-neutral-800 overflow-hidden">
                    <button
                        type="button"
                        onClick={() => setShowAdvanced((prev) => !prev)}
                        className="w-full p-3 flex items-center justify-between text-xs font-black text-white hover:bg-neutral-900 transition-colors cursor-pointer"
                    >
                        <span className="flex items-center gap-1.5">
                            <SlidersHorizontal className="w-3.5 h-3.5 text-[#FFE566]" />
                            <span>Visual Fine-Tuning & Color</span>
                        </span>
                        <div className="flex items-center gap-1 text-[11px] font-bold text-neutral-400">
                            <span>{showAdvanced ? "Collapse" : "Expand"}</span>
                            {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </div>
                    </button>

                    <div className="p-3 pt-0 border-t border-neutral-800 space-y-3">
                        {/* Brightness */}
                        {config.features.brightness && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                    <span className="flex items-center gap-1">
                                        <Sun className="w-3 h-3 text-[#FFE566]" />
                                        <span>Brightness</span>
                                    </span>
                                    <span className="font-mono text-xs">{transform.brightness > 0 ? `+${transform.brightness}` : transform.brightness}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-60"
                                    max="60"
                                    step="2"
                                    value={transform.brightness}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onTransformChange((prev) => ({ ...prev, brightness: val }));
                                    }}
                                    className="w-full accent-[#FFE566] cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Contrast */}
                        {config.features.contrast && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                    <span className="flex items-center gap-1">
                                        <Contrast className="w-3 h-3 text-[#38BDF8]" />
                                        <span>Contrast</span>
                                    </span>
                                    <span className="font-mono text-xs">{transform.contrast > 0 ? `+${transform.contrast}` : transform.contrast}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-60"
                                    max="60"
                                    step="2"
                                    value={transform.contrast}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onTransformChange((prev) => ({ ...prev, contrast: val }));
                                    }}
                                    className="w-full accent-[#38BDF8] cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Saturation */}
                        {config.features.saturation && (
                            <div className="space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                    <span className="flex items-center gap-1">
                                        <Sparkles className="w-3 h-3 text-[#a2ff86]" />
                                        <span>Saturation</span>
                                    </span>
                                    <span className="font-mono text-xs">{transform.saturation > 0 ? `+${transform.saturation}` : transform.saturation}</span>
                                </div>
                                <input
                                    type="range"
                                    min="-100"
                                    max="100"
                                    step="5"
                                    value={transform.saturation}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        onTransformChange((prev) => ({ ...prev, saturation: val }));
                                    }}
                                    className="w-full accent-[#a2ff86] cursor-pointer"
                                />
                            </div>
                        )}

                        {/* Advanced Collapsible Section */}
                        {showAdvanced && (
                            <div className="pt-2 border-t border-neutral-800 space-y-3 animate-in fade-in duration-150">
                                {/* Exposure */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                        <span className="flex items-center gap-1">
                                            <Gauge className="w-3 h-3 text-amber-400" />
                                            <span>Exposure Highlights</span>
                                        </span>
                                        <span className="font-mono text-xs">{transform.exposure > 0 ? `+${transform.exposure}` : transform.exposure}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-60"
                                        max="60"
                                        step="2"
                                        value={transform.exposure}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            onTransformChange((prev) => ({ ...prev, exposure: val }));
                                        }}
                                        className="w-full accent-amber-400 cursor-pointer"
                                    />
                                </div>

                                {/* Warmth / Temperature */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                        <span className="flex items-center gap-1">
                                            <Flame className="w-3 h-3 text-orange-400" />
                                            <span>Warmth / Temperature</span>
                                        </span>
                                        <span className="font-mono text-xs">
                                            {transform.temperature > 0 ? `Warm +${transform.temperature}` : transform.temperature < 0 ? `Cool ${transform.temperature}` : "Neutral 0"}
                                        </span>
                                    </div>
                                    <input
                                        type="range"
                                        min="-80"
                                        max="80"
                                        step="2"
                                        value={transform.temperature}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            onTransformChange((prev) => ({ ...prev, temperature: val }));
                                        }}
                                        className="w-full accent-orange-400 cursor-pointer"
                                    />
                                </div>

                                {/* Grayscale */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                        <span className="flex items-center gap-1">
                                            <Droplet className="w-3 h-3 text-neutral-400" />
                                            <span>Grayscale / Monochrome</span>
                                        </span>
                                        <span className="font-mono text-xs">{transform.grayscale}%</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={transform.grayscale}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            onTransformChange((prev) => ({ ...prev, grayscale: val }));
                                        }}
                                        className="w-full accent-neutral-300 cursor-pointer"
                                    />
                                </div>

                                {/* Blur */}
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-300">
                                        <span className="flex items-center gap-1">
                                            <Eye className="w-3 h-3 text-indigo-400" />
                                            <span>Soft Focus / Blur</span>
                                        </span>
                                        <span className="font-mono text-xs">{transform.blur}px</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0"
                                        max="16"
                                        step="1"
                                        value={transform.blur}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value, 10);
                                            onTransformChange((prev) => ({ ...prev, blur: val }));
                                        }}
                                        className="w-full accent-indigo-400 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 9. Reset All Adjustments Button */}
            {hasAdjustments && (
                <button
                    type="button"
                    onClick={handleResetAll}
                    className="w-full py-2.5 px-3 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-xs font-black border border-neutral-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                    <RefreshCw className="w-3.5 h-3.5 text-[#FFE566]" />
                    <span>Reset All Adjustments</span>
                </button>
            )}
        </div>
    );
};
