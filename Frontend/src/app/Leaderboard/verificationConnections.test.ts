import test from "node:test";
import assert from "node:assert/strict";
import { getVerificationConnections } from "./verificationConnections.ts";

test("only explicit ownership proof removes a connected platform from the verification queue", () => {
    const connections = getVerificationConnections([
        { portal: "GitHub", portalUsername: "developer", verified: true, ownershipStatus: "CONNECTED_UNVERIFIED" },
        { portal: "leetcode", portal_username: "coder", ownership_status: "VERIFIED" },
        { portal: "codechef", username: "chef", verified: true },
        { portal: "codeforces", username: "contestant", ownershipStatus: "PENDING" },
        { portal: "missing-handle" },
    ]);
    assert.deepEqual(connections.filter((p) => !p.verified).map((p) => p.portal), ["github", "codechef", "codeforces"]);
    assert.equal(connections.find((p) => p.portal === "leetcode")?.verified, true);
});

test("empty and duplicate platform rows do not create extra verification actions", () => {
    assert.deepEqual(getVerificationConnections(), []);
    assert.deepEqual(getVerificationConnections([
        { portal: " github ", username: "old" },
        { portal: "github", portalUsername: " current ", ownershipStatus: "VERIFIED" },
    ]), [{ portal: "github", username: "current", verified: true }]);
});
