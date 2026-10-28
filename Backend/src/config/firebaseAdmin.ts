import { initializeApp, getApps, getApp, cert, applicationDefault, type App } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";

/**
 * Orbix Firebase Admin SDK Configuration
 *
 * Centralized server-side Firebase Admin initialization.
 * Verifies Firebase ID tokens, claims, project identity, and phone numbers.
 * Backend credentials are NEVER exposed to the client.
 */

let isInitialized = false;
let configuredProjectId: string = process.env.FIREBASE_PROJECT_ID || "";

export function initializeFirebaseAdmin(): App | null {
    if (getApps().length > 0) {
        isInitialized = true;
        return getApps()[0] || null;
    }

    try {
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
        const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
        const projectId = process.env.FIREBASE_PROJECT_ID;

        if (serviceAccountJson) {
            const parsed = typeof serviceAccountJson === "string" ? JSON.parse(serviceAccountJson) : serviceAccountJson;
            configuredProjectId = parsed.project_id || projectId || "";
            const app = initializeApp({
                credential: cert(parsed),
                ...(configuredProjectId ? { projectId: configuredProjectId } : {}),
            });
            isInitialized = true;
            console.log(`[Firebase Admin] Initialized with Service Account JSON for project: ${configuredProjectId}`);
            return app;
        }

        if (serviceAccountPath) {
            const app = initializeApp({
                credential: cert(serviceAccountPath),
                ...(projectId ? { projectId } : {}),
            });
            isInitialized = true;
            configuredProjectId = projectId || "";
            console.log(`[Firebase Admin] Initialized with Service Account file for project: ${configuredProjectId}`);
            return app;
        }

        if (clientEmail && privateKey && projectId) {
            configuredProjectId = projectId;
            const app = initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
                projectId,
            });
            isInitialized = true;
            console.log(`[Firebase Admin] Initialized with individual credentials for project: ${projectId}`);
            return app;
        }

        if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
            const app = initializeApp({
                credential: applicationDefault(),
                ...(projectId ? { projectId } : {}),
            });
            isInitialized = true;
            configuredProjectId = projectId || app.options.projectId || "";
            console.log(`[Firebase Admin] Initialized with Application Default Credentials for project: ${configuredProjectId}`);
            return app;
        }

        if (projectId) {
            configuredProjectId = projectId;
            const app = initializeApp({
                projectId,
            });
            isInitialized = true;
            console.log(`[Firebase Admin] Initialized with Project ID: ${projectId}`);
            return app;
        }

        console.warn("[Firebase Admin] Notice: No Firebase credentials provided. Token verification will require FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID.");
        return null;
    } catch (err: any) {
        console.error("[Firebase Admin] Initialization error:", err.message);
        return null;
    }
}

export interface VerifiedFirebaseUser {
    uid: string;
    phoneNumber: string;
    authTime: number;
    issuer: string;
    audience: string;
    projectId: string;
}

/**
 * Authoritatively verifies a Firebase ID token.
 * Validates token signature, project ID, issuer, expiration, and ensures phone_number claim exists.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseUser> {
    if (!idToken || typeof idToken !== "string" || !idToken.trim()) {
        const error: any = new Error("Firebase ID token is required.");
        error.statusCode = 400;
        throw error;
    }

    const trimmedToken = idToken.trim();

    // Ensure Firebase Admin is initialized
    if (!isInitialized && getApps().length === 0) {
        initializeFirebaseAdmin();
    }

    if (getApps().length > 0 && process.env.NODE_ENV !== "test" && process.env.MOCK_FIREBASE_AUTH !== "true") {
        try {
            const defaultApp = getApp();
            const decoded: DecodedIdToken = await getAuth(defaultApp).verifyIdToken(trimmedToken, true);

            // 1. Verify project identity matches configured project
            const expectedProjectId = configuredProjectId || process.env.FIREBASE_PROJECT_ID;
            if (expectedProjectId) {
                const tokenProjectId = (decoded as any).firebase?.project_id || decoded.aud;
                if (tokenProjectId !== expectedProjectId) {
                    const error: any = new Error(
                        `Firebase token belongs to unauthorized project: ${tokenProjectId} (expected: ${expectedProjectId})`
                    );
                    error.statusCode = 403;
                    throw error;
                }
            }

            // 2. Validate token claims
            if (!decoded.phone_number) {
                const error: any = new Error("Firebase token is not associated with a verified phone number.");
                error.statusCode = 400;
                throw error;
            }

            // 3. Check expiration
            const now = Math.floor(Date.now() / 1000);
            if (decoded.exp && decoded.exp < now) {
                const error: any = new Error("Firebase ID token has expired. Please verify your phone number again.");
                error.statusCode = 401;
                throw error;
            }

            return {
                uid: decoded.uid,
                phoneNumber: decoded.phone_number,
                authTime: decoded.auth_time,
                issuer: decoded.iss,
                audience: decoded.aud,
                projectId: (decoded as any).firebase?.project_id || decoded.aud,
            };
        } catch (adminErr: any) {
            if (adminErr.statusCode) throw adminErr;

            const errCode = adminErr.code || "";
            let message = "Firebase token verification failed.";
            let statusCode = 401;

            if (errCode === "auth/id-token-expired") {
                message = "Verification session expired. Please verify your phone number again.";
            } else if (errCode === "auth/id-token-revoked") {
                message = "Verification token was revoked. Please verify your phone number again.";
            } else if (errCode === "auth/invalid-id-token" || errCode === "auth/argument-error") {
                message = "Invalid Firebase ID token provided.";
                statusCode = 400;
            } else if (adminErr.message) {
                message = adminErr.message;
            }

            const error: any = new Error(message);
            error.statusCode = statusCode;
            error.code = errCode;
            throw error;
        }
    }

    // Fallback for development/testing environment if Admin SDK credentials are not yet configured
    if (process.env.NODE_ENV !== "production") {
        console.warn("[Firebase Admin] Running in development fallback mode for token verification.");
        // Decode payload safely for simulation in test environments
        const parts = trimmedToken.split(".");
        const payloadPart = parts[1];
        if (parts.length === 3 && payloadPart) {
            try {
                const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
                const expectedProjectId = configuredProjectId || process.env.FIREBASE_PROJECT_ID || "orbix-dev";
                if (payload.aud && payload.aud !== expectedProjectId) {
                    const error: any = new Error(
                        `Firebase token belongs to unauthorized project: ${payload.aud} (expected: ${expectedProjectId})`
                    );
                    error.statusCode = 403;
                    throw error;
                }

                const now = Math.floor(Date.now() / 1000);
                if (payload.exp && payload.exp < now) {
                    const error: any = new Error("Firebase ID token has expired. Please verify your phone number again.");
                    error.statusCode = 401;
                    throw error;
                }

                if (!payload.phone_number) {
                    const error: any = new Error("Firebase token is not associated with a verified phone number.");
                    error.statusCode = 400;
                    throw error;
                }

                return {
                    uid: payload.user_id || payload.sub || "simulated_uid",
                    phoneNumber: payload.phone_number,
                    authTime: payload.auth_time || Math.floor(Date.now() / 1000),
                    issuer: payload.iss || `https://securetoken.google.com/${expectedProjectId || "orbix-dev"}`,
                    audience: payload.aud || expectedProjectId || "orbix-dev",
                    projectId: payload.firebase?.project_id || payload.aud || expectedProjectId || "orbix-dev",
                };
            } catch (pErr: any) {
                if (pErr.statusCode) throw pErr;
            }
        }
    }

    const unconfiguredErr: any = new Error(
        "Firebase Admin authentication service is not configured. Please supply FIREBASE_SERVICE_ACCOUNT_KEY or FIREBASE_PROJECT_ID in server environment."
    );
    unconfiguredErr.statusCode = 503;
    throw unconfiguredErr;
}
