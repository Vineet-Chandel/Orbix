import React from "react";
import { CARD_THEMES } from "./types";
import type { CardFormat, CardFace, CardThemeId } from "./types";

interface CardCustomizerToolbarProps {
    format: CardFormat;
    onFormatChange: (fmt: CardFormat) => void;
    face: CardFace;
    onFaceChange: (fc: CardFace) => void;
    onFlip: () => void;
    themeId: CardThemeId;
    onThemeChange: (th: CardThemeId) => void;
    includeGitHub: boolean;
    onToggleGitHub: (val: boolean) => void;
    isGitHubConnected: boolean;
    onDownload: () => void;
    isExporting: boolean;
    onCopyLink: () => void;
    connectedPlatformCount: number;
}

export const CardCustomizerToolbar: React.FC<CardCustomizerToolbarProps> = ({
    format,
    onFormatChange,
    face,
    onFaceChange,
    onFlip,
    themeId,
    onThemeChange,
    includeGitHub,
    onToggleGitHub,
    isGitHubConnected,
    onDownload,
    isExporting,
    onCopyLink,
    connectedPlatformCount,
}) => {
    return (
        <div className="space-y-4">
            {/* Format & Face Segmented Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Format Selector */}
                <div className="bg-neutral-100 p-1 rounded-xl flex items-center">
                    <button
                        type="button"
                        onClick={() => onFormatChange("linkedin")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            format === "linkedin"
                                ? "bg-white text-neutral-900 shadow-2xs"
                                : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.62 1.62 0 1 0 0-3.24 1.62 1.62 0 0 0 0 3.24m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                        </svg>
                        <span>LinkedIn Card</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onFormatChange("instagram")}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            format === "instagram"
                                ? "bg-white text-neutral-900 shadow-2xs"
                                : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="5" y="2" width="14" height="20" rx="3" />
                            <circle cx="12" cy="18" r="1" fill="currentColor" />
                        </svg>
                        <span>Story (9:16)</span>
                    </button>
                </div>

                {/* Face Selector + Quick Flip Button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 p-1 rounded-xl flex items-center">
                        <button
                            type="button"
                            onClick={() => onFaceChange("front")}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                face === "front"
                                    ? "bg-white text-neutral-900 shadow-2xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            Front Face
                        </button>
                        <button
                            type="button"
                            onClick={() => onFaceChange("back")}
                            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                face === "back"
                                    ? "bg-white text-neutral-900 shadow-2xs"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            Back (QR)
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={onFlip}
                        title="Flip card between Front and Back"
                        className="h-9 w-9 flex items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-all cursor-pointer flex-shrink-0"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Theme Swatches & GitHub Stats Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70">
                {/* Theme Selector */}
                <div>
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                        Brand Theme
                    </label>
                    <div className="flex items-center gap-2">
                        {(Object.keys(CARD_THEMES) as CardThemeId[]).map((id) => {
                            const th = CARD_THEMES[id];
                            const isSelected = themeId === id;
                            return (
                                <button
                                    key={id}
                                    type="button"
                                    onClick={() => onThemeChange(id)}
                                    title={th.name}
                                    className={`relative w-7 h-7 rounded-full transition-all cursor-pointer flex items-center justify-center ${
                                        isSelected
                                            ? "ring-2 ring-offset-2 ring-neutral-900 scale-110 shadow-xs"
                                            : "opacity-75 hover:opacity-100 hover:scale-105"
                                    }`}
                                    style={{ backgroundColor: th.accentColor }}
                                >
                                    {isSelected && (
                                        <svg className="w-3.5 h-3.5 text-black drop-shadow-xs" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>
                            );
                        })}
                        <span className="text-xs font-semibold text-neutral-700 ml-1.5 truncate max-w-[120px]">
                            {CARD_THEMES[themeId].name}
                        </span>
                    </div>
                </div>

                {/* GitHub Toggle Switch */}
                <div className="sm:border-l sm:border-neutral-200 sm:pl-4 pt-2 sm:pt-0">
                    <label className="block text-[11px] font-bold text-neutral-500 uppercase tracking-wider mb-1.5">
                        GitHub Activity
                    </label>
                    <label
                        className={`inline-flex items-center gap-2 text-xs font-medium cursor-pointer ${
                            !isGitHubConnected ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                        title={
                            !isGitHubConnected
                                ? "Connect GitHub in the Platforms section below to include stats"
                                : "Toggle GitHub stats on front card"
                        }
                    >
                        <input
                            type="checkbox"
                            checked={includeGitHub && isGitHubConnected}
                            disabled={!isGitHubConnected}
                            onChange={(e) => onToggleGitHub(e.target.checked)}
                            className="w-4 h-4 rounded text-black focus:ring-black accent-black cursor-pointer"
                        />
                        <span className="font-semibold text-neutral-800">
                            Include GitHub Stats
                        </span>
                        {!isGitHubConnected && (
                            <span className="text-[10px] text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                Not Connected
                            </span>
                        )}
                    </label>
                </div>
            </div>

            {/* Platform count info indicator */}
            <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>
                    Showing{" "}
                    <strong className="text-neutral-800 font-bold">
                        {Math.min(format === "linkedin" ? 3 : 5, connectedPlatformCount)}
                    </strong>{" "}
                    of {connectedPlatformCount} connected coding platforms
                </span>
                <span className="text-[11px] text-neutral-400">
                    {format === "linkedin" ? "1200 × 627 px" : "1080 × 1920 px (9:16)"}
                </span>
            </div>

            {/* Primary Action Buttons: Download PNG & Copy Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                <button
                    type="button"
                    onClick={onDownload}
                    disabled={isExporting}
                    className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                    {isExporting ? (
                        <>
                            <svg className="w-4 h-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                            <span>Rendering High-Res PNG...</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Download {face === "front" ? "Front" : "Back"} Card PNG</span>
                        </>
                    )}
                </button>

                <button
                    type="button"
                    onClick={onCopyLink}
                    className="h-11 flex items-center justify-center gap-2 px-4 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold transition-all shadow-2xs cursor-pointer hover:border-neutral-400"
                >
                    <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                    <span>Copy Showcase URL</span>
                </button>
            </div>
        </div>
    );
};
