import React, { useState } from "react";
import { X, UploadCloud, Trash2, Check, Palette, Sparkles } from "lucide-react";
import type { FormThemeSettings } from "../../../api/clubEventFormApi";
import { requestFormMediaSignature, uploadFileToCloudinary } from "../../../api/clubEventFormApi";
import { useToast } from "../../../context/ToastContext";

export interface FormThemeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    theme: FormThemeSettings;
    headerImageUrl: string | null;
    eventId: string;
    onChangeTheme: (updatedTheme: FormThemeSettings) => void;
    onChangeHeaderImage: (url: string | null, publicId: string | null) => void;
}

const ORBIX_ACCENT_PALETTES = [
    { label: "Vibrant Cyan", value: "#38BDF8", bgClass: "bg-[#38BDF8]" },
    { label: "Electric Yellow", value: "#FFE566", bgClass: "bg-[#FFE566]" },
    { label: "Neon Lime", value: "#a2ff86", bgClass: "bg-[#a2ff86]" },
    { label: "Royal Purple", value: "#C084FC", bgClass: "bg-[#C084FC]" },
    { label: "Coral Rose", value: "#FB7185", bgClass: "bg-[#FB7185]" },
    { label: "Tangerine", value: "#FB923C", bgClass: "bg-[#FB923C]" },
    { label: "Neo Black", value: "#18181b", bgClass: "bg-[#18181b]" },
    { label: "Emerald Teal", value: "#2DD4BF", bgClass: "bg-[#2DD4BF]" },
];

const BACKGROUND_PALETTES = [
    { label: "Neo Cream", value: "#FAF6EE", preview: "bg-[#FAF6EE]" },
    { label: "Pure White", value: "#FFFFFF", preview: "bg-white" },
    { label: "Soft Gray", value: "#F3F4F6", preview: "bg-gray-100" },
    { label: "Warm Amber", value: "#FFFBEB", preview: "bg-amber-50" },
    { label: "Cool Sky", value: "#EFF6FF", preview: "bg-blue-50" },
];

const SURFACE_PALETTES = [
    { label: "Pure White", value: "#FFFFFF" },
    { label: "Warm Ivory", value: "#FAF6EE" },
    { label: "Cool Slate", value: "#F8FAFC" },
];

const SHADOW_STYLES: { label: string; value: "soft" | "crisp" | "bold"; desc: string }[] = [
    { label: "Crisp 2px", value: "crisp", desc: "Classic Neo-Brutalist 2px border shadow" },
    { label: "Bold 4px", value: "bold", desc: "High-contrast 4px solid drop shadow" },
    { label: "Soft Glow", value: "soft", desc: "Subtle diffused border shadow" },
];

const BUTTON_STYLES: { label: string; value: "rounded" | "pill" | "sharp" }[] = [
    { label: "Rounded (Default)", value: "rounded" },
    { label: "Pill Capsule", value: "pill" },
    { label: "Sharp Neo", value: "sharp" },
];

const FONT_OPTIONS: { label: string; value: "sans" | "serif" | "mono" | "display"; sub: string }[] = [
    { label: "Sans (Modern)", value: "sans", sub: "Space Grotesk & Inter" },
    { label: "Serif (Editorial)", value: "serif", sub: "Lora & Playfair" },
    { label: "Mono (Dev)", value: "mono", sub: "JetBrains & SF Mono" },
    { label: "Display (Bold)", value: "display", sub: "Cabinet Grotesk" },
];

export const FormThemeDrawer: React.FC<FormThemeDrawerProps> = ({
    isOpen,
    onClose,
    theme,
    headerImageUrl,
    eventId,
    onChangeTheme,
    onChangeHeaderImage,
}) => {
    const toast = useToast();
    const [isUploading, setIsUploading] = useState(false);

    if (!isOpen) return null;

    const handleUploadHeaderImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const signatureConfig = await requestFormMediaSignature(eventId, "banner");
            const result = await uploadFileToCloudinary(signatureConfig, file);
            onChangeHeaderImage(result.secureUrl, result.publicId);
            toast.success("Form header banner updated successfully!");
        } catch (err: any) {
            toast.error(err.message || "Failed to upload header banner.");
        } finally {
            setIsUploading(false);
            e.target.value = "";
        }
    };

    return (
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white dark:bg-[#0A0A0A] border-l border-neutral-200 dark:border-neutral-800 shadow-2xl z-50 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                            <Palette className="w-5 h-5 text-neutral-900 dark:text-neutral-100" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">Theme & Aesthetics</h3>
                            <p className="text-[11px] text-neutral-500 font-normal">
                                Customize fonts, surfaces, and colors
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* 1. Header Banner Image */}
                <div className="space-y-2.5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                        <span>Form Banner Header</span>
                        <span className="text-[10px] text-neutral-400 font-medium lowercase">Max 10 MB</span>
                    </label>

                    {headerImageUrl ? (
                        <div className="relative rounded-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden shadow-sm group">
                            <img
                                src={headerImageUrl}
                                alt="Form Header"
                                className="w-full h-28 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                <label className="px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-sm text-neutral-900 font-semibold text-xs border border-neutral-200 shadow-sm cursor-pointer hover:bg-white">
                                    Change
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleUploadHeaderImage}
                                        disabled={isUploading}
                                        className="hidden"
                                    />
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onChangeHeaderImage(null, null)}
                                    className="p-1.5 rounded-xl bg-rose-500 text-white border border-rose-600 shadow-sm cursor-pointer hover:bg-rose-600"
                                    title="Remove header image"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label className="border border-dashed border-neutral-300 dark:border-neutral-700 hover:border-neutral-900 dark:hover:border-neutral-400 rounded-2xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-neutral-50/70 dark:bg-neutral-900/60 hover:bg-neutral-100/70 dark:hover:bg-neutral-900 transition-colors">
                            <UploadCloud className="w-6 h-6 text-neutral-500" />
                            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
                                {isUploading ? "Uploading Banner..." : "Upload Header Banner"}
                            </span>
                            <span className="text-[10px] text-neutral-400 font-normal">
                                Recommended 1200 x 320 px (JPG, PNG, WebP)
                            </span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleUploadHeaderImage}
                                disabled={isUploading}
                                className="hidden"
                            />
                        </label>
                    )}
                </div>

                {/* 2. Primary Accent Color */}
                <div className="space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Accent Theme Color
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                        {ORBIX_ACCENT_PALETTES.map((palette) => {
                            const isSelected = theme.accentColor?.toLowerCase() === palette.value.toLowerCase();
                            return (
                                <button
                                    key={palette.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, accentColor: palette.value })}
                                    className={`h-10 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-center transition-all active:scale-95 cursor-pointer ${
                                        palette.bgClass
                                    } ${isSelected ? "ring-2 ring-neutral-900 dark:ring-white ring-offset-2 ring-offset-white dark:ring-offset-[#0A0A0A]" : "hover:border-neutral-400"}`}
                                    title={palette.label}
                                >
                                    {isSelected && (
                                        <Check
                                            className={`w-4 h-4 stroke-[2.5] ${
                                                palette.value === "#18181b" ? "text-white" : "text-black"
                                            }`}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 3. Canvas Background Color */}
                <div className="space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Canvas Background Tone
                    </label>
                    <div className="grid grid-cols-5 gap-2">
                        {BACKGROUND_PALETTES.map((bg) => {
                            const isSelected = (theme.backgroundColor || "#FAF6EE").toLowerCase() === bg.value.toLowerCase();
                            return (
                                <button
                                    key={bg.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, backgroundColor: bg.value })}
                                    className={`h-9 rounded-xl border border-neutral-200 dark:border-neutral-700 flex items-center justify-center cursor-pointer transition-all active:scale-95 ${
                                        bg.preview
                                    } ${isSelected ? "ring-2 ring-neutral-900 dark:ring-white ring-offset-2" : "hover:border-neutral-400"}`}
                                    title={bg.label}
                                >
                                    {isSelected && <Check className="w-3.5 h-3.5 text-neutral-900 stroke-[2.5]" />}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 4. Card Surface Tone */}
                <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Card Surface Color
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SURFACE_PALETTES.map((sf) => {
                            const isSelected = (theme.cardSurfaceColor || "#FFFFFF").toLowerCase() === sf.value.toLowerCase();
                            return (
                                <button
                                    key={sf.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, cardSurfaceColor: sf.value })}
                                    className={`p-2 rounded-xl border text-[11px] font-semibold cursor-pointer text-center transition-colors ${
                                        isSelected
                                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm"
                                            : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                    }`}
                                >
                                    {sf.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 5. Card Shadow Style */}
                <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Card Elevation
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SHADOW_STYLES.map((sh) => {
                            const isSelected = (theme.cardShadowStyle || "crisp") === sh.value;
                            return (
                                <button
                                    key={sh.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, cardShadowStyle: sh.value })}
                                    className={`p-2 rounded-xl border text-[11px] font-semibold cursor-pointer text-center transition-colors ${
                                        isSelected
                                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm"
                                            : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                    }`}
                                    title={sh.desc}
                                >
                                    {sh.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 6. Button Style */}
                <div className="space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Button Geometry
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {BUTTON_STYLES.map((b) => {
                            const isSelected = (theme.buttonStyle || "rounded") === b.value;
                            return (
                                <button
                                    key={b.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, buttonStyle: b.value })}
                                    className={`p-2 rounded-xl border text-[11px] font-semibold cursor-pointer text-center transition-colors ${
                                        isSelected
                                            ? "bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 border-neutral-900 dark:border-white shadow-sm"
                                            : "bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                                    }`}
                                >
                                    {b.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 7. Font Family */}
                <div className="space-y-2.5">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                        Typography Style
                    </label>
                    <div className="space-y-2">
                        {FONT_OPTIONS.map((font) => (
                            <button
                                key={font.value}
                                type="button"
                                onClick={() => onChangeTheme({ ...theme, fontFamily: font.value })}
                                className={`w-full text-left p-3 rounded-xl border font-medium text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                    (theme.fontFamily || "sans") === font.value
                                        ? "bg-neutral-100 dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-sm"
                                        : "bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300"
                                }`}
                            >
                                <div>
                                    <span className="block font-semibold">{font.label}</span>
                                    <span className="text-[10px] text-neutral-500 font-normal block">
                                        {font.sub}
                                    </span>
                                </div>
                                {(theme.fontFamily || "sans") === font.value && (
                                    <Check className="w-4 h-4 text-neutral-900 dark:text-neutral-100 stroke-[2.5]" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800 mt-6">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-semibold text-xs hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1.5"
                >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Apply Theme</span>
                </button>
            </div>
        </div>
    );
};
