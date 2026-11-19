// Backend/src/controllers/blog/blogLikeController.ts
import type { Request, Response } from "express";
import {
    getPublicationLikeInfo,
    getBatchPublicationLikes,
    likePublication,
    unlikePublication,
    type PublicationKey,
} from "../../services/blog/blogLikeService.js";

/**
 * Normalizes an Express route parameter that may be string or string[].
 */
function cleanParam(param: string | string[] | undefined): string {
    if (!param) return "";
    const raw = Array.isArray(param) ? (param[0] ?? "") : param;
    return String(raw).trim();
}

/**
 * Validates publication slug identifiers.
 * Permits alphanumeric characters, hyphens, and underscores between 1 and 120 characters.
 */
function isValidIdentifier(val: string): boolean {
    if (!val || typeof val !== "string") return false;
    const clean = val.trim();
    return clean.length >= 1 && clean.length <= 120 && /^[a-zA-Z0-9_-]+$/.test(clean);
}

/**
 * GET /api/blogs/:hoster/:blogName/likes
 * Retrieves like count and viewer liked state for a single publication.
 * Handled via optionalAuthenticate (guests receive likedByViewer: false).
 */
export async function getPublicationLikesHandler(req: Request, res: Response): Promise<void> {
    try {
        const hoster = cleanParam(req.params.hoster);
        const blogName = cleanParam(req.params.blogName);

        if (!hoster || !blogName || !isValidIdentifier(hoster) || !isValidIdentifier(blogName)) {
            res.status(400).json({
                status: "failed",
                message: "Invalid hoster or blogName parameter",
            });
            return;
        }

        const viewerId = req.user?.id || null;
        const result = await getPublicationLikeInfo(hoster, blogName, viewerId);

        res.status(200).json({
            status: "success",
            data: {
                ...result,
                liked: result.likedByViewer,
            },
        });
    } catch (err: any) {
        console.error("[blogLikeController] getPublicationLikesHandler error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error retrieving publication likes",
        });
    }
}

/**
 * POST /api/blogs/likes/batch
 * Retrieves like information for multiple publications in one database query (avoids N+1).
 * Accepts up to 50 publications per request.
 */
export async function getBatchPublicationLikesHandler(req: Request, res: Response): Promise<void> {
    try {
        const { publications } = req.body;

        if (!publications) {
            res.status(200).json({
                status: "success",
                data: { publications: [] },
            });
            return;
        }

        if (!Array.isArray(publications)) {
            res.status(400).json({
                status: "failed",
                message: "Invalid request payload: 'publications' must be an array",
            });
            return;
        }

        if (publications.length > 50) {
            res.status(400).json({
                status: "failed",
                message: "Batch size exceeds limit: maximum 50 publications per request",
            });
            return;
        }

        // Filter and sanitize valid items
        const sanitized: PublicationKey[] = [];
        for (const item of publications) {
            const h = cleanParam(item?.hoster);
            const b = cleanParam(item?.blogName);
            if (h && b && isValidIdentifier(h) && isValidIdentifier(b)) {
                sanitized.push({
                    hoster: h,
                    blogName: b,
                });
            }
        }

        const viewerId = req.user?.id || null;
        const result = await getBatchPublicationLikes(sanitized, viewerId);

        res.status(200).json({
            status: "success",
            data: {
                publications: result.map((p) => ({
                    ...p,
                    liked: p.likedByViewer,
                })),
            },
        });
    } catch (err: any) {
        console.error("[blogLikeController] getBatchPublicationLikesHandler error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error retrieving batch publication likes",
        });
    }
}

/**
 * POST /api/blogs/:hoster/:blogName/likes
 * Idempotently adds a like to the publication for the authenticated user.
 * Protected via authenticate middleware (rejects guests with 401).
 */
export async function likePublicationHandler(req: Request, res: Response): Promise<void> {
    try {
        const hoster = cleanParam(req.params.hoster);
        const blogName = cleanParam(req.params.blogName);
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                status: "failed",
                message: "Authentication required",
            });
            return;
        }

        if (!hoster || !blogName || !isValidIdentifier(hoster) || !isValidIdentifier(blogName)) {
            res.status(400).json({
                status: "failed",
                message: "Invalid hoster or blogName parameter",
            });
            return;
        }

        const result = await likePublication(hoster, blogName, userId);

        res.status(200).json({
            status: "success",
            data: {
                ...result,
                liked: result.likedByViewer,
            },
        });
    } catch (err: any) {
        console.error("[blogLikeController] likePublicationHandler error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error recording publication like",
        });
    }
}

/**
 * DELETE /api/blogs/:hoster/:blogName/likes
 * Idempotently removes a like from the publication for the authenticated user.
 * Protected via authenticate middleware (rejects guests with 401).
 */
export async function unlikePublicationHandler(req: Request, res: Response): Promise<void> {
    try {
        const hoster = cleanParam(req.params.hoster);
        const blogName = cleanParam(req.params.blogName);
        const userId = req.user?.id;

        if (!userId) {
            res.status(401).json({
                status: "failed",
                message: "Authentication required",
            });
            return;
        }

        if (!hoster || !blogName || !isValidIdentifier(hoster) || !isValidIdentifier(blogName)) {
            res.status(400).json({
                status: "failed",
                message: "Invalid hoster or blogName parameter",
            });
            return;
        }

        const result = await unlikePublication(hoster, blogName, userId);

        res.status(200).json({
            status: "success",
            data: {
                ...result,
                liked: result.likedByViewer,
            },
        });
    } catch (err: any) {
        console.error("[blogLikeController] unlikePublicationHandler error:", err);
        res.status(500).json({
            status: "error",
            message: "Internal server error removing publication like",
        });
    }
}
