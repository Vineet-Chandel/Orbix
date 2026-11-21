import { test } from "node:test";
import assert from "node:assert/strict";
import { createRefreshingCache } from "./refreshingCache.js";
import { withCacheBudget } from "./withCacheBudget.js";

function client() {
    return { status: "ready", get: async (_key: string): Promise<string | null> => null,
        set: async (_key: string, _value: string, _mode: "EX", _ttl: number): Promise<unknown> => "OK" };
}

test("concurrent cold requests share a single provider fetch", async () => {
    const cache = createRefreshingCache<number>(client(), { freshMs: 1000, staleMs: 10000 });
    let calls = 0;
    const load = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return 42; };
    assert.deepEqual(await Promise.all(Array.from({ length: 30 }, () => cache("month", load))), Array(30).fill(42));
    assert.equal(calls, 1);
});

test("expired fresh feed returns stale content immediately and deduplicates refresh", async () => {
    let clock = 0, calls = 0;
    const cache = createRefreshingCache<number>(client(), { freshMs: 100, staleMs: 1000, now: () => clock });
    await cache("month", async () => 1);
    clock = 200;
    let finish!: (n: number) => void;
    const load = () => { calls++; return new Promise<number>((resolve) => { finish = resolve; }); };
    assert.equal(await cache("month", load), 1);
    assert.equal(await cache("month", load), 1);
    assert.equal(calls, 1);
    finish(2);
    await new Promise((r) => setImmediate(r));
    assert.equal(await cache("month", load), 2);
});

test("month boundaries never reuse another month's calendar", async () => {
    const cache = createRefreshingCache<string>(client(), { freshMs: 100, staleMs: 1000 });
    assert.equal(await cache("nov", async () => "November"), "November");
    assert.equal(await cache("dec", async () => "December"), "December");
});

test("a failed refresh preserves stale content but never serves it after the hard expiry", async () => {
    let clock = 0;
    const cache = createRefreshingCache<number>(client(), { freshMs: 100, staleMs: 1000, now: () => clock });
    await cache("month", async () => 1);
    const fail = async () => { throw new Error("provider offline"); };
    clock = 200;
    assert.equal(await cache("month", fail), 1);
    await new Promise((r) => setImmediate(r));
    clock = 2000;
    await assert.rejects(cache("month", fail), /provider offline/);
    assert.equal(await cache("month", async () => 3), 3);
});

test("public refresh cannot bypass its minimum refresh interval", async () => {
    let clock = 0, calls = 0;
    const cache = createRefreshingCache<number>(client(), { freshMs: 100, staleMs: 1000, minRefreshMs: 50, now: () => clock });
    const load = async () => ++calls;
    await cache("month", load);
    assert.equal(await cache("month", load, true), 1);
    clock = 60;
    assert.equal(await cache("month", load, true), 2);
});

test("Redis writes do not block and read failures/timeouts return a miss", async () => {
    const redis = client();
    redis.set = () => new Promise(() => undefined);
    assert.equal(await createRefreshingCache<number>(redis, { freshMs: 100, staleMs: 1000 })("a", async () => 3), 3);
    assert.equal(await withCacheBudget(() => new Promise(() => undefined), 5), undefined);
    assert.equal(await withCacheBudget(async () => { throw new Error("offline"); }), undefined);
});
