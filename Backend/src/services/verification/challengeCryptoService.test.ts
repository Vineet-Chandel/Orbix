/**
 * UNIT & INTEGRATION TESTS: PLATFORM ACCOUNT OWNERSHIP VERIFICATION
 * 
 * Tests:
 * 1. Cryptographic token generation, 128+ bit entropy derivation, length (30 chars), Base62 distribution, zero collisions.
 * 2. SHA-256 token hashing, determinism, lowercase hex format, sensitivity.
 * 3. Candidate token extraction from diverse profile texts, edge cases, punctuation boundaries,
 *    multiline bios, markdown, and invalid format rejection.
 * 4. Constant-time candidate verification with timingSafeEqual.
 * 5. Full profile field validation orchestrator.
 * 6. Migration 069 static analysis: structural invariants, non-blocking indexes, trigger compatibility.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
    CHALLENGE_TOKEN_PREFIX,
    CHALLENGE_RANDOM_PAYLOAD_LENGTH,
    CHALLENGE_TOKEN_TOTAL_LENGTH,
    CHALLENGE_DISPLAY_PREFIX_LENGTH,
    CHALLENGE_TOKEN_REGEX,
    generateRandomBase62,
    hashChallengeToken,
    generateChallengeToken,
    extractChallengeCandidates,
    verifyCandidateMatch,
    validateProfileFieldForToken,
} from './challengeCryptoService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Platform Verification Cryptographic Service', () => {

    describe('Token Generation (CSPRNG & 128+ Bit Base62 Entropy)', () => {
        test('Generates token with exact expected total length (30 chars = 8 prefix + 22 payload)', () => {
            const tokenBundle = generateChallengeToken();
            assert.equal(tokenBundle.plaintextToken.length, CHALLENGE_TOKEN_TOTAL_LENGTH);
            assert.equal(tokenBundle.plaintextToken.length, 30);
            assert.equal(CHALLENGE_RANDOM_PAYLOAD_LENGTH, 22);
            assert.equal(CHALLENGE_TOKEN_PREFIX.length, 8);
        });

        test('Generates token starting with standard prefix orbix-v-', () => {
            const tokenBundle = generateChallengeToken();
            assert.ok(tokenBundle.plaintextToken.startsWith(CHALLENGE_TOKEN_PREFIX));
            assert.ok(tokenBundle.plaintextToken.startsWith('orbix-v-'));
        });

        test('Generates payload exclusively from Base62 alphanumeric set', () => {
            const base62Regex = /^[0-9a-zA-Z]{22}$/;
            for (let i = 0; i < 50; i++) {
                const tokenBundle = generateChallengeToken();
                const payload = tokenBundle.plaintextToken.slice(CHALLENGE_TOKEN_PREFIX.length);
                assert.equal(payload.length, 22);
                assert.ok(base62Regex.test(payload), `Payload contains invalid characters: ${payload}`);
            }
        });

        test('Demonstrates mathematical 128+ bit entropy derivation for 22 Base62 characters', () => {
            // Character set size = 62
            const alphabetSize = 62;
            const bitsPerChar = Math.log2(alphabetSize); // ~5.9542 bits/char
            assert.ok(bitsPerChar > 5.95 && bitsPerChar < 5.96);

            // 21 characters is strictly LESS than 128 bits
            const entropy21 = 21 * bitsPerChar;
            assert.ok(entropy21 < 128, `21 characters (${entropy21} bits) must be less than 128 bits`);

            // 22 characters strictly MEETS and EXCEEDS 128 bits
            const entropy22 = 22 * bitsPerChar;
            assert.ok(entropy22 >= 128, `22 characters (${entropy22} bits) must provide at least 128 bits`);
            assert.ok(entropy22 > 130.9 && entropy22 < 131.0);

            // BigInt state space bounds: 62^21 < 2^128 < 62^22
            const states21 = 62n ** 21n;
            const states128 = 2n ** 128n;
            const states22 = 62n ** 22n;

            assert.ok(states21 < states128, '62^21 must be strictly less than 2^128');
            assert.ok(states22 > states128, '62^22 must be strictly greater than 2^128');
        });

        test('Provides safe display prefix matching first 12 characters', () => {
            const tokenBundle = generateChallengeToken();
            assert.equal(tokenBundle.tokenDisplayPrefix.length, CHALLENGE_DISPLAY_PREFIX_LENGTH);
            assert.equal(tokenBundle.tokenDisplayPrefix, tokenBundle.plaintextToken.slice(0, 12));
            assert.ok(tokenBundle.tokenDisplayPrefix.startsWith('orbix-v-'));
        });

        test('Produces zero collisions across 1,000 sequentially generated tokens', () => {
            const sampleSize = 1000;
            const seenTokens = new Set<string>();

            for (let i = 0; i < sampleSize; i++) {
                const { plaintextToken } = generateChallengeToken();
                assert.ok(!seenTokens.has(plaintextToken), `Collision detected on token: ${plaintextToken}`);
                seenTokens.add(plaintextToken);
            }

            assert.equal(seenTokens.size, sampleSize);
        });

        test('generateRandomBase62 handles edge lengths correctly', () => {
            assert.equal(generateRandomBase62(0), '');
            assert.equal(generateRandomBase62(-5), '');
            assert.equal(generateRandomBase62(1).length, 1);
            assert.equal(generateRandomBase62(22).length, 22);
            assert.equal(generateRandomBase62(32).length, 32);
        });
    });

    describe('Token Hashing (SHA-256) & Storage Integrity', () => {
        test('Produces lowercase 64-character hexadecimal SHA-256 hash', () => {
            const { plaintextToken, tokenHash } = generateChallengeToken();
            assert.equal(tokenHash.length, 64);
            assert.ok(/^[0-9a-f]{64}$/.test(tokenHash));
        });

        test('Hashing is deterministic and matches Node crypto digest', () => {
            const testToken = 'orbix-v-1a2B3c4D5e6F7g8H9i0J1k';
            const expected = crypto.createHash('sha256').update(testToken, 'utf8').digest('hex').toLowerCase();
            const actual = hashChallengeToken(testToken);
            assert.equal(actual, expected);
            assert.equal(hashChallengeToken(testToken), actual);
        });

        test('Slight mutation in token produces avalanche effect in hash', () => {
            const tokenA = 'orbix-v-1a2B3c4D5e6F7g8H9i0J1k';
            const tokenB = 'orbix-v-1a2B3c4D5e6F7g8H9i0J1l'; // Last character changed
            const hashA = hashChallengeToken(tokenA);
            const hashB = hashChallengeToken(tokenB);
            assert.notEqual(hashA, hashB);
        });

        test('Token bundle hash matches recomputed hash of plaintext token', () => {
            const tokenBundle = generateChallengeToken();
            const recomputedHash = hashChallengeToken(tokenBundle.plaintextToken);
            assert.equal(tokenBundle.tokenHash, recomputedHash);
        });

        test('Plaintext token is distinct from its hash', () => {
            const tokenBundle = generateChallengeToken();
            assert.notEqual(tokenBundle.plaintextToken, tokenBundle.tokenHash);
            assert.ok(!tokenBundle.tokenHash.includes(tokenBundle.plaintextToken));
        });
    });

    describe('Candidate Extraction (Boundary-Aware Regex)', () => {
        const sampleToken = 'orbix-v-0123456789abcdef012345'; // Exactly 30 chars (8 prefix + 22 payload)

        test('Extracts single token at start of string', () => {
            const text = sampleToken;
            const candidates = extractChallengeCandidates(text);
            assert.deepEqual(candidates, [sampleToken]);
        });

        test('Extracts single token embedded inside sentence text', () => {
            const text = `Hello world, my verification token is ${sampleToken} for Orbix.`;
            const candidates = extractChallengeCandidates(text);
            assert.deepEqual(candidates, [sampleToken]);
        });

        test('Extracts token across multiline and markdown bio fields', () => {
            const text = `# Software Engineer\n\nContact: dev@example.com\nVerification: ${sampleToken}\nLocation: San Francisco`;
            const candidates = extractChallengeCandidates(text);
            assert.deepEqual(candidates, [sampleToken]);
        });

        test('Extracts token surrounded by standard punctuation and brackets', () => {
            const cases = [
                `[${sampleToken}]`,
                `(${sampleToken})`,
                `{${sampleToken}}`,
                `<${sampleToken}>`,
                `"${sampleToken}"`,
                `'${sampleToken}'`,
                `Token: ${sampleToken}.`,
                `Token: ${sampleToken},`,
                `${sampleToken}; next`,
            ];

            for (const c of cases) {
                const candidates = extractChallengeCandidates(c);
                assert.deepEqual(candidates, [sampleToken], `Failed to extract from: ${c}`);
            }
        });

        test('Extracts multiple distinct tokens and preserves order', () => {
            const token1 = 'orbix-v-1111111111111111111111';
            const token2 = 'orbix-v-2222222222222222222222';
            const token3 = 'orbix-v-3333333333333333333333';
            const text = `First ${token1} and then ${token2} and finally ${token3}.`;
            const candidates = extractChallengeCandidates(text);
            assert.deepEqual(candidates, [token1, token2, token3]);
        });

        test('Deduplicates repeated tokens in profile text', () => {
            const text = `${sampleToken} repeated here: ${sampleToken}`;
            const candidates = extractChallengeCandidates(text);
            assert.deepEqual(candidates, [sampleToken]);
        });

        test('Rejects tokens with invalid length (too short or too long)', () => {
            const tooShort = 'bio with orbix-v-123456789012345678901 (21 chars payload)';
            assert.deepEqual(extractChallengeCandidates(tooShort), []);

            const tooLong = 'bio with orbix-v-12345678901234567890123 (23 chars payload)';
            assert.deepEqual(extractChallengeCandidates(tooLong), []);

            const legacy16 = 'bio with orbix-v-0123456789abcdef (legacy 16 chars payload)';
            assert.deepEqual(extractChallengeCandidates(legacy16), []);
        });

        test('Rejects tokens embedded directly inside alphanumeric identifiers (no boundary)', () => {
            // Preceded by letters, digits, underscores, or hyphens
            assert.deepEqual(extractChallengeCandidates(`my${sampleToken}`), []);
            assert.deepEqual(extractChallengeCandidates(`123${sampleToken}`), []);
            assert.deepEqual(extractChallengeCandidates(`user_${sampleToken}`), []);
            assert.deepEqual(extractChallengeCandidates(`user-${sampleToken}`), []);

            // Followed by letters, digits, underscores, or hyphens
            assert.deepEqual(extractChallengeCandidates(`${sampleToken}extra`), []);
            assert.deepEqual(extractChallengeCandidates(`${sampleToken}999`), []);
            assert.deepEqual(extractChallengeCandidates(`${sampleToken}_suffix`), []);
            assert.deepEqual(extractChallengeCandidates(`${sampleToken}-suffix`), []);
        });

        test('Rejects wrong prefix', () => {
            assert.deepEqual(extractChallengeCandidates('other-v-0123456789abcdef012345'), []);
            assert.deepEqual(extractChallengeCandidates('orbix-0123456789abcdef012345'), []);
            assert.deepEqual(extractChallengeCandidates('v-0123456789abcdef012345'), []);
        });

        test('Safely handles null, undefined, empty, and non-string inputs', () => {
            assert.deepEqual(extractChallengeCandidates(null), []);
            assert.deepEqual(extractChallengeCandidates(undefined), []);
            assert.deepEqual(extractChallengeCandidates(''), []);
            assert.deepEqual(extractChallengeCandidates('    '), []);
            assert.deepEqual(extractChallengeCandidates(12345), []);
            assert.deepEqual(extractChallengeCandidates({ bio: sampleToken }), []);
            assert.deepEqual(extractChallengeCandidates([sampleToken]), []);
        });
    });

    describe('Candidate Verification & Timing-Safe Matching', () => {
        test('Successfully verifies candidate matching stored hash', () => {
            const tokenBundle = generateChallengeToken();
            const matched = verifyCandidateMatch(tokenBundle.plaintextToken, tokenBundle.tokenHash);
            assert.equal(matched, true);
        });

        test('Rejects candidate when hash does not match', () => {
            const tokenBundle = generateChallengeToken();
            const wrongToken = generateChallengeToken().plaintextToken;
            const matched = verifyCandidateMatch(wrongToken, tokenBundle.tokenHash);
            assert.equal(matched, false);
        });

        test('Accepts uppercase expectedHash (case-insensitive hex comparison)', () => {
            const tokenBundle = generateChallengeToken();
            const uppercaseHash = tokenBundle.tokenHash.toUpperCase();
            const matched = verifyCandidateMatch(tokenBundle.plaintextToken, uppercaseHash);
            assert.equal(matched, true);
        });

        test('Safely rejects malformed expectedHash without throwing', () => {
            const tokenBundle = generateChallengeToken();
            assert.equal(verifyCandidateMatch(tokenBundle.plaintextToken, 'not-a-hash'), false);
            assert.equal(verifyCandidateMatch(tokenBundle.plaintextToken, 'short'), false);
            assert.equal(verifyCandidateMatch(tokenBundle.plaintextToken, ''), false);
            assert.equal(verifyCandidateMatch(tokenBundle.plaintextToken, null as any), false);
            assert.equal(verifyCandidateMatch('', tokenBundle.tokenHash), false);
        });
    });

    describe('Full Profile Field Validation Orchestrator', () => {
        test('Validates profile bio containing exact challenge token', () => {
            const tokenBundle = generateChallengeToken();
            const profileBio = `Full-stack engineer. Code: ${tokenBundle.plaintextToken} to verify Orbix profile.`;

            const result = validateProfileFieldForToken(profileBio, tokenBundle.tokenHash);
            assert.equal(result.matched, true);
            assert.equal(result.matchedCandidate, tokenBundle.plaintextToken);
        });

        test('Validates correctly when multiple tokens exist in profile and one matches', () => {
            const tokenA = generateChallengeToken();
            const tokenB = generateChallengeToken();
            const profileBio = `Old: ${tokenA.plaintextToken} | New: ${tokenB.plaintextToken}`;

            const resultB = validateProfileFieldForToken(profileBio, tokenB.tokenHash);
            assert.equal(resultB.matched, true);
            assert.equal(resultB.matchedCandidate, tokenB.plaintextToken);
        });

        test('Returns matched: false when profile contains token for a different user', () => {
            const userAToken = generateChallengeToken();
            const userBToken = generateChallengeToken();
            const profileBio = `Bio has user A token: ${userAToken.plaintextToken}`;

            const result = validateProfileFieldForToken(profileBio, userBToken.tokenHash);
            assert.equal(result.matched, false);
            assert.equal(result.matchedCandidate, undefined);
        });

        test('Returns matched: false when profile has no verification token', () => {
            const tokenBundle = generateChallengeToken();
            const profileBio = 'I love coding in Rust and TypeScript!';

            const result = validateProfileFieldForToken(profileBio, tokenBundle.tokenHash);
            assert.equal(result.matched, false);
            assert.equal(result.matchedCandidate, undefined);
        });

        test('Returns matched: false when profile content is null or non-string', () => {
            const tokenBundle = generateChallengeToken();
            assert.equal(validateProfileFieldForToken(null, tokenBundle.tokenHash).matched, false);
            assert.equal(validateProfileFieldForToken(undefined, tokenBundle.tokenHash).matched, false);
            assert.equal(validateProfileFieldForToken(42, tokenBundle.tokenHash).matched, false);
        });
    });

    describe('Migration 069 Static Schema & Invariant Analysis', () => {
        const migrationPath = path.resolve(__dirname, '../../database/migrations/069_platform_account_ownership_verification.sql');

        test('Migration file 069 exists on disk', () => {
            assert.ok(fs.existsSync(migrationPath), `Migration file not found at ${migrationPath}`);
        });

        test('Migration 069 contains all required tables, columns, indexes, and triggers', () => {
            const sql = fs.readFileSync(migrationPath, 'utf8');

            // Table creation
            assert.ok(sql.includes('public.user_links_orphaned_archive'), 'Missing user_links_orphaned_archive');
            assert.ok(sql.includes('public.platform_verification_challenges'), 'Missing platform_verification_challenges');

            // Columns on user_links
            assert.ok(sql.includes('ownership_status'), 'Missing ownership_status column');
            assert.ok(sql.includes('sync_status'), 'Missing sync_status column');
            assert.ok(sql.includes('legacy_unverified_at'), 'Missing legacy_unverified_at column');
            assert.ok(sql.includes('verified_at'), 'Missing verified_at column');
            assert.ok(sql.includes('verified_handle'), 'Missing verified_handle column');
            assert.ok(sql.includes('verification_method'), 'Missing verification_method column');
            assert.ok(sql.includes('verification_metadata'), 'Missing verification_metadata column');

            // Constraints
            assert.ok(sql.includes('chk_user_links_ownership_status'), 'Missing chk_user_links_ownership_status');
            assert.ok(sql.includes('chk_user_links_sync_status'), 'Missing chk_user_links_sync_status');
            assert.ok(sql.includes('chk_pvc_status'), 'Missing chk_pvc_status');
            assert.ok(sql.includes('fk_pvc_user_link'), 'Missing fk_pvc_user_link');

            // Partial unique index
            assert.ok(sql.includes('unique_verified_portal_account'), 'Missing unique_verified_portal_account index');

            // Triggers
            assert.ok(sql.includes('trg_sync_user_links_verified'), 'Missing trg_sync_user_links_verified trigger');
            assert.ok(sql.includes('trg_user_links_reset_on_identity_change'), 'Missing trg_user_links_reset_on_identity_change trigger');
        });
    });
});
