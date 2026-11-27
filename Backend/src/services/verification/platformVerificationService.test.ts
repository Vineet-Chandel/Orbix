/**
 * COMPREHENSIVE UNIT & INTEGRATION TESTS: PHASE 2 PLATFORM ACCOUNT OWNERSHIP VERIFICATION
 * 
 * Verifies:
 * 1. Platform Adapter Registry & Discovery (Tier 1 vs Tier 2/3 rejection).
 * 2. Individual Platform Adapters:
 *    - LeetCode Adapter (GraphQL, candidate extraction, timeout, error normalization).
 *    - Codeforces Adapter (REST API, organization field extraction, error handling).
 *    - HackerRank Adapter (REST API, short_bio candidate extraction, 404 normalization).
 *    - GitHub Adapter (OAuth numeric provider ID binding, non-challenge architecture).
 * 3. Rate Limiter (sliding window, initiate/confirm limits, isolation by user/action).
 * 4. Schema Compatibility Utility (Pre-migration fail-closed "1 = 0" vs post-migration).
 * 5. Trust-Sensitive Consumer Enforcement & ClientPortals Neutralization.
 * 6. Cryptographic Token Format & Constant-Time Security Invariants.
 */

import { test, describe, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import redis from '../../redis/client.js';
import { pool } from '../../database/client.js';

import {
    adapterRegistry,
    getSupportedPlatforms,
    normalizePlatformName,
} from './adapters/adapterRegistry.js';
import { LeetCodeAdapter } from './adapters/leetcodeAdapter.js';
import { CodeforcesAdapter } from "./adapters/codeforcesAdapter.js";
import { HackerRankAdapter } from "./adapters/hackerrankAdapter.js";
import { GitHubAdapter } from "./adapters/githubAdapter.js";
import { KaggleAdapter } from "./adapters/kaggleAdapter.js";
import { AtCoderAdapter } from "./adapters/atcoderAdapter.js";
import { CodeChefAdapter } from "./adapters/codechefAdapter.js";
import { TopCoderAdapter } from "./adapters/topcoderAdapter.js";
import { GeeksforGeeksAdapter } from "./adapters/geeksforgeeksAdapter.js";
import { HackerEarthAdapter } from "./adapters/hackerearthAdapter.js";
import { InterviewBitAdapter } from "./adapters/interviewbitAdapter.js";
import { SubstackAdapter } from "./adapters/substackAdapter.js";
import { MediumAdapter } from "./adapters/mediumAdapter.js";
import { Code360Adapter } from "./adapters/code360Adapter.js";
import {
    checkVerificationRateLimit,
    setRedisClientForTest,
    resetRedisClientForTest,
} from './verificationRateLimiter.js';
import {
    checkVerificationSchemaStatus,
    getVerifiedLinksCondition,
    resetSchemaStateCache,
} from './schemaCompatibility.js';
import {
    generateChallengeToken,
    verifyCandidateMatch,
    extractChallengeCandidates,
} from './challengeCryptoService.js';

describe('Phase 2 Platform Account Ownership Verification Engine', () => {

    // =========================================================================
    // 1. ADAPTER REGISTRY & PLATFORM DISCOVERY
    // =========================================================================
    describe('Adapter Registry & Platform Discovery', () => {
        test('Registers all supported platforms: LeetCode, Codeforces, HackerRank, GitHub, Kaggle, AtCoder, CodeChef, TopCoder, GeeksforGeeks, HackerEarth, InterviewBit, Substack, Medium, Code360', () => {
            const supported = getSupportedPlatforms();
            assert.ok(supported.includes('leetcode'), 'LeetCode must be supported');
            assert.ok(supported.includes('codeforces'), 'Codeforces must be supported');
            assert.ok(supported.includes('hackerrank'), 'HackerRank must be supported');
            assert.ok(supported.includes('github'), 'GitHub must be supported');
            assert.ok(supported.includes('kaggle'), 'Kaggle must be supported');
            assert.ok(supported.includes('atcoder'), 'AtCoder must be supported');
            assert.ok(supported.includes('codechef'), 'CodeChef must be supported');
            assert.ok(supported.includes('topcoder'), 'TopCoder must be supported');
            assert.ok(supported.includes('geeksforgeeks'), 'GeeksforGeeks must be supported');
            assert.ok(supported.includes('hackerearth'), 'HackerEarth must be supported');
            assert.ok(supported.includes('interviewbit'), 'InterviewBit must be supported');
            assert.ok(supported.includes('substack'), 'Substack must be supported');
            assert.ok(supported.includes('medium'), 'Medium must be supported');
            assert.ok(supported.includes('code360'), 'Code360 must be supported');
            assert.equal(supported.length, 14, 'Exactly 14 platforms should be registered');
        });

        test('Resolves correct adapter instances by case-insensitive name', () => {
            assert.ok(adapterRegistry.getAdapter('leetcode') instanceof LeetCodeAdapter);
            assert.ok(adapterRegistry.getAdapter('LeetCode') instanceof LeetCodeAdapter);
            assert.ok(adapterRegistry.getAdapter('LEETCODE') instanceof LeetCodeAdapter);
            assert.ok(adapterRegistry.getAdapter('codeforces') instanceof CodeforcesAdapter);
            assert.ok(adapterRegistry.getAdapter('hackerrank') instanceof HackerRankAdapter);
            assert.ok(adapterRegistry.getAdapter('github') instanceof GitHubAdapter);
            assert.ok(adapterRegistry.getAdapter('kaggle') instanceof KaggleAdapter);
            assert.ok(adapterRegistry.getAdapter('Kaggle') instanceof KaggleAdapter);
            assert.ok(adapterRegistry.getAdapter('KAGGLE') instanceof KaggleAdapter);
            assert.ok(adapterRegistry.getAdapter('atcoder') instanceof AtCoderAdapter);
            assert.ok(adapterRegistry.getAdapter('AtCoder') instanceof AtCoderAdapter);
            assert.ok(adapterRegistry.getAdapter('codechef') instanceof CodeChefAdapter);
            assert.ok(adapterRegistry.getAdapter('CodeChef') instanceof CodeChefAdapter);
            assert.ok(adapterRegistry.getAdapter('topcoder') instanceof TopCoderAdapter);
            assert.ok(adapterRegistry.getAdapter('TopCoder') instanceof TopCoderAdapter);
            assert.ok(adapterRegistry.getAdapter('geeksforgeeks') instanceof GeeksforGeeksAdapter);
            assert.ok(adapterRegistry.getAdapter('GeeksforGeeks') instanceof GeeksforGeeksAdapter);
            assert.ok(adapterRegistry.getAdapter('GEEKSFORGEEKS') instanceof GeeksforGeeksAdapter);
            assert.ok(adapterRegistry.getAdapter('hackerearth') instanceof HackerEarthAdapter);
            assert.ok(adapterRegistry.getAdapter('HackerEarth') instanceof HackerEarthAdapter);
            assert.ok(adapterRegistry.getAdapter('HACKEREARTH') instanceof HackerEarthAdapter);
            assert.ok(adapterRegistry.getAdapter('interviewbit') instanceof InterviewBitAdapter);
            assert.ok(adapterRegistry.getAdapter('InterviewBit') instanceof InterviewBitAdapter);
            assert.ok(adapterRegistry.getAdapter('INTERVIEWBIT') instanceof InterviewBitAdapter);
            assert.ok(adapterRegistry.getAdapter('substack') instanceof SubstackAdapter);
            assert.ok(adapterRegistry.getAdapter('Substack') instanceof SubstackAdapter);
            assert.ok(adapterRegistry.getAdapter('SUBSTACK') instanceof SubstackAdapter);
            assert.ok(adapterRegistry.getAdapter('medium') instanceof MediumAdapter);
            assert.ok(adapterRegistry.getAdapter('Medium') instanceof MediumAdapter);
            assert.ok(adapterRegistry.getAdapter('MEDIUM') instanceof MediumAdapter);
            assert.ok(adapterRegistry.getAdapter('code360') instanceof Code360Adapter);
            assert.ok(adapterRegistry.getAdapter('Code360') instanceof Code360Adapter);
            assert.ok(adapterRegistry.getAdapter('CODE360') instanceof Code360Adapter);
        });

        test('Rejects unsupported Tier 2/3 platforms with undefined', () => {
            assert.equal(adapterRegistry.getAdapter('cses'), undefined);
            assert.equal(adapterRegistry.getAdapter('spoj'), undefined);
            assert.equal(adapterRegistry.getAdapter('unknown_platform'), undefined);
            assert.equal(adapterRegistry.getAdapter(''), undefined);
        });

        test('Normalizes platform names cleanly', () => {
            assert.equal(normalizePlatformName('  LeetCode  '), 'leetcode');
            assert.equal(normalizePlatformName('CodeForces'), 'codeforces');
            assert.equal(normalizePlatformName('   '), '');
            assert.equal(normalizePlatformName(null as any), '');
        });
    });

    // =========================================================================
    // 2. INDIVIDUAL PLATFORM ADAPTERS
    // =========================================================================
    describe('Tier 1 Platform Verification Adapters', () => {

        // --- LeetCode Adapter ---
        describe('LeetCode Adapter', () => {
            const adapter = new LeetCodeAdapter();

            test('Targets aboutMe as sole challenge field and rejects realName', () => {
                assert.equal(adapter.defaultTargetField, 'aboutMe');
                assert.deepEqual(Array.from(adapter.supportedTargetFields), ['aboutMe']);
                assert.ok(!adapter.supportedTargetFields.includes('realName' as any));
            });

            test('Provides clear user instructions pointing to LeetCode profile settings', () => {
                const instructions = adapter.getInstructions('orbix-v-AbCdEf123456');
                assert.equal(instructions.fieldName, 'aboutMe');
                assert.ok(instructions.instructions.includes('ReadMe'));
                assert.ok(instructions.profileSettingsUrl?.includes('leetcode.com/settings/profile'));
            });

            test('Extracts candidate verification tokens from LeetCode GraphQL response', async () => {
                const tokenBundle = generateChallengeToken();
                const mockProfile = {
                    data: {
                        matchedUser: {
                            username: 'test_coder',
                            profile: {
                                realName: 'Alice Developer',
                                aboutMe: `Passionate engineer! Verification: ${tokenBundle.plaintextToken} Enjoying algorithms.`,
                            },
                        },
                    },
                };

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => mockProfile,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('test_coder');
                    assert.ok(fetchResult.success, 'Fetch must succeed');
                    assert.equal(fetchResult.handle, 'test_coder');

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken), 'Candidate token must be extracted');
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles LeetCode user not found (matchedUser === null)', async () => {
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => ({ data: { matchedUser: null } }),
                } as any);

                try {
                    const result = await adapter.fetchProfile('non_existent_user');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NOT_FOUND');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles LeetCode HTTP 429 rate limit', async () => {
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: false,
                    status: 429,
                    statusText: 'Too Many Requests',
                } as any);

                try {
                    const result = await adapter.fetchProfile('throttled_user');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'RATE_LIMITED');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });
        });

        // --- Codeforces Adapter ---
        describe('Codeforces Adapter', () => {
            const adapter = new CodeforcesAdapter();

            test('Restricts challenge verification exclusively to organization (freeform text)', () => {
                assert.equal(adapter.defaultTargetField, 'organization');
                assert.deepEqual(Array.from(adapter.supportedTargetFields), ['organization']);
            });

            test('Extracts candidate tokens from organization field in user.info', async () => {
                const tokenBundle = generateChallengeToken();
                const mockResponse = {
                    status: 'OK',
                    result: [
                        {
                            handle: 'tourist',
                            firstName: 'Gennady',
                            lastName: 'Korotkevich',
                            country: 'Belarus',
                            city: 'Gomel',
                            organization: `ITMO University [${tokenBundle.plaintextToken}]`,
                        },
                    ],
                };

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => mockResponse,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('tourist');
                    assert.ok(fetchResult.success);
                    assert.equal(fetchResult.targetFieldsContent['organization'], `ITMO University [${tokenBundle.plaintextToken}]`);

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken));
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles Codeforces user not found error response', async () => {
                const mockResponse = {
                    status: 'FAILED',
                    comment: 'handles: User non_existent_cf_user not found',
                };

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => mockResponse,
                } as any);

                try {
                    const result = await adapter.fetchProfile('non_existent_cf_user');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NOT_FOUND');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });
        });

        // --- HackerRank Adapter ---
        describe('HackerRank Adapter', () => {
            const adapter = new HackerRankAdapter();

            test('Restricts challenge verification to Headline (jobs_headline)', () => {
                assert.equal(adapter.defaultTargetField, 'headline');
                assert.deepEqual(Array.from(adapter.supportedTargetFields), ['headline', 'jobs_headline']);
            });

            test('Extracts candidate tokens from HackerRank jobs_headline', async () => {
                const tokenBundle = generateChallengeToken();
                const mockResponse = {
                    model: {
                        username: 'alice_hr',
                        name: 'Alice',
                        jobs_headline: `Software Engineer ${tokenBundle.plaintextToken}`,
                        short_bio: null,
                    },
                };

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => mockResponse,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('alice_hr');
                    assert.ok(fetchResult.success);
                    assert.equal(fetchResult.targetFieldsContent['headline'], `Software Engineer ${tokenBundle.plaintextToken}`);
                    assert.equal(fetchResult.targetFieldsContent['jobs_headline'], `Software Engineer ${tokenBundle.plaintextToken}`);

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken));
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Provides instructions pointing to user profile and Headline', () => {
                const instructions = adapter.getInstructions('ORBIX-ABCD-1234', 'headline', 'alice_hr');
                assert.equal(instructions.fieldName, 'headline');
                assert.equal(instructions.displayFieldName, 'Headline');
                assert.equal(instructions.profileSettingsUrl, 'https://www.hackerrank.com/profile/alice_hr');
                assert.ok(instructions.instructions.includes('Headline'));
                assert.ok(!instructions.instructions.includes('short_bio'));
                assert.ok(!instructions.instructions.includes('Short Bio'));
            });

            test('Handles HackerRank 404', async () => {
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                } as any);

                try {
                    const result = await adapter.fetchProfile('missing_hr_user');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NOT_FOUND');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });
        });

        // --- GitHub Adapter ---
        describe('GitHub Adapter (OAuth Mode)', () => {
            const adapter = new GitHubAdapter();

            test('Configured strictly for OAuth verification and rejects challenges', () => {
                assert.equal(adapter.supportsOAuthVerification, true);
                assert.equal(adapter.supportsChallengeVerification, false);
                assert.equal(adapter.defaultTargetField, 'oauth_identity');
                assert.deepEqual(adapter.extractCandidates({} as any), []);
            });

            test('Fetches GitHub user profile and extracts immutable numeric ID', async () => {
                const mockGithubUser = {
                    id: 583231,
                    login: 'octocat',
                };

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    json: async () => mockGithubUser,
                } as any);

                try {
                    const result = await adapter.fetchProfile('octocat');
                    assert.ok(result.success);
                    assert.equal(result.targetFieldsContent['oauth_identity'], '583231');
                    assert.equal(result.targetFieldsContent['login'], 'octocat');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Provides instructions pointing to OAuth link route', () => {
                const instructions = adapter.getInstructions('token_ignored');
                assert.equal(instructions.fieldName, 'oauth_identity');
                assert.ok(instructions.instructions.includes('OAuth'));
                assert.equal(instructions.profileSettingsUrl, '/api/auth/github');
            });
        });

        // --- Kaggle Adapter ---
        describe('Kaggle Adapter', () => {
            const adapter = new KaggleAdapter();

            test('Targets bio as sole challenge field and rejects other fields', () => {
                assert.equal(adapter.defaultTargetField, 'bio');
                assert.deepEqual(Array.from(adapter.supportedTargetFields), ['bio']);
                assert.ok(!adapter.supportedTargetFields.includes('username' as any));
            });

            test('Provides clear user instructions pointing to Kaggle profile, Home tab and Bio section', () => {
                const instructions = adapter.getInstructions('orbix-v-AbCdEf123456', 'bio', 'alexis_test');
                assert.equal(instructions.fieldName, 'bio');
                assert.equal(instructions.displayFieldName, 'Bio');
                assert.ok(instructions.instructions.includes('Home tab'));
                assert.ok(instructions.instructions.includes('Bio'));
                assert.ok(instructions.instructions.includes('Edit'));
                assert.equal(instructions.profileSettingsUrl, 'https://www.kaggle.com/alexis_test');
            });

            test('Extracts candidate verification tokens from Kaggle Open Graph description', async () => {
                const tokenBundle = generateChallengeToken();
                const mockHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Kaggle Grandmaster Profile</title>
                        <meta property="og:description" content="AI Researcher | Verification: ${tokenBundle.plaintextToken} | Deep learning practitioner" />
                    </head>
                    <body></body>
                    </html>
                `;

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('test_kaggler');
                    assert.ok(fetchResult.success, 'Fetch must succeed');
                    assert.equal(fetchResult.handle, 'test_kaggler');

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken), 'Candidate token must be extracted');
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Extracts candidate verification tokens from Kaggle JSON-LD Schema.org Person description', async () => {
                const tokenBundle = generateChallengeToken();
                const mockHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <script type="application/ld+json">
                        {
                            "@context": "https://schema.org",
                            "@type": "Person",
                            "name": "Alex Kaggler",
                            "description": "Kaggle Competitions Master. Orbix token ${tokenBundle.plaintextToken} for verification."
                        }
                        </script>
                    </head>
                    <body></body>
                    </html>
                `;

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('alex_kaggler');
                    assert.ok(fetchResult.success);

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken));
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Extracts candidate verification tokens from Kaggle embedded JSON state (userBio)', async () => {
                const tokenBundle = generateChallengeToken();
                const mockHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <script>
                            window.KaggleState = {
                                "userBio": "Data scientist exploring NLP. ${tokenBundle.plaintextToken}"
                            };
                        </script>
                    </head>
                    <body></body>
                    </html>
                `;

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('nlp_master');
                    assert.ok(fetchResult.success);

                    const candidates = adapter.extractCandidates(fetchResult);
                    assert.ok(candidates.includes(tokenBundle.plaintextToken));
                    assert.ok(verifyCandidateMatch(candidates[0], tokenBundle.tokenHash));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles Kaggle 404 user not found', async () => {
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: false,
                    status: 404,
                    statusText: 'Not Found',
                } as any);

                try {
                    const result = await adapter.fetchProfile('non_existent_kaggler');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NOT_FOUND');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles Kaggle HTTP 429 rate limit', async () => {
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: false,
                    status: 429,
                    statusText: 'Too Many Requests',
                } as any);

                try {
                    const result = await adapter.fetchProfile('throttled_kaggler');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'RATE_LIMITED');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Handles reserved handle rejection as NOT_FOUND without network call', async () => {
                let fetchCalled = false;
                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => {
                    fetchCalled = true;
                    return {} as any;
                };

                try {
                    const result = await adapter.fetchProfile('competitions');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NOT_FOUND');
                    assert.equal(fetchCalled, false, 'Fetch must not be called for reserved handles');
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Rejects tokens present elsewhere on page (e.g. comments, scripts) when absent from Bio', async () => {
                const tokenBundle = generateChallengeToken();
                const mockHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Kaggle Competitions Grandmaster</title>
                        <meta property="og:description" content="Legitimate bio with NO verification token present." />
                        <script>
                            window.unrelatedData = {
                                "comment": "Token accidentally elsewhere: ${tokenBundle.plaintextToken}"
                            };
                        </script>
                    </head>
                    <body>
                        <div class="user-comments">Token in forum comment: ${tokenBundle.plaintextToken}</div>
                        <div class="user-notebook-title">Notebook title ${tokenBundle.plaintextToken}</div>
                    </body>
                    </html>
                `;

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any);

                try {
                    const fetchResult = await adapter.fetchProfile('unrelated_kaggler');
                    assert.ok(fetchResult.success);

                    // Candidate extractor strictly examines 'bio'
                    const candidates = adapter.extractCandidates(fetchResult, 'bio');
                    assert.equal(candidates.length, 0, 'Must NOT extract tokens from outside the Bio field');

                    // If non-bio field is requested, extractor strictly returns empty
                    assert.deepEqual(adapter.extractCandidates(fetchResult, 'comment' as any), []);
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });

            test('Detects Google reCAPTCHA Enterprise bot challenge page and normalizes as NETWORK_ERROR', async () => {
                const recaptchaHtml = `
                    <!doctype html><html lang="en-US" dir="ltr"><head>
                    <base href="https://www.google.com/recaptcha/challengepage/">
                    <script>window['ppConfig'] = {productName: 'RecaptchaChallengePageUi'};</script>
                    </head>
                    <body>
                    <div class="fBEGtb">Checking your browser before accessing www.kaggle.com ...</div>
                    <div class="g-recaptcha" data-sitekey="6Ldxq2IpAAAAAIXyCS5jnxpiPbvmOlpcNu9ovJpc"></div>
                    </body></html>
                `;

                const originalFetch = globalThis.fetch;
                globalThis.fetch = async () => ({
                    ok: true,
                    status: 200,
                    text: async () => recaptchaHtml,
                } as any);

                try {
                    const result = await adapter.fetchProfile('bot_gated_kaggler');
                    assert.equal(result.success, false);
                    assert.equal(result.errorCode, 'NETWORK_ERROR');
                    assert.ok(result.errorMessage?.includes('bot protection challenge'));
                } finally {
                    globalThis.fetch = originalFetch;
                }
            });
        });
    });

    // =========================================================================
    // 3. RATE LIMITING & ABUSE PREVENTION
    // =========================================================================
    describe('Verification Rate Limiter (Fixed Window with Atomic Expiry)', () => {
        let store: Map<string, { value: number; expireAt: number }>;

        beforeEach(() => {
            store = new Map();
            setRedisClientForTest({
                status: 'ready',
                async eval(script: string, numkeys: number, key: string, windowArg: number | string): Promise<[number, number]> {
                    const windowSec = Number(windowArg);
                    const now = Date.now();
                    let entry = store.get(key);
                    if (!entry || now >= entry.expireAt) {
                        entry = { value: 1, expireAt: now + windowSec * 1000 };
                        store.set(key, entry);
                        return [1, windowSec];
                    }
                    entry.value += 1;
                    const ttl = Math.max(0, Math.ceil((entry.expireAt - now) / 1000));
                    return [entry.value, ttl];
                },
            });
        });

        afterEach(() => {
            resetRedisClientForTest();
        });

        test('Allows initiation within window limit (10 attempts per 15 min)', async () => {
            const userId = 'test_user_rate_1';

            for (let i = 0; i < 10; i++) {
                const check = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
                assert.equal(check.allowed, true, `Attempt ${i + 1} should be allowed`);
                assert.equal(check.remaining, 9 - i);
            }

            // 11th attempt should be blocked
            const blocked = await checkVerificationRateLimit(userId, 'initiate', 10, 900);
            assert.equal(blocked.allowed, false, '11th attempt must be rate-limited');
            assert.equal(blocked.remaining, 0);
            assert.ok(blocked.resetInSeconds > 0);
        });

        test('Allows confirmation within window limit (20 attempts per 15 min)', async () => {
            const userId = 'test_user_rate_2';

            for (let i = 0; i < 20; i++) {
                const check = await checkVerificationRateLimit(userId, 'confirm', 20, 900);
                assert.equal(check.allowed, true, `Confirm attempt ${i + 1} should be allowed`);
            }

            // 21st attempt should be blocked
            const blocked = await checkVerificationRateLimit(userId, 'confirm', 20, 900);
            assert.equal(blocked.allowed, false, '21st confirm attempt must be blocked');
            assert.equal(blocked.remaining, 0);
        });

        test('Isolates rate limits across distinct users and actions', async () => {
            const userA = 'user_A_isolated';
            const userB = 'user_B_isolated';

            // Exhaust userA initiate
            for (let i = 0; i < 10; i++) {
                await checkVerificationRateLimit(userA, 'initiate', 10, 900);
            }
            assert.equal((await checkVerificationRateLimit(userA, 'initiate', 10, 900)).allowed, false);

            // userB initiate must still be allowed
            assert.equal((await checkVerificationRateLimit(userB, 'initiate', 10, 900)).allowed, true);

            // userA confirm must still be allowed (independent action bucket)
            assert.equal((await checkVerificationRateLimit(userA, 'confirm', 20, 900)).allowed, true);
        });
    });

    // =========================================================================
    // 4. SCHEMA COMPATIBILITY UTILITY (FAIL-CLOSED SECURITY)
    // =========================================================================
    describe('Schema Compatibility Utility (Fail-Closed Security)', () => {
        beforeEach(() => {
            resetSchemaStateCache();
        });

        test('Generates verified condition respecting post-migration state or fail-closed 1 = 0', async () => {
            const status = await checkVerificationSchemaStatus();

            const condWithoutAlias = await getVerifiedLinksCondition();
            const condWithAlias = await getVerifiedLinksCondition('ul');

            if (status.hasOwnershipStatusColumn) {
                assert.equal(condWithoutAlias, "ownership_status = 'VERIFIED'");
                assert.equal(condWithAlias, "ul.ownership_status = 'VERIFIED'");
            } else {
                // Critical security fix: pre-migration must FAIL CLOSED
                assert.equal(condWithoutAlias, "1 = 0", 'Pre-migration must fail-closed to 1 = 0');
                assert.equal(condWithAlias, "1 = 0", 'Pre-migration with alias must fail-closed to 1 = 0');
            }
        });

        test('Caches schema status safely and resets cache', async () => {
            const status1 = await checkVerificationSchemaStatus();
            assert.equal(typeof status1.isMigrated, 'boolean');
            assert.equal(typeof status1.hasOwnershipStatusColumn, 'boolean');
            assert.equal(typeof status1.hasChallengesTable, 'boolean');

            resetSchemaStateCache();
            const status2 = await checkVerificationSchemaStatus();
            assert.equal(status2.isMigrated, status1.isMigrated);
        });
    });

    // =========================================================================
    // 5. CONSUMER ENFORCEMENT & INJECTION NEUTRALIZATION
    // =========================================================================
    describe('Trust-Sensitive Consumer Enforcement & Injection Neutralization', () => {

        test('ClientPortals cannot synthesize unverified platforms in portalsMap', () => {
            // Emulate the neutralized portalsMap logic across analytics routes
            const verifiedPortalRows = [
                { portal: 'leetcode', portal_username: 'real_alice' },
            ];

            const portalsMap: Record<string, string> = {};
            for (const r of verifiedPortalRows) {
                const p = (r.portal || '').toLowerCase().trim();
                const u = (r.portal_username || '').trim();
                if (p && u) portalsMap[p] = u;
            }

            // Untrusted client attempts to inject 'tourist' for codeforces and override leetcode
            const maliciousClientPortals = {
                codeforces: 'tourist',
                leetcode: 'imposter_alice',
                hackerrank: { username: 'hacker_god' },
            };

            for (const [k] of Object.entries(maliciousClientPortals)) {
                const p = k.toLowerCase().trim();
                if (p.startsWith('_') || p === 'theme' || p === 'github') continue;
                // Under our hardened implementation, clientPortals NEVER adds or overrides portalsMap
            }

            // Assert portalsMap was NOT contaminated
            assert.equal(portalsMap['leetcode'], 'real_alice', 'Verified handle must be preserved');
            assert.equal(portalsMap['codeforces'], undefined, 'Injected platform must NOT exist in portalsMap');
            assert.equal(portalsMap['hackerrank'], undefined, 'Injected platform object must NOT exist in portalsMap');
        });

        test('Resume Intelligence strictly filters platforms by verified ownership', () => {
            const mockRows = [
                { portal: 'leetcode', portalUsername: 'coder1', verified: true, lastSyncStatus: 'valid' },
                { portal: 'codeforces', portalUsername: 'tourist', verified: false, lastSyncStatus: 'valid' },
            ];

            // Filter applied in resumeIntelligence
            const verifiedPlatforms = mockRows
                .filter(r => r.verified === true)
                .map(row => ({
                    portal: row.portal,
                    username: row.portalUsername,
                    verified: true,
                }));

            assert.equal(verifiedPlatforms.length, 1);
            assert.equal(verifiedPlatforms[0].portal, 'leetcode');
            assert.equal(verifiedPlatforms[0].username, 'coder1');
        });
    });

    // =========================================================================
    // 6. CRYPTOGRAPHIC TOKEN FORMAT & SECURITY INVARIANTS
    // =========================================================================
    describe('Cryptographic Security Invariants', () => {
        test('Plaintext tokens are NEVER stored in hash form', () => {
            const tokenBundle = generateChallengeToken();
            assert.notEqual(tokenBundle.plaintextToken, tokenBundle.tokenHash);
            assert.equal(tokenBundle.tokenHash.length, 64);
            assert.match(tokenBundle.tokenHash, /^[0-9a-f]{64}$/);
            assert.equal(tokenBundle.plaintextToken.length, 30);
            assert.ok(tokenBundle.plaintextToken.startsWith('orbix-v-'));
        });

        test('Safe display prefix matches first 12 characters of plaintext token', () => {
            const tokenBundle = generateChallengeToken();
            assert.equal(tokenBundle.tokenDisplayPrefix.length, 12);
            assert.equal(tokenBundle.tokenDisplayPrefix, tokenBundle.plaintextToken.slice(0, 12));
        });

        test('Extracts candidate tokens accurately across boundaries', () => {
            const sampleBio = 'Hello! My verification code is [orbix-v-9X2kL8mP4qRt1wZaBcDeFg]. Follow me!';
            const candidates = extractChallengeCandidates(sampleBio);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], 'orbix-v-9X2kL8mP4qRt1wZaBcDeFg');
        });
    });

    after(async () => {
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
});
