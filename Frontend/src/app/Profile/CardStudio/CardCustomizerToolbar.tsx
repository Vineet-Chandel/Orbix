import React from "react";
import { motion } from "framer-motion";
import { Code2, FolderGit2, Sparkles } from "lucide-react";
import { CARD_THEMES } from "./types";
import type { CardFormat, CardFace, CardThemeId, SlotShowcaseCategory } from "./types";
import type { RankedPlatform, RankedContestPlatform } from "../../../utils/cardStatsAggregator";
import { getPortalIcon } from "../../../utils/portalIcons";

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

    // Dynamic Slot Customization Props
    maxSlots: number;
    availablePlatforms: RankedPlatform[];
    currentSlotIds: string[];
    onSlotChange: (slotIndex: number, platformId: string) => void;
    onSwapSlots: (indexA: number, indexB: number) => void;
    onRemoveSlot: (slotIndex: number) => void;
    onTogglePlatform: (platformId: string) => void;
    onResetSlots: () => void;
    isCustomized: boolean;

    // 3-Way Slot Classification Category
    slotCategory: SlotShowcaseCategory;
    onSlotCategoryChange: (cat: SlotShowcaseCategory) => void;

    // Legacy Contest Standings Support
    showcaseMode?: "problems" | "contests";
    onShowcaseModeChange?: (mode: "problems" | "contests") => void;
    availableContests?: RankedContestPlatform[];
    currentContestSlotIds?: string[];
    onContestSlotChange?: (slotIndex: number, platformId: string) => void;
    onSwapContestSlots?: (indexA: number, indexB: number) => void;
    onRemoveContestSlot?: (slotIndex: number) => void;
    onToggleContestPlatform?: (platformId: string) => void;
    onResetContestSlots?: () => void;
    isContestCustomized?: boolean;
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
    connectedPlatformCount: _connectedPlatformCount,
    maxSlots,
    availablePlatforms,
    currentSlotIds,
    onSlotChange,
    onSwapSlots,
    onRemoveSlot,
    onTogglePlatform,
    onResetSlots,
    isCustomized,
    slotCategory = "both",
    onSlotCategoryChange,
    showcaseMode: _showcaseMode = "problems",
    onShowcaseModeChange: _onShowcaseModeChange,
    availableContests: _availableContests = [],
    currentContestSlotIds: _currentContestSlotIds = [],
    onContestSlotChange: _onContestSlotChange,
    onSwapContestSlots: _onSwapContestSlots,
    onRemoveContestSlot: _onRemoveContestSlot,
    onToggleContestPlatform: _onToggleContestPlatform,
    onResetContestSlots: _onResetContestSlots,
    isContestCustomized: _isContestCustomized = false,
}) => {
    return (
        <div className="space-y-4">
            {/* Format & Face Segmented Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Format Selector */}
                <div className="bg-neutral-100 p-1 rounded-xl flex items-center relative">
                    <button
                        type="button"
                        onClick={() => onFormatChange("linkedin")}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            format === "linkedin"
                                ? "text-neutral-900"
                                : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        {format === "linkedin" && (
                            <motion.div
                                layoutId="activeFormatIndicator"
                                className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.62 1.62 0 1 0 0-3.24 1.62 1.62 0 0 0 0 3.24m1.39 9.74v-8.37H5.07v8.37h2.78z" />
                            </svg>
                            <span>LinkedIn Card</span>
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => onFormatChange("instagram")}
                        className={`relative flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                            format === "instagram"
                                ? "text-neutral-900"
                                : "text-neutral-500 hover:text-neutral-900"
                        }`}
                    >
                        {format === "instagram" && (
                            <motion.div
                                layoutId="activeFormatIndicator"
                                className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                                transition={{ type: "spring", stiffness: 450, damping: 35 }}
                            />
                        )}
                        <span className="relative z-10 flex items-center gap-1.5">
                            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <rect x="5" y="2" width="14" height="20" rx="3" />
                                <circle cx="12" cy="18" r="1" fill="currentColor" />
                            </svg>
                            <span>Story (9:16)</span>
                        </span>
                    </button>
                </div>

                {/* Face Selector + Quick Flip Button */}
                <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-100 p-1 rounded-xl flex items-center relative">
                        <button
                            type="button"
                            onClick={() => onFaceChange("front")}
                            className={`relative flex-1 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                face === "front"
                                    ? "text-neutral-900"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            {face === "front" && (
                                <motion.div
                                    layoutId="activeFaceIndicator"
                                    className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <span className="relative z-10">Front Face</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onFaceChange("back")}
                            className={`relative flex-1 py-1.5 px-3 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                                face === "back"
                                    ? "text-neutral-900"
                                    : "text-neutral-500 hover:text-neutral-900"
                            }`}
                        >
                            {face === "back" && (
                                <motion.div
                                    layoutId="activeFaceIndicator"
                                    className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                                    transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                />
                            )}
                            <span className="relative z-10">Back (QR)</span>
                        </button>
                    </div>

                    <motion.button
                        type="button"
                        onClick={onFlip}
                        whileTap={{ scale: 0.9, rotate: 180 }}
                        whileHover={{ scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                        title="Flip card between Front and Back"
                        className="h-9 w-9 flex items-center justify-center rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 transition-colors cursor-pointer flex-shrink-0"
                    >
                        <svg className={`w-4 h-4 transition-transform duration-500 ${face === "back" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </motion.button>
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
                                : "Toggle GitHub stats on card"
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

            {/* ========================================================================= */}
            {/* SHOWCASED PLATFORM SLOTS SECTION */}
            {/* ========================================================================= */}
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/70 space-y-3.5">
                {/* Slot Classification Category Selector Segmented Tabs */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b border-neutral-200/80">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-neutral-900 uppercase tracking-wider">
                                Showcased Platform Slots
                            </span>
                            {isCustomized ? (
                                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 border border-indigo-200">
                                    Customized
                                </span>
                            ) : (
                                <span className="text-[10px] font-medium text-neutral-500">
                                    (Auto Ranked)
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-neutral-500 mt-0.5">
                            {slotCategory === "practice"
                                ? "Practice slots: Smart synced problem solving with verified contest ratings (ratings displayed only when active & good)."
                                : slotCategory === "dev"
                                ? "Dev slots: Engineering metrics including total commits, repositories, and best working day."
                                : "Both slots: 1 dedicated dev slot (GitHub) alongside your top problem-solving practice platforms."}
                        </p>
                    </div>

                    {/* 3-Way Slot Classification Category Switcher */}
                    <div className="bg-neutral-200/80 p-0.5 rounded-xl flex items-center flex-shrink-0 relative">
                        {(["practice", "dev", "both"] as SlotShowcaseCategory[]).map((cat) => {
                            const isSelected = slotCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => onSlotCategoryChange(cat)}
                                    className={`relative flex items-center gap-1.5 py-1 px-3 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                                        isSelected
                                            ? "text-neutral-900"
                                            : "text-neutral-600 hover:text-neutral-900"
                                    }`}
                                >
                                    {isSelected && (
                                        <motion.div
                                            layoutId="activeCategoryIndicator"
                                            className="absolute inset-0 bg-white rounded-lg shadow-2xs"
                                            transition={{ type: "spring", stiffness: 450, damping: 35 }}
                                        />
                                    )}
                                    <span className="relative z-10 flex items-center gap-1.5">
                                        {cat === "practice" && <Code2 className="w-3.5 h-3.5 text-indigo-600" />}
                                        {cat === "dev" && <FolderGit2 className="w-3.5 h-3.5 text-emerald-600" />}
                                        {cat === "both" && <Sparkles className="w-3.5 h-3.5 text-amber-500" />}
                                        <span className="capitalize">{cat === "dev" ? "Dev Slot" : cat}</span>
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Reset Auto Button Header if customized */}
                <div className="flex items-center justify-between text-xs text-neutral-500">
                    <span className="text-[11px]">
                        {format === "linkedin"
                            ? `Displaying ${currentSlotIds.filter(Boolean).length} of 3 slots on LinkedIn Card`
                            : `Displaying ${currentSlotIds.filter(Boolean).length} of 5 slots on Story Card`}
                    </span>

                    {isCustomized && (
                        <button
                            type="button"
                            onClick={onResetSlots}
                            title="Reset slots back to auto-ranked order"
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold text-neutral-600 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-md shadow-2xs transition-all cursor-pointer"
                        >
                            <svg className="w-3 h-3 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reset Auto</span>
                        </button>
                    )}
                </div>

                {/* Slot Selectors */}
                <div className="space-y-2">
                    {Array.from({ length: maxSlots }).map((_, slotIdx) => {
                        const currentId = currentSlotIds[slotIdx] || "";
                        const isDevDedicatedSlot = slotCategory === "both" && slotIdx === maxSlots - 1;

                        // Options relevant to this slot
                        const filteredPlatforms = availablePlatforms.filter((plat) => {
                            if (slotCategory === "practice") {
                                return !plat.isGitHub && plat.category !== "dev";
                            }
                            if (slotCategory === "dev") {
                                return plat.isGitHub || plat.category === "dev";
                            }
                            // Both mode
                            if (isDevDedicatedSlot) {
                                return plat.isGitHub || plat.category === "dev";
                            }
                            return !plat.isGitHub && plat.category !== "dev";
                        });

                        const platformsToDisplay = filteredPlatforms.length > 0 ? filteredPlatforms : availablePlatforms;

                        return (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                key={slotIdx}
                                className="flex items-center gap-2 bg-white p-2 rounded-lg border border-neutral-200 shadow-2xs"
                            >
                                {/* Slot Badge */}
                                <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                                    <span
                                        className={`w-2 h-2 rounded-full ${
                                            isDevDedicatedSlot || slotCategory === "dev"
                                                ? "bg-emerald-500"
                                                : "bg-indigo-500"
                                        }`}
                                    />
                                    <span className="text-[11px] font-black text-neutral-700 tracking-wider">
                                        {isDevDedicatedSlot ? "Dev Slot" : `Slot ${slotIdx + 1}`}
                                    </span>
                                </div>

                                {/* Platform Dropdown Selector */}
                                <div className="flex-1 min-w-0 relative">
                                    <select
                                        value={currentId}
                                        onChange={(e) => onSlotChange(slotIdx, e.target.value)}
                                        className="w-full text-xs font-semibold bg-neutral-50 hover:bg-neutral-100 focus:bg-white text-neutral-800 border border-neutral-200 focus:border-neutral-900 rounded-md py-1.5 pl-2.5 pr-7 outline-none cursor-pointer truncate transition-colors"
                                    >
                                        <option value="">— Empty / Select Platform —</option>
                                        {platformsToDisplay.map((plat) => {
                                            const isSelectedElsewhere = currentSlotIds.some(
                                                (id, idx) => idx !== slotIdx && id === plat.id
                                            );

                                            let label = "";
                                            if (plat.isGitHub || plat.category === "dev") {
                                                const bestStr = plat.bestWorkingDay ? ` • Best: ${plat.bestWorkingDay}` : "";
                                                label = `${plat.name} (${plat.publicRepos ?? 0} repos, ${plat.contributionsOrCommits ?? 0} commits${bestStr})`;
                                            } else if (plat.hasGoodRating && plat.rating) {
                                                const tierStr = plat.tier ? ` ${plat.tier}` : "";
                                                label = `${plat.name} (Rating: ${plat.rating}${tierStr} • ${plat.solvedCount} solved)`;
                                            } else if (plat.solvedCount > 0) {
                                                label = `${plat.name} (${plat.solvedCount} solved)`;
                                            } else {
                                                label = `${plat.name} (@${plat.username})`;
                                            }

                                            return (
                                                <option key={plat.id} value={plat.id}>
                                                    {label} {isSelectedElsewhere ? "(Swap)" : ""}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>

                                {/* Reorder Controls */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    <button
                                        type="button"
                                        disabled={slotIdx === 0}
                                        onClick={() => onSwapSlots(slotIdx, slotIdx - 1)}
                                        title="Move slot up"
                                        className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={slotIdx === maxSlots - 1}
                                        onClick={() => onSwapSlots(slotIdx, slotIdx + 1)}
                                        title="Move slot down"
                                        className="w-6 h-6 flex items-center justify-center rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>

                                    {/* Clear / Delete Slot Button */}
                                    <button
                                        type="button"
                                        disabled={!currentId}
                                        onClick={() => onRemoveSlot(slotIdx)}
                                        title="Remove platform from this slot"
                                        className="w-6 h-6 flex items-center justify-center rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-25 disabled:cursor-not-allowed cursor-pointer transition-colors"
                                    >
                                        <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* Quick 1-Click Platform Toggle Chips */}
                <div className="pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 block mb-1.5">
                        Quick Add / Remove Platforms:
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                        {availablePlatforms
                            .filter((plat) => {
                                if (slotCategory === "practice") return !plat.isGitHub && plat.category !== "dev";
                                if (slotCategory === "dev") return plat.isGitHub || plat.category === "dev";
                                return true;
                            })
                            .map((plat) => {
                                const isPresent = currentSlotIds.includes(plat.id);
                                return (
                                    <button
                                        key={plat.id}
                                        type="button"
                                        onClick={() => onTogglePlatform(plat.id)}
                                        title={isPresent ? `Remove ${plat.name} from card` : `Add ${plat.name} to card`}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                            isPresent
                                                ? "bg-neutral-900 text-white shadow-2xs hover:bg-neutral-800"
                                                : "bg-white text-neutral-700 hover:bg-neutral-100 border border-neutral-300 hover:border-neutral-400"
                                        }`}
                                    >
                                        <div className="w-3.5 h-3.5 flex items-center justify-center flex-shrink-0">
                                            {getPortalIcon(plat.id, "w-full h-full object-contain")}
                                        </div>
                                        <span>{plat.name}</span>
                                        {plat.isGitHub ? (
                                            <span className={`text-[10px] font-mono ${isPresent ? "text-emerald-300" : "text-emerald-600"}`}>
                                                ({plat.contributionsOrCommits ?? 0} commits)
                                            </span>
                                        ) : plat.hasGoodRating && plat.rating ? (
                                            <span className={`text-[10px] font-mono ${isPresent ? "text-amber-300" : "text-amber-600"}`}>
                                                ({plat.rating}★)
                                            </span>
                                        ) : plat.solvedCount > 0 ? (
                                            <span className={`text-[10px] font-mono ${isPresent ? "text-neutral-300" : "text-neutral-500"}`}>
                                                ({plat.solvedCount})
                                            </span>
                                        ) : null}
                                        <span className="text-[10px] font-bold">
                                            {isPresent ? "✕" : "+"}
                                        </span>
                                    </button>
                                );
                            })}
                    </div>
                </div>
            </div>

            {/* Platform count info indicator */}
            <div className="flex items-center justify-between text-xs text-neutral-500 px-1">
                <span>
                    Displaying{" "}
                    <strong className="text-neutral-800 font-bold">
                        {currentSlotIds.filter(Boolean).length}
                    </strong>{" "}
                    of {availablePlatforms.length} connected platforms
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
