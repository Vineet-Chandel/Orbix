// Backend/src/services/auth/oauthService.ts
import crypto from "crypto";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { query } from "../../database/client.js";
import redis from "../../redis/client.js";
import { userDetailsCache } from "../../redis/cache/cache-auth.js";
import { createSession } from "../session/sessionService.js";

const DEFAULT_AVATAR_URL = "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
const ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const STATE_COOKIE_NAME = "orbix_oauth_state";
const STATE_TTL_SECONDS = 600; // 10 minutes

export interface OAuthStatePayload {
    state: string;
    provider: "google" | "github";
    returnTo?: string | undefined;
    deviceId?: string | undefined;
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
        return process.env.FRONTEND_URL || "http://localhost:5173";
    }

    public static getBackendUrl(): string {
        return process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`;
    }

    private static getAuthCookieOptions() {
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
        const payload: OAuthStatePayload = {
            state,
            provider,
            returnTo: returnTo || "/dashboard",
            deviceId: deviceId || undefined,
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
     * Validate incoming state parameter against stored state cookie and Redis.
     */
    public static async validateState(
        req: Request,
        res: Response,
        incomingState: string,
        expectedProvider: "google" | "github"
    ): Promise<OAuthStatePayload> {
        if (!incomingState || typeof incomingState !== "string") {
            throw new Error("Missing or invalid OAuth state parameter");
        }

        let statePayload: OAuthStatePayload | null = null;

        // 1. Check Redis first
        try {
            if (redis && redis.status === "ready") {
                const redisData = await redis.get(`oauth:state:${incomingState}`);
                if (redisData) {
                    statePayload = JSON.parse(redisData);
                    await redis.del(`oauth:state:${incomingState}`);
                }
            }
        } catch (err) {
            console.warn("⚠️ Redis state lookup warning:", err);
        }

        // 2. Fallback to HTTPOnly cookie
        if (!statePayload) {
            const rawCookie = req.cookies?.[STATE_COOKIE_NAME];
            if (rawCookie) {
                try {
                    const parsed = typeof rawCookie === "string" ? JSON.parse(rawCookie) : rawCookie;
                    if (parsed && parsed.state === incomingState) {
                        statePayload = parsed;
                    }
                } catch {
                    // Invalid cookie json
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

        return statePayload;
    }

    /**
     * Build Google OAuth Authorization URL
     */
    public static getGoogleAuthUrl(state: string): string {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        if (!clientId) {
            throw new Error("GOOGLE_CLIENT_ID is not configured in backend environment variables");
        }

        const callbackUrl =
            process.env.GOOGLE_CALLBACK_URL ||
            `${this.getBackendUrl()}/api/auth/google/callback`;

        const params = new URLSearchParams({
            client_id: clientId,
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
    public static getGitHubAuthUrl(state: string): string {
        const clientId = process.env.GITHUB_CLIENT_ID;
        if (!clientId) {
            throw new Error("GITHUB_CLIENT_ID is not configured in backend environment variables");
        }

        const callbackUrl =
            process.env.GITHUB_CALLBACK_URL ||
            `${this.getBackendUrl()}/api/auth/github/callback`;

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: callbackUrl,
            scope: "read:user user:email",
            state,
        });

        return `https://github.com/login/oauth/authorize?${params.toString()}`;
    }

    /**
     * Exchange Google authorization code and fetch verified profile
     */
    public static async exchangeGoogleCode(code: string): Promise<NormalizedOAuthProfile> {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const callbackUrl =
            process.env.GOOGLE_CALLBACK_URL ||
            `${this.getBackendUrl()}/api/auth/google/callback`;

        if (!clientId || !clientSecret) {
            throw new Error("Google OAuth credentials are not properly configured");
        }

        // 1. Exchange code for tokens
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: clientId,
                client_secret: clientSecret,
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
    public static async exchangeGitHubCode(code: string): Promise<NormalizedOAuthProfile> {
        const clientId = process.env.GITHUB_CLIENT_ID;
        const clientSecret = process.env.GITHUB_CLIENT_SECRET;
        const callbackUrl =
            process.env.GITHUB_CALLBACK_URL ||
            `${this.getBackendUrl()}/api/auth/github/callback`;

        if (!clientId || !clientSecret) {
            throw new Error("GitHub OAuth credentials are not properly configured");
        }

        // 1. Exchange code for access token
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                redirect_uri: callbackUrl,
            }),
        });

        const tokenData = await tokenRes.json().catch(() => null);
        if (!tokenRes.ok || !tokenData?.access_token) {
            console.error("GitHub token exchange error:", tokenData);
            throw new Error(tokenData?.error_description || tokenData?.error || "Failed to exchange GitHub authorization code");
        }

        const accessToken = tokenData.access_token;

        // 2. Fetch User Profile
        const userRes = await fetch("https://api.github.com/user", {
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
            await query(
                `INSERT INTO leaderboard_entries (user_id, username, is_verified, orbix_score)
                 VALUES ($1, $2, true, 0)
                 ON CONFLICT (user_id) DO UPDATE SET is_verified = true;`,
                [createdUser.id, createdUser.username]
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
            const checkRes = await query(
                `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                [candidate]
            );

            if (checkRes.rows.length === 0) {
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
