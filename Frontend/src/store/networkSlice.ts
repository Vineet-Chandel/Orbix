// Frontend/src/store/networkSlice.ts
import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import {
    fetchExploreProfiles,
    type ExploreDeveloper,
} from "../utils/profileApi";
import {
    sendConnectionRequest,
    acceptConnectionRequest,
    declineConnectionRequest,
    cancelConnectionRequest,
    removeActiveConnection,
    blockTargetUser,
    unblockTargetUser,
    fetchUserConnectionsList,
    fetchBlockedUsersList,
    fetchPendingRequests,
    type ConnectedUserItem,
    type BlockedUserItem,
    type PendingRequestItem,
} from "../api/relationshipApi";

export interface NetworkState {
    activeTab: "explore" | "connections" | "requests";
    explore: {
        items: ExploreDeveloper[];
        total: number;
        page: number;
        hasMore: boolean;
        isLoading: boolean;
        isLoadingMore: boolean;
        error: string | null;
    };
    connections: {
        items: ConnectedUserItem[];
        totalCount: number;
        nextCursor: string | null;
        isLoading: boolean;
        error: string | null;
    };
    requests: {
        incoming: PendingRequestItem[];
        outgoing: PendingRequestItem[];
        totalIncoming: number;
        totalOutgoing: number;
        activeSubTab: "incoming" | "outgoing";
        isLoading: boolean;
        error: string | null;
    };
    blocked: {
        items: BlockedUserItem[];
        totalCount: number;
        nextCursor: string | null;
        isLoading: boolean;
        error: string | null;
    };
}

const initialState: NetworkState = {
    activeTab: "explore",
    explore: {
        items: [],
        total: 0,
        page: 1,
        hasMore: true,
        isLoading: false,
        isLoadingMore: false,
        error: null,
    },
    connections: {
        items: [],
        totalCount: 0,
        nextCursor: null,
        isLoading: false,
        error: null,
    },
    requests: {
        incoming: [],
        outgoing: [],
        totalIncoming: 0,
        totalOutgoing: 0,
        activeSubTab: "incoming",
        isLoading: false,
        error: null,
    },
    blocked: {
        items: [],
        totalCount: 0,
        nextCursor: null,
        isLoading: false,
        error: null,
    },
};

// ============================================================================
// ASYNC THUNKS
// ============================================================================

export const fetchExploreDevelopersThunk = createAsyncThunk(
    "network/fetchExploreDevelopers",
    async (
        params: {
            search?: string;
            college?: string;
            openToWork?: boolean;
            verifiedOnly?: boolean;
            sortBy?: "score" | "solved" | "contests" | "streak" | "recent" | "name";
            page?: number;
            limit?: number;
            isInitial?: boolean;
        },
        { rejectWithValue }
    ) => {
        try {
            const res = await fetchExploreProfiles(params);
            if (!res.success) {
                return rejectWithValue((res as any).message || "Failed to load explore developers");
            }
            return {
                users: res.users,
                total: res.total,
                page: res.page,
                totalPages: res.totalPages,
                isInitial: params.isInitial ?? false,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error loading developers");
        }
    }
);

export const fetchConnectionsThunk = createAsyncThunk(
    "network/fetchConnections",
    async (
        params: { limit?: number; cursor?: string; search?: string; isInitial?: boolean },
        { rejectWithValue }
    ) => {
        try {
            const res = await fetchUserConnectionsList(params.limit, params.cursor, params.search);
            if (!res.success) {
                return rejectWithValue("Failed to load connections");
            }
            return {
                connections: res.connections,
                totalCount: res.totalCount,
                nextCursor: res.nextCursor,
                isInitial: params.isInitial ?? false,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error loading connections");
        }
    }
);

export const fetchPendingRequestsThunk = createAsyncThunk(
    "network/fetchPendingRequests",
    async (
        params: { filter?: "incoming" | "outgoing" | "all"; limit?: number; cursor?: string } = {},
        { rejectWithValue }
    ) => {
        try {
            const filter = params.filter || "all";
            const res = await fetchPendingRequests(filter, params.limit, params.cursor);
            if (!res.success) {
                return rejectWithValue("Failed to load pending requests");
            }
            return {
                requests: res.requests,
                totalCount: res.totalCount,
                filter,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error loading pending requests");
        }
    }
);

export const fetchBlockedUsersThunk = createAsyncThunk(
    "network/fetchBlockedUsers",
    async (
        params: { limit?: number; cursor?: string; isInitial?: boolean } = {},
        { rejectWithValue }
    ) => {
        try {
            const res = await fetchBlockedUsersList(params.limit, params.cursor);
            if (!res.success) {
                return rejectWithValue("Failed to load blocked users");
            }
            return {
                blockedUsers: res.blockedUsers,
                totalCount: res.totalCount,
                nextCursor: res.nextCursor,
                isInitial: params.isInitial ?? false,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error loading blocked users");
        }
    }
);

export const sendExploreConnectionRequestThunk = createAsyncThunk(
    "network/sendExploreConnectionRequest",
    async (candidate: ExploreDeveloper, { rejectWithValue }) => {
        try {
            const targetId = candidate.id || candidate.username;
            const res = await sendConnectionRequest(targetId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to send request");
            }
            return {
                candidate,
                response: res,
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error sending request");
        }
    }
);

export const cancelPendingRequestThunk = createAsyncThunk(
    "network/cancelPendingRequest",
    async (
        { relationshipId, targetUserId }: { relationshipId: string; targetUserId: string },
        { rejectWithValue }
    ) => {
        try {
            const res = await cancelConnectionRequest(targetUserId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to cancel request");
            }
            return { relationshipId, targetUserId };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error cancelling request");
        }
    }
);

export const acceptPendingRequestThunk = createAsyncThunk(
    "network/acceptPendingRequest",
    async (
        {
            relationshipId,
            targetUserId,
            peerUser,
        }: {
            relationshipId: string;
            targetUserId: string;
            peerUser?: {
                username: string;
                displayName: string;
                avatarUrl: string | null;
                headline: string | null;
                college: string | null;
            };
        },
        { rejectWithValue }
    ) => {
        try {
            const res = await acceptConnectionRequest(targetUserId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to accept connection");
            }
            return { relationshipId, targetUserId, peerUser };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error accepting connection");
        }
    }
);

export const declinePendingRequestThunk = createAsyncThunk(
    "network/declinePendingRequest",
    async (
        { relationshipId, targetUserId }: { relationshipId: string; targetUserId: string },
        { rejectWithValue }
    ) => {
        try {
            const res = await declineConnectionRequest(targetUserId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to decline request");
            }
            return { relationshipId, targetUserId };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error declining request");
        }
    }
);

export const removeConnectionThunk = createAsyncThunk(
    "network/removeConnection",
    async (
        { relationshipId, targetUserId }: { relationshipId: string; targetUserId: string },
        { rejectWithValue }
    ) => {
        try {
            const res = await removeActiveConnection(targetUserId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to remove connection");
            }
            return { relationshipId, targetUserId };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error removing connection");
        }
    }
);

export const blockUserThunk = createAsyncThunk(
    "network/blockUser",
    async (
        {
            targetUserId,
            reason,
            userPreview,
        }: {
            targetUserId: string;
            reason?: string;
            userPreview?: {
                username: string;
                displayName: string;
                avatarUrl: string | null;
                headline: string | null;
            };
        },
        { rejectWithValue }
    ) => {
        try {
            const res = await blockTargetUser(targetUserId, reason);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to block user");
            }
            return { targetUserId, userPreview };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error blocking user");
        }
    }
);

export const unblockUserThunk = createAsyncThunk(
    "network/unblockUser",
    async (targetUserId: string, { rejectWithValue }) => {
        try {
            const res = await unblockTargetUser(targetUserId);
            if (!res.success) {
                return rejectWithValue(res.message || "Failed to unblock user");
            }
            return { targetUserId };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error unblocking user");
        }
    }
);

// ============================================================================
// SLICE DEFINITION
// ============================================================================

export const networkSlice = createSlice({
    name: "network",
    initialState,
    reducers: {
        setActiveNetworkTab: (
            state,
            action: PayloadAction<"explore" | "connections" | "requests">
        ) => {
            state.activeTab = action.payload;
        },
        setRequestsSubTab: (
            state,
            action: PayloadAction<"incoming" | "outgoing">
        ) => {
            state.requests.activeSubTab = action.payload;
        },
        removeExploreDeveloper: (state, action: PayloadAction<string>) => {
            const idOrUsername = action.payload.toLowerCase();
            const initialLen = state.explore.items.length;
            state.explore.items = state.explore.items.filter(
                (d) => d.id !== action.payload && d.username.toLowerCase() !== idOrUsername
            );
            if (state.explore.items.length < initialLen) {
                state.explore.total = Math.max(0, state.explore.total - 1);
            }
        },
        clearExploreList: (state) => {
            state.explore.items = [];
            state.explore.total = 0;
            state.explore.page = 1;
            state.explore.hasMore = true;
        },
    },
    extraReducers: (builder) => {
        // --- Fetch Explore Developers ---
        builder
            .addCase(fetchExploreDevelopersThunk.pending, (state, action) => {
                if (action.meta.arg.isInitial) {
                    state.explore.isLoading = true;
                } else {
                    state.explore.isLoadingMore = true;
                }
                state.explore.error = null;
            })
            .addCase(fetchExploreDevelopersThunk.fulfilled, (state, action) => {
                state.explore.isLoading = false;
                state.explore.isLoadingMore = false;
                const { users, total, page, totalPages, isInitial } = action.payload;

                if (isInitial) {
                    state.explore.items = users;
                    state.explore.total = total;
                } else {
                    const existingIds = new Set(state.explore.items.map((u) => u.id || u.username));
                    const newItems = users.filter((u) => !existingIds.has(u.id || u.username));
                    state.explore.items = [...state.explore.items, ...newItems];
                }

                state.explore.page = page;
                state.explore.hasMore = page < totalPages && users.length > 0;
            })
            .addCase(fetchExploreDevelopersThunk.rejected, (state, action) => {
                state.explore.isLoading = false;
                state.explore.isLoadingMore = false;
                state.explore.error = (action.payload as string) || "Failed to load explore developers";
            });

        // --- Send Connection Request from Explore ---
        builder
            .addCase(sendExploreConnectionRequestThunk.fulfilled, (state, action) => {
                const { candidate } = action.payload;
                const targetKey = (candidate.id || candidate.username).toLowerCase();

                // 1. Remove developer immediately from explore list & decrement total
                const prevLen = state.explore.items.length;
                state.explore.items = state.explore.items.filter(
                    (d) => (d.id || "").toLowerCase() !== targetKey && d.username.toLowerCase() !== targetKey
                );
                if (state.explore.items.length < prevLen) {
                    state.explore.total = Math.max(0, state.explore.total - 1);
                }

                // 2. Add to outgoing requests in Redux
                const newOutgoing: PendingRequestItem = {
                    relationshipId: action.payload.response.relationshipId || `rel-${Date.now()}`,
                    userId: candidate.id,
                    username: candidate.username,
                    displayName: candidate.displayName,
                    avatarUrl: candidate.avatarUrl || candidate.photoUrl || null,
                    headline: candidate.headline || null,
                    college: candidate.college || null,
                    orbixScore: candidate.orbixScore || 0,
                    totalSolved: candidate.totalSolved || 0,
                    isVerifiedCoder: candidate.isVerifiedCoder === true,
                    type: "outgoing",
                    requestedAt: new Date().toISOString(),
                };

                const exists = state.requests.outgoing.some(
                    (r) => r.userId === candidate.id || r.username.toLowerCase() === candidate.username.toLowerCase()
                );
                if (!exists) {
                    state.requests.outgoing.unshift(newOutgoing);
                    state.requests.totalOutgoing += 1;
                }
            });

        // --- Fetch Connections ---
        builder
            .addCase(fetchConnectionsThunk.pending, (state) => {
                state.connections.isLoading = true;
                state.connections.error = null;
            })
            .addCase(fetchConnectionsThunk.fulfilled, (state, action) => {
                state.connections.isLoading = false;
                const { connections, totalCount, nextCursor, isInitial } = action.payload;
                if (isInitial) {
                    state.connections.items = connections;
                } else {
                    const existingKeys = new Set(state.connections.items.map((c) => c.relationshipId));
                    const newItems = connections.filter((c) => !existingKeys.has(c.relationshipId));
                    state.connections.items = [...state.connections.items, ...newItems];
                }
                state.connections.totalCount = totalCount;
                state.connections.nextCursor = nextCursor;
            })
            .addCase(fetchConnectionsThunk.rejected, (state, action) => {
                state.connections.isLoading = false;
                state.connections.error = (action.payload as string) || "Failed to load connections";
            });

        // --- Fetch Pending Requests ---
        builder
            .addCase(fetchPendingRequestsThunk.pending, (state) => {
                state.requests.isLoading = true;
                state.requests.error = null;
            })
            .addCase(fetchPendingRequestsThunk.fulfilled, (state, action) => {
                state.requests.isLoading = false;
                const { requests } = action.payload;
                state.requests.incoming = requests.filter((r) => r.type === "incoming");
                state.requests.outgoing = requests.filter((r) => r.type === "outgoing");
                state.requests.totalIncoming = state.requests.incoming.length;
                state.requests.totalOutgoing = state.requests.outgoing.length;
            })
            .addCase(fetchPendingRequestsThunk.rejected, (state, action) => {
                state.requests.isLoading = false;
                state.requests.error = (action.payload as string) || "Failed to load requests";
            });

        // --- Cancel Pending Request ---
        builder.addCase(cancelPendingRequestThunk.fulfilled, (state, action) => {
            const { relationshipId, targetUserId } = action.payload;
            const targetLower = targetUserId.toLowerCase();
            const initialLen = state.requests.outgoing.length;

            state.requests.outgoing = state.requests.outgoing.filter(
                (r) => r.relationshipId !== relationshipId && r.userId !== targetUserId && r.username.toLowerCase() !== targetLower
            );
            if (state.requests.outgoing.length < initialLen) {
                state.requests.totalOutgoing = Math.max(0, state.requests.totalOutgoing - 1);
            }
        });

        // --- Accept Pending Request ---
        builder.addCase(acceptPendingRequestThunk.fulfilled, (state, action) => {
            const { relationshipId, targetUserId, peerUser } = action.payload;
            const targetLower = targetUserId.toLowerCase();

            // Remove from incoming
            const initialIncomingLen = state.requests.incoming.length;
            state.requests.incoming = state.requests.incoming.filter(
                (r) => r.relationshipId !== relationshipId && r.userId !== targetUserId && r.username.toLowerCase() !== targetLower
            );
            if (state.requests.incoming.length < initialIncomingLen) {
                state.requests.totalIncoming = Math.max(0, state.requests.totalIncoming - 1);
            }

            // Add to connections list
            if (peerUser) {
                const newConnection: ConnectedUserItem = {
                    relationshipId,
                    connectedUserId: targetUserId,
                    username: peerUser.username,
                    displayName: peerUser.displayName,
                    avatarUrl: peerUser.avatarUrl,
                    headline: peerUser.headline,
                    college: peerUser.college,
                    connectedAt: new Date().toISOString(),
                };
                const exists = state.connections.items.some((c) => c.connectedUserId === targetUserId);
                if (!exists) {
                    state.connections.items.unshift(newConnection);
                    state.connections.totalCount += 1;
                }
            }
        });

        // --- Decline Pending Request ---
        builder.addCase(declinePendingRequestThunk.fulfilled, (state, action) => {
            const { relationshipId, targetUserId } = action.payload;
            const targetLower = targetUserId.toLowerCase();
            const initialLen = state.requests.incoming.length;

            state.requests.incoming = state.requests.incoming.filter(
                (r) => r.relationshipId !== relationshipId && r.userId !== targetUserId && r.username.toLowerCase() !== targetLower
            );
            if (state.requests.incoming.length < initialLen) {
                state.requests.totalIncoming = Math.max(0, state.requests.totalIncoming - 1);
            }
        });

        // --- Remove Connection ---
        builder.addCase(removeConnectionThunk.fulfilled, (state, action) => {
            const { relationshipId, targetUserId } = action.payload;
            const targetLower = targetUserId.toLowerCase();
            const initialLen = state.connections.items.length;

            state.connections.items = state.connections.items.filter(
                (c) => c.relationshipId !== relationshipId && c.connectedUserId !== targetUserId && c.username.toLowerCase() !== targetLower
            );
            if (state.connections.items.length < initialLen) {
                state.connections.totalCount = Math.max(0, state.connections.totalCount - 1);
            }
        });

        // --- Fetch Blocked Users ---
        builder
            .addCase(fetchBlockedUsersThunk.pending, (state) => {
                state.blocked.isLoading = true;
                state.blocked.error = null;
            })
            .addCase(fetchBlockedUsersThunk.fulfilled, (state, action) => {
                state.blocked.isLoading = false;
                const { blockedUsers, totalCount, nextCursor, isInitial } = action.payload;
                if (isInitial) {
                    state.blocked.items = blockedUsers;
                } else {
                    const existingKeys = new Set(state.blocked.items.map((b) => b.id));
                    const newItems = blockedUsers.filter((b) => !existingKeys.has(b.id));
                    state.blocked.items = [...state.blocked.items, ...newItems];
                }
                state.blocked.totalCount = totalCount;
                state.blocked.nextCursor = nextCursor;
            })
            .addCase(fetchBlockedUsersThunk.rejected, (state, action) => {
                state.blocked.isLoading = false;
                state.blocked.error = (action.payload as string) || "Failed to load blocked users";
            });

        // --- Block User ---
        builder.addCase(blockUserThunk.fulfilled, (state, action) => {
            const { targetUserId, userPreview } = action.payload;
            const targetLower = targetUserId.toLowerCase();

            // 1. Remove from explore
            const initExpLen = state.explore.items.length;
            state.explore.items = state.explore.items.filter(
                (d) => (d.id || "").toLowerCase() !== targetLower && d.username.toLowerCase() !== targetLower
            );
            if (state.explore.items.length < initExpLen) {
                state.explore.total = Math.max(0, state.explore.total - 1);
            }

            // 2. Remove from connections
            const initConnLen = state.connections.items.length;
            state.connections.items = state.connections.items.filter(
                (c) => (c.connectedUserId || "").toLowerCase() !== targetLower && (c.username || "").toLowerCase() !== targetLower
            );
            if (state.connections.items.length < initConnLen) {
                state.connections.totalCount = Math.max(0, state.connections.totalCount - 1);
            }

            // 3. Remove from requests
            state.requests.incoming = state.requests.incoming.filter(
                (r) => (r.userId || "").toLowerCase() !== targetLower && (r.username || "").toLowerCase() !== targetLower
            );
            state.requests.outgoing = state.requests.outgoing.filter(
                (r) => (r.userId || "").toLowerCase() !== targetLower && (r.username || "").toLowerCase() !== targetLower
            );
            state.requests.totalIncoming = state.requests.incoming.length;
            state.requests.totalOutgoing = state.requests.outgoing.length;

            // 4. Add to blocked
            if (userPreview) {
                const newBlocked: BlockedUserItem = {
                    id: `block-${Date.now()}`,
                    blockedId: targetUserId,
                    username: userPreview.username,
                    displayName: userPreview.displayName,
                    avatarUrl: userPreview.avatarUrl,
                    headline: userPreview.headline,
                    blockedAt: new Date().toISOString(),
                };
                const exists = state.blocked.items.some(
                    (b) => b.blockedId === targetUserId || b.username.toLowerCase() === userPreview.username.toLowerCase()
                );
                if (!exists) {
                    state.blocked.items.unshift(newBlocked);
                    state.blocked.totalCount += 1;
                }
            }
        });

        // --- Unblock User ---
        builder.addCase(unblockUserThunk.fulfilled, (state, action) => {
            const { targetUserId } = action.payload;
            const targetLower = targetUserId.toLowerCase();
            const initLen = state.blocked.items.length;

            state.blocked.items = state.blocked.items.filter(
                (b) => b.blockedId !== targetUserId && b.username.toLowerCase() !== targetLower
            );
            if (state.blocked.items.length < initLen) {
                state.blocked.totalCount = Math.max(0, state.blocked.totalCount - 1);
            }
        });
    },
});

export const {
    setActiveNetworkTab,
    setRequestsSubTab,
    removeExploreDeveloper,
    clearExploreList,
} = networkSlice.actions;

export default networkSlice.reducer;
