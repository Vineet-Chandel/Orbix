import { resolveGitHubLinkReturnTo, assertGitHubLinkIdentity } from "./githubLinkFlow.js";
// Backend/src/services/auth/oauthService.ts
import crypto from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { query, pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { userDetailsCache } from "../../redis/cache/cache-auth.js";
import { createSession } from "../session/sessionService.js";
import { OnboardingEmailService } from "../email/onboardingEmailService.js";
import { checkHandleAvailabilityAcrossPlatform } from "../../validators/usernamePolicy.js";
import { platformVerificationService } from "../verification/platformVerificationService.js";
import { assertVerificationSchemaReady, resetSchemaStateCache, verificationSchemaRequiredError } from "../verification/schemaCompatibility.js";

const DEFAULT_AVATAR_URL = "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
const ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STATE_COOKIE_NAME = "orbix_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

/**
 * Universal atomic GET-and-DEL Lua script for single-use OAuth CSRF state tokens.
 * Guarantees that concurrent callbacks attempting to consume the same state cannot both succeed.
 */
export const ATOMIC_GET_DEL_LUA = `
local val = redis.call('GET', KEYS[1])
if val then
    redis.call('DEL', KEYS[1])
end
return val
`;

export interface OAuthStatePayload {
    state: string;
    provider: "google" | "github";
    action?: "login" | "link";
    userId?: string;
    sessionId?: string;
    targetUsername?: string | undefined;
    returnTo?: string | undefined;
    deviceId?: string | undefined;
    redirectUri?: string | undefined;
    createdAt: number;
}

export interface NormalizedOAuthProfile {
    provider: "google" | "github";
    providerId: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
    usernameCandidate?: string;
}

export class OAuthService {
    private static getJWTSecret(): string {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error("JWT_SECRET is not configured on the server");
        }
        return secret;
    }

    public static getFrontendUrl(): string {
        const raw =
            process.env.FRONTEND_URL ||
            process.env.APP_BASE_URL ||
            process.env.SITE_URL ||
            (process.env.NODE_ENV === "production" ? "https://theorbix.world" : "http://localhost:5173");
        return raw.trim().replace(/\/+$/, "");
    }

    public static getBackendUrl(): string {
        const raw =
            process.env.BACKEND_URL ||
            (process.env.NODE_ENV === "production"
                ? (process.env.SITE_URL || process.env.FRONTEND_URL || "https://theorbix.world")
                : `http://localhost:${process.env.PORT || 3000}`);
        return raw.trim().replace(/\/+$/, "");
    }

    public static getGitHubCallbackUrl(): string {
        const raw = process.env.GITHUB_CALLBACK_URL;
        if (raw && typeof raw === "string" && raw.trim().length > 0) {
            return raw.trim().replace(/\/+$/, "");
        }
        return `${this.getBackendUrl()}/api/auth/github/callback`;
    }

    public static getGoogleCallbackUrl(): string {
        const raw = process.env.GOOGLE_CALLBACK_URL;
        if (raw && typeof raw === "string" && raw.trim().length > 0) {
            return raw.trim().replace(/\/+$/, "");
        }
        return `${this.getBackendUrl()}/api/auth/google/callback`;
    }

    public static getAuthCookieOptions() {
        const isProduction = process.env.NODE_ENV === "production";
        return {
            httpOnly: true,
            sameSite: "lax" as const,
            path: "/",
            secure: isProduction,
        };
    }

    /**
     * Generate cryptographically secure state token and store it in an HTTPOnly cookie and Redis.
     */
    public static async generateState(
        res: Response,
        provider: "google" | "github",
        returnTo?: string,
        deviceId?: string
    ): Promise<string> {
        const state = crypto.randomBytes(32).toString("hex");
        const redirectUri = provider === "github" ? this.getGitHubCallbackUrl() : this.getGoogleCallbackUrl();
        const payload: OAuthStatePayload = {
            state,
            provider,
            returnTo: returnTo || "/dashboard",
            deviceId: deviceId || undefined,
            redirectUri,
            createdAt: Date.now(),
        };

        // 1. Store in Redis with TTL if Redis is operational
        try {
            if (redis && redis.status === "ready") {
                await redis.set(
                    `oauth:state:${state}`,
                    JSON.stringify(payload),
                    "EX",
                    STATE_TTL_SECONDS
                );
            }
        } catch (err) {
            console.warn("⚠️ Redis state storage warning:", err);
        }

        // 2. Set signed/serialized state in an HTTPOnly cookie as robust fallback
        res.cookie(STATE_COOKIE_NAME, JSON.stringify(payload), {
            ...this.getAuthCookieOptions(),
            maxAge: STATE_TTL_SECONDS * 1000,
        });

        return state;
    }

    /**
     * Generate cryptographically secure state token bound strictly to an authenticated user ID for account linking.
     * Enforces fail-closed requirement: distributed Redis storage MUST be operational to ensure single-use guarantees.
     */
    public static async generateLinkState(
        res: Response,
        userId: string,
        returnTo?: string,
        targetUsername?: string,
        deviceId?: string,
        sessionId?: string
    ): Promise<string> {
        const cleanUserId = userId ? String(userId).trim() : "";
        if (!cleanUserId) {
            const err: any = new Error("Cannot generate account-linking OAuth state without authenticated userId");
            err.statusCode = 401;
            err.code = "AUTH_REQUIRED";
            throw err;
        }

        const cleanSessionId = sessionId ? String(sessionId).trim() : "";
        if (!cleanSessionId) {
            const err: any = new Error("Cannot generate account-linking OAuth state without active sessionId");
            err.statusCode = 401;
            err.code = "SESSION_REQUIRED";
            throw err;
        }

        // Fail-closed invariant: Distributed atomic storage is strictly required for account linking
        if (!redis || redis.status !== "ready") {
            const err: any = new Error(
                "Distributed session store (Redis) is unavailable. Secure account linking cannot be initiated without atomic single-use guarantees."
            );
            err.statusCode = 503;
            err.code = "SERVICE_UNAVAILABLE";
            throw err;
        }

        const state = crypto.randomBytes(32).toString("hex");
        const redirectUri = this.getGitHubCallbackUrl();
        const payload: OAuthStatePayload = {
            state,
            action: "link",
            provider: "github",
            userId: cleanUserId,
            sessionId: cleanSessionId,
            targetUsername: targetUsername || undefined,
            returnTo: resolveGitHubLinkReturnTo(returnTo, this.getFrontendUrl()),
            deviceId: deviceId || undefined,
            redirectUri,
            createdAt: Date.now(),
        };

        // 1. Store in Redis with TTL using atomic SET
        try {
            await redis.set(
                `oauth:state:${state}`,
                JSON.stringify(payload),
                "EX",
                STATE_TTL_SECONDS
            );
        } catch (err: any) {
            console.error("Failed to store OAuth link state in Redis:", err);
            const failure: any = new Error("Failed to persist secure OAuth state in distributed storage.");
            failure.statusCode = 503;
            failure.code = "SERVICE_UNAVAILABLE";
            throw failure;
        }

        // 2. Set signed/serialized state in an HTTPOnly cookie as reference
        res.cookie(STATE_COOKIE_NAME, JSON.stringify(payload), {
            ...this.getAuthCookieOptions(),
            maxAge: STATE_TTL_SECONDS * 1000,
        });

        return state;
    }

    /**
     * Inspect incoming state without mutating or deleting it (for cancellation/error routing).
     */
    public static async peekState(
        req: Request,
        incomingState: string
    ): Promise<OAuthStatePayload | null> {
        if (!incomingState || typeof incomingState !== "string") return null;
        try {
            if (redis && redis.status === "ready") {
                const redisData = await redis.get(`oauth:state:${incomingState}`);
                if (redisData) return JSON.parse(redisData);
            }
        } catch {}
        const rawCookie = req.cookies?.[STATE_COOKIE_NAME];
        if (rawCookie) {
            try {
                const parsed = typeof rawCookie === "string" ? JSON.parse(rawCookie) : rawCookie;
                if (parsed && parsed.state === incomingState) return parsed;
            } catch {}
        }
        return null;
    }

    /**
     * Invalidate and consume state safely upon cancellation or failure.
     * Guarantees a cancelled or failed transaction cannot leave a reusable authorization state.
     */
    public static async invalidateState(
        req: Request,
        res: Response,
        incomingState: string
    ): Promise<OAuthStatePayload | null> {
        if (!incomingState || typeof incomingState !== "string") return null;
        let statePayload: OAuthStatePayload | null = null;

        try {
            if (redis && redis.status === "ready") {
                const redisData = await redis.eval(
                    ATOMIC_GET_DEL_LUA,
                    1,
                    `oauth:state:${incomingState}`
                );
                if (redisData && typeof redisData === "string") {
                    statePayload = JSON.parse(redisData);
                }
            }
        } catch (err) {
            console.warn("⚠️ Redis state invalidation warning:", err);
        }

        if (!statePayload) {
            const rawCookie = req.cookies?.[STATE_COOKIE_NAME];
            if (rawCookie) {
                try {
                    const parsed = typeof rawCookie === "string" ? JSON.parse(rawCookie) : rawCookie;
                    if (parsed && parsed.state === incomingState) {
                        statePayload = parsed;
                    }
                } catch {}
            }
        }

        // Clear the state cookie
        res.clearCookie(STATE_COOKIE_NAME, this.getAuthCookieOptions());
        return statePayload;
    }

    /**
     * Strictly validates session and user binding between initiating OAuth state and incoming callback session.
     * Enforces fail-closed rules: both userId and sessionId are mandatory on state AND callback.
     * Rejects missing, mismatched, expired, or replaced sessions.
     */
    public static validateCallbackSessionBinding(
        statePayload: { userId?: string | null; sessionId?: string | null; returnTo?: string },
        authOutcome: { ok: boolean; user?: { id: string } | null; sessionId?: string | null }
    ): { ok: true } | { ok: false; code: string; message: string } {
        const stateUserId = statePayload.userId ? String(statePayload.userId).trim() : "";
        const stateSessionId = statePayload.sessionId ? String(statePayload.sessionId).trim() : "";

        if (!stateUserId || !stateSessionId) {
            return {
                ok: false,
                code: "INVALID_LINKING_STATE",
                message: "Invalid linking state: missing bound user ID or session ID. Account linking rejected.",
            };
        }

        if (!authOutcome.ok || !authOutcome.user?.id) {
            return {
                ok: false,
                code: "SESSION_EXPIRED_OR_INVALID",
                message: "Your active Orbix session has expired or is invalid. Account linking rejected.",
            };
        }

        const currentUserId = String(authOutcome.user.id).trim();
        const currentSessionId = authOutcome.sessionId ? String(authOutcome.sessionId).trim() : "";

        if (!currentSessionId) {
            return {
                ok: false,
                code: "CALLBACK_SESSION_ID_MISSING",
                message: "Session validation failed: active session ID missing from current session. Account linking rejected.",
            };
        }

        if (currentUserId !== stateUserId) {
            return {
                ok: false,
                code: "USER_MISMATCH",
                message: "Session mismatch: active authenticated user does not match the account that initiated GitHub linking.",
            };
        }

        if (currentSessionId !== stateSessionId) {
            return {
                ok: false,
                code: "SESSION_MISMATCH",
                message: "Session mismatch: active authenticated session was replaced or modified during linking. Account linking rejected.",
            };
        }

        return { ok: true };
    }

    /**
     * Atomically validate and consume incoming state parameter against Redis and cookie.
     * Uses atomic Lua GETDEL to ensure concurrent callbacks cannot both succeed.
     * For account linking ('link'), cookie fallback is strictly rejected (fail closed).
     */
    public static async validateState(
        req: Request,
        res: Response,
        incomingState: string,
        expectedProvider: "google" | "github",
        expectedAction?: "login" | "link"
    ): Promise<OAuthStatePayload> {
        if (!incomingState || typeof incomingState !== "string") {
            throw new Error("Missing or invalid OAuth state parameter");
        }

        let statePayload: OAuthStatePayload | null = null;

        // 1. Check Redis first using atomic get-and-delete
        try {
            if (redis && redis.status === "ready") {
                const redisData = await redis.eval(
                    ATOMIC_GET_DEL_LUA,
                    1,
                    `oauth:state:${incomingState}`
                );
                if (redisData && typeof redisData === "string") {
                    statePayload = JSON.parse(redisData);
                }
            }
        } catch (err) {
            console.warn("⚠️ Redis state lookup warning:", err);
        }

        // 2. Cookie fallback ONLY for standard public login/signup (action !== "link")
        // Client-controlled cookies cannot guarantee single-use concurrency without server state
        if (!statePayload) {
            const rawCookie = req.cookies?.[STATE_COOKIE_NAME];
            if (rawCookie) {
                try {
                    const parsed = typeof rawCookie === "string" ? JSON.parse(rawCookie) : rawCookie;
                    if (parsed && parsed.state === incomingState) {
                        // Fail-closed invariant: Reject cookie fallback for account linking
                        if (parsed.action === "link") {
                            throw new Error("OAuth session state expired or invalid. Please try signing in again.");
                        }
                        statePayload = parsed;
                    }
                } catch (e: any) {
                    if (e.message?.includes("OAuth session state expired")) throw e;
                }
            }
        }

        // Clear the state cookie
        res.clearCookie(STATE_COOKIE_NAME, this.getAuthCookieOptions());

        if (!statePayload) {
            throw new Error("OAuth session state expired or invalid. Please try signing in again.");
        }

        if (statePayload.provider !== expectedProvider) {
            throw new Error(`Provider mismatch: expected ${expectedProvider}, got ${statePayload.provider}`);
        }

        if (expectedAction && (statePayload.action || "login") !== expectedAction) {
            throw new Error(`OAuth action mismatch: expected ${expectedAction}, got ${statePayload.action || "login"}`);
        }

        return statePayload;
    }

    /**
     * Build Google OAuth Authorization URL
     */
    public static getGoogleAuthUrl(state: string, customRedirectUri?: string): string {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            throw new Error("GOOGLE_CLIENT_ID is not configured in backend environment variables");
        }

        const callbackUrl = customRedirectUri || this.getGoogleCallbackUrl();

        const params = new URLSearchParams({
            client_id: clientId.trim(),
            redirect_uri: callbackUrl,
            response_type: "code",
            scope: "openid email profile",
            access_type: "offline",
            prompt: "select_account",
            state,
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    /**
     * Build GitHub OAuth Authorization URL
     */
    public static getGitHubAuthUrl(state: string, customRedirectUri?: string): string {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            throw new Error("GITHUB_CLIENT_ID is not configured in backend environment variables");
        }

        const callbackUrl = customRedirectUri || this.getGitHubCallbackUrl();

        const params = new URLSearchParams({
            client_id: clientId.trim(),
            redirect_uri: callbackUrl,
            scope: "read:user user:email",
            state,
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange Google authorization code and fetch verified profile
     */
    public static async exchangeGoogleCode(code: string, customRedirectUri?: string): Promise<NormalizedOAuthProfile> {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const callbackUrl = customRedirectUri || this.getGoogleCallbackUrl();

        if (!clientId || !clientSecret) {
            throw new Error("Google OAuth credentials are not properly configured");
        }

        // 1. Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
                redirect_uri: callbackUrl,
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok || !tokenData?.access_token) {
            console.error("Google token exchange error:", tokenData);
            throw new Error(tokenData?.error_description || tokenData?.error || "Failed to exchange Google authorization code");
        }

        // 2. Fetch User Profile
        const profileRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`,
            },
        });

        const profile = await profileRes.json().catch(() => null);
        if (!profileRes.ok || !profile?.sub || !profile?.email) {
            console.error("Google userinfo error:", profile);
            throw new Error("Failed to fetch verified user profile from Google");
        }

        // 3. Ensure email is verified by Google
        if (profile.email_verified !== true && profile.email_verified !== "true") {
            throw new Error("Your Google email is not verified. Please verify your Google email first.");
        }

        const email = profile.email.trim().toLowerCase();
        const candidateUsername = email.split("@")[0].replace(/[^a-z0-9._-]/gi, "");

        return {
            provider: "google",
            providerId: String(profile.sub),
            email,
            name: profile.name || `${profile.given_name || ""} ${profile.family_name || ""}`.trim() || candidateUsername,
            firstName: profile.given_name || profile.name?.split(" ")[0] || candidateUsername,
            lastName: profile.family_name || profile.name?.split(" ").slice(1).join(" ") || "Developer",
            avatarUrl: profile.picture || null,
            usernameCandidate: candidateUsername,
        };
    }

    /**
     * Exchange GitHub authorization code and fetch verified profile & primary email
     */
    public static async exchangeGitHubCode(code: string, customRedirectUri?: string): Promise<NormalizedOAuthProfile> {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const callbackUrl = customRedirectUri || this.getGitHubCallbackUrl();

        if (!clientId || !clientSecret) {
            throw new Error("GitHub OAuth credentials are not properly configured");
        }

        // 1. Exchange code for access token
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            signal: AbortSignal.timeout(10_000),
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: clientId.trim(),
                client_secret: clientSecret.trim(),
                code: code.trim(),
                redirect_uri: callbackUrl,
            }),
        });

        const tokenData = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok || !tokenData?.access_token) {
            console.error("GitHub token exchange failed:", { status: tokenRes.status, code: tokenData?.error });
            throw new Error(tokenData?.error_description || tokenData?.error || "Failed to exchange GitHub authorization code");
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch User Profile
        const userRes = await fetch("https://api.github.com/user", {
            signal: AbortSignal.timeout(10_000),
            headers: {
                Authorization: `Bearer ${accessToken}`,
                "User-Agent": "Orbix-OAuth-Platform",
                Accept: "application/vnd.github.v3+json",
            },
        });

        const userData = await userRes.json().catch(() => null);
        if (!userRes.ok || !userData?.id) {
            console.error("GitHub user API error:", userData);
            throw new Error("Failed to fetch GitHub user account");
        }

        // 3. Fetch User Emails (to reliably acquire primary verified email, even if private)
        let primaryEmail: string | null = null;
        if (userData.email && typeof userData.email === "string") {
            primaryEmail = userData.email.trim().toLowerCase();
        }

        try {
            const emailsRes = await fetch("https://api.github.com/user/emails", {
                signal: AbortSignal.timeout(5_000),
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "User-Agent": "Orbix-OAuth-Platform",
                    Accept: "application/vnd.github.v3+json",
                },
            });

            if (emailsRes.ok) {
                const emailsList: Array<{ email: string; primary: boolean; verified: boolean }> =
                    await emailsRes.json();
                if (Array.isArray(emailsList) && emailsList.length > 0) {
                    const primaryVerified = emailsList.find((e) => e.primary && e.verified);
                    const anyVerified = emailsList.find((e) => e.verified);
                    if (primaryVerified) {
                        primaryEmail = primaryVerified.email.trim().toLowerCase();
                    } else if (anyVerified) {
                        primaryEmail = anyVerified.email.trim().toLowerCase();
                    }
                }
            }
        } catch (err) {
            console.warn("⚠️ GitHub emails fetch warning:", err);
        }

        if (!primaryEmail) {
            throw new Error(
                "Unable to retrieve a verified email address from your GitHub account. Please ensure your GitHub account has at least one verified email."
            );
        }

        const candidateUsername = (userData.login || primaryEmail.split("@")[0]).replace(/[^a-z0-9._-]/gi, "");

        return {
            provider: "github",
            providerId: String(userData.id),
            email: primaryEmail,
            name: userData.name || userData.login || candidateUsername,
            firstName: userData.name?.split(" ")[0] || userData.login || candidateUsername,
            lastName: userData.name?.split(" ").slice(1).join(" ") || "Developer",
            avatarUrl: userData.avatar_url || null,
            usernameCandidate: candidateUsername,
        };
    }

    /**
     * Authenticated Account Linking:
     * Links an immutable GitHub provider ID to an existing authenticated Orbix user.
     * Enforces:
     * - Atomic database transaction (all-or-nothing rollback on failure)
     * - Row-level locking (FOR UPDATE) to prevent concurrency races
     * - Database-level unique constraint handling (idx_users_github_id, unique_verified_portal_account)
     * - No email matching
     * - No new user creation
     * - No session switching
     * - No silent replacement of an existing different GitHub ID
     * - Rejection if GitHub ID is already bound to another Orbix user
     * - Rejection if GitHub handle is already verified by another Orbix user
     * - Automatic verified ownership recording in user_links within same transaction
     */
    public static async linkGitHubAccount(
        userId: string,
        profile: NormalizedOAuthProfile,
        targetUsername?: string,
        externalClient?: any
    ): Promise<{ success: boolean; linkedUser: any; verifiedHandle: string }> {
        if (!userId) {
            throw new Error("Missing authenticated user ID for account linking");
        }

        assertGitHubLinkIdentity(targetUsername, profile.usernameCandidate);
        await assertVerificationSchemaReady();

        const numericProviderId = String(profile.providerId).trim();
        if (!numericProviderId) {
            throw new Error("Missing immutable GitHub provider ID from provider profile");
        }

        const client = externalClient || (await pool.connect());
        const shouldManageTransaction = externalClient?.manageTransaction !== undefined
            ? Boolean(externalClient.manageTransaction)
            : !externalClient;

        try {
            if (shouldManageTransaction) {
                await client.query("BEGIN;");
            }

            // 1. Fetch authenticated user from database with row lock FOR UPDATE
            const userRes = await client.query(
                `SELECT id, username, email, firstname AS "firstName", lastname AS "lastName",
                        termsaccepted AS "termsAccepted", account_type AS "accountType", github_id AS "githubId"
                 FROM public.users
                 WHERE id = $1
                 FOR UPDATE;`,
                [userId]
            );

            if (userRes.rows.length === 0) {
                const err: any = new Error("Authenticated Orbix user account not found");
                err.statusCode = 404;
                err.code = "USER_NOT_FOUND";
                throw err;
            }

            const currentUser = userRes.rows[0];

            // 2. Reject silent replacement if user already has a different GitHub ID linked
            if (currentUser.githubId && String(currentUser.githubId).trim() !== numericProviderId) {
                const err: any = new Error(
                    `Your Orbix account is already linked to a different GitHub account (ID: ${currentUser.githubId}). Please unlink it before linking a new account.`
                );
                err.statusCode = 409;
                err.code = "CANNOT_REPLACE_EXISTING_LINK";
                throw err;
            }

            // 3. Reject if this GitHub numeric ID is already bound to another Orbix user
            const conflictRes = await client.query(
                `SELECT id, username
                 FROM public.users
                 WHERE github_id = $1 AND id != $2
                 LIMIT 1;`,
                [numericProviderId, userId]
            );

            if (conflictRes.rows.length > 0) {
                const err: any = new Error(
                    "This GitHub account is already linked to another Orbix user account."
                );
                err.statusCode = 409;
                err.code = "ACCOUNT_ALREADY_BOUND";
                throw err;
            }

            // 4. Resolve the handle to bind (priority: targetUsername claim -> GitHub login handle -> candidate)
            const resolvedHandle = (targetUsername || profile.usernameCandidate || profile.name || "github").trim();

            // 5. Ensure external handle is not verified by another user in user_links
            const handleConflictRes = await client.query(
                `SELECT user_id
                 FROM public.user_links
                 WHERE LOWER(TRIM(portal)) = 'github'
                   AND LOWER(TRIM(portal_username)) = LOWER(TRIM($1))
                   AND ownership_status = 'VERIFIED'
                   AND user_id != $2
                 LIMIT 1;`,
                [resolvedHandle, userId]
            );

            if (handleConflictRes.rows.length > 0) {
                const err: any = new Error(
                    `The GitHub handle '${resolvedHandle}' is already verified by another Orbix user.`
                );
                err.statusCode = 409;
                err.code = "HANDLE_ALREADY_VERIFIED";
                throw err;
            }

            // 6. Bind immutable numeric GitHub ID to user
            await client.query(
                `UPDATE public.users
                 SET github_id = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2;`,
                [numericProviderId, userId]
            );

            // The selected identity was proven by GitHub. Update its saved handle
            // before recording proof, so identity-reset triggers run before verification.
            await client.query(
                `UPDATE public.user_links SET portal_username = $1, link = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $3 AND LOWER(TRIM(portal)) = 'github'
                   AND LOWER(TRIM(portal_username)) IS DISTINCT FROM LOWER(TRIM($1));`,
                [resolvedHandle, `https://github.com/${resolvedHandle}`, userId]
            );

            // 7. Authoritative ownership recording in user_links within same transaction
            await platformVerificationService.recordVerifiedOwnership(
                userId,
                "github",
                resolvedHandle,
                "oauth",
                {
                    githubId: numericProviderId,
                    githubUsername: profile.usernameCandidate || resolvedHandle,
                    linkedAt: new Date().toISOString(),
                },
                client
            );

            if (shouldManageTransaction) {
                await client.query("COMMIT;");
                await platformVerificationService.refreshOwnershipAfterCommit(userId);
            }

            // 8. Update Redis details cache after successful commit
            await userDetailsCache({
                id: currentUser.id,
                gmail: currentUser.email,
                username: currentUser.username,
                accountType: currentUser.accountType || "personal",
                firstName: currentUser.firstName || "",
                lastName: currentUser.lastName || "",
                termsAccepted: Boolean(currentUser.termsAccepted),
            }).catch(() => {});

            return {
                success: true,
                linkedUser: currentUser,
                verifiedHandle: resolvedHandle,
            };
        } catch (err: any) {
            if (shouldManageTransaction) {
                await client.query("ROLLBACK;").catch(() => {});
            }

            if (err?.code === "42703" || err?.code === "42P01") {
                resetSchemaStateCache();
                throw verificationSchemaRequiredError();
            }

            // Cleanly normalize PostgreSQL database unique constraint violations
            if (err?.code === "23505") {
                if (err.constraint === "idx_users_github_id" || err.detail?.includes("github_id") || err.message?.includes("idx_users_github_id")) {
                    const boundErr: any = new Error("This GitHub account is already linked to another Orbix user account.");
                    boundErr.statusCode = 409;
                    boundErr.code = "ACCOUNT_ALREADY_BOUND";
                    throw boundErr;
                }
                if (err.constraint === "unique_verified_portal_account" || err.detail?.includes("portal_username") || err.message?.includes("unique_verified_portal_account")) {
                    const handleErr: any = new Error(`The GitHub handle '${targetUsername || profile.usernameCandidate || "github"}' is already verified by another Orbix user.`);
                    handleErr.statusCode = 409;
                    handleErr.code = "HANDLE_ALREADY_VERIFIED";
                    throw handleErr;
                }
            }

            throw err;
        } finally {
            if (!externalClient && client && typeof client.release === "function") {
                client.release();
            }
        }
    }

    /**
     * Canonical Account Linking & Onboarding:
     * - If user with matching email already exists, link the provider and authenticate that exact account.
     * - If no user exists, create a new personal account, assigning the OAuth profile picture as avatar.
     */
    public static async findOrCreateOAuthUser(
        profile: NormalizedOAuthProfile
    ): Promise<{ user: any; isNewUser: boolean }> {
        const normalizedEmail = profile.email.trim().toLowerCase();

        // 1. Look up existing user by email
        const existingResult = await query(
            `SELECT
                id,
                username,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                termsaccepted AS "termsAccepted",
                account_type AS "accountType",
                avatar_url AS "avatarUrl",
                photo_url AS "photoUrl",
                google_id AS "googleId",
                github_id AS "githubId",
                auth_provider AS "authProvider",
                is_email_verified AS "isEmailVerified"
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1;`,
            [normalizedEmail]
        );

        if (existingResult.rows.length > 0) {
            const existingUser = existingResult.rows[0];

            if (existingUser.accountType === "club") {
                const err: any = new Error(
                    "OAuth sign-in is only supported for Personal accounts. Please use the Club Portal to sign in with your club credentials."
                );
                err.statusCode = 403;
                err.code = "ACCOUNT_TYPE_MISMATCH";
                throw err;
            }

            // If user exists, target the exact same account (canonical email identity)
            const updates: string[] = [];
            const values: any[] = [];
            let valIdx = 1;

            // Link provider ID
            if (profile.provider === "google" && !existingUser.googleId) {
                updates.push(`google_id = $${valIdx++}`);
                values.push(profile.providerId);
            } else if (profile.provider === "github" && !existingUser.githubId) {
                updates.push(`github_id = $${valIdx++}`);
                values.push(profile.providerId);
            }

            // Ensure email is marked verified because provider already verified it
            if (!existingUser.isEmailVerified) {
                updates.push(`is_email_verified = true`);
                updates.push(`email_verified_at = CURRENT_TIMESTAMP`);
                updates.push(`is_verified_coder = true`);
            }

            // If user has default avatar and provider supplies an authentic photo, update it
            const currentAvatar = existingUser.photoUrl || existingUser.avatarUrl;
            if (
                profile.avatarUrl &&
                (!currentAvatar || currentAvatar === DEFAULT_AVATAR_URL)
            ) {
                updates.push(`avatar_url = $${valIdx++}`);
                values.push(profile.avatarUrl);
            }

            if (updates.length > 0) {
                values.push(existingUser.id);
                await query(
                    `UPDATE users SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = $${valIdx};`,
                    values
                );
            }

            // Synchronize leaderboard verified status
            try {
                await query(
                    `UPDATE leaderboard_entries SET is_verified = true WHERE user_id = $1;`,
                    [existingUser.id]
                );
            } catch {
                // Non-blocking
            }

            // Prime / update Redis details cache
            await userDetailsCache({
                id: existingUser.id,
                firstName: existingUser.firstName,
                middleName: existingUser.middleName,
                lastName: existingUser.lastName,
                gmail: normalizedEmail,
                username: existingUser.username,
                termsAccepted: existingUser.termsAccepted,
                accountType: existingUser.accountType || "personal",
            });

            return { user: existingUser, isNewUser: false };
        }

        // 2. User does not exist: Register new personal account
        const uniqueUsername = await this.generateUniqueUsername(
            profile.usernameCandidate || profile.name
        );

        const initialAvatarUrl = profile.avatarUrl || DEFAULT_AVATAR_URL;
        const googleId = profile.provider === "google" ? profile.providerId : null;
        const githubId = profile.provider === "github" ? profile.providerId : null;

        const insertResult = await query(
            `INSERT INTO users (
                id,
                username,
                firstname,
                lastname,
                email,
                password,
                termsaccepted,
                avatar_url,
                is_email_verified,
                email_verified_at,
                is_verified_coder,
                google_id,
                github_id,
                auth_provider,
                account_type,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                $1,
                $2,
                $3,
                $4,
                NULL,
                true,
                $5,
                true,
                CURRENT_TIMESTAMP,
                true,
                $6,
                $7,
                $8,
                'personal',
                CURRENT_TIMESTAMP,
                CURRENT_TIMESTAMP
            ) RETURNING
                id,
                username,
                firstname AS "firstName",
                lastname AS "lastName",
                email AS gmail,
                termsaccepted AS "termsAccepted",
                account_type AS "accountType",
                avatar_url AS "avatarUrl";`,
            [
                uniqueUsername,
                profile.firstName || profile.name,
                profile.lastName || "Developer",
                normalizedEmail,
                initialAvatarUrl,
                googleId,
                githubId,
                profile.provider,
            ]
        );

        const createdUser = insertResult.rows[0];

        // Seed initial leaderboard entry
        try {
            const initialDisplayName = `${createdUser.firstName || ""} ${createdUser.lastName || ""}`.trim() || createdUser.username;
            await query(
                `INSERT INTO leaderboard_entries (user_id, username, display_name, is_verified, score, platform_ratings)
                 VALUES ($1, $2, $3, true, 0, '{}'::jsonb)
                 ON CONFLICT (user_id) DO UPDATE SET
                     username = EXCLUDED.username,
                     display_name = COALESCE(NULLIF(EXCLUDED.display_name, ''), leaderboard_entries.display_name),
                     is_verified = true;`,
                [createdUser.id, createdUser.username, initialDisplayName]
            );
        } catch {
            // Non-blocking
        }

        // Prime Redis cache
        await userDetailsCache({
            id: createdUser.id,
            firstName: createdUser.firstName,
            lastName: createdUser.lastName,
            gmail: normalizedEmail,
            username: createdUser.username,
            termsAccepted: true,
            accountType: "personal",
        });

        // Send founder welcome gesture email asynchronously for new OAuth signup
        OnboardingEmailService.sendPersonalWelcomeEmailAsync({
            to: normalizedEmail,
            firstName: createdUser.firstName,
            username: createdUser.username,
            userId: createdUser.id,
        });

        return { user: createdUser, isNewUser: true };
    }

    /**
     * Generate an alphanumeric, clean, URL-safe unique username
     */
    private static async generateUniqueUsername(baseSuggestion: string): Promise<string> {
        let clean = baseSuggestion
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9._-]/g, "");

        if (clean.length < 3) {
            clean = `coder_${clean}`;
        }
        if (clean.length > 15) {
            clean = clean.slice(0, 15);
        }

        // Ensure starts with a letter or number
        if (!/^[a-z0-9]/.test(clean)) {
            clean = `u_${clean}`;
        }

        let candidate = clean;
        let attempt = 0;

        while (attempt < 50) {
            const availability = await checkHandleAvailabilityAcrossPlatform(candidate, { entityType: "user" });
            if (availability.available) {
                return candidate;
            }

            // Append random suffix
            const suffix = Math.floor(100 + Math.random() * 900);
            candidate = `${clean.slice(0, 12)}_${suffix}`;
            attempt++;
        }

        return `user_${Date.now().toString().slice(-6)}`;
    }

    /**
     * Finalize OAuth login: create canonical session, issue JWTs, set HTTPOnly cookies, return tokens
     */
    public static async finalizeOAuthSession(
        user: any,
        provider: "google" | "github",
        req: Request,
        res: Response,
        deviceId?: string
    ): Promise<{ token: string; refreshToken: string; sessionId: string }> {
        if (user?.accountType === "club" || user?.account_type === "club") {
            const err: any = new Error("OAuth sign-in is not permitted for Club accounts.");
            err.statusCode = 403;
            err.code = "ACCOUNT_TYPE_MISMATCH";
            throw err;
        }

        const JWT_SECRET = this.getJWTSecret();

        if (deviceId) {
            req.headers["x-orbix-device-id"] = deviceId;
        }

        // 1. Create canonical persistent session record
        const sessionResult = await createSession({
            userId: user.id,
            req,
            loginMethod: provider,
            isMfa: false,
        });
        const sessionId = sessionResult.sessionId;

        // 2. Generate Access Token & Refresh Token (matching local signin/signup format)
        const token = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail || user.email,
                username: user.username,
                sid: sessionId,
                accountType: "personal",
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users",
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail || user.email,
                username: user.username,
                sid: sessionId,
                accountType: "personal",
                type: "refresh",
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users",
            }
        );

        // 3. Set standard HTTPOnly auth cookies
        res.cookie("token", token, {
            ...this.getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS,
        });

        res.cookie("refreshToken", refreshToken, {
            ...this.getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS,
        });

        return { token, refreshToken, sessionId };
    }
}
