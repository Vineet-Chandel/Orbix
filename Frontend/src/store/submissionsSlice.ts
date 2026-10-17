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
    { username: string; force?: boolean },
    { state: { submissions: SubmissionsState }; rejectValue: string }
>(
    "submissions/fetchUnified",
    async ({ username, force = false }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim() || "vineet_chandel";
        const state = getState().submissions;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        // If existing data is present and not force-refreshing and fetched within 15 minutes, return existing
        if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        try {
            const res = await fetch(
                `http://localhost:3000/api/portals/submissions/unified?username=${encodeURIComponent(
                    effectiveUser
                )}${force ? "&refresh=true" : ""}`
            );
            if (!res.ok) {
                return rejectWithValue(`HTTP error ${res.status}`);
            }
            const data = await res.json();
            if (!data.success) {
                return rejectWithValue(data.message || "Failed to fetch unified submissions");
            }
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
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching submissions");
        }
    },
    {
        // Prevent duplicate network calls: only fetch if not loading and not fresh
        condition: ({ username, force = false }, { getState }) => {
            const effectiveUser = username.trim() || "vineet_chandel";
            const state = getState().submissions;
            if (state.loadingByUser[effectiveUser]) {
                return false;
            }
            const existing = state.dataByUser[effectiveUser];
            const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
            const now = Date.now();
            if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
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
        invalidateSubmissions: (state, action: PayloadAction<string>) => {
            const user = action.payload;
            delete state.dataByUser[user];
            delete state.lastFetchedAtByUser[user];
            saveStoredSubmissions(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUnifiedSubmissions.pending, (state, action) => {
                const user = action.meta.arg.username.trim() || "vineet_chandel";
                state.loadingByUser[user] = true;
                state.errorByUser[user] = null;
            })
            .addCase(fetchUnifiedSubmissions.fulfilled, (state, action) => {
                const user = action.payload.username;
                state.loadingByUser[user] = false;
                state.dataByUser[user] = action.payload;
                state.lastFetchedAtByUser[user] = Date.now();
                saveStoredSubmissions(state.dataByUser);
            })
            .addCase(fetchUnifiedSubmissions.rejected, (state, action) => {
                const user = action.meta.arg.username.trim() || "vineet_chandel";
                state.loadingByUser[user] = false;
                state.errorByUser[user] = (action.payload as string) || "Failed to load submissions";
            });
    },
});

export const { setSubmissionsData, invalidateSubmissions } = submissionsSlice.actions;
export default submissionsSlice.reducer;
