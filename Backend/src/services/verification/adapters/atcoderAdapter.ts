/**
 * ATCODER VERIFICATION ADAPTER
 * Public profile HTML inspector for AtCoder accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

function decodeHtmlEntities(str: string): string {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

export class AtCoderAdapter implements PlatformAdapter {
    public readonly portal = 'atcoder';
    public readonly displayName = 'AtCoder';
    public readonly defaultTargetField = 'affiliation';
    public readonly supportedTargetFields = ['affiliation'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_]{2,30}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid AtCoder username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://atcoder.jp/users/${encodeURIComponent(cleanHandle)}`, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                    "Accept-Language": "en-US,en;q=0.9",
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
                    errorMessage: `AtCoder user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'AtCoder rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `AtCoder responded with HTTP ${res.status}`,
                };
            }

            const html = await res.text();

            if (html.includes('<title>404 Not Found') || html.includes('User not found')) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `AtCoder user '${cleanHandle}' does not exist.`,
                };
            }

            // Extract Affiliation / 所属 table row
            const affiliationMatch = html.match(
                /<th[^>]*class=["'][^"']*no-break[^"']*["'][^>]*>(?:Affiliation|所属)<\/th>\s*<td[^>]*class=["'][^"']*break-all[^"']*["'][^>]*>([\s\S]*?)<\/td>/i
            );

            let affiliation: string | null = null;
            if (affiliationMatch && affiliationMatch[1]) {
                const cleaned = decodeHtmlEntities(affiliationMatch[1].replace(/<[^>]+>/g, "").trim());
                if (cleaned) {
                    affiliation = cleaned;
                }
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                affiliation,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: {
                    handle: cleanHandle,
                    hasAffiliation: affiliation !== null,
                    htmlLength: html.length,
                },
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
                    ? 'AtCoder profile fetch timed out after 8000ms'
                    : (err?.message || 'Network error fetching AtCoder profile'),
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
            displayFieldName: 'Affiliation',
            instructions: `Temporarily set your Affiliation on AtCoder (https://atcoder.jp/settings) to '${token}', save changes, and click I've Updated My Profile.`,
            profileSettingsUrl: 'https://atcoder.jp/settings',
        };
    }
}
