/**
 * Cloudinary Delivery & Performance Optimization Helper
 * Ensures responsive dimensions, modern formats (WebP/AVIF via f_auto), and dynamic compression (q_auto).
 * Eliminates downloading multi-megabyte raw assets when displaying thumbnails or previews.
 */

export interface CloudinaryTransformOptions {
    width?: number;
    height?: number;
    crop?: "fill" | "limit" | "fit" | "thumb" | "scale";
    quality?: "auto" | "auto:good" | "auto:eco" | "auto:low" | number;
    format?: "auto" | "webp" | "avif" | "png" | "jpg";
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
    } = options || {};

    const transforms: string[] = [`f_${format}`, `q_${quality}`];
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (width || height) transforms.push(`c_${crop}`);

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
 * Optimized header banner delivery (standard 1200px max width with q_auto, f_auto)
 */
export function getCloudinaryBannerUrl(url?: string | null): string {
    return getOptimizedCloudinaryUrl(url, { width: 1200, crop: "limit", quality: "auto" });
}

/**
 * Optimized thumbnail delivery for cards and lists (300px max width)
 */
export function getCloudinaryThumbnailUrl(url?: string | null, size = 300): string {
    return getOptimizedCloudinaryUrl(url, { width: size, height: size, crop: "fill", quality: "auto" });
}

/**
 * Optimized avatar delivery (150px square crop)
 */
export function getCloudinaryAvatarUrl(url?: string | null): string {
    return getOptimizedCloudinaryUrl(url, { width: 150, height: 150, crop: "thumb", quality: "auto" });
}
