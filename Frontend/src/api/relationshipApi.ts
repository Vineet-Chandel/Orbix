// Frontend/src/api/relationshipApi.ts

export type RelationshipState =
    | 'none'
    | 'outgoing_pending'
    | 'incoming_pending'
    | 'connected'
    | 'blocked_by_me'
    | 'blocked_by_them'
    | 'cooldown_active'
    | 'unavailable';

export interface RelationshipStatePayload {
    success: boolean;
    state: RelationshipState;
    relationshipId: string | null;
    requestedBy: string | null;
    targetUserId: string;
    canRequest: boolean;
    canAccept: boolean;
    canDecline: boolean;
    canCancel: boolean;
    canRemove: boolean;
    canBlock: boolean;
    canUnblock: boolean;
    cooldownRemainingMs?: number;
    nextAllowedRequestAt?: string;
    message?: string;
}

export interface RelationshipMutationResponse {
    success: boolean;
    outcome: string;
    state: RelationshipState;
    message: string;
    relationshipId?: string | null;
    retryAfter?: number;
}

export interface ConnectedUserItem {
    relationshipId: string;
    connectedUserId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    photoUrl?: string | null;
    headline: string | null;
    college: string | null;
    location?: string | null;
    skills?: string[];
    orbixScore?: number;
    totalSolved?: number;
    isVerifiedCoder?: boolean;
    connectedAt: string;
}

export interface BlockedUserItem {
    id: string;
    blockedId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    photoUrl?: string | null;
    headline: string | null;
    blockedAt: string;
}

const API_BASE = "/api";

/**
 * Broadcasts relationship state change across all open views in the browser
 */
export function broadcastRelationshipChange(targetUserId: string, state: RelationshipState) {
    if (typeof window !== "undefined") {
        window.dispatchEvent(
            new CustomEvent("orbix_relationship_changed", {
                detail: { targetUserId, state },
            })
        );
    }
}

/**
 * Fetches relationship states in bulk for an array of user IDs/usernames in a single API call
 */
export async function fetchRelationshipStatesBatch(
    userIds: string[]
): Promise<Record<string, RelationshipStatePayload>> {
    if (!userIds || userIds.length === 0) return {};
    const res = await fetch(`${API_BASE}/relationships/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userIds }),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch relationships batch (${res.status})`);
    }

    const data = await res.json();
    return data.relationships || {};
}

// DataLoader-style in-flight request batcher: collects all single-user requests
// fired in the same microtask/event-loop tick and coalesces them into 1 batch HTTP request.
let pendingBatch: Map<
    string,
    Array<{
        resolve: (val: RelationshipStatePayload) => void;
        reject: (err: any) => void;
    }>
> = new Map();
let batchDebounceTimer: any = null;

function flushBatch() {
    const queue = pendingBatch;
    pendingBatch = new Map();
    batchDebounceTimer = null;

    const userIds = Array.from(queue.keys());
    if (userIds.length === 0) return;

    fetchRelationshipStatesBatch(userIds)
        .then((map) => {
            for (const [id, listeners] of queue.entries()) {
                const payload = map[id] || {
                    success: true,
                    state: "none",
                    relationshipId: null,
                    requestedBy: null,
                    targetUserId: id,
                    canRequest: true,
                    canAccept: false,
                    canDecline: false,
                    canCancel: false,
                    canRemove: false,
                    canBlock: true,
                    canUnblock: false,
                };
                listeners.forEach((l) => l.resolve(payload));
            }
        })
        .catch((err) => {
            for (const listeners of queue.values()) {
                listeners.forEach((l) => l.reject(err));
            }
        });
}

/**
 * Batched version of fetchRelationshipState.
 * If multiple components mount simultaneously, their calls are merged into 1 HTTP call.
 */
export function fetchRelationshipStateBatched(userId: string): Promise<RelationshipStatePayload> {
    return new Promise((resolve, reject) => {
        const listeners = pendingBatch.get(userId) || [];
        listeners.push({ resolve, reject });
        pendingBatch.set(userId, listeners);

        if (!batchDebounceTimer) {
            batchDebounceTimer = setTimeout(flushBatch, 15);
        }
    });
}

/**
 * Fetches viewer-specific relationship state for a target user ID or username.
 * Automatically delegates to the batched request coalescer to avoid N+1 storms.
 */
export async function fetchRelationshipState(userId: string): Promise<RelationshipStatePayload> {
    return fetchRelationshipStateBatched(userId);
}

/**
 * Sends a connection request
 */
export async function sendConnectionRequest(userId: string): Promise<RelationshipMutationResponse> {
    const res = await fetch(`${API_BASE}/relationships/${encodeURIComponent(userId)}/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.state) {
        broadcastRelationshipChange(userId, data.state);
    }
    return data;
}

/**
 * Accepts an incoming connection request
 */
export async function acceptConnectionRequest(userId: string): Promise<RelationshipMutationResponse> {
    const res = await fetch(`${API_BASE}/relationships/${encodeURIComponent(userId)}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.state) {
        broadcastRelationshipChange(userId, data.state);
    }
    return data;
}

/**
 * Declines an incoming connection request
 */
export async function declineConnectionRequest(userId: string): Promise<RelationshipMutationResponse> {
    const res = await fetch(`${API_BASE}/relationships/${encodeURIComponent(userId)}/decline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.state) {
        broadcastRelationshipChange(userId, data.state);
    }
    return data;
}

/**
 * Cancels an outgoing connection request
 */
export async function cancelConnectionRequest(userId: string): Promise<RelationshipMutationResponse> {
    const res = await fetch(`${API_BASE}/relationships/${encodeURIComponent(userId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.state) {
        broadcastRelationshipChange(userId, data.state);
    }
    return data;
}

/**
 * Removes an established connection
 */
export async function removeActiveConnection(userId: string): Promise<RelationshipMutationResponse> {
    const res = await fetch(`${API_BASE}/relationships/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.state) {
        broadcastRelationshipChange(userId, data.state);
    }
    return data;
}

/**
 * Blocks a target user
 */
export async function blockTargetUser(userId: string, reason?: string): Promise<{ success: boolean; message: string; outcome?: string; retryAfter?: number }> {
    const res = await fetch(`${API_BASE}/blocks/${encodeURIComponent(userId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        credentials: "include",
    });

    const data = await res.json();
    if (data.success) {
        broadcastRelationshipChange(userId, "blocked_by_me");
    }
    return data;
}

/**
 * Unblocks a target user
 */
export async function unblockTargetUser(userId: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`${API_BASE}/blocks/${encodeURIComponent(userId)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    const data = await res.json();
    if (data.success) {
        broadcastRelationshipChange(userId, "none");
    }
    return data;
}

/**
 * Retrieves paginated list of user's accepted connections
 */
export async function fetchUserConnectionsList(
    limit = 20,
    cursor?: string,
    search?: string
): Promise<{
    success: boolean;
    connections: ConnectedUserItem[];
    nextCursor: string | null;
    totalCount: number;
}> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);
    if (search) params.set("search", search);

    const res = await fetch(`${API_BASE}/settings/connections?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch connections (${res.status})`);
    }

    return res.json();
}

/**
 * Retrieves paginated list of current user's blocked accounts
 */
export async function fetchBlockedUsersList(
    limit = 20,
    cursor?: string
): Promise<{
    success: boolean;
    blockedUsers: BlockedUserItem[];
    nextCursor: string | null;
    totalCount: number;
}> {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${API_BASE}/settings/blocked?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch blocked users (${res.status})`);
    }

    return res.json();
}

/**
 * Sends a user-triggered notification adhering to 3/24h rolling quota
 */
export async function sendUserDirectNotification(
    recipientId: string,
    title: string,
    body: string,
    idempotencyKey?: string
): Promise<{
    success: boolean;
    message?: string;
    code?: string;
    retryAfter?: number;
    notification?: any;
}> {
    const res = await fetch(`${API_BASE}/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            recipientId,
            title,
            body,
            idempotencyKey,
        }),
        credentials: "include",
    });

    return res.json();
}

export interface PendingRequestItem {
    relationshipId: string;
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    photoUrl?: string | null;
    headline: string | null;
    college: string | null;
    location?: string | null;
    skills?: string[];
    orbixScore: number;
    totalSolved: number;
    isVerifiedCoder: boolean;
    type: "incoming" | "outgoing";
    requestedAt: string;
}

/**
 * Retrieves incoming or outgoing pending connection requests.
 */
export async function fetchPendingRequests(
    filter: "incoming" | "outgoing" | "all" = "all",
    limit = 20,
    cursor?: string
): Promise<{
    success: boolean;
    requests: PendingRequestItem[];
    nextCursor: string | null;
    totalCount: number;
}> {
    const params = new URLSearchParams();
    params.set("type", filter);
    params.set("limit", String(limit));
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`${API_BASE}/relationships/requests/pending?${params.toString()}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch pending requests (${res.status})`);
    }

    return res.json();
}

export interface QuotaStatusSummary {
    requests: {
        daily: { used: number; limit: number; remaining: number };
        weekly: { used: number; limit: number; remaining: number };
    };
    blocks: {
        daily: { used: number; limit: number; remaining: number };
        weekly: { used: number; limit: number; remaining: number };
    };
}

/**
 * Retrieves current real-time quota status for connection requests and blocks
 */
export async function fetchRelationshipQuota(): Promise<{
    success: boolean;
    quota: QuotaStatusSummary;
}> {
    const res = await fetch(`${API_BASE}/relationships/quota`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch quota (${res.status})`);
    }

    return res.json();
}
