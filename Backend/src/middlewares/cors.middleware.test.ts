import { test } from "node:test";
import assert from "node:assert/strict";
import { createCorsMiddleware } from "./cors.middleware.js";

function invoke(origin?: string, method = "GET", env: NodeJS.ProcessEnv = {}) {
    const headers = new Map<string, unknown>();
    let status = 200, called = false;
    const req = { headers: { origin }, method, protocol: "https", get: () => "api.orbix.test" };
    const res = {
        vary: (v: string) => headers.set("Vary", v),
        setHeader: (k: string, v: unknown) => headers.set(k, v),
        status: (code: number) => { status = code; return res; },
        json: () => undefined, sendStatus: (code: number) => { status = code; },
    };
    createCorsMiddleware({ NODE_ENV: "production", FRONTEND_URL: "https://orbix.test", ...env })(req as any, res as any, () => { called = true; });
    return { headers, status, called };
}

test("credentialed API access is limited to trusted origins", () => {
    const trusted = invoke("https://orbix.test");
    assert.equal(trusted.called, true);
    assert.equal(trusted.headers.get("Access-Control-Allow-Credentials"), "true");
    const hostile = invoke("https://orbix.test.attacker.example");
    assert.equal(hostile.status, 403);
    assert.equal(hostile.called, false);
    assert.equal(hostile.headers.has("Access-Control-Allow-Origin"), false);
    assert.equal(invoke("null").status, 403);
    assert.equal(invoke("http://localhost:5173").status, 403);
});

test("same origin and server clients continue through to normal authorization", () => {
    assert.equal(invoke("https://api.orbix.test").called, true);
    assert.equal(invoke().called, true);
    assert.equal(invoke("https://preview.orbix.test", "GET", { CORS_ALLOWED_ORIGINS: "https://preview.orbix.test" }).called, true);
});

test("trusted preflights are cacheable and vary by origin", () => {
    const result = invoke("https://orbix.test", "OPTIONS");
    assert.equal(result.status, 204);
    assert.equal(result.called, false);
    assert.equal(result.headers.get("Access-Control-Max-Age"), "600");
    assert.equal(result.headers.get("Vary"), "Origin");
});
