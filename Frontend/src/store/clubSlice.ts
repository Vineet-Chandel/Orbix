import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import type {
    ClubProfileData,
    ClubCoordinator,
    ClubAchievement,
    ClubProfileResponse,
} from "../utils/clubProfileApi";
import { fetchClubFullProfile, updateClubProfile } from "../utils/clubProfileApi";

export interface ClubState {
    club: ClubProfileData | null;
    coordinators: ClubCoordinator[];
    achievements: ClubAchievement[];
    stats: {
        upcoming_count: number;
        past_count: number;
        draft_count: number;
        total_count: number;
    } | null;
    permissions: {
        clubId: string;
        clubName: string;
        clubSlug: string;
        userRole: string;
        isOwner: boolean;
        isAdmin: boolean;
        isTeamLead: boolean;
        canManageProfile: boolean;
        [key: string]: any;
    } | null;
    completion: {
        percentage: number;
        completedItems: string[];
        missingItems: string[];
    };
    isInitialized: boolean;
    loading: boolean;
    saving: boolean;
    error: string | null;
    lastFetchedAt: number | null;
}

const initialState: ClubState = {
    club: null,
    coordinators: [],
    achievements: [],
    stats: null,
    permissions: null,
    completion: {
        percentage: 0,
        completedItems: [],
        missingItems: [],
    },
    isInitialized: false,
    loading: false,
    saving: false,
    error: null,
    lastFetchedAt: null,
};

/**
 * Fetch club profile with smart client-side caching.
 * If data is already initialized in Redux and force is not true, skips network request.
 */
export const fetchClubProfile = createAsyncThunk<
    ClubProfileResponse,
    { clubId?: string; force?: boolean } | undefined,
    { rejectValue: string }
>(
    "club/fetchClubProfile",
    async (args, { getState, rejectWithValue }) => {
        const state = (getState() as any).club as ClubState;
        if (state && state.isInitialized && !args?.force && state.club) {
            return {
                success: true,
                club: state.club,
                coordinators: state.coordinators,
                achievements: state.achievements,
                stats: state.stats || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 },
                permissions: state.permissions || ({} as any),
                completion: state.completion,
            };
        }

        try {
            const data = await fetchClubFullProfile(args?.clubId);
            return data;
        } catch (err: any) {
            return rejectWithValue(err.message || "Failed to load club profile");
        }
    }
);

/**
 * Save club profile and automatically update the centralized Redux store.
 */
export const saveClubProfile = createAsyncThunk<
    ClubProfileResponse,
    { payload: Record<string, any>; clubId?: string },
    { rejectValue: string }
>(
    "club/saveClubProfile",
    async ({ payload, clubId }, { rejectWithValue }) => {
        try {
            const data = await updateClubProfile(payload, clubId);
            return data;
        } catch (err: any) {
            return rejectWithValue(err.message || "Failed to update club profile");
        }
    }
);

export const clubSlice = createSlice({
    name: "club",
    initialState,
    reducers: {
        setClubProfileData: (state, action: PayloadAction<ClubProfileResponse>) => {
            state.club = action.payload.club;
            state.coordinators = action.payload.coordinators || [];
            state.achievements = action.payload.achievements || [];
            state.stats = action.payload.stats || null;
            state.permissions = action.payload.permissions || null;
            state.completion = action.payload.completion || { percentage: 0, completedItems: [], missingItems: [] };
            state.isInitialized = true;
            state.loading = false;
            state.error = null;
            state.lastFetchedAt = Date.now();
        },
        updateClubPartial: (state, action: PayloadAction<Partial<ClubProfileData>>) => {
            if (state.club) {
                state.club = { ...state.club, ...action.payload };
            }
        },
        setClubCoordinators: (state, action: PayloadAction<ClubCoordinator[]>) => {
            state.coordinators = action.payload;
        },
        setClubAchievements: (state, action: PayloadAction<ClubAchievement[]>) => {
            state.achievements = action.payload;
        },
        clearClubState: (state) => {
            state.club = null;
            state.coordinators = [];
            state.achievements = [];
            state.stats = null;
            state.permissions = null;
            state.completion = { percentage: 0, completedItems: [], missingItems: [] };
            state.isInitialized = false;
            state.loading = false;
            state.saving = false;
            state.error = null;
            state.lastFetchedAt = null;
        },
    },
    extraReducers: (builder) => {
        builder
            // fetchClubProfile
            .addCase(fetchClubProfile.pending, (state, action) => {
                // Only show loading spinner if we don't have initialized club data yet
                if (!state.isInitialized || action.meta.arg?.force) {
                    state.loading = true;
                }
                state.error = null;
            })
            .addCase(fetchClubProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.isInitialized = true;
                state.club = action.payload.club;
                state.coordinators = action.payload.coordinators || [];
                state.achievements = action.payload.achievements || [];
                state.stats = action.payload.stats || null;
                state.permissions = action.payload.permissions || null;
                state.completion = action.payload.completion || { percentage: 0, completedItems: [], missingItems: [] };
                state.lastFetchedAt = Date.now();
                state.error = null;
            })
            .addCase(fetchClubProfile.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to load club profile";
            })
            // saveClubProfile
            .addCase(saveClubProfile.pending, (state) => {
                state.saving = true;
                state.error = null;
            })
            .addCase(saveClubProfile.fulfilled, (state, action) => {
                state.saving = false;
                state.club = action.payload.club;
                if (action.payload.coordinators) state.coordinators = action.payload.coordinators;
                if (action.payload.achievements) state.achievements = action.payload.achievements;
                if (action.payload.completion) state.completion = action.payload.completion;
                if (action.payload.stats) state.stats = action.payload.stats;
                state.error = null;
            })
            .addCase(saveClubProfile.rejected, (state, action) => {
                state.saving = false;
                state.error = action.payload || "Failed to save club profile";
            });
    },
});

export const {
    setClubProfileData,
    updateClubPartial,
    setClubCoordinators,
    setClubAchievements,
    clearClubState,
} = clubSlice.actions;

export default clubSlice.reducer;
