import express, { type Request, type Response } from 'express';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import validator from "validator";
import SignupValidator, { ValidationError } from '../../validators/SignupValidator.js';
import { query } from "../../database/client.js"
import SigninValidator from '../../validators/SigninValidator.js';
import { failsOccursSignin, failsOccursSignup, resetSigninFailures, getFailures } from '../../redis/rate-limiters/rate-limiters-auth.js';
import { deleteUserDetailsCache, getUserDetailsCache, userDetailsCache } from '../../redis/cache/cache-auth.js';
import redis from '../../redis/client.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { handleSavePortals, handleGetSavedPortals } from '../portals/portals.js';
import { handleGetMyProfile, parseLinks } from '../profile/profile.js';
import { EmailVerificationService } from '../../services/email/emailVerificationService.js';
import { TwoFactorAuthService } from '../../services/auth/twoFactorAuthService.js';
import { enrichUserWithClubData } from '../../services/club/clubEnrichmentService.js';
import {
    createSession,
    revokeSession,
    isSessionRevoked,
    throttleTouchSession,
} from '../../services/session/sessionService.js';
import { time } from 'node:console';
const authRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not configured");
    process.exit(1);
}



const isProduction = process.env.NODE_ENV === "production";
const ACCESS_TOKEN_EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const getAuthCookieOptions = () => ({
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: isProduction,
});

authRouter.post('/signup/send-email-otp', async (req: Request, res: Response) => {
    try {
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = (req.headers["user-agent"] as string) || "unknown";

        const attempts = await failsOccursSignup({ ip });
        if (attempts > 10) {
            return res.status(429).json({
                success: false,
                message: "Too many verification requests. Please try again later."
            });
        }

        const rawEmail = req.body?.email || req.body?.gmail;
        if (!rawEmail || typeof rawEmail !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid email address is required."
            });
        }

        const normalizedEmail = rawEmail.trim().toLowerCase();
        if (!validator.isEmail(normalizedEmail)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address."
            });
        }

        // 1. Pre-check: Is email already registered?
        const existingEmailResult = await query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
            [normalizedEmail]
        );
        if (existingEmailResult.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address already exists. Please sign in instead."
            });
        }

        // 2. Pre-check: If username provided, is it taken?
        const rawUsername = req.body?.username;
        if (rawUsername && typeof rawUsername === "string") {
            const normalizedUsername = rawUsername.trim().toLowerCase();
            if (!validator.matches(normalizedUsername, /^[a-z0-9._-]{3,20}$/)) {
                return res.status(400).json({
                    success: false,
                    message: "Username must be 3-20 characters: lowercase letters, numbers, dot, _, or -."
                });
            }

            const existingUsernameResult = await query(
                `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                [normalizedUsername]
            );
            if (existingUsernameResult.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "This username is already taken. Please choose a different username."
                });
            }
        }

        // 2b. Pre-check: If phone number provided, is it taken?
        const rawPhone = req.body?.phone;
        if (rawPhone && typeof rawPhone === "string" && rawPhone.trim()) {
            const normalizedPhone = rawPhone.trim();
            const existingPhoneResult = await query(
                `SELECT id FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) LIMIT 1;`,
                [normalizedPhone]
            );
            if (existingPhoneResult.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "This mobile phone number is already registered to another Orbix account."
                });
            }
        }

        // 3. Determine recipient display name for email
        const firstName = req.body?.firstName ? String(req.body.firstName).trim() : "";
        const lastName = req.body?.lastName ? String(req.body.lastName).trim() : "";
        const displayName = [firstName, lastName].filter(Boolean).join(" ") || (rawUsername ? String(rawUsername).trim() : "Developer");

        // 4. Send Pre-Registration OTP via Resend
        const result = await EmailVerificationService.sendPreRegistrationOtp({
            email: normalizedEmail,
            name: displayName,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send email verification code",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

authRouter.post('/signup/verify-email-otp', async (req: Request, res: Response) => {
    try {
        const rawEmail = req.body?.email || req.body?.gmail;
        const otp = req.body?.otp;

        if (!rawEmail || typeof rawEmail !== "string") {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        if (!otp || typeof otp !== "string") {
            return res.status(400).json({
                success: false,
                message: "6-digit verification code is required."
            });
        }

        const normalizedEmail = rawEmail.trim().toLowerCase();
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";

        const result = await EmailVerificationService.verifyPreRegistrationOtp({
            email: normalizedEmail,
            otp: otp.trim(),
            ipAddress: ip,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Email verification failed",
        });
    }
});

authRouter.post('/signup', async (req: Request, res: Response) => {
    try {
        // Rate Limiting
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const attempts = await failsOccursSignup({ ip });
        if (attempts > 5) {
            return res.status(429).json({ success: false, message: "Too many signup attempts. Please try again later." });
        }

        // Validate Data
        const validatedData = SignupValidator(req.body);

        // Enforce Email OTP Verification Requirement
        const verificationToken = req.body?.verificationToken;
        const directOtp = req.body?.otp;

        let emailVerified = false;

        if (verificationToken && typeof verificationToken === "string") {
            const isValidToken = EmailVerificationService.verifyVerificationToken(
                verificationToken,
                validatedData.gmail
            );
            if (!isValidToken) {
                return res.status(400).json({
                    success: false,
                    message: "Email verification proof is invalid or has expired. Please verify your email again."
                });
            }
            emailVerified = true;
        } else if (directOtp && typeof directOtp === "string") {
            // Direct atomic verification support
            const otpResult = await EmailVerificationService.verifyPreRegistrationOtp({
                email: validatedData.gmail,
                otp: directOtp.trim(),
                ipAddress: ip,
            });
            if (!otpResult || !otpResult.success) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid or expired verification code."
                });
            }
            emailVerified = true;
        } else {
            return res.status(400).json({
                success: false,
                message: "Email verification is required before creating an account. Please verify your email via the OTP sent to your inbox."
            });
        }

        if (!emailVerified) {
            return res.status(400).json({
                success: false,
                message: "Email verification could not be confirmed. Please request a new code."
            });
        }

        // Hash Password AFTER validation
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // 1. Insert into Database FIRST with default avatar, verified email and verified coder flag
        const defaultAvatarUrl = "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
        const result = await query(
            `
                INSERT INTO users (
                    username,
                    firstname,
                    middlename,
                    lastname,
                    email,
                    password,
                    termsaccepted,
                    avatar_url,
                    account_type,
                    is_email_verified,
                    email_verified_at,
                    is_verified_coder
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'personal',true,CURRENT_TIMESTAMP,true)
                RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", avatar_url AS "avatarUrl", photo_url AS "photoUrl", is_email_verified AS "isEmailVerified", is_verified_coder AS "isVerifiedCoder"`,
            [
                validatedData.username,
                validatedData.firstName,
                validatedData.middleName || null,
                validatedData.lastName,
                validatedData.gmail,
                hashedPassword,
                validatedData.termsAccepted,
                defaultAvatarUrl
            ]
        );

        const createdUser = result.rows[0];
        const userId = createdUser?.id || `usr-${Date.now()}`;

        // Ensure leaderboard entry verification status is synchronized
        try {
            await query(`UPDATE leaderboard_entries SET is_verified = true WHERE user_id = $1;`, [userId]);
        } catch {
            // Non-blocking if user doesn't have leaderboard row yet
        }

        // Create canonical persistent session record on genuine signup authentication
        const sessionResult = await createSession({
            userId,
            req,
            loginMethod: "password",
            isMfa: false,
        });
        const sessionId = sessionResult.sessionId;

        // 2. Generate Access Token & Refresh Token
        const token = jwt.sign(
            {
                sub: userId,
                gmail: validatedData.gmail,
                username: validatedData.username,
                sid: sessionId,
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: userId,
                gmail: validatedData.gmail,
                username: validatedData.username,
                sid: sessionId,
                type: "refresh"
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // 3. Set Cookies with explicit root path
        res.cookie("token", token, {
            ...getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS
        });

        res.cookie("refreshToken", refreshToken, {
            ...getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS
        });


        await userDetailsCache({
            id: userId,
            firstName: validatedData.firstName,
            middleName: validatedData.middleName,
            lastName: validatedData.lastName,
            gmail: validatedData.gmail,
            username: validatedData.username,
            password_hash: hashedPassword,
            termsAccepted: validatedData.termsAccepted,
            accountType: "personal"
        });

        // 4. Return Success
        return res.status(201).json({
            success: true,
            message: 'Account registered and email verified successfully!',
            token,
            user: {
                id: userId,
                username: validatedData.username,
                firstName: validatedData.firstName,
                middleName: validatedData.middleName,
                lastName: validatedData.lastName,
                gmail: validatedData.gmail,
                avatarUrl: defaultAvatarUrl,
                photoUrl: null,
                isEmailVerified: true,
                isVerifiedCoder: true,
                isVerified: true,
            }
        });

    } catch (err: any) {
        // Handle Validation Errors cleanly
        if (err instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        // Handle Postgres Unique Constraint Violation
        if (err.code === '23505') {
            return res.status(409).json({
                success: false,
                message: 'Username or email already exists!'
            });
        }

        // Log actual error on server, but DO NOT leak to client
        console.error("Signup Internal Error:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

authRouter.post('/signin', async (req: Request, res: Response) => {
    try {
        const validatedData = SigninValidator(req.body);

        // Rate Limiting
        const failures = await getFailures({
            email: validatedData.gmail,
            ip: req.ip || "unknown",
        });

        if (failures >= 10) {
            return res.status(429).json({
                success: false,
                message: "Too many failed attempts. Please try again later."
            });
        }

        // 1. Query authoritative database for credentials and full user profile (by email or username)
        let Result = await query(
            `SELECT
                id,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                username,
                password AS password_hash,
                termsaccepted AS "termsAccepted",
                account_type AS "accountType",
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
                COALESCE(is_email_verified, false) AS "isEmailVerified",
                email_verified_at AS "emailVerifiedAt",
                (COALESCE(is_email_verified, false) = true) AS "isVerifiedCoder",
                (COALESCE(is_email_verified, false) = true) AS "isVerified",
                COALESCE(is_two_factor_enabled, false) AS "isTwoFactorEnabled",
                two_factor_enabled_at AS "twoFactorEnabledAt",
                created_at AS "createdAt"
            FROM users
            WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
            LIMIT 1;`,
            [validatedData.gmail]
        );

        // 2. If not matched directly on users, check verified_clubs (slug/public_email) or club_verification_requests (contact_email)
        if (Result.rows.length === 0) {
            const clubLookup = await query(
                `SELECT auth_user_id FROM verified_clubs 
                 WHERE LOWER(slug) = LOWER($1) OR LOWER(public_email) = LOWER($1)
                 LIMIT 1;`,
                [validatedData.gmail]
            );
            let targetUserId: string | null = clubLookup.rows[0]?.auth_user_id || null;

            if (!targetUserId) {
                const reqLookup = await query(
                    `SELECT auth_user_id FROM club_verification_requests 
                     WHERE LOWER(contact_email) = LOWER($1) OR LOWER(college_official_email) = LOWER($1)
                     LIMIT 1;`,
                    [validatedData.gmail]
                );
                targetUserId = reqLookup.rows[0]?.auth_user_id || null;
            }

            if (targetUserId) {
                Result = await query(
                    `SELECT
                        id,
                        firstname AS "firstName",
                        middlename AS "middleName",
                        lastname AS "lastName",
                        email AS gmail,
                        username,
                        password AS password_hash,
                        termsaccepted AS "termsAccepted",
                        account_type AS "accountType",
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
                        COALESCE(is_email_verified, false) AS "isEmailVerified",
                        email_verified_at AS "emailVerifiedAt",
                        (COALESCE(is_email_verified, false) = true) AS "isVerifiedCoder",
                        (COALESCE(is_email_verified, false) = true) AS "isVerified",
                        COALESCE(is_two_factor_enabled, false) AS "isTwoFactorEnabled",
                        two_factor_enabled_at AS "twoFactorEnabledAt",
                        created_at AS "createdAt"
                    FROM users
                    WHERE id = $1
                    LIMIT 1;`,
                    [targetUserId]
                );
            }
        }

        const user = Result.rows[0];

        if (!user || !user.password_hash) {
            await bcrypt.compare("dummy", "$2b$10$XN4E5x6gT3x7l3eUaR9UOuQYx8wO1bU1Jv3bT6D2p7t3Z6U1q9F4W");
            await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" });
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Password verification against real database hash
        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);

        if (!isPasswordValid) {
            await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" });
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Context-aware Account Type resolution (seamless personal vs club login)
        const requestedAccountType =
            validatedData.accountType ||
            req.body?.accountType ||
            req.body?.loginMode ||
            req.body?.expectedAccountType;

        const effectiveAccountType = requestedAccountType === "club" ? "club" : "personal";

        // Intercept login if Two-Factor Authentication is enabled on this account
        if (user.isTwoFactorEnabled) {
            const clientIp = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
            const userAgent = (req.headers["user-agent"] as string) || "unknown";

            const twoFactorResult = await TwoFactorAuthService.initiateLogin2FA({
                userId: user.id,
                email: user.gmail,
                username: user.username,
                name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.username,
                ipAddress: clientIp,
                userAgent,
            });

            return res.status(200).json({
                success: true,
                requires2FA: true,
                accountType: effectiveAccountType,
                twoFactorChallengeToken: twoFactorResult.challengeToken,
                maskedEmail: twoFactorResult.maskedEmail,
                cooldownSeconds: twoFactorResult.cooldownSeconds,
                message: twoFactorResult.message,
            });
        }

        // Create canonical persistent session record on genuine authentication
        const sessionResult = await createSession({
            userId: user.id,
            req,
            loginMethod: "password",
            isMfa: false,
        });
        const sessionId = sessionResult.sessionId;

        // Generate Access Token & Refresh Token with context-aware accountType & session ID
        const token = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: effectiveAccountType,
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: effectiveAccountType,
                type: "refresh"
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // Set Cookies with explicit root path
        res.cookie("token", token, {
            ...getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS
        });

        res.cookie("refreshToken", refreshToken, {
            ...getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS
        });

        // Strip password_hash before returning user
        const { password_hash, ...safeUser }: any = user;
        safeUser.accountType = effectiveAccountType;
        safeUser.links = parseLinks(safeUser.links, safeUser);
        safeUser.skills = Array.isArray(safeUser.skills) ? safeUser.skills : [];

        // Fetch user's connected platforms from database
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
            [user.username, user.gmail]
        );
        safeUser.platforms = linksResult.rows || [];

        // Enrich club status & verified club details for all accounts
        await enrichUserWithClubData(safeUser, user.id);

        await resetSigninFailures({ email: validatedData.gmail, ip: req.ip || "unknown" });

        await userDetailsCache({ id: user.id, firstName: user.firstName, middleName: user.middleName, lastName: user.lastName, gmail: user.gmail, username: user.username, password_hash, termsAccepted: user.termsAccepted });
        return res.status(200).json({
            success: true,
            message: "Login successfully",
            token,
            refreshToken,
            user: safeUser
        });

    } catch (err: any) {
        if (err instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                message: err.message
            });
        }

        console.error("Signin Internal Error:", err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
});

/**
 * Token Refresh Endpoint:
 * Handles refreshing expired or active access tokens using the refresh token or current token.
 * Supports POST /refresh, POST /refresh-token, and GET /refresh.
 */
const handleTokenRefresh = async (req: Request, res: Response) => {
    try {
        const tokenCandidate =
            req.cookies?.refreshToken ||
            req.cookies?.token ||
            req.body?.refreshToken ||
            req.body?.token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : undefined);

        if (!tokenCandidate || typeof tokenCandidate !== "string") {
            return res.status(401).json({
                success: false,
                message: "No authentication token provided. Please sign in."
            });
        }

        let decoded: any = null;
        try {
            decoded = jwt.verify(tokenCandidate, JWT_SECRET, {
                issuer: "orbix",
                audience: "orbix-users"
            });
        } catch (verifyErr: any) {
            // If token expired, attempt to safely decode to refresh session if valid payload
            try {
                decoded = jwt.decode(tokenCandidate) as any;
                if (!decoded || !decoded.gmail) {
                    throw new Error("Invalid token payload");
                }
            } catch {
                // Completely invalid token: clear cookies
                res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
                res.clearCookie("refreshToken", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
                return res.status(401).json({
                    success: false,
                    message: "Session expired or invalid. Please sign in again."
                });
            }
        }

        const userGmail = decoded?.gmail;
        if (!userGmail) {
            return res.status(401).json({
                success: false,
                message: "Invalid session token."
            });
        }

        // Fetch full authoritative user profile from database
        const Result = await query(
            `SELECT
                id,
                firstname AS "firstName",
                middlename AS "middleName",
                lastname AS "lastName",
                email AS gmail,
                username,
                password AS password_hash,
                termsaccepted AS "termsAccepted",
                account_type AS "accountType",
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
                COALESCE(is_email_verified, false) AS "isEmailVerified",
                email_verified_at AS "emailVerifiedAt",
                (COALESCE(is_email_verified, false) = true) AS "isVerifiedCoder",
                (COALESCE(is_email_verified, false) = true) AS "isVerified",
                COALESCE(is_two_factor_enabled, false) AS "isTwoFactorEnabled",
                two_factor_enabled_at AS "twoFactorEnabledAt",
                created_at AS "createdAt"
            FROM users
            WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($1)
            LIMIT 1;`,
            [userGmail]
        );
        const user = Result.rows[0];

        if (!user) {
            res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
            res.clearCookie("refreshToken", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
            return res.status(401).json({
                success: false,
                message: "User account not found. Please sign in again."
            });
        }

        const existingSessionId = decoded?.sid || decoded?.sessionId;
        if (existingSessionId) {
            const isRevoked = await isSessionRevoked(existingSessionId);
            if (isRevoked) {
                res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
                res.clearCookie("refreshToken", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
                return res.status(401).json({
                    success: false,
                    message: "Session has been terminated or expired. Please sign in again.",
                });
            }
            // Touch existing session's last_active_at (throttled to once per 5 minutes)
            throttleTouchSession(existingSessionId);
        }

        const refreshedAccountType = decoded?.accountType || user.accountType || "personal";

        // Generate fresh Access Token (8 hours) and fresh Refresh Token (7 days) retaining existing session ID
        const newAccessToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: existingSessionId,
                accountType: refreshedAccountType,
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        const newRefreshToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: existingSessionId,
                accountType: refreshedAccountType,
                type: "refresh"
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // Update cookies with explicit path: "/"
        res.cookie("token", newAccessToken, {
            ...getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS
        });

        res.cookie("refreshToken", newRefreshToken, {
            ...getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS
        });

        const { password_hash, ...safeUser }: any = user;
        safeUser.accountType = refreshedAccountType;
        safeUser.links = parseLinks(safeUser.links, safeUser);
        safeUser.skills = Array.isArray(safeUser.skills) ? safeUser.skills : [];

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
            [user.username, user.gmail]
        );
        safeUser.platforms = linksResult.rows || [];

        // Enrich club status & verified club details for all accounts
        await enrichUserWithClubData(safeUser, user.id);

        await userDetailsCache({ ...user, id: user.id });

        return res.status(200).json({
            success: true,
            message: "Token refreshed successfully",
            token: newAccessToken,
            refreshToken: newRefreshToken,
            user: safeUser
        });

    } catch (err: any) {
        console.error("Token refresh error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal server error refreshing token"
        });
    }
};

authRouter.post('/refresh', handleTokenRefresh);
authRouter.post('/refresh-token', handleTokenRefresh);
authRouter.get('/refresh', handleTokenRefresh);

authRouter.post('/signout', async (req: Request, res: Response) => {
    try {
        let gmail = req.body?.gmail;
        let sessionId: string | null = null;
        let userId: string | null = null;

        // Extract session ID and user from cookie/JWT
        const rawToken = req.cookies?.token || req.cookies?.refreshToken;
        if (rawToken && typeof rawToken === "string") {
            try {
                const decoded = jwt.decode(rawToken) as any;
                if (decoded?.gmail && !gmail) {
                    gmail = decoded.gmail;
                }
                if (decoded?.sub) {
                    userId = decoded.sub;
                }
                if (decoded?.sid) {
                    sessionId = decoded.sid;
                }
            } catch {
                // ignore
            }
        }

        // Revoke persistent session in database and Redis
        if (userId && sessionId) {
            revokeSession(userId, sessionId, "user_logout").catch((err) => {
                console.warn("[Signout] Session revocation non-blocking warning:", err?.message);
            });
        }

        if (gmail && typeof gmail === 'string') {
            await deleteUserDetailsCache(gmail).catch(() => { });
            // Also invalidate profile and portals caches in Redis
            try {
                if (redis && redis.status === "ready") {
                    await Promise.allSettled([
                        redis.del(`user:portals:${gmail}`),
                        redis.del(`profile:public:${gmail}`),
                    ]);
                }
            } catch {
                // ignore
            }
        }

        const clearOpts = {
            ...getAuthCookieOptions(),
            expires: new Date(0),
            maxAge: 0,
        };

        // Thoroughly clear both token and refreshToken across all browser scopes
        res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
        res.clearCookie("refreshToken", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });

        res.cookie("token", "", clearOpts);
        res.cookie("refreshToken", "", clearOpts);

        return res.json({
            success: true,
            message: "Logout Successfully !"
        });
    } catch (err: any) {
        console.error("Signout error:", err);
        return res.status(500).json({
            success: false,
            message: "Error signing out"
        });
    }
});

const handleMeEndpoint = handleGetMyProfile;

authRouter.get("/profile/me", authenticate, handleGetMyProfile);
authRouter.get("/me", authenticate, handleGetMyProfile);

// Profile portal save & retrieval endpoints (/api/profile/save)
authRouter.post("/profile/save", authenticate, handleSavePortals);
authRouter.get("/profile/save", authenticate, handleGetSavedPortals);

/* ==========================================================================
   Two-Factor Authentication (2FA) Routes
   ========================================================================== */

/**
 * POST /api/auth/2fa/verify-login & /api/2fa/verify-login
 * Verifies the 6-digit OTP sent to the user's email during login challenge.
 */
const handleVerifyLogin2FA = async (req: Request, res: Response) => {
    try {
        const { challengeToken, otp } = req.body;
        if (!challengeToken || !otp) {
            return res.status(400).json({
                success: false,
                message: "Challenge token and 6-digit verification code are required."
            });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const { user } = await TwoFactorAuthService.verifyLoginOtp({
            challengeToken: String(challengeToken).trim(),
            otp: String(otp).trim(),
            ipAddress: ip
        });

        // Context-aware Account Type resolution on 2FA Login
        const requestedAccountType = req.body?.accountType || req.body?.loginMode || req.body?.expectedAccountType;
        const effectiveAccountType = requestedAccountType === "club" ? "club" : "personal";

        // Create canonical persistent session record on genuine 2FA authentication
        const sessionResult = await createSession({
            userId: user.id,
            req,
            loginMethod: "2fa_otp",
            isMfa: true,
        });
        const sessionId = sessionResult.sessionId;

        // Generate Access Token & Refresh Token
        const token = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: effectiveAccountType,
            },
            JWT_SECRET,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username,
                sid: sessionId,
                accountType: effectiveAccountType,
                type: "refresh"
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users"
            }
        );

        // Set Auth Cookies
        res.cookie("token", token, {
            ...getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS
        });

        res.cookie("refreshToken", refreshToken, {
            ...getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS
        });

        const safeUser: any = { ...user };
        safeUser.accountType = effectiveAccountType;
        safeUser.links = parseLinks(safeUser.links, safeUser);
        safeUser.skills = Array.isArray(safeUser.skills) ? safeUser.skills : [];

        const linksResult = await query(
            `SELECT
                id, portal, portal_username AS "portalUsername", link, raw_input AS "rawInput",
                verified, display_name AS "displayName", avatar_url AS "avatarUrl", stats,
                is_public AS "isPublic", last_sync_status AS "lastSyncStatus", last_sync_at AS "lastSyncAt"
            FROM user_links
            WHERE username = $1 OR username = $2
            ORDER BY created_at ASC;`,
            [user.username, user.gmail]
        );
        safeUser.platforms = linksResult.rows || [];

        await enrichUserWithClubData(safeUser, user.id);
        await resetSigninFailures({ email: user.gmail, ip });
        await userDetailsCache({ id: user.id, firstName: user.firstName, middleName: user.middleName, lastName: user.lastName, gmail: user.gmail, username: user.username, termsAccepted: user.termsAccepted });

        return res.status(200).json({
            success: true,
            message: "Signed in successfully with Two-Factor Authentication",
            token,
            refreshToken,
            user: safeUser
        });
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to verify Two-Factor code."
        });
    }
};

authRouter.post('/auth/2fa/verify-login', handleVerifyLogin2FA);
authRouter.post('/2fa/verify-login', handleVerifyLogin2FA);

/**
 * POST /api/auth/2fa/resend-login-otp & /api/2fa/resend-login-otp
 * Resends the 6-digit OTP code to the registered email during login.
 */
const handleResendLoginOtp = async (req: Request, res: Response) => {
    try {
        const { challengeToken } = req.body;
        if (!challengeToken) {
            return res.status(400).json({
                success: false,
                message: "Verification challenge token is required."
            });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = (req.headers["user-agent"] as string) || "unknown";

        const result = await TwoFactorAuthService.resendLoginOtp({
            challengeToken: String(challengeToken).trim(),
            ipAddress: ip,
            userAgent
        });

        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to resend Two-Factor code."
        });
    }
};

authRouter.post('/auth/2fa/resend-login-otp', handleResendLoginOtp);
authRouter.post('/2fa/resend-login-otp', handleResendLoginOtp);

/**
 * POST /api/auth/2fa/setup/send-otp & /api/2fa/setup/send-otp
 * Authenticated endpoint: Sends a 6-digit verification OTP to user's email to enable 2FA in Settings.
 */
const handleSendSetupOtp = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const userId = authUser?.sub || authUser?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const userRes = await query(
            `SELECT id, email, username, firstname, lastname, COALESCE(is_two_factor_enabled, false) as "isTwoFactorEnabled"
             FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const user = userRes.rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: "User account not found." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = (req.headers["user-agent"] as string) || "unknown";

        const result = await TwoFactorAuthService.sendSetupOtp({
            userId: user.id,
            email: user.email,
            name: `${user.firstname || ""} ${user.lastname || ""}`.trim() || user.username,
            ipAddress: ip,
            userAgent
        });

        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to send 2FA setup verification code."
        });
    }
};

authRouter.post('/auth/2fa/setup/send-otp', authenticate, handleSendSetupOtp);
authRouter.post('/2fa/setup/send-otp', authenticate, handleSendSetupOtp);

/**
 * POST /api/auth/2fa/setup/verify-otp & /api/2fa/setup/verify-otp
 * Authenticated endpoint: Verifies the 6-digit setup code and enables 2FA on the user's account.
 */
const handleVerifySetupOtp = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const userId = authUser?.sub || authUser?.id;
        const { otp } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }
        if (!otp || String(otp).trim().length !== 6) {
            return res.status(400).json({ success: false, message: "Please provide a valid 6-digit verification code." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const result = await TwoFactorAuthService.verifySetupOtp({
            userId,
            otp: String(otp).trim(),
            ipAddress: ip
        });

        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to verify 2FA code."
        });
    }
};

authRouter.post('/auth/2fa/setup/verify-otp', authenticate, handleVerifySetupOtp);
authRouter.post('/2fa/setup/verify-otp', authenticate, handleVerifySetupOtp);

/**
 * POST /api/auth/2fa/disable & /api/2fa/disable
 * Authenticated endpoint: Disables 2FA on the user's account after optional password confirmation.
 */
const handleDisable2FA = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const userId = authUser?.sub || authUser?.id;
        const { password } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const disablePayload: { userId: string; password?: string; ipAddress?: string } = {
            userId: String(userId),
            ipAddress: String(ip)
        };
        if (password) {
            disablePayload.password = String(password);
        }
        const result = await TwoFactorAuthService.disable2FA(disablePayload);

        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to disable Two-Factor Authentication."
        });
    }
};

authRouter.post('/auth/2fa/disable', authenticate, handleDisable2FA);
authRouter.post('/2fa/disable', authenticate, handleDisable2FA);

/**
 * POST /api/auth/password/change & /api/password/change
 * Unified password change endpoint for authenticated sessions.
 */
const handlePasswordChange = async (req: Request, res: Response) => {
    try {
        const authUser = (req as any).user;
        const userId = authUser?.sub || authUser?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { currentPassword, newPassword, confirmPassword } = req.body;
        const { ClubSettingsService } = await import("../../services/club/clubSettingsService.js");
        const result = await ClubSettingsService.changePassword(userId, currentPassword, newPassword, confirmPassword);
        return res.status(200).json(result);
    } catch (err: any) {
        return res.status(err.statusCode || 400).json({
            success: false,
            message: err.message || "Failed to update password."
        });
    }
};

authRouter.post('/auth/password/change', authenticate, handlePasswordChange);
authRouter.post('/password/change', authenticate, handlePasswordChange);

export default authRouter;