/// <reference path="../../types/express.d.ts" />
import express, { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { query } from "../../database/client.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { userDetailsCache } from "../../redis/cache/cache-auth.js";
import { failsOccursSignup } from "../../redis/rate-limiters/rate-limiters-auth.js";
import ClubRegistrationValidator, {
    type ValidatedClubRegistrationData,
} from "../../validators/ClubRegistrationValidator.js";
import { ValidationError } from "../../validators/SignupValidator.js";

const clubRouter = express.Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not configured");
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

/**
 * Server-side reviewer allowlist.
 * Explicitly configured in the trusted server-side environment.
 */
export const getReviewerAllowlist = (): string[] => {
    const raw =
        process.env.ORBIX_REVIEWER_EMAILS ||
        "admin@orbix.dev,staff@orbix.dev,reviewer@orbix.dev,vineet@orbix.dev";
    return raw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
};

/**
 * Middleware: Verify that the requesting user is an authorized Orbix reviewer.
 * Rejects unauthorized users on the server side with 403 Forbidden.
 */
export const authenticateReviewer = async (
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required to access reviewer endpoints",
        });
    }

    const email = (req.user.gmail || req.user.email || "").toLowerCase();
    const allowlist = getReviewerAllowlist();
    const isAllowlisted = allowlist.includes(email);
    const isAdminAccount = (req.user as any).accountType === "admin" || (req.user as any).account_type === "admin";

    if (!isAllowlisted && !isAdminAccount) {
        return res.status(403).json({
            success: false,
            message: "Access forbidden: authorized Orbix staff/reviewers only",
        });
    }

    next();
};

/**
 * POST /api/club/register
 * Registers a new club account and immediately creates a pending verification request.
 */
clubRouter.post("/register", async (req: Request, res: Response) => {
    try {
        // Rate limiting
        const ip = req.ip || "unknown";
        const attempts = await failsOccursSignup({ ip });
        if (attempts > 6) {
            return res.status(429).json({
                success: false,
                message: "Too many registration attempts. Please try again later.",
            });
        }

        // Validate complete club registration payload
        const validated: ValidatedClubRegistrationData = ClubRegistrationValidator(req.body);

        // 1. Check if user already exists
        const existingUserRes = await query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1;`,
            [validated.contactEmail, validated.username]
        );
        if (existingUserRes.rows[0]) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address or username is already registered.",
            });
        }

        // 2. Check if active verification request exists for this email
        const existingActiveReq = await query(
            `SELECT id FROM club_verification_requests 
             WHERE LOWER(contact_email) = LOWER($1) 
               AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion')
             LIMIT 1;`,
            [validated.contactEmail]
        );
        if (existingActiveReq.rows[0]) {
            return res.status(409).json({
                success: false,
                message: "An active club verification application already exists for this email address.",
            });
        }

        // 3. Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);
        const newUserId = crypto.randomUUID();

        // 4. Split representative full name into firstName and lastName for users table
        const nameParts = validated.contactPersonName.split(" ").filter(Boolean);
        const firstName = nameParts[0] || validated.contactPersonName;
        const lastName = nameParts.slice(1).join(" ") || "Representative";

        // 5. Insert into auth.users (Supabase Auth table)
        try {
            await query(
                `INSERT INTO auth.users (
                    id,
                    email,
                    encrypted_password,
                    role,
                    aud,
                    raw_app_meta_data,
                    raw_user_meta_data,
                    created_at,
                    updated_at
                ) VALUES ($1, $2, $3, 'authenticated', 'authenticated', '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb, NOW(), NOW())
                ON CONFLICT (id) DO NOTHING;`,
                [
                    newUserId,
                    validated.contactEmail,
                    hashedPassword,
                    JSON.stringify({
                        account_type: "club",
                        club_name: validated.clubName,
                        contact_name: validated.contactPersonName,
                    }),
                ]
            );
        } catch (authErr: any) {
            console.warn("Notice: auth.users sync note:", authErr.message || authErr);
        }

        // 6. Insert into public.users with account_type = 'club'
        const userInsertRes = await query(
            `INSERT INTO users (
                id,
                username,
                firstname,
                lastname,
                email,
                password,
                termsaccepted,
                account_type
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'club')
            RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", account_type AS "accountType";`,
            [
                newUserId,
                validated.username,
                firstName,
                lastName,
                validated.contactEmail,
                hashedPassword,
                validated.termsAccepted,
            ]
        );
        const createdUser = userInsertRes.rows[0];

        // 7. Insert into public.club_verification_requests
        const requestInsertRes = await query(
            `INSERT INTO club_verification_requests (
                auth_user_id,
                club_name,
                college_name,
                college_city,
                college_state,
                college_country,
                club_category,
                club_description,
                contact_person_name,
                contact_person_role,
                contact_email,
                college_official_email,
                contact_phone,
                college_website_url,
                club_website_url,
                club_social_url,
                terms_accepted,
                terms_version,
                privacy_policy_accepted,
                privacy_policy_version,
                status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, 'v1.0', $18, 'v1.0',
                'pending'
            )
            RETURNING id, club_name, status, submitted_at;`,
            [
                newUserId,
                validated.clubName,
                validated.collegeName,
                validated.collegeCity,
                validated.collegeState,
                validated.collegeCountry,
                validated.clubCategory,
                validated.clubDescription,
                validated.contactPersonName,
                validated.contactPersonRole,
                validated.contactEmail,
                validated.collegeOfficialEmail,
                validated.contactPhone,
                validated.collegeWebsiteUrl,
                validated.clubWebsiteUrl,
                validated.clubSocialUrl,
                validated.termsAccepted,
                validated.privacyPolicyAccepted,
            ]
        );
        const createdRequest = requestInsertRes.rows[0];

        // 8. Generate JWT session tokens with accountType = 'club'
        const token = jwt.sign(
            {
                sub: newUserId,
                gmail: validated.contactEmail,
                username: validated.username,
                accountType: "club",
            },
            JWT_SECRET as string,
            {
                expiresIn: "8h",
                issuer: "orbix",
                audience: "orbix-users",
            }
        );

        const refreshToken = jwt.sign(
            {
                sub: newUserId,
                gmail: validated.contactEmail,
                username: validated.username,
                accountType: "club",
                type: "refresh",
            },
            JWT_SECRET as string,
            {
                expiresIn: "7d",
                issuer: "orbix",
                audience: "orbix-users",
            }
        );

        res.cookie("token", token, {
            ...getAuthCookieOptions(),
            maxAge: ACCESS_TOKEN_EXPIRY_MS,
        });

        res.cookie("refreshToken", refreshToken, {
            ...getAuthCookieOptions(),
            maxAge: REFRESH_TOKEN_EXPIRY_MS,
        });

        // 9. Cache in Redis
        await userDetailsCache({
            id: newUserId,
            firstName,
            middleName: "",
            lastName,
            gmail: validated.contactEmail,
            username: validated.username,
            password_hash: hashedPassword,
            termsAccepted: true,
            accountType: "club",
            account_type: "club",
        }).catch(() => {});

        return res.status(201).json({
            success: true,
            message: "Club registration submitted for verification successfully.",
            token,
            user: {
                id: newUserId,
                username: validated.username,
                firstName,
                lastName,
                gmail: validated.contactEmail,
                accountType: "club",
            },
            request: {
                id: createdRequest.id,
                clubName: createdRequest.club_name,
                status: createdRequest.status,
                submittedAt: createdRequest.submitted_at,
            },
        });
    } catch (err: any) {
        if (err instanceof ValidationError) {
            return res.status(400).json({
                success: false,
                message: err.message,
            });
        }

        if (err.code === "23505") {
            return res.status(409).json({
                success: false,
                message: "A verification application with these credentials already exists.",
            });
        }

        console.error("Club registration error:", err);
        return res.status(500).json({
            success: false,
            message: "An internal server error occurred during club registration.",
        });
    }
});

/**
 * GET /api/club/application-status
 * Authenticated endpoint for club representatives to view their own application status.
 * Internal checklist results and reviewer notes are completely excluded.
 */
clubRouter.get("/application-status", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const userEmail = req.user?.gmail || req.user?.email;

        if (!userId && !userEmail) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        // Fetch user's latest club verification request by auth_user_id or contact_email
        const result = await query(
            `SELECT
                id,
                auth_user_id,
                club_name,
                college_name,
                college_city,
                college_state,
                college_country,
                club_category,
                club_description,
                contact_person_name,
                contact_person_role,
                contact_email,
                college_official_email,
                contact_phone,
                college_website_url,
                club_website_url,
                club_social_url,
                terms_accepted,
                terms_version,
                privacy_policy_accepted,
                privacy_policy_version,
                consent_recorded_at,
                status,
                submitted_at,
                updated_at
            FROM club_verification_requests
            WHERE auth_user_id = $1 OR LOWER(contact_email) = LOWER($2)
            ORDER BY submitted_at DESC
            LIMIT 1;`,
            [userId || null, userEmail || null]
        );

        if (!result.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "No club verification application found for this account.",
            });
        }

        return res.json({
            success: true,
            application: result.rows[0],
        });
    } catch (err: any) {
        console.error("Fetch club application status error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to retrieve application status.",
        });
    }
});

/**
 * GET /api/club/reviewer/check-access
 * Checks whether the currently authenticated user is an authorized reviewer.
 */
clubRouter.get("/reviewer/check-access", authenticate, async (req: Request, res: Response) => {
    try {
        const email = (req.user?.gmail || req.user?.email || "").toLowerCase();
        const allowlist = getReviewerAllowlist();
        const isAllowlisted = allowlist.includes(email);
        const isAdminAccount = (req.user as any)?.accountType === "admin" || (req.user as any)?.account_type === "admin";

        return res.json({
            success: true,
            isReviewer: isAllowlisted || isAdminAccount,
        });
    } catch {
        return res.json({ success: true, isReviewer: false });
    }
});

/**
 * GET /api/club/reviewer/queue
 * Retrieves all club verification requests for authorized Orbix staff/reviewers.
 * Supports optional ?status=... filtering.
 */
clubRouter.get(
    "/reviewer/queue",
    authenticate,
    authenticateReviewer,
    async (req: Request, res: Response) => {
        try {
            const statusFilter = req.query.status as string | undefined;

            let queryStr = `
                SELECT
                    id,
                    auth_user_id,
                    club_name,
                    college_name,
                    college_city,
                    college_state,
                    college_country,
                    club_category,
                    club_description,
                    contact_person_name,
                    contact_person_role,
                    contact_email,
                    college_official_email,
                    contact_phone,
                    college_website_url,
                    club_website_url,
                    club_social_url,
                    status,
                    college_contact_status,
                    club_existence_confirmed,
                    college_authorization_confirmed,
                    representative_authority_confirmed,
                    last_college_contacted_at,
                    reviewed_by,
                    reviewed_at,
                    internal_notes,
                    submitted_at,
                    updated_at
                FROM club_verification_requests
            `;
            const params: any[] = [];

            if (statusFilter && statusFilter !== "all") {
                queryStr += " WHERE status = $1";
                params.push(statusFilter);
            }

            queryStr += " ORDER BY submitted_at DESC LIMIT 100;";

            const result = await query(queryStr, params);

            return res.json({
                success: true,
                count: result.rows.length,
                requests: result.rows,
            });
        } catch (err: any) {
            console.error("Reviewer queue fetch error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to retrieve verification queue.",
            });
        }
    }
);

/**
 * GET /api/club/reviewer/request/:id
 * Retrieves full application details for an individual club verification request.
 */
clubRouter.get(
    "/reviewer/request/:id",
    authenticate,
    authenticateReviewer,
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const result = await query(
                `SELECT * FROM club_verification_requests WHERE id = $1 LIMIT 1;`,
                [id]
            );

            if (!result.rows[0]) {
                return res.status(404).json({
                    success: false,
                    message: "Verification request not found.",
                });
            }

            return res.json({
                success: true,
                request: result.rows[0],
            });
        } catch (err: any) {
            console.error("Fetch verification request error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to retrieve verification request.",
            });
        }
    }
);

/**
 * PATCH /api/club/reviewer/request/:id
 * Updates college verification checklist results, internal notes, and/or status.
 * Enforces valid transitions and requires full checklist confirmation before ready_for_promotion.
 */
clubRouter.patch(
    "/reviewer/request/:id",
    authenticate,
    authenticateReviewer,
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const reviewerId = req.user?.id;

            // 1. Fetch current application state
            const currentRes = await query(
                `SELECT * FROM club_verification_requests WHERE id = $1 LIMIT 1;`,
                [id]
            );
            if (!currentRes.rows[0]) {
                return res.status(404).json({
                    success: false,
                    message: "Verification request not found.",
                });
            }
            const current = currentRes.rows[0];

            const {
                collegeContactStatus,
                clubExistenceConfirmed,
                collegeAuthorizationConfirmed,
                representativeAuthorityConfirmed,
                lastCollegeContactedAt,
                internalNotes,
                status: newStatus,
            } = req.body;

            // Determine updated checklist values (preserving existing values if omitted)
            const updatedContactStatus =
                collegeContactStatus !== undefined
                    ? collegeContactStatus
                    : current.college_contact_status;
            const updatedExistence =
                clubExistenceConfirmed !== undefined
                    ? Boolean(clubExistenceConfirmed)
                    : current.club_existence_confirmed;
            const updatedAuthorization =
                collegeAuthorizationConfirmed !== undefined
                    ? Boolean(collegeAuthorizationConfirmed)
                    : current.college_authorization_confirmed;
            const updatedAuthority =
                representativeAuthorityConfirmed !== undefined
                    ? Boolean(representativeAuthorityConfirmed)
                    : current.representative_authority_confirmed;
            const updatedContactDate =
                lastCollegeContactedAt !== undefined
                    ? lastCollegeContactedAt
                    : current.last_college_contacted_at;
            const updatedNotes =
                internalNotes !== undefined ? internalNotes : current.internal_notes;

            // Validate college_contact_status check constraint
            const validContactStatuses = [
                "not_started",
                "contacted",
                "confirmed",
                "not_found",
                "no_response",
            ];
            if (!validContactStatuses.includes(updatedContactStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid college contact status. Must be one of: ${validContactStatuses.join(
                        ", "
                    )}`,
                });
            }

            // Status transition validation
            let targetStatus = current.status;
            if (newStatus && newStatus !== current.status) {
                const validStatuses = [
                    "pending",
                    "under_review",
                    "needs_information",
                    "rejected",
                    "ready_for_promotion",
                ];
                if (!validStatuses.includes(newStatus)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid application status: ${newStatus}`,
                    });
                }

                // Allowed status transitions
                const allowedTransitions: Record<string, string[]> = {
                    pending: ["under_review"],
                    under_review: ["needs_information", "rejected", "ready_for_promotion"],
                    needs_information: ["under_review"],
                    ready_for_promotion: ["under_review"], // allowed for correction
                    rejected: ["under_review"], // allowed for reconsideration
                };

                const permitted = allowedTransitions[current.status] || [];
                if (!permitted.includes(newStatus)) {
                    return res.status(400).json({
                        success: false,
                        message: `Invalid status transition: cannot change from '${current.status}' to '${newStatus}'.`,
                    });
                }

                // Strict validation for ready_for_promotion:
                // All verification checklist items must be confirmed!
                if (newStatus === "ready_for_promotion") {
                    if (
                        updatedContactStatus !== "confirmed" ||
                        !updatedExistence ||
                        !updatedAuthorization ||
                        !updatedAuthority
                    ) {
                        return res.status(400).json({
                            success: false,
                            message:
                                "Cannot mark as 'ready_for_promotion': All checklist items (College Contact Confirmed, Club Existence, College Authorization, and Representative Authority) must be verified first.",
                        });
                    }
                }

                targetStatus = newStatus;
            }

            // Update database record
            const updateRes = await query(
                `UPDATE club_verification_requests
                 SET
                    college_contact_status = $1,
                    club_existence_confirmed = $2,
                    college_authorization_confirmed = $3,
                    representative_authority_confirmed = $4,
                    last_college_contacted_at = $5,
                    internal_notes = $6,
                    status = $7,
                    reviewed_by = $8,
                    reviewed_at = NOW(),
                    updated_at = NOW()
                 WHERE id = $9
                 RETURNING *;`,
                [
                    updatedContactStatus,
                    updatedExistence,
                    updatedAuthorization,
                    updatedAuthority,
                    updatedContactDate,
                    updatedNotes,
                    targetStatus,
                    reviewerId || null,
                    id,
                ]
            );

            return res.json({
                success: true,
                message: "Verification application updated successfully.",
                request: updateRes.rows[0],
            });
        } catch (err: any) {
            console.error("Reviewer update error:", err);
            return res.status(500).json({
                success: false,
                message: "Failed to update verification application.",
            });
        }
    }
);

export default clubRouter;
