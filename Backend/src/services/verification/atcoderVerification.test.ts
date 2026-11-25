/**
 * ATCODER CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AtCoderAdapter } from './adapters/atcoderAdapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken } from './challengeCryptoService.js';
import { platformVerificationService } from './platformVerificationService.js';
import { pool } from '../../database/client.js';
import redis from '../../redis/client.js';
import { resetSchemaStateCache } from './schemaCompatibility.js';

describe('AtCoder Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new AtCoderAdapter();

    test('Adapter conforms to PlatformAdapter metadata interface', () => {
        assert.equal(adapter.portal, 'atcoder');
        assert.equal(adapter.displayName, 'AtCoder');
        assert.equal(adapter.defaultTargetField, 'affiliation');
        assert.deepEqual([...adapter.supportedTargetFields], ['affiliation']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('atcoder');
        assert.ok(registered);
        assert.equal(registered?.portal, 'atcoder');
        assert.equal(adapterRegistry.isSupported('atcoder'), true);
        assert.equal(adapterRegistry.isSupported('ATCODER'), true);
    });

    test('Generates user instructions targeting Affiliation and settings URL', () => {
        const testToken = 'orbix-v-testAtcoderToken123';
        const instructions = adapter.getInstructions(testToken);
        assert.equal(instructions.fieldName, 'affiliation');
        assert.equal(instructions.displayFieldName, 'Affiliation');
        assert.equal(instructions.profileSettingsUrl, 'https://atcoder.jp/settings');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Affiliation'));
        assert.ok(instructions.instructions.includes('https://atcoder.jp/settings'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('invalid handle with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Parses English Affiliation table cell from profile HTML', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>tourist (Gennady Korotkevich) - AtCoder</title></head>
            <body>
                <table class="table table-bordered table-striped">
                    <tr>
                        <th class="no-break">Country / Region</th>
                        <td>Belarus</td>
                    </tr>
                    <tr>
                        <th class="no-break">Affiliation</th>
                        <td class="break-all">University of ITMO &amp; ${token}</td>
                    </tr>
                </table>
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
            assert.equal(result.portal, 'atcoder');
            assert.equal(result.handle, 'tourist');
            assert.ok(result.targetFieldsContent.affiliation?.includes(token));
            assert.ok(result.targetFieldsContent.affiliation?.includes('&'));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Parses Japanese 所属 table cell from profile HTML', async () => {
        const token = generateChallengeToken().plaintextToken;
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>chokudai - AtCoder</title></head>
            <body>
                <table class="table table-bordered table-striped">
                    <tr>
                        <th class="no-break">所属</th>
                        <td class="break-all">AtCoder Inc. [${token}]</td>
                    </tr>
                </table>
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

            const result = await adapter.fetchProfile('chokudai');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.affiliation?.includes(token));

            const candidates = adapter.extractCandidates(result);
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns affiliation null when user exists but Affiliation row is absent', async () => {
        const mockHtml = `
            <!DOCTYPE html>
            <html>
            <head><title>newbie - AtCoder</title></head>
            <body>
                <table class="table table-bordered table-striped">
                    <tr>
                        <th class="no-break">Country / Region</th>
                        <td>Japan</td>
                    </tr>
                </table>
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

            const result = await adapter.fetchProfile('newbie');
            assert.equal(result.success, true);
            assert.equal(result.targetFieldsContent.affiliation, null);

            const candidates = adapter.extractCandidates(result);
            assert.deepEqual(candidates, []);
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

            const result = await adapter.fetchProfile('nonexistent_user_xyz');
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

            const result = await adapter.fetchProfile('busy_user');
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

            const result = await adapter.fetchProfile('timeout_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'RATE_LIMITED');
            assert.ok(result.errorMessage?.includes('timed out'));
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
