/**
 * TOPCODER CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { TopCoderAdapter } from './adapters/topcoderAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';

describe('TopCoder Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new TopCoderAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'topcoder');
        assert.equal(adapter.displayName, 'TopCoder');
        assert.equal(adapter.defaultTargetField, 'description');
        assert.deepEqual([...adapter.supportedTargetFields], ['description']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('topcoder');
        assert.ok(registered);
        assert.equal(registered?.portal, 'topcoder');
        assert.equal(adapterRegistry.isSupported('topcoder'), true);
        assert.equal(adapterRegistry.isSupported('TOPCODER'), true);
    });

    test('Generates user instructions targeting Short Bio and settings/profile URL', () => {
        const testToken = 'orbix-v-testTopcoderToken99';
        const instructions = adapter.getInstructions(testToken);
        assert.equal(instructions.fieldName, 'description');
        assert.equal(instructions.displayFieldName, 'Short Bio');
        assert.equal(instructions.profileSettingsUrl, 'https://www.topcoder.com/settings/profile');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Short Bio'));
        assert.ok(instructions.instructions.includes('https://www.topcoder.com/settings/profile'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('topcoder handle spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses description from official TopCoder REST API JSON response', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockMemberData = [
            {
                handle: 'tourist',
                firstName: 'Gennady',
                lastName: 'Korotkevich',
                description: `Competitive Programmer. Orbix verify: ${token}`,
                status: 'ACTIVE',
            },
        ];

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockMemberData,
            } as any);

            const result = await adapter.fetchProfile('tourist');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'topcoder');
            assert.equal(result.handle, 'tourist');
            assert.ok(result.targetFieldsContent.description?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns description null when user exists but description is empty', async () => {
        const mockMemberData = [
            {
                handle: 'empty_bio_coder',
                description: '',
            },
        ];

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockMemberData,
            } as any);

            const result = await adapter.fetchProfile('empty_bio_coder');
            assert.equal(result.success, true);
            assert.equal(result.targetFieldsContent.description, null);

            const candidates = adapter.extractCandidates(result);
            assert.deepEqual(candidates, []);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Detects missing user when API returns empty array', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => [],
            } as any);

            const result = await adapter.fetchProfile('nonexistent_handle_123');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Detects mismatch when returned member handle does not match query', async () => {
        const mockMemberData = [
            {
                handle: 'different_user',
                description: 'Some text',
            },
        ];

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockMemberData,
            } as any);

            const result = await adapter.fetchProfile('queried_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 404 user not found', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                json: async () => ({ message: 'Not found' }),
            } as any);

            const result = await adapter.fetchProfile('nonexistent_tc');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 429 rate limit exceeded', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                json: async () => ({ message: 'Rate limit' }),
            } as any);

            const result = await adapter.fetchProfile('busy_tc_coder');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles network failure and abort timeouts', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                throw error;
            };

            const result = await adapter.fetchProfile('timeout_tc');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('timed out'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
