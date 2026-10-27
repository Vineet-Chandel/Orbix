import crypto from "crypto";
import redis from "../../redis/client.js";
import { query } from "../../database/client.js";
import { sendVerificationEmail } from "./resendService.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";
import { invalidateAllUserCaches } from "../../redis/cache/cache-profile.js";

const OTP_TTL_SECONDS = 600; // 10 minutes
const COOLDOWN_SECONDS = 60; // 1 minute between OTP requests
const MAX_HOURLY_REQUESTS = 5; // Max 5 OTP requests per hour per user
const MAX_VERIFY_ATTEMPTS = 5; // Max 5 incorrect guesses before OTP invalidation

interface SendOtpParams {
    userId: string;
    email: string;
    name?: string;
    ipAddress?: string;
    userAgent?: string;
}

interface VerifyOtpParams {
    userId: string;
    otp: string;
    ipAddress?: string;
}

export class EmailVerificationService {
    /**
     * Generates a cryptographically strong 6-digit numeric OTP.
     */
    private static generateSecureOtp(): string {
        return crypto.randomInt(100000, 1000000).toString();
    }

    /**
     * Computes SHA-256 hash of the OTP for safe storage.
     */
    private static hashOtp(otp: string): string {
        return crypto.createHash("sha256").update(otp.trim()).digest("hex");
    }

    /**
     * Gets current verification status for a user.
     */
    static async getStatus(userId: string, email: string) {
        // Query user record from PostgreSQL
        const userRes = await query(
            `SELECT id, email, username, is_email_verified AS "isEmailVerified", email_verified_at AS "emailVerifiedAt"
             FROM users
             WHERE id = $1 LIMIT 1;`,
            [userId]
        );

        const user = userRes.rows[0];
        const isVerified = Boolean(user?.isEmailVerified);
        const emailVerifiedAt = user?.emailVerifiedAt || null;

        // Check active cooldown in Redis
        let cooldownRemainingSeconds = 0;
        let hasPendingOtp = false;

        try {
            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`otp:cooldown:${userId}`);
                if (ttl > 0) {
                    cooldownRemainingSeconds = ttl;
                }
                const pending = await redis.exists(`otp:email_verification:${userId}`);
                hasPendingOtp = pending === 1;
            }
        } catch (err: any) {
            console.warn("[EmailVerificationService] Redis check failed:", err.message);
        }

        return {
            email: user?.email || email,
            isEmailVerified: isVerified,
            emailVerifiedAt,
            hasPendingOtp,
            cooldownRemainingSeconds,
        };
    }

    /**
     * Sends a new email verification OTP with strict rate-limiting and audit logging.
     */
    static async sendOtp(params: SendOtpParams) {
        const { userId, email, name, ipAddress = "unknown", userAgent = "unknown" } = params;
        const normalizedEmail = email.trim().toLowerCase();

        // 1. Check if user exists and whether email is already verified
        const userRes = await query(
            `SELECT id, email, username, is_email_verified AS "isEmailVerified" FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        if (!userRes.rows[0]) {
            throw new Error("User account not found");
        }

        // 2. Redis Rate Limiting: 60s cooldown
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`otp:cooldown:${userId}`);
            if (cooldownTtl > 0) {
                const error: any = new Error(`Please wait ${cooldownTtl} seconds before requesting another verification code.`);
                error.statusCode = 429;
                error.cooldownRemainingSeconds = cooldownTtl;
                throw error;
            }

            // 3. Redis Rate Limiting: Hourly maximum 5 requests
            const hourlyKey = `otp:hourly_count:${userId}`;
            const hourlyCount = await redis.incr(hourlyKey);
            if (hourlyCount === 1) {
                await redis.expire(hourlyKey, 3600); // 1 hour TTL
            }
            if (hourlyCount > MAX_HOURLY_REQUESTS) {
                const error: any = new Error("Hourly verification request limit reached (5 codes/hr). Please try again later.");
                error.statusCode = 429;
                throw error;
            }
        }

        // 4. Generate new 6-digit OTP and compute hash
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        // 5. Cache in Redis with 10-minute TTL
        if (redis && redis.status === "ready") {
            const redisPayload = JSON.stringify({
                otpHash,
                email: normalizedEmail,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });

            await redis.set(`otp:email_verification:${userId}`, redisPayload, "EX", OTP_TTL_SECONDS);
            await redis.set(`otp:cooldown:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 6. Record in PostgreSQL audit table
        try {
            // Invalidate any prior pending OTPs for this user
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
            console.error("[EmailVerificationService] Failed to record OTP in audit table:", dbErr.message);
        }

        // 7. Dispatch verification email via Resend
        const sendResult = await sendVerificationEmail({
            to: normalizedEmail,
            name: name || userRes.rows[0].username || "Developer",
            otp,
        });

        if (!sendResult.success) {
            throw new Error(sendResult.error || "Failed to dispatch verification email via Resend");
        }

        return {
            success: true,
            message: `Verification code sent to ${normalizedEmail}`,
            email: normalizedEmail,
            simulated: Boolean(sendResult.simulated),
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresInSeconds: OTP_TTL_SECONDS,
        };
    }

    /**
     * Verifies the submitted OTP code.
     */
    static async verifyOtp(params: VerifyOtpParams) {
        const { userId, otp, ipAddress = "unknown" } = params;

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            const error: any = new Error("Please enter a valid 6-digit numeric verification code.");
            error.statusCode = 400;
            throw error;
        }

        const cleanedOtp = otp.trim();
        const incomingHash = this.hashOtp(cleanedOtp);

        let cachedData: {
            otpHash: string;
            email: string;
            attempts: number;
            expiresAt: string;
        } | null = null;

        // 1. Look up in Redis first
        if (redis && redis.status === "ready") {
            const raw = await redis.get(`otp:email_verification:${userId}`);
            if (raw) {
                try {
                    cachedData = JSON.parse(raw);
                } catch {}
            }
        }

        // 2. Fallback to PostgreSQL if Redis is missing or evicted
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
                    otpHash: row.otpHash,
                    email: row.email,
                    attempts: row.attempts,
                    expiresAt: row.expiresAt.toISOString(),
                };
            }
        }

        if (!cachedData) {
            const error: any = new Error("Verification code has expired or is invalid. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        // 3. Check brute-force attempts
        if (cachedData.attempts >= MAX_VERIFY_ATTEMPTS) {
            // Invalidate in Redis and DB
            if (redis && redis.status === "ready") {
                await redis.del(`otp:email_verification:${userId}`);
            }
            await query(
                `UPDATE email_verification_otps
                 SET status = 'failed'
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            const error: any = new Error("Too many incorrect attempts. This code has been invalidated for security. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        // 4. Verify Hash
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(cachedData.otpHash, "hex"),
            Buffer.from(incomingHash, "hex")
        );

        if (!isMatch) {
            const newAttempts = cachedData.attempts + 1;
            const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

            // Update attempts in Redis
            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`otp:email_verification:${userId}`);
                if (ttl > 0) {
                    cachedData.attempts = newAttempts;
                    await redis.set(`otp:email_verification:${userId}`, JSON.stringify(cachedData), "EX", ttl);
                }
            }

            // Update attempts in PostgreSQL
            await query(
                `UPDATE email_verification_otps
                 SET attempts = attempts + 1
                 WHERE user_id = $1 AND status = 'pending';`,
                [userId]
            );

            const error: any = new Error(
                remaining > 0
                    ? `Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`
                    : "Too many incorrect attempts. Code invalidated. Please request a new code."
            );
            error.statusCode = 400;
            throw error;
        }

        // 5. Successful Verification!
        const verifiedAt = new Date();

        // Update PostgreSQL users table
        const updateRes = await query(
            `UPDATE users
             SET is_email_verified = true,
                 email_verified_at = $1,
                 email = COALESCE(NULLIF($2, ''), email)
             WHERE id = $3
             RETURNING id, username, email, is_email_verified AS "isEmailVerified", email_verified_at AS "emailVerifiedAt";`,
            [verifiedAt, cachedData.email, userId]
        );

        // Mark OTP audit record as verified
        await query(
            `UPDATE email_verification_otps
             SET status = 'verified',
                 verified_at = $1
             WHERE user_id = $2 AND status = 'pending';`,
            [verifiedAt, userId]
        );

        // Cleanup Redis keys
        if (redis && redis.status === "ready") {
            await redis.del(`otp:email_verification:${userId}`);
            await redis.del(`otp:cooldown:${userId}`);
        }

        // Invalidate auth and profile caches
        const updatedUser = updateRes.rows[0];
        if (updatedUser) {
            deleteUserDetailsCache(updatedUser.email).catch(() => {});
            invalidateAllUserCaches({
                id: userId,
                username: updatedUser.username,
                gmail: updatedUser.email,
            }).catch(() => {});
        }

        return {
            success: true,
            message: "Email successfully verified!",
            isEmailVerified: true,
            emailVerifiedAt: verifiedAt.toISOString(),
            email: updatedUser?.email || cachedData.email,
        };
    }
}
