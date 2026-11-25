/**
 * GEEKSFORGEEKS VERIFICATION ADAPTER
 * Public profile Next.js RSC flight inspector for GeeksforGeeks accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

interface MentorProfileData {
    handle: string;
    bio: string;
    headline: string;
}

function extractMentorFromFlight(unescapedFlight: string, cleanHandle: string): MentorProfileData | null {
    const mentorIndex = unescapedFlight.indexOf('{"mentor":');
    if (mentorIndex === -1) {
        return null;
    }

    // Attempt standard balanced-brace extraction of the {"mentor": ...} JSON block
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;

    for (let i = mentorIndex; i < unescapedFlight.length; i++) {
        const char = unescapedFlight[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (char === '\\') {
            escape = true;
            continue;
        }

        if (char === '"') {
            inString = !inString;
            continue;
        }

        if (!inString) {
            if (char === '{') {
                depth++;
            } else if (char === '}') {
                depth--;
                if (depth === 0) {
                    endIndex = i + 1;
                    break;
                }
            }
        }
    }

    if (endIndex !== -1) {
        try {
            const parsed = JSON.parse(unescapedFlight.slice(mentorIndex, endIndex));
            if (parsed && parsed.mentor && typeof parsed.mentor === 'object') {
                const mentor = parsed.mentor;
                if (
                    typeof mentor.handle === 'string' &&
                    mentor.handle.toLowerCase() === cleanHandle.toLowerCase()
                ) {
                    return {
                        handle: mentor.handle,
                        bio: typeof mentor.bio === 'string' ? mentor.bio : '',
                        headline: typeof mentor.headline === 'string' ? mentor.headline : '',
                    };
                }
            }
        } catch {
            // Fall back to regex extraction if JSON.parse fails on unescaped fragment
        }
    }

    // Regex fallback for non-standard or truncated chunks
    const mentorSection = unescapedFlight.slice(mentorIndex, mentorIndex + 5000);
    const handleMatch = mentorSection.match(/"handle"\s*:\s*"([^"]+)"/i);
    if (!handleMatch || handleMatch[1].toLowerCase() !== cleanHandle.toLowerCase()) {
        return null;
    }

    const bioMatch = mentorSection.match(/"bio"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const headlineMatch = mentorSection.match(/"headline"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    const unescapeJsonString = (str: string): string => {
        try {
            return JSON.parse(`"${str}"`);
        } catch {
            return str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    };

    return {
        handle: handleMatch[1],
        bio: bioMatch ? unescapeJsonString(bioMatch[1]) : '',
        headline: headlineMatch ? unescapeJsonString(headlineMatch[1]) : '',
    };
}

export class GeeksforGeeksAdapter implements PlatformAdapter {
    public readonly portal = 'geeksforgeeks';
    public readonly displayName = 'GeeksforGeeks';
    public readonly defaultTargetField = 'bio';
    public readonly supportedTargetFields = ['bio', 'headline'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_\-.]{2,50}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid GeeksforGeeks username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://www.geeksforgeeks.org/user/${encodeURIComponent(cleanHandle)}/`, {
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
                    errorMessage: `GeeksforGeeks user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'GeeksforGeeks rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `GeeksforGeeks responded with HTTP ${res.status}`,
                };
            }

            const html = await res.text();

            // Extract Next.js RSC flight chunks: self.__next_f.push([1,"..."])
            const flightRegex = /self\.__next_f\.push\(\[\s*\d+\s*,\s*"((?:[^"\\]|\\.)*)"\s*\]\)/g;
            let flightMatch: RegExpExecArray | null;
            let fullFlight = '';
            while ((flightMatch = flightRegex.exec(html)) !== null) {
                fullFlight += flightMatch[1];
            }

            const unescapedFlight = fullFlight.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

            // Detect non-existent profiles
            if (!unescapedFlight.includes('{"mentor":')) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `GeeksforGeeks user '${cleanHandle}' does not exist.`,
                };
            }

            const mentorData = extractMentorFromFlight(unescapedFlight, cleanHandle);
            if (!mentorData) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `GeeksforGeeks profile for '${cleanHandle}' not found or handle does not match.`,
                };
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                bio: mentorData.bio,
                headline: mentorData.headline,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: {
                    handle: mentorData.handle,
                    hasBio: Boolean(mentorData.bio),
                    hasHeadline: Boolean(mentorData.headline),
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
                    ? 'GeeksforGeeks profile fetch timed out after 8000ms'
                    : (err?.message || 'Network error fetching GeeksforGeeks profile'),
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

    public getInstructions(token: string, targetField: string = this.defaultTargetField, _handle?: string): VerificationInstructions {
        const profileSettingsUrl = 'https://www.geeksforgeeks.org/profile/edit';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        const displayFieldName = fieldName === 'headline' ? 'Headline' : 'About/Bio';

        return {
            fieldName,
            displayFieldName,
            instructions: `Open your GeeksforGeeks profile edit page (${profileSettingsUrl}), paste '${token}' into either your ${displayFieldName} (or Headline), save changes, and return to Orbix to verify.`,
            profileSettingsUrl,
        };
    }
}
