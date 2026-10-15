import { v2 as cloudinary, type UploadApiResponse, type ResourceApiResponse } from "cloudinary";

/**
 * Supported profile photo image formats
 */
export const ALLOWED_PHOTO_FORMATS = ["jpg", "jpeg", "png", "webp"] as const;
export type AllowedPhotoFormat = (typeof ALLOWED_PHOTO_FORMATS)[number];

export const DEFAULT_AVATAR_FOLDER = process.env.CLOUDINARY_AVATAR_FOLDER || "orbix/avatars";
export const DEFAULT_AVATAR_MAX_BYTES = parseInt(process.env.CLOUDINARY_AVATAR_MAX_BYTES || "5242880", 10); // 5 MB default

/**
 * Returns true if all essential Cloudinary credentials are configured
 */
export function isCloudinaryConfigured(): boolean {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    return Boolean(cloudName && apiKey && apiSecret);
}

/**
 * Validates Cloudinary configuration and throws a clear error if missing
 */
export function assertCloudinaryConfigured(): {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    folder: string;
    maxBytes: number;
} {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

    if (!cloudName || !apiKey || !apiSecret) {
        throw new Error(
            "Cloudinary is not properly configured. Missing required environment variables: " +
            [!cloudName && "CLOUDINARY_CLOUD_NAME", !apiKey && "CLOUDINARY_API_KEY", !apiSecret && "CLOUDINARY_API_SECRET"]
                .filter(Boolean)
                .join(", ")
        );
    }

    // Configure Cloudinary SDK singleton instance
    cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
    });

    return {
        cloudName,
        apiKey,
        apiSecret,
        folder: DEFAULT_AVATAR_FOLDER,
        maxBytes: DEFAULT_AVATAR_MAX_BYTES,
    };
}

/**
 * Generate a canonical, highly optimized HTTPS delivery URL with face-aware cropping
 */
export function getOptimizedAvatarUrl(publicId: string, version?: number | string): string {
    const { cloudName } = assertCloudinaryConfigured();
    // Return transformed URL: 256x256, fill crop, face gravity, auto format, auto quality
    return cloudinary.url(publicId, {
        secure: true,
        version: version ? String(version) : undefined,
        transformation: [
            {
                width: 256,
                height: 256,
                crop: "fill",
                gravity: "face",
            },
            {
                fetch_format: "auto",
                quality: "auto",
            },
        ],
    });
}

/**
 * Safely delete an asset from Cloudinary by public ID
 */
export async function destroyCloudinaryAsset(publicId: string): Promise<boolean> {
    if (!publicId || !isCloudinaryConfigured()) return false;
    try {
        assertCloudinaryConfigured();
        const result = await cloudinary.uploader.destroy(publicId, {
            invalidate: true,
            resource_type: "image",
        });
        return result?.result === "ok" || result?.result === "not found";
    } catch (err: any) {
        console.warn(`[Cloudinary Cleanup] Failed to destroy asset ${publicId}:`, err?.message || err);
        return false;
    }
}

/**
 * Fetch and verify asset metadata from Cloudinary Admin API
 */
export async function getCloudinaryAsset(publicId: string): Promise<any> {
    assertCloudinaryConfigured();
    return await cloudinary.api.resource(publicId, {
        resource_type: "image",
        image_metadata: true,
    });
}

export { cloudinary };
