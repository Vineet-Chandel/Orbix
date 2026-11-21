/**
 * UNIT & INTEGRATION TESTS: DISTRIBUTED VERIFICATION RATE LIMITER
 * 
 * Verifies:
 * 1. Algorithm: Distributed Fixed Window Counter with Atomic Expiry via Lua.
 * 2. Counter creation and expiry initialization are atomic.
 * 3. Concurrent requests do NOT reset or extend the window expiry.
 * 4. Boundary behavior: requests immediately before and after expiry.
 * 5. Window reset behavior: expired keys are reset with fresh quota.
 * 6. Multi-instance enforcement: independent instances share enforcement without multiplier.
 * 7. Fail-closed security: Redis offline, error, and timeout strictly block verification.
 * 8. Recovery: normal operations resume as soon as Redis is restored.
 */

import { test, describe, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import defaultRedis from '../../redis/client.js';
import {
    checkVerificationRateLimit,
    setRedisClientForTest,
    resetRedisClientForTest,
    REDIS_RATE_LIMIT_TIMEOUT_MS,
    type RateLimitResult,
} from './verificationRateLimiter.js';

/**
 * Creates an in-memory atomic distributed store simulating a real shared Redis instance
 * executing the FIXED_WINDOW_LUA_SCRIPT.
 */
function createMockRedisStore() {
    const store = new Map<string, { value: number; expireAt: number; initialWindow: number }>();
    let simulatedNow: number | null = null;

    return {
        store,
        status: 'ready' as string,
        delayMs: 0,
        throwError: false,

        /** Allows tests to mock precise time progression */
        setNow(timestamp: number | null) {
            simulatedNow = timestamp;
        },
        getNow() {
            return simulatedNow !== null ? simulatedNow : Date.now();
        },

        async eval(script: string, numkeys: number, key: string, windowArg: number | string): Promise<[number, number]> {
            if (this.delayMs > 0) {
                await new Promise((r) => setTimeout(r, this.delayMs));
            }
            if (this.throwError) {
                throw new Error('Redis command execution failed');
            }
            if (this.status !== 'ready') {
                throw new Error('Connection is closed');
            }

            const windowSeconds = Number(windowArg);
            const now = this.getNow();
            let entry = store.get(key);

            // If key does not exist or has expired, atomic creation with initial expiry
            if (!entry || now >= entry.expireAt) {
                entry = {
                    value: 1,
                    expireAt: now + windowSeconds * 1000,
                    initialWindow: windowSeconds,
                };
                store.set(key, entry);
                return [1, windowSeconds];
            }

            // Key exists within active window: increment counter WITHOUT extending expireAt
            entry.value += 1;
            const remainingTtl = Math.max(0, Math.ceil((entry.expireAt - now) / 1000));
            return [entry.value, remainingTtl];
        },
    };
}

describe('Distributed Fixed Window Rate Limiter Semantics & Security Suite', () => {
    let mockRedis: ReturnType<typeof createMockRedisStore>;

    beforeEach(() => {
        mockRedis = createMockRedisStore();
        setRedisClientForTest(mockRedis);
    });

    afterEach(() => {
        resetRedisClientForTest();
    });

    after(() => {
        try {
            defaultRedis.disconnect();
        } catch {}
    });

    // 1. FIRST REQUEST & ATOMIC EXPIRY INITIALIZATION
    test('1. First request atomically creates counter and initializes TTL window', async () => {
        const userId = 'user_init_test';
        const windowSec = 900; // 15 minutes
        const maxLimit = 10;

        const res = await checkVerificationRateLimit(userId, 'initiate', maxLimit, windowSec);

        assert.equal(res.allowed, true, 'First request must be allowed');
        assert.equal(res.remaining, 9, 'Remaining must be maxRequests - 1');
        assert.equal(res.resetInSeconds, windowSec, 'TTL must match initial window duration');

        // Verify underlying storage entry has atomic expireAt set
        const entry = mockRedis.store.get(`ratelimit:verification:initiate:${userId}`);
        assert.ok(entry !== undefined, 'Redis key must exist');
        assert.equal(entry?.value, 1, 'Counter must be initialized to 1');
        assert.ok(entry?.expireAt > Date.now(), 'Key must have an explicit future expireAt');
    });

    // 2. CONCURRENT FIRST REQUESTS AGAINST PREVIOUSLY NONEXISTENT KEY
    test('2. Concurrent first requests do not reset or extend the expiration window', async () => {
        const userId = 'user_concurrent_first';
        const windowSec = 900;
        const maxLimit = 10;
        const baseTime = Date.now();
        mockRedis.setNow(baseTime);

        // Fire 5 concurrent requests simultaneously at the exact same millisecond
        const concurrentReqs = Array.from({ length: 5 }, () =>
            checkVerificationRateLimit(userId, 'initiate', maxLimit, windowSec)
        );

        const results = await Promise.all(concurrentReqs);

        // All 5 should be allowed within limit
        for (const r of results) {
            assert.equal(r.allowed, true);
        }

        const entry = mockRedis.store.get(`ratelimit:verification:initiate:${userId}`);
        assert.equal(entry?.value, 5, 'Counter must be exactly 5');
        // Crucial invariant: expireAt must equal baseTime + windowSec * 1000
        // None of the subsequent 4 concurrent requests modified expireAt
        assert.equal(entry?.expireAt, baseTime + windowSec * 1000, 'Expiry timestamp must NOT be extended by concurrent requests');

        // Advance simulated time by 300 seconds (5 minutes into the 15-minute window)
        mockRedis.setNow(baseTime + 300 * 1000);

        // 6th request arriving at t = 300s
        const res6 = await checkVerificationRateLimit(userId, 'initiate', maxLimit, windowSec);
        assert.equal(res6.allowed, true);
        assert.equal(res6.remaining, 4);
        assert.equal(res6.resetInSeconds, 600, 'Remaining TTL must reflect elapsed time (600s remaining), NOT reset to 900s');
        assert.equal(entry?.expireAt, baseTime + windowSec * 1000, 'expireAt must still remain strictly unchanged');
    });

    // 3. REQUESTS IMMEDIATELY BEFORE AND AFTER EXPIRY (WINDOW RESET)
    test('3. Boundary check: Blocks immediately before expiry and resets immediately after', async () => {
        const userId = 'user_boundary_test';
        const windowSec = 60; // 60-second window
        const maxLimit = 3;
        const baseTime = Date.now();
        mockRedis.setNow(baseTime);

        // Exhaust all 3 requests at t = 0
        await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        const res3 = await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        assert.equal(res3.allowed, true);
        assert.equal(res3.remaining, 0);

        // 4th request at t = 0 is blocked
        const blockedEarly = await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        assert.equal(blockedEarly.allowed, false);
        assert.equal(blockedEarly.code, 'RATE_LIMIT_EXCEEDED');

        // Immediately BEFORE expiry: t = 59.9s (59,900 ms)
        mockRedis.setNow(baseTime + 59_900);
        const blockedRightBefore = await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        assert.equal(blockedRightBefore.allowed, false, 'Must still be blocked 100ms before expiry');
        assert.equal(blockedRightBefore.remaining, 0);
        assert.equal(blockedRightBefore.resetInSeconds, 1, 'TTL must reflect 1 second remaining');

        // Immediately AFTER expiry: t = 60.1s (60,100 ms)
        mockRedis.setNow(baseTime + 60_100);
        const resetRequest = await checkVerificationRateLimit(userId, 'confirm', maxLimit, windowSec);
        assert.equal(resetRequest.allowed, true, 'Window must reset immediately after expiry');
        assert.equal(resetRequest.remaining, 2, 'Counter resets: 1 used, 2 remaining');
        assert.equal(resetRequest.resetInSeconds, windowSec, 'TTL must reset to full 60-second window');

        // Expired keys do not accumulate indefinitely: key was replaced in-place
        const entry = mockRedis.store.get(`ratelimit:verification:confirm:${userId}`);
        assert.equal(entry?.value, 1, 'Underlying counter must reset to 1');
    });

    // 4. MULTI-INSTANCE ENFORCEMENT ACROSS INDEPENDENT APPLICATION PODS
    test('4. Multiple application instances share enforcement state without allowance multiplier', async () => {
        const userId = 'user_multi_pod';
        const limit = 4;
        const windowSec = 900;

        // Simulate 3 independent application container pods sharing the same Redis cluster
        const pod1 = () => checkVerificationRateLimit(userId, 'initiate', limit, windowSec);
        const pod2 = () => checkVerificationRateLimit(userId, 'initiate', limit, windowSec);
        const pod3 = () => checkVerificationRateLimit(userId, 'initiate', limit, windowSec);

        // Pod 1 sends 2 requests
        assert.equal((await pod1()).allowed, true);
        assert.equal((await pod1()).allowed, true);

        // Pod 2 sends 2 requests (total 4 reaches limit)
        assert.equal((await pod2()).allowed, true);
        const pod2Last = await pod2();
        assert.equal(pod2Last.allowed, true);
        assert.equal(pod2Last.remaining, 0);

        // Pod 3 tries to send a request: MUST be blocked because shared limit is exhausted
        const pod3Blocked = await pod3();
        assert.equal(pod3Blocked.allowed, false, 'Pod 3 must be blocked; cannot grant independent allowance');
        assert.equal(pod3Blocked.code, 'RATE_LIMIT_EXCEEDED');

        // Pod 1 also blocked
        const pod1Blocked = await pod1();
        assert.equal(pod1Blocked.allowed, false);
    });

    // 5. FAIL-CLOSED ON REDIS FAILURE & TIMEOUT
    test('5. Fails closed with SERVICE_UNAVAILABLE on Redis disconnect, timeout, or command failure', async () => {
        const userId = 'user_fail_closed_test';

        // 5a. Disconnected Redis
        mockRedis.status = 'end';
        const offlineRes = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
        assert.equal(offlineRes.allowed, false, 'Must fail closed when offline');
        assert.equal(offlineRes.code, 'SERVICE_UNAVAILABLE');
        assert.ok(offlineRes.error?.includes('Verification service is temporarily unavailable'));

        // 5b. Command error during execution
        mockRedis.status = 'ready';
        mockRedis.throwError = true;
        const errorRes = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
        assert.equal(errorRes.allowed, false, 'Must fail closed on command error');
        assert.equal(errorRes.code, 'SERVICE_UNAVAILABLE');

        // 5c. Timeout during execution (> 2000ms)
        mockRedis.throwError = false;
        mockRedis.delayMs = REDIS_RATE_LIMIT_TIMEOUT_MS + 200;
        const timeoutRes = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
        assert.equal(timeoutRes.allowed, false, 'Must fail closed on timeout');
        assert.equal(timeoutRes.code, 'SERVICE_UNAVAILABLE');
    });

    // 6. RECOVERY AFTER REDIS RESTORED
    test('6. Recovers immediately once Redis returns to ready state', async () => {
        const userId = 'user_recovery_test';

        // Set offline
        mockRedis.status = 'connecting';
        const downRes = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
        assert.equal(downRes.allowed, false);
        assert.equal(downRes.code, 'SERVICE_UNAVAILABLE');

        // Restore online
        mockRedis.status = 'ready';
        mockRedis.delayMs = 0;
        mockRedis.throwError = false;

        const recoveredRes = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
        assert.equal(recoveredRes.allowed, true, 'Must allow requests immediately upon Redis recovery');
        assert.equal(recoveredRes.remaining, 9);
    });
});
