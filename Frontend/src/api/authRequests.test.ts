import { test } from "node:test";
import assert from "node:assert/strict";
import { requestAuthJson, beginSignOut, SIGNED_OUT_KEY } from "./authRequests.ts";

const memory = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
} });

test("slow authentication requests time out without automatic retries", async () => {
    const original = globalThis.fetch; let calls = 0;
    globalThis.fetch = async (_url, options) => {
        calls++;
        return new Promise((_resolve, reject) => options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true }));
    };
    try {
        await assert.rejects(requestAuthJson("/api/auth/signin", {}, 5), /taking too long/);
        assert.equal(calls, 1);
    } finally { globalThis.fetch = original; }
});

test("timeout covers a body that stalls after headers arrive", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, options) => ({ json: () => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), { once: true });
    }) }) as Response;
    try { await assert.rejects(requestAuthJson("/api/auth/signin", {}, 5), /taking too long/); }
    finally { globalThis.fetch = original; }
});

test("leaving the login page cancels the pending request", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, options) => new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(new DOMException("Cancelled", "AbortError")), { once: true });
    });
    const controller = new AbortController();
    try {
        const result = requestAuthJson("/api/auth/signin", { signal: controller.signal });
        controller.abort();
        await assert.rejects(result, { name: "AbortError" });
    } finally { globalThis.fetch = original; }
});

test("signout is immediate locally, deduplicated, and finishes before a new login", async () => {
    const original = globalThis.fetch; const calls: string[] = [];
    let finish!: (response: Response) => void;
    memory.set("orbix_token", "session-token");
    globalThis.fetch = async (url, options) => {
        calls.push(String(url));
        if (String(url).endsWith("/logout")) {
            assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer session-token");
            return new Promise((resolve) => { finish = resolve; });
        }
        return new Response(JSON.stringify({ user: { id: "next-user" } }));
    };
    try {
        const signout = beginSignOut();
        assert.equal(memory.get(SIGNED_OUT_KEY), "1");
        assert.equal(beginSignOut(), signout);
        const signin = requestAuthJson("/api/auth/signin");
        assert.deepEqual(calls, ["/api/auth/logout"]);
        finish(new Response(JSON.stringify({ success: true })));
        await Promise.all([signout, signin]);
        assert.deepEqual(calls, ["/api/auth/logout", "/api/auth/signin"]);
    } finally { globalThis.fetch = original; memory.clear(); }
});

test("a proxy outage produces a useful error instead of a JSON parse failure", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = async () => new Response("Bad gateway", { status: 502 });
    try { await assert.rejects(requestAuthJson("/api/auth/signin"), /unavailable \(502\)/); }
    finally { globalThis.fetch = original; }
});
