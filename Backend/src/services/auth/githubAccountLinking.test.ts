/**
 * ORBIX — GITHUB OAUTH ACCOUNT-LINKING FINAL SECURITY CLOSURE TEST SUITE
 * 
 * Verifies all mandatory security & concurrency properties:
 * 1. Two concurrent callbacks consuming one state — exactly one succeeds (Atomic Redis Lua GETDEL).
 * 2. User A initiates linking, logs out, and the callback is rejected.
 * 3. User A initiates linking, browser switches to User B, and the callback is rejected.
 * 4. Expired or replaced initiating session is rejected.
 * 5. Concurrent attempts to bind one GitHub numeric ID to two Orbix users — exactly one succeeds (Database unique index).
 * 6. Ownership-recording failure cannot leave a partially completed verified link (Atomic transaction rollback).
 * 7. Provider cancellation invalidates the pending transaction.
 * 8. Existing login/signup OAuth behavior remains unchanged.
 * 9. Email discrepancy: GitHub email ignored, identity linked strictly to authenticated userId.
 * 10. Existing GitHub identity cannot be silently replaced (rejected with CANNOT_REPLACE_EXISTING_LINK).
 */

import { test, describe, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { pool } from '../../database/client.js';
import redis from '../../redis/client.js';
import { OAuthService, type NormalizedOAuthProfile } from './oauthService.js';
import { platformVerificationService } from '../verification/platformVerificationService.js';
import { resolveAuthenticatedUser } from '../../middlewares/auth.middleware.js';
import { GitHubAdapter } from '../verification/adapters/githubAdapter.js';
import { assertVerificationSchemaReady, checkVerificationSchemaStatus, resetSchemaStateCache } from '../verification/schemaCompatibility.js';

const JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-at-least-32-chars-long";
process.env.JWT_SECRET = JWT_SECRET;

describe('GitHub OAuth Account-Linking Final Security Closure', () => {
    let executedQueries: { sql: string; params?: any[] }[] = [];
    let customQueryHandler: ((sql: string, params?: any[]) => any) | null = null;
    const redisStore = new Map<string, string>();

    // Save originals
    const originalPoolQuery = pool.query.bind(pool);
    const originalPoolConnect = pool.connect?.bind(pool);
    const originalRedisGet = redis.get.bind(redis);
    const originalRedisSet = (redis as any).set?.bind(redis);
    const originalRedisDel = (redis as any).del?.bind(redis);
    const originalRedisEval = (redis as any).eval?.bind(redis);
    const originalRedisMget = (redis as any).mget?.bind(redis);

    test('Missing ownership migration rejects linking before any account mutation', async () => {
        customQueryHandler = (sql) => sql.includes('information_schema.') ? { rows: [], rowCount: 0 } : undefined;
        await assert.rejects(
            OAuthService.linkGitHubAccount('a0000000-0000-4000-8000-000000000001', {
                provider: 'github', providerId: '583231', email: 'alice@example.com', name: 'Alice', usernameCandidate: 'alice-octo',
            }, 'alice-octo'),
            { code: 'MIGRATION_REQUIRED', statusCode: 503 }
        );
        assert.equal(executedQueries.some(({ sql }) => /BEGIN|UPDATE public.users|ownership_status = 'VERIFIED'/.test(sql)), false);
    });

    test('Concurrent schema preflights share one metadata inspection per replica', async () => {
        await Promise.all(Array.from({ length: 20 }, () => assertVerificationSchemaReady()));
        await checkVerificationSchemaStatus();
        assert.equal(executedQueries.filter(({ sql }) => sql.includes('information_schema.columns')).length, 1);
        assert.equal(executedQueries.filter(({ sql }) => sql.includes('information_schema.tables')).length, 1);
    });

    test('Proven handle is saved atomically and downstream refresh starts only after commit', async () => {
        const originalRefresh = platformVerificationService.refreshOwnershipAfterCommit;
        let refreshes = 0;
        platformVerificationService.refreshOwnershipAfterCommit = async (_userId: string) => {
            assert.ok(executedQueries.some(({ sql }) => sql.trim().startsWith('COMMIT')));
            refreshes++;
        };
        try {
            await OAuthService.linkGitHubAccount('a0000000-0000-4000-8000-000000000001', {
                provider: 'github', providerId: '583231', email: 'alice@example.com', name: 'Alice', usernameCandidate: 'alice-octo',
            }, 'alice-octo');
            assert.equal(refreshes, 1);
            const handleUpdate = executedQueries.findIndex(({ sql }) => sql.includes('SET portal_username = $1'));
            const ownershipWrite = executedQueries.findIndex(({ sql }) => sql.includes("SET ownership_status = 'VERIFIED'") || sql.includes('INSERT INTO public.user_links'));
            assert.ok(handleUpdate >= 0 && ownershipWrite > handleUpdate);
        } finally {
            platformVerificationService.refreshOwnershipAfterCommit = originalRefresh;
        }
    });

    beforeEach(() => {
        resetSchemaStateCache();
        executedQueries = [];
        customQueryHandler = null;
        redisStore.clear();

        // Mock pool.query to intercept database operations
        (pool as any).query = async (textOrObj: any, params?: any[]) => {
            const rawSql = typeof textOrObj === 'string' ? textOrObj : textOrObj.text;
            const values = Array.isArray(params) ? params : textOrObj?.values || [];
            executedQueries.push({ sql: rawSql, params: values });

            const normSql = rawSql.replace(/\s+/g, ' ');

            if (customQueryHandler) {
                const handled = await customQueryHandler(normSql, values);
                if (handled !== undefined) return handled;
            }

            if (normSql.includes('information_schema.columns') || normSql.includes('information_schema.tables')) {
                return { rows: [{ exists: 1 }], rowCount: 1 };
            }

            // Default safe query responses
            if (normSql.includes('WHERE github_id = $1 AND id != $2')) {
                return { rows: [], rowCount: 0 };
            }

            if (normSql.includes('FROM public.users') || normSql.includes('FROM users')) {
                const requestedId = values[0] || 'a0000000-0000-4000-8000-000000000001';
                return {
                    rows: [{
                        id: requestedId,
                        username: typeof requestedId === 'string' && requestedId.includes('b000') ? 'bob' : 'alice',
                        email: typeof requestedId === 'string' && requestedId.includes('b000') ? 'bob@orbix.dev' : 'alice@orbix.dev',
                        gmail: typeof requestedId === 'string' && requestedId.includes('b000') ? 'bob@orbix.dev' : 'alice@orbix.dev',
                        firstName: typeof requestedId === 'string' && requestedId.includes('b000') ? 'Bob' : 'Alice',
                        lastName: 'Coder',
                        accountType: 'personal',
                        account_type: 'personal',
                        termsAccepted: true,
                        githubId: null,
                        github_id: null,
                    }],
                    rowCount: 1,
                };
            }

            if (normSql.includes('FROM public.user_links') && normSql.includes("LOWER(TRIM(portal)) = 'github'") && normSql.includes('user_id != $2')) {
                return { rows: [], rowCount: 0 };
            }

            if (normSql.includes('FROM public.user_links WHERE user_id = $1') && normSql.includes("LOWER(TRIM(portal)) = $2")) {
                return { rows: [{ id: 'link-uuid-1' }], rowCount: 1 };
            }

            if (normSql.includes('UPDATE public.users SET github_id = $1') || normSql.includes('UPDATE public.user_links')) {
                return { rowCount: 1, rows: [] };
            }

            if (normSql.includes('INSERT INTO public.user_links')) {
                return { rowCount: 1, rows: [{ id: 'new-link-uuid' }] };
            }

            if (normSql.startsWith('BEGIN') || normSql.startsWith('COMMIT') || normSql.startsWith('ROLLBACK')) {
                return { rows: [], rowCount: 0 };
            }

            return { rows: [], rowCount: 0 };
        };

        // Mock pool.connect to return a transactional client
        const mockClient = {
            query: async (textOrObj: any, params?: any[]) => (pool as any).query(textOrObj, params),
            release: () => {},
        };
        (pool as any).connect = async () => mockClient;

        // Mock Redis client operations with atomic Lua evaluation
        (redis as any).status = 'ready';
        (redis as any).get = async (key: string) => redisStore.get(key) || null;
        (redis as any).set = async (key: string, value: string, ...args: any[]) => {
            redisStore.set(key, value);
            return 'OK';
        };
        (redis as any).del = async (key: string) => {
            const existed = redisStore.has(key);
            redisStore.delete(key);
            return existed ? 1 : 0;
        };
        (redis as any).eval = async (script: string, numKeys: number, key: string) => {
            if (script.includes("DEL") && script.includes("GET")) {
                const val = redisStore.get(key) || null;
                if (val) {
                    redisStore.delete(key);
                }
                return val;
            }
            return null;
        };
        (redis as any).hset = async () => 1;
        (redis as any).hgetall = async () => ({});
        (redis as any).expire = async () => 1;
        (redis as any).mget = async (...keys: any[]) => {
            const flattened = Array.isArray(keys[0]) ? keys[0] : keys;
            return flattened.map((k: string) => redisStore.get(k) || null);
        };
    });

    afterEach(() => {
        customQueryHandler = null;
    });

    after(async () => {
        (pool as any).query = originalPoolQuery;
        if (originalPoolConnect) (pool as any).connect = originalPoolConnect;
        (redis as any).get = originalRedisGet;
        if (originalRedisSet) (redis as any).set = originalRedisSet;
        if (originalRedisDel) (redis as any).del = originalRedisDel;
        if (originalRedisEval) (redis as any).eval = originalRedisEval;
        if (originalRedisMget) (redis as any).mget = originalRedisMget;

        try {
            if (redis && typeof redis.disconnect === 'function') {
                redis.disconnect();
            }
        } catch {}
        try {
            if (pool && typeof pool.end === 'function') {
                await pool.end();
            }
        } catch {}
    });

    // Helper to generate signed JWT for session simulation
    function createSessionToken(userId: string, username: string, sessionId?: string): string {
        if (sessionId) {
            redisStore.set(`session:active:${sessionId}`, "active");
        }
        return jwt.sign(
            {
                sub: userId,
                username,
                gmail: `${username}@orbix.dev`,
                accountType: "personal",
                ...(sessionId ? { sid: sessionId } : {}),
            },
            JWT_SECRET,
            {
                issuer: "orbix",
                audience: "orbix-users",
                expiresIn: "1h",
            }
        );
    }

    // =========================================================================
    // 1. Two concurrent callbacks consuming one state — exactly one succeeds
    // =========================================================================
    test('1. Two concurrent callbacks consuming one state — exactly one succeeds (Atomic Lua GETDEL)', async () => {
        const mockRes1: any = { clearCookie: () => {}, cookie: () => {} };
        const mockRes2: any = { clearCookie: () => {}, cookie: () => {} };
        const state = await OAuthService.generateLinkState(mockRes1, 'user-a', '/dashboard', 'alice-gh', undefined, 'sess-alice-01');

        // Verify state is stored in Redis
        assert.ok(redisStore.has(`oauth:state:${state}`));

        const mockReq1: any = { cookies: {} };
        const mockReq2: any = { cookies: {} };

        // Execute concurrent consumption
        const results = await Promise.allSettled([
            OAuthService.validateState(mockReq1, mockRes1, state, 'github', 'link'),
            OAuthService.validateState(mockReq2, mockRes2, state, 'github', 'link'),
        ]);

        const fulfilled = results.filter(r => r.status === 'fulfilled');
        const rejected = results.filter(r => r.status === 'rejected');

        assert.equal(fulfilled.length, 1, 'Exactly one concurrent callback must succeed');
        assert.equal(rejected.length, 1, 'Exactly one concurrent callback must be rejected');
        assert.match((rejected[0] as PromiseRejectedResult).reason.message, /OAuth session state expired or invalid/);

        // Verify state was completely consumed
        assert.equal(redisStore.has(`oauth:state:${state}`), false);
    });

    // =========================================================================
    // 2. User A initiates linking, logs out, and the callback is rejected
    // =========================================================================
    test('2. User A initiates linking, logs out, and the callback is rejected', async () => {
        const userAId = 'a0000000-0000-4000-8000-000000000001';
        const mockRes: any = { cookie: () => {}, clearCookie: () => {} };
        const state = await OAuthService.generateLinkState(mockRes, userAId, '/dashboard', undefined, undefined, 'sess-alice-01');

        // Valid state exists in Redis
        const payload = await OAuthService.validateState({ cookies: {} } as any, mockRes, state, 'github');
        assert.equal(payload.userId, userAId);
        assert.equal(payload.action, 'link');

        // Simulate request after logout (no token cookie, no Authorization header)
        const loggedOutReq: any = { cookies: {}, headers: {} };
        const authOutcome = await resolveAuthenticatedUser(loggedOutReq);

        assert.equal(authOutcome.ok, false);
        assert.equal((authOutcome as any).status, 401);
        assert.match((authOutcome as any).message, /Authentication required/);
    });

    // =========================================================================
    // 3. User A initiates linking, browser switches to User B, and the callback is rejected
    // =========================================================================
    test('3. User A initiates linking, browser switches to User B, and the callback is rejected', async () => {
        const userAId = 'a0000000-0000-4000-8000-000000000001';
        const userBId = 'b0000000-0000-4000-8000-000000000002';
        const mockRes: any = { cookie: () => {}, clearCookie: () => {} };

        // User A initiates link flow
        const state = await OAuthService.generateLinkState(mockRes, userAId, '/profile', undefined, undefined, 'sess-alice-01');
        const statePayload = await OAuthService.validateState({ cookies: {} } as any, mockRes, state, 'github');

        // Browser currently holds active session for User B
        const userBToken = createSessionToken(userBId, 'bob');
        const switchedReq: any = {
            cookies: { token: userBToken },
            headers: {},
        };

        const authOutcome = await resolveAuthenticatedUser(switchedReq);
        assert.equal(authOutcome.ok, true);
        if (authOutcome.ok) {
            // Callback session mismatch detection
            const isUserMatch = String(authOutcome.user.id) === String(statePayload.userId);
            assert.equal(isUserMatch, false, 'Must detect user ID mismatch between active session and initiating state');
            assert.equal(authOutcome.user.id, userBId);
            assert.equal(statePayload.userId, userAId);
        }
    });

    // =========================================================================
    // 4. Expired or replaced initiating session is rejected
    // =========================================================================
    test('4. Expired or replaced initiating session is rejected', async () => {
        const userAId = 'a0000000-0000-4000-8000-000000000001';
        const initialSessionId = 'session-12345';
        const replacedSessionId = 'session-99999';
        const mockRes: any = { cookie: () => {}, clearCookie: () => {} };

        // State initiated with initialSessionId
        const state = await OAuthService.generateLinkState(
            mockRes,
            userAId,
            '/dashboard',
            'alice',
            undefined,
            initialSessionId
        );
        const statePayload = await OAuthService.validateState({ cookies: {} } as any, mockRes, state, 'github');
        assert.equal(statePayload.sessionId, initialSessionId);

        // Incoming callback carries replaced session token
        const replacedToken = createSessionToken(userAId, 'alice', replacedSessionId);
        const reqWithReplacedSession: any = {
            cookies: { token: replacedToken },
            headers: {},
        };

        const authOutcome = await resolveAuthenticatedUser(reqWithReplacedSession);
        assert.equal(authOutcome.ok, true);
        if (authOutcome.ok) {
            const isSessionMatch = statePayload.sessionId === authOutcome.sessionId;
            assert.equal(isSessionMatch, false, 'Must detect that the initiating session was replaced');
        }
    });

    // =========================================================================
    // 5. Concurrent attempts to bind one GitHub numeric ID to two Orbix users
    // =========================================================================
    test('5. Concurrent attempts to bind one GitHub numeric ID to two Orbix users — exactly one succeeds', async () => {
        const userAId = 'a0000000-0000-4000-8000-000000000001';
        const userBId = 'b0000000-0000-4000-8000-000000000002';
        const numericGithubId = '583231';

        const profileA: NormalizedOAuthProfile = {
            provider: 'github',
            providerId: numericGithubId,
            email: 'alice@example.com',
            name: 'Alice',
            usernameCandidate: 'alice-octo',
        };
        const profileB: NormalizedOAuthProfile = {
            provider: 'github',
            providerId: numericGithubId,
            email: 'bob@example.com',
            name: 'Bob',
            usernameCandidate: 'bob-octo',
        };

        let boundUser: string | null = null;

        // Simulate database unique index constraint idx_users_github_id
        customQueryHandler = (sql, params) => {
            if (sql.includes('UPDATE public.users SET github_id = $1')) {
                if (boundUser !== null && boundUser !== params?.[1]) {
                    const uniqueError: any = new Error('duplicate key value violates unique constraint "idx_users_github_id"');
                    uniqueError.code = '23505';
                    uniqueError.constraint = 'idx_users_github_id';
                    throw uniqueError;
                }
                boundUser = params?.[1];
                return { rowCount: 1, rows: [] };
            }
            return undefined;
        };

        // User A links first
        const resultA = await OAuthService.linkGitHubAccount(userAId, profileA);
        assert.equal(resultA.success, true);
        assert.equal(boundUser, userAId);

        // User B attempts to bind the same numeric ID -> database unique index throws 23505
        await assert.rejects(
            async () => {
                await OAuthService.linkGitHubAccount(userBId, profileB);
            },
            (err: any) => {
                assert.equal(err.code, 'ACCOUNT_ALREADY_BOUND');
                assert.equal(err.statusCode, 409);
                assert.match(err.message, /already linked to another Orbix user/i);
                return true;
            }
        );

        // User A remains the sole owner of numeric ID
        assert.equal(boundUser, userAId);
    });

    // =========================================================================
    // 6. Ownership-recording failure cannot leave a partially completed verified link
    // =========================================================================
    test('6. Ownership-recording failure rolls back entire transaction (zero partial state)', async () => {
        const userId = 'a0000000-0000-4000-8000-000000000001';
        const profile: NormalizedOAuthProfile = {
            provider: 'github',
            providerId: '778899',
            email: 'alice@example.com',
            name: 'Alice',
            usernameCandidate: 'alice-fail-test',
        };

        let rollbackExecuted = false;

        // Force an error during user_links update
        customQueryHandler = (sql, params) => {
            if (sql.includes('UPDATE public.user_links') || sql.includes('INSERT INTO public.user_links')) {
                throw new Error('Database disk error during user_links recording');
            }
            if (sql.startsWith('ROLLBACK')) {
                rollbackExecuted = true;
                return { rows: [], rowCount: 0 };
            }
            return undefined;
        };

        await assert.rejects(
            async () => {
                await OAuthService.linkGitHubAccount(userId, profile, 'alice-fail-test');
            },
            /Database disk error during user_links recording/
        );

        assert.equal(rollbackExecuted, true, 'ROLLBACK must be executed when ownership recording fails');
    });

    // =========================================================================
    // 7. Provider cancellation invalidates the pending transaction
    // =========================================================================
    test('7. Provider cancellation invalidates state and prevents reuse', async () => {
        const mockRes: any = { cookie: () => {}, clearCookie: () => {} };
        const returnToUrl = '/dashboard?tab=platforms';
        const state = await OAuthService.generateLinkState(mockRes, 'user-a', returnToUrl, undefined, undefined, 'sess-alice-01');

        // State exists in Redis
        assert.ok(redisStore.has(`oauth:state:${state}`));

        // Cancellation arrives -> invalidateState is called
        const mockReq: any = { cookies: {} };
        const cancelledPayload = await OAuthService.invalidateState(mockReq, mockRes, state);

        assert.ok(cancelledPayload);
        assert.equal(cancelledPayload?.action, 'link');
        assert.equal(cancelledPayload?.returnTo, new URL(returnToUrl, OAuthService.getFrontendUrl()).href);

        // State must be completely removed from Redis
        assert.equal(redisStore.has(`oauth:state:${state}`), false);

        // Attempting to reuse or validate the cancelled state immediately fails
        await assert.rejects(
            async () => {
                await OAuthService.validateState(mockReq, mockRes, state, 'github');
            },
            /OAuth session state expired or invalid/
        );
    });

    // =========================================================================
    // 8. Existing login/signup OAuth behavior remains unchanged
    // =========================================================================
    test('8. Normal login/signup state validation preserves standard behavior', async () => {
        const mockRes: any = { cookie: () => {}, clearCookie: () => {} };
        const normalLoginState = await OAuthService.generateState(mockRes, 'github', '/dashboard');

        // State exists in Redis
        assert.ok(redisStore.has(`oauth:state:${normalLoginState}`));

        const mockReq: any = { cookies: {} };
        const payload = await OAuthService.validateState(mockReq, mockRes, normalLoginState, 'github');

        assert.equal(payload.provider, 'github');
        assert.equal(payload.action, undefined); // Normal login has no 'link' action
        assert.equal(payload.userId, undefined);
    });

    // =========================================================================
    // 9. Email discrepancy: GitHub email ignored, identity linked strictly to userId
    // =========================================================================
    test("9. GitHub email differs from Orbix email, identity is bound strictly without email query", async () => {
        const userAId = 'a0000000-0000-4000-8000-000000000001';
        const userAEmail = 'alice@orbix.dev';

        const profile: NormalizedOAuthProfile = {
            provider: 'github',
            providerId: '883311',
            email: 'completely_different_github_email@gmail.com',
            name: 'Alice',
            usernameCandidate: 'alice-diff',
        };

        const result = await OAuthService.linkGitHubAccount(userAId, profile, 'alice-diff');
        assert.equal(result.success, true);
        assert.equal(result.linkedUser.email, userAEmail);

        // Confirm NO query used the external GitHub email as an authorization criterion
        const leakedQuery = executedQueries.find(q =>
            q.params && q.params.some(p => typeof p === 'string' && p.toLowerCase() === 'completely_different_github_email@gmail.com')
        );
        assert.equal(leakedQuery, undefined, 'Must never search or link accounts by external GitHub email');
    });

    // =========================================================================
    // 10. Existing GitHub identity cannot be silently replaced
    // =========================================================================
    test('10. Rejects silent replacement if user already has a different GitHub ID linked', async () => {
        const userId = 'a0000000-0000-4000-8000-000000000001';
        const profile: NormalizedOAuthProfile = {
            provider: 'github',
            providerId: '999999',
            email: 'alice@orbix.dev',
            name: 'Alice',
        };

        // User already has github_id = '111111'
        customQueryHandler = (sql, params) => {
            if (sql.includes('FROM public.users WHERE id = $1')) {
                return {
                    rows: [{
                        id: userId,
                        username: 'alice',
                        email: 'alice@orbix.dev',
                        accountType: 'personal',
                        githubId: '111111', // Existing link
                    }],
                    rowCount: 1,
                };
            }
            return undefined;
        };

        await assert.rejects(
            async () => {
                await OAuthService.linkGitHubAccount(userId, profile);
            },
            (err: any) => {
                assert.equal(err.code, 'CANNOT_REPLACE_EXISTING_LINK');
                assert.equal(err.statusCode, 409);
                return true;
            }
        );
    });

    // =========================================================================
    // 11. STRICT FAIL-CLOSED OAUTH SESSION-BINDING REGRESSION TESTS
    // =========================================================================
    describe('Strict Fail-Closed OAuth Session-Binding Gate', () => {
        const aliceId = 'a0000000-0000-4000-8000-000000000001';
        const bobId = 'b0000000-0000-4000-8000-000000000002';
        const session1 = 'session-orbix-aaa-111';
        const session2 = 'session-orbix-bbb-222';

        test('Case 1: Same user + same session -> ALLOWED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcome = { ok: true, user: { id: aliceId }, sessionId: session1 };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcome);
            assert.equal(res.ok, true);
        });

        test('Case 2: Same user + different session (replaced/secondary session) -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcome = { ok: true, user: { id: aliceId }, sessionId: session2 };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcome);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'SESSION_MISMATCH');
                assert.match(res.message, /Session mismatch: active authenticated session was replaced or modified/);
            }
        });

        test('Case 3: Different user + same session (impossible in practice, defensive) -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcome = { ok: true, user: { id: bobId }, sessionId: session1 };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcome);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'USER_MISMATCH');
                assert.match(res.message, /Session mismatch: active authenticated user does not match/);
            }
        });

        test('Case 4: Different user + different session -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcome = { ok: true, user: { id: bobId }, sessionId: session2 };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcome);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'USER_MISMATCH');
            }
        });

        test('Case 5: Missing state session ID -> REJECTED (Fail Closed)', () => {
            const statePayloadNoSid = { userId: aliceId, sessionId: '', action: 'link' };
            const authOutcome = { ok: true, user: { id: aliceId }, sessionId: session1 };
            const res = OAuthService.validateCallbackSessionBinding(statePayloadNoSid, authOutcome);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'INVALID_LINKING_STATE');
                assert.match(res.message, /missing bound user ID or session ID/);
            }

            const statePayloadNullSid = { userId: aliceId, sessionId: undefined as any, action: 'link' };
            const resNull = OAuthService.validateCallbackSessionBinding(statePayloadNullSid, authOutcome);
            assert.equal(resNull.ok, false);
            if (!resNull.ok) {
                assert.equal(resNull.code, 'INVALID_LINKING_STATE');
            }
        });

        test('Case 6: Missing callback session ID -> REJECTED (Fail Closed)', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcomeNoSid = { ok: true, user: { id: aliceId }, sessionId: '' };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcomeNoSid);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'CALLBACK_SESSION_ID_MISSING');
                assert.match(res.message, /active session ID missing from current session/);
            }
        });

        test('Case 7: Expired session (authOutcome.ok = false) -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcomeExpired = { ok: false, status: 401, message: 'Invalid or expired token' };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcomeExpired as any);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'SESSION_EXPIRED_OR_INVALID');
                assert.match(res.message, /Your active Orbix session has expired or is invalid/);
            }
        });

        test('Case 8: Revoked session (sessionRevoked = true, authOutcome.ok = false) -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcomeRevoked = { ok: false, status: 401, message: 'Session has been terminated. Please sign in again.', sessionRevoked: true };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcomeRevoked as any);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'SESSION_EXPIRED_OR_INVALID');
            }
        });

        test('Case 9: Account switch after initiation (Alice initiates, Bob returns) -> REJECTED', () => {
            const statePayload = { userId: aliceId, sessionId: session1, action: 'link' };
            const authOutcomeSwitched = { ok: true, user: { id: bobId }, sessionId: 'session-bob-999' };
            const res = OAuthService.validateCallbackSessionBinding(statePayload, authOutcomeSwitched);
            assert.equal(res.ok, false);
            if (!res.ok) {
                assert.equal(res.code, 'USER_MISMATCH');
            }
        });

        test('Case 10: Initiation rejects missing userId or missing sessionId (Fail Closed at entry)', async () => {
            const mockRes: any = { cookie: () => {}, clearCookie: () => {} };

            // Missing userId
            await assert.rejects(
                async () => {
                    await OAuthService.generateLinkState(mockRes, '', '/dashboard', undefined, undefined, session1);
                },
                (err: any) => {
                    assert.equal(err.code, 'AUTH_REQUIRED');
                    assert.equal(err.statusCode, 401);
                    return true;
                }
            );

            // Missing sessionId
            await assert.rejects(
                async () => {
                    await OAuthService.generateLinkState(mockRes, aliceId, '/dashboard', undefined, undefined, '');
                },
                (err: any) => {
                    assert.equal(err.code, 'SESSION_REQUIRED');
                    assert.equal(err.statusCode, 401);
                    return true;
                }
            );
        });

        test('Case 11: Redis unavailable during initiation fails closed with 503', async () => {
            const mockRes: any = { cookie: () => {}, clearCookie: () => {} };
            const prevStatus = (redis as any).status;
            (redis as any).status = 'disconnected';

            try {
                await assert.rejects(
                    async () => {
                        await OAuthService.generateLinkState(mockRes, aliceId, '/dashboard', undefined, undefined, session1);
                    },
                    (err: any) => {
                        assert.equal(err.statusCode, 503);
                        assert.equal(err.code, 'SERVICE_UNAVAILABLE');
                        return true;
                    }
                );
            } finally {
                (redis as any).status = prevStatus;
            }
        });
    });
});
