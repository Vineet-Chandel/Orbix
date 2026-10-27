/// <reference path="../../types/express.d.ts" />
import express, { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool, query } from "../../database/client.js";
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
 * Helper to generate a clean, URL-safe slug.
 */
export function generateSlug(text: string): string {
    return text
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/**
 * Record a persistent timeline event for an application.
 */
export async function recordTimelineEvent({
    applicationId,
    authUserId,
    stage,
    status,
    title,
    message,
    actionRequired,
    isApplicantVisible = true,
    actorId,
}: {
    applicationId: string;
    authUserId: string;
    stage: "application_submitted" | "initial_review" | "college_verification" | "verification_decision" | "club_activated";
    status: "completed" | "in_progress" | "upcoming" | "action_required" | "rejected";
    title: string;
    message: string;
    actionRequired?: string | null | undefined;
    isApplicantVisible?: boolean | null | undefined;
    actorId?: string | null | undefined;
}) {
    try {
        await query(
            `INSERT INTO club_verification_timeline_events (
                application_id, auth_user_id, stage, status, title, message, action_required, is_applicant_visible, actor_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW());`,
            [applicationId, authUserId, stage, status, title, message, actionRequired || null, isApplicantVisible, actorId || null]
        );
    } catch (err) {
        console.warn("Notice: recordTimelineEvent failed:", err);
    }
}

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

        // 1. Authoritatively validate and resolve the institution from the verified directory
        let verifiedInst: any = null;
        if (validated.collegeId) {
            const instRes = await query(
                `SELECT id, official_name, city, district, state, website, verification_status 
                 FROM institutions 
                 WHERE id = $1 AND verification_status = 'verified' AND is_active = true 
                 LIMIT 1;`,
                [validated.collegeId]
            );
            verifiedInst = instRes.rows[0];
        }

        // Fallback: Check by official name or AISHE code if collegeId was not directly passed
        if (!verifiedInst && validated.collegeName) {
            const instRes = await query(
                `SELECT id, official_name, city, district, state, website, verification_status 
                 FROM institutions 
                 WHERE (LOWER(official_name) = LOWER($1) OR LOWER(aishe_code) = LOWER($1) OR LOWER(normalized_name) = LOWER($1))
                   AND verification_status = 'verified' AND is_active = true 
                 LIMIT 1;`,
                [validated.collegeName]
            );
            verifiedInst = instRes.rows[0];
        }

        if (!verifiedInst) {
            return res.status(400).json({
                success: false,
                message: "Selected college must be an official verified institution from the Orbix higher education directory. Custom or unregistered institutions are not permitted.",
            });
        }

        const authoritativeCollegeId = verifiedInst.id;
        const authoritativeCollegeName = verifiedInst.official_name;
        const authoritativeCollegeCity = verifiedInst.city || verifiedInst.district || validated.collegeCity;
        const authoritativeCollegeState = verifiedInst.state || validated.collegeState;
        const authoritativeCollegeCountry = "India";
        const authoritativeCollegeWebsite = verifiedInst.website || validated.collegeWebsiteUrl || null;

        // 2. Check if user already exists
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

        // 3. Check if active verification request exists for this email
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

        // 4. Hash password
        const hashedPassword = await bcrypt.hash(validated.password, 10);
        const newUserId = crypto.randomUUID();

        // 5. Split representative full name into firstName and lastName for users table
        const nameParts = validated.contactPersonName.split(" ").filter(Boolean);
        const firstName = nameParts[0] || validated.contactPersonName;
        const lastName = nameParts.slice(1).join(" ") || "Representative";

        // 6. Insert into auth.users (Supabase Auth table)
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

        // 7. Insert into public.users with account_type = 'club' and verified college_id
        const defaultAvatarUrl = "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png";
        const userInsertRes = await query(
            `INSERT INTO users (
                id,
                username,
                firstname,
                lastname,
                email,
                password,
                termsaccepted,
                account_type,
                avatar_url,
                college_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'club', $8, $9)
            RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", account_type AS "accountType", avatar_url AS "avatarUrl", college_id AS "collegeId";`,
            [
                newUserId,
                validated.username,
                firstName,
                lastName,
                validated.contactEmail,
                hashedPassword,
                validated.termsAccepted,
                defaultAvatarUrl,
                authoritativeCollegeId,
            ]
        );
        const createdUser = userInsertRes.rows[0];

        // 8. Insert into public.club_verification_requests with verified college details
        const requestInsertRes = await query(
            `INSERT INTO club_verification_requests (
                auth_user_id,
                college_id,
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
                $11, $12, $13, $14, $15, $16, $17, $18, 'v1.0', $19, 'v1.0',
                'pending'
            )
            RETURNING id, club_name, status, submitted_at;`,
            [
                newUserId,
                authoritativeCollegeId,
                validated.clubName,
                authoritativeCollegeName,
                authoritativeCollegeCity,
                authoritativeCollegeState,
                authoritativeCollegeCountry,
                validated.clubCategory,
                validated.clubDescription,
                validated.contactPersonName,
                validated.contactPersonRole,
                validated.contactEmail,
                validated.collegeOfficialEmail,
                validated.contactPhone,
                authoritativeCollegeWebsite,
                validated.clubWebsiteUrl,
                validated.clubSocialUrl,
                validated.termsAccepted,
                validated.privacyPolicyAccepted,
            ]
        );
        const createdRequest = requestInsertRes.rows[0];

        // 7b. Insert initial 5-stage timeline history into club_verification_timeline_events
        await query(
            `INSERT INTO club_verification_timeline_events (
                application_id, auth_user_id, stage, status, title, message, is_applicant_visible, created_at
            ) VALUES 
            ($1, $2, 'application_submitted', 'completed', 'Application submitted', 'Your application was received.', true, NOW()),
            ($1, $2, 'initial_review', 'in_progress', 'Initial review', 'Orbix is reviewing the submitted details.', true, NOW() + interval '1 millisecond'),
            ($1, $2, 'college_verification', 'upcoming', 'College verification', 'The college and representative will be checked.', true, NOW() + interval '2 milliseconds'),
            ($1, $2, 'verification_decision', 'upcoming', 'Verification decision', 'Approval, additional information, or rejection.', true, NOW() + interval '3 milliseconds'),
            ($1, $2, 'club_activated', 'upcoming', 'Club access activated', 'Your dedicated club dashboard becomes available.', true, NOW() + interval '4 milliseconds');`,
            [createdRequest.id, newUserId]
        ).catch((err) => console.warn("Notice: initial timeline creation:", err.message || err));

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

        // Check if user already has an active verified club
        const verifiedRes = await query(
            `SELECT id, name, slug, category, college_name, college_city, college_state, college_country, logo_url, is_active, verified_at
             FROM verified_clubs
             WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        const verifiedClub = verifiedRes.rows[0];

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
                college_contact_status,
                last_college_contacted_at,
                submitted_at,
                updated_at,
                verified_club_id
            FROM club_verification_requests
            WHERE auth_user_id = $1 OR LOWER(contact_email) = LOWER($2)
            ORDER BY submitted_at DESC
            LIMIT 1;`,
            [userId || null, userEmail || null]
        );

        const application = result.rows[0];

        if (!application && !verifiedClub) {
            return res.status(404).json({
                success: false,
                message: "No club verification application found for this account.",
            });
        }

        // If club is verified, return isVerified: true and dashboard redirect info
        if (verifiedClub) {
            const timelineRes = await query(
                `SELECT id, stage, status, title, message, action_required AS "actionRequired", created_at AS "createdAt"
                 FROM club_verification_timeline_events
                 WHERE auth_user_id = $1 AND is_applicant_visible = true
                 ORDER BY created_at ASC;`,
                [userId]
            );

            return res.json({
                success: true,
                isVerified: true,
                verifiedClub,
                application: application ? { ...application, status: "approved" } : { status: "approved", club_name: verifiedClub.name },
                timelineEvents: timelineRes.rows,
            });
        }

        // Fetch timeline events for pending application
        let timelineRes = await query(
            `SELECT id, stage, status, title, message, action_required AS "actionRequired", created_at AS "createdAt"
             FROM club_verification_timeline_events
             WHERE auth_user_id = $1 AND is_applicant_visible = true
             ORDER BY created_at ASC;`,
            [userId]
        );

        let timelineEvents = timelineRes.rows;

        // Backfill if empty for an existing application
        if (timelineEvents.length === 0 && application) {
            await query(
                `INSERT INTO club_verification_timeline_events (
                    application_id, auth_user_id, stage, status, title, message, is_applicant_visible, created_at
                ) VALUES 
                ($1, $2, 'application_submitted', 'completed', 'Application submitted', 'Your application was received.', true, $3),
                ($1, $2, 'initial_review', $4, 'Initial review', 'Orbix is reviewing the submitted details.', true, $3 + interval '1 millisecond'),
                ($1, $2, 'college_verification', 'upcoming', 'College verification', 'The college and representative will be checked.', true, $3 + interval '2 milliseconds'),
                ($1, $2, 'verification_decision', 'upcoming', 'Verification decision', 'Approval, additional information, or rejection.', true, $3 + interval '3 milliseconds'),
                ($1, $2, 'club_activated', 'upcoming', 'Club access activated', 'Your dedicated club dashboard becomes available.', true, $3 + interval '4 milliseconds');`,
                [
                    application.id,
                    application.auth_user_id,
                    application.submitted_at || new Date(),
                    application.status === 'pending' ? 'in_progress' : 'completed',
                ]
            ).catch(() => {});

            const refetch = await query(
                `SELECT id, stage, status, title, message, action_required AS "actionRequired", created_at AS "createdAt"
                 FROM club_verification_timeline_events
                 WHERE auth_user_id = $1 AND is_applicant_visible = true
                 ORDER BY created_at ASC;`,
                [userId]
            );
            timelineEvents = refetch.rows;
        }

        return res.json({
            success: true,
            isVerified: false,
            application,
            timelineEvents,
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

            const timelineRes = await query(
                `SELECT * FROM club_verification_timeline_events WHERE application_id = $1 ORDER BY created_at ASC;`,
                [id]
            );

            return res.json({
                success: true,
                request: result.rows[0],
                timelineEvents: timelineRes.rows,
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

            // Record timeline events for state transitions
            if (targetStatus !== current.status) {
                if (targetStatus === "under_review") {
                    await recordTimelineEvent({
                        applicationId: current.id,
                        authUserId: current.auth_user_id,
                        stage: "initial_review",
                        status: "completed",
                        title: "Initial review completed",
                        message: "Initial completeness and institution identification confirmed.",
                        actorId: reviewerId,
                    });
                    await recordTimelineEvent({
                        applicationId: current.id,
                        authUserId: current.auth_user_id,
                        stage: "college_verification",
                        status: "in_progress",
                        title: "College verification in progress",
                        message: "The college and representative authority are being verified.",
                        actorId: reviewerId,
                    });
                } else if (targetStatus === "needs_information") {
                    const actionMsg = req.body.actionRequired || "Additional information or documentation is required from the club representative.";
                    await recordTimelineEvent({
                        applicationId: current.id,
                        authUserId: current.auth_user_id,
                        stage: "college_verification",
                        status: "action_required",
                        title: "Information required from applicant",
                        message: actionMsg,
                        actionRequired: actionMsg,
                        actorId: reviewerId,
                    });
                } else if (targetStatus === "rejected") {
                    const rejectMsg = req.body.decisionMessage || "Your club registration application could not be verified based on institution response.";
                    await recordTimelineEvent({
                        applicationId: current.id,
                        authUserId: current.auth_user_id,
                        stage: "verification_decision",
                        status: "rejected",
                        title: "Application rejected",
                        message: rejectMsg,
                        actorId: reviewerId,
                    });
                }
            } else if (updatedContactStatus === "contacted" && current.college_contact_status !== "contacted") {
                await recordTimelineEvent({
                    applicationId: current.id,
                    authUserId: current.auth_user_id,
                    stage: "college_verification",
                    status: "in_progress",
                    title: "College contacted",
                    message: "Orbix review team reached out to the stated institution administration.",
                    actorId: reviewerId,
                });
            }

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

/**
 * POST /api/club/reviewer/promote/:id (and /api/club/reviewer/approve/:id)
 * Atomically approves and promotes an application into a verified club.
 */
const handlePromoteClub = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const { id } = req.params;
        const reviewerId = req.user?.id;

        // 1. Lock and validate application
        const appRes = await client.query(
            `SELECT * FROM club_verification_requests WHERE id = $1 FOR UPDATE;`,
            [id]
        );
        if (!appRes.rows[0]) {
            await client.query("ROLLBACK");
            return res.status(404).json({ success: false, message: "Verification request not found." });
        }
        const app = appRes.rows[0];

        // 2. Strict checklist revalidation: All 4 items MUST be confirmed
        if (
            app.college_contact_status !== "confirmed" ||
            !app.club_existence_confirmed ||
            !app.college_authorization_confirmed ||
            !app.representative_authority_confirmed
        ) {
            await client.query("ROLLBACK");
            return res.status(400).json({
                success: false,
                message: "Cannot promote club: All 4 verification checklist items (College Contact Confirmed, Club Existence, College Authorization, and Representative Authority) must be verified first.",
            });
        }

        // 3. Ensure auth_user_id does not already belong to another verified club
        const existingClub = await client.query(
            `SELECT id, slug FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [app.auth_user_id]
        );
        if (existingClub.rows[0]) {
            await client.query("ROLLBACK");
            return res.status(409).json({
                success: false,
                message: "An active verified club is already associated with this account.",
                verifiedClub: existingClub.rows[0],
            });
        }

        // 4. Generate unique readable slug from club_name
        let baseSlug = generateSlug(app.club_name);
        if (!baseSlug || baseSlug.length < 2) baseSlug = "club";
        let candidateSlug = baseSlug;
        let counter = 1;
        while (true) {
            const slugCheck = await client.query(
                `SELECT id FROM verified_clubs WHERE slug = $1 LIMIT 1;`,
                [candidateSlug]
            );
            if (!slugCheck.rows[0]) break;
            counter++;
            candidateSlug = `${baseSlug}-${counter}`;
        }

        // 5. Insert into verified_clubs
        const newClubId = crypto.randomUUID();
        const clubInsertRes = await client.query(
            `INSERT INTO verified_clubs (
                id,
                auth_user_id,
                college_id,
                name,
                slug,
                category,
                college_name,
                college_city,
                college_state,
                college_country,
                short_description,
                about,
                website_url,
                social_links,
                is_active,
                verified_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true, NOW(), NOW(), NOW())
            RETURNING *;`,
            [
                newClubId,
                app.auth_user_id,
                app.college_id || null,
                app.club_name,
                candidateSlug,
                app.club_category,
                app.college_name,
                app.college_city,
                app.college_state,
                app.college_country,
                app.club_description,
                app.club_description || `Official chapter of ${app.club_name} at ${app.college_name}.`,
                app.club_website_url,
                JSON.stringify(app.club_social_url ? { website: app.club_website_url, social: app.club_social_url } : {}),
            ]
        );
        const verifiedClub = clubInsertRes.rows[0];

        // 6. Record timeline events for verification_decision and club_activated
        await client.query(
            `INSERT INTO club_verification_timeline_events (
                application_id, auth_user_id, stage, status, title, message, is_applicant_visible, actor_id, created_at
            ) VALUES 
            ($1, $2, 'verification_decision', 'completed', 'Verification decision: Approved', 'Orbix reviewer confirmed all institution checks and representative credentials.', true, $3, NOW()),
            ($1, $2, 'club_activated', 'completed', 'Club access activated', 'Your dedicated club dashboard and public profile are now live.', true, $3, NOW() + interval '1 millisecond');`,
            [app.id, app.auth_user_id, reviewerId || null]
        );

        // 7. Atomically transition request to 'approved' and associate verified_club_id
        await client.query(
            `UPDATE club_verification_requests
             SET status = 'approved',
                 verified_club_id = $1,
                 reviewed_by = $2,
                 reviewed_at = NOW(),
                 updated_at = NOW()
             WHERE id = $3;`,
            [newClubId, reviewerId || null, app.id]
        );

        await client.query("COMMIT");

        return res.status(200).json({
            success: true,
            message: "Club verified, promoted, and activated successfully.",
            verifiedClub,
            redirectUrl: `/clubs/${verifiedClub.slug}`,
        });
    } catch (err: any) {
        await client.query("ROLLBACK");
        console.error("Atomic club promotion error:", err);
        return res.status(500).json({
            success: false,
            message: "Internal error during atomic club promotion.",
        });
    } finally {
        client.release();
    }
};

clubRouter.post("/reviewer/promote/:id", authenticate, authenticateReviewer, handlePromoteClub);
clubRouter.post("/reviewer/approve/:id", authenticate, authenticateReviewer, handlePromoteClub);

/**
 * GET /api/club/session-state
 * Resolves current user's authoritative account classification and club status.
 */
clubRouter.get("/session-state", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Authentication required" });
        }

        // Check verified_clubs
        const verifiedRes = await query(
            `SELECT id, name, slug, category, college_name, college_city, college_state, college_country, logo_url, is_active, verified_at
             FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );

        if (verifiedRes.rows[0]) {
            return res.json({
                success: true,
                accountType: "club",
                clubStatus: "approved",
                verifiedClub: verifiedRes.rows[0],
            });
        }

        // Check club_verification_requests
        const reqRes = await query(
            `SELECT id, club_name, status, submitted_at FROM club_verification_requests WHERE auth_user_id = $1 ORDER BY submitted_at DESC LIMIT 1;`,
            [userId]
        );

        if (reqRes.rows[0]) {
            return res.json({
                success: true,
                accountType: "club",
                clubStatus: reqRes.rows[0].status,
                application: reqRes.rows[0],
            });
        }

        return res.json({
            success: true,
            accountType: req.user?.accountType || "personal",
            clubStatus: "none",
        });
    } catch (err: any) {
        console.error("Session state error:", err);
        return res.status(500).json({ success: false, message: "Failed to resolve session state." });
    }
});

/**
 * GET /api/club/profile
 * Authenticated endpoint for the club to fetch its own verified profile & dashboard stats.
 */
clubRouter.get("/profile", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const clubRes = await query(
            `SELECT * FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );

        if (!clubRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "No verified club found for this account.",
            });
        }

        const club = clubRes.rows[0];

        // Event counts
        const countRes = await query(
            `SELECT 
                COUNT(*) FILTER (WHERE status = 'published' AND starts_at >= NOW()) AS upcoming_count,
                COUNT(*) FILTER (WHERE status = 'published' AND starts_at < NOW()) AS past_count,
                COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
                COUNT(*) AS total_count
             FROM club_events
             WHERE club_id = $1;`,
            [club.id]
        );

        return res.json({
            success: true,
            club,
            stats: countRes.rows[0] || { upcoming_count: 0, past_count: 0, draft_count: 0, total_count: 0 },
        });
    } catch (err: any) {
        console.error("Get club profile error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve club profile." });
    }
});

/**
 * PATCH /api/club/profile
 * Updates public profile fields (short_description, about, logo_url, cover_image_url, website_url, public_email, social_links).
 */
clubRouter.patch("/profile", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );

        if (!clubRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "No verified club found for this account.",
            });
        }

        const clubId = clubRes.rows[0].id;
        const {
            shortDescription,
            about,
            logoUrl,
            coverImageUrl,
            websiteUrl,
            publicEmail,
            socialLinks,
        } = req.body;

        // URL validations
        const urlRegex = /^https?:\/\/.+/i;
        if (websiteUrl && !urlRegex.test(websiteUrl)) {
            return res.status(400).json({ success: false, message: "Invalid website URL format." });
        }
        if (logoUrl && !urlRegex.test(logoUrl)) {
            return res.status(400).json({ success: false, message: "Invalid logo URL format." });
        }

        const updateRes = await query(
            `UPDATE verified_clubs
             SET
                short_description = COALESCE($1, short_description),
                about = COALESCE($2, about),
                logo_url = COALESCE($3, logo_url),
                cover_image_url = COALESCE($4, cover_image_url),
                website_url = COALESCE($5, website_url),
                public_email = COALESCE($6, public_email),
                social_links = COALESCE($7::jsonb, social_links),
                updated_at = NOW()
             WHERE id = $8
             RETURNING *;`,
            [
                shortDescription !== undefined ? shortDescription : null,
                about !== undefined ? about : null,
                logoUrl !== undefined ? logoUrl : null,
                coverImageUrl !== undefined ? coverImageUrl : null,
                websiteUrl !== undefined ? websiteUrl : null,
                publicEmail !== undefined ? publicEmail : null,
                socialLinks !== undefined ? JSON.stringify(socialLinks) : null,
                clubId,
            ]
        );

        return res.json({
            success: true,
            message: "Club profile updated successfully.",
            club: updateRes.rows[0],
        });
    } catch (err: any) {
        console.error("Update club profile error:", err);
        return res.status(500).json({ success: false, message: "Failed to update club profile." });
    }
});

/**
 * GET /api/club/events
 * Authenticated endpoint for the club to fetch all its events (draft, published, cancelled).
 */
clubRouter.get("/events", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        if (!clubRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }

        const eventsRes = await query(
            `SELECT
                id,
                club_id AS "clubId",
                title,
                slug,
                summary,
                description,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                location_type AS "locationType",
                venue_or_location AS "venueOrLocation",
                registration_url AS "registrationUrl",
                cover_image_url AS "coverImageUrl",
                status,
                published_at AS "publishedAt",
                created_at AS "createdAt",
                updated_at AS "updatedAt"
             FROM club_events
             WHERE club_id = $1
             ORDER BY starts_at ASC;`,
            [clubRes.rows[0].id]
        );

        return res.json({
            success: true,
            events: eventsRes.rows,
        });
    } catch (err: any) {
        console.error("Get club events error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve club events." });
    }
});

/**
 * POST /api/club/events
 * Creates a new event for the authenticated club.
 */
clubRouter.post("/events", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        if (!clubRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }
        const clubId = clubRes.rows[0].id;

        const {
            title,
            summary,
            description,
            startsAt,
            endsAt,
            timezone = "Asia/Kolkata",
            locationType = "in_person",
            venueOrLocation,
            registrationUrl,
            coverImageUrl,
            status = "draft",
        } = req.body;

        if (!title || typeof title !== "string" || title.trim().length < 3) {
            return res.status(400).json({ success: false, message: "Event title must be at least 3 characters." });
        }

        if (!startsAt || isNaN(Date.parse(startsAt))) {
            return res.status(400).json({ success: false, message: "Valid startsAt ISO timestamp is required." });
        }

        if (endsAt && Date.parse(endsAt) < Date.parse(startsAt)) {
            return res.status(400).json({ success: false, message: "endsAt cannot be earlier than startsAt." });
        }

        let baseSlug = generateSlug(title);
        if (!baseSlug) baseSlug = "event";
        let candidateSlug = baseSlug;
        let counter = 1;
        while (true) {
            const check = await query(
                `SELECT id FROM club_events WHERE club_id = $1 AND slug = $2 LIMIT 1;`,
                [clubId, candidateSlug]
            );
            if (!check.rows[0]) break;
            counter++;
            candidateSlug = `${baseSlug}-${counter}`;
        }

        const isPublished = status === "published";
        const publishedAt = isPublished ? new Date().toISOString() : null;

        const insertRes = await query(
            `INSERT INTO club_events (
                club_id,
                title,
                slug,
                summary,
                description,
                starts_at,
                ends_at,
                timezone,
                location_type,
                venue_or_location,
                registration_url,
                cover_image_url,
                status,
                published_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
            RETURNING
                id,
                club_id AS "clubId",
                title,
                slug,
                summary,
                description,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                location_type AS "locationType",
                venue_or_location AS "venueOrLocation",
                registration_url AS "registrationUrl",
                cover_image_url AS "coverImageUrl",
                status,
                published_at AS "publishedAt",
                created_at AS "createdAt";`,
            [
                clubId,
                title.trim(),
                candidateSlug,
                summary || null,
                description || null,
                new Date(startsAt).toISOString(),
                endsAt ? new Date(endsAt).toISOString() : null,
                timezone,
                locationType,
                venueOrLocation || null,
                registrationUrl || null,
                coverImageUrl || null,
                status,
                publishedAt,
            ]
        );

        return res.status(201).json({
            success: true,
            message: `Event ${isPublished ? "published" : "created as draft"} successfully.`,
            event: insertRes.rows[0],
        });
    } catch (err: any) {
        console.error("Create event error:", err);
        return res.status(500).json({ success: false, message: "Failed to create event." });
    }
});

/**
 * PATCH /api/club/events/:eventId
 * Updates an event belonging to the authenticated club.
 */
clubRouter.patch("/events/:eventId", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { eventId } = req.params;

        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        if (!clubRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }
        const clubId = clubRes.rows[0].id;

        // Verify event belongs to this club
        const existingEvent = await query(
            `SELECT * FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [eventId, clubId]
        );
        if (!existingEvent.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found or not owned by this club." });
        }

        const {
            title,
            summary,
            description,
            startsAt,
            endsAt,
            timezone,
            locationType,
            venueOrLocation,
            registrationUrl,
            coverImageUrl,
            status,
        } = req.body;

        const current = existingEvent.rows[0];
        const newStatus = status || current.status;
        let publishedAt = current.published_at;
        if (newStatus === "published" && current.status !== "published") {
            publishedAt = new Date().toISOString();
        }

        const updateRes = await query(
            `UPDATE club_events
             SET
                title = COALESCE($1, title),
                summary = COALESCE($2, summary),
                description = COALESCE($3, description),
                starts_at = COALESCE($4, starts_at),
                ends_at = COALESCE($5, ends_at),
                timezone = COALESCE($6, timezone),
                location_type = COALESCE($7, location_type),
                venue_or_location = COALESCE($8, venue_or_location),
                registration_url = COALESCE($9, registration_url),
                cover_image_url = COALESCE($10, cover_image_url),
                status = COALESCE($11, status),
                published_at = $12,
                updated_at = NOW()
             WHERE id = $13 AND club_id = $14
             RETURNING
                id,
                club_id AS "clubId",
                title,
                slug,
                summary,
                description,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                location_type AS "locationType",
                venue_or_location AS "venueOrLocation",
                registration_url AS "registrationUrl",
                cover_image_url AS "coverImageUrl",
                status,
                published_at AS "publishedAt",
                updated_at AS "updatedAt";`,
            [
                title ? title.trim() : null,
                summary !== undefined ? summary : null,
                description !== undefined ? description : null,
                startsAt ? new Date(startsAt).toISOString() : null,
                endsAt ? new Date(endsAt).toISOString() : null,
                timezone || null,
                locationType || null,
                venueOrLocation !== undefined ? venueOrLocation : null,
                registrationUrl !== undefined ? registrationUrl : null,
                coverImageUrl !== undefined ? coverImageUrl : null,
                status || null,
                publishedAt,
                eventId,
                clubId,
            ]
        );

        return res.json({
            success: true,
            message: "Event updated successfully.",
            event: updateRes.rows[0],
        });
    } catch (err: any) {
        console.error("Update event error:", err);
        return res.status(500).json({ success: false, message: "Failed to update event." });
    }
});

/**
 * DELETE /api/club/events/:eventId
 * Deletes an event belonging to the authenticated club.
 */
clubRouter.delete("/events/:eventId", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        const { eventId } = req.params;

        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        if (!clubRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }

        const deleteRes = await query(
            `DELETE FROM club_events WHERE id = $1 AND club_id = $2 RETURNING id;`,
            [eventId, clubRes.rows[0].id]
        );

        if (!deleteRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found or not owned by this club." });
        }

        return res.json({ success: true, message: "Event deleted successfully." });
    } catch (err: any) {
        console.error("Delete event error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete event." });
    }
});

/**
 * Public Club Profile Endpoint (No login required)
 * GET /public/:slug or GET /:slug
 */
const handleGetPublicClub = async (req: Request, res: Response) => {
    try {
        const { slug } = req.params;
        if (!slug) {
            return res.status(400).json({ success: false, message: "Club slug is required." });
        }

        const clubRes = await query(
            `SELECT
                id,
                name,
                slug,
                category,
                college_name AS "collegeName",
                college_city AS "collegeCity",
                college_state AS "collegeState",
                college_country AS "collegeCountry",
                short_description AS "shortDescription",
                about,
                logo_url AS "logoUrl",
                cover_image_url AS "coverImageUrl",
                website_url AS "websiteUrl",
                public_email AS "publicEmail",
                social_links AS "socialLinks",
                verified_at AS "verifiedAt",
                created_at AS "createdAt"
             FROM verified_clubs
             WHERE LOWER(slug) = LOWER($1) AND is_active = true
             LIMIT 1;`,
            [slug]
        );

        if (!clubRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "Club not found or inactive.",
            });
        }

        const club = clubRes.rows[0];

        // Fetch published events
        const eventsRes = await query(
            `SELECT
                id,
                title,
                slug,
                summary,
                description,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                location_type AS "locationType",
                venue_or_location AS "venueOrLocation",
                registration_url AS "registrationUrl",
                cover_image_url AS "coverImageUrl",
                published_at AS "publishedAt"
             FROM club_events
             WHERE club_id = $1 AND status = 'published'
             ORDER BY starts_at ASC;`,
            [club.id]
        );

        const now = new Date();
        const upcomingEvents = eventsRes.rows.filter((e) => new Date(e.startsAt) >= now);
        const pastEvents = eventsRes.rows.filter((e) => new Date(e.startsAt) < now);

        return res.json({
            success: true,
            club,
            upcomingEvents,
            pastEvents,
            totalEvents: eventsRes.rows.length,
        });
    } catch (err: any) {
        console.error("Public club profile fetch error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve public club profile." });
    }
};

clubRouter.get("/public/:slug", handleGetPublicClub);
clubRouter.get("/:slug", handleGetPublicClub);

export default clubRouter;
