/**
 * MEDIUM CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 * Validates Short bio target field verification, public retrieval paths, and Name exclusion invariants.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MediumAdapter } from './adapters/mediumAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';

describe('Medium Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new MediumAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface with Short bio target', () => {
        assert.equal(adapter.portal, 'medium');
        assert.equal(adapter.displayName, 'Medium');
        assert.equal(adapter.defaultTargetField, 'short_bio');
        assert.ok(adapter.supportedTargetFields.includes('short_bio'));
        assert.ok(adapter.supportedTargetFields.includes('bio'));
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('medium');
        assert.ok(registered);
        assert.equal(registered?.portal, 'medium');
        assert.equal(adapterRegistry.isSupported('medium'), true);
        assert.equal(adapterRegistry.isSupported('Medium'), true);
        assert.equal(adapterRegistry.isSupported('MEDIUM'), true);
    });

    test('Generates user instructions targeting Short bio and settings URL', () => {
        const testToken = 'orbix-v-testMediumToken1234';
        const instructions = adapter.getInstructions(testToken, undefined, 'writer');
        assert.equal(instructions.fieldName, 'short_bio');
        assert.equal(instructions.displayFieldName, 'Short bio');
        assert.equal(instructions.profileSettingsUrl, 'https://medium.com/me/settings/account');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Short bio'));
        assert.ok(!instructions.instructions.includes('Name'));
        assert.ok(instructions.instructions.includes('https://medium.com/me/settings/account'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('invalid handle with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses short_bio from Medium public format=json endpoint', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockPayload = {
            success: true,
            payload: {
                user: {
                    userId: 'user_123',
                    name: 'Author Name',
                    username: 'author_handle',
                    bio: `Software architect and writer. Verification token: ${token}`,
                }
            }
        };
        const mockJsonResponse = `])}while(1);</x>${JSON.stringify(mockPayload)}`;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url: any) => {
                const urlStr = String(url);
                if (urlStr.includes('format=json')) {
                    return {
                        ok: true,
                        status: 200,
                        text: async () => mockJsonResponse,
                    } as any;
                }
                throw new Error(`Unexpected URL: ${urlStr}`);
            };

            const result = await adapter.fetchProfile('author_handle');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'medium');
            assert.equal(result.handle, 'author_handle');
            assert.ok(result.targetFieldsContent.short_bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses short_bio from HTML fallback via JSON-LD Person schema', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Person",
                    "name": "Jane Writer",
                    "description": "Essayist. Token: ${token}"
                }
                </script>
            </head>
            <body>Profile Content</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url: any) => {
                const urlStr = String(url);
                if (urlStr.includes('format=json')) {
                    // Simulate JSON endpoint unavailable / 500
                    return { ok: false, status: 500, text: async () => '' } as any;
                }
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any;
            };

            const result = await adapter.fetchProfile('janewriter');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.short_bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses short_bio from HTML fallback via window.__APOLLO_STATE__', async () => {
        const token = generateChallengeToken().plaintextToken;
        const apolloState = {
            'User:abc12345': {
                __typename: 'User',
                id: 'abc12345',
                name: 'Dev Coder',
                bio: `Researcher & hacker. ${token}`,
            }
        };
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <script>window.__APOLLO_STATE__ = ${JSON.stringify(apolloState)};</script>
            </head>
            <body>Profile Content</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url: any) => {
                const urlStr = String(url);
                if (urlStr.includes('format=json')) {
                    return { ok: false, status: 500, text: async () => '' } as any;
                }
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any;
            };

            const result = await adapter.fetchProfile('devcoder');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.short_bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses short_bio from HTML fallback via OpenGraph og:description', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:description" content="Read writing from Sam on Medium. Tech enthusiast and founder. ${token}"/>
            </head>
            <body>Profile Content</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url: any) => {
                const urlStr = String(url);
                if (urlStr.includes('format=json')) {
                    return { ok: false, status: 500, text: async () => '' } as any;
                }
                return {
                    ok: true,
                    status: 200,
                    text: async () => mockHtml,
                } as any;
            };

            const result = await adapter.fetchProfile('sam');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.short_bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('SECURITY INVARIANT: Token placed in display Name is NEVER extracted or accepted', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockPayload = {
            success: true,
            payload: {
                user: {
                    userId: 'user_456',
                    name: `Infiltrator (${token})`, // Token erroneously placed in Name!
                    username: 'infiltrator',
                    bio: 'Legitimate short bio without token.', // Bio does NOT have token
                }
            }
        };
        const mockJsonResponse = `])}while(1);</x>${JSON.stringify(mockPayload)}`;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockJsonResponse,
            } as any);

            const result = await adapter.fetchProfile('infiltrator');
            assert.equal(result.success, true);
            // Verify targetFieldsContent does NOT store name as short_bio
            assert.ok(!result.targetFieldsContent.short_bio?.includes(token));

            // Candidate extraction must be completely empty
            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 0, 'Candidate tokens must NOT be extracted from Name field');

            // Explicitly requesting 'name' or 'displayName' must be rejected
            const nameCandidates = adapter.extractCandidates(result, 'name');
            assert.equal(nameCandidates.length, 0);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns TOKEN_NOT_FOUND candidate empty set when bio is empty or does not contain token', async () => {
        const mockPayload = {
            success: true,
            payload: {
                user: {
                    userId: 'user_empty',
                    name: 'Empty Bio User',
                    username: 'empty_user',
                    bio: '',
                }
            }
        };
        const mockJsonResponse = `])}while(1);</x>${JSON.stringify(mockPayload)}`;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockJsonResponse,
            } as any);

            const result = await adapter.fetchProfile('empty_user');
            assert.equal(result.success, true);
            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 0);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles 404 Not Found as NOT_FOUND error', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                text: async () => 'User not found',
            } as any);

            const result = await adapter.fetchProfile('nonexistent_user_404');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles 429 Rate Limit as RATE_LIMITED error', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 429,
                text: async () => 'Rate limit exceeded',
            } as any);

            const result = await adapter.fetchProfile('busyuser');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('rate limit exceeded'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles fetch timeout/abort cleanly as RATE_LIMITED', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                const abortError = new Error('The operation was aborted');
                abortError.name = 'AbortError';
                throw abortError;
            };

            const result = await adapter.fetchProfile('slowuser');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('timed out'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
