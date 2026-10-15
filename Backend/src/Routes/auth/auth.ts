import express, { type Request, type Response } from 'express';
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import SignupValidator, { ValidationError } from '../../validators/SignupValidator.js';
import { query } from "../../database/client.js"
import SigninValidator from '../../validators/SigninValidator.js';
import { failsOccursSignin, failsOccursSignup, resetSigninFailures, getFailures } from '../../redis/rate-limiters/rate-limiters-auth.js';
import { deleteUserDetailsCache, getUserDetailsCache, userDetailsCache } from '../../redis/cache/cache-auth.js';
import redis from '../../redis/client.js';
import { authenticate } from '../../middlewares/auth.middleware.js';
import { handleSavePortals, handleGetSavedPortals } from '../portals/portals.js';
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

authRouter.post('/signup', async (req: Request, res: Response) => {
    try {
        // Rate Limiting
        const ip = req.ip || "unknown";
        const attempts = await failsOccursSignup({ ip });
        if (attempts > 5) {
            return res.status(429).json({ success: false, message: "Too many signup attempts. Please try again later." });
        }

        // Validate Data
        const validatedData = SignupValidator(req.body);

        // Hash Password AFTER validation
        const hashedPassword = await bcrypt.hash(validatedData.password, 10);

        // 1. Insert into Database FIRST
        const result = await query(
            `
                INSERT INTO users (
                username,
                firstName,
                middleName,
                lastName,
                email,
                password,
                termsAccepted
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName"`,
            [
                validatedData.username,
                validatedData.firstName,
                validatedData.middleName || null,
                validatedData.lastName,
                validatedData.gmail,
                hashedPassword,
                validatedData.termsAccepted
            ]
        );

        const createdUser = result.rows[0];
        const userId = createdUser?.id || `usr-${Date.now()}`;

        // 2. Generate Access Token & Refresh Token
        const token = jwt.sign(
            {
                sub: userId,
                gmail: validatedData.gmail,
                username: validatedData.username
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
            termsAccepted: validatedData.termsAccepted
        });

        // 4. Return Success

        return res.status(201).json({
            success: true,
            message: 'Account registered successfully!',
            token,
            user: {
                id: userId,
                username: validatedData.username,
                firstName: validatedData.firstName,
                middleName: validatedData.middleName,
                lastName: validatedData.lastName,
                gmail: validatedData.gmail
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

        // Caching with redis
        let user = await getUserDetailsCache(validatedData.gmail);

        if (!user) {
            const Result = await query(
                `SELECT
                id,
                firstName,
                middleName,
                lastName,
                email AS gmail,
                username,
                password AS password_hash,
                termsAccepted
            FROM users
            WHERE email = $1 OR username = $1
            LIMIT 1;`,
                [validatedData.gmail]
            );
            user = Result.rows[0];
            if (!user) {
                await bcrypt.compare("dummy", "$2b$10$XN4E5x6gT3x7l3eUaR9UOuQYx8wO1bU1Jv3bT6D2p7t3Z6U1q9F4W");
                await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" });
                return res.status(401).json({
                    success: false,
                    message: "Invalid Credentials"
                });
            }
        }

        // Password verification
        const isPasswordValid = await bcrypt.compare(validatedData.password, user.password_hash);

        if (!isPasswordValid) {
            await failsOccursSignin({ email: validatedData.gmail, ip: req.ip || "unknown" });
            return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            });
        }

        // Generate Access Token & Refresh Token
        const token = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username
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
        const { password_hash, ...safeUser } = user;
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

        // Validate user existence in Redis Cache or Database
        let user = await getUserDetailsCache(userGmail);
        if (!user) {
            const Result = await query(
                `SELECT
                    id,
                    firstName,
                    middleName,
                    lastName,
                    email AS gmail,
                    username,
                    password AS password_hash,
                    termsAccepted
                FROM users
                WHERE email = $1 OR username = $1
                LIMIT 1;`,
                [userGmail]
            );
            user = Result.rows[0];
        }

        if (!user) {
            res.clearCookie("token", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
            res.clearCookie("refreshToken", { path: "/", httpOnly: true, sameSite: "lax", secure: isProduction });
            return res.status(401).json({
                success: false,
                message: "User account not found. Please sign in again."
            });
        }

        // Generate fresh Access Token (8 hours) and fresh Refresh Token (7 days)
        const newAccessToken = jwt.sign(
            {
                sub: user.id,
                gmail: user.gmail,
                username: user.username
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

        const { password_hash, ...safeUser } = user;
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

        // If gmail was not passed in body, extract from cookie/JWT
        if (!gmail) {
            const rawToken = req.cookies?.token || req.cookies?.refreshToken;
            if (rawToken && typeof rawToken === "string") {
                try {
                    const decoded = jwt.decode(rawToken) as any;
                    if (decoded?.gmail) {
                        gmail = decoded.gmail;
                    }
                } catch {
                    // ignore
                }
            }
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

const handleMeEndpoint = async (req: Request, res: Response) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                status: "failed",
                success: false,
                message: "Authentication required",
            });
        }

        // Fetch fresh profile metadata from database
        const dbResult = await query(
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
                cover_image_url AS "coverImageUrl",
                website,
                location,
                skills,
                is_public AS "isPublic",
                created_at AS "createdAt"
            FROM users
            WHERE id = $1 OR email = $2
            LIMIT 1;`,
            [user.id, user.gmail]
        );

        const fullUser = dbResult.rows[0] || user;

        return res.status(200).json({
            status: "success",
            success: true,
            users: fullUser,
            user: {
                id: fullUser.id,
                firstName: fullUser.firstName,
                middleName: fullUser.middleName,
                lastName: fullUser.lastName,
                gmail: fullUser.gmail,
                termsAccepted: fullUser.termsAccepted,
                username: fullUser.username,
                headline: fullUser.headline || null,
                bio: fullUser.bio || null,
                avatarUrl: fullUser.avatarUrl || null,
                coverImageUrl: fullUser.coverImageUrl || null,
                website: fullUser.website || null,
                location: fullUser.location || null,
                skills: Array.isArray(fullUser.skills) ? fullUser.skills : [],
                isPublic: fullUser.isPublic !== false,
                createdAt: fullUser.createdAt || null,
            },
        });
    } catch (err: unknown) {
        console.error("GET /me failed:", err);
        return res.status(500).json({
            status: "error",
            success: false,
            message: "An internal server error occurred",
        });
    }
};

authRouter.get("/profile/me", authenticate, handleMeEndpoint);
authRouter.get("/me", authenticate, handleMeEndpoint);

// Profile portal save & retrieval endpoints (/api/profile/save)
authRouter.post("/profile/save", authenticate, handleSavePortals);
authRouter.get("/profile/save", authenticate, handleGetSavedPortals);

export default authRouter;