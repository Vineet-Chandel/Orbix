export interface PublicProfilePlatform {
    portal: string;
    portalUsername: string;
    link: string;
    verified: boolean;
    displayName?: string;
    avatarUrl?: string;
    stats: Array<{ label: string; value: string }>;
    isPublic: boolean;
    lastSyncStatus?: string;
    lastSyncAt?: string;
}

export interface PublicProfileData {
    id?: string;
    username: string;
    displayName: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    photoUrl?: string | null;
    previousPhotoUrl?: string | null;
    coverImageUrl?: string;
    headline?: string;
    bio?: string;
    website?: string;
    location?: string;
    skills?: string[];
    isPublic: boolean;
    createdAt?: string;
    isOwner: boolean;
    platforms: PublicProfilePlatform[];
}

// In-memory client-side cache for public profile requests (5 minutes freshness)
const publicProfileCache = new Map<string, { data: PublicProfileData; timestamp: number }>();
const inFlightRequests = new Map<string, Promise<PublicProfileData>>();
const CLIENT_CACHE_TTL_MS = 5 * 60 * 1000;

export const invalidatePublicProfileClientCache = (username?: string) => {
    if (username) {
        publicProfileCache.delete(username.toLowerCase().trim());
    } else {
        publicProfileCache.clear();
    }
};

/**
 * Fetch public profile by username with client-side caching & request deduplication
 */
export async function fetchPublicProfile(username: string, force = false): Promise<PublicProfileData> {
    const key = username.toLowerCase().trim();

    // Check client-side memory cache if not forced
    if (!force) {
        const cached = publicProfileCache.get(key);
        if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL_MS) {
            return cached.data;
        }
    }

    // Deduplicate in-flight requests
    if (inFlightRequests.has(key)) {
        return inFlightRequests.get(key)!;
    }

    const requestPromise = (async () => {
        const endpoints = [
            `/api/profile/public/${encodeURIComponent(key)}`,
            `http://localhost:3000/api/profile/public/${encodeURIComponent(key)}`,
            `/profile/public/${encodeURIComponent(key)}`,
        ];

        let lastError = "Unable to fetch profile";

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                });

                if (response.ok) {
                    const json = await response.json();
                    if (json.success && json.profile) {
                        const profile = json.profile as PublicProfileData;
                        publicProfileCache.set(key, { data: profile, timestamp: Date.now() });
                        return profile;
                    }
                } else if (response.status === 404) {
                    const errJson = await response.json().catch(() => null);
                    throw new Error(errJson?.message || "Profile not found or is private.");
                }
            } catch (err: any) {
                if (err.message.includes("not found") || err.message.includes("private")) {
                    throw err;
                }
                lastError = err?.message || lastError;
            }
        }

        throw new Error(lastError);
    })();

    inFlightRequests.set(key, requestPromise);

    try {
        const result = await requestPromise;
        return result;
    } finally {
        inFlightRequests.delete(key);
    }
}

/**
 * Update authenticated user's profile details
 */
export async function updateProfile(payload: {
    firstName?: string;
    lastName?: string;
    headline?: string;
    bio?: string;
    avatarUrl?: string;
    coverImageUrl?: string;
    website?: string;
    location?: string;
    skills?: string[];
    isPublic?: boolean;
}): Promise<any> {
    const endpoints = ["/api/profile", "http://localhost:3000/api/profile"];
    let lastError = "Failed to update profile";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json.user;
            } else {
                const errJson = await response.json().catch(() => null);
                throw new Error(errJson?.message || "Failed to update profile");
            }
        } catch (err: any) {
            lastError = err.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Disconnect a platform
 */
export async function disconnectPlatform(portal: string): Promise<boolean> {
    const endpoints = [
        `/api/portals/${portal}`,
        `http://localhost:3000/api/portals/${portal}`,
        `/api/profile/platforms/${portal}`,
        `http://localhost:3000/api/profile/platforms/${portal}`,
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (response.ok) {
                invalidatePublicProfileClientCache();
                return true;
            }
        } catch {
            // continue
        }
    }

    throw new Error(`Failed to disconnect ${portal}`);
}

/**
 * Edit a platform handle / link
 */
export async function editPlatformHandle(portal: string, handleOrLink: string): Promise<any> {
    const endpoints = [
        `/api/portals/${portal}`,
        `http://localhost:3000/api/portals/${portal}`,
        `/api/profile/platforms/${portal}`,
        `http://localhost:3000/api/profile/platforms/${portal}`,
    ];

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ handle: handleOrLink }),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json.platform;
            }
        } catch {
            // continue
        }
    }

    throw new Error(`Failed to update ${portal}`);
}

/**
 * Cloudinary Direct Upload Configuration returned by server
 */
export interface PhotoUploadConfig {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    publicId: string;
    folder: string;
    uploadUrl: string;
    maxBytes: number;
    allowedFormats: string[];
}

export interface PhotoOperationResult {
    success: boolean;
    message: string;
    photoUrl: string | null;
    hasPreviousPhoto: boolean;
    previousPhotoUrl?: string | null;
}

/**
 * Step A: Request signed direct upload configuration from backend
 */
export async function requestPhotoUploadSignature(): Promise<PhotoUploadConfig> {
    const endpoints = [
        "/api/profile/photo/upload-signature",
        "http://localhost:3000/api/profile/photo/upload-signature",
        "/profile/photo/upload-signature",
    ];

    let lastError = "Unable to request upload signature";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (response.ok) {
                const json = await response.json();
                if (json.success && json.uploadConfig) {
                    return json.uploadConfig as PhotoUploadConfig;
                }
            } else {
                const errJson = await response.json().catch(() => null);
                lastError = errJson?.message || `Error (${response.status}): ${response.statusText}`;
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Step B: Upload image file directly from browser to Cloudinary
 */
export function uploadPhotoToCloudinary(
    config: PhotoUploadConfig,
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ publicId: string; version?: number; secureUrl: string }> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener("progress", (event) => {
            if (event.lengthComputable && onProgress) {
                const percent = Math.round((event.loaded / event.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener("load", () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    resolve({
                        publicId: response.public_id || config.publicId,
                        version: response.version,
                        secureUrl: response.secure_url,
                    });
                } catch {
                    reject(new Error("Failed to parse Cloudinary response."));
                }
            } else {
                try {
                    const errRes = JSON.parse(xhr.responseText);
                    reject(new Error(errRes.error?.message || "Cloudinary direct upload failed."));
                } catch {
                    reject(new Error(`Upload failed with HTTP ${xhr.status}`));
                }
            }
        });

        xhr.addEventListener("error", () => {
            reject(new Error("Network connection lost during upload. Please check your connection and try again."));
        });

        xhr.addEventListener("abort", () => {
            reject(new Error("Upload was cancelled."));
        });

        const formData = new FormData();
        formData.append("file", file);
        formData.append("api_key", config.apiKey);
        formData.append("timestamp", String(config.timestamp));
        formData.append("signature", config.signature);
        formData.append("public_id", config.publicId);
        formData.append("folder", config.folder);
        formData.append("overwrite", "true");

        xhr.open("POST", config.uploadUrl, true);
        xhr.send(formData);
    });
}

/**
 * Step C: Confirm verified upload and persist to database
 */
export async function confirmPhotoUpload(publicId: string, version?: number): Promise<PhotoOperationResult> {
    const endpoints = [
        "/api/profile/photo/confirm",
        "http://localhost:3000/api/profile/photo/confirm",
        "/profile/photo/confirm",
    ];

    let lastError = "Unable to confirm photo update";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ publicId, version }),
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json as PhotoOperationResult;
            } else {
                const errJson = await response.json().catch(() => null);
                lastError = errJson?.message || `Server error (${response.status})`;
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Restore previous profile photo
 */
export async function restorePreviousPhoto(): Promise<PhotoOperationResult> {
    const endpoints = [
        "/api/profile/photo/restore",
        "http://localhost:3000/api/profile/photo/restore",
        "/profile/photo/restore",
    ];

    let lastError = "Unable to restore previous photo";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json as PhotoOperationResult;
            } else {
                const errJson = await response.json().catch(() => null);
                lastError = errJson?.message || `Error (${response.status})`;
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
        }
    }

    throw new Error(lastError);
}

/**
 * Reset to application default avatar
 */
export async function useDefaultAvatar(): Promise<PhotoOperationResult> {
    const endpoints = [
        "/api/profile/photo/default",
        "http://localhost:3000/api/profile/photo/default",
        "/profile/photo/default",
    ];

    let lastError = "Unable to set default avatar";

    for (const url of endpoints) {
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (response.ok) {
                const json = await response.json();
                invalidatePublicProfileClientCache();
                return json as PhotoOperationResult;
            } else {
                const errJson = await response.json().catch(() => null);
                lastError = errJson?.message || `Error (${response.status})`;
            }
        } catch (err: any) {
            lastError = err?.message || lastError;
        }
    }

    throw new Error(lastError);
}

