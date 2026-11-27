/**
 * NAUKRI CODE360 CRYPTOGRAPHIC OWNERSHIP VERIFICATION TEST SUITE
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Code360Adapter } from './adapters/code360Adapter.js';
import { adapterRegistry } from './adapters/adapterRegistry.js';
import { generateChallengeToken, verifyCandidateMatch } from './challengeCryptoService.js';
import { fetchCode360 } from '../../Routes/portals/portals.js';

describe('Naukri Code360 Verification Adapter & Challenge Lifecycle', () => {
    const adapter = new Code360Adapter();

    test('Adapter conforms to PlatformAdapter metadata interface with About as primary default', () => {
        assert.equal(adapter.portal, 'code360');
        assert.equal(adapter.displayName, 'Naukri Code360');
        assert.equal(adapter.defaultTargetField, 'about');
        assert.deepEqual([...adapter.supportedTargetFields], ['about', 'name']);
        assert.equal(adapter.supportsChallengeVerification, true);
        assert.equal(adapter.supportsOAuthVerification, false);
    });

    test('Registered in adapterRegistry under lowercase portal key', () => {
        const registered = adapterRegistry.getAdapter('code360');
        assert.ok(registered);
        assert.equal(registered?.portal, 'code360');
        assert.equal(adapterRegistry.isSupported('code360'), true);
        assert.equal(adapterRegistry.isSupported('Code360'), true);
        assert.equal(adapterRegistry.isSupported('CODE360'), true);
    });

    test('Generates user instructions targeting About you (Bio) as primary default', () => {
        const testToken = 'orbix-v-testCode360Token12345';
        const instructions = adapter.getInstructions(testToken, undefined, 'code360_user');
        assert.equal(instructions.fieldName, 'about');
        assert.equal(instructions.displayFieldName, 'About you (Bio)');
        assert.equal(instructions.profileSettingsUrl, 'https://www.naukri.com/code360/profile/edit');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('About you'));
        assert.ok(instructions.instructions.includes('Additional info'));
    });

    test('Generates user instructions targeting Name when requested', () => {
        const testToken = 'orbix-v-testCode360Token12345';
        const instructions = adapter.getInstructions(testToken, 'name', 'code360_user');
        assert.equal(instructions.fieldName, 'name');
        assert.equal(instructions.displayFieldName, 'Name');
        assert.equal(instructions.profileSettingsUrl, 'https://www.naukri.com/code360/profile/edit');
        assert.ok(instructions.instructions.includes(testToken));
        assert.ok(instructions.instructions.includes('Name'));
        assert.ok(instructions.instructions.includes('Personal info'));
    });

    test('Rejects invalid or empty handle inputs before network request', async () => {
        const emptyResult = await adapter.fetchProfile('');
        assert.equal(emptyResult.success, false);
        assert.equal(emptyResult.errorCode, 'NOT_FOUND');

        const invalidChars = await adapter.fetchProfile('invalid handle with spaces!');
        assert.equal(invalidChars.success, false);
        assert.equal(invalidChars.errorCode, 'NOT_FOUND');
    });

    test('Verification succeeds when token is placed in About you (Bio)', async () => {
        const bundle = generateChallengeToken();
        const token = bundle.plaintextToken;
        const mockProfileData = {
            data: {
                uuid: 'sarthaksangwan',
                name: 'Sarthak',
                about: `Full stack engineer. Orbix verification: ${token}`,
                profile: {
                    summary: `Full stack engineer. Orbix verification: ${token}`,
                },
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('sarthaksangwan');
            assert.equal(result.success, true);
            assert.ok(result.targetFieldsContent.about?.includes(token));

            const candidates = adapter.extractCandidates(result, 'about');
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);

            // Cryptographic match check
            assert.equal(verifyCandidateMatch(candidates[0], bundle.tokenHash), true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Verification succeeds when token is placed in Name (Display Name) via fallback', async () => {
        const bundle = generateChallengeToken();
        const token = bundle.plaintextToken;
        const mockProfileData = {
            data: {
                uuid: 'c827361a-1234-4567-890a-bcdef0123456',
                name: `Ninja Developer ${token}`,
                about: 'Competitive programmer and DSA learner',
                image: 'https://files.codingninjas.in/avatar-1710924338.png',
                user_exp: 5000,
                user_level_name: 'Specialist',
                dsa_domain_data: {
                    problem_count_data: {
                        total_count: 142,
                    },
                },
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('c827361a-1234-4567-890a-bcdef0123456');
            assert.equal(result.success, true);

            // Primary target 'about' has no token, but fallback finds it in 'name'
            const candidates = adapter.extractCandidates(result, 'about');
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], token);

            // Also succeeds when explicit target 'name' is queried
            const nameCandidates = adapter.extractCandidates(result, 'name');
            assert.equal(nameCandidates.length, 1);
            assert.equal(nameCandidates[0], token);

            // Cryptographic match check
            assert.equal(verifyCandidateMatch(candidates[0], bundle.tokenHash), true);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Profile exists but token is absent → verification fails', async () => {
        const bundle = generateChallengeToken();
        const mockProfileData = {
            data: {
                uuid: 'sarthaksangwan',
                name: 'Sarthak',
                about: 'Full stack engineer with 5 years experience in React and Node',
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('sarthaksangwan');
            assert.equal(result.success, true);

            const candidates = adapter.extractCandidates(result, 'about');
            // No candidate tokens found in profile
            assert.equal(candidates.length, 0);

            // Token match cannot succeed without candidate
            const anyMatch = candidates.some(c => verifyCandidateMatch(c, bundle.tokenHash));
            assert.equal(anyMatch, false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Wrong token placed in profile → verification fails', async () => {
        const bundleUserA = generateChallengeToken();
        const bundleUserB = generateChallengeToken();

        // User B placed their own token, but User A tries to verify
        const mockProfileData = {
            data: {
                uuid: 'test_ninja',
                name: 'Ninja',
                about: `Challenge: ${bundleUserB.plaintextToken}`,
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const result = await adapter.fetchProfile('test_ninja');
            assert.equal(result.success, true);

            const candidates = adapter.extractCandidates(result, 'about');
            assert.equal(candidates.length, 1);
            assert.equal(candidates[0], bundleUserB.plaintextToken);

            // Cryptographic match for User A MUST FAIL
            assert.equal(verifyCandidateMatch(candidates[0], bundleUserA.tokenHash), false);
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Handles profile URL input correctly', async () => {
        const mockProfileData = {
            data: {
                uuid: 'Maximus',
                name: 'Maximus',
                about: null,
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async (url: any) => {
                assert.ok(String(url).includes('uuid=Maximus'));
                return {
                    ok: true,
                    status: 200,
                    json: async () => mockProfileData,
                } as any;
            };

            const result = await adapter.fetchProfile('https://www.naukri.com/code360/profile/Maximus');
            assert.equal(result.success, true);
            assert.equal(result.handle, 'Maximus');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns NOT_FOUND when API returns 404', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: false,
                status: 404,
                json: async () => ({ data: null, message: 'Not found' }),
            } as any);

            const result = await adapter.fetchProfile('nonexistent_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NOT_FOUND');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Returns RATE_LIMITED when API returns 429', async () => {
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

    test('Returns NETWORK_ERROR on fetch exception or abort', async () => {
        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => {
                const err = new Error('Connection refused');
                throw err;
            };

            const result = await adapter.fetchProfile('network_error_user');
            assert.equal(result.success, false);
            assert.equal(result.errorCode, 'NETWORK_ERROR');
        } finally {
            globalThis.fetch = originalFetch;
        }
    });

    test('Account-resolution status (fetchCode360) cannot independently grant ownership verification', async () => {
        const mockProfileData = {
            data: {
                uuid: 'sarthaksangwan',
                name: 'Sarthak Sangwan',
                image: 'https://files.codingninjas.in/avatar-1710924338.png',
                user_exp: 13870,
                user_level_name: 'Expert',
                followers_count: 1,
                dsa_domain_data: {
                    problem_count_data: {
                        total_count: 69,
                    },
                },
            },
        };

        const originalFetch = globalThis.fetch;
        try {
            globalThis.fetch = async () => ({
                ok: true,
                status: 200,
                json: async () => mockProfileData,
            } as any);

            const profile = await fetchCode360('sarthaksangwan');
            assert.ok(profile !== null);
            assert.equal(profile.success, true, 'Account existence must be true');
            assert.equal(
                profile.verified,
                false,
                'CRAWLER INVARIANT: Successful public profile resolution must strictly have verified = false'
            );
        } finally {
            globalThis.fetch = originalFetch;
        }
    });
});
