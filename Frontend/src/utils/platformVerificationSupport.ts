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
    "interviewbit",
    "substack",
    "medium",
    "code360",
] as const;

export type SupportedVerificationPlatform = (typeof SUPPORTED_VERIFICATION_PLATFORMS)[number];

/**
 * Layering constants for ownership verification dialogs and lightboxes.
 * Ensures the lightbox preview always stacks cleanly above the verification modal.
 */
export const VERIFICATION_MODAL_Z_INDEX = 10001;
export const SCREENSHOT_LIGHTBOX_Z_INDEX = 10020;

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
        clean === "hackerearth" ||
        clean === "interviewbit" ||
        clean === "substack" ||
        clean === "medium" ||
        clean === "code360"
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
        case "interviewbit":
            return "bio";
        case "substack":
            return "bio";
        case "medium":
            return "short_bio";
        case "code360":
            return "about";
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
                instruction: "Open your Kaggle profile, select the Home tab, locate the Bio section, click the Edit control associated with Bio, paste the verification code into your Bio, save changes, and click Verify.",
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
                screenshotAlt: "AtCoder general settings showing the Affiliation field for verification token placement",
                screenshotCaption: "In your AtCoder General Settings, locate the Affiliation field and paste the verification token as shown above.",
                hasScreenshot: true,
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
        case "topcoder": {
            const cleanUser = (portalUsername || "").trim().replace(/^@+/, "");
            const settingsUrl = cleanUser
                ? `https://profiles.topcoder.com/${encodeURIComponent(cleanUser)}`
                : (fallbackSettingsUrl && fallbackSettingsUrl !== "#"
                    ? fallbackSettingsUrl
                    : "https://profiles.topcoder.com/");

            return {
                portalId: "topcoder",
                portalName: "TopCoder",
                targetFieldName: "Description",
                settingsUrl,
                settingsUrlLabel: cleanUser ? "Open TopCoder Profile" : "Open TopCoder",
                instruction: "Open your TopCoder profile, locate the About Me section, click the edit icon (or Add your bio), paste the verification code into the Description field, save changes, and click Verify.",
                detailText: "Place the token in your Description field under About Me on TopCoder and save changes.",
                screenshotAlt: "TopCoder profile showing the Add your bio link and About Me Description field for verification token placement",
                screenshotCaption: "On your TopCoder profile, click Add your bio (or the edit icon) under About Me, paste the verification token into Description, and click Save as shown above.",
                hasScreenshot: true,
            };
        }
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
                screenshotAlt: "HackerEarth settings showing the Profile tab, Bio field, and Save Changes button for verification token placement",
                screenshotCaption: "In your HackerEarth Settings, select the Profile tab, paste the verification token into the Bio field, and click Save Changes as shown above.",
                hasScreenshot: true,
            };
        }
        case "interviewbit":
            return {
                portalId: "interviewbit",
                portalName: "InterviewBit",
                targetFieldName: "Bio",
                settingsUrl: "https://www.interviewbit.com/profile/settings/",
                settingsUrlLabel: "Open InterviewBit Settings",
                instruction: "Temporarily paste the verification code into your InterviewBit Bio field, save changes, ensure your profile is set to Public under Privacy Settings, and click Verify.",
                detailText: "In your InterviewBit profile settings, locate the Bio field under Profile and paste the verification code.",
                screenshotAlt: "InterviewBit Basic Details settings showing the Bio field for verification token placement",
                screenshotCaption: "In your InterviewBit Profile Settings under Basic Details, locate the Bio field and paste the verification token as shown above.",
                hasScreenshot: true,
            };
        case "substack":
            return {
                portalId: "substack",
                portalName: "Substack",
                targetFieldName: "Bio",
                settingsUrl: "https://substack.com/profile/edit",
                settingsUrlLabel: "Open Substack Settings",
                instruction: "Temporarily paste the verification code into your Substack Bio field, save changes, and click Verify.",
                detailText: "In your Substack profile editor, locate the Bio field and paste the verification code.",
                screenshotAlt: "Substack Edit Profile settings showing the Bio field and Save button for verification token placement",
                screenshotCaption: "In your Substack Edit Profile settings, locate the Bio field, paste the verification token, and click Save as shown above.",
                hasScreenshot: true,
            };
        case "medium":
            return {
                portalId: "medium",
                portalName: "Medium",
                targetFieldName: "Short bio",
                settingsUrl: "https://medium.com/me/settings/account",
                settingsUrlLabel: "Open Medium Settings",
                instruction: "Open your Medium profile settings, select Profile information, paste the verification code into the Short bio field, save changes, and click Verify.",
                detailText: "In your Medium profile settings under Profile information, paste the token into Short bio and save changes.",
                screenshotAlt: "Medium Profile information settings showing the Short bio textarea for verification token placement",
                screenshotCaption: "In your Medium Profile information settings, locate the Short bio textarea, paste the verification token, and click Save as shown above.",
                hasScreenshot: true,
            };
        case "code360":
            return {
                portalId: "code360",
                portalName: "Naukri Code360",
                targetFieldName: "Profile summary",
                settingsUrl: "https://www.naukri.com/mnjuser/profile",
                settingsUrlLabel: "Open Profile Manager",
                instruction: "Open the provided Naukri profile-editing link, find and select Profile summary in the left sidebar, paste the verification token into the large text area, click Save, and click Verify.",
                detailText: "In the Naukri profile editor, select Profile summary in the left sidebar, paste your verification token into the Profile summary text area, and click Save.",
                screenshotAlt: "Naukri profile editing interface showing Profile summary in the sidebar (1) and the Profile summary dialog text area (2) for verification token placement",
                screenshotCaption: "In your Naukri profile editor, select Profile summary in the left sidebar (1), paste the verification token into the large text area (2), and click Save.",
                hasScreenshot: true,
            };
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

