/**
 * MEDIUM VERIFICATION ADAPTER
 * Public profile inspector for Medium accounts.
 * Inspects user's public profile (https://medium.com/@<handle>?format=json and HTML fallback)
 * to verify ownership via the editable 'Short bio' field.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class MediumAdapter implements PlatformAdapter {
    public readonly portal = 'medium';
    public readonly displayName = 'Medium';
    public readonly defaultTargetField = 'short_bio';
    public readonly supportedTargetFields = ['short_bio', 'bio'] as const;
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
                errorMessage: 'Empty or invalid Medium handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            let bio: string | null = null;
            let foundUser = false;

            // Strategy 1: Medium public JSON endpoint (?format=json)
            const jsonUrl = `https://medium.com/@${encodeURIComponent(cleanHandle)}?format=json`;
            const jsonRes = await fetch(jsonUrl, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                signal: controller.signal,
            });

            if (jsonRes.status === 404) {
                clearTimeout(timeoutId);
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Medium user '@${cleanHandle}' does not exist.`,
                };
            }

            if (jsonRes.status === 429) {
                clearTimeout(timeoutId);
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Medium rate limit exceeded. Please retry in a few moments.',
                };
            }

            if (jsonRes.ok) {
                const text = await jsonRes.text();
                // Medium prefixes JSON responses with "])}while(1);</x>" to prevent script inclusion
                const cleanJson = text.replace(/^\]\)\}\s*while\s*\(\s*1\s*\)\s*;\s*<\s*\/\s*x\s*>/i, '').trim();
                try {
                    const data = JSON.parse(cleanJson);
                    const user = data?.payload?.user;
                    if (user && typeof user === 'object') {
                        foundUser = true;
                        if (typeof user.bio === 'string' && user.bio.trim()) {
                            bio = user.bio.trim();
                        }
                    }
                } catch {
                    // JSON parsing failed, fallback to HTML below
                }
            }

            // Strategy 2: If bio was not resolved or JSON was not ok, fallback to profile HTML
            if (!foundUser) {
                const htmlUrl = `https://medium.com/@${encodeURIComponent(cleanHandle)}`;
                const htmlRes = await fetch(htmlUrl, {
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    signal: controller.signal,
                });

                if (htmlRes.status === 404) {
                    clearTimeout(timeoutId);
                    return {
                        success: false,
                        portal: this.portal,
                        handle: cleanHandle,
                        targetFieldsContent: {},
                        errorCode: 'NOT_FOUND',
                        errorMessage: `Medium user '@${cleanHandle}' does not exist.`,
                    };
                }

                if (htmlRes.status === 429) {
                    clearTimeout(timeoutId);
                    return {
                        success: false,
                        portal: this.portal,
                        handle: cleanHandle,
                        targetFieldsContent: {},
                        errorCode: 'RATE_LIMITED',
                        errorMessage: 'Medium rate limit exceeded. Please retry in a few moments.',
                    };
                }

                if (htmlRes.ok) {
                    const html = await htmlRes.text();

                    // Parse JSON-LD Person schema
                    const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.*?)<\/script>/is);
                    if (jsonLdMatch && jsonLdMatch[1]) {
                        try {
                            const parsed = JSON.parse(jsonLdMatch[1]);
                            if (parsed && typeof parsed === 'object') {
                                foundUser = true;
                                if (typeof parsed.description === 'string' && parsed.description.trim()) {
                                    bio = parsed.description.trim();
                                }
                            }
                        } catch {}
                    }

                    // Parse Apollo state if bio not found in JSON-LD
                    if (!bio) {
                        const apolloMatch = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{.*?\});/s);
                        if (apolloMatch && apolloMatch[1]) {
                            try {
                                const state = JSON.parse(apolloMatch[1]);
                                const userKey = Object.keys(state).find(k => k.startsWith('User:'));
                                if (userKey && state[userKey]) {
                                    foundUser = true;
                                    if (typeof state[userKey].bio === 'string' && state[userKey].bio.trim()) {
                                        bio = state[userKey].bio.trim();
                                    }
                                }
                            } catch {}
                        }
                    }

                    // Parse OpenGraph description fallback
                    if (!bio) {
                        const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
                        if (ogDescMatch && ogDescMatch[1] && ogDescMatch[1].trim()) {
                            foundUser = true;
                            const desc = ogDescMatch[1].trim();
                            const prefixMatch = desc.match(/^Read writing from .*? on Medium\.\s*(.*)$/i);
                            bio = prefixMatch && prefixMatch[1] ? prefixMatch[1].trim() : desc;
                        }
                    }
                }
            }

            clearTimeout(timeoutId);

            if (!foundUser && !bio) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Medium user '@${cleanHandle}' not found.`,
                };
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                short_bio: bio,
                bio,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: { handle: cleanHandle, short_bio: bio },
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
                    ? 'Medium request timed out'
                    : (err?.message || 'Failed to connect to Medium'),
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
            // Strictly NEVER extract candidates from display name
            if (field === 'name' || field === 'displayName') {
                continue;
            }
            const content = fetchResult.targetFieldsContent[field];
            if (content) {
                candidates.push(...extractChallengeCandidates(content));
            }
        }

        return Array.from(new Set(candidates));
    }

    public getInstructions(token: string, targetField: string = this.defaultTargetField, _handle?: string): VerificationInstructions {
        const profileSettingsUrl = 'https://medium.com/me/settings/account';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        return {
            fieldName,
            displayFieldName: 'Short bio',
            instructions: `Open your Medium Settings (${profileSettingsUrl}), select Profile information, locate the Short bio field, enter or paste '${token}', click Save, return to Orbix, and click Verify.`,
            profileSettingsUrl,
        };
    }
}
