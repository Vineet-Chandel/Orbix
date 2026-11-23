import test from "node:test";
import assert from "node:assert/strict";
import { resolveGitHubLinkReturnTo, assertGitHubLinkIdentity } from "./githubLinkFlow.js";

test("GitHub linking returns to the current frontend page across separate API and web hosts", () => {
    const frontend = "https://orbix.example";
    assert.equal(resolveGitHubLinkReturnTo("/onboarding?tab=dev", frontend), "https://orbix.example/onboarding?tab=dev");
    assert.equal(resolveGitHubLinkReturnTo("https://orbix.example/profile", frontend), "https://orbix.example/profile");
    assert.equal(resolveGitHubLinkReturnTo("https://other.example/steal", frontend), "https://orbix.example/onboarding");
    assert.equal(resolveGitHubLinkReturnTo("//other.example", frontend), "https://orbix.example/onboarding");
});

test("GitHub authorization must prove ownership of the selected handle", () => {
    assert.doesNotThrow(() => assertGitHubLinkIdentity("Vineet-Chandel", "vineet-chandel"));
    assert.throws(() => assertGitHubLinkIdentity("selected-account", "different-account"), { code: "IDENTITY_MISMATCH" });
    assert.throws(() => assertGitHubLinkIdentity("selected-account", undefined), { code: "IDENTITY_MISMATCH" });
});
