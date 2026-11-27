/**
 * SUBSTACK VERIFICATION ADAPTER
 * Public profile HTML and JSON-LD schema inspector for Substack accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class SubstackAdapter implements PlatformAdapter {
    public readonly portal = 'substack';
    public readonly displayName = 'Substack';
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
                errorMessage: 'Empty or invalid Substack handle',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const profileUrl = `https://substack.com/@${encodeURIComponent(cleanHandle)}`;

            const res = await fetch(profileUrl, {
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
                    errorMessage: `Substack user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Substack rate limit exceeded. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `Substack responded with HTTP ${res.status}`,
                };
            }

            const html = await res.text();
            if (!html) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Substack user '${cleanHandle}' not found.`,
                };
            }

            // Check for non-existent account indicators
            if (html.includes('name="robots" content="noindex"') && html.includes('property="og:title" content="Search')) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Substack user '${cleanHandle}' does not exist.`,
                };
            }

            let description: string | null = null;
            let foundPerson = false;

            // Parse JSON-LD metadata for Person schema
            const jsonLdMatches = html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gis);
            for (const match of jsonLdMatches) {
                try {
                    const parsed = JSON.parse(match[1]);
                    if (parsed && typeof parsed === "object") {
                        const person = parsed["@type"] === "Person"
                            ? parsed
                            : (Array.isArray(parsed["@graph"]) ? parsed["@graph"].find((item: any) => item["@type"] === "Person") : null);

                        if (person) {
                            foundPerson = true;
                            if (typeof person.description === "string" && person.description.trim()) {
                                description = person.description.trim();
                            }
                            break;
                        }
                    }
                } catch {
                    // Ignore JSON parse errors for unrelated JSON-LD blocks
                }
            }

            // Fallback to meta tags if description was not in JSON-LD
            if (!description) {
                const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["'](.*?)["']/i);
                if (ogDescMatch && ogDescMatch[1] && ogDescMatch[1].trim()) {
                    description = ogDescMatch[1].trim();
                } else {
                    const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i);
                    if (metaDescMatch && metaDescMatch[1] && metaDescMatch[1].trim()) {
                        description = metaDescMatch[1].trim();
                    }
                }
            }

            // If neither Person schema nor profile OpenGraph tags are found, user does not exist
            const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["'](.*?)["']/i);
            if (!foundPerson && (!ogTitleMatch || ogTitleMatch[1]?.startsWith("Search "))) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Substack user '${cleanHandle}' not found.`,
                };
            }

            const bio = description && description.trim() ? description.trim() : null;

            const targetFieldsContent: Record<string, string | null | undefined> = {
                bio,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: { handle: cleanHandle, bio },
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
                    ? 'Substack request timed out'
                    : (err?.message || 'Failed to connect to Substack'),
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
        const profileSettingsUrl = 'https://substack.com/profile/edit';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        return {
            fieldName,
            displayFieldName: 'Bio',
            instructions: `Open your Substack profile editor (${profileSettingsUrl}), locate the Bio field, enter or append '${token}', click Save, and return to Orbix to click Verify.`,
            profileSettingsUrl,
        };
    }
}
