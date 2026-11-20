import { configureStore } from "@reduxjs/toolkit";
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import userReducer from "./userSlice";
import submissionsReducer from "./submissionsSlice";
import developmentReducer from "./developmentSlice";
import contestsReducer from "./contestsSlice";
import badgesReducer from "./badgesSlice";
import practiceAnalyticsReducer from "./practiceAnalyticsSlice";
import developmentAnalyticsReducer from "./developmentAnalyticsSlice";
import eventsReducer from "./eventsSlice";
import networkReducer from "./networkSlice";
import clubReducer from "./clubSlice";
import clubEventsReducer from "./clubEventsSlice";
import leaderboardReducer from "./leaderboardSlice";
import { personalDataApi } from "./personalDataApi";

export const store = configureStore({
    reducer: {
        user: userReducer,
        submissions: submissionsReducer,
        development: developmentReducer,
        contests: contestsReducer,
        badges: badgesReducer,
        practiceAnalytics: practiceAnalyticsReducer,
        developmentAnalytics: developmentAnalyticsReducer,
        events: eventsReducer,
        network: networkReducer,
        club: clubReducer,
        clubEvents: clubEventsReducer,
        leaderboard: leaderboardReducer,
        [personalDataApi.reducerPath]: personalDataApi.reducer,
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(personalDataApi.middleware),
});

// Drop private cached responses on logout or identity changes, including pending queries.
let cachedIdentity = store.getState().user.user?.id || store.getState().user.user?.username;
store.subscribe(() => {
    const identity = store.getState().user.user?.id || store.getState().user.user?.username;
    if (identity !== cachedIdentity) {
        cachedIdentity = identity;
        store.dispatch(personalDataApi.util.resetApiState());
    }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export * from "./userSlice";
export * from "./submissionsSlice";
export * from "./developmentSlice";
export * from "./contestsSlice";
export * from "./badgesSlice";
export * from "./practiceAnalyticsSlice";
export * from "./developmentAnalyticsSlice";
export * from "./eventsSlice";
export * from "./networkSlice";
export * from "./clubSlice";
export * from "./clubEventsSlice";
export * from "./leaderboardSlice";
