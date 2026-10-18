import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface ContestHistoryPoint {
    contestId: string | number;
    contestName: string;
    date: string;
    timestamp: number;
    rating: number;
    ratingBefore?: number | null;
    ratingChange?: number | null;
    rank?: number | null;
    division?: string | null;
    problemsSolved?: number | null;
    totalProblems?: number | null;
}

export interface PlatformTierInfo {
    name: string;
    color: string;
    badgeBg?: string;
    description?: string;
    nextTierName?: string | null;
    pointsToNextTier?: number | null;
    progressPercent?: number | null;
}

export interface PlatformContestAnalytics {
    portal: string;
    portalName: string;
    portalUsername: string;
    profileUrl: string;
    connected: boolean;
    currentRating: number | null;
    peakRating: number | null;
    tier: string | null;
    tierColor: string | null;
    tierInfo: PlatformTierInfo | null;
    officialRank: number | null;
    percentile?: number | null;
    ratedContestsCount: number;
    history: ContestHistoryPoint[];
    recentChange90d?: number | null;
    lastSyncAt: string;
    status: "valid" | "no_contests" | "history_unavailable" | "syncing" | "error" | "not_connected";
    statusMessage?: string;
    exploreContestsUrl: string;
}

export interface UnifiedRecentContestItem {
    portal: string;
    portalName: string;
    contestId: string;
    contestName: string;
    contestUrl: string;
    date: string;
    timestamp: number;
    rank: number | null;
    rating: number;
    ratingBefore?: number | null;
    ratingChange?: number | null;
    division?: string | null;
    problemsSolved?: number | null;
    totalProblems?: number | null;
}

export interface UnifiedContestData {
    username: string;
    timestamp: string;
    platforms: PlatformContestAnalytics[];
    recentContests?: UnifiedRecentContestItem[];
    summary: {
        totalRatedContests: number;
        platformContestCounts: Record<string, number>;
    };
}

export interface ContestsState {
    dataByUser: Record<string, UnifiedContestData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

// Local storage caching for zero-flicker rehydration across page refreshes
const getStoredContests = (): Record<string, UnifiedContestData> => {
    try {
        const stored = localStorage.getItem("orbix_unified_contests");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredContests = (data: Record<string, UnifiedContestData>) => {
    try {
        localStorage.setItem("orbix_unified_contests", JSON.stringify(data));
    } catch {
        // Safe fallback if quota exceeded
    }
};

const initialData = getStoredContests();

const initialState: ContestsState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {},
};

export const fetchContestPerformance = createAsyncThunk<
    UnifiedContestData,
    { username: string; force?: boolean; portals?: Record<string, any> },
    { state: { contests: ContestsState }; rejectValue: string }
>(
    "contests/fetchUnified",
    async ({ username, force = false, portals }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim();
        if (!effectiveUser) {
            return rejectWithValue("Username is required to fetch contest performance");
        }
        const state = getState().contests;
        const existing = state.dataByUser[effectiveUser] || state.dataByUser[effectiveUser.toLowerCase()];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || state.lastFetchedAtByUser[effectiveUser.toLowerCase()] || 0;
        const now = Date.now();

        // Check if client portals differ from existing cached platforms (platforms added, removed, or handles edited)
        let portalsMismatched = false;
        if (portals && typeof portals === "object") {
            const clientActive = Object.entries(portals)
                .map(([k, v]) => [k.toLowerCase().trim(), (typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "")).trim()] as const)
                .filter(([k, u]) => k !== "github" && !k.startsWith("_") && k !== "theme" && Boolean(u));

            const existingActive = (existing?.platforms || []).filter((p) => p.connected && p.portalUsername);

            if (clientActive.length !== existingActive.length) {
                portalsMismatched = true;
            } else {
                for (const [k, u] of clientActive) {
                    const match = existingActive.find((p) => p.portal.toLowerCase() === k);
                    if (!match || match.portalUsername.toLowerCase() !== u.toLowerCase()) {
                        portalsMismatched = true;
                        break;
                    }
                }
            }
        }

        // Invalidate old cache if it contained unconnected platforms
        const hasUnconnectedInCache = existing?.platforms?.some((p) => !p.connected || p.status === "not_connected");

        if (existing && !force && !portalsMismatched && !hasUnconnectedInCache && now - lastFetched < 10 * 60 * 1000) {
            return existing;
        }

        let portalsQuery = "";
        if (portals && typeof portals === "object") {
            const simplified: Record<string, string> = {};
            for (const [k, v] of Object.entries(portals)) {
                const u = typeof v === "object" ? v?.username || v?.portalUsername || "" : String(v || "");
                if (u && k !== "github" && !k.startsWith("_") && k !== "theme") simplified[k.toLowerCase().trim()] = u.trim();
            }
            if (Object.keys(simplified).length > 0) {
                portalsQuery = `&portals=${encodeURIComponent(JSON.stringify(simplified))}`;
            }
        }

        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token") || "";
        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

        const endpoints = [
            `/api/portals/contests?username=${encodeURIComponent(effectiveUser)}${force || portalsMismatched ? "&refresh=true" : ""}${portalsQuery}`,
            `http://localhost:3000/api/portals/contests?username=${encodeURIComponent(effectiveUser)}${force || portalsMismatched ? "&refresh=true" : ""}${portalsQuery}`,
        ];

        let lastError = "Failed to fetch contest performance";
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    headers: reqHeaders,
                    signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        return {
                            username: effectiveUser,
                            timestamp: data.timestamp || new Date().toISOString(),
                            platforms: data.platforms || [],
                            recentContests: data.recentContests || [],
                            summary: data.summary || {
                                totalRatedContests: 0,
                                platformContestCounts: {},
                            },
                        };
                    }
                    lastError = data.message || lastError;
                }
            } catch (err: any) {
                lastError = err.message || lastError;
            }
        }

        return rejectWithValue(lastError);
    }
);

export const contestsSlice = createSlice({
    name: "contests",
    initialState,
    reducers: {
        clearContestsCache: (state, action: PayloadAction<string | undefined>) => {
            const user = action.payload?.trim();
            if (user) {
                delete state.dataByUser[user];
                delete state.dataByUser[user.toLowerCase()];
                delete state.lastFetchedAtByUser[user];
                delete state.lastFetchedAtByUser[user.toLowerCase()];
                delete state.errorByUser[user];
                delete state.errorByUser[user.toLowerCase()];
            } else {
                state.dataByUser = {};
                state.lastFetchedAtByUser = {};
                state.errorByUser = {};
            }
            saveStoredContests(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchContestPerformance.pending, (state, action) => {
                const user = (action.meta.arg.username || "").trim();
                if (user) {
                    state.loadingByUser[user] = true;
                    state.errorByUser[user] = null;
                }
            })
            .addCase(fetchContestPerformance.fulfilled, (state, action) => {
                const user = action.payload.username;
                if (user) {
                    state.loadingByUser[user] = false;
                    state.dataByUser[user] = action.payload;
                    state.lastFetchedAtByUser[user] = Date.now();
                    state.errorByUser[user] = null;
                    saveStoredContests(state.dataByUser);
                }
            })
            .addCase(fetchContestPerformance.rejected, (state, action) => {
                const user = (action.meta.arg.username || "").trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.errorByUser[user] = action.payload || "Failed to load contest performance";
                }
            });
    },
});

export const { clearContestsCache } = contestsSlice.actions;
export default contestsSlice.reducer;
