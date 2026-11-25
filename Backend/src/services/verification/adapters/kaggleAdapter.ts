/**
 * KAGGLE VERIFICATION ADAPTER
 * Public profile HTML/metadata inspector for Kaggle accounts.
 */

import type { PlatformAdapter, AdapterFetchResult, VerificationInstructions } from "./adapterInterface.js";
import { extractChallengeCandidates } from "../challengeCryptoService.js";

export class KaggleAdapter implements PlatformAdapter {
    public readonly portal = 'kaggle';
    public readonly displayName = 'Kaggle';
    public readonly defaultTargetField = 'bio';
    public readonly supportedTargetFields = ['bio'] as const;
    public readonly supportsChallengeVerification = true;
    public readonly supportsOAuthVerification = false;

    public async fetchProfile(handle: string): Promise<AdapterFetchResult> {
        const cleanHandle = handle.trim().replace(/^@+/, "");
        if (!cleanHandle || !/^[a-zA-Z0-9_\-]{3,30}$/.test(cleanHandle)) {
            return {
                success: false,
                portal: this.portal,
                handle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: 'Empty or invalid Kaggle username',
            };
        }

        // Filter out reserved system routes
        const reservedRoutes = new Set([
            "competitions", "datasets", "code", "models", "discussion", "discussions",
            "learn", "messages", "rankings", "organizations", "docs", "progression",
            "terms", "privacy", "contact", "about", "account", "work", "community",
            "search", "api", "certification", "compliance"
        ]);
        if (reservedRoutes.has(cleanHandle.toLowerCase())) {
            return {
                success: false,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {},
                errorCode: 'NOT_FOUND',
                errorMessage: `Kaggle identifier '${cleanHandle}' is a reserved platform route, not a user account.`,
            };
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);

            const res = await fetch(`https://www.kaggle.com/${encodeURIComponent(cleanHandle)}`, {
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
                    errorMessage: `Kaggle user '${cleanHandle}' does not exist.`,
                };
            }

            if (res.status === 429) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'RATE_LIMITED',
                    errorMessage: 'Kaggle rate limit encountered. Please retry in a few moments.',
                };
            }

            if (!res.ok) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: `Kaggle responded with HTTP ${res.status}`,
                };
            }

            const html = await res.text();

            if (
                html.includes("<title>Page Not Found | Kaggle</title>") ||
                html.includes("<h1>Page Not Found</h1>") ||
                html.includes("User not found") ||
                html.includes("404 Not Found")
            ) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NOT_FOUND',
                    errorMessage: `Kaggle profile '${cleanHandle}' not found or deleted.`,
                };
            }

            // Detect Google reCAPTCHA Enterprise / Cloudflare bot protection gates
            if (
                html.includes("RecaptchaChallengePageUi") ||
                html.includes("recaptcha/challengepage") ||
                html.includes("g-recaptcha") ||
                html.includes("Checking your browser before accessing www.kaggle.com")
            ) {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: 'Kaggle automated bot protection challenge encountered.',
                };
            }

            // Extract Bio from multiple authoritative locations:
            // 1. Open Graph description (og:description)
            // 2. Meta description (meta[name="description"])
            // 3. Embedded JSON-LD (application/ld+json Schema.org Person description)
            // 4. Embedded state/JSON ("userBio", "bio", or "description")
            // 5. DOM bio containers
            const bioPieces: string[] = [];

            // 1. Open Graph description
            const ogDescMatch =
                html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:description["']/i);
            if (ogDescMatch && ogDescMatch[1]) {
                const ogContent = ogDescMatch[1].trim();
                if (ogContent) {
                    bioPieces.push(ogContent);
                }
            }

            // 2. Meta description
            const metaDescMatch =
                html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
            if (metaDescMatch && metaDescMatch[1]) {
                const mContent = metaDescMatch[1].trim();
                if (mContent && !bioPieces.includes(mContent)) {
                    bioPieces.push(mContent);
                }
            }

            // 3. JSON-LD Person description
            try {
                const jsonLdRegex = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
                let jsonLdMatch;
                while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
                    const parsed = JSON.parse(jsonLdMatch[1] || "{}");
                    if (parsed.description && typeof parsed.description === "string") {
                        const desc = parsed.description.trim();
                        if (desc && !bioPieces.includes(desc)) {
                            bioPieces.push(desc);
                        }
                    }
                }
            } catch {
                // Non-fatal parse error
            }

            // 4. Embedded JSON state matching "userBio" or "bio"
            const jsonBioMatch =
                html.match(/["'](?:userBio|bio)["']\s*:\s*"((?:[^"\\]|\\.)*)"/i) ||
                html.match(/["']description["']\s*:\s*"((?:[^"\\]|\\.)*)"/i);
            if (jsonBioMatch && jsonBioMatch[1]) {
                try {
                    const unescaped = JSON.parse(`"${jsonBioMatch[1]}"`);
                    if (unescaped && typeof unescaped === "string" && !bioPieces.includes(unescaped)) {
                        bioPieces.push(unescaped);
                    }
                } catch {
                    const raw = jsonBioMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                    if (raw && !bioPieces.includes(raw)) {
                        bioPieces.push(raw);
                    }
                }
            }

            // 5. DOM bio containers
            const domBioMatch =
                html.match(/<(?:div|p|span)[^>]*class=["'][^"']*(?:user-bio|profile-bio|bio-text)[^"']*["'][^>]*>([\s\S]*?)<\/(?:div|p|span)>/i);
            if (domBioMatch && domBioMatch[1]) {
                const cleanedText = domBioMatch[1].replace(/<[^>]+>/g, "").trim();
                if (cleanedText && !bioPieces.includes(cleanedText)) {
                    bioPieces.push(cleanedText);
                }
            }

            const combinedBio = bioPieces.length > 0 ? bioPieces.join("\n") : null;

            const targetFieldsContent: Record<string, string | null | undefined> = {
                bio: combinedBio,
            };

            return {
                success: true,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent,
                rawProfile: {
                    handle: cleanHandle,
                    bioSourcesFound: bioPieces.length,
                    htmlLength: html.length,
                },
            };
        } catch (err: any) {
            if (err.name === 'AbortError') {
                return {
                    success: false,
                    portal: this.portal,
                    handle: cleanHandle,
                    targetFieldsContent: {},
                    errorCode: 'NETWORK_ERROR',
                    errorMessage: 'Kaggle profile fetch timed out after 8000ms',
                };
            }

            return {
                success: false,
                portal: this.portal,
                handle: cleanHandle,
                targetFieldsContent: {},
                errorCode: 'NETWORK_ERROR',
                errorMessage: err.message || 'Network error fetching Kaggle profile',
            };
        }
    }

    public extractCandidates(fetchResult: AdapterFetchResult, targetField: string = this.defaultTargetField): string[] {
        if (!fetchResult.success || !fetchResult.targetFieldsContent) {
            return [];
        }

        // Restrict verification candidate extraction strictly to 'bio'
        if (targetField !== 'bio') {
            return [];
        }

        const text = fetchResult.targetFieldsContent[targetField];
        if (!text || typeof text !== 'string') {
            return [];
        }

        return extractChallengeCandidates(text);
    }

    public getInstructions(token: string, targetField: string = this.defaultTargetField, handle?: string): VerificationInstructions {
        const cleanHandle = (handle || "").trim().replace(/^@+/, "");
        const profileUrl = cleanHandle
            ? `https://www.kaggle.com/${encodeURIComponent(cleanHandle)}`
            : 'https://www.kaggle.com/';

        return {
            fieldName: 'bio',
            displayFieldName: 'Bio',
            instructions: `Open your Kaggle profile (${profileUrl}), select the Home tab, locate the Bio section, click the Edit control associated with Bio, append '${token}' to your existing Bio, save changes, and return to Orbix to verify.`,
            profileSettingsUrl: profileUrl,
        };
    }
}
