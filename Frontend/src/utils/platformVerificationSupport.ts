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

export interface PlatformVerificationGuide {
    portalId: string;
    portalName: string;
    targetFieldName: string;
    settingsUrl: string;
    settingsUrlLabel: string;
    instruction: string;
    detailText: string;
    screenshotAlt?: string;
    screenshotCaption?: string;
    hasScreenshot: boolean;
}

export function getPlatformVerificationGuide(
    portalId: string,
    _token?: string,
    fallbackSettingsUrl?: string
): PlatformVerificationGuide {
    const clean = (portalId || "").toLowerCase().trim();
    switch (clean) {
        case "leetcode":
            return {
                portalId: "leetcode",
                portalName: "LeetCode",
                targetFieldName: "ReadMe",
                settingsUrl: "https://leetcode.com/settings/profile/",
                settingsUrlLabel: "Open LeetCode Profile Settings",
                instruction: "Temporarily paste the verification code into your LeetCode ReadMe section, save changes on LeetCode, and click I've Updated My Profile.",
                detailText: "Place the token in your ReadMe field and save changes on LeetCode.",
                screenshotAlt: "LeetCode profile settings showing the ReadMe section highlighted for verification token placement",
                screenshotCaption: "In your LeetCode Profile Settings, locate the ReadMe row and paste the verification code as highlighted above.",
                hasScreenshot: true,
            };
        case "codeforces":
            return {
                portalId: "codeforces",
                portalName: "Codeforces",
                targetFieldName: "Organization",
                settingsUrl: "https://codeforces.com/settings/social",
                settingsUrlLabel: "Open Codeforces Social Settings",
                instruction: "Temporarily set your Organization on Codeforces to the verification code, click Save Changes, and click I've Updated My Profile.",
                detailText: "Place the token in your Organization field and save changes on Codeforces.",
                hasScreenshot: false,
            };
        case "hackerrank":
            return {
                portalId: "hackerrank",
                portalName: "HackerRank",
                targetFieldName: "Short Bio",
                settingsUrl: "https://www.hackerrank.com/settings/profile",
                settingsUrlLabel: "Open HackerRank Profile Settings",
                instruction: "Temporarily paste the verification code into your HackerRank Short Bio section, save changes on HackerRank, and click I've Updated My Profile.",
                detailText: "Place the token in your Short Bio field and save changes on HackerRank.",
                hasScreenshot: false,
            };
        default:
            return {
                portalId: clean,
                portalName: portalId,
                targetFieldName: "Profile Bio",
                settingsUrl: fallbackSettingsUrl || "#",
                settingsUrlLabel: `Open ${portalId} Profile Settings`,
                instruction: `Temporarily paste the verification code into your ${portalId} profile, save changes, and click I've Updated My Profile.`,
                detailText: "Place the token in your profile settings and save changes.",
                hasScreenshot: false,
            };
    }
}

