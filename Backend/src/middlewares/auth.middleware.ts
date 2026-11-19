/// <reference path="../types/express.d.ts" />
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { getUserDetailsCache, userDetailsCache } from "../redis/cache/cache-auth.js";
import { query } from "../database/client.js";
import { isSessionRevoked, throttleTouchSession } from "../services/session/sessionService.js";

const JWT_SECRET = process.env.JWT_SECRET;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ResolvedAuthOutcome =
    | { ok: true; user: any; sessionId?: string }
    | { ok: false; status: number; code?: string; message: string; sessionRevoked?: boolean };

function extractToken(req: Request): string | undefined {
    return (
        req.cookies?.token ||
        (req.headers.authorization?.startsWith("Bearer ")
            ? req.headers.authorization.slice(7)
            : undefined)
    );
}

/**
 * Resolves and validates JWT + session + PostgreSQL/Redis identity with strict
 * separation between 'personal'/'admin' accounts and 'club' accounts.
 */
async function resolveAuthenticatedUser(req: Request): Promise<ResolvedAuthOutcome> {
    if (!JWT_SECRET) {
        console.error("FATAL: JWT_SECRET is not configured");
        return { ok: false, status: 500, message: "Internal server error" };
    }

    const token = extractToken(req);
    if (!token) {
        return { ok: false, status: 401, message: "Authentication required" };
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, JWT_SECRET, {
            issuer: "orbix",
            audience: "orbix-users",
        });
    } catch {
        return { ok: false, status: 401, message: "Invalid or expired token" };
    }

    const userId = decoded?.sub ? String(decoded.sub) : "";
    const userGmail = decoded?.gmail ? String(decoded.gmail) : "";
    const username = decoded?.username ? String(decoded.username) : "";
    const tokenAccountType = decoded?.accountType ? String(decoded.accountType) : undefined;

    if (!userGmail && !userId && !username) {
        return { ok: false, status: 401, message: "Invalid token payload" };
    }

    const sessionId = decoded?.sid || decoded?.sessionId;
    if (sessionId) {
        const revoked = await isSessionRevoked(sessionId);
        if (revoked) {
            return {
                ok: false,
                status: 401,
                message: "Session has been terminated. Please sign in again.",
                sessionRevoked: true,
            };
        }
        throttleTouchSession(sessionId);
    }

    const isUuid = Boolean(userId && UUID_REGEX.test(userId));

    // Prefer lookup by immutable user UUID before falling back to email
    let user = isUuid
        ? await getUserDetailsCache(userId)
        : userGmail
        ? await getUserDetailsCache(userGmail)
        : null;

    if (user) {
        const cachedAccountType = user.accountType || (user as any).account_type || "personal";
        if (isUuid && user.id !== userId) {
            user = null;
        } else if (tokenAccountType && cachedAccountType !== tokenAccountType) {
            user = null;
        }
    }

    if (!user) {
        const result = isUuid
            ? await query(
                  `SELECT
                      id,
                      firstname AS "firstName",
                      middlename AS "middleName",
                      lastname AS "lastName",
                      email AS gmail,
                      username,
                      termsaccepted AS "termsAccepted",
                      account_type AS "accountType"
                  FROM users
                  WHERE id = $1::uuid
                  LIMIT 1;`,
                  [userId]
              )
            : await query(
                  `SELECT
                      id,
                      firstname AS "firstName",
                      middlename AS "middleName",
                      lastname AS "lastName",
                      email AS gmail,
                      username,
                      termsaccepted AS "termsAccepted",
                      account_type AS "accountType"
                  FROM users
                  WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2)
                  LIMIT 1;`,
                  [userGmail || null, username || null]
              );
        user = result.rows[0];

        if (user && user.gmail) {
            user.firstName = user.firstName || (user as any).firstname || "";
            user.middleName = user.middleName || (user as any).middlename || "";
            user.lastName = user.lastName || (user as any).lastname || "";
            user.termsAccepted = user.termsAccepted ?? (user as any).termsaccepted ?? false;
            const resolvedType = user.accountType || (user as any).account_type || "personal";

            userDetailsCache({
                id: user.id,
                firstName: user.firstName,
                middleName: user.middleName,
                lastName: user.lastName,
                gmail: user.gmail,
                username: user.username,
                termsAccepted: user.termsAccepted,
                accountType: resolvedType,
                account_type: resolvedType,
            }).catch(() => {});
        }
    }

    if (!user) {
        return { ok: false, status: 401, message: "User account not found" };
    }

    const dbAccountType = user.accountType || (user as any).account_type || "personal";

    // Strict Account-Type Integrity: never let a personal token assume a club account or vice versa
    if (tokenAccountType === "club" && dbAccountType !== "club") {
        return {
            ok: false,
            status: 403,
            code: "ACCOUNT_TYPE_MISMATCH",
            message: "Club Portal session is invalid for a personal account. Please sign in again.",
        };
    }
    if (dbAccountType === "club" && tokenAccountType !== "club") {
        return {
            ok: false,
            status: 403,
            code: "ACCOUNT_TYPE_MISMATCH",
            message: "Personal authentication cannot assume a Club account identity. Please use Club Login.",
        };
    }

    const normalizedUser = {
        ...user,
        firstName: user.firstName || (user as any).firstname || "",
        middleName: user.middleName || (user as any).middlename || "",
        lastName: user.lastName || (user as any).lastname || "",
        termsAccepted: user.termsAccepted ?? (user as any).termsaccepted ?? false,
        accountType: dbAccountType,
        account_type: dbAccountType,
    };

    return { ok: true, user: normalizedUser, sessionId };
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const outcome = await resolveAuthenticatedUser(req);
        if (!outcome.ok) {
            return res.status(outcome.status).json({
                status: outcome.status === 500 ? "error" : "failed",
                ...(outcome.code ? { code: outcome.code } : {}),
                ...(outcome.sessionRevoked ? { sessionRevoked: true } : {}),
                message: outcome.message,
            });
        }

        if (outcome.sessionId) {
            (req as any).sessionId = outcome.sessionId;
        }
        req.user = outcome.user;
        return next();
    } catch (err) {
        console.error("Authentication middleware error:", err);
        return res.status(500).json({
            status: "error",
            message: "Internal server error during authentication",
        });
    }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction) => {
    try {
        const outcome = await resolveAuthenticatedUser(req);
        if (outcome.ok) {
            if (outcome.sessionId) {
                (req as any).sessionId = outcome.sessionId;
            }
            req.user = outcome.user;
        }
        return next();
    } catch {
        return next();
    }
};

/**
 * Enforces that the caller authenticated through the Club Portal (account_type = 'club').
 * Prevents personal accounts (including Gmail OAuth sessions) from accessing Club Portal endpoints.
 */
export const requireClubAccount = (req: Request, res: Response, next: NextFunction) => {
    const authUser = req.user as any;
    if (!authUser || !authUser.id) {
        return res.status(401).json({
            success: false,
            code: "CLUB_AUTH_REQUIRED",
            message: "Club Portal authentication required.",
        });
    }

    const acctType = authUser.accountType || authUser.account_type || "personal";
    if (acctType !== "club") {
        return res.status(403).json({
            success: false,
            code: "CLUB_PORTAL_AUTH_REQUIRED",
            message: "Club Portal login required. Personal accounts cannot access Club management endpoints.",
        });
    }

    return next();
};

/**
 * Enforces that the caller is NOT a club account (personal / standard user endpoints).
 */
export const requirePersonalAccount = (req: Request, res: Response, next: NextFunction) => {
    const authUser = req.user as any;
    if (!authUser || !authUser.id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required.",
        });
    }

    const acctType = authUser.accountType || authUser.account_type || "personal";
    if (acctType === "club") {
        return res.status(403).json({
            success: false,
            code: "PERSONAL_ACCOUNT_REQUIRED",
            message: "This endpoint is only available to personal accounts.",
        });
    }

    return next();
};
