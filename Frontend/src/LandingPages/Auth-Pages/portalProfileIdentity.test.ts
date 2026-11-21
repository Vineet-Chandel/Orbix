import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { matchesPortalProfileIdentity } from "./portalProfileIdentity";
import { PortalProfileCard, type PortalProfileData } from "./PortalProfileCard";

const oldProfile: PortalProfileData = {
    success: true, portal: "github", username: "vineet", name: "Previous Account",
    avatar: "", stats: [{ label: "repos", value: "1 repos" }], profileUrl: "https://github.com/vineet", verified: false,
};

test("cached previews must match both the platform and the requested account", () => {
    assert.equal(matchesPortalProfileIdentity(oldProfile, "github", "vineet-chandel"), false);
    assert.equal(matchesPortalProfileIdentity(oldProfile, "leetcode", "vineet"), false);
    assert.equal(matchesPortalProfileIdentity({ ...oldProfile, success: false }, "github", "vineet"), false);
    assert.equal(matchesPortalProfileIdentity(oldProfile, "GitHub", " VINEET "), true);
    assert.equal(matchesPortalProfileIdentity(null, "github", "vineet"), false);
});

test("editing a disconnected account shows loading instead of the previous account and connect action", () => {
    const html = renderToStaticMarkup(createElement(PortalProfileCard, {
        portalId: "github", username: "vineet-chandel", isConnected: false,
        initialProfile: oldProfile, onConnect() {}, onDisconnect() {},
    }));
    assert.match(html, /Loading account/);
    assert.doesNotMatch(html, /Previous Account|Yes, connect|1 repos/);
});

test("reconnecting the same account can reuse its matching preview", () => {
    const html = renderToStaticMarkup(createElement(PortalProfileCard, {
        portalId: "github", username: "vineet", isConnected: false,
        initialProfile: oldProfile, onConnect() {}, onDisconnect() {},
    }));
    assert.match(html, /Previous Account/);
    assert.match(html, /Yes, connect/);
    assert.doesNotMatch(html, /Loading account/);
});
