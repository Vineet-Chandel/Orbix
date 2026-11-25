/**
 * CODECHEF VERIFICATION ADAPTER
 * Public profile HTML inspector for CodeChef accounts.
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

export class CodeChefAdapter implements PlatformAdapter {
    public readonly portal = 'codechef';
    public readonly displayName = 'CodeChef';
    public readonly defaultTargetField = 'highest_degree';
    public readonly supportedTargetFields = ['highest_degree'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_]{3,30}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid CodeChef username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(cleanHandle)}`, {
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
                    errorMessage: `CodeChef user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'CodeChef rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `CodeChef responded with HTTP ${res.status}`,
                };
            }

            const html = await res.text();

            // When a user does not exist, CodeChef redirects to or renders the general landing page without user details
            if (!html.includes('user-details') || /<title>\s*CodeChef - Learn and Practice Coding/i.test(html)) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `CodeChef user '${cleanHandle}' does not exist.`,
                };
            }

            // Extract Highest Degree Earned from profile HTML
            // Supports <label>Highest Degree Earned:</label>, <label>Highest Degree:</label>, <label>Degree:</label>
            const degreeMatch = html.match(
                /<label[^>]*>\s*(?:Highest\s+Degree(?:\s+Earned)?|Degree)\s*:\s*<\/label>\s*(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>|<\/li>)/i
            );

            let highestDegree: string | null = null;
            if (degreeMatch && degreeMatch[1]) {
                const cleaned = decodeHtmlEntities(degreeMatch[1].replace(/<[^>]+>/g, "").trim());
                if (cleaned && cleaned.toLowerCase() !== 'na' && cleaned.toLowerCase() !== 'none') {
                    highestDegree = cleaned;
                }
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                highest_degree: highestDegree,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: {
                    handle: cleanHandle,
                    hasHighestDegree: highestDegree !== null,
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
                    ? 'CodeChef profile fetch timed out after 8000ms'
                    : (err?.message || 'Network error fetching CodeChef profile'),
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
        const cleanHandle = (handle || "").trim().replace(/^@+/, "");
        const profileSettingsUrl = cleanHandle
            ? `https://www.codechef.com/users/${encodeURIComponent(cleanHandle)}/edit`
            : 'https://www.codechef.com/';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        return {
            fieldName,
            displayFieldName: 'Highest Degree Earned',
            instructions: `Open your CodeChef profile editor (${profileSettingsUrl}), navigate to the Professional section, enter or append '${token}' into the Highest Degree Earned field, save changes, and click Verify.`,
            profileSettingsUrl,
        };
    }
}
