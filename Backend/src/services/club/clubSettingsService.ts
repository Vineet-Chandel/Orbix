import bcrypt from "bcrypt";
import { query, pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { sendSecurityNotificationEmail } from "../email/resendService.js";
import { ManageAccountsService } from "../account/manageAccountsService.js";

export class ClubSettingsService {
    /**
     * Resolves the authoritative verified_clubs record and linked user record for the given auth user.
     */
    static async getClubAndUser(userId: string) {
        const clubRes = await query(
            `SELECT vc.id, vc.auth_user_id, vc.name, COALESCE(u.username, vc.slug) AS slug, 
                    vc.category, vc.college_name, vc.college_city, vc.college_state, vc.college_country,
                    vc.short_description, vc.about, vc.mission, vc.vision, vc.founded_year,
                    vc.operating_status, vc.focus_areas, vc.logo_url, vc.cover_image_url,
                    vc.website_url, vc.public_email, vc.contact_phone, vc.social_links,
                    vc.is_active, vc.verified_at, vc.created_at, vc.updated_at,
                    COALESCE(vc.profile_visibility, 'public') AS profile_visibility,
                    COALESCE(vc.publication_status, 'published') AS publication_status,
                    COALESCE(vc.recruitment_status, 'closed') AS recruitment_status,
                    vc.recruitment_announcement, vc.recruitment_url
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE vc.auth_user_id = $1 LIMIT 1;`,
            [userId]
        );

        const club = clubRes.rows[0];
        if (!club) {
            const err: any = new Error("No verified club organization found for this account.");
            err.statusCode = 404;
            throw err;
        }

        const userRes = await query(
            `SELECT id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName",
                    is_email_verified AS "isEmailVerified", email_verified_at AS "emailVerifiedAt",
                    is_two_factor_enabled AS "isTwoFactorEnabled", created_at AS "createdAt",
                    phone, is_phone_verified AS "isPhoneVerified"
             FROM users
             WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];

        return { club, user };
    }

    /**
     * Fetches comprehensive status for Club Settings:
     * - Club metadata and branding
     * - User identity and email verification
     * - Monthly change quotas (email & slug)
     * - Verification badge standing
     * - Counts (events, team members, unread inbox)
     */
    static async getClubSettingsStatus(userId: string) {
        const { club, user } = await this.getClubAndUser(userId);

        // Fetch monthly quotas from ManageAccountsService
        const [emailQuota, slugQuota] = await Promise.all([
            ManageAccountsService.getMonthlyQuota(userId, "email"),
            ManageAccountsService.getMonthlyQuota(userId, "username"),
        ]);

        // Fetch counts for club events and team members
        const [eventsRes, membersRes, unreadRes] = await Promise.all([
            query(`SELECT COUNT(*)::int AS count FROM club_events WHERE club_id = $1;`, [club.id]),
            query(`SELECT COUNT(*)::int AS count FROM club_memberships WHERE club_id = $1 AND status = 'active';`, [club.id]),
            query(`SELECT COUNT(*)::int AS count FROM club_inbox_messages WHERE club_id = $1 AND is_read = false AND sender_type = 'student';`, [club.id]),
        ]);

        const eventsCount = eventsRes.rows[0]?.count || 0;
        const teamMembersCount = membersRes.rows[0]?.count || 0;
        const unreadInboxCount = unreadRes.rows[0]?.count || 0;

        return {
            club: {
                ...club,
                isPublic: club.profile_visibility === "public",
            },
            user: {
                ...user,
                displayName: club.name,
                primaryEmail: user?.gmail || club.public_email || "",
            },
            verification: {
                isVerifiedClub: Boolean(club.is_active),
                verifiedAt: club.verified_at,
                collegeName: club.college_name,
                category: club.category,
                standing: club.is_active ? "Good Standing" : "Restricted",
                tier: "Collegiate Verified Organization",
            },
            monthlyLimits: {
                email: emailQuota,
                username: slugQuota,
            },
            stats: {
                eventsCount,
                teamMembersCount,
                unreadInboxCount,
            },
        };
    }

    /**
     * Updates club showcase privacy controls (public, private, unlisted).
     */
    static async updateClubPrivacy(userId: string, data: {
        profileVisibility?: "public" | "unlisted" | "private";
        isPublic?: boolean;
        recruitmentStatus?: "open" | "closed" | "upcoming";
    }) {
        const { club } = await this.getClubAndUser(userId);

        let targetVisibility = data.profileVisibility;
        if (typeof data.isPublic === "boolean") {
            targetVisibility = data.isPublic ? "public" : "private";
        }

        if (!targetVisibility || !["public", "unlisted", "private"].includes(targetVisibility)) {
            targetVisibility = "public";
        }

        const validRecruitment = data.recruitmentStatus && ["open", "closed", "upcoming"].includes(data.recruitmentStatus)
            ? data.recruitmentStatus
            : club.recruitment_status;

        const updateRes = await query(
            `UPDATE verified_clubs
             SET profile_visibility = $1,
                 recruitment_status = $2,
                 updated_at = NOW()
             WHERE id = $3
             RETURNING id, name, slug, profile_visibility, recruitment_status, updated_at;`,
            [targetVisibility, validRecruitment, club.id]
        );

        // Invalidate club profile cache if Redis is configured
        if (redis && redis.status === "ready") {
            await redis.del(`club:profile:${club.id}`);
            await redis.del(`club:public:${club.slug}`);
        }

        const updated = updateRes.rows[0];
        return {
            success: true,
            message: `Club showcase visibility updated to ${targetVisibility}.`,
            club: {
                ...updated,
                isPublic: updated.profile_visibility === "public",
            },
        };
    }

    /**
     * Changes password for an authenticated account (both club and personal users).
     * Validates current password, checks complexity, hashes new password with bcrypt,
     * updates database, invalidates cache, and dispatches security alert email.
     */
    static async changePassword(userId: string, currentPassword: string, newPassword: string, confirmPassword?: string) {
        if (!currentPassword || typeof currentPassword !== "string") {
            const err: any = new Error("Current password is required.");
            err.statusCode = 400;
            throw err;
        }

        if (!newPassword || typeof newPassword !== "string") {
            const err: any = new Error("New password is required.");
            err.statusCode = 400;
            throw err;
        }

        if (confirmPassword && newPassword !== confirmPassword) {
            const err: any = new Error("New passwords do not match.");
            err.statusCode = 400;
            throw err;
        }

        if (newPassword.length < 8) {
            const err: any = new Error("New password must be at least 8 characters long.");
            err.statusCode = 400;
            throw err;
        }

        const hasLetter = /[a-zA-Z]/.test(newPassword);
        const hasDigit = /\d/.test(newPassword);
        if (!hasLetter || !hasDigit) {
            const err: any = new Error("New password must contain a combination of letters and numbers.");
            err.statusCode = 400;
            throw err;
        }

        if (currentPassword === newPassword) {
            const err: any = new Error("New password cannot be identical to your current password.");
            err.statusCode = 400;
            throw err;
        }

        // Fetch current password hash from public.users
        const userRes = await query(
            `SELECT id, username, email, password, firstname FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user || !user.password) {
            const err: any = new Error("User credentials record not found.");
            err.statusCode = 404;
            throw err;
        }

        // Validate current password
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            const err: any = new Error("Incorrect current password. Please verify and try again.");
            err.statusCode = 401;
            throw err;
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Atomic commit
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // Update public.users
            await client.query(
                `UPDATE users 
                 SET password = $1, updated_at = NOW() 
                 WHERE id = $2;`,
                [hashedPassword, userId]
            );

            // Synchronize auth.users if Supabase auth table exists
            try {
                await client.query(
                    `UPDATE auth.users 
                     SET encrypted_password = $1, updated_at = NOW() 
                     WHERE id = $2;`,
                    [hashedPassword, userId]
                );
            } catch {
                // auth.users may not exist in pure local postgres
            }

            await client.query("COMMIT;");
        } catch (dbErr) {
            await client.query("ROLLBACK;");
            throw dbErr;
        } finally {
            client.release();
        }

        // Invalidate Redis user cache
        if (user.email) {
            await deleteUserDetailsCache(user.email).catch(() => {});
        }

        // Send security alert notification email
        sendSecurityNotificationEmail({
            to: user.email,
            name: user.firstname || user.username || "Club Representative",
            subject: "Your Orbix Club Password Was Changed",
            badgeText: "Security Alert",
            headline: "Password Changed Successfully",
            message: "The password for your Orbix club account was recently changed. If you performed this action, no further steps are necessary. If you did NOT change your password, please contact Orbix Security immediately.",
            isWarning: true,
            footerNotice: "This is an automated security alert sent to the registered primary email for your organization.",
        }).catch((err) => {
            console.warn("Notice: Security notification email warning:", err.message || err);
        });

        return {
            success: true,
            message: "Password updated successfully. Please use your new password next time you sign in.",
        };
    }

    /**
     * Generates a complete GDPR / Organization data export archive for the club.
     */
    static async exportClubData(userId: string) {
        const { club, user } = await this.getClubAndUser(userId);

        const [eventsRes, membersRes, coordinatorsRes, achievementsRes] = await Promise.all([
            query(`SELECT * FROM club_events WHERE club_id = $1 ORDER BY created_at DESC;`, [club.id]),
            query(`SELECT * FROM club_memberships WHERE club_id = $1 ORDER BY created_at DESC;`, [club.id]),
            query(`SELECT * FROM club_coordinators WHERE club_id = $1 ORDER BY display_order ASC;`, [club.id]),
            query(`SELECT * FROM club_achievements WHERE club_id = $1 ORDER BY display_order ASC;`, [club.id]),
        ]);

        return {
            exportId: crypto.randomUUID(),
            generatedAt: new Date().toISOString(),
            organization: {
                id: club.id,
                name: club.name,
                slug: club.slug,
                category: club.category,
                collegeName: club.college_name,
                publicEmail: club.public_email,
                contactPhone: club.contact_phone,
                registeredEmail: user?.gmail,
                verifiedAt: club.verified_at,
            },
            coordinators: coordinatorsRes.rows,
            achievements: achievementsRes.rows,
            events: eventsRes.rows,
            memberships: membersRes.rows,
        };
    }
}
