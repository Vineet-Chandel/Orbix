import { test, describe, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import { OAuthService } from "./oauthService.js";
import redis from "../../redis/client.js";
import { pool } from "../../database/client.js";

describe("GitHub OAuth Flow & Redirect URI Integrity Suite", () => {
    const originalEnv = { ...process.env };

    after(() => {
        try {
            redis.disconnect();
        } catch {}
        try {
            pool.end();
        } catch {}
    });

    beforeEach(() => {
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = { ...originalEnv };
    });

    test("1. Normalizes frontend and backend URLs by stripping trailing slashes", () => {
        process.env.FRONTEND_URL = "http://localhost:5173///";
        process.env.BACKEND_URL = "http://localhost:3000///";

        assert.equal(OAuthService.getFrontendUrl(), "http://localhost:5173");
        assert.equal(OAuthService.getBackendUrl(), "http://localhost:3000");
    });

    test("2. Defaults callback URL to ${BACKEND_URL}/api/auth/github/callback when GITHUB_CALLBACK_URL is unset", () => {
        delete process.env.GITHUB_CALLBACK_URL;
        process.env.BACKEND_URL = "http://localhost:3000";

        assert.equal(
            OAuthService.getGitHubCallbackUrl(),
            "http://localhost:3000/api/auth/github/callback"
        );
    });

    test("3. Uses explicit GITHUB_CALLBACK_URL when configured and strips trailing slashes", () => {
        process.env.GITHUB_CALLBACK_URL = "https://theorbix.world/api/auth/github/callback/";

        assert.equal(
            OAuthService.getGitHubCallbackUrl(),
            "https://theorbix.world/api/auth/github/callback"
        );
    });

    test("4. Constructs valid GitHub authorization URL with exact client_id and redirect_uri", () => {
        process.env.GITHUB_CLIENT_ID = "test-client-id-12345";
        process.env.GITHUB_CALLBACK_URL = "http://localhost:3000/api/auth/github/callback";

        const state = "random-csrf-token-abc";
        const authUrl = OAuthService.getGitHubAuthUrl(state);
        const url = new URL(authUrl);

        assert.equal(url.origin, "https://github.com");
        assert.equal(url.pathname, "/login/oauth/authorize");
        assert.equal(url.searchParams.get("client_id"), "test-client-id-12345");
        assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/github/callback");
        assert.equal(url.searchParams.get("scope"), "read:user user:email");
        assert.equal(url.searchParams.get("state"), state);
    });

    test("5. Supports custom redirect URI override in getGitHubAuthUrl", () => {
        process.env.GITHUB_CLIENT_ID = "test-client-id-12345";
        const state = "random-csrf-token-abc";
        const customUri = "https://custom.orbix.io/api/auth/github/callback";

        const authUrl = OAuthService.getGitHubAuthUrl(state, customUri);
        const url = new URL(authUrl);

        assert.equal(url.searchParams.get("redirect_uri"), customUri);
    });

    test("6. Throws descriptive error if GITHUB_CLIENT_ID is missing when generating auth URL", () => {
        delete process.env.GITHUB_CLIENT_ID;

        assert.throws(
            () => OAuthService.getGitHubAuthUrl("state-token"),
            /GITHUB_CLIENT_ID is not configured/
        );
    });

    test("7. State generation includes exact redirectUri in payload", async () => {
        process.env.GITHUB_CALLBACK_URL = "http://localhost:3000/api/auth/github/callback";
        let capturedCookie: { name: string; val: any } | null = null;
        const mockRes: any = {
            cookie: (name: string, val: any) => {
                capturedCookie = { name, val };
            },
        };

        const state = await OAuthService.generateState(mockRes, "github", "/dashboard");
        assert.ok(state);
        assert.ok(capturedCookie);
        const payload = JSON.parse(capturedCookie.val);
        assert.equal(payload.provider, "github");
        assert.equal(payload.redirectUri, "http://localhost:3000/api/auth/github/callback");
    });

    test("8. Google OAuth callback URL generation behaves consistently", () => {
        process.env.GOOGLE_CLIENT_ID = "test-google-client-id";
        process.env.GOOGLE_CALLBACK_URL = "http://localhost:3000/api/auth/google/callback";

        const authUrl = OAuthService.getGoogleAuthUrl("test-state");
        const url = new URL(authUrl);

        assert.equal(url.origin, "https://accounts.google.com");
        assert.equal(url.searchParams.get("client_id"), "test-google-client-id");
        assert.equal(url.searchParams.get("redirect_uri"), "http://localhost:3000/api/auth/google/callback");
    });
});
