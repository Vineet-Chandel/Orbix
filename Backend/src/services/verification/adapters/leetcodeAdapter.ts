/**
 * LEETCODE VERIFICATION ADAPTER
 * Public GraphQL profile inspector for LeetCode accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class LeetCodeAdapter implements PlatformAdapter {
    public readonly portal = 'leetcode';
    public readonly displayName = 'LeetCode';
    public readonly defaultTargetField = 'aboutMe';
    public readonly supportedTargetFields = ['aboutMe'] as const;
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
                errorMessage: 'Empty or invalid LeetCode username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                },
                body: JSON.stringify({
                    query: `query userPublicProfile($username: String!) {
                        matchedUser(username: $username) {
                            username
                            profile {
                                realName
                                aboutMe
                                userAvatar
                                ranking
                            }
                        }
                    }`,
                    variables: { username: cleanHandle },
                }),
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
                    errorMessage: 'LeetCode API rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `LeetCode API responded with HTTP ${res.status}`,
                };
            }

            const data = (await res.json()) as any;

            if (data?.errors && !data?.data?.matchedUser) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'INVALID_RESPONSE',
                    errorMessage: data.errors[0]?.message || 'GraphQL error returned by LeetCode',
                };
            }

            const matchedUser = data?.data?.matchedUser;
            if (!matchedUser) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `LeetCode user '${cleanHandle}' does not exist or profile is private.`,
                };
            }

            const profile = matchedUser.profile || {};
            const targetFieldsContent: Record<string, string | null | undefined> = {
                aboutMe: typeof profile.aboutMe === 'string' ? profile.aboutMe : null,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: matchedUser,
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
                    ? 'LeetCode API request timed out'
                    : (err?.message || 'Failed to connect to LeetCode API'),
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
        return {
            fieldName: 'aboutMe',
            displayFieldName: 'About Me / Summary',
            instructions: `Temporarily paste the code '${token}' into your LeetCode About Me / Summary section, save your profile, and click Confirm.`,
            profileSettingsUrl: 'https://leetcode.com/profile/',
        };
    }
}
