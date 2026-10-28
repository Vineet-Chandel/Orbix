import crypto from "crypto";
import jwt from "jsonwebtoken";
import redis from "../../redis/client.js";
import { query } from "../../database/client.js";
import { sendVerificationSms, normalizePhoneNumber } from "./smsGatewayService.js";
import { verifyFirebaseIdToken, type VerifiedFirebaseUser } from "../../config/firebaseAdmin.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";

const OTP_TTL_SECONDS = 600; // 10 minutes
const COOLDOWN_SECONDS = 60; // 1 minute between OTP requests
const MAX_HOURLY_REQUESTS = 5; // Max 5 OTP requests per hour per phone
const MAX_VERIFY_ATTEMPTS = 5; // Max 5 incorrect guesses before OTP invalidation

const JWT_SECRET = process.env.JWT_SECRET || "orbix_secret_fallback_key_2026";

export interface SendPhoneOtpParams {
    phone: string;
    clubName?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export interface VerifyPhoneOtpParams {
    phone: string;
    otp: string;
    ipAddress?: string | undefined;
}

export interface VerifyFirebasePhoneParams {
    idToken: string;
    expectedPhone: string;
    userId?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
}

export class PhoneVerificationService {
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
     * Issues a cryptographically signed verification proof token for verified phone numbers.
     */
    static generateVerificationToken(canonicalPhone: string, firebaseUid?: string): string {
        return jwt.sign(
            {
                sub: canonicalPhone,
                type: "phone_verification",
                firebaseUid: firebaseUid || null,
                verifiedAt: new Date().toISOString(),
                jti: crypto.randomUUID(),
            },
            JWT_SECRET as string,
            {
                expiresIn: "1h",
                issuer: "orbix",
                audience: "orbix-registration",
            }
        );
    }

    /**
     * Validates a phone verification proof token.
     */
    static verifyVerificationToken(token: string, expectedPhone: string): boolean {
        try {
            const decoded: any = jwt.verify(token, JWT_SECRET as string, {
                issuer: "orbix",
                audience: "orbix-registration",
            });
            const normExpected = normalizePhoneNumber(expectedPhone);
            return (
                Boolean(decoded) &&
                decoded.type === "phone_verification" &&
                decoded.sub === normExpected.canonical
            );
        } catch {
            return false;
        }
    }

    /**
     * Authoritatively verifies a Firebase ID token, validates phone identity,
     * enforces account phone uniqueness, and associates the phone with the Supabase account or registration state.
     */
    static async verifyFirebasePhoneAssociation(params: VerifyFirebasePhoneParams) {
        const { idToken, expectedPhone, userId, ipAddress = "unknown", userAgent = "unknown" } = params;

        // 1. Normalize and validate requested phone number
        const norm = normalizePhoneNumber(expectedPhone);
        if (!norm.isValid) {
            const error: any = new Error("Please provide a valid 10-digit mobile phone number format.");
            error.statusCode = 400;
            throw error;
        }

        // 2. Authoritatively verify Firebase ID token using Firebase Admin SDK
        const verifiedFirebaseUser: VerifiedFirebaseUser = await verifyFirebaseIdToken(idToken);

        // 3. Normalize verified phone number from Firebase token
        const normFirebasePhone = normalizePhoneNumber(verifiedFirebaseUser.phoneNumber);
        if (!normFirebasePhone.isValid) {
            const error: any = new Error("Firebase token did not contain a valid phone number.");
            error.statusCode = 400;
            throw error;
        }

        // 4. Verify that token phone number matches the submitted phone number
        if (normFirebasePhone.canonical !== norm.canonical) {
            const error: any = new Error(
                `Phone number mismatch: submitted number (${norm.formatted}) does not match the authenticated phone number (${normFirebasePhone.formatted}).`
            );
            error.statusCode = 400;
            throw error;
        }

        const canonical = norm.canonical;

        // 5. Enforce Phone Uniqueness Policy: One account per verified phone number
        const existingUserRes = await query(
            `SELECT id, username, email FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) LIMIT 1;`,
            [canonical]
        );

        const existingUser = existingUserRes.rows[0];
        if (existingUser && (!userId || existingUser.id !== userId)) {
            const error: any = new Error(
                "This mobile phone number is already associated with another Orbix account. If this is your account, please log in or contact support."
            );
            error.statusCode = 409;
            throw error;
        }

        const verifiedAt = new Date();

        // 6. Record audit entry in phone_verification_otps
        try {
            await query(
                `INSERT INTO phone_verification_otps
                 (user_id, phone, otp_hash, status, attempts, ip_address, user_agent, expires_at, verified_at, firebase_uid, auth_provider)
                 VALUES ($1, $2, $3, 'verified', 1, $4, $5, $6, $7, $8, 'firebase');`,
                [
                    userId || null,
                    canonical,
                    "firebase_token_verified",
                    ipAddress,
                    userAgent,
                    new Date(Date.now() + 3600 * 1000),
                    verifiedAt,
                    verifiedFirebaseUser.uid,
                ]
            );
        } catch (dbErr: any) {
            console.error("[PhoneVerificationService] Failed to record Firebase verification audit:", dbErr.message);
        }

        // 7. If user is currently authenticated (Supabase session), associate immediately
        if (userId) {
            await query(
                `UPDATE users
                 SET phone = $1,
                     is_phone_verified = true,
                     phone_verified_at = $2,
                     phone_confirmed_at = $2
                 WHERE id = $3;`,
                [canonical, verifiedAt, userId]
            );

            // Invalidate auth cache in Redis
            try {
                await deleteUserDetailsCache(userId);
            } catch {}

            return {
                success: true,
                message: "Phone number verified and associated with your account successfully!",
                phone: norm.formatted,
                canonical: norm.canonical,
                isAssociated: true,
                verifiedAt: verifiedAt.toISOString(),
            };
        }

        // 8. If in pre-registration (e.g. Club Registration before user creation):
        // Issue a cryptographically signed continuation ticket bound to this phone number
        const continuationToken = this.generateVerificationToken(canonical, verifiedFirebaseUser.uid);

        return {
            success: true,
            message: "Phone number verified successfully!",
            phone: norm.formatted,
            canonical: norm.canonical,
            isAssociated: false,
            token: continuationToken,
            verifiedAt: verifiedAt.toISOString(),
        };
    }

    /**
     * Sends a new SMS verification code with strict rate-limiting and audit logging.
     */
    static async sendOtp(params: SendPhoneOtpParams) {
        const { phone: rawPhone, clubName, ipAddress = "unknown", userAgent = "unknown" } = params;
        const norm = normalizePhoneNumber(rawPhone);

        if (!norm.isValid) {
            const error: any = new Error("Please provide a valid 10-digit mobile phone number.");
            error.statusCode = 400;
            throw error;
        }

        const canonical = norm.canonical;

        // 1. Redis Rate Limiting: 60s cooldown
        if (redis && redis.status === "ready") {
            const cooldownTtl = await redis.ttl(`otp:phone_cooldown:${canonical}`);
            if (cooldownTtl > 0) {
                const error: any = new Error(`Please wait ${cooldownTtl} seconds before requesting another SMS code.`);
                error.statusCode = 429;
                error.cooldownRemainingSeconds = cooldownTtl;
                throw error;
            }

            // 2. Redis Rate Limiting: Hourly limit of 5 requests
            const hourlyKey = `otp:phone_hourly:${canonical}`;
            const hourlyCount = await redis.incr(hourlyKey);
            if (hourlyCount === 1) {
                await redis.expire(hourlyKey, 3600);
            }
            if (hourlyCount > MAX_HOURLY_REQUESTS) {
                const error: any = new Error("Hourly SMS verification limit reached (5 codes/hr). Please try again later.");
                error.statusCode = 429;
                throw error;
            }
        }

        // 3. Generate new 6-digit OTP and compute hash
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        // 4. Cache in Redis with 10-minute TTL
        if (redis && redis.status === "ready") {
            const redisPayload = JSON.stringify({
                otpHash,
                canonical,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });

            await redis.set(`otp:phone_verification:${canonical}`, redisPayload, "EX", OTP_TTL_SECONDS);
            await redis.set(`otp:phone_cooldown:${canonical}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 5. Record in PostgreSQL audit table
        try {
            await query(
                `UPDATE phone_verification_otps
                 SET status = 'expired'
                 WHERE phone = $1 AND status = 'pending';`,
                [canonical]
            );

            await query(
                `INSERT INTO phone_verification_otps
                 (phone, otp_hash, status, attempts, ip_address, user_agent, expires_at)
                 VALUES ($1, $2, 'pending', 0, $3, $4, $5);`,
                [canonical, otpHash, ipAddress, userAgent, expiresAt]
            );
        } catch (dbErr: any) {
            console.error("[PhoneVerificationService] Failed to record OTP in audit table:", dbErr.message);
        }

        // 6. Dispatch SMS
        const sendResult = await sendVerificationSms({
            to: canonical,
            otp,
            clubName,
        });

        if (!sendResult.success) {
            throw new Error(sendResult.error || "Failed to dispatch SMS verification code");
        }

        // Cache devOtp in Redis if simulation was used
        if (redis && redis.status === "ready" && sendResult.simulated) {
            const redisPayload = JSON.stringify({
                otp,
                otpHash,
                canonical,
                attempts: 0,
                expiresAt: expiresAt.toISOString(),
            });
            await redis.set(`otp:phone_verification:${canonical}`, redisPayload, "EX", OTP_TTL_SECONDS);
        }

        return {
            success: true,
            message: sendResult.simulated && sendResult.providerError
                ? `SMS Provider Notice: ${sendResult.providerError}`
                : `Verification code sent to ${norm.formatted}`,
            phone: norm.formatted,
            canonical: norm.canonical,
            simulated: Boolean(sendResult.simulated),
            devOtp: sendResult.devOtp,
            providerError: sendResult.providerError,
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresInSeconds: OTP_TTL_SECONDS,
        };
    }

    /**
     * Verifies the submitted phone OTP code and returns a signed verification token.
     */
    static async verifyOtp(params: VerifyPhoneOtpParams) {
        const { phone: rawPhone, otp, ipAddress: _ipAddress = "unknown" } = params;
        const norm = normalizePhoneNumber(rawPhone);

        if (!norm.isValid) {
            const error: any = new Error("Invalid mobile phone number format.");
            error.statusCode = 400;
            throw error;
        }

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            const error: any = new Error("Please enter a valid 6-digit numeric verification code.");
            error.statusCode = 400;
            throw error;
        }

        const canonical = norm.canonical;
        const cleanedOtp = otp.trim();
        const incomingHash = this.hashOtp(cleanedOtp);

        let cachedData: {
            otpHash: string;
            canonical: string;
            attempts: number;
            expiresAt: string;
        } | null = null;

        // 1. Look up in Redis first
        if (redis && redis.status === "ready") {
            const raw = await redis.get(`otp:phone_verification:${canonical}`);
            if (raw) {
                try {
                    cachedData = JSON.parse(raw);
                } catch {}
            }
        }

        // 2. Fallback to PostgreSQL
        if (!cachedData) {
            const dbOtpRes = await query(
                `SELECT id, phone, otp_hash AS "otpHash", attempts, expires_at AS "expiresAt"
                 FROM phone_verification_otps
                 WHERE phone = $1 AND status = 'pending' AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1;`,
                [canonical]
            );

            if (dbOtpRes.rows[0]) {
                const row = dbOtpRes.rows[0];
                cachedData = {
                    otpHash: row.otpHash,
                    canonical: row.phone,
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

        // 3. Brute force check
        if (cachedData.attempts >= MAX_VERIFY_ATTEMPTS) {
            if (redis && redis.status === "ready") {
                await redis.del(`otp:phone_verification:${canonical}`);
            }
            await query(
                `UPDATE phone_verification_otps
                 SET status = 'failed'
                 WHERE phone = $1 AND status = 'pending';`,
                [canonical]
            );

            const error: any = new Error("Too many incorrect attempts. This code has been invalidated for security. Please request a new code.");
            error.statusCode = 400;
            throw error;
        }

        // 4. Constant-time Hash Comparison
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(cachedData.otpHash, "hex"),
            Buffer.from(incomingHash, "hex")
        );

        if (!isMatch) {
            const newAttempts = cachedData.attempts + 1;
            const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

            if (redis && redis.status === "ready") {
                const ttl = await redis.ttl(`otp:phone_verification:${canonical}`);
                if (ttl > 0) {
                    cachedData.attempts = newAttempts;
                    await redis.set(`otp:phone_verification:${canonical}`, JSON.stringify(cachedData), "EX", ttl);
                }
            }

            await query(
                `UPDATE phone_verification_otps
                 SET attempts = attempts + 1
                 WHERE phone = $1 AND status = 'pending';`,
                [canonical]
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

        // Mark OTP audit record as verified
        await query(
            `UPDATE phone_verification_otps
             SET status = 'verified', verified_at = $1
             WHERE phone = $2 AND status = 'pending';`,
            [verifiedAt, canonical]
        );

        // Clear active Redis pending OTP
        if (redis && redis.status === "ready") {
            await redis.del(`otp:phone_verification:${canonical}`);
            await redis.del(`otp:phone_cooldown:${canonical}`);
        }

        // Generate cryptographic proof token
        const token = this.generateVerificationToken(canonical);

        return {
            success: true,
            message: "Phone number verified successfully!",
            phone: norm.formatted,
            canonical: norm.canonical,
            token,
        };
    }
}
