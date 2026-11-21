import React, { useState, useRef, useEffect, useId } from "react";
import { Check, Copy, Pipette, Sliders } from "lucide-react";

export interface NeoColorPickerProps {
    value: string;
    onChange: (color: string) => void;
    label?: string;
    disabled?: boolean;
    className?: string;
    showInput?: boolean;
    size?: "sm" | "md";
    placement?: "auto" | "top" | "bottom";
    align?: "auto" | "left" | "right";
    presetColors?: string[];
}

/**
 * Curated Certificate & Orbix Theme Color Palettes
 */
export const CERTIFICATE_PRESET_COLORS = [
    // Classical Certificate & Honors (Diplomas, Seals, Formal Titles)
    { hex: "#000000", name: "Deep Obsidian" },
    { hex: "#0F172A", name: "Slate Midnight" },
    { hex: "#1E3A8A", name: "Imperial Navy" },
    { hex: "#1E293B", name: "Charcoal Steel" },
    { hex: "#312E81", name: "Royal Indigo" },
    { hex: "#581C87", name: "Sovereign Purple" },
    { hex: "#831843", name: "Regal Burgundy" },
    { hex: "#991B1B", name: "Cardinal Crimson" },
    { hex: "#065F46", name: "Emerald Forest" },
    { hex: "#B45309", name: "Warm Bronze" },
    { hex: "#D97706", name: "Lustrous Gold" },
    { hex: "#EAB308", name: "Bright Gold" },
    { hex: "#78350F", name: "Heritage Amber" },
    { hex: "#451A03", name: "Antique Walnut" },

    // Orbix Signature & Modern Vibrants
    { hex: "#FFE566", name: "Orbix Canary" },
    { hex: "#A2FF86", name: "Orbix Mint" },
    { hex: "#38BDF8", name: "Electric Sky" },
    { hex: "#818CF8", name: "Periwinkle" },
    { hex: "#F472B6", name: "Bubblegum" },
    { hex: "#FB7185", name: "Coral Rose" },
    { hex: "#F97316", name: "Vivid Orange" },
    { hex: "#10B981", name: "Emerald Mint" },

    // Monochromes & Parchment Neutrals
    { hex: "#FFFFFF", name: "Pure White" },
    { hex: "#FAF6EE", name: "Orbix Ivory" },
    { hex: "#FFFBEB", name: "Parchment Cream" },
    { hex: "#F1F5F9", name: "Platinum Light" },
    { hex: "#CBD5E1", name: "Soft Silver" },
    { hex: "#94A3B8", name: "Muted Slate" },
    { hex: "#64748B", name: "Cool Graphite" },
    { hex: "#334155", name: "Dark Steel" },
];

/**
 * Color math utilities: HEX <-> HSL <-> RGB
 */
function normalizeHex(input: string): string {
    let clean = input.trim().replace(/^#/, "");
    if (clean.length === 3) {
        clean = clean
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (clean.length === 6 && /^[0-9A-Fa-f]{6}$/.test(clean)) {
        return `#${clean.toUpperCase()}`;
    }
    return input.startsWith("#") ? input.toUpperCase() : `#${input.toUpperCase()}`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    let clean = hex.trim().replace(/^#/, "");
    if (clean.length === 3) {
        clean = clean
            .split("")
            .map((c) => c + c)
            .join("");
    }
    if (clean.length !== 6 || !/^[0-9A-Fa-f]{6}$/.test(clean)) return null;
    return {
        r: parseInt(clean.slice(0, 2), 16),
        g: parseInt(clean.slice(2, 4), 16),
        b: parseInt(clean.slice(4, 6), 16),
    };
}

function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0;
    let s = 0;
    const l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = (g - b) / d + (g < b ? 6 : 0);
                break;
            case g:
                h = (b - r) / d + 2;
                break;
            case b:
                h = (r - g) / d + 4;
                break;
        }
        h /= 6;
    }
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r = 0;
    let g = 0;
    let b = 0;

    if (0 <= h && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (60 <= h && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (120 <= h && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (180 <= h && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (240 <= h && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (300 <= h && h <= 360) {
        r = c;
        g = 0;
        b = x;
    }

    const toHex = (n: number) => {
        const hex = Math.round((n + m) * 255).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/**
 * NeoColorPicker
 * Replaces the raw OS <input type="color"> with Orbix's signature Neo-Brutalist
 * high-contrast color palette, including curated certificate swatches,
 * an interactive spectrum slider, eyedropper support, and live hex input.
 */
export const NeoColorPicker: React.FC<NeoColorPickerProps> = ({
    value,
    onChange,
    label,
    disabled = false,
    className = "",
    showInput = true,
    size = "md",
    placement = "auto",
    align = "auto",
    presetColors,
}) => {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [autoPlacement, setAutoPlacement] = useState<"top" | "bottom">("bottom");
    const [autoAlign, setAutoAlign] = useState<"left" | "right">("right");

    const containerRef = useRef<HTMLDivElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const nativeColorInputRef = useRef<HTMLInputElement>(null);

    // Current normalized hex color
    const currentHex = normalizeHex(value || "#000000");

    // Local HSL state derived from value
    const rgb = hexToRgb(currentHex) || { r: 15, g: 23, b: 42 };
    const { h: initialH, s: initialS, l: initialL } = rgbToHsl(rgb.r, rgb.g, rgb.b);

    const [hue, setHue] = useState<number>(initialH);
    const [sat, setSat] = useState<number>(initialS || 100);
    const [lightness, setLightness] = useState<number>(initialL);

    // Synchronize HSL when value changes from outside
    useEffect(() => {
        const parsedRgb = hexToRgb(currentHex);
        if (parsedRgb) {
            const parsedHsl = rgbToHsl(parsedRgb.r, parsedRgb.g, parsedRgb.b);
            setHue(parsedHsl.h);
            setSat(parsedHsl.s);
            setLightness(parsedHsl.l);
        }
    }, [currentHex]);

    // Compute dynamic popover placement & alignment on open
    useEffect(() => {
        if (!isOpen || !containerRef.current) return;

        const rect = containerRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom;
        const spaceAbove = rect.top;

        if (placement === "auto") {
            setAutoPlacement(spaceBelow < 380 && spaceAbove > spaceBelow ? "top" : "bottom");
        } else {
            setAutoPlacement(placement);
        }

        if (align === "auto") {
            const spaceRight = window.innerWidth - rect.left;
            setAutoAlign(spaceRight < 300 ? "right" : "left");
        } else {
            setAutoAlign(align);
        }
    }, [isOpen, placement, align]);

    // Close on click outside or Escape key
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e: MouseEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node) &&
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("keydown", handleKeyDown);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

    // Palette swatches to display
    const swatches = presetColors
        ? presetColors.map((hex) => ({ hex, name: hex }))
        : CERTIFICATE_PRESET_COLORS;

    // Eyedropper API support check
    const hasEyeDropper = typeof window !== "undefined" && "EyeDropper" in window;

    const handlePickFromScreen = async () => {
        if (!hasEyeDropper) return;
        try {
            const EyeDropperClass = (window as any).EyeDropper;
            const eyeDropper = new EyeDropperClass();
            const result = await eyeDropper.open();
            if (result?.sRGBHex) {
                onChange(normalizeHex(result.sRGBHex));
            }
        } catch {
            // User cancelled eyedropper
        }
    };

    const handleCopy = () => {
        navigator.clipboard?.writeText(currentHex);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };

    const handleHueChange = (newHue: number) => {
        setHue(newHue);
        const nextHex = hslToHex(newHue, Math.max(sat, 30), lightness);
        onChange(nextHex);
    };

    const handleLightnessChange = (newLightness: number) => {
        setLightness(newLightness);
        const nextHex = hslToHex(hue, Math.max(sat, 30), newLightness);
        onChange(nextHex);
    };

    const swatchSizeClasses = {
        sm: "w-7 h-7",
        md: "w-8 h-8",
    }[size];

    return (
        <div ref={containerRef} className={`relative inline-block ${className}`}>
            {label && (
                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                    {label}
                </label>
            )}

            {/* In-Line Trigger Bar */}
            <div className="flex items-center gap-2">
                {/* Visual Color Swatch Button */}
                <button
                    type="button"
                    onClick={() => !disabled && setIsOpen((prev) => !prev)}
                    disabled={disabled}
                    className={`${swatchSizeClasses} rounded-lg border-2 border-black relative overflow-hidden shadow-[2px_2px_0px_#000] cursor-pointer transition-all active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_#000] focus:outline-none focus:ring-2 focus:ring-black/20 shrink-0 ${
                        disabled ? "opacity-50 cursor-not-allowed" : "hover:scale-105"
                    }`}
                    style={{ backgroundColor: currentHex }}
                    title={`Click to open palette (${currentHex})`}
                    aria-label={`Select color, current is ${currentHex}`}
                    aria-expanded={isOpen}
                >
                    {/* Inner subtle diagonal slash if color is white/light */}
                    {(currentHex === "#FFFFFF" || currentHex === "#FAF6EE") && (
                        <div className="absolute inset-0 border-b border-black/15 pointer-events-none" />
                    )}
                </button>

                {/* Hex Text Input */}
                {showInput && (
                    <div className="flex items-center gap-1 flex-1">
                        <input
                            type="text"
                            value={currentHex}
                            onChange={(e) => {
                                const val = e.target.value.trim();
                                if (/^#[0-9A-Fa-f]{0,6}$/.test(val) || /^[0-9A-Fa-f]{0,6}$/.test(val)) {
                                    onChange(val.startsWith("#") ? val.toUpperCase() : `#${val.toUpperCase()}`);
                                }
                            }}
                            onBlur={() => onChange(normalizeHex(currentHex))}
                            disabled={disabled}
                            maxLength={7}
                            placeholder="#000000"
                            className="w-full p-1.5 text-xs font-mono font-bold border-2 border-black rounded-lg bg-white uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-black/20 shadow-[1px_1px_0px_#000]"
                        />

                        {/* Eyedropper Quick Tool */}
                        {hasEyeDropper && (
                            <button
                                type="button"
                                onClick={handlePickFromScreen}
                                disabled={disabled}
                                className="p-1.5 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-[#FFE566] text-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 shrink-0"
                                title="Pick color from screen"
                            >
                                <Pipette className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Neo-Brutalist Color Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    id={`${id}-popover`}
                    className={`absolute z-[150] w-64 sm:w-72 bg-[#FAF6EE] border-3 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-3.5 space-y-3 animate-fadeIn select-none ${
                        autoPlacement === "top" ? "bottom-full mb-2" : "top-full mt-2"
                    } ${autoAlign === "right" ? "right-0" : "left-0"}`}
                >
                    {/* Popover Header with Live Color Preview & Copy */}
                    <div className="flex items-center justify-between gap-2 pb-2 border-b-2 border-black/10">
                        <div className="flex items-center gap-2 min-w-0">
                            <div
                                className="w-7 h-7 rounded-lg border-2 border-black shadow-[1.5px_1.5px_0px_#000] shrink-0"
                                style={{ backgroundColor: currentHex }}
                            />
                            <div className="min-w-0">
                                <span className="text-[11px] font-mono font-black text-black block truncate tracking-wider">
                                    {currentHex}
                                </span>
                                <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider block">
                                    Selected Color
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-1">
                            {hasEyeDropper && (
                                <button
                                    type="button"
                                    onClick={handlePickFromScreen}
                                    className="p-1.5 rounded-lg border border-black bg-white hover:bg-[#FFE566] text-black shadow-[1px_1px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    title="Pick color from screen"
                                >
                                    <Pipette className="w-3.5 h-3.5 stroke-[2.5]" />
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={handleCopy}
                                className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 text-black shadow-[1px_1px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1 text-[10px] font-bold"
                                title="Copy hex code"
                            >
                                {copied ? (
                                    <>
                                        <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                                        <span className="text-emerald-700">Copied</span>
                                    </>
                                ) : (
                                    <Copy className="w-3.5 h-3.5 stroke-[2.5]" />
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Interactive Hue Spectrum Slider */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                                Hue Spectrum
                            </span>
                            <span className="text-[10px] font-mono font-bold text-neutral-500">
                                {hue}°
                            </span>
                        </div>
                        <input
                            type="range"
                            min={0}
                            max={360}
                            value={hue}
                            onChange={(e) => handleHueChange(Number(e.target.value))}
                            className="w-full h-4 rounded-md border-2 border-black appearance-none cursor-pointer shadow-[1px_1px_0px_#000]"
                            style={{
                                background:
                                    "linear-gradient(to right, #FF0000 0%, #FFFF00 17%, #00FF00 33%, #00FFFF 50%, #0000FF 67%, #FF00FF 83%, #FF0000 100%)",
                            }}
                        />
                    </div>

                    {/* Interactive Lightness / Shade Slider */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                                Shade &amp; Lightness
                            </span>
                            <span className="text-[10px] font-mono font-bold text-neutral-500">
                                {lightness}%
                            </span>
                        </div>
                        <input
                            type="range"
                            min={5}
                            max={95}
                            value={lightness}
                            onChange={(e) => handleLightnessChange(Number(e.target.value))}
                            className="w-full h-4 rounded-md border-2 border-black appearance-none cursor-pointer shadow-[1px_1px_0px_#000]"
                            style={{
                                background: `linear-gradient(to right, #000000 0%, hsl(${hue}, 100%, 50%) 50%, #FFFFFF 100%)`,
                            }}
                        />
                    </div>

                    {/* Curated Swatches Section */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold text-neutral-600 uppercase tracking-wider">
                                Curated Swatches
                            </span>
                            <span className="text-[9px] font-bold text-neutral-400">
                                Certificate &amp; Brand
                            </span>
                        </div>

                        <div className="grid grid-cols-7 sm:grid-cols-8 gap-1.5 bg-white p-2 rounded-xl border-2 border-black shadow-[2px_2px_0px_#000] max-h-36 overflow-y-auto">
                            {swatches.map((swatch) => {
                                const isSelected =
                                    currentHex.toLowerCase() === swatch.hex.toLowerCase();
                                const isLight = ["#ffffff", "#faf6ee", "#fffbeb", "#f1f5f9", "#cbd5e1", "#ffe566", "#a2ff86", "#38bdf8"].includes(
                                    swatch.hex.toLowerCase()
                                );

                                return (
                                    <button
                                        key={swatch.hex}
                                        type="button"
                                        onClick={() => {
                                            onChange(swatch.hex);
                                        }}
                                        className={`w-6 h-6 rounded-md border-2 border-black cursor-pointer transition-all flex items-center justify-center shrink-0 ${
                                            isSelected
                                                ? "ring-2 ring-black scale-110 shadow-[1.5px_1.5px_0px_#000]"
                                                : "hover:scale-115 active:translate-x-0.5 active:translate-y-0.5"
                                        }`}
                                        style={{ backgroundColor: swatch.hex }}
                                        title={`${swatch.name} (${swatch.hex})`}
                                    >
                                        {isSelected && (
                                            <Check
                                                className={`w-3 h-3 stroke-[3.5] ${
                                                    isLight ? "text-black" : "text-white"
                                                }`}
                                            />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer with System Picker trigger and Done */}
                    <div className="flex items-center justify-between pt-1 border-t border-black/10">
                        <button
                            type="button"
                            onClick={() => nativeColorInputRef.current?.click()}
                            className="text-[10px] font-bold text-neutral-600 hover:text-black flex items-center gap-1 hover:underline cursor-pointer"
                        >
                            <Sliders className="w-3 h-3" />
                            <span>System Picker...</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="px-2.5 py-1 rounded-lg bg-[#a2ff86] hover:bg-[#8ee673] text-black border border-black text-[10px] font-black shadow-[1px_1px_0px_#000] active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                            Done
                        </button>

                        {/* Hidden Native Picker input for optional OS-level fallback */}
                        <input
                            ref={nativeColorInputRef}
                            type="color"
                            value={currentHex}
                            onChange={(e) => onChange(normalizeHex(e.target.value))}
                            className="sr-only"
                            tabIndex={-1}
                            aria-hidden="true"
                        />
                    </div>
                </div>
            )}
        </div>
    );
};

export default NeoColorPicker;
