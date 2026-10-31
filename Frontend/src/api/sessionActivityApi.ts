// Frontend/src/api/sessionActivityApi.ts

const API_BASE = "/api";

export function getOrCreateDeviceId(): string {
    if (typeof window === "undefined") return "";
    let did = localStorage.getItem("orbix_did");
    if (!did) {
        did = crypto.randomUUID();
        localStorage.setItem("orbix_did", did);
    }
    return did;
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
