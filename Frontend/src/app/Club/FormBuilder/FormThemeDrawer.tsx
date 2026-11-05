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
        <div className="fixed inset-y-0 right-0 w-full sm:w-96 bg-white border-l-2 border-black shadow-[-6px_0px_0px_#000] z-50 p-6 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-200">
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between border-b-2 border-black/10 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-[#FFE566] border border-black shadow-[2px_2px_0px_#000]">
                            <Palette className="w-5 h-5 text-black" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-black">Theme & Aesthetics</h3>
                            <p className="text-[11px] text-neutral-500 font-medium">
                                Customize fonts, surfaces, and colors
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl border border-black hover:bg-neutral-100 cursor-pointer shadow-[1px_1px_0px_#000]"
                    >
                        <X className="w-4 h-4 text-black" />
                    </button>
                </div>

                {/* 1. Header Banner Image */}
                <div className="space-y-2.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-black flex items-center justify-between">
                        <span>Form Banner Header</span>
                        <span className="text-[10px] text-neutral-500 font-bold lowercase">Cloudinary</span>
                    </label>

                    {headerImageUrl ? (
                        <div className="relative rounded-2xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000] group">
                            <img
                                src={headerImageUrl}
                                alt="Form Header"
                                className="w-full h-28 object-cover"
                            />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                                <label className="px-3 py-1.5 rounded-xl bg-white text-black font-black text-xs border border-black shadow cursor-pointer hover:bg-neutral-100">
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
                                    className="p-1.5 rounded-xl bg-rose-500 text-white border border-black shadow cursor-pointer hover:bg-rose-600"
                                    title="Remove header image"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <label className="border-2 border-dashed border-black/40 hover:border-black rounded-2xl p-5 flex flex-col items-center justify-center gap-1.5 cursor-pointer bg-neutral-50 hover:bg-neutral-100 transition-colors">
                            <UploadCloud className="w-6 h-6 text-neutral-600" />
                            <span className="text-xs font-black text-black">
                                {isUploading ? "Uploading to Cloudinary..." : "Upload Header Banner"}
                            </span>
                            <span className="text-[10px] text-neutral-500 font-medium">
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
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
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
                                    className={`h-10 rounded-xl border-2 border-black flex items-center justify-center transition-transform active:scale-95 cursor-pointer ${
                                        palette.bgClass
                                    } ${isSelected ? "shadow-[2px_2px_0px_#000] ring-2 ring-black" : ""}`}
                                    title={palette.label}
                                >
                                    {isSelected && (
                                        <Check
                                            className={`w-4 h-4 stroke-[3] ${
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
                                    className={`h-9 rounded-xl border-2 border-black flex items-center justify-center cursor-pointer transition-transform active:scale-95 ${
                                        bg.preview
                                    } ${isSelected ? "shadow-[2px_2px_0px_#000] ring-2 ring-black" : ""}`}
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
                                    className={`p-2 rounded-xl border-2 border-black text-[11px] font-black cursor-pointer text-center ${
                                        isSelected ? "bg-black text-white shadow-[2px_2px_0px_#000]" : "bg-white text-black hover:bg-neutral-50"
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
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Neo Card Shadow
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {SHADOW_STYLES.map((sh) => {
                            const isSelected = (theme.cardShadowStyle || "crisp") === sh.value;
                            return (
                                <button
                                    key={sh.value}
                                    type="button"
                                    onClick={() => onChangeTheme({ ...theme, cardShadowStyle: sh.value })}
                                    className={`p-2 rounded-xl border-2 border-black text-[11px] font-black cursor-pointer text-center ${
                                        isSelected ? "bg-black text-white shadow-[2px_2px_0px_#000]" : "bg-white text-black hover:bg-neutral-50"
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
                                    className={`p-2 rounded-xl border-2 border-black text-[11px] font-black cursor-pointer text-center ${
                                        isSelected ? "bg-black text-white shadow-[2px_2px_0px_#000]" : "bg-white text-black hover:bg-neutral-50"
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
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        Typography Style
                    </label>
                    <div className="space-y-2">
                        {FONT_OPTIONS.map((font) => (
                            <button
                                key={font.value}
                                type="button"
                                onClick={() => onChangeTheme({ ...theme, fontFamily: font.value })}
                                className={`w-full text-left p-3 rounded-xl border-2 border-black font-black text-xs flex items-center justify-between cursor-pointer transition-colors ${
                                    (theme.fontFamily || "sans") === font.value
                                        ? "bg-neutral-100 shadow-[2px_2px_0px_#000]"
                                        : "bg-white hover:bg-neutral-50"
                                }`}
                            >
                                <div>
                                    <span className="block">{font.label}</span>
                                    <span className="text-[10px] text-neutral-500 font-medium block">
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

            <div className="pt-6 border-t-2 border-black/10 mt-6">
                <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-2.5 rounded-xl bg-black text-white font-black text-xs hover:bg-neutral-800 transition-colors shadow-[2px_2px_0px_#000] cursor-pointer flex items-center justify-center gap-1.5"
                >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Apply Theme</span>
                </button>
            </div>
        </div>
    );
};
