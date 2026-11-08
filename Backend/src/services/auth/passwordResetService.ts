import crypto from "crypto";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import redis from "../../redis/client.js";
import { query } from "../../database/client.js";
import { maskEmail } from "./twoFactorAuthService.js";
import {
    sendPasswordResetOtpEmail,
    sendPasswordResetSuccessEmail,
} from "../email/resendService.js";
import {
    revokeAllSessions,
    recordSecurityEvent,
} from "../session/sessionService.js";
import { maskIpAddress } from "../session/deviceParser.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";
import { hasWeakPattern } from "../../validators/weakPatterns.js";

const OTP_TTL_SECONDS = 600; // 10 minutes
const COOLDOWN_SECONDS = 60; // 60 seconds between resend requests
const MAX_HOURLY_REQUESTS = 5; // Max 5 requests per hour per user
const MAX_VERIFY_ATTEMPTS = 5; // Max 5 incorrect guesses before invalidating OTP
const PROOF_TOKEN_TTL_SECONDS = 900; // 15 minutes to complete password change

const JWT_SECRET = process.env.JWT_SECRET || "orbix_secret_fallback_key_2026";

export interface FindAccountParams {
    identifier: string;
    accountType?: "personal" | "club";
    ipAddress?: string;
    userAgent?: string;
}

export interface ResendOtpParams {
    resetSessionToken: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface VerifyResetOtpParams {
    resetSessionToken: string;
    otp: string;
    ipAddress?: string;
    userAgent?: string;
}

export interface ResetPasswordParams {
    resetProofToken: string;
    newPassword: string;
    confirmPassword?: string;
    ipAddress?: string;
    userAgent?: string;
}

export class PasswordResetService {
    /**
     * Generates a cryptographically secure 6-digit numeric OTP.
     */
    private static generateSecureOtp(): string {
        return crypto.randomInt(100000, 1000000).toString();
    }

    /**
     * Computes SHA-256 hash of OTP for storage.
     */
    private static hashOtp(otp: string): string {
        return crypto.createHash("sha256").update(otp.trim()).digest("hex");
    }

    /**
     * Constant-time string comparison against dummy hash to prevent user enumeration timing attacks.
     */
    private static async dummyTimingComparison(): Promise<void> {
        try {
            await bcrypt.compare("dummy_password_timing_pad", "$2b$10$XN4E5x6gT3x7l3eUaR9UOuQYx8wO1bU1Jv3bT6D2p7t3Z6U1q9F4W");
        } catch {}
    }

    /**
     * Resolves a user account from username, email, or club credentials.
     */
    static async resolveUser(identifier: string, accountType: "personal" | "club" = "personal") {
        const cleanId = (identifier || "").trim().toLowerCase();
        if (!cleanId) return null;

        // 1. If in club mode, first check verified_clubs and club_verification_requests
        if (accountType === "club") {
            const clubLookup = await query(
                `SELECT auth_user_id FROM verified_clubs 
                 WHERE LOWER(slug) = LOWER($1) 
                    OR LOWER(public_email) = LOWER($1)
                    OR LOWER(name) = LOWER($1)
                    OR LOWER(REPLACE(slug, '-', '')) = LOWER(REPLACE($1, '-', ''))
                    OR LOWER(REPLACE(name, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
                 LIMIT 1;`,
                [cleanId]
            );

            let targetUserId: string | null = clubLookup.rows[0]?.auth_user_id || null;

            if (!targetUserId) {
                const reqLookup = await query(
                    `SELECT auth_user_id FROM club_verification_requests 
                     WHERE LOWER(contact_email) = LOWER($1) 
                        OR LOWER(college_official_email) = LOWER($1)
                        OR LOWER(club_name) = LOWER($1)
                        OR LOWER(REPLACE(club_name, ' ', '')) = LOWER(REPLACE($1, ' ', ''))
                     LIMIT 1;`,
                    [cleanId]
                );
                targetUserId = reqLookup.rows[0]?.auth_user_id || null;
            }

            if (targetUserId) {
                const clubUserRes = await query(
                    `SELECT id, email, username, firstname AS "firstName", lastname AS "lastName",
                            photo_url AS "photoUrl", avatar_url AS "avatarUrl", password AS password_hash
                     FROM users
                     WHERE id = $1
                     LIMIT 1;`,
                    [targetUserId]
                );
                if (clubUserRes.rows[0]) {
                    return { ...clubUserRes.rows[0], matchedVia: "club_profile" };
                }
            }
        }

        // 2. Query users table directly by email or username
        const userRes = await query(
            `SELECT id, email, username, firstname AS "firstName", lastname AS "lastName",
                    photo_url AS "photoUrl", avatar_url AS "avatarUrl", password AS password_hash
             FROM users
             WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
             LIMIT 1;`,
            [cleanId]
        );

        if (userRes.rows[0]) {
            return { ...userRes.rows[0], matchedVia: "user_credential" };
        }

        // 3. Fallback: If user searched in personal mode but entered a club slug/name, or vice versa
        const fallbackClubLookup = await query(
            `SELECT auth_user_id FROM verified_clubs 
             WHERE LOWER(slug) = LOWER($1) 
                OR LOWER(public_email) = LOWER($1)
                OR LOWER(name) = LOWER($1)
             LIMIT 1;`,
            [cleanId]
        );
        const fallbackUserId = fallbackClubLookup.rows[0]?.auth_user_id;
        if (fallbackUserId) {
            const fallbackRes = await query(
                `SELECT id, email, username, firstname AS "firstName", lastname AS "lastName",
                        photo_url AS "photoUrl", avatar_url AS "avatarUrl", password AS password_hash
                 FROM users
                 WHERE id = $1
                 LIMIT 1;`,
                [fallbackUserId]
            );
            if (fallbackRes.rows[0]) {
                return { ...fallbackRes.rows[0], matchedVia: "fallback_club" };
            }
        }

        return null;
    }

    /**
     * Step 1: Find Account and Dispatch Reset OTP.
     * Aligned with Instagram account recovery:
     * - Searches account by username or email.
     * - If found, generates 6-digit OTP and sends to registered email.
     * - Returns masked email (e.g. pk***5@gmail.com) with stars so user gets an idea which email is used.
     */
    static async findAccountAndSendOtp(params: FindAccountParams) {
        const { identifier, accountType = "personal", ipAddress = "unknown", userAgent = "unknown" } = params;

        if (!identifier || typeof identifier !== "string" || identifier.trim().length < 2) {
            const err: any = new Error(
                accountType === "club"
                    ? "Please enter your club username, slug, or registered email address."
                    : "Please enter your username or email address."
            );
            err.statusCode = 400;
            throw err;
        }

        const user = await this.resolveUser(identifier, accountType);

        if (!user || !user.email) {
            // Mitigate timing side-channels
            await this.dummyTimingComparison();
            const err: any = new Error(
                accountType === "club"
                    ? "No club account found matching this username or email."
                    : "No account found matching this username or email."
            );
            err.statusCode = 404;
            throw err;
        }

        const userId = user.id;
        const normalizedEmail = user.email.toLowerCase().trim();

        // Rate Limiting Check: 60-second cooldown in Redis
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`otp:reset_cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const err: any = new Error(`Please wait ${cooldownTtl} seconds before requesting another verification code.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = cooldownTtl;
                throw err;
            }

            // Hourly limit: Max 5 requests per hour
            const hourlyKey = `otp:reset_hourly:${userId}`;
            const hourlyCount = await redis.incr(hourlyKey);
            if (hourlyCount === 1) {
                await redis.expire(hourlyKey, 3600);
            }
            if (hourlyCount > MAX_HOURLY_REQUESTS) {
                const err: any = new Error("Password reset request limit reached (5 codes/hr). Please try again later or contact support.");
                err.statusCode = 429;
                throw err;
            }
        }

        // Generate 6-digit cryptographically secure OTP
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        // Store OTP in Redis with 10-minute TTL
        if (redis && redis.status === "ready") {
            const redisPayload = JSON.stringify({
                userId,
                email: normalizedEmail,
                username: user.username,
                otpHash,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
                accountType,
            });

            await redis.set(`otp:password_reset:${userId}`, redisPayload, "EX", OTP_TTL_SECONDS);
            await redis.set(`otp:reset_cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // Record in PostgreSQL audit table
        try {
            await query(
                `UPDATE email_verification_otps
                 SET status = 'expired'
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            await query(
                `INSERT INTO email_verification_otps
                 (user_id, email, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6);`,
                [userId, normalizedEmail, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch (dbErr: any) {
            console.warn("[PasswordResetService] Failed to record in email_verification_otps:", dbErr.message);
        }

        // Send Email via Resend / SMTP
        const sendResult = await sendPasswordResetOtpEmail({
            to: normalizedEmail,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Developer",
            otp,
            accountType,
        });

        // Always log OTP in non-production or when simulated
        if (process.env.NODE_ENV !== "production" || sendResult.simulated || sendResult.sandboxRestricted) {
            console.log(`\n======================================================`);
            console.log(`[Orbix Password Reset OTP] Destination: ${normalizedEmail}`);
            console.log(`[Orbix Password Reset OTP] 6-Digit Code: >>> ${otp} <<<`);
            console.log(`======================================================\n`);
        }

        // Generate temporary resetSessionToken for client state tracking
        const resetSessionToken = jwt.sign(
            {
                sub: userId,
                action: "forgot_password_pending",
                accountType,
                exp: Math.floor(Date.now() / 1000) + OTP_TTL_SECONDS,
            },
            JWT_SECRET
        );

        const masked = maskEmail(normalizedEmail);

        return {
            success: true,
            message: `A 6-digit verification code has been sent to ${masked}.`,
            maskedEmail: masked,
            userPreview: {
                username: user.username,
                displayName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username,
                avatarUrl: user.avatarUrl || user.photoUrl || null,
            },
            resetSessionToken,
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresInSeconds: OTP_TTL_SECONDS,
            simulated: Boolean(sendResult.simulated || sendResult.sandboxRestricted),
            // Expose devOtp in development so local testing can proceed without real SMTP
            devOtp: (process.env.NODE_ENV !== "production" || sendResult.simulated || sendResult.sandboxRestricted) ? otp : undefined,
        };
    }

    /**
     * Resends a new OTP to the user's email if cooldown has elapsed.
     */
    static async resendResetOtp(params: ResendOtpParams) {
        const { resetSessionToken, ipAddress = "unknown", userAgent = "unknown" } = params;

        if (!resetSessionToken) {
            const err: any = new Error("Invalid or missing session token. Please start the password reset flow again.");
            err.statusCode = 400;
            throw err;
        }

        let decoded: any;
        try {
            decoded = jwt.verify(resetSessionToken, JWT_SECRET);
        } catch {
            const err: any = new Error("Password reset session has expired. Please restart the recovery flow.");
            err.statusCode = 401;
            throw err;
        }

        const userId = decoded.sub;
        if (!userId) {
            const err: any = new Error("Invalid session token payload.");
            err.statusCode = 400;
            throw err;
        }

        const userRes = await query(
            `SELECT id, email, username, firstname AS "firstName", lastname AS "lastName"
             FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        const normalizedEmail = user.email.toLowerCase().trim();

        // Check Cooldown in Redis
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`otp:reset_cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const err: any = new Error(`Please wait ${cooldownTtl} seconds before requesting a new code.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = cooldownTtl;
                throw err;
            }

            // Check Hourly limit
            const hourlyKey = `otp:reset_hourly:${userId}`;
            const hourlyCount = await redis.incr(hourlyKey);
            if (hourlyCount > MAX_HOURLY_REQUESTS) {
                const err: any = new Error("Hourly verification request limit reached. Please try again later.");
                err.statusCode = 429;
                throw err;
            }
        }

        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        if (redis && redis.status === "ready") {
            const redisPayload = JSON.stringify({
                userId,
                email: normalizedEmail,
                username: user.username,
                otpHash,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
                accountType: decoded.accountType || "personal",
            });

            await redis.set(`otp:password_reset:${userId}`, redisPayload, "EX", OTP_TTL_SECONDS);
            await redis.set(`otp:reset_cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        try {
            await query(
                `UPDATE email_verification_otps
                 SET status = 'expired'
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            await query(
                `INSERT INTO email_verification_otps
                 (user_id, email, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, $3, 'pending', 0, $4, $5, $6);`,
                [userId, normalizedEmail, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch {}

        const sendResult = await sendPasswordResetOtpEmail({
            to: normalizedEmail,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Developer",
            otp,
            accountType: decoded.accountType || "personal",
        });

        if (process.env.NODE_ENV !== "production" || sendResult.simulated || sendResult.sandboxRestricted) {
            console.log(`[Orbix Password Reset Resend OTP] >>> ${otp} <<< for ${normalizedEmail}`);
        }

        const masked = maskEmail(normalizedEmail);

        return {
            success: true,
            message: `A new 6-digit code has been sent to ${masked}.`,
            maskedEmail: masked,
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresInSeconds: OTP_TTL_SECONDS,
            devOtp: (process.env.NODE_ENV !== "production" || sendResult.simulated || sendResult.sandboxRestricted) ? otp : undefined,
        };
    }

    /**
     * Step 2: Verify the 6-Digit OTP.
     * Upon success, generates a single-use cryptographically signed resetProofToken (15 min TTL).
     */
    static async verifyResetOtp(params: VerifyResetOtpParams) {
        const { resetSessionToken, otp, ipAddress = "unknown" } = params;

        if (!resetSessionToken) {
            const err: any = new Error("Recovery session token is required.");
            err.statusCode = 400;
            throw err;
        }

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            const err: any = new Error("Please enter a valid 6-digit numeric verification code.");
            err.statusCode = 400;
            throw err;
        }

        let decoded: any;
        try {
            decoded = jwt.verify(resetSessionToken, JWT_SECRET);
        } catch {
            const err: any = new Error("Verification session has expired. Please request a new code.");
            err.statusCode = 401;
            throw err;
        }

        const userId = decoded.sub;
        const incomingHash = this.hashOtp(otp.trim());

        let cachedData: {
            userId: string;
            email: string;
            username: string;
            otpHash: string;
            attempts: number;
            expiresAt: string;
            accountType?: string;
        } | null = null;

        // 1. Check Redis first
        if (redis && redis.status === "ready") {
            const raw = await redis.get(`otp:password_reset:${userId}`);
            if (raw) {
                try {
                    cachedData = JSON.parse(raw);
                } catch {}
            }
        }

        // 2. Fallback to PostgreSQL
        if (!cachedData) {
            const dbOtpRes = await query(
                `SELECT id, email, otp_hash AS "otpHash", attempts, expires_at AS "expiresAt"
                 FROM email_verification_otps
                 WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1;`,
                [userId]
            );

            if (dbOtpRes.rows[0]) {
                const row = dbOtpRes.rows[0];
                cachedData = {
                    userId,
                    email: row.email,
                    username: decoded.username || "",
                    otpHash: row.otpHash,
                    attempts: row.attempts,
                    expiresAt: row.expiresAt.toISOString(),
                    accountType: decoded.accountType || "personal",
                };
            }
        }

        if (!cachedData) {
            const err: any = new Error("Verification code has expired or is invalid. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        // 3. Brute force check: Maximum 5 attempts
        if (cachedData.attempts >= MAX_VERIFY_ATTEMPTS) {
            if (redis && redis.status === "ready") {
                await redis.del(`otp:password_reset:${userId}`);
            }
            await query(
                `UPDATE email_verification_otps
                 SET status = 'failed'
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            const err: any = new Error("Too many incorrect attempts. Code invalidated for security. Please request a new code.");
            err.statusCode = 400;
            throw err;
        }

        // 4. Constant-time comparison
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(cachedData.otpHash, "hex"),
            Buffer.from(incomingHash, "hex")
        );

        if (!isMatch) {
            const newAttempts = cachedData.attempts + 1;
            const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`otp:password_reset:${userId}`);
                if (ttl > 0) {
                    cachedData.attempts = newAttempts;
                    await redis.set(`otp:password_reset:${userId}`, JSON.stringify(cachedData), "EX", ttl);
                }
            }

            await query(
                `UPDATE email_verification_otps
                 SET attempts = attempts + 1
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            const err: any = new Error(
                remaining > 0
                    ? `Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
                    : "Too many incorrect attempts. Code invalidated. Please request a new code."
            );
            err.statusCode = 400;
            throw err;
        }

        // 5. Successful Verification
        await query(
            `UPDATE email_verification_otps
             SET status = 'verified', verified_at = NOW()
             WHERE user_id = $1 AND status = 'pending';`,
            [userId]
        );

        // Clear active OTP from Redis
        if (redis && redis.status === "ready") {
            await redis.del(`otp:password_reset:${userId}`);
            await redis.del(`otp:reset_cooldown:${userId}`);
        }

        // Issue single-use cryptographically signed proof token (JWT with random jti nonce)
        const jti = crypto.randomBytes(24).toString("hex");

        if (redis && redis.status === "ready") {
            await redis.set(`password_reset_proof:${jti}`, userId, "EX", PROOF_TOKEN_TTL_SECONDS);
        }

        const resetProofToken = jwt.sign(
            {
                sub: userId,
                email: cachedData.email,
                accountType: cachedData.accountType || decoded.accountType || "personal",
                action: "password_reset_verified",
                jti,
                exp: Math.floor(Date.now() / 1000) + PROOF_TOKEN_TTL_SECONDS,
            },
            JWT_SECRET
        );

        return {
            success: true,
            message: "Verification successful! You can now choose a new password.",
            resetProofToken,
            expiresInSeconds: PROOF_TOKEN_TTL_SECONDS,
        };
    }

    /**
     * Step 3: Set New Password.
     * Enforces identical strength criteria as the signup page:
     * - Minimum 8 characters, maximum 128 characters.
     * - Upper, lower, number, symbol.
     * - No weak dictionary / keyboard / numeric patterns.
     * - Cannot be identical to current password.
     * - Revokes all existing active sessions.
     * - Invalidates user caches.
     * - Dispatches confirmation security notice.
     */
    static async resetPassword(params: ResetPasswordParams) {
        const { resetProofToken, newPassword, confirmPassword, ipAddress = "unknown", userAgent = "unknown" } = params;

        if (!resetProofToken) {
            const err: any = new Error("Verification proof is required to set a new password.");
            err.statusCode = 400;
            throw err;
        }

        let decoded: any;
        try {
            decoded = jwt.verify(resetProofToken, JWT_SECRET);
        } catch {
            const err: any = new Error("Password reset session has expired or is invalid. Please verify again.");
            err.statusCode = 401;
            throw err;
        }

        if (decoded.action !== "password_reset_verified" || !decoded.jti || !decoded.sub) {
            const err: any = new Error("Invalid password reset token.");
            err.statusCode = 400;
            throw err;
        }

        const userId = decoded.sub;
        const jti = decoded.jti;

        // Verify nonce single-use in Redis
        if (redis && redis.status === "ready") {
            const storedUserId = await redis.get(`password_reset_proof:${jti}`);
            if (!storedUserId || storedUserId !== userId) {
                const err: any = new Error("This password reset proof has already been used or expired. Please start again.");
                err.statusCode = 401;
                throw err;
            }
        }

        // Validate Passwords Match
        if (!newPassword || typeof newPassword !== "string") {
            const err: any = new Error("New password is required.");
            err.statusCode = 400;
            throw err;
        }

        if (confirmPassword !== undefined && newPassword !== confirmPassword) {
            const err: any = new Error("New passwords do not match.");
            err.statusCode = 400;
            throw err;
        }

        // Validate Password Strength (matching signup page criteria)
        if (newPassword.length < 8) {
            const err: any = new Error("Password must be at least 8 characters long.");
            err.statusCode = 400;
            throw err;
        }

        if (newPassword.length > 128) {
            const err: any = new Error("Password must not exceed 128 characters.");
            err.statusCode = 400;
            throw err;
        }

        const hasUpper = /[A-Z]/.test(newPassword);
        const hasLower = /[a-z]/.test(newPassword);
        const hasNumber = /[0-9]/.test(newPassword);
        const hasSymbol = /[^A-Za-z0-9]/.test(newPassword);

        if (!hasUpper || !hasLower || !hasNumber || !hasSymbol) {
            const err: any = new Error(
                "Password must include at least one uppercase letter, one lowercase letter, one number, and one special character."
            );
            err.statusCode = 400;
            throw err;
        }

        if (hasWeakPattern(newPassword)) {
            const err: any = new Error("Password contains a common weak pattern (e.g. sequence, keyboard pattern, or dictionary word).");
            err.statusCode = 400;
            throw err;
        }

        // Fetch User and Check against current password
        const userRes = await query(
            `SELECT id, email, username, firstname AS "firstName", lastname AS "lastName", password AS password_hash
             FROM users
             WHERE id = $1
             LIMIT 1;`,
            [userId]
        );

        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        if (user.password_hash) {
            const isIdentical = await bcrypt.compare(newPassword, user.password_hash);
            if (isIdentical) {
                const err: any = new Error("New password cannot be identical to your current password. Please choose a different password.");
                err.statusCode = 400;
                throw err;
            }
        }

        // Hash new password securely with bcrypt
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update database
        await query(
            `UPDATE users
             SET password = $1,
                 updated_at = NOW()
             WHERE id = $2;`,
            [hashedPassword, userId]
        );

        // Consume the reset proof token from Redis so it can never be replayed
        if (redis && redis.status === "ready") {
            await redis.del(`password_reset_proof:${jti}`);
        }

        // Invalidate all user caches
        await deleteUserDetailsCache(user.email);
        if (user.username) await deleteUserDetailsCache(user.username);
        await deleteUserDetailsCache(userId);
        await invalidateAllUserCaches({
            id: userId,
            username: user.username,
            email: user.email,
            gmail: user.email,
        });

        // Terminate all existing sessions across all devices for this user
        const maskedIp = maskIpAddress(ipAddress);
        try {
            await revokeAllSessions(userId, "password_reset");
        } catch (sessErr: any) {
            console.warn("[PasswordResetService] Session revocation notice:", sessErr.message);
        }

        // Record Security Event in Audit Log
        try {
            await recordSecurityEvent({
                userId,
                eventType: "password_reset",
                title: "Password Changed",
                description: `Password was reset successfully via verified OTP. All existing sessions were terminated.`,
                severity: "warning",
                ipAddressMasked: maskedIp,
                deviceSummary: userAgent,
                metadata: {
                    action: "password_reset_otp",
                    accountType: decoded.accountType || "personal",
                    timestamp: new Date().toISOString(),
                },
            });
        } catch {}

        // Send Confirmation Security Notice Email
        sendPasswordResetSuccessEmail({
            to: user.email,
            name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username || "Developer",
            accountType: decoded.accountType || "personal",
            ipAddressMasked: maskedIp,
        }).catch((emailErr) => {
            console.warn("[PasswordResetService] Failed to send reset confirmation email:", emailErr.message);
        });

        return {
            success: true,
            message: "Your password has been successfully updated! You can now sign in with your new password.",
            identifier: user.email,
            username: user.username,
        };
    }
}
