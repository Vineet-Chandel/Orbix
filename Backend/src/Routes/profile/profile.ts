import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import {
    getCachedPublicProfile,
    setCachedPublicProfile,
    invalidatePublicProfileCache,
    invalidatePrivateProfileCache,
    invalidateAllUserCaches,
    type PublicProfilePayload,
} from "../../redis/cache/cache-profile.js";
import { verifyAndFetchPortal, extractPortalUsername } from "../portals/portals.js";
import photoRouter from "./photo.js";
import resumeRouter, { generateSignedResumeUrl } from "./resume.js";

const profileRouter = express.Router();

// Mount dedicated profile photo management router (/api/profile/photo & /profile/photo)
profileRouter.use("/photo", photoRouter);

// Mount dedicated resume management router (/api/profile/resume)
profileRouter.use("/resume", resumeRouter);

/**
 * Helper to normalize skills input
 */
function parseSkills(input: any): string[] {
    if (Array.isArray(input)) {
        return input.map((s) => String(s).trim()).filter(Boolean);
    }
    if (typeof input === "string") {
        return input
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);
    }
    return [];
}

export function parseLinks(rawLinks: any, row?: any): Array<{ label: string; url: string; platform?: string }> {
    let list = rawLinks;
    if (typeof list === "string") {
        try {
            list = JSON.parse(list);
        } catch {
            list = [];
        }
    }
    const result: Array<{ label: string; url: string; platform?: string }> = [];
    if (Array.isArray(list)) {
        for (const item of list) {
            if (!item) continue;
            const url = String(item.url || "").trim();
            if (!url) continue;
            const label = String(item.label || item.title || item.name || "Link").trim();
            const linkObj: { label: string; url: string; platform?: string } = { label, url };
            if (item.platform) {
                linkObj.platform = String(item.platform).trim();
            }
            result.push(linkObj);
        }
    }
    // Backward compatibility fallback ONLY if rawLinks was completely null/undefined in DB
    if ((rawLinks === null || rawLinks === undefined) && result.length === 0 && row) {
        if (row.linkedin) result.push({ label: "LinkedIn", url: row.linkedin, platform: "linkedin" });
        if (row.github) result.push({ label: "GitHub", url: row.github, platform: "github" });
        if (row.website) result.push({ label: "Portfolio", url: row.website, platform: "portfolio" });
        if (row.customLink || row.custom_link) result.push({ label: "Link", url: row.customLink || row.custom_link });
    }
    return result.slice(0, 4);
}

/**
 * GET /api/profile/me & GET /api/me
 * Retrieves current authenticated user's private profile details.
 */
export const handleGetMyProfile = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // Fetch fresh user record from database
        const result = await query(
            `SELECT
                id,
                username,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                termsaccepted AS "termsAccepted",
                headline,
                bio,
                avatar_url AS "avatarUrl",
                photo_url AS "photoUrl",
                previous_photo_url AS "previousPhotoUrl",
                (previous_photo_url IS NOT NULL) AS "hasPreviousPhoto",
                cover_image_url AS "coverImageUrl",
                website,
                linkedin,
                github,
                custom_link AS "customLink",
                location,
                skills,
                links,
                is_open_to_work AS "isOpenToWork",
                is_hireable AS "isHireable",
                is_public AS "isPublic",
                resume_url AS "resumeUrl",
                resume_filename AS "resumeFilename",
                resume_filesize AS "resumeFilesize",
                resume_updated_at AS "resumeUpdatedAt",
                is_resume_public AS "isResumePublic",
                created_at AS "createdAt"
            FROM users
            WHERE id = $1 OR email = $2
            LIMIT 1;`,
            [authUser.id, authUser.gmail]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "User profile not found",
            });
        }

        const userRow = result.rows[0];

        // Fetch user's connected platforms
        const linksResult = await query(
            `SELECT
                id,
                portal,
                portal_username AS "portalUsername",
                link,
                raw_input AS "rawInput",
                verified,
                display_name AS "displayName",
                avatar_url AS "avatarUrl",
                stats,
                is_public AS "isPublic",
                last_sync_status AS "lastSyncStatus",
                last_sync_at AS "lastSyncAt"
            FROM user_links
            WHERE username = $1 OR username = $2
            ORDER BY created_at ASC;`,
            [userRow.username, userRow.gmail]
        );

        return res.status(200).json({
            success: true,
            user: {
                ...userRow,
                skills: Array.isArray(userRow.skills) ? userRow.skills : [],
                links: parseLinks(userRow.links, userRow),
                platforms: linksResult.rows || [],
            },
        });
    } catch (err: any) {
        console.error("GET /profile/me error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve profile",
            error: err.message,
        });
    }
};

profileRouter.get("/me", authenticate, handleGetMyProfile);
profileRouter.get("/", authenticate, handleGetMyProfile);

/**
 * PUT /api/profile
 * Updates authenticated user's editable profile information.
 */
profileRouter.put("/", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const {
            firstName,
            lastName,
            headline,
            bio,
            avatarUrl,
            coverImageUrl,
            website,
            linkedin,
            github,
            customLink,
            location,
            skills,
            links,
            isOpenToWork,
            isHireable,
            isPublic,
        } = req.body;

        // Validation
        const sanitizedFirstName = firstName !== undefined ? String(firstName).trim() : authUser.firstName;
        const sanitizedLastName = lastName !== undefined ? String(lastName).trim() : authUser.lastName;
        const sanitizedHeadline = headline !== undefined ? String(headline).trim().slice(0, 255) : null;
        const sanitizedBio = bio !== undefined ? String(bio).trim().slice(0, 2000) : null;
        const sanitizedAvatarUrl = avatarUrl !== undefined ? String(avatarUrl).trim() : null;
        const sanitizedCoverImageUrl = coverImageUrl !== undefined ? String(coverImageUrl).trim() : null;
        let sanitizedWebsite = website !== undefined ? String(website).trim().slice(0, 255) : null;
        let sanitizedLinkedin = linkedin !== undefined ? String(linkedin).trim().slice(0, 255) : null;
        let sanitizedGithub = github !== undefined ? String(github).trim().slice(0, 255) : null;
        let sanitizedCustomLink = customLink !== undefined ? String(customLink).trim().slice(0, 255) : null;
        const sanitizedLocation = location !== undefined ? String(location).trim().slice(0, 150) : null;
        const sanitizedSkills = skills !== undefined ? parseSkills(skills) : [];
        const sanitizedIsOpenToWork = typeof isOpenToWork === "boolean" ? isOpenToWork : null;
        const sanitizedIsHireable = typeof isHireable === "boolean" ? isHireable : null;
        const sanitizedIsPublic = typeof isPublic === "boolean" ? isPublic : true;

        let sanitizedLinksJson: string | null = null;
        if (links !== undefined) {
            const rawArr = Array.isArray(links) ? links : [];
            const cleanLinks = rawArr
                .filter((l: any) => l && typeof l === "object" && typeof l.url === "string" && l.url.trim().length > 0)
                .map((l: any) => ({
                    label: String(l.label || l.platform || "Link").trim().slice(0, 50),
                    url: String(l.url).trim().slice(0, 500),
                    platform: l.platform ? String(l.platform).trim().slice(0, 50) : undefined,
                }))
                .slice(0, 4);
            sanitizedLinksJson = JSON.stringify(cleanLinks);

            // Sync legacy link fields if not explicitly provided
            for (const l of cleanLinks) {
                const p = (l.platform || l.label || "").toLowerCase();
                const u = l.url;
                if (!sanitizedLinkedin && (p.includes("linkedin") || u.includes("linkedin.com"))) {
                    sanitizedLinkedin = u;
                } else if (!sanitizedGithub && (p.includes("github") || u.includes("github.com"))) {
                    sanitizedGithub = u;
                } else if (!sanitizedWebsite && (p.includes("website") || p.includes("portfolio") || p.includes("personal"))) {
                    sanitizedWebsite = u;
                } else if (!sanitizedCustomLink) {
                    sanitizedCustomLink = u;
                }
            }
        }

        // Retrieve existing profile to verify whether any changes actually exist
        const currentRes = await query(
            `SELECT
                firstname AS "firstName",
                lastname AS "lastName",
                headline,
                bio,
                avatar_url AS "avatarUrl",
                cover_image_url AS "coverImageUrl",
                website,
                linkedin,
                github,
                custom_link AS "customLink",
                location,
                skills,
                links,
                is_open_to_work AS "isOpenToWork",
                is_hireable AS "isHireable",
                is_public AS "isPublic"
             FROM users
             WHERE id = $1 OR email = $2
             LIMIT 1;`,
            [authUser.id, authUser.gmail]
        );

        if (!currentRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "User account not found",
            });
        }

        const current = currentRes.rows[0];

        const hasTextDiff = (incoming: string | null | undefined, existing: string | null | undefined) => {
            const inc = incoming !== undefined && incoming !== null ? String(incoming).trim() : "";
            const ext = existing !== undefined && existing !== null ? String(existing).trim() : "";
            return inc !== ext;
        };

        const isFirstNameChanged = firstName !== undefined && (sanitizedFirstName || "").trim() !== (current.firstName || "").trim();
        const isLastNameChanged = lastName !== undefined && (sanitizedLastName || "").trim() !== (current.lastName || "").trim();
        const isHeadlineChanged = headline !== undefined && hasTextDiff(sanitizedHeadline, current.headline);
        const isBioChanged = bio !== undefined && hasTextDiff(sanitizedBio, current.bio);
        const isAvatarChanged = avatarUrl !== undefined && hasTextDiff(sanitizedAvatarUrl, current.avatarUrl);
        const isCoverChanged = coverImageUrl !== undefined && hasTextDiff(sanitizedCoverImageUrl, current.coverImageUrl);
        const isWebsiteChanged = website !== undefined && hasTextDiff(sanitizedWebsite, current.website);
        const isLinkedinChanged = linkedin !== undefined && hasTextDiff(sanitizedLinkedin, current.linkedin);
        const isGithubChanged = github !== undefined && hasTextDiff(sanitizedGithub, current.github);
        const isCustomLinkChanged = customLink !== undefined && hasTextDiff(sanitizedCustomLink, current.customLink);
        const isLocationChanged = location !== undefined && hasTextDiff(sanitizedLocation, current.location);

        const isIsOpenToWorkChanged = typeof isOpenToWork === "boolean" && Boolean(isOpenToWork) !== Boolean(current.isOpenToWork);
        const isIsHireableChanged = typeof isHireable === "boolean" && Boolean(isHireable) !== Boolean(current.isHireable);
        const isIsPublicChanged = typeof isPublic === "boolean" && Boolean(isPublic) !== Boolean(current.isPublic);

        // Skills difference check
        let isSkillsChanged = false;
        if (skills !== undefined) {
            const existingSkills = parseSkills(current.skills);
            if (sanitizedSkills.length !== existingSkills.length) {
                isSkillsChanged = true;
            } else {
                for (let i = 0; i < sanitizedSkills.length; i++) {
                    const s = sanitizedSkills[i];
                    const es = existingSkills[i];
                    if (s !== es) {
                        isSkillsChanged = true;
                        break;
                    }
                }
            }
        }

        // Links difference check
        let isLinksChanged = false;
        if (links !== undefined) {
            const cleanLinks = (Array.isArray(links) ? links : [])
                .filter((l: any) => l && typeof l === "object" && typeof l.url === "string" && l.url.trim().length > 0)
                .map((l: any) => ({
                    label: String(l.label || l.platform || "Link").trim().slice(0, 50),
                    url: String(l.url).trim().slice(0, 500),
                    platform: l.platform ? String(l.platform).trim().slice(0, 50) : undefined,
                }))
                .slice(0, 4);

            const existingLinks = parseLinks(current.links, current);
            if (cleanLinks.length !== existingLinks.length) {
                isLinksChanged = true;
            } else {
                for (let i = 0; i < cleanLinks.length; i++) {
                    const c = cleanLinks[i];
                    const e = existingLinks[i];
                    if (
                        !c ||
                        !e ||
                        c.label !== e.label ||
                        c.url !== e.url ||
                        (c.platform || undefined) !== (e.platform || undefined)
                    ) {
                        isLinksChanged = true;
                        break;
                    }
                }
            }
        }

        const hasAnyChanges =
            isFirstNameChanged ||
            isLastNameChanged ||
            isHeadlineChanged ||
            isBioChanged ||
            isAvatarChanged ||
            isCoverChanged ||
            isWebsiteChanged ||
            isLinkedinChanged ||
            isGithubChanged ||
            isCustomLinkChanged ||
            isLocationChanged ||
            isIsOpenToWorkChanged ||
            isIsHireableChanged ||
            isIsPublicChanged ||
            isSkillsChanged ||
            isLinksChanged;

        if (!hasAnyChanges) {
            return res.status(400).json({
                success: false,
                message: "No profile changes detected. The submitted details are identical to your current profile.",
            });
        }

        const finalFirstName = firstName !== undefined ? (sanitizedFirstName || null) : current.firstName;
        const finalLastName = lastName !== undefined ? (sanitizedLastName || null) : current.lastName;
        const finalHeadline = headline !== undefined ? sanitizedHeadline : current.headline;
        const finalBio = bio !== undefined ? sanitizedBio : current.bio;
        const finalAvatarUrl = avatarUrl !== undefined ? sanitizedAvatarUrl : current.avatarUrl;
        const finalCoverImageUrl = coverImageUrl !== undefined ? sanitizedCoverImageUrl : current.coverImageUrl;
        const finalWebsite = website !== undefined ? sanitizedWebsite : (sanitizedWebsite || current.website);
        const finalLinkedin = linkedin !== undefined ? sanitizedLinkedin : (sanitizedLinkedin || current.linkedin);
        const finalGithub = github !== undefined ? sanitizedGithub : (sanitizedGithub || current.github);
        const finalCustomLink = customLink !== undefined ? sanitizedCustomLink : (sanitizedCustomLink || current.customLink);
        const finalLocation = location !== undefined ? sanitizedLocation : current.location;
        const finalSkills = skills !== undefined ? sanitizedSkills : parseSkills(current.skills);
        const finalIsPublic = typeof isPublic === "boolean" ? sanitizedIsPublic : (current.isPublic ?? true);
        const finalLinksJson = links !== undefined ? (sanitizedLinksJson || "[]") : (current.links ? (typeof current.links === "string" ? current.links : JSON.stringify(current.links)) : "[]");
        const finalIsOpenToWork = typeof isOpenToWork === "boolean" ? sanitizedIsOpenToWork : current.isOpenToWork;
        const finalIsHireable = typeof isHireable === "boolean" ? sanitizedIsHireable : current.isHireable;

        const updateResult = await query(
            `UPDATE users
             SET
                firstname = COALESCE($1, firstname),
                lastname = COALESCE($2, lastname),
                headline = $3,
                bio = $4,
                avatar_url = $5,
                cover_image_url = $6,
                website = $7,
                linkedin = $8,
                github = $9,
                custom_link = $10,
                location = $11,
                skills = $12::jsonb,
                is_public = $13,
                links = COALESCE($14::jsonb, '[]'::jsonb),
                is_open_to_work = COALESCE($15, false),
                is_hireable = COALESCE($16, false),
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $17 OR email = $18
             RETURNING
                id,
                username,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                termsaccepted AS "termsAccepted",
                headline,
                bio,
                avatar_url AS "avatarUrl",
                cover_image_url AS "coverImageUrl",
                website,
                linkedin,
                github,
                custom_link AS "customLink",
                location,
                skills,
                links,
                is_open_to_work AS "isOpenToWork",
                is_hireable AS "isHireable",
                is_public AS "isPublic",
                updated_at AS "updatedAt";`,
            [
                finalFirstName || null,
                finalLastName || null,
                finalHeadline,
                finalBio,
                finalAvatarUrl,
                finalCoverImageUrl,
                finalWebsite,
                finalLinkedin,
                finalGithub,
                finalCustomLink,
                finalLocation,
                JSON.stringify(finalSkills),
                finalIsPublic,
                finalLinksJson,
                finalIsOpenToWork,
                finalIsHireable,
                authUser.id,
                authUser.gmail,
            ]
        );

        if (!updateResult.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "User account not found",
            });
        }

        const updatedUser = updateResult.rows[0];

        // Invalidate Redis caches
        await invalidateAllUserCaches({
            id: authUser.id,
            username: updatedUser.username,
            gmail: updatedUser.gmail,
        });

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: {
                ...updatedUser,
                skills: Array.isArray(updatedUser.skills) ? updatedUser.skills : [],
                links: parseLinks(updatedUser.links, updatedUser),
            },
        });
    } catch (err: any) {
        console.error("PUT /profile error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: err.message,
        });
    }
});

/**
 * GET /api/profile/public/:username (or /api/profile/user/:username)
 * Retrieves public-facing profile showcase by username.
 * Public visitors do NOT need to authenticate.
 * If authenticated user is the owner, they can see private platforms and an `isOwner: true` flag.
 */
export const handleGetPublicProfile = async (req: Request, res: Response) => {
    try {
        const username = String(req.params.username || "").trim().toLowerCase();
        if (!username) {
            return res.status(400).json({
                success: false,
                message: "Username parameter is required",
            });
        }

        const viewer = req.user;
        const isOwner =
            viewer &&
            (viewer.username?.toLowerCase() === username ||
                viewer.gmail?.toLowerCase() === username);

        // Immediate mock handler for the public demo profile
        if (username === "vineet-chandel" || username === "demo") {
            const demoProfile: PublicProfilePayload = {
                id: "demo-vineet-chandel",
                username: "Vineet-Chandel",
                displayName: "Vineet Chandel",
                firstName: "Vineet",
                lastName: "Chandel",
                avatarUrl: "/avatar.png",
                photoUrl: "/avatar.png",
                headline: "Full Stack Engineer & Competitive Programmer | Grandmaster Track",
                bio: "Passionate Full Stack Engineer & Systems Architect with 1,680+ algorithmic problems solved across global platforms. Specializing in high-throughput distributed systems, scalable web applications, and developer productivity tooling. Top 0.5% Guardian on LeetCode and Candidate Master on Codeforces.",
                location: "Bengaluru, India",
                website: "https://orbix.dev/profile/u/Vineet-Chandel",
                linkedin: "https://linkedin.com/in/Vineet-Chandel",
                github: "https://github.com/Vineet-Chandel",
                customLink: "https://leetcode.com/u/Vineet-Chandel",
                isOpenToWork: true,
                isHireable: true,
                isPublic: true,
                resumeUrl: "/sample-resume.pdf",
                resumeFilename: "Vineet_Chandel_FullStack_Resume.pdf",
                resumeFilesize: 1420000,
                resumeUpdatedAt: "2026-02-15T00:00:00.000Z",
                isResumePublic: true,
                createdAt: "2024-01-15T00:00:00.000Z",
                skills: [
                    "TypeScript", "React", "Next.js", "Node.js", "Python", "C++", "Go",
                    "PostgreSQL", "Redis", "Docker", "GraphQL", "Distributed Systems",
                    "System Design", "Tailwind CSS"
                ],
                links: [
                    { label: "GitHub", url: "https://github.com/Vineet-Chandel", platform: "github" },
                    { label: "LinkedIn", url: "https://linkedin.com/in/Vineet-Chandel", platform: "linkedin" },
                    { label: "Portfolio", url: "https://orbix.dev/profile/u/Vineet-Chandel", platform: "portfolio" },
                    { label: "LeetCode", url: "https://leetcode.com/u/Vineet-Chandel", platform: "leetcode" },
                ],
                platforms: [
                    {
                        portal: "leetcode",
                        portalUsername: "Vineet-Chandel",
                        link: "https://leetcode.com/u/Vineet-Chandel",
                        verified: true,
                        displayName: "LeetCode",
                        stats: [
                            { label: "solved", value: "912" },
                            { label: "rating", value: "2,340" },
                            { label: "tier", value: "Guardian" },
                            { label: "contests", value: "56" },
                            { label: "active days", value: "280" },
                        ],
                    },
                    {
                        portal: "codeforces",
                        portalUsername: "Vineet-Chandel",
                        link: "https://codeforces.com/profile/Vineet-Chandel",
                        verified: true,
                        displayName: "Codeforces",
                        stats: [
                            { label: "solved", value: "468" },
                            { label: "rating", value: "2,045" },
                            { label: "tier", value: "Candidate Master" },
                            { label: "contests", value: "38" },
                            { label: "active days", value: "145" },
                        ],
                    },
                    {
                        portal: "codechef",
                        portalUsername: "Vineet-Chandel",
                        link: "https://www.codechef.com/users/Vineet-Chandel",
                        verified: true,
                        displayName: "CodeChef",
                        stats: [
                            { label: "solved", value: "342" },
                            { label: "rating", value: "2,215" },
                            { label: "tier", value: "6 Star" },
                            { label: "contests", value: "26" },
                            { label: "active days", value: "112" },
                        ],
                    },
                    {
                        portal: "github",
                        portalUsername: "Vineet-Chandel",
                        link: "https://github.com/Vineet-Chandel",
                        verified: true,
                        displayName: "GitHub",
                        stats: [
                            { label: "contributions", value: "3,180" },
                            { label: "repositories", value: "62" },
                            { label: "followers", value: "840" },
                            { label: "stars", value: "1,420" },
                        ],
                    },
                    {
                        portal: "geeksforgeeks",
                        portalUsername: "Vineet-Chandel",
                        link: "https://auth.geeksforgeeks.org/user/Vineet-Chandel",
                        verified: true,
                        displayName: "GeeksforGeeks",
                        stats: [
                            { label: "solved", value: "410" },
                            { label: "submissions", value: "720" },
                            { label: "active days", value: "130" },
                        ],
                    },
                    {
                        portal: "hackerrank",
                        portalUsername: "Vineet-Chandel",
                        link: "https://www.hackerrank.com/Vineet-Chandel",
                        verified: true,
                        displayName: "HackerRank",
                        stats: [
                            { label: "solved", value: "245" },
                            { label: "submissions", value: "410" },
                            { label: "active days", value: "82" },
                        ],
                    },
                    {
                        portal: "atcoder",
                        portalUsername: "Vineet-Chandel",
                        link: "https://atcoder.jp/users/Vineet-Chandel",
                        verified: true,
                        displayName: "AtCoder",
                        stats: [
                            { label: "solved", value: "140" },
                            { label: "rating", value: "1,640" },
                            { label: "tier", value: "1-Kyu" },
                            { label: "contests", value: "18" },
                        ],
                    },
                    {
                        portal: "code360",
                        portalUsername: "Vineet-Chandel",
                        link: "https://naukri.com/code360/profile/Vineet-Chandel",
                        verified: true,
                        displayName: "Code360",
                        stats: [
                            { label: "solved", value: "165" },
                            { label: "submissions", value: "290" },
                        ],
                    },
                    {
                        portal: "interviewbit",
                        portalUsername: "Vineet-Chandel",
                        link: "https://www.interviewbit.com/profile/Vineet-Chandel",
                        verified: true,
                        displayName: "InterviewBit",
                        stats: [
                            { label: "solved", value: "130" },
                        ],
                    },
                ],
            };

            return res.status(200).json({
                success: true,
                profile: {
                    ...demoProfile,
                    isOwner: !!isOwner,
                },
            });
        }

        // Check Redis cache first (only for public visitors, not owners who see private details)
        if (!isOwner) {
            const cached = await getCachedPublicProfile(username);
            if (cached) {
                return res.status(200).json({
                    success: true,
                    profile: {
                        ...cached,
                        isOwner: false,
                    },
                });
            }
        }

        // Query database for user
        const userResult = await query(
            `SELECT
                id,
                username,
                firstname AS "firstName",
                lastname AS "lastName",
                headline,
                bio,
                avatar_url AS "avatarUrl",
                photo_url AS "photoUrl",
                cover_image_url AS "coverImageUrl",
                website,
                linkedin,
                github,
                custom_link AS "customLink",
                location,
                skills,
                links,
                is_open_to_work AS "isOpenToWork",
                is_hireable AS "isHireable",
                is_public AS "isPublic",
                resume_url AS "resumeUrl",
                resume_filename AS "resumeFilename",
                resume_filesize AS "resumeFilesize",
                resume_updated_at AS "resumeUpdatedAt",
                is_resume_public AS "isResumePublic",
                created_at AS "createdAt"
            FROM users
            WHERE LOWER(username) = $1
            LIMIT 1;`,
            [username]
        );

        if (!userResult.rows[0]) {
            return res.status(404).json({
                success: false,
                message: `User '@${username}' not found`,
            });
        }

        const userRow = userResult.rows[0];

        // Query all verified/connected platforms for showcase
        const linksResult = await query(
            `SELECT
                portal,
                portal_username AS "portalUsername",
                link,
                verified,
                display_name AS "displayName",
                avatar_url AS "avatarUrl",
                stats,
                last_sync_status AS "lastSyncStatus",
                last_sync_at AS "lastSyncAt"
            FROM user_links
            WHERE (LOWER(username) = $1)
            ORDER BY portal ASC;`,
            [username]
        );

        const fullName = `${userRow.firstName} ${userRow.lastName || ""}`.trim();
        const displayName = fullName || userRow.username;

        const canonicalAvatar = userRow.photoUrl || userRow.avatarUrl || null;

        const publicProfilePayload: PublicProfilePayload = {
            id: userRow.id,
            username: userRow.username,
            displayName,
            firstName: userRow.firstName,
            lastName: userRow.lastName,
            avatarUrl: canonicalAvatar || undefined,
            photoUrl: userRow.photoUrl || null,
            coverImageUrl: userRow.coverImageUrl,
            headline: userRow.headline,
            bio: userRow.bio,
            website: userRow.website,
            linkedin: userRow.linkedin || null,
            github: userRow.github || null,
            customLink: userRow.customLink || null,
            location: userRow.location,
            skills: Array.isArray(userRow.skills) ? userRow.skills : [],
            links: parseLinks(userRow.links, userRow),
            isOpenToWork: userRow.isOpenToWork === true,
            isHireable: userRow.isHireable === true,
            isPublic: userRow.isPublic !== false,
            resumeUrl: userRow.isResumePublic !== false ? (userRow.resumeUrl || null) : null,
            resumeFilename: userRow.isResumePublic !== false ? (userRow.resumeFilename || null) : null,
            resumeFilesize: userRow.isResumePublic !== false ? (userRow.resumeFilesize || null) : null,
            resumeUpdatedAt: userRow.isResumePublic !== false ? (userRow.resumeUpdatedAt || null) : null,
            isResumePublic: userRow.isResumePublic !== false,
            createdAt: userRow.createdAt,
            platforms: linksResult.rows || [],
        };

        // Cache public profile in Redis
        if (userRow.isPublic !== false) {
            await setCachedPublicProfile(username, publicProfilePayload);
        }

        return res.status(200).json({
            success: true,
            profile: {
                ...publicProfilePayload,
                isOwner: !!isOwner,
            },
        });
    } catch (err: any) {
        console.error("Public profile fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve public profile",
            error: err.message,
        });
    }
};

profileRouter.get("/public/:username", optionalAuthenticate, handleGetPublicProfile);
profileRouter.get("/user/:username", optionalAuthenticate, handleGetPublicProfile);

/**
 * POST /api/profile/:username/hire-message (and /api/profile/hire-message)
 * Recruiter / hiring manager inquiry endpoint to send notification & message to profile owner.
 */
const handleSendHireMessage = async (req: Request, res: Response) => {
    try {
        const usernameParam = req.params.username || req.body.username;
        const username = String(usernameParam || "").trim().toLowerCase();
        const { senderName, senderEmail, communicationEmail, company, message } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, message: "Recipient username is required" });
        }

        // Strict verification: all entries are necessary
        if (!senderName || typeof senderName !== "string" || senderName.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Your full name is required (minimum 2 characters)" });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!senderEmail || typeof senderEmail !== "string" || !emailRegex.test(senderEmail.trim())) {
            return res.status(400).json({ success: false, message: "A valid work email is required" });
        }

        if (!communicationEmail || typeof communicationEmail !== "string" || !emailRegex.test(communicationEmail.trim())) {
            return res.status(400).json({ success: false, message: "A valid communication email is required for direct correspondence" });
        }

        if (!company || typeof company !== "string" || company.trim().length < 2) {
            return res.status(400).json({ success: false, message: "Company name is required" });
        }

        if (!message || typeof message !== "string" || message.trim().length < 10) {
            return res.status(400).json({ success: false, message: "Message is required (minimum 10 characters describing the role)" });
        }

        // Verify user exists and retrieve email + name
        const userRes = await query(
            `SELECT id, username, firstname, lastname, email, is_hireable
             FROM users
             WHERE LOWER(username) = $1
             LIMIT 1;`,
            [username]
        );

        if (!userRes.rows[0]) {
            return res.status(404).json({ success: false, message: `User '@${username}' not found` });
        }

        const recipient = userRes.rows[0];

        // Store recruiter message in recruiter_messages table with communication_email
        const msgResult = await query(
            `INSERT INTO recruiter_messages (
                recipient_user_id,
                recipient_username,
                recipient_email,
                sender_name,
                sender_email,
                communication_email,
                company,
                message,
                status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'delivered')
            RETURNING id, created_at;`,
            [
                recipient.id,
                recipient.username,
                recipient.email,
                senderName.trim().slice(0, 150),
                senderEmail.trim().slice(0, 255),
                communicationEmail.trim().slice(0, 255),
                company.trim().slice(0, 200),
                message.trim().slice(0, 5000),
            ]
        );

        // Store notification for user in user_notifications table
        const cleanCompany = company.trim();
        await query(
            `INSERT INTO user_notifications (
                user_id,
                username,
                title,
                body,
                type,
                metadata
            ) VALUES ($1, $2, $3, $4, $5, $6);`,
            [
                recipient.id,
                recipient.username,
                `New hire inquiry from ${senderName.trim()} at ${cleanCompany}`,
                message.trim().slice(0, 280),
                "hire_inquiry",
                JSON.stringify({
                    senderName: senderName.trim(),
                    senderEmail: senderEmail.trim(),
                    communicationEmail: communicationEmail.trim(),
                    company: cleanCompany,
                    messageId: msgResult.rows[0]?.id,
                    fullMessage: message.trim(),
                }),
            ]
        );

        const recipientFirst = recipient.firstname || recipient.username;

        return res.status(200).json({
            success: true,
            message: `Your message has been sent to ${recipientFirst}. They will receive your communication email so they can get back to you!`,
        });
    } catch (err: any) {
        console.error("Hire message dispatch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to send message. Please try again later.",
            error: err.message,
        });
    }
};

profileRouter.post("/:username/hire-message", handleSendHireMessage);
profileRouter.post("/hire-message", handleSendHireMessage);

/**
 * GET /api/profile/messages
 * Retrieves inbound recruiter messages for the authenticated user.
 */
profileRouter.get("/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const msgs = await query(
            `SELECT
                id,
                sender_name AS "senderName",
                sender_email AS "senderEmail",
                communication_email AS "communicationEmail",
                company,
                message,
                status,
                is_read AS "isRead",
                created_at AS "createdAt"
             FROM recruiter_messages
             WHERE LOWER(recipient_username) = $1 OR LOWER(recipient_username) = $2
             ORDER BY created_at DESC
             LIMIT 50;`,
            [authUser.username.toLowerCase(), authUser.gmail.toLowerCase()]
        );
        return res.status(200).json({ success: true, messages: msgs.rows });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to fetch messages", error: err.message });
    }
});


/**
 * DELETE /api/profile/platforms/:portal (or /api/portals/:portal)
 * Disconnects / deletes a linked platform from user profile.
 */
profileRouter.delete("/platforms/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const portal = String(req.params.portal || "").trim().toLowerCase();

        const result = await query(
            `DELETE FROM user_links
             WHERE (username = $1 OR username = $2) AND LOWER(portal) = $3
             RETURNING id, portal;`,
            [authUser.username, authUser.gmail, portal]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: `Platform connection '${portal}' not found`,
            });
        }

        // Invalidate Redis caches
        await invalidateAllUserCaches({
            username: authUser.username,
            gmail: authUser.gmail,
        });

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' disconnected successfully`,
        });
    } catch (err: any) {
        console.error("Platform disconnect error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to disconnect platform",
            error: err.message,
        });
    }
});

/**
 * PUT /api/profile/platforms/:portal
 * Edits handle / link for an existing connected platform.
 */
profileRouter.put("/platforms/:portal", authenticate, async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        const portal = String(req.params.portal || "").trim().toLowerCase();
        const { handle, link } = req.body;

        const rawCandidate = handle || link;
        if (!rawCandidate || typeof rawCandidate !== "string") {
            return res.status(400).json({
                success: false,
                message: "Handle or profile link is required",
            });
        }

        const cleanHandle = extractPortalUsername(portal, rawCandidate) || rawCandidate.trim();

        // Verify with live platform fetcher
        const verifiedData = await verifyAndFetchPortal(portal, cleanHandle);

        const finalHandle = verifiedData?.username || cleanHandle;
        const finalLink = verifiedData?.profileUrl || link || `https://${portal}.com/${cleanHandle}`;
        const finalDisplayName = verifiedData?.name || authUser.firstName;
        const finalAvatar = verifiedData?.avatar || null;
        const finalStats = verifiedData?.stats || [];
        const isVerified = verifiedData ? verifiedData.verified !== false : true;

        const updateResult = await query(
            `UPDATE user_links
             SET portal_username = $1,
                 link = $2,
                 raw_input = $3,
                 verified = $4,
                 display_name = $5,
                 avatar_url = $6,
                 stats = $7::jsonb,
                 last_sync_status = 'valid',
                 last_sync_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE (username = $8 OR username = $9) AND LOWER(portal) = $10
             RETURNING
                id,
                portal,
                portal_username AS "portalUsername",
                link,
                verified,
                display_name AS "displayName",
                avatar_url AS "avatarUrl",
                stats,
                is_public AS "isPublic",
                last_sync_status AS "lastSyncStatus",
                last_sync_at AS "lastSyncAt";`,
            [
                finalHandle,
                finalLink,
                rawCandidate,
                isVerified,
                finalDisplayName,
                finalAvatar,
                JSON.stringify(finalStats),
                authUser.username,
                authUser.gmail,
                portal,
            ]
        );

        if (updateResult.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: `Platform connection '${portal}' not found`,
            });
        }

        // Invalidate Redis caches
        await invalidateAllUserCaches({
            username: authUser.username,
            gmail: authUser.gmail,
        });

        return res.status(200).json({
            success: true,
            message: `Platform '${portal}' updated successfully`,
            platform: updateResult.rows[0],
        });
    } catch (err: any) {
        console.error("Platform update error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to update platform connection",
            error: err.message,
        });
    }
});

export default profileRouter;
