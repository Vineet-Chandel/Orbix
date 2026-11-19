import type { Request, Response, NextFunction } from "express";

/**
 * Validates whether a given string is a valid standard UUID format.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns allowlisted founder user IDs from the server-side environment variable.
 * Strictly zero-trust: returns an empty list if unconfigured or malformed.
 * Does NOT contain any hardcoded fallback identities.
 */
export function getFounderUserIds(): string[] {
    const raw = process.env.ORBIX_FOUNDER_USER_IDS;
    if (!raw || typeof raw !== "string" || raw.trim().length === 0) {
        return [];
    }

    const tokens = raw.split(",");
    const validIds: string[] = [];

    for (const token of tokens) {
        const clean = token.trim().toLowerCase();
        if (!clean) continue;

        if (UUID_REGEX.test(clean)) {
            validIds.push(clean);
        } else {
            console.warn(
                "[FounderAuth] Malformed entry ignored in ORBIX_FOUNDER_USER_IDS (expected valid UUID format)."
            );
        }
    }

    return validIds;
}

/**
 * Authoritatively checks whether an authenticated user ID is an authorized Orbix founder.
 * Enforces strict UUID checking against server-side ORBIX_FOUNDER_USER_IDS.
 * No email-based bypass is permitted to protect against mutable email spoofing.
 */
export async function isAuthorizedFounder(userId: string): Promise<boolean> {
    if (!userId || typeof userId !== "string") return false;

    const cleanId = userId.trim().toLowerCase();
    if (!UUID_REGEX.test(cleanId)) return false;

    const founderIds = getFounderUserIds();
    if (founderIds.length === 0) {
        return false;
    }

    return founderIds.includes(cleanId);
}

/**
 * Express Middleware: Strictly enforces Orbix founder access server-side.
 * Returns 401 Unauthorized for unauthenticated requests.
 * Returns 403 Forbidden for non-founder accounts or when founder allowlist is unconfigured.
 */
export const requireFounder = async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            message: "Authentication required to access internal founder operations.",
        });
    }

    const isFounder = await isAuthorizedFounder(req.user.id);

    if (!isFounder) {
        return res.status(403).json({
            success: false,
            message: "Access restricted: Authorized Orbix founders only.",
        });
    }

    (req as any).isFounder = true;
    return next();
};
