// Frontend/src/api/sessionActivityApi.ts

const API_BASE = "/api";
const DEVICE_ID_STORAGE_KEY = "orbix_did";
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Module-level memory cache ensuring stable ID persistence during the session
// even if localStorage, sessionStorage, or cookies are disabled/restricted by browser privacy modes.
let inMemoryDeviceId: string | null = null;

/**
 * Validates whether a candidate string is a well-formed UUID.
 */
export function isValidDeviceId(id: unknown): id is string {
    return typeof id === "string" && UUID_V4_REGEX.test(id.trim());
}

/**
 * Generates an RFC 4122 version 4 compliant UUID using window.crypto.getRandomValues().
 * Supported in both secure (HTTPS) and non-secure (HTTP) browser contexts across all modern browsers.
 */
function generateCryptoRandomUUID(): string {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    // Per RFC 4122 Section 4.4:
    // Set 4 most significant bits of 7th byte (time_hi_and_version) to 0100 (version 4)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set 2 most significant bits of 9th byte (clock_seq_hi_and_reserved) to 10 (RFC 4122 variant)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Last-resort fallback for environments without Web Crypto API (e.g. archaic browser or restricted iframe).
 * Produces an RFC 4122-compatible UUID string using high-precision timestamps and pseudo-randomness.
 * NOTE: Device IDs are non-secret client telemetry hints for device recognition, not security credentials.
 */
function generatePseudoRandomUUID(): string {
    let d = Date.now();
    let d2 = (typeof performance !== "undefined" && performance.now && (performance.now() * 1000)) || 0;
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        let r = Math.random() * 16;
        if (d > 0) {
            r = (d + r) % 16 | 0;
            d = Math.floor(d / 16);
        } else if (d2 > 0) {
            r = (d2 + r) % 16 | 0;
            d2 = Math.floor(d2 / 16);
        } else {
            r = r | 0;
        }
        const val = c === "x" ? (r | 0) : (((r | 0) & 0x3) | 0x8);
        return val.toString(16);
    });
}

/**
 * Safely generates a standard UUID v4 without throwing in any browser context.
 * 1. window.crypto.randomUUID() (available in HTTPS / Secure Contexts)
 * 2. window.crypto.getRandomValues() (available in both HTTP and HTTPS)
 * 3. Pseudo-random fallback (last resort for non-crypto environments)
 */
export function createNewDeviceId(): string {
    try {
        if (typeof window !== "undefined" && window.crypto && typeof window.crypto.randomUUID === "function") {
            return window.crypto.randomUUID();
        }
    } catch {
        // Fall through to getRandomValues
    }

    try {
        if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
            return generateCryptoRandomUUID();
        }
    } catch {
        // Fall through to pseudo-random
    }

    return generatePseudoRandomUUID();
}

/**
 * Retrieves or generates a persistent device identifier.
 *
 * Guarantees:
 * 1. NEVER throws an exception under any circumstance (SecurityError, QuotaExceededError, missing Crypto, HTTP origin).
 * 2. Reuses existing valid device IDs from localStorage, falling back to sessionStorage, then in-memory cache.
 * 3. Safely generates UUID v4 on both HTTP and HTTPS contexts without assuming window.crypto.randomUUID exists.
 * 4. Silently handles storage failures, maintaining in-memory continuity across calls.
 */
export function getOrCreateDeviceId(): string {
    if (typeof window === "undefined") {
        return "";
    }

    // 1. Check in-memory cache first for fast, non-throwing return
    if (isValidDeviceId(inMemoryDeviceId)) {
        return inMemoryDeviceId;
    }

    let existingId: string | null = null;

    // 2. Try localStorage
    try {
        existingId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (isValidDeviceId(existingId)) {
            inMemoryDeviceId = existingId;
            return existingId;
        }
    } catch {
        // localStorage is disabled, restricted, or throws SecurityError
    }

    // 3. Try sessionStorage fallback
    try {
        existingId = sessionStorage.getItem(DEVICE_ID_STORAGE_KEY);
        if (isValidDeviceId(existingId)) {
            inMemoryDeviceId = existingId;
            try {
                localStorage.setItem(DEVICE_ID_STORAGE_KEY, existingId);
            } catch {}
            return existingId;
        }
    } catch {
        // sessionStorage restricted
    }

    // 4. Generate a new valid identifier
    const newId = createNewDeviceId();
    inMemoryDeviceId = newId;

    // 5. Attempt persistence
    try {
        localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    } catch {
        try {
            sessionStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
        } catch {
            // Memory cache remains active for the lifespan of the page
        }
    }

    return newId;
}

function getSessionHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (typeof window !== "undefined") {
        const did = getOrCreateDeviceId();
        if (did) headers["x-orbix-device-id"] = did;
        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token");
        if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export interface UserSessionItem {
    id: string;
    sessionId: string;
    deviceName: string;
    deviceType: "desktop" | "laptop" | "mobile" | "tablet";
    browser: string;
    browserVersion: string | null;
    operatingSystem: string;
    operatingSystemVersion: string | null;
    userAgentSummary: string;
    ipAddressMasked: string;
    city: string | null;
    region: string | null;
    country: string | null;
    countryCode: string | null;
    locationSummary: string;
    loginMethod: string;
    isMfaAuthenticated: boolean;
    isNewDevice: boolean;
    riskLevel: string;
    status: string;
    isCurrentSession: boolean;
    createdAt: string;
    lastActiveAt: string;
    expiresAt: string;
    revokedAt?: string | null;
    revocationReason?: string | null;
}

export interface SecurityEventItem {
    id: string;
    eventType: string;
    title: string;
    description: string;
    severity: "info" | "warning" | "high" | "critical";
    ipAddressMasked: string | null;
    locationSummary: string | null;
    deviceSummary: string | null;
    metadata?: Record<string, any>;
    createdAt: string;
}

export interface SessionOverviewData {
    totalActiveSessions: number;
    recognizedDevicesCount: number;
    latestLoginAt: string | null;
    currentSession: UserSessionItem | null;
    activeSessions: UserSessionItem[];
}

export interface ClubAccessItem {
    id: string;
    clubId: string;
    userId: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
    userRoleAtTime: string;
    action: string;
    actionLabel: string;
    deviceName: string;
    browser: string;
    operatingSystem: string;
    locationSummary: string;
    ipAddressMasked: string;
    sessionStatus: string;
    createdAt: string;
    metadata?: Record<string, any>;
}

/**
 * Fetch overview of active sessions, recognized devices, and current device
 */
export async function fetchSessionOverview(): Promise<{
    success: boolean;
    overview: SessionOverviewData;
}> {
    const res = await fetch(`${API_BASE}/account/sessions/overview`, {
        method: "GET",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch session overview (${res.status})`);
    }

    return data;
}

/**
 * Fetch all currently active sessions for the user
 */
export async function fetchActiveSessions(): Promise<{
    success: boolean;
    sessions: UserSessionItem[];
}> {
    const res = await fetch(`${API_BASE}/account/sessions`, {
        method: "GET",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch active sessions (${res.status})`);
    }

    return data;
}

/**
 * Fetch session history with pagination
 */
export async function fetchSessionHistory(params?: {
    limit?: number;
    offset?: number;
}): Promise<{
    success: boolean;
    total: number;
    sessions: UserSessionItem[];
}> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));

    const queryStr = searchParams.toString();
    const url = `${API_BASE}/account/sessions/history${queryStr ? `?${queryStr}` : ""}`;

    const res = await fetch(url, {
        method: "GET",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch session history (${res.status})`);
    }

    return data;
}

/**
 * Terminate a specific session remotely
 */
export async function terminateSession(sessionId: string): Promise<{
    success: boolean;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/account/sessions/${encodeURIComponent(sessionId)}`, {
        method: "DELETE",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to terminate session (${res.status})`);
    }

    return data;
}

/**
 * Log out of all other active sessions except current
 */
export async function terminateOtherSessions(): Promise<{
    success: boolean;
    message: string;
    revokedCount: number;
}> {
    const res = await fetch(`${API_BASE}/account/sessions/revoke-others`, {
        method: "POST",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to terminate other sessions (${res.status})`);
    }

    return data;
}

/**
 * Log out of all active sessions including current
 */
export async function terminateAllSessions(): Promise<{
    success: boolean;
    message: string;
    revokedCount: number;
}> {
    const res = await fetch(`${API_BASE}/account/sessions/revoke-all`, {
        method: "POST",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to terminate all sessions (${res.status})`);
    }

    return data;
}

/**
 * Fetch chronological account security event timeline
 */
export async function fetchSecurityEvents(params?: {
    limit?: number;
    offset?: number;
}): Promise<{
    success: boolean;
    total: number;
    events: SecurityEventItem[];
}> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));

    const queryStr = searchParams.toString();
    const url = `${API_BASE}/account/security-events${queryStr ? `?${queryStr}` : ""}`;

    const res = await fetch(url, {
        method: "GET",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch security events (${res.status})`);
    }

    return data;
}

/**
 * Fetch club team access audit activity
 */
export async function fetchClubAccessActivity(
    clubId: string,
    params?: { limit?: number; offset?: number; action?: string }
): Promise<{
    success: boolean;
    total: number;
    activeTeamSessionsCount: number;
    events: ClubAccessItem[];
}> {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.append("limit", String(params.limit));
    if (params?.offset) searchParams.append("offset", String(params.offset));
    if (params?.action && params.action !== "all") searchParams.append("action", params.action);

    const queryStr = searchParams.toString();
    const url = `${API_BASE}/clubs/${encodeURIComponent(clubId)}/activity${queryStr ? `?${queryStr}` : ""}`;

    const res = await fetch(url, {
        method: "GET",
        headers: getSessionHeaders(),
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch club activity logs (${res.status})`);
    }

    return data;
}

/**
 * Record routine member access to club dashboard/settings
 */
export async function logClubAccessEvent(
    clubId: string,
    action: string,
    metadata?: Record<string, any>
): Promise<void> {
    try {
        await fetch(`${API_BASE}/clubs/${encodeURIComponent(clubId)}/activity/log`, {
            method: "POST",
            headers: getSessionHeaders(),
            credentials: "include",
            body: JSON.stringify({ action, metadata }),
        });
    } catch {
        // Non-blocking logging
    }
}
