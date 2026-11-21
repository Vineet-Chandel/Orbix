import { AsyncLocalStorage } from "node:async_hooks";
import { performance } from "node:perf_hooks";
import type { RequestHandler } from "express";

const requestMetrics = new AsyncLocalStorage<{ queries: number; databaseMs: number }>();

export function recordDatabaseQuery(durationMs: number) {
    const metrics = requestMetrics.getStore();
    if (metrics) { metrics.queries++; metrics.databaseMs += durationMs; }
}

/** All API routes; logs contain route templates, never URLs, payloads or identities. */
export const apiPerformance: RequestHandler = (req, res, next) => {
    const started = performance.now();
    const family = req.path.split("/")[1] || "root";
    const namespace = new Set(["root", "auth", "profile", "users", "portals", "projects", "leaderboard", "events", "notifications", "institutions", "club", "clubs", "workspace", "team-workspaces", "relationships", "blocks", "settings", "account", "privacy", "verification", "college-verification", "help", "admin", "platform", "about", "blogs", "blog", "health"]).has(family) ? family : "other";
    const metrics = { queries: 0, databaseMs: 0 };
    requestMetrics.run(metrics, () => {
        res.once("finish", () => {
            const durationMs = Math.round(performance.now() - started);
            if (durationMs < 1000 && res.statusCode < 500 && process.env.API_PERFORMANCE_LOG_ALL !== "true") return;
            console.info(JSON.stringify({
                event: "api_request", method: req.method, namespace,
                route: typeof req.route?.path === "string" ? req.route.path : "unmatched",
                status: res.statusCode, durationMs,
                queries: metrics.queries, databaseMs: Math.round(metrics.databaseMs),
            }));
        });
        next();
    });
};
