import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import redis from "../../redis/client.js";
import { query } from "../../database/client.js";
import { sendSecurityNotificationEmail } from "../email/resendService.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";

const OTP_TTL_SECONDS = 600; // 10 minutes
const COOLDOWN_SECONDS = 60; // 60 seconds cooldown between OTP requests
const MAX_HOURLY_REQUESTS = 6; // Max 6 requests per hour per user
const MAX_VERIFY_ATTEMPTS = 5; // Max 5 incorrect attempts before code invalidation
const JWT_SECRET = process.env.JWT_SECRET || "orbix_jwt_secret_fallback_2026";

export function maskEmail(email: string): string {
    if (!email || !email.includes("@")) return email || "";
    const [localPart, domain] = email.split("@");
    if (!localPart) return email;
    if (localPart.length <= 2) {
        return `${localPart[0]}***@${domain}`;
    }
    const visibleStart = localPart.slice(0, 2);
    const visibleEnd = localPart.slice(-1);
    return `${visibleStart}***${visibleEnd}@${domain}`;
}

export class TwoFactorAuthService {
    /**
     * Generates a cryptographically secure 6-digit numeric OTP.
     */
    private static generateSecureOtp(): string {
        return crypto.randomInt(100000, 1000000).toString();
    }

    /**
     * Generates SHA-256 hash for secure database/Redis storage.
     */
    private static hashOtp(otp: string): string {
        return crypto.createHash("sha256").update(otp.trim()).digest("hex");
    }

    /**
     * Sends an email OTP to verify and activate Two-Factor Authentication from Settings.
     */
    static async sendSetupOtp(params: {
        userId: string;
        email: string;
        name?: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, email, name = "Developer", ipAddress = "unknown", userAgent = "unknown" } = params;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Rate Limiting: Check cooldown in Redis
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`2fa:setup:cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const error: any = new Error(`Please wait ${cooldownTtl} seconds before requesting another verification code.`);
                error.statusCode = 429;
                error.cooldownRemainingSeconds = cooldownTtl;
                throw error;
            }

            // Hourly limit
            const hourlyKey = `2fa:setup:hourly:${userId}`;
            const hourlyCount = await redis.incr(hourlyKey);
            if (hourlyCount === 1) {
                await redis.expire(hourlyKey, 3600);
            }
            if (hourlyCount > MAX_HOURLY_REQUESTS) {
                const error: any = new Error("Hourly verification limit reached. Please try again later.");
                error.statusCode = 429;
                throw error;
            }
        }

        // 2. Generate secure 6-digit OTP
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        // 3. Cache in Redis
        if (redis && redis.status === "ready") {
            const payload = JSON.stringify({
                otpHash,
                email: normalizedEmail,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });
            await redis.set(`2fa:setup:${userId}`, payload, "EX", OTP_TTL_SECONDS);
            await redis.set(`2fa:setup:cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 4. Record in audit table
        try {
            await query(
                `INSERT INTO email_verification_otps
                 (user_id, email, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6);`,
                [userId, normalizedEmail, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch (dbErr) {
            console.warn("Notice: 2FA setup audit insert note:", dbErr);
        }

        // 5. Send Email via Resend
        const emailResult = await sendSecurityNotificationEmail({
            to: normalizedEmail,
            name,
            subject: `Orbix Two-Factor Authentication Code: ${otp}`,
            badgeText: "2FA Setup",
            headline: "Enable Two-Factor Authentication",
            message: "You requested to turn on Two-Factor Authentication for your Orbix account. Use the 6-digit code below to confirm your setup and secure your login.",
            otp,
            otpLabel: "2FA Activation Code",
            footerNotice: "If you did not request this, please change your password immediately.",
        });

        return {
            success: true,
            maskedEmail: maskEmail(normalizedEmail),
            cooldownSeconds: COOLDOWN_SECONDS,
            simulated: Boolean(emailResult.simulated),
            message: `Verification code sent to ${maskEmail(normalizedEmail)}.`,
        };
    }

    /**
     * Verifies the setup OTP and enables 2FA on the user's account.
     */
    static async verifySetupOtp(params: {
        userId: string;
        otp: string;
        ipAddress?: string;
    }) {
        const { userId, otp, ipAddress = "unknown" } = params;
        const submittedHash = this.hashOtp(otp);

        let cachedData: any = null;
        if (redis && redis.status === "ready") {
            const raw = await redis.get(`2fa:setup:${userId}`);
            if (raw) {
                try {
                    cachedData = JSON.parse(raw);
                } catch {
                    cachedData = null;
                }
            }
        }

        if (!cachedData) {
            const error: any = new Error("Verification code has expired or was not requested. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        const currentAttempts = (cachedData.attempts || 0) + 1;
        if (currentAttempts > MAX_VERIFY_ATTEMPTS) {
            if (redis && redis.status === "ready") {
                await redis.del(`2fa:setup:${userId}`);
            }
            const error: any = new Error("Too many incorrect attempts. Code invalidated. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        if (cachedData.otpHash !== submittedHash) {
            cachedData.attempts = currentAttempts;
            const remaining = MAX_VERIFY_ATTEMPTS - currentAttempts;
            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`2fa:setup:${userId}`);
                if (ttl > 0) {
                    await redis.set(`2fa:setup:${userId}`, JSON.stringify(cachedData), "EX", ttl);
                }
            }
            const error: any = new Error(
                remaining > 0
                    ? `Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
                    : "Too many incorrect attempts. Code invalidated. Please request a new code."
            );
            error.statusCode = 400;
            throw error;
        }

        // OTP is valid: Enable 2FA on users table
        const now = new Date();
        await query(
            `UPDATE users
             SET is_two_factor_enabled = true,
                 two_factor_enabled_at = $1
             WHERE id = $2;`,
            [now, userId]
        );

        // Audit log
        try {
            await query(
                `UPDATE email_verification_otps
                 SET status = 'verified', verified_at = $1
                 WHERE user_id = $2 AND status = 'pending' AND otp_hash = $3;`,
                [now, userId, submittedHash]
            );
        } catch {}

        // Cleanup Redis
        if (redis && redis.status === "ready") {
            await redis.del(`2fa:setup:${userId}`);
            await redis.del(`2fa:setup:cooldown:${userId}`);
        }

        // Invalidate user cache
        const userRes = await query(`SELECT email FROM users WHERE id = $1 LIMIT 1;`, [userId]);
        const email = userRes.rows[0]?.email;
        if (email) {
            await deleteUserDetailsCache(email);
            await invalidateAllUserCaches(email);
        }

        return {
            success: true,
            isTwoFactorEnabled: true,
            twoFactorEnabledAt: now.toISOString(),
            message: "Two-Factor Authentication has been successfully enabled on your account.",
        };
    }

    /**
     * Disables Two-Factor Authentication on the user's account after password verification.
     */
    static async disable2FA(params: {
        userId: string;
        password?: string;
        ipAddress?: string;
    }) {
        const { userId, password } = params;

        // Fetch user from DB
        const userRes = await query(
            `SELECT id, email, username, password FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const error: any = new Error("User not found.");
            error.statusCode = 404;
            throw error;
        }

        // If user has a password set, require password verification for security
        if (user.password && password) {
            const isPasswordValid = await bcrypt.compare(password, user.password);
            if (!isPasswordValid) {
                const error: any = new Error("Incorrect account password.");
                error.statusCode = 401;
                throw error;
            }
        }

        // Disable 2FA
        await query(
            `UPDATE users
             SET is_two_factor_enabled = false,
                 two_factor_enabled_at = NULL
             WHERE id = $1;`,
            [userId]
        );

        // Invalidate caches
        if (user.email) {
            await deleteUserDetailsCache(user.email);
            await invalidateAllUserCaches(user.email);
        }

        // Send alert email informing user that 2FA was deactivated
        if (user.email) {
            sendSecurityNotificationEmail({
                to: user.email,
                name: user.username || "Developer",
                subject: "Security Alert: Two-Factor Authentication Disabled",
                badgeText: "Security Update",
                headline: "Two-Factor Authentication Was Turned Off",
                message: "Two-Factor Authentication (2FA) was recently disabled on your Orbix account. If you did not make this change, please reset your password immediately.",
                isWarning: true,
                footerNotice: "Orbix Security Team",
            }).catch(() => {});
        }

        return {
            success: true,
            isTwoFactorEnabled: false,
            message: "Two-Factor Authentication has been disabled.",
        };
    }

    /**
     * Issues a short-lived 2FA challenge token and sends a sign-in OTP to the user's email.
     */
    static async initiateLogin2FA(params: {
        userId: string;
        email: string;
        username: string;
        name?: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, email, username, name = "Developer", ipAddress = "unknown", userAgent = "unknown" } = params;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Generate 2FA Challenge JWT Token (expires in 10 minutes)
        const challengeToken = jwt.sign(
            {
                sub: userId,
                email: normalizedEmail,
                username,
                type: "2fa_challenge",
                jti: crypto.randomUUID(),
            },
            JWT_SECRET,
            {
                expiresIn: "10m",
                issuer: "orbix",
                audience: "orbix-2fa",
            }
        );

        // 2. Generate 6-digit login OTP
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        // 3. Cache in Redis
        if (redis && redis.status === "ready") {
            const payload = JSON.stringify({
                otpHash,
                userId,
                email: normalizedEmail,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });
            await redis.set(`2fa:login:${userId}`, payload, "EX", OTP_TTL_SECONDS);
            await redis.set(`2fa:login:cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 4. Record audit entry in DB
        try {
            await query(
                `INSERT INTO email_verification_otps
                 (user_id, email, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6);`,
                [userId, normalizedEmail, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch {}

        // 5. Send Email via Resend
        const emailResult = await sendSecurityNotificationEmail({
            to: normalizedEmail,
            name: username || name,
            subject: `Orbix Login Verification Code: ${otp}`,
            badgeText: "2FA Login",
            headline: "Two-Factor Authentication Login Code",
            message: `A sign-in attempt was initiated for your Orbix account (@${username}). Enter the 6-digit verification code below to complete your login.`,
            otp,
            otpLabel: "Login Verification Code",
            footerNotice: "If you did not attempt to sign in, someone may know your password. Please secure your account.",
        });

        return {
            requires2FA: true,
            challengeToken,
            maskedEmail: maskEmail(normalizedEmail),
            cooldownSeconds: COOLDOWN_SECONDS,
            simulated: Boolean(emailResult.simulated),
            message: `Two-factor authentication code sent to ${maskEmail(normalizedEmail)}.`,
        };
    }

    /**
     * Resends the login 2FA OTP after verifying the challenge token and cooldown.
     */
    static async resendLoginOtp(params: {
        challengeToken: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { challengeToken, ipAddress = "unknown", userAgent = "unknown" } = params;

        let decoded: any;
        try {
            decoded = jwt.verify(challengeToken, JWT_SECRET, {
                issuer: "orbix",
                audience: "orbix-2fa",
            });
        } catch {
            const error: any = new Error("Session expired or invalid. Please sign in again.");
            error.statusCode = 401;
            throw error;
        }

        if (decoded.type !== "2fa_challenge" || !decoded.sub) {
            const error: any = new Error("Invalid challenge payload.");
            error.statusCode = 400;
            throw error;
        }

        const userId = decoded.sub;
        const normalizedEmail = (decoded.email || "").toLowerCase();
        const username = decoded.username || "";

        // Check cooldown in Redis
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`2fa:login:cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const error: any = new Error(`Please wait ${cooldownTtl} seconds before requesting another code.`);
                error.statusCode = 429;
                error.cooldownRemainingSeconds = cooldownTtl;
                throw error;
            }
        }

        // Generate new OTP
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        if (redis && redis.status === "ready") {
            const payload = JSON.stringify({
                otpHash,
                userId,
                email: normalizedEmail,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });
            await redis.set(`2fa:login:${userId}`, payload, "EX", OTP_TTL_SECONDS);
            await redis.set(`2fa:login:cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        try {
            await query(
                `INSERT INTO email_verification_otps
                 (user_id, email, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6);`,
                [userId, normalizedEmail, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch {}

        await sendSecurityNotificationEmail({
            to: normalizedEmail,
            name: username || "Developer",
            subject: `Orbix Login Verification Code: ${otp}`,
            badgeText: "2FA Login",
            headline: "Two-Factor Authentication Login Code",
            message: `A sign-in attempt was initiated for your Orbix account (@${username}). Enter the 6-digit verification code below to complete your login.`,
            otp,
            otpLabel: "Login Verification Code",
            footerNotice: "If you did not attempt to sign in, someone may know your password. Please secure your account.",
        });

        return {
            success: true,
            maskedEmail: maskEmail(normalizedEmail),
            cooldownSeconds: COOLDOWN_SECONDS,
            message: `A new verification code was sent to ${maskEmail(normalizedEmail)}.`,
        };
    }

    /**
     * Verifies the 2FA login OTP using the challenge token, returning the authenticated user session.
     */
    static async verifyLoginOtp(params: {
        challengeToken: string;
        otp: string;
        ipAddress?: string;
    }) {
        const { challengeToken, otp } = params;

        let decoded: any;
        try {
            decoded = jwt.verify(challengeToken, JWT_SECRET, {
                issuer: "orbix",
                audience: "orbix-2fa",
            });
        } catch {
            const error: any = new Error("Login verification session expired. Please sign in again.");
            error.statusCode = 401;
            throw error;
        }

        if (decoded.type !== "2fa_challenge" || !decoded.sub) {
            const error: any = new Error("Invalid challenge payload.");
            error.statusCode = 400;
            throw error;
        }

        const userId = decoded.sub;
        const submittedHash = this.hashOtp(otp);

        let cachedData: any = null;
        if (redis && redis.status === "ready") {
            const raw = await redis.get(`2fa:login:${userId}`);
            if (raw) {
                try {
                    cachedData = JSON.parse(raw);
                } catch {
                    cachedData = null;
                }
            }
        }

        if (!cachedData) {
            const error: any = new Error("Verification code has expired. Please request a new code or sign in again.");
            error.statusCode = 400;
            throw error;
        }

        const currentAttempts = (cachedData.attempts || 0) + 1;
        if (currentAttempts > MAX_VERIFY_ATTEMPTS) {
            if (redis && redis.status === "ready") {
                await redis.del(`2fa:login:${userId}`);
            }
            const error: any = new Error("Too many incorrect attempts. Code invalidated. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        if (cachedData.otpHash !== submittedHash) {
            cachedData.attempts = currentAttempts;
            const remaining = MAX_VERIFY_ATTEMPTS - currentAttempts;
            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`2fa:login:${userId}`);
                if (ttl > 0) {
                    await redis.set(`2fa:login:${userId}`, JSON.stringify(cachedData), "EX", ttl);
                }
            }
            const error: any = new Error(
                remaining > 0
                    ? `Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
                    : "Too many incorrect attempts. Code invalidated. Please request a new code."
            );
            error.statusCode = 400;
            throw error;
        }

        // Clean up Redis
        if (redis && redis.status === "ready") {
            await redis.del(`2fa:login:${userId}`);
            await redis.del(`2fa:login:cooldown:${userId}`);
        }

        // Fetch user from DB
        const result = await query(
            `SELECT
                id,
                username,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                termsaccepted AS "termsAccepted",
                account_type AS "accountType",
                headline,
                bio,
                avatar_url AS "avatarUrl",
                photo_url AS "photoUrl",
                previous_photo_url AS "previousPhotoUrl",
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
                COALESCE(is_email_verified, false) AS "isEmailVerified",
                email_verified_at AS "emailVerifiedAt",
                COALESCE(is_two_factor_enabled, false) AS "isTwoFactorEnabled",
                two_factor_enabled_at AS "twoFactorEnabledAt",
                created_at AS "createdAt"
            FROM users
            WHERE id = $1
            LIMIT 1;`,
            [userId]
        );

        const user = result.rows[0];
        if (!user) {
            const error: any = new Error("User record not found.");
            error.statusCode = 404;
            throw error;
        }

        return {
            success: true,
            user,
        };
    }
}
