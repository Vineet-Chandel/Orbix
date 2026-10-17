import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type { PlatformSubmissionStat } from "../utils/submissionsAggregator";

export interface UnifiedDevelopmentData {
    username: string;
    totalContributions: number;
    totalSubmissions: number;
    activeDays: number;
    dayStreak: number;
    platformBreakdown: Record<string, PlatformSubmissionStat>;
    dailyMerged: Record<string, { count: number; platforms: string[] }>;
    connectedPlatformsCount: number;
    timestamp?: string;
}

export interface DevelopmentState {
    dataByUser: Record<string, UnifiedDevelopmentData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

// Local storage caching for zero-flicker instant hydration
const getStoredDevelopment = (): Record<string, UnifiedDevelopmentData> => {
    try {
        const stored = localStorage.getItem("orbix_unified_development");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredDevelopment = (data: Record<string, UnifiedDevelopmentData>) => {
    try {
        localStorage.setItem("orbix_unified_development", JSON.stringify(data));
    } catch {
        // Safe fallback
    }
};

const initialData = getStoredDevelopment();

const initialState: DevelopmentState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {},
};

export const fetchUnifiedDevelopment = createAsyncThunk<
    UnifiedDevelopmentData,
    { username: string; force?: boolean },
    { state: { development: DevelopmentState }; rejectValue: string }
>(
    "development/fetchUnified",
    async ({ username, force = false }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim() || "vineet_chandel";
        const state = getState().development;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        // If existing data is present and not force-refreshing and fetched within 15 minutes, return existing
        if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        try {
            const res = await fetch(
                `http://localhost:3000/api/portals/development/unified?username=${encodeURIComponent(
                    effectiveUser
                )}${force ? "&refresh=true" : ""}`
            );
            if (!res.ok) {
                return rejectWithValue(`HTTP error ${res.status}`);
            }
            const data = await res.json();
            if (!data.success) {
                return rejectWithValue(data.message || "Failed to fetch unified development contributions");
            }
            return {
                username: effectiveUser,
                totalContributions: data.totalContributions || data.totalSubmissions || 0,
                totalSubmissions: data.totalSubmissions || data.totalContributions || 0,
                activeDays: data.activeDays || 0,
                dayStreak: data.dayStreak || 0,
                platformBreakdown: data.platformBreakdown || {},
                dailyMerged: data.dailyMerged || {},
                connectedPlatformsCount:
                    data.connectedPlatformsCount ||
                    Object.keys(data.platformBreakdown || {}).length,
                timestamp: data.timestamp || new Date().toISOString(),
            };
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching development contributions");
        }
    },
    {
        // Prevent duplicate network calls
        condition: ({ username, force = false }, { getState }) => {
            const effectiveUser = username.trim() || "vineet_chandel";
            const state = getState().development;
            const isLoading = state?.loadingByUser?.[effectiveUser];
            if (isLoading) return false;
            return true;
        },
    }
);

export const developmentSlice = createSlice({
    name: "development",
    initialState,
    reducers: {
        setDevelopmentData: (
            state,
            action: PayloadAction<{ username: string; data: UnifiedDevelopmentData }>
        ) => {
            const { username, data } = action.payload;
            state.dataByUser[username] = data;
            state.lastFetchedAtByUser[username] = Date.now();
            state.errorByUser[username] = null;
            saveStoredDevelopment(state.dataByUser);
        },
        clearDevelopmentCache: (state, action: PayloadAction<string | undefined>) => {
            if (action.payload) {
                delete state.dataByUser[action.payload];
                delete state.lastFetchedAtByUser[action.payload];
                delete state.loadingByUser[action.payload];
                delete state.errorByUser[action.payload];
            } else {
                state.dataByUser = {};
                state.lastFetchedAtByUser = {};
                state.loadingByUser = {};
                state.errorByUser = {};
            }
            saveStoredDevelopment(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUnifiedDevelopment.pending, (state, action) => {
                const user = action.meta.arg.username.trim() || "vineet_chandel";
                state.loadingByUser[user] = true;
                state.errorByUser[user] = null;
            })
            .addCase(fetchUnifiedDevelopment.fulfilled, (state, action) => {
                const user = action.meta.arg.username.trim() || "vineet_chandel";
                state.loadingByUser[user] = false;
                state.dataByUser[user] = action.payload;
                state.lastFetchedAtByUser[user] = Date.now();
                state.errorByUser[user] = null;
                saveStoredDevelopment(state.dataByUser);
            })
            .addCase(fetchUnifiedDevelopment.rejected, (state, action) => {
                const user = action.meta.arg.username.trim() || "vineet_chandel";
                state.loadingByUser[user] = false;
                state.errorByUser[user] = action.payload || "Failed to load development contributions";
            });
    },
});

export const { setDevelopmentData, clearDevelopmentCache } = developmentSlice.actions;
export default developmentSlice.reducer;
