// Backend/src/middlewares/staff.middleware.ts
import type { Request, Response, NextFunction } from "express";
import { query } from "../database/client.js";

/**
 * Server-side staff/admin allowlist.
 */
export const getStaffAllowlist = (): string[] => {
    const raw =
        process.env.ORBIX_STAFF_EMAILS ||
        process.env.ORBIX_REVIEWER_EMAILS ||
        "admin@orbix.dev,staff@orbix.dev,reviewer@orbix.dev,support@orbix.dev";
    return raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
};

export type StaffRole =
    | "super_admin"
    | "platform_admin"
    | "moderation_admin"
    | "operations_admin"
    | "support_admin"
    | "support_agent"
    | "reviewer"
    | "user";

/**
 * Resolve staff role for authenticated user
 */
export async function resolveUserStaffRole(userId: string, email?: string): Promise<StaffRole> {
    const cleanEmail = (email || "").toLowerCase();
    const allowlist = getStaffAllowlist();
    if (allowlist.includes(cleanEmail)) {
        return "super_admin";
    }

    try {
        const res = await query(
            `SELECT staff_role, account_type FROM users WHERE id = $1 LIMIT 1;`,
            [userId]
        );
        const row = res.rows[0];
        if (!row) return "user";

        if (row.account_type === "admin") {
            return "super_admin";
        }

        if (row.staff_role && row.staff_role !== "user") {
            return row.staff_role as StaffRole;
        }

        return "user";
    } catch {
        return "user";
    }
}

/**
 * Middleware: Require any authorized Orbix staff or administrator.
 */
export const requireStaff = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required to access staff operations.",
        });
    }

    const email = (req.user.gmail || req.user.email || "").toLowerCase();
    const role = await resolveUserStaffRole(req.user.id, email);

    if (role === "user") {
        return res.status(403).json({
            success: false,
            message: "Access forbidden: authorized Orbix staff/administrators only.",
        });
    }

    (req as any).staffRole = role;
    return next();
};

/**
 * Middleware: Require support staff role (Support Agent, Support Admin, or higher).
 */
export const requireSupportStaff = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required.",
        });
    }

    const email = (req.user.gmail || req.user.email || "").toLowerCase();
    const role = await resolveUserStaffRole(req.user.id, email);

    const allowedRoles: StaffRole[] = [
        "super_admin",
        "platform_admin",
        "operations_admin",
        "support_admin",
        "support_agent",
        "reviewer",
    ];

    if (!allowedRoles.includes(role)) {
        return res.status(403).json({
            success: false,
            message: "Access forbidden: authorized support staff only.",
        });
    }

    (req as any).staffRole = role;
    return next();
};

/**
 * Middleware: Require Account Governance / Moderation Admin privilege.
 */
export const requireGovernanceAdmin = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required.",
        });
    }

    const email = (req.user.gmail || req.user.email || "").toLowerCase();
    const role = await resolveUserStaffRole(req.user.id, email);

    const allowedRoles: StaffRole[] = [
        "super_admin",
        "platform_admin",
        "moderation_admin",
        "operations_admin",
    ];

    if (!allowedRoles.includes(role)) {
        return res.status(403).json({
            success: false,
            message: "Access forbidden: account governance administrator privileges required.",
        });
    }

    (req as any).staffRole = role;
    return next();
};
