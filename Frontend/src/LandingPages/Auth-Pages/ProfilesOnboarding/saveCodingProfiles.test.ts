import test from "node:test";
import assert from "node:assert/strict";
import { persistCodingProfiles } from "./saveCodingProfiles";

test("saves the exact connected bucket with the existing authenticated session", async () => {
    const original = globalThis.fetch;
    const payload = { connectedProfiles: {}, deletedPortals: ["leetcode"], syncMode: "exact" };
    globalThis.fetch = async (url, options) => {
        assert.equal(url, "/api/portals/save");
        assert.equal(options?.credentials, "include");
        assert.equal(options?.method, "POST");
        assert.deepEqual(JSON.parse(String(options?.body)), payload);
        assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer session");
        return new Response(JSON.stringify({ success: true, dbPersisted: true }));
    };
    try { await persistCodingProfiles("/api/portals/save", payload, { Authorization: "Bearer session" }); }
    finally { globalThis.fetch = original; }
});

test("failed and unpersisted requests cannot mark coding profile changes as saved", async () => {
    const original = globalThis.fetch;
    try {
        globalThis.fetch = async () => new Response(JSON.stringify({ success: false, message: "Session expired" }), { status: 401 });
        await assert.rejects(persistCodingProfiles("/save", {}, {}), /Session expired/);
        globalThis.fetch = async () => new Response(JSON.stringify({ success: true, dbPersisted: false, message: "Successfully saved!" }));
        await assert.rejects(persistCodingProfiles("/save", {}, {}), /weren’t saved/);
        globalThis.fetch = async () => { throw new Error("Offline"); };
        await assert.rejects(persistCodingProfiles("/save", {}, {}), /Offline/);
    } finally { globalThis.fetch = original; }
});
