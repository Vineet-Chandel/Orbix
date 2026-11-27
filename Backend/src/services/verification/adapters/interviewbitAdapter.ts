/**
 * INTERVIEWBIT VERIFICATION ADAPTER
 * Official REST API profile inspector for InterviewBit accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class InterviewBitAdapter implements PlatformAdapter {
    public readonly portal = 'interviewbit';
    public readonly displayName = 'InterviewBit';
    public readonly defaultTargetField = 'bio';
    public readonly supportedTargetFields = ['bio'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_\-\.]{1,50}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid InterviewBit handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const profileUrl = `https://www.interviewbit.com/profile/${encodeURIComponent(cleanHandle)}/`;

            const res = await fetch(`https://www.interviewbit.com/v2/profile/username?id=${encodeURIComponent(cleanHandle)}`, {
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
                    errorMessage: `InterviewBit user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 403) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `InterviewBit user '${cleanHandle}' does not exist or profile is set to Private. Please ensure your profile is set to Public under Privacy Settings.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'InterviewBit API rate limit exceeded. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `InterviewBit API responded with HTTP ${res.status}`,
                };
            }

            const data = (await res.json()) as any;

            if (!data || (!data.username && !data.id && !data.name)) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `InterviewBit user '${cleanHandle}' not found.`,
                };
            }

            const bio = typeof data.bio === 'string' && data.bio.trim()
                ? data.bio.trim()
                : null;

            const targetFieldsContent: Record<string, string | null | undefined> = {
                bio,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: data,
            };
        } catch (err: any) {
            const isTimeout = err?.name === 'AbortError' || err?.code === 'ABORT_ERR';
            return {
                success: false,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {},
                errorCode: isTimeout ? 'RATE_LIMITED' : 'NETWORK_ERROR',
                errorMessage: isTimeout
                    ? 'InterviewBit API request timed out'
                    : (err?.message || 'Failed to connect to InterviewBit API'),
            };
        }
    }

    public extractCandidates(fetchResult: AdapterFetchResult, targetField?: string): string[] {
        if (!fetchResult.success || !fetchResult.targetFieldsContent) {
            return [];
        }

        const candidates: string[] = [];
        const fieldsToInspect = targetField
            ? [targetField]
            : this.supportedTargetFields;

        for (const field of fieldsToInspect) {
            const content = fetchResult.targetFieldsContent[field];
            if (content) {
                candidates.push(...extractChallengeCandidates(content));
            }
        }

        return Array.from(new Set(candidates));
    }

    public getInstructions(token: string, targetField: string = this.defaultTargetField, handle?: string): VerificationInstructions {
        const profileSettingsUrl = 'https://www.interviewbit.com/profile/settings/';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        return {
            fieldName,
            displayFieldName: 'Bio',
            instructions: `Open your InterviewBit Settings (${profileSettingsUrl}), locate the Bio field under Profile, enter or append '${token}', click Save, ensure your profile is set to Public under Privacy Settings, and return to Orbix to click Verify.`,
            profileSettingsUrl,
        };
    }
}
