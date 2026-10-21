import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";
import { isDemoProfileUsername, demoDevelopmentAnalytics } from "../data/demoProfileData";

export interface LanguageItem {
    name: string;
    percentage: number;
    color: string;
    bytes: number;
    formattedSize?: string;
}

export interface DevelopmentRepoItem {
    name: string;
    description: string;
    stars: number;
    forks: number;
    language: string;
    languageColor: string;
    url: string;
}

export interface MostStarredRepo {
    name: string;
    stars: number;
    url: string;
}

export interface LatestWorkRepo {
    name: string;
    pushedAt: string;
    relativeTime: string;
    url: string;
}

export interface DevelopmentAnalyticsData {
    username: string;
    githubHandle: string;
    contributions: number;
    repos: number;
    stars: number;
    followers: number;
    languages: LanguageItem[];
    topRepositories: DevelopmentRepoItem[];
    mostStarred?: MostStarredRepo | null;
    latestWork?: LatestWorkRepo | null;
    timestamp: string;
}

export interface DevelopmentAnalyticsState {
    dataByUser: Record<string, DevelopmentAnalyticsData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

const getStoredDevelopmentAnalytics = (): Record<string, DevelopmentAnalyticsData> => {
    try {
        const stored = localStorage.getItem("orbix_development_analytics");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredDevelopmentAnalytics = (data: Record<string, DevelopmentAnalyticsData>) => {
    try {
        localStorage.setItem("orbix_development_analytics", JSON.stringify(data));
    } catch {
        // Safe fallback
    }
};

const initialData = getStoredDevelopmentAnalytics();

const initialState: DevelopmentAnalyticsState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {},
};

export const fetchDevelopmentAnalytics = createAsyncThunk<
    DevelopmentAnalyticsData,
    { username: string; githubHandle?: string; force?: boolean; portals?: Record<string, any> },
    { state: { developmentAnalytics: DevelopmentAnalyticsState }; rejectValue: string }
>(
    "developmentAnalytics/fetch",
    async ({ username, githubHandle, force = false, portals }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim();
        if (!effectiveUser) {
            return rejectWithValue("Username is required to fetch development analytics");
        }

        // Instantly return enhanced mock data for demo profile
        if (isDemoProfileUsername(effectiveUser)) {
            return {
                ...demoDevelopmentAnalytics,
                username: effectiveUser,
                githubHandle: githubHandle || effectiveUser,
            };
        }
        const state = getState().developmentAnalytics;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        // 15-minute client freshness window unless forced
        if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token") || "";
        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

        let ghHandle = (githubHandle || "").trim();
        if (!ghHandle && portals) {
            const gh = portals.github || portals.GitHub || portals.Github;
            if (typeof gh === "object" && gh) {
                ghHandle = (gh.username || gh.portal_username || gh.handle || "").trim();
            } else if (typeof gh === "string") {
                ghHandle = gh.trim();
            }
        }

        let portalsParam = "";
        if (ghHandle) {
            portalsParam += `&githubHandle=${encodeURIComponent(ghHandle)}`;
        }

        const endpoints = [
            `/api/portals/development/analytics?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}${portalsParam}`,
            `http://localhost:3000/api/portals/development/analytics?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}${portalsParam}`,
        ];

        let lastError = "Failed to fetch development analytics";
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    headers: reqHeaders,
                    signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success || data.contributions !== undefined) {
                        return {
                            username: effectiveUser,
                            githubHandle: data.githubHandle || ghHandle || "",
                            contributions: data.contributions ?? 0,
                            repos: data.repos ?? 0,
                            stars: data.stars ?? 0,
                            followers: data.followers ?? 0,
                            languages: data.languages || [],
                            topRepositories: data.topRepositories || [],
                            mostStarred: data.mostStarred ?? null,
                            latestWork: data.latestWork ?? null,
                            timestamp: data.timestamp || new Date().toISOString(),
                        };
                    }
                    lastError = data.message || lastError;
                }
            } catch (err: any) {
                lastError = err.message || lastError;
            }
        }

        // Return existing cached data if available
        if (existing) {
            return existing;
        }

        return {
            username: effectiveUser,
            githubHandle: ghHandle || "",
            contributions: 0,
            repos: 0,
            stars: 0,
            followers: 0,
            languages: [],
            topRepositories: [],
            mostStarred: null,
            latestWork: null,
            timestamp: new Date().toISOString(),
        };
    }
);

export const developmentAnalyticsSlice = createSlice({
    name: "developmentAnalytics",
    initialState,
    reducers: {
        clearDevelopmentAnalyticsCache: (state, action: PayloadAction<string | undefined>) => {
            const user = action.payload;
            if (user) {
                delete state.dataByUser[user];
                delete state.lastFetchedAtByUser[user];
                delete state.errorByUser[user];
                delete state.loadingByUser[user];
            } else {
                state.dataByUser = {};
                state.lastFetchedAtByUser = {};
                state.errorByUser = {};
                state.loadingByUser = {};
            }
            saveStoredDevelopmentAnalytics(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchDevelopmentAnalytics.pending, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = true;
                    state.errorByUser[user] = null;
                }
            })
            .addCase(fetchDevelopmentAnalytics.fulfilled, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.dataByUser[user] = action.payload;
                    state.lastFetchedAtByUser[user] = Date.now();
                    state.errorByUser[user] = null;
                    saveStoredDevelopmentAnalytics(state.dataByUser);
                }
            })
            .addCase(fetchDevelopmentAnalytics.rejected, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.errorByUser[user] = action.payload || "Failed to load development analytics";
                }
            });
    },
});

export const { clearDevelopmentAnalyticsCache } = developmentAnalyticsSlice.actions;
export default developmentAnalyticsSlice.reducer;
