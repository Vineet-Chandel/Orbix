import type { RequestHandler } from "express";

export function createCorsMiddleware(env: NodeJS.ProcessEnv = process.env): RequestHandler {
    const allowed = new Set<string>();
    for (const candidate of [
        env.FRONTEND_URL,
        env.SITE_URL,
        env.APP_BASE_URL,
        ...(env.CORS_ALLOWED_ORIGINS || "").split(","),
    ]) {
        if (!candidate?.trim()) continue;
        const url = new URL(candidate.trim());
        if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid CORS origin protocol");
        allowed.add(url.origin);
    }
    if (env.NODE_ENV === "production") {
        allowed.add("https://theorbix.world");
        allowed.add("https://www.theorbix.world");
    } else {
        allowed.add("http://localhost:5173");
        allowed.add("http://127.0.0.1:5173");
    }
    return (req, res, next) => {
        const origin = req.headers.origin;
        res.vary("Origin");
        if (origin) {
            const sameOrigin = origin === `${req.protocol}://${req.get("host")}`;
            if (!allowed.has(origin) && !sameOrigin) {
                res.status(403).json({ success: false, message: "Origin is not allowed." });
                return;
            }
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Credentials", "true");
        }
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] ||
            "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Orbix-Device-Id");
        res.setHeader("Access-Control-Expose-Headers", "Authorization");
        res.setHeader("Access-Control-Max-Age", "600");
        if (req.method === "OPTIONS") { res.sendStatus(204); return; }
        next();
    };
}
