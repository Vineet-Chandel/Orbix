import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Check,
    Crop,
    AlertCircle,
    Undo2,
    Redo2,
    Layers,
    Sliders,
} from "lucide-react";
import { getMediaPlacementConfig, type MediaPlacementConfig } from "./imagePlacementConfigs";
import {
    loadImageElement,
    renderTransformedImageToBlob,
    INITIAL_TRANSFORM_STATE,
    type EditorTransformState,
} from "./imageCanvasUtils";
import { AdaptiveImageCropper } from "./AdaptiveImageCropper";
import { AdaptiveImageAdjustmentPanel } from "./AdaptiveImageAdjustmentPanel";
import { AdaptiveImagePreview } from "./AdaptiveImagePreview";
import { OrbixLoader } from "../ui/loader";
import { useModalDismiss } from "../../hooks/useModalDismiss";

export interface AdaptiveImageEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    imageSource: File | string | Blob | null;
    placementId?: string;
    customConfig?: Partial<MediaPlacementConfig>;
    onConfirm: (result: { file: File; blob: Blob; dataUrl: string }) => void | Promise<void>;
}

export const AdaptiveImageEditorModal: React.FC<AdaptiveImageEditorModalProps> = ({
    isOpen,
    onClose,
    imageSource,
    placementId = "user_avatar",
    customConfig,
    onConfirm,
}) => {
    const baseConfig = getMediaPlacementConfig(placementId);
    const config: MediaPlacementConfig = {
        ...baseConfig,
        ...customConfig,
        features: {
            ...baseConfig.features,
            ...(customConfig?.features || {}),
        },
        exportTarget: {
            ...baseConfig.exportTarget,
            ...(customConfig?.exportTarget || {}),
        },
    };

    const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
    const [loadingImage, setLoadingImage] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const [activeAspectRatio, setActiveAspectRatio] = useState<number>(config.aspectRatio);
    const [transform, setTransform] = useState<EditorTransformState>(INITIAL_TRANSFORM_STATE);
    const [isExporting, setIsExporting] = useState(false);
    const [activeTab, setActiveTab] = useState<"adjust" | "preview">("adjust");
    const [isFocalMode, setIsFocalMode] = useState(false);

    // Undo / Redo History Stack
    const [history, setHistory] = useState<EditorTransformState[]>([INITIAL_TRANSFORM_STATE]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // Load Image Element whenever imageSource changes or modal opens
    useEffect(() => {
        if (!isOpen || !imageSource) {
            setLoadedImage(null);
            setLoadError(null);
            return;
        }

        let isMounted = true;
        setLoadingImage(true);
        setLoadError(null);

        loadImageElement(imageSource)
            .then((img) => {
                if (!isMounted) return;
                setLoadedImage(img);
                setActiveAspectRatio(config.aspectRatio);
                const initial: EditorTransformState = {
                    ...INITIAL_TRANSFORM_STATE,
                    fitMode: config.fit || "cover",
                    backgroundColor: config.fit === "contain" ? "#000000" : undefined,
                };
                setTransform(initial);
                setHistory([initial]);
                setHistoryIndex(0);
            })
            .catch((err) => {
                if (!isMounted) return;
                console.error("AdaptiveImageEditor image load error:", err);
                setLoadError(err.message || "Failed to load selected image.");
            })
            .finally(() => {
                if (isMounted) setLoadingImage(false);
            });

        return () => {
            isMounted = false;
        };
    }, [isOpen, imageSource, config.aspectRatio, config.fit]);

    const { handleBackdropClick } = useModalDismiss({
        isOpen: isOpen && !isExporting,
        onClose,
    });

    // History-tracking Transform Updater
    const handleTransformChange = (updater: (prev: EditorTransformState) => EditorTransformState) => {
        setTransform((prev) => {
            const next = updater(prev);
            setHistory((h) => [...h.slice(0, historyIndex + 1), next]);
            setHistoryIndex((idx) => idx + 1);
            return next;
        });
    };

    const handleUndo = () => {
        if (historyIndex > 0) {
            const targetIdx = historyIndex - 1;
            setHistoryIndex(targetIdx);
            setTransform(history[targetIdx]);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const targetIdx = historyIndex + 1;
            setHistoryIndex(targetIdx);
            setTransform(history[targetIdx]);
        }
    };

    // Execute High-Resolution Export
    const handleConfirmExport = async () => {
        if (!loadedImage) return;

        try {
            setIsExporting(true);

            // Compute cropbox in relative image space
            const targetRatio =
                activeAspectRatio > 0
                    ? activeAspectRatio
                    : loadedImage.naturalWidth / loadedImage.naturalHeight;

            const targetW = config.exportTarget.width;
            const targetH = Math.round(targetW / targetRatio);

            const sourceW = loadedImage.naturalWidth;
            const sourceH = loadedImage.naturalHeight;

            // Cropbox bounding box calculations
            const cropBox = {
                x: -transform.pan.x,
                y: -transform.pan.y,
                width: sourceW / transform.zoom,
                height: sourceH / transform.zoom,
            };

            const fileName =
                imageSource instanceof File
                    ? imageSource.name
                    : `${config.placementId}_framed`;

            const result = await renderTransformedImageToBlob(
                loadedImage,
                transform,
                cropBox,
                targetW,
                targetH,
                config.exportTarget.mimeType,
                config.exportTarget.quality,
                fileName
            );

            await onConfirm(result);
            onClose();
        } catch (err: any) {
            console.error("Failed to export framed image:", err);
            setLoadError("Export failed: " + (err.message || "Unknown error"));
        } finally {
            setIsExporting(false);
        }
    };

    if (!isOpen) return null;
    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[120] flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md select-none"
            onClick={handleBackdropClick}
        >
            <div
                className="w-full max-w-6xl h-[94vh] max-h-[860px] bg-[#0A0A0A] border-2 border-neutral-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150 text-white"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 1. Header Bar */}
                <div className="p-3.5 sm:px-6 bg-[#0E0E0E] border-b border-neutral-800 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                            <Crop className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm sm:text-base font-black text-white tracking-tight truncate">
                                    {config.title}
                                </h3>
                                <span className="hidden sm:inline px-2 py-0.5 rounded-full bg-neutral-900 border border-neutral-700 text-[10px] font-bold text-neutral-300">
                                    {config.shape} • {activeAspectRatio > 0 ? `${activeAspectRatio.toFixed(2)}:1` : "Freeform"}
                                </span>
                            </div>
                            <p className="text-[11px] text-neutral-400 font-medium truncate">
                                {config.description}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Undo & Redo Actions */}
                        <div className="flex items-center bg-neutral-900 border border-neutral-700 rounded-xl p-0.5">
                            <button
                                type="button"
                                onClick={handleUndo}
                                disabled={historyIndex <= 0}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
                                title="Undo (Cmd+Z)"
                            >
                                <Undo2 className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleRedo}
                                disabled={historyIndex >= history.length - 1}
                                className="p-1.5 rounded-lg text-neutral-400 hover:text-white disabled:opacity-30 cursor-pointer transition-colors"
                                title="Redo (Cmd+Y)"
                            >
                                <Redo2 className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Close Modal Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
                            title="Close Editor"
                        >
                            <X className="w-4 h-4 stroke-[2.5]" />
                        </button>
                    </div>
                </div>

                {/* 2. Workspace Body */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Left: Interactive Canvas Viewport */}
                    <div className="flex-1 relative flex items-center justify-center bg-[#050505] overflow-hidden min-h-[300px]">
                        {loadingImage && (
                            <div className="flex flex-col items-center gap-3 text-white">
                                <OrbixLoader size="md" />
                                <span className="text-xs font-bold text-neutral-400">Loading media...</span>
                            </div>
                        )}

                        {loadError && (
                            <div className="max-w-md p-5 rounded-2xl bg-rose-950/80 border border-rose-500 text-rose-200 text-center space-y-2">
                                <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
                                <p className="text-sm font-bold">Failed to load media</p>
                                <p className="text-xs text-rose-300">{loadError}</p>
                            </div>
                        )}

                        {!loadingImage && !loadError && loadedImage && (
                            <AdaptiveImageCropper
                                image={loadedImage}
                                config={config}
                                activeAspectRatio={activeAspectRatio}
                                transform={transform}
                                onTransformChange={handleTransformChange}
                                isFocalMode={isFocalMode}
                                onToggleFocalMode={() => setIsFocalMode((prev) => !prev)}
                            />
                        )}
                    </div>

                    {/* Right: Controls & Previews Sidebar */}
                    <div className="w-full md:w-[380px] lg:w-[420px] bg-[#0E0E0E] border-t md:border-t-0 md:border-l border-neutral-800 flex flex-col shrink-0">
                        {/* Sidebar Tabs */}
                        <div className="p-3 border-b border-neutral-800 flex items-center gap-2 bg-[#0A0A0A]">
                            <button
                                type="button"
                                onClick={() => setActiveTab("adjust")}
                                className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                    activeTab === "adjust"
                                        ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                        : "bg-neutral-900 text-neutral-400 hover:text-white"
                                }`}
                            >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Adjustments</span>
                            </button>

                            {config.previewContexts && config.previewContexts.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab("preview")}
                                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                                        activeTab === "preview"
                                            ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                            : "bg-neutral-900 text-neutral-400 hover:text-white"
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>Live Previews</span>
                                </button>
                            )}
                        </div>

                        {/* Scrollable Tab Content */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                            {activeTab === "adjust" ? (
                                <AdaptiveImageAdjustmentPanel
                                    config={config}
                                    activeAspectRatio={activeAspectRatio}
                                    onAspectRatioChange={(newRatio) => setActiveAspectRatio(newRatio)}
                                    transform={transform}
                                    onTransformChange={handleTransformChange}
                                    isFocalMode={isFocalMode}
                                    onToggleFocalMode={() => setIsFocalMode((prev) => !prev)}
                                />
                            ) : (
                                loadedImage && (
                                    <AdaptiveImagePreview
                                        image={loadedImage}
                                        config={config}
                                        transform={transform}
                                    />
                                )
                            )}
                        </div>
                    </div>
                </div>

                {/* 3. Bottom Action Bar */}
                <div className="p-4 sm:px-6 bg-[#0E0E0E] border-t border-neutral-800 flex items-center justify-between shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isExporting}
                        className="px-4 py-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-bold border border-neutral-700 transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        <span className="hidden sm:inline text-[11px] font-mono text-neutral-500">
                            Target: {config.exportTarget.width}×{Math.round(config.exportTarget.width / (activeAspectRatio || 1))}px ({config.exportTarget.mimeType.split("/")[1].toUpperCase()})
                        </span>

                        <button
                            type="button"
                            onClick={handleConfirmExport}
                            disabled={!loadedImage || isExporting}
                            className="px-5 py-2.5 rounded-xl bg-[#a2ff86] hover:bg-[#86efac] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50"
                        >
                            {isExporting ? (
                                <>
                                    <OrbixLoader size="sm" />
                                    <span>Processing & Exporting...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4 stroke-[3]" />
                                    <span>Confirm & Apply</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
