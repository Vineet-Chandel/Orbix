import { demoPublicProfile, isDemoProfileUsername } from "../data/demoProfileData";

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
    linkedin?: string | null;
    github?: string | null;
    customLink?: string | null;
    location?: string;
    skills?: string[];
    links?: Array<{ label: string; url: string; platform?: string }>;
    isOpenToWork?: boolean;
    isHireable?: boolean;
    isPublic: boolean;
    resumeUrl?: string | null;
    resumeFilename?: string | null;
    resumeFilesize?: number | null;
    resumeUpdatedAt?: string | null;
    isResumePublic?: boolean;
    college?: {
        id: string;
        officialName: string;
        city?: string | null;
        state?: string | null;
        district?: string | null;
        institutionType?: string | null;
        aisheCode?: string | null;
        verificationStatus?: string | null;
    } | null;
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
        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token");
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
            // If the request was explicitly aborted (e.g. debounced typing), do not fall back or wrap in generic Error
            if (options?.signal?.aborted || netErr?.name === "AbortError" || String(netErr?.message || "").toLowerCase().includes("abort")) {
                throw netErr;
            }
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

    // Instant return for verified demo showcase profile
    if (isDemoProfileUsername(key)) {
        return demoPublicProfile;
    }

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
    linkedin?: string;
    github?: string;
    customLink?: string;
    location?: string;
    skills?: string[];
    links?: Array<{ label: string; url: string; platform?: string }>;
    isOpenToWork?: boolean;
    isHireable?: boolean;
    isPublic?: boolean;
    collegeId?: string | null;
}): Promise<any> {
    const json = await apiFetch<{ success: boolean; user: any }>("/api/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
    });
    invalidatePublicProfileClientCache();
    return json.user;
}

export interface InstitutionItem {
    id: string;
    officialName: string;
    city?: string | null;
    state?: string | null;
    district?: string | null;
    institutionType?: string | null;
    aisheCode?: string | null;
    verificationStatus?: "verified" | "needs_review" | "unverified" | "inactive" | string | null;
}

/**
 * Autocomplete search for verified institutions with optional state filter and abort signal
 */
export async function searchInstitutions(
    q: string,
    options?: { state?: string; limit?: number; signal?: AbortSignal }
): Promise<InstitutionItem[]> {
    const clean = (q || "").trim();
    if (clean.length < 2) return [];

    const params = new URLSearchParams({ q: clean });
    if (options?.state) params.append("state", options.state);
    if (options?.limit) params.append("limit", String(options.limit));

    const json = await apiFetch<{ success: boolean; institutions: InstitutionItem[] }>(
        `/api/institutions/search?${params.toString()}`,
        {
            signal: options?.signal,
        }
    );
    return json.institutions || [];
}

/**
 * Fetch a single institution by UUID
 */
export async function getInstitutionById(id: string): Promise<InstitutionItem | null> {
    try {
        const cleanId = String(id || "").trim();
        if (!cleanId) return null;
        const json = await apiFetch<{ success: boolean; institution: InstitutionItem }>(
            `/api/institutions/${encodeURIComponent(cleanId)}`
        );
        return json.institution || null;
    } catch {
        return null;
    }
}

/**
 * Submit a verification request for an unlisted or missing college
 */
export async function submitInstitutionVerificationRequest(payload: {
    institutionName: string;
    institutionWebsite?: string;
    supportingReference?: string;
}): Promise<{ success: boolean; message: string; requestId?: string }> {
    return await apiFetch<{ success: boolean; message: string; requestId?: string }>(
        "/api/institutions/verification-request",
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
}

/**
 * Fetch authenticated user's submitted verification requests
 */
export async function getMyInstitutionVerificationRequests(): Promise<any[]> {
    try {
        const json = await apiFetch<{ success: boolean; requests: any[] }>(
            "/api/institutions/verification-requests/mine"
        );
        return json.requests || [];
    } catch {
        return [];
    }
}

/**
 * Send a message / notification to the profile owner from a recruiter
 */
export async function sendHireMessage(payload: {
    username: string;
    senderName: string;
    senderEmail: string;
    communicationEmail: string;
    company?: string;
    message: string;
}): Promise<{ success: boolean; message: string }> {
    const encodedUsername = encodeURIComponent(payload.username.toLowerCase().trim());
    const json = await apiFetch<{ success: boolean; message: string }>(
        `/api/profile/${encodedUsername}/hire-message`,
        {
            method: "POST",
            body: JSON.stringify(payload),
        }
    );
    return json;
}

export interface UserNotification {
    id: string;
    title: string;
    body: string;
    type: string;
    metadata: {
        senderName?: string;
        senderEmail?: string;
        communicationEmail?: string;
        company?: string;
        messageId?: string;
        fullMessage?: string;
    };
    isRead: boolean;
    readAt?: string | null;
    createdAt: string;
}

/**
 * Fetch notifications for authenticated user
 */
export async function fetchNotifications(autoMarkRead = false): Promise<{
    notifications: UserNotification[];
    unreadCount: number;
}> {
    const query = autoMarkRead ? "?autoMarkRead=true" : "";
    const json = await apiFetch<{
        success: boolean;
        notifications: UserNotification[];
        unreadCount: number;
    }>(`/api/notifications${query}`);
    return {
        notifications: json.notifications || [],
        unreadCount: json.unreadCount || 0,
    };
}

/**
 * Fetch unread notification count
 */
export async function fetchUnreadNotificationCount(): Promise<number> {
    try {
        const json = await apiFetch<{ success: boolean; unreadCount: number }>(
            "/api/notifications/unread-count"
        );
        return json.unreadCount || 0;
    } catch {
        return 0;
    }
}

/**
 * Mark notifications as read
 */
export async function markNotificationsAsRead(notificationIds?: string[]): Promise<boolean> {
    try {
        await apiFetch("/api/notifications/mark-read", {
            method: "POST",
            body: JSON.stringify({ notificationIds }),
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Delete a notification
 */
export async function deleteNotification(id: string): Promise<boolean> {
    try {
        await apiFetch(`/api/notifications/${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
        return true;
    } catch {
        return false;
    }
}

/**
 * Helper to purge local cache buckets on platform changes
 */
function purgeLocalPlatformCaches() {
    try {
        localStorage.removeItem("orbix_unified_submissions");
        localStorage.removeItem("orbix_unified_development");
        localStorage.removeItem("orbix_unified_contests");
        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("orbix_portals_updated"));
            window.dispatchEvent(new Event("storage"));
        }
    } catch {
        // Safe fallback
    }
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
        purgeLocalPlatformCaches();
        return true;
    } catch {
        await apiFetch(`/api/profile/platforms/${portal}`, {
            method: "DELETE",
        });
        invalidatePublicProfileClientCache();
        purgeLocalPlatformCaches();
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
        purgeLocalPlatformCaches();
        return json.platform;
    } catch {
        const json = await apiFetch<{ platform: any }>(`/api/profile/platforms/${portal}`, {
            method: "PUT",
            body: JSON.stringify({ handle: handleOrLink }),
        });
        invalidatePublicProfileClientCache();
        purgeLocalPlatformCaches();
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

// ============================================================================
// RESUME API ENGINE (Under 5 MB, Cloudinary, Full CRUD, PDF Viewer, Recruiter Checks)
// ============================================================================

export interface ResumeCheckItem {
    id: string;
    label: string;
    status: "pass" | "warn" | "tip";
    description: string;
}

export interface ResumeData {
    hasResume: boolean;
    resumeUrl: string | null;
    resumeFilename: string | null;
    resumeFilesize: number | null;
    resumeUpdatedAt: string | null;
    isResumePublic: boolean;
    checks?: ResumeCheckItem[];
}

// In-memory client-side cache and request deduplication for resumes
let cachedMyResume: { data: ResumeData; timestamp: number } | null = null;
let myResumeInFlight: Promise<ResumeData> | null = null;
const publicResumeCache = new Map<string, { data: ResumeData; timestamp: number }>();
const publicResumeInFlight = new Map<string, Promise<ResumeData>>();

const MY_RESUME_CLIENT_CACHE_TTL_MS = 60 * 1000; // 60s client freshness window
const PUBLIC_RESUME_CLIENT_CACHE_TTL_MS = 3 * 60 * 1000; // 3 min public resume cache

export const invalidateResumeClientCache = () => {
    cachedMyResume = null;
    myResumeInFlight = null;
    publicResumeCache.clear();
    publicResumeInFlight.clear();
};

/**
 * Fetch authenticated user's current resume details and recruiter checks with SWR caching
 */
export async function fetchMyResume(options?: { forceRefresh?: boolean }): Promise<ResumeData> {
    const now = Date.now();

    // 1. Return fresh client cache if available and not forced
    if (!options?.forceRefresh && cachedMyResume && now - cachedMyResume.timestamp < MY_RESUME_CLIENT_CACHE_TTL_MS) {
        return cachedMyResume.data;
    }

    // 2. Share inflight request if one is already running
    if (myResumeInFlight) {
        return myResumeInFlight;
    }

    // 3. Initiate request with inflight tracking
    myResumeInFlight = (async () => {
        try {
            const json = await apiFetch<{ success: boolean } & ResumeData>("/api/profile/resume", {
                method: "GET",
            });
            cachedMyResume = {
                data: json,
                timestamp: Date.now(),
            };
            return json;
        } catch (err) {
            // Gracefully fallback to stale cache if available
            if (cachedMyResume) {
                return cachedMyResume.data;
            }
            throw err;
        } finally {
            myResumeInFlight = null;
        }
    })();

    return myResumeInFlight;
}

/**
 * Direct upload of resume PDF (under 5 MB) with progress monitoring
 */
export async function uploadResume(
    file: File,
    onProgress?: (percent: number) => void
): Promise<{ success: boolean; resume: ResumeData; message: string }> {
    const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
    const formData = new FormData();
    formData.append("resume", file);

    const endpoints = [
        "/api/profile/resume/upload",
        "http://localhost:3000/api/profile/resume/upload",
    ];

    let lastError = "Failed to upload resume";

    for (const url of endpoints) {
        try {
            const result = await new Promise<{ success: boolean; resume: ResumeData; message: string }>(
                (resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.withCredentials = true;

                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable && onProgress) {
                            const percent = Math.round((event.loaded / event.total) * 100);
                            onProgress(percent);
                        }
                    };

                    xhr.onload = () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                const parsed = JSON.parse(xhr.responseText);
                                resolve(parsed);
                            } catch {
                                resolve({ success: true, resume: {} as ResumeData, message: "Uploaded" });
                            }
                        } else {
                            try {
                                const parsed = JSON.parse(xhr.responseText);
                                reject(new Error(parsed.message || `Upload failed with status ${xhr.status}`));
                            } catch {
                                reject(new Error(`Upload failed with status ${xhr.status}`));
                            }
                        }
                    };

                    xhr.onerror = () => {
                        reject(new Error("Network error during resume upload"));
                    };

                    xhr.open("POST", url, true);
                    if (token) {
                        xhr.setRequestHeader("Authorization", `Bearer ${token}`);
                    }
                    xhr.send(formData);
                }
            );

            // Invalidate caches and prime with new data
            invalidatePublicProfileClientCache();
            invalidateResumeClientCache();
            if (result?.resume) {
                cachedMyResume = {
                    data: result.resume,
                    timestamp: Date.now(),
                };
            }
            return result;
        } catch (err: any) {
            lastError = err?.message || lastError;
            continue;
        }
    }

    throw new Error(lastError);
}

/**
 * Delete resume from Cloudinary and database
 */
export async function deleteResume(): Promise<{ success: boolean; message: string }> {
    const json = await apiFetch<{ success: boolean; message: string }>("/api/profile/resume", {
        method: "DELETE",
    });
    invalidatePublicProfileClientCache();
    invalidateResumeClientCache();
    return json;
}

/**
 * Toggle whether resume download button is visible on the public profile
 */
export async function updateResumeVisibility(
    isPublic: boolean
): Promise<{ success: boolean; isResumePublic: boolean; message: string }> {
    const json = await apiFetch<{ success: boolean; isResumePublic: boolean; message: string }>(
        "/api/profile/resume/visibility",
        {
            method: "PATCH",
            body: JSON.stringify({ isPublic }),
        }
    );
    invalidatePublicProfileClientCache();
    invalidateResumeClientCache();
    return json;
}

/**
 * Fetch a user's publicly shared resume with client-side caching & deduplication
 */
export async function fetchPublicResume(username: string, options?: { forceRefresh?: boolean }): Promise<ResumeData> {
    const normalized = username.toLowerCase().trim();
    const now = Date.now();

    if (!options?.forceRefresh) {
        const cached = publicResumeCache.get(normalized);
        if (cached && now - cached.timestamp < PUBLIC_RESUME_CLIENT_CACHE_TTL_MS) {
            return cached.data;
        }
    }

    if (publicResumeInFlight.has(normalized)) {
        return publicResumeInFlight.get(normalized)!;
    }

    const reqPromise = (async () => {
        try {
            const encoded = encodeURIComponent(normalized);
            const json = await apiFetch<{ success: boolean } & ResumeData>(
                `/api/profile/resume/public/${encoded}`,
                {
                    method: "GET",
                }
            );
            publicResumeCache.set(normalized, {
                data: json,
                timestamp: Date.now(),
            });
            return json;
        } finally {
            publicResumeInFlight.delete(normalized);
        }
    })();

    publicResumeInFlight.set(normalized, reqPromise);
    return reqPromise;
}


