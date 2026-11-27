/**
 * SUBSTACK CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SubstackAdapter } from './adapters/substackAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';

describe('Substack Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new SubstackAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'substack');
        assert.equal(adapter.displayName, 'Substack');
        assert.equal(adapter.defaultTargetField, 'bio');
        assert.deepEqual([...adapter.supportedTargetFields], ['bio']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('substack');
        assert.ok(registered);
        assert.equal(registered?.portal, 'substack');
        assert.equal(adapterRegistry.isSupported('substack'), true);
        assert.equal(adapterRegistry.isSupported('Substack'), true);
        assert.equal(adapterRegistry.isSupported('SUBSTACK'), true);
    });

    test('Generates user instructions targeting Bio and settings URL', () => {
        const testToken = 'orbix-v-testSubstackToken99';
        const instructions = adapter.getInstructions(testToken, undefined, 'author');
        assert.equal(instructions.fieldName, 'bio');
        assert.equal(instructions.displayFieldName, 'Bio');
        assert.equal(instructions.profileSettingsUrl, 'https://substack.com/profile/edit');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Bio'));
        assert.ok(instructions.instructions.includes('https://substack.com/profile/edit'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('invalid handle with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses bio from JSON-LD Person schema in public profile HTML', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:title" content="Jane Writer | Substack"/>
                <script type="application/ld+json">
                {
                    "@context": "https://schema.org",
                    "@type": "Person",
                    "name": "Jane Writer",
                    "description": "Author, analyst, thinker. Verification token: ${token}",
                    "image": "https://example.com/jane.jpg"
                }
                </script>
            </head>
            <body>Profile Content</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('janewriter');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'substack');
            assert.equal(result.handle, 'janewriter');
            assert.ok(result.targetFieldsContent.bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses bio from OpenGraph meta tags fallback when JSON-LD description is omitted', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta property="og:title" content="John Doe | Substack"/>
                <meta property="og:description" content="Essayist and researcher. Token: ${token}"/>
            </head>
            <body>Profile Content</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('johndoe');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.bio?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Identifies non-existent accounts using noindex and Search title indicators', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta data-rh="true" name="robots" content="noindex"/>
                <meta data-rh="true" property="og:title" content="Search &quot;ghost_user_9999&quot; on Substack"/>
            </head>
            <body>Search results</body>
            </html>
        `;

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                text: async () => mockHtml,
            } as any);

            const result = await adapter.fetchProfile('ghost_user_9999');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
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
