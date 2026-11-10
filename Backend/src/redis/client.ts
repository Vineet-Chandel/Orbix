// Backend/src/redis/client.ts
import { Redis } from "ioredis";

/**
 * Creates an isolated Redis client instance.
 * Supports dedicated REDIS_CACHE_URL, REDIS_QUEUE_URL, REDIS_RATELIMIT_URL or standard REDIS_URL.
 */
export function createRedisClient(customUrl?: string, role: "cache" | "queue" | "ratelimit" = "cache"): Redis {
    const url =
        customUrl ||
        (role === "cache"
            ? process.env.REDIS_CACHE_URL
            : role === "queue"
            ? process.env.REDIS_QUEUE_URL
            : process.env.REDIS_RATELIMIT_URL) ||
        process.env.REDIS_URL;

    let client: Redis;

    if (url && (url.startsWith("redis://") || url.startsWith("rediss://"))) {
        client = new Redis(url, {
            maxRetriesPerRequest: role === "queue" ? null : 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });
    } else {
        client = new Redis({
            host: process.env.REDIS_HOST || "127.0.0.1",
            port: Number(process.env.REDIS_PORT) || 6379,
            username: process.env.REDIS_USERNAME || undefined,
            password: process.env.REDIS_PASSWORD || undefined,
            maxRetriesPerRequest: role === "queue" ? null : 3,
            enableReadyCheck: true,
            lazyConnect: false,
        });
    }

    client.on("connect", () => {
        console.log(`Redis connected [Role: ${role}]`);
    });

    client.on("error", (err: Error) => {
        console.warn(`Redis connection warning [Role: ${role}]:`, err.message);
    });

    return client;
}

// Default instance for application caching & single-flight operations
const defaultRedis = createRedisClient(undefined, "cache");

export default defaultRedis;
