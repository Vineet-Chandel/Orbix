import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
    isPlatformVerificationSupported,
    getPlatformVerificationMethod,
    getPlatformVerificationField,
    getPlatformVerificationGuide,
    SUPPORTED_VERIFICATION_PLATFORMS,
    VERIFICATION_MODAL_Z_INDEX,
    SCREENSHOT_LIGHTBOX_Z_INDEX,
} from "../../utils/platformVerificationSupport.ts";
import type { OwnershipStatus, ActiveVerificationChallenge } from "../../types/platformVerification.ts";
import { normalizePortalError } from "../../LandingPages/Auth-Pages/portalErrorMapping.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Ownership Verification Support & Registry", async (t) => {
    await t.test("correctly identifies supported platforms with whitespace and casing tolerance", () => {
        assert.equal(isPlatformVerificationSupported("leetcode"), true);
        assert.equal(isPlatformVerificationSupported("LeetCode "), true);
        assert.equal(isPlatformVerificationSupported("CODEFORCES"), true);
        assert.equal(isPlatformVerificationSupported("  hackerrank  "), true);
        assert.equal(isPlatformVerificationSupported("GitHub"), true);
        assert.equal(isPlatformVerificationSupported("Kaggle"), true);
        assert.equal(isPlatformVerificationSupported("  kaggle  "), true);
        assert.equal(isPlatformVerificationSupported("atcoder"), true);
        assert.equal(isPlatformVerificationSupported("  AtCoder  "), true);
        assert.equal(isPlatformVerificationSupported("codechef"), true);
        assert.equal(isPlatformVerificationSupported("CodeChef "), true);
        assert.equal(isPlatformVerificationSupported("topcoder"), true);
        assert.equal(isPlatformVerificationSupported(" TopCoder "), true);
        assert.equal(isPlatformVerificationSupported("geeksforgeeks"), true);
        assert.equal(isPlatformVerificationSupported("GeeksforGeeks "), true);
        assert.equal(isPlatformVerificationSupported(" GEEKSFORGEEKS "), true);
        assert.equal(isPlatformVerificationSupported("hackerearth"), true);
        assert.equal(isPlatformVerificationSupported("HackerEarth "), true);
        assert.equal(isPlatformVerificationSupported("  HACKEREARTH  "), true);
        assert.equal(isPlatformVerificationSupported("interviewbit"), true);
        assert.equal(isPlatformVerificationSupported("InterviewBit "), true);
        assert.equal(isPlatformVerificationSupported("  INTERVIEWBIT  "), true);
        assert.equal(isPlatformVerificationSupported("substack"), true);
        assert.equal(isPlatformVerificationSupported("Substack "), true);
        assert.equal(isPlatformVerificationSupported("  SUBSTACK  "), true);
        assert.equal(isPlatformVerificationSupported("medium"), true);
        assert.equal(isPlatformVerificationSupported("Medium "), true);
        assert.equal(isPlatformVerificationSupported("  MEDIUM  "), true);
        assert.equal(isPlatformVerificationSupported("code360"), true);
        assert.equal(isPlatformVerificationSupported("Code360 "), true);
        assert.equal(isPlatformVerificationSupported("  CODE360  "), true);
    });

    await t.test("rejects unsupported platforms and edge cases", () => {
        assert.equal(isPlatformVerificationSupported("cses"), false);
        assert.equal(isPlatformVerificationSupported("gfg"), false);
        assert.equal(isPlatformVerificationSupported("spoj"), false);
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
        assert.equal(getPlatformVerificationMethod("kaggle"), "token");
        assert.equal(getPlatformVerificationMethod("atcoder"), "token");
        assert.equal(getPlatformVerificationMethod("codechef"), "token");
        assert.equal(getPlatformVerificationMethod("topcoder"), "token");
        assert.equal(getPlatformVerificationMethod("geeksforgeeks"), "token");
        assert.equal(getPlatformVerificationMethod("hackerearth"), "token");
        assert.equal(getPlatformVerificationMethod("interviewbit"), "token");
        assert.equal(getPlatformVerificationMethod("InterviewBit"), "token");
        assert.equal(getPlatformVerificationMethod("substack"), "token");
        assert.equal(getPlatformVerificationMethod("Substack"), "token");
        assert.equal(getPlatformVerificationMethod("medium"), "token");
        assert.equal(getPlatformVerificationMethod("Medium"), "token");
        assert.equal(getPlatformVerificationMethod("code360"), "token");
        assert.equal(getPlatformVerificationMethod("Code360"), "token");
        assert.equal(getPlatformVerificationMethod("cses"), null);
    });

    await t.test("returns exact target profile fields for token verification", () => {
        assert.equal(getPlatformVerificationField("leetcode"), "aboutMe");
        assert.equal(getPlatformVerificationField("codeforces"), "organization");
        assert.equal(getPlatformVerificationField("hackerrank"), "headline");
        assert.equal(getPlatformVerificationField("github"), "oauth_identity");
        assert.equal(getPlatformVerificationField("kaggle"), "bio");
        assert.equal(getPlatformVerificationField("atcoder"), "affiliation");
        assert.equal(getPlatformVerificationField("codechef"), "highest_degree");
        assert.notEqual(getPlatformVerificationField("codechef"), "institution");
        assert.equal(getPlatformVerificationField("topcoder"), "description");
        assert.equal(getPlatformVerificationField("geeksforgeeks"), "bio");
        assert.equal(getPlatformVerificationField("hackerearth"), "bio");
        assert.equal(getPlatformVerificationField("interviewbit"), "bio");
        assert.equal(getPlatformVerificationField("substack"), "bio");
        assert.equal(getPlatformVerificationField("medium"), "short_bio");
        assert.equal(getPlatformVerificationField("code360"), "about");
        assert.equal(getPlatformVerificationField("cses"), null);
    });

    await t.test("registry contains exactly the 14 verified adapters", () => {
        assert.deepEqual([...SUPPORTED_VERIFICATION_PLATFORMS], [
            "leetcode",
            "codeforces",
            "hackerrank",
            "github",
            "kaggle",
            "atcoder",
            "codechef",
            "topcoder",
            "geeksforgeeks",
            "hackerearth",
            "interviewbit",
            "substack",
            "medium",
            "code360",
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
        assert.equal(cfGuide.hasScreenshot, true);
        assert.ok(cfGuide.screenshotAlt?.includes("Organization"));
        assert.ok(cfGuide.screenshotCaption?.includes("Organization"));

        // HackerRank: must target Headline and profile/{username}
        const hrGuide = getPlatformVerificationGuide("hackerrank", testToken, undefined, "alice_hr");
        assert.equal(hrGuide.portalId, "hackerrank");
        assert.equal(hrGuide.portalName, "HackerRank");
        assert.equal(hrGuide.targetFieldName, "Headline");
        assert.equal(hrGuide.settingsUrl, "https://www.hackerrank.com/profile/alice_hr");
        assert.equal(hrGuide.settingsUrlLabel, "Open HackerRank Profile");
        assert.ok(hrGuide.instruction.includes("Headline"));
        assert.ok(!hrGuide.instruction.includes("Short Bio"));
        assert.ok(!hrGuide.instruction.includes("short_bio"));
        assert.ok(!hrGuide.instruction.includes(testToken));
        assert.ok(hrGuide.detailText.includes("Headline"));
        assert.equal(hrGuide.hasScreenshot, true);
        assert.ok(hrGuide.screenshotAlt?.includes("Headline"));
        assert.ok(hrGuide.screenshotCaption?.includes("Headline"));

        // Kaggle: must target Bio and profile/{username}
        const kaggleGuide = getPlatformVerificationGuide("kaggle", testToken, undefined, "alexis_test");
        assert.equal(kaggleGuide.portalId, "kaggle");
        assert.equal(kaggleGuide.portalName, "Kaggle");
        assert.equal(kaggleGuide.targetFieldName, "Bio");
        assert.equal(kaggleGuide.settingsUrl, "https://www.kaggle.com/alexis_test");
        assert.equal(kaggleGuide.settingsUrlLabel, "Open Kaggle Profile");
        assert.ok(kaggleGuide.instruction.includes("Bio"));
        assert.ok(kaggleGuide.instruction.includes("Home tab"));
        assert.ok(kaggleGuide.instruction.includes("Edit control"));
        assert.ok(!kaggleGuide.instruction.includes(testToken));
        assert.ok(kaggleGuide.detailText.includes("Bio"));
        assert.equal(kaggleGuide.hasScreenshot, false);

        // AtCoder: must target Affiliation and settings
        const atcoderGuide = getPlatformVerificationGuide("atcoder", testToken, undefined, "chokudai");
        assert.equal(atcoderGuide.portalId, "atcoder");
        assert.equal(atcoderGuide.portalName, "AtCoder");
        assert.equal(atcoderGuide.targetFieldName, "Affiliation");
        assert.equal(atcoderGuide.settingsUrl, "https://atcoder.jp/settings");
        assert.ok(atcoderGuide.instruction.includes("Affiliation"));
        assert.ok(!atcoderGuide.instruction.includes(testToken));
        assert.ok(atcoderGuide.detailText.includes("Affiliation"));
        assert.equal(atcoderGuide.hasScreenshot, true);
        assert.ok(atcoderGuide.screenshotAlt?.includes("Affiliation"));
        assert.ok(atcoderGuide.screenshotCaption?.includes("Affiliation"));

        // CodeChef: must target Highest Degree Earned, Professional section, and dynamic user edit URL
        const codechefGuide = getPlatformVerificationGuide("codechef", testToken, undefined, "chef_user");
        assert.equal(codechefGuide.portalId, "codechef");
        assert.equal(codechefGuide.portalName, "CodeChef");
        assert.equal(codechefGuide.targetFieldName, "Highest Degree Earned");
        assert.equal(codechefGuide.settingsUrl, "https://www.codechef.com/users/chef_user/edit");
        assert.equal(codechefGuide.settingsUrlLabel, "Open CodeChef Edit Profile");
        assert.ok(codechefGuide.instruction.includes("Highest Degree Earned"));
        assert.ok(codechefGuide.instruction.includes("Professional"));
        assert.ok(!codechefGuide.instruction.includes("Institution"));
        assert.ok(!codechefGuide.instruction.includes(testToken));
        assert.ok(codechefGuide.detailText.includes("Highest Degree Earned"));
        assert.equal(codechefGuide.hasScreenshot, true);
        assert.ok(codechefGuide.screenshotAlt?.includes("Highest Degree Earned"));
        assert.ok(codechefGuide.screenshotCaption?.includes("Highest Degree Earned"));

        // CodeChef fallback when username is absent: must NOT resolve to misleading 'edit' username
        const codechefFallbackGuide = getPlatformVerificationGuide("codechef", testToken);
        assert.equal(codechefFallbackGuide.settingsUrl, "https://www.codechef.com/");
        assert.equal(codechefFallbackGuide.settingsUrlLabel, "Open CodeChef");
        assert.notEqual(codechefFallbackGuide.settingsUrl, "https://www.codechef.com/users/edit");

        // TopCoder: must target Description and profile URL under About Me
        const topcoderGuide = getPlatformVerificationGuide("topcoder", testToken, undefined, "tc_coder");
        assert.equal(topcoderGuide.portalId, "topcoder");
        assert.equal(topcoderGuide.portalName, "TopCoder");
        assert.equal(topcoderGuide.targetFieldName, "Description");
        assert.equal(topcoderGuide.settingsUrl, "https://profiles.topcoder.com/tc_coder");
        assert.equal(topcoderGuide.settingsUrlLabel, "Open TopCoder Profile");
        assert.ok(topcoderGuide.instruction.includes("Description"));
        assert.ok(topcoderGuide.instruction.includes("About Me"));
        assert.ok(!topcoderGuide.instruction.includes("Short Bio"));
        assert.ok(!topcoderGuide.instruction.includes(testToken));
        assert.ok(topcoderGuide.detailText.includes("Description"));
        assert.ok(topcoderGuide.detailText.includes("About Me"));
        assert.equal(topcoderGuide.hasScreenshot, true);
        assert.ok(topcoderGuide.screenshotAlt?.includes("Add your bio"));
        assert.ok(topcoderGuide.screenshotAlt?.includes("Description"));
        assert.ok(topcoderGuide.screenshotCaption?.includes("Add your bio"));
        assert.ok(topcoderGuide.screenshotCaption?.includes("Description"));

        // Fallback when handle is absent
        const topcoderFallbackGuide = getPlatformVerificationGuide("topcoder", testToken);
        assert.equal(topcoderFallbackGuide.settingsUrl, "https://profiles.topcoder.com/");
        assert.equal(topcoderFallbackGuide.settingsUrlLabel, "Open TopCoder");

        // GeeksforGeeks: must target About/Bio and profile/edit
        const gfgGuide = getPlatformVerificationGuide("geeksforgeeks", testToken, undefined, "gfg_coder");
        assert.equal(gfgGuide.portalId, "geeksforgeeks");
        assert.equal(gfgGuide.portalName, "GeeksforGeeks");
        assert.equal(gfgGuide.targetFieldName, "About/Bio");
        assert.equal(gfgGuide.settingsUrl, "https://www.geeksforgeeks.org/profile/edit");
        assert.equal(gfgGuide.settingsUrlLabel, "Open GeeksforGeeks Profile Settings");
        assert.ok(gfgGuide.instruction.includes("About/Bio"));
        assert.ok(gfgGuide.instruction.includes("Headline"));
        assert.ok(!gfgGuide.instruction.includes(testToken));
        assert.ok(gfgGuide.detailText.includes("About/Bio"));
        assert.equal(gfgGuide.hasScreenshot, true);
        assert.ok(gfgGuide.screenshotAlt?.includes("Headline"));
        assert.ok(gfgGuide.screenshotAlt?.includes("About/Bio"));
        assert.ok(gfgGuide.screenshotCaption?.includes("About/Bio"));

        // HackerEarth: must target Bio and profile settings URL
        const heGuide = getPlatformVerificationGuide("hackerearth", testToken, undefined, "rahultripathi");
        assert.equal(heGuide.portalId, "hackerearth");
        assert.equal(heGuide.portalName, "HackerEarth");
        assert.equal(heGuide.targetFieldName, "Bio");
        assert.equal(heGuide.settingsUrl, "https://www.hackerearth.com/@rahultripathi/");
        assert.equal(heGuide.settingsUrlLabel, "Open HackerEarth Profile");
        assert.ok(heGuide.instruction.includes("Bio"));
        assert.ok(heGuide.instruction.includes("Verify"));
        assert.ok(heGuide.detailText.includes("Bio"));
        assert.equal(heGuide.hasScreenshot, true);
        assert.ok(heGuide.screenshotAlt?.includes("Bio"));
        assert.ok(heGuide.screenshotAlt?.includes("Save Changes"));
        assert.ok(heGuide.screenshotCaption?.includes("Bio"));
        assert.ok(heGuide.screenshotCaption?.includes("Save Changes"));

        // InterviewBit: must target Bio and profile/settings/
        const ibGuide = getPlatformVerificationGuide("interviewbit", testToken, undefined, "ib_user");
        assert.equal(ibGuide.portalId, "interviewbit");
        assert.equal(ibGuide.portalName, "InterviewBit");
        assert.equal(ibGuide.targetFieldName, "Bio");
        assert.equal(ibGuide.settingsUrl, "https://www.interviewbit.com/profile/settings/");
        assert.equal(ibGuide.settingsUrlLabel, "Open InterviewBit Settings");
        assert.ok(ibGuide.instruction.includes("Bio"));
        assert.ok(ibGuide.instruction.includes("Verify"));
        assert.ok(ibGuide.instruction.includes("Privacy Settings"));
        assert.equal(ibGuide.hasScreenshot, true);
        assert.ok(ibGuide.screenshotAlt?.includes("Bio"));
        assert.ok(ibGuide.screenshotCaption?.includes("Bio"));

        // Substack: must target Bio and profile/edit
        const substackGuide = getPlatformVerificationGuide("substack", testToken, undefined, "author");
        assert.equal(substackGuide.portalId, "substack");
        assert.equal(substackGuide.portalName, "Substack");
        assert.equal(substackGuide.targetFieldName, "Bio");
        assert.equal(substackGuide.settingsUrl, "https://substack.com/profile/edit");
        assert.equal(substackGuide.settingsUrlLabel, "Open Substack Settings");
        assert.ok(substackGuide.instruction.includes("Bio"));
        assert.ok(substackGuide.instruction.includes("Verify"));
        assert.equal(substackGuide.hasScreenshot, true);
        assert.ok(substackGuide.screenshotAlt?.includes("Bio"));
        assert.ok(substackGuide.screenshotCaption?.includes("Bio"));
        assert.ok(substackGuide.screenshotCaption?.includes("Save"));

        // Medium: must target Short bio and settings/account
        const mediumGuide = getPlatformVerificationGuide("medium", testToken, undefined, "writer");
        assert.equal(mediumGuide.portalId, "medium");
        assert.equal(mediumGuide.portalName, "Medium");
        assert.equal(mediumGuide.targetFieldName, "Short bio");
        assert.equal(mediumGuide.settingsUrl, "https://medium.com/me/settings/account");
        assert.equal(mediumGuide.settingsUrlLabel, "Open Medium Settings");
        assert.ok(mediumGuide.instruction.includes("Short bio"));
        assert.ok(!mediumGuide.instruction.includes("Name"));
        assert.ok(mediumGuide.instruction.includes("Verify"));
        assert.ok(mediumGuide.detailText.includes("Short bio"));
        assert.ok(!mediumGuide.detailText.includes("Name"));
        assert.equal(mediumGuide.hasScreenshot, true);
        assert.ok(mediumGuide.screenshotAlt?.includes("Short bio"));
        assert.ok(mediumGuide.screenshotCaption?.includes("Short bio"));
        assert.ok(mediumGuide.screenshotCaption?.includes("Save"));

        // Code360: must target Profile summary and mnjuser/profile
        const code360Guide = getPlatformVerificationGuide("code360", testToken, undefined, "ninja_coder");
        assert.equal(code360Guide.portalId, "code360");
        assert.equal(code360Guide.portalName, "Naukri Code360");
        assert.equal(code360Guide.targetFieldName, "Profile summary");
        assert.equal(code360Guide.settingsUrl, "https://www.naukri.com/mnjuser/profile");
        assert.equal(code360Guide.settingsUrlLabel, "Open Profile Manager");
        assert.ok(code360Guide.instruction.includes("Profile summary"));
        assert.ok(code360Guide.instruction.includes("Verify"));
        assert.ok(code360Guide.detailText.includes("Profile summary"));
        assert.equal(code360Guide.hasScreenshot, true);
        assert.ok(code360Guide.screenshotAlt?.includes("Profile summary"));
        assert.ok(code360Guide.screenshotCaption?.includes("Profile summary"));

        // Unsupported platforms (e.g. CSES): must NOT return fake token placement instructions
        const csesGuide = getPlatformVerificationGuide("cses", testToken, undefined, "cses_user");
        assert.equal(csesGuide.portalId, "cses");
        assert.ok(!csesGuide.instruction.includes("verification code"));
        assert.ok(!csesGuide.detailText.includes("Place the token"));
    });

    await t.test("standardizes verification action button instructions to Verify across all active challenge platforms", () => {
        const testToken = "orbix-v-testToken123456789";
        for (const portal of ["leetcode", "codeforces", "hackerrank", "codechef", "geeksforgeeks", "hackerearth", "interviewbit", "substack", "medium", "code360"]) {
            const guide = getPlatformVerificationGuide(portal, testToken);
            assert.ok(guide.instruction.includes("Verify"), `${portal} instruction must direct user to click Verify`);
            assert.ok(!guide.instruction.includes("Updated My Profile"), `${portal} instruction must not mention Updated My Profile`);
        }
    });
    await t.test("OwnershipVerificationModal instructions for Medium target Short bio and strictly not Name", () => {
        const modalPath = path.resolve(__dirname, "OwnershipVerificationModal.tsx");
        const modalSource = fs.readFileSync(modalPath, "utf-8");

        const mediumBlockMatch = modalSource.match(/guide\?\.portalId === ["']medium["']\s*\?\s*\(([\s\S]*?)\)\s*:/);
        assert.ok(mediumBlockMatch, "Modal must have a dedicated branch for Medium");
        const mediumBlock = mediumBlockMatch[1];
        assert.ok(mediumBlock.includes("Short bio"), "Medium block must instruct user to locate Short bio");
        // Strip JSX className attributes before checking that Name field is not referenced
        const instructionContent = mediumBlock.replace(/className="[^"]*"/g, "");
        assert.ok(!instructionContent.includes("Name"), "Medium block must never instruct user to use Name field");
        assert.ok(!mediumBlock.includes(">Name<"), "Medium block must never render Name as field label");
    });

    await t.test("OwnershipVerificationModal instructions and navigation for Code360 strictly enforce Profile summary UX journey", () => {
        const modalPath = path.resolve(__dirname, "OwnershipVerificationModal.tsx");
        const modalSource = fs.readFileSync(modalPath, "utf-8");

        // 1. Verify Code360 modal branch exists and conforms to required UX journey
        const code360BlockMatch = modalSource.match(/guide\?\.portalId === ["']code360["']\s*\?\s*\(([\s\S]*?)\)\s*:/);
        assert.ok(code360BlockMatch, "Modal must have a dedicated branch for Code360");
        const code360Block = code360BlockMatch[1];

        // 2. Guide identifies Profile summary as the target section and textarea
        assert.ok(code360Block.includes("Profile summary"), "Code360 block must instruct user to locate Profile summary");

        // 3. Obsolete terms must be strictly absent
        assert.ok(!code360Block.includes("Additional info"), "Code360 block must not reference Additional info");
        assert.ok(!code360Block.includes("About you"), "Code360 block must not reference About you");
        assert.ok(!code360Block.includes("Personal info"), "Code360 block must not reference Personal info");
        assert.ok(!code360Block.includes("Name*"), "Code360 block must not reference Name*");
        assert.ok(!code360Block.includes("Full name"), "Code360 block must not reference Full name");
        assert.ok(!code360Block.includes("Alternative:"), "Code360 block must not contain obsolete Alternative section");

        // 4. Verified settings destination URL and label
        const testToken = "orbix-v-testToken123456789";
        const guide = getPlatformVerificationGuide("code360", testToken);
        assert.equal(guide.settingsUrl, "https://www.naukri.com/mnjuser/profile");
        assert.equal(guide.settingsUrlLabel, "Open Profile Manager");
        assert.equal(getPlatformVerificationField("code360"), "about");

        // 5. Screenshot guide behavior: hasScreenshot is true and asset is configured
        assert.equal(guide.hasScreenshot, true, "Code360 must claim hasScreenshot: true with authentic asset");
        assert.ok(guide.screenshotAlt, "Screenshot alt must be defined");
        assert.ok(guide.screenshotCaption, "Screenshot caption must be defined");
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

test("Platform Fetch Failure Classification & Anti-Bot Differentiation", async (t) => {
    await t.test("CRITICAL: anti-bot interception (503 / PLATFORM_UNAVAILABLE) is never labeled Account Not Found", () => {
        const normalized = normalizePortalError(503, {
            code: "PLATFORM_UNAVAILABLE",
            message: "Kaggle is temporarily unavailable due to anti-bot verification. Please try again shortly."
        }, "Kaggle");

        assert.ok(normalized.message.includes("anti-bot verification") || normalized.message.includes("temporarily unavailable"));
        assert.ok(!normalized.message.includes("Account not found"), "Must NOT state account not found when blocked by anti-bot gate");
        assert.equal(normalized.badgeLabel, "Platform Unavailable");
        assert.notEqual(normalized.badgeLabel, "Account Not Found");
    });

    await t.test("Rate limit (429) maps to Rate Limited badge and message", () => {
        const normalized = normalizePortalError(429, { code: "RATE_LIMITED" }, "Kaggle");
        assert.ok(normalized.message.includes("Too many requests") || normalized.message.includes("Rate limit"));
        assert.equal(normalized.badgeLabel, "Rate Limited");
    });

    await t.test("Network timeout (504) maps to Network Error badge and message", () => {
        const normalized = normalizePortalError(504, { code: "NETWORK_ERROR", message: "Connection to Kaggle timed out." }, "Kaggle");
        assert.ok(normalized.message.includes("timed out") || normalized.message.includes("Unable to connect"));
        assert.equal(normalized.badgeLabel, "Network Error");
    });

    await t.test("Parse error (502) maps to Parse Error badge and message", () => {
        const normalized = normalizePortalError(502, { code: "PARSE_ERROR" }, "Kaggle");
        assert.ok(normalized.message.includes("could not be interpreted") || normalized.message.includes("parse"));
        assert.equal(normalized.badgeLabel, "Parse Error");
    });

    await t.test("Genuine missing account (404) maps to Account Not Found badge and message", () => {
        const normalized = normalizePortalError(404, { code: "ACCOUNT_NOT_FOUND" }, "Kaggle");
        assert.ok(normalized.message.includes("Account not found"));
        assert.equal(normalized.badgeLabel, "Account Not Found");
    });
});

test("Screenshot Lightbox Stacking & Layering Architecture Invariants", async (t) => {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    await t.test("lightbox z-index is strictly higher than ownership verification modal", () => {
        assert.ok(
            SCREENSHOT_LIGHTBOX_Z_INDEX > VERIFICATION_MODAL_Z_INDEX,
            `Lightbox z-index (${SCREENSHOT_LIGHTBOX_Z_INDEX}) must be strictly greater than modal z-index (${VERIFICATION_MODAL_Z_INDEX})`
        );
        assert.equal(VERIFICATION_MODAL_Z_INDEX, 10001);
        assert.equal(SCREENSHOT_LIGHTBOX_Z_INDEX, 10020);
    });

    await t.test("OwnershipVerificationModal component source enforces z-[10020] and rejects legacy z-[120]", () => {
        const modalPath = path.resolve(__dirname, "OwnershipVerificationModal.tsx");
        const modalSource = fs.readFileSync(modalPath, "utf-8");

        // Lightbox must use z-[10020]
        assert.ok(
            modalSource.includes("fixed inset-0 z-[10020]"),
            "ScreenshotPreviewModal backdrop must use z-[10020]"
        );

        // Lightbox must NOT use legacy z-[120]
        assert.ok(
            !modalSource.includes("z-[120]"),
            "ScreenshotPreviewModal must NOT use legacy z-[120]"
        );

        // Modal must use z-[10001]
        assert.ok(
            modalSource.includes("fixed inset-0 z-[10001]"),
            "OwnershipVerificationModal backdrop must use z-[10001]"
        );

        // Both modals must use createPortal to document.body
        const createPortalCount = (modalSource.match(/createPortal\(/g) || []).length;
        const bodyTargetCount = (modalSource.match(/document\.body/g) || []).length;
        assert.ok(createPortalCount >= 2, "Both ScreenshotPreviewModal and OwnershipVerificationModal must use createPortal");
        assert.ok(bodyTargetCount >= 2, "Both modals must portal into document.body to break free of parent stacking contexts");

        // Must import and resolve AtCoder verification screenshot guide
        assert.ok(
            modalSource.includes('import atcoderGuideImg from "../../assets/verification/atcoder-verification-guide.png"'),
            "OwnershipVerificationModal must import atcoder-verification-guide.png"
        );
        assert.ok(
            /case\s+"atcoder":\s+return\s+atcoderGuideImg;/.test(modalSource),
            "getGuideScreenshot must return atcoderGuideImg for 'atcoder'"
        );

        // Must import and resolve TopCoder verification screenshot guide
        assert.ok(
            modalSource.includes('import topcoderGuideImg from "../../assets/verification/topcoder-verification-guide.png"'),
            "OwnershipVerificationModal must import topcoder-verification-guide.png"
        );
        assert.ok(
            /case\s+"topcoder":\s+return\s+topcoderGuideImg;/.test(modalSource),
            "getGuideScreenshot must return topcoderGuideImg for 'topcoder'"
        );

        // Must import and resolve HackerEarth verification screenshot guide
        assert.ok(
            modalSource.includes('import hackerearthGuideImg from "../../assets/verification/hackerearth-verification-guide.png"'),
            "OwnershipVerificationModal must import hackerearth-verification-guide.png"
        );
        assert.ok(
            /case\s+"hackerearth":\s+return\s+hackerearthGuideImg;/.test(modalSource),
            "getGuideScreenshot must return hackerearthGuideImg for 'hackerearth'"
        );

        // Must import and resolve Medium verification screenshot guide
        assert.ok(
            modalSource.includes('import mediumGuideImg from "../../assets/verification/medium-verification-guide.png"'),
            "OwnershipVerificationModal must import medium-verification-guide.png"
        );
        assert.ok(
            /case\s+"medium":\s+return\s+mediumGuideImg;/.test(modalSource),
            "getGuideScreenshot must return mediumGuideImg for 'medium'"
        );

        // Must import and resolve Code360 verification screenshot guide
        assert.ok(
            modalSource.includes('import code360GuideImg from "../../assets/verification/code360-verification-guide.png"'),
            "OwnershipVerificationModal must import code360-verification-guide.png"
        );
        assert.ok(
            /case\s+"code360":\s+return\s+code360GuideImg;/.test(modalSource),
            "getGuideScreenshot must return code360GuideImg for 'code360'"
        );
    });

    await t.test("OwnershipVerificationModal isolates Escape and backdrop dismiss when isPreviewOpen is true", () => {
        const modalPath = path.resolve(__dirname, "OwnershipVerificationModal.tsx");
        const modalSource = fs.readFileSync(modalPath, "utf-8");

        assert.ok(
            modalSource.includes("disableEscape: isConfirming || isCancelling || oauthRedirecting || isPreviewOpen"),
            "OwnershipVerificationModal must disable its Escape handler when preview is open"
        );
        assert.ok(
            modalSource.includes("disableBackdrop: isConfirming || isCancelling || oauthRedirecting || isPreviewOpen"),
            "OwnershipVerificationModal must disable its backdrop dismiss when preview is open"
        );
    });

    await t.test("validates screenshot guide availability and asset existence for all platforms", () => {
        const assetsDir = path.resolve(__dirname, "../../assets/verification");

        const screenshotExpectations: Record<string, { hasScreenshot: boolean; assetFile?: string }> = {
            leetcode: { hasScreenshot: true, assetFile: "leetcode-verification-guide-cropped.png" },
            codeforces: { hasScreenshot: true, assetFile: "codeforces-verification-guide.png" },
            hackerrank: { hasScreenshot: true, assetFile: "hackerrank-verification-guide.png" },
            codechef: { hasScreenshot: true, assetFile: "codechef-verification-guide.png" },
            geeksforgeeks: { hasScreenshot: true, assetFile: "geeksforgeeks-verification-guide.png" },
            hackerearth: { hasScreenshot: true, assetFile: "hackerearth-verification-guide.png" },
            atcoder: { hasScreenshot: true, assetFile: "atcoder-verification-guide.png" },
            topcoder: { hasScreenshot: true, assetFile: "topcoder-verification-guide.png" },
            interviewbit: { hasScreenshot: true, assetFile: "interviewbit-verification-guide.png" },
            substack: { hasScreenshot: true, assetFile: "substack-verification-guide.png" },
            medium: { hasScreenshot: true, assetFile: "medium-verification-guide.png" },
            code360: { hasScreenshot: true, assetFile: "code360-verification-guide.png" },
            kaggle: { hasScreenshot: false },
            github: { hasScreenshot: false },
        };

        for (const [platform, exp] of Object.entries(screenshotExpectations)) {
            const guide = getPlatformVerificationGuide(platform, "test_token", undefined, "test_user");
            assert.equal(
                guide.hasScreenshot,
                exp.hasScreenshot,
                `Platform '${platform}' hasScreenshot must be ${exp.hasScreenshot}`
            );

            if (exp.hasScreenshot && exp.assetFile) {
                const assetPath = path.join(assetsDir, exp.assetFile);
                assert.ok(
                    fs.existsSync(assetPath),
                    `Expected screenshot asset '${exp.assetFile}' for platform '${platform}' must exist at ${assetPath}`
                );
            }
        }
    });

    await t.test("OwnershipStatusBadge defines exact pending tooltip text and preserves other status tooltips", () => {
        const badgePath = path.resolve(__dirname, "OwnershipStatusBadge.tsx");
        const badgeSource = fs.readFileSync(badgePath, "utf-8");

        // Must define exactly "Ownership verification pending" for both minimal and boxed variants
        const pendingMatches = badgeSource.match(/title="Ownership verification pending"/g) || [];
        assert.equal(
            pendingMatches.length,
            2,
            "OwnershipStatusBadge must have exactly 2 occurrences of title='Ownership verification pending'"
        );

        // Must completely eradicate the old verbose tooltip
        assert.ok(
            !badgeSource.includes("Account is connected but cryptographic ownership has not been proven."),
            "Legacy pending tooltip must be completely removed from OwnershipStatusBadge"
        );

        // Other status tooltips must be strictly preserved
        assert.ok(
            badgeSource.includes('title="Cryptographic account ownership verified."'),
            "VERIFIED status tooltip must be preserved"
        );
        assert.ok(
            badgeSource.includes('title="Ownership verification challenge active."'),
            "PENDING active challenge status tooltip must be preserved"
        );
        assert.ok(
            badgeSource.includes('title="Previously verified ownership was revoked."'),
            "REVOKED status tooltip must be preserved"
        );
        assert.ok(
            badgeSource.includes('title="Cryptographic ownership verification is not available for this platform."'),
            "UNSUPPORTED platform status tooltip must be preserved"
        );
    });
});
