/// <reference path="../../types/express.d.ts" />
import express, { type Request, type Response, type NextFunction } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { pool, query } from "../../database/client.js";
import { authenticate, optionalAuthenticate } from "../../middlewares/auth.middleware.js";
import { userDetailsCache } from "../../redis/cache/cache-auth.js";
import { failsOccursSignup } from "../../redis/rate-limiters/rate-limiters-auth.js";
import ClubRegistrationValidator, {
    type ValidatedClubRegistrationData,
} from "../../validators/ClubRegistrationValidator.js";
import { ValidationError } from "../../validators/SignupValidator.js";
import { EmailVerificationService } from "../../services/email/emailVerificationService.js";
import { PhoneVerificationService } from "../../services/sms/phoneVerificationService.js";
import { normalizePhoneNumber } from "../../services/sms/smsGatewayService.js";
import { enrichUserWithClubData } from "../../services/club/clubEnrichmentService.js";
import {
    getClubModerationState,
    muteUserForClub,
    unmuteUserForClub,
    blockUserForClub,
    unblockUserForClub,
    listModeratedUsers,
} from "../../services/club/clubModerationService.js";
import {
    sendMessageToClub,
    sendClubReply,
    checkClubMessageQuota,
} from "../../services/club/clubInboxService.js";

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
/**
 * Helper to dynamically generate the 5-stage verification timeline directly
 * from the main club_verification_requests table and verified_clubs record.
 * This guarantees the timeline is 100% reactive on every refresh,
 * even when reviewers manually modify the database directly.
 */
export function computeDynamicTimelineEvents(application: any, verifiedClub?: any) {
    if (!application && !verifiedClub) return [];

    const appStatus = application?.status || (verifiedClub ? "approved" : "pending");
    const submittedAt = application?.submitted_at || application?.created_at || new Date().toISOString();
    const reviewedAt = application?.reviewed_at || application?.updated_at || submittedAt;
    const clubName = application?.club_name || verifiedClub?.name || "your club";
    const collegeName = application?.college_name || verifiedClub?.college_name || "your college";

    // 1. Stage: application_submitted
    const stage1 = {
        id: "stage-1",
        stage: "application_submitted",
        status: "completed" as const,
        title: "Application submitted",
        message: `Your verification application for ${clubName} was received.`,
        actionRequired: null,
        createdAt: submittedAt,
    };

    // 2. Stage: initial_review
    const isPending = appStatus === "pending";
    const stage2 = {
        id: "stage-2",
        stage: "initial_review",
        status: (isPending ? "in_progress" : "completed") as "completed" | "in_progress",
        title: isPending ? "Initial review" : "Initial review completed",
        message: isPending
            ? "Orbix is reviewing the submitted details and institutional references."
            : "Orbix initial intake check validated.",
        actionRequired: null,
        createdAt: isPending ? submittedAt : reviewedAt,
    };

    // 3. Stage: college_verification
    let stage3Status: "completed" | "in_progress" | "upcoming" | "action_required" | "rejected" = "upcoming";
    let stage3Title = "College verification";
    let stage3Message = "The college and representative credentials will be checked.";
    let stage3Action: string | null = null;

    const collegeContactStatus = application?.college_contact_status || "not_started";
    const isContactConfirmed = collegeContactStatus === "confirmed";
    const allChecksConfirmed =
        isContactConfirmed &&
        application?.club_existence_confirmed &&
        application?.college_authorization_confirmed &&
        application?.representative_authority_confirmed;

    if (appStatus === "pending") {
        stage3Status = "upcoming";
        stage3Title = "College verification";
        stage3Message = "The college and representative credentials will be checked.";
    } else if (["approved", "ready_for_promotion"].includes(appStatus) || verifiedClub || allChecksConfirmed) {
        stage3Status = "completed";
        stage3Title = "College verification completed";
        stage3Message = `Institution recognition, club existence, and representative authority confirmed for ${collegeName}.`;
    } else if (appStatus === "needs_information") {
        stage3Status = "action_required";
        stage3Title = "Action Required: Additional Details Needed";
        stage3Message = application?.internal_notes || "Please check your contact email and provide the requested verification materials.";
        stage3Action = "Provide requested institutional documents or credentials";
    } else if (appStatus === "rejected") {
        stage3Status = "rejected";
        stage3Title = "College verification criteria unmet";
        stage3Message = application?.internal_notes || "Could not verify institutional affiliation or representative credentials.";
    } else if (appStatus === "under_review") {
        stage3Status = "in_progress";
        stage3Title = "College verification in progress";
        stage3Message = collegeContactStatus === "contacted"
            ? "Outreach initiated with institution administration or faculty advisor."
            : "Reviewing college directory recognition and campus presence.";
    }

    const stage3 = {
        id: "stage-3",
        stage: "college_verification",
        status: stage3Status,
        title: stage3Title,
        message: stage3Message,
        actionRequired: stage3Action,
        createdAt: application?.last_college_contacted_at || reviewedAt,
    };

    // 4. Stage: verification_decision
    let stage4Status: "completed" | "in_progress" | "upcoming" | "action_required" | "rejected" = "upcoming";
    let stage4Title = "Verification decision";
    let stage4Message = "Approval, additional information, or rejection.";
    let stage4Action: string | null = null;

    if (["approved", "ready_for_promotion"].includes(appStatus) || verifiedClub) {
        stage4Status = "completed";
        stage4Title = "Verification decision: Approved";
        stage4Message = "Application verified and approved by Orbix reviewer.";
    } else if (appStatus === "rejected") {
        stage4Status = "rejected";
        stage4Title = "Verification decision: Not Approved";
        stage4Message = application?.internal_notes || "Application could not be approved under current standards.";
    } else if (appStatus === "needs_information") {
        stage4Status = "action_required";
        stage4Title = "Verification decision: Information Required";
        stage4Message = "Reviewer is awaiting clarifying documents or credentials before deciding.";
        stage4Action = "Respond to verification inquiry";
    }

    const stage4 = {
        id: "stage-4",
        stage: "verification_decision",
        status: stage4Status,
        title: stage4Title,
        message: stage4Message,
        actionRequired: stage4Action,
        createdAt: reviewedAt,
    };

    // 5. Stage: club_activated
    let stage5Status: "completed" | "in_progress" | "upcoming" = "upcoming";
    let stage5Title = "Club access activated";
    let stage5Message = "Your dedicated club dashboard becomes available once approved.";

    if (appStatus === "approved" || verifiedClub) {
        stage5Status = "completed";
        stage5Title = "Club access activated";
        stage5Message = "Your dedicated club dashboard and public profile are now live.";
    } else if (appStatus === "ready_for_promotion") {
        stage5Status = "in_progress";
        stage5Title = "Activating club access";
        stage5Message = "Club credentials approved. Activation is in progress.";
    }

    const stage5 = {
        id: "stage-5",
        stage: "club_activated",
        status: stage5Status,
        title: stage5Title,
        message: stage5Message,
        actionRequired: null,
        createdAt: verifiedClub?.verified_at || reviewedAt,
    };

    return [stage1, stage2, stage3, stage4, stage5];
}

export async function recordTimelineEvent(_params: any) {
    // No-op: timeline is now derived dynamically from club_verification_requests and verified_clubs
}

/**
 * Server-side reviewer allowlist.
 * Explicitly configured in the trusted server-side environment.
 */
export const getReviewerAllowlist = (): string[] => {
    const raw =
        process.env.ORBIX_REVIEWER_EMAILS ||
        "admin@orbix.dev,staff@orbix.dev,reviewer@orbix.dev";
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
 * POST /api/club/verify/send-email-otp
 * Dispatches an email verification OTP code to the applicant's primary email.
 */
/**
 * GET /api/club/check-availability
 * Checks whether a username, email, or mobile phone number is available for registration.
 * Handles both guest applicants and authenticated users registering a club under their existing account.
 */
clubRouter.get("/check-availability", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const username = typeof req.query.username === "string" ? req.query.username.trim().toLowerCase() : null;
        const email = typeof req.query.email === "string" ? req.query.email.trim().toLowerCase() : null;
        const rawPhone = typeof req.query.phone === "string" ? req.query.phone.trim() : null;

        if (!username && !email && !rawPhone) {
            return res.status(400).json({ success: false, message: "Provide username, email, or phone to check availability." });
        }

        const callerUserId = req.user?.id;
        const callerEmail = req.user?.gmail?.toLowerCase() || req.user?.email?.toLowerCase();
        const callerUsername = req.user?.username?.toLowerCase();

        if (username) {
            if (!/^[a-z0-9._-]{3,20}$/.test(username)) {
                return res.json({
                    success: true,
                    available: false,
                    field: "username",
                    message: "Username must be 3-20 characters: lowercase letters, numbers, dot, _, or -."
                });
            }
            if (callerUsername && callerUsername === username) {
                // Caller's own username is valid for club registration under their account
            } else {
                const userRes = await query(`SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`, [username]);
                if (userRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: false,
                        field: "username",
                        message: "This username is already taken. Please choose another."
                    });
                }
            }
        }

        if (email) {
            if (callerEmail && callerEmail === email) {
                // Caller is registering a club using their signed-in account email.
                // Check if they already hold an active club application or verified club.
                const existingAppRes = await query(
                    `SELECT id, club_name, status FROM club_verification_requests 
                     WHERE auth_user_id = $1 
                       AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                     LIMIT 1;`,
                    [callerUserId]
                );
                if (existingAppRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: false,
                        field: "email",
                        message: `You already have an active club registration application for "${existingAppRes.rows[0].club_name}" (${existingAppRes.rows[0].status}).`
                    });
                }

                const existingClubRes = await query(
                    `SELECT id, name FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
                    [callerUserId]
                );
                if (existingClubRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: false,
                        field: "email",
                        message: `You already lead the verified club "${existingClubRes.rows[0].name}".`
                    });
                }
            } else {
                const emailRes = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`, [email]);
                if (emailRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: false,
                        field: "email",
                        message: "An account with this email address is already registered. Please sign in to register your club under this account."
                    });
                }
                const appRes = await query(
                    `SELECT id FROM club_verification_requests 
                     WHERE LOWER(contact_email) = LOWER($1) 
                       AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                     LIMIT 1;`,
                    [email]
                );
                if (appRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: false,
                        field: "email",
                        message: "An active club verification application already exists for this email address."
                    });
                }
            }
        }

        if (rawPhone) {
            const norm = normalizePhoneNumber(rawPhone);
            if (!norm.isValid) {
                return res.json({
                    success: true,
                    available: false,
                    field: "phone",
                    message: "Please enter a valid 10-digit mobile phone number format."
                });
            }
            const canonicalPhone = norm.canonical;

            // Check users
            const userPhoneRes = await query(
                `SELECT id FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) LIMIT 1;`,
                [canonicalPhone]
            );
            if (userPhoneRes.rows[0] && (!callerUserId || userPhoneRes.rows[0].id !== callerUserId)) {
                return res.json({
                    success: true,
                    available: false,
                    field: "phone",
                    message: "This mobile phone number is already registered to another Orbix account."
                });
            }

            // Check club_verification_requests
            const appPhoneRes = await query(
                `SELECT id, auth_user_id FROM club_verification_requests 
                 WHERE LOWER(TRIM(contact_phone)) = LOWER(TRIM($1)) 
                   AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                 LIMIT 1;`,
                [canonicalPhone]
            );
            if (appPhoneRes.rows[0] && (!callerUserId || appPhoneRes.rows[0].auth_user_id !== callerUserId)) {
                return res.json({
                    success: true,
                    available: false,
                    field: "phone",
                    message: "This mobile phone number is already associated with an active club verification application."
                });
            }

            // Check verified_clubs
            const clubPhoneRes = await query(
                `SELECT id, auth_user_id FROM verified_clubs 
                 WHERE LOWER(TRIM(contact_phone)) = LOWER(TRIM($1)) 
                 LIMIT 1;`,
                [canonicalPhone]
            );
            if (clubPhoneRes.rows[0] && (!callerUserId || clubPhoneRes.rows[0].auth_user_id !== callerUserId)) {
                return res.json({
                    success: true,
                    available: false,
                    field: "phone",
                    message: "This mobile phone number is already associated with a verified club."
                });
            }
        }

        return res.json({
            success: true,
            available: true,
            message: "Available for registration."
        });
    } catch (err: any) {
        console.error("Check availability error:", err);
        return res.status(500).json({ success: false, message: "Error checking availability." });
    }
});

/**
 * POST /api/club/verify/send-email-otp
 * Dispatches an email verification OTP code to the applicant's primary email.
 * Allows authenticated users registering a club under their existing account.
 */
clubRouter.post("/verify/send-email-otp", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const rawEmail = req.body?.email;
        const name = req.body?.name || "Club Representative";
        const rawUsername = req.body?.username;

        if (!rawEmail || typeof rawEmail !== "string") {
            return res.status(400).json({ success: false, message: "A valid primary email address is required." });
        }

        const normalizedEmail = rawEmail.trim().toLowerCase();
        const callerUserId = req.user?.id;
        const callerEmail = req.user?.gmail?.toLowerCase() || req.user?.email?.toLowerCase();

        // 1. Pre-check email uniqueness
        if (callerEmail && callerEmail === normalizedEmail) {
            // Caller is authenticated using their own email.
            // Ensure they don't already have an active application or verified club.
            const existingAppRes = await query(
                `SELECT id, club_name, status FROM club_verification_requests 
                 WHERE auth_user_id = $1 
                   AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                 LIMIT 1;`,
                [callerUserId]
            );
            if (existingAppRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: `You already have an active club registration application for "${existingAppRes.rows[0].club_name}" (${existingAppRes.rows[0].status}).`,
                });
            }

            const existingClubRes = await query(
                `SELECT id, name FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
                [callerUserId]
            );
            if (existingClubRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: `You already lead the verified club "${existingClubRes.rows[0].name}".`,
                });
            }
        } else {
            // Unauthenticated guest registration
            const existingEmailRes = await query(
                `SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
                [normalizedEmail]
            );
            if (existingEmailRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: "An account with this email address already exists. Please sign in to register your club under this account.",
                });
            }

            const existingAppRes = await query(
                `SELECT id FROM club_verification_requests 
                 WHERE LOWER(contact_email) = LOWER($1) 
                   AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                 LIMIT 1;`,
                [normalizedEmail]
            );
            if (existingAppRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: "An active club verification application already exists for this email address. Please sign in to check status.",
                });
            }

            const existingClubRes = await query(
                `SELECT id FROM verified_clubs WHERE LOWER(contact_email) = LOWER($1) LIMIT 1;`,
                [normalizedEmail]
            );
            if (existingClubRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: "A verified club already exists with this email address.",
                });
            }
        }

        // 2. Pre-check username uniqueness if provided and not owned by caller
        if (rawUsername && typeof rawUsername === "string") {
            const normalizedUsername = rawUsername.trim().toLowerCase();
            const callerUsername = req.user?.username?.toLowerCase();
            if (!callerUsername || callerUsername !== normalizedUsername) {
                const existingUsernameRes = await query(
                    `SELECT id FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                    [normalizedUsername]
                );
                if (existingUsernameRes.rows[0]) {
                    return res.status(409).json({
                        success: false,
                        message: "This username is already taken. Please choose another username.",
                    });
                }
            }
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await EmailVerificationService.sendPreRegistrationOtp({
            email: normalizedEmail,
            name,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send email verification code",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/club/verify/verify-email-otp
 * Verifies the 6-digit email OTP and returns a cryptographically signed proof token.
 */
clubRouter.post("/verify/verify-email-otp", async (req: Request, res: Response) => {
    try {
        const { email, otp } = req.body;
        if (!email || typeof email !== "string") {
            return res.status(400).json({ success: false, message: "Email is required." });
        }
        if (!otp || typeof otp !== "string") {
            return res.status(400).json({ success: false, message: "6-digit verification code is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const result = await EmailVerificationService.verifyPreRegistrationOtp({
            email,
            otp,
            ipAddress: ip,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Email verification failed",
        });
    }
});

/**
 * POST /api/club/verify/send-phone-otp
 * Dispatches an SMS verification OTP code to the applicant's primary mobile phone.
 * Pre-checks that the mobile phone number is unique before expending SMS resources.
 */
clubRouter.post("/verify/send-phone-otp", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const phone = req.body?.phone;
        const clubName = req.body?.clubName || "Orbix Club";

        if (!phone || typeof phone !== "string") {
            return res.status(400).json({ success: false, message: "Primary mobile phone number is required." });
        }

        const callerUserId = req.user?.id;
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const result = await PhoneVerificationService.sendOtp({
            phone,
            clubName,
            userId: callerUserId,
            ipAddress: ip,
            userAgent,
        });

        return res.status(200).json(result);
    } catch (err: any) {
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Failed to send SMS verification code",
            cooldownRemainingSeconds: err.cooldownRemainingSeconds || 0,
        });
    }
});

/**
 * POST /api/club/verify/verify-phone-otp
 * POST /api/club/verify/verify-phone-firebase
 * Verifies mobile phone authentication via Firebase ID Token (or legacy 6-digit OTP in test simulation)
 * and returns a cryptographically signed continuation proof token for registration.
 */
const handleVerifyPhoneRequest = async (req: Request, res: Response) => {
    try {
        const { phone, otp, idToken } = req.body;
        if (!phone || typeof phone !== "string") {
            return res.status(400).json({ success: false, message: "Phone number is required." });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        // 1. Firebase Phone Authentication flow (primary)
        if (idToken && typeof idToken === "string") {
            const result = await PhoneVerificationService.verifyFirebasePhoneAssociation({
                idToken,
                expectedPhone: phone,
                userId: req.user?.id,
                ipAddress: ip,
                userAgent,
            });
            return res.status(200).json(result);
        }

        // 2. Legacy / Simulation OTP fallback (for test suite)
        if (otp && typeof otp === "string") {
            const result = await PhoneVerificationService.verifyOtp({
                phone,
                otp,
                ipAddress: ip,
            });
            return res.status(200).json(result);
        }

        return res.status(400).json({
            success: false,
            message: "Firebase ID token or verification code is required.",
        });
    } catch (err: any) {
        const statusCode = err.statusCode || 400;
        return res.status(statusCode).json({
            success: false,
            message: err.message || "Phone verification failed",
        });
    }
};

clubRouter.post("/verify/verify-phone-otp", handleVerifyPhoneRequest);
clubRouter.post("/verify/verify-phone-firebase", handleVerifyPhoneRequest);

/**
 * POST /api/club/register
 * Registers a new club application.
 * Supports both:
 * 1. Authenticated users registering a club under their existing email account.
 * 2. Unauthenticated guest applicants creating a new account alongside the club application.
 */
clubRouter.post("/register", optionalAuthenticate, async (req: Request, res: Response) => {
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

        const isExistingUser = Boolean(req.user);

        // Validate complete club registration payload (password optional if already authenticated)
        const validated: ValidatedClubRegistrationData = ClubRegistrationValidator(req.body, { isExistingUser });

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

        // 2. Branch: Authenticated existing user vs. Unauthenticated guest registration
        if (isExistingUser && req.user) {
            const authUserId = req.user.id;

            // 2a. Check if existing user already has an active application or verified club
            const existingActiveReq = await query(
                `SELECT id, club_name, status FROM club_verification_requests 
                 WHERE auth_user_id = $1 
                   AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion')
                 LIMIT 1;`,
                [authUserId]
            );
            if (existingActiveReq.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: `You already have an active club registration application for "${existingActiveReq.rows[0].club_name}" (${existingActiveReq.rows[0].status}). Please check status instead.`,
                });
            }

            const existingClub = await query(
                `SELECT id, name FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
                [authUserId]
            );
            if (existingClub.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: `You already lead the verified club "${existingClub.rows[0].name}".`,
                });
            }

            // 2b. If contactEmail is different from account email, ensure it's not taken by another user
            if (req.user.gmail.toLowerCase() !== validated.contactEmail.toLowerCase()) {
                const emailCheck = await query(
                    `SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1;`,
                    [validated.contactEmail, authUserId]
                );
                if (emailCheck.rows[0]) {
                    return res.status(409).json({
                        success: false,
                        message: "The contact email address is already registered to another Orbix account.",
                    });
                }
            }

            // 2c. Enforce phone uniqueness against other accounts
            if (validated.contactPhone) {
                const normPhone = normalizePhoneNumber(validated.contactPhone);
                const canonicalPhone = normPhone.isValid ? normPhone.canonical : validated.contactPhone.trim();

                const existingPhoneRes = await query(
                    `SELECT id FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1;`,
                    [canonicalPhone, authUserId]
                );
                if (existingPhoneRes.rows[0]) {
                    return res.status(409).json({
                        success: false,
                        message: "This mobile phone number is already registered to another Orbix account.",
                    });
                }

                const existingAppPhone = await query(
                    `SELECT id FROM club_verification_requests 
                     WHERE LOWER(TRIM(contact_phone)) = LOWER(TRIM($1)) AND auth_user_id != $2 
                       AND status IN ('pending', 'under_review', 'needs_information', 'ready_for_promotion') 
                     LIMIT 1;`,
                    [canonicalPhone, authUserId]
                );
                if (existingAppPhone.rows[0]) {
                    return res.status(409).json({
                        success: false,
                        message: "This mobile phone number is already associated with an active club verification application.",
                    });
                }
            }

            // 2d. Verify Email & Phone proof tokens
            let isEmailVerified = Boolean(
                req.user.isEmailVerified &&
                req.user.gmail.toLowerCase() === validated.contactEmail.toLowerCase()
            );
            let isPhoneVerified = false;

            if (validated.emailVerificationToken) {
                const validEmail = EmailVerificationService.verifyVerificationToken(
                    validated.emailVerificationToken,
                    validated.contactEmail
                );
                if (!validEmail) {
                    return res.status(400).json({
                        success: false,
                        message: "Email verification proof is invalid or has expired. Please verify your email again.",
                    });
                }
                isEmailVerified = true;
            }

            if (validated.phoneVerificationToken) {
                const validPhone = PhoneVerificationService.verifyVerificationToken(
                    validated.phoneVerificationToken,
                    validated.contactPhone
                );
                if (!validPhone) {
                    return res.status(400).json({
                        success: false,
                        message: "Phone verification proof is invalid or has expired. Please verify your phone number again.",
                    });
                }
                isPhoneVerified = true;
            }

            if (isProduction && (!isEmailVerified || !isPhoneVerified)) {
                return res.status(400).json({
                    success: false,
                    message: "Both primary email and primary mobile number must be verified before completing club registration.",
                });
            }

            const verificationTimestamp = new Date();

            // 2e. Update user's phone and college if applicable
            await query(
                `UPDATE users
                 SET 
                     phone = COALESCE($2, phone),
                     is_phone_verified = true,
                     phone_verified_at = COALESCE(phone_verified_at, $3),
                     phone_confirmed_at = COALESCE(phone_confirmed_at, $3),
                     college_id = COALESCE(college_id, $4)
                 WHERE id = $1;`,
                [
                    authUserId,
                    validated.contactPhone || null,
                    verificationTimestamp,
                    authoritativeCollegeId,
                ]
            );

            // 2f. Insert into public.club_verification_requests
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
                    is_email_verified,
                    is_phone_verified,
                    phone_verified_at,
                    status
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                    $11, $12, $13, $14, $15, $16, $17, $18, 'v1.0', $19, 'v1.0',
                    $20, $21, $22, 'pending'
                )
                RETURNING id, club_name, status, submitted_at, is_email_verified AS "isEmailVerified", is_phone_verified AS "isPhoneVerified";`,
                [
                    authUserId,
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
                    isEmailVerified,
                    isPhoneVerified,
                    isPhoneVerified ? verificationTimestamp : null,
                ]
            );
            const createdRequest = requestInsertRes.rows[0];

            // 2g. Timeline is computed dynamically on refresh from club_verification_requests

            // 2h. Fetch fresh user record and enrich with club details
            const userRes = await query(
                `SELECT id, username, firstname AS "firstName", lastname AS "lastName", email AS gmail, account_type AS "accountType", avatar_url AS "avatarUrl", college_id AS "collegeId", phone, is_email_verified AS "isEmailVerified", is_phone_verified AS "isPhoneVerified"
                 FROM users WHERE id = $1 LIMIT 1;`,
                [authUserId]
            );
            const userObj = userRes.rows[0] || {
                id: authUserId,
                username: req.user.username,
                firstName: req.user.firstName,
                lastName: req.user.lastName,
                gmail: req.user.gmail,
                accountType: req.user.accountType,
            };

            await enrichUserWithClubData(userObj, authUserId);

            return res.status(201).json({
                success: true,
                message: "Club registration submitted for verification successfully.",
                user: userObj,
                request: {
                    id: createdRequest.id,
                    clubName: createdRequest.club_name,
                    status: createdRequest.status,
                    submittedAt: createdRequest.submitted_at,
                },
            });
        }

        // =====================================================================
        // 3. Unauthenticated guest applicant registration
        // =====================================================================

        // Check if user already exists
        const existingUserRes = await query(
            `SELECT id FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1;`,
            [validated.contactEmail, validated.username]
        );
        if (existingUserRes.rows[0]) {
            return res.status(409).json({
                success: false,
                message: "An account with this email address or username is already registered. Please sign in to register your club under this account.",
            });
        }

        // Check if active verification request exists for this email
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

        // Enforce phone uniqueness: prevent duplicate phone accounts
        if (validated.contactPhone) {
            const existingPhoneRes = await query(
                `SELECT id FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) LIMIT 1;`,
                [validated.contactPhone]
            );
            if (existingPhoneRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: "This mobile phone number is already registered to another Orbix account.",
                });
            }
        }

        // Verify Email & Phone proof tokens
        let isEmailVerified = false;
        let isPhoneVerified = false;

        if (validated.emailVerificationToken) {
            const validEmail = EmailVerificationService.verifyVerificationToken(
                validated.emailVerificationToken,
                validated.contactEmail
            );
            if (!validEmail) {
                return res.status(400).json({
                    success: false,
                    message: "Email verification proof is invalid or has expired. Please verify your email again.",
                });
            }
            isEmailVerified = true;
        }

        if (validated.phoneVerificationToken) {
            const validPhone = PhoneVerificationService.verifyVerificationToken(
                validated.phoneVerificationToken,
                validated.contactPhone
            );
            if (!validPhone) {
                return res.status(400).json({
                    success: false,
                    message: "Phone verification proof is invalid or has expired. Please verify your phone number again.",
                });
            }
            isPhoneVerified = true;
        }

        // In production, enforce dual email & phone verification
        if (isProduction && (!isEmailVerified || !isPhoneVerified)) {
            return res.status(400).json({
                success: false,
                message: "Both primary email and primary mobile number must be verified before completing club registration.",
            });
        }

        const verificationTimestamp = new Date();

        // Hash password
        const hashedPassword = await bcrypt.hash(validated.password || "TempPassword123!", 10);
        const newUserId = crypto.randomUUID();

        // Split representative full name into firstName and lastName for users table
        const nameParts = validated.contactPersonName.split(" ").filter(Boolean);
        const firstName = nameParts[0] || validated.contactPersonName;
        const lastName = nameParts.slice(1).join(" ") || "Representative";

        // Insert into auth.users (Supabase Auth table)
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
                        phone: validated.contactPhone,
                        is_email_verified: isEmailVerified,
                        is_phone_verified: isPhoneVerified,
                    }),
                ]
            );
        } catch (authErr: any) {
            console.warn("Notice: auth.users sync note:", authErr.message || authErr);
        }

        // Insert into public.users with account_type = 'club' and verified college_id
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
                college_id,
                phone,
                is_email_verified,
                email_verified_at,
                is_phone_verified,
                phone_verified_at,
                phone_confirmed_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'club', $8, $9, $10, $11, $12, $13, $14, $15)
            RETURNING id, username, email AS gmail, firstname AS "firstName", lastname AS "lastName", account_type AS "accountType", avatar_url AS "avatarUrl", college_id AS "collegeId", phone, is_email_verified AS "isEmailVerified", is_phone_verified AS "isPhoneVerified";`,
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
                validated.contactPhone,
                isEmailVerified,
                isEmailVerified ? verificationTimestamp : null,
                isPhoneVerified,
                isPhoneVerified ? verificationTimestamp : null,
                isPhoneVerified ? verificationTimestamp : null,
            ]
        );
        const createdUser = userInsertRes.rows[0];

        // Insert into public.club_verification_requests with verified college details
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
                is_email_verified,
                is_phone_verified,
                phone_verified_at,
                status
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, 'v1.0', $19, 'v1.0',
                $20, $21, $22, 'pending'
            )
            RETURNING id, club_name, status, submitted_at, is_email_verified AS "isEmailVerified", is_phone_verified AS "isPhoneVerified";`,
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
                isEmailVerified,
                isPhoneVerified,
                isPhoneVerified ? verificationTimestamp : null,
            ]
        );
        const createdRequest = requestInsertRes.rows[0];

        // Timeline is computed dynamically on refresh from club_verification_requests

        // Generate JWT session tokens with accountType = 'club'
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

        // Cache in Redis
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

        const safeNewUser: any = {
            id: newUserId,
            username: validated.username,
            firstName,
            lastName,
            gmail: validated.contactEmail,
            accountType: "club",
        };
        await enrichUserWithClubData(safeNewUser, newUserId);

        return res.status(201).json({
            success: true,
            message: "Club registration submitted for verification successfully.",
            token,
            user: safeNewUser,
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
            `SELECT vc.id, vc.name, COALESCE(u.username, vc.slug) AS slug, u.username AS "clubUsername", vc.category, vc.college_name, vc.college_city, vc.college_state, vc.college_country, vc.logo_url, vc.is_active, vc.verified_at
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE vc.auth_user_id = $1 LIMIT 1;`,
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

        // Compute dynamic 5-stage timeline directly from current application & club status
        const timelineEvents = computeDynamicTimelineEvents(application, verifiedClub);

        // If club is verified, return isVerified: true and dashboard redirect info
        if (verifiedClub) {
            return res.json({
                success: true,
                isVerified: true,
                verifiedClub,
                application: application ? { ...application, status: "approved" } : { status: "approved", club_name: verifiedClub.name },
                timelineEvents,
            });
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

            const timelineEvents = computeDynamicTimelineEvents(result.rows[0]);

            return res.json({
                success: true,
                request: result.rows[0],
                timelineEvents,
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

        // 4. Generate unique readable slug from the registered club username (preferred)
        const clubUserRes = await client.query(
            `SELECT username FROM users WHERE id = $1 LIMIT 1;`,
            [app.auth_user_id]
        );
        const clubUsername = clubUserRes.rows[0]?.username;
        let baseSlug = clubUsername ? generateSlug(clubUsername) : generateSlug(app.club_name);
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

        // 6. Transition request to 'approved' and associate verified_club_id
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
            `SELECT vc.id, vc.name, COALESCE(u.username, vc.slug) AS slug, u.username AS "clubUsername", vc.category, vc.college_name, vc.college_city, vc.college_state, vc.college_country, vc.logo_url, vc.is_active, vc.verified_at
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE vc.auth_user_id = $1 LIMIT 1;`,
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
            `SELECT vc.*, COALESCE(u.username, vc.slug) AS slug, u.username AS "clubUsername"
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE vc.auth_user_id = $1 LIMIT 1;`,
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
                vc.id,
                vc.name,
                COALESCE(u.username, vc.slug) AS slug,
                u.username AS "clubUsername",
                vc.category,
                vc.college_name AS "collegeName",
                vc.college_city AS "collegeCity",
                vc.college_state AS "collegeState",
                vc.college_country AS "collegeCountry",
                vc.short_description AS "shortDescription",
                vc.about,
                vc.logo_url AS "logoUrl",
                vc.cover_image_url AS "coverImageUrl",
                vc.website_url AS "websiteUrl",
                vc.public_email AS "publicEmail",
                vc.social_links AS "socialLinks",
                vc.verified_at AS "verifiedAt",
                vc.created_at AS "createdAt"
             FROM verified_clubs vc
             LEFT JOIN users u ON u.id = vc.auth_user_id
             WHERE (LOWER(vc.slug) = LOWER($1) OR LOWER(u.username) = LOWER($1)) AND vc.is_active = true
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
