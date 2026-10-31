import crypto from "node:crypto";
import { query, pool } from "../../database/client.js";
import { ClubTeamService, type ClubUserPermissions } from "./clubTeamService.js";
import {
    assertCloudinaryConfigured,
    isCloudinaryConfigured,
    cloudinary,
} from "../../config/cloudinary.js";
import {
    getCachedPublicClubProfile,
    setCachedPublicClubProfile,
    invalidateClubProfileCache,
} from "../../redis/cache/cache-club-profile.js";
import { getClubModerationState } from "./clubModerationService.js";

export interface CoordinatorData {
    id?: string;
    clubId?: string;
    linkedUserId?: string | null;
    name: string;
    department?: string | null;
    role: string;
    imageUrl?: string | null;
    isPrimary?: boolean;
    displayOrder?: number;
    isPublic?: boolean;
    contactEmail?: string | null;
    linkedinUrl?: string | null;
}

export interface AchievementData {
    id?: string;
    clubId?: string;
    title: string;
    description?: string | null;
    achievementDate?: string | null;
    issuer?: string | null;
    imageUrl?: string | null;
    externalLink?: string | null;
    displayOrder?: number;
}

export interface ProfileCompletionResult {
    percentage: number;
    completedItems: string[];
    missingItems: string[];
}

export class ClubProfileService {
    /**
     * Compute club profile completion score and identify missing recommended items.
     */
    static calculateCompletion(club: any, coordinatorsCount: number, achievementsCount: number): ProfileCompletionResult {
        const checks = [
            { id: "name", label: "Club Name", completed: Boolean(club.name && club.name.trim().length > 0), weight: 10 },
            { id: "slug", label: "Custom Club Username", completed: Boolean(club.slug && club.slug.trim().length > 0), weight: 5 },
            { id: "shortDescription", label: "Tagline / Short Description", completed: Boolean(club.shortDescription && club.shortDescription.trim().length > 10), weight: 10 },
            { id: "about", label: "Detailed About Story", completed: Boolean(club.about && club.about.trim().length > 50), weight: 15 },
            { id: "logoUrl", label: "Club Official Logo", completed: Boolean(club.logoUrl), weight: 10 },
            { id: "coverImageUrl", label: "Club Header Banner", completed: Boolean(club.coverImageUrl), weight: 10 },
            { id: "coordinators", label: "Student Leads / Coordinators Added", completed: coordinatorsCount > 0, weight: 15 },
            { id: "focusAreas", label: "Focus Areas & Topics", completed: Array.isArray(club.focusAreas) && club.focusAreas.length > 0, weight: 10 },
            { id: "contactOrSocial", label: "Contact Info or Social Handles", completed: Boolean(club.publicEmail || club.websiteUrl || (club.socialLinks && Object.keys(club.socialLinks).length > 0)), weight: 10 },
            { id: "achievementsOrMission", label: "Achievements or Mission & Vision", completed: achievementsCount > 0 || Boolean(club.mission || club.vision), weight: 5 },
        ];

        let totalScore = 0;
        const completedItems: string[] = [];
        const missingItems: string[] = [];

        for (const c of checks) {
            if (c.completed) {
                totalScore += c.weight;
                completedItems.push(c.label);
            } else {
                missingItems.push(c.label);
            }
        }

        return {
            percentage: Math.min(100, totalScore),
            completedItems,
            missingItems,
        };
    }

    /**
     * Fetch complete club profile for workspace management, including coordinators,
     * achievements, stats, and viewer permissions.
     */
    static async getFullClubProfile(userId: string, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms) {
            const error: any = new Error("No verified club workspace found for your account.");
            error.statusCode = 404;
            throw error;
        }

        const clubId = perms.clubId;

        // Fetch club details
        const clubRes = await query(
            `SELECT
                vc.id,
                vc.name,
                COALESCE(u.username, vc.slug) AS slug,
                u.username AS "clubUsername",
                vc.category,
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.college_city AS "collegeCity",
                vc.college_state AS "collegeState",
                vc.college_country AS "collegeCountry",
                vc.short_description AS "shortDescription",
                vc.about,
                vc.logo_url AS "logoUrl",
                vc.cover_image_url AS "coverImageUrl",
                vc.website_url AS "websiteUrl",
                vc.public_email AS "publicEmail",
                vc.contact_phone AS "contactPhone",
                vc.social_links AS "socialLinks",
                vc.founded_year AS "foundedYear",
                vc.operating_status AS "operatingStatus",
                vc.mission,
                vc.vision,
                vc.focus_areas AS "focusAreas",
                vc.publication_status AS "publicationStatus",
                vc.profile_visibility AS "profileVisibility",
                vc.recruitment_status AS "recruitmentStatus",
                vc.recruitment_announcement AS "recruitmentAnnouncement",
                vc.recruitment_url AS "recruitmentUrl",
                vc.is_active AS "isActive",
                vc.verified_at AS "verifiedAt",
                vc.created_at AS "createdAt",
                vc.updated_at AS "updatedAt"
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE vc.id = $1
             LIMIT 1;`,
            [clubId]
        );

        const club = clubRes.rows[0];
        if (!club) {
            const error: any = new Error("Verified club record not found.");
            error.statusCode = 404;
            throw error;
        }

        // Fetch coordinators
        const coordRes = await query(
            `SELECT
                c.id,
                c.club_id AS "clubId",
                c.linked_user_id AS "linkedUserId",
                c.name,
                c.department,
                c.role,
                c.image_url AS "imageUrl",
                c.is_primary AS "isPrimary",
                c.display_order AS "displayOrder",
                c.is_public AS "isPublic",
                c.contact_email AS "contactEmail",
                c.linkedin_url AS "linkedinUrl",
                c.created_at AS "createdAt",
                c.updated_at AS "updatedAt",
                u.username AS "linkedUsername",
                COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username) AS "linkedDisplayName",
                u.avatar_url AS "linkedAvatarUrl"
             FROM club_coordinators c
             LEFT JOIN users u ON u.id = c.linked_user_id
             WHERE c.club_id = $1
             ORDER BY c.display_order ASC, c.created_at ASC;`,
            [clubId]
        );

        // Fetch achievements
        const achRes = await query(
            `SELECT
                id,
                club_id AS "clubId",
                title,
                description,
                achievement_date AS "achievementDate",
                issuer,
                image_url AS "imageUrl",
                external_link AS "externalLink",
                display_order AS "displayOrder",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM club_achievements
             WHERE club_id = $1
             ORDER BY display_order ASC, created_at ASC;`,
            [clubId]
        );

        // Event stats
        const countRes = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'published' AND starts_at >= NOW()) AS upcoming_count,
                COUNT(*) FILTER (WHERE status = 'published' AND starts_at < NOW()) AS past_count,
                COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
                COUNT(*) AS total_count
             FROM club_events
             WHERE club_id = $1;`,
            [clubId]
        );

        const coordinators = coordRes.rows;
        const achievements = achRes.rows;
        const stats = countRes.rows[0] || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 };
        const completion = this.calculateCompletion(club, coordinators.length, achievements.length);

        const canManageProfile = perms.isOwner || perms.isAdmin;

        return {
            club,
            coordinators,
            achievements,
            stats,
            permissions: {
                ...perms,
                canManageProfile,
            },
            completion,
        };
    }

    /**
     * Update club profile fields with authoritative permission verification.
     */
    static async updateClubProfile(userId: string, payload: Record<string, any>, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms) {
            const error: any = new Error("No verified club workspace found for your account.");
            error.statusCode = 404;
            throw error;
        }

        if (!perms.isOwner && !perms.isAdmin) {
            const error: any = new Error("Forbidden: You lack management permissions to edit this club profile.");
            error.statusCode = 403;
            throw error;
        }

        const clubId = perms.clubId;

        // Current club record for slug and diff
        const currentRes = await query(
            `SELECT id, slug, auth_user_id FROM verified_clubs WHERE id = $1 LIMIT 1;`,
            [clubId]
        );
        const currentClub = currentRes.rows[0];
        if (!currentClub) {
            const error: any = new Error("Verified club record not found.");
            error.statusCode = 404;
            throw error;
        }

        // Slug updates are blocked — username changes require a separate process
        if (payload.slug !== undefined) {
            delete payload.slug; // Silently ignore slug changes from the profile update endpoint
        }

        // URL format validation helper
        const isValidUrl = (url?: string | null) => {
            if (!url) return true;
            return /^https?:\/\/.+/i.test(url.trim());
        };

        if (payload.websiteUrl && !isValidUrl(payload.websiteUrl)) {
            const error: any = new Error("Invalid website URL format.");
            error.statusCode = 400;
            throw error;
        }
        if (payload.logoUrl && !isValidUrl(payload.logoUrl)) {
            const error: any = new Error("Invalid logo image URL format.");
            error.statusCode = 400;
            throw error;
        }
        if (payload.coverImageUrl && !isValidUrl(payload.coverImageUrl)) {
            const error: any = new Error("Invalid cover banner URL format.");
            error.statusCode = 400;
            throw error;
        }
        if (payload.recruitmentUrl && !isValidUrl(payload.recruitmentUrl)) {
            const error: any = new Error("Invalid recruitment form URL format.");
            error.statusCode = 400;
            throw error;
        }

        // Enumeration validations
        const validOperating = ["active", "recruiting", "hiatus", "inactive"];
        if (payload.operatingStatus && !validOperating.includes(payload.operatingStatus)) {
            const error: any = new Error(`Invalid operating status. Allowed: ${validOperating.join(", ")}`);
            error.statusCode = 400;
            throw error;
        }

        const validPub = ["draft", "published", "hidden"];
        if (payload.publicationStatus && !validPub.includes(payload.publicationStatus)) {
            const error: any = new Error(`Invalid publication status. Allowed: ${validPub.join(", ")}`);
            error.statusCode = 400;
            throw error;
        }

        const validVis = ["public", "unlisted", "private"];
        if (payload.profileVisibility && !validVis.includes(payload.profileVisibility)) {
            const error: any = new Error(`Invalid profile visibility. Allowed: ${validVis.join(", ")}`);
            error.statusCode = 400;
            throw error;
        }

        const validRec = ["open", "closed", "upcoming"];
        if (payload.recruitmentStatus && !validRec.includes(payload.recruitmentStatus)) {
            const error: any = new Error(`Invalid recruitment status. Allowed: ${validRec.join(", ")}`);
            error.statusCode = 400;
            throw error;
        }

        // Focus areas cleanup
        let cleanFocusAreas: string[] | undefined = undefined;
        if (payload.focusAreas !== undefined) {
            if (Array.isArray(payload.focusAreas)) {
                cleanFocusAreas = payload.focusAreas
                    .map((t: any) => String(t).trim())
                    .filter((t: string) => t.length > 0 && t.length <= 40)
                    .slice(0, 20);
            } else {
                cleanFocusAreas = [];
            }
        }

        // Year validation
        let cleanFoundedYear: number | null | undefined = undefined;
        if (payload.foundedYear !== undefined) {
            if (payload.foundedYear === null || payload.foundedYear === "") {
                cleanFoundedYear = null;
            } else {
                const yr = parseInt(payload.foundedYear, 10);
                const currentYear = new Date().getFullYear();
                if (isNaN(yr) || yr < 1800 || yr > currentYear + 1) {
                    const error: any = new Error(`Founded year must be between 1800 and ${currentYear + 1}.`);
                    error.statusCode = 400;
                    throw error;
                }
                cleanFoundedYear = yr;
            }
        }

        // Build dynamic update query
        const updates: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        const addField = (colName: string, val: any) => {
            if (val !== undefined) {
                updates.push(`${colName} = $${pIndex++}`);
                values.push(val);
            }
        };

        if (payload.name !== undefined && String(payload.name).trim().length >= 2) {
            addField("name", String(payload.name).trim());
        }
        if (payload.category !== undefined && String(payload.category).trim().length > 0) {
            addField("category", String(payload.category).trim());
        }
        if (payload.shortDescription !== undefined) {
            addField("short_description", payload.shortDescription ? String(payload.shortDescription).trim() : null);
        }
        if (payload.about !== undefined) {
            addField("about", payload.about ? String(payload.about).trim() : null);
        }
        if (payload.logoUrl !== undefined) {
            addField("logo_url", payload.logoUrl ? String(payload.logoUrl).trim() : null);
        }
        if (payload.coverImageUrl !== undefined) {
            addField("cover_image_url", payload.coverImageUrl ? String(payload.coverImageUrl).trim() : null);
        }
        if (payload.websiteUrl !== undefined) {
            addField("website_url", payload.websiteUrl ? String(payload.websiteUrl).trim() : null);
        }
        if (payload.publicEmail !== undefined) {
            addField("public_email", payload.publicEmail ? String(payload.publicEmail).trim() : null);
        }
        if (payload.contactPhone !== undefined) {
            addField("contact_phone", payload.contactPhone ? String(payload.contactPhone).trim() : null);
        }
        if (payload.socialLinks !== undefined) {
            addField("social_links", JSON.stringify(payload.socialLinks || {}));
        }
        if (cleanFoundedYear !== undefined) {
            addField("founded_year", cleanFoundedYear);
        }
        if (payload.operatingStatus !== undefined) {
            addField("operating_status", payload.operatingStatus);
        }
        if (payload.mission !== undefined) {
            addField("mission", payload.mission ? String(payload.mission).trim() : null);
        }
        if (payload.vision !== undefined) {
            addField("vision", payload.vision ? String(payload.vision).trim() : null);
        }
        if (cleanFocusAreas !== undefined) {
            addField("focus_areas", JSON.stringify(cleanFocusAreas));
        }
        if (payload.publicationStatus !== undefined) {
            addField("publication_status", payload.publicationStatus);
        }
        if (payload.profileVisibility !== undefined) {
            addField("profile_visibility", payload.profileVisibility);
        }
        if (payload.recruitmentStatus !== undefined) {
            addField("recruitment_status", payload.recruitmentStatus);
        }
        if (payload.recruitmentAnnouncement !== undefined) {
            addField("recruitment_announcement", payload.recruitmentAnnouncement ? String(payload.recruitmentAnnouncement).trim() : null);
        }
        if (payload.recruitmentUrl !== undefined) {
            addField("recruitment_url", payload.recruitmentUrl ? String(payload.recruitmentUrl).trim() : null);
        }

        if (updates.length === 0) {
            return await this.getFullClubProfile(userId, requestedClubId);
        }

        updates.push(`updated_at = NOW()`);
        values.push(clubId);

        const sql = `
            UPDATE verified_clubs
            SET ${updates.join(", ")}
            WHERE id = $${pIndex}
            RETURNING *;
        `;

        await query(sql, values);

        // Invalidate public profile cache
        await invalidateClubProfileCache(currentClub.slug, []);

        return await this.getFullClubProfile(userId, requestedClubId);
    }

    /**
     * Generate Cloudinary signature for secure direct browser-to-Cloudinary uploads
     * Folders:
     * - orbix/clubs/{clubId}/logo
     * - orbix/clubs/{clubId}/banner
     * - orbix/clubs/{clubId}/coordinators
     * - orbix/clubs/{clubId}/achievements
     */
    static async getUploadSignature(
        userId: string,
        type: "logo" | "banner" | "coordinator" | "achievement",
        requestedClubId?: string
    ) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms) {
            const error: any = new Error("No verified club workspace found for your account.");
            error.statusCode = 404;
            throw error;
        }

        if (!perms.isOwner && !perms.isAdmin) {
            const error: any = new Error("Forbidden: You lack management permissions to upload club assets.");
            error.statusCode = 403;
            throw error;
        }

        if (!isCloudinaryConfigured()) {
            const error: any = new Error("Cloudinary image upload service is not configured.");
            error.statusCode = 503;
            throw error;
        }

        const { cloudName, apiKey, apiSecret } = assertCloudinaryConfigured();

        const timestamp = Math.round(Date.now() / 1000);
        const randomHex = crypto.randomBytes(6).toString("hex");
        const folder = `orbix/clubs/${perms.clubId}/${type}`;
        const publicId = `${folder}/${type}_${timestamp}_${randomHex}`;

        const paramsToSign: Record<string, any> = {
            overwrite: true,
            public_id: publicId,
            timestamp,
        };

        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        return {
            cloudName,
            apiKey,
            timestamp,
            publicId,
            folder,
            signature,
            uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        };
    }

    // =========================================================================
    // COORDINATOR MANAGEMENT
    // =========================================================================

    static async addCoordinator(userId: string, data: CoordinatorData, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can add coordinators.");
            error.statusCode = 403;
            throw error;
        }

        if (!data.name || !data.name.trim()) {
            const error: any = new Error("Coordinator name is required.");
            error.statusCode = 400;
            throw error;
        }
        if (!data.role || !data.role.trim()) {
            const error: any = new Error("Coordinator role / title is required.");
            error.statusCode = 400;
            throw error;
        }

        const clubId = perms.clubId;

        // Determine next display order
        const maxOrderRes = await query(
            `SELECT COALESCE(MAX(display_order), -1) AS max_order FROM club_coordinators WHERE club_id = $1;`,
            [clubId]
        );
        const nextOrder = (maxOrderRes.rows[0]?.max_order ?? -1) + 1;

        const insertRes = await query(
            `INSERT INTO club_coordinators (
                club_id,
                linked_user_id,
                name,
                department,
                role,
                image_url,
                is_primary,
                display_order,
                is_public,
                contact_email,
                linkedin_url
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *;`,
            [
                clubId,
                data.linkedUserId || null,
                data.name.trim(),
                data.department ? data.department.trim() : null,
                data.role.trim(),
                data.imageUrl ? data.imageUrl.trim() : null,
                Boolean(data.isPrimary),
                nextOrder,
                data.isPublic !== undefined ? Boolean(data.isPublic) : true,
                data.contactEmail ? data.contactEmail.trim() : null,
                data.linkedinUrl ? data.linkedinUrl.trim() : null,
            ]
        );

        await invalidateClubProfileCache(perms.clubSlug);
        return insertRes.rows[0];
    }

    static async updateCoordinator(userId: string, coordinatorId: string, data: Partial<CoordinatorData>, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can edit coordinators.");
            error.statusCode = 403;
            throw error;
        }

        const checkRes = await query(
            `SELECT id FROM club_coordinators WHERE id = $1 AND club_id = $2;`,
            [coordinatorId, perms.clubId]
        );
        if (!checkRes.rows[0]) {
            const error: any = new Error("Coordinator not found in this club.");
            error.statusCode = 404;
            throw error;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        const addField = (colName: string, val: any) => {
            if (val !== undefined) {
                updates.push(`${colName} = $${pIndex++}`);
                values.push(val);
            }
        };

        if (data.name !== undefined) addField("name", data.name.trim());
        if (data.department !== undefined) addField("department", data.department ? data.department.trim() : null);
        if (data.role !== undefined) addField("role", data.role.trim());
        if (data.imageUrl !== undefined) addField("image_url", data.imageUrl ? data.imageUrl.trim() : null);
        if (data.linkedUserId !== undefined) addField("linked_user_id", data.linkedUserId || null);
        if (data.isPrimary !== undefined) addField("is_primary", Boolean(data.isPrimary));
        if (data.isPublic !== undefined) addField("is_public", Boolean(data.isPublic));
        if (data.contactEmail !== undefined) addField("contact_email", data.contactEmail ? data.contactEmail.trim() : null);
        if (data.linkedinUrl !== undefined) addField("linkedin_url", data.linkedinUrl ? data.linkedinUrl.trim() : null);
        if (data.displayOrder !== undefined) addField("display_order", Number(data.displayOrder) || 0);

        if (updates.length === 0) {
            return checkRes.rows[0];
        }

        updates.push(`updated_at = NOW()`);
        values.push(coordinatorId, perms.clubId);

        const sql = `
            UPDATE club_coordinators
            SET ${updates.join(", ")}
            WHERE id = $${pIndex++} AND club_id = $${pIndex}
            RETURNING *;
        `;

        const updateRes = await query(sql, values);
        await invalidateClubProfileCache(perms.clubSlug);
        return updateRes.rows[0];
    }

    static async deleteCoordinator(userId: string, coordinatorId: string, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can delete coordinators.");
            error.statusCode = 403;
            throw error;
        }

        const delRes = await query(
            `DELETE FROM club_coordinators WHERE id = $1 AND club_id = $2 RETURNING id;`,
            [coordinatorId, perms.clubId]
        );

        if (!delRes.rows[0]) {
            const error: any = new Error("Coordinator not found.");
            error.statusCode = 404;
            throw error;
        }

        await invalidateClubProfileCache(perms.clubSlug);
        return { success: true, deletedId: coordinatorId };
    }

    static async reorderCoordinators(userId: string, coordinatorIds: string[], requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can reorder coordinators.");
            error.statusCode = 403;
            throw error;
        }

        if (!Array.isArray(coordinatorIds)) {
            const error: any = new Error("coordinatorIds array required.");
            error.statusCode = 400;
            throw error;
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (let i = 0; i < coordinatorIds.length; i++) {
                await client.query(
                    `UPDATE club_coordinators SET display_order = $1, updated_at = NOW() WHERE id = $2 AND club_id = $3;`,
                    [i, coordinatorIds[i], perms.clubId]
                );
            }
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }

        await invalidateClubProfileCache(perms.clubSlug);
        return { success: true };
    }

    // =========================================================================
    // ACHIEVEMENTS MANAGEMENT
    // =========================================================================

    static async addAchievement(userId: string, data: AchievementData, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can add achievements.");
            error.statusCode = 403;
            throw error;
        }

        if (!data.title || !data.title.trim()) {
            const error: any = new Error("Achievement title is required.");
            error.statusCode = 400;
            throw error;
        }

        const clubId = perms.clubId;
        const maxOrderRes = await query(
            `SELECT COALESCE(MAX(display_order), -1) AS max_order FROM club_achievements WHERE club_id = $1;`,
            [clubId]
        );
        const nextOrder = (maxOrderRes.rows[0]?.max_order ?? -1) + 1;

        const insertRes = await query(
            `INSERT INTO club_achievements (
                club_id,
                title,
                description,
                achievement_date,
                issuer,
                image_url,
                external_link,
                display_order
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *;`,
            [
                clubId,
                data.title.trim(),
                data.description ? data.description.trim() : null,
                data.achievementDate ? data.achievementDate.trim() : null,
                data.issuer ? data.issuer.trim() : null,
                data.imageUrl ? data.imageUrl.trim() : null,
                data.externalLink ? data.externalLink.trim() : null,
                nextOrder,
            ]
        );

        await invalidateClubProfileCache(perms.clubSlug);
        return insertRes.rows[0];
    }

    static async updateAchievement(userId: string, achievementId: string, data: Partial<AchievementData>, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can edit achievements.");
            error.statusCode = 403;
            throw error;
        }

        const checkRes = await query(
            `SELECT id FROM club_achievements WHERE id = $1 AND club_id = $2;`,
            [achievementId, perms.clubId]
        );
        if (!checkRes.rows[0]) {
            const error: any = new Error("Achievement not found in this club.");
            error.statusCode = 404;
            throw error;
        }

        const updates: string[] = [];
        const values: any[] = [];
        let pIndex = 1;

        const addField = (colName: string, val: any) => {
            if (val !== undefined) {
                updates.push(`${colName} = $${pIndex++}`);
                values.push(val);
            }
        };

        if (data.title !== undefined) addField("title", data.title.trim());
        if (data.description !== undefined) addField("description", data.description ? data.description.trim() : null);
        if (data.achievementDate !== undefined) addField("achievement_date", data.achievementDate ? data.achievementDate.trim() : null);
        if (data.issuer !== undefined) addField("issuer", data.issuer ? data.issuer.trim() : null);
        if (data.imageUrl !== undefined) addField("image_url", data.imageUrl ? data.imageUrl.trim() : null);
        if (data.externalLink !== undefined) addField("external_link", data.externalLink ? data.externalLink.trim() : null);
        if (data.displayOrder !== undefined) addField("display_order", Number(data.displayOrder) || 0);

        if (updates.length === 0) {
            return checkRes.rows[0];
        }

        updates.push(`updated_at = NOW()`);
        values.push(achievementId, perms.clubId);

        const sql = `
            UPDATE club_achievements
            SET ${updates.join(", ")}
            WHERE id = $${pIndex++} AND club_id = $${pIndex}
            RETURNING *;
        `;

        const updateRes = await query(sql, values);
        await invalidateClubProfileCache(perms.clubSlug);
        return updateRes.rows[0];
    }

    static async deleteAchievement(userId: string, achievementId: string, requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can delete achievements.");
            error.statusCode = 403;
            throw error;
        }

        const delRes = await query(
            `DELETE FROM club_achievements WHERE id = $1 AND club_id = $2 RETURNING id;`,
            [achievementId, perms.clubId]
        );

        if (!delRes.rows[0]) {
            const error: any = new Error("Achievement not found.");
            error.statusCode = 404;
            throw error;
        }

        await invalidateClubProfileCache(perms.clubSlug);
        return { success: true, deletedId: achievementId };
    }

    static async reorderAchievements(userId: string, achievementIds: string[], requestedClubId?: string) {
        const perms = await ClubTeamService.resolveUserClubPermissions(userId, requestedClubId);
        if (!perms || (!perms.isOwner && !perms.isAdmin)) {
            const error: any = new Error("Forbidden: Only club owners or admins can reorder achievements.");
            error.statusCode = 403;
            throw error;
        }

        if (!Array.isArray(achievementIds)) {
            const error: any = new Error("achievementIds array required.");
            error.statusCode = 400;
            throw error;
        }

        const client = await pool.connect();
        try {
            await client.query("BEGIN");
            for (let i = 0; i < achievementIds.length; i++) {
                await client.query(
                    `UPDATE club_achievements SET display_order = $1, updated_at = NOW() WHERE id = $2 AND club_id = $3;`,
                    [i, achievementIds[i], perms.clubId]
                );
            }
            await client.query("COMMIT");
        } catch (e) {
            await client.query("ROLLBACK");
            throw e;
        } finally {
            client.release();
        }

        await invalidateClubProfileCache(perms.clubSlug);
        return { success: true };
    }

    // =========================================================================
    // DYNAMIC PUBLIC CLUB PROFILE (with caching & permissions checks)
    // =========================================================================

    static async getPublicClubProfile(slug: string, viewerUserId?: string) {
        if (!slug || !slug.trim()) {
            const error: any = new Error("Club slug is required.");
            error.statusCode = 400;
            throw error;
        }

        const cleanSlug = slug.trim().toLowerCase();

        // 1. Fetch club record
        const clubRes = await query(
            `SELECT
                vc.id,
                vc.name,
                COALESCE(u.username, vc.slug) AS slug,
                u.username AS "clubUsername",
                vc.category,
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.college_city AS "collegeCity",
                vc.college_state AS "collegeState",
                vc.college_country AS "collegeCountry",
                vc.short_description AS "shortDescription",
                vc.about,
                vc.logo_url AS "logoUrl",
                vc.cover_image_url AS "coverImageUrl",
                vc.website_url AS "websiteUrl",
                vc.public_email AS "publicEmail",
                vc.contact_phone AS "contactPhone",
                vc.social_links AS "socialLinks",
                vc.founded_year AS "foundedYear",
                vc.operating_status AS "operatingStatus",
                vc.mission,
                vc.vision,
                vc.focus_areas AS "focusAreas",
                vc.publication_status AS "publicationStatus",
                vc.profile_visibility AS "profileVisibility",
                vc.recruitment_status AS "recruitmentStatus",
                vc.recruitment_announcement AS "recruitmentAnnouncement",
                vc.recruitment_url AS "recruitmentUrl",
                vc.is_active AS "isActive",
                vc.auth_user_id AS "authUserId",
                vc.verified_at AS "verifiedAt",
                vc.created_at AS "createdAt"
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE (LOWER(vc.slug) = $1 OR LOWER(u.username) = $1)
             LIMIT 1;`,
            [cleanSlug]
        );

        const club = clubRes.rows[0];
        if (!club || !club.isActive) {
            const error: any = new Error("Club not found or is currently inactive.");
            error.statusCode = 404;
            throw error;
        }

        // Check if viewer has management permissions
        let isManagerOrMember = false;
        if (viewerUserId) {
            const perms = await ClubTeamService.resolveUserClubPermissions(viewerUserId, club.id);
            if (perms && (perms.isOwner || perms.isAdmin || perms.isTeamLead || perms.userRole === "member")) {
                isManagerOrMember = true;
            }
        }

        // Publication Status check: if draft or hidden, only managers/members can preview
        if (club.publicationStatus !== "published" && !isManagerOrMember) {
            const error: any = new Error("This club profile is currently in draft mode and not published publicly.");
            error.statusCode = 404;
            throw error;
        }

        // Profile Visibility check: if private, only members can view
        if (club.profileVisibility === "private" && !isManagerOrMember) {
            const error: any = new Error("This club profile is private to registered club members.");
            error.statusCode = 403;
            throw error;
        }

        // Moderation / Block check for viewer
        if (viewerUserId) {
            const modState = await getClubModerationState(club.id, viewerUserId);
            if (modState.isBlocked) {
                return {
                    isBlockedByClub: true,
                    club: {
                        id: club.id,
                        name: club.name,
                        slug: club.slug,
                        collegeName: club.collegeName,
                    },
                    upcomingEvents: [],
                    pastEvents: [],
                    coordinators: [],
                    achievements: [],
                    teams: [],
                    totalEvents: 0,
                    message: "Access Restricted: You don't have permission to view this club profile.",
                };
            }
        }

        // Check Redis cache for public viewers (when not previewing draft as manager)
        if (!isManagerOrMember && club.publicationStatus === "published" && club.profileVisibility === "public") {
            const cached = await getCachedPublicClubProfile(cleanSlug);
            if (cached) {
                return cached;
            }
        }

        // Fetch published events
        const eventsRes = await query(
            `SELECT
                id,
                title,
                slug,
                summary,
                description,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                location_type AS "locationType",
                venue_or_location AS "venueOrLocation",
                registration_url AS "registrationUrl",
                cover_image_url AS "coverImageUrl",
                published_at AS "publishedAt"
             FROM club_events
             WHERE club_id = $1 AND status = 'published'
             ORDER BY starts_at ASC;`,
            [club.id]
        );

        const now = new Date();
        const upcomingEvents = eventsRes.rows.filter((e) => new Date(e.startsAt) >= now);
        const pastEvents = eventsRes.rows.filter((e) => new Date(e.startsAt) < now);

        // Fetch public coordinators
        const coordRes = await query(
            `SELECT
                c.id,
                c.name,
                c.department,
                c.role,
                c.image_url AS "imageUrl",
                c.is_primary AS "isPrimary",
                c.display_order AS "displayOrder",
                c.contact_email AS "contactEmail",
                c.linkedin_url AS "linkedinUrl",
                u.username AS "linkedUsername",
                COALESCE(NULLIF(TRIM(CONCAT(u.firstname, ' ', u.lastname)), ''), u.username) AS "linkedDisplayName",
                u.avatar_url AS "linkedAvatarUrl"
             FROM club_coordinators c
             LEFT JOIN users u ON u.id = c.linked_user_id
             WHERE c.club_id = $1 AND c.is_public = true
             ORDER BY c.display_order ASC, c.created_at ASC;`,
            [club.id]
        );

        // Fetch achievements
        const achRes = await query(
            `SELECT
                id,
                title,
                description,
                achievement_date AS "achievementDate",
                issuer,
                image_url AS "imageUrl",
                external_link AS "externalLink",
                display_order AS "displayOrder"
             FROM club_achievements
             WHERE club_id = $1
             ORDER BY display_order ASC, created_at ASC;`,
            [club.id]
        );

        // Fetch active teams / departments
        const teamsRes = await query(
            `SELECT
                t.id,
                t.name,
                t.slug,
                t.description,
                t.responsibilities,
                t.display_order AS "displayOrder",
                (SELECT COUNT(*) FROM club_team_members tm WHERE tm.team_id = t.id AND tm.status = 'active') AS "memberCount"
             FROM club_teams t
             WHERE t.club_id = $1 AND t.is_archived = false
             ORDER BY t.display_order ASC, t.created_at ASC;`,
            [club.id]
        );

        // Clean sensitive fields from club object before sending to public
        const { authUserId, ...publicClub } = club;

        const responsePayload = {
            isBlockedByClub: false,
            club: publicClub,
            upcomingEvents,
            pastEvents,
            coordinators: coordRes.rows,
            achievements: achRes.rows,
            teams: teamsRes.rows,
            totalEvents: eventsRes.rows.length,
            isManagerOrMember,
        };

        // Cache if published and public
        if (!isManagerOrMember && club.publicationStatus === "published" && club.profileVisibility === "public") {
            await setCachedPublicClubProfile(cleanSlug, responsePayload, 600); // 10 minutes cache
        }

        return responsePayload;
    }

    /**
     * Retrieve all verified clubs belonging to the specified or caller's college.
     * Reusable across Club Dashboard "Campus Clubs" and Student Personal "Explore Clubs".
     */
    static async getCollegeClubs(
        userId?: string | undefined,
        options?: {
            collegeId?: string | undefined;
            collegeName?: string | undefined;
            clubId?: string | undefined;
        } | undefined
    ) {
        let collegeId = options?.collegeId;
        let collegeName = options?.collegeName;
        let callerClubId = options?.clubId;

        // 1. If not explicitly provided and user is authenticated, determine their college and club context
        if (userId && !callerClubId) {
            try {
                const perms = await ClubTeamService.resolveUserClubPermissions(userId, options?.clubId);
                if (perms?.clubId) {
                    callerClubId = perms.clubId;
                }
            } catch {
                // Not a club manager - proceed as normal student/user
            }
        }

        // 2. If callerClubId is available, resolve collegeId & collegeName directly from verified_clubs
        if (callerClubId && (!collegeId || !collegeName)) {
            try {
                const clubRes = await query(
                    `SELECT college_id, college_name FROM verified_clubs WHERE id = $1 LIMIT 1;`,
                    [callerClubId]
                );
                if (clubRes.rows.length > 0) {
                    collegeId = collegeId || clubRes.rows[0].college_id;
                    collegeName = collegeName || clubRes.rows[0].college_name;
                }
            } catch {
                // Ignore query error and fall back
            }
        }

        // 3. If still no college, check user's registered college in users table
        if (userId && !collegeId && !collegeName) {
            try {
                const userRes = await query(
                    `SELECT college, college_id FROM users WHERE id = $1 LIMIT 1;`,
                    [userId]
                );
                if (userRes.rows.length > 0) {
                    collegeName = userRes.rows[0].college || null;
                    collegeId = userRes.rows[0].college_id || null;
                }
            } catch {
                // Ignore query error
            }
        }

        // If no college could be resolved and no club context exists, return empty result gracefully
        if (!collegeId && (!collegeName || !collegeName.trim()) && !callerClubId) {
            return {
                collegeName: collegeName || "Your College",
                collegeId: collegeId || null,
                totalClubs: 0,
                clubs: [],
            };
        }

        const cleanCollegeName = collegeName ? collegeName.trim() : null;

        // 4. Query all verified clubs from this college (and ensure the caller club is always included)
        const clubsRes = await query(
            `SELECT
                vc.id,
                vc.name,
                COALESCE(u.username, vc.slug) AS slug,
                u.username AS "clubUsername",
                vc.category,
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.college_city AS "collegeCity",
                vc.college_state AS "collegeState",
                vc.college_country AS "collegeCountry",
                vc.short_description AS "shortDescription",
                vc.about,
                vc.mission,
                vc.vision,
                vc.logo_url AS "logoUrl",
                vc.cover_image_url AS "coverImageUrl",
                vc.website_url AS "websiteUrl",
                vc.public_email AS "publicEmail",
                vc.contact_phone AS "contactPhone",
                vc.social_links AS "socialLinks",
                vc.founded_year AS "foundedYear",
                vc.operating_status AS "operatingStatus",
                vc.focus_areas AS "focusAreas",
                vc.recruitment_status AS "recruitmentStatus",
                vc.recruitment_announcement AS "recruitmentAnnouncement",
                vc.recruitment_url AS "recruitmentUrl",
                vc.publication_status AS "publicationStatus",
                vc.profile_visibility AS "profileVisibility",
                vc.is_active AS "isActive",
                vc.verified_at AS "verifiedAt",
                vc.created_at AS "createdAt",
                COALESCE(tm.member_count, 0) AS "memberCount",
                COALESCE(ev.event_count, 0) AS "eventsCount",
                COALESCE(ach.ach_count, 0) AS "achievementsCount",
                COALESCE(cd.coord_count, 0) AS "coordinatorsCount"
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             LEFT JOIN (
                 SELECT club_id, COUNT(*) AS member_count
                 FROM club_team_members
                 WHERE status = 'active'
                 GROUP BY club_id
             ) tm ON tm.club_id = vc.id
             LEFT JOIN (
                 SELECT club_id, COUNT(*) AS event_count
                 FROM club_events
                 WHERE status = 'published'
                 GROUP BY club_id
             ) ev ON ev.club_id = vc.id
             LEFT JOIN (
                 SELECT club_id, COUNT(*) AS ach_count
                 FROM club_achievements
                 GROUP BY club_id
             ) ach ON ach.club_id = vc.id
             LEFT JOIN (
                 SELECT club_id, COUNT(*) AS coord_count
                 FROM club_coordinators
                 GROUP BY club_id
             ) cd ON cd.club_id = vc.id
             WHERE (vc.is_active = true OR ($3::text IS NOT NULL AND vc.id::text = $3::text))
               AND (
                   ($3::text IS NOT NULL AND vc.id::text = $3::text)
                   OR
                   ($1::text IS NOT NULL AND vc.college_id::text = $1::text)
                   OR
                   ($2::text IS NOT NULL AND LOWER(TRIM(vc.college_name)) = LOWER(TRIM($2)))
               )
             ORDER BY
                 CASE WHEN $3::text IS NOT NULL AND vc.id::text = $3::text THEN 0 ELSE 1 END,
                 vc.name ASC;`,
            [collegeId || null, cleanCollegeName, callerClubId || null]
        );

        const rows = clubsRes.rows;
        const currentClubRow = rows.find((r: any) => callerClubId && r.id === callerClubId);
        const resolvedCollegeName = currentClubRow?.collegeName || cleanCollegeName || rows[0]?.collegeName || "Your College";
        const resolvedCollegeId = currentClubRow?.collegeId || collegeId || rows[0]?.collegeId || null;

        if (rows.length === 0) {
            return {
                collegeName: resolvedCollegeName,
                collegeId: resolvedCollegeId,
                totalClubs: 0,
                clubs: [],
            };
        }

        const clubIds = rows.map((r: any) => r.id);

        // Batch fetch primary coordinators for rich preview
        const coordRes = await query(
            `SELECT
                c.id,
                c.club_id AS "clubId",
                c.name,
                c.role,
                c.department,
                c.image_url AS "imageUrl",
                c.is_primary AS "isPrimary",
                c.contact_email AS "contactEmail",
                c.linkedin_url AS "linkedinUrl",
                u.username AS "linkedUsername",
                u.avatar_url AS "linkedAvatarUrl"
             FROM club_coordinators c
             LEFT JOIN users u ON u.id = c.linked_user_id
             WHERE c.club_id = ANY($1::uuid[])
             ORDER BY c.display_order ASC, c.created_at ASC;`,
            [clubIds]
        );

        // Group coordinators by clubId
        const coordinatorsMap = new Map<string, any[]>();
        for (const coord of coordRes.rows) {
            if (!coordinatorsMap.has(coord.clubId)) {
                coordinatorsMap.set(coord.clubId, []);
            }
            coordinatorsMap.get(coord.clubId)!.push(coord);
        }

        // Batch fetch top achievements for preview
        const achRes = await query(
            `SELECT
                a.id,
                a.club_id AS "clubId",
                a.title,
                a.description,
                a.achievement_date AS "achievementDate",
                a.issuer,
                a.image_url AS "imageUrl",
                a.external_link AS "externalLink"
             FROM club_achievements a
             WHERE a.club_id = ANY($1::uuid[])
             ORDER BY a.display_order ASC, a.created_at ASC;`,
            [clubIds]
        );

        const achievementsMap = new Map<string, any[]>();
        for (const ach of achRes.rows) {
            if (!achievementsMap.has(ach.clubId)) {
                achievementsMap.set(ach.clubId, []);
            }
            achievementsMap.get(ach.clubId)!.push(ach);
        }

        const enrichedClubs = rows.map((c: any) => {
            const isCurrent = Boolean(callerClubId && c.id === callerClubId);
            return {
                ...c,
                memberCount: parseInt(c.memberCount, 10) || 0,
                eventsCount: parseInt(c.eventsCount, 10) || 0,
                achievementsCount: parseInt(c.achievementsCount, 10) || 0,
                coordinatorsCount: parseInt(c.coordinatorsCount, 10) || 0,
                isCurrentClub: isCurrent,
                coordinators: coordinatorsMap.get(c.id) || [],
                achievements: achievementsMap.get(c.id) || [],
            };
        });

        return {
            collegeName: resolvedCollegeName,
            collegeId: resolvedCollegeId,
            totalClubs: enrichedClubs.length,
            clubs: enrichedClubs,
        };
    }
}
