import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import { query, pool } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import {
    assertCloudinaryConfigured,
    isCloudinaryConfigured,
    getOptimizedAvatarUrl,
    destroyCloudinaryAsset,
    getCloudinaryAsset,
    ALLOWED_PHOTO_FORMATS,
    cloudinary,
} from "../../config/cloudinary.js";
import {
    invalidatePublicProfileCache,
    invalidatePrivateProfileCache,
    invalidateAllUserCaches,
} from "../../redis/cache/cache-profile.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";

const photoRouter = express.Router();

// Simple in-memory rate limiter for upload signatures (15 requests per 10 minutes per user)
const signatureRateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_SIGNATURES_PER_WINDOW = 15;

function checkRateLimit(key: string): boolean {
    const now = Date.now();
    const record = signatureRateLimits.get(key);
    if (!record || now > record.resetAt) {
        signatureRateLimits.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }
    if (record.count >= MAX_SIGNATURES_PER_WINDOW) {
        return false;
    }
    record.count++;
    return true;
}

/**
 * Background retryable worker to clean up superseded Cloudinary assets
 */
export async function processPhotoCleanupQueue(): Promise<void> {
    try {
        const pendingJobs = await query(
            `SELECT id, public_id AS "publicId", attempts
             FROM photo_cleanup_queue
             WHERE status = 'pending' AND attempts < 5
             LIMIT 10;`
        );

        for (const job of pendingJobs.rows) {
            try {
                const deleted = await destroyCloudinaryAsset(job.publicId);
                if (deleted) {
                    await query(
                        `UPDATE photo_cleanup_queue
                         SET status = 'completed', updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1;`,
                        [job.id]
                    );
                } else {
                    await query(
                        `UPDATE photo_cleanup_queue
                         SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
                         WHERE id = $1;`,
                        [job.id]
                    );
                }
            } catch (err: any) {
                await query(
                    `UPDATE photo_cleanup_queue
                     SET attempts = attempts + 1, last_error = $1, updated_at = CURRENT_TIMESTAMP
                     WHERE id = $2;`,
                    [err?.message || "Unknown error", job.id]
                );
            }
        }
    } catch {
        // Non-fatal background cleanup
    }
}

/**
 * STEP A: Request Upload Signature
 * POST /api/profile/photo/upload-signature
 */
export const handleUploadSignature = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        if (!isCloudinaryConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Photo upload service is not configured. Please contact the administrator.",
            });
        }

        const rateLimitKey = authUser.id || authUser.gmail || authUser.username;
        if (!checkRateLimit(rateLimitKey)) {
            return res.status(429).json({
                success: false,
                message: "Too many upload attempts. Please wait a few minutes before trying again.",
            });
        }

        const { cloudName, apiKey, apiSecret, folder, maxBytes } = assertCloudinaryConfigured();

        if (apiSecret.length < 20) {
            return res.status(500).json({
                success: false,
                message: `CLOUDINARY_API_SECRET in Backend/.env is invalid (length is ${apiSecret.length} chars). Cloudinary API secrets are 27 characters long. Please paste the full API Secret from Cloudinary Console.`,
            });
        }

        // Server generates safe, unique Cloudinary public ID with folder prefix
        const timestamp = Math.round(Date.now() / 1000);
        const randomHex = crypto.randomBytes(6).toString("hex");
        const safeUserId = (authUser.id || authUser.username || "user").replace(/[^a-zA-Z0-9_-]/g, "");
        const publicId = `${folder}/u_${safeUserId}_${timestamp}_${randomHex}`;

        // Parameters covered by the signature (omit separate folder param to prevent Cloudinary from duplicating the folder prefix)
        const paramsToSign: Record<string, any> = {
            public_id: publicId,
            timestamp,
        };

        // Sign using official Cloudinary algorithm
        const signature = cloudinary.utils.api_sign_request(paramsToSign, apiSecret);

        // Store verifiable upload-intent record in PostgreSQL
        await query(
            `INSERT INTO photo_upload_intents (
                user_id,
                username,
                user_email,
                public_id,
                signature,
                timestamp,
                folder,
                status,
                expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', CURRENT_TIMESTAMP + INTERVAL '15 minutes')
            ON CONFLICT (public_id) DO NOTHING;`,
            [
                authUser.id || null,
                authUser.username,
                authUser.gmail,
                publicId,
                signature,
                timestamp,
                folder,
            ]
        );

        return res.status(200).json({
            success: true,
            uploadConfig: {
                cloudName,
                apiKey,
                timestamp,
                signature,
                publicId,
                folder,
                uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
                maxBytes,
                allowedFormats: ALLOWED_PHOTO_FORMATS,
            },
        });
    } catch (err: any) {
        console.error("handleUploadSignature error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to generate upload signature",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

/**
 * STEP C: Confirm and Persist Uploaded Asset
 * POST /api/profile/photo/confirm
 */
export const handleConfirmPhoto = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const { publicId, version } = req.body || {};
        if (!publicId || typeof publicId !== "string" || !publicId.trim()) {
            return res.status(400).json({
                success: false,
                message: "Valid Cloudinary public ID is required.",
            });
        }

        const cleanPublicId = publicId.trim();
        const { folder, maxBytes } = assertCloudinaryConfigured();

        // Normalize duplicated folder prefixes if present (e.g. "orbix/avatars/orbix/avatars/u_..." -> "orbix/avatars/u_...")
        const strippedPublicId = cleanPublicId.replace(new RegExp(`^(${folder}/)+`), "");
        const canonicalPublicId = `${folder}/${strippedPublicId}`;

        // 1. Verify that upload intent exists, belongs to this user, and is unconsumed/unexpired
        const intentResult = await query(
            `SELECT id, status, expires_at, public_id
             FROM photo_upload_intents
             WHERE (public_id = $1 OR public_id = $2 OR public_id = $3)
               AND (username = $4 OR user_email = $5 OR user_id = $6)
             LIMIT 1;`,
            [cleanPublicId, canonicalPublicId, strippedPublicId, authUser.username, authUser.gmail, authUser.id || null]
        );

        if (intentResult.rowCount === 0) {
            return res.status(403).json({
                success: false,
                message: "Upload intent not found or unauthorized for this user.",
            });
        }

        const intent = intentResult.rows[0];
        if (intent.status === "consumed") {
            return res.status(409).json({
                success: false,
                message: "This upload has already been confirmed.",
            });
        }

        if (intent.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: `Upload intent is in '${intent.status}' state and cannot be confirmed.`,
            });
        }

        if (new Date(intent.expires_at) < new Date()) {
            await query(
                `UPDATE photo_upload_intents SET status = 'expired', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
                [intent.id]
            );
            return res.status(410).json({
                success: false,
                message: "Upload session expired. Please choose your photo again.",
            });
        }

        // 2. Server-side verification with Cloudinary Resource API
        let resource: any;
        try {
            resource = await getCloudinaryAsset(cleanPublicId);
        } catch {
            if (canonicalPublicId !== cleanPublicId) {
                try {
                    resource = await getCloudinaryAsset(canonicalPublicId);
                } catch (fetchErr: any) {
                    console.error("Cloudinary resource fetch failed:", fetchErr?.message || fetchErr);
                    return res.status(400).json({
                        success: false,
                        message: "Uploaded asset could not be verified on Cloudinary. Please try uploading again.",
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: "Uploaded asset could not be verified on Cloudinary. Please try uploading again.",
                });
            }
        }

        const verifiedAssetPublicId = resource.public_id || cleanPublicId;

        if (!resource || resource.resource_type !== "image") {
            await destroyCloudinaryAsset(verifiedAssetPublicId);
            return res.status(400).json({
                success: false,
                message: "Uploaded resource is not a valid image.",
            });
        }

        if (typeof resource.bytes === "number" && resource.bytes > maxBytes) {
            await destroyCloudinaryAsset(verifiedAssetPublicId);
            return res.status(400).json({
                success: false,
                message: `File size exceeds the allowed limit of ${(maxBytes / (1024 * 1024)).toFixed(1)} MB.`,
            });
        }

        const format = (resource.format || "").toLowerCase();
        if (!ALLOWED_PHOTO_FORMATS.includes(format as any)) {
            await destroyCloudinaryAsset(verifiedAssetPublicId);
            return res.status(400).json({
                success: false,
                message: `Unsupported file format '${format}'. Allowed formats: ${ALLOWED_PHOTO_FORMATS.join(", ")}.`,
            });
        }

        // 3. Generate canonical transformed delivery URL
        const canonicalPhotoUrl = getOptimizedAvatarUrl(verifiedAssetPublicId, version || resource.version);

        // 4. Atomic database update
        const client = await pool.connect();

        let oldSupersededPublicId: string | null = null;
        let newPreviousPhotoUrl: string | null = null;
        let newPreviousPhotoPublicId: string | null = null;

        try {
            await client.query("BEGIN");

            // Lock user row and retrieve current photo fields
            const currentUserRes = await client.query(
                `SELECT photo_url AS "photoUrl",
                        photo_public_id AS "photoPublicId",
                        previous_photo_url AS "previousPhotoUrl",
                        previous_photo_public_id AS "previousPhotoPublicId"
                 FROM users
                 WHERE id = $1 OR email = $2
                 FOR UPDATE;`,
                [authUser.id || null, authUser.gmail]
            );

            const currentUser = currentUserRes.rows[0];

            // If user currently has an active custom photo, it becomes the previous photo
            if (currentUser?.photoPublicId && currentUser.photoPublicId !== verifiedAssetPublicId) {
                newPreviousPhotoUrl = currentUser.photoUrl;
                newPreviousPhotoPublicId = currentUser.photoPublicId;

                // Any older previous photo that is now superseded can be queued for cleanup
                if (
                    currentUser.previousPhotoPublicId &&
                    currentUser.previousPhotoPublicId !== currentUser.photoPublicId &&
                    currentUser.previousPhotoPublicId !== verifiedAssetPublicId
                ) {
                    oldSupersededPublicId = currentUser.previousPhotoPublicId;
                }
            } else if (currentUser?.previousPhotoPublicId) {
                // Retain existing previous photo if replacing while default was active
                newPreviousPhotoUrl = currentUser.previousPhotoUrl;
                newPreviousPhotoPublicId = currentUser.previousPhotoPublicId;
            }

            // Update user record with new active photo
            await client.query(
                `UPDATE users
                 SET photo_url = $1,
                     photo_public_id = $2,
                     previous_photo_url = $3,
                     previous_photo_public_id = $4,
                     avatar_url = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 OR email = $6;`,
                [
                    canonicalPhotoUrl,
                    verifiedAssetPublicId,
                    newPreviousPhotoUrl,
                    newPreviousPhotoPublicId,
                    authUser.id || null,
                    authUser.gmail,
                ]
            );

            // Mark upload intent as consumed
            await client.query(
                `UPDATE photo_upload_intents
                 SET status = 'consumed', updated_at = CURRENT_TIMESTAMP
                 WHERE id = $1;`,
                [intent.id]
            );

            // If an older photo is superseded, enqueue safe cleanup
            if (oldSupersededPublicId) {
                await client.query(
                    `INSERT INTO photo_cleanup_queue (public_id, reason, status)
                     VALUES ($1, 'superseded', 'pending');`,
                    [oldSupersededPublicId]
                );
            }

            await client.query("COMMIT");
        } catch (dbErr) {
            await client.query("ROLLBACK");
            throw dbErr;
        } finally {
            client.release();
        }

        // 5. Invalidate relevant caches
        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.username),
            deleteUserDetailsCache(authUser.gmail),
        ]);

        // 6. Trigger non-blocking cleanup of superseded assets
        if (oldSupersededPublicId) {
            processPhotoCleanupQueue().catch(() => {});
        }

        return res.status(200).json({
            success: true,
            message: "Profile photo updated successfully",
            photoUrl: canonicalPhotoUrl,
            hasPreviousPhoto: Boolean(newPreviousPhotoUrl),
            previousPhotoUrl: newPreviousPhotoUrl,
        });
    } catch (err: any) {
        console.error("handleConfirmPhoto error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to confirm profile photo update",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

/**
 * Action: Restore Previous Photo
 * POST /api/profile/photo/restore
 */
export const handleRestorePhoto = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const client = await pool.connect();

        let restoredUrl: string | null = null;
        let newPreviousUrl: string | null = null;

        try {
            await client.query("BEGIN");

            const currentUserRes = await client.query(
                `SELECT photo_url AS "photoUrl",
                        photo_public_id AS "photoPublicId",
                        previous_photo_url AS "previousPhotoUrl",
                        previous_photo_public_id AS "previousPhotoPublicId"
                 FROM users
                 WHERE id = $1 OR email = $2
                 FOR UPDATE;`,
                [authUser.id || null, authUser.gmail]
            );

            const currentUser = currentUserRes.rows[0];
            if (!currentUser || !currentUser.previousPhotoUrl || !currentUser.previousPhotoPublicId) {
                await client.query("ROLLBACK");
                return res.status(400).json({
                    success: false,
                    message: "No previous photo exists to restore.",
                });
            }

            // Swap active photo and previous photo
            restoredUrl = currentUser.previousPhotoUrl;
            const restoredPublicId = currentUser.previousPhotoPublicId;

            newPreviousUrl = currentUser.photoUrl || null;
            const newPreviousPublicId = currentUser.photoPublicId || null;

            await client.query(
                `UPDATE users
                 SET photo_url = $1,
                     photo_public_id = $2,
                     previous_photo_url = $3,
                     previous_photo_public_id = $4,
                     avatar_url = $1,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $5 OR email = $6;`,
                [
                    restoredUrl,
                    restoredPublicId,
                    newPreviousUrl,
                    newPreviousPublicId,
                    authUser.id || null,
                    authUser.gmail,
                ]
            );

            await client.query("COMMIT");
        } catch (dbErr) {
            await client.query("ROLLBACK");
            throw dbErr;
        } finally {
            client.release();
        }

        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.username),
            deleteUserDetailsCache(authUser.gmail),
        ]);

        return res.status(200).json({
            success: true,
            message: "Previous profile photo restored successfully",
            photoUrl: restoredUrl,
            hasPreviousPhoto: Boolean(newPreviousUrl),
            previousPhotoUrl: newPreviousUrl,
        });
    } catch (err: any) {
        console.error("handleRestorePhoto error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to restore previous profile photo",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

/**
 * Action: Use Default Avatar
 * POST /api/profile/photo/default & DELETE /api/profile/photo
 */
export const handleUseDefaultAvatar = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const client = await pool.connect();

        let preservedPreviousUrl: string | null = null;

        try {
            await client.query("BEGIN");

            const currentUserRes = await client.query(
                `SELECT photo_url AS "photoUrl",
                        photo_public_id AS "photoPublicId",
                        previous_photo_url AS "previousPhotoUrl",
                        previous_photo_public_id AS "previousPhotoPublicId"
                 FROM users
                 WHERE id = $1 OR email = $2
                 FOR UPDATE;`,
                [authUser.id || null, authUser.gmail]
            );

            const currentUser = currentUserRes.rows[0];

            // If the user had an active photo, preserve it as previous_photo so they can still restore it!
            let newPreviousUrl = currentUser?.previousPhotoUrl || null;
            let newPreviousPublicId = currentUser?.previousPhotoPublicId || null;

            if (currentUser?.photoPublicId) {
                newPreviousUrl = currentUser.photoUrl;
                newPreviousPublicId = currentUser.photoPublicId;
            }

            preservedPreviousUrl = newPreviousUrl;

            // Set active photo fields to default avatar
            const defaultAvatarUrl = "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
            await client.query(
                `UPDATE users
                 SET photo_url = NULL,
                     photo_public_id = NULL,
                     avatar_url = $5,
                     previous_photo_url = $1,
                     previous_photo_public_id = $2,
                     updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 OR email = $4;`,
                [newPreviousUrl, newPreviousPublicId, authUser.id || null, authUser.gmail, defaultAvatarUrl]
            );

            await client.query("COMMIT");
        } catch (dbErr) {
            await client.query("ROLLBACK");
            throw dbErr;
        } finally {
            client.release();
        }

        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.username),
            deleteUserDetailsCache(authUser.gmail),
        ]);

        return res.status(200).json({
            success: true,
            message: "Default avatar applied",
            photoUrl: null,
            hasPreviousPhoto: Boolean(preservedPreviousUrl),
            previousPhotoUrl: preservedPreviousUrl,
        });
    } catch (err: any) {
        console.error("handleUseDefaultAvatar error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to apply default avatar",
            error: process.env.NODE_ENV === "development" ? err.message : undefined,
        });
    }
};

// Restrict club accounts from personal avatar management
photoRouter.use(authenticate, (req: Request, res: Response, next) => {
    if ((req.user as any)?.accountType === "club" || (req.user as any)?.account_type === "club") {
        return res.status(403).json({
            success: false,
            message: "Club accounts cannot access personal photo features.",
        });
    }
    next();
});

// Route registrations
photoRouter.post("/upload-signature", handleUploadSignature);
photoRouter.post("/confirm", handleConfirmPhoto);
photoRouter.post("/restore", handleRestorePhoto);
photoRouter.post("/default", handleUseDefaultAvatar);
photoRouter.delete("/", handleUseDefaultAvatar);

export default photoRouter;
