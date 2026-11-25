/**
 * PLATFORM VERIFICATION COMPATIBILITY REGISTRY
 * Authoritative frontend mapping of Phase 2-3 backend adapters.
 */

export const SUPPORTED_VERIFICATION_PLATFORMS = [
    "leetcode",
    "codeforces",
    "hackerrank",
    "github",
    "kaggle",
    "atcoder",
    "codechef",
    "topcoder",
    "geeksforgeeks",
    "hackerearth",
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
    if (
        clean === "leetcode" ||
        clean === "codeforces" ||
        clean === "hackerrank" ||
        clean === "kaggle" ||
        clean === "atcoder" ||
        clean === "codechef" ||
        clean === "topcoder" ||
        clean === "geeksforgeeks" ||
        clean === "hackerearth"
    ) return "token";
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
            return "headline";
        case "github":
            return "oauth_identity";
        case "kaggle":
            return "bio";
        case "atcoder":
            return "affiliation";
        case "codechef":
            return "highest_degree";
        case "topcoder":
            return "description";
        case "geeksforgeeks":
            return "bio";
        case "hackerearth":
            return "bio";
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
    fallbackSettingsUrl?: string,
    portalUsername?: string
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
                instruction: "Temporarily paste the verification code into your LeetCode ReadMe section, save changes on LeetCode, and click Verify.",
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
                instruction: "Temporarily set your Organization on Codeforces to the verification code, click Save Changes, and click Verify.",
                detailText: "Place the token in your Organization field and save changes on Codeforces.",
                screenshotAlt: "Codeforces social settings showing the Organization field for verification token placement",
                screenshotCaption: "In your Codeforces Social Settings, locate the Organization field and paste the verification code as shown above.",
                hasScreenshot: true,
            };
        case "hackerrank": {
            const cleanUser = (portalUsername || "").trim();
            const profileUrl = cleanUser
                ? `https://www.hackerrank.com/profile/${encodeURIComponent(cleanUser)}`
                : (fallbackSettingsUrl && fallbackSettingsUrl !== "#"
                    ? fallbackSettingsUrl
                    : "https://www.hackerrank.com/profile/");

            return {
                portalId: "hackerrank",
                portalName: "HackerRank",
                targetFieldName: "Headline",
                settingsUrl: profileUrl,
                settingsUrlLabel: "Open HackerRank Profile",
                instruction: "Open your HackerRank profile, click the edit icon beside your profile name, append the verification code to your existing Headline text, save changes, and click Verify.",
                detailText: "On your HackerRank profile, click the edit icon beside your profile name, append the token to your Headline field, and save changes.",
                screenshotAlt: "HackerRank profile settings showing the Headline field for verification token placement",
                screenshotCaption: "In your HackerRank Personal Information editor, locate the Headline field and append the verification token as shown above.",
                hasScreenshot: true,
            };
        }
        case "kaggle": {
            const cleanUser = (portalUsername || "").trim().replace(/^@+/, "");
            const profileUrl = cleanUser
                ? `https://www.kaggle.com/${encodeURIComponent(cleanUser)}`
                : (fallbackSettingsUrl && fallbackSettingsUrl !== "#"
                    ? fallbackSettingsUrl
                    : "https://www.kaggle.com/");

            return {
                portalId: "kaggle",
                portalName: "Kaggle",
                targetFieldName: "Bio",
                settingsUrl: profileUrl,
                settingsUrlLabel: "Open Kaggle Profile",
                instruction: "Open your Kaggle profile, select the Home tab, locate the Bio section, click the Edit control associated with Bio, append the verification code to your existing Bio, save changes, and return to Orbix to verify.",
                detailText: "On your Kaggle profile Home tab, locate the Bio section, click Edit, append the token to your Bio, and save changes.",
                hasScreenshot: false,
            };
        }
        case "atcoder":
            return {
                portalId: "atcoder",
                portalName: "AtCoder",
                targetFieldName: "Affiliation",
                settingsUrl: "https://atcoder.jp/settings",
                settingsUrlLabel: "Open AtCoder Settings",
                instruction: "Open your AtCoder settings, enter the verification code into the Affiliation field, click Update, and return to Orbix to verify.",
                detailText: "Place the token in your Affiliation field on AtCoder and save changes.",
                hasScreenshot: false,
            };
        case "codechef": {
            const cleanUser = (portalUsername || "").trim().replace(/^@+/, "");
            const settingsUrl = cleanUser
                ? `https://www.codechef.com/users/${encodeURIComponent(cleanUser)}/edit`
                : (fallbackSettingsUrl && fallbackSettingsUrl !== "#"
                    ? fallbackSettingsUrl
                    : "https://www.codechef.com/");

            return {
                portalId: "codechef",
                portalName: "CodeChef",
                targetFieldName: "Highest Degree Earned",
                settingsUrl,
                settingsUrlLabel: cleanUser ? "Open CodeChef Edit Profile" : "Open CodeChef",
                instruction: "Open your CodeChef profile editor, select Professional in the sidebar, paste the verification code into the Highest Degree Earned field, save changes, and click Verify.",
                detailText: "Place the token in your Highest Degree Earned field under Professional Information on CodeChef and save changes.",
                screenshotAlt: "CodeChef profile editing settings showing the Professional section and Highest Degree Earned field for verification token placement",
                screenshotCaption: "In your CodeChef profile editor, select Professional in the sidebar, locate the Highest Degree Earned field, paste the verification token, and click Save as shown above.",
                hasScreenshot: true,
            };
        }
        case "topcoder":
            return {
                portalId: "topcoder",
                portalName: "TopCoder",
                targetFieldName: "Short Bio",
                settingsUrl: "https://www.topcoder.com/settings/profile",
                settingsUrlLabel: "Open TopCoder Profile Settings",
                instruction: "Open your TopCoder profile settings, append the verification code to your Short Bio field, save changes, and return to Orbix to verify.",
                detailText: "Place the token in your Short Bio field on TopCoder and save changes.",
                hasScreenshot: false,
            };
        case "geeksforgeeks":
            return {
                portalId: "geeksforgeeks",
                portalName: "GeeksforGeeks",
                targetFieldName: "About/Bio",
                settingsUrl: "https://www.geeksforgeeks.org/profile/edit",
                settingsUrlLabel: "Open GeeksforGeeks Profile Settings",
                instruction: "Open your GeeksforGeeks profile edit page, paste the verification code into the About/Bio field (or Headline), save changes, and click Verify.",
                detailText: "Place the token in your About/Bio field on GeeksforGeeks and save changes.",
                screenshotAlt: "GeeksforGeeks profile edit settings showing the Headline and About/Bio fields for verification token placement",
                screenshotCaption: "In your GeeksforGeeks profile editor, locate the About/Bio field and paste the verification code as shown above.",
                hasScreenshot: true,
            };
        case "hackerearth": {
            const cleanUser = (portalUsername || "").trim().replace(/^@+/, "");
            const settingsUrl = cleanUser
                ? `https://www.hackerearth.com/@${encodeURIComponent(cleanUser)}/`
                : (fallbackSettingsUrl && fallbackSettingsUrl !== "#"
                    ? fallbackSettingsUrl
                    : "https://www.hackerearth.com/");

            return {
                portalId: "hackerearth",
                portalName: "HackerEarth",
                targetFieldName: "Bio",
                settingsUrl,
                settingsUrlLabel: cleanUser ? "Open HackerEarth Profile" : "Open HackerEarth",
                instruction: "Open your HackerEarth profile, click Edit Profile to open Settings, paste the verification code into the Bio field, save changes, and click Verify.",
                detailText: "Place the token in your Bio field under the Profile tab on HackerEarth and save changes.",
                hasScreenshot: false,
            };
        }
        default:
            return {
                portalId: clean,
                portalName: portalId,
                targetFieldName: "Profile",
                settingsUrl: fallbackSettingsUrl || "#",
                settingsUrlLabel: `Open ${portalId} Profile`,
                instruction: `Automated ownership verification is currently unsupported for ${portalId}.`,
                detailText: `Automated ownership verification is currently unsupported for ${portalId}.`,
                hasScreenshot: false,
            };
    }
}

