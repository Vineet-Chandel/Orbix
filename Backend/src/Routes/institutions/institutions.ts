import express, { type Request, type Response } from "express";
import { query } from "../../database/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";

const institutionsRouter = express.Router();

/**
 * GET /api/institutions/search?q=...&state=...&limit=...
 * Public autocomplete search for verified, active institutions.
 * Returns only the fields needed by the UI dropdown.
 */
institutionsRouter.get("/search", async (req: Request, res: Response) => {
    try {
        const rawQuery = String(req.query.q || "").trim();
        const stateFilter = req.query.state
            ? String(req.query.state).trim()
            : null;
        let limit = parseInt(String(req.query.limit || "15"), 10);

        // Enforce server-side limits
        if (isNaN(limit) || limit < 1) limit = 15;
        if (limit > 50) limit = 50;

        // Sanitize: remove SQL wildcards
        let sanitized = rawQuery
            .replace(/%/g, "")
            .replace(/_/g, "")
            .replace(/\\/g, "");

        // Require at least 2 meaningful characters
        if (sanitized.length < 2) {
            return res.status(200).json({
                success: true,
                institutions: [],
                total: 0,
            });
        }

        const result = await query(
            `SELECT
                id,
                official_name AS "officialName",
                city,
                state,
                district,
                institution_type AS "institutionType",
                aishe_code AS "aisheCode",
                verification_status AS "verificationStatus"
            FROM search_verified_institutions($1, $2, $3);`,
            [sanitized, stateFilter, limit]
        );

        return res.status(200).json({
            success: true,
            institutions: result.rows,
            total: result.rows.length,
        });
    } catch (err: any) {
        console.error("Institution search error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to search institutions",
            error: err.message,
        });
    }
});

/**
 * GET /api/institutions/:id
 * Fetch a single institution by UUID (for resolving saved college_id).
 */
institutionsRouter.get("/:id", async (req: Request, res: Response) => {
    try {
        const institutionId = String(req.params.id || "").trim();

        // Basic UUID format validation
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(institutionId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid institution ID format",
            });
        }

        const result = await query(
            `SELECT
                id,
                official_name AS "officialName",
                city,
                state,
                district,
                institution_type AS "institutionType",
                aishe_code AS "aisheCode",
                verification_status AS "verificationStatus",
                is_active AS "isActive"
            FROM institutions
            WHERE id = $1
            LIMIT 1;`,
            [institutionId]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "Institution not found",
            });
        }

        return res.status(200).json({
            success: true,
            institution: result.rows[0],
        });
    } catch (err: any) {
        console.error("Institution fetch error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch institution",
            error: err.message,
        });
    }
});

/**
 * POST /api/institutions/verification-request
 * Authenticated users can submit a request for a missing institution.
 * Creates a pending review — does NOT create a verified institution.
 */
institutionsRouter.post(
    "/verification-request",
    optionalAuthenticate,
    async (req: Request, res: Response) => {
        try {
            const authUser = req.user;
            const submittedByUserId = authUser?.id || null;
            const submittedByUsername = authUser?.username || "guest";

            const { institutionName, institutionWebsite, supportingReference } =
                req.body;

            if (
                !institutionName ||
                typeof institutionName !== "string" ||
                institutionName.trim().length < 3
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Institution name is required (minimum 3 characters)",
                });
            }

            const cleanName = institutionName.trim().slice(0, 500);
            const cleanWebsite = institutionWebsite
                ? String(institutionWebsite).trim().slice(0, 500)
                : null;
            const cleanReference = supportingReference
                ? String(supportingReference).trim().slice(0, 2000)
                : null;

            // Check for duplicate pending requests
            const existingRequest = await query(
                `SELECT id FROM institution_verification_requests
                 WHERE (
                     ($1::uuid IS NOT NULL AND submitted_by_user_id = $1)
                     OR ($1::uuid IS NULL AND LOWER(institution_name) = LOWER($2))
                 )
                   AND LOWER(institution_name) = LOWER($2)
                   AND status IN ('pending', 'under_review')
                 LIMIT 1;`,
                [submittedByUserId, cleanName]
            );

            if (existingRequest.rows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message:
                        "A verification request for this institution has already been submitted and is currently being reviewed.",
                });
            }

            // Check if institution already exists in directory as verified
            const existingInstitution = await query(
                `SELECT id, official_name, verification_status
                 FROM institutions
                 WHERE LOWER(normalized_name) = LOWER($1)
                    OR LOWER(official_name) = LOWER($1)
                 LIMIT 1;`,
                [cleanName.toLowerCase()]
            );

            if (existingInstitution.rows.length > 0) {
                const existing = existingInstitution.rows[0];
                if (existing.verification_status === "verified") {
                    return res.status(409).json({
                        success: false,
                        message: `"${existing.official_name}" already exists as a verified institution in the directory. You can search and select it in the dropdown.`,
                    });
                }
            }

            const insertResult = await query(
                `INSERT INTO institution_verification_requests (
                    submitted_by_user_id,
                    submitted_by_username,
                    institution_name,
                    institution_website,
                    supporting_reference,
                    status
                ) VALUES ($1, $2, $3, $4, $5, 'pending')
                RETURNING id, created_at;`,
                [
                    submittedByUserId,
                    submittedByUsername,
                    cleanName,
                    cleanWebsite,
                    cleanReference,
                ]
            );

            return res.status(201).json({
                success: true,
                message:
                    "Your verification request has been submitted and recorded in the database review queue.",
                requestId: insertResult.rows[0]?.id,
            });
        } catch (err: any) {
            console.error("Verification request error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to submit verification request",
                error: err.message,
            });
        }
    }
);

/**
 * GET /api/institutions/verification-requests/mine
 * Get authenticated user's own verification requests.
 */
institutionsRouter.get(
    "/verification-requests/mine",
    authenticate,
    async (req: Request, res: Response) => {
        try {
            const authUser = req.user;
            if (!authUser) {
                return res.status(401).json({
                    success: false,
                    message: "Authentication required",
                });
            }

            const result = await query(
                `SELECT
                    id,
                    institution_name AS "institutionName",
                    institution_website AS "institutionWebsite",
                    status,
                    admin_notes AS "adminNotes",
                    created_at AS "createdAt",
                    updated_at AS "updatedAt"
                FROM institution_verification_requests
                WHERE submitted_by_user_id = $1
                ORDER BY created_at DESC
                LIMIT 20;`,
                [authUser.id]
            );

            return res.status(200).json({
                success: true,
                requests: result.rows,
            });
        } catch (err: any) {
            console.error("Fetch verification requests error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to fetch verification requests",
                error: err.message,
            });
        }
    }
);

export default institutionsRouter;
