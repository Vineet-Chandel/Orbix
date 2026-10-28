import crypto from "crypto";
import validator from "validator";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query, pool } from "../../database/client.js";
import redis from "../../redis/client.js";
import { deleteUserDetailsCache, userDetailsCache } from "../../redis/cache/cache-auth.js";
import { sendSecurityNotificationEmail } from "../email/resendService.js";
import { EmailVerificationService } from "../email/emailVerificationService.js";

const JWT_SECRET = process.env.JWT_SECRET || "orbix_jwt_secret_fallback_2026";
const OTP_TTL_SECONDS = 600; // 10 minutes
const COOLDOWN_SECONDS = 60; // 60 seconds
const MAX_VERIFY_ATTEMPTS = 5;
const MONTHLY_LIMIT = 2; // 2 changes per UTC calendar month

const RESERVED_USERNAMES = new Set([
    "admin", "administrator", "api", "auth", "signup", "signin", "login",
    "logout", "dashboard", "settings", "profile", "profiles", "help", "club",
    "clubs", "portal", "portals", "leaderboard", "events", "onboarding", "docs",
    "notifications", "explore", "feed", "blog", "support", "terms", "privacy",
    "root", "system", "superuser", "orbix", "moderator", "null", "undefined",
    "about", "contact", "security", "status", "legal", "verify", "verification"
]);

export interface MonthlyQuotaResult {
    used: number;
    limit: number;
    remaining: number;
    canChange: boolean;
    nextResetAt: string;
}

export interface ManageAccountsStatusResult {
    primaryEmail: string;
    isEmailVerified: boolean;
    emailVerifiedAt: string | null;
    emailState:
        | "email_verified"
        | "email_verification_required"
        | "old_email_authorization_pending"
        | "new_email_verification_pending"
        | "verification_code_expired"
        | "too_many_attempts"
        | "email_change_completed"
        | "email_change_cancelled";
    username: string;
    usernameUpdatedAt: string | null;
    pendingEmail: string | null;
    pendingOperation: {
        id: string;
        changeType: "email_change" | "username_change";
        stage: string;
        currentValue: string;
        requestedValue: string;
        expiresAt: string;
        cooldownRemainingSeconds: number;
        attemptsRemaining: number;
        createdAt: string;
    } | null;
    monthlyLimits: {
        email: MonthlyQuotaResult;
        username: MonthlyQuotaResult;
    };
    unverifiedPrimaryCooldownSeconds: number;
}

export class ManageAccountsService {
    /**
     * Computes the current UTC calendar month boundaries: [startOfMonth, startOfNextMonth).
     */
    static getUtcMonthBounds(targetDate = new Date()): { startOfMonth: Date; startOfNextMonth: Date } {
        const startOfMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), 1, 0, 0, 0, 0));
        const startOfNextMonth = new Date(Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth() + 1, 1, 0, 0, 0, 0));
        return { startOfMonth, startOfNextMonth };
    }

    /**
     * Computes the number of successfully committed changes of a given type within the current UTC month.
     */
    static async getMonthlyQuota(userId: string, changeType: "email" | "username"): Promise<MonthlyQuotaResult> {
        const { startOfMonth, startOfNextMonth } = this.getUtcMonthBounds();

        const res = await query(
            `SELECT COUNT(*)::int AS count
             FROM account_change_history
             WHERE user_id = $1 AND change_type = $2 AND created_at >= $3 AND created_at < $4;`,
            [userId, changeType, startOfMonth, startOfNextMonth]
        );

        const used = res.rows[0]?.count || 0;
        return {
            used,
            limit: MONTHLY_LIMIT,
            remaining: Math.max(0, MONTHLY_LIMIT - used),
            canChange: used < MONTHLY_LIMIT,
            nextResetAt: startOfNextMonth.toISOString(),
        };
    }

    /**
     * Generates a cryptographically random 6-digit numeric OTP.
     */
    static generateSecureOtp(): string {
        return crypto.randomInt(100000, 1000000).toString();
    }

    /**
     * Hashes an OTP with a server secret to prevent plain-text exposure in storage.
     */
    static hashOtp(otp: string): string {
        return crypto.createHmac("sha256", JWT_SECRET).update(otp.trim()).digest("hex");
    }

    /**
     * Retrieves the authoritative Manage Accounts status for the authenticated user.
     */
    static async getStatus(userId: string): Promise<ManageAccountsStatusResult> {
        const userRes = await query(
            `SELECT
                id,
                email,
                username,
                COALESCE(is_email_verified, false) AS "isEmailVerified",
                email_verified_at AS "emailVerifiedAt",
                username_updated_at AS "usernameUpdatedAt",
                pending_email AS "pendingEmail",
                pending_email_operation_id AS "pendingEmailOperationId"
             FROM users
             WHERE id = $1;`,
            [userId]
        );

        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found");
            err.statusCode = 404;
            throw err;
        }

        // Check for active pending operation
        let activeOp: any = null;
        let attemptsRemaining = MAX_VERIFY_ATTEMPTS;
        let cooldownRemainingSeconds = 0;

        const opRes = await query(
            `SELECT
                id,
                change_type AS "changeType",
                current_value AS "currentValue",
                requested_value AS "requestedValue",
                stage,
                attempts,
                expires_at AS "expiresAt",
                created_at AS "createdAt"
             FROM account_change_operations
             WHERE user_id = $1 AND stage NOT IN ('completed', 'cancelled', 'expired')
             ORDER BY created_at DESC
             LIMIT 1;`,
            [userId]
        );

        if (opRes.rows[0]) {
            const op = opRes.rows[0];
            const now = new Date();
            const expiresAt = new Date(op.expiresAt);

            if (now > expiresAt) {
                // Operation has expired: clean up safely
                await query(
                    `UPDATE account_change_operations
                     SET stage = 'expired', updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1;`,
                    [op.id]
                );
                await query(
                    `UPDATE users
                     SET pending_email = NULL, pending_email_operation_id = NULL
                     WHERE id = $1;`,
                    [userId]
                );
            } else {
                // Active operation
                activeOp = op;

                // Lookup active challenge for this stage
                const challengeType = op.stage === "old_email_authorization_pending"
                    ? "old_email_auth"
                    : op.stage === "new_email_verification_pending"
                    ? "new_email_verify"
                    : "username_change_auth";

                const chalRes = await query(
                    `SELECT attempts, last_resent_at AS "lastResentAt"
                     FROM account_change_challenges
                     WHERE operation_id = $1 AND challenge_type = $2 AND status = 'pending'
                     ORDER BY created_at DESC LIMIT 1;`,
                    [op.id, challengeType]
                );

                if (chalRes.rows[0]) {
                    const chal = chalRes.rows[0];
                    attemptsRemaining = Math.max(0, MAX_VERIFY_ATTEMPTS - (chal.attempts || 0));
                }

                // Check Redis cooldown
                if (redis && redis.status === "ready") {
                    const ttl = await redis.ttl(`otp:acct_change_cooldown:${op.id}:${challengeType}`);
                    if (ttl > 0) cooldownRemainingSeconds = ttl;
                }
            }
        }

        // Monthly limits
        const [emailQuota, usernameQuota] = await Promise.all([
            this.getMonthlyQuota(userId, "email"),
            this.getMonthlyQuota(userId, "username"),
        ]);

        // Unverified primary email cooldown
        let unverifiedPrimaryCooldownSeconds = 0;
        if (!user.isEmailVerified && redis && redis.status === "ready") {
            const primaryTtl = await redis.ttl(`otp:email_cooldown:${user.email?.toLowerCase()}`);
            if (primaryTtl > 0) unverifiedPrimaryCooldownSeconds = primaryTtl;
        }

        // Determine authoritative email state
        let emailState: ManageAccountsStatusResult["emailState"] = "email_verification_required";
        if (activeOp) {
            if (activeOp.stage === "old_email_authorization_pending") {
                emailState = "old_email_authorization_pending";
            } else if (activeOp.stage === "new_email_verification_pending") {
                emailState = "new_email_verification_pending";
            }
            if (attemptsRemaining === 0) {
                emailState = "too_many_attempts";
            }
        } else if (user.isEmailVerified) {
            emailState = "email_verified";
        } else {
            emailState = "email_verification_required";
        }

        return {
            primaryEmail: user.email,
            isEmailVerified: user.isEmailVerified,
            emailVerifiedAt: user.emailVerifiedAt ? new Date(user.emailVerifiedAt).toISOString() : null,
            emailState,
            username: user.username,
            usernameUpdatedAt: user.usernameUpdatedAt ? new Date(user.usernameUpdatedAt).toISOString() : null,
            pendingEmail: user.pendingEmail || null,
            pendingOperation: activeOp ? {
                id: activeOp.id,
                changeType: activeOp.changeType,
                stage: activeOp.stage,
                currentValue: activeOp.currentValue,
                requestedValue: activeOp.requestedValue,
                expiresAt: new Date(activeOp.expiresAt).toISOString(),
                cooldownRemainingSeconds,
                attemptsRemaining,
                createdAt: new Date(activeOp.createdAt).toISOString(),
            } : null,
            monthlyLimits: {
                email: emailQuota,
                username: usernameQuota,
            },
            unverifiedPrimaryCooldownSeconds,
        };
    }

    /**
     * Step 1: Initiates an email change by verifying the new email request,
     * checking monthly quota, and sending an authorization OTP to the OLD primary email.
     */
    static async startEmailChange(params: {
        userId: string;
        newEmail: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, newEmail, ipAddress = "unknown", userAgent = "unknown" } = params;

        // 1. Quota Check
        const quota = await this.getMonthlyQuota(userId, "email");
        if (!quota.canChange) {
            const err: any = new Error("Monthly email change limit reached (2 changes per UTC calendar month).");
            err.statusCode = 429;
            err.code = "MONTHLY_LIMIT_REACHED";
            err.limit = quota.limit;
            err.action = "email_change";
            err.nextEligibleAt = quota.nextResetAt;
            throw err;
        }

        // 2. Validate New Email Format
        const normalizedNewEmail = (newEmail || "").trim().toLowerCase();
        if (!validator.isEmail(normalizedNewEmail)) {
            const err: any = new Error("Please enter a valid email address.");
            err.statusCode = 400;
            throw err;
        }

        // 3. Fetch Current User
        const userRes = await query(
            `SELECT id, email, username, firstname, is_email_verified
             FROM users WHERE id = $1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        const currentEmail = user.email.trim().toLowerCase();
        if (currentEmail === normalizedNewEmail) {
            const err: any = new Error("The requested email is already your current primary email address.");
            err.statusCode = 400;
            throw err;
        }

        // 4. Enforce Database Uniqueness Constraint
        const conflictRes = await query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1;`,
            [normalizedNewEmail, userId]
        );
        if (conflictRes.rows[0]) {
            const err: any = new Error("This email address is already in use by another account.");
            err.statusCode = 409;
            err.code = "EMAIL_ALREADY_EXISTS";
            throw err;
        }

        // 5. Rate limit: check if user recently requested start
        if (redis && redis.status === "ready") {
            const startCooldown = await redis.ttl(`otp:acct_change_start:${userId}`);
            if (startCooldown > 0) {
                const err: any = new Error(`Please wait ${startCooldown} seconds before initiating another email change.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = startCooldown;
                throw err;
            }
        }

        // 6. Cancel any stale incomplete email change operations
        await query(
            `UPDATE account_change_operations
             SET stage = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Superceded by new change request'
             WHERE user_id = $1 AND change_type = 'email_change' AND stage NOT IN ('completed', 'cancelled', 'expired');`,
            [userId]
        );

        // 7. Create Account Change Operation
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
        const opRes = await query(
            `INSERT INTO account_change_operations (
                user_id,
                change_type,
                current_value,
                requested_value,
                stage,
                expires_at
            ) VALUES ($1, 'email_change', $2, $3, 'old_email_authorization_pending', $4)
            RETURNING id;`,
            [userId, currentEmail, normalizedNewEmail, expiresAt]
        );
        const operationId = opRes.rows[0].id;

        // Set pending_email and pending_email_operation_id on users record
        await query(
            `UPDATE users
             SET pending_email = $1, pending_email_operation_id = $2
             WHERE id = $3;`,
            [normalizedNewEmail, operationId, userId]
        );

        // 8. Generate & Store Challenge OTP for Old Email
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);

        const chalRes = await query(
            `INSERT INTO account_change_challenges (
                operation_id,
                user_id,
                challenge_type,
                destination,
                otp_hash,
                status,
                ip_address,
                user_agent,
                expires_at
            ) VALUES ($1, $2, 'old_email_auth', $3, $4, 'pending', $5, $6, $7)
            RETURNING id;`,
            [operationId, userId, currentEmail, otpHash, ipAddress, userAgent, expiresAt]
        );
        const challengeId = chalRes.rows[0].id;

        await query(
            `UPDATE account_change_operations
             SET old_challenge_id = $1
             WHERE id = $2;`,
            [challengeId, operationId]
        );

        // 9. Set Cooldown in Redis
        if (redis && redis.status === "ready") {
            await redis.set(`otp:acct_change_cooldown:${operationId}:old_email_auth`, "1", "EX", COOLDOWN_SECONDS);
            await redis.set(`otp:acct_change_start:${userId}`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 10. Send Authorization Email to Old Address via Resend
        const displayName = user.firstname || user.username || "Developer";
        const sendResult = await sendSecurityNotificationEmail({
            to: currentEmail,
            name: displayName,
            subject: `Authorize Email Change: ${otp}`,
            badgeText: "Account Security",
            headline: "Authorize Changing Your Primary Email",
            message: `We received a request to change your Orbix account email to <strong>${normalizedNewEmail}</strong>. To authorize this change, please enter the single-use 6-digit verification code below.`,
            otp,
            otpLabel: "Authorization Code",
            isWarning: false,
            footerNotice: "If you did not request this change, someone may be attempting to access your account. Please change your password immediately."
        });

        const isDev = process.env.NODE_ENV !== "production";

        return {
            success: true,
            message: `Authorization code sent to your current email address (${currentEmail}).`,
            operationId,
            stage: "old_email_authorization_pending",
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresAt: expiresAt.toISOString(),
            simulated: Boolean(sendResult.simulated),
            devOtp: (isDev || sendResult.sandboxRestricted) ? otp : undefined,
            sandboxRestricted: Boolean(sendResult.sandboxRestricted),
            provider: sendResult.provider,
        };
    }

    /**
     * Step 2: Authorizes the old primary email address by validating the authorization OTP,
     * advances the stage to 'new_email_verification_pending', and dispatches verification OTP to the NEW email.
     */
    static async authorizeOldEmail(params: {
        userId: string;
        operationId: string;
        otp: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, operationId, otp, ipAddress = "unknown", userAgent = "unknown" } = params;

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            const err: any = new Error("Please enter a valid 6-digit numeric verification code.");
            err.statusCode = 400;
            throw err;
        }

        const cleanedOtp = otp.trim();
        const incomingHash = this.hashOtp(cleanedOtp);

        // 1. Fetch Operation
        const opRes = await query(
            `SELECT id, user_id, current_value, requested_value, stage, expires_at
             FROM account_change_operations
             WHERE id = $1 AND user_id = $2;`,
            [operationId, userId]
        );
        const op = opRes.rows[0];
        if (!op) {
            const err: any = new Error("Email change operation not found.");
            err.statusCode = 404;
            throw err;
        }

        if (op.stage !== "old_email_authorization_pending") {
            const err: any = new Error(`Operation is not awaiting old email authorization (current stage: ${op.stage}).`);
            err.statusCode = 400;
            throw err;
        }

        if (new Date() > new Date(op.expires_at)) {
            await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
            const err: any = new Error("The verification code for this operation has expired. Please initiate a new email change.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Fetch Active Challenge
        const chalRes = await query(
            `SELECT id, otp_hash, attempts, status, expires_at
             FROM account_change_challenges
             WHERE operation_id = $1 AND challenge_type = 'old_email_auth' AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1;`,
            [operationId]
        );
        const challenge = chalRes.rows[0];
        if (!challenge) {
            const err: any = new Error("Authorization challenge not found or already consumed.");
            err.statusCode = 400;
            throw err;
        }

        // 3. Brute Force Protection (max 5 attempts)
        if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
            await query(`UPDATE account_change_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
            await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
            const err: any = new Error("Too many incorrect attempts. Authorization code invalidated. Please start over.");
            err.statusCode = 400;
            throw err;
        }

        // 4. Constant-Time Hash Comparison
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(challenge.otp_hash, "hex"),
            Buffer.from(incomingHash, "hex")
        );

        if (!isMatch) {
            const newAttempts = challenge.attempts + 1;
            const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

            await query(`UPDATE account_change_challenges SET attempts = $1 WHERE id = $2;`, [newAttempts, challenge.id]);

            if (remaining <= 0) {
                await query(`UPDATE account_change_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
                await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
                const err: any = new Error("Too many incorrect attempts. Authorization code invalidated. Please start over.");
                err.statusCode = 400;
                throw err;
            }

            const err: any = new Error(`Invalid authorization code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`);
            err.statusCode = 400;
            err.attemptsRemaining = remaining;
            throw err;
        }

        // 5. Consume Old Challenge
        await query(
            `UPDATE account_change_challenges
             SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
             WHERE id = $1;`,
            [challenge.id]
        );

        // 6. Transition Operation Stage & Record Pending Email on User Record
        const newExpiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
        await query(
            `UPDATE account_change_operations
             SET stage = 'new_email_verification_pending',
                 expires_at = $1,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [newExpiresAt, operationId]
        );

        await query(
            `UPDATE users
             SET pending_email = $1, pending_email_operation_id = $2
             WHERE id = $3;`,
            [op.requested_value, operationId, userId]
        );

        // 7. Generate & Store New Email Challenge
        const newOtp = this.generateSecureOtp();
        const newOtpHash = this.hashOtp(newOtp);

        const newChalRes = await query(
            `INSERT INTO account_change_challenges (
                operation_id,
                user_id,
                challenge_type,
                destination,
                otp_hash,
                status,
                ip_address,
                user_agent,
                expires_at
            ) VALUES ($1, $2, 'new_email_verify', $3, $4, 'pending', $5, $6, $7)
            RETURNING id;`,
            [operationId, userId, op.requested_value, newOtpHash, ipAddress, userAgent, newExpiresAt]
        );
        const newChallengeId = newChalRes.rows[0].id;

        await query(
            `UPDATE account_change_operations
             SET new_challenge_id = $1
             WHERE id = $2;`,
            [newChallengeId, operationId]
        );

        // 8. Set Cooldown in Redis
        if (redis && redis.status === "ready") {
            await redis.set(`otp:acct_change_cooldown:${operationId}:new_email_verify`, "1", "EX", COOLDOWN_SECONDS);
        }

        // 9. Send Verification Email to the NEW Address via Resend
        const userRes = await query(`SELECT firstname, username FROM users WHERE id = $1;`, [userId]);
        const displayName = userRes.rows[0]?.firstname || userRes.rows[0]?.username || "Developer";

        const sendResult = await sendSecurityNotificationEmail({
            to: op.requested_value,
            name: displayName,
            subject: `Verify New Primary Email: ${newOtp}`,
            badgeText: "Verify Email",
            headline: "Confirm Your New Orbix Email",
            message: `You requested to set <strong>${op.requested_value}</strong> as your primary email for Orbix. Enter the 6-digit confirmation code below to verify ownership and complete the change.`,
            otp: newOtp,
            otpLabel: "Verification Code",
            isWarning: false,
            footerNotice: "This verification code expires in 10 minutes. If you did not request to set this email, please ignore this message."
        });

        const isDev = process.env.NODE_ENV !== "production";

        return {
            success: true,
            message: `Current email authorized! Verification code sent to your new email (${op.requested_value}).`,
            operationId,
            stage: "new_email_verification_pending",
            pendingEmail: op.requested_value,
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresAt: newExpiresAt.toISOString(),
            simulated: Boolean(sendResult.simulated),
            devOtp: (isDev || sendResult.sandboxRestricted || !sendResult.success) ? newOtp : undefined,
            sandboxRestricted: Boolean(sendResult.sandboxRestricted),
            provider: sendResult.provider,
        };
    }

    /**
     * Step 3: Verifies the new email OTP, atomically commits the email change in a DB transaction,
     * marks email verified, consumes challenges, records history, and dispatches security notifications.
     */
    static async verifyNewEmailAndCommit(params: {
        userId: string;
        operationId: string;
        otp: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, operationId, otp, ipAddress = "unknown", userAgent = "unknown" } = params;

        if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp.trim())) {
            const err: any = new Error("Please enter a valid 6-digit numeric verification code.");
            err.statusCode = 400;
            throw err;
        }

        const cleanedOtp = otp.trim();
        const incomingHash = this.hashOtp(cleanedOtp);

        // 1. Fetch Operation
        const opRes = await query(
            `SELECT id, user_id, current_value, requested_value, stage, expires_at
             FROM account_change_operations
             WHERE id = $1 AND user_id = $2;`,
            [operationId, userId]
        );
        const op = opRes.rows[0];
        if (!op) {
            const err: any = new Error("Email change operation not found.");
            err.statusCode = 404;
            throw err;
        }

        if (op.stage !== "new_email_verification_pending") {
            const err: any = new Error(`Operation is not awaiting new email verification (current stage: ${op.stage}).`);
            err.statusCode = 400;
            throw err;
        }

        if (new Date() > new Date(op.expires_at)) {
            await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
            await query(`UPDATE users SET pending_email = NULL, pending_email_operation_id = NULL WHERE id = $1;`, [userId]);
            const err: any = new Error("The verification code for this operation has expired. Please initiate a new email change.");
            err.statusCode = 400;
            throw err;
        }

        // 2. Fetch Active Challenge
        const chalRes = await query(
            `SELECT id, otp_hash, attempts, status, expires_at
             FROM account_change_challenges
             WHERE operation_id = $1 AND challenge_type = 'new_email_verify' AND status = 'pending'
             ORDER BY created_at DESC LIMIT 1;`,
            [operationId]
        );
        const challenge = chalRes.rows[0];
        if (!challenge) {
            const err: any = new Error("Verification challenge not found or already consumed.");
            err.statusCode = 400;
            throw err;
        }

        // 3. Brute Force Protection
        if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
            await query(`UPDATE account_change_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
            await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
            await query(`UPDATE users SET pending_email = NULL, pending_email_operation_id = NULL WHERE id = $1;`, [userId]);
            const err: any = new Error("Too many incorrect attempts. Verification code invalidated. Please start over.");
            err.statusCode = 400;
            throw err;
        }

        // 4. Constant-Time Hash Comparison
        const isMatch = crypto.timingSafeEqual(
            Buffer.from(challenge.otp_hash, "hex"),
            Buffer.from(incomingHash, "hex")
        );

        if (!isMatch) {
            const newAttempts = challenge.attempts + 1;
            const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;

            await query(`UPDATE account_change_challenges SET attempts = $1 WHERE id = $2;`, [newAttempts, challenge.id]);

            if (remaining <= 0) {
                await query(`UPDATE account_change_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
                await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
                await query(`UPDATE users SET pending_email = NULL, pending_email_operation_id = NULL WHERE id = $1;`, [userId]);
                const err: any = new Error("Too many incorrect attempts. Verification code invalidated. Please start over.");
                err.statusCode = 400;
                throw err;
            }

            const err: any = new Error(`Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`);
            err.statusCode = 400;
            err.attemptsRemaining = remaining;
            throw err;
        }

        // 5. ATOMIC DATABASE TRANSACTION
        const client = await pool.connect();
        const oldEmail = op.current_value;
        const newEmail = op.requested_value;

        try {
            await client.query("BEGIN;");

            // 5a. Row-level Lock & Recheck uniqueness of new email
            const conflictCheck = await client.query(
                `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 FOR UPDATE;`,
                [newEmail, userId]
            );
            if (conflictCheck.rows[0]) {
                await client.query("ROLLBACK;");
                const err: any = new Error("This email address was recently registered to another account. Email change blocked.");
                err.statusCode = 409;
                throw err;
            }

            // 5b. Atomically recheck monthly limit
            const { startOfMonth, startOfNextMonth } = this.getUtcMonthBounds();
            const limitCheck = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM account_change_history
                 WHERE user_id = $1 AND change_type = 'email' AND created_at >= $2 AND created_at < $3;`,
                [userId, startOfMonth, startOfNextMonth]
            );
            if ((limitCheck.rows[0]?.count || 0) >= MONTHLY_LIMIT) {
                await client.query("ROLLBACK;");
                const err: any = new Error("Monthly email change limit reached (2 changes per UTC calendar month).");
                err.statusCode = 429;
                throw err;
            }

            // 5c. Update authoritative user email and verification status
            const userUpdateRes = await client.query(
                `UPDATE users
                 SET email = $1,
                     is_email_verified = true,
                     email_verified_at = CURRENT_TIMESTAMP,
                     is_verified_coder = true,
                     pending_email = NULL,
                     pending_email_operation_id = NULL
                 WHERE id = $2
                 RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", avatar_url AS "avatarUrl", photo_url AS "photoUrl", is_email_verified AS "isEmailVerified", is_verified_coder AS "isVerifiedCoder";`,
                [newEmail, userId]
            );
            const updatedUser = userUpdateRes.rows[0];

            // 5d. Record in audit history
            await client.query(
                `INSERT INTO account_change_history (
                    user_id,
                    operation_id,
                    change_type,
                    old_value,
                    new_value,
                    ip_address,
                    user_agent
                 ) VALUES ($1, $2, 'email', $3, $4, $5, $6);`,
                [userId, operationId, oldEmail, newEmail, ipAddress, userAgent]
            );

            // 5e. Mark operation completed & challenge consumed
            await client.query(
                `UPDATE account_change_operations
                 SET stage = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1;`,
                [operationId]
            );

            await client.query(
                `UPDATE account_change_challenges
                 SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
                 WHERE id = $1;`,
                [challenge.id]
            );

            // 5f. Synchronize leaderboard entry verification
            await client.query(
                `UPDATE leaderboard_entries SET is_verified = true WHERE user_id = $1;`,
                [userId]
            ).catch(() => {});

            await client.query("COMMIT;");

            // 6. Cache Invalidation & Update
            await deleteUserDetailsCache(oldEmail);
            await deleteUserDetailsCache(newEmail);
            await userDetailsCache({
                id: userId,
                firstName: updatedUser?.firstName,
                lastName: updatedUser?.lastName,
                gmail: newEmail,
                username: updatedUser?.username,
                termsAccepted: true,
                accountType: "personal",
            });

            // 7. Issue Fresh Access & Refresh Tokens
            const token = jwt.sign(
                {
                    sub: userId,
                    gmail: newEmail,
                    username: updatedUser?.username,
                },
                JWT_SECRET,
                {
                    expiresIn: "8h",
                    issuer: "orbix",
                    audience: "orbix-users",
                }
            );

            const refreshToken = jwt.sign(
                {
                    sub: userId,
                    gmail: newEmail,
                    username: updatedUser?.username,
                    type: "refresh",
                },
                JWT_SECRET,
                {
                    expiresIn: "7d",
                    issuer: "orbix",
                    audience: "orbix-users",
                }
            );

            // 8. Transactional Security Notifications to BOTH addresses concurrently
            const displayName = updatedUser?.firstName || updatedUser?.username || "Developer";

            const [oldNoticeRes, newNoticeRes] = await Promise.allSettled([
                sendSecurityNotificationEmail({
                    to: oldEmail,
                    name: displayName,
                    subject: "Security Alert: Primary Email Address Changed",
                    badgeText: "Security Alert",
                    headline: "Your Primary Email Was Changed",
                    message: `The primary email for your Orbix account (@${updatedUser?.username}) was successfully changed to <strong>${newEmail}</strong>. If you made this change, no further action is required.`,
                    isWarning: true,
                    footerNotice: "If you did NOT authorize this change, someone has gained unauthorized access to your account. Please contact support immediately."
                }),
                sendSecurityNotificationEmail({
                    to: newEmail,
                    name: displayName,
                    subject: "Your Orbix Primary Email Is Confirmed",
                    badgeText: "Email Verified",
                    headline: "Primary Email Address Confirmed",
                    message: `Your Orbix primary email address has been verified and updated to <strong>${newEmail}</strong>. You can now use this address to log in and receive notifications.`,
                    isWarning: false,
                    footerNotice: "Thank you for keeping your account secure."
                })
            ]);

            if (oldNoticeRes.status === "rejected" || (oldNoticeRes.status === "fulfilled" && !oldNoticeRes.value.success)) {
                console.warn("[Security Notification Warning] Old email notice failed:", oldNoticeRes.status === "rejected" ? oldNoticeRes.reason : oldNoticeRes.value.error);
            }
            if (newNoticeRes.status === "rejected" || (newNoticeRes.status === "fulfilled" && !newNoticeRes.value.success)) {
                console.warn("[Security Notification Warning] New email notice failed:", newNoticeRes.status === "rejected" ? newNoticeRes.reason : newNoticeRes.value.error);
            }

            return {
                success: true,
                message: "Email address changed and verified successfully!",
                primaryEmail: newEmail,
                newEmail,
                isEmailVerified: true,
                token,
                refreshToken,
                user: updatedUser,
            };

        } catch (dbErr) {
            await client.query("ROLLBACK;");
            throw dbErr;
        } finally {
            client.release();
        }
    }

    /**
     * Cancels an in-progress email change operation and clears pending state.
     */
    static async cancelEmailChange(userId: string, operationId?: string) {
        let opId = operationId;

        if (!opId) {
            const activeRes = await query(
                `SELECT id FROM account_change_operations
                 WHERE user_id = $1 AND change_type = 'email_change' AND stage NOT IN ('completed', 'cancelled', 'expired')
                 ORDER BY created_at DESC LIMIT 1;`,
                [userId]
            );
            opId = activeRes.rows[0]?.id;
        }

        if (opId) {
            const opCheck = await query(
                `SELECT user_id FROM account_change_operations WHERE id = $1;`,
                [opId]
            );
            if (!opCheck.rows[0] || opCheck.rows[0].user_id !== userId) {
                const err: any = new Error("Email change operation not found.");
                err.statusCode = 404;
                throw err;
            }

            await query(
                `UPDATE account_change_operations
                 SET stage = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Cancelled by user'
                 WHERE id = $1 AND user_id = $2;`,
                [opId, userId]
            );

            await query(
                `UPDATE account_change_challenges
                 SET status = 'expired'
                 WHERE operation_id = $1 AND status = 'pending';`,
                [opId]
            );
        }

        await query(
            `UPDATE users
             SET pending_email = NULL, pending_email_operation_id = NULL
             WHERE id = $1;`,
            [userId]
        );

        return {
            success: true,
            message: "Email change operation cancelled successfully.",
        };
    }

    /**
     * Resends the verification or authorization code for an active email change operation.
     */
    static async resendEmailChangeOtp(params: {
        userId: string;
        operationId: string;
        step: "old" | "new";
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, operationId, step, ipAddress = "unknown", userAgent = "unknown" } = params;

        // Fetch Operation
        const opRes = await query(
            `SELECT id, user_id, current_value, requested_value, stage, expires_at
             FROM account_change_operations
             WHERE id = $1 AND user_id = $2;`,
            [operationId, userId]
        );
        const op = opRes.rows[0];
        if (!op) {
            const err: any = new Error("Operation not found.");
            err.statusCode = 404;
            throw err;
        }

        const expectedStage = step === "old" ? "old_email_authorization_pending" : "new_email_verification_pending";
        const challengeType = step === "old" ? "old_email_auth" : "new_email_verify";
        const destination = step === "old" ? op.current_value : op.requested_value;

        if (op.stage !== expectedStage) {
            const err: any = new Error(`Cannot resend code for step '${step}' while in stage '${op.stage}'.`);
            err.statusCode = 400;
            throw err;
        }

        // Check Cooldown in Redis
        const cooldownKey = `otp:acct_change_cooldown:${operationId}:${challengeType}`;
        if (redis && redis.status === "ready") {
            const ttl = await redis.ttl(cooldownKey);
            if (ttl > 0) {
                const err: any = new Error(`Please wait ${ttl} seconds before requesting another code.`);
                err.statusCode = 429;
                err.cooldownRemainingSeconds = ttl;
                throw err;
            }
        }

        // Expire previous pending challenge for this step
        await query(
            `UPDATE account_change_challenges
             SET status = 'expired'
             WHERE operation_id = $1 AND challenge_type = $2 AND status = 'pending';`,
            [operationId, challengeType]
        );

        // Generate Fresh OTP
        const otp = this.generateSecureOtp();
        const otpHash = this.hashOtp(otp);
        const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);

        await query(
            `INSERT INTO account_change_challenges (
                operation_id,
                user_id,
                challenge_type,
                destination,
                otp_hash,
                status,
                ip_address,
                user_agent,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8);`,
            [operationId, userId, challengeType, destination, otpHash, ipAddress, userAgent, expiresAt]
        );

        // Extend operation expiry
        await query(
            `UPDATE account_change_operations
             SET expires_at = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2;`,
            [expiresAt, operationId]
        );

        // Set Cooldown
        if (redis && redis.status === "ready") {
            await redis.set(cooldownKey, "1", "EX", COOLDOWN_SECONDS);
        }

        // Fetch user name
        const userRes = await query(`SELECT firstname, username FROM users WHERE id = $1;`, [userId]);
        const displayName = userRes.rows[0]?.firstname || userRes.rows[0]?.username || "Developer";

        // Dispatch Email
        const isOld = step === "old";
        const sendResult = await sendSecurityNotificationEmail({
            to: destination,
            name: displayName,
            subject: `${isOld ? "Authorize Email Change" : "Verify New Email"}: ${otp}`,
            badgeText: isOld ? "Authorize Change" : "Verify Email",
            headline: isOld ? "Authorize Changing Your Primary Email" : "Confirm Your New Orbix Email",
            message: isOld
                ? `Here is your new authorization code to confirm changing your Orbix primary email to <strong>${op.requested_value}</strong>.`
                : `Here is your new verification code to confirm <strong>${destination}</strong> as your primary Orbix email.`,
            otp,
            otpLabel: isOld ? "Authorization Code" : "Verification Code",
            isWarning: false,
        });

        const isDev = process.env.NODE_ENV !== "production";

        return {
            success: true,
            message: `New code sent to ${destination}.`,
            cooldownSeconds: COOLDOWN_SECONDS,
            expiresAt: expiresAt.toISOString(),
            simulated: Boolean(sendResult.simulated),
            devOtp: (isDev || sendResult.sandboxRestricted || !sendResult.success) ? otp : undefined,
            sandboxRestricted: Boolean(sendResult.sandboxRestricted),
            provider: sendResult.provider,
        };
    }

    /**
     * Checks if a proposed username is valid and available.
     * Enforces canonical format (3-20 chars: a-z, 0-9, dot, _, -), rejects reserved routes,
     * checks case-insensitive database uniqueness, and prevents claiming recently released usernames.
     */
    static async checkUsernameAvailability(username: string, currentUserId: string): Promise<{
        available: boolean;
        isCurrent?: boolean;
        reason?: string;
    }> {
        if (!username || typeof username !== "string") {
            return { available: false, reason: "Username is required." };
        }

        const normalized = username.trim().toLowerCase();

        if (normalized.length < 3 || normalized.length > 20) {
            return { available: false, reason: "Username must be between 3 and 20 characters." };
        }

        if (!/^[a-z0-9._-]+$/.test(normalized)) {
            return { available: false, reason: "Username can only contain lowercase letters, numbers, dot (.), underscore (_), or hyphen (-)." };
        }

        if (RESERVED_USERNAMES.has(normalized)) {
            return { available: false, reason: "This username is reserved by the system." };
        }

        // Check if user already owns this username
        const currentCheck = await query(`SELECT id, username FROM users WHERE id = $1;`, [currentUserId]);
        if (currentCheck.rows[0]?.username?.toLowerCase() === normalized) {
            return { available: true, isCurrent: true, reason: "This is your current username." };
        }

        // Check if taken in database
        const conflictRes = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`, [normalized]);
        if (conflictRes.rows[0]) {
            return { available: false, reason: "This username is already taken." };
        }

        // Anti-impersonation: check if released within last 7 days by another user
        const historyCheck = await query(
            `SELECT id FROM account_change_history
             WHERE change_type = 'username' AND LOWER(old_value) = LOWER($1) AND user_id != $2
             AND created_at >= NOW() - INTERVAL '7 days'
             LIMIT 1;`,
            [normalized, currentUserId]
        );
        if (historyCheck.rows[0]) {
            return { available: false, reason: "This username was recently released and is temporarily on anti-impersonation hold." };
        }

        return { available: true };
    }

    /**
     * Step 1 for Username Change:
     * Evaluates monthly limits (2/month), validates format and availability,
     * and triggers step-up verification (Email OTP if email is verified, or password challenge).
     */
    static async requestUsernameChange(params: {
        userId: string;
        newUsername: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, newUsername, ipAddress = "unknown", userAgent = "unknown" } = params;

        // 1. Quota Check
        const quota = await this.getMonthlyQuota(userId, "username");
        if (!quota.canChange) {
            const err: any = new Error("Monthly username change limit reached (2 changes per UTC calendar month).");
            err.statusCode = 429;
            err.code = "MONTHLY_LIMIT_REACHED";
            err.limit = quota.limit;
            err.action = "username_change";
            err.nextEligibleAt = quota.nextResetAt;
            throw err;
        }

        // 2. Validate availability & format
        const avail = await this.checkUsernameAvailability(newUsername, userId);
        if (!avail.available) {
            const err: any = new Error(avail.reason || "Username is not available.");
            err.statusCode = 400;
            throw err;
        }
        if (avail.isCurrent) {
            const err: any = new Error("The requested username is already your active username.");
            err.statusCode = 400;
            throw err;
        }

        const normalizedUsername = newUsername.trim().toLowerCase();

        // 3. Fetch user
        const userRes = await query(
            `SELECT id, email, username, firstname, is_email_verified FROM users WHERE id = $1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        const currentUsername = user.username;

        // 4. If email is verified, issue step-up OTP challenge via email
        if (user.is_email_verified) {
            // Cancel previous active username change operations
            await query(
                `UPDATE account_change_operations
                 SET stage = 'cancelled', cancelled_at = CURRENT_TIMESTAMP, cancellation_reason = 'Superceded by new username change request'
                 WHERE user_id = $1 AND change_type = 'username_change' AND stage NOT IN ('completed', 'cancelled', 'expired');`,
                [userId]
            );

            const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
            const opRes = await query(
                `INSERT INTO account_change_operations (
                    user_id,
                    change_type,
                    current_value,
                    requested_value,
                    stage,
                    expires_at
                ) VALUES ($1, 'username_change', $2, $3, 'authorization_pending', $4)
                RETURNING id;`,
                [userId, currentUsername, normalizedUsername, expiresAt]
            );
            const operationId = opRes.rows[0].id;

            const otp = this.generateSecureOtp();
            const otpHash = this.hashOtp(otp);

            await query(
                `INSERT INTO account_change_challenges (
                    operation_id,
                    user_id,
                    challenge_type,
                    destination,
                    otp_hash,
                    status,
                    ip_address,
                    user_agent,
                    expires_at
                ) VALUES ($1, $2, 'username_change_auth', $3, $4, 'pending', $5, $6, $7);`,
                [operationId, userId, user.email, otpHash, ipAddress, userAgent, expiresAt]
            );

            if (redis && redis.status === "ready") {
                await redis.set(`otp:acct_change_cooldown:${operationId}:username_change_auth`, "1", "EX", COOLDOWN_SECONDS);
            }

            const displayName = user.firstname || user.username || "Developer";
            const sendResult = await sendSecurityNotificationEmail({
                to: user.email,
                name: displayName,
                subject: `Authorize Username Change: ${otp}`,
                badgeText: "Security Step-Up",
                headline: "Authorize Changing Your Username",
                message: `We received a request to change your Orbix username from <strong>@${currentUsername}</strong> to <strong>@${normalizedUsername}</strong>. Enter the 6-digit confirmation code below to verify your identity and commit the change.`,
                otp,
                otpLabel: "Security Code",
                isWarning: false,
                footerNotice: "If you did not request to change your username, please secure your account immediately."
            });

            const isDev = process.env.NODE_ENV !== "production";

            return {
                success: true,
                stepUpType: "email_otp",
                operationId,
                message: `Verification code sent to your verified email (${user.email}) to authorize username change.`,
                newUsername: normalizedUsername,
                cooldownSeconds: COOLDOWN_SECONDS,
                expiresAt: expiresAt.toISOString(),
                simulated: Boolean(sendResult.simulated),
                devOtp: (isDev || sendResult.sandboxRestricted || !sendResult.success) ? otp : undefined,
                sandboxRestricted: Boolean(sendResult.sandboxRestricted),
                provider: sendResult.provider,
            };
        }

        // 5. If email is unverified, fallback to password challenge
        return {
            success: true,
            stepUpType: "password",
            message: "Please enter your account password to authorize changing your username.",
            newUsername: normalizedUsername,
        };
    }

    /**
     * Step 2 for Username Change:
     * Validates step-up authorization (email OTP or password), atomically updates username
     * across users, user_links, and history in a DB transaction, and reissues authentication tokens.
     */
    static async confirmUsernameChange(params: {
        userId: string;
        newUsername: string;
        operationId?: string;
        otp?: string;
        currentPassword?: string;
        ipAddress?: string;
        userAgent?: string;
    }) {
        const { userId, newUsername, operationId, otp, currentPassword, ipAddress = "unknown", userAgent = "unknown" } = params;

        const normalizedUsername = (newUsername || "").trim().toLowerCase();

        // 1. Fetch user
        const userRes = await query(
            `SELECT id, email, username, password, firstname, lastname, avatar_url, photo_url, is_email_verified
             FROM users WHERE id = $1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            const err: any = new Error("User account not found.");
            err.statusCode = 404;
            throw err;
        }

        const oldUsername = user.username;

        // 2. Validate Step-Up Authentication
        let challengeIdToConsume: string | null = null;

        if (operationId && otp) {
            // Email OTP Step-up
            const cleanedOtp = otp.trim();
            const incomingHash = this.hashOtp(cleanedOtp);

            const opRes = await query(
                `SELECT id, stage, requested_value, expires_at
                 FROM account_change_operations
                 WHERE id = $1 AND user_id = $2 AND change_type = 'username_change';`,
                [operationId, userId]
            );
            const op = opRes.rows[0];
            if (!op || op.stage !== "authorization_pending") {
                const err: any = new Error("Username change operation not found or expired.");
                err.statusCode = 400;
                throw err;
            }

            if (new Date() > new Date(op.expires_at)) {
                await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
                const err: any = new Error("The verification code has expired. Please request a new username change.");
                err.statusCode = 400;
                throw err;
            }

            const chalRes = await query(
                `SELECT id, otp_hash, attempts
                 FROM account_change_challenges
                 WHERE operation_id = $1 AND challenge_type = 'username_change_auth' AND status = 'pending'
                 ORDER BY created_at DESC LIMIT 1;`,
                [operationId]
            );
            const challenge = chalRes.rows[0];
            if (!challenge) {
                const err: any = new Error("Authorization challenge not found or already used.");
                err.statusCode = 400;
                throw err;
            }

            if (challenge.attempts >= MAX_VERIFY_ATTEMPTS) {
                await query(`UPDATE account_change_challenges SET status = 'failed' WHERE id = $1;`, [challenge.id]);
                await query(`UPDATE account_change_operations SET stage = 'expired' WHERE id = $1;`, [operationId]);
                const err: any = new Error("Too many incorrect attempts. Code invalidated.");
                err.statusCode = 400;
                throw err;
            }

            const isMatch = crypto.timingSafeEqual(
                Buffer.from(challenge.otp_hash, "hex"),
                Buffer.from(incomingHash, "hex")
            );

            if (!isMatch) {
                const newAttempts = challenge.attempts + 1;
                const remaining = MAX_VERIFY_ATTEMPTS - newAttempts;
                await query(`UPDATE account_change_challenges SET attempts = $1 WHERE id = $2;`, [newAttempts, challenge.id]);
                const err: any = new Error(`Invalid verification code. You have ${remaining} ${remaining === 1 ? "attempt" : "attempts"} remaining.`);
                err.statusCode = 400;
                err.attemptsRemaining = remaining;
                throw err;
            }

            challengeIdToConsume = challenge.id;

        } else if (currentPassword) {
            // Password verification step-up
            const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
            if (!isPasswordValid) {
                const err: any = new Error("Incorrect account password. Username change rejected.");
                err.statusCode = 401;
                throw err;
            }
        } else {
            const err: any = new Error("Step-up verification (verification code or password) is required to change username.");
            err.statusCode = 400;
            throw err;
        }

        // 3. ATOMIC DATABASE TRANSACTION
        const client = await pool.connect();
        try {
            await client.query("BEGIN;");

            // 3a. Recheck username availability with row lock
            const conflictCheck = await client.query(
                `SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2 FOR UPDATE;`,
                [normalizedUsername, userId]
            );
            if (conflictCheck.rows[0]) {
                await client.query("ROLLBACK;");
                const err: any = new Error("This username was just claimed by another user.");
                err.statusCode = 409;
                throw err;
            }

            // 3b. Recheck monthly limit
            const { startOfMonth, startOfNextMonth } = this.getUtcMonthBounds();
            const limitCheck = await client.query(
                `SELECT COUNT(*)::int AS count
                 FROM account_change_history
                 WHERE user_id = $1 AND change_type = 'username' AND created_at >= $2 AND created_at < $3;`,
                [userId, startOfMonth, startOfNextMonth]
            );
            if ((limitCheck.rows[0]?.count || 0) >= MONTHLY_LIMIT) {
                await client.query("ROLLBACK;");
                const err: any = new Error("Monthly username change limit reached (2 changes per UTC calendar month).");
                err.statusCode = 429;
                throw err;
            }

            // 3c. Update authoritative user record
            const updateRes = await client.query(
                `UPDATE users
                 SET username = $1, username_updated_at = CURRENT_TIMESTAMP
                 WHERE id = $2
                 RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", avatar_url AS "avatarUrl", photo_url AS "photoUrl", is_email_verified AS "isEmailVerified", is_verified_coder AS "isVerifiedCoder";`,
                [normalizedUsername, userId]
            );
            const updatedUser = updateRes.rows[0];

            // 3d. Update username reference on user_links
            await client.query(
                `UPDATE user_links
                 SET username = $1, updated_at = CURRENT_TIMESTAMP
                 WHERE user_id = $2;`,
                [normalizedUsername, userId]
            );

            // 3e. Record in audit history
            await client.query(
                `INSERT INTO account_change_history (
                    user_id,
                    operation_id,
                    change_type,
                    old_value,
                    new_value,
                    ip_address,
                    user_agent
                 ) VALUES ($1, $2, 'username', $3, $4, $5, $6);`,
                [userId, operationId || null, oldUsername, normalizedUsername, ipAddress, userAgent]
            );

            // 3f. Complete operation & consume challenge if present
            if (operationId) {
                await client.query(
                    `UPDATE account_change_operations
                     SET stage = 'completed', completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $1;`,
                    [operationId]
                );
            }

            if (challengeIdToConsume) {
                await client.query(
                    `UPDATE account_change_challenges
                     SET status = 'consumed', consumed_at = CURRENT_TIMESTAMP
                     WHERE id = $1;`,
                    [challengeIdToConsume]
                );
            }

            await client.query("COMMIT;");

            // 4. Invalidate and update Redis user caches
            await deleteUserDetailsCache(user.email);
            await userDetailsCache({
                id: userId,
                firstName: updatedUser?.firstName,
                lastName: updatedUser?.lastName,
                gmail: user.email,
                username: normalizedUsername,
                termsAccepted: true,
                accountType: "personal",
            });

            // 5. Issue updated tokens
            const token = jwt.sign(
                {
                    sub: userId,
                    gmail: user.email,
                    username: normalizedUsername,
                },
                JWT_SECRET,
                {
                    expiresIn: "8h",
                    issuer: "orbix",
                    audience: "orbix-users",
                }
            );

            const refreshToken = jwt.sign(
                {
                    sub: userId,
                    gmail: user.email,
                    username: normalizedUsername,
                    type: "refresh",
                },
                JWT_SECRET,
                {
                    expiresIn: "7d",
                    issuer: "orbix",
                    audience: "orbix-users",
                }
            );

            // 6. Security Notification Email
            sendSecurityNotificationEmail({
                to: user.email,
                name: updatedUser?.firstName || normalizedUsername,
                subject: `Orbix Username Updated: @${normalizedUsername}`,
                badgeText: "Username Updated",
                headline: "Your Username Has Been Changed",
                message: `The username for your Orbix account was changed from <strong>@${oldUsername}</strong> to <strong>@${normalizedUsername}</strong>. Public links to your profile now resolve to your new username.`,
                isWarning: false,
                footerNotice: "If you did not make this change, please contact support immediately."
            }).catch(e => console.error("[Security Notification Error] Username change notice failed:", e.message));

            return {
                success: true,
                message: "Username updated successfully!",
                username: normalizedUsername,
                newUsername: normalizedUsername,
                token,
                refreshToken,
                user: updatedUser,
            };

        } catch (dbErr) {
            await client.query("ROLLBACK;");
            throw dbErr;
        } finally {
            client.release();
        }
    }
}
