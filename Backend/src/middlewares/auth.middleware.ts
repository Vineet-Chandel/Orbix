import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUserDetailsCache, userDetailsCache } from "../redis/cache/cache-auth.js";
import { query } from "../database/client.js";

const JWT_SECRET = process.env.JWT_SECRET;

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!JWT_SECRET) {
            console.error("FATAL: JWT_SECRET is not configured");
            return res.status(500).json({ status: "error", message: "Internal server error" });
        }

        const token =
            req.cookies?.token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : undefined);

        if (!token) {
            return res.status(401).json({
                status: "failed",
                message: "Authentication required",
            });
        }

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET, {
                issuer: "orbix",
                audience: "orbix-users",
            });
        } catch {
            return res.status(401).json({
                status: "failed",
                message: "Invalid or expired token",
            });
        }

        const userId = decoded?.sub;
        const userGmail = decoded?.gmail;
        const username = decoded?.username;
        if (!userGmail && !userId && !username) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid token payload",
            });
        }

        // Check Redis cache first, fallback to Postgres
        let user = userGmail ? await getUserDetailsCache(userGmail) : null;
        if (!user) {
            const result = await query(
                `SELECT
                    id,
                    firstname AS "firstName",
                    middlename AS "middleName",
                    lastname AS "lastName",
                    email AS gmail,
                    username,
                    termsaccepted AS "termsAccepted"
                FROM users
                WHERE id = $1 OR LOWER(email) = LOWER($2) OR LOWER(username) = LOWER($3)
                LIMIT 1;`,
                [userId || null, userGmail || null, username || null]
            );
            user = result.rows[0];

            if (user && user.gmail) {
                // Ensure camelCase fields are set cleanly
                user.firstName = user.firstName || (user as any).firstname || "";
                user.middleName = user.middleName || (user as any).middlename || "";
                user.lastName = user.lastName || (user as any).lastname || "";
                user.termsAccepted = user.termsAccepted ?? (user as any).termsaccepted ?? false;

                // Prime Redis cache for instant future lookups (without touching password_hash)
                userDetailsCache({
                    id: user.id,
                    firstName: user.firstName,
                    middleName: user.middleName,
                    lastName: user.lastName,
                    gmail: user.gmail,
                    username: user.username,
                    termsAccepted: user.termsAccepted
                }).catch(() => {});
            }
        }

        if (!user) {
            return res.status(401).json({
                status: "failed",
                message: "User account not found",
            });
        }

        // Normalize camelCase on req.user
        req.user = {
            ...user,
            firstName: user.firstName || (user as any).firstname || "",
            middleName: user.middleName || (user as any).middlename || "",
            lastName: user.lastName || (user as any).lastname || "",
            termsAccepted: user.termsAccepted ?? (user as any).termsaccepted ?? false,
        };
        return next();
    } catch (err) {
        console.error("Authentication middleware error:", err);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during authentication",
        });
    }
};

export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        if (!JWT_SECRET) {
            return next();
        }

        const token =
            req.cookies?.token ||
            (req.headers.authorization?.startsWith("Bearer ")
                ? req.headers.authorization.slice(7)
                : undefined);

        if (!token) {
            return next();
        }

        let decoded: any;
        try {
            decoded = jwt.verify(token, JWT_SECRET, {
                issuer: "orbix",
                audience: "orbix-users",
            });
        } catch {
            return next();
        }

        const userId = decoded?.sub;
        const userGmail = decoded?.gmail;
        const username = decoded?.username;
        if (!userGmail && !userId && !username) {
            return next();
        }

        let user = userGmail ? await getUserDetailsCache(userGmail) : null;
        if (!user) {
            const result = await query(
                `SELECT
                    id,
                    firstname AS "firstName",
                    middlename AS "middleName",
                    lastname AS "lastName",
                    email AS gmail,
                    username,
                    termsaccepted AS "termsAccepted"
                FROM users
                WHERE id = $1 OR LOWER(email) = LOWER($2) OR LOWER(username) = LOWER($3)
                LIMIT 1;`,
                [userId || null, userGmail || null, username || null]
            );
            user = result.rows[0];

            if (user && user.gmail) {
                user.firstName = user.firstName || (user as any).firstname || "";
                user.middleName = user.middleName || (user as any).middlename || "";
                user.lastName = user.lastName || (user as any).lastname || "";
                user.termsAccepted = user.termsAccepted ?? (user as any).termsaccepted ?? false;

                userDetailsCache({
                    id: user.id,
                    firstName: user.firstName,
                    middleName: user.middleName,
                    lastName: user.lastName,
                    gmail: user.gmail,
                    username: user.username,
                    termsAccepted: user.termsAccepted
                }).catch(() => {});
            }
        }

        if (user) {
            req.user = {
                ...user,
                firstName: user.firstName || (user as any).firstname || "",
                middleName: user.middleName || (user as any).middlename || "",
                lastName: user.lastName || (user as any).lastname || "",
                termsAccepted: user.termsAccepted ?? (user as any).termsaccepted ?? false,
            };
        }

        return next();
    } catch {
        return next();
    }
};
