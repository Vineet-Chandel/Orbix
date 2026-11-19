// Backend/src/Routes/auth/oauthRoutes.ts
import express, { type Request, type Response } from "express";
import { OAuthService } from "../../services/auth/oauthService.js";

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
 * 4. GITHUB OAUTH CALLBACK
 * Route: GET /api/auth/github/callback
 */
oauthRouter.get("/github/callback", async (req: Request, res: Response) => {
    const frontendUrl = OAuthService.getFrontendUrl();

    try {
        const code = req.query.code as string;
        const incomingState = req.query.state as string;
        const providerError = req.query.error as string;

        if (providerError) {
            return res.redirect(
                `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                    `GitHub sign-in was cancelled or denied: ${providerError}`
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

        // 1. Verify CSRF state token
        const statePayload = await OAuthService.validateState(req, res, incomingState, "github");

        // 2. Exchange authorization code for user profile
        const profile = await OAuthService.exchangeGitHubCode(code);

        // 3. Link existing user or create a new user account
        const { user, isNewUser } = await OAuthService.findOrCreateOAuthUser(profile);

        // 4. Finalize session, issue JWTs & set HTTPOnly cookies
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
        return res.redirect(
            `${frontendUrl}/auth/signin?error=${encodeURIComponent(
                err.message || "Failed to authenticate with GitHub"
            )}`
        );
    }
});
