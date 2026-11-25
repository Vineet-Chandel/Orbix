/**
 * GEEKSFORGEEKS CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GeeksforGeeksAdapter } from './adapters/geeksforgeeksAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken, verifyCandidateMatch } from './challengeCryptoService.js';

describe('GeeksforGeeks Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new GeeksforGeeksAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'geeksforgeeks');
        assert.equal(adapter.displayName, 'GeeksforGeeks');
        assert.equal(adapter.defaultTargetField, 'bio');
        assert.deepEqual([...adapter.supportedTargetFields], ['bio', 'headline']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('geeksforgeeks');
        assert.ok(registered);
        assert.equal(registered?.portal, 'geeksforgeeks');
        assert.equal(adapterRegistry.isSupported('geeksforgeeks'), true);
        assert.equal(adapterRegistry.isSupported('GEEKSFORGEEKS'), true);
        assert.equal(adapterRegistry.isSupported('GeeksForGeeks'), true);
    });

    test('Generates user instructions targeting About/Bio and edit URL', () => {
        const testToken = 'orbix-v-gfgTestToken123456';
        const instructions = adapter.getInstructions(testToken, 'bio', 'rahultripathi');
        assert.equal(instructions.fieldName, 'bio');
        assert.equal(instructions.displayFieldName, 'About/Bio');
        assert.equal(instructions.profileSettingsUrl, 'https://www.geeksforgeeks.org/profile/edit');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('About/Bio'));
        assert.ok(instructions.instructions.includes('https://www.geeksforgeeks.org/profile/edit'));
    });

    test('Generates user instructions targeting Headline when specified', () => {
        const testToken = 'orbix-v-gfgTestTokenHeadline';
        const instructions = adapter.getInstructions(testToken, 'headline', 'rahultripathi');
        assert.equal(instructions.fieldName, 'headline');
        assert.equal(instructions.displayFieldName, 'Headline');
        assert.equal(instructions.profileSettingsUrl, 'https://www.geeksforgeeks.org/profile/edit');
        assert.ok(instructions.instructions.includes('Headline'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const spacesResult = await adapter.fetchProfile('   ');
        assert.equal(spacesResult.success, false);
        assert.equal(spacesResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('gfg user with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses token embedded in user bio from Next.js RSC flight chunks', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>tourist - GeeksforGeeks</title></head>
            <body>
                <script>self.__next_f.push([1,"4:I{\\"id\\":\\"4445\\",\\"chunks\\":[]}\\n"])</script>
                <script>self.__next_f.push([1,"5:[\\"$\\",\\"div\\",null,{\\"children\\":{\\"mentor\\":{\\"handle\\":\\"tourist\\",\\"name\\":\\"Gennady\\",\\"bio\\":\\"Competitive programmer ${token} verification\\",\\"headline\\":\\"Grandmaster\\"}}]"])</script>
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
            assert.equal(result.portal, 'geeksforgeeks');
            assert.equal(result.handle, 'tourist');
            assert.ok(result.targetFieldsContent.bio?.includes(token));
            assert.equal(result.targetFieldsContent.headline, 'Grandmaster');

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses token embedded in user headline when bio is empty', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>developer1 - GeeksforGeeks</title></head>
            <body>
                <script>self.__next_f.push([1,"3:[\\"$\\",\\"div\\",null,{\\"mentor\\":{\\"handle\\":\\"developer1\\",\\"name\\":\\"Dev One\\",\\"bio\\":\\"\\",\\"headline\\":\\"${token}\\"}}]"])</script>
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

            const result = await adapter.fetchProfile('developer1');
            assert.equal(result.success, true);
            assert.equal(result.targetFieldsContent.bio, '');
            assert.ok(result.targetFieldsContent.headline?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles special characters, escaped quotes, and newlines in bio safely', async () => {
        const token = generateChallengeToken().plaintextToken;
        // In RSC flight string literal: double escaped quotes \\\" and literal braces
        const mockHtml = `
            <script>self.__next_f.push([1,"1:{\\"mentor\\":{\\"handle\\":\\"special_user\\",\\"name\\":\\"Special\\",\\"bio\\":\\"Working at {Google} \\\\\\"Software Engineer\\\\\\" ${token}\\",\\"headline\\":\\"Community Member\\"}}\\n"])</script>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('special_user');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.bio?.includes(token));
            assert.ok(result.targetFieldsContent.bio?.includes('Working at {Google}'));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Rejects flight chunk if handle does not match requested user', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <script>self.__next_f.push([1,"{\\"mentor\\":{\\"handle\\":\\"other_user\\",\\"name\\":\\"Other\\",\\"bio\\":\\"${token}\\",\\"headline\\":\\"Student\\"}}\\n"])</script>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('my_expected_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('not found or handle does not match'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Detects missing user when Next.js renders not-found chunk without mentor', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>GeeksforGeeks</title></head>
            <body>
                <script>self.__next_f.push([1,"0:[\\"$\\",\\"script\\",null,{\\"src\\":\\"/static/chunks/app/not-found-abc123.js\\"}]\\n"])</script>
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

            const result = await adapter.fetchProfile('nonexistent_gfg_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 404 response as NOT_FOUND', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                text: async () => '404 Not Found',
            } as any);

            const result = await adapter.fetchProfile('missing_user_404');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles HTTP 429 response as RATE_LIMITED', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                text: async () => 'Too Many Requests',
            } as any);

            const result = await adapter.fetchProfile('rate_limited_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles network failure and AbortError timeout', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                const error = new Error('Timeout');
                error.name = 'AbortError';
                throw error;
            };

            const timeoutResult = await adapter.fetchProfile('timeout_user');
            assert.equal(timeoutResult.success, false);
            assert.equal(timeoutResult.errorCode, 'RATE_LIMITED');
            assert.ok(timeoutResult.errorMessage?.includes('timed out'));

            globalThis.fetch = async () => {
                throw new Error('Connection refused');
            };

            const networkResult = await adapter.fetchProfile('net_err_user');
            assert.equal(networkResult.success, false);
            assert.equal(networkResult.errorCode, 'NETWORK_ERROR');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Complete end-to-end challenge candidate match verification', async () => {
        const { plaintextToken, tokenHash } = generateChallengeToken();

        const mockHtml = `
            <script>self.__next_f.push([1,"1:{\\"mentor\\":{\\"handle\\":\\"verified_user\\",\\"name\\":\\"Verified Dev\\",\\"bio\\":\\"Software Engineer | Orbix verification code: ${plaintextToken}\\",\\"headline\\":\\"Community Member\\"}}\\n"])</script>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const fetchResult = await adapter.fetchProfile('verified_user');
            assert.equal(fetchResult.success, true);

            const candidates = adapter.extractCandidates(fetchResult);
            assert.equal(candidates.length, 1);

            const isMatch = verifyCandidateMatch(candidates[0], tokenHash);
            assert.equal(isMatch, true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
