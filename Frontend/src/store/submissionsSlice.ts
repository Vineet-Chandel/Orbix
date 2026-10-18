import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { PlatformSubmissionStat } from "../utils/submissionsAggregator";

export interface UnifiedSubmissionsData {
    username: string;
    totalSubmissions: number;
    activeDays: number;
    dayStreak: number;
    platformBreakdown: Record<string, PlatformSubmissionStat>;
    dailyMerged: Record<string, { count: number; platforms: string[] }>;
    connectedPlatformsCount: number;
    timestamp?: string;
}

export interface SubmissionsState {
    dataByUser: Record<string, UnifiedSubmissionsData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

// Local storage caching for zero-flicker rehydration across page refreshes
const getStoredSubmissions = (): Record<string, UnifiedSubmissionsData> => {
    try {
        const stored = localStorage.getItem("orbix_unified_submissions");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredSubmissions = (data: Record<string, UnifiedSubmissionsData>) => {
    try {
        localStorage.setItem("orbix_unified_submissions", JSON.stringify(data));
    } catch {
        // Safe fallback if quota exceeded
    }
};

const initialData = getStoredSubmissions();

const initialState: SubmissionsState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {},
};

export const fetchUnifiedSubmissions = createAsyncThunk<
    UnifiedSubmissionsData,
    { username: string; force?: boolean; portals?: Record<string, any> },
    { state: { submissions: SubmissionsState }; rejectValue: string }
>(
    "submissions/fetchUnified",
    async ({ username, force = false, portals }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim();
        if (!effectiveUser) {
            return rejectWithValue("Username is required to fetch unified submissions");
        }
        const state = getState().submissions;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        // Extract simplified map of connected non-github portals
        const clientPortalsRecord: Record<string, string> = {};
        if (portals && typeof portals === "object") {
            for (const [k, v] of Object.entries(portals)) {
                const lk = k.toLowerCase().trim();
                if (lk === "github" || lk.startsWith("_") || lk === "theme") continue;
                const u = typeof v === "object" ? (v?.username || v?.portal_username || "") : String(v || "");
                if (u.trim()) clientPortalsRecord[lk] = u.trim();
            }
        }

        // Check if there is any mismatch between connected client platforms and cached data
        let hasPortalMismatch = false;
        if (portals && typeof portals === "object") {
            const clientKeys = Object.keys(clientPortalsRecord);
            const cachedKeys = Object.keys(existing?.platformBreakdown || {}).filter((k) => k !== "github");

            const hasMissing = clientKeys.some(
                (k) => !cachedKeys.includes(k) || (existing?.platformBreakdown?.[k]?.username?.toLowerCase() !== clientPortalsRecord[k].toLowerCase())
            );
            const hasRemoved = cachedKeys.some((k) => !clientKeys.includes(k));

            if (hasMissing || hasRemoved) {
                hasPortalMismatch = true;
            }
        }

        // If existing data is present, not force-refreshing, no portal mismatch, and fresh within 15 minutes, return existing
        if (existing && !force && !hasPortalMismatch && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        let portalsQuery = "";
        if (Object.keys(clientPortalsRecord).length > 0) {
            const str = Object.entries(clientPortalsRecord).map(([k, v]) => `${k}:${v}`).join(",");
            portalsQuery = `&portals=${encodeURIComponent(str)}`;
        }

        const isRefreshing = force || hasPortalMismatch;
        const endpoints = [
            `/api/portals/submissions/unified?username=${encodeURIComponent(effectiveUser)}${isRefreshing ? "&refresh=true" : ""}${portalsQuery}`,
            `http://localhost:3000/api/portals/submissions/unified?username=${encodeURIComponent(effectiveUser)}${isRefreshing ? "&refresh=true" : ""}${portalsQuery}`,
        ];

        let authToken = "";
        try {
            authToken = localStorage.getItem("orbix_token") || "";
        } catch {
            // ignore
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

        let lastError = "Failed to fetch unified submissions";

        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    headers,
                    credentials: "include",
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.success) {
                        return {
                            username: effectiveUser,
                            totalSubmissions: data.totalSubmissions || 0,
                            activeDays: data.activeDays || 0,
                            dayStreak: data.dayStreak || 0,
                            platformBreakdown: data.platformBreakdown || {},
                            dailyMerged: data.dailyMerged || {},
                            connectedPlatformsCount:
                                data.connectedPlatformsCount ||
                                Object.keys(data.platformBreakdown || {}).length,
                            timestamp: data.timestamp || new Date().toISOString(),
                        };
                    }
                }
            } catch (err: any) {
                lastError = err?.message || lastError;
            }
        }

        return rejectWithValue(lastError);
    },
    {
        // Allow fetch if force or portal mismatch detected; prevent infinite duplicate requests
        condition: ({ username, force = false, portals }, { getState }) => {
            const effectiveUser = username.trim();
            if (!effectiveUser) return false;
            const state = getState().submissions;
            if (state.loadingByUser[effectiveUser]) {
                return false;
            }
            if (force) return true;

            const existing = state.dataByUser[effectiveUser];
            const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
            const now = Date.now();

            if (portals && typeof portals === "object") {
                const clientPortalsRecord: Record<string, string> = {};
                for (const [k, v] of Object.entries(portals)) {
                    const lk = k.toLowerCase().trim();
                    if (lk === "github" || lk.startsWith("_") || lk === "theme") continue;
                    const u = typeof v === "object" ? (v?.username || v?.portal_username || "") : String(v || "");
                    if (u.trim()) clientPortalsRecord[lk] = u.trim();
                }
                const clientKeys = Object.keys(clientPortalsRecord);
                const cachedKeys = Object.keys(existing?.platformBreakdown || {}).filter((k) => k !== "github");
                const hasMissing = clientKeys.some(
                    (k) => !cachedKeys.includes(k) || (existing?.platformBreakdown?.[k]?.username?.toLowerCase() !== clientPortalsRecord[k].toLowerCase())
                );
                const hasRemoved = cachedKeys.some((k) => !clientKeys.includes(k));
                if (hasMissing || hasRemoved) {
                    return true;
                }
            }

            if (existing && now - lastFetched < 15 * 60 * 1000) {
                return false;
            }
            return true;
        },
    }
);

export const submissionsSlice = createSlice({
    name: "submissions",
    initialState,
    reducers: {
        setSubmissionsData: (state, action: PayloadAction<UnifiedSubmissionsData>) => {
            const user = action.payload.username;
            state.dataByUser[user] = action.payload;
            state.lastFetchedAtByUser[user] = Date.now();
            saveStoredSubmissions(state.dataByUser);
        },
        invalidateSubmissions: (state, action: PayloadAction<string | undefined>) => {
            if (action.payload) {
                const user = action.payload;
                delete state.dataByUser[user];
                delete state.lastFetchedAtByUser[user];
                delete state.loadingByUser[user];
                delete state.errorByUser[user];
            } else {
                state.dataByUser = {};
                state.lastFetchedAtByUser = {};
                state.loadingByUser = {};
                state.errorByUser = {};
            }
            saveStoredSubmissions(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUnifiedSubmissions.pending, (state, action) => {
                const user = (action.meta.arg.username || "").trim();
                if (user) {
                    state.loadingByUser[user] = true;
                    state.errorByUser[user] = null;
                }
            })
            .addCase(fetchUnifiedSubmissions.fulfilled, (state, action) => {
                const user = action.payload.username;
                if (user) {
                    state.loadingByUser[user] = false;
                    state.dataByUser[user] = action.payload;
                    state.lastFetchedAtByUser[user] = Date.now();
                    saveStoredSubmissions(state.dataByUser);
                }
            })
            .addCase(fetchUnifiedSubmissions.rejected, (state, action) => {
                const user = (action.meta.arg.username || "").trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.errorByUser[user] = (action.payload as string) || "Failed to load submissions";
                }
            });
    },
});

export const { setSubmissionsData, invalidateSubmissions } = submissionsSlice.actions;
export default submissionsSlice.reducer;
