/**
 * ORBIX PLATFORM VERIFICATION - DISTRIBUTED RATE LIMITER
 * 
 * Enforces per-user rate limits on verification initiation and confirmation requests.
 * Uses a distributed Redis store executing an atomic Fixed Window Counter with Atomic Expiry.
 * 
 * Algorithm Specification:
 * - Algorithm: Distributed Fixed Window Counter with Atomic Expiry.
 * - Atomicity Guarantee: An atomic Lua script executes INCR and initial EXPIRE in a single
 *   isolated Redis transaction.
 * - Non-Extension Guarantee: Subsequent requests within an active window increment the counter
 *   without resetting or extending the window expiration time.
 * - Fail-Closed Security Policy: If Redis is unavailable, disconnected, or times out (>2000ms),
 *   the limiter strictly FAILS CLOSED for verification actions to prevent distributed bypass.
 * - Infrastructure Privacy: Errors return standardized codes ('SERVICE_UNAVAILABLE') without
 *   exposing connection strings, internal hosts, or error stacks to clients.
 */

import defaultRedis from "../../redis/client.js";

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetInSeconds: number;
    code?: 'RATE_LIMIT_EXCEEDED' | 'SERVICE_UNAVAILABLE';
    error?: string;
}

/** Timeout threshold in milliseconds for distributed Redis operations */
export const REDIS_RATE_LIMIT_TIMEOUT_MS = 2000;

/**
 * Lua script for atomic Fixed Window Rate Limiting.
 * KEYS[1]: Rate limit Redis key
 * ARGV[1]: Window duration in seconds
 * 
 * Returns: [current_count, remaining_ttl_in_seconds]
 */
export const FIXED_WINDOW_LUA_SCRIPT = `
local key = KEYS[1]
local window = tonumber(ARGV[1])

local current = redis.call('INCR', key)
if current == 1 then
    redis.call('EXPIRE', key, window)
end

local ttl = redis.call('TTL', key)
if ttl == -1 then
    redis.call('EXPIRE', key, window)
    ttl = window
end

return {current, ttl}
`;

// Test client override (null uses defaultRedis)
let testRedisClientOverride: any = null;

/**
 * Injects a mock or custom Redis client for testing.
 * @param client Custom client or null to restore default
 */
export function setRedisClientForTest(client: any): void {
    testRedisClientOverride = client;
}

/**
 * Restores default production Redis client.
 */
export function resetRedisClientForTest(): void {
    testRedisClientOverride = null;
}

/**
 * Checks whether an action by a user exceeds the distributed rate limit.
 * 
 * @param userId Authenticated user UUID
 * @param action 'initiate' | 'confirm'
 * @param maxRequests Maximum requests allowed in window
 * @param windowSeconds Window length in seconds
 * @returns {Promise<RateLimitResult>}
 */
export async function checkVerificationRateLimit(
    userId: string,
    action: 'initiate' | 'confirm',
    maxRequests: number = action === 'initiate' ? 10 : 20,
    windowSeconds: number = 15 * 60
): Promise<RateLimitResult> {
    const key = `ratelimit:verification:${action}:${userId}`;
    const redis = testRedisClientOverride !== null ? testRedisClientOverride : defaultRedis;

    // Fail closed if Redis is unavailable or not in ready state
    if (!redis || redis.status !== "ready") {
        console.warn(`[SECURITY] Distributed rate limiter unavailable (status: ${redis?.status || 'null'}). Failing closed for verification:${action}:${userId}.`);
        return {
            allowed: false,
            remaining: 0,
            resetInSeconds: windowSeconds,
            code: 'SERVICE_UNAVAILABLE',
            error: 'Verification service is temporarily unavailable. Please try again later.',
        };
    }

    try {
        const executeWithTimeout = async (): Promise<[number, number]> => {
            let timer: NodeJS.Timeout | undefined;

            const evalPromise = (async () => {
                const res = await (redis as any).eval(
                    FIXED_WINDOW_LUA_SCRIPT,
                    1,
                    key,
                    windowSeconds
                );
                return res as [number, number];
            })();

            const timeoutPromise = new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    reject(new Error(`Redis rate limit operation timed out after ${REDIS_RATE_LIMIT_TIMEOUT_MS}ms`));
                }, REDIS_RATE_LIMIT_TIMEOUT_MS);
            });

            try {
                return await Promise.race([evalPromise, timeoutPromise]);
            } finally {
                if (timer) clearTimeout(timer);
            }
        };

        const results = await executeWithTimeout();

        if (Array.isArray(results) && results.length >= 2) {
            const count = Number(results[0]) || 1;
            const ttl = Number(results[1]) >= 0 ? Number(results[1]) : windowSeconds;

            const allowed = count <= maxRequests;
            const remaining = Math.max(0, maxRequests - count);

            if (!allowed) {
                return {
                    allowed: false,
                    remaining: 0,
                    resetInSeconds: ttl,
                    code: 'RATE_LIMIT_EXCEEDED',
                    error: `Verification ${action} limit exceeded.`,
                };
            }

            return {
                allowed: true,
                remaining,
                resetInSeconds: ttl,
            };
        }

        // If results malformed, fail closed
        return {
            allowed: false,
            remaining: 0,
            resetInSeconds: windowSeconds,
            code: 'SERVICE_UNAVAILABLE',
            error: 'Verification service is temporarily unavailable. Please try again later.',
        };
    } catch (err: any) {
        // Log securely on server, fail closed to client with no infrastructure leakage
        console.error(`[SECURITY] Distributed rate limiter failure (${err?.message}). Failing closed for verification:${action}:${userId}.`);
        return {
            allowed: false,
            remaining: 0,
            resetInSeconds: windowSeconds,
            code: 'SERVICE_UNAVAILABLE',
            error: 'Verification service is temporarily unavailable. Please try again later.',
        };
    }
}
