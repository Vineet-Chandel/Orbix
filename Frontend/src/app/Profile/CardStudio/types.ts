export type CardFormat = "linkedin" | "instagram";
export type CardFace = "front" | "back";
export type CardThemeId = "indigo" | "gold" | "emerald" | "ruby" | "slate";
export type SlotShowcaseCategory = "practice" | "dev" | "both";

export interface CardThemeConfig {
    id: CardThemeId;
    name: string;
    bannerGradient: string;
    bannerPatternColor: string;
    accentColor: string;
    badgeBg: string;
    badgeText: string;
    borderGlow: string;
}

export const CARD_THEMES: Record<CardThemeId, CardThemeConfig> = {
    indigo: {
        id: "indigo",
        name: "Midnight Indigo",
        bannerGradient: "from-indigo-500 via-purple-600 to-indigo-800",
        bannerPatternColor: "rgba(255,255,255,0.08)",
        accentColor: "#6366F1",
        badgeBg: "rgba(99, 102, 241, 0.15)",
        badgeText: "#818CF8",
        borderGlow: "rgba(99, 102, 241, 0.25)",
    },
    gold: {
        id: "gold",
        name: "Obsidian Gold",
        bannerGradient: "from-amber-400 via-amber-500 to-yellow-600",
        bannerPatternColor: "rgba(0,0,0,0.08)",
        accentColor: "#F59E0B",
        badgeBg: "rgba(245, 158, 11, 0.15)",
        badgeText: "#FBBF24",
        borderGlow: "rgba(245, 158, 11, 0.25)",
    },
    emerald: {
        id: "emerald",
        name: "Cyber Emerald",
        bannerGradient: "from-emerald-400 via-teal-500 to-emerald-700",
        bannerPatternColor: "rgba(0,0,0,0.08)",
        accentColor: "#10B981",
        badgeBg: "rgba(16, 185, 129, 0.15)",
        badgeText: "#34D399",
        borderGlow: "rgba(16, 185, 129, 0.25)",
    },
    ruby: {
        id: "ruby",
        name: "Crimson Ruby",
        bannerGradient: "from-rose-500 via-red-600 to-rose-800",
        bannerPatternColor: "rgba(255,255,255,0.08)",
        accentColor: "#F43F5E",
        badgeBg: "rgba(244, 63, 94, 0.15)",
        badgeText: "#FB7185",
        borderGlow: "rgba(244, 63, 94, 0.25)",
    },
    slate: {
        id: "slate",
        name: "Titanium Slate",
        bannerGradient: "from-neutral-300 via-neutral-400 to-neutral-600",
        bannerPatternColor: "rgba(0,0,0,0.06)",
        accentColor: "#E5E7EB",
        badgeBg: "rgba(255, 255, 255, 0.12)",
        badgeText: "#F3F4F6",
        borderGlow: "rgba(255, 255, 255, 0.2)",
    },
};

export interface CardCustomizationSettings {
    format: CardFormat;
    face: CardFace;
    theme: CardThemeId;
    includeGitHub: boolean;
    slotCategory?: SlotShowcaseCategory;
    selectedPlatforms: string[]; // Custom manual selection or auto order
}

export const DEFAULT_CARD_SETTINGS: CardCustomizationSettings = {
    format: "linkedin",
    face: "front",
    theme: "indigo",
    includeGitHub: false,
    slotCategory: "both",
    selectedPlatforms: [],
};
