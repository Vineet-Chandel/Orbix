import { configureStore } from "@reduxjs/toolkit";
import { type TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import userReducer from "./userSlice";
import submissionsReducer from "./submissionsSlice";
import developmentReducer from "./developmentSlice";
import contestsReducer from "./contestsSlice";
import badgesReducer from "./badgesSlice";
import practiceAnalyticsReducer from "./practiceAnalyticsSlice";

export const store = configureStore({
    reducer: {
        user: userReducer,
        submissions: submissionsReducer,
        development: developmentReducer,
        contests: contestsReducer,
        badges: badgesReducer,
        practiceAnalytics: practiceAnalyticsReducer,
    },
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
