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
 * Common helper to attach authentication tokens and JSON content headers
 */
function getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
        const token = localStorage.getItem("orbix_token");
        if (token) {
            headers["Authorization"] = `Bearer ${token}`;
        }
    }
    return headers;
}

/**
 * Robust API fetch wrapper:
 * - Uses Vite proxy path (/api/...) and direct backend fallback (http://localhost:3000/api/...)
 * - Attaches auth credentials
 * - Immediately returns or throws authoritative backend errors (401, 403, 429, 500) without masking
 */
async function apiFetch<T = any>(
    path: string,
    options: RequestInit = {}
): Promise<T> {
    const cleanPath = path.startsWith("/api") ? path : `/api${path}`;
    const endpoints = [
        cleanPath,
        `http://localhost:3000${cleanPath}`,
    ];

    let lastError = "Request failed";

    for (const url of endpoints) {
        let response: Response;
        try {
            response = await fetch(url, {
                ...options,
                headers: {
                    ...getAuthHeaders(),
                    ...(options.headers || {}),
                },
                credentials: "include",
            });
        } catch (netErr: any) {
            lastError = netErr?.message || "Network request failed";
            continue; // Fall back to direct backend port if network/proxy failed
        }

        if (response.ok) {
            const json = await response.json().catch(() => ({}));
            return json as T;
        }

        // Authoritative server response: do NOT try subsequent endpoints and mask error
        const errJson = await response.json().catch(() => null);
        const errMsg =
            errJson?.message ||
            errJson?.error ||
            (response.status === 401
                ? "Authentication required. Please log in."
                : `Server returned error (${response.status}): ${response.statusText}`);
        throw new Error(errMsg);
    }

    throw new Error(lastError);
}

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
        const encodedKey = encodeURIComponent(key);
        const endpoints = [
            `/api/profile/public/${encodedKey}`,
            `http://localhost:3000/api/profile/public/${encodedKey}`,
        ];

        let lastError = "Unable to fetch profile";

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: getAuthHeaders(),
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
                } else {
                    const errJson = await response.json().catch(() => null);
                    throw new Error(errJson?.message || `Error (${response.status})`);
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
    const json = await apiFetch<{ success: boolean; user: any }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    invalidatePublicProfileClientCache();
    return json.user;
}

/**
 * Disconnect a platform
 */
export async function disconnectPlatform(portal: string): Promise<boolean> {
    try {
        await apiFetch(`/api/portals/${portal}`, {
            method: "DELETE",
        });
        invalidatePublicProfileClientCache();
        return true;
    } catch {
        await apiFetch(`/api/profile/platforms/${portal}`, {
            method: "DELETE",
        });
        invalidatePublicProfileClientCache();
        return true;
    }
}

/**
 * Edit a platform handle / link
 */
export async function editPlatformHandle(portal: string, handleOrLink: string): Promise<any> {
    try {
        const json = await apiFetch<{ platform: any }>(`/api/portals/${portal}`, {
            method: "PUT",
            body: JSON.stringify({ handle: handleOrLink }),
        });
        invalidatePublicProfileClientCache();
        return json.platform;
    } catch {
        const json = await apiFetch<{ platform: any }>(`/api/profile/platforms/${portal}`, {
            method: "PUT",
            body: JSON.stringify({ handle: handleOrLink }),
        });
        invalidatePublicProfileClientCache();
        return json.platform;
    }
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
    const json = await apiFetch<{ success: boolean; uploadConfig: PhotoUploadConfig }>(
        "/api/profile/photo/upload-signature",
        {
            method: "POST",
        }
    );

    if (!json.uploadConfig) {
        throw new Error("Invalid signature response from server.");
    }

    return json.uploadConfig;
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
                    const rawMsg = errRes.error?.message || `Upload failed with HTTP ${xhr.status}`;
                    if (rawMsg.toLowerCase().includes("invalid signature")) {
                        reject(new Error("Cloudinary API Secret mismatch. Please verify that CLOUDINARY_API_SECRET in Backend/.env matches your Cloudinary Console API Secret."));
                    } else {
                        reject(new Error(rawMsg));
                    }
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
        if (config.folder && !config.publicId.startsWith(`${config.folder}/`)) {
            formData.append("folder", config.folder);
        }
        formData.append("overwrite", "true");

        xhr.open("POST", config.uploadUrl, true);
        xhr.send(formData);
    });
}

/**
 * Step C: Confirm verified upload and persist to database
 */
export async function confirmPhotoUpload(publicId: string, version?: number): Promise<PhotoOperationResult> {
    const json = await apiFetch<PhotoOperationResult>(
        "/api/profile/photo/confirm",
        {
            method: "POST",
            body: JSON.stringify({ publicId, version }),
        }
    );
    invalidatePublicProfileClientCache();
    return json;
}

/**
 * Restore previous profile photo
 */
export async function restorePreviousPhoto(): Promise<PhotoOperationResult> {
    const json = await apiFetch<PhotoOperationResult>(
        "/api/profile/photo/restore",
        {
            method: "POST",
        }
    );
    invalidatePublicProfileClientCache();
    return json;
}

/**
 * Reset to application default avatar
 */
export async function useDefaultAvatar(): Promise<PhotoOperationResult> {
    const json = await apiFetch<PhotoOperationResult>(
        "/api/profile/photo/default",
        {
            method: "POST",
        }
    );
    invalidatePublicProfileClientCache();
    return json;
}

