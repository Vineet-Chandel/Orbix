/**
 * HACKEREARTH VERIFICATION ADAPTER
 * Public profile Next.js RSC flight stream inspector for HackerEarth developer accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

interface HackerEarthProfileData {
    username: string;
    miniresume: string;
    location: string;
    full_name: string;
    website: string;
    blog: string;
    github: string;
    linkedin: string;
    twitter: string;
}

function extractHackerEarthFromFlight(unescapedFlight: string, cleanHandle: string): HackerEarthProfileData | null {
    const profileDataIdx = unescapedFlight.indexOf('"profileData":');
    if (profileDataIdx === -1) {
        return null;
    }

    // Verify handle attribution from routing metadata, og tags, or username prop
    const lowerHandle = cleanHandle.toLowerCase();
    const isAttributed =
        unescapedFlight.toLowerCase().includes(`community/profile/${lowerHandle}/opengraph-image`) ||
        unescapedFlight.toLowerCase().includes(`property="og:url" content="https://www.hackerearth.com/@${lowerHandle}`) ||
        unescapedFlight.toLowerCase().includes(`"k":"${lowerHandle}"`) ||
        unescapedFlight.toLowerCase().includes(`"username":"${lowerHandle}"`) ||
        unescapedFlight.toLowerCase().includes(`/@${lowerHandle}`);

    if (!isAttributed) {
        return null;
    }

    // Extract profileData object using balanced braces
    const startObjIdx = unescapedFlight.indexOf('{', profileDataIdx);
    if (startObjIdx === -1) {
        return null;
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    let endObjIdx = -1;

    for (let i = startObjIdx; i < unescapedFlight.length; i++) {
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
                    endObjIdx = i + 1;
                    break;
                }
            }
        }
    }

    if (endObjIdx !== -1) {
        try {
            const parsed = JSON.parse(unescapedFlight.slice(startObjIdx, endObjIdx));
            if (parsed && typeof parsed === 'object') {
                return {
                    username: cleanHandle,
                    miniresume: typeof parsed.miniresume === 'string' ? parsed.miniresume : '',
                    location: typeof parsed.location === 'string' ? parsed.location : '',
                    full_name: typeof parsed.full_name === 'string' ? parsed.full_name : '',
                    website: typeof parsed.website === 'string' ? parsed.website : '',
                    blog: typeof parsed.blog === 'string' ? parsed.blog : '',
                    github: typeof parsed.github === 'string' ? parsed.github : '',
                    linkedin: typeof parsed.linkedin === 'string' ? parsed.linkedin : '',
                    twitter: typeof parsed.twitter === 'string' ? parsed.twitter : '',
                };
            }
        } catch {
            // Fall back to regex extraction below if JSON.parse fails
        }
    }

    // Fallback regex extraction
    const section = unescapedFlight.slice(profileDataIdx, profileDataIdx + 5000);
    const miniresumeMatch = section.match(/"miniresume"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const locationMatch = section.match(/"location"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const fullNameMatch = section.match(/"full_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    const unescapeJsonString = (str: string): string => {
        try {
            return JSON.parse(`"${str}"`);
        } catch {
            return str.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
    };

    return {
        username: cleanHandle,
        miniresume: miniresumeMatch ? unescapeJsonString(miniresumeMatch[1]) : '',
        location: locationMatch ? unescapeJsonString(locationMatch[1]) : '',
        full_name: fullNameMatch ? unescapeJsonString(fullNameMatch[1]) : '',
        website: '',
        blog: '',
        github: '',
        linkedin: '',
        twitter: '',
    };
}

export class HackerEarthAdapter implements PlatformAdapter {
    public readonly portal = 'hackerearth' as any;
    public readonly displayName = 'HackerEarth';
    public readonly defaultTargetField = 'bio';
    public readonly supportedTargetFields = ['bio', 'location'] as const;
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
                errorMessage: 'Empty or invalid HackerEarth username',
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://www.hackerearth.com/@${encodeURIComponent(cleanHandle)}/`, {
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
                    errorMessage: `HackerEarth user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'HackerEarth rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `HackerEarth responded with HTTP ${res.status}`,
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

            // Detect valid profileData presence
            if (!unescapedFlight.includes('"profileData":')) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `HackerEarth user '${cleanHandle}' does not exist.`,
                };
            }

            const profileData = extractHackerEarthFromFlight(unescapedFlight, cleanHandle);
            if (!profileData) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `HackerEarth profile for '${cleanHandle}' not found or handle does not match.`,
                };
            }

            const targetFieldsContent: Record<string, string | null | undefined> = {
                bio: profileData.miniresume,
                location: profileData.location,
                full_name: profileData.full_name,
                website: profileData.website,
                blog: profileData.blog,
                github: profileData.github,
                linkedin: profileData.linkedin,
                twitter: profileData.twitter,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: {
                    handle: profileData.username,
                    hasBio: Boolean(profileData.miniresume),
                    hasLocation: Boolean(profileData.location),
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
                    ? 'HackerEarth profile fetch timed out after 8000ms'
                    : (err?.message || 'Network error fetching HackerEarth profile'),
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
        const cleanUser = handle ? handle.trim().replace(/^@+/, '') : '';
        const profileSettingsUrl = cleanUser
            ? `https://www.hackerearth.com/@${encodeURIComponent(cleanUser)}/`
            : 'https://www.hackerearth.com/';
        const fieldName = this.supportedTargetFields.includes(targetField as any) ? targetField : this.defaultTargetField;
        const displayFieldName = fieldName === 'location' ? 'Location' : 'Bio';

        return {
            fieldName,
            displayFieldName,
            instructions: `Open your HackerEarth profile (${profileSettingsUrl}), click the Edit Profile icon to open Settings, paste '${token}' into your ${displayFieldName} field under the Profile tab, click Save Changes, and return to Orbix to verify.`,
            profileSettingsUrl,
        };
    }
}
