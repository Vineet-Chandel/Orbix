import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { apiFetch } from "../api/apiClient";
import type {
    LeaderboardEntry,
    LeaderboardMetadata,
    LeaderboardResponse,
    CollegeLeaderboardResponse,
    ParticipatingCollege,
} from "../app/Leaderboard/types";

// Cache TTL configuration
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache validity
const PARTICIPATING_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache validity

export interface LeaderboardCachePayload {
    podium: LeaderboardEntry[];
    entries: LeaderboardEntry[];
    metadata: LeaderboardMetadata | null;
    currentUser: LeaderboardEntry | null;
    collegesRepresentedCount?: number;
    collegeMeta?: {
        id: string;
        name: string;
        code?: string | null;
        city?: string | null;
        country?: string | null;
        totalStudents?: number;
    } | null;
    cachedAt: number;
}

export interface LeaderboardState {
    activeTab: "global" | "college";
    selectedCollege: ParticipatingCollege | null;
    page: number;
    limit: number;
    period: string;
    filter: "all" | "verified";
    searchQuery: string;
    debouncedSearch: string;

    // Fast-access in-memory caches
    globalCache: Record<string, LeaderboardCachePayload>;
    collegeCache: Record<string, LeaderboardCachePayload>;

    // Participating Colleges list
    participatingColleges: ParticipatingCollege[];
    collegesRepresentedCount: number;
    participatingCollegesFetchedAt: number | null;
    isParticipatingLoading: boolean;

    // Loading states
    isGlobalLoading: boolean;
    isCollegeLoading: boolean;
    isSyncing: boolean;
    error: string | null;
}

// Helper to load persisted cache for instant zero-flicker rehydration
const loadPersistedCache = <T>(key: string, defaultValue: T): T => {
    try {
        const raw = sessionStorage.getItem(key);
        if (raw) {
            const parsed = JSON.parse(raw);
            return parsed || defaultValue;
        }
    } catch {
        // Fallback to default
    }
    return defaultValue;
};

// Helper to save cache in sessionStorage
const savePersistedCache = (key: string, value: any) => {
    try {
        sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Storage limit safely ignored
    }
};

const initialGlobalCache = loadPersistedCache<Record<string, LeaderboardCachePayload>>("orbix_lb_global_cache", {});
const initialCollegeCache = loadPersistedCache<Record<string, LeaderboardCachePayload>>("orbix_lb_college_cache", {});
const initialParticipating = loadPersistedCache<ParticipatingCollege[]>("orbix_lb_participating", []);
const initialCollegesCount = loadPersistedCache<number>("orbix_lb_colleges_count", 0);

const initialState: LeaderboardState = {
    activeTab: "global",
    selectedCollege: null,
    page: 1,
    limit: 20,
    period: "all_time",
    filter: "all",
    searchQuery: "",
    debouncedSearch: "",

    globalCache: initialGlobalCache,
    collegeCache: initialCollegeCache,

    participatingColleges: initialParticipating,
    collegesRepresentedCount: initialCollegesCount,
    participatingCollegesFetchedAt: initialParticipating.length > 0 ? Date.now() : null,
    isParticipatingLoading: false,

    isGlobalLoading: false,
    isCollegeLoading: false,
    isSyncing: false,
    error: null,
};

// Generates a deterministic key for global leaderboard caching
export const getGlobalCacheKey = (page: number, limit: number, period: string, filter: string, search: string, user: string | null) => {
    return `p${page}_l${limit}_pr${period}_f${filter}_s${(search || "").trim().toLowerCase()}_u${(user || "").trim().toLowerCase()}`;
};

// Generates a deterministic key for college leaderboard caching
export const getCollegeCacheKey = (collegeId: string, page: number, limit: number, period: string, filter: string, search: string, user: string | null) => {
    return `${collegeId}_p${page}_l${limit}_pr${period}_f${filter}_s${(search || "").trim().toLowerCase()}_u${(user || "").trim().toLowerCase()}`;
};

/**
 * Async Thunk: Fetch Global Leaderboard with Client-Side Caching
 */
export const fetchGlobalLeaderboard = createAsyncThunk<
    { cacheKey: string; data: LeaderboardCachePayload; fromCache: boolean },
    {
        page?: number;
        limit?: number;
        period?: string;
        filter?: "all" | "verified";
        search?: string;
        user?: string | null;
        forceRefresh?: boolean;
    },
    { state: { leaderboard: LeaderboardState }; rejectValue: string }
>(
    "leaderboard/fetchGlobal",
    async (params, { getState, rejectWithValue }) => {
        const {
            page = 1,
            limit = 20,
            period = "all_time",
            filter = "all",
            search = "",
            user = null,
            forceRefresh = false,
        } = params;

        const cacheKey = getGlobalCacheKey(page, limit, period, filter, search, user);
        const state = getState().leaderboard;
        const cached = state.globalCache[cacheKey];

        // 1. Check client-side Redux cache for zero-latency return
        if (cached && !forceRefresh && (Date.now() - cached.cachedAt < CACHE_TTL_MS)) {
            return { cacheKey, data: cached, fromCache: true };
        }

        // 2. Fetch from Backend API
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                period,
            });

            if (filter === "verified") {
                queryParams.set("filter", "verified");
            }
            if (search.trim()) {
                queryParams.set("search", search.trim());
            }
            if (user) {
                queryParams.set("user", user);
            }

            const response = await apiFetch<LeaderboardResponse>(`/api/leaderboard/global?${queryParams.toString()}`);

            if (!response || !response.success) {
                return rejectWithValue("Failed to fetch global leaderboard");
            }

            // Find current user rank if not explicitly provided
            let currentUser = response.currentUser || null;
            if (!currentUser && user && response.entries) {
                const uLower = user.toLowerCase();
                currentUser =
                    response.entries.find((e) => e.username?.toLowerCase() === uLower) ||
                    response.podium?.find((e) => e.username?.toLowerCase() === uLower) ||
                    null;
            }

            const payload: LeaderboardCachePayload = {
                podium: response.podium || [],
                entries: response.entries || [],
                metadata: response.metadata || null,
                currentUser,
                collegesRepresentedCount: response.collegesRepresentedCount,
                cachedAt: Date.now(),
            };

            return { cacheKey, data: payload, fromCache: false };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching global leaderboard");
        }
    }
);

/**
 * Async Thunk: Fetch College Leaderboard with Client-Side Caching
 */
export const fetchCollegeLeaderboard = createAsyncThunk<
    { cacheKey: string; data: LeaderboardCachePayload; fromCache: boolean },
    {
        collegeId: string;
        page?: number;
        limit?: number;
        period?: string;
        filter?: "all" | "verified";
        search?: string;
        user?: string | null;
        forceRefresh?: boolean;
    },
    { state: { leaderboard: LeaderboardState }; rejectValue: string }
>(
    "leaderboard/fetchCollege",
    async (params, { getState, rejectWithValue }) => {
        const {
            collegeId,
            page = 1,
            limit = 20,
            period = "all_time",
            filter = "all",
            search = "",
            user = null,
            forceRefresh = false,
        } = params;

        if (!collegeId) {
            return rejectWithValue("College ID is required to fetch college standings");
        }

        const cacheKey = getCollegeCacheKey(collegeId, page, limit, period, filter, search, user);
        const state = getState().leaderboard;
        const cached = state.collegeCache[cacheKey];

        // 1. Check client-side Redux cache for zero-latency return
        if (cached && !forceRefresh && (Date.now() - cached.cachedAt < CACHE_TTL_MS)) {
            return { cacheKey, data: cached, fromCache: true };
        }

        // 2. Fetch from Backend API
        try {
            const queryParams = new URLSearchParams({
                page: String(page),
                limit: String(limit),
                period,
            });

            if (filter === "verified") {
                queryParams.set("filter", "verified");
            }
            if (search.trim()) {
                queryParams.set("search", search.trim());
            }
            if (user) {
                queryParams.set("user", user);
            }

            const response = await apiFetch<CollegeLeaderboardResponse>(
                `/api/leaderboard/colleges/${encodeURIComponent(collegeId)}?${queryParams.toString()}`
            );

            if (!response || !response.success) {
                return rejectWithValue("Failed to fetch college leaderboard");
            }

            // Find current user rank if not explicitly provided
            let currentUser = response.currentUser || null;
            if (!currentUser && user && response.entries) {
                const uLower = user.toLowerCase();
                currentUser =
                    response.entries.find((e) => e.username?.toLowerCase() === uLower) ||
                    response.podium?.find((e) => e.username?.toLowerCase() === uLower) ||
                    null;
            }

            const collegeMeta = response.college
                ? {
                      id: response.college.id,
                      name: response.college.name,
                      code: response.college.code,
                      city: response.college.city,
                      country: response.college.country,
                      totalStudents: response.totalStudents,
                  }
                : null;

            const payload: LeaderboardCachePayload = {
                podium: response.podium || [],
                entries: response.entries || [],
                metadata: response.metadata || null,
                currentUser,
                collegesRepresentedCount: response.collegesRepresentedCount,
                collegeMeta,
                cachedAt: Date.now(),
            };

            return { cacheKey, data: payload, fromCache: false };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching college leaderboard");
        }
    }
);

/**
 * Async Thunk: Fetch Participating Colleges List
 */
export const fetchParticipatingColleges = createAsyncThunk<
    { colleges: ParticipatingCollege[]; count: number; fromCache: boolean },
    { forceRefresh?: boolean } | undefined,
    { state: { leaderboard: LeaderboardState }; rejectValue: string }
>(
    "leaderboard/fetchParticipatingColleges",
    async (options, { getState, rejectWithValue }) => {
        const forceRefresh = options?.forceRefresh || false;
        const state = getState().leaderboard;

        if (
            !forceRefresh &&
            state.participatingColleges.length > 0 &&
            state.participatingCollegesFetchedAt &&
            Date.now() - state.participatingCollegesFetchedAt < PARTICIPATING_CACHE_TTL_MS
        ) {
            return {
                colleges: state.participatingColleges,
                count: state.collegesRepresentedCount,
                fromCache: true,
            };
        }

        try {
            const data = await apiFetch<{ success: boolean; colleges: ParticipatingCollege[]; count?: number }>(
                "/api/leaderboard/colleges/participating"
            );

            if (data && data.success && Array.isArray(data.colleges)) {
                const count = data.count ?? data.colleges.length;
                savePersistedCache("orbix_lb_participating", data.colleges);
                savePersistedCache("orbix_lb_colleges_count", count);
                return { colleges: data.colleges, count, fromCache: false };
            }
            return rejectWithValue("Failed to fetch participating colleges");
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching participating colleges");
        }
    }
);

/**
 * Async Thunk: Sync Leaderboard Now (Server Recalculation + Cache Purge)
 */
export const syncLeaderboardNow = createAsyncThunk<
    void,
    void,
    { dispatch: any; rejectValue: string }
>(
    "leaderboard/syncNow",
    async (_, { dispatch, rejectWithValue }) => {
        try {
            const res = await apiFetch<{ success: boolean }>("/api/leaderboard/sync", {
                method: "POST",
            });

            if (!res || !res.success) {
                return rejectWithValue("Sync request failed or server requires authentication");
            }

            // Invalidate Redux and session caches
            dispatch(clearLeaderboardCache());
        } catch (err: any) {
            return rejectWithValue(err.message || "Failed to trigger leaderboard sync");
        }
    }
);

export const leaderboardSlice = createSlice({
    name: "leaderboard",
    initialState,
    reducers: {
        setActiveTab: (state, action: PayloadAction<"global" | "college">) => {
            state.activeTab = action.payload;
            state.page = 1;
            state.searchQuery = "";
            state.debouncedSearch = "";
            state.error = null;
        },
        setSelectedCollege: (state, action: PayloadAction<ParticipatingCollege | null>) => {
            state.selectedCollege = action.payload;
            state.page = 1;
            state.searchQuery = "";
            state.debouncedSearch = "";
            state.error = null;
        },
        setPage: (state, action: PayloadAction<number>) => {
            state.page = action.payload;
        },
        setSearchQuery: (state, action: PayloadAction<string>) => {
            state.searchQuery = action.payload;
        },
        setDebouncedSearch: (state, action: PayloadAction<string>) => {
            state.debouncedSearch = action.payload;
            state.page = 1;
        },
        setFilter: (state, action: PayloadAction<"all" | "verified">) => {
            state.filter = action.payload;
            state.page = 1;
        },
        clearLeaderboardCache: (state) => {
            state.globalCache = {};
            state.collegeCache = {};
            sessionStorage.removeItem("orbix_lb_global_cache");
            sessionStorage.removeItem("orbix_lb_college_cache");
        },
    },
    extraReducers: (builder) => {
        // Fetch Global Leaderboard
        builder.addCase(fetchGlobalLeaderboard.pending, (state, action) => {
            const { page = 1, limit = 20, period = "all_time", filter = "all", search = "", user = null } = action.meta.arg;
            const cacheKey = getGlobalCacheKey(page, limit, period, filter, search, user);
            // Only set loading true if data is NOT already in cache
            if (!state.globalCache[cacheKey]) {
                state.isGlobalLoading = true;
            }
            state.error = null;
        });
        builder.addCase(fetchGlobalLeaderboard.fulfilled, (state, action) => {
            const { cacheKey, data } = action.payload;
            state.globalCache[cacheKey] = data;
            state.isGlobalLoading = false;
            state.error = null;
            savePersistedCache("orbix_lb_global_cache", state.globalCache);
        });
        builder.addCase(fetchGlobalLeaderboard.rejected, (state, action) => {
            state.isGlobalLoading = false;
            state.error = action.payload || "Failed to load global leaderboard";
        });

        // Fetch College Leaderboard
        builder.addCase(fetchCollegeLeaderboard.pending, (state, action) => {
            const { collegeId, page = 1, limit = 20, period = "all_time", filter = "all", search = "", user = null } = action.meta.arg;
            const cacheKey = getCollegeCacheKey(collegeId, page, limit, period, filter, search, user);
            // Only set loading true if data is NOT already in cache
            if (!state.collegeCache[cacheKey]) {
                state.isCollegeLoading = true;
            }
            state.error = null;
        });
        builder.addCase(fetchCollegeLeaderboard.fulfilled, (state, action) => {
            const { cacheKey, data } = action.payload;
            state.collegeCache[cacheKey] = data;
            state.isCollegeLoading = false;
            state.error = null;
            savePersistedCache("orbix_lb_college_cache", state.collegeCache);
        });
        builder.addCase(fetchCollegeLeaderboard.rejected, (state, action) => {
            state.isCollegeLoading = false;
            state.error = action.payload || "Failed to load college leaderboard";
        });

        // Fetch Participating Colleges
        builder.addCase(fetchParticipatingColleges.pending, (state) => {
            if (state.participatingColleges.length === 0) {
                state.isParticipatingLoading = true;
            }
        });
        builder.addCase(fetchParticipatingColleges.fulfilled, (state, action) => {
            state.participatingColleges = action.payload.colleges;
            state.collegesRepresentedCount = action.payload.count;
            state.participatingCollegesFetchedAt = Date.now();
            state.isParticipatingLoading = false;
        });
        builder.addCase(fetchParticipatingColleges.rejected, (state) => {
            state.isParticipatingLoading = false;
        });

        // Sync Now
        builder.addCase(syncLeaderboardNow.pending, (state) => {
            state.isSyncing = true;
        });
        builder.addCase(syncLeaderboardNow.fulfilled, (state) => {
            state.isSyncing = false;
        });
        builder.addCase(syncLeaderboardNow.rejected, (state, action) => {
            state.isSyncing = false;
            state.error = action.payload || "Sync failed";
        });
    },
});

export const {
    setActiveTab,
    setSelectedCollege,
    setPage,
    setSearchQuery,
    setDebouncedSearch,
    setFilter,
    clearLeaderboardCache,
} = leaderboardSlice.actions;

export default leaderboardSlice.reducer;
