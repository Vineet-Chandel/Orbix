/**
 * HACKEREARTH CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { HackerEarthAdapter } from './adapters/hackerearthAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken, verifyCandidateMatch } from './challengeCryptoService.js';

describe('HackerEarth Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new HackerEarthAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'hackerearth');
        assert.equal(adapter.displayName, 'HackerEarth');
        assert.equal(adapter.defaultTargetField, 'bio');
        assert.deepEqual([...adapter.supportedTargetFields], ['bio', 'location']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('hackerearth');
        assert.ok(registered);
        assert.equal(registered?.portal, 'hackerearth');
        assert.equal(adapterRegistry.isSupported('hackerearth'), true);
        assert.equal(adapterRegistry.isSupported('HACKEREARTH'), true);
        assert.equal(adapterRegistry.isSupported('HackerEarth'), true);
    });

    test('Generates user instructions targeting Bio and profile settings', () => {
        const testToken = 'orbix-v-heTestToken123456';
        const instructions = adapter.getInstructions(testToken, 'bio', 'rahultripathi');
        assert.equal(instructions.fieldName, 'bio');
        assert.equal(instructions.displayFieldName, 'Bio');
        assert.equal(instructions.profileSettingsUrl, 'https://www.hackerearth.com/@rahultripathi/');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Bio'));
        assert.ok(instructions.instructions.includes('https://www.hackerearth.com/@rahultripathi/'));
    });

    test('Generates user instructions targeting Location when specified', () => {
        const testToken = 'orbix-v-heTestTokenLocation';
        const instructions = adapter.getInstructions(testToken, 'location', 'rahultripathi');
        assert.equal(instructions.fieldName, 'location');
        assert.equal(instructions.displayFieldName, 'Location');
        assert.equal(instructions.profileSettingsUrl, 'https://www.hackerearth.com/@rahultripathi/');
        assert.ok(instructions.instructions.includes('Location'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const spacesResult = await adapter.fetchProfile('   ');
        assert.equal(spacesResult.success, false);
        assert.equal(spacesResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('he user with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses token embedded in user bio (miniresume) from Next.js RSC flight chunks', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>tourist | Developer Profile on HackerEarth</title>
                <meta property="og:url" content="https://www.hackerearth.com/@tourist/" />
            </head>
            <body>
                <script>self.__next_f.push([1,"4:I{\\"id\\":\\"4445\\",\\"chunks\\":[]}\\n"])</script>
                <script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{\\"username\\":\\"tourist\\",\\"profileData\\":{\\"full_name\\":\\"Gennady Korotkevich\\",\\"avatar\\":\\"https://uc.hackerearth.com/avatar.jpg\\",\\"miniresume\\":\\"Competitive programmer ${token} verification\\",\\"location\\":\\"Gomel, Belarus\\"}}]"])</script>
            </body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('tourist');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'hackerearth');
            assert.equal(result.handle, 'tourist');
            assert.ok(result.targetFieldsContent.bio?.includes(token));
            assert.equal(result.targetFieldsContent.location, 'Gomel, Belarus');
            assert.equal(result.targetFieldsContent.full_name, 'Gennady Korotkevich');

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses token embedded in user location field from Next.js RSC flight chunks', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>tourist | Developer Profile on HackerEarth</title>
                <meta property="og:url" content="https://www.hackerearth.com/@tourist/" />
            </head>
            <body>
                <script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{\\"username\\":\\"tourist\\",\\"profileData\\":{\\"full_name\\":\\"Gennady\\",\\"miniresume\\":null,\\"location\\":\\"${token}\\"}}]"])</script>
            </body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('@tourist');
            assert.equal(result.success, true);
            assert.equal(result.handle, 'tourist');
            assert.equal(result.targetFieldsContent.bio, '');
            assert.equal(result.targetFieldsContent.location, token);

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Enforces exact handle attribution and rejects mismatched handle profiles', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>otheruser | Developer Profile on HackerEarth</title>
                <meta property="og:url" content="https://www.hackerearth.com/@otheruser/" />
            </head>
            <body>
                <script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{\\"username\\":\\"otheruser\\",\\"profileData\\":{\\"full_name\\":\\"Other\\",\\"miniresume\\":\\"orbix-v-test1234567890123456\\",\\"location\\":\\"NY\\"}}]"])</script>
            </body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('claimed_victim_handle');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('not found or handle does not match'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 404 cleanly when HackerEarth user does not exist', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                text: async () => 'Not Found',
            } as any);

            const result = await adapter.fetchProfile('nonexistent_user_9999');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 429 rate limit cleanly with retryable error code', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                text: async () => 'Too Many Requests',
            } as any);

            const result = await adapter.fetchProfile('tourist');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('rate limit'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles network abort/timeout cleanly with retryable error code', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                const error = new Error('The operation was aborted');
                error.name = 'AbortError';
                throw error;
            };

            const result = await adapter.fetchProfile('tourist');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('timed out'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('End-to-end cryptographic challenge match via verifyCandidateMatch', async () => {
        const challenge = generateChallengeToken();
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:url" content="https://www.hackerearth.com/@rahultripathi/" />
            </head>
            <body>
                <script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{\\"username\\":\\"rahultripathi\\",\\"profileData\\":{\\"full_name\\":\\"Rahul Tripathi\\",\\"miniresume\\":\\"Verified developer ${challenge.plaintextToken}\\",\\"location\\":\\"India\\"}}]"])</script>
            </body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const fetchResult = await adapter.fetchProfile('rahultripathi');
            assert.equal(fetchResult.success, true);

            const candidates = adapter.extractCandidates(fetchResult);
            assert.equal(candidates.length, 1);

            const matchResult = verifyCandidateMatch(candidates[0], challenge.tokenHash);
            assert.equal(matchResult, true);

            const tamperedMatch = verifyCandidateMatch('orbix-v-tamperedInvalidToken12', challenge.tokenHash);
            assert.equal(tamperedMatch, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
