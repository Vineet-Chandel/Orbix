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

const profileRouter = express.Router();

// Mount dedicated profile photo management router (/api/profile/photo & /profile/photo)
profileRouter.use("/photo", photoRouter);

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
                is_public AS "isPublic",
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
            isPublic,
        } = req.body;

        // Validation
        const sanitizedFirstName = firstName !== undefined ? String(firstName).trim() : authUser.firstName;
        const sanitizedLastName = lastName !== undefined ? String(lastName).trim() : authUser.lastName;
        const sanitizedHeadline = headline !== undefined ? String(headline).trim().slice(0, 255) : null;
        const sanitizedBio = bio !== undefined ? String(bio).trim().slice(0, 2000) : null;
        const sanitizedAvatarUrl = avatarUrl !== undefined ? String(avatarUrl).trim() : null;
        const sanitizedCoverImageUrl = coverImageUrl !== undefined ? String(coverImageUrl).trim() : null;
        const sanitizedWebsite = website !== undefined ? String(website).trim().slice(0, 255) : null;
        const sanitizedLinkedin = linkedin !== undefined ? String(linkedin).trim().slice(0, 255) : null;
        const sanitizedGithub = github !== undefined ? String(github).trim().slice(0, 255) : null;
        const sanitizedCustomLink = customLink !== undefined ? String(customLink).trim().slice(0, 255) : null;
        const sanitizedLocation = location !== undefined ? String(location).trim().slice(0, 150) : null;
        const sanitizedSkills = skills !== undefined ? parseSkills(skills) : [];
        const sanitizedIsPublic = typeof isPublic === "boolean" ? isPublic : true;

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
                updated_at = CURRENT_TIMESTAMP
             WHERE id = $14 OR email = $15
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
                is_public AS "isPublic",
                updated_at AS "updatedAt";`,
            [
                sanitizedFirstName || null,
                sanitizedLastName || null,
                sanitizedHeadline,
                sanitizedBio,
                sanitizedAvatarUrl,
                sanitizedCoverImageUrl,
                sanitizedWebsite,
                sanitizedLinkedin,
                sanitizedGithub,
                sanitizedCustomLink,
                sanitizedLocation,
                JSON.stringify(sanitizedSkills),
                sanitizedIsPublic,
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
                is_public AS "isPublic",
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
            isPublic: userRow.isPublic !== false,
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
