/**
 * INTERVIEWBIT CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { InterviewBitAdapter } from './adapters/interviewbitAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';

describe('InterviewBit Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new InterviewBitAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'interviewbit');
        assert.equal(adapter.displayName, 'InterviewBit');
        assert.equal(adapter.defaultTargetField, 'bio');
        assert.deepEqual([...adapter.supportedTargetFields], ['bio']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('interviewbit');
        assert.ok(registered);
        assert.equal(registered?.portal, 'interviewbit');
        assert.equal(adapterRegistry.isSupported('interviewbit'), true);
        assert.equal(adapterRegistry.isSupported('InterviewBit'), true);
        assert.equal(adapterRegistry.isSupported('INTERVIEWBIT'), true);
    });

    test('Generates user instructions targeting Bio and settings URL', () => {
        const testToken = 'orbix-v-testIBToken12345';
        const instructions = adapter.getInstructions(testToken, undefined, 'ib_user');
        assert.equal(instructions.fieldName, 'bio');
        assert.equal(instructions.displayFieldName, 'Bio');
        assert.equal(instructions.profileSettingsUrl, 'https://www.interviewbit.com/profile/settings/');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Bio'));
        assert.ok(instructions.instructions.includes('Privacy Settings'));
        assert.ok(instructions.instructions.includes('Public'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('ib handle with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses bio from official InterviewBit REST API JSON response', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockProfileData = {
            id: 12345,
            username: 'coder_ib',
            name: 'IB Developer',
            bio: `Software Engineer. Orbix challenge: ${token}`,
            global_rank: 500,
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('coder_ib');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'interviewbit');
            assert.equal(result.handle, 'coder_ib');
            assert.ok(result.targetFieldsContent.bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns bio null when user exists but bio is empty or whitespace', async () => {
        const mockProfileData = {
            id: 12345,
            username: 'empty_bio_user',
            name: 'No Bio',
            bio: '   ',
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('empty_bio_user');
            assert.equal(result.success, true);
            assert.equal(result.targetFieldsContent.bio, null);

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 0);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles 403 Forbidden with clear Privacy Settings error guidance', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 403,
            } as any);

            const result = await adapter.fetchProfile('private_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('Private'));
            assert.ok(result.errorMessage?.includes('Privacy Settings'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles 404 Not Found cleanly', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
            } as any);

            const result = await adapter.fetchProfile('nonexistent_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles 429 Rate Limited gracefully', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
            } as any);

            const result = await adapter.fetchProfile('rate_limited_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles network connection errors and timeouts', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                throw new Error('Connection refused');
            };

            const result = await adapter.fetchProfile('network_fail_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NETWORK_ERROR');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
