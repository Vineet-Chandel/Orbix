/**
 * PLATFORM VERIFICATION COMPATIBILITY REGISTRY
 * Authoritative frontend mapping of Phase 2-3 backend adapters.
 */

export const SUPPORTED_VERIFICATION_PLATFORMS = [
    "leetcode",
    "codeforces",
    "hackerrank",
    "github",
] as const;

export type SupportedVerificationPlatform = (typeof SUPPORTED_VERIFICATION_PLATFORMS)[number];

export function isPlatformVerificationSupported(portalId: string): boolean {
    if (!portalId) return false;
    const clean = portalId.toLowerCase().trim();
    return (SUPPORTED_VERIFICATION_PLATFORMS as readonly string[]).includes(clean);
}

export function getPlatformVerificationMethod(portalId: string): "token" | "oauth" | null {
    const clean = (portalId || "").toLowerCase().trim();
    if (clean === "github") return "oauth";
    if (clean === "leetcode" || clean === "codeforces" || clean === "hackerrank") return "token";
    return null;
}

export function getPlatformVerificationField(portalId: string): string | null {
    const clean = (portalId || "").toLowerCase().trim();
    switch (clean) {
        case "leetcode":
            return "aboutMe";
        case "codeforces":
            return "organization";
        case "hackerrank":
            return "short_bio";
        case "github":
            return "oauth_identity";
        default:
            return null;
    }
}
