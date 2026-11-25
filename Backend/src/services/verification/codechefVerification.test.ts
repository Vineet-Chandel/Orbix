/**
 * CODECHEF CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CodeChefAdapter } from './adapters/codechefAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';

describe('CodeChef Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new CodeChefAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'codechef');
        assert.equal(adapter.displayName, 'CodeChef');
        assert.equal(adapter.defaultTargetField, 'highest_degree');
        assert.deepEqual([...adapter.supportedTargetFields], ['highest_degree']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('codechef');
        assert.ok(registered);
        assert.equal(registered?.portal, 'codechef');
        assert.equal(adapterRegistry.isSupported('codechef'), true);
        assert.equal(adapterRegistry.isSupported('CODECHEF'), true);
    });

    test('Generates user instructions targeting Highest Degree Earned and dynamic edit URL', () => {
        const testToken = 'orbix-v-testChefToken12345';
        const instructions = adapter.getInstructions(testToken, 'highest_degree', 'chef_user');
        assert.equal(instructions.fieldName, 'highest_degree');
        assert.equal(instructions.displayFieldName, 'Highest Degree Earned');
        assert.equal(instructions.profileSettingsUrl, 'https://www.codechef.com/users/chef_user/edit');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Highest Degree Earned'));
        assert.ok(instructions.instructions.includes('Professional'));
        assert.ok(instructions.instructions.includes('https://www.codechef.com/users/chef_user/edit'));

        const fallbackInstructions = adapter.getInstructions(testToken, 'highest_degree');
        assert.equal(fallbackInstructions.profileSettingsUrl, 'https://www.codechef.com/');
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('chef with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses Highest Degree Earned field from profile HTML with span wrapper', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>gennady.korotkevich - CodeChef User Profile | CodeChef</title></head>
            <body>
                <section class="user-details">
                    <ul class="side-nav">
                        <li><label>Country:</label> <span>Belarus</span></li>
                        <li><label>Highest Degree Earned:</label> <span>B.S. Computer Science (${token})</span></li>
                    </ul>
                </section>
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

            const result = await adapter.fetchProfile('gennady');
            assert.equal(result.success, true);
            assert.equal(result.portal, 'codechef');
            assert.equal(result.handle, 'gennady');
            assert.ok(result.targetFieldsContent.highest_degree?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses Highest Degree Earned field without span wrapper', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>coder1 - CodeChef User Profile | CodeChef</title></head>
            <body>
                <section class="user-details">
                    <li><label>Highest Degree Earned:</label> Verify: ${token}</li>
                </section>
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

            const result = await adapter.fetchProfile('coder1');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.highest_degree?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses Highest Degree variation without Earned', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>coder2 - CodeChef User Profile | CodeChef</title></head>
            <body>
                <section class="user-details">
                    <li><label>Highest Degree:</label> <span>M.Tech AI (${token})</span></li>
                </section>
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

            const result = await adapter.fetchProfile('coder2');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.highest_degree?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Regression test: Rejects token placed in Institution field and yields zero candidates', async () => {
        const token = generateChallengeToken().plaintextToken;
        // User attempted to put token in Institution (Where do you study?)
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>legacy_user - CodeChef User Profile | CodeChef</title></head>
            <body>
                <section class="user-details">
                    <ul class="side-nav">
                        <li><label>Country:</label> <span>India</span></li>
                        <li><label>Student/Professional:</label> <span>Student</span></li>
                        <li><label>Institution:</label> <span>PSIT College (${token})</span></li>
                    </ul>
                </section>
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

            const result = await adapter.fetchProfile('legacy_user');
            assert.equal(result.success, true);
            // highest_degree must be null because only Institution contains text
            assert.equal(result.targetFieldsContent.highest_degree, null);
            // institution must not be present in targetFieldsContent
            assert.equal(result.targetFieldsContent.institution, undefined);

            // extractCandidates MUST yield no candidates
            const candidates = adapter.extractCandidates(result);
            assert.deepEqual(candidates, []);

            // Explicitly requesting 'institution' must also yield no candidates
            const instCandidates = adapter.extractCandidates(result, 'institution');
            assert.deepEqual(instCandidates, []);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns highest_degree null when user has NA or empty degree', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>no_inst - CodeChef User Profile | CodeChef</title></head>
            <body>
                <section class="user-details">
                    <li><label>Highest Degree Earned:</label> <span>NA</span></li>
                </section>
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

            const result = await adapter.fetchProfile('no_inst');
            assert.equal(result.success, true);
            assert.equal(result.targetFieldsContent.highest_degree, null);

            const candidates = adapter.extractCandidates(result);
            assert.deepEqual(candidates, []);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Detects missing user when profile redirects to homepage or lacks user-details', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>CodeChef - Learn and Practice Coding with Problems</title></head>
            <body>
                <div class="homepage-banner">Welcome to CodeChef</div>
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

            const result = await adapter.fetchProfile('nonexistent_chef');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
            assert.ok(result.errorMessage?.includes('does not exist'));
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
                text: async () => '404 Not Found',
            } as any);

            const result = await adapter.fetchProfile('nonexistent_user_404');
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
                text: async () => 'Rate limit exceeded',
            } as any);

            const result = await adapter.fetchProfile('busy_chef');
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

            const result = await adapter.fetchProfile('timeout_chef');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('timed out'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
