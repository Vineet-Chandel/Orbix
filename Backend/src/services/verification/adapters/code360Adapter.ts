/**
 * NAUKRI CODE360 VERIFICATION ADAPTER
 * Official REST API profile inspector for Naukri Code360 (formerly Coding Ninjas Studio).
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class Code360Adapter implements PlatformAdapter {
    public readonly portal = 'code360';
    public readonly displayName = 'Naukri Code360';
    public readonly defaultTargetField = 'about';
    public readonly supportedTargetFields = ['about', 'name'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        let cleanHandle = handle.trim().replace(/^@+/, "");
        if (cleanHandle.includes("naukri.com") || cleanHandle.includes("codingninjas.com")) {
            const match =
                cleanHandle.match(/(?:code360|codestudio)\/profile\/([a-zA-Z0-9_\.\-]+)/i) ||
                cleanHandle.match(/(?:profile|users?)\/([a-zA-Z0-9_\.\-]+)/i);
            if (match && match[1]) cleanHandle = match[1];
        }
        cleanHandle = (cleanHandle.replace(/\/+$/, "").split("/")[0] || "").split("?")[0]?.trim() || "";

        if (!cleanHandle || !/^[a-zA-Z0-9_\.\-]{3,60}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid Naukri Code360 handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const profileUrl = `https://www.naukri.com/code360/profile/${encodeURIComponent(cleanHandle)}`;

            const res = await fetch(`https://www.naukri.com/code360/api/v3/public_section/profile/user_details?uuid=${encodeURIComponent(cleanHandle)}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Referer": profileUrl,
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.status === 404) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Naukri Code360 user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Naukri Code360 API rate limit exceeded. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `Naukri Code360 API responded with HTTP ${res.status}`,
                };
            }

            const json = (await res.json()) as any;
            const data = json?.data;

            if (!data || (!data.name && !data.uuid)) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Naukri Code360 user '${cleanHandle}' not found.`,
                };
            }

            const rawName = typeof data.name === 'string' ? data.name : '';
            const rawAbout = typeof data.about === 'string'
                ? data.about
                : (typeof data.profile?.summary === 'string' ? data.profile.summary : '');

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {
                    name: rawName.trim() || undefined,
                    about: rawAbout.trim() || undefined,
                },
                rawProfile: {
                    profileUrl,
                    name: rawName,
                    username: data.uuid || cleanHandle,
                    about: rawAbout,
                    avatar: data.image,
                    solved: data.dsa_domain_data?.problem_count_data?.total_count,
                    exp: data.user_exp,
                    level: data.user_level_name,
                },
            };
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: 'Request to Naukri Code360 timed out after 8 seconds.',
                };
            }

            return {
                success: false,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {},
                errorCode: 'NETWORK_ERROR',
                errorMessage: `Failed to connect to Naukri Code360: ${error?.message || 'Unknown network error'}`,
            };
        }
    }

    public extractCandidates(fetchResult: AdapterFetchResult, targetField?: string): string[] {
        const field = targetField || this.defaultTargetField;
        const content = fetchResult.targetFieldsContent[field];

        if (!content) {
            // Fallback: check all available fields in targetFieldsContent
            const allCandidates: string[] = [];
            for (const val of Object.values(fetchResult.targetFieldsContent)) {
                if (val) {
                    allCandidates.push(...extractChallengeCandidates(val));
                }
            }
            return allCandidates;
        }

        const candidates = extractChallengeCandidates(content);
        if (candidates.length === 0) {
            for (const [key, val] of Object.entries(fetchResult.targetFieldsContent)) {
                if (key !== field && val) {
                    candidates.push(...extractChallengeCandidates(val));
                }
            }
        }
        return candidates;
    }

    public getInstructions(token: string, targetField?: string, _handle?: string): VerificationInstructions {
        const field = targetField === 'name' ? 'name' : 'about';

        if (field === 'name') {
            return {
                fieldName: 'name',
                displayFieldName: 'Name',
                profileSettingsUrl: 'https://www.naukri.com/code360/profile/edit',
                instructions: `To verify ownership of your Naukri Code360 account:
1. Log in to your Naukri Code360 account.
2. Go to your Profile Edit settings at https://www.naukri.com/code360/profile/edit
3. Under the "Personal info" tab, locate the "Name" field.
4. Temporarily paste or append your verification code: ${token}
5. Click "Save changes".
6. Return to Orbix and click "Verify Ownership".
7. You may restore your original display name once verified.`,
            };
        }

        return {
            fieldName: 'about',
            displayFieldName: 'About you (Bio)',
            profileSettingsUrl: 'https://www.naukri.com/code360/profile/edit',
            instructions: `To verify ownership of your Naukri Code360 account:
1. Log in to your Naukri Code360 account.
2. Go to your Profile Edit settings at https://www.naukri.com/code360/profile/edit
3. Click the "Additional info" tab in the left sidebar.
4. Locate the "About you" (Bio) textarea.
5. Temporarily paste your verification code: ${token}
6. Click "Save changes".
7. Return to Orbix and click "Verify Ownership".
8. You may restore your original bio once verified.`,
        };
    }
}
