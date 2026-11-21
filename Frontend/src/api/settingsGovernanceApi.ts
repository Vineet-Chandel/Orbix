// Frontend/src/api/settingsGovernanceApi.ts

const API_BASE = "/api";

export interface GovernanceStatusResponse {
    success: boolean;
    standing: {
        status: "good" | "cooldown" | "warning" | "probation" | "restricted" | "suspended";
        statusLabel: string;
        isCompliant: boolean;
        standingScore: number;
        verifiedBadges: {
            isInstitutionalVerified: boolean;
            isEmailVerified: boolean;
            isTwoFactorEnabled: boolean;
        };
        conduct: {
            activeStrikes: number;
            totalStrikesIssued: number;
            conductStatus: string;
        };
        syncHealth: {
            connectedPlatformsCount: number;
            lastGlobalSyncAt: string | null;
            failedSyncsCount: number;
            status: "healthy" | "partial" | "degraded";
        };
        securityLevel: {
            level: string;
            twoFactorActive: boolean;
            emailVerified: boolean;
        };
        collegiateSafeguard: {
            isOnCooldown: boolean;
            remainingCooldownHours: number;
            cooldownExpiresAt: string | null;
            policyDescription: string;
        };
    };
    capabilities: {
        leaderboards: { eligible: boolean; label: string; description: string };
        cardStudio: { accessLevel: string; label: string; description: string };
        resumeIntelligence: { quotaTier: string; label: string; description: string };
        syncCadence: { refreshType: string; label: string; description: string };
    };
    entitlements: Record<string, any>;
    activeRestrictions: Array<{
        restrictionType: string;
        reason: string;
        expiresAt: string | null;
    }>;
}

export interface GovernanceTimelineItem {
    id: string;
    previousStatus: string;
    newStatus: string;
    reason: string;
    createdAt: string;
}

export interface PrivacyPreferences {
    userId?: string;
    anonymousTelemetry: boolean;
    searchEngineIndexing: boolean;
    recruiterInquiries: boolean;
    activityBroadcasts: boolean;
    leaderboardPublicDisplay: boolean;
    resumeFactGating: boolean;
    updatedAt?: string;
}

export interface DataInventoryCategory {
    category: string;
    description: string;
    itemCount: number;
    retentionPolicy: string;
    exportable: boolean;
}

export interface PrivacyAuditRecord {
    id: string;
    type: "export" | "deletion" | "preference_change";
    status: string;
    details: string;
    createdAt: string;
}

export interface PlatformAboutMetadata {
    success: boolean;
    platform: {
        name: string;
        version: string;
        edition: string;
        buildNumber: string;
        environment: string;
        gitCommit: string;
        releaseDate: string;
        channel: string;
    };
    ecosystemStats: {
        supportedPortals: number;
        indexingEngine: string;
        scoringEngineVersion: string;
        collegesSupported: number;
    };
    releaseHistory: Array<{
        version: string;
        releaseName: string;
        releaseDate: string;
        channel: string;
        highlights: string[];
        breakingChanges: string[];
    }>;
    officialLinks: Record<string, string>;
}

/**
 * Fetch authoritative account standing, conduct record, platform health and quotas
 */
export async function fetchAccountGovernanceStatus(): Promise<GovernanceStatusResponse> {
    const res = await fetch(`${API_BASE}/account/governance/status`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch account standing (${res.status})`);
    }

    return data;
}

/**
 * Fetch sanitized status audit history for the authenticated user
 */
export async function fetchAccountStatusTimeline(): Promise<{
    success: boolean;
    history: GovernanceTimelineItem[];
}> {
    const res = await fetch(`${API_BASE}/account/governance/timeline`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch status history (${res.status})`);
    }

    return data;
}

/**
 * Fetch current user privacy preferences
 */
export async function fetchPrivacyPreferences(): Promise<{
    success: boolean;
    preferences: PrivacyPreferences;
}> {
    const res = await fetch(`${API_BASE}/account/privacy/preferences`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch privacy preferences (${res.status})`);
    }

    return data;
}

/**
 * Save updated user privacy preferences
 */
export async function updatePrivacyPreferences(
    preferences: Partial<PrivacyPreferences>
): Promise<{
    success: boolean;
    message: string;
    preferences: PrivacyPreferences;
}> {
    const res = await fetch(`${API_BASE}/account/privacy/preferences`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(preferences),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to update privacy preferences (${res.status})`);
    }

    return data;
}

/**
 * Fetch personal platform data inventory
 */
export async function fetchDataInventory(): Promise<{
    success: boolean;
    inventory: DataInventoryCategory[];
}> {
    const res = await fetch(`${API_BASE}/account/privacy/inventory`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch data inventory (${res.status})`);
    }

    return data;
}

/**
 * Schedule permanent account deletion with 7-day grace period
 */
export async function requestAccountDeletion(reason?: string): Promise<{
    success: boolean;
    message: string;
    scheduledPurgeAt: string;
}> {
    const res = await fetch(`${API_BASE}/account/privacy/deletion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ reason }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to schedule account deletion (${res.status})`);
    }

    return data;
}

/**
 * Cancel a pending scheduled account deletion
 */
export async function cancelAccountDeletion(): Promise<{
    success: boolean;
    message: string;
}> {
    const res = await fetch(`${API_BASE}/account/privacy/deletion`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to cancel account deletion (${res.status})`);
    }

    return data;
}

/**
 * Fetch privacy and compliance audit logs
 */
export async function fetchPrivacyRequestHistory(): Promise<{
    success: boolean;
    history: PrivacyAuditRecord[];
}> {
    const res = await fetch(`${API_BASE}/account/privacy/history`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch privacy history (${res.status})`);
    }

    return data;
}

/**
 * Fetch dynamic platform release metadata and architecture documentation
 */
export async function fetchPlatformAboutMetadata(): Promise<PlatformAboutMetadata> {
    const res = await fetch(`${API_BASE}/platform/about`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || `Failed to fetch platform metadata (${res.status})`);
    }

    return data;
}
