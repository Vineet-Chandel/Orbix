import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
    initiateVerification,
    confirmVerification,
    cancelVerification,
    VerificationApiError,
    startGitHubOwnershipVerification,
} from "./platformVerificationApi";

describe("Platform Verification API Client", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it("starts GitHub account linking with the selected handle and return page", async () => {
        globalThis.fetch = async (url, options) => {
            assert.match(String(url), /\/api\/auth\/github\/link$/);
            assert.equal(options?.method, "POST");
            assert.equal(options?.credentials, "include");
            assert.equal(options?.redirect, "error");
            assert.deepEqual(JSON.parse(String(options?.body)), { portalUsername: "vineet-chandel", returnTo: "https://orbix.example/onboarding" });
            return new Response(JSON.stringify({ success: true, url: "https://github.com/login/oauth/authorize?state=bound-session" }));
        };
        assert.equal(await startGitHubOwnershipVerification("vineet-chandel", "https://orbix.example/onboarding"), "https://github.com/login/oauth/authorize?state=bound-session");
    });

    it("surfaces initiation errors without trying a fallback navigation", async () => {
        let requests = 0;
        globalThis.fetch = async () => {
            requests++;
            return new Response(JSON.stringify({ success: false, message: "Session store unavailable" }), { status: 503 });
        };
        await assert.rejects(startGitHubOwnershipVerification("handle", "/onboarding"), /Session store unavailable/);
        assert.equal(requests, 1);
        globalThis.fetch = async () => new Response(JSON.stringify({ success: true, url: "https://orbix.example/dashboard?error=failed" }));
        await assert.rejects(startGitHubOwnershipVerification("handle", "/onboarding"), /Could not open GitHub authorization/);
    });

    describe("initiateVerification", () => {
        it("rejects empty portal or portalUsername with INVALID_INPUT before network request", async () => {
            await assert.rejects(
                async () => initiateVerification({ portal: "", portalUsername: "tourist" }),
                (err: any) => {
                    assert.equal(err.code, "INVALID_INPUT");
                    assert.equal(err.status, 400);
                    return true;
                }
            );

            await assert.rejects(
                async () => initiateVerification({ portal: "leetcode", portalUsername: "   " }),
                (err: any) => {
                    assert.equal(err.code, "INVALID_INPUT");
                    assert.equal(err.status, 400);
                    return true;
                }
            );
        });

        it("processes successful challenge initiation response", async () => {
            const mockResponse = {
                success: true,
                challengeId: "test-challenge-123",
                portal: "leetcode",
                portalUsername: "tourist",
                targetField: "aboutMe",
                displayFieldName: "About Me",
                token: "orbix-v-1234567890123456789012",
                tokenDisplayPrefix: "orbix-v-1234",
                instructions: "Add token to your LeetCode About Me bio.",
                profileSettingsUrl: "https://leetcode.com/profile/account/",
                expiresAt: "2026-11-20T22:30:00.000Z",
                alreadyVerified: false,
            };

            globalThis.fetch = async (url: any, init: any) => {
                assert.ok(String(url).includes("/api/portals/verification/initiate"));
                assert.equal(init.method, "POST");
                const body = JSON.parse(init.body);
                assert.equal(body.portal, "leetcode");
                assert.equal(body.portalUsername, "tourist");

                return new Response(JSON.stringify(mockResponse), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            };

            const result = await initiateVerification({ portal: "leetcode", portalUsername: "tourist" });
            assert.equal(result.success, true);
            assert.equal(result.token, "orbix-v-1234567890123456789012");
            assert.equal(result.targetField, "aboutMe");
            assert.equal(result.challengeId, "test-challenge-123");
        });

        it("parses RATE_LIMIT_EXCEEDED (429) and extracts resetInSeconds", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        code: "RATE_LIMIT_EXCEEDED",
                        message: "Verification initiation limit exceeded. Please wait 450 seconds before retrying.",
                    }),
                    {
                        status: 429,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => initiateVerification({ portal: "leetcode", portalUsername: "tourist" }),
                (err: any) => {
                    assert.ok(err instanceof VerificationApiError);
                    assert.equal(err.status, 429);
                    assert.equal(err.code, "RATE_LIMIT_EXCEEDED");
                    assert.equal(err.resetInSeconds, 450);
                    return true;
                }
            );
        });

        it("parses SERVICE_UNAVAILABLE (503) fail-closed state", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        code: "SERVICE_UNAVAILABLE",
                        message: "Verification service is temporarily unavailable. Please try again later.",
                    }),
                    {
                        status: 503,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => initiateVerification({ portal: "leetcode", portalUsername: "tourist" }),
                (err: any) => {
                    assert.equal(err.status, 503);
                    assert.equal(err.code, "SERVICE_UNAVAILABLE");
                    return true;
                }
            );
        });

        it("handles requiresOAuth for GitHub platform", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        code: "AUTH_REQUIRED",
                        message: "GitHub verification requires active GitHub OAuth identity.",
                        requiresOAuth: true,
                        oauthUrl: "/api/auth/github",
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => initiateVerification({ portal: "github", portalUsername: "octocat" }),
                (err: any) => {
                    assert.equal(err.requiresOAuth, true);
                    assert.equal(err.oauthUrl, "/api/auth/github");
                    return true;
                }
            );
        });
    });

    describe("confirmVerification", () => {
        it("handles successful verification confirmation", async () => {
            const mockConfirmSuccess = {
                success: true,
                verified: true,
                portal: "leetcode",
                portalUsername: "tourist",
                verificationMethod: "token",
                verifiedAt: "2026-11-20T21:50:00.000Z",
                message: "Platform account ownership verified successfully.",
            };

            globalThis.fetch = async (url: any, init: any) => {
                assert.ok(String(url).includes("/api/portals/verification/confirm"));
                assert.equal(init.method, "POST");
                return new Response(JSON.stringify(mockConfirmSuccess), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            };

            const result = await confirmVerification({ portal: "leetcode", portalUsername: "tourist" });
            assert.equal(result.success, true);
            assert.equal(result.verified, true);
            assert.equal(result.portal, "leetcode");
            assert.equal(result.verificationMethod, "token");
        });

        it("handles CHALLENGE_FAILED with attemptsRemaining", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        verified: false,
                        code: "CHALLENGE_FAILED",
                        message: "Token not found in external profile. 4 attempts remaining.",
                        attemptsRemaining: 4,
                    }),
                    {
                        status: 400,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => confirmVerification({ portal: "leetcode" }),
                (err: any) => {
                    assert.equal(err.status, 400);
                    assert.equal(err.code, "CHALLENGE_FAILED");
                    assert.equal(err.attemptsRemaining, 4);
                    return true;
                }
            );
        });

        it("handles CHALLENGE_EXPIRED (410)", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        verified: false,
                        code: "CHALLENGE_EXPIRED",
                        message: "Verification challenge has expired. Please initiate a new challenge.",
                    }),
                    {
                        status: 410,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => confirmVerification({ portal: "leetcode" }),
                (err: any) => {
                    assert.equal(err.status, 410);
                    assert.equal(err.code, "CHALLENGE_EXPIRED");
                    return true;
                }
            );
        });

        it("handles MAX_ATTEMPTS_EXCEEDED (429)", async () => {
            globalThis.fetch = async () => {
                return new Response(
                    JSON.stringify({
                        success: false,
                        verified: false,
                        code: "MAX_ATTEMPTS_EXCEEDED",
                        message: "Maximum verification attempts (5) exceeded for this challenge.",
                        attemptsRemaining: 0,
                    }),
                    {
                        status: 429,
                        headers: { "Content-Type": "application/json" },
                    }
                );
            };

            await assert.rejects(
                async () => confirmVerification({ portal: "codeforces" }),
                (err: any) => {
                    assert.equal(err.status, 429);
                    assert.equal(err.code, "MAX_ATTEMPTS_EXCEEDED");
                    assert.equal(err.attemptsRemaining, 0);
                    return true;
                }
            );
        });
    });

    describe("cancelVerification", () => {
        it("sends cancellation request to backend", async () => {
            globalThis.fetch = async (url: any, init: any) => {
                assert.ok(String(url).includes("/api/portals/verification/cancel"));
                assert.equal(init.method, "POST");
                const body = JSON.parse(init.body);
                assert.equal(body.portal, "leetcode");

                return new Response(JSON.stringify({ success: true, cancelled: true }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            };

            const result = await cancelVerification({ portal: "leetcode" });
            assert.equal(result.success, true);
            assert.equal(result.cancelled, true);
        });
    });
});
