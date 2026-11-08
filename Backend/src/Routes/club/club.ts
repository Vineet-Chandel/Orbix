/// <reference path="../../types/express.d.ts" />
import express, { type Request, type Response, type NextFunction } from "express";
import crypto from "crypto";
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
import clubTeamRouter from "./clubTeamRoutes.js";
import clubProfileRouter from "./clubProfileRoutes.js";
import clubSettingsRouter from "./clubSettingsRoutes.js";
import { ClubProfileService } from "../../services/club/clubProfileService.js";
import { notifyClubAndCollegeUsers } from "../../services/club/clubEventNotificationService.js";
import { ClubEventFormService } from "../../services/club/clubEventFormService.js";
import { sendGuardianConsentEmail } from "../../services/email/resendService.js";
import { ClubCredibilityService } from "../../services/club/clubCredibilityService.js";
import { ClubCredibilityEngine } from "../../scoring/clubCredibilityEngine.js";

const clubRouter = express.Router();

// Mount dedicated Club Team Management router (/api/club/team)
clubRouter.use("/team", clubTeamRouter);

// Mount dedicated Club Profile Management router (/api/club/profile)
clubRouter.use("/profile", clubProfileRouter);

// Mount dedicated Club Settings Management router (/api/club/settings)
clubRouter.use("/settings", clubSettingsRouter);

// GET /api/club/college-clubs - direct route for campus clubs listing
clubRouter.get("/college-clubs", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const collegeId = (req.query.collegeId as string) || undefined;
        const collegeName = (req.query.collegeName as string) || undefined;
        const clubId = (req.query.clubId as string) || undefined;

        const result = await ClubProfileService.getCollegeClubs(userId, {
            collegeId,
            collegeName,
            clubId,
        });

        return res.json({
            success: true,
            ...result,
        });
    } catch (err: any) {
        console.error("GET /api/club/college-clubs error:", err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve college clubs.",
        });
    }
});

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

    const collegeContactStatus = application?.college_contact_status || "not_started";
    const isContactConfirmed = collegeContactStatus === "confirmed";
    const allChecksConfirmed = Boolean(
        isContactConfirmed &&
        application?.club_existence_confirmed &&
        application?.college_authorization_confirmed &&
        application?.representative_authority_confirmed
    );
    const anyCheckStarted = Boolean(
        application?.club_existence_confirmed ||
        application?.college_authorization_confirmed ||
        application?.representative_authority_confirmed ||
        collegeContactStatus !== "not_started" ||
        application?.reviewed_by ||
        application?.reviewed_at
    );

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
    const isInitialReviewDone = Boolean(
        appStatus !== "pending" ||
        anyCheckStarted ||
        allChecksConfirmed ||
        verifiedClub
    );
    const stage2 = {
        id: "stage-2",
        stage: "initial_review",
        status: (isInitialReviewDone ? "completed" : "in_progress") as "completed" | "in_progress",
        title: isInitialReviewDone ? "Initial review completed" : "Initial review in progress",
        message: isInitialReviewDone
            ? "Orbix automated intake check validated. Domain and identity verified."
            : "Orbix is reviewing the submitted details and institutional references.",
        actionRequired: null,
        createdAt: isInitialReviewDone ? (application?.updated_at || reviewedAt) : submittedAt,
    };

    // 3. Stage: college_verification
    let stage3Status: "completed" | "in_progress" | "upcoming" | "action_required" | "rejected" = "upcoming";
    let stage3Title = "College verification";
    let stage3Message = "The college and representative credentials will be checked.";
    let stage3Action: string | null = null;

    if (["approved", "ready_for_promotion"].includes(appStatus) || verifiedClub || allChecksConfirmed) {
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
    } else if (anyCheckStarted || appStatus === "under_review") {
        stage3Status = "in_progress";
        stage3Title = "College verification in progress";
        stage3Message = collegeContactStatus === "contacted"
            ? "Outreach initiated with institution administration or faculty advisor."
            : "Active multi-channel investigation in progress with campus leadership.";
    } else {
        stage3Status = "upcoming";
        stage3Title = "College verification";
        stage3Message = "The college and representative credentials will be checked.";
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

    if (["approved"].includes(appStatus) || verifiedClub) {
        stage4Status = "completed";
        stage4Title = "Verification decision: Approved";
        stage4Message = "Application verified and approved by Orbix reviewer.";
    } else if (appStatus === "ready_for_promotion" || allChecksConfirmed) {
        stage4Status = "in_progress";
        stage4Title = "Verification decision: Awaiting Final Promotion";
        stage4Message = "All institutional checks passed. Awaiting final promotion sign-off and access release.";
    } else if (appStatus === "rejected") {
        stage4Status = "rejected";
        stage4Title = "Verification decision: Not Approved";
        stage4Message = application?.internal_notes || "Application could not be approved under current standards.";
    } else if (appStatus === "needs_information") {
        stage4Status = "action_required";
        stage4Title = "Verification decision: Information Required";
        stage4Message = "Reviewer is awaiting clarifying documents or credentials before deciding.";
        stage4Action = "Respond to verification inquiry";
    } else if (stage3Status === "completed") {
        stage4Status = "in_progress";
        stage4Title = "Verification decision: Under Final Review";
        stage4Message = "Reviewer is reviewing final recommendation.";
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
    } else if (appStatus === "ready_for_promotion" || allChecksConfirmed) {
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
                const userRes = await query(`SELECT id, email FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`, [username]);
                if (userRes.rows[0]) {
                    const rowEmail = userRes.rows[0].email?.toLowerCase();
                    const checkEmail = (email || callerEmail || "").toLowerCase();
                    if (checkEmail && rowEmail === checkEmail) {
                        return res.json({
                            success: true,
                            available: true,
                            isExistingAccount: true,
                            field: "username",
                            message: "Username matches your Orbix account."
                        });
                    }
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

                const emailRes = await query(`SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`, [email]);
                if (emailRes.rows[0]) {
                    return res.json({
                        success: true,
                        available: true,
                        isExistingAccount: true,
                        field: "email",
                        message: "Existing Orbix account found. Your club application will be linked to your account."
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
            // Unauthenticated guest registration: ensure no duplicate active application exists
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
                `SELECT id FROM verified_clubs WHERE LOWER(public_email) = LOWER($1) LIMIT 1;`,
                [normalizedEmail]
            );
            if (existingClubRes.rows[0]) {
                return res.status(409).json({
                    success: false,
                    message: "A verified club already exists with this email address.",
                });
            }
        }

        // 2. Pre-check username uniqueness if provided and not owned by caller or this email
        if (rawUsername && typeof rawUsername === "string") {
            const normalizedUsername = rawUsername.trim().toLowerCase();
            const callerUsername = req.user?.username?.toLowerCase();
            if (!callerUsername || callerUsername !== normalizedUsername) {
                const existingUsernameRes = await query(
                    `SELECT id, email FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
                    [normalizedUsername]
                );
                if (existingUsernameRes.rows[0]) {
                    const rowEmail = existingUsernameRes.rows[0].email?.toLowerCase();
                    if (rowEmail !== normalizedEmail) {
                        return res.status(409).json({
                            success: false,
                            message: "This username is already taken. Please choose another username.",
                        });
                    }
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

        // Check if user already exists by email or username
        const userByEmail = await query(
            `SELECT id, password, email, username, firstname, lastname, account_type FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1;`,
            [validated.contactEmail]
        );
        const userByUsername = await query(
            `SELECT id, password, email, username, firstname, lastname, account_type FROM users WHERE LOWER(username) = LOWER($1) LIMIT 1;`,
            [validated.username]
        );

        let effectiveUserId = "";
        let existingUserObj: any = null;

        if (userByEmail.rows[0]) {
            const exUser = userByEmail.rows[0];

            // If username is taken by another account
            if (userByUsername.rows[0] && userByUsername.rows[0].id !== exUser.id) {
                return res.status(409).json({
                    success: false,
                    message: "This username is already taken by another account. Please choose another username.",
                });
            }

            const passwordToCheck = validated.password;
            if (!passwordToCheck) {
                return res.status(409).json({
                    success: false,
                    isExistingAccount: true,
                    message: "An account with this email address already exists. Please enter your account password to register your club under this account.",
                });
            }

            const isPasswordValid = await bcrypt.compare(passwordToCheck, exUser.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    success: false,
                    message: "Incorrect password for existing account. Please enter your valid account password to register your club.",
                });
            }

            effectiveUserId = exUser.id;
            existingUserObj = {
                id: exUser.id,
                username: exUser.username,
                firstName: exUser.firstname,
                lastName: exUser.lastname,
                gmail: exUser.email,
                accountType: "club",
            };
        } else if (userByUsername.rows[0]) {
            return res.status(409).json({
                success: false,
                message: "This username is already taken. Please choose another username.",
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

        // Enforce phone uniqueness: prevent duplicate phone accounts across different users
        if (validated.contactPhone) {
            const existingPhoneRes = await query(
                `SELECT id FROM users WHERE LOWER(TRIM(phone)) = LOWER(TRIM($1)) AND id != $2 LIMIT 1;`,
                [validated.contactPhone, effectiveUserId || "00000000-0000-0000-0000-000000000000"]
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
        const hashedPassword = await bcrypt.hash(validated.password || "TempPassword123!", 10);

        // Split representative full name into firstName and lastName
        const nameParts = validated.contactPersonName.split(" ").filter(Boolean);
        const firstName = existingUserObj?.firstName || nameParts[0] || validated.contactPersonName;
        const lastName = existingUserObj?.lastName || nameParts.slice(1).join(" ") || "Representative";

        if (!effectiveUserId) {
            // New user registration
            effectiveUserId = crypto.randomUUID();

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
                        effectiveUserId,
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
            await query(
                `INSERT INTO users (
                    id,
                    username,
                    firstname,
                    lastname,
                    email,
                    password,
                    termsaccepted,
                    terms_version,
                    terms_accepted_at,
                    privacy_policy_accepted,
                    privacy_policy_version,
                    privacy_policy_accepted_at,
                    is_age_18_confirmed,
                    age_confirmed_at,
                    account_type,
                    avatar_url,
                    college_id,
                    phone,
                    is_email_verified,
                    email_verified_at,
                    is_phone_verified,
                    phone_verified_at,
                    phone_confirmed_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'v1.0', CURRENT_TIMESTAMP, true, 'v1.0', CURRENT_TIMESTAMP, true, CURRENT_TIMESTAMP, 'club', $8, $9, $10, $11, $12, $13, $14, $15);`,
                [
                    effectiveUserId,
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

            // Audit Trail: Append-only legal consent records for club representative
            try {
                const repUserAgent = (req.headers["user-agent"] as string) || "Unknown User-Agent";
                await query(
                    `INSERT INTO user_legal_consents (user_id, document_type, document_version, action, ip_address, user_agent, metadata)
                     VALUES
                     ($1, 'terms_and_conditions', 'v1.0', 'accepted', $2, $3, $4),
                     ($1, 'privacy_policy', 'v1.0', 'accepted', $2, $3, $4),
                     ($1, 'age_confirmation', 'v1.0', 'accepted', $2, $3, $4);`,
                    [
                        effectiveUserId,
                        ip,
                        repUserAgent,
                        JSON.stringify({ registrationType: "club_representative", clubName: validated.clubName, agreedAt: new Date().toISOString() })
                    ]
                );
            } catch (repConsentErr) {
                console.error("Failed to log club representative legal consents:", repConsentErr);
            }
        } else {
            // Existing user linking: update phone & college
            await query(
                `UPDATE users
                 SET phone = COALESCE($2, phone),
                     is_phone_verified = true,
                     phone_verified_at = COALESCE(phone_verified_at, $3),
                     phone_confirmed_at = COALESCE(phone_confirmed_at, $3),
                     college_id = COALESCE(college_id, $4)
                 WHERE id = $1;`,
                [effectiveUserId, validated.contactPhone || null, verificationTimestamp, authoritativeCollegeId]
            );
        }

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
                effectiveUserId,
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

        const finalSessionEmail = existingUserObj?.gmail || validated.contactEmail;
        const finalSessionUsername = existingUserObj?.username || validated.username;

        // Generate JWT session tokens with accountType = 'club'
        const token = jwt.sign(
            {
                sub: effectiveUserId,
                gmail: finalSessionEmail,
                username: finalSessionUsername,
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
                sub: effectiveUserId,
                gmail: finalSessionEmail,
                username: finalSessionUsername,
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
            id: effectiveUserId,
            firstName,
            middleName: "",
            lastName,
            gmail: finalSessionEmail,
            username: finalSessionUsername,
            password_hash: hashedPassword,
            termsAccepted: true,
            accountType: "club",
            account_type: "club",
        }).catch(() => {});

        const safeNewUser: any = existingUserObj || {
            id: effectiveUserId,
            username: finalSessionUsername,
            firstName,
            lastName,
            gmail: finalSessionEmail,
            accountType: "club",
        };
        await enrichUserWithClubData(safeNewUser, effectiveUserId);

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
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
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
                club_existence_confirmed,
                college_authorization_confirmed,
                representative_authority_confirmed,
                last_college_contacted_at,
                reviewed_by,
                reviewed_at,
                internal_notes,
                submitted_at,
                updated_at,
                verified_club_id,
                college_id,
                is_email_verified,
                is_phone_verified,
                phone_verified_at,
                applicant_user_id
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
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
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
 * Normalizes event location type for DB storage.
 * Maps 'virtual' or 'online' to 'online' (satisfying legacy check constraints)
 * while the SELECT queries map 'online' back to 'virtual' for frontend consumers.
 */
const normalizeLocationTypeForDb = (type?: string): string => {
    if (!type) return "in_person";
    const lower = type.toLowerCase().trim();
    if (lower === "virtual" || lower === "online") return "online";
    if (lower === "hybrid") return "hybrid";
    return "in_person";
};

/**
 * GET /api/club/events
 * Authenticated endpoint for the club to fetch all its events (draft, published, cancelled).
 */
clubRouter.get("/events", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const requestedClubId = (req.query.clubId as string) || undefined;
        let clubId: string | null = null;

        if (userId) {
            const staffClub = await getStaffClub(userId, requestedClubId);
            if (staffClub) {
                clubId = staffClub.id;
            }
        }

        if (!clubId) {
            const clubRes = await query(
                `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
                [userId]
            );
            if (clubRes.rows[0]) {
                clubId = clubRes.rows[0].id;
            }
        }

        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }

        const eventsRes = await query(
            `SELECT
                e.id,
                e.club_id AS "clubId",
                e.title,
                e.slug,
                e.summary,
                e.description,
                COALESCE(e.scope, 'CAMPUS') AS "scope",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.registration_url AS "registrationUrl",
                e.cover_image_url AS "coverImageUrl",
                e.status,
                e.published_at AS "publishedAt",
                e.created_at AS "createdAt",
                e.updated_at AS "updatedAt",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('registered', 'attended')), 0) AS "registrationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'pending'), 0) AS "pendingCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status NOT IN ('cancelled', 'blocked')), 0) AS "totalApplicationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'attended'), 0) AS "attendeesCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('rejected', 'cancelled', 'blocked')), 0) AS "rejectedCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_likes cel WHERE cel.event_id = e.id), 0) AS "likesCount"
             FROM club_events e
             WHERE e.club_id = $1
             ORDER BY e.starts_at ASC;`,
            [clubId]
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
 * GET /api/club/events/creation-eligibility
 * Returns real-time event creation eligibility, cooldowns, and score requirements
 */
clubRouter.get("/events/creation-eligibility", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        let clubId = clubRes.rows[0]?.id;
        if (!clubId) {
            const staffClub = await getStaffClub(userId);
            clubId = staffClub?.id;
        }
        if (!clubId) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }

        const eligibility = await ClubCredibilityService.checkEventCreationEligibility(clubId);
        return res.json({
            success: true,
            eligibility,
        });
    } catch (err: any) {
        console.error("GET /events/creation-eligibility error:", err);
        return res.status(500).json({ success: false, message: "Failed to determine event creation eligibility." });
    }
});

/**
 * GET /api/club/events/:eventId
 * Authenticated endpoint for the club to fetch a specific event they own (draft, published, completed, cancelled).
 * Strictly enforces that ONLY the club that owns the event can access it.
 */
clubRouter.get("/events/:eventId", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }

        let club: any = null;
        if (userId) {
            const staffClub = await getStaffClub(userId);
            if (staffClub) {
                const clubDetails = await query(
                    `SELECT id, name, slug, college_name, college_id, logo_url FROM verified_clubs WHERE id = $1 LIMIT 1;`,
                    [staffClub.id]
                );
                club = clubDetails.rows[0];
            }
        }

        if (!club) {
            const clubRes = await query(
                `SELECT id, name, slug, college_name, college_id, logo_url FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
                [userId]
            );
            club = clubRes.rows[0];
        }

        if (!club) {
            return res.status(403).json({ success: false, message: "Only verified clubs can access this event management page." });
        }

        const eventRes = await query(
            `SELECT
                e.id,
                e.club_id AS "clubId",
                e.title,
                e.slug,
                e.summary,
                e.description,
                COALESCE(e.scope, 'CAMPUS') AS "scope",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.registration_url AS "registrationUrl",
                e.cover_image_url AS "coverImageUrl",
                e.status,
                e.published_at AS "publishedAt",
                e.created_at AS "createdAt",
                e.updated_at AS "updatedAt",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('registered', 'attended')), 0) AS "registrationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'pending'), 0) AS "pendingCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status NOT IN ('cancelled', 'blocked')), 0) AS "totalApplicationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'attended'), 0) AS "attendeesCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('rejected', 'cancelled', 'blocked')), 0) AS "rejectedCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_likes cel WHERE cel.event_id = e.id), 0) AS "likesCount"
             FROM club_events e
             WHERE e.id = $1 AND e.club_id = $2
             LIMIT 1;`,
            [eventId, club.id]
        );

        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found or you do not have permission to access it." });
        }

        return res.json({
            success: true,
            event: eventRes.rows[0],
            club,
        });
    } catch (err: any) {
        console.error("Get single club event error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve event details." });
    }
});

/**
 * POST /api/club/events
 * Creates a new event for the authenticated club.
 */
clubRouter.post("/events", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
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
            scope = "CAMPUS",
            initialFormStructure,
            initialFormSettings,
            initialFormTheme,
        } = req.body;

        const validScopes = ["CAMPUS", "PAN_INDIA"];
        const finalScope = (validScopes.includes(scope) ? scope : "CAMPUS") as "CAMPUS" | "PAN_INDIA";

        // Centralized Credibility Engine check & scope-based cooldown enforcement
        const eligibility = await ClubCredibilityService.checkEventCreationEligibility(clubId);
        const scopeEligibility = finalScope === "PAN_INDIA" ? eligibility.panIndia : eligibility.campus;

        if (!scopeEligibility.eligible) {
            if (!scopeEligibility.scorePassed) {
                return res.status(403).json({
                    success: false,
                    code: "CREDIBILITY_SCORE_TOO_LOW",
                    message: scopeEligibility.reason,
                    currentScore: eligibility.currentScore,
                    requiredScore: scopeEligibility.minScore,
                    scope: finalScope,
                });
            }
            if (scopeEligibility.inCooldown) {
                return res.status(429).json({
                    success: false,
                    code: "EVENT_CREATION_COOLDOWN_ACTIVE",
                    message: scopeEligibility.reason,
                    cooldownExpiresAt: scopeEligibility.cooldownExpiresAt,
                    cooldownRemainingMs: scopeEligibility.cooldownRemainingMs,
                    cooldownDurationHours: scopeEligibility.cooldownDurationHours,
                    scope: finalScope,
                });
            }
        }

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

        const validStatuses = ["draft", "published", "completed", "cancelled"];
        const finalStatus = validStatuses.includes(status) ? status : "draft";
        const isPublished = finalStatus === "published" || finalStatus === "completed";
        const publishedAt = isPublished ? new Date().toISOString() : null;
        const dbLocationType = normalizeLocationTypeForDb(locationType);

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
                scope,
                published_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), NOW())
            RETURNING
                id,
                club_id AS "clubId",
                title,
                slug,
                summary,
                description,
                scope,
                starts_at AS "startsAt",
                ends_at AS "endsAt",
                timezone,
                CASE WHEN location_type = 'online' THEN 'virtual' ELSE location_type END AS "locationType",
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
                dbLocationType,
                venueOrLocation || null,
                registrationUrl || null,
                coverImageUrl || null,
                finalStatus,
                finalScope,
                publishedAt,
            ]
        );

        const newEvent = insertRes.rows[0];

        // Record immutable event creation for persistent cooldown tracking
        await ClubCredibilityService.recordEventCreation(clubId, newEvent.id, finalScope);

        // Save and publish initial registration form configured during 3-step event creation
        if (initialFormStructure && Array.isArray(initialFormStructure?.sections)) {
            try {
                await ClubEventFormService.saveFormDraft(newEvent.id, userId, {
                    structure: initialFormStructure,
                    title: `${title.trim()} Registration`,
                    settings: initialFormSettings || {},
                    themeSettings: initialFormTheme || {},
                });
                if (finalStatus === "published") {
                    await ClubEventFormService.publishForm(newEvent.id, userId, "Initial event publication");
                }
            } catch (formSaveErr) {
                console.error("[POST /events] Error saving initial form structure:", formSaveErr);
            }
        }

        // Notify club staff and college students ONLY AFTER event and registration form are ready
        if (finalStatus === "published") {
            notifyClubAndCollegeUsers(newEvent.id, clubId, "published", userId).catch((err) =>
                console.error("[POST /events] Notification dispatch error:", err)
            );
        }

        return res.status(201).json({
            success: true,
            message: `Event ${isPublished ? "published" : "created"} successfully.`,
            event: {
                ...newEvent,
                registrationsCount: 0,
                attendeesCount: 0,
                rejectedCount: 0,
                likesCount: 0,
            },
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
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }

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
            scope,
        } = req.body;

        const current = existingEvent.rows[0];

        if (scope !== undefined) {
            const validScopes = ["CAMPUS", "PAN_INDIA"];
            if (!validScopes.includes(scope)) {
                return res.status(400).json({ success: false, message: `Invalid scope: ${scope}. Allowed: ${validScopes.join(", ")}` });
            }

            if (scope !== current.scope) {
                const regCountRes = await query(
                    `SELECT COUNT(*)::int AS count FROM club_event_registrations WHERE event_id = $1 AND status NOT IN ('cancelled', 'rejected');`,
                    [eventId]
                );
                if ((regCountRes.rows[0]?.count || 0) > 0) {
                    return res.status(400).json({
                        success: false,
                        code: "SCOPE_LOCKED",
                        message: "Event scope cannot be altered after participant registrations have been received.",
                    });
                }

                // Security guard: Ensure club meets credibility threshold for the new scope
                const eligibility = await ClubCredibilityService.checkEventCreationEligibility(clubId);
                if (scope === "PAN_INDIA" && !eligibility.panIndia.scorePassed) {
                    return res.status(403).json({
                        success: false,
                        code: "CREDIBILITY_SCORE_TOO_LOW",
                        message: `Cannot upgrade event scope to Pan-India. Required Credibility Score >= 50.0 (Current: ${eligibility.currentScore}).`,
                        currentScore: eligibility.currentScore,
                        requiredScore: 50,
                    });
                }
                if (scope === "CAMPUS" && !eligibility.campus.scorePassed) {
                    return res.status(403).json({
                        success: false,
                        code: "CREDIBILITY_SCORE_TOO_LOW",
                        message: `Cannot modify event scope to Campus. Required Credibility Score >= 20.0 (Current: ${eligibility.currentScore}).`,
                        currentScore: eligibility.currentScore,
                        requiredScore: 20,
                    });
                }
            }
        }

        const validStatuses = ["draft", "published", "completed", "cancelled"];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: `Invalid status: ${status}. Allowed: ${validStatuses.join(", ")}` });
        }
        const newStatus = status || current.status;

        // Security check: Moving to Draft or Cancelling requires confirmation text and club account password
        if (status && (status === "draft" || status === "cancelled") && current.status !== status) {
            // Enforce Minimum 4-Hour advance cancellation warning/limit when cancelling a live published event
            if (status === "cancelled" && current.status === "published") {
                const startsAtMs = new Date(current.starts_at).getTime();
                const nowMs = Date.now();
                const hoursRemaining = (startsAtMs - nowMs) / (1000 * 60 * 60);

                if (hoursRemaining > 0 && hoursRemaining < 4) {
                    const { emergencyBypass } = req.body;
                    if (!emergencyBypass) {
                        const minutesLeft = Math.max(1, Math.ceil(hoursRemaining * 60));
                        return res.status(400).json({
                            success: false,
                            code: "EVENT_CANCELLATION_4H_LIMIT",
                            hoursRemaining,
                            message: `Warning: Minimum 4-hour advance limit required to cancel a published event. This event is scheduled to start in ${minutesLeft} minutes. Cancellation triggers immediate alerts to all registered students. To proceed under urgent circumstances, please acknowledge the 4-hour emergency waiver.`,
                        });
                    }
                }
            }

            const { password, confirmationText } = req.body;
            if (!password) {
                return res.status(400).json({
                    success: false,
                    message: `Club account password is required to transform event status to ${status}.`,
                });
            }

            const expectedPhrase = `delete ${current.title.trim()}`.toLowerCase();
            if (!confirmationText || confirmationText.trim().toLowerCase() !== expectedPhrase) {
                return res.status(400).json({
                    success: false,
                    message: `Confirmation text must match: delete ${current.title.trim()}`,
                });
            }

            const userRes = await query(`SELECT password FROM users WHERE id = $1 LIMIT 1;`, [userId]);
            if (!userRes.rows[0]?.password) {
                return res.status(401).json({ success: false, message: "User credentials not found." });
            }
            const isMatch = await bcrypt.compare(password, userRes.rows[0].password);
            if (!isMatch) {
                return res.status(401).json({ success: false, message: "Incorrect club account password. Authentication failed." });
            }
        }

        let publishedAt = current.published_at;
        if ((newStatus === "published" || newStatus === "completed") && !current.published_at) {
            publishedAt = new Date().toISOString();
        }
        const dbLocationType = locationType !== undefined ? normalizeLocationTypeForDb(locationType) : undefined;

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
                scope = COALESCE($12, scope),
                published_at = $13,
                updated_at = NOW()
             WHERE id = $14 AND club_id = $15
             RETURNING id;`,
            [
                title ? title.trim() : null,
                summary !== undefined ? summary : null,
                description !== undefined ? description : null,
                startsAt ? new Date(startsAt).toISOString() : null,
                endsAt ? new Date(endsAt).toISOString() : null,
                timezone || null,
                dbLocationType !== undefined ? dbLocationType : null,
                venueOrLocation !== undefined ? venueOrLocation : null,
                registrationUrl !== undefined ? registrationUrl : null,
                coverImageUrl !== undefined ? coverImageUrl : null,
                status || null,
                scope || null,
                publishedAt,
                eventId,
                clubId,
            ]
        );

        const refreshedEvent = await query(
            `SELECT
                e.id,
                e.club_id AS "clubId",
                e.title,
                e.slug,
                e.summary,
                e.description,
                COALESCE(e.scope, 'CAMPUS') AS "scope",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.registration_url AS "registrationUrl",
                e.cover_image_url AS "coverImageUrl",
                e.status,
                e.published_at AS "publishedAt",
                e.created_at AS "createdAt",
                e.updated_at AS "updatedAt",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('registered', 'attended')), 0) AS "registrationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'pending'), 0) AS "pendingCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status NOT IN ('cancelled', 'blocked')), 0) AS "totalApplicationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status = 'attended'), 0) AS "attendeesCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations cer WHERE cer.event_id = e.id AND cer.status IN ('rejected', 'cancelled', 'blocked')), 0) AS "rejectedCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_likes cel WHERE cel.event_id = e.id), 0) AS "likesCount"
             FROM club_events e
             WHERE e.id = $1 AND e.club_id = $2
             LIMIT 1;`,
            [eventId, clubId]
        );

        // Dispatch lifecycle notifications when transitioned to published, cancelled, or completed
        if (newStatus !== current.status) {
            if (newStatus === "published" || newStatus === "cancelled" || newStatus === "completed") {
                notifyClubAndCollegeUsers(String(eventId), clubId, newStatus, userId).catch((err) =>
                    console.error("[PATCH /events] Notification dispatch error:", err)
                );
            }

            // Credibility Engine Integration: Lifecycle transitions evaluate outcome evidence
            if (newStatus === "completed" && current.status !== "completed") {
                const attendeesCount = refreshedEvent.rows[0]?.attendeesCount || 0;
                const regsCount = refreshedEvent.rows[0]?.registrationsCount || 0;
                const compEval = new ClubCredibilityEngine().evaluateCompletedEventQuality({
                    deliveryAgainstCommitments: 90,
                    scheduleReliability: 90,
                    participantCommunication: 85,
                    verifiedExperience: attendeesCount > 0 ? 85 : 70,
                    complaintResolution: 95,
                    certificateAccuracy: 90,
                });

                ClubCredibilityService.recordCredibilityEvent({
                    clubId,
                    eventId: String(eventId),
                    sourceAction: "event_completed",
                    reasonCode: "event_delivered_successfully",
                    outcomeQuality: compEval.qualityScore,
                    weightInputs: {
                        baseWeight: 1.0,
                        scope: current.scope,
                        verifiedRegistrations: regsCount,
                        verifiedAttendees: attendeesCount,
                        isNegativeOutcome: false,
                    },
                    factorBreakdown: {
                        eventTitle: current.title,
                        scope: current.scope,
                        attendeesCount,
                        registrationsCount: regsCount,
                        dimensionalBreakdown: compEval.dimensionalBreakdown,
                    },
                    actorId: userId,
                    idempotencyKey: `complete_${eventId}_${current.status}`,
                }).catch((err) => console.error("[Credibility] Record event_completed error:", err));
            } else if (newStatus === "cancelled" && current.status === "published") {
                const startsAtMs = new Date(current.starts_at).getTime();
                const hoursNotice = Math.max(0, (startsAtMs - Date.now()) / (1000 * 60 * 60));
                const regsCount = refreshedEvent.rows[0]?.registrationsCount || 0;
                const reasonCat = req.body.reasonCategory || (req.body.emergencyBypass ? "emergency_verified" : "operational_delay");

                const cancelEval = new ClubCredibilityEngine().evaluateCancellationQuality({
                    hoursNoticeBeforeEvent: hoursNotice,
                    affectedRegistrationsCount: regsCount,
                    reasonCategory: reasonCat,
                    communicatedToAllParticipants: true,
                    rescheduleOrRemedyOffered: Boolean(req.body.rescheduleOffered),
                });

                ClubCredibilityService.recordCredibilityEvent({
                    clubId,
                    eventId: String(eventId),
                    sourceAction: "event_cancelled",
                    reasonCode: `cancellation_${reasonCat}`,
                    outcomeQuality: cancelEval.qualityScore,
                    weightInputs: {
                        baseWeight: 1.5,
                        scope: current.scope,
                        verifiedRegistrations: regsCount,
                        noticeHours: hoursNotice,
                        isNegativeOutcome: cancelEval.qualityScore < 50,
                    },
                    factorBreakdown: {
                        eventTitle: current.title,
                        scope: current.scope,
                        hoursNotice,
                        affectedRegistrations: regsCount,
                        reasonCategory: reasonCat,
                        dimensionalBreakdown: cancelEval.dimensionalBreakdown,
                    },
                    actorId: userId,
                    idempotencyKey: `cancel_${eventId}_${Date.now()}`,
                }).catch((err) => console.error("[Credibility] Record event_cancelled error:", err));
            } else if (newStatus === "draft" && current.status === "published") {
                // Unpublishing a live published event with active registrations
                const regsCount = refreshedEvent.rows[0]?.registrationsCount || 0;
                if (regsCount > 0) {
                    const startsAtMs = new Date(current.starts_at).getTime();
                    const hoursNotice = Math.max(0, (startsAtMs - Date.now()) / (1000 * 60 * 60));
                    const cancelEval = new ClubCredibilityEngine().evaluateCancellationQuality({
                        hoursNoticeBeforeEvent: hoursNotice,
                        affectedRegistrationsCount: regsCount,
                        reasonCategory: "operational_delay",
                        communicatedToAllParticipants: true,
                        rescheduleOrRemedyOffered: false,
                    });

                    ClubCredibilityService.recordCredibilityEvent({
                        clubId,
                        eventId: String(eventId),
                        sourceAction: "event_postponed",
                        reasonCode: "unpublish_live_event_to_draft",
                        outcomeQuality: cancelEval.qualityScore,
                        weightInputs: {
                            baseWeight: 1.2,
                            scope: current.scope,
                            verifiedRegistrations: regsCount,
                            noticeHours: hoursNotice,
                            isNegativeOutcome: cancelEval.qualityScore < 50,
                        },
                        factorBreakdown: {
                            eventTitle: current.title,
                            scope: current.scope,
                            hoursNotice,
                            affectedRegistrations: regsCount,
                        },
                        actorId: userId,
                        idempotencyKey: `draft_unpublish_${eventId}_${Date.now()}`,
                    }).catch((err) => console.error("[Credibility] Record unpublish_to_draft error:", err));
                }
            }
        }

        return res.json({
            success: true,
            message: "Event updated successfully.",
            event: refreshedEvent.rows[0],
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
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized." });
        }
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }

        const clubRes = await query(
            `SELECT id FROM verified_clubs WHERE auth_user_id = $1 LIMIT 1;`,
            [userId]
        );
        if (!clubRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Verified club not found." });
        }

        const existingEvent = await query(
            `SELECT id, title, status, scope, starts_at,
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations r WHERE r.event_id = club_events.id AND r.status IN ('registered', 'attended')), 0) AS "registrationsCount"
             FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`,
            [eventId, clubRes.rows[0].id]
        );
        if (!existingEvent.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found or not owned by this club." });
        }

        const { password, confirmationText } = req.body || {};
        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Club account password is required to delete an event.",
            });
        }

        const expectedPhrase = `delete ${existingEvent.rows[0].title.trim()}`.toLowerCase();
        if (!confirmationText || confirmationText.trim().toLowerCase() !== expectedPhrase) {
            return res.status(400).json({
                success: false,
                message: `Confirmation text must match: delete ${existingEvent.rows[0].title.trim()}`,
            });
        }

        const userRes = await query(`SELECT password FROM users WHERE id = $1 LIMIT 1;`, [userId]);
        if (!userRes.rows[0]?.password) {
            return res.status(401).json({ success: false, message: "User credentials not found." });
        }
        const isMatch = await bcrypt.compare(password, userRes.rows[0].password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Incorrect club account password. Authentication failed." });
        }

        // Credibility Accountability: If deleting a live published event with student registrations, record evidence
        const ev = existingEvent.rows[0];
        if (ev.status === "published" && (ev.registrationsCount || 0) > 0) {
            const startsAtMs = new Date(ev.starts_at).getTime();
            const hoursNotice = Math.max(0, (startsAtMs - Date.now()) / (1000 * 60 * 60));
            const cancelEval = new ClubCredibilityEngine().evaluateCancellationQuality({
                hoursNoticeBeforeEvent: hoursNotice,
                affectedRegistrationsCount: ev.registrationsCount,
                reasonCategory: "operational_delay",
                communicatedToAllParticipants: false,
                rescheduleOrRemedyOffered: false,
            });

            await ClubCredibilityService.recordCredibilityEvent({
                clubId: clubRes.rows[0].id,
                eventId: String(eventId),
                sourceAction: "event_deleted",
                reasonCode: "published_event_deleted_with_registrations",
                outcomeQuality: cancelEval.qualityScore,
                weightInputs: {
                    baseWeight: 2.0,
                    scope: ev.scope,
                    verifiedRegistrations: ev.registrationsCount,
                    noticeHours: hoursNotice,
                    isNegativeOutcome: cancelEval.qualityScore < 50,
                },
                factorBreakdown: {
                    eventTitle: ev.title,
                    scope: ev.scope,
                    hoursNotice,
                    affectedRegistrations: ev.registrationsCount,
                },
                actorId: userId,
                idempotencyKey: `delete_pub_${eventId}_${Date.now()}`,
            }).catch((err) => console.error("[Credibility] Record event_deleted error:", err));
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
 * Set of reserved route prefixes that must never be treated as a club slug
 */
const RESERVED_CLUB_ROUTES = new Set([
    "college-events",
    "inbox",
    "settings",
    "profile",
    "team",
    "events",
    "moderation",
    "reviewer",
    "user",
    "check-availability",
    "session-state",
    "application-status",
    "public-events",
    "public",
    "college-clubs",
    "register",
    "verify",
]);

/**
 * Public Club Profile Endpoint (No login required)
 * GET /public/:slug or GET /:slug
 */
const handleGetPublicClub = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const rawSlug = req.params.slug;
        const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug;
        if (!slug) {
            return res.status(400).json({ success: false, message: "Club slug is required." });
        }

        if (RESERVED_CLUB_ROUTES.has(slug.toLowerCase())) {
            return next();
        }

        const profileData = await ClubProfileService.getPublicClubProfile(slug, req.user?.id);

        return res.json({
            success: true,
            ...profileData,
        });
    } catch (err: any) {
        console.error(`Public club profile fetch error for slug "${req.params.slug}":`, err);
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message || "Failed to retrieve public club profile.",
        });
    }
};

// =========================================================================
// CLUB INBOX & PUBLIC MESSAGING ENDPOINTS
// =========================================================================

/**
 * Helper to retrieve staff verified club
 */
async function getStaffClub(userId: string, requestedClubId?: string) {
    if (requestedClubId) {
        const res = await query(
            `SELECT vc.id, vc.name, vc.slug, vc.auth_user_id AS "authUserId", vc.is_active AS "isActive"
             FROM verified_clubs vc
             WHERE vc.id = $1 AND (
                 vc.auth_user_id = $2
                 OR EXISTS (
                     SELECT 1 FROM club_team_members ctm
                     WHERE ctm.club_id = vc.id AND ctm.user_id = $2 AND ctm.status = 'active'
                 )
                 OR EXISTS (
                     SELECT 1 FROM club_coordinators cc
                     WHERE cc.club_id = vc.id AND cc.linked_user_id = $2
                 )
             ) LIMIT 1;`,
            [requestedClubId, userId]
        );
        if (res.rows[0]) return res.rows[0];
    }

    const res = await query(
        `SELECT vc.id, vc.name, vc.slug, vc.auth_user_id AS "authUserId", vc.is_active AS "isActive"
         FROM verified_clubs vc
         WHERE vc.auth_user_id = $1
            OR EXISTS (
                SELECT 1 FROM club_team_members ctm
                WHERE ctm.club_id = vc.id AND ctm.user_id = $1 AND ctm.status = 'active'
            )
            OR EXISTS (
                SELECT 1 FROM club_coordinators cc
                WHERE cc.club_id = vc.id AND cc.linked_user_id = $1
            )
         LIMIT 1;`,
        [userId]
    );
    return res.rows[0] || null;
}

/**
 * POST /api/club/:clubId/messages
 * Allows any authenticated registered user to send an inquiry message to a verified club.
 * Does NOT require connection with club owner.
 * Enforces rate limits (daily, weekly, monthly, per-pair).
 * Enforces club-specific block check.
 * If user is muted, delivery is silent (notification to club suppressed).
 */
clubRouter.post("/:clubId/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const { clubId } = req.params;
        const senderId = req.user!.id;
        const senderName = req.user!.firstName
            ? `${req.user!.firstName} ${req.user!.lastName || ""}`.trim()
            : req.user!.username || "Orbix User";
        const { subject, body } = req.body;

        const result = await sendMessageToClub({
            senderId,
            senderName,
            clubId: String(clubId),
            subject,
            body,
        });

        if (!result.success) {
            const status = result.code === "RATE_LIMIT_EXCEEDED" ? 429
                : result.code === "USER_BLOCKED_BY_CLUB" ? 403
                : result.code === "CLUB_NOT_AVAILABLE" ? 404
                : 400;

            return res.status(status).json({
                success: false,
                code: result.code,
                message: result.error,
                retryAfterSeconds: result.retryAfterSeconds,
            });
        }

        return res.status(201).json({
            success: true,
            message: "Message sent to club successfully.",
            conversationId: result.conversationId,
            messageId: result.messageId,
            isMutedDelivery: result.isMutedDelivery,
        });
    } catch (err: any) {
        console.error("POST /api/club/:clubId/messages error:", err);
        return res.status(500).json({ success: false, message: "Internal server error." });
    }
});

/**
 * GET /api/club/:clubId/my-conversation
 * Retrieves the current user's conversation and messages with this club.
 */
clubRouter.get("/:clubId/my-conversation", authenticate, async (req: Request, res: Response) => {
    try {
        const { clubId } = req.params;
        const userId = req.user!.id;

        const convRes = await query(
            `SELECT id, subject, status, is_read_by_user AS "isReadByUser", last_message_at AS "lastMessageAt", created_at AS "createdAt"
             FROM club_conversations
             WHERE club_id = $1 AND user_id = $2
             LIMIT 1;`,
            [clubId, userId]
        );

        if (!convRes.rows[0]) {
            return res.json({ success: true, conversation: null, messages: [] });
        }

        const conv = convRes.rows[0];
        const msgsRes = await query(
            `SELECT id, sender_id AS "senderId", sender_type AS "senderType", body, created_at AS "createdAt"
             FROM club_messages
             WHERE conversation_id = $1
             ORDER BY created_at ASC;`,
            [conv.id]
        );

        return res.json({
            success: true,
            conversation: conv,
            messages: msgsRes.rows,
        });
    } catch (err: any) {
        console.error("GET my-conversation error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve conversation." });
    }
});

/**
 * GET /api/club/college-events
 * Returns published events organized by clubs for the student's college, with like state and registration status.
 */
clubRouter.get("/college-events", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id || null;
        const requestedCollegeId = (req.query.collegeId as string) || undefined;
        const requestedCollegeName = (req.query.collegeName as string) || undefined;
        const timeFilter = (req.query.timeFilter as string) || "all"; // 'all' | 'live' | 'upcoming' | 'today' | 'completed' | 'past'
        const clubId = (req.query.clubId as string) || undefined;
        const search = ((req.query.search as string) || "").trim();

        // Retrieve user college
        const isValidUuid = (val: any): boolean =>
            typeof val === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());

        let userCollegeId: string | null =
            requestedCollegeId && isValidUuid(requestedCollegeId) ? requestedCollegeId.trim() : null;
        let userCollegeName: string | null =
            requestedCollegeName &&
            requestedCollegeName.trim() &&
            requestedCollegeName !== "undefined" &&
            requestedCollegeName !== "null"
                ? requestedCollegeName.trim()
                : null;

        // 1. Retrieve user college from profile if user is authenticated and either collegeId or collegeName is missing
        if (userId && (!userCollegeId || !userCollegeName)) {
            try {
                const userRes = await query(
                    `SELECT u.college, u.college_id, inst.official_name AS institution_name
                     FROM users u
                     LEFT JOIN institutions inst ON inst.id = u.college_id
                     WHERE u.id = $1 LIMIT 1;`,
                    [userId]
                );
                const userRow = userRes.rows[0];
                if (userRow) {
                    if (!userCollegeId && isValidUuid(userRow.college_id)) {
                        userCollegeId = userRow.college_id;
                    }
                    if (!userCollegeName) {
                        userCollegeName = userRow.institution_name || userRow.college || null;
                    }
                }
            } catch {
                // Ignore fallback error
            }
        }

        // 2. If caller is logged in as / associated with a club, fall back to the club's college
        if (userId && (!userCollegeId || !userCollegeName)) {
            try {
                const clubRes = await query(
                    `SELECT vc.college_id, vc.college_name
                     FROM verified_clubs vc
                     WHERE vc.auth_user_id = $1
                     UNION
                     SELECT vc.college_id, vc.college_name
                     FROM verified_clubs vc
                     JOIN club_members cm ON cm.club_id = vc.id
                     WHERE cm.user_id = $1 AND cm.status = 'active'
                     LIMIT 1;`,
                    [userId]
                );
                if (clubRes.rows.length > 0) {
                    if (!userCollegeId && isValidUuid(clubRes.rows[0].college_id)) {
                        userCollegeId = clubRes.rows[0].college_id;
                    }
                    if (!userCollegeName) {
                        userCollegeName = clubRes.rows[0].college_name || null;
                    }
                }
            } catch {
                // Ignore fallback error
            }
        }

        // 3. If collegeId exists but collegeName is missing, resolve official name
        if (userCollegeId && (!userCollegeName || !userCollegeName.trim())) {
            try {
                const instRes = await query(
                    `SELECT official_name FROM institutions WHERE id = $1 LIMIT 1;`,
                    [userCollegeId]
                );
                if (instRes.rows.length > 0 && instRes.rows[0].official_name) {
                    userCollegeName = instRes.rows[0].official_name;
                }
            } catch {
                // Ignore fallback error
            }
        }

        // 4. If collegeName exists but collegeId is missing, resolve UUID
        if (userCollegeName && !userCollegeId) {
            try {
                const instRes = await query(
                    `SELECT id FROM institutions WHERE LOWER(TRIM(official_name)) = LOWER(TRIM($1)) LIMIT 1;`,
                    [userCollegeName]
                );
                if (instRes.rows.length > 0 && isValidUuid(instRes.rows[0].id)) {
                    userCollegeId = instRes.rows[0].id;
                }
            } catch {
                // Ignore fallback error
            }
        }

        let sql = `
            SELECT
                e.id,
                e.club_id AS "clubId",
                e.title,
                e.slug,
                e.summary,
                e.description,
                COALESCE(e.scope, 'CAMPUS') AS "scope",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.registration_url AS "registrationUrl",
                e.cover_image_url AS "coverImageUrl",
                e.status,
                e.published_at AS "publishedAt",
                e.created_at AS "createdAt",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                COALESCE(vc.cover_image_url, '') AS "clubBannerUrl",
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.category AS "clubCategory",
                (SELECT COUNT(*)::int FROM club_event_likes WHERE event_id = e.id) AS "likesCount",
                CASE WHEN $1::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_likes WHERE event_id = e.id AND user_id = $1::uuid) ELSE false END AS "hasLiked",
                CASE WHEN $1::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_registrations WHERE event_id = e.id AND user_id = $1::uuid AND status IN ('registered', 'attended')) ELSE false END AS "isRegistered",
                CASE WHEN $1::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_registrations WHERE event_id = e.id AND user_id = $1::uuid AND status = 'pending') ELSE false END AS "isPending",
                CASE WHEN $1::uuid IS NOT NULL THEN (SELECT status FROM club_event_registrations WHERE event_id = e.id AND user_id = $1::uuid AND status != 'cancelled' ORDER BY registered_at DESC LIMIT 1) ELSE NULL END AS "registrationStatus",
                CASE WHEN $1::uuid IS NOT NULL THEN (SELECT ticket_code FROM club_event_registrations WHERE event_id = e.id AND user_id = $1::uuid AND status IN ('registered', 'attended') ORDER BY registered_at DESC LIMIT 1) ELSE NULL END AS "ticketCode",
                (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = e.id AND status IN ('registered', 'attended')) AS "registrationsCount",
                (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = e.id AND status NOT IN ('cancelled', 'blocked')) AS "totalApplicationsCount"
            FROM club_events e
            JOIN verified_clubs vc ON vc.id = e.club_id
            WHERE e.status IN ('published', 'completed') AND vc.is_active = true
        `;
        const params: any[] = [userId];

        if (userCollegeId || userCollegeName) {
            params.push(userCollegeId, userCollegeName);
            sql += ` AND (
                e.scope = 'PAN_INDIA'
                OR ($${params.length - 1}::uuid IS NOT NULL AND vc.college_id = $${params.length - 1}::uuid)
                OR ($${params.length}::text IS NOT NULL AND LOWER(vc.college_name) = LOWER($${params.length}))
            )`;
        }

        if (clubId && isValidUuid(clubId)) {
            params.push(clubId.trim());
            sql += ` AND e.club_id = $${params.length}`;
        }

        if (timeFilter === "upcoming" || timeFilter === "live") {
            sql += ` AND (COALESCE(e.ends_at, e.starts_at) >= NOW() AND e.status != 'completed')`;
        } else if (timeFilter === "past" || timeFilter === "completed") {
            sql += ` AND (COALESCE(e.ends_at, e.starts_at) < NOW() OR e.status = 'completed')`;
        } else if (timeFilter === "today") {
            sql += ` AND (DATE(e.starts_at) = CURRENT_DATE OR (e.starts_at <= NOW() AND COALESCE(e.ends_at, e.starts_at) >= NOW()))`;
        }

        if (search) {
            params.push(`%${search.toLowerCase()}%`);
            sql += ` AND (LOWER(e.title) LIKE $${params.length} OR LOWER(COALESCE(e.summary, '')) LIKE $${params.length} OR LOWER(COALESCE(e.venue_or_location, '')) LIKE $${params.length} OR LOWER(vc.name) LIKE $${params.length})`;
        }

        sql += (timeFilter === "past" || timeFilter === "completed") ? ` ORDER BY e.starts_at DESC` : ` ORDER BY e.starts_at ASC`;

        const eventsRes = await query(sql, params);

        return res.json({
            success: true,
            collegeName: userCollegeName || "Your College",
            collegeId: userCollegeId,
            events: eventsRes.rows,
        });
    } catch (err: any) {
        console.error("GET /api/club/college-events error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve college events." });
    }
});

/**
 * GET /api/club/public-events/:eventId
 * Returns public event details, including host club, college affiliation, and registration state if logged in.
 */
clubRouter.get("/public-events/:eventId", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const userId = req.user?.id || null;

        const eventRes = await query(
            `SELECT
                e.id,
                e.club_id AS "clubId",
                e.title,
                e.slug,
                e.summary,
                e.description,
                COALESCE(e.scope, 'CAMPUS') AS "scope",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.registration_url AS "registrationUrl",
                e.cover_image_url AS "coverImageUrl",
                e.status,
                e.published_at AS "publishedAt",
                e.created_at AS "createdAt",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                COALESCE(vc.cover_image_url, '') AS "clubBannerUrl",
                vc.college_id AS "collegeId",
                vc.college_name AS "collegeName",
                vc.category AS "clubCategory",
                (SELECT COUNT(*)::int FROM club_event_likes WHERE event_id = e.id) AS "likesCount",
                CASE WHEN $2::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_likes WHERE event_id = e.id AND user_id = $2::uuid) ELSE false END AS "hasLiked",
                CASE WHEN $2::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_registrations WHERE event_id = e.id AND user_id = $2::uuid AND status IN ('registered', 'attended')) ELSE false END AS "isRegistered",
                CASE WHEN $2::uuid IS NOT NULL THEN EXISTS(SELECT 1 FROM club_event_registrations WHERE event_id = e.id AND user_id = $2::uuid AND status = 'pending') ELSE false END AS "isPending",
                CASE WHEN $2::uuid IS NOT NULL THEN (SELECT status FROM club_event_registrations WHERE event_id = e.id AND user_id = $2::uuid AND status != 'cancelled' ORDER BY registered_at DESC LIMIT 1) ELSE NULL END AS "registrationStatus",
                CASE WHEN $2::uuid IS NOT NULL THEN (SELECT ticket_code FROM club_event_registrations WHERE event_id = e.id AND user_id = $2::uuid AND status IN ('registered', 'attended') ORDER BY registered_at DESC LIMIT 1) ELSE NULL END AS "ticketCode",
                (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = e.id AND status IN ('registered', 'attended')) AS "registrationsCount",
                (SELECT COUNT(*)::int FROM club_event_registrations WHERE event_id = e.id AND status NOT IN ('cancelled', 'blocked')) AS "totalApplicationsCount"
            FROM club_events e
            JOIN verified_clubs vc ON vc.id = e.club_id
            WHERE e.id = $1 AND e.status IN ('published', 'completed')
            LIMIT 1;`,
            [eventId, userId]
        );

        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found or not published." });
        }

        return res.json({ success: true, event: eventRes.rows[0] });
    } catch (err: any) {
        console.error("GET /api/club/public-events/:eventId error:", err);
        return res.status(500).json({ success: false, message: "Failed to load event details." });
    }
});

/**
 * POST /api/club/events/:eventId/like
 * Toggles student heart / appreciation for an event.
 */
clubRouter.post("/events/:eventId/like", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        const userId = req.user!.id;

        const checkEvent = await query(
            `SELECT id FROM club_events WHERE ($1::boolean = true AND id = $2::uuid) OR slug = $3 LIMIT 1;`,
            [isUuid, isUuid ? eventId : null, eventId]
        );
        if (!checkEvent.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const targetEventId = checkEvent.rows[0].id;

        const existing = await query(
            `SELECT id FROM club_event_likes WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [targetEventId, userId]
        );

        let liked = false;
        if (existing.rows[0]) {
            await query(
                `DELETE FROM club_event_likes WHERE event_id = $1 AND user_id = $2;`,
                [targetEventId, userId]
            );
            liked = false;
        } else {
            await query(
                `INSERT INTO club_event_likes (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;`,
                [targetEventId, userId]
            );
            liked = true;
        }

        const countRes = await query(
            `SELECT COUNT(*)::int AS count FROM club_event_likes WHERE event_id = $1;`,
            [targetEventId]
        );
        const likesCount = countRes.rows[0]?.count || 0;

        return res.json({
            success: true,
            liked,
            likesCount,
        });
    } catch (err: any) {
        console.error("Event like toggle error:", err);
        return res.status(500).json({ success: false, message: "Failed to update appreciation." });
    }
});

/**
 * POST /api/club/events/:eventId/register
 * Registers / applies authenticated user for a club event with student details.
 * Enforces block check: blocked users CANNOT register or RSVP.
 */
clubRouter.post("/events/:eventId/register", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const userId = req.user!.id;
        const {
            applicantName,
            applicantEmail,
            department,
            yearOfStudy,
            rollNumber,
            phoneNumber,
            notes,
            answers,
            isAttendeeUnder18,
            guardianName,
            guardianEmail,
            guardianPhone,
            guardianRelationship,
        } = req.body || {};

        const eventRes = await query(
            `SELECT e.id, e.club_id, e.title, e.status, COALESCE(e.scope, 'CAMPUS') AS "scope", vc.name AS "clubName",
                    vc.college_id AS "eventCollegeId", vc.college_name AS "eventCollegeName"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1
             LIMIT 1;`,
            [eventId]
        );

        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const event = eventRes.rows[0];

        if (event.status !== "published") {
            return res.status(400).json({ success: false, message: "Registration is not open for this event." });
        }

        // 1. Enforce Block Check
        const mod = await getClubModerationState(event.club_id, userId);
        if (mod.isBlocked) {
            return res.status(403).json({
                success: false,
                code: "ACCESS_RESTRICTED",
                message: "Access Restricted: You don't have permission to register for events by this club.",
            });
        }

        // Fetch user default info and verified college affiliation
        const userRes = await query(
            `SELECT u.username, u.email, u.firstname, u.lastname, u.college_id AS "userCollegeId",
                    inst.official_name AS "userCollegeName"
             FROM users u
             LEFT JOIN institutions inst ON inst.id = u.college_id
             WHERE u.id = $1 LIMIT 1;`,
            [userId]
        );
        const userRow = userRes.rows[0];

        // 2. Enforce Campus Affiliation Check:
        // Exclusively enforced for CAMPUS-scoped events. Pan India events allow cross-campus participation.
        const isCampusOnly = event.scope !== "PAN_INDIA";
        if (isCampusOnly && event.eventCollegeId) {
            if (!userRow?.userCollegeId) {
                return res.status(403).json({
                    success: false,
                    code: "COLLEGE_REQUIRED",
                    message: `This event is exclusively restricted to students of ${event.eventCollegeName || "the host campus"}. Please link and verify your college affiliation in your profile first.`,
                    eventCollegeName: event.eventCollegeName,
                });
            }

            if (String(userRow.userCollegeId).trim().toLowerCase() !== String(event.eventCollegeId).trim().toLowerCase()) {
                return res.status(403).json({
                    success: false,
                    code: "DIFFERENT_COLLEGE_RESTRICTED",
                    message: `This event is exclusively restricted to students of ${event.eventCollegeName || "the host campus"}. You are affiliated with ${userRow.userCollegeName || "a different institution"}.`,
                    eventCollegeName: event.eventCollegeName,
                    userCollegeName: userRow.userCollegeName,
                });
            }
        }

        // Resolve canonical institution snapshot for registration record
        let regInstitutionId: string | null = null;
        let regInstitutionName: string | null = null;
        let regUniversityName: string | null = null;
        let regCampusName: string | null = null;
        let regInstitutionCity: string | null = null;
        let regInstitutionState: string | null = null;
        let regInstitutionVerification: string = "unverified";
        let regIsUnlisted: boolean = false;

        const {
            institutionId: customInstId,
            institutionName: customInstName,
            universityName: customUnivName,
            campusName: customCampName,
            institutionCity: customInstCity,
            institutionState: customInstState,
            isUnlistedInstitution: customIsUnlisted,
        } = req.body || {};

        const targetInstId = customInstId || userRow?.userCollegeId;
        const isValidId = Boolean(targetInstId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(targetInstId).trim()));
        if (isValidId) {
            try {
                const instRes = await query(
                    `SELECT id, official_name, state, city, district, verification_status FROM institutions WHERE id = $1 LIMIT 1;`,
                    [targetInstId]
                );
                if (instRes.rows[0]) {
                    const inst = instRes.rows[0];
                    regInstitutionId = inst.id;
                    regInstitutionName = inst.official_name;
                    regInstitutionCity = inst.city || inst.district || null;
                    regInstitutionState = inst.state || null;
                    regInstitutionVerification = inst.verification_status || "verified";
                }
            } catch {}
        }

        if (!regInstitutionName && (customInstName || userRow?.userCollegeName)) {
            regInstitutionName = (customInstName || userRow?.userCollegeName || "").trim();
            regInstitutionCity = customInstCity || null;
            regInstitutionState = customInstState || null;
            regUniversityName = customUnivName || null;
            regCampusName = customCampName || null;
            regIsUnlisted = Boolean(customIsUnlisted);
            regInstitutionVerification = "unverified";
        }

        const defaultName = userRow?.firstname
            ? `${userRow.firstname} ${userRow.lastname || ""}`.trim()
            : userRow?.username || "Student";
        const finalName = (applicantName && typeof applicantName === "string" ? applicantName.trim() : "") || defaultName;
        const finalEmail = (applicantEmail && typeof applicantEmail === "string" ? applicantEmail.trim() : "") || userRow?.email || "";

        // 3. Check existing registration
        const existingReg = await query(
            `SELECT id, status, ticket_code FROM club_event_registrations WHERE event_id = $1 AND user_id = $2 LIMIT 1;`,
            [eventId, userId]
        );
        if (existingReg.rows[0]) {
            if (existingReg.rows[0].status === "blocked") {
                return res.status(403).json({
                    success: false,
                    code: "ACCESS_RESTRICTED",
                    message: "Access Restricted: You don't have permission to access this event.",
                });
            }
            if (existingReg.rows[0].status === "pending") {
                return res.status(200).json({
                    success: true,
                    message: "Your application is currently pending review by the club coordinators.",
                    registration: existingReg.rows[0],
                });
            }
            if (existingReg.rows[0].status === "registered" || existingReg.rows[0].status === "attended") {
                return res.status(200).json({
                    success: true,
                    message: "You are already registered for this event.",
                    registration: existingReg.rows[0],
                });
            }
            if (existingReg.rows[0].status === "cancelled" || existingReg.rows[0].status === "rejected") {
                // Reactivate application into pending review
                const reactivated = await query(
                    `UPDATE club_event_registrations
                     SET status = 'pending',
                         applicant_name = COALESCE($1, applicant_name),
                         applicant_email = COALESCE($2, applicant_email),
                         department = COALESCE($3, department),
                         year_of_study = COALESCE($4, year_of_study),
                         roll_number = COALESCE($5, roll_number),
                         phone_number = COALESCE($6, phone_number),
                         notes = COALESCE($7, notes),
                         institution_id = COALESCE($8, institution_id),
                         institution_name = COALESCE($9, institution_name),
                         university_name = COALESCE($10, university_name),
                         campus_name = COALESCE($11, campus_name),
                         institution_city = COALESCE($12, institution_city),
                         institution_state = COALESCE($13, institution_state),
                         institution_verification_status = COALESCE($14, institution_verification_status),
                         is_unlisted_institution = COALESCE($15, is_unlisted_institution),
                         registered_at = NOW(),
                         reviewed_at = NULL,
                         reviewed_by_user_id = NULL,
                         review_notes = NULL,
                         updated_at = NOW()
                     WHERE id = $16
                     RETURNING id, event_id AS "eventId", club_id AS "clubId", status, ticket_code AS "ticketCode", registered_at AS "registeredAt";`,
                    [
                        finalName,
                        finalEmail,
                        department || null,
                        yearOfStudy || null,
                        rollNumber || null,
                        phoneNumber || null,
                        notes || null,
                        regInstitutionId,
                        regInstitutionName,
                        regUniversityName,
                        regCampusName,
                        regInstitutionCity,
                        regInstitutionState,
                        regInstitutionVerification,
                        regIsUnlisted,
                        existingReg.rows[0].id,
                    ]
                );
                return res.json({
                    success: true,
                    message: `Application submitted for review for ${event.title}!`,
                    registration: {
                        ...reactivated.rows[0],
                        ticketCode: null,
                    },
                });
            }
        }

        // Minor Attendee & Guardian Verification Processing
        const isMinor = Boolean(isAttendeeUnder18);
        let normGuardianName: string | null = null;
        let normGuardianEmail: string | null = null;
        let normGuardianPhone: string | null = null;
        let normGuardianRelationship: string | null = null;
        let guardianConsentStatus = "not_required";
        let guardianConsentToken: string | null = null;
        let guardianConsentTokenExpiresAt: Date | null = null;

        if (isMinor) {
            normGuardianName = typeof guardianName === "string" ? guardianName.trim() : "";
            normGuardianEmail = typeof guardianEmail === "string" ? guardianEmail.trim().toLowerCase() : "";
            normGuardianPhone = typeof guardianPhone === "string" ? guardianPhone.trim() : "";
            normGuardianRelationship = typeof guardianRelationship === "string" ? guardianRelationship.trim() : "";

            if (!normGuardianName || normGuardianName.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: "Parent or legal guardian's full name is required for attendees under 18.",
                });
            }

            if (!normGuardianEmail || !normGuardianEmail.includes("@")) {
                return res.status(400).json({
                    success: false,
                    message: "A valid email address for your parent or legal guardian is required.",
                });
            }

            if (normGuardianEmail.toLowerCase() === finalEmail.toLowerCase() || normGuardianEmail.toLowerCase() === (userRow?.email || "").toLowerCase()) {
                return res.status(400).json({
                    success: false,
                    message: "Guardian email address must be distinct from the attendee's personal email address.",
                });
            }

            if (!normGuardianPhone || normGuardianPhone.length < 7) {
                return res.status(400).json({
                    success: false,
                    message: "Parent or legal guardian's contact phone number is required.",
                });
            }

            if (!normGuardianRelationship) {
                return res.status(400).json({
                    success: false,
                    message: "Relationship to parent or legal guardian (e.g., Mother, Father, Guardian) is required.",
                });
            }

            guardianConsentStatus = "pending_verification";
            guardianConsentToken = crypto.randomBytes(32).toString("hex");
            guardianConsentTokenExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }

        // 3. Register user application with status 'pending'
        const regRes = await query(
            `INSERT INTO club_event_registrations (
                event_id,
                club_id,
                user_id,
                status,
                applicant_name,
                applicant_email,
                department,
                year_of_study,
                roll_number,
                phone_number,
                notes,
                answers,
                institution_id,
                institution_name,
                university_name,
                campus_name,
                institution_city,
                institution_state,
                institution_verification_status,
                is_unlisted_institution,
                is_attendee_under_18,
                guardian_name,
                guardian_email,
                guardian_phone,
                guardian_relationship,
                guardian_consent_status,
                guardian_consent_token,
                guardian_consent_token_expires_at,
                registered_at,
                created_at,
                updated_at
            ) VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, NOW(), NOW(), NOW())
            RETURNING id, event_id AS "eventId", club_id AS "clubId", status, ticket_code AS "ticketCode", registered_at AS "registeredAt", is_attendee_under_18 AS "isAttendeeUnder18", guardian_consent_status AS "guardianConsentStatus", institution_name AS "institutionName";`,
            [
                eventId,
                event.club_id,
                userId,
                finalName,
                finalEmail,
                department || null,
                yearOfStudy || null,
                rollNumber || null,
                phoneNumber || null,
                notes || null,
                answers ? JSON.stringify(answers) : "{}",
                regInstitutionId,
                regInstitutionName,
                regUniversityName,
                regCampusName,
                regInstitutionCity,
                regInstitutionState,
                regInstitutionVerification,
                regIsUnlisted,
                isMinor,
                normGuardianName,
                normGuardianEmail,
                normGuardianPhone,
                normGuardianRelationship,
                guardianConsentStatus,
                guardianConsentToken,
                guardianConsentTokenExpiresAt,
            ]
        );

        const createdReg = regRes.rows[0];

        // If minor, dispatch verification email to parent/guardian
        if (isMinor && normGuardianEmail && guardianConsentToken) {
            const frontendBaseUrl = process.env.FRONTEND_URL || "http://localhost:5173";
            const consentLink = `${frontendBaseUrl}/events/guardian-consent?token=${guardianConsentToken}&registrationId=${createdReg.id}`;
            
            try {
                await sendGuardianConsentEmail({
                    to: normGuardianEmail,
                    guardianName: normGuardianName || "Parent / Guardian",
                    studentName: finalName,
                    eventTitle: event.title,
                    clubName: event.clubName,
                    collegeName: event.eventCollegeName || "Host Campus",
                    consentLink,
                    expiresInDays: 7,
                });
            } catch (emailErr) {
                console.error("[MinorProtection] Failed to dispatch guardian consent email:", emailErr);
            }

            return res.status(201).json({
                success: true,
                message: `Registration received! Because you are under 18, a verification link has been emailed to your parent/guardian (${normGuardianEmail}). Registration will remain pending until parental consent is verified.`,
                registration: {
                    ...createdReg,
                    ticketCode: null,
                },
                minorConsentPending: true,
            });
        }

        return res.status(201).json({
            success: true,
            message: `Application submitted for ${event.title}! The club coordinators will review your application.`,
            registration: {
                ...createdReg,
                ticketCode: null,
            },
        });
    } catch (err: any) {
        console.error("Event registration error:", err);
        return res.status(500).json({ success: false, message: "Failed to register for event." });
    }
});

/**
 * POST /api/club/events/:eventId/cancel
 * Student cancels their event registration.
 */
clubRouter.post("/events/:eventId/cancel", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const userId = req.user!.id;

        const updateRes = await query(
            `UPDATE club_event_registrations
             SET status = 'cancelled', updated_at = NOW()
             WHERE event_id = $1 AND user_id = $2 AND status != 'cancelled'
             RETURNING id, event_id, status;`,
            [eventId, userId]
        );

        if (!updateRes.rows[0]) {
            return res.status(404).json({ success: false, message: "No active registration found to cancel." });
        }

        return res.json({ success: true, message: "Registration cancelled successfully." });
    } catch (err: any) {
        console.error("Cancel registration error:", err);
        return res.status(500).json({ success: false, message: "Failed to cancel registration." });
    }
});

/**
 * GET /api/club/user/applications
 * Returns all event applications/registrations for the logged-in student.
 */
clubRouter.get("/user/applications", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const appsRes = await query(
            `SELECT
                r.id,
                r.event_id AS "eventId",
                r.club_id AS "clubId",
                r.status,
                r.registered_at AS "registeredAt",
                r.checked_in_at AS "checkedInAt",
                r.reviewed_at AS "reviewedAt",
                r.review_notes AS "reviewNotes",
                CASE WHEN r.status IN ('registered', 'attended') THEN r.ticket_code ELSE NULL END AS "ticketCode",
                r.applicant_name AS "applicantName",
                r.applicant_email AS "applicantEmail",
                r.department,
                r.year_of_study AS "yearOfStudy",
                r.roll_number AS "rollNumber",
                r.phone_number AS "phoneNumber",
                r.notes,
                e.title AS "eventTitle",
                e.slug AS "eventSlug",
                e.summary AS "eventSummary",
                e.description AS "eventDescription",
                e.starts_at AS "startsAt",
                e.ends_at AS "endsAt",
                e.timezone,
                CASE WHEN e.location_type = 'online' THEN 'virtual' ELSE e.location_type END AS "locationType",
                e.venue_or_location AS "venueOrLocation",
                e.cover_image_url AS "coverImageUrl",
                e.status AS "eventStatus",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                vc.college_name AS "collegeName"
             FROM club_event_registrations r
             JOIN club_events e ON e.id = r.event_id
             JOIN verified_clubs vc ON vc.id = r.club_id
             WHERE r.user_id = $1
             ORDER BY r.registered_at DESC;`,
            [userId]
        );

        return res.json({
            success: true,
            applications: appsRes.rows,
        });
    } catch (err: any) {
        console.error("Fetch user applications error:", err);
        return res.status(500).json({ success: false, message: "Failed to load event applications." });
    }
});

/**
 * GET /api/club/events/:eventId/applications
 * Returns all student applications for a club event in an Excel spreadsheet-compatible format for staff.
 */
clubRouter.get("/events/:eventId/applications", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const userId = req.user!.id;

        // Verify event and staff permission
        const eventRes = await query(
            `SELECT e.id, e.club_id, e.title, e.starts_at, e.venue_or_location, COALESCE(e.scope, 'CAMPUS') AS scope, vc.name AS "clubName"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1 LIMIT 1;`,
            [eventId]
        );
        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const event = eventRes.rows[0];

        const staffClub = await getStaffClub(userId, event.club_id);
        if (!staffClub) {
            return res.status(403).json({ success: false, message: "Access forbidden: you cannot manage applications for this event." });
        }

        const applicantsRes = await query(
            `SELECT
                r.id,
                r.user_id AS "userId",
                COALESCE(r.applicant_name, TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS "applicantName",
                COALESCE(r.applicant_email, u.email) AS "applicantEmail",
                u.username,
                COALESCE(u.photo_url, u.avatar_url, 'https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png') AS "avatarUrl",
                COALESCE(r.department, '') AS "department",
                COALESCE(r.year_of_study, '') AS "yearOfStudy",
                COALESCE(r.roll_number, '') AS "rollNumber",
                COALESCE(r.phone_number, '') AS "phoneNumber",
                r.institution_id AS "institutionId",
                COALESCE(r.institution_name, '') AS "institutionName",
                COALESCE(r.university_name, '') AS "universityName",
                COALESCE(r.campus_name, '') AS "campusName",
                COALESCE(r.institution_city, '') AS "institutionCity",
                COALESCE(r.institution_state, '') AS "institutionState",
                COALESCE(r.institution_verification_status, 'unverified') AS "institutionVerificationStatus",
                COALESCE(r.is_unlisted_institution, false) AS "isUnlistedInstitution",
                r.ticket_code AS "ticketCode",
                r.status,
                r.registered_at AS "registeredAt",
                r.checked_in_at AS "checkedInAt",
                r.reviewed_at AS "reviewedAt",
                r.review_notes AS "reviewNotes",
                COALESCE(r.notes, '') AS "notes",
                COALESCE(r.is_attendee_under_18, false) AS "isAttendeeUnder18",
                r.guardian_name AS "guardianName",
                r.guardian_email AS "guardianEmail",
                r.guardian_phone AS "guardianPhone",
                r.guardian_relationship AS "guardianRelationship",
                COALESCE(r.guardian_consent_status, 'not_required') AS "guardianConsentStatus",
                r.guardian_consent_verified_at AS "guardianConsentVerifiedAt",
                r.answers,
                r.form_response AS "formResponse",
                r.file_attachments AS "fileAttachments"
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1 AND r.club_id = $2
             ORDER BY r.registered_at DESC;`,
            [eventId, event.club_id]
        );

        // Fetch form structure if exists
        const formRes = await query(
            `SELECT structure, title, settings FROM club_event_forms WHERE event_id = $1 LIMIT 1;`,
            [eventId]
        );

        const rows = applicantsRes.rows;
        const summary = {
            total: rows.length,
            pending: rows.filter((r) => r.status === "pending").length,
            registered: rows.filter((r) => r.status === "registered").length,
            attended: rows.filter((r) => r.status === "attended").length,
            waitlisted: rows.filter((r) => r.status === "waitlisted").length,
            rejected: rows.filter((r) => r.status === "rejected").length,
            cancelled: rows.filter((r) => r.status === "cancelled").length,
        };

        return res.json({
            success: true,
            event: {
                id: event.id,
                title: event.title,
                startsAt: event.starts_at,
                venue: event.venue_or_location,
                clubName: event.clubName,
                scope: event.scope || "CAMPUS",
            },
            formStructure: formRes.rows[0]?.structure || null,
            formSettings: formRes.rows[0]?.settings || null,
            summary,
            applications: rows,
        });
    } catch (err: any) {
        console.error("Fetch event applications error:", err);
        return res.status(500).json({ success: false, message: "Failed to load event applications." });
    }
});

/**
 * PATCH /api/club/events/:eventId/applications/:registrationId
 * Updates status of an applicant (pending, registered, attended, waitlisted, rejected, cancelled).
 */
clubRouter.patch("/events/:eventId/applications/:registrationId", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId, registrationId } = req.params;
        const { status, reviewNotes } = req.body;
        const userId = req.user!.id;

        const allowedStatuses = ["pending", "registered", "attended", "waitlisted", "rejected", "cancelled"];
        if (!status || !allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Valid status is required (${allowedStatuses.join(", ")}).`,
            });
        }

        const eventRes = await query(
            `SELECT e.id, e.club_id, e.title, vc.name AS "clubName"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1 LIMIT 1;`,
            [eventId]
        );
        if (!eventRes.rows[0]) return res.status(404).json({ success: false, message: "Event not found." });

        const staffClub = await getStaffClub(userId, eventRes.rows[0].club_id);
        if (!staffClub) return res.status(403).json({ success: false, message: "Access forbidden." });

        // Enforce Minor Protection: Cannot approve an under-18 attendee without verified guardian consent
        if (status === "registered" || status === "attended") {
            const curRegRes = await query(
                `SELECT is_attendee_under_18, guardian_consent_status FROM club_event_registrations WHERE id = $1::uuid AND event_id = $2::uuid LIMIT 1;`,
                [registrationId, eventId]
            );
            const curReg = curRegRes.rows[0];
            if (curReg?.is_attendee_under_18 && curReg?.guardian_consent_status !== "verified") {
                return res.status(400).json({
                    success: false,
                    code: "GUARDIAN_CONSENT_REQUIRED",
                    message: `Cannot approve applicant under 18 years of age: Verifiable parental/guardian consent is currently "${curReg.guardian_consent_status || 'pending'}". Electronic guardian verification must be completed first.`,
                });
            }
        }

        const isAttended = status === "attended";
        const updateRes = await query(
            `UPDATE club_event_registrations
             SET status = $1::varchar,
                 reviewed_at = NOW(),
                 reviewed_by_user_id = $2::uuid,
                 review_notes = COALESCE($3, review_notes),
                 checked_in_at = CASE WHEN $6::boolean = true AND checked_in_at IS NULL THEN NOW() ELSE checked_in_at END,
                 updated_at = NOW()
             WHERE id = $4::uuid AND event_id = $5::uuid
             RETURNING id, user_id AS "userId", applicant_name AS "applicantName", applicant_email AS "applicantEmail",
                       department, year_of_study AS "yearOfStudy", roll_number AS "rollNumber",
                       status, ticket_code AS "ticketCode", checked_in_at AS "checkedInAt", reviewed_at AS "reviewedAt", updated_at AS "updatedAt";`,
            [status, userId, reviewNotes || null, registrationId, eventId, isAttended]
        );

        if (!updateRes.rows[0]) return res.status(404).json({ success: false, message: "Registration record not found." });

        const updatedRow = updateRes.rows[0];

        // Send real-time notification to applicant on status change
        try {
            const applicantUserRes = await query(`SELECT id, username FROM users WHERE id = $1::uuid LIMIT 1;`, [updatedRow.userId]);
            if (applicantUserRes.rows[0]) {
                const appUser = applicantUserRes.rows[0];
                const eventTitle = eventRes.rows[0].title;
                const clubName = eventRes.rows[0].clubName;
                const clubSlug = eventRes.rows[0].clubSlug;
                const startsAt = eventRes.rows[0].starts_at;
                const venueOrLocation = eventRes.rows[0].venue_or_location;

                if (status === "registered") {
                    await query(
                        `INSERT INTO user_notifications (
                            user_id, recipient_id, username, title, body, type, notification_type, metadata, idempotency_key, is_read, created_at
                        ) VALUES (
                            $1::uuid, $1::uuid, $2,
                            'Application Accepted! 🎉',
                            $3,
                            'club_event',
                            'application_approved',
                            $4::jsonb,
                            $5,
                            false,
                            NOW()
                        ) ON CONFLICT (idempotency_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, metadata = EXCLUDED.metadata;`,
                        [
                            appUser.id,
                            appUser.username,
                            `Your application for "${eventTitle}" was accepted by ${clubName}. Your session entry pass is now ready!`,
                            JSON.stringify({
                                eventId,
                                registrationId,
                                ticketCode: updatedRow.ticketCode,
                                eventTitle,
                                clubName,
                                clubSlug: clubSlug || "",
                                startsAt,
                                venueOrLocation,
                                applicantName: updatedRow.applicantName,
                                rollNumber: updatedRow.rollNumber,
                                department: updatedRow.department,
                                action: "application_approved",
                                status: "registered",
                            }),
                            `app-approved-${registrationId}-${Date.now()}`,
                        ]
                    );
                } else if (status === "rejected") {
                    await query(
                        `INSERT INTO user_notifications (
                            user_id, recipient_id, username, title, body, type, notification_type, metadata, idempotency_key, is_read, created_at
                        ) VALUES (
                            $1::uuid, $1::uuid, $2,
                            'Application Update',
                            $3,
                            'club_event',
                            'application_rejected',
                            $4::jsonb,
                            $5,
                            false,
                            NOW()
                        ) ON CONFLICT (idempotency_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, metadata = EXCLUDED.metadata;`,
                        [
                            appUser.id,
                            appUser.username,
                            `Your application for "${eventTitle}" was not selected by ${clubName}.`,
                            JSON.stringify({
                                eventId,
                                registrationId,
                                eventTitle,
                                clubName,
                                action: "application_rejected",
                                status: "rejected",
                            }),
                            `app-rejected-${registrationId}-${Date.now()}`,
                        ]
                    );
                }
            }
        } catch (notifErr) {
            console.warn("Applicant notification warning (non-fatal):", notifErr);
        }

        return res.json({ success: true, message: `Applicant status updated to ${status}.`, registration: updatedRow });
    } catch (err: any) {
        console.error("Update applicant status error:", err);
        return res.status(500).json({ success: false, message: "Failed to update status." });
    }
});

/**
 * GET /api/club/events/:eventId/applications/export
 * Downloads the applications list as an Excel-compatible RFC-4180 CSV with UTF-8 BOM.
 */
clubRouter.get("/events/:eventId/applications/export", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const userId = req.user!.id;

        const eventRes = await query(
            `SELECT e.id, e.club_id, e.title, vc.name AS "clubName"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1 LIMIT 1;`,
            [eventId]
        );
        if (!eventRes.rows[0]) return res.status(404).send("Event not found.");

        const staffClub = await getStaffClub(userId, eventRes.rows[0].club_id);
        if (!staffClub) return res.status(403).send("Forbidden.");

        const applicantsRes = await query(
            `SELECT
                r.ticket_code,
                COALESCE(r.applicant_name, TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                u.username,
                COALESCE(r.applicant_email, u.email) AS email,
                COALESCE(u.photo_url, u.avatar_url, '') AS avatar_url,
                COALESCE(r.institution_name, '') AS institution_name,
                COALESCE(r.university_name, '') AS university_name,
                COALESCE(r.institution_city, '') AS institution_city,
                COALESCE(r.institution_state, '') AS institution_state,
                COALESCE(r.institution_verification_status, 'unverified') AS institution_verification_status,
                COALESCE(r.department, '') AS department,
                COALESCE(r.year_of_study, '') AS year_of_study,
                COALESCE(r.roll_number, '') AS roll_number,
                COALESCE(r.phone_number, '') AS phone,
                r.status,
                r.registered_at,
                r.reviewed_at,
                r.checked_in_at,
                COALESCE(r.notes, '') AS notes,
                r.answers,
                r.form_response,
                r.file_attachments
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1 AND r.club_id = $2
             ORDER BY r.registered_at ASC;`,
            [eventId, eventRes.rows[0].club_id]
        );

        // Fetch form structure to extract custom dynamic question headers
        const formRes = await query(
            `SELECT structure FROM club_event_forms WHERE event_id = $1 LIMIT 1;`,
            [eventId]
        );
        let formStructure = formRes.rows[0]?.structure;
        if (!formStructure || !Array.isArray(formStructure?.sections) || formStructure.sections.length === 0) {
            const versionRes = await query(
                `SELECT structure FROM club_event_form_versions
                 WHERE event_id = $1
                 ORDER BY is_published DESC, version_number DESC LIMIT 1;`,
                [eventId]
            );
            if (versionRes.rows[0]?.structure) {
                formStructure = versionRes.rows[0].structure;
            }
        }

        const customQuestions: { id: string; title: string; type: string }[] = [];
        const seenQuestionIds = new Set<string>();

        if (formStructure && Array.isArray(formStructure.sections)) {
            formStructure.sections.forEach((sec: any) => {
                (sec.questions || sec.fields || []).forEach((q: any) => {
                    if (
                        q &&
                        q.id &&
                        !seenQuestionIds.has(q.id) &&
                        q.type !== "image_card" &&
                        q.type !== "markdown_card" &&
                        q.type !== "image_block" &&
                        q.type !== "video_block" &&
                        q.type !== "title_card"
                    ) {
                        seenQuestionIds.add(q.id);
                        customQuestions.push({
                            id: q.id,
                            title: q.title || q.label || "Question",
                            type: q.type || "text",
                        });
                    }
                });
            });
        }

        // Also discover any other submitted question keys in answers
        applicantsRes.rows.forEach((r) => {
            const ansObj = { ...(r.form_response || {}), ...(r.answers || {}) };
            Object.keys(ansObj).forEach((k) => {
                if (
                    k === "q_roll_number" ||
                    k === "q_department" ||
                    k === "q_year" ||
                    k === "q_student_name" ||
                    k === "q_student_email" ||
                    k === "q_phone" ||
                    k === "id" ||
                    k === "eventId" ||
                    k === "userId"
                ) {
                    return;
                }
                if (!seenQuestionIds.has(k)) {
                    seenQuestionIds.add(k);
                    let title = k;
                    if (title.startsWith("q_")) {
                        title = title.substring(2).replace(/_/g, " ");
                        title = title.charAt(0).toUpperCase() + title.slice(1);
                    }
                    customQuestions.push({
                        id: k,
                        title,
                        type: "text",
                    });
                }
            });
        });

        const escapeCsv = (val: any) => {
            if (val === null || val === undefined) return '""';
            let str = String(val);
            if (typeof val === "object") {
                str = JSON.stringify(val);
            }
            // CSV Injection Protection (RFC-4180 / Spreadsheet security)
            if (/^[=+\-@\t\r]/.test(str)) {
                str = `'${str}`;
            }
            str = str.replace(/"/g, '""');
            return `"${str}"`;
        };

        const standardHeaders = [
            "Ticket Code",
            "Name",
            "Username",
            "Email",
            "Roll Number / Student ID",
            "Department",
            "Year of Study",
            "Phone Number",
            "Institution / College",
            "University",
            "City",
            "State",
            "Status",
            "Applied At",
            "Reviewed At",
            "Checked In At",
            "Notes",
        ];

        // Append custom question titles
        const headers = [
            ...standardHeaders,
            ...customQuestions.map((q) => q.title),
        ];

        const rows = applicantsRes.rows.map((r) => {
            const ansObj = { ...(r.form_response || {}), ...(r.answers || {}) };
            const attachments = r.file_attachments || [];

            const standardRow = [
                escapeCsv(r.ticket_code),
                escapeCsv(r.name),
                escapeCsv(r.username),
                escapeCsv(r.email),
                escapeCsv(r.roll_number || ansObj["q_roll_number"] || ""),
                escapeCsv(r.department || ansObj["q_department"] || ""),
                escapeCsv(r.year_of_study || ansObj["q_year"] || ""),
                escapeCsv(r.phone || ansObj["q_phone"] || ""),
                escapeCsv(r.institution_name),
                escapeCsv(r.university_name),
                escapeCsv(r.institution_city),
                escapeCsv(r.institution_state),
                escapeCsv(r.status === "registered" ? "accepted" : r.status),
                escapeCsv(r.registered_at ? new Date(r.registered_at).toISOString() : ""),
                escapeCsv(r.reviewed_at ? new Date(r.reviewed_at).toISOString() : ""),
                escapeCsv(r.checked_in_at ? new Date(r.checked_in_at).toISOString() : ""),
                escapeCsv(r.notes),
            ];

            const customValues = customQuestions.map((q) => {
                if (q.type === "file_upload") {
                    const matchedFiles = attachments.filter((f: any) => f.questionId === q.id);
                    if (matchedFiles.length > 0) {
                        return escapeCsv(matchedFiles.map((f: any) => f.fileUrl).join(" ; "));
                    }
                }
                let val = ansObj[q.id];
                if (val === undefined && q.id.startsWith("q_")) {
                    val = ansObj[q.id.replace(/^q_/, "")];
                } else if (val === undefined) {
                    val = ansObj[`q_${q.id}`];
                }

                if (Array.isArray(val)) {
                    return escapeCsv(val.join(", "));
                }
                if (typeof val === "object" && val !== null) {
                    return escapeCsv(Object.entries(val).map(([k, v]) => `${k}: ${v}`).join("; "));
                }
                return escapeCsv(val ?? "");
            });

            return [...standardRow, ...customValues].join(",");
        });

        const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
        const safeTitle = (eventRes.rows[0].title || "event").replace(/[^a-zA-Z0-9_-]/g, "_");

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_applications.csv"`);
        return res.status(200).send(csvContent);
    } catch (err: any) {
        console.error("Export applications error:", err);
        return res.status(500).send("Export failed.");
    }
});

/**
 * POST /api/club/events/:eventId/checkin
 * Checks in an attendee for an event. Enforces block check.
 */
clubRouter.post("/events/:eventId/checkin", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const { ticketCode, attendeeUserId } = req.body;
        const targetUserId = attendeeUserId || req.user!.id;

        const eventRes = await query(`SELECT club_id FROM club_events WHERE id = $1 LIMIT 1;`, [eventId]);
        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const clubId = eventRes.rows[0].club_id;

        // Block check
        const mod = await getClubModerationState(clubId, targetUserId);
        if (mod.isBlocked) {
            return res.status(403).json({
                success: false,
                code: "ACCESS_RESTRICTED",
                message: "Access Restricted: This attendee has been blocked by the club and cannot attend.",
            });
        }

        const updateRes = await query(
            `UPDATE club_event_registrations
             SET status = 'attended', checked_in_at = NOW(), updated_at = NOW()
             WHERE event_id = $1 AND (user_id = $2 OR ticket_code = $3) AND status = 'registered'
             RETURNING id, user_id, status, checked_in_at;`,
            [eventId, targetUserId, ticketCode || ""]
        );

        if (!updateRes.rows[0]) {
            return res.status(400).json({ success: false, message: "No active registration found or already checked in." });
        }

        return res.json({ success: true, message: "Attendee checked in successfully.", checkin: updateRes.rows[0] });
    } catch (err: any) {
        console.error("Event checkin error:", err);
        return res.status(500).json({ success: false, message: "Failed to check in." });
    }
});

/**
 * POST /api/club/events/:eventId/checkin-verify
 * Scans or pastes a ticketCode for live entry pass verification and check-in.
 * Returns the full user identity profile (database personal & academic info, social links,
 * plus check-in state).
 */
clubRouter.post("/events/:eventId/checkin-verify", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isEventUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isEventUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const { ticketCode, forceCheckIn } = req.body;
        const staffUserId = req.user!.id;

        if (!ticketCode || typeof ticketCode !== "string" || !ticketCode.trim()) {
            return res.status(400).json({ success: false, message: "Valid ticketCode or student ID is required." });
        }

        let cleanCode = ticketCode.trim();

        // 1. If payload is raw JSON (from custom QR generators), extract ticketCode or id
        if (cleanCode.startsWith("{") && cleanCode.endsWith("}")) {
            try {
                const parsed = JSON.parse(cleanCode);
                cleanCode = parsed.ticketCode || parsed.ticket_code || parsed.id || parsed.registrationId || parsed.code || cleanCode;
            } catch {}
        }

        // 2. If payload is a URL, extract code, ticketCode, or id from query params or path
        if (cleanCode.includes("?") || cleanCode.includes("/")) {
            try {
                const urlMatch = cleanCode.match(/(?:ticketCode|code|id|registrationId)=([A-Za-z0-9_-]+)/i);
                if (urlMatch && urlMatch[1]) {
                    cleanCode = urlMatch[1];
                } else if (!cleanCode.includes("?")) {
                    const parts = cleanCode.split("/").filter(Boolean);
                    if (parts.length > 0) {
                        const lastPart = parts[parts.length - 1];
                        if (lastPart && lastPart.length >= 6) {
                            cleanCode = lastPart;
                        }
                    }
                }
            } catch {}
        }

        cleanCode = cleanCode.trim();
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanCode);

        const eventRes = await query(
            `SELECT e.id, e.club_id, e.title, vc.name AS "clubName"
             FROM club_events e
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE e.id = $1::uuid LIMIT 1;`,
            [eventId]
        );
        if (!eventRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const event = eventRes.rows[0];

        // Staff access check
        const staffClub = await getStaffClub(staffUserId, event.club_id);
        if (!staffClub) {
            return res.status(403).json({ success: false, message: "Access forbidden. Club staff only." });
        }

        // Query registration with complete user profile information (matches ticket code, registration id, user id, or student roll number)
        const regRes = await query(
            `SELECT 
                r.id AS "registrationId",
                r.event_id AS "eventId",
                r.club_id AS "clubId",
                r.user_id AS "userId",
                r.status,
                r.ticket_code AS "ticketCode",
                r.registered_at AS "registeredAt",
                r.checked_in_at AS "checkedInAt",
                r.department,
                r.year_of_study AS "yearOfStudy",
                r.roll_number AS "rollNumber",
                r.phone_number AS "phoneNumber",
                r.notes,
                r.reviewed_at AS "reviewedAt",
                r.review_notes AS "reviewNotes",
                u.username,
                u.firstname AS "firstName",
                u.middlename AS "middleName",
                u.lastname AS "lastName",
                u.email,
                COALESCE(u.avatar_url, u.photo_url) AS "avatarUrl",
                u.cover_image_url AS "coverImageUrl",
                u.headline,
                u.bio,
                u.location,
                COALESCE(u.college, inst.name) AS "collegeName",
                u.website,
                u.linkedin,
                u.github,
                u.custom_link AS "customLink",
                u.links,
                u.skills,
                u.phone,
                u.is_phone_verified AS "isPhoneVerified",
                u.is_email_verified AS "isEmailVerified",
                u.created_at AS "memberSince"
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             LEFT JOIN institutions inst ON inst.id = u.college_id
             WHERE r.event_id = $1::uuid 
               AND (
                   UPPER(TRIM(r.ticket_code)) = UPPER(TRIM($2))
                   OR ($3::boolean = TRUE AND (r.id = $2::uuid OR r.user_id = $2::uuid))
                   OR (r.roll_number IS NOT NULL AND UPPER(TRIM(r.roll_number)) = UPPER(TRIM($2)))
               )
             LIMIT 1;`,
            [eventId, cleanCode, isUuid]
        );

        if (!regRes.rows[0]) {
            return res.status(404).json({
                success: false,
                code: "TICKET_NOT_FOUND",
                message: `Pass ID / Ticket "${cleanCode}" was not found for this event. Please verify the code or ID and try again.`,
            });
        }

        const row = regRes.rows[0];

        // Moderation block check
        const mod = await getClubModerationState(event.club_id, row.userId);
        if (mod.isBlocked) {
            return res.status(403).json({
                success: false,
                code: "ACCESS_RESTRICTED",
                message: "Access Restricted: This attendee has been blocked by the club.",
                attendee: row,
            });
        }

        let actionTaken: "checked_in" | "already_checked_in" | "pending" | "invalid_status" = "invalid_status";
        let message = "";

        if (row.status === "registered" || (row.status === "pending" && forceCheckIn === true)) {
            // Perform check-in!
            const checkinRes = await query(
                `UPDATE club_event_registrations
                 SET status = 'attended',
                     checked_in_at = NOW(),
                     reviewed_at = COALESCE(reviewed_at, NOW()),
                     reviewed_by_user_id = COALESCE(reviewed_by_user_id, $2::uuid),
                     updated_at = NOW()
                 WHERE id = $1::uuid
                 RETURNING checked_in_at AS "checkedInAt";`,
                [row.registrationId, staffUserId]
            );

            row.status = "attended";
            row.checkedInAt = checkinRes.rows[0]?.checkedInAt || new Date().toISOString();
            actionTaken = "checked_in";
            message = `Verified & Checked-In successfully! Welcome, ${row.firstName || row.username}.`;

            // Real-time in-app notification
            try {
                await query(
                    `INSERT INTO user_notifications (
                        user_id, recipient_id, username, title, body, type, notification_type, metadata, idempotency_key, is_read, created_at
                    ) VALUES (
                        $1::uuid, $1::uuid, $2,
                        'Checked In to Event! 🎟️',
                        $3,
                        'club_event',
                        'event_checkin',
                        $4::jsonb,
                        $5,
                        false,
                        NOW()
                    ) ON CONFLICT (idempotency_key) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, metadata = EXCLUDED.metadata;`,
                    [
                        row.userId,
                        row.username,
                        `You have been checked in to "${event.title}" by ${event.clubName}. Welcome to the session!`,
                        JSON.stringify({ eventId, ticketCode: row.ticketCode, clubName: event.clubName }),
                        `app-checkin-${row.registrationId}-${Date.now()}`,
                    ]
                );
            } catch (notifErr) {
                console.warn("Check-in notification error (non-fatal):", notifErr);
            }
        } else if (row.status === "attended") {
            actionTaken = "already_checked_in";
            message = `Attendee was already checked in at ${new Date(row.checkedInAt).toLocaleTimeString()}.`;
        } else if (row.status === "pending") {
            actionTaken = "pending";
            message = `Registration status is currently PENDING review. You can click 'Admit & Check-In' to verify entry.`;
        } else {
            actionTaken = "invalid_status";
            message = `Ticket status is "${row.status.toUpperCase()}". Admission cannot be completed.`;
        }

        return res.json({
            success: true,
            actionTaken,
            message,
            attendee: row,
        });
    } catch (err: any) {
        console.error("Check-in verify error:", err);
        return res.status(500).json({ success: false, message: "Internal server error during verification." });
    }
});

// =========================================================================
// CLUB STAFF INBOX & MODERATION ENDPOINTS
// =========================================================================

/**
 * GET /api/club/inbox
 * Fetches conversations for the authenticated club staff.
 * Filters: 'inbox' (normal/unmuted), 'muted' (filtered), 'archived', 'all'.
 */
clubRouter.get("/inbox", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden: verified club staff only." });

        const filter = (req.query.filter as string) || "inbox";
        const search = ((req.query.search as string) || "").trim().toLowerCase();

        let sql = `
            SELECT
                c.id,
                c.club_id AS "clubId",
                c.user_id AS "userId",
                c.subject,
                c.status,
                c.is_read_by_club AS "isReadByClub",
                c.last_message_preview AS "lastMessagePreview",
                c.last_message_at AS "lastMessageAt",
                c.created_at AS "createdAt",
                u.username,
                u.firstname AS "firstName",
                u.lastname AS "lastName",
                COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                u.email,
                COALESCE(m.is_muted, false) AS "isMuted",
                COALESCE(m.is_blocked, false) AS "isBlocked"
            FROM club_conversations c
            JOIN users u ON u.id = c.user_id
            LEFT JOIN club_user_moderation m ON m.club_id = c.club_id AND m.user_id = c.user_id
            WHERE c.club_id = $1
        `;
        const params: any[] = [club.id];

        if (filter === "muted") {
            sql += ` AND m.is_muted = true AND c.status != 'archived'`;
        } else if (filter === "archived") {
            sql += ` AND c.status = 'archived'`;
        } else if (filter === "inbox") {
            sql += ` AND (m.is_muted IS NULL OR m.is_muted = false) AND c.status != 'archived'`;
        }

        if (search) {
            params.push(`%${search}%`);
            sql += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(u.firstname) LIKE $${params.length} OR LOWER(u.lastname) LIKE $${params.length} OR LOWER(c.subject) LIKE $${params.length} OR LOWER(c.last_message_preview) LIKE $${params.length})`;
        }

        sql += ` ORDER BY c.last_message_at DESC LIMIT 100;`;

        const result = await query(sql, params);
        return res.json({ success: true, count: result.rows.length, conversations: result.rows });
    } catch (err: any) {
        console.error("GET /api/club/inbox error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve club inbox." });
    }
});

/**
 * GET /api/club/inbox/unread-count
 * Returns real-time unread count and muted count for the club inbox badge.
 */
clubRouter.get("/inbox/unread-count", authenticate, async (req: Request, res: Response) => {
    try {
        const requestedClubId = (req.query.clubId as string) || undefined;
        const club = await getStaffClub(req.user!.id, requestedClubId);
        if (!club) {
            return res.json({
                success: true,
                counts: { unreadCount: 0, mutedCount: 0, totalCount: 0 },
            });
        }

        const countsRes = await query(
            `SELECT
                COUNT(*) FILTER (WHERE c.is_read_by_club = false AND (m.is_muted IS NULL OR m.is_muted = false) AND c.status != 'archived')::int AS "unreadCount",
                COUNT(*) FILTER (WHERE m.is_muted = true)::int AS "mutedCount",
                COUNT(*)::int AS "totalCount"
             FROM club_conversations c
             LEFT JOIN club_user_moderation m ON m.club_id = c.club_id AND m.user_id = c.user_id
             WHERE c.club_id = $1;`,
            [club.id]
        );

        return res.json({
            success: true,
            counts: countsRes.rows[0] || { unreadCount: 0, mutedCount: 0, totalCount: 0 },
        });
    } catch (err: any) {
        console.error("GET /api/club/inbox/unread-count error:", err);
        return res.status(200).json({
            success: true,
            counts: { unreadCount: 0, mutedCount: 0, totalCount: 0 },
        });
    }
});

/**
 * GET /api/club/inbox/:conversationId/messages
 * Retrieves full chronological message history for a conversation and auto-marks it as read.
 */
clubRouter.get("/inbox/:conversationId/messages", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { conversationId } = req.params;

        const convRes = await query(
            `SELECT
                c.id,
                c.club_id AS "clubId",
                c.user_id AS "userId",
                c.subject,
                c.status,
                c.is_read_by_club AS "isReadByClub",
                c.last_message_at AS "lastMessageAt",
                c.created_at AS "createdAt",
                u.username,
                u.firstname AS "firstName",
                u.lastname AS "lastName",
                COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                u.email,
                COALESCE(m.is_muted, false) AS "isMuted",
                COALESCE(m.is_blocked, false) AS "isBlocked",
                m.mute_reason AS "muteReason",
                m.block_reason AS "blockReason"
             FROM club_conversations c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN club_user_moderation m ON m.club_id = c.club_id AND m.user_id = c.user_id
             WHERE c.id = $1 AND c.club_id = $2
             LIMIT 1;`,
            [conversationId, club.id]
        );

        if (!convRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Conversation not found." });
        }

        // Auto mark as read by club
        await query(`UPDATE club_conversations SET is_read_by_club = true, updated_at = NOW() WHERE id = $1;`, [conversationId]);

        const msgsRes = await query(
            `SELECT
                m.id,
                m.conversation_id AS "conversationId",
                m.sender_id AS "senderId",
                m.sender_type AS "senderType",
                m.body,
                m.is_muted_delivery AS "isMutedDelivery",
                m.created_at AS "createdAt",
                u.username AS "senderUsername",
                u.firstname AS "senderFirstName",
                COALESCE(u.photo_url, u.avatar_url) AS "senderAvatarUrl"
             FROM club_messages m
             JOIN users u ON u.id = m.sender_id
             WHERE m.conversation_id = $1
             ORDER BY m.created_at ASC;`,
            [conversationId]
        );

        return res.json({
            success: true,
            conversation: convRes.rows[0],
            messages: msgsRes.rows,
        });
    } catch (err: any) {
        console.error("GET conversation messages error:", err);
        return res.status(500).json({ success: false, message: "Failed to fetch messages." });
    }
});

/**
 * POST /api/club/inbox/:conversationId/reply
 * Club staff sends reply to the user.
 */
clubRouter.post("/inbox/:conversationId/reply", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { conversationId } = req.params;
        const { body } = req.body;

        const result = await sendClubReply({
            clubId: club.id,
            staffId: req.user!.id,
            conversationId: String(conversationId),
            body,
        });

        if (!result.success) {
            return res.status(400).json({ success: false, message: result.error });
        }

        return res.status(201).json({ success: true, message: "Reply sent successfully.", reply: result.message });
    } catch (err: any) {
        console.error("POST club reply error:", err);
        return res.status(500).json({ success: false, message: "Failed to post reply." });
    }
});

/**
 * PATCH /api/club/inbox/:conversationId/read
 */
clubRouter.patch("/inbox/:conversationId/read", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { conversationId } = req.params;
        const { isRead = true } = req.body;

        await query(
            `UPDATE club_conversations SET is_read_by_club = $1, updated_at = NOW() WHERE id = $2 AND club_id = $3;`,
            [Boolean(isRead), conversationId, club.id]
        );

        return res.json({ success: true, message: "Conversation read state updated." });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to update read state." });
    }
});

/**
 * PATCH /api/club/inbox/:conversationId/archive
 */
clubRouter.patch("/inbox/:conversationId/archive", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { conversationId } = req.params;
        const { isArchived = true } = req.body;

        await query(
            `UPDATE club_conversations SET status = $1, updated_at = NOW() WHERE id = $2 AND club_id = $3;`,
            [isArchived ? "archived" : "open", conversationId, club.id]
        );

        return res.json({ success: true, message: isArchived ? "Conversation archived." : "Conversation restored to inbox." });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to update archive state." });
    }
});

// Moderation Endpoints
clubRouter.post("/moderation/mute", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { userId, reason } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

        const state = await muteUserForClub({ clubId: club.id, userId, staffId: req.user!.id, reason });
        return res.json({ success: true, message: "User muted for this club.", state });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to mute user." });
    }
});

clubRouter.post("/moderation/unmute", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

        const state = await unmuteUserForClub(club.id, userId);
        return res.json({ success: true, message: "User unmuted.", state });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to unmute user." });
    }
});

clubRouter.post("/moderation/block", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { userId, reason } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

        const state = await blockUserForClub({ clubId: club.id, userId, staffId: req.user!.id, reason });
        return res.json({ success: true, message: "User blocked from this club.", state });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to block user." });
    }
});

clubRouter.post("/moderation/unblock", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { userId } = req.body;
        if (!userId) return res.status(400).json({ success: false, message: "User ID is required." });

        const state = await unblockUserForClub(club.id, userId);
        return res.json({ success: true, message: "User unblocked.", state });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to unblock user." });
    }
});

clubRouter.get("/moderation/list", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const list = await listModeratedUsers(club.id);
        return res.json({ success: true, count: list.length, list });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "Failed to list moderation list." });
    }
});

// ============================================================================
// CERTIFICATES & CREDENTIAL ISSUANCE SYSTEM
// High-throughput, production-grade certificate management with strict eligibility
// ============================================================================

/**
 * GET /api/club/certificates/events
 * Returns the club's events for selecting in event-based certificate issuance.
 */
clubRouter.get("/certificates/events", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const eventsRes = await query(
            `SELECT
                e.id,
                e.title,
                e.slug,
                e.starts_at AS "startsAt",
                e.status,
                e.venue_or_location AS "venueOrLocation",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations r WHERE r.event_id = e.id AND r.status = 'attended'), 0) AS "attendeesCount",
                COALESCE((SELECT COUNT(*)::int FROM club_event_registrations r WHERE r.event_id = e.id AND r.status != 'cancelled'), 0) AS "registrationsCount",
                COALESCE((SELECT COUNT(*)::int FROM club_certificates c WHERE c.event_id = e.id), 0) AS "certificatesIssuedCount"
             FROM club_events e
             WHERE e.club_id = $1
             ORDER BY e.starts_at DESC;`,
            [club.id]
        );

        return res.json({ success: true, events: eventsRes.rows });
    } catch (err: any) {
        console.error("Fetch certificate events error:", err);
        return res.status(500).json({ success: false, message: "Failed to load events for certificates." });
    }
});

/**
 * GET /api/club/certificates/event/:eventId/recipients
 * Returns all participants/attendees for a specific event with attendance and certificate status.
 */
clubRouter.get("/certificates/event/:eventId/recipients", authenticate, async (req: Request, res: Response) => {
    try {
        const { eventId } = req.params;
        const isUuid = Boolean(typeof eventId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(eventId));
        if (!isUuid) {
            return res.status(404).json({ success: false, message: "Event not found." });
        }
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const eventRes = await query(`SELECT id, title, starts_at FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`, [eventId, club.id]);
        if (!eventRes.rows[0]) return res.status(404).json({ success: false, message: "Event not found for this club." });

        const recipientsRes = await query(
            `SELECT
                r.id AS "registrationId",
                u.id AS "userId",
                COALESCE(r.applicant_name, TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                COALESCE(r.applicant_email, u.email) AS email,
                u.username,
                COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                r.status,
                r.ticket_code AS "ticketCode",
                r.checked_in_at AS "checkedInAt",
                COALESCE(r.department, '') AS department,
                COALESCE(r.year_of_study, '') AS "yearOfStudy",
                COALESCE(r.roll_number, '') AS "rollNumber",
                EXISTS(SELECT 1 FROM club_certificates cc WHERE cc.event_id = $1 AND cc.user_id = u.id) AS "alreadyHasCert"
             FROM club_event_registrations r
             JOIN users u ON u.id = r.user_id
             WHERE r.event_id = $1 AND r.club_id = $2
             ORDER BY CASE WHEN r.status = 'attended' THEN 0 WHEN r.status = 'registered' THEN 1 ELSE 2 END, r.registered_at ASC;`,
            [eventId, club.id]
        );

        return res.json({
            success: true,
            event: eventRes.rows[0],
            recipients: recipientsRes.rows,
        });
    } catch (err: any) {
        console.error("Fetch event recipients error:", err);
        return res.status(500).json({ success: false, message: "Failed to load event participants." });
    }
});

/**
 * GET /api/club/certificates/eligible-recipients
 * Returns connected and credible students for the club:
 * 1. Same college campus as club
 * 2. Attended or registered for club events
 * 3. Active club team members / coordinators
 * Enriched with credibility metrics (attended count, team role, affiliation).
 */
clubRouter.get("/certificates/eligible-recipients", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const { search = "", category = "all" } = req.query as { search?: string; category?: string };

        const eligibleRes = await query(
            `WITH club_info AS (
                SELECT id, college_id, auth_user_id FROM verified_clubs WHERE id = $1
            )
            SELECT DISTINCT
                u.id,
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                u.username,
                u.email,
                COALESCE(u.photo_url, u.avatar_url) AS "avatarUrl",
                u.college_id AS "collegeId",
                c.name AS "collegeName",
                (u.college_id IS NOT NULL AND u.college_id = ci.college_id) AS "isSameCollege",
                COALESCE(att.attended_count, 0) AS "eventsAttendedCount",
                COALESCE(reg.registered_count, 0) AS "eventsRegisteredCount",
                CASE WHEN tm.id IS NOT NULL OR u.id = ci.auth_user_id THEN true ELSE false END AS "isTeamMember",
                COALESCE(tm.role_title, CASE WHEN u.id = ci.auth_user_id THEN 'Club Lead' ELSE NULL END) AS "teamRole",
                latest.latest_event_title AS "latestEventTitle",
                latest.latest_event_date AS "latestEventDate",
                COALESCE(cert_count.total_certs, 0) AS "existingCertsCount"
            FROM users u
            CROSS JOIN club_info ci
            LEFT JOIN colleges c ON u.college_id = c.id
            LEFT JOIN (
                SELECT user_id, COUNT(*)::int AS attended_count
                FROM club_event_registrations
                WHERE club_id = $1 AND status = 'attended'
                GROUP BY user_id
            ) att ON att.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*)::int AS registered_count
                FROM club_event_registrations
                WHERE club_id = $1 AND status != 'cancelled'
                GROUP BY user_id
            ) reg ON reg.user_id = u.id
            LEFT JOIN (
                SELECT DISTINCT ON (user_id) user_id, title AS role_title, id
                FROM club_team_members
                WHERE club_id = $1 AND status = 'active'
                ORDER BY user_id, created_at DESC
            ) tm ON tm.user_id = u.id
            LEFT JOIN (
                SELECT DISTINCT ON (r.user_id) r.user_id, e.title AS latest_event_title, e.starts_at AS latest_event_date
                FROM club_event_registrations r
                JOIN club_events e ON e.id = r.event_id
                WHERE r.club_id = $1 AND r.status IN ('registered', 'attended')
                ORDER BY r.user_id, r.registered_at DESC
            ) latest ON latest.user_id = u.id
            LEFT JOIN (
                SELECT user_id, COUNT(*)::int AS total_certs
                FROM club_certificates
                WHERE club_id = $1
                GROUP BY user_id
            ) cert_count ON cert_count.user_id = u.id
            WHERE (
                (u.college_id IS NOT NULL AND u.college_id = ci.college_id)
                OR COALESCE(reg.registered_count, 0) > 0
                OR tm.id IS NOT NULL
                OR u.id = ci.auth_user_id
            )
            ORDER BY "eventsAttendedCount" DESC, "isTeamMember" DESC, name ASC
            LIMIT 300;`,
            [club.id]
        );

        let list = eligibleRes.rows.map((row) => {
            // Determine credibility category & score
            let credibilityCategory = "campus_student";
            let credibilityBadge = "Campus Verified";
            let credibilityRank = 1;

            if (row.eventsAttendedCount > 0) {
                credibilityCategory = "event_attendee";
                credibilityBadge = row.eventsAttendedCount > 1
                    ? `Top Participant (${row.eventsAttendedCount} Events)`
                    : `Verified Attendee (1 Event)`;
                credibilityRank = 3;
            } else if (row.isTeamMember) {
                credibilityCategory = "team_member";
                credibilityBadge = `Team (${row.teamRole || "Core"})`;
                credibilityRank = 2;
            } else if (row.eventsRegisteredCount > 0) {
                credibilityCategory = "event_registered";
                credibilityBadge = "Registered Participant";
                credibilityRank = 1.5;
            }

            return {
                ...row,
                credibilityCategory,
                credibilityBadge,
                credibilityRank,
            };
        });

        // Filter by category if requested
        if (category === "attendees") {
            list = list.filter((item) => item.eventsAttendedCount > 0);
        } else if (category === "team") {
            list = list.filter((item) => item.isTeamMember);
        } else if (category === "campus") {
            list = list.filter((item) => item.isSameCollege);
        }

        // Filter by search query
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(
                (item) =>
                    item.name.toLowerCase().includes(q) ||
                    item.username.toLowerCase().includes(q) ||
                    item.email.toLowerCase().includes(q)
            );
        }

        return res.json({
            success: true,
            totalEligible: list.length,
            recipients: list,
        });
    } catch (err: any) {
        console.error("Fetch eligible certificate recipients error:", err);
        return res.status(500).json({ success: false, message: "Failed to load eligible students." });
    }
});

/**
 * POST /api/club/certificates/issue
 * Production-grade bulk certificate issuance:
 * - Strictly enforces eligibility: recipient must be from same college, attended an event, or be a team member
 * - Generates unique verifiable credential code: ORB-[CLUB]-[YEAR]-[HASH]
 * - Creates in-app notifications in user_notifications
 * - Protected by database transactions
 */
clubRouter.post("/certificates/issue", authenticate, async (req: Request, res: Response) => {
    try {
        const staffUserId = req.user!.id;
        const club = await getStaffClub(staffUserId);
        if (!club) {
            return res.status(403).json({ success: false, message: "Access forbidden: you do not have staff permissions for this club." });
        }

        const {
            recipientUserIds,
            eventId,
            title,
            certificateType = "participation",
            description,
            signerName,
            signerRole,
        } = req.body;

        if (!Array.isArray(recipientUserIds) || recipientUserIds.length === 0) {
            return res.status(400).json({ success: false, message: "At least one recipient user ID must be provided." });
        }

        if (!title || typeof title !== "string" || title.trim().length < 3) {
            return res.status(400).json({ success: false, message: "A valid certificate title is required (minimum 3 characters)." });
        }

        const validTypes = ["participation", "excellence", "merit", "contributor", "organizer", "appreciation"];
        if (!validTypes.includes(certificateType)) {
            return res.status(400).json({ success: false, message: `Invalid certificate type. Allowed types: ${validTypes.join(", ")}` });
        }

        // If eventId provided, verify it belongs to this club
        let eventTitle: string | null = null;
        if (eventId) {
            const evCheck = await query(`SELECT title FROM club_events WHERE id = $1 AND club_id = $2 LIMIT 1;`, [eventId, club.id]);
            if (!evCheck.rows[0]) {
                return res.status(400).json({ success: false, message: "Specified event does not belong to this club." });
            }
            eventTitle = evCheck.rows[0].title;
        }

        // STRICT SECURITY ENFORCEMENT: Filter and verify all recipientUserIds
        // User MUST be:
        // 1) From the same college as the club (users.college_id = verified_clubs.college_id)
        // 2) OR registered / attended at least one event of this club
        // 3) OR an active team member / coordinator of this club
        // 4) OR the club owner
        const eligibleUsersRes = await query(
            `SELECT
                u.id,
                u.email,
                u.username,
                COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name
             FROM users u
             WHERE u.id = ANY($1::uuid[])
               AND (
                 (u.college_id IS NOT NULL AND u.college_id = (SELECT college_id FROM verified_clubs WHERE id = $2))
                 OR EXISTS (SELECT 1 FROM club_event_registrations cer WHERE cer.club_id = $2 AND cer.user_id = u.id)
                 OR EXISTS (SELECT 1 FROM club_team_members ctm WHERE ctm.club_id = $2 AND ctm.user_id = u.id)
                 OR EXISTS (SELECT 1 FROM club_memberships cm WHERE cm.club_id = $2 AND cm.user_id = u.id)
                 OR u.id = (SELECT auth_user_id FROM verified_clubs WHERE id = $2)
               );`,
            [recipientUserIds, club.id]
        );

        const eligibleUsers = eligibleUsersRes.rows;
        if (eligibleUsers.length === 0) {
            return res.status(400).json({
                success: false,
                message: "None of the selected recipients meet the eligibility requirements (must belong to your campus, have attended your events, or be a team member).",
            });
        }

        const clubSlugPrefix = (club.slug || club.name || "ORB")
            .replace(/[^a-zA-Z0-9]/g, "")
            .slice(0, 5)
            .toUpperCase() || "ORB";
        const currentYear = new Date().getFullYear();

        const issuedCertificates: any[] = [];
        const finalSignerName = signerName?.trim() || club.name || "Club Coordinator";
        const finalSignerRole = signerRole?.trim() || "Lead Coordinator";
        const cleanTitle = title.trim();
        const cleanDesc = description?.trim() || (
            eventId && eventTitle
                ? `Awarded for active participation and outstanding commitment in "${eventTitle}" organized by ${club.name}.`
                : `Awarded in recognition of meritorious contribution, commitment, and skill demonstrated with ${club.name}.`
        );

        // Transactional batch insert
        const client = await pool.connect();
        try {
            await client.query("BEGIN");

            for (const user of eligibleUsers) {
                // Generate a cryptographically secure, unique credential code
                const randomHex = crypto.randomBytes(3).toString("hex").toUpperCase();
                const credentialCode = `ORB-${clubSlugPrefix}-${currentYear}-${randomHex}`;

                const certInsertRes = await client.query(
                    `INSERT INTO club_certificates (
                        club_id,
                        user_id,
                        event_id,
                        title,
                        certificate_type,
                        recipient_name,
                        recipient_email,
                        description,
                        credential_code,
                        signer_name,
                        signer_role,
                        issued_by_user_id,
                        issue_date,
                        metadata
                    ) VALUES (
                        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13::jsonb
                    )
                    ON CONFLICT (club_id, user_id, COALESCE(event_id, '00000000-0000-0000-0000-000000000000'::uuid), certificate_type, title)
                    DO UPDATE SET
                        description = EXCLUDED.description,
                        signer_name = EXCLUDED.signer_name,
                        signer_role = EXCLUDED.signer_role,
                        updated_at = NOW()
                    RETURNING id, credential_code, title, certificate_type, issue_date;`,
                    [
                        club.id,
                        user.id,
                        eventId || null,
                        cleanTitle,
                        certificateType,
                        user.name,
                        user.email,
                        cleanDesc,
                        credentialCode,
                        finalSignerName,
                        finalSignerRole,
                        staffUserId,
                        JSON.stringify({
                            clubName: club.name,
                            clubSlug: club.slug,
                            collegeName: club.college_name,
                            eventTitle: eventTitle,
                        }),
                    ]
                );

                const cert = certInsertRes.rows[0];
                issuedCertificates.push({
                    id: cert.id,
                    recipientId: user.id,
                    recipientName: user.name,
                    credentialCode: cert.credential_code,
                });

                // Immediately create notification for the student in user_notifications
                const notifTitle = `🎓 Certificate Awarded!`;
                const notifBody = `${club.name} has awarded you the "${cleanTitle}" certificate.`;
                const notifMetadata = JSON.stringify({
                    type: "club_certificate",
                    certificateId: cert.id,
                    credentialCode: cert.credential_code,
                    clubId: club.id,
                    clubName: club.name,
                    clubSlug: club.slug,
                    eventId: eventId || null,
                    eventTitle: eventTitle || null,
                    certificateType,
                    title: cleanTitle,
                    issueDate: cert.issue_date,
                });

                await client.query(
                    `INSERT INTO user_notifications (
                        user_id,
                        recipient_id,
                        username,
                        title,
                        body,
                        type,
                        notification_type,
                        metadata,
                        idempotency_key,
                        is_read,
                        created_at
                    ) VALUES (
                        $1, $1, $2,
                        $3, $4,
                        'club_certificate',
                        'certificate_awarded',
                        $5::jsonb,
                        $6,
                        false,
                        NOW()
                    )
                    ON CONFLICT (idempotency_key) DO UPDATE SET
                        title = EXCLUDED.title,
                        body = EXCLUDED.body,
                        metadata = EXCLUDED.metadata;`,
                    [
                        user.id,
                        user.username,
                        notifTitle,
                        notifBody,
                        notifMetadata,
                        `cert-${cert.id}`,
                    ]
                );
            }

            await client.query("COMMIT");
        } catch (txnErr) {
            await client.query("ROLLBACK");
            throw txnErr;
        } finally {
            client.release();
        }

        // Credibility Engine Integration: Record certificate issuance evidence
        if (issuedCertificates.length > 0) {
            ClubCredibilityService.recordCredibilityEvent({
                clubId: club.id,
                eventId: eventId ? String(eventId) : undefined,
                sourceAction: "certificate_issued",
                reasonCode: "verified_credentials_awarded",
                outcomeQuality: 90,
                weightInputs: {
                    baseWeight: 0.8,
                    scope: "CAMPUS",
                    verifiedAttendees: issuedCertificates.length,
                    isNegativeOutcome: false,
                },
                factorBreakdown: {
                    issuedCount: issuedCertificates.length,
                    certificateType: certificateType || "participation",
                },
                actorId: staffUserId,
                idempotencyKey: `cert_batch_${club.id}_${Date.now()}`,
            }).catch((err) => console.error("[Credibility] Record certificate_issued error:", err));
        }

        const skippedCount = recipientUserIds.length - eligibleUsers.length;

        return res.json({
            success: true,
            message: `Successfully issued ${issuedCertificates.length} certificate(s).`,
            issuedCount: issuedCertificates.length,
            skippedCount,
            certificates: issuedCertificates,
        });
    } catch (err: any) {
        console.error("Issue certificates error:", err);
        return res.status(500).json({ success: false, message: err.message || "Failed to issue certificates." });
    }
});

/**
 * GET /api/club/certificates/issued
 * Returns all certificates issued by the authenticated staff's club.
 */
clubRouter.get("/certificates/issued", authenticate, async (req: Request, res: Response) => {
    try {
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const certsRes = await query(
            `SELECT
                c.id,
                c.title,
                c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName",
                c.recipient_email AS "recipientEmail",
                c.description,
                c.credential_code AS "credentialCode",
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                c.issue_date AS "issueDate",
                c.event_id AS "eventId",
                e.title AS "eventTitle",
                u.username AS "recipientUsername",
                COALESCE(u.photo_url, u.avatar_url) AS "recipientAvatarUrl"
             FROM club_certificates c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE c.club_id = $1
             ORDER BY c.issue_date DESC;`,
            [club.id]
        );

        return res.json({ success: true, count: certsRes.rows.length, certificates: certsRes.rows });
    } catch (err: any) {
        console.error("Fetch issued certificates error:", err);
        return res.status(500).json({ success: false, message: "Failed to load issued certificates." });
    }
});

/**
 * DELETE /api/club/certificates/:certificateId
 * Revokes or deletes an issued certificate.
 */
clubRouter.delete("/certificates/:certificateId", authenticate, async (req: Request, res: Response) => {
    try {
        const { certificateId } = req.params;
        const club = await getStaffClub(req.user!.id);
        if (!club) return res.status(403).json({ success: false, message: "Access forbidden." });

        const delRes = await query(
            `DELETE FROM club_certificates WHERE id = $1 AND club_id = $2 RETURNING id;`,
            [certificateId, club.id]
        );

        if (!delRes.rows[0]) {
            return res.status(404).json({ success: false, message: "Certificate not found or already deleted." });
        }

        return res.json({ success: true, message: "Certificate revoked successfully." });
    } catch (err: any) {
        console.error("Delete certificate error:", err);
        return res.status(500).json({ success: false, message: "Failed to delete certificate." });
    }
});

/**
 * GET /api/club/user/certificates
 * Returns all verified certificates awarded to the authenticated student/user.
 */
clubRouter.get("/user/certificates", authenticate, async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;

        const certsRes = await query(
            `SELECT
                c.id,
                c.club_id AS "clubId",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                vc.college_name AS "collegeName",
                c.event_id AS "eventId",
                e.title AS "eventTitle",
                e.starts_at AS "eventDate",
                c.title,
                c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName",
                c.recipient_email AS "recipientEmail",
                c.description,
                c.credential_code AS "credentialCode",
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                c.issue_date AS "issueDate",
                c.metadata,
                c.created_at AS "createdAt"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE c.user_id = $1
             ORDER BY c.issue_date DESC;`,
            [userId]
        );

        return res.json({ success: true, certificates: certsRes.rows });
    } catch (err: any) {
        console.error("Fetch user certificates error:", err);
        return res.status(500).json({ success: false, message: "Failed to retrieve certificates." });
    }
});

/**
 * GET /api/club/certificates/verify/:credentialCode
 * Public verification endpoint for any certificate code.
 */
clubRouter.get("/certificates/verify/:credentialCode", optionalAuthenticate, async (req: Request, res: Response) => {
    try {
        const { credentialCode } = req.params;

        const certRes = await query(
            `SELECT
                c.id,
                c.title,
                c.certificate_type AS "certificateType",
                c.recipient_name AS "recipientName",
                c.credential_code AS "credentialCode",
                c.issue_date AS "issueDate",
                c.signer_name AS "signerName",
                c.signer_role AS "signerRole",
                c.description,
                c.metadata,
                vc.id AS "clubId",
                vc.name AS "clubName",
                vc.slug AS "clubSlug",
                vc.college_name AS "collegeName",
                COALESCE(vc.logo_url, '') AS "clubLogoUrl",
                e.title AS "eventTitle",
                e.starts_at AS "eventStartsAt"
             FROM club_certificates c
             JOIN verified_clubs vc ON vc.id = c.club_id
             LEFT JOIN club_events e ON e.id = c.event_id
             WHERE LOWER(c.credential_code) = LOWER($1)
             LIMIT 1;`,
            [credentialCode]
        );

        if (!certRes.rows[0]) {
            return res.status(404).json({
                success: false,
                verified: false,
                message: "Certificate not found. The credential code may be invalid or revoked.",
            });
        }

        return res.json({
            success: true,
            verified: true,
            certificate: certRes.rows[0],
        });
    } catch (err: any) {
        console.error("Verify certificate error:", err);
        return res.status(500).json({ success: false, message: "Verification failed." });
    }
});

// Wildcard public club profile routes placed at the bottom so they do not collide with specific endpoints
clubRouter.get("/public/:slug", optionalAuthenticate, handleGetPublicClub);
clubRouter.get("/:slug", optionalAuthenticate, handleGetPublicClub);

export default clubRouter;


/**
 * GET /api/club/events/guardian-consent/verify
 * Public endpoint allowing parents/guardians to inspect the event details & minor registration
 */
clubRouter.get("/events/guardian-consent/verify", async (req: Request, res: Response) => {
    try {
        const token = typeof req.query.token === "string" ? req.query.token.trim() : "";
        const registrationId = typeof req.query.registrationId === "string" ? req.query.registrationId.trim() : "";

        if (!token || !registrationId) {
            return res.status(400).json({
                success: false,
                message: "Valid consent token and registration ID are required.",
            });
        }

        const regRes = await query(
            `SELECT r.id, r.event_id, r.applicant_name AS "applicantName", r.applicant_email AS "applicantEmail",
                    r.is_attendee_under_18 AS "isAttendeeUnder18", r.guardian_name AS "guardianName",
                    r.guardian_email AS "guardianEmail", r.guardian_phone AS "guardianPhone",
                    r.guardian_relationship AS "guardianRelationship", r.guardian_consent_status AS "guardianConsentStatus",
                    r.guardian_consent_token_expires_at AS "expiresAt", r.guardian_consent_verified_at AS "verifiedAt",
                    e.title AS "eventTitle", e.description AS "eventDescription", e.starts_at AS "startsAt",
                    e.venue_or_location AS "venue", vc.name AS "clubName", vc.college_name AS "collegeName"
             FROM club_event_registrations r
             JOIN club_events e ON e.id = r.event_id
             JOIN verified_clubs vc ON vc.id = e.club_id
             WHERE r.id = $1::uuid AND r.guardian_consent_token = $2
             LIMIT 1;`,
            [registrationId, token]
        );

        if (!regRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "Consent record not found or security token is invalid.",
            });
        }

        const reg = regRes.rows[0];

        // Check if token has expired
        if (reg.expiresAt && new Date(reg.expiresAt) < new Date()) {
            return res.status(410).json({
                success: false,
                message: "This guardian consent request link has expired. Please have the student re-apply.",
                isExpired: true,
            });
        }

        return res.json({
            success: true,
            details: reg,
        });
    } catch (err: any) {
        console.error("Guardian consent verify error:", err);
        return res.status(500).json({ success: false, message: "Failed to verify guardian consent token." });
    }
});

/**
 * POST /api/club/events/guardian-consent/confirm
 * Public endpoint for parent/guardian to grant or decline electronic consent
 */
clubRouter.post("/events/guardian-consent/confirm", async (req: Request, res: Response) => {
    try {
        const { token, registrationId, action, guardianName, relationshipConfirm, remarks } = req.body || {};

        if (!token || !registrationId || !["grant", "reject"].includes(action)) {
            return res.status(400).json({
                success: false,
                message: "Token, registrationId, and valid action ('grant' or 'reject') are required.",
            });
        }

        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || req.ip || "unknown";
        const userAgent = req.headers["user-agent"] || "unknown";

        const regRes = await query(
            `SELECT id, event_id, guardian_consent_status, guardian_consent_token_expires_at, applicant_name
             FROM club_event_registrations
             WHERE id = $1::uuid AND guardian_consent_token = $2
             LIMIT 1;`,
            [registrationId, token]
        );

        if (!regRes.rows[0]) {
            return res.status(404).json({
                success: false,
                message: "Invalid consent record or authorization token.",
            });
        }

        const reg = regRes.rows[0];

        if (reg.guardian_consent_token_expires_at && new Date(reg.guardian_consent_token_expires_at) < new Date()) {
            return res.status(410).json({
                success: false,
                message: "This consent request has expired.",
                isExpired: true,
            });
        }

        if (action === "grant") {
            await query(
                `UPDATE club_event_registrations
                 SET guardian_consent_status = 'verified',
                     guardian_consent_verified_at = NOW(),
                     guardian_consent_ip = $1,
                     guardian_consent_user_agent = $2,
                     guardian_name = COALESCE($3, guardian_name),
                     guardian_relationship = COALESCE($4, guardian_relationship),
                     updated_at = NOW()
                 WHERE id = $5::uuid;`,
                [ip, userAgent, guardianName || null, relationshipConfirm || null, registrationId]
            );

            return res.json({
                success: true,
                message: "Parental/guardian consent has been confirmed successfully. The student's registration is now forwarded to the event coordinators.",
                consentStatus: "verified",
            });
        } else {
            // Action === "reject"
            await query(
                `UPDATE club_event_registrations
                 SET guardian_consent_status = 'rejected',
                     status = 'rejected',
                     review_notes = 'Parental/guardian consent was declined by guardian.',
                     reviewed_at = NOW(),
                     guardian_consent_ip = $1,
                     guardian_consent_user_agent = $2,
                     updated_at = NOW()
                 WHERE id = $3::uuid;`,
                [ip, userAgent, registrationId]
            );

            return res.json({
                success: true,
                message: "Consent declined. The collegiate event registration has been cancelled.",
                consentStatus: "rejected",
            });
        }
    } catch (err: any) {
        console.error("Guardian consent confirm error:", err);
        return res.status(500).json({ success: false, message: "Failed to submit guardian consent decision." });
    }
});
