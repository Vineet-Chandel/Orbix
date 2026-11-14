/**
 * Orbix Adaptive Image Upload & Editing System — Canvas Utilities
 * High-performance, pixel-perfect image manipulation, cropping, transformation,
 * filtering, temperature tinting, and high-fidelity canvas export utilities.
 */

export interface EditorTransformState {
    zoom: number; // 0.5 to 4.0 (1.0 = 100%)
    pan: { x: number; y: number }; // Pixel offset in viewport/canvas space
    rotation: number; // degrees (-180 to 180)
    flipHorizontal: boolean;
    flipVertical: boolean;

    // Visual adjustments (-100 to +100, 0 = neutral)
    brightness: number;
    contrast: number;
    saturation: number;
    exposure: number;
    temperature: number; // -100 (cool blue) to +100 (warm amber)
    sharpness: number; // 0 to 100
    blur: number; // 0 to 20 px
    grayscale: number; // 0 to 100%

    // Presets & Modes
    filterPreset: "none" | "vivid" | "warm" | "cool" | "dramatic_bw" | "cyber" | "studio";
    fitMode: "cover" | "contain" | "original";
    focalPoint: { x: number; y: number }; // 0% to 100% (default 50%, 50%)

    // Freeform crop bounding box (optional normalized 0..1 coordinates relative to image)
    freeformCrop?: { x: number; y: number; width: number; height: number } | null;

    backgroundColor?: string; // Optional letterbox backdrop color (hex or 'transparent')
}

export const INITIAL_TRANSFORM_STATE: EditorTransformState = {
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    rotation: 0,
    flipHorizontal: false,
    flipVertical: false,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    sharpness: 0,
    blur: 0,
    grayscale: 0,
    filterPreset: "none",
    fitMode: "cover",
    focalPoint: { x: 50, y: 50 },
    freeformCrop: null,
    backgroundColor: "#000000",
};

export interface FilterPresetDefinition {
    id: EditorTransformState["filterPreset"];
    label: string;
    description: string;
    accentColor: string;
    values: Partial<EditorTransformState>;
}

export const FILTER_PRESETS: FilterPresetDefinition[] = [
    {
        id: "none",
        label: "Normal",
        description: "Original unfiltered image",
        accentColor: "#71717A",
        values: {
            brightness: 0,
            contrast: 0,
            saturation: 0,
            exposure: 0,
            temperature: 0,
            grayscale: 0,
            blur: 0,
        },
    },
    {
        id: "vivid",
        label: "Vivid",
        description: "Boosted saturation and rich contrast",
        accentColor: "#F59E0B",
        values: {
            brightness: 4,
            contrast: 18,
            saturation: 32,
            exposure: 6,
            temperature: 8,
            grayscale: 0,
        },
    },
    {
        id: "warm",
        label: "Warm Amber",
        description: "Golden hour glow and gentle warmth",
        accentColor: "#F97316",
        values: {
            brightness: 6,
            contrast: 10,
            saturation: 15,
            exposure: 4,
            temperature: 35,
            grayscale: 0,
        },
    },
    {
        id: "cool",
        label: "Cool Slate",
        description: "Modern Nordic cool blue aesthetic",
        accentColor: "#38BDF8",
        values: {
            brightness: 2,
            contrast: 14,
            saturation: -8,
            exposure: 0,
            temperature: -35,
            grayscale: 0,
        },
    },
    {
        id: "dramatic_bw",
        label: "Noir B&W",
        description: "High-contrast dramatic monochrome",
        accentColor: "#E4E4E7",
        values: {
            brightness: -4,
            contrast: 38,
            saturation: -100,
            exposure: -2,
            temperature: 0,
            grayscale: 100,
        },
    },
    {
        id: "cyber",
        label: "Cyber Neon",
        description: "High-voltage electric saturation & punch",
        accentColor: "#A2FF86",
        values: {
            brightness: 8,
            contrast: 28,
            saturation: 45,
            exposure: 10,
            temperature: -12,
            grayscale: 0,
        },
    },
    {
        id: "studio",
        label: "Studio Punch",
        description: "Clean commercial clarity with enhanced sharpness",
        accentColor: "#FFE566",
        values: {
            brightness: 8,
            contrast: 20,
            saturation: 12,
            exposure: 6,
            temperature: 4,
            sharpness: 25,
            grayscale: 0,
        },
    },
];

/**
 * Loads an HTMLImageElement safely from a File, Blob, or URL string.
 * Converts File/Blob to persistent Data URLs so they never expire or suffer from revoked object URLs.
 */
export function loadImageElement(source: string | File | Blob): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        // Case A: File or Blob - Read as Data URL to guarantee persistence and eliminate CORS issues
        if (typeof source !== "string") {
            const reader = new FileReader();
            reader.onload = () => {
                const dataUrl = reader.result as string;
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error("Failed to decode image from selected file."));
                img.src = dataUrl;
            };
            reader.onerror = () => reject(new Error("Failed to read file from disk."));
            reader.readAsDataURL(source);
            return;
        }

        // Case B: String URL or Data URL
        const img = new Image();
        if (!source.startsWith("data:") && !source.startsWith("blob:")) {
            img.crossOrigin = "anonymous";
        }
        img.onload = () => resolve(img);
        img.onerror = () => {
            // If crossOrigin failed on external CDN, retry without crossOrigin so it still displays
            if (img.crossOrigin) {
                const fallbackImg = new Image();
                fallbackImg.onload = () => resolve(fallbackImg);
                fallbackImg.onerror = () => reject(new Error("Failed to load image from URL."));
                fallbackImg.src = source;
            } else {
                reject(new Error("Failed to load image from URL."));
            }
        };
        img.src = source;
    });
}

/**
 * Computes standard CSS filter string from transform state.
 */
export function getTransformFilterCss(transform: EditorTransformState): string {
    const bVal = Math.max(0, 100 + transform.brightness + transform.exposure * 0.5);
    const cVal = Math.max(0, 100 + transform.contrast);
    const sVal = Math.max(0, 100 + transform.saturation);
    const gVal = Math.max(0, Math.min(100, transform.grayscale));
    const blurPx = Math.max(0, transform.blur);

    let filterStr = `brightness(${bVal}%) contrast(${cVal}%) saturate(${sVal}%)`;
    if (gVal > 0) filterStr += ` grayscale(${gVal}%)`;
    if (blurPx > 0) filterStr += ` blur(${blurPx}px)`;

    return filterStr;
}

/**
 * Computes Temperature / Warmth tint color for overlay layer.
 */
export function getTemperatureOverlayColor(temperature: number): string | null {
    if (temperature === 0) return null;
    if (temperature > 0) {
        // Warm Amber
        const alpha = Math.min(0.45, (temperature / 100) * 0.4);
        return `rgba(255, 145, 0, ${alpha.toFixed(3)})`;
    } else {
        // Cool Blue
        const alpha = Math.min(0.45, (Math.abs(temperature) / 100) * 0.4);
        return `rgba(0, 160, 255, ${alpha.toFixed(3)})`;
    }
}

/**
 * Renders the transformed image to an offscreen canvas and exports a Blob / File.
 */
export async function renderTransformedImageToBlob(
    image: HTMLImageElement,
    transform: EditorTransformState,
    cropBoxOnScreen: { width: number; height: number },
    outputWidth: number,
    outputHeight: number,
    mimeType: "image/webp" | "image/png" | "image/jpeg" = "image/webp",
    quality: number = 0.92,
    fileName: string = "orbix_framed_image"
): Promise<{ blob: Blob; file: File; dataUrl: string }> {
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) throw new Error("Could not initialize 2D canvas context.");

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    // 1. Fill background if specified and not transparent
    const isPng = mimeType === "image/png";
    const bg = transform.backgroundColor;
    if (bg && bg !== "transparent") {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, outputWidth, outputHeight);
    } else if (!isPng) {
        // Non-PNG formats do not support transparency; default to pitch black
        ctx.fillStyle = "#000000";
        ctx.fillRect(0, 0, outputWidth, outputHeight);
    }

    // 2. Set Canvas filters
    ctx.filter = getTransformFilterCss(transform);

    // 3. Transformations: Center origin
    ctx.save();
    ctx.translate(outputWidth / 2, outputHeight / 2);

    if (transform.rotation !== 0) {
        ctx.rotate((transform.rotation * Math.PI) / 180);
    }

    const scaleX = transform.flipHorizontal ? -1 : 1;
    const scaleY = transform.flipVertical ? -1 : 1;
    ctx.scale(scaleX, scaleY);

    // Compute display dimensions matching AdaptiveImageCropper
    const natW = image.naturalWidth || 600;
    const natH = image.naturalHeight || 600;
    const imgAspect = natW / natH;
    const screenW = cropBoxOnScreen.width || outputWidth;
    const screenH = cropBoxOnScreen.height || outputHeight;

    let baseDisplayW = screenW;
    let baseDisplayH = baseDisplayW / imgAspect;

    if (transform.fitMode === "cover") {
        if (baseDisplayH < screenH) {
            baseDisplayH = screenH;
            baseDisplayW = baseDisplayH * imgAspect;
        }
    } else if (transform.fitMode === "contain") {
        if (baseDisplayH > screenH) {
            baseDisplayH = screenH;
            baseDisplayW = baseDisplayH * imgAspect;
        }
    } else {
        baseDisplayW = Math.min(screenW, natW);
        baseDisplayH = baseDisplayW / imgAspect;
    }

    // Ratio from screen cropbox to output canvas
    const scaleFactor = outputWidth / screenW;
    const drawW = baseDisplayW * transform.zoom * scaleFactor;
    const drawH = baseDisplayH * transform.zoom * scaleFactor;
    const drawX = -drawW / 2 + transform.pan.x * scaleFactor;
    const drawY = -drawH / 2 + transform.pan.y * scaleFactor;

    ctx.drawImage(image, drawX, drawY, drawW, drawH);

    ctx.restore();

    // 4. Warmth / Temperature Tint Overlay
    if (transform.temperature !== 0) {
        const tint = getTemperatureOverlayColor(transform.temperature);
        if (tint) {
            ctx.save();
            ctx.globalCompositeOperation = "color";
            ctx.fillStyle = tint;
            ctx.fillRect(0, 0, outputWidth, outputHeight);
            ctx.restore();
        }
    }

    // 5. Export to Blob and File
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    reject(new Error("Canvas blob conversion failed."));
                    return;
                }
                const ext = mimeType === "image/png" ? "png" : mimeType === "image/jpeg" ? "jpg" : "webp";
                const cleanFileName = `${fileName.replace(/\.[^/.]+$/, "")}.${ext}`;
                const file = new File([blob], cleanFileName, { type: mimeType, lastModified: Date.now() });
                const dataUrl = canvas.toDataURL(mimeType, quality);
                resolve({ blob, file, dataUrl });
            },
            mimeType,
            quality
        );
    });
}
