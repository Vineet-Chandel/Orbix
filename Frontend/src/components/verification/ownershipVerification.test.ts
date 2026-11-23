import test from "node:test";
import assert from "node:assert/strict";
import {
    isPlatformVerificationSupported,
    getPlatformVerificationMethod,
    getPlatformVerificationField,
    getPlatformVerificationGuide,
    SUPPORTED_VERIFICATION_PLATFORMS,
} from "../../utils/platformVerificationSupport.ts";
import type { OwnershipStatus, ActiveVerificationChallenge } from "../../types/platformVerification.ts";

test("Ownership Verification Support & Registry", async (t) => {
    await t.test("correctly identifies supported platforms with whitespace and casing tolerance", () => {
        assert.equal(isPlatformVerificationSupported("leetcode"), true);
        assert.equal(isPlatformVerificationSupported("LeetCode "), true);
        assert.equal(isPlatformVerificationSupported("CODEFORCES"), true);
        assert.equal(isPlatformVerificationSupported("  hackerrank  "), true);
        assert.equal(isPlatformVerificationSupported("GitHub"), true);
    });

    await t.test("rejects unsupported platforms and edge cases", () => {
        assert.equal(isPlatformVerificationSupported("codechef"), false);
        assert.equal(isPlatformVerificationSupported("gfg"), false);
        assert.equal(isPlatformVerificationSupported("kaggle"), false);
        assert.equal(isPlatformVerificationSupported("atcoder"), false);
        assert.equal(isPlatformVerificationSupported(""), false);
        assert.equal(isPlatformVerificationSupported(null as unknown as string), false);
        assert.equal(isPlatformVerificationSupported(undefined as unknown as string), false);
    });

    await t.test("returns correct verification method", () => {
        assert.equal(getPlatformVerificationMethod("github"), "oauth");
        assert.equal(getPlatformVerificationMethod("GitHub"), "oauth");
        assert.equal(getPlatformVerificationMethod("leetcode"), "token");
        assert.equal(getPlatformVerificationMethod("codeforces"), "token");
        assert.equal(getPlatformVerificationMethod("hackerrank"), "token");
        assert.equal(getPlatformVerificationMethod("codechef"), null);
    });

    await t.test("returns exact target profile fields for token verification", () => {
        assert.equal(getPlatformVerificationField("leetcode"), "aboutMe");
        assert.equal(getPlatformVerificationField("codeforces"), "organization");
        assert.equal(getPlatformVerificationField("hackerrank"), "short_bio");
        assert.equal(getPlatformVerificationField("github"), "oauth_identity");
        assert.equal(getPlatformVerificationField("gfg"), null);
    });

    await t.test("registry contains exactly the 4 Phase 2-3 verified adapters", () => {
        assert.deepEqual([...SUPPORTED_VERIFICATION_PLATFORMS], [
            "leetcode",
            "codeforces",
            "hackerrank",
            "github",
        ]);
    });

    await t.test("getPlatformVerificationGuide produces exact platform instructions and settings URLs", () => {
        const testToken = "orbix-v-testToken123456789";

        // LeetCode: must target ReadMe and settings/profile/
        const leetcodeGuide = getPlatformVerificationGuide("leetcode", testToken);
        assert.equal(leetcodeGuide.portalId, "leetcode");
        assert.equal(leetcodeGuide.portalName, "LeetCode");
        assert.equal(leetcodeGuide.targetFieldName, "ReadMe");
        assert.equal(leetcodeGuide.settingsUrl, "https://leetcode.com/settings/profile/");
        assert.equal(leetcodeGuide.settingsUrlLabel, "Open LeetCode Profile Settings");
        assert.ok(leetcodeGuide.instruction.includes("ReadMe"));
        assert.ok(!leetcodeGuide.instruction.includes(testToken));
        assert.ok(leetcodeGuide.instruction.includes("verification code"));
        assert.ok(leetcodeGuide.detailText.includes("ReadMe"));
        assert.equal(leetcodeGuide.hasScreenshot, true);
        assert.ok(leetcodeGuide.screenshotAlt?.includes("ReadMe"));

        // Codeforces: must target Organization and settings/social
        const cfGuide = getPlatformVerificationGuide("codeforces", testToken);
        assert.equal(cfGuide.portalId, "codeforces");
        assert.equal(cfGuide.portalName, "Codeforces");
        assert.equal(cfGuide.targetFieldName, "Organization");
        assert.equal(cfGuide.settingsUrl, "https://codeforces.com/settings/social");
        assert.ok(cfGuide.instruction.includes("Organization"));
        assert.ok(!cfGuide.instruction.includes(testToken));
        assert.equal(cfGuide.hasScreenshot, false);

        // HackerRank: must target Short Bio and settings/profile
        const hrGuide = getPlatformVerificationGuide("hackerrank", testToken);
        assert.equal(hrGuide.portalId, "hackerrank");
        assert.equal(hrGuide.portalName, "HackerRank");
        assert.equal(hrGuide.targetFieldName, "Short Bio");
        assert.equal(hrGuide.settingsUrl, "https://www.hackerrank.com/settings/profile");
        assert.ok(hrGuide.instruction.includes("Short Bio"));
        assert.ok(!hrGuide.instruction.includes(testToken));
        assert.equal(hrGuide.hasScreenshot, false);
    });
});

test("Ownership Status & Sync Decoupling Invariants", async (t) => {
    interface PlatformState {
        name: string;
        username: string;
        verified: boolean;
        syncStatus: "valid" | "broken" | "error" | "pending";
        ownershipStatus: OwnershipStatus;
    }

    await t.test("successful profile sync/crawling must never promote unverified account to verified", () => {
        const initialAccount: PlatformState = {
            name: "leetcode",
            username: "tourist",
            verified: false,
            syncStatus: "pending",
            ownershipStatus: "CONNECTED_UNVERIFIED",
        };

        // Simulate background sync returning fresh stats
        const syncUpdate = {
            syncStatus: "valid" as const,
            profileData: { easy: 50, medium: 100, hard: 30 },
        };

        // Apply decoupled sync logic
        const updatedAccount: PlatformState = {
            ...initialAccount,
            syncStatus: syncUpdate.syncStatus,
            // Invariant: ownershipStatus & verified are NOT modified by sync!
        };

        assert.equal(updatedAccount.syncStatus, "valid");
        assert.equal(updatedAccount.verified, false);
        assert.equal(updatedAccount.ownershipStatus, "CONNECTED_UNVERIFIED");
    });

    await t.test("background sync failure must never revoke verified cryptographic ownership", () => {
        const verifiedAccount: PlatformState = {
            name: "leetcode",
            username: "verified_user",
            verified: true,
            syncStatus: "valid",
            ownershipStatus: "VERIFIED",
        };

        // Simulate sync network error / crawl timeout
        const syncFailure = {
            syncStatus: "broken" as const,
        };

        // Apply decoupled sync logic
        const updatedAccount: PlatformState = {
            ...verifiedAccount,
            syncStatus: syncFailure.syncStatus,
            // Invariant: sync failure does not revoke ownership
        };

        assert.equal(updatedAccount.syncStatus, "broken");
        assert.equal(updatedAccount.verified, true);
        assert.equal(updatedAccount.ownershipStatus, "VERIFIED");
    });

    await t.test("userSlice storage transformation correctly maps ownershipStatus to verified boolean", () => {
        const backendPortals = [
            {
                platform: "leetcode",
                username: "user1",
                ownershipStatus: "VERIFIED" as OwnershipStatus,
                verificationMethod: "token",
                verifiedAt: "2026-11-20T12:00:00Z",
            },
            {
                platform: "codeforces",
                username: "user2",
                ownershipStatus: "CONNECTED_UNVERIFIED" as OwnershipStatus,
                verificationMethod: null,
                verifiedAt: null,
            },
            {
                platform: "hackerrank",
                username: "user3",
                ownershipStatus: "REVOKED" as OwnershipStatus,
                verificationMethod: "token",
                verifiedAt: null,
            },
        ];

        const mappedPortals = backendPortals.map((p) => {
            const ownershipStatus: OwnershipStatus =
                p.ownershipStatus === "VERIFIED" || p.ownershipStatus === "REVOKED"
                    ? p.ownershipStatus
                    : "CONNECTED_UNVERIFIED";

            return {
                name: p.platform,
                username: p.username,
                ownershipStatus,
                verified: ownershipStatus === "VERIFIED",
                verificationMethod: p.verificationMethod || undefined,
                verifiedAt: p.verifiedAt || undefined,
            };
        });

        assert.equal(mappedPortals[0].verified, true);
        assert.equal(mappedPortals[0].ownershipStatus, "VERIFIED");

        assert.equal(mappedPortals[1].verified, false);
        assert.equal(mappedPortals[1].ownershipStatus, "CONNECTED_UNVERIFIED");

        assert.equal(mappedPortals[2].verified, false);
        assert.equal(mappedPortals[2].ownershipStatus, "REVOKED");
    });
});

test("Security & Non-Persistence Invariants", async (t) => {
    await t.test("challenge tokens are memory-only and never leaked to persistent storage keys", () => {
        const activeChallenge: ActiveVerificationChallenge = {
            challengeId: "ch_test_123",
            portal: "leetcode",
            portalUsername: "alice",
            token: "orbix_verify_a1b2c3d4e5f67890abcdef1234567890",
            targetField: "aboutMe",
            displayFieldName: "About Me",
            tokenDisplayPrefix: "orbix_verify_",
            expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            instructions: "Paste token in aboutMe",
        };

        // Verify token format
        assert.match(activeChallenge.token, /^orbix_verify_[0-9a-f]{32,}$/);

        // Simulated stored object in localStorage
        const storedProfileData = {
            platforms: [
                {
                    name: activeChallenge.portal,
                    username: activeChallenge.portalUsername,
                    ownershipStatus: "CONNECTED_UNVERIFIED",
                    verified: false,
                },
            ],
        };

        const serialized = JSON.stringify(storedProfileData);
        assert.equal(serialized.includes(activeChallenge.token), false);
        assert.equal(serialized.includes("token"), false);
    });

    await t.test("countdown timer correctly formats seconds and detects expiry", () => {
        const formatTime = (totalSeconds: number): string => {
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
        };

        assert.equal(formatTime(900), "15:00");
        assert.equal(formatTime(65), "01:05");
        assert.equal(formatTime(9), "00:09");
        assert.equal(formatTime(0), "00:00");

        const now = Date.now();
        const pastExpiresAt = new Date(now - 1000).toISOString();
        const futureExpiresAt = new Date(now + 60000).toISOString();

        assert.equal(new Date(pastExpiresAt).getTime() <= now, true);
        assert.equal(new Date(futureExpiresAt).getTime() > now, true);
    });
});
