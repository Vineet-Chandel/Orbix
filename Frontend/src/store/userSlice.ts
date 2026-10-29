import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit";

export interface User {
    id?: string;
    firstName: string;
    middleName?: string | undefined;
    lastName: string;
    gmail: string;
    username: string;
    termsAccepted?: boolean | string;
    accountType?: "personal" | "club" | "admin" | string;
    clubStatus?: "pending" | "under_review" | "needs_information" | "rejected" | "ready_for_promotion" | "approved" | "none" | string;
    clubName?: string | null;
    clubId?: string | null;
    verifiedClub?: {
        id: string;
        name: string;
        slug: string;
        category?: string;
        collegeName?: string;
        logoUrl?: string | null;
    } | null;
    application?: {
        id: string;
        status: string;
        clubName: string;
    } | null;
    headline?: string | null;
    bio?: string | null;
    avatarUrl?: string | null;
    photoUrl?: string | null;
    previousPhotoUrl?: string | null;
    hasPreviousPhoto?: boolean;
    coverImageUrl?: string | null;
    website?: string | null;
    linkedin?: string | null;
    github?: string | null;
    customLink?: string | null;
    location?: string | null;
    skills?: string[];
    links?: Array<{ label: string; url: string; platform?: string }>;
    isOpenToWork?: boolean;
    isHireable?: boolean;
    isPublic?: boolean;
    createdAt?: string | null;
    platforms?: any[];
    portals?: Record<string, { raw: string; username: string; url: string }>;
    // Dynamic Resume section
    resumeUrl?: string | null;
    resumePublicId?: string | null;
    resumeFilename?: string | null;
    resumeFilesize?: number | null;
    resumeUpdatedAt?: string | null;
    isResumePublic?: boolean;
    resumeMetadata?: Record<string, any> | null;
    // Verified College / Institution
    collegeId?: string | null;
    isEmailVerified?: boolean;
    emailVerifiedAt?: string | null;
    isVerified?: boolean;
    isVerifiedCoder?: boolean;
    college?: {
        id: string;
        officialName: string;
        city?: string | null;
        state?: string | null;
        district?: string | null;
        institutionType?: string | null;
        aisheCode?: string | null;
        verificationStatus?: "verified" | "needs_review" | "unverified" | "inactive" | string;
    } | null;
    collegeUpdatedAt?: string | null;
    canChangeCollege?: boolean;
    collegeLockRemainingMs?: number;
    nextAllowedCollegeChangeAt?: string | null;
}

export interface UserState {
    user: User | null;
    loading: boolean;
    isAuthenticated: boolean;
    error: string | null;
    lastFetchedAt: number | null;
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
    loading: !initialStoredUser, // only loading if no stored user
    isAuthenticated: !!initialStoredUser,
    error: null,
    lastFetchedAt: null,
};

// Request deduplication lock
let inFlightFetchPromise: Promise<User> | null = null;

// Async Thunk to fetch user profile from /profile/me or /me on app load or refresh
export const fetchUserProfile = createAsyncThunk<User, { force?: boolean } | void, { rejectValue: string }>(
    "user/fetchUserProfile",
    async (_options, { rejectWithValue }) => {
        // Return existing in-flight request if one is active unless forced
        if (inFlightFetchPromise && !_options?.force) {
            try {
                return await inFlightFetchPromise;
            } catch (err: any) {
                return rejectWithValue(err.message || "Failed to fetch profile");
            }
        }

        const fetchPromise = (async () => {
            const endpoints = [
                "/api/profile/me",
                "http://localhost:3000/api/profile/me",
                "/api/me",
                "http://localhost:3000/api/me"
            ];
            let lastError = "Unable to fetch profile";

            for (const url of endpoints) {
                try {
                    const token = typeof window !== "undefined" ? localStorage.getItem("orbix_token") : null;
                    const headers: Record<string, string> = {
                        "Content-Type": "application/json",
                    };
                    if (token) {
                        headers["Authorization"] = `Bearer ${token}`;
                    }

                    const response = await fetch(url, {
                        method: "GET",
                        headers,
                        credentials: "include",
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data?.user) {
                            const u = data.user;
                            if (typeof u.links === "string") {
                                try {
                                    u.links = JSON.parse(u.links);
                                } catch {
                                    u.links = [];
                                }
                            }
                            return u as User;
                        }
                    } else if (response.status === 401) {
                        throw new Error("Unauthorized");
                    }
                } catch (err: any) {
                    if (err.message === "Unauthorized") {
                        throw err;
                    }
                    lastError = err?.message || lastError;
                }
            }

            throw new Error(lastError);
        })();

        inFlightFetchPromise = fetchPromise;

        try {
            const result = await fetchPromise;
            return result;
        } catch (err: any) {
            return rejectWithValue(err.message || "Session verification failed");
        } finally {
            inFlightFetchPromise = null;
        }
    }
);

export function syncConnectedPortalsStorage(platforms?: any[]) {
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        return;
    }

    try {
        let existing: Record<string, any> = {};
        try {
            const raw = localStorage.getItem("orbix_connected_portals");
            if (raw) existing = JSON.parse(raw);
        } catch {}

        const nextPortals: Record<string, any> = { ...existing };
        const rawPortals: Record<string, any> = {};

        for (const p of platforms) {
            const portalKey = (p.portal || "").toLowerCase().trim();
            if (!portalKey) continue;

            const handle = (p.portalUsername || p.portal_username || p.username || "").trim();
            const profileUrl = (p.link || p.profileUrl || p.url || "").trim();

            nextPortals[portalKey] = {
                portal: portalKey,
                username: handle,
                profileUrl,
                verified: p.verified !== false,
                displayName: p.displayName || p.display_name || handle,
                avatarUrl: p.avatarUrl || p.avatar_url,
                stats: p.stats,
                syncStatus: p.lastSyncStatus || p.syncStatus || "valid",
                lastSyncAt: p.lastSyncAt || p.last_sync_at || new Date().toISOString(),
            };

            rawPortals[portalKey] = {
                raw: handle,
                username: handle,
                url: profileUrl,
            };
        }

        localStorage.setItem("orbix_connected_portals", JSON.stringify(nextPortals));
        localStorage.setItem("orbix_portals", JSON.stringify(rawPortals));

        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("orbix_portals_updated"));
            window.dispatchEvent(new Event("storage"));
        }
    } catch (err) {
        console.error("Failed to sync connected portals to storage:", err);
    }
}

export const userSlice = createSlice({
    name: "user",
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<User | null>) => {
            if (action.payload) {
                // In personal user case, only those persons verified via email OTP are verified
                const isVerified = Boolean(action.payload.isEmailVerified);
                action.payload.isEmailVerified = isVerified;
                action.payload.isVerifiedCoder = isVerified;
                action.payload.isVerified = isVerified;
            }
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
            state.loading = false;
            state.error = null;
            state.lastFetchedAt = action.payload ? Date.now() : null;

            if (action.payload) {
                try {
                    localStorage.setItem("orbix_user", JSON.stringify(action.payload));
                    if (action.payload.platforms) {
                        syncConnectedPortalsStorage(action.payload.platforms);
                    }
                } catch {
                    // ignore localStorage quota errors
                }
            } else {
                localStorage.removeItem("orbix_user");
            }
        },
        updateUserProfile: (state, action: PayloadAction<Partial<User>>) => {
            if (state.user) {
                state.user = {
                    ...state.user,
                    ...action.payload,
                };
                try {
                    localStorage.setItem("orbix_user", JSON.stringify(state.user));
                    if (state.user.platforms) {
                        syncConnectedPortalsStorage(state.user.platforms);
                    }
                } catch {
                    // ignore
                }
            }
        },
        clearUser: (state) => {
            state.user = null;
            state.isAuthenticated = false;
            state.loading = false;
            state.error = null;
            state.lastFetchedAt = null;
            try {
                localStorage.removeItem("orbix_user");
                localStorage.removeItem("orbix_token");
                localStorage.removeItem("orbix_connected_portals");
                localStorage.removeItem("orbix_portals");
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
        setEmailVerified: (
            state,
            action: PayloadAction<{ isEmailVerified: boolean; emailVerifiedAt?: string | null; email?: string }>
        ) => {
            if (state.user) {
                state.user.isEmailVerified = action.payload.isEmailVerified;
                state.user.isVerifiedCoder = action.payload.isEmailVerified;
                state.user.isVerified = action.payload.isEmailVerified;
                if (action.payload.emailVerifiedAt) {
                    state.user.emailVerifiedAt = action.payload.emailVerifiedAt;
                }
                if (action.payload.email) {
                    state.user.gmail = action.payload.email;
                }
                try {
                    localStorage.setItem("orbix_user", JSON.stringify(state.user));
                } catch {
                    // ignore
                }
            }
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchUserProfile.pending, (state) => {
                if (!state.user) {
                    state.loading = true;
                }
                state.error = null;
            })
            .addCase(fetchUserProfile.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.isAuthenticated = true;
                state.error = null;
                state.lastFetchedAt = Date.now();

                try {
                    localStorage.setItem("orbix_user", JSON.stringify(action.payload));
                    if (action.payload?.platforms) {
                        syncConnectedPortalsStorage(action.payload.platforms);
                    }
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
                        localStorage.removeItem("orbix_token");
                    } catch {
                        // ignore
                    }
                }
                state.error = action.payload || "Session verification failed";
            });
    },
});

export const { setUser, updateUserProfile, clearUser, setLoading, setPortalProfiles, setEmailVerified } = userSlice.actions;
export default userSlice.reducer;
