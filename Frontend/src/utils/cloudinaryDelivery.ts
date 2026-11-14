/**
 * Cloudinary Delivery & Performance Optimization Helper
 * Ensures responsive dimensions, modern formats (WebP/AVIF via f_auto), dynamic compression (q_auto),
 * responsive srcset generation, and focal gravity delivery.
 * Eliminates downloading multi-megabyte raw assets when displaying thumbnails or previews.
 */

export interface CloudinaryTransformOptions {
    width?: number;
    height?: number;
    crop?: "fill" | "limit" | "fit" | "thumb" | "scale" | "lfill" | "mfit";
    quality?: "auto" | "auto:good" | "auto:eco" | "auto:low" | number;
    format?: "auto" | "webp" | "avif" | "png" | "jpg";
    gravity?: "auto" | "face" | "center" | "north" | "south" | "east" | "west" | string;
    dpr?: number | "auto";
}

/**
 * Injects responsive dimensions and delivery transformations (f_auto, q_auto) into Cloudinary URLs.
 * If the URL is not a Cloudinary URL or is already transformed, returns it safely.
 */
export function getOptimizedCloudinaryUrl(
    url: string | null | undefined,
    options?: CloudinaryTransformOptions
): string {
    if (!url || typeof url !== "string") return "";

    // If not hosted on Cloudinary, return original URL
    if (!url.includes("res.cloudinary.com") || !url.includes("/image/upload/")) {
        return url;
    }

    const {
        width,
        height,
        crop = width && height ? "fill" : "limit",
        quality = "auto",
        format = "auto",
        gravity,
        dpr = "auto",
    } = options || {};

    const transforms: string[] = [`f_${format}`, `q_${quality}`];
    if (dpr) transforms.push(`dpr_${dpr}`);
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (crop) transforms.push(`c_${crop}`);
    if (gravity) transforms.push(`g_${gravity}`);

    const transformStr = transforms.join(",");

    // Locate upload segment
    const uploadMarker = "/image/upload/";
    const uploadIndex = url.indexOf(uploadMarker);
    if (uploadIndex === -1) return url;

    const prefix = url.substring(0, uploadIndex + uploadMarker.length);
    const suffix = url.substring(uploadIndex + uploadMarker.length);

    // If already contains transformation flags right after upload, prevent duplicating
    if (suffix.startsWith("f_") || suffix.startsWith("w_") || suffix.startsWith("q_")) {
        return url;
    }

    return `${prefix}${transformStr}/${suffix}`;
}

/**
 * Generates an HTML srcset string for responsive <img> or <picture> elements.
 * e.g. "url_320 320w, url_640 640w, url_1200 1200w"
 */
export function getCloudinarySrcSet(
    url: string | null | undefined,
    widths: number[] = [320, 640, 960, 1200, 1600],
    options?: Omit<CloudinaryTransformOptions, "width">
): string {
    if (!url) return "";
    return widths
        .map((w) => `${getOptimizedCloudinaryUrl(url, { ...options, width: w })} ${w}w`)
        .join(", ");
}

/**
 * Optimized header banner delivery (standard 1200px max width with q_auto, f_auto)
 */
export function getCloudinaryBannerUrl(url?: string | null): string {
    return getOptimizedCloudinaryUrl(url, { width: 1200, crop: "limit", quality: "auto" });
}

/**
 * Optimized Event Banner delivery matching Orbix 2.4:1 aspect ratio
 */
export function getCloudinaryEventBannerUrl(
    url?: string | null,
    variant: "card" | "hero" | "pass" = "hero"
): string {
    if (variant === "card") {
        return getOptimizedCloudinaryUrl(url, { width: 640, height: 266, crop: "fit", quality: "auto" });
    }
    if (variant === "pass") {
        return getOptimizedCloudinaryUrl(url, { width: 480, height: 200, crop: "fit", quality: "auto" });
    }
    return getOptimizedCloudinaryUrl(url, { width: 1440, height: 600, crop: "fit", quality: "auto" });
}

/**
 * Optimized Club Header Banner delivery (2.6:1 wide hero)
 */
export function getCloudinaryClubBannerUrl(
    url?: string | null,
    breakpoint: "mobile" | "desktop" = "desktop"
): string {
    const width = breakpoint === "mobile" ? 640 : 1440;
    const height = breakpoint === "mobile" ? 246 : 553;
    return getOptimizedCloudinaryUrl(url, { width, height, crop: "fill", quality: "auto", gravity: "auto" });
}

/**
 * Optimized thumbnail delivery for cards and lists (300px max width)
 */
export function getCloudinaryThumbnailUrl(url?: string | null, size = 300): string {
    return getOptimizedCloudinaryUrl(url, { width: size, height: size, crop: "fill", quality: "auto" });
}

/**
 * Optimized avatar delivery with automatic facial gravity detection (g_face)
 */
export function getCloudinaryAvatarUrl(url?: string | null, size = 160): string {
    return getOptimizedCloudinaryUrl(url, {
        width: size,
        height: size,
        crop: "thumb",
        gravity: "face",
        quality: "auto",
    });
}
