import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface User {
    id?: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    termsAccepted?: boolean | string;
    portals?: Record<string, { raw: string; username: string; url: string }>;
}

export interface UserState {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    error: string | null;
}

const getStoredUser = (): User | null => {
    try {
        const stored = localStorage.getItem("orbix_user");
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
};

const initialStoredUser = getStoredUser();

const initialState: UserState = {
    user: initialStoredUser,
    loading: true, // starts true while verifying session with /profile/me
    isAuthenticated: !!initialStoredUser,
    error: null,
};

// Async Thunk to fetch user profile from /profile/me on app load or refresh
export const fetchUserProfile = createAsyncThunk<User, void, { rejectValue: string }>(
    "user/fetchUserProfile",
    async (_, { rejectWithValue }) => {
        const endpoints = ["/api/profile/me", "http://localhost:3000/api/profile/me"];
        let lastError = "Unable to fetch profile";

        for (const url of endpoints) {
            try {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    credentials: "include",
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data?.user) {
                        return data.user as User;
                    }
                } else if (response.status === 401) {
                    return rejectWithValue("Unauthorized");
                }
            } catch (err: any) {
                lastError = err?.message || lastError;
            }
        }

        return rejectWithValue(lastError);
    }
);

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User | null>) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.loading = false;
            state.error = null;

            if (action.payload) {
                try {
                    localStorage.setItem("orbix_user", JSON.stringify(action.payload));
                } catch {
                    // ignore localStorage quota errors
                }
            } else {
                localStorage.removeItem("orbix_user");
            }
        },
        clearUser: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
            try {
                localStorage.removeItem("orbix_user");
            } catch {
                // ignore
            }
        },
        setLoading: (state, action: PayloadAction<boolean>) => {
            state.loading = action.payload;
        },
        setPortalProfiles: (
            state,
            action: PayloadAction<Record<string, { raw: string; username: string; url: string }>>
        ) => {
            if (state.user) {
                state.user.portals = action.payload;
                try {
                    localStorage.setItem("orbix_user", JSON.stringify(state.user));
                } catch {
                    // ignore
                }
            }
            try {
                localStorage.setItem("orbix_portals", JSON.stringify(action.payload));
            } catch {
                // ignore
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUserProfile.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
                state.error = null;

                try {
                    localStorage.setItem("orbix_user", JSON.stringify(action.payload));
                } catch {
                    // ignore
                }
            })
            .addCase(fetchUserProfile.rejected, (state, action) => {
                state.loading = false;
                // If unauthorized or expired token, clear user session
                if (action.payload === "Unauthorized") {
                    state.user = null;
                    state.isAuthenticated = false;
                    try {
                        localStorage.removeItem("orbix_user");
                    } catch {
                        // ignore
                    }
                }
                state.error = action.payload || "Session verification failed";
            });
    },
});

export const { setUser, clearUser, setLoading, setPortalProfiles } = userSlice.actions;
export default userSlice.reducer;
