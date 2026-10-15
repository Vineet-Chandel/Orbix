import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUserDetailsCache } from "../redis/cache/cache-auth.js";
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

        const userGmail = decoded?.gmail;
        if (!userGmail) {
            return res.status(401).json({
                status: "failed",
                message: "Invalid token payload",
            });
        }

        // Check Redis cache first, fallback to Postgres
        let user = await getUserDetailsCache(userGmail);
        if (!user) {
            const result = await query(
                `SELECT
                    id,
                    firstName,
                    middleName,
                    lastName,
                    email AS gmail,
                    username,
                    termsAccepted
                FROM users
                WHERE email = $1
                LIMIT 1;`,
                [userGmail]
            );
            user = result.rows[0];
        }

        if (!user) {
            return res.status(401).json({
                status: "failed",
                message: "User account not found",
            });
        }

        req.user = user;
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

        const userGmail = decoded?.gmail;
        if (!userGmail) {
            return next();
        }

        let user = await getUserDetailsCache(userGmail);
        if (!user) {
            const result = await query(
                `SELECT
                    id,
                    firstName,
                    middleName,
                    lastName,
                    email AS gmail,
                    username,
                    termsAccepted
                FROM users
                WHERE email = $1
                LIMIT 1;`,
                [userGmail]
            );
            user = result.rows[0];
        }

        if (user) {
            req.user = user;
        }

        return next();
    } catch {
        return next();
    }
};
