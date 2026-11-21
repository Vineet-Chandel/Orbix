/**
 * CODEFORCES VERIFICATION ADAPTER
 * Official REST API profile inspector for Codeforces accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class CodeforcesAdapter implements PlatformAdapter {
    public readonly portal = 'codeforces';
    public readonly displayName = 'Codeforces';
    public readonly defaultTargetField = 'organization';
    public readonly supportedTargetFields = ['organization'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim();
        if (!cleanHandle) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid Codeforces handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(cleanHandle)}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Codeforces API call limit exceeded. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `Codeforces API responded with HTTP ${res.status}`,
                };
            }

            const data = (await res.json()) as any;

            if (data?.status === "FAILED") {
                const comment = String(data?.comment || "");
                if (comment.toLowerCase().includes("not found")) {
                    return {
                        success: false,
                        portal: this.portal,
                        handle: cleanHandle,
                        targetFieldsContent: {},
                        errorCode: 'NOT_FOUND',
                        errorMessage: `Codeforces handle '${cleanHandle}' does not exist.`,
                    };
                }
                if (comment.toLowerCase().includes("limit exceeded")) {
                    return {
                        success: false,
                        portal: this.portal,
                        handle: cleanHandle,
                        targetFieldsContent: {},
                        errorCode: 'RATE_LIMITED',
                        errorMessage: 'Codeforces API rate limit exceeded.',
                    };
                }
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'INVALID_RESPONSE',
                    errorMessage: comment || 'Codeforces API returned an error',
                };
            }

            const user = data?.result?.[0];
            if (!user) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Codeforces user '${cleanHandle}' not found.`,
                };
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                organization: typeof user.organization === 'string' ? user.organization : null,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: user,
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
                    ? 'Codeforces API request timed out'
                    : (err?.message || 'Failed to connect to Codeforces API'),
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

    public getInstructions(token: string, targetField: string = this.defaultTargetField): VerificationInstructions {
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        return {
            fieldName,
            displayFieldName: fieldName === 'organization' ? 'Organization' : fieldName,
            instructions: `Temporarily set your ${fieldName} on Codeforces (https://codeforces.com/settings/social) to '${token}', save changes, and click Confirm.`,
            profileSettingsUrl: 'https://codeforces.com/settings/social',
        };
    }
}
