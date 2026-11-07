import React, { useState } from "react";
import { createPortal } from "react-dom";
import { Palette, X, UploadCloud, Check, Trash2, Sparkles, RefreshCw } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import type { FormThemeSettings } from "../../../api/clubEventFormApi";
import { requestFormMediaSignature, uploadFileToCloudinary } from "../../../api/clubEventFormApi";

export interface FormThemeDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    theme: FormThemeSettings;
    headerImageUrl?: string | null;
    eventId: string;
    onChangeTheme: (theme: FormThemeSettings) => void;
    onChangeHeaderImage: (url: string | null, publicId: string | null) => void;
}

const ORBIX_ACCENT_PALETTES: { label: string; value: string; bgClass: string }[] = [
    { label: "Orbix Sky", value: "#38BDF8", bgClass: "bg-[#38BDF8]" },
    { label: "Campus Yellow", value: "#FFE566", bgClass: "bg-[#FFE566]" },
    { label: "Neon Lime", value: "#A2FF86", bgClass: "bg-[#A2FF86]" },
    { label: "Cyber Purple", value: "#C084FC", bgClass: "bg-[#C084FC]" },
    { label: "Vibrant Coral", value: "#FB7185", bgClass: "bg-[#FB7185]" },
    { label: "Bright Amber", value: "#FB923C", bgClass: "bg-[#FB923C]" },
    { label: "Solid Pitch", value: "#18181B", bgClass: "bg-[#18181B]" },
    { label: "Emerald Teal", value: "#2DD4BF", bgClass: "bg-[#2DD4BF]" },
];

const BACKGROUND_PALETTES: { label: string; value: string; preview: string }[] = [
    { label: "Orbix Canvas", value: "#FAF6EE", preview: "bg-[#FAF6EE]" },
    { label: "Clean White", value: "#FFFFFF", preview: "bg-white" },
    { label: "Cool Mist", value: "#F1F5F9", preview: "bg-[#F1F5F9]" },
    { label: "Soft Cream", value: "#FEFCE8", preview: "bg-[#FEFCE8]" },
    { label: "Sky Ice", value: "#F0F9FF", preview: "bg-[#F0F9FF]" },
];

const SURFACE_PALETTES: { label: string; value: string }[] = [
    { label: "Pure White", value: "#FFFFFF" },
    { label: "Warm Ivory", value: "#FCFBF7" },
    { label: "Cool Slate", value: "#F8FAFC" },
];

const SHADOW_STYLES: { label: string; value: "crisp" | "bold" | "soft"; desc: string }[] = [
    { label: "Crisp 2px", value: "crisp", desc: "Classic Neo 2px sharp offset" },
    { label: "Bold 4px", value: "bold", desc: "Orbix Signature 4px high-contrast" },
    { label: "Soft Glow", value: "soft", desc: "Subtle diffused box elevation" },
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

    const handleResetTheme = () => {
        onChangeTheme({
            accentColor: "#38BDF8",
            backgroundColor: "#FAF6EE",
            cardSurfaceColor: "#FFFFFF",
            fontFamily: "sans",
            buttonStyle: "rounded",
            cardShadowStyle: "crisp",
        });
        toast.info("Theme reset to Orbix defaults.");
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-screen h-screen z-[100] flex items-center justify-center p-3 sm:p-4 select-none">
            {/* Backdrop Overlay */}
            <div
                className="fixed inset-0 top-0 left-0 right-0 bottom-0 w-full h-full bg-black/70 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Neo-brutalist Centered Theme Panel (Dead Center of Screen) */}
            <aside
                className="relative w-full max-w-[480px] max-h-[90vh] rounded-3xl bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] border-3 sm:border-4 border-black shadow-[8px_8px_0px_#000] z-[101] text-black flex flex-col justify-between overflow-hidden animate-in zoom-in-95 duration-200"
            >
                {/* Top Header */}
                <div className="p-4 sm:p-5 border-b-2 border-black/15 bg-white/70 backdrop-blur-sm flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-[#FFE566] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center shrink-0">
                            <Palette className="w-5 h-5 text-black stroke-[2.5]" />
                        </div>
                        <div className="truncate">
                            <h3 className="text-base font-black text-black tracking-tight truncate">
                                Theme & Aesthetics
                            </h3>
                            <p className="text-[11px] text-neutral-600 font-bold truncate">
                                Customize fonts, surfaces & colors
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                        title="Close theme panel"
                    >
                        <X className="w-4 h-4 text-black stroke-[2.5]" />
                    </button>
                </div>

                {/* Scrollable Customization Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-6 no-scrollbar">
                    {/* 1. Header Banner Image */}
                    <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-wider text-black flex items-center justify-between">
                            <span>Form Banner Header</span>
                            <span className="text-[10px] text-neutral-500 font-bold lowercase">Max 10 MB</span>
                        </label>

                        {headerImageUrl ? (
                            <div className="relative rounded-2xl border-2 border-black overflow-hidden shadow-[2.5px_2.5px_0px_#000] group bg-black">
                                <img
                                    src={headerImageUrl}
                                    alt="Form Header"
                                    className="w-full h-28 object-contain"
                                />
                                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                    <label className="px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-neutral-100 transition-transform active:scale-95">
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
                                        className="p-1.5 rounded-xl bg-rose-400 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-rose-500 transition-transform active:scale-95"
                                        title="Remove header image"
                                    >
                                        <Trash2 className="w-4 h-4 stroke-[2.5]" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <label className="border-2 border-dashed border-black hover:bg-amber-100/50 rounded-2xl p-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-white transition-all shadow-[2px_2px_0px_#000]">
                                <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                                <span className="text-xs font-black text-black">
                                    {isUploading ? "Uploading Banner..." : "Upload Header Banner"}
                                </span>
                                <span className="text-[10px] text-neutral-600 font-bold">
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
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Accent Theme Color
                        </label>
                        <div className="grid grid-cols-4 gap-2.5">
                            {ORBIX_ACCENT_PALETTES.map((palette) => {
                                const isSelected = theme.accentColor?.toLowerCase() === palette.value.toLowerCase();
                                return (
                                    <button
                                        key={palette.value}
                                        type="button"
                                        onClick={() => onChangeTheme({ ...theme, accentColor: palette.value })}
                                        className={`h-10 rounded-xl border-2 border-black flex items-center justify-center transition-all cursor-pointer ${
                                            palette.bgClass
                                        } ${
                                            isSelected
                                                ? "shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px] ring-2 ring-black"
                                                : "shadow-[1.5px_1.5px_0px_#000] hover:shadow-[2.5px_2.5px_0px_#000]"
                                        }`}
                                        title={palette.label}
                                    >
                                        {isSelected && (
                                            <Check
                                                className={`w-4 h-4 stroke-[3] ${
                                                    palette.value === "#18181B" ? "text-white" : "text-black"
                                                }`}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 3. Canvas Background Color */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
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
                                        className={`h-9 rounded-xl border-2 border-black flex items-center justify-center cursor-pointer transition-all ${
                                            bg.preview
                                        } ${
                                            isSelected
                                                ? "shadow-[2.5px_2.5px_0px_#000] ring-2 ring-black"
                                                : "shadow-[1px_1px_0px_#000] hover:shadow-[2px_2px_0px_#000]"
                                        }`}
                                        title={bg.label}
                                    >
                                        {isSelected && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 4. Card Surface Tone */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
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
                                        className={`p-2.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer text-center transition-all ${
                                            isSelected
                                                ? "bg-[#FFE566] text-black shadow-[2.5px_2.5px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1px_1px_0px_#000]"
                                        }`}
                                    >
                                        {sf.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 5. Card Elevation */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
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
                                        className={`p-2.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer text-center transition-all ${
                                            isSelected
                                                ? "bg-[#A2FF86] text-black shadow-[2.5px_2.5px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1px_1px_0px_#000]"
                                        }`}
                                        title={sh.desc}
                                    >
                                        {sh.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 6. Button Geometry */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
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
                                        className={`p-2.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer text-center transition-all ${
                                            isSelected
                                                ? "bg-[#C084FC] text-black shadow-[2.5px_2.5px_0px_#000]"
                                                : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1px_1px_0px_#000]"
                                        }`}
                                    >
                                        {b.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* 7. Font Family */}
                    <div className="space-y-2">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Typography Style
                        </label>
                        <div className="space-y-2">
                            {FONT_OPTIONS.map((font) => (
                                <button
                                    key={font.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, fontFamily: font.value })}
                                    className={`w-full text-left p-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-between cursor-pointer transition-all ${
                                        (theme.fontFamily || "sans") === font.value
                                            ? "bg-[#FFE566] text-black shadow-[3px_3px_0px_#000]"
                                            : "bg-white hover:bg-neutral-100 text-neutral-800 shadow-[1.5px_1.5px_0px_#000]"
                                    }`}
                                >
                                    <div>
                                        <span className="block font-black">{font.label}</span>
                                        <span className="text-[10px] text-neutral-600 font-bold block">
                                            {font.sub}
                                        </span>
                                    </div>
                                    {(theme.fontFamily || "sans") === font.value && (
                                        <Check className="w-4 h-4 text-black stroke-[3]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Bottom Actions */}
                <div className="p-4 sm:p-5 border-t-2 border-black/15 bg-white/70 backdrop-blur-sm flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={handleResetTheme}
                        className="p-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px] shrink-0"
                        title="Reset theme defaults"
                    >
                        <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 py-2.5 rounded-xl bg-[#A2FF86] hover:bg-[#8ee673] text-black font-black text-xs border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1.5px_1.5px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[1.5px] active:translate-y-[1.5px] transition-all cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                    >
                        <Sparkles className="w-4 h-4 stroke-[2.5]" />
                        <span>Apply & Close</span>
                    </button>
                </div>
            </aside>
        </div>,
        document.body
    );
};
