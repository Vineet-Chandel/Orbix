import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { isDemoProfileUsername, demoBadgesData, DEMO_USERNAME } from "../data/demoProfileData";

export interface UnifiedBadgeRecord {
    id: string;
    platform: string;
    platformName: string;
    name: string;
    displayName: string;
    category?: string;
    icon: string;
    hoverText?: string | null;
    description?: string | null;
    creationDate?: string | null;
    earnedTimestamp?: number | null;
    profileUrl?: string | null;
}

export interface UnifiedBadgesData {
    username: string;
    totalEarned: number;
    platformCounts: Record<string, number>;
    badges: UnifiedBadgeRecord[];
    timestamp: string;
}

export interface BadgesState {
    dataByUser: Record<string, UnifiedBadgesData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

const getStoredBadges = (): Record<string, UnifiedBadgesData> => {
    try {
        const stored = localStorage.getItem("orbix_unified_badges");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredBadges = (data: Record<string, UnifiedBadgesData>) => {
    try {
        localStorage.setItem("orbix_unified_badges", JSON.stringify(data));
    } catch {
        // Safe fallback if quota exceeded
    }
};

const initialData: Record<string, UnifiedBadgesData> = {
    [DEMO_USERNAME]: demoBadgesData,
    "vineet-chandel": demoBadgesData,
    "vineetchandel": demoBadgesData,
    "vineet_chandel": demoBadgesData,
    "demo": demoBadgesData,
    ...getStoredBadges(),
};

const initialState: BadgesState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {
        [DEMO_USERNAME]: Date.now(),
        "vineet-chandel": Date.now(),
        "vineetchandel": Date.now(),
        "vineet_chandel": Date.now(),
        "demo": Date.now(),
    },
};

export const fetchUnifiedBadges = createAsyncThunk<
    UnifiedBadgesData,
    { username: string; force?: boolean },
    { state: { badges: BadgesState }; rejectValue: string }
>(
    "badges/fetchUnified",
    async ({ username, force = false }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim();
        if (!effectiveUser) {
            return rejectWithValue("Username is required to fetch badges");
        }

        // Instantly return enhanced data for demo profile, attempting live server sync for vineet_chandel first
        if (isDemoProfileUsername(effectiveUser) || effectiveUser.toLowerCase() === "vineet_chandel") {
            try {
                const endpoints = [
                    `/api/portals/badges/unified?username=vineet_chandel`,
                    `http://localhost:3000/api/portals/badges/unified?username=vineet_chandel`,
                ];
                for (const url of endpoints) {
                    try {
                        const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
                        if (res.ok) {
                            const data = await res.json();
                            if (data.success && Array.isArray(data.badges) && data.badges.length > 0) {
                                return {
                                    username: effectiveUser,
                                    totalEarned: data.totalEarned || data.badges.length,
                                    platformCounts: data.platformCounts || {},
                                    badges: data.badges,
                                    timestamp: data.timestamp || new Date().toISOString(),
                                };
                            }
                        }
                    } catch {
                        // try next
                    }
                }
            } catch {
                // fallback to demoBadgesData
            }

            return {
                ...demoBadgesData,
                username: effectiveUser,
            };
        }
        const state = getState().badges;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token") || "";
        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

        const endpoints = [
            `/api/portals/badges/unified?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}`,
            `http://localhost:3000/api/portals/badges/unified?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}`,
        ];

        let lastError = "Failed to fetch badges";
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
                            totalEarned: data.totalEarned || (data.badges ? data.badges.length : 0),
                            platformCounts: data.platformCounts || {},
                            badges: data.badges || [],
                            timestamp: data.timestamp || new Date().toISOString(),
                        };
                    }
                    lastError = data.message || lastError;
                }
            } catch (err: any) {
                lastError = err.message || lastError;
            }
        }

        return rejectWithValue(lastError);
    },
    {
        condition: ({ username, force = false }, { getState }) => {
            const effectiveUser = username.trim();
            if (!effectiveUser) return false;
            const state = getState().badges;
            if (state.loadingByUser[effectiveUser] && !force) {
                return false;
            }
            return true;
        },
    }
);

export const badgesSlice = createSlice({
    name: "badges",
    initialState,
    reducers: {
        clearBadgesUser: (state, action: PayloadAction<string | undefined>) => {
            const user = action.payload;
            if (user) {
                delete state.dataByUser[user];
                delete state.loadingByUser[user];
                delete state.errorByUser[user];
                delete state.lastFetchedAtByUser[user];
            } else {
                state.dataByUser = {};
                state.loadingByUser = {};
                state.errorByUser = {};
                state.lastFetchedAtByUser = {};
            }
            saveStoredBadges(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUnifiedBadges.pending, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = true;
                    state.errorByUser[user] = null;
                }
            })
            .addCase(fetchUnifiedBadges.fulfilled, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.dataByUser[user] = action.payload;
                    state.lastFetchedAtByUser[user] = Date.now();
                    state.errorByUser[user] = null;
                    saveStoredBadges(state.dataByUser);
                }
            })
            .addCase(fetchUnifiedBadges.rejected, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.errorByUser[user] = action.payload || "Failed to load badges";
                }
            });
    },
});

export const { clearBadgesUser } = badgesSlice.actions;
export const clearBadgesCache = clearBadgesUser;
export default badgesSlice.reducer;
