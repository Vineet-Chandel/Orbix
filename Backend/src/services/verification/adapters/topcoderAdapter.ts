/**
 * TOPCODER VERIFICATION ADAPTER
 * Official REST API profile inspector for TopCoder accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class TopCoderAdapter implements PlatformAdapter {
    public readonly portal = 'topcoder';
    public readonly displayName = 'TopCoder';
    public readonly defaultTargetField = 'description';
    public readonly supportedTargetFields = ['description'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_\-\.]{2,40}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid TopCoder handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://api.topcoder.com/v6/members?handle=${encodeURIComponent(cleanHandle)}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json",
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
                    errorMessage: `TopCoder user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'TopCoder API rate limit exceeded. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `TopCoder API responded with HTTP ${res.status}`,
                };
            }

            const data = (await res.json()) as any;

            if (!Array.isArray(data) || data.length === 0) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `TopCoder user '${cleanHandle}' does not exist.`,
                };
            }

            const user = data[0];
            if (!user || typeof user.handle !== 'string' || user.handle.toLowerCase() !== cleanHandle.toLowerCase()) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `TopCoder user '${cleanHandle}' not found.`,
                };
            }

            const description = typeof user.description === 'string' && user.description.trim()
                ? user.description.trim()
                : null;

            const targetFieldsContent: Record<string, string | null | undefined> = {
                description,
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
                    ? 'TopCoder API request timed out'
                    : (err?.message || 'Failed to connect to TopCoder API'),
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
            displayFieldName: 'Short Bio',
            instructions: `Temporarily set your Short Bio on TopCoder (https://www.topcoder.com/settings/profile) to '${token}', save changes, and click I've Updated My Profile.`,
            profileSettingsUrl: 'https://www.topcoder.com/settings/profile',
        };
    }
}
