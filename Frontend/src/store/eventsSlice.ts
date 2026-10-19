import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface EventItem {
    id: string;
    platform: string;
    platformName: string;
    title: string;
    url: string;
    startTime: string; // ISO String
    endTime: string;   // ISO String
    startTimestamp: number;
    endTimestamp: number;
    durationSeconds: number;
    durationFormatted: string;
    type: "contest" | "hackathon";
    status: "UPCOMING" | "LIVE" | "FINISHED";
    division?: string | null;
    rated: boolean;
    description?: string;
}

export interface EventsState {
    events: EventItem[];
    allEvents: EventItem[];
    upNext: EventItem | null;
    countsByPlatform: Record<string, number>;
    countsByMonthAndPlatform: Record<string, Record<string, number>>;
    stats: {
        totalInNext7Days: number;
        totalPlatformsInNext7Days: number;
    };
    allowedMonths: string[];
    currentMonthStr: string;
    selectedMonth: string;
    selectedType: "contests" | "hackathons";
    selectedPlatform: string | null;
    viewMode: "calendar" | "list";
    reminders: string[];
    loading: boolean;
    error: string | null;
    lastFetched: number | null;
}

const LOCAL_STORAGE_KEY = "orbix_events_state_cache_v1";
const REMINDERS_STORAGE_KEY = "orbix_events_reminders_v1";

// Safely load initial cache from localStorage for instant zero-latency render
const loadInitialState = (): EventsState => {
    let savedReminders: string[] = [];
    try {
        const rawReminders = localStorage.getItem(REMINDERS_STORAGE_KEY);
        if (rawReminders) {
            savedReminders = JSON.parse(rawReminders);
        }
    } catch {
        // ignore
    }

    try {
        const cached = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            return {
                ...parsed,
                reminders: savedReminders.length > 0 ? savedReminders : (parsed.reminders || []),
                loading: false,
                error: null,
            };
        }
    } catch {
        // ignore
    }

    const now = new Date();
    const currMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const prevMonthObj = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStr = `${prevMonthObj.getFullYear()}-${String(prevMonthObj.getMonth() + 1).padStart(2, "0")}`;
    const nextMonthObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const nextMonthStr = `${nextMonthObj.getFullYear()}-${String(nextMonthObj.getMonth() + 1).padStart(2, "0")}`;

    return {
        events: [],
        allEvents: [],
        upNext: null,
        countsByPlatform: {},
        countsByMonthAndPlatform: {},
        stats: {
            totalInNext7Days: 0,
            totalPlatformsInNext7Days: 0,
        },
        allowedMonths: [prevMonthStr, currMonthStr, nextMonthStr],
        currentMonthStr: currMonthStr,
        selectedMonth: currMonthStr,
        selectedType: "contests",
        selectedPlatform: null,
        viewMode: "calendar",
        reminders: savedReminders,
        loading: false,
        error: null,
        lastFetched: null,
    };
};

const initialState: EventsState = loadInitialState();

export const fetchEvents = createAsyncThunk(
    "events/fetchEvents",
    async (params: { refresh?: boolean; type?: string; platform?: string } = {}, { rejectWithValue }) => {
        try {
            const search = new URLSearchParams();
            if (params.refresh) search.set("refresh", "true");
            if (params.type) search.set("type", params.type);
            if (params.platform) search.set("platform", params.platform);

            const res = await fetch(`http://localhost:3000/api/events?${search.toString()}`);
            if (!res.ok) {
                throw new Error(`Failed to fetch events: ${res.statusText}`);
            }
            const data = await res.json();
            return data;
        } catch (err: any) {
            return rejectWithValue(err.message || "Network error fetching events");
        }
    }
);

export const toggleReminder = createAsyncThunk(
    "events/toggleReminder",
    async (eventId: string, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem("token") || "";
            const res = await fetch("http://localhost:3000/api/events/reminders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ eventId }),
            });
            if (!res.ok) {
                throw new Error("Failed to toggle reminder on server");
            }
            const data = await res.json();
            return { eventId, enabled: data.enabled };
        } catch (err: any) {
            return rejectWithValue(err.message);
        }
    }
);

export const fetchReminders = createAsyncThunk(
    "events/fetchReminders",
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem("token") || "";
            const res = await fetch("http://localhost:3000/api/events/reminders", {
                headers: {
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });
            if (!res.ok) return [];
            const data = await res.json();
            return (data.reminders || []) as string[];
        } catch (err: any) {
            return rejectWithValue(err.message);
        }
    }
);

export const eventsSlice = createSlice({
    name: "events",
    initialState,
    reducers: {
        setSelectedMonth: (state, action: PayloadAction<string>) => {
            // Strictly enforce the 3-month window restriction
            if (state.allowedMonths.includes(action.payload)) {
                state.selectedMonth = action.payload;
            }
        },
        setSelectedType: (state, action: PayloadAction<"contests" | "hackathons">) => {
            state.selectedType = action.payload;
            // Also adjust upNext if needed
            if (state.allEvents.length > 0) {
                const now = Date.now();
                const filtered = state.allEvents.filter(
                    (e) => e.type === (action.payload === "contests" ? "contest" : "hackathon") && e.endTimestamp > now
                );
                state.upNext = filtered[0] || null;
            }
        },
        setSelectedPlatform: (state, action: PayloadAction<string | null>) => {
            // Toggle platform: if same platform is clicked, clear it
            if (state.selectedPlatform === action.payload) {
                state.selectedPlatform = null;
            } else {
                state.selectedPlatform = action.payload;
            }
        },
        setViewMode: (state, action: PayloadAction<"calendar" | "list">) => {
            state.viewMode = action.payload;
        },
        toggleLocalReminder: (state, action: PayloadAction<string>) => {
            const id = action.payload;
            if (state.reminders.includes(id)) {
                state.reminders = state.reminders.filter((r) => r !== id);
            } else {
                state.reminders.push(id);
            }
            try {
                localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(state.reminders));
            } catch {
                // ignore
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchEvents.pending, (state) => {
                state.loading = state.allEvents.length === 0;
                state.error = null;
            })
            .addCase(fetchEvents.fulfilled, (state, action) => {
                state.loading = false;
                state.error = null;
                const payload = action.payload;

                if (payload.events) {
                    state.allEvents = payload.events;
                    state.events = payload.events;
                }
                if (payload.upNext) {
                    state.upNext = payload.upNext;
                }
                if (payload.countsByPlatform) {
                    state.countsByPlatform = payload.countsByPlatform;
                }
                if (payload.countsByMonthAndPlatform) {
                    state.countsByMonthAndPlatform = payload.countsByMonthAndPlatform;
                }
                if (payload.allowedMonths) {
                    state.allowedMonths = payload.allowedMonths;
                }
                if (payload.currentMonthStr) {
                    state.currentMonthStr = payload.currentMonthStr;
                    if (!state.selectedMonth || !payload.allowedMonths.includes(state.selectedMonth)) {
                        state.selectedMonth = payload.currentMonthStr;
                    }
                }
                if (payload.stats) {
                    state.stats = payload.stats;
                }

                state.lastFetched = Date.now();

                // Persist cache to localStorage
                try {
                    localStorage.setItem(
                        LOCAL_STORAGE_KEY,
                        JSON.stringify({
                            allEvents: state.allEvents,
                            events: state.events,
                            upNext: state.upNext,
                            countsByPlatform: state.countsByPlatform,
                            countsByMonthAndPlatform: state.countsByMonthAndPlatform,
                            allowedMonths: state.allowedMonths,
                            currentMonthStr: state.currentMonthStr,
                            selectedMonth: state.selectedMonth,
                            selectedType: state.selectedType,
                            selectedPlatform: state.selectedPlatform,
                            viewMode: state.viewMode,
                            stats: state.stats,
                            lastFetched: state.lastFetched,
                        })
                    );
                } catch {
                    // ignore
                }
            })
            .addCase(fetchEvents.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload as string;
            })
            .addCase(toggleReminder.fulfilled, (state, action) => {
                const { eventId, enabled } = action.payload;
                if (enabled && !state.reminders.includes(eventId)) {
                    state.reminders.push(eventId);
                } else if (!enabled && state.reminders.includes(eventId)) {
                    state.reminders = state.reminders.filter((r) => r !== eventId);
                }
                try {
                    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(state.reminders));
                } catch {
                    // ignore
                }
            })
            .addCase(fetchReminders.fulfilled, (state, action) => {
                if (Array.isArray(action.payload)) {
                    state.reminders = action.payload;
                    try {
                        localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(state.reminders));
                    } catch {
                        // ignore
                    }
                }
            });
    },
});

export const {
    setSelectedMonth,
    setSelectedType,
    setSelectedPlatform,
    setViewMode,
    toggleLocalReminder,
} = eventsSlice.actions;

export default eventsSlice.reducer;
