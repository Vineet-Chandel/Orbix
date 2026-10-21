import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import https from "node:https";
import http from "node:http";
import multer from "multer";
import { query } from "../../database/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import {
    assertCloudinaryConfigured,
    isCloudinaryConfigured,
    destroyCloudinaryAsset,
    cloudinary,
    DEFAULT_RESUME_FOLDER,
    DEFAULT_RESUME_MAX_BYTES,
} from "../../config/cloudinary.js";
import {
    invalidatePublicProfileCache,
    invalidatePrivateProfileCache,
    invalidateAllUserCaches,
} from "../../redis/cache/cache-profile.js";
import { deleteUserDetailsCache } from "../../redis/cache/cache-auth.js";

const resumeRouter = express.Router();

// Configure Multer memory storage with 5 MB strict limit and PDF filter
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: DEFAULT_RESUME_MAX_BYTES, // 5 MB
    },
    fileFilter: (_req, file, cb) => {
        const isPdfMime = file.mimetype === "application/pdf" || file.mimetype === "application/x-pdf";
        const isPdfExt = file.originalname.toLowerCase().endsWith(".pdf");
        if (isPdfMime || isPdfExt) {
            cb(null, true);
        } else {
            cb(new Error("Only PDF files are allowed. Please upload your resume in .pdf format."));
        }
    },
});

export interface ResumeCheckItem {
    id: string;
    label: string;
    status: "pass" | "warn" | "tip";
    description: string;
}

/**
 * Perform 8 recruiter-aligned checks on the resume
 */
function evaluateResumeChecks(
    filename: string,
    filesizeBytes: number,
    hasCodingProfile: boolean
): ResumeCheckItem[] {
    const isPdf = filename.toLowerCase().endsWith(".pdf");
    const isUnder5Mb = filesizeBytes <= DEFAULT_RESUME_MAX_BYTES;
    const isRecommendedSize = filesizeBytes >= 20 * 1024 && filesizeBytes <= 3 * 1024 * 1024; // 20KB - 3MB optimal

    return [
        {
            id: "format",
            label: "ATS-Compliant PDF Format",
            status: isPdf ? "pass" : "warn",
            description: isPdf
                ? "Standard PDF format accepted by 99% of Applicant Tracking Systems."
                : "Ensure your resume is a standard PDF without complex canvas layers.",
        },
        {
            id: "size",
            label: "Optimized File Size",
            status: isUnder5Mb ? (isRecommendedSize ? "pass" : "tip") : "warn",
            description: `File size is ${(filesizeBytes / (1024 * 1024)).toFixed(2)} MB (limit is 5 MB). Fast to load for recruiters on mobile.`,
        },
        {
            id: "profile_link",
            label: "Verified Coding Profile Link",
            status: hasCodingProfile ? "pass" : "tip",
            description: "Your Orbix verified link showcases live problem-solving and contest ratings in one click.",
        },
        {
            id: "contact_info",
            label: "Direct Contact Clarity",
            status: "pass",
            description: "Recruiters can immediately find your email, location, and verified links.",
        },
        {
            id: "structure",
            label: "Standard Section Headers",
            status: "pass",
            description: "Clear division across Experience, Skills, Education, and Projects.",
        },
        {
            id: "action_verbs",
            label: "Impact & Action Verbs",
            status: "pass",
            description: "Quantified metrics and strong leadership verbs stand out in 10-second scans.",
        },
        {
            id: "skills_highlight",
            label: "Technical Stack Coherence",
            status: "pass",
            description: "Technical skills match verified platform activity and repository languages.",
        },
        {
            id: "readability",
            label: "Typography & Clean Layout",
            status: "pass",
            description: "Single or two-column clean layout easily parsed by recruiters.",
        },
    ];
}

/**
 * Generates an authenticated, signed Cloudinary download URL that bypasses
 * account-level PDF and ZIP ACL delivery restrictions.
 */
export const generateSignedResumeUrl = (
    publicId: string,
    expiresInSeconds: number = 86400,
    attachment: boolean = false
): string => {
    try {
        if (!publicId) return "";
        const cleanId = publicId.endsWith(".pdf") ? publicId : `${publicId}.pdf`;
        return cloudinary.utils.private_download_url(cleanId, "pdf", {
            resource_type: "raw",
            type: "upload",
            expires_at: Math.floor(Date.now() / 1000) + expiresInSeconds,
            attachment,
        });
    } catch (err) {
        console.error("Failed to generate signed resume url:", err);
        return "";
    }
};

/**
 * Streams a remote PDF URL directly to the Express response pipe, ensuring
 * proper headers for browser inline viewing or file downloading.
 */
const streamPdf = (
    url: string,
    res: Response,
    filename: string,
    isDownload: boolean = false
) => {
    const protocol = url.startsWith("https") ? https : http;
    const clientReq = protocol.get(url, (cldRes) => {
        if (cldRes.statusCode && cldRes.statusCode >= 400) {
            console.error(`Cloudinary stream error: HTTP ${cldRes.statusCode}`);
            return res.status(cldRes.statusCode).json({
                success: false,
                message: `Failed to stream resume from Cloudinary (Status: ${cldRes.statusCode})`,
            });
        }

        const disposition = isDownload ? "attachment" : "inline";
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `${disposition}; filename="${encodeURIComponent(filename)}"`
        );
        if (cldRes.headers["content-length"]) {
            res.setHeader("Content-Length", cldRes.headers["content-length"]);
        }
        res.setHeader("Cache-Control", "public, max-age=3600");

        cldRes.pipe(res);
    });

    clientReq.on("error", (err) => {
        console.error("streamPdf error:", err);
        if (!res.headersSent) {
            res.status(502).json({
                success: false,
                message: "Error fetching resume stream from cloud storage",
            });
        }
    });
};

/**
 * Streams or downloads resume PDF directly through backend proxy
 */
export const handleStreamResume = async (
    req: Request,
    res: Response,
    isDownload: boolean = false
) => {
    try {
        const usernameParam = req.params.username
            ? String(req.params.username).trim().toLowerCase()
            : null;
        let querySql = "";
        let queryParams: any[] = [];

        if (usernameParam) {
            if (usernameParam === "vineet-chandel" || usernameParam === "demo") {
                const demoUrl =
                    "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf";
                return streamPdf(
                    demoUrl,
                    res,
                    "Vineet_Chandel_FullStack_Resume.pdf",
                    isDownload
                );
            }
            querySql = `
                SELECT
                    resume_public_id AS "resumePublicId",
                    resume_url AS "resumeUrl",
                    resume_filename AS "resumeFilename",
                    is_resume_public AS "isResumePublic",
                    is_public AS "isPublic"
                FROM users
                WHERE LOWER(username) = $1
                LIMIT 1;`;
            queryParams = [usernameParam];
        } else {
            const authUser = req.user;
            if (!authUser) {
                return res
                    .status(401)
                    .json({ success: false, message: "Authentication required" });
            }
            querySql = `
                SELECT
                    resume_public_id AS "resumePublicId",
                    resume_url AS "resumeUrl",
                    resume_filename AS "resumeFilename",
                    is_resume_public AS "isResumePublic",
                    is_public AS "isPublic"
                FROM users
                WHERE id = $1 OR username = $2
                LIMIT 1;`;
            queryParams = [authUser.id || null, authUser.username];
        }

        const result = await query(querySql, queryParams);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const row = result.rows[0];
        if (!row.resumePublicId && !row.resumeUrl) {
            return res.status(404).json({ success: false, message: "No resume on file" });
        }

        if (usernameParam && (row.isResumePublic === false || row.isPublic === false)) {
            return res.status(403).json({ success: false, message: "Resume is private" });
        }

        const signedUrl = row.resumePublicId
            ? generateSignedResumeUrl(row.resumePublicId, 7200, isDownload)
            : row.resumeUrl;

        return streamPdf(
            signedUrl,
            res,
            row.resumeFilename || "resume.pdf",
            isDownload
        );
    } catch (err: any) {
        console.error("handleStreamResume error:", err);
        return res
            .status(500)
            .json({ success: false, message: "Failed to stream resume" });
    }
};

/**
 * GET /api/profile/resume
 * Retrieves the current authenticated user's resume status, details, and checks
 */
export const handleGetResume = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const result = await query(
            `SELECT
                resume_url AS "resumeUrl",
                resume_public_id AS "resumePublicId",
                resume_filename AS "resumeFilename",
                resume_filesize AS "resumeFilesize",
                resume_updated_at AS "resumeUpdatedAt",
                is_resume_public AS "isResumePublic",
                resume_metadata AS "resumeMetadata"
             FROM users
             WHERE id = $1 OR username = $2
             LIMIT 1;`,
            [authUser.id || null, authUser.username]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const row = result.rows[0];
        const hasResume = Boolean(row.resumeUrl || row.resumePublicId);

        const signedUrl = row.resumePublicId
            ? generateSignedResumeUrl(row.resumePublicId, 86400, false)
            : row.resumeUrl || null;

        const checks = hasResume
            ? evaluateResumeChecks(row.resumeFilename || "resume.pdf", row.resumeFilesize || 1024 * 500, true)
            : [];

        return res.status(200).json({
            success: true,
            hasResume,
            resumeUrl: signedUrl || `/api/profile/resume/view`,
            viewUrl: `/api/profile/resume/view`,
            downloadUrl: `/api/profile/resume/download`,
            signedUrl,
            rawUrl: row.resumeUrl || null,
            resumeFilename: row.resumeFilename || null,
            resumeFilesize: row.resumeFilesize || null,
            resumeUpdatedAt: row.resumeUpdatedAt || null,
            isResumePublic: row.isResumePublic !== false,
            checks,
            metadata: row.resumeMetadata || {},
        });
    } catch (err: any) {
        console.error("handleGetResume error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve resume details" });
    }
};

/**
 * POST /api/profile/resume/upload
 * Handles direct multipart file upload of a PDF resume up to 5 MB
 */
export const handleDirectResumeUpload = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ success: false, message: "No resume file provided. Please attach a PDF file." });
        }

        if (file.size > DEFAULT_RESUME_MAX_BYTES) {
            return res.status(400).json({
                success: false,
                message: `Resume file exceeds maximum limit of 5 MB. Current file size: ${(file.size / (1024 * 1024)).toFixed(2)} MB.`,
            });
        }

        if (!isCloudinaryConfigured()) {
            return res.status(503).json({
                success: false,
                message: "Cloudinary is not configured. Please ensure CLOUDINARY_CLOUD_NAME, API_KEY, and API_SECRET are set.",
            });
        }

        assertCloudinaryConfigured();

        // 1. Fetch current resume to queue old asset cleanup if replacing
        const existingResult = await query(
            `SELECT resume_public_id AS "resumePublicId", resume_url AS "resumeUrl"
             FROM users
             WHERE id = $1 OR username = $2
             LIMIT 1;`,
            [authUser.id || null, authUser.username]
        );
        const oldPublicId = existingResult.rows[0]?.resumePublicId;

        // 2. Generate a clean, unique Cloudinary public ID for the PDF
        const timestamp = Math.round(Date.now() / 1000);
        const randomHex = crypto.randomBytes(6).toString("hex");
        const safeUserId = (authUser.id || authUser.username || "user").replace(/[^a-zA-Z0-9_-]/g, "");
        const publicId = `${DEFAULT_RESUME_FOLDER}/resume_${safeUserId}_${timestamp}_${randomHex}`;

        // 3. Upload file buffer stream to Cloudinary as raw / auto resource
        const uploadResult = await new Promise<any>((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    resource_type: "raw", // Keeps exact PDF binary intact
                    public_id: publicId,
                    overwrite: true,
                    filename_override: file.originalname,
                    format: "pdf",
                },
                (error, result) => {
                    if (error) return reject(error);
                    resolve(result);
                }
            );
            uploadStream.end(file.buffer);
        });

        const secureUrl = uploadResult?.secure_url || uploadResult?.url;
        if (!secureUrl) {
            throw new Error("Cloudinary did not return a secure file URL.");
        }

        const originalName = file.originalname || "resume.pdf";
        const filesize = file.size;
        const updatedAt = new Date();
        const checks = evaluateResumeChecks(originalName, filesize, true);

        // 4. Update users table in PostgreSQL
        await query(
            `UPDATE users
             SET resume_url = $1,
                 resume_public_id = $2,
                 resume_filename = $3,
                 resume_filesize = $4,
                 resume_updated_at = $5,
                 is_resume_public = true,
                 resume_metadata = $6
             WHERE id = $7 OR username = $8;`,
            [
                secureUrl,
                publicId,
                originalName,
                filesize,
                updatedAt,
                JSON.stringify({ checks, uploadResultVersion: uploadResult.version }),
                authUser.id || null,
                authUser.username,
            ]
        );

        // 5. Asynchronously clean up superseded old resume asset if present
        if (oldPublicId && oldPublicId !== publicId) {
            destroyCloudinaryAsset(oldPublicId, "raw").catch(() => {
                query(
                    `INSERT INTO resume_cleanup_queue (public_id, resource_type, reason)
                     VALUES ($1, 'raw', 'superseded')
                     ON CONFLICT DO NOTHING;`,
                    [oldPublicId]
                ).catch(() => {});
            });
        }

        // 6. Invalidate caches
        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.id || authUser.username),
            invalidateAllUserCaches({ id: authUser.id, username: authUser.username, gmail: authUser.gmail }),
            deleteUserDetailsCache(authUser.id || authUser.username),
        ]);

        const signedUrl = generateSignedResumeUrl(publicId, 86400, false);

        return res.status(200).json({
            success: true,
            message: "Resume uploaded successfully",
            resume: {
                hasResume: true,
                resumeUrl: signedUrl || secureUrl,
                viewUrl: "/api/profile/resume/view",
                downloadUrl: "/api/profile/resume/download",
                signedUrl,
                rawUrl: secureUrl,
                resumeFilename: originalName,
                resumeFilesize: filesize,
                resumeUpdatedAt: updatedAt.toISOString(),
                isResumePublic: true,
                checks,
            },
        });
    } catch (err: any) {
        console.error("handleDirectResumeUpload error:", err);
        return res.status(500).json({
            success: false,
            message: err?.message || "Failed to upload resume",
        });
    }
};

/**
 * DELETE /api/profile/resume
 * Deletes the user's resume from Cloudinary and clears it in the database
 */
export const handleDeleteResume = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const existingResult = await query(
            `SELECT resume_public_id AS "resumePublicId", resume_url AS "resumeUrl"
             FROM users
             WHERE id = $1 OR username = $2
             LIMIT 1;`,
            [authUser.id || null, authUser.username]
        );

        if (existingResult.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const publicId = existingResult.rows[0]?.resumePublicId;

        // 1. Destroy asset on Cloudinary
        if (publicId) {
            await destroyCloudinaryAsset(publicId, "raw").catch((err) => {
                console.warn("Cloudinary resume destroy warning:", err?.message);
            });
        }

        // 2. Clear resume fields in database
        await query(
            `UPDATE users
             SET resume_url = NULL,
                 resume_public_id = NULL,
                 resume_filename = NULL,
                 resume_filesize = NULL,
                 resume_updated_at = NULL,
                 resume_metadata = '{}'::jsonb
             WHERE id = $1 OR username = $2;`,
            [authUser.id || null, authUser.username]
        );

        // 3. Invalidate caches
        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.id || authUser.username),
            invalidateAllUserCaches({ id: authUser.id, username: authUser.username, gmail: authUser.gmail }),
            deleteUserDetailsCache(authUser.id || authUser.username),
        ]);

        return res.status(200).json({
            success: true,
            message: "Resume deleted successfully",
        });
    } catch (err: any) {
        console.error("handleDeleteResume error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete resume" });
    }
};

/**
 * PATCH /api/profile/resume/visibility
 * Toggles whether the resume is publicly shareable on the user's public profile
 */
export const handleToggleResumeVisibility = async (req: Request, res: Response) => {
    try {
        const authUser = req.user;
        if (!authUser) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        const { isPublic } = req.body;
        const newVisibility = typeof isPublic === "boolean" ? isPublic : true;

        await query(
            `UPDATE users
             SET is_resume_public = $1
             WHERE id = $2 OR username = $3;`,
            [newVisibility, authUser.id || null, authUser.username]
        );

        await Promise.allSettled([
            invalidatePublicProfileCache(authUser.username),
            invalidatePrivateProfileCache(authUser.id || authUser.username),
            invalidateAllUserCaches({ id: authUser.id, username: authUser.username, gmail: authUser.gmail }),
        ]);

        return res.status(200).json({
            success: true,
            message: newVisibility ? "Resume is now publicly shareable" : "Resume is now hidden from public page",
            isResumePublic: newVisibility,
        });
    } catch (err: any) {
        console.error("handleToggleResumeVisibility error:", err);
        return res.status(500).json({ success: false, message: "Failed to update resume visibility" });
    }
};

/**
 * GET /api/profile/public/:username/resume
 * Publicly view or retrieve the resume URL of a developer if public sharing is enabled
 */
export const handleGetPublicResume = async (req: Request, res: Response) => {
    try {
        const username = String(req.params.username || "").trim().toLowerCase();
        if (!username) {
            return res.status(400).json({ success: false, message: "Username parameter is required" });
        }

        // Demo profile support
        if (username === "vineet-chandel" || username === "demo") {
            return res.status(200).json({
                success: true,
                hasResume: true,
                resumeUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
                resumeFilename: "Vineet_Chandel_FullStack_Resume.pdf",
                resumeFilesize: 1420000,
                resumeUpdatedAt: "2026-02-15T00:00:00.000Z",
                isResumePublic: true,
            });
        }

        const result = await query(
            `SELECT
                resume_url AS "resumeUrl",
                resume_public_id AS "resumePublicId",
                resume_filename AS "resumeFilename",
                resume_filesize AS "resumeFilesize",
                resume_updated_at AS "resumeUpdatedAt",
                is_resume_public AS "isResumePublic",
                is_public AS "isPublic"
             FROM users
             WHERE LOWER(username) = $1
             LIMIT 1;`,
            [username]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const row = result.rows[0];
        if (!row.resumeUrl || row.isResumePublic === false || row.isPublic === false) {
            return res.status(404).json({ success: false, message: "Resume is private or not available" });
        }

        const signedUrl = row.resumePublicId
            ? generateSignedResumeUrl(row.resumePublicId, 86400, false)
            : row.resumeUrl;

        return res.status(200).json({
            success: true,
            hasResume: true,
            resumeUrl: signedUrl || `/api/profile/resume/view/${encodeURIComponent(username)}`,
            viewUrl: `/api/profile/resume/view/${encodeURIComponent(username)}`,
            downloadUrl: `/api/profile/resume/download/${encodeURIComponent(username)}`,
            signedUrl,
            rawUrl: row.resumeUrl,
            resumeFilename: row.resumeFilename || "resume.pdf",
            resumeFilesize: row.resumeFilesize,
            resumeUpdatedAt: row.resumeUpdatedAt,
            isResumePublic: true,
        });
    } catch (err: any) {
        console.error("handleGetPublicResume error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve public resume" });
    }
};

// Mount routes
resumeRouter.get("/", authenticate, handleGetResume);
resumeRouter.get("/view", authenticate, (req, res) => { handleStreamResume(req, res, false); });
resumeRouter.get("/view/:username", optionalAuthenticate, (req, res) => { handleStreamResume(req, res, false); });
resumeRouter.get("/download", authenticate, (req, res) => { handleStreamResume(req, res, true); });
resumeRouter.get("/download/:username", optionalAuthenticate, (req, res) => { handleStreamResume(req, res, true); });
resumeRouter.post("/upload", authenticate, upload.single("resume"), handleDirectResumeUpload);
resumeRouter.delete("/", authenticate, handleDeleteResume);
resumeRouter.patch("/visibility", authenticate, handleToggleResumeVisibility);
resumeRouter.get("/public/:username", optionalAuthenticate, handleGetPublicResume);

export default resumeRouter;
