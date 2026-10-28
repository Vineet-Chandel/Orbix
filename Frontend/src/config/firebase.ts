import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

/**
 * Firebase Client SDK Configuration for Orbix Phone Authentication.
 * Configuration values are sourced exclusively from environment variables.
 * Backend secrets (service accounts, private keys) are NEVER exposed here.
 */
export const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "",
};

/**
 * Determines whether client Firebase configuration has been populated.
 */
export const isFirebaseConfigured = (): boolean => {
    return Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.projectId &&
        firebaseConfig.apiKey !== "your_firebase_api_key" &&
        !firebaseConfig.apiKey.includes("your_")
    );
};

let appInstance: FirebaseApp;
let authInstance: Auth | null = null;

// Initialize Firebase only once across re-renders and hot-module reloads
if (typeof window !== "undefined") {
    try {
        if (getApps().length > 0) {
            appInstance = getApp();
        } else {
            // Provide a fallback placeholder config if env vars are unset during dev
            // to prevent runtime crash on module import
            const configToUse = isFirebaseConfigured()
                ? firebaseConfig
                : {
                    apiKey: "AIzaSyFakeKeyForLocalDevelopmentAndLinting00",
                    authDomain: "orbix-dev.firebaseapp.com",
                    projectId: "orbix-dev",
                    appId: "1:000000000000:web:0000000000000000000000",
                };
            appInstance = initializeApp(configToUse);
        }
        authInstance = getAuth(appInstance);
        // Set language code to browser default or English
        authInstance.useDeviceLanguage();
    } catch (initErr) {
        console.warn("[Firebase] Client initialization warning:", initErr);
    }
}

export const app = appInstance!;
export const auth = authInstance!;
export default auth;
