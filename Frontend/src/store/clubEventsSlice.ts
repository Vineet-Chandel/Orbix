import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface ClubEvent {
    id: string;
    clubId: string;
    title: string;
    slug: string;
    summary: string | null;
    description: string | null;
    startsAt: string;
    endsAt: string | null;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string | null;
    registrationUrl: string | null;
    coverImageUrl: string | null;
    status: "draft" | "published" | "completed" | "cancelled";
    publishedAt: string | null;
    createdAt: string;
    updatedAt?: string;
    isOptimistic?: boolean;
    syncError?: string | null;
    registrationsCount?: number;
    attendeesCount?: number;
    rejectedCount?: number;
    likesCount?: number;
}

export interface CreateClubEventPayload {
    title: string;
    summary?: string | null;
    description?: string | null;
    startsAt: string;
    endsAt?: string | null;
    timezone?: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation?: string | null;
    registrationUrl?: string | null;
    coverImageUrl?: string | null;
    status: "draft" | "published" | "completed" | "cancelled";
    initialFormStructure?: any;
    initialFormSettings?: any;
    initialFormTheme?: any;
}

export type ClubEventStatus = "draft" | "published" | "completed" | "cancelled";
export type ClubEventFilter = "all" | "published" | "completed" | "draft" | "cancelled";

export interface ClubEventsState {
    events: ClubEvent[];
    statusFilter: ClubEventFilter;
    loading: boolean;
    error: string | null;
    lastFetchedAt: number | null;
}

const initialState: ClubEventsState = {
    events: [],
    statusFilter: "all",
    loading: false,
    error: null,
    lastFetchedAt: null,
};

/**
 * Fetch all events for the club from server
 */
export const fetchClubEvents = createAsyncThunk<
    ClubEvent[],
    string | undefined,
    { rejectValue: string }
>("clubEvents/fetchClubEvents", async (clubId, { rejectWithValue }) => {
    try {
        const url = clubId ? `/api/club/events?clubId=${encodeURIComponent(clubId)}` : "/api/club/events";
        const res = await fetch(url, { credentials: "include" });
        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
            return rejectWithValue(data?.message || "Failed to load club events.");
        }

        return (data.events || []) as ClubEvent[];
    } catch (err: any) {
        return rejectWithValue(err.message || "Failed to load club events.");
    }
});

/**
 * Background thunk to create a club event on the server.
 * Operates in the background after an optimistic item is added.
 */
export const createClubEvent = createAsyncThunk<
    { tempId: string; event: ClubEvent },
    { tempId: string; payload: CreateClubEventPayload },
    { rejectValue: { tempId: string; message: string } }
>("clubEvents/createClubEvent", async ({ tempId, payload }, { rejectWithValue }) => {
    try {
        const res = await fetch("/api/club/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !data?.event) {
            return rejectWithValue({
                tempId,
                message: data?.message || "Failed to save event on server.",
            });
        }

        return { tempId, event: data.event as ClubEvent };
    } catch (err: any) {
        return rejectWithValue({
            tempId,
            message: err.message || "Network error while saving event.",
        });
    }
});

/**
 * Background thunk to update a club event on the server.
 */
export const updateClubEvent = createAsyncThunk<
    { event: ClubEvent },
    { eventId: string; payload: Partial<CreateClubEventPayload>; previousEvent?: ClubEvent },
    { rejectValue: { eventId: string; message: string; previousEvent?: ClubEvent } }
>("clubEvents/updateClubEvent", async ({ eventId, payload, previousEvent }, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/club/events/${eventId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(payload),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success || !data?.event) {
            return rejectWithValue({
                eventId,
                previousEvent,
                message: data?.message || "Failed to update event on server.",
            });
        }

        return { event: data.event as ClubEvent };
    } catch (err: any) {
        return rejectWithValue({
            eventId,
            previousEvent,
            message: err.message || "Network error while updating event.",
        });
    }
});

/**
 * Background thunk to change status of a club event.
 */
export const changeClubEventStatus = createAsyncThunk<
    { eventId: string; status: ClubEventStatus },
    {
        eventId: string;
        status: ClubEventStatus;
        previousStatus: ClubEventStatus;
        password?: string;
        confirmationText?: string;
        emergencyBypass?: boolean;
    },
    { rejectValue: { eventId: string; previousStatus: ClubEventStatus; message: string } }
>("clubEvents/changeClubEventStatus", async ({ eventId, status, previousStatus, password, confirmationText, emergencyBypass }, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/club/events/${eventId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status, password, confirmationText, emergencyBypass }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
            return rejectWithValue({
                eventId,
                previousStatus,
                message: data?.message || "Failed to change event status.",
            });
        }

        return { eventId, status };
    } catch (err: any) {
        return rejectWithValue({
            eventId,
            previousStatus,
            message: err.message || "Network error while changing event status.",
        });
    }
});

/**
 * Background thunk to delete a club event on the server.
 */
export const deleteClubEvent = createAsyncThunk<
    { eventId: string },
    {
        eventId: string;
        previousEvent: ClubEvent;
        password?: string;
        confirmationText?: string;
    },
    { rejectValue: { eventId: string; previousEvent: ClubEvent; message: string } }
>("clubEvents/deleteClubEvent", async ({ eventId, previousEvent, password, confirmationText }, { rejectWithValue }) => {
    try {
        const res = await fetch(`/api/club/events/${eventId}`, {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ password, confirmationText }),
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
            return rejectWithValue({
                eventId,
                previousEvent,
                message: data?.message || "Failed to delete event.",
            });
        }

        return { eventId };
    } catch (err: any) {
        return rejectWithValue({
            eventId,
            previousEvent,
            message: err.message || "Network error while deleting event.",
        });
    }
});

export const clubEventsSlice = createSlice({
    name: "clubEvents",
    initialState,
    reducers: {
        setEvents: (state, action: PayloadAction<ClubEvent[]>) => {
            state.events = action.payload;
            state.lastFetchedAt = Date.now();
        },
        setStatusFilter: (state, action: PayloadAction<ClubEventFilter>) => {
            state.statusFilter = action.payload;
        },
        // Optimistic: immediately add event to listing
        addEventOptimistic: (state, action: PayloadAction<ClubEvent>) => {
            state.events.unshift(action.payload);
        },
        // Optimistic: immediately update event
        updateEventOptimistic: (state, action: PayloadAction<{ id: string; changes: Partial<ClubEvent> }>) => {
            const index = state.events.findIndex((e) => e.id === action.payload.id);
            if (index !== -1) {
                state.events[index] = {
                    ...state.events[index],
                    ...action.payload.changes,
                    updatedAt: new Date().toISOString(),
                };
            }
        },
        // Optimistic: immediately update status
        updateStatusOptimistic: (state, action: PayloadAction<{ id: string; status: ClubEventStatus }>) => {
            const index = state.events.findIndex((e) => e.id === action.payload.id);
            if (index !== -1) {
                const isPub = action.payload.status === "published";
                state.events[index].status = action.payload.status;
                if (isPub && !state.events[index].publishedAt) {
                    state.events[index].publishedAt = new Date().toISOString();
                }
            }
        },
        // Optimistic: immediately delete event
        deleteEventOptimistic: (state, action: PayloadAction<string>) => {
            state.events = state.events.filter((e) => e.id !== action.payload);
        },
        // Rollback optimistic add
        rollbackOptimisticAdd: (state, action: PayloadAction<string>) => {
            state.events = state.events.filter((e) => e.id !== action.payload);
        },
    },
    extraReducers: (builder) => {
        // Fetch events
        builder
            .addCase(fetchClubEvents.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchClubEvents.fulfilled, (state, action) => {
                state.loading = false;
                state.events = action.payload;
                state.lastFetchedAt = Date.now();
            })
            .addCase(fetchClubEvents.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || "Failed to fetch events";
            });

        // Create event background response
        builder
            .addCase(createClubEvent.fulfilled, (state, action) => {
                const { tempId, event } = action.payload;
                const index = state.events.findIndex((e) => e.id === tempId);
                if (index !== -1) {
                    state.events[index] = { ...event, isOptimistic: false };
                } else {
                    state.events.unshift(event);
                }
            })
            .addCase(createClubEvent.rejected, (state, action) => {
                if (action.payload?.tempId) {
                    // Rollback optimistic insertion
                    state.events = state.events.filter((e) => e.id !== action.payload!.tempId);
                }
                state.error = action.payload?.message || "Failed to create event";
            });

        // Update event background response
        builder
            .addCase(updateClubEvent.fulfilled, (state, action) => {
                const index = state.events.findIndex((e) => e.id === action.payload.event.id);
                if (index !== -1) {
                    state.events[index] = { ...action.payload.event, isOptimistic: false };
                }
            })
            .addCase(updateClubEvent.rejected, (state, action) => {
                if (action.payload?.previousEvent) {
                    const index = state.events.findIndex((e) => e.id === action.payload!.eventId);
                    if (index !== -1) {
                        state.events[index] = action.payload.previousEvent;
                    }
                }
                state.error = action.payload?.message || "Failed to update event";
            });

        // Status change background response
        builder
            .addCase(changeClubEventStatus.fulfilled, (state, action) => {
                const index = state.events.findIndex((e) => e.id === action.payload.eventId);
                if (index !== -1) {
                    state.events[index].status = action.payload.status;
                }
            })
            .addCase(changeClubEventStatus.rejected, (state, action) => {
                if (action.payload) {
                    const index = state.events.findIndex((e) => e.id === action.payload!.eventId);
                    if (index !== -1) {
                        state.events[index].status = action.payload.previousStatus;
                    }
                }
            });

        // Delete event background response
        builder
            .addCase(deleteClubEvent.fulfilled, (state, action) => {
                state.events = state.events.filter((e) => e.id !== action.payload.eventId);
            })
            .addCase(deleteClubEvent.rejected, (state, action) => {
                if (action.payload?.previousEvent) {
                    const exists = state.events.some((e) => e.id === action.payload!.previousEvent.id);
                    if (!exists) {
                        state.events.push(action.payload.previousEvent);
                        state.events.sort(
                            (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
                        );
                    }
                }
            });
    },
});

export const {
    setEvents,
    setStatusFilter,
    addEventOptimistic,
    updateEventOptimistic,
    updateStatusOptimistic,
    deleteEventOptimistic,
    rollbackOptimisticAdd,
} = clubEventsSlice.actions;

export default clubEventsSlice.reducer;
