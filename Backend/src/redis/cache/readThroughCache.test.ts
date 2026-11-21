import { test } from "node:test";
import assert from "node:assert/strict";
import { createReadThroughCache } from "./readThroughCache.js";

function fakeClient(value: string | null = null) {
    return { status: "ready", get: async (_key: string) => value, set: async (_key: string, _value: string, _mode: "EX", _ttl: number) => "OK" };
}

test("cache hit avoids a database query", async () => {
    const cached = createReadThroughCache(fakeClient("42"));
    let calls = 0;
    assert.equal(await cached("count:user-a", 10, async () => { calls++; return 7; }), 42);
    assert.equal(calls, 0);
});

test("cache outage and malformed cache entries fall back to live data", async () => {
    for (const status of ["ready", "reconnecting"]) {
        const client = fakeClient("not-json"); client.status = status;
        assert.deepEqual(await createReadThroughCache(client)("colleges", 300, async () => ["PSIT"]), ["PSIT"]);
    }
});

test("a stalled Redis read does not stall discovery", async () => {
    const client = fakeClient();
    client.get = () => new Promise(() => undefined);
    assert.equal(await createReadThroughCache(client, 5)("count", 10, async () => 3), 3);
});

test("concurrent requests for the same key share one database query", async () => {
    const cached = createReadThroughCache(fakeClient());
    let calls = 0;
    const load = async () => { calls++; await new Promise((resolve) => setTimeout(resolve, 5)); return 9; };
    assert.deepEqual(await Promise.all([cached("a", 10, load), cached("a", 10, load)]), [9, 9]);
    assert.equal(calls, 1);
});

test("different viewers do not share counts and failed loads can be retried", async () => {
    const cached = createReadThroughCache(fakeClient());
    assert.deepEqual(await Promise.all([cached("user-a", 10, async () => 1), cached("user-b", 10, async () => 2)]), [1, 2]);
    await assert.rejects(cached("retry", 10, async () => { throw new Error("DB offline"); }));
    assert.equal(await cached("retry", 10, async () => 5), 5);
});

test("cache writes never block the response", async () => {
    const client = fakeClient(); client.set = () => new Promise(() => undefined);
    assert.equal(await createReadThroughCache(client)("count", 10, async () => 6), 6);
});
