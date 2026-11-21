import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { apiPerformance, recordDatabaseQuery } from "./apiPerformance.middleware.js";

test("timings isolate concurrent requests and never log sensitive URL data", async () => {
    const original = console.info;
    const originalSetting = process.env.API_PERFORMANCE_LOG_ALL;
    process.env.API_PERFORMANCE_LOG_ALL = "true";
    const logs: any[] = [];
    console.info = (line) => { logs.push(JSON.parse(line)); };
    try {
        await Promise.all([1, 2].map((count) => new Promise<void>((resolve) => {
            const req = { method: "GET", path: "/profile/private-person?token=secret", route: { path: "/:username" } };
            const res = Object.assign(new EventEmitter(), { statusCode: 200 });
            apiPerformance(req as any, res as any, () => {
                setImmediate(() => {
                    for (let i = 0; i < count; i++) recordDatabaseQuery(10);
                    res.emit("finish");
                    resolve();
                });
            });
        })));
        assert.deepEqual(logs.map((entry) => entry.queries).sort(), [1, 2]);
        assert.deepEqual(logs.map((entry) => entry.databaseMs).sort(), [10, 20]);
        assert.equal(logs[0].namespace, "profile");
        assert.equal(logs[0].route, "/:username");
        assert.equal(JSON.stringify(logs).includes("secret"), false);
        assert.equal(JSON.stringify(logs).includes("private-person"), false);
    } finally {
        console.info = original;
        if (originalSetting === undefined) delete process.env.API_PERFORMANCE_LOG_ALL;
        else process.env.API_PERFORMANCE_LOG_ALL = originalSetting;
    }
});
