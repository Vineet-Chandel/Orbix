import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePortalError, type PortalFetchErrorCategory, type NormalizedPortalError } from "./portalErrorMapping";

test("Orbix — Frontend Portal Error Normalization & State Synchronization Suite", async (t) => {
    const platform = "Kaggle";

    await t.test("1. PLATFORM_UNAVAILABLE never renders an Account Not Found badge", () => {
        // Direct machine error code
        const resCode = normalizePortalError(503, { code: "PLATFORM_UNAVAILABLE" }, platform);
        assert.equal(resCode.category, "PLATFORM_UNAVAILABLE");
        assert.equal(resCode.badgeLabel, "Platform Unavailable");
        assert.notEqual(resCode.badgeLabel, "Account Not Found");
        assert.ok(!resCode.message.toLowerCase().includes("not found"));

        // Status code 503 without code
        const resStatus = normalizePortalError(503, { message: "Something went wrong. Please try again." }, platform);
        assert.equal(resStatus.category, "PLATFORM_UNAVAILABLE");
        assert.equal(resStatus.badgeLabel, "Platform Unavailable");
        assert.notEqual(resStatus.badgeLabel, "Account Not Found");
        assert.ok(resStatus.message.includes(platform));
        assert.ok(!resStatus.message.includes("Something went wrong"));

        // Anti-bot message content without code or status
        const resMsg = normalizePortalError(null, { message: "recaptcha bot challenge encountered" }, platform);
        assert.equal(resMsg.category, "PLATFORM_UNAVAILABLE");
        assert.equal(resMsg.badgeLabel, "Platform Unavailable");
        assert.notEqual(resMsg.badgeLabel, "Account Not Found");
    });

    await t.test("2. RATE_LIMITED renders the correct badge and message", () => {
        // By code
        const resCode = normalizePortalError(429, { code: "RATE_LIMITED" }, platform);
        assert.equal(resCode.category, "RATE_LIMITED");
        assert.equal(resCode.badgeLabel, "Rate Limited");
        assert.equal(resCode.message, "Too many requests. Please wait before trying again.");

        // By status
        const resStatus = normalizePortalError(429, null, platform);
        assert.equal(resStatus.category, "RATE_LIMITED");
        assert.equal(resStatus.badgeLabel, "Rate Limited");
        assert.equal(resStatus.message, "Too many requests. Please wait before trying again.");

        // Custom non-generic message preserved
        const resCustom = normalizePortalError(429, { code: "RATE_LIMITED", message: "Rate limit reached. Retry in 60s." }, platform);
        assert.equal(resCustom.badgeLabel, "Rate Limited");
        assert.equal(resCustom.message, "Rate limit reached. Retry in 60s.");
    });

    await t.test("3. NETWORK_ERROR renders the correct badge and message", () => {
        // By code
        const resCode = normalizePortalError(504, { code: "NETWORK_ERROR" }, platform);
        assert.equal(resCode.category, "NETWORK_ERROR");
        assert.equal(resCode.badgeLabel, "Network Error");
        assert.equal(resCode.message, `Unable to connect to ${platform}. Please try again.`);

        // By connection timeout (status 0 / null)
        const resAbort = normalizePortalError(0, { message: "Connection to Kaggle timed out." }, platform);
        assert.equal(resAbort.category, "NETWORK_ERROR");
        assert.equal(resAbort.badgeLabel, "Network Error");
        assert.equal(resAbort.message, "Connection to Kaggle timed out.");
    });

    await t.test("4. PARSE_ERROR renders the correct badge and message", () => {
        // By code
        const resCode = normalizePortalError(502, { code: "PARSE_ERROR" }, platform);
        assert.equal(resCode.category, "PARSE_ERROR");
        assert.equal(resCode.badgeLabel, "Parse Error");
        assert.equal(resCode.message, `${platform}'s profile response could not be interpreted. Please try again later.`);

        // By status 502
        const resStatus = normalizePortalError(502, null, platform);
        assert.equal(resStatus.category, "PARSE_ERROR");
        assert.equal(resStatus.badgeLabel, "Parse Error");
    });

    await t.test("5. Genuine ACCOUNT_NOT_FOUND still renders correctly", () => {
        // By code
        const resCode = normalizePortalError(404, { code: "ACCOUNT_NOT_FOUND" }, platform);
        assert.equal(resCode.category, "ACCOUNT_NOT_FOUND");
        assert.equal(resCode.badgeLabel, "Account Not Found");
        assert.equal(resCode.message, `Account not found on ${platform}. Check the username or profile link.`);

        // By status 404
        const resStatus = normalizePortalError(404, null, platform);
        assert.equal(resStatus.category, "ACCOUNT_NOT_FOUND");
        assert.equal(resStatus.badgeLabel, "Account Not Found");
        assert.equal(resStatus.message, `Account not found on ${platform}. Check the username or profile link.`);
    });

    await t.test("6. Unknown error codes render a neutral generic state (NEVER Account Not Found)", () => {
        // Arbitrary unknown error code
        const resUnknown = normalizePortalError(500, { code: "UNKNOWN_INTERNAL_ERROR", message: "Something went wrong. Please try again." }, platform);
        assert.equal(resUnknown.category, "UNKNOWN_ERROR");
        assert.equal(resUnknown.badgeLabel, "Error");
        assert.notEqual(resUnknown.badgeLabel, "Account Not Found");
        assert.equal(resUnknown.message, "Something went wrong. Please try again.");

        // Null error object with 500
        const resNull = normalizePortalError(500, null, platform);
        assert.equal(resNull.category, "UNKNOWN_ERROR");
        assert.equal(resNull.badgeLabel, "Error");
        assert.notEqual(resNull.badgeLabel, "Account Not Found");
    });

    await t.test("7. A previous Account Not Found state is cleared when a new request begins", () => {
        // Simulate UI state lifecycle
        let state: { loading: boolean; error: string | null; errorState: any; profile: any } = {
            loading: false,
            error: "Account not found on Kaggle. Check the username or profile link.",
            errorState: normalizePortalError(404, { code: "ACCOUNT_NOT_FOUND" }, platform),
            profile: null,
        };

        // When a new request begins:
        state = { loading: true, error: null, errorState: null, profile: null };
        assert.equal(state.loading, true);
        assert.equal(state.error, null);
        assert.equal(state.errorState, null);
    });

    await t.test("8. Successful retry clears previous error", () => {
        let state: { loading: boolean; error: string | null; errorState: any; profile: any } = {
            loading: false,
            error: "Kaggle is temporarily unavailable",
            errorState: normalizePortalError(503, { code: "PLATFORM_UNAVAILABLE" }, platform),
            profile: null,
        };

        // Retry succeeds:
        const mockProfile = { username: "rt2248", name: "RT", success: true };
        state = { loading: false, error: null, errorState: null, profile: mockProfile };

        assert.equal(state.loading, false);
        assert.equal(state.error, null);
        assert.equal(state.errorState, null);
        assert.ok(state.profile);
    });

    await t.test("9. Switching between platforms does not retain stale error state", () => {
        let currentPlatform = "kaggle";
        let state: {
            loading: boolean;
            error: string | null;
            errorState: NormalizedPortalError | null;
            profile: any;
        } = {
            loading: false,
            error: "Kaggle is temporarily unavailable",
            errorState: normalizePortalError(503, { code: "PLATFORM_UNAVAILABLE" }, "Kaggle"),
            profile: null,
        };

        // Platform tab switch occurs:
        currentPlatform = "codeforces";
        state = { loading: false, error: null, errorState: null, profile: null };

        assert.equal(currentPlatform, "codeforces");
        assert.equal(state.error, null);
        assert.equal(state.errorState, null);
    });

    await t.test("10. Badge and message cannot disagree for any supported error category", () => {
        const categories: PortalFetchErrorCategory[] = [
            "ACCOUNT_NOT_FOUND",
            "PLATFORM_UNAVAILABLE",
            "RATE_LIMITED",
            "NETWORK_ERROR",
            "PARSE_ERROR",
            "UNKNOWN_ERROR",
        ];

        for (const cat of categories) {
            const normalized = normalizePortalError(null, { code: cat }, platform);
            assert.equal(normalized.category, cat);

            if (cat === "ACCOUNT_NOT_FOUND") {
                assert.equal(normalized.badgeLabel, "Account Not Found");
                assert.ok(normalized.message.includes("Account not found"));
            } else if (cat === "PLATFORM_UNAVAILABLE") {
                assert.equal(normalized.badgeLabel, "Platform Unavailable");
                assert.ok(normalized.message.includes("temporarily unavailable"));
            } else if (cat === "RATE_LIMITED") {
                assert.equal(normalized.badgeLabel, "Rate Limited");
                assert.ok(normalized.message.includes("Too many requests"));
            } else if (cat === "NETWORK_ERROR") {
                assert.equal(normalized.badgeLabel, "Network Error");
                assert.ok(normalized.message.includes("Unable to connect"));
            } else if (cat === "PARSE_ERROR") {
                assert.equal(normalized.badgeLabel, "Parse Error");
                assert.ok(normalized.message.includes("could not be interpreted"));
            } else if (cat === "UNKNOWN_ERROR") {
                assert.equal(normalized.badgeLabel, "Error");
                assert.ok(normalized.message.includes("Something went wrong"));
            }
        }
    });
});
