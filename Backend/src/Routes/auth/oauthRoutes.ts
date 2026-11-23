// Backend/src/Routes/auth/oauthRoutes.ts
import express, { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { OAuthService } from "../../services/auth/oauthService.js";
import { authenticate, resolveAuthenticatedUser } from "../../middlewares/auth.middleware.js";
import { assertVerificationSchemaReady } from "../../services/verification/schemaCompatibility.js";
import { checkVerificationRateLimit } from "../../services/verification/verificationRateLimiter.js";

export const oauthRouter = express.Router();

/**
 * 1. INITIATE GOOGLE OAUTH
 * Route: GET /api/auth/google
 */
oauthRouter.get("/google", async (req: Request, res: Response) => {
    try {
        const returnTo = (req.query.returnTo as string) || "/dashboard";
        const deviceId =
            (req.headers["x-orbix-device-id"] as string) ||
            (req.query.deviceId as string) ||
            undefined;

        const state = await OAuthService.generateState(res, "google", returnTo, deviceId);
        const authUrl = OAuthService.getGoogleAuthUrl(state);

        if (req.query.redirect === "false" || req.headers.accept?.includes("application/json")) {
            return res.json({ success: true, url: authUrl });
        }

        return res.redirect(authUrl);
    } catch (err: any) {
        console.error("Initiate Google OAuth error:", err);
        const frontendUrl = OAuthService.getFrontendUrl();
        return res.redirect(
            `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                err.message || "Failed to initiate Google sign-in"
            )}`
        );
    }
});

/**
 * 2. GOOGLE OAUTH CALLBACK
 * Route: GET /api/auth/google/callback
 */
oauthRouter.get("/google/callback", async (req: Request, res: Response) => {
    const frontendUrl = OAuthService.getFrontendUrl();

    try {
        const code = req.query.code as string;
        const incomingState = req.query.state as string;
        const providerError = req.query.error as string;

        if (providerError) {
            return res.redirect(
                `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                    `Google sign-in was cancelled or denied: ${providerError}`
                )}`
            );
        }

        if (!code) {
            return res.redirect(
                `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                    "Missing authorization code from Google"
                )}`
            );
        }

        // 1. Verify CSRF state token
        const statePayload = await OAuthService.validateState(req, res, incomingState, "google");

        // 2. Exchange authorization code for user profile
        const profile = await OAuthService.exchangeGoogleCode(code);

        // 3. Link existing user or create a new user account
        const { user, isNewUser } = await OAuthService.findOrCreateOAuthUser(profile);

        // 4. Finalize session, issue JWTs & set HTTPOnly cookies
        const { token } = await OAuthService.finalizeOAuthSession(
            user,
            "google",
            req,
            res,
            statePayload.deviceId
        );

        const targetDestination = statePayload.returnTo || "/dashboard";
        return res.redirect(
            `${frontendUrl}/auth/callback?token=${encodeURIComponent(
                token
            )}&status=success&provider=google&isNew=${isNewUser ? "1" : "0"}&returnTo=${encodeURIComponent(
                targetDestination
            )}`
        );
    } catch (err: any) {
        console.error("Google OAuth callback error:", err);
        return res.redirect(
            `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                err.message || "Failed to authenticate with Google"
            )}`
        );
    }
});

/**
 * 3. INITIATE GITHUB OAUTH
 * Route: GET /api/auth/github
 */
oauthRouter.get("/github", async (req: Request, res: Response) => {
    try {
        const returnTo = (req.query.returnTo as string) || "/dashboard";
        const deviceId =
            (req.headers["x-orbix-device-id"] as string) ||
            (req.query.deviceId as string) ||
            undefined;

        const state = await OAuthService.generateState(res, "github", returnTo, deviceId);
        const authUrl = OAuthService.getGitHubAuthUrl(state);

        if (req.query.redirect === "false" || req.headers.accept?.includes("application/json")) {
            return res.json({ success: true, url: authUrl });
        }

        return res.redirect(authUrl);
    } catch (err: any) {
        console.error("Initiate GitHub OAuth error:", err);
        const frontendUrl = OAuthService.getFrontendUrl();
        return res.redirect(
            `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                err.message || "Failed to initiate GitHub sign-in"
            )}`
        );
    }
});

/**
 * 4. INITIATE AUTHENTICATED GITHUB ACCOUNT LINKING
 * Route: GET & POST /api/auth/github/link
 * Requires authenticated Orbix user. Binds OAuth transaction to req.user.id.
 */
oauthRouter.all("/github/link", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        if (!authUser?.id) {
            return res.status(401).json({ success: false, code: "AUTH_REQUIRED", message: "Authentication required to link GitHub account" });
        }

        const sessionId = (req as any).sessionId ? String((req as any).sessionId).trim() : "";
        if (!sessionId) {
            return res.status(401).json({
                success: false,
                code: "SESSION_REQUIRED",
                message: "Valid active session required to link GitHub account",
            });
        }

        const limit = await checkVerificationRateLimit(authUser.id, "initiate", 10, 15 * 60);
        if (!limit.allowed) {
            if (limit.code === "RATE_LIMIT_EXCEEDED") res.setHeader("Retry-After", String(limit.resetInSeconds));
            return res.status(limit.code === "RATE_LIMIT_EXCEEDED" ? 429 : 503).json({
                success: false, code: limit.code,
                message: limit.error || "GitHub verification is temporarily unavailable. Please retry.",
                resetInSeconds: limit.resetInSeconds,
            });
        }
        await assertVerificationSchemaReady();

        const returnTo = (req.body?.returnTo || req.query.returnTo as string) || "/onboarding";
        const portalUsername = (req.body?.portalUsername || req.query.portalUsername as string) || undefined;
        const deviceId =
            (req.headers["x-orbix-device-id"] as string) ||
            (req.query.deviceId as string) ||
            undefined;

        const state = await OAuthService.generateLinkState(
            res,
            authUser.id,
            returnTo,
            portalUsername,
            deviceId,
            sessionId
        );
        const authUrl = OAuthService.getGitHubAuthUrl(state);

        if (req.method === "POST" || req.query.redirect === "false" || req.headers.accept?.includes("application/json")) {
            return res.json({ success: true, url: authUrl });
        }

        return res.redirect(authUrl);
    } catch (err: any) {
        console.error("Initiate GitHub Account Link error:", err);
        if (req.method === "POST" || req.query.redirect === "false" || req.headers.accept?.includes("application/json")) {
            return res.status(err.statusCode || 503).json({
                success: false,
                code: err.code || "GITHUB_LINK_FAILED",
                message: err.message || "Could not start GitHub verification. Please retry.",
            });
        }
        const frontendUrl = OAuthService.getFrontendUrl();
        return res.redirect(
            `${frontendUrl}/dashboard?error=${encodeURIComponent(
                err.message || "Failed to initiate GitHub account linking"
            )}`
        );
    }
});

/**
 * 5. GITHUB OAUTH CALLBACK (Dual-mode: Normal Login vs Authenticated Linking)
 * Route: GET /api/auth/github/callback and GET /api/auth/github/link/callback
 */
oauthRouter.get(["/github/callback", "/github/link/callback"], async (req: Request, res: Response) => {
    const frontendUrl = OAuthService.getFrontendUrl();
    let statePayload: any = null;

    try {
        const code = req.query.code as string;
        const incomingState = req.query.state as string;
        const providerError = req.query.error as string;
        const providerErrorDescription = req.query.error_description as string;
        const errorMessage = providerErrorDescription || providerError;

        if (providerError) {
            if (incomingState) {
                try {
                    // Atomically invalidate the state so cancellation does not leave a reusable token
                    statePayload = await OAuthService.invalidateState(req, res, incomingState);
                } catch {
                    // ignore
                }
            }

            if (statePayload?.action === "link" && statePayload?.returnTo) {
                const sep = statePayload.returnTo.includes("?") ? "&" : "?";
                return res.redirect(
                    `${statePayload.returnTo}${sep}status=cancelled&error=${encodeURIComponent(
                        errorMessage || "GitHub account linking was cancelled on GitHub"
                    )}&portal=github`
                );
            }

            return res.redirect(
                `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                    `GitHub sign-in was cancelled or denied: ${errorMessage}`
                )}`
            );
        }

        if (!code) {
            return res.redirect(
                `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                    "Missing authorization code from GitHub"
                )}`
            );
        }

        // 1. Verify and atomically consume CSRF state token via Redis Lua GETDEL
        statePayload = await OAuthService.validateState(req, res, incomingState, "github");

        // 2. Exchange authorization code for user profile
        const profile = await OAuthService.exchangeGitHubCode(code, statePayload.redirectUri);

        // 3. ISOLATED ACCOUNT-LINKING TRANSACTION:
        if (statePayload.action === "link") {
            const targetDestination = statePayload.returnTo || "/dashboard";
            const separator = targetDestination.includes("?") ? "&" : "?";

            // CRITICAL: Verify that the incoming callback request is from an active authenticated session
            // that strictly matches the initiating user ID and exact session ID (fail closed)
            const authOutcome = await resolveAuthenticatedUser(req);
            const bindingCheck = OAuthService.validateCallbackSessionBinding(statePayload, authOutcome);
            if (!bindingCheck.ok) {
                return res.redirect(
                    `${targetDestination}${separator}status=error&error=${encodeURIComponent(
                        bindingCheck.message
                    )}&portal=github`
                );
            }

            // Safe to execute atomic database transaction binding
            await OAuthService.linkGitHubAccount(
                statePayload.userId,
                profile,
                statePayload.targetUsername
            );

            return res.redirect(
                `${targetDestination}${separator}status=success&portal=github&action=linked&username=${encodeURIComponent(
                    profile.usernameCandidate || profile.name || ""
                )}`
            );
        }

        // 4. Standard Login/Registration Flow (Completely untouched!)
        const { user, isNewUser } = await OAuthService.findOrCreateOAuthUser(profile);

        // 5. Finalize session, issue JWTs & set HTTPOnly cookies
        const { token } = await OAuthService.finalizeOAuthSession(
            user,
            "github",
            req,
            res,
            statePayload.deviceId
        );

        const targetDestination = statePayload.returnTo || "/dashboard";
        return res.redirect(
            `${frontendUrl}/auth/callback?token=${encodeURIComponent(
                token
            )}&status=success&provider=github&isNew=${isNewUser ? "1" : "0"}&returnTo=${encodeURIComponent(
                targetDestination
            )}`
        );
    } catch (err: any) {
        console.error("GitHub OAuth callback error:", err);
        if (statePayload?.action === "link" && statePayload?.returnTo) {
            const sep = statePayload.returnTo.includes("?") ? "&" : "?";
            return res.redirect(
                `${statePayload.returnTo}${sep}status=error&error=${encodeURIComponent(
                    err.message || "Failed to link GitHub account"
                )}&portal=github`
            );
        }
        return res.redirect(
            `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                err.message || "Failed to authenticate with GitHub"
            )}`
        );
    }
});

/**
 * 6. OAUTH SESSION SYNC & COOKIE ISSUANCE
 * Route: POST /api/auth/oauth/session and POST /api/auth/session/sync
 * Called by OAuthCallbackPage on the frontend origin with the token from the redirect URL.
 * Sets standard HTTPOnly cookies ('token' and 'refreshToken') directly on the frontend domain/origin.
 */
oauthRouter.post(["/oauth/session", "/session/sync"], async (req: Request, res: Response) => {
    try {
        const tokenCandidate =
            req.body?.token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : undefined) ||
            req.cookies?.token;

        if (!tokenCandidate || typeof tokenCandidate !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid authentication token is required.",
            });
        }

        req.headers.authorization = `Bearer ${tokenCandidate.trim()}`;

        const outcome = await resolveAuthenticatedUser(req);
        if (!outcome.ok) {
            return res.status(outcome.status).json({
                success: false,
                message: outcome.message,
            });
        }

        const user = outcome.user;
        const sessionId = outcome.sessionId;
        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            return res.status(500).json({ success: false, message: "JWT secret not configured." });
        }

        const accessToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: user.accountType || "personal",
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
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: user.accountType || "personal",
                type: "refresh",
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users",
            }
        );

        const ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000;
        const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

        res.cookie("token", accessToken, {
            ...OAuthService.getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS,
        });

        res.cookie("refreshToken", refreshToken, {
            ...OAuthService.getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS,
        });

        return res.json({
            success: true,
            user,
            token: accessToken,
            refreshToken,
        });
    } catch (err: any) {
        console.error("OAuth session sync error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to establish authenticated session.",
        });
    }
});
