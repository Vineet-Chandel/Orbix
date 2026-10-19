import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface DifficultyBreakdown {
    easy: number;
    medium: number;
    hard: number;
    total: number;
}

export interface PlatformProblemCount {
    portal: string;
    platformName: string;
    count: number;
    percentage: number;
}

export interface RecentSolveItem {
    id: string;
    title: string;
    portal: string;
    platformName: string;
    timestamp: number;
    solvedAt: string;
    url: string;
    relativeTime: string;
}

export interface DsaTopicItem {
    topic: string;
    count: number;
    percentage: number;
}

export interface TopicStrengthItem {
    topic: string;
    axisLabel: string;
    score: number;
    count: number;
}

export interface PracticeAnalyticsData {
    username: string;
    totalSolved: number;
    donutTotal: number;
    difficulty: DifficultyBreakdown;
    platformBreakdown: PlatformProblemCount[];
    recentlySolved: RecentSolveItem[];
    dsaTopics: DsaTopicItem[];
    topicStrength: TopicStrengthItem[];
    timestamp: string;
}

export interface PracticeAnalyticsState {
    dataByUser: Record<string, PracticeAnalyticsData>;
    loadingByUser: Record<string, boolean>;
    errorByUser: Record<string, string | null>;
    lastFetchedAtByUser: Record<string, number>;
}

const getStoredPracticeAnalytics = (): Record<string, PracticeAnalyticsData> => {
    try {
        const stored = localStorage.getItem("orbix_practice_analytics");
        return stored ? JSON.parse(stored) : {};
    } catch {
        return {};
    }
};

const saveStoredPracticeAnalytics = (data: Record<string, PracticeAnalyticsData>) => {
    try {
        localStorage.setItem("orbix_practice_analytics", JSON.stringify(data));
    } catch {
        // Safe fallback
    }
};

const initialData = getStoredPracticeAnalytics();

const initialState: PracticeAnalyticsState = {
    dataByUser: initialData,
    loadingByUser: {},
    errorByUser: {},
    lastFetchedAtByUser: {},
};

export const fetchPracticeAnalytics = createAsyncThunk<
    PracticeAnalyticsData,
    { username: string; force?: boolean; portals?: Record<string, any> },
    { state: { practiceAnalytics: PracticeAnalyticsState }; rejectValue: string }
>(
    "practiceAnalytics/fetch",
    async ({ username, force = false, portals }, { getState, rejectWithValue }) => {
        const effectiveUser = username.trim();
        if (!effectiveUser) {
            return rejectWithValue("Username is required to fetch practice analytics");
        }
        const state = getState().practiceAnalytics;
        const existing = state.dataByUser[effectiveUser];
        const lastFetched = state.lastFetchedAtByUser[effectiveUser] || 0;
        const now = Date.now();

        if (existing && !force && now - lastFetched < 15 * 60 * 1000) {
            return existing;
        }

        const token = localStorage.getItem("orbix_token") || localStorage.getItem("token") || "";
        const reqHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) reqHeaders["Authorization"] = `Bearer ${token}`;

        let portalsParam = "";
        const simplifiedPortals: Record<string, string> = {};
        if (portals && typeof portals === "object") {
            for (const [k, v] of Object.entries(portals)) {
                const u = typeof v === "object" ? v?.username || v?.portalUsername || v?.portal_username || "" : String(v || "");
                if (u && k !== "github" && !k.startsWith("_") && k !== "theme") {
                    simplifiedPortals[k.toLowerCase().trim()] = u.trim();
                }
            }
            if (Object.keys(simplifiedPortals).length > 0) {
                try {
                    portalsParam = `&clientPortals=${encodeURIComponent(JSON.stringify(simplifiedPortals))}`;
                } catch {
                    // Ignore
                }
            }
        }

        const endpoints = [
            `/api/portals/practice/analytics?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}${portalsParam}`,
            `http://localhost:3000/api/portals/practice/analytics?username=${encodeURIComponent(effectiveUser)}${force ? "&refresh=true" : ""}${portalsParam}`,
        ];

        let lastError = "Failed to fetch practice analytics";
        for (const url of endpoints) {
            try {
                const res = await fetch(url, {
                    headers: reqHeaders,
                    signal: AbortSignal.timeout(10000),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.success || data.totalSolved !== undefined) {
                        return {
                            username: effectiveUser,
                            totalSolved: data.totalSolved || 0,
                            donutTotal: data.donutTotal || 0,
                            difficulty: data.difficulty || { easy: 0, medium: 0, hard: 0, total: 0 },
                            platformBreakdown: data.platformBreakdown || [],
                            recentlySolved: data.recentlySolved || [],
                            dsaTopics: data.dsaTopics || [],
                            topicStrength: data.topicStrength || [],
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
            const state = getState().practiceAnalytics;
            if (state.loadingByUser[effectiveUser] && !force) {
                return false;
            }
            return true;
        },
    }
);

export const practiceAnalyticsSlice = createSlice({
    name: "practiceAnalytics",
    initialState,
    reducers: {
        clearPracticeAnalyticsCache: (state, action: PayloadAction<string | undefined>) => {
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
            saveStoredPracticeAnalytics(state.dataByUser);
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPracticeAnalytics.pending, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = true;
                    state.errorByUser[user] = null;
                }
            })
            .addCase(fetchPracticeAnalytics.fulfilled, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.dataByUser[user] = action.payload;
                    state.lastFetchedAtByUser[user] = Date.now();
                    state.errorByUser[user] = null;
                    saveStoredPracticeAnalytics(state.dataByUser);
                }
            })
            .addCase(fetchPracticeAnalytics.rejected, (state, action) => {
                const user = action.meta.arg.username.trim();
                if (user) {
                    state.loadingByUser[user] = false;
                    state.errorByUser[user] = action.payload || "Failed to load practice analytics";
                }
            });
    },
});

export const { clearPracticeAnalyticsCache } = practiceAnalyticsSlice.actions;
export default practiceAnalyticsSlice.reducer;
