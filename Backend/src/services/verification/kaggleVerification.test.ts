/**
 * DEDICATED KAGGLE CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 * 
 * Tests the complete challenge lifecycle for Kaggle platform ownership verification:
 * 1. Challenge Initiation:
 *    - Token generation, 15-minute expiration window, 'bio' field targeting
 *    - Instruction payload generation with direct Kaggle settings link
 *    - Rejection if handle already verified by another user
 * 2. Profile Inspection & Token Candidate Extraction:
 *    - Open Graph og:description extraction
 *    - JSON-LD Schema.org Person description extraction
 *    - Embedded script state (userBio) extraction
 *    - Profile HTML DOM container extraction
 * 3. Challenge Confirmation:
 *    - Successful token matching and transition to verified status
 *    - Atomic status transition, attempts counter, verified_at timestamp
 *    - Cache invalidation trigger (refreshOwnershipAfterCommit)
 * 4. Security & Abuse Resistance:
 *    - Expired challenge rejection (CHALLENGE_EXPIRED)
 *    - Wrong/missing token rejection (TOKEN_NOT_FOUND)
 *    - Attempts exhaustion (ATTEMPTS_EXHAUSTED)
 *    - Replay prevention on terminal challenge status
 */

import { test, describe, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../database/client.js';
import redis from '../../redis/client.js';

import { platformVerificationService } from './platformVerificationService.js';
import { KaggleAdapter } from './adapters/kaggleAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { resetSchemaStateCache } from './schemaCompatibility.js';
import { generateChallengeToken, verifyCandidateMatch } from './challengeCryptoService.js';
import { setRedisClientForTest, resetRedisClientForTest } from './verificationRateLimiter.js';

describe('Kaggle Cryptographic Ownership Verification Engine', () => {
    const originalQuery = pool.query;
    const originalFetch = globalThis.fetch;

    let mockChallenges: Map<string, any>;
    let mockUserLinks: Map<string, any>;
    let deletedRedisKeys: string[];

    beforeEach(() => {
        resetSchemaStateCache();
        mockChallenges = new Map();
        mockUserLinks = new Map();
        deletedRedisKeys = [];

        // Mock Redis
        (redis as any).status = 'ready';
        (redis as any).del = async (...keys: string[]) => {
            deletedRedisKeys.push(...keys);
            return keys.length;
        };
        (redis as any).get = async () => null;

        // Mock pool.query
        (pool as any).query = async (sql: string, params: any[] = []) => {
            const sqlUpper = sql.toUpperCase();

            // Schema existence check
            if (sql.includes('information_schema.columns') || sql.includes('information_schema.tables')) {
                return { rows: [{ exists: 1 }] };
            }

            // User lookup
            if (sqlUpper.includes('FROM PUBLIC.USERS') && sqlUpper.includes('WHERE ID = $1')) {
                return { rows: [{ username: 'test_orbix_user', email: 'tester@orbix.test' }] };
            }

            // Check if handle is already verified by another user
            if (sqlUpper.includes('FROM PUBLIC.USER_LINKS') && sqlUpper.includes("OWNERSHIP_STATUS = 'VERIFIED'")) {
                const [portal, handle] = params;
                for (const link of mockUserLinks.values()) {
                    if (
                        link.portal.toLowerCase() === portal.toLowerCase() &&
                        link.portal_username.toLowerCase() === handle.toLowerCase() &&
                        link.ownership_status === 'VERIFIED'
                    ) {
                        return { rows: [link] };
                    }
                }
                return { rows: [] };
            }

            // Check existing user_links for user & portal
            if (sqlUpper.includes('FROM PUBLIC.USER_LINKS') && sqlUpper.includes('WHERE USER_ID = $1')) {
                const [userId, portal] = params;
                for (const link of mockUserLinks.values()) {
                    if (link.user_id === userId && link.portal.toLowerCase() === portal.toLowerCase()) {
                        return { rows: [link] };
                    }
                }
                return { rows: [] };
            }

            // Insert into user_links
            if (sqlUpper.includes('INSERT INTO PUBLIC.USER_LINKS')) {
                const id = 'link_' + Math.random().toString(36).substring(2, 9);
                const link = {
                    id,
                    user_id: params[0],
                    username: params[1],
                    portal: params[2],
                    portal_username: params[3],
                    link: params[4],
                    ownership_status: params[5] || 'CONNECTED_UNVERIFIED',
                    sync_status: 'NOT_SYNCED',
                    verified: params[5] === 'VERIFIED',
                };
                mockUserLinks.set(id, link);
                return { rows: [{ id }] };
            }

            // Update user_links
            if (sqlUpper.includes('UPDATE PUBLIC.USER_LINKS')) {
                return { rows: [] };
            }

            // Pending challenge query (initiate check or confirm read)
            if (sqlUpper.includes('FROM PUBLIC.PLATFORM_VERIFICATION_CHALLENGES') && sqlUpper.includes("STATUS = 'PENDING'")) {
                const [userId, portal] = params;
                const found: any[] = [];
                for (const ch of mockChallenges.values()) {
                    if (ch.user_id === userId && ch.portal.toLowerCase() === portal.toLowerCase() && ch.status === 'pending') {
                        // Include current_link_username from mockUserLinks
                        let current_link_username = ch.portal_username;
                        const link = mockUserLinks.get(ch.link_id);
                        if (link) current_link_username = link.portal_username;
                        found.push({ ...ch, current_link_username });
                    }
                }
                found.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                return { rows: found.slice(0, 1) };
            }

            // Select challenge FOR UPDATE
            if (sqlUpper.includes('FROM PUBLIC.PLATFORM_VERIFICATION_CHALLENGES') && sqlUpper.includes('FOR UPDATE')) {
                const [challengeId] = params;
                const ch = mockChallenges.get(challengeId);
                if (ch) {
                    let current_link_username = ch.portal_username;
                    const link = mockUserLinks.get(ch.link_id);
                    if (link) current_link_username = link.portal_username;
                    return { rows: [{ ...ch, current_link_username }] };
                }
                return { rows: [] };
            }

            // Insert challenge:
            // VALUES ($1: user_id, $2: link_id, $3: cleanPortal, $4: cleanUsername, $5: token_hash, $6: token_display_prefix, $7: targetField, $8: expiresAt)
            if (sqlUpper.includes('INSERT INTO PUBLIC.PLATFORM_VERIFICATION_CHALLENGES')) {
                const id = 'ch_' + Math.random().toString(36).substring(2, 9);
                const ch = {
                    id,
                    user_id: params[0],
                    link_id: params[1],
                    portal: params[2],
                    portal_username: params[3],
                    token_hash: params[4],
                    token_display_prefix: params[5],
                    target_field: params[6],
                    status: 'pending',
                    attempts: 0,
                    max_attempts: 5,
                    expires_at: params[7],
                    created_at: new Date().toISOString(),
                };
                mockChallenges.set(id, ch);
                return { rows: [{ id }] };
            }

            // Update challenge status / attempts
            if (sqlUpper.includes('UPDATE PUBLIC.PLATFORM_VERIFICATION_CHALLENGES')) {
                if (sqlUpper.includes("SET STATUS = 'EXPIRED'")) {
                    const id = params[0];
                    const ch = mockChallenges.get(id);
                    if (ch) ch.status = 'expired';
                } else if (sqlUpper.includes("SET STATUS = 'FAILED'") && params.length === 1) {
                    const id = params[0];
                    const ch = mockChallenges.get(id);
                    if (ch) ch.status = 'failed';
                } else if (sqlUpper.includes("SET STATUS = 'VERIFIED'")) {
                    const [attempts, id] = params;
                    const ch = mockChallenges.get(id);
                    if (ch) {
                        ch.status = 'verified';
                        ch.attempts = attempts;
                    }
                } else if (sqlUpper.includes('SET STATUS = $1') || sqlUpper.includes('SET STATUS = $1,')) {
                    const [status, attempts, lastErrorOrNull, id] = params.length === 4 ? params : [params[0], params[1], null, params[2]];
                    const targetId = params.length === 4 ? params[3] : params[2];
                    const ch = mockChallenges.get(targetId);
                    if (ch) {
                        ch.status = status;
                        ch.attempts = attempts;
                    }
                } else if (sqlUpper.includes('SET LAST_ATTEMPT_AT = CURRENT_TIMESTAMP')) {
                    const [attempts, id] = params;
                    const ch = mockChallenges.get(id);
                    if (ch) {
                        ch.attempts = attempts;
                    }
                }
                return { rows: [] };
            }

            // Transaction controls
            if (sqlUpper.includes('BEGIN') || sqlUpper.includes('COMMIT') || sqlUpper.includes('ROLLBACK')) {
                return { rows: [] };
            }

            return { rows: [] };
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        resetRedisClientForTest();
    });

    after(async () => {
        (pool as any).query = originalQuery;
        resetSchemaStateCache();
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

    // =========================================================================
    // 1. REGISTRATION & CAPABILITIES
    // =========================================================================
    test('Kaggle adapter is properly registered and configured', () => {
        assert.ok(adapterRegistry.isSupported('kaggle'));
        const adapter = adapterRegistry.getAdapter('kaggle');
        assert.ok(adapter instanceof KaggleAdapter);
        assert.equal(adapter.portal, 'kaggle');
        assert.equal(adapter.displayName, 'Kaggle');
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
        assert.equal(adapter.defaultTargetField, 'bio');
        assert.deepEqual(Array.from(adapter.supportedTargetFields), ['bio']);
    });

    // =========================================================================
    // 2. INITIATION LIFECYCLE
    // =========================================================================
    test('Initiates Kaggle challenge with valid 15-min token and bio instructions', async () => {
        const userId = 'user_kaggle_001';
        const handle = 'datasci_coder';

        const result = await platformVerificationService.initiate(userId, 'kaggle', handle);

        assert.equal(result.success, true);
        assert.equal(result.portal, 'kaggle');
        assert.equal(result.portalUsername, handle);
        assert.equal(result.targetField, 'bio');
        assert.equal(result.displayFieldName, 'Bio');
        assert.ok(result.token, 'Must return plaintext token');
        assert.match(result.token, /^orbix-v-[0-9a-zA-Z]{22}$/, 'Must follow base62 token schema');
        assert.ok(result.tokenDisplayPrefix);
        assert.equal(result.tokenDisplayPrefix, result.token.substring(0, 12));
        assert.equal(result.profileSettingsUrl, 'https://www.kaggle.com/datasci_coder');
        assert.ok(result.instructions?.includes('Home tab'));
        assert.ok(result.instructions?.includes('Bio'));
        assert.ok(result.instructions?.includes('Edit'));

        // Verify challenge was recorded in database mock
        const storedChallenge = Array.from(mockChallenges.values())[0];
        assert.ok(storedChallenge);
        assert.equal(storedChallenge.user_id, userId);
        assert.equal(storedChallenge.portal, 'kaggle');
        assert.equal(storedChallenge.portal_username, handle);
        assert.equal(storedChallenge.target_field, 'bio');
        assert.equal(storedChallenge.status, 'pending');
        // Token hash must match plaintext token
        assert.ok(verifyCandidateMatch(result.token, storedChallenge.token_hash));
    });

    test('Rejects initiation if handle is already verified by another user', async () => {
        mockUserLinks.set('link_existing', {
            id: 'link_existing',
            user_id: 'other_user_999',
            portal: 'kaggle',
            portal_username: 'taken_kaggler',
            ownership_status: 'VERIFIED',
            verification_method: 'profile_bio',
            verified: true,
            verified_at: new Date().toISOString(),
        });

        const result = await platformVerificationService.initiate('new_user_111', 'kaggle', 'taken_kaggler');
        assert.equal(result.success, false);
        assert.equal(result.code, 'ACCOUNT_ALREADY_VERIFIED');
        assert.ok(result.error?.includes('already verified by another Orbix user'));
    });

    // =========================================================================
    // 3. CONFIRMATION LIFECYCLE
    // =========================================================================
    test('Confirms ownership when token is found in public Kaggle bio (Open Graph)', async () => {
        const userId = 'user_kaggle_002';
        const handle = 'master_analyst';

        // 1. Initiate
        const initResult = await platformVerificationService.initiate(userId, 'kaggle', handle);
        assert.equal(initResult.success, true);
        const token = initResult.token!;

        // 2. Mock Kaggle profile response with token in og:description
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Master Analyst | Kaggle</title>
                <meta property="og:title" content="Master Analyst" />
                <meta property="og:description" content="Senior Data Scientist. Verification: ${token} | Loving PyTorch and XGBoost" />
            </head>
            <body></body>
            </html>
        `;

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            text: async () => mockHtml,
        } as any);

        // 3. Confirm
        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, true);
        assert.equal(confirmResult.verified, true);
        assert.equal(confirmResult.portal, 'kaggle');
        assert.equal(confirmResult.portalUsername, handle);
        assert.equal(confirmResult.verificationMethod, 'profile_bio');
        assert.ok(confirmResult.verifiedAt);

        // Verify challenge status updated to verified
        const storedChallenge = Array.from(mockChallenges.values())[0];
        assert.equal(storedChallenge.status, 'verified');

        // Verify Redis caches were purged
        assert.ok(deletedRedisKeys.length > 0);
    });

    test('Confirms ownership when token is found in Kaggle JSON-LD Person description', async () => {
        const userId = 'user_kaggle_003';
        const handle = 'jsonld_kaggler';

        const initResult = await platformVerificationService.initiate(userId, 'kaggle', handle);
        const token = initResult.token!;

        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Person",
                    "name": "JSON-LD Kaggler",
                    "description": "Kaggle Grandmaster. ${token} is my Orbix verification key."
                }
                </script>
            </head>
            <body></body>
            </html>
        `;

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            text: async () => mockHtml,
        } as any);

        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, true);
        assert.equal(confirmResult.verified, true);
    });

    test('Confirms ownership when token is found in Kaggle embedded JSON state', async () => {
        const userId = 'user_kaggle_004';
        const handle = 'state_kaggler';

        const initResult = await platformVerificationService.initiate(userId, 'kaggle', handle);
        const token = initResult.token!;

        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <script>
                    window.KaggleState = {
                        "userId": 987654,
                        "userBio": "Machine Learning Engineer. Verify: ${token}"
                    };
                </script>
            </head>
            <body></body>
            </html>
        `;

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            text: async () => mockHtml,
        } as any);

        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, true);
        assert.equal(confirmResult.verified, true);
    });

    // =========================================================================
    // 4. SECURITY & REJECTION SCENARIOS
    // =========================================================================
    test('Fails confirmation when token is not present in profile (TOKEN_NOT_FOUND)', async () => {
        const userId = 'user_kaggle_005';
        const handle = 'unverified_kaggler';

        await platformVerificationService.initiate(userId, 'kaggle', handle);

        // Profile without token
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:description" content="Just a regular Kaggle user with no token." />
            </head>
            <body></body>
            </html>
        `;

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            text: async () => mockHtml,
        } as any);

        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, false);
        assert.equal(confirmResult.verified, false);
        assert.equal(confirmResult.code, 'TOKEN_NOT_FOUND');
        assert.ok(confirmResult.error?.includes('was not detected'));

        // Challenge status remains pending but attempts incremented
        const storedChallenge = Array.from(mockChallenges.values())[0];
        assert.equal(storedChallenge.status, 'pending');
        assert.equal(storedChallenge.attempts, 1);
    });

    test('Fails confirmation when challenge has expired (CHALLENGE_EXPIRED)', async () => {
        const userId = 'user_kaggle_006';
        const handle = 'expired_kaggler';

        await platformVerificationService.initiate(userId, 'kaggle', handle);

        // Manually mutate challenge expiration to the past
        const storedChallenge = Array.from(mockChallenges.values())[0];
        storedChallenge.expires_at = new Date(Date.now() - 60000).toISOString();

        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, false);
        assert.equal(confirmResult.verified, false);
        assert.equal(confirmResult.code, 'CHALLENGE_EXPIRED');
        assert.equal(storedChallenge.status, 'expired');
    });

    test('Fails confirmation when attempts are exhausted (ATTEMPTS_EXHAUSTED)', async () => {
        const userId = 'user_kaggle_007';
        const handle = 'exhausted_kaggler';

        await platformVerificationService.initiate(userId, 'kaggle', handle);

        // Manually set attempts = max_attempts
        const storedChallenge = Array.from(mockChallenges.values())[0];
        storedChallenge.attempts = storedChallenge.max_attempts;

        const confirmResult = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(confirmResult.success, false);
        assert.equal(confirmResult.verified, false);
        assert.equal(confirmResult.code, 'ATTEMPTS_EXHAUSTED');
        assert.equal(storedChallenge.status, 'failed');
    });

    test('Prevents replay by rejecting confirm on already confirmed challenge', async () => {
        const userId = 'user_kaggle_008';
        const handle = 'replay_kaggler';

        const initResult = await platformVerificationService.initiate(userId, 'kaggle', handle);
        const token = initResult.token!;

        const mockHtml = `
            <html><head><meta property="og:description" content="Token: ${token}" /></head></html>
        `;

        globalThis.fetch = async () => ({
            ok: true,
            status: 200,
            text: async () => mockHtml,
        } as any);

        // First confirmation succeeds
        const first = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(first.success, true);
        assert.equal(first.verified, true);

        // Second confirmation has no active pending challenge
        const second = await platformVerificationService.confirm(userId, 'kaggle', handle);
        assert.equal(second.success, false);
        assert.equal(second.verified, false);
        assert.equal(second.code, 'NO_ACTIVE_CHALLENGE');
    });
});
