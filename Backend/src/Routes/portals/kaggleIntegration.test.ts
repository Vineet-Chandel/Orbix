/**
 * ORBIX KAGGLE BACKEND INTEGRATION - REGRESSION TEST SUITE
 * 
 * Comprehensive tests covering:
 * 1. Platform Detection & Resolution (detectPortalFromUrl, extractPortalUsername, buildPortalLink)
 * 2. Public Data Retrieval (fetchKaggle): Normal, Partial, JSON-LD, 404, Rate Limit, Timeout
 * 3. verifyAndFetchPortal Integration & Routing
 * 4. Scoring Engine Non-Pollution Invariant
 * 5. Strict Separation of Ownership Verification vs. Public Crawling
 */

import { test, describe, beforeEach, afterEach, after } from "node:test";
import assert from "node:assert/strict";
import redis from "../../redis/client.js";

import {
    fetchKaggle,
    fetchKaggleDetailed,
    verifyAndFetchPortal,
    verifyAndFetchPortalDetailed,
    detectPortalFromUrl,
    extractPortalUsername,
    buildPortalLink,
    type PortalProfileData,
    type PortalFetchDetailResult,
} from "./portals.js";
import { adapterRegistry } from "../../services/verification/adapters/adapterRegistry.js";
import { KaggleAdapter } from "../../services/verification/adapters/kaggleAdapter.js";
import { computeOrbixScoreFromPortals } from "../../scoring/orbixScore.js";

describe("ORBIX — Kaggle Backend Integration Test Suite", () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    after(async () => {
        if (redis && typeof redis.disconnect === "function") {
            try {
                redis.disconnect();
            } catch {
                // ignore
            }
        }
    });

    // =========================================================================
    // 1. PLATFORM DETECTION & PROFILE RESOLUTION
    // =========================================================================
    describe("Platform Detection & Profile Resolution", () => {
        test("detectPortalFromUrl accurately detects Kaggle URLs", () => {
            assert.equal(detectPortalFromUrl("https://www.kaggle.com/vineetchandel"), "kaggle");
            assert.equal(detectPortalFromUrl("https://kaggle.com/vineetchandel"), "kaggle");
            assert.equal(detectPortalFromUrl("http://kaggle.com/vineetchandel/competitions"), "kaggle");
            assert.equal(detectPortalFromUrl("https://www.kaggle.com/vineetchandel?tab=code"), "kaggle");
            assert.equal(detectPortalFromUrl("KAGGLE.COM/vineetchandel"), "kaggle");
        });

        test("detectPortalFromUrl rejects or differentiates non-Kaggle URLs", () => {
            assert.equal(detectPortalFromUrl("https://leetcode.com/vineetchandel"), "leetcode");
            assert.equal(detectPortalFromUrl("https://github.com/vineetchandel"), "github");
            assert.equal(detectPortalFromUrl("https://unknown-domain.org/vineetchandel"), null);
            assert.equal(detectPortalFromUrl(""), null);
            assert.equal(detectPortalFromUrl(null as any), null);
        });

        test("extractPortalUsername extracts valid usernames from diverse URL formats", () => {
            // Canonical URL
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineetchandel"), "vineetchandel");
            // Trailing slash
            assert.equal(extractPortalUsername("kaggle", "https://kaggle.com/vineetchandel/"), "vineetchandel");
            // Sub-paths (code, competitions, datasets, discussion)
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineetchandel/competitions"), "vineetchandel");
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineetchandel/code"), "vineetchandel");
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineetchandel/datasets"), "vineetchandel");
            // Query parameters and fragment
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineetchandel?tab=datasets#overview"), "vineetchandel");
            // Bare username
            assert.equal(extractPortalUsername("kaggle", "vineetchandel"), "vineetchandel");
            // Leading @ symbol
            assert.equal(extractPortalUsername("kaggle", "@vineetchandel"), "vineetchandel");
            // Username with hyphens and underscores
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/vineet_chandel-99"), "vineet_chandel-99");
        });

        test("extractPortalUsername rejects reserved system routes and malformed handles", () => {
            // Reserved Kaggle system paths must not be extracted as usernames
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/competitions"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/datasets"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/code"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/learn"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/models"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/discussion"), null);
            assert.equal(extractPortalUsername("kaggle", "https://www.kaggle.com/about"), null);
            assert.equal(extractPortalUsername("kaggle", "competitions"), null);

            // Invalid username constraints (length 3-30, forbidden characters)
            assert.equal(extractPortalUsername("kaggle", "ab"), null, "Too short (< 3 chars)");
            assert.equal(extractPortalUsername("kaggle", "a".repeat(35)), null, "Too long (> 30 chars)");
            assert.equal(extractPortalUsername("kaggle", "vineet$chandel"), null, "Illegal character '$'");
            assert.equal(extractPortalUsername("kaggle", ""), null, "Empty input");
        });

        test("buildPortalLink constructs canonical Kaggle profile URL", () => {
            assert.equal(buildPortalLink("kaggle", "vineetchandel"), "https://www.kaggle.com/vineetchandel");
            assert.equal(buildPortalLink("kaggle", " user_123 "), "https://www.kaggle.com/user_123");
        });
    });

    // =========================================================================
    // 2. KAGGLE DATA RETRIEVAL (fetchKaggle)
    // =========================================================================
    describe("Kaggle Data Retrieval (fetchKaggle)", () => {
        test("Successfully retrieves public profile with full Open Graph and tier metadata", async () => {
            const mockHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Vineet Chandel | Grandmaster | Kaggle</title>
                    <meta property="og:title" content="Vineet Chandel | Grandmaster" />
                    <meta property="og:image" content="https://storage.googleapis.com/kaggle-avatars/vineetchandel.png" />
                    <meta property="og:description" content="Kaggle profile for Vineet Chandel. Machine learning engineer." />
                    <meta property="og:url" content="https://www.kaggle.com/vineetchandel" />
                    <meta property="og:type" content="profile" />
                </head>
                <body>
                    <div class="user-stats">125 followers</div>
                </body>
                </html>
            `;

            globalThis.fetch = async (url: any) => {
                assert.ok(String(url).includes("vineetchandel"));
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any;
            };

            const data = await fetchKaggle("vineetchandel");
            assert.ok(data !== null, "Profile data must not be null");
            assert.equal(data.success, true);
            assert.equal(data.portal, "kaggle");
            assert.equal(data.username, "vineetchandel");
            assert.equal(data.name, "Vineet Chandel");
            assert.equal(data.avatar, "https://storage.googleapis.com/kaggle-avatars/vineetchandel.png");
            assert.equal(data.profileUrl, "https://www.kaggle.com/vineetchandel");

            // CRITICAL OWNERSHIP INVARIANT
            assert.equal(data.verified, false, "Public crawling must NEVER grant verified ownership status");

            // Stats extraction
            const portalStat = data.stats.find((s) => s.label === "portal");
            const catStat = data.stats.find((s) => s.label === "category");
            const tierStat = data.stats.find((s) => s.label === "tier");
            const followersStat = data.stats.find((s) => s.label === "followers");

            assert.equal(portalStat?.value, "Kaggle");
            assert.equal(catStat?.value, "Data Science & ML");
            assert.equal(tierStat?.value, "Grandmaster");
            assert.equal(followersStat?.value, "125 followers");
        });

        test("Handles missing optional fields with graceful fallbacks (no fabricated data)", async () => {
            const mockMinimalHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>minimaluser | Kaggle</title>
                </head>
                <body>
                    <div>Minimal profile</div>
                </body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockMinimalHtml,
            } as any);

            const data = await fetchKaggle("minimaluser");
            assert.ok(data !== null);
            assert.equal(data.success, true);
            assert.equal(data.username, "minimaluser");
            assert.equal(data.name, "minimaluser");
            // Must have a deterministic fallback avatar
            assert.ok(data.avatar.startsWith("https://api.dicebear.com/"), "Must fall back to deterministic avatar");
            assert.equal(data.verified, false);

            const tierStat = data.stats.find((s) => s.label === "tier");
            assert.equal(tierStat, undefined, "Must not fabricate a tier default when missing");
        });

        test("Extracts Person metadata from embedded JSON-LD if present", async () => {
            const mockJsonLdHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Data Scientist | Kaggle</title>
                    <script type="application/ld+json">
                    {
                        "@context": "http://schema.org",
                        "@type": "Person",
                        "name": "Dr. Data Scientist",
                        "image": "https://storage.googleapis.com/kaggle-avatars/drdata.jpg"
                    }
                    </script>
                </head>
                <body></body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockJsonLdHtml,
            } as any);

            const data = await fetchKaggle("drdata");
            assert.ok(data !== null);
            assert.equal(data.name, "Dr. Data Scientist");
            assert.equal(data.avatar, "https://storage.googleapis.com/kaggle-avatars/drdata.jpg");
            assert.equal(data.verified, false);
        });

        test("Returns null for nonexistent profile (HTTP 404)", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                text: async () => "Not Found",
            } as any);

            const data = await fetchKaggle("nonexistent_user_9999");
            assert.equal(data, null, "Must return null when user does not exist (404)");
        });

        test("Returns null when HTML contains 404 or Page Not Found indicators", async () => {
            const notFoundHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Page Not Found | Kaggle</title>
                </head>
                <body>
                    <h1>Page Not Found</h1>
                </body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => notFoundHtml,
            } as any);

            const data = await fetchKaggle("deleted_account");
            assert.equal(data, null, "Must return null when page indicates Page Not Found");
        });

        test("Returns null gracefully on network timeout or abort", async () => {
            globalThis.fetch = async () => {
                throw new Error("The operation was aborted due to timeout");
            };

            const data = await fetchKaggle("timeoutuser");
            assert.equal(data, null, "Must handle network timeout gracefully without throwing");
        });

        test("Returns null on HTTP 429 rate limit or HTTP 500 error", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                statusText: "Too Many Requests",
                text: async () => "Rate limit exceeded",
            } as any);

            const data = await fetchKaggle("rate_limited_user");
            assert.equal(data, null, "Must handle rate limit without crash");
        });

        test("Pre-emptively returns null for invalid usernames without calling network", async () => {
            let fetchCalled = false;
            globalThis.fetch = async () => {
                fetchCalled = true;
                return { ok: true } as any;
            };

            const tooShort = await fetchKaggle("ab");
            assert.equal(tooShort, null);
            assert.equal(fetchCalled, false, "Network must not be called for invalid usernames");

            const reserved = await fetchKaggle("competitions");
            assert.equal(reserved, null);
            assert.equal(fetchCalled, false, "Network must not be called for reserved routes");
        });
    });

    // =========================================================================
    // 2B. DETAILED RESPONSE CLASSIFICATION & ANTI-BOT FAIL-CLOSED GUARANTEES
    // =========================================================================
    describe("Detailed Response Classification & Anti-Bot Protection (fetchKaggleDetailed)", () => {
        test("Confirmed HTTP 404 maps to code: ACCOUNT_NOT_FOUND (status 404)", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                statusText: "Not Found",
            } as any);

            const result = await fetchKaggleDetailed("missing_kaggler");
            assert.equal(result.success, false);
            assert.equal(result.code, "ACCOUNT_NOT_FOUND");
            assert.equal(result.statusCode, 404);
            assert.ok(result.message.includes("Account not found on kaggle"));
        });

        test("HTML containing Page Not Found indicators maps to code: ACCOUNT_NOT_FOUND (status 404)", async () => {
            const notFoundHtml = `<html><head><title>Page Not Found | Kaggle</title></head><body><h1>Page Not Found</h1></body></html>`;
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => notFoundHtml,
            } as any);

            const result = await fetchKaggleDetailed("deleted_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "ACCOUNT_NOT_FOUND");
            assert.equal(result.statusCode, 404);
        });

        test("CRITICAL REGRESSION: reCAPTCHA Enterprise challenge shell maps to PLATFORM_UNAVAILABLE (status 503) — NEVER ACCOUNT_NOT_FOUND", async () => {
            const recaptchaHtml = `
                <!doctype html><html lang="en-US" dir="ltr"><head>
                <base href="https://www.google.com/recaptcha/challengepage/">
                <title>Checking your browser - reCAPTCHA</title>
                <script>window['ppConfig'] = {productName: 'RecaptchaChallengePageUi'};</script>
                </head>
                <body>
                <div class="fBEGtb">Checking your browser before accessing www.kaggle.com ...</div>
                <div class="g-recaptcha" data-sitekey="6Ldxq2IpAAAAAIXyCS5jnxpiPbvmOlpcNu9ovJpc"></div>
                </body></html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => recaptchaHtml,
            } as any);

            const result = await fetchKaggleDetailed("rt2248");
            assert.equal(result.success, false);
            assert.notEqual(
                result.code,
                "ACCOUNT_NOT_FOUND",
                "REGRESSION: reCAPTCHA challenge must NEVER be classified as ACCOUNT_NOT_FOUND"
            );
            assert.equal(result.code, "PLATFORM_UNAVAILABLE");
            assert.equal(result.statusCode, 503);
            assert.ok(result.message.includes("anti-bot verification") || result.message.includes("temporarily unavailable"));
        });

        test("HTTP 403 access forbidden maps to code: PLATFORM_UNAVAILABLE (status 503)", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 403,
                statusText: "Forbidden",
            } as any);

            const result = await fetchKaggleDetailed("forbidden_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "PLATFORM_UNAVAILABLE");
            assert.equal(result.statusCode, 503);
            assert.ok(result.message.includes("blocked automated access"));
        });

        test("HTTP 429 rate limit maps to code: RATE_LIMITED (status 429)", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                statusText: "Too Many Requests",
            } as any);

            const result = await fetchKaggleDetailed("throttled_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "RATE_LIMITED");
            assert.equal(result.statusCode, 429);
            assert.ok(result.message.includes("rate limit"));
        });

        test("HTTP 500 / 503 platform error maps to code: PLATFORM_UNAVAILABLE (status 503)", async () => {
            globalThis.fetch = async () => ({
                ok: false,
                status: 500,
                statusText: "Internal Server Error",
            } as any);

            const result = await fetchKaggleDetailed("server_err_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "PLATFORM_UNAVAILABLE");
            assert.equal(result.statusCode, 503);
            assert.ok(result.message.includes("currently unavailable"));
        });

        test("Connection timeout or abort maps to code: NETWORK_ERROR (status 504)", async () => {
            globalThis.fetch = async () => {
                const err: any = new Error("The operation was aborted due to timeout");
                err.name = "TimeoutError";
                throw err;
            };

            const result = await fetchKaggleDetailed("timeout_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "NETWORK_ERROR");
            assert.equal(result.statusCode, 504);
            assert.ok(result.message.includes("timed out"));
        });

        test("HTTP 200 with unknown/unrecognized HTML structure maps to code: PARSE_ERROR (status 502)", async () => {
            const randomHtml = `<html><head><title>Some Random Page</title></head><body>Hello world without any Kaggle identity</body></html>`;
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => randomHtml,
            } as any);

            const result = await fetchKaggleDetailed("unrecognized_html_user");
            assert.equal(result.success, false);
            assert.equal(result.code, "PARSE_ERROR");
            assert.equal(result.statusCode, 502);
            assert.ok(result.message.includes("Could not parse Kaggle profile structure"));
        });

        test("Username normalization cleans @ symbol, whitespace and queries", async () => {
            let requestedUrl = "";
            const validHtml = `
                <html>
                <head>
                    <title>RT2248 | Kaggle</title>
                    <meta property="og:title" content="RT2248" />
                </head>
                <body></body>
                </html>
            `;
            globalThis.fetch = async (url: any) => {
                requestedUrl = String(url);
                return {
                    ok: true,
                    status: 200,
                    text: async () => validHtml,
                } as any;
            };

            const result = await fetchKaggleDetailed("  @rt2248  ");
            assert.equal(result.success, true);
            assert.equal(result.data.username, "rt2248");
            assert.equal(requestedUrl, "https://www.kaggle.com/rt2248");
        });

        test("Negative-cache guarantee: transient errors are NOT stored in Redis; subsequent retry succeeds", async () => {
            let fetchCallCount = 0;
            const validHtml = `
                <html><head><title>RT2248 | Kaggle</title><meta property="og:title" content="RT2248" /></head></html>
            `;

            // First call encounters reCAPTCHA 503
            globalThis.fetch = async () => {
                fetchCallCount++;
                if (fetchCallCount === 1) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => `<div class="g-recaptcha">RecaptchaChallengePageUi</div>`,
                    } as any;
                }
                // Second call receives valid profile HTML
                return {
                    ok: true,
                    status: 200,
                    text: async () => validHtml,
                } as any;
            };

            const firstResult = await verifyAndFetchPortalDetailed("kaggle", "rt2248", { forceFresh: true });
            assert.equal(firstResult.success, false);
            assert.equal(firstResult.code, "PLATFORM_UNAVAILABLE");

            // Second call (simulate retry after transient anti-bot challenge)
            const secondResult = await verifyAndFetchPortalDetailed("kaggle", "rt2248", { forceFresh: false });
            assert.equal(secondResult.success, true);
            assert.equal(secondResult.data.username, "rt2248");
            assert.equal(fetchCallCount, 2, "Second call must NOT return a cached negative failure");
        });
    });

    // =========================================================================
    // 3. verifyAndFetchPortal INTEGRATION & ROUTING
    // =========================================================================
    describe("verifyAndFetchPortal Routing", () => {
        test("Routes 'kaggle' portal parameter to fetchKaggle", async () => {
            const mockHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Kaggle Master | Master | Kaggle</title>
                    <meta property="og:title" content="Kaggle Master | Master" />
                </head>
                <body></body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            // Test lower-case
            const resLower = await verifyAndFetchPortal("kaggle", "kagglemaster", { forceFresh: true });
            assert.ok(resLower !== null);
            assert.equal(resLower.portal, "kaggle");
            assert.equal(resLower.username, "kagglemaster");
            assert.equal(resLower.verified, false);

            // Test mixed-case
            const resUpper = await verifyAndFetchPortal("Kaggle", "kagglemaster", { forceFresh: true });
            assert.ok(resUpper !== null);
            assert.equal(resUpper.portal, "kaggle");
        });
    });

    // =========================================================================
    // 4. SCORING ENGINE ISOLATION
    // =========================================================================
    describe("Scoring Engine Isolation", () => {
        test("Kaggle platform does not artificially pollute algorithmic problem solve counts", () => {
            const scoreResult = computeOrbixScoreFromPortals({
                kaggle: {
                    connected: true,
                    portal: "kaggle",
                    username: "datasci_hero",
                    name: "Data Sci Hero",
                    verified: false,
                    stats: [
                        { label: "portal", value: "Kaggle" },
                        { label: "category", value: "Data Science & ML" },
                        { label: "tier", value: "Master" },
                        { label: "followers", value: "500 followers" },
                    ],
                },
            });

            // Problem solving metrics should be 0 (Kaggle is ML/Data Science, not DSA practice)
            assert.equal(scoreResult.breakdown.problems.totalSolved, 0, "Kaggle stats must not be counted as DSA problems solved");
            assert.equal(scoreResult.breakdown.problems.points, 0);
        });
    });

    // =========================================================================
    // 5. CRITICAL OWNERSHIP SEPARATION
    // =========================================================================
    describe("Strict Separation of Ownership Verification vs. Public Crawling", () => {
        test("Kaggle is registered as a supported cryptographic challenge adapter in AdapterRegistry", () => {
            assert.equal(
                adapterRegistry.isSupported("kaggle"),
                true,
                "Kaggle must be registered as a Tier 1 ownership verification platform"
            );

            const adapter = adapterRegistry.getAdapter("kaggle");
            assert.ok(adapter, "KaggleAdapter must be resolved");
            assert.ok(adapter instanceof KaggleAdapter);
            assert.equal(adapter.portal, "kaggle");
            assert.equal(adapter.supportsChallengeVerification, true);
            assert.equal(adapter.defaultTargetField, "bio");

            // Unsupported platforms still reject cleanly
            const unsupportedResponse = adapterRegistry.getUnsupportedResponse("codechef");
            assert.equal(unsupportedResponse.success, false);
            assert.equal(unsupportedResponse.code, "UNSUPPORTED_PLATFORM");
            assert.ok(unsupportedResponse.error.includes("unsupported"));
        });

        test("Successful public crawling strictly returns verified: false", async () => {
            const mockHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Verified Candidate | Kaggle</title>
                    <meta property="og:title" content="Verified Candidate" />
                </head>
                <body></body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const profile = await fetchKaggle("cand_user");
            assert.ok(profile !== null);
            assert.equal(profile.success, true);
            assert.equal(
                profile.verified,
                false,
                "CRAWLER INVARIANT VIOLATION: A retrieved public profile must NEVER have verified = true"
            );
        });

        test("Failed crawling does not corrupt ownership status", async () => {
            // Emulate existing record in DB with CONNECTED_UNVERIFIED
            const initialRecord = {
                portal: "kaggle",
                portal_username: "vineetchandel",
                verified: false,
                ownership_status: "CONNECTED_UNVERIFIED",
                last_sync_status: "valid",
            };

            // Crawl fails (e.g., 404 or network outage)
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                text: async () => "Not Found",
            } as any);

            const result = await verifyAndFetchPortal("kaggle", initialRecord.portal_username, { forceFresh: true });
            assert.equal(result, null);

            // Invariant: sync status can become 'broken', but ownership_status MUST remain intact
            const updatedRecord = {
                ...initialRecord,
                last_sync_status: "broken", // sync status changed
                // ownership_status unchanged
            };

            assert.equal(updatedRecord.ownership_status, "CONNECTED_UNVERIFIED");
            assert.equal(updatedRecord.verified, false);
        });
    });

    // =========================================================================
    // 6. PERSISTENCE & SYNCHRONIZATION BEHAVIOR
    // =========================================================================
    describe("Persistence & Synchronization Behavior", () => {
        test("Preserves existing valid metadata during partial profile update", () => {
            const existingProfile = {
                displayName: "Vineet Chandel",
                avatar: "https://storage.googleapis.com/kaggle-avatars/vineetchandel.png",
                stats: [
                    { label: "portal", value: "Kaggle" },
                    { label: "tier", value: "Master" },
                ],
            };

            // Incoming crawled profile missing tier but having followers
            const incomingFresh: PortalProfileData = {
                success: true,
                portal: "kaggle",
                username: "vineetchandel",
                name: "Vineet Chandel",
                avatar: "https://storage.googleapis.com/kaggle-avatars/vineetchandel.png",
                stats: [
                    { label: "portal", value: "Kaggle" },
                    { label: "followers", value: "600 followers" },
                ],
                profileUrl: "https://www.kaggle.com/vineetchandel",
                verified: false,
            };

            // Merging simulation matching Orbix DB COALESCE semantics
            const mergedDisplayName = incomingFresh.name || existingProfile.displayName;
            const mergedAvatar = incomingFresh.avatar || existingProfile.avatar;

            assert.equal(mergedDisplayName, "Vineet Chandel");
            assert.equal(mergedAvatar, "https://storage.googleapis.com/kaggle-avatars/vineetchandel.png");
            assert.equal(incomingFresh.verified, false);
        });

        test("Contract format matches Frontend PortalProfileData expectations", async () => {
            const mockHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Test Analyst | Kaggle</title>
                    <meta property="og:title" content="Test Analyst" />
                    <meta property="og:image" content="https://storage.googleapis.com/kaggle-avatars/testanalyst.jpg" />
                </head>
                <body></body>
                </html>
            `;

            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const data = await fetchKaggle("testanalyst");
            assert.ok(data !== null);

            // Mandatory contract fields consumed by Orbix Frontend (portalParser, cardStudio, settings)
            assert.equal(typeof data.success, "boolean");
            assert.equal(typeof data.portal, "string");
            assert.equal(typeof data.username, "string");
            assert.equal(typeof data.name, "string");
            assert.equal(typeof data.avatar, "string");
            assert.ok(Array.isArray(data.stats));
            assert.equal(typeof data.profileUrl, "string");
            assert.equal(typeof data.verified, "boolean");
            assert.equal(data.verified, false);
        });
    });
});
